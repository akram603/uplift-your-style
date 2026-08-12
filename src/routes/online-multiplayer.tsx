import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SetupScreen, type SetupResult } from "@/components/game/setup-screen";
import { MpAuctionScreen } from "@/components/game/mp-auction-screen";
import { SquadDashboard } from "@/components/game/squad-dashboard";
import { Button } from "@/components/ui/button";
import {
  createMpGame,
  other,
  reduceMp,
  type MpAction,
  type MpState,
  type PeerId,
} from "@/lib/mp-game";
import { sfx } from "@/lib/sfx";
import type { NetMessage, NetSession, NetStatus } from "@/lib/net";
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  Loader2,
  RotateCcw,
  Trophy,
  Unplug,
  Wifi,
  PlayCircle,
} from "lucide-react";
import { MatchSimScreen } from "@/components/game/match-sim-screen";

export const Route = createFileRoute("/online-multiplayer")({
  head: () => ({
    meta: [
      { title: "Online Multiplayer Draft — Football Auction Draft" },
      {
        name: "description",
        content:
          "Draft head-to-head with a friend anywhere. Host a room, share the invite link, and bid in real time over the internet.",
      },
      { property: "og:title", content: "Online Multiplayer Draft — Football Auction Draft" },
      {
        property: "og:description",
        content: "Host a room, share the invite link, and draft head-to-head in real time.",
      },
    ],
  }),
  component: OnlineMultiplayer,
});

type Screen = "menu" | "host" | "join" | "playing";

const DEFAULT_NAMES: Record<PeerId, string> = { host: "Host Club", guest: "Guest Club" };

