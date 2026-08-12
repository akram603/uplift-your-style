// Head-to-head match simulation for the two-player modes. Pure functions so
// the host can simulate once and broadcast the identical result to the guest.

import type { Player } from './players'
import { teamAttack, teamDefense } from './game'

export type SimSide = 'host' | 'guest'

export interface MatchEvent {
  minute: number
  /** Team that caused the event, or null for neutral commentary. */
  side: SimSide | null
  kind: 'kickoff' | 'goal' | 'chance' | 'save' | 'card' | 'fulltime'
  text: string
}

export interface MatchSim {
  hostGoals: number
  guestGoals: number
  hostRating: number
  guestRating: number
  hostAttack: number
  guestAttack: number
  hostDefense: number
  guestDefense: number
  winner: SimSide | null
  events: MatchEvent[]
}

interface SimTeam {
  id: SimSide
  name: string
  squad: Player[]
}

function avgOvr(squad: Player[]): number {
  if (!squad.length) return 0
  return Math.round(squad.reduce((s, p) => s + p.ovr, 0) / squad.length)
}

function pick<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined
  return arr[Math.floor(Math.random() * arr.length)]
}

function scorer(squad: Player[]): string {
  const attackers = squad.filter((p) => p.position === 'FWD' || p.position === 'MID')
  return (pick(attackers.length ? attackers : squad)?.name ?? 'An unknown trialist')
}

function keeper(squad: Player[]): string {
  return squad.find((p) => p.position === 'GK')?.name ?? 'the keeper'
}

/**
 * Simulates 90 minutes minute-by-minute. Chance quality is driven by the
 * drafted squads: attack (shooting/passing) vs the opponent's defence.
 */
export function simulateHeadToHead(host: SimTeam, guest: SimTeam): MatchSim {
  const hostAttack = teamAttack(host)
  const guestAttack = teamAttack(guest)
  const hostDefense = teamDefense(host)
  const guestDefense = teamDefense(guest)

  const events: MatchEvent[] = [
    { minute: 0, side: null, kind: 'kickoff', text: `Kick-off! ${host.name} vs ${guest.name}.` },
  ]

  let hostGoals = 0
  let guestGoals = 0

  const chanceRate = (att: number, def: number) =>
    Math.max(0.012, Math.min(0.09, 0.035 + (att - def) / 900))

  const hostRate = chanceRate(hostAttack, guestDefense)
  const guestRate = chanceRate(guestAttack, hostDefense)

  for (let minute = 1; minute <= 90; minute++) {
    for (const [team, rate, oppo] of [
      [host, hostRate, guest],
      [guest, guestRate, host],
    ] as [SimTeam, number, SimTeam][]) {
      if (Math.random() > rate) continue
      const name = scorer(team.squad)
      const goal = Math.random() < 0.42
      if (goal) {
        if (team.id === 'host') hostGoals++
        else guestGoals++
        events.push({
          minute,
          side: team.id,
          kind: 'goal',
          text: `GOAL! ${name} finds the net for ${team.name}. ${hostGoals}-${guestGoals}`,
        })
      } else if (Math.random() < 0.5) {
        events.push({
          minute,
          side: team.id,
          kind: 'save',
          text: `${name} forces a fine save from ${keeper(oppo.squad)}.`,
        })
      } else {
        events.push({
          minute,
          side: team.id,
          kind: 'chance',
          text: `${name} drags an effort wide for ${team.name}.`,
        })
      }
    }
    if (Math.random() < 0.006) {
      const team = Math.random() < 0.5 ? host : guest
      events.push({
        minute,
        side: team.id,
        kind: 'card',
        text: `Yellow card for ${scorer(team.squad)} (${team.name}).`,
      })
    }
  }

  const winner: SimSide | null =
    hostGoals > guestGoals ? 'host' : guestGoals > hostGoals ? 'guest' : null

  events.push({
    minute: 90,
    side: null,
    kind: 'fulltime',
    text: `Full time: ${host.name} ${hostGoals} - ${guestGoals} ${guest.name}.`,
  })

  return {
    hostGoals,
    guestGoals,
    hostRating: avgOvr(host.squad),
    guestRating: avgOvr(guest.squad),
    hostAttack,
    guestAttack,
    hostDefense,
    guestDefense,
    winner,
    events,
  }
}
