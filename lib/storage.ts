import { Task } from './types'

export const TASKS_KEY = 'nextup_tasks'
export const SEEN_OVERDUE_KEY = 'nextup_seen_overdue_ids'
export const DISMISSED_MUST_START_KEY = 'nextup_dismissed_must_start'

export function loadTasks(): Task[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (!raw) return []
    const tasks = JSON.parse(raw) as Task[]
    // 向后兼容：旧数据缺少 progress / originalEstimate / lastProgressUpdatedAt 字段
    return tasks.map((t) => ({
      ...t,
      progress: t.progress ?? 0,
      originalEstimate: t.originalEstimate ?? t.estimateMinutes,
      // 缺失时用创建时间兜底；连创建时间也没有则用当前时间（视为刚更新，不立刻触发停滞提醒）
      lastProgressUpdatedAt:
        t.lastProgressUpdatedAt ??
        (typeof t.createdAt === 'number' && !isNaN(t.createdAt)
          ? new Date(t.createdAt).toISOString()
          : new Date().toISOString()),
      // updatedAt 同理兜底，用于导入合并时判断新旧
      updatedAt:
        t.updatedAt ??
        (typeof t.createdAt === 'number' && !isNaN(t.createdAt)
          ? new Date(t.createdAt).toISOString()
          : new Date().toISOString()),
      // 超时决策相关字段兜底
      abandoned: t.abandoned ?? false,
      rescheduleCount: t.rescheduleCount ?? 0,
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

// ─────────────────────────────────────────────
// "必须立即处理"提醒的关闭记录
// ─────────────────────────────────────────────

/**
 * dismiss 记录：key 为任务 id，value 为关闭时任务的关键字段签名。
 * 若任务的 deadline / estimateMinutes 之后发生变化，签名不匹配，
 * 视为新提醒，重新展示。
 */
export type DismissedMustStartMap = Record<string, string>

/** 生成任务的关键字段签名（deadline + estimateMinutes） */
export function mustStartSignature(deadline: number, estimateMinutes: number): string {
  return `${deadline}:${estimateMinutes}`
}

export function loadDismissedMustStart(): DismissedMustStartMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(DISMISSED_MUST_START_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as DismissedMustStartMap
  } catch {
    return {}
  }
}

export function saveDismissedMustStart(map: DismissedMustStartMap): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DISMISSED_MUST_START_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

/** 记录某任务被关闭时的签名 */
export function markMustStartDismissed(
  id: string,
  deadline: number,
  estimateMinutes: number
): void {
  const map = loadDismissedMustStart()
  map[id] = mustStartSignature(deadline, estimateMinutes)
  saveDismissedMustStart(map)
}

// ─────────────────────────────────────────────
// AI 推荐理由缓存
// key 格式：任务id:deadline:estimateMinutes:progress
// 推荐任务或其关键字段变化后缓存自动失效
// ─────────────────────────────────────────────

export const EXPLANATIONS_KEY = 'nextup_explanations'

function loadExplanationMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(EXPLANATIONS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

export function loadExplanation(sig: string): string | null {
  return loadExplanationMap()[sig] ?? null
}

export function saveExplanation(sig: string, explanation: string): void {
  if (typeof window === 'undefined') return
  try {
    const map = loadExplanationMap()
    map[sig] = explanation
    // 控制体积，最多保留最近 50 条
    const keys = Object.keys(map)
    if (keys.length > 50) {
      for (const k of keys.slice(0, keys.length - 50)) delete map[k]
    }
    localStorage.setItem(EXPLANATIONS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────
// 长线任务停滞提醒的关闭记录
// key 为任务 id，value 为关闭时该任务的 progress。
// 若之后 progress 发生变化（真的推进了），再次停滞满阈值时重新提醒。
// ─────────────────────────────────────────────

export const DISMISSED_STAGNANT_KEY = 'nextup_dismissed_stagnant'
export function loadDismissedStagnant(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(DISMISSED_STAGNANT_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, number>
  } catch {
    return {}
  }
}

export function markStagnantDismissed(id: string, progress: number): void {
  if (typeof window === 'undefined') return
  try {
    const map = loadDismissedStagnant()
    map[id] = progress
    localStorage.setItem(DISMISSED_STAGNANT_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}
