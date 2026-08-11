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
