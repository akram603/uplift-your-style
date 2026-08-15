// Two-player (human vs human) auction engine for local network multiplayer.
// The host owns the authoritative state; both peers apply the same reducer so
// the host can simply broadcast the resulting snapshot after every action.

import { filterPool, type Player, type PoolFilterConfig } from './players'
import type { TeamSize } from './formations'
import { pickNeededPosition, playersForPosition, positionNeedCounts } from './formations'
import type { LogEntry, LogKind } from './game'
import { simulateHeadToHead, type MatchSim } from './mp-match'

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
  phase: 'bidding' | 'resolved' | 'over' | 'match'
  /** Monotonic revision — used to drop stale/out-of-order network frames. */
  rev: number
  teamSize: TeamSize
  formationId?: string | undefined
  totalRounds: number
  round: number
  teams: Record<PeerId, MpTeam>
  pool: Player[]
  revealed: Player
  hidden: Player
  base: number
  currentBid: number
  highBidderId: PeerId | null
  /** Who opened this round (kept for display); anyone may bid at any time. */
  turnId: PeerId
  /** Epoch ms when the live bidding countdown for this round expires. */
  endsAt: number
  result: MpResult | null
  log: LogEntry[]
  /** Config kept so the next round of the series can be rebuilt in place. */
  config: MpConfig
  /** Leaderboard: 3 points a win, 1 a draw, 0 a loss. */
  points: Record<PeerId, number>
  /** Last simulated match, shown after the draft finishes. */
  match: MatchSim | null
}

export interface MpConfig {
  teamSize: TeamSize
  formationId?: string | undefined
  startingBudget: number
  filter: PoolFilterConfig
  hostName: string
  guestName: string
}

export type MpAction =
  | { type: 'raise'; by: PeerId; amount: number }
  | { type: 'concede'; by: PeerId }
  | { type: 'next'; by: PeerId }
  | { type: 'timeout' }
  | { type: 'simulate' }
  | { type: 'newDraft' }

/** Seconds each player has to keep bidding before the hammer falls. */
export const ROUND_SECONDS = 20
/** Countdown restored after every bid. */
export const BID_EXTENSION_SECONDS = 10

let logId = 0
function pushLog(state: MpState, kind: LogKind, text: string) {
  state.log = [{ id: logId++, kind, text }, ...state.log].slice(0, 40)
}

export function other(id: PeerId): PeerId {
  return id === 'host' ? 'guest' : 'host'
}

function draw(
  pool: Player[],
  state?: Pick<MpState, 'teams' | 'teamSize' | 'formationId'>,
): { revealed: Player; hidden: Player; rest: Player[] } {
  let eligible = pool
  if (state) {
    // Auction a position both squads still legally need (goalkeeper included).
    const need = positionNeedCounts(state.teams.host.squad, state.teamSize, state.formationId)
    eligible = playersForPosition(pool, pickNeededPosition(need))
  }
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  const revealed = shuffled[0]!
  const hidden = shuffled[1]!
  const taken = new Set([revealed.id, hidden.id])
  return { revealed, hidden, rest: pool.filter((p) => !taken.has(p.id)) }
}

export function createMpGame(
  config: MpConfig,
  points?: Record<PeerId, number>,
  rev = 0,
): MpState {
  const pool = filterPool(config.filter)
  const seed = {
    teams: {
      host: { id: 'host' as PeerId, name: config.hostName, budget: 0, squad: [] },
      guest: { id: 'guest' as PeerId, name: config.guestName, budget: 0, squad: [] },
    },
    teamSize: config.teamSize,
    formationId: config.formationId,
  }
  const { revealed, hidden, rest } = draw(pool, seed)
  const state: MpState = {
    phase: 'bidding',
    rev,
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
    base: 0,
    currentBid: 0,
    highBidderId: null,
    turnId: 'host',
    endsAt: Date.now() + ROUND_SECONDS * 1000,
    result: null,
    log: [],
    config,
    points: points ?? { host: 0, guest: 0 },
    match: null,
  }
  pushLog(
    state,
    'info',
    `Round 1: ${revealed.name} (${revealed.position}) is up. Bidding opens at $0M — type any amount.`,
  )
  return state
}

/** Any amount above the current bid is legal (bidding starts at zero). */
export function minMpBid(state: MpState): number {
  return state.highBidderId === null ? 1 : state.currentBid + 1
}

export function hiddenCost(state: MpState, recipient: PeerId): number {
  const price = Math.max(state.currentBid, Math.round(state.hidden.value * 0.4))
  return Math.min(state.teams[recipient].budget, Math.max(2, Math.round(price * 0.55)))
}

