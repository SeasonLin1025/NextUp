import { Task } from './types'

const TASKS_KEY = 'nextup_tasks'
const SEEN_OVERDUE_KEY = 'nextup_seen_overdue_ids'

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (!raw) return []
    const tasks = JSON.parse(raw) as Task[]
    // 向后兼容：旧数据缺少 progress / originalEstimate 字段
    return tasks.map((t) => ({
      ...t,
      progress: t.progress ?? 0,
      originalEstimate: t.originalEstimate ?? t.estimateMinutes,
    }))
  } catch {
    return []
  }
}

export function saveTasks(tasks: Task[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
  } catch {
    // ignore quota errors
  }
}

export function loadSeenOverdueIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SEEN_OVERDUE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function saveSeenOverdueIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SEEN_OVERDUE_KEY, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

/** 将新的超时 id 合并到已见列表并持久化 */
export function markOverdueSeen(newIds: string[]): void {
  const existing = loadSeenOverdueIds()
  const merged = Array.from(new Set([...existing, ...newIds]))
  saveSeenOverdueIds(merged)
}
