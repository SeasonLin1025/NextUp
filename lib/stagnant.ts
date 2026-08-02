import { Task } from './types'

// ─────────────────────────────────────────────
// 长线任务停滞检测（纯本地逻辑，不调用 AI）
// ─────────────────────────────────────────────

/** 停滞阈值（天）：超过该天数没有推进进度视为停滞 */
export const STAGNANT_DAYS_THRESHOLD = 5

/** 长线任务判定窗口：deadline 距 now 超过 7 天（与 groupTasks 的长线分区一致） */
const LONG_TERM_WINDOW_MS = 7 * 24 * 3_600_000

const DAY_MS = 24 * 3_600_000

export interface StagnantItem {
  task: Task
  /** 已连续停滞天数（向下取整） */
  stagnantDays: number
  /** 距截止天数（向下取整） */
  daysUntilDeadline: number
}

/** 取任务的最近进度更新时间（ms），字段缺失时按创建时间/当前时间兜底 */
function getLastProgressUpdatedMs(task: Task, now: number): number {
  if (task.lastProgressUpdatedAt) {
    const t = new Date(task.lastProgressUpdatedAt).getTime()
    if (!isNaN(t)) return t
  }
  if (typeof task.createdAt === 'number' && !isNaN(task.createdAt)) {
    return task.createdAt
  }
  return now
}

/**
 * 收集所有停滞的长线任务，按停滞天数从多到少排序。
 * 停滞定义（需同时满足）：
 * - 未完成、未超时
 * - 长线任务（deadline 距 now 超过 7 天）
 * - progress < 100
 * - 距上次进度更新 >= STAGNANT_DAYS_THRESHOLD 天
 */
export function getStagnantTasks(tasks: Task[], now: number = Date.now()): StagnantItem[] {
  if (!tasks || tasks.length === 0) return []

  const items: StagnantItem[] = []
  for (const t of tasks) {
    if (t.completed) continue
    if (t.deadline <= now) continue                       // 已超时不进入
    if (t.deadline - now <= LONG_TERM_WINDOW_MS) continue // 非长线不进入
    if ((t.progress ?? 0) >= 100) continue

    const lastMs = getLastProgressUpdatedMs(t, now)
    const stagnantMs = now - lastMs
    if (stagnantMs < STAGNANT_DAYS_THRESHOLD * DAY_MS) continue

    items.push({
      task: t,
      stagnantDays: Math.floor(stagnantMs / DAY_MS),
      daysUntilDeadline: Math.floor((t.deadline - now) / DAY_MS),
    })
  }

  items.sort((a, b) => b.stagnantDays - a.stagnantDays)
  return items
}
