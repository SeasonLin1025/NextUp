import { Task } from './types'

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────

const URGENCY_WEIGHT: Record<Task['urgency'], number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const SEVEN_DAYS_MS = 7 * 24 * 3_600_000

/** 临界截止窗口（分钟）：deadline 距 now 不足该值视为"临界" */
const NEAR_DEADLINE_WINDOW_MINUTES = 30

/**
 * 必须立即开始的缓冲系数：
 * 若 minutesUntilDeadline <= remainingEstimateMinutes * mustStartBuffer，
 * 说明剩余时间已不足以从容完成，必须立刻动手。
 */
export const MUST_START_BUFFER = 1.2

/**
 * 同 Tier 内 slack 平局容差（分钟）：
 * 两任务 slack 差值小于该值时视为"同等紧张"，才用 urgency 分先后。
 */
export const SLACK_TIE_TOLERANCE_MINUTES = 15

/**
 * 大卡语气"极宽裕"判定倍数：
 * slackMinutes > estimateMinutes * AMPLE_SLACK_MULTIPLIER 视为极宽裕。
 */
export const AMPLE_SLACK_MULTIPLIER = 10

// ─────────────────────────────────────────────
// Risk Tier 类型
// ─────────────────────────────────────────────

/**
 * Risk Tier 风险分层：
 *
 * Tier 1 — 临界且时间不足：deadline 在 30 分钟内，且 slack < 0（做不完）
 * Tier 2 — 时间不足但未临界：slack < 0，但 deadline > 30 分钟后
 * Tier 3 — 临界但可完成：deadline 在 30 分钟内，slack >= 0（还来得及）
 * Tier 4 — 正常任务：deadline > 30 分钟后，slack >= 0
 */
export type RiskTier = 1 | 2 | 3 | 4

export interface TaskSchedulingMeta {
  /** 距截止剩余分钟数 */
  minutesUntilDeadline: number
  /** 剩余预估耗时（来自 task.estimateMinutes） */
  remainingEstimateMinutes: number
  /**
   * Slack（余裕/缺口）分钟数：= minutesUntilDeadline - remainingEstimateMinutes
   * > 0：有余裕；< 0：时间缺口（来不及）
   */
  slackMinutes: number
  /** 风险分层，1 最高 */
  riskTier: RiskTier
  /** 可读风险标签 */
  riskLabel: string
}

// ─────────────────────────────────────────────
// 核心计算
// ─────────────────────────────────────────────

/**
 * 计算单个任务的调度元信息（slack、riskTier 等）
 * 只对 active 任务（未完成、deadline > now）有意义
 */
export function getTaskSchedulingMeta(
  task: Task,
  now: number = Date.now()
): TaskSchedulingMeta {
  const minutesUntilDeadline = (task.deadline - now) / 60_000
  const remainingEstimateMinutes = task.estimateMinutes
  const slackMinutes = minutesUntilDeadline - remainingEstimateMinutes

  const isNearDeadline = minutesUntilDeadline <= NEAR_DEADLINE_WINDOW_MINUTES
  const isTimeDeficit = slackMinutes < 0

  let riskTier: RiskTier
  let riskLabel: string

  if (isNearDeadline && isTimeDeficit) {
    riskTier = 1
    riskLabel = '临界且时间不足'
  } else if (!isNearDeadline && isTimeDeficit) {
    riskTier = 2
    riskLabel = '时间不足'
  } else if (isNearDeadline && !isTimeDeficit) {
    riskTier = 3
    riskLabel = '临界但可完成'
  } else {
    riskTier = 4
    riskLabel = '正常任务'
  }

  return { minutesUntilDeadline, remainingEstimateMinutes, slackMinutes, riskTier, riskLabel }
}

/**
 * 对 active 任务（未完成、deadline > now）按风险排序
 *
 * 排序规则（优先级依次）：
 * 1. riskTier 升序（Tier 1 最优先）——跨层优先级不变
 * 2. 同层内 slack 升序（缺口越大/缓冲越小的越靠前）
 * 3. 若 slack 差值 < SLACK_TIE_TOLERANCE_MINUTES 视为同等紧张 → urgency 降序（high > medium > low）
 * 4. deadline 升序（越早截止越优先）
 * 5. estimateMinutes 降序（越大越优先）
 */
export function sortActiveTasksByRisk(tasks: Task[], now: number = Date.now()): Task[] {
  const withMeta = tasks.map((t) => ({ t, meta: getTaskSchedulingMeta(t, now) }))

  withMeta.sort((a, b) => {
    // 1. riskTier 升序
    if (a.meta.riskTier !== b.meta.riskTier) return a.meta.riskTier - b.meta.riskTier
    // 2. slack 升序；差值在容差内视为同等紧张
    const slackDiff = a.meta.slackMinutes - b.meta.slackMinutes
    if (Math.abs(slackDiff) >= SLACK_TIE_TOLERANCE_MINUTES) return slackDiff
    // 3. urgency 降序
    const uA = URGENCY_WEIGHT[a.t.urgency]
    const uB = URGENCY_WEIGHT[b.t.urgency]
    if (uA !== uB) return uB - uA
    // 4. deadline 升序
    if (a.t.deadline !== b.t.deadline) return a.t.deadline - b.t.deadline
    // 5. estimateMinutes 降序
    return b.t.estimateMinutes - a.t.estimateMinutes
  })

  return withMeta.map(({ t }) => t)
}

