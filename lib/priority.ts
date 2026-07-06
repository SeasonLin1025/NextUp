import { Task } from './types'

const URGENCY_WEIGHT: Record<Task['urgency'], number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function calcScore(task: Task, now: number = Date.now()): number {
  const urgencyWeight = URGENCY_WEIGHT[task.urgency]
  const hoursLeft = (task.deadline - now) / 3_600_000
  // Avoid division by zero or negative time
  const safHoursLeft = Math.max(hoursLeft, 0.01)
  const tightness = task.estimateMinutes / 60 / safHoursLeft
  return urgencyWeight * 0.4 + tightness * 100 * 0.6
}

export function sortTasks(tasks: Task[]): Task[] {
  const now = Date.now()
  const pending = tasks
    .filter((t) => !t.completed)
    .sort((a, b) => calcScore(b, now) - calcScore(a, now))

  const done = tasks
    .filter((t) => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return [...pending, ...done]
}
