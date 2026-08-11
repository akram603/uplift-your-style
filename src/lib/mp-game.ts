// Two-player (human vs human) auction engine for local network multiplayer.
// The host owns the authoritative state; both peers apply the same reducer so
// the host can simply broadcast the resulting snapshot after every action.

import { filterPool, type Player, type PoolFilterConfig } from './players'
import type { TeamSize } from './formations'
import type { LogEntry, LogKind } from './game'
import { increment } from './game'

export type PeerId = 'host' | 'guest'

export interface MpTeam {
  id: PeerId
  name: string
  budget: number
  squad: Player[]
}

export interface MpResult {
  revealedWinnerId: PeerId | null
  revealedPrice: number
  hiddenWinnerId: PeerId | null
  hiddenPrice: number
}

export interface MpState {
  phase: 'bidding' | 'resolved' | 'over'
  teamSize: TeamSize
  formationId?: string
  totalRounds: number
  round: number
  teams: Record<PeerId, MpTeam>
  pool: Player[]
  revealed: Player
  hidden: Player
  base: number
  currentBid: number
  highBidderId: PeerId | null
  /** Whose move it is right now. */
  turnId: PeerId
  result: MpResult | null
  log: LogEntry[]
}

export interface MpConfig {
  teamSize: TeamSize
  formationId?: string
  startingBudget: number
  filter: PoolFilterConfig
  hostName: string
  guestName: string
}

export type MpAction =
  | { type: 'raise'; by: PeerId; amount: number }
  | { type: 'concede'; by: PeerId }
  | { type: 'next'; by: PeerId }

let logId = 0
function pushLog(state: MpState, kind: LogKind, text: string) {
  state.log = [{ id: logId++, kind, text }, ...state.log].slice(0, 40)
}

export function other(id: PeerId): PeerId {
  return id === 'host' ? 'guest' : 'host'
}

function draw(pool: Player[]): { revealed: Player; hidden: Player; rest: Player[] } {
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const revealed = shuffled[0]!
  const hidden = shuffled[1]!
  return {
    revealed,
    hidden,
    rest: shuffled.slice(2),
  }
}

export function createMpGame(config: MpConfig): MpState {
  const pool = filterPool(config.filter)
  const { revealed, hidden, rest } = draw(pool)
  const state: MpState = {
    phase: 'bidding',
    teamSize: config.teamSize,
    formationId: config.formationId,
    totalRounds: config.teamSize,
    round: 1,
    teams: {
      host: { id: 'host', name: config.hostName, budget: config.startingBudget, squad: [] },
      guest: { id: 'guest', name: config.guestName, budget: config.startingBudget, squad: [] },
    },
    pool: rest,
    revealed,
    hidden,
    base: Math.max(2, Math.round(revealed.value * 0.35)),
    currentBid: 0,
    highBidderId: null,
    turnId: 'host',
    result: null,
    log: [],
  }
  pushLog(state, 'info', `Round 1: ${revealed.name} is on the block. Opening at $${state.base}M.`)
  return state
}

export function minMpBid(state: MpState): number {
  if (state.highBidderId === null) return state.base
  return state.currentBid + increment(state.currentBid)
}

export function hiddenCost(state: MpState, recipient: PeerId): number {
  const price = state.currentBid || state.base
  return Math.min(state.teams[recipient].budget, Math.max(2, Math.round(price * 0.55)))
}

function clone(state: MpState): MpState {
  return {
    ...state,
    teams: {
      host: { ...state.teams.host, squad: [...state.teams.host.squad] },
      guest: { ...state.teams.guest, squad: [...state.teams.guest.squad] },
    },
    pool: [...state.pool],
    log: [...state.log],
    result: state.result ? { ...state.result } : null,
  }
}

/** Pure reducer: returns a new state, or the same state if the action is illegal. */
export function reduceMp(prev: MpState, action: MpAction): MpState {
  if (action.type === 'raise') {
    if (prev.phase !== 'bidding' || prev.turnId !== action.by) return prev
    const min = minMpBid(prev)
    const bid = Math.floor(action.amount)
    if (!Number.isFinite(bid) || bid < min || bid > prev.teams[action.by].budget) return prev
    const state = clone(prev)
    state.currentBid = bid
    state.highBidderId = action.by
    state.turnId = other(action.by)
    pushLog(state, 'bid', `${state.teams[action.by].name} bids $${bid}M for ${state.revealed.name}.`)
    return state
  }

  if (action.type === 'concede') {
    if (prev.phase !== 'bidding' || prev.turnId !== action.by) return prev
    const state = clone(prev)
    const loser = action.by
    const winner = other(action.by)
    // No bids yet: the opponent takes the revealed player at the base price.
    const price = state.highBidderId === winner ? state.currentBid : state.base
    const affordable = Math.min(price, state.teams[winner].budget)
    const hidden = hiddenCost(state, loser)

    state.result = {
      revealedWinnerId: winner,
      revealedPrice: affordable,
      hiddenWinnerId: loser,
      hiddenPrice: hidden,
    }
    state.phase = 'resolved'
    pushLog(
      state,
      'win',
      `${state.teams[winner].name} signs ${state.revealed.name} for $${affordable}M.`,
    )
    pushLog(
      state,
      'hidden',
      `${state.teams[loser].name} is compensated with the hidden player, ${state.hidden.name}, for $${hidden}M.`,
    )
    return state
  }

  if (action.type === 'next') {
    if (prev.phase !== 'resolved' || !prev.result) return prev
    const state = clone(prev)
    const r = state.result!
    for (const id of ['host', 'guest'] as PeerId[]) {
      const team = state.teams[id]
      if (id === r.revealedWinnerId) {
        team.budget = Math.max(0, Math.round(team.budget - r.revealedPrice))
        team.squad = [...team.squad, state.revealed]
      }
      if (id === r.hiddenWinnerId) {
        team.budget = Math.max(0, Math.round(team.budget - r.hiddenPrice))
        team.squad = [...team.squad, state.hidden]
      }
    }

    const squadFull = state.teams.host.squad.length >= state.teamSize
    if (squadFull || state.pool.length < 2 || state.round >= state.totalRounds) {
      state.phase = 'over'
      state.result = null
      return state
    }

    const { revealed, hidden, rest } = draw(state.pool)
    state.round += 1
    state.revealed = revealed
    state.hidden = hidden
    state.pool = rest
    state.base = Math.max(2, Math.round(revealed.value * 0.35))
    state.currentBid = 0
    state.highBidderId = null
    state.result = null
    state.phase = 'bidding'
    // Alternate who opens each round for fairness.
    state.turnId = state.round % 2 === 1 ? 'host' : 'guest'
    pushLog(
      state,
      'info',
      `Round ${state.round}: ${revealed.name} is on the block. Opening at $${state.base}M.`,
    )
    return state
  }

  return prev
}
