// Career season engine: round-robin league, head-to-head stats-aware match
// simulation, standings, prize money, loan repayments and a transfer market
// between matchdays. Pure functions over Team/Player so the UI can save/restore.

import type { Player } from './players'
import type { Team } from './game'
import { debtWithInterest, squadRating, teamAttack, teamDefense } from './game'

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface StandingRow {
  teamId: string
  name: string
  isHuman: boolean
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  pts: number
}

export function emptyStandings(teams: Team[]): StandingRow[] {
  return teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    isHuman: t.isHuman,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
  }))
}

export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort(
    (a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name),
  )
}

// ---------------------------------------------------------------------------
// Schedule (single round robin, circle method)
// ---------------------------------------------------------------------------

export function roundRobinSchedule(teamIds: string[]): [string, string][][] {
  const arr = [...teamIds]
  if (arr.length % 2 === 1) arr.push('__bye__')
  const m = arr.length
  const rounds: [string, string][][] = []
  for (let r = 0; r < m - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i]!
      const b = arr[m - 1 - i]!
      if (a !== '__bye__' && b !== '__bye__') pairs.push([a, b])
    }
    rounds.push(pairs)
    // Rotate all but the first element (right), keeping a stable "anchor".
    arr.splice(1, 0, arr.pop()!)
  }
  return rounds
}

// ---------------------------------------------------------------------------
// Match simulation (head to head)
// ---------------------------------------------------------------------------

export interface ClubFinance {
  reward: number
  repaid: number
  outstanding: number
}

export interface MatchResult {
  homeId: string
  homeName: string
  awayId: string
  awayName: string
  homeGoals: number
  awayGoals: number
  homeRating: number
  awayRating: number
  /** Home-perspective outcome. */
  outcome: 'home' | 'away' | 'draw'
  /** Financial settlement for each club (prize money + loan repayment). */
  homeFinance?: ClubFinance
  awayFinance?: ClubFinance
}

function rollGoals(att: number, def: number, homeBoost: number): number {
  const base = 1.25 + homeBoost + (att - def) / 10
  const raw = base + (Math.random() * 2.2 - 1.1)
  return Math.max(0, Math.min(6, Math.round(raw)))
}

export function simMatch(home: Team, away: Team): MatchResult {
  const homeGoals = rollGoals(teamAttack(home), teamDefense(away), 0.25)
  const awayGoals = rollGoals(teamAttack(away), teamDefense(home), 0)
  const outcome: MatchResult['outcome'] =
    homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away'
  return {
    homeId: home.id,
    homeName: home.name,
    awayId: away.id,
    awayName: away.name,
    homeGoals,
    awayGoals,
    homeRating: squadRating(home),
    awayRating: squadRating(away),
    outcome,
  }
}

function prizeFor(outcome: 'home' | 'away' | 'draw' | 'win' | 'loss', rating: number): number {
  const won = outcome === 'win' || outcome === 'home'
  const drawn = outcome === 'draw'
  return Math.round(rating / 6) + (won ? 12 : drawn ? 6 : 2)
}

// ---------------------------------------------------------------------------
// Season state machine
// ---------------------------------------------------------------------------

export interface SeasonState {
  matchday: number
  totalMatchdays: number
  schedule: [string, string][][]
  standings: StandingRow[]
  /** Recent results per team (W/D/L), newest last, capped at 5. */
  form: Record<string, string[]>
  finished: boolean
  championId: string | null
  /** Results of the most recently played matchday (for the report screen). */
  lastResults: MatchResult[]
}

export function createSeason(teams: Team[]): SeasonState {
  const schedule = roundRobinSchedule(teams.map((t) => t.id))
  return {
    matchday: 1,
    totalMatchdays: schedule.length,
    schedule,
    standings: emptyStandings(teams),
    form: Object.fromEntries(teams.map((t) => [t.id, []])),
    finished: false,
    championId: null,
    lastResults: [],
  }
}

export interface SeasonTurn {
  teams: Team[]
  season: SeasonState
  results: MatchResult[]
  humanResult: MatchResult | null
}

/**
 * Plays the next matchday: every club plays its scheduled opponent, prize
 * money is paid into budgets, loans are repaid with interest, standings and
 * form are updated. Marks the season finished after the last matchday.
 */
