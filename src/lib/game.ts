// Core game + auction engine. Pure logic, framework-agnostic, so it can be
// reused when we add real multiplayer (server-authoritative state) later.

import type { Player } from './players'
import type { TeamSize } from './formations'
import { pickNeededPosition, playersForPosition, positionNeedCounts } from './formations'

export interface Team {
  id: string
  name: string
  isHuman: boolean
  budget: number
  /** Budget the club starts each match window with (persists across rounds). */
  startingBudget: number
  squad: Player[]
  /** Outstanding borrowed amount (principal only). Persists until repaid. */
  debt: number
  /** AI bidding personality (higher = more willing to overpay). */
  aggression: number
  /** Formation chosen for this run (display only). */
  formationId?: string | undefined
}

/** Maximum total amount any club may borrow across the draft. */
export const MAX_LOAN = 30
/** Interest charged on repayment at the next match. */
export const LOAN_INTEREST = 0.1

/** How much this club may still borrow. */
export function loanHeadroom(team: Team): number {
  return Math.max(0, MAX_LOAN - team.debt)
}

/** Amount owed at the next match, including interest. */
export function debtWithInterest(team: Team): number {
  return Math.round(team.debt * (1 + LOAN_INTEREST))
}

/**
 * Borrows `amount` for a club: cash goes straight into the budget (raising
 * bidding power) and the principal is recorded as debt. Clamped to headroom.
 */
export function takeLoan(teams: Team[], teamId: string, amount: number): Team[] {
  return teams.map((t) => {
    if (t.id !== teamId) return t
    const borrowed = Math.min(Math.max(0, Math.floor(amount)), loanHeadroom(t))
    if (borrowed <= 0) return t
    return { ...t, budget: t.budget + borrowed, debt: t.debt + borrowed }
  })
}

// ---------------------------------------------------------------------------
// Difficulty
// ---------------------------------------------------------------------------

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface DifficultyConfig {
  id: Difficulty
  label: string
  desc: string
  /** Scales how far AI managers will push their bids. */
  aiAggroMult: number
  /** Scales the AI starting budget. */
  aiBudgetMult: number
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'easy',
    label: 'Easy',
    desc: 'Rookie managers with shallow pockets.',
    aiAggroMult: 0.72,
    aiBudgetMult: 0.85,
  },
  {
    id: 'normal',
    label: 'Normal',
    desc: 'An even playing field.',
    aiAggroMult: 1,
    aiBudgetMult: 1,
  },
  {
    id: 'hard',
    label: 'Hard',
    desc: 'Ruthless AI with deeper pockets.',
    aiAggroMult: 1.4,
    aiBudgetMult: 1.2,
  },
]

export function difficultyConfig(id: Difficulty): DifficultyConfig {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]!
}

// ---------------------------------------------------------------------------
// Squad ratings & stats-aware match simulation
// ---------------------------------------------------------------------------

/** Average overall rating of the squad (0 when empty). */
export function squadRating(team: Pick<Team, 'squad'>): number {
  if (!team.squad.length) return 0
  return Math.round(team.squad.reduce((s, p) => s + p.ovr, 0) / team.squad.length)
}

const POS_ATTACK_MULT: Record<string, number> = { FWD: 1.15, MID: 1.0, DEF: 0.7, GK: 0.15 }
const POS_DEFENSE_MULT: Record<string, number> = { GK: 1.1, DEF: 1.15, MID: 0.8, FWD: 0.5 }

/** Attacking power (0-100): driven by shooting + passing, weighted by position. */
export function teamAttack(team: Pick<Team, 'squad'>): number {
  if (!team.squad.length) return 52
  const total = team.squad.reduce(
    (s, p) => s + (p.shooting * 0.6 + p.passing * 0.4) * (POS_ATTACK_MULT[p.position] ?? 1),
    0,
  )
  return Math.round(total / team.squad.length)
}

/** Defensive solidity (0-100): driven by defending + pace, weighted by position. */
export function teamDefense(team: Pick<Team, 'squad'>): number {
  if (!team.squad.length) return 46
  const total = team.squad.reduce(
    (s, p) => s + (p.defending * 0.75 + p.pace * 0.25) * (POS_DEFENSE_MULT[p.position] ?? 1),
    0,
  )
  return Math.round(total / team.squad.length)
}