function clone(state: MpState): MpState {
  return {
    ...state,
    rev: state.rev + 1,
    teams: {
      host: { ...state.teams.host, squad: [...state.teams.host.squad] },
      guest: { ...state.teams.guest, squad: [...state.teams.guest.squad] },
    },
    pool: [...state.pool],
    log: [...state.log],
    result: state.result ? { ...state.result } : null,
    points: { ...state.points },
  }
}

/** Awards the revealed player to `winner` and the hidden one to the other side. */
function settle(state: MpState, winner: PeerId): MpState {
  const loser = other(winner)
  const price = Math.min(Math.max(1, state.currentBid), state.teams[winner].budget)
  const hidden = hiddenCost(state, loser)
  state.result = {
    revealedWinnerId: winner,
    revealedPrice: price,
    hiddenWinnerId: loser,
    hiddenPrice: hidden,
  }
  state.phase = 'resolved'
  pushLog(state, 'win', `${state.teams[winner].name} signs ${state.revealed.name} for $${price}M.`)
  pushLog(
    state,
    'hidden',
    `${state.teams[loser].name} is compensated with the hidden player, ${state.hidden.name}, for $${hidden}M.`,
  )
  return state
}

/** Pure reducer: returns a new state, or the same state if the action is illegal. */
export function reduceMp(prev: MpState, action: MpAction): MpState {
  if (action.type === 'raise') {
    if (prev.phase !== 'bidding') return prev
    const min = minMpBid(prev)
    const bid = Math.floor(action.amount)
    if (!Number.isFinite(bid) || bid < min || bid > prev.teams[action.by].budget) return prev
    const state = clone(prev)
    state.currentBid = bid
    state.highBidderId = action.by
    state.turnId = other(action.by)
    state.endsAt = Date.now() + BID_EXTENSION_SECONDS * 1000
    pushLog(state, 'bid', `${state.teams[action.by].name} bids $${bid}M for ${state.revealed.name}.`)
    return state
  }

  if (action.type === 'timeout') {
    if (prev.phase !== 'bidding') return prev
    const state = clone(prev)
    if (state.highBidderId) {
      pushLog(state, 'info', 'Time! The hammer falls.')
      return settle(state, state.highBidderId)
    }
    // Nobody bid: the manager with the smaller squad takes the revealed player
    // for a token $1M so both squads stay complete.
    const winner: PeerId =
      state.teams.host.squad.length <= state.teams.guest.squad.length ? 'host' : 'guest'
    state.currentBid = 1
    pushLog(state, 'info', 'No bids — the player goes for a token fee.')
    return settle(state, winner)
  }

  if (action.type === 'concede') {
    if (prev.phase !== 'bidding') return prev
    const state = clone(prev)
    const loser = action.by
    const winner = other(action.by)
    // No bids yet: the opponent takes the revealed player at the base price.
    const price = state.highBidderId === winner ? state.currentBid : 1
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

    const squadFull =
      state.teams.host.squad.length >= state.teamSize &&
      state.teams.guest.squad.length >= state.teamSize
    if (squadFull || state.pool.length < 2) {
      state.phase = 'over'
      state.result = null
      return state
    }

    const { revealed, hidden, rest } = draw(state.pool, state)
    state.round += 1
    state.revealed = revealed
    state.hidden = hidden
    state.pool = rest
    state.base = 0
    state.currentBid = 0
    state.highBidderId = null
    state.result = null
    state.phase = 'bidding'
    state.endsAt = Date.now() + ROUND_SECONDS * 1000
    // Alternate who opens each round for fairness.
    state.turnId = state.round % 2 === 1 ? 'host' : 'guest'
    pushLog(
      state,
      'info',
      `Round ${state.round}: ${revealed.name} (${revealed.position}) is up. Bidding opens at $0M.`,
    )
    return state
  }

  if (action.type === 'simulate') {
    if (prev.phase !== 'over') return prev
    const state = clone(prev)
    const sim = simulateHeadToHead(
      { id: 'host', name: state.teams.host.name, squad: state.teams.host.squad },
      { id: 'guest', name: state.teams.guest.name, squad: state.teams.guest.squad },
    )
    state.match = sim
    state.phase = 'match'
    state.points = {
      host: state.points.host + (sim.winner === 'host' ? 3 : sim.winner === null ? 1 : 0),
      guest: state.points.guest + (sim.winner === 'guest' ? 3 : sim.winner === null ? 1 : 0),
    }
    return state
  }

  if (action.type === 'newDraft') {
    if (prev.phase !== 'match' && prev.phase !== 'over') return prev
    return createMpGame(prev.config, prev.points, prev.rev + 1)
  }

  return prev
}
