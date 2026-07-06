import { Task } from './types'

const STORAGE_KEY = 'nextup_tasks'

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Task[]
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  } catch {
    // ignore quota errors
  }
}