/**
 * 从所有未完成且未超时的任务中，按风险算法推荐一个任务
 * 包含「待完成」和「长线任务」，长线任务若进入高风险同样可被推荐
 */
export function getRecommendedTask(tasks: Task[], now: number = Date.now()): Task | null {
  const active = tasks.filter((t) => !t.completed && !t.abandoned && t.deadline > now)
  if (active.length === 0) return null
  const sorted = sortActiveTasksByRisk(active, now)
  return sorted[0]
}

/**
 * 获取"其他需要关注"的任务列表（排除当前推荐任务）
 * 满足以下任一条件：slackMinutes < 0 | minutesUntilDeadline <= 30 | riskTier <= 3
 * 按 sortActiveTasksByRisk 排序，最多返回前 N 条
 */
export function getAttentionTasks(
  tasks: Task[],
  recommendedTaskId?: string,
  now: number = Date.now()
): Array<{ task: Task; meta: TaskSchedulingMeta }> {
  if (!tasks || tasks.length === 0) return []

  const candidates = tasks.filter((t) => {
    if (t.completed || t.abandoned || t.deadline <= now) return false
    if (t.id === recommendedTaskId) return false
    const meta = getTaskSchedulingMeta(t, now)
    return meta.slackMinutes < 0 || meta.minutesUntilDeadline <= 30 || meta.riskTier <= 3
  })

  const sorted = sortActiveTasksByRisk(candidates, now)
  return sorted.map((t) => ({ task: t, meta: getTaskSchedulingMeta(t, now) }))
}

/**
 * 判断单个 active 任务是否进入"必须立即开始"状态
 * 条件：minutesUntilDeadline <= remainingEstimateMinutes * MUST_START_BUFFER
 */
export function isMustStartNow(task: Task, now: number = Date.now()): boolean {
  if (task.completed || task.abandoned || task.deadline <= now) return false
  const meta = getTaskSchedulingMeta(task, now)
  return meta.minutesUntilDeadline <= meta.remainingEstimateMinutes * MUST_START_BUFFER
}

/**
 * 收集所有"必须立即开始"的 active 任务，按风险排序
 * 只针对 active 任务（未完成、deadline > now），已超时任务不进入
 */
export function getMustStartTasks(
  tasks: Task[],
  now: number = Date.now()
): Array<{ task: Task; meta: TaskSchedulingMeta }> {
  if (!tasks || tasks.length === 0) return []

  const candidates = tasks.filter((t) => isMustStartNow(t, now))
  const sorted = sortActiveTasksByRisk(candidates, now)
  return sorted.map((t) => ({ task: t, meta: getTaskSchedulingMeta(t, now) }))
}

// ─────────────────────────────────────────────
// 分组 & 列表排序
// ─────────────────────────────────────────────

export type TaskGroup = {
  pending: Task[]    // 待完成：deadline 在 now ~ now+7天
  longTerm: Task[]   // 长线任务：deadline > now+7天
  overdue: Task[]    // 已超时：deadline < now，未完成、未放弃
  done: Task[]       // 已完成
  abandoned: Task[]  // 已放弃（"不做了"），与已完成语义分离
}

export function groupTasks(tasks: Task[]): TaskGroup {
  const now = Date.now()

  const pending: Task[] = []
  const longTerm: Task[] = []
  const overdue: Task[] = []
  const done: Task[] = []
  const abandoned: Task[] = []

  for (const t of tasks) {
    if (t.abandoned) {
      abandoned.push(t)
    } else if (t.completed) {
      done.push(t)
    } else if (t.deadline < now) {
      overdue.push(t)
    } else if (t.deadline - now > SEVEN_DAYS_MS) {
      longTerm.push(t)
    } else {
      pending.push(t)
    }
  }

  // 待完成 & 长线任务：统一用风险排序
  const sortedPending = sortActiveTasksByRisk(pending, now)
  const sortedLongTerm = sortActiveTasksByRisk(longTerm, now)
  // 已超时：按 deadline 升序（超时最久的在前）
  overdue.sort((a, b) => a.deadline - b.deadline)
  // 已完成：按 completedAt 倒序
  done.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  // 已放弃：按 abandonedAt 倒序
  abandoned.sort((a, b) => (b.abandonedAt ?? '').localeCompare(a.abandonedAt ?? ''))

  return { pending: sortedPending, longTerm: sortedLongTerm, overdue, done, abandoned }
}

/** 兼容旧版 sortTasks，将四区展平返回 */
export function sortTasks(tasks: Task[]): Task[] {
  const { pending, longTerm, overdue, done } = groupTasks(tasks)
  return [...pending, ...longTerm, ...overdue, ...done]
}

// 保留旧 calcScore，避免潜在引用报错
export function calcScore(task: Task, now: number = Date.now()): number {
  const urgencyWeight = URGENCY_WEIGHT[task.urgency]
  const hoursLeft = (task.deadline - now) / 3_600_000
  const safHoursLeft = Math.max(hoursLeft, 0.01)
  const tightness = task.estimateMinutes / 60 / safHoursLeft
  return urgencyWeight * 0.4 + tightness * 100 * 0.6
}
