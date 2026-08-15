// Compact wire format for the online draft.
//
// The authoritative state carries the whole remaining player pool (hundreds of
// objects). The guest never draws from it, so we strip it before sending and
// re-attach an empty pool on arrival — this cuts a typical frame from ~200 KB
// to a couple of KB, which is what keeps low-end phones and slow links smooth.

import type { MpState, PeerId } from './mp-game'

export interface WireState extends Omit<MpState, 'pool'> {
  /** Pool is host-only; we only ship the count for display/debug. */
  poolCount: number
}

/** Small delta sent for the most frequent event: a raise during bidding. */
export interface BidPatch {
  rev: number
  currentBid: number
  highBidderId: PeerId | null
  turnId: PeerId
  endsAt: number
  text: string
}

export function encodeState(state: MpState): WireState {
  const { pool, ...rest } = state
  return {
    ...rest,
    poolCount: pool.length,
    // Only the most recent entries are ever rendered.
    log: state.log.slice(0, 20),
  }
}

export function decodeState(wire: WireState, localPool: readonly []= []): MpState {
  const { poolCount: _poolCount, ...rest } = wire
  return { ...rest, pool: localPool as unknown as MpState['pool'] }
}

export function toBidPatch(state: MpState): BidPatch {
  return {
    rev: state.rev,
    currentBid: state.currentBid,
    highBidderId: state.highBidderId,
    turnId: state.turnId,
    endsAt: state.endsAt,
    text: state.log[0]?.text ?? '',
  }
}

let patchLogId = -1

/** Applies a bid delta without cloning squads/pool — cheap on weak devices. */
export function applyBidPatch(state: MpState, patch: BidPatch): MpState {
  if (patch.rev <= state.rev || state.phase !== 'bidding') return state
  return {
    ...state,
    rev: patch.rev,
    currentBid: patch.currentBid,
    highBidderId: patch.highBidderId,
    turnId: patch.turnId,
    endsAt: patch.endsAt,
    log: patch.text
      ? [{ id: patchLogId--, kind: 'bid' as const, text: patch.text }, ...state.log].slice(0, 40)
      : state.log,
  }
}

/** Shifts host timestamps into the local clock so countdowns match on both ends. */
export function shiftClock<T extends { endsAt: number }>(value: T, offsetMs: number): T {
  return offsetMs ? { ...value, endsAt: value.endsAt - offsetMs } : value
}