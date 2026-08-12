import type { Position } from './players'

export type TeamSize = 5 | 6 | 11

/** 11-a-side tactical shapes; smaller formats keep a single classic shape. */
export type FormationId = '433' | '442' | '352'

export interface FormationSlot {
  position: Position
  /** Row from the back (0 = keeper line) used for pitch layout. */
  row: number
}

export interface Formation {
  id: string
  label: string
  slots: FormationSlot[]
}

const FIVE: Formation = {
  id: '5aside',
  label: '5-a-side (1-2-1)',
  slots: [
    { position: 'GK', row: 0 },
    { position: 'DEF', row: 1 },
    { position: 'MID', row: 2 },
    { position: 'MID', row: 2 },
    { position: 'FWD', row: 3 },
  ],
}

const SIX: Formation = {
  id: '6aside',
  label: '6-a-side (1-2-2)',
  slots: [
    { position: 'GK', row: 0 },
    { position: 'DEF', row: 1 },
    { position: 'DEF', row: 1 },
    { position: 'MID', row: 2 },
    { position: 'FWD', row: 3 },
    { position: 'FWD', row: 3 },
  ],
}

const ELEVEN: Record<FormationId, Formation> = {
  433: {
    id: '433',
    label: '11-a-side 4-3-3',
    slots: [
      { position: 'GK', row: 0 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'FWD', row: 3 },
      { position: 'FWD', row: 3 },
      { position: 'FWD', row: 3 },
    ],
  },
  442: {
    id: '442',
    label: '11-a-side 4-4-2',
    slots: [
      { position: 'GK', row: 0 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'FWD', row: 3 },
      { position: 'FWD', row: 3 },
    ],
  },
  352: {
    id: '352',
    label: '11-a-side 3-5-2',
    slots: [
      { position: 'GK', row: 0 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'DEF', row: 1 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'MID', row: 2 },
      { position: 'FWD', row: 3 },
      { position: 'FWD', row: 3 },
    ],
  },
}

/** Formations the player may pick for a given team size. */
export function formationsForSize(size: TeamSize): Formation[] {
  if (size === 11) return [ELEVEN['433'], ELEVEN['442'], ELEVEN['352']]
  return [size === 5 ? FIVE : SIX]
}

/** Default formation id for a team size. */
export function defaultFormationId(size: TeamSize): string {
  return formationsForSize(size)[0]!.id
}

/** Fallback when an unknown formation id is supplied. */
export function slotsForSize(size: TeamSize, formationId?: string): FormationSlot[] {
  const available = formationsForSize(size)
  const match = available.find((f) => f.id === formationId)
  return (match ?? available[0]!).slots
}

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD']

/**
 * How many slots of each position a squad still has to fill for its formation.
 * The totals always add up to the number of remaining rounds, so drafting one
 * needed position per round guarantees a legal squad — goalkeeper included.
 */
export function positionNeedCounts(
  squad: { position: Position }[],
  size: TeamSize,
  formationId?: string,
): Record<Position, number> {
  const need: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 }
  for (const s of slotsForSize(size, formationId)) need[s.position] += 1
  for (const p of squad) if (need[p.position] > 0) need[p.position] -= 1
  return need
}

/** Picks the next position to auction, weighted by how many slots remain. */
export function pickNeededPosition(need: Record<Position, number>): Position | null {
  const total = ORDER.reduce((s, p) => s + Math.max(0, need[p]), 0)
  if (total <= 0) return null
  let roll = Math.random() * total
  for (const p of ORDER) {
    roll -= Math.max(0, need[p])
    if (roll <= 0) return p
  }
  return ORDER.find((p) => need[p] > 0) ?? null
}

/** Players from `pool` that can legally fill the given position. */
export function playersForPosition<T extends { position: Position }>(
  pool: T[],
  position: Position | null,
): T[] {
  if (!position) return pool
  const matching = pool.filter((p) => p.position === position)
  return matching.length >= 2 ? matching : pool
}