function OnlineMultiplayer() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [role, setRole] = useState<PeerId>("host");
  const [room, setRoom] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState<NetStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [state, setState] = useState<MpState | null>(null);
  const [myName, setMyName] = useState<string>(DEFAULT_NAMES.host);
  const [slow, setSlow] = useState(false);
  const [copied, setCopied] = useState(false);

  const sessionRef = useRef<NetSession | null>(null);
  const stateRef = useRef<MpState | null>(null);
  const roleRef = useRef<PeerId>("host");
  const lastSetupRef = useRef<SetupResult | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // Pre-fill the join code when arriving via an invite link (?room=XXXXX).
  useEffect(() => {
    const fromUrl = roomFromUrl();
    if (fromUrl) {
      setJoinCode(fromUrl);
      setScreen("menu");
    }
  }, []);

  // Surface a hint when the peer link takes unusually long (restrictive network).
  useEffect(() => {
    if (status === "connected" || (screen !== "host" && screen !== "join")) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, [status, screen]);

  useEffect(
    () => () => {
      sessionRef.current?.close();
      sessionRef.current = null;
    },
    [],
  );

  const handleMessage = useCallback((msg: NetMessage) => {
    if (msg.kind === "state") {
      setState(msg.state);
      setScreen("playing");
      return;
    }
    if (msg.kind === "hello") {
      setPeerName(msg.name);
      return;
    }
    if (msg.kind === "action") {
      // Only the host is authoritative: it applies guest actions and rebroadcasts.
      if (roleRef.current !== "host") return;
      const current = stateRef.current;
      if (!current) return;
      const next = reduceMp(current, msg.action);
      setState(next);
      sessionRef.current?.send({ kind: "state", state: next });
    }
  }, []);

  const startHosting = useCallback(async () => {
    setError(null);
    setCopied(false);
    const net = await import("@/lib/net");
    const id = net.makeRoomId();
    setRoom(id);
    setRole("host");
    setScreen("host");
    sessionRef.current = await net.host(id, {
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === "error") setError(detail ?? "Connection error");
        if (s === "connected") {
          sfx.win();
          sessionRef.current?.send({ kind: "hello", name: myName.trim() || DEFAULT_NAMES.host });
        }
      },
      onMessage: handleMessage,
    });
  }, [handleMessage, myName]);

  const startJoining = useCallback(async () => {
    setError(null);
    setRole("guest");
    setScreen("join");
    const net = await import("@/lib/net");
    sessionRef.current = await net.join(joinCode, {
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === "error")
          setError(detail ?? "Could not reach that room. Check the Room ID and try again.");
        if (s === "connected") {
          sfx.win();
          sessionRef.current?.send({ kind: "hello", name: myName.trim() || DEFAULT_NAMES.guest });
        }
      },
      onMessage: handleMessage,
    });
  }, [handleMessage, joinCode, myName]);

  const hostStartGame = useCallback(
    (setup: SetupResult) => {
      lastSetupRef.current = setup;
      const game = createMpGame({
        teamSize: setup.teamSize,
        formationId: setup.formationId,
        startingBudget: setup.startingBudget,
        filter: setup.filter,
        hostName: myName.trim() || DEFAULT_NAMES.host,
        guestName: peerName?.trim() || DEFAULT_NAMES.guest,
      });
      setState(game);
      setScreen("playing");
      sessionRef.current?.send({ kind: "state", state: game });
    },
    [myName, peerName],
  );

  const rematch = useCallback(() => {
    const setup = lastSetupRef.current;
    if (!setup || roleRef.current !== "host") return;
    const game = createMpGame({
      teamSize: setup.teamSize,
      formationId: setup.formationId,
      startingBudget: setup.startingBudget,
      filter: setup.filter,
      hostName: myName.trim() || DEFAULT_NAMES.host,
      guestName: peerName?.trim() || DEFAULT_NAMES.guest,
    });
    setState(game);
    setScreen("playing");
    sessionRef.current?.send({ kind: "state", state: game });
  }, [myName, peerName]);

  const dispatch = useCallback(
    (action: MpAction) => {
      if (role === "host") {
        const current = stateRef.current;
        if (!current) return;
        const next = reduceMp(current, action);
        setState(next);
        sessionRef.current?.send({ kind: "state", state: next });
      } else {
        sessionRef.current?.send({ kind: "action", action });
      }
    },
    [role],
  );

  const leave = () => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setState(null);
    setStatus("idle");
    setPeerName(null);
    setError(null);
    setScreen("menu");
  };

  const copyInvite = async () => {
    const net = await import("@/lib/net");
    const link = net.makeInviteLink(room);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const disconnected =
    screen === "playing" && (status === "closed" || status === "error");

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Main menu
      </Link>

      {screen === "menu" && (
        <div className="mx-auto max-w-xl">
          <h1 className="font-display text-3xl font-bold">Online Multiplayer</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Two managers, anywhere in the world. The host opens a room and shares the invite
            link; the friend joins and both drafts stay in sync in real time. No AI takes part.
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <label
              htmlFor="my-name"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Your club name
            </label>
            <input
              id="my-name"
              value={myName}
              maxLength={18}
              onChange={(e) => setMyName(e.target.value)}
              placeholder="e.g. Goalden FC"
              className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="mt-4 grid gap-3">
            <Button className="h-12 text-base" onClick={startHosting}>
              <Wifi className="h-4 w-4" /> Host Game
            </Button>
            <div className="rounded-2xl border border-border bg-card p-4">
              <label
                htmlFor="room"
                className="mb-1.5 block text-xs font-medium text-muted-foreground"
              >
                Room ID from the host
              </label>
              <div className="flex gap-2">
                <input
                  id="room"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. K7Q2M"
                  className="h-12 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-lg tracking-widest outline-none focus:border-primary"
                />
                <Button
                  variant="secondary"
                  className="h-12"
                  disabled={joinCode.trim().length < 4}
                  onClick={startJoining}
                >
                  Join Game
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === "host" && (
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-3xl font-bold">Room Ready</h1>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Room ID
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="font-mono text-4xl font-bold tracking-[0.3em] text-primary">
                {room}
              </span>
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => navigator.clipboard?.writeText(room)}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              On the other device, open this app, tap{" "}
              <span className="text-foreground">Online Multiplayer</span>, enter this Room ID and
              press Join Game. Works over the internet — no need to be on the same Wi-Fi.
            </p>
            <div className="mt-3">
              <Button variant="outline" className="h-10" onClick={copyInvite}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-money" /> Link copied!
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" /> Copy invite link
                  </>
                )}
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm">
              {status === "connected" ? (
                <span className="font-medium text-money">
                  {peerName ?? "Opponent"} connected — you can start the draft.
                </span>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Waiting for the other player…</span>
                </>
              )}
            </p>
            {slow && status !== "connected" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Still waiting. Send the invite link or double-check the Room ID. Very strict
                networks may need a moment to relay the connection.
              </p>
            )}
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Draft settings</h2>
            <SetupScreen
              onStart={hostStartGame}
              showOpponents={false}
              ctaLabel={status === "connected" ? "Start Draft" : "Waiting for opponent…"}
            />
          </div>
          <div className="mt-4">
            <Button variant="ghost" onClick={leave}>
              Cancel room
            </Button>
          </div>
        </div>
      )}

      {screen === "join" && (
        <div className="mx-auto max-w-xl">
          <h1 className="font-display text-3xl font-bold">Joining Room {joinCode}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            {status === "connected" ? (
              <>
                <span className="font-medium text-money">
                  Connected to {peerName ?? "the host"} — waiting for them to start the draft…
                </span>
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connecting to the host…
              </>
            )}
          </p>
          {slow && status !== "connected" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Taking a while — double-check the Room ID. Connections over the internet can take a
              few extra seconds to relay.
            </p>
          )}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

          <div className="mt-4">
            <Button variant="ghost" onClick={leave}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {screen === "playing" && state && state.phase !== "over" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold">Head-to-Head Draft</h1>
            <span className="text-xs text-muted-foreground">
              {status === "connected" ? "Connected" : "Connection lost"}
            </span>
          </div>
          <MpAuctionScreen state={state} meId={role} onAction={dispatch} />
          {disconnected && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
              <p className="flex items-center gap-2 text-sm text-destructive">
                <Unplug className="h-4 w-4 shrink-0" />
                The connection was lost. The draft can't continue — both players should head back
                and create a new room.
              </p>
              <Button variant="destructive" className="h-10" onClick={leave}>
                Leave Room
              </Button>
            </div>
          )}
        </>
      )}

      {screen === "playing" && state && state.phase === "over" && (
        <MpGameOver
          state={state}
          meId={role}
          isHost={role === "host"}
          onSimulate={() => dispatch({ type: "simulate" })}
          onRematch={rematch}
          onLeave={leave}
        />
      )}

      {screen === "playing" && state && state.phase === "match" && state.match && (
        <MatchSimScreen
          sim={state.match}
          names={{ host: state.teams.host.name, guest: state.teams.guest.name }}
          points={state.points}
          canAdvance={role === "host"}
          onNextRound={() => dispatch({ type: "newDraft" })}
        />
      )}
    </main>
  );
}