export interface MatchReport {
  teamId: string
  name: string
  isHuman: boolean
  /** Squad rating used for the simulation. */
  rating: number
  attack: number
  defense: number
  goalsFor: number
  goalsAgainst: number
  outcome: 'win' | 'draw' | 'loss'
  /** Prize money earned from the match. */
  reward: number
  /** Owed at kickoff (principal + interest). */
  owed: number
  /** Actually repaid out of reward + budget. */
  repaid: number
  /** Still outstanding after repayment. */
  outstanding: number
  /** True when the club could not clear its debt. */
  penalty: boolean
  budgetAfter: number
}

function rollGoals(stat: number, baseline: number, spread = 2.6): number {
  // stat above baseline scores more, below scores less; capped 0-6
  const raw = (stat - baseline) / 7.5 + (Math.random() * spread - spread / 2)
  return Math.max(0, Math.min(6, Math.round(raw)))
}

/**
 * Simulates one match per club (each club plays an average league opponent),
 * pays prize money, then automatically deducts the borrowed amount plus
 * interest. Clubs that cannot cover it keep the remainder as debt and are
 * flagged with a financial penalty.
 */
export function simulateNextMatch(teams: Team[]): {
  teams: Team[]
  reports: MatchReport[]
} {
  const reports: MatchReport[] = []
  const updated = teams.map((t) => {
    const rating = squadRating(t)
    const attack = teamAttack(t)
    const defense = teamDefense(t)
    // League-average baseline: an attack around 70 + defense around 70 is a coin flip.
    const goalsFor = rollGoals(attack, 70)
    const goalsAgainst = rollGoals(defense, 70)
    const outcome: MatchReport['outcome'] =
      goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss'
    const reward =
      Math.round(rating / 6) + (outcome === 'win' ? 12 : outcome === 'draw' ? 6 : 2)

    // The next match window starts from the club's standing budget again, so
    // the debt is genuinely SUBTRACTED here rather than silently cleared.
    const owed = debtWithInterest(t)
    const available = t.startingBudget + reward
    const repaid = Math.min(owed, available)
    const outstanding = owed - repaid
    const budgetAfter = Math.max(0, available - repaid)

    reports.push({
      teamId: t.id,
      name: t.name,
      isHuman: t.isHuman,
      rating,
      attack,
      defense,
      goalsFor,
      goalsAgainst,
      outcome,
      reward,
      owed,
      repaid,
      outstanding,
      penalty: outstanding > 0,
      budgetAfter,
    })

    return { ...t, budget: budgetAfter, debt: outstanding }
  })
  return { teams: updated, reports }
}

export interface GameConfig {
  teamSize: TeamSize
  startingBudget: number
  numOpponents: number
  difficulty: Difficulty
  formationId?: string | undefined
}

export type LogKind = 'info' | 'bid' | 'win' | 'hidden'
export interface LogEntry {
  id: number
  text: string
  kind: LogKind
}

export interface RoundResult {
  revealedWinnerId: string
  revealedPrice: number
  hiddenWinnerId: string | null
  hiddenPrice: number
}

export interface AuctionState {
  round: number
  revealed: Player
  hidden: Player
  base: number
  currentBid: number
  highBidderId: string | null
  /** Runner-up tracker: the bidder who held the lead before the current one. */
  prevHighBidderId: string | null
  /** Max each AI will pay for the revealed player this round. */
  aiMax: Record<string, number>
  humanId: string
  phase: 'bidding' | 'resolved'
  humanTookHidden: boolean
  /** Set when an AI deliberately dropped out to grab the hidden player. */
  aiBluffed: boolean
  result: RoundResult | null
  log: LogEntry[]
}

let logCounter = 0
function log(state: AuctionState, kind: LogKind, text: string) {
  state.log = [{ id: logCounter++, kind, text }, ...state.log].slice(0, 40)
}

const AI_NAMES = [
  'FC Nebula',
  'Iron United',
  'Crimson XI',
  'Athletic Volt',
  'Royal Kestrels',
  'Sporting Ember',
  'Atlético Zenith',
  'Blackpool Storm',
  'Dynamo Aurora',
  'Polaris City',
  'Inter Frost',
  'Harbour Rovers',
]

