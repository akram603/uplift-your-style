// localStorage persistence: single-player career auto-save + run history.

export interface RunRecord {
  id: string
  date: string
  teamSize: number
  formationId: string
  difficulty: string
  rank: number
  totalTeams: number
  champion: boolean
  avgOvr: number
  squadNames: string[]
}

const SAVE_KEY = 'fad.career.v1'
const HISTORY_KEY = 'fad.history.v1'

export function saveCareer<T>(data: T): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* storage full / private mode — ignore */
  }
}

export function loadCareer<T>(): T | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function clearCareer(): void {
  try {
    localStorage.removeItem(SAVE_KEY)
  } catch {
    /* ignore */
  }
}

export function loadHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as RunRecord[]) : []
  } catch {
    return []
  }
}

export function addHistory(record: RunRecord): RunRecord[] {
  const list = [record, ...loadHistory()].slice(0, 20)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  return list
}
