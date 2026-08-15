// Two-player turn-based auction engine for online and local multiplayer.
// Strict turn logic: players alternate, each with a countdown. On your turn
// you either raise the bid (switching the turn to your opponent) or pass
// (conceding the revealed player and taking the hidden one instead).

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
  turnId: PeerId
  endsAt: number
  result: MpResult | null
  log: LogEntry[]
  config: MpConfig
  points: Record<PeerId, number>
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
  | { type: 'pass'; by: PeerId }
  | { type: 'timeout' }
  | { type: 'next'; by: PeerId }
  | { type: 'simulate' }
  | { type: 'newDraft' }

export const TURN_SECONDS = 15

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
    endsAt: Date.now() + TURN_SECONDS * 1000,
    result: null,
    log: [],
    config,
    points: points ?? { host: 0, guest: 0 },
    match: null,
  }
  pushLog(
    state,
    'info',
    `Round 1: ${revealed.name} (${revealed.position}) is up. ${config.hostName} opens the bidding.`,
  )
  return state
}

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

function settle(state: MpState, winner: PeerId, loser: PeerId): MpState {
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

export function reduceMp(prev: MpState, action: MpAction): MpState {
  if (action.type === 'raise') {
    if (prev.phase !== 'bidding') return prev
    if (action.by !== prev.turnId) return prev
    const min = minMpBid(prev)
    const bid = Math.floor(action.amount)
    if (!Number.isFinite(bid) || bid < min || bid > prev.teams[action.by].budget) return prev
    const state = clone(prev)
    state.currentBid = bid
    state.highBidderId = action.by
    state.turnId = other(action.by)
    state.endsAt = Date.now() + TURN_SECONDS * 1000
    pushLog(state, 'bid', `${state.teams[action.by].name} bids $${bid}M for ${state.revealed.name}.`)
    return state
  }

  if (action.type === 'pass') {
    if (prev.phase !== 'bidding') return prev
    if (action.by !== prev.turnId) return prev
    const state = clone(prev)
    const passer = action.by
    const winner = other(action.by)

    if (state.highBidderId === null) {
      // Nobody bid yet — passer takes the hidden, opponent gets revealed for $1.
      const hidden = hiddenCost(state, passer)
      state.result = {
        revealedWinnerId: winner,
        revealedPrice: 1,
        hiddenWinnerId: passer,
        hiddenPrice: hidden,
      }
      state.phase = 'resolved'
      pushLog(state, 'info', `${state.teams[passer].name} passes and takes the hidden player.`)
      pushLog(state, 'win', `${state.teams[winner].name} gets ${state.revealed.name} for $1M.`)
      return state
    }

    // Someone already bid — the high bidder wins the revealed, passer gets hidden.
    return settle(state, state.highBidderId, passer)
  }

  if (action.type === 'timeout') {
    if (prev.phase !== 'bidding') return prev
    const state = clone(prev)
    const passer = state.turnId
    pushLog(state, 'info', `Time! ${state.teams[passer].name}'s turn expired.`)

    if (state.highBidderId === null) {
      const winner = other(passer)
      const hidden = hiddenCost(state, passer)
      state.result = {
        revealedWinnerId: winner,
        revealedPrice: 1,
        hiddenWinnerId: passer,
        hiddenPrice: hidden,
      }
      state.phase = 'resolved'
      pushLog(state, 'win', `${state.teams[winner].name} gets ${state.revealed.name} for $1M.`)
      return state
    }

    return settle(state, state.highBidderId, passer)
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
    state.endsAt = Date.now() + TURN_SECONDS * 1000
    state.turnId = state.round % 2 === 1 ? 'host' : 'guest'
    pushLog(
      state,
      'info',
      `Round ${state.round}: ${revealed.name} (${revealed.position}) is up. ${state.teams[state.turnId].name} opens the bidding.`,
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