export function createTeams(config: GameConfig): Team[] {
  const diff = difficultyConfig(config.difficulty)
  const teams: Team[] = [
    {
      id: 'human',
      name: 'Your Club',
      isHuman: true,
      budget: config.startingBudget,
      startingBudget: config.startingBudget,
      squad: [],
      debt: 0,
      aggression: 1,
      formationId: config.formationId,
    },
  ]
  for (let i = 0; i < config.numOpponents; i++) {
    const aiBudget = Math.round(config.startingBudget * diff.aiBudgetMult)
    teams.push({
      id: `ai-${i}`,
      name: AI_NAMES[i % AI_NAMES.length]!,
      isHuman: false,
      budget: aiBudget,
      startingBudget: aiBudget,
      squad: [],
      debt: 0,
      aggression: (0.85 + Math.random() * 0.5) * diff.aiAggroMult,
      formationId: config.formationId,
    })
  }
  return teams
}

/** Suggested increment (used only for the quick-bump helper in the UI). */
export function increment(price: number): number {
  if (price < 20) return 2
  if (price < 50) return 5
  return 8
}

export function nextBidAmount(state: AuctionState): number {
  if (state.highBidderId === null) return 1
  return state.currentBid + 1
}

function teamById(teams: Team[], id: string | null): Team | undefined {
  return teams.find((t) => t.id === id)
}

/** Picks two unused players for a round: one revealed, one hidden. */
export function startRound(
  round: number,
  pool: Player[],
  teams: Team[],
  teamSize?: TeamSize,
  formationId?: string,
): AuctionState {
  // Only auction positions the human squad still legally needs, so every
  // formation (goalkeeper included) always gets filled.
  const human = teams.find((t) => t.isHuman)
  const needPos =
    human && teamSize
      ? pickNeededPosition(positionNeedCounts(human.squad, teamSize, formationId))
      : null
  const eligible = playersForPosition(pool, needPos)
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  const revealed = shuffled[0]!
  const hidden = shuffled[1]!
  // Every auction opens at 0 — managers type any amount they like.
  const base = 0

  const aiMax: Record<string, number> = {}
  for (const t of teams) {
    if (t.isHuman) continue
    const desire = revealed.value * t.aggression * (0.7 + Math.random() * 0.5)
    aiMax[t.id] = Math.max(base, Math.min(t.budget, Math.round(desire)))
  }

  const state: AuctionState = {
    round,
    revealed,
    hidden,
    base,
    currentBid: 0,
    highBidderId: null,
    prevHighBidderId: null,
    aiMax,
    humanId: 'human',
    phase: 'bidding',
    humanTookHidden: false,
    aiBluffed: false,
    result: null,
    log: [],
  }
  log(
    state,
    'info',
    `Round ${round}: ${revealed.name} (${revealed.position}) is on the block. Bidding opens at $0M.`,
  )
  return state
}

/** Human places a bid at the next increment, then AI opponents respond once. */
export function humanBid(prev: AuctionState, teams: Team[]): AuctionState {
  return humanBidAmount(prev, teams, nextBidAmount(prev))
}

/** The lowest legal bid the human may place right now. */
export function minLegalBid(state: AuctionState): number {
  return nextBidAmount(state)
}

/** Cost of settling for the hidden player this round. */
export function hiddenPriceFor(state: AuctionState): number {
  return Math.max(2, Math.round(state.hidden.value * 0.3))
}

/**
 * Human places a manual bid of an exact amount, then AI opponents respond once.
 * The amount must be at least the minimum legal bid and within the human budget.
 * Invalid amounts are rejected (state returned unchanged) as a safety net; the
 * UI validates and surfaces the reason before calling this.
 */
export function humanBidAmount(
  prev: AuctionState,
  teams: Team[],
  amount: number,
): AuctionState {
  if (prev.phase !== 'bidding') return prev
  const human = teamById(teams, prev.humanId)!
  const min = minLegalBid(prev)
  if (!Number.isFinite(amount)) return prev
  const bid = Math.floor(amount)
  if (bid < min || bid > human.budget) return prev

  const state = cloneState(prev)
  state.prevHighBidderId = state.highBidderId
  state.highBidderId = state.humanId
  state.currentBid = bid
  log(state, 'bid', `Your Club bids $${bid}M for ${state.revealed.name}.`)
  return aiRespond(state, teams)
}