export function playMatchday(teams: Team[], season: SeasonState): SeasonTurn {
  if (season.finished) return { teams, season, results: season.lastResults, humanResult: null }

  const md = season.matchday
  const pairs = season.schedule[md - 1] ?? []
  const byId = new Map(teams.map((t) => [t.id, t]))
  const results: MatchResult[] = []

  for (const [homeId, awayId] of pairs) {
    const home = byId.get(homeId)!
    const away = byId.get(awayId)!
    const res = simMatch(home, away)
    results.push(res)
  }

  // Apply finances per team (standings use their own tallies).
  let updatedTeams = teams.map((t) => t)
  const standings = season.standings.map((row) => ({ ...row }))
  const form: Record<string, string[]> = Object.fromEntries(
    teams.map((t) => [t.id, [...(season.form[t.id] ?? [])]]),
  )

  // Finances per club (paid before standings tallies).
  const settle = (club: Team, gf: number, ga: number, outcomeFlag: 'home' | 'away' | 'draw'): ClubFinance => {
    const reward = prizeFor(outcomeFlag, squadRating(club))
    const owed = debtWithInterest(club)
    const available = club.budget + reward
    const repaid = Math.min(owed, available)
    const outstanding = owed - repaid
    updatedTeams = updatedTeams.map((t) =>
      t.id === club.id
        ? { ...club, budget: Math.max(0, Math.round(available - repaid)), debt: outstanding }
        : t,
    )
    return { reward, repaid, outstanding }
  }

  for (const res of results) {
    const homeClub = byId.get(res.homeId)!
    const awayClub = byId.get(res.awayId)!
    res.homeFinance = settle(homeClub, res.homeGoals, res.awayGoals, res.outcome)
    res.awayFinance = settle(
      awayClub,
      res.awayGoals,
      res.homeGoals,
      res.outcome === 'home' ? 'away' : res.outcome === 'away' ? 'home' : 'draw',
    )

    const homeRow = standings.find((r) => r.teamId === res.homeId)!
    const awayRow = standings.find((r) => r.teamId === res.awayId)!
    homeRow.played += 1
    awayRow.played += 1
    homeRow.gf += res.homeGoals
    homeRow.ga += res.awayGoals
    awayRow.gf += res.awayGoals
    awayRow.ga += res.homeGoals
    homeRow.gd = homeRow.gf - homeRow.ga
    awayRow.gd = awayRow.gf - awayRow.ga
    if (res.outcome === 'home') {
      homeRow.won += 1
      homeRow.pts += 3
      awayRow.lost += 1
      form[res.homeId]!.push('W')
      form[res.awayId]!.push('L')
    } else if (res.outcome === 'away') {
      awayRow.won += 1
      awayRow.pts += 3
      homeRow.lost += 1
      form[res.homeId]!.push('L')
      form[res.awayId]!.push('W')
    } else {
      homeRow.drawn += 1
      awayRow.drawn += 1
      homeRow.pts += 1
      awayRow.pts += 1
      form[res.homeId]!.push('D')
      form[res.awayId]!.push('D')
    }
    // Cap form at the last 5.
    form[res.homeId] = form[res.homeId]!.slice(-5)
    form[res.awayId] = form[res.awayId]!.slice(-5)
  }

  const finished = md >= season.totalMatchdays
  const sorted = sortStandings(standings)

  return {
    teams: updatedTeams,
    season: {
      matchday: finished ? season.totalMatchdays : md + 1,
      totalMatchdays: season.totalMatchdays,
      schedule: season.schedule,
      standings: sorted,
      form,
      finished,
      championId: finished ? sorted[0]!.teamId : null,
      lastResults: results,
    },
    results,
    humanResult: results.find((r) => r.homeId === 'human' || r.awayId === 'human') ?? null,
  }
}

// ---------------------------------------------------------------------------
// Transfer market
// ---------------------------------------------------------------------------

export function buyPrice(p: Player): number {
  return p.value + 5
}

export function sellPrice(p: Player): number {
  return Math.max(2, Math.round(p.value * 0.7))
}

/** Buys a free agent for the human club (if affordable and squad has space). */
export function buyPlayer(
  teams: Team[],
  pool: Player[],
  playerId: string,
  teamSize: number,
): { teams: Team[]; pool: Player[] } {
  const human = teams.find((t) => t.isHuman)
  const player = pool.find((p) => p.id === playerId)
  if (!human || !player || human.squad.length >= teamSize) {
    return { teams, pool }
  }
  const price = buyPrice(player)
  if (human.budget < price) return { teams, pool }
  return {
    teams: teams.map((t) =>
      t.isHuman
        ? { ...t, budget: t.budget - price, squad: [...t.squad, player] }
        : t,
    ),
    pool: pool.filter((p) => p.id !== playerId),
  }
}

/** Sells a squad player for 70% of market value. */
export function sellPlayer(
  teams: Team[],
  pool: Player[],
  playerId: string,
): { teams: Team[]; pool: Player[] } {
  const human = teams.find((t) => t.isHuman)
  const idx = human?.squad.findIndex((p) => p.id === playerId) ?? -1
  if (!human || idx === -1) return { teams, pool }
  const player = human.squad[idx]!
  return {
    teams: teams.map((t) =>
      t.isHuman
        ? {
            ...t,
            budget: t.budget + sellPrice(player),
            squad: t.squad.filter((p) => p.id !== playerId),
          }
        : t,
    ),
    pool: [...pool, player],
  }
}
