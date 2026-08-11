// Peer-to-peer transport for the two-player draft.
//
// Uses WebRTC data channels (via PeerJS). Traffic flows directly between the
// two devices when possible; a public TURN relay (OpenRelay) keeps the
// connection working across different networks / strict NATs, so the Room ID
// works over the internet, not just the same Wi-Fi.
//
// Browser-only: import this module lazily (inside an effect/handler).

import type { DataConnection, Peer } from "peerjs";
import type { MpAction, MpState } from "./mp-game";

export type NetStatus = "idle" | "hosting" | "joining" | "connected" | "closed" | "error";

export type NetMessage =
  | { kind: "state"; state: MpState }
  | { kind: "action"; action: MpAction }
  | { kind: "hello"; name: string };

const ROOM_PREFIX = "fad-";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Path of the multiplayer screen (used to build shareable invite links). */
export const MULTIPLAYER_PATH = "/online-multiplayer";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Public relay — enables play across different networks. Free tier is rate
  // limited but ample for a head-to-head draft.
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:80?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

export function makeRoomId(): string {
  let out = "";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function roomToPeerId(room: string): string {
  return ROOM_PREFIX + room.trim().toUpperCase();
}

/** Shareable invite link for a room (host copies this to send to a friend). */
export function makeInviteLink(room: string): string {
  const base = typeof location !== "undefined" ? location.origin : "";
  return `${base}${MULTIPLAYER_PATH}?room=${room.trim().toUpperCase()}`;
}

/** Pulls a room code out of the current URL (?room=XXXXX), if present. */
export function roomFromUrl(): string {
  if (typeof location === "undefined") return "";
  const params = new URLSearchParams(location.search);
  return (params.get("room") ?? "").trim().toUpperCase();
}

export interface NetHandlers {
  onStatus: (status: NetStatus, detail?: string) => void;
  onMessage: (msg: NetMessage) => void;
}

export interface NetSession {
  send: (msg: NetMessage) => void;
  close: () => void;
}

async function createPeer(id?: string): Promise<Peer> {
  const { default: PeerCtor } = await import("peerjs");
  const opts = { config: { iceServers: ICE_SERVERS } };
  return id ? new PeerCtor(id, opts) : new PeerCtor(opts);
}

function wire(conn: DataConnection, handlers: NetHandlers) {
  conn.on("open", () => handlers.onStatus("connected"));
  conn.on("data", (data) => {
    try {
      const msg = (typeof data === "string" ? JSON.parse(data) : data) as NetMessage;
      handlers.onMessage(msg);
    } catch {
      /* ignore malformed frames */
    }
  });
  conn.on("close", () => handlers.onStatus("closed"));
  conn.on("error", (err) => handlers.onStatus("error", String(err?.message ?? err)));
}

/** Opens a room and waits for the other player to join. */
export async function host(room: string, handlers: NetHandlers): Promise<NetSession> {
  handlers.onStatus("hosting");
  const peer = await createPeer(roomToPeerId(room));
  let conn: DataConnection | null = null;

  peer.on("error", (err) => handlers.onStatus("error", err.message));
  peer.on("connection", (incoming) => {
    if (conn) {
      incoming.close();
      return;
    }
    conn = incoming;
    wire(incoming, handlers);
  });

  return {
    send: (msg) => {
      if (conn?.open) conn.send(msg);
    },
    close: () => {
      conn?.close();
      peer.destroy();
    },
  };
}

/** Joins an existing room by ID. */
export async function join(room: string, handlers: NetHandlers): Promise<NetSession> {
  handlers.onStatus("joining");
  const peer = await createPeer();
  let conn: DataConnection | null = null;

  peer.on("error", (err) => handlers.onStatus("error", err.message));
  await new Promise<void>((resolve) => {
    if (peer.open) return resolve();
    peer.on("open", () => resolve());
  });

  conn = peer.connect(roomToPeerId(room), { reliable: true });
  wire(conn, handlers);

  return {
    send: (msg) => {
      if (conn?.open) conn.send(msg);
    },
    close: () => {
      conn?.close();
      peer.destroy();
    },
  };
}