/**
 * One AI counter-bid (the most aggressive able opponent), or human wins.
 * Aggressive AI occasionally plays a mind game: it drops out of the revealed
 * race on purpose to pocket the hidden player instead — handing you the star.
 */
function aiRespond(state: AuctionState, teams: Team[]): AuctionState {
  let best: Team | null = null
  for (const t of teams) {
    if (t.isHuman || t.id === state.highBidderId) continue
    const max = state.aiMax[t.id] ?? 0
    if (max > state.currentBid && t.budget > state.currentBid) {
      if (!best || (state.aiMax[t.id] ?? 0) > (state.aiMax[best.id] ?? 0)) best = t
    }
  }

  if (!best) {
    // No opponent will top the current bid: the leader wins the revealed player.
    return resolveRevealed(state, teams, state.highBidderId!)
  }

  // Free-form counter: a custom amount above the current bid, never over budget
  // or the AI's valuation.
  const ceiling = Math.min(best.budget, state.aiMax[best.id] ?? 0)
  const step = Math.max(1, Math.round((ceiling - state.currentBid) * (0.15 + Math.random() * 0.35)))
  const next = Math.min(ceiling, state.currentBid + step)

  // Mind game: an aggressive AI with headroom may bail out deliberately.
  if (best.aggression >= 1.15 && Math.random() < 0.1 * Math.min(1.6, best.aggression)) {
    state.aiBluffed = true
    log(
      state,
      'hidden',
      `${best.name} plays a mind game and drops out — they settle for the hidden player!`,
    )
    return resolveRevealed(state, teams, state.highBidderId!)
  }

  state.prevHighBidderId = state.highBidderId
  state.highBidderId = best.id
  state.currentBid = next
  log(state, 'bid', `${best.name} counters with $${next}M.`)
  return state
}

/** Human bows out of the revealed race and locks in the hidden player. */
export function humanTakeHidden(prev: AuctionState, teams: Team[]): AuctionState {
  if (prev.phase !== 'bidding') return prev
  const state = cloneState(prev)
  state.humanTookHidden = true
  log(state, 'hidden', `Your Club gambles on the hidden player and drops out of the ${state.revealed.name} race.`)

  // Resolve the revealed player among AI opponents only.
  const contenders = teams
    .filter((t) => !t.isHuman && (state.aiMax[t.id] ?? 0) >= state.base)
    .sort((a, b) => (state.aiMax[b.id] ?? 0) - (state.aiMax[a.id] ?? 0))

  const humanTeam = teamById(teams, state.humanId)!
  const hiddenPrice = Math.min(humanTeam.budget, hiddenPriceFor(state))

  if (contenders.length === 0) {
    // Nobody wanted the revealed player.
    state.result = {
      revealedWinnerId: '',
      revealedPrice: 0,
      hiddenWinnerId: state.humanId,
      hiddenPrice,
    }
  } else {
    const winner = contenders[0]!
    const second = contenders[1]
    const secondBench = second ? (state.aiMax[second.id] ?? state.base) : state.base
    const price = Math.min(
      state.aiMax[winner.id] ?? state.base,
      Math.max(state.base, secondBench + increment(secondBench)),
    )
    state.result = {
      revealedWinnerId: winner.id,
      revealedPrice: price,
      hiddenWinnerId: state.humanId,
      hiddenPrice,
    }
    log(state, 'win', `${winner.name} wins ${state.revealed.name} for $${price}M.`)
  }
  state.phase = 'resolved'
  log(state, 'hidden', `The hidden player is yours for $${hiddenPrice}M.`)
  return state
}

