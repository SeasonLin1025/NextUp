import { Task } from './types'

const URGENCY_WEIGHT: Record<Task['urgency'], number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const SEVEN_DAYS_MS = 7 * 24 * 3_600_000

export type TaskGroup = {
  pending: Task[]      // 待完成：deadline 在 now ~ now+7天
  longTerm: Task[]     // 长线任务：deadline > now+7天
  overdue: Task[]      // 已超时：deadline < now，未完成
  done: Task[]         // 已完成
}

export function calcScore(task: Task, now: number = Date.now()): number {
  const urgencyWeight = URGENCY_WEIGHT[task.urgency]
  const hoursLeft = (task.deadline - now) / 3_600_000
  const safHoursLeft = Math.max(hoursLeft, 0.01)
  const tightness = task.estimateMinutes / 60 / safHoursLeft
  return urgencyWeight * 0.4 + tightness * 100 * 0.6
}

export function groupTasks(tasks: Task[]): TaskGroup {
  const now = Date.now()

  const pending: Task[] = []
  const longTerm: Task[] = []
  const overdue: Task[] = []
  const done: Task[] = []

  for (const t of tasks) {
    if (t.completed) {
      done.push(t)
    } else if (t.deadline < now) {
      overdue.push(t)
    } else if (t.deadline - now > SEVEN_DAYS_MS) {
      longTerm.push(t)
    } else {
      pending.push(t)
    }
  }

  // 待完成：按 score 降序
  pending.sort((a, b) => calcScore(b, now) - calcScore(a, now))
  // 长线任务：按 deadline 升序（最近到期排前面）
  longTerm.sort((a, b) => a.deadline - b.deadline)
  // 已超时：按超时时长降序（超时最久的在前）
  overdue.sort((a, b) => a.deadline - b.deadline)
  // 已完成：按 completedAt 倒序
  done.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return { pending, longTerm, overdue, done }
}

/** 兼容旧版 sortTasks，将四区展平返回 */
export function sortTasks(tasks: Task[]): Task[] {
  const { pending, longTerm, overdue, done } = groupTasks(tasks)
  return [...pending, ...longTerm, ...overdue, ...done]
}