function MpGameOver({
  state,
  meId,
  isHost,
  onSimulate,
  onRematch,
  onLeave,
}: {
  state: MpState;
  meId: PeerId;
  isHost: boolean;
  onSimulate: () => void;
  onRematch: () => void;
  onLeave: () => void;
}) {
  const me = state.teams[meId];
  const rival = state.teams[other(meId)];
  const myScore = me.squad.reduce((s, p) => s + p.ovr, 0);
  const rivalScore = rival.squad.reduce((s, p) => s + p.ovr, 0);
  const verdict = myScore === rivalScore ? "Dead heat" : myScore > rivalScore ? "You win!" : "You lose";

  return (
    <div className="animate-pop">
      <header className="mb-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3.5 w-3.5" /> Draft Complete
        </span>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{verdict}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {me.name} <span className="font-mono text-foreground">{myScore}</span> · {rival.name}{" "}
          <span className="font-mono text-foreground">{rivalScore}</span>
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <SquadDashboard
          name={me.name}
          budget={me.budget}
          squad={me.squad}
          teamSize={state.teamSize}
          formationId={state.formationId}
        />
        <SquadDashboard
          name={rival.name}
          budget={rival.budget}
          squad={rival.squad}
          teamSize={state.teamSize}
          formationId={state.formationId}
        />
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button className="h-12 w-full text-base sm:col-span-2" onClick={onSimulate}>
          <PlayCircle className="h-4 w-4" /> Start Match Simulation
        </Button>
        {isHost ? (
          <Button className="h-12 w-full text-base" onClick={onRematch}>
            <RotateCcw className="h-4 w-4" /> Rematch (host)
          </Button>
        ) : (
          <p className="flex items-center justify-center text-xs text-muted-foreground">
            Waiting for the host to start a rematch…
          </p>
        )}
        <Button variant="secondary" className="h-12 w-full text-base" onClick={onLeave}>
          Leave Room
        </Button>
      </div>
    </div>
  );
}

function roomFromUrl(): string {
  if (typeof location === "undefined") return "";
  const params = new URLSearchParams(location.search);
  return (params.get("room") ?? "").trim().toUpperCase();
}