/** Human declines entirely: AIs settle both players between themselves. */
export function humanPass(prev: AuctionState, teams: Team[]): AuctionState {
  if (prev.phase !== 'bidding') return prev
  const state = cloneState(prev)
  const contenders = teams
    .filter((t) => !t.isHuman && (state.aiMax[t.id] ?? 0) >= state.base)
    .sort((a, b) => (state.aiMax[b.id] ?? 0) - (state.aiMax[a.id] ?? 0))

  log(state, 'info', `Your Club passes on this round.`)
  if (contenders.length === 0) {
    state.result = { revealedWinnerId: '', revealedPrice: 0, hiddenWinnerId: null, hiddenPrice: 0 }
  } else {
    const winner = contenders[0]!
    const second = contenders[1]
    const secondBench = second ? (state.aiMax[second.id] ?? state.base) : state.base
    const price = Math.min(state.aiMax[winner.id] ?? state.base, Math.max(state.base, secondBench + increment(secondBench)))
    const hiddenPrice = second ? Math.min(second.budget, Math.max(2, Math.round(price * 0.55))) : 0
    state.result = {
      revealedWinnerId: winner.id,
      revealedPrice: price,
      hiddenWinnerId: second ? second.id : null,
      hiddenPrice,
    }
    log(state, 'win', `${winner.name} wins ${state.revealed.name} for $${price}M.`)
  }
  state.phase = 'resolved'
  return state
}

/**
 * Chooses who receives the hidden player once the revealed player is won.
 * The hidden player ALWAYS goes to a participant other than the revealed
 * winner, so the losing side is compensated:
 *   - Prefer the runner-up (last bidder before the winner).
 *   - Otherwise, if an AI won, the human is compensated with the hidden player.
 *   - Otherwise (human won with no runner-up), the strongest AI receives it.
 * Returns null only when there is genuinely no other participant.
 */
function pickHiddenRecipient(
  state: AuctionState,
  teams: Team[],
  winnerId: string,
): string | null {
  const others = teams.filter((t) => t.id !== winnerId)
  if (others.length === 0) return null

  const winner = teamById(teams, winnerId)
  const human = others.find((t) => t.isHuman)

  // If an AI won the revealed player, the human ALWAYS receives the hidden one.
  if (winner && !winner.isHuman && human) return human.id

  // The human won: the hidden player must go to an AI opponent.
  const ais = others.filter((t) => !t.isHuman)
  if (ais.length > 0) {
    // Runner-up AI gets first refusal, otherwise the keenest bidder.
    if (state.prevHighBidderId && state.prevHighBidderId !== winnerId) {
      const runnerUp = ais.find((t) => t.id === state.prevHighBidderId)
      if (runnerUp) return runnerUp.id
    }
    return [...ais].sort((a, b) => (state.aiMax[b.id] ?? 0) - (state.aiMax[a.id] ?? 0))[0]!.id
  }

  return others[0]!.id

}

/** Finalises the revealed auction: winner keeps revealed, the other side gets hidden. */
function resolveRevealed(
  state: AuctionState,
  teams: Team[],
  winnerId: string,
): AuctionState {
  const revealedPrice = state.currentBid
  const hiddenWinnerId = pickHiddenRecipient(state, teams, winnerId)

  let hiddenPrice = 0
  if (hiddenWinnerId) {
    const recipient = teamById(teams, hiddenWinnerId)!
    hiddenPrice = Math.min(recipient.budget, Math.max(2, Math.round(revealedPrice * 0.55)))
  }

  state.result = {
    revealedWinnerId: winnerId,
    revealedPrice,
    hiddenWinnerId,
    hiddenPrice,
  }
  state.phase = 'resolved'

  const winnerTeam = teamById(teams, winnerId)!
  log(state, 'win', `${winnerTeam.name} wins ${state.revealed.name} for $${revealedPrice}M.`)
  if (hiddenWinnerId) {
    const ru = teamById(teams, hiddenWinnerId)!
    const reason = ru.isHuman ? 'You are' : `${ru.name} is`
    log(state, 'hidden', `${reason} compensated with the hidden player for $${hiddenPrice}M.`)
  }
  return state
}

/** Applies a resolved round result to the teams, returning updated copies. */
export function applyResult(teams: Team[], state: AuctionState): Team[] {
  const result = state.result
  if (!result) return teams
  return teams.map((t) => {
    let budget = t.budget
    const squad = [...t.squad]
    if (t.id === result.revealedWinnerId) {
      budget -= result.revealedPrice
      squad.push(state.revealed)
    }
    if (t.id === result.hiddenWinnerId) {
      budget -= result.hiddenPrice
      squad.push(state.hidden)
    }
    return { ...t, budget: Math.max(0, Math.round(budget)), squad }
  })
}

function cloneState(state: AuctionState): AuctionState {
  return {
    ...state,
    aiMax: { ...state.aiMax },
    log: [...state.log],
    result: state.result ? { ...state.result } : null,
  }
}
