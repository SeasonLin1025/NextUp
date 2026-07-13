import { Task } from './types'
import { getTaskSchedulingMeta, RiskTier } from './priority'

// ─── 常量 ─────────────────────────────────────
export const PX_PER_HOUR    = 64
export const PX_PER_MINUTE  = PX_PER_HOUR / 60
export const MIN_BLOCK_HEIGHT = 32
export const FREE_SLOT_MIN = 30

// ─── 类型 ─────────────────────────────────────

export type BlockStatus = 'active' | 'overdue' | 'done'

export interface TimeBlock {
  task: Task
  status: BlockStatus
  // 相对时间轴 axisStartHour 的分钟偏移
  endMin: number        // deadline 对应分钟偏移（定位锚点）
  durationMin: number   // estimateMinutes（active 任务用），其他为固定高度
  riskTier: RiskTier
  riskLabel: string
  hasConflict: boolean
}

export interface FreeSlot {
  startMin: number
  endMin: number
  durationMin: number
}

export interface DayViewData {
  axisStartHour: number
  axisEndHour: number
  axisMinutes: number
  blocks: TimeBlock[]
  freeSlots: FreeSlot[]
}

// ─── 主入口 ───────────────────────────────────

export function buildDayViewData(tasks: Task[], dateStr: string, now: number): DayViewData {
  const [year, month, day] = dateStr.split('-').map(Number)
  const dayBase = new Date(year, month - 1, day).getTime()

  const activeTasks  = tasks.filter((t) => !t.completed && t.deadline > now)
  const overdueTasks = tasks.filter((t) => !t.completed && t.deadline <= now)
  const doneTasks    = tasks.filter((t) => t.completed)

  // 时间轴范围：默认 08-24，根据所有任务扩展
  const DEFAULT_START = 8
  const DEFAULT_END   = 24
  let axisStartHour = DEFAULT_START
  let axisEndHour   = DEFAULT_END

  const allRanges = [
    ...activeTasks.map((t) => ({
      startMs: t.deadline - t.estimateMinutes * 60_000,
      endMs: t.deadline,
    })),
    // 已超时/已完成：deadline 附近 ±1h 范围，确保时间轴覆盖
    ...[...overdueTasks, ...doneTasks].map((t) => ({
      startMs: t.deadline - 60 * 60_000,
      endMs: t.deadline,
    })),
  ]

  for (const { startMs, endMs } of allRanges) {
    const startHour = (startMs - dayBase) / 3_600_000
    const endHour   = (endMs - dayBase) / 3_600_000
    if (startHour < axisStartHour) axisStartHour = Math.floor(startHour)
    if (endHour > axisEndHour)     axisEndHour   = Math.ceil(endHour)
  }

  axisStartHour = Math.max(0, axisStartHour)
  axisEndHour   = Math.min(48, axisEndHour)

  const axisStartMs = dayBase + axisStartHour * 3_600_000
  const axisMinutes = (axisEndHour - axisStartHour) * 60

  // ── active 任务块（参与空闲/冲突计算）
  const activeBlocks: TimeBlock[] = activeTasks.map((t) => {
    const meta   = getTaskSchedulingMeta(t, now)
    const endMin = Math.round((t.deadline - axisStartMs) / 60_000)
    return {
      task: t,
      status: 'active',
      endMin,
      durationMin: t.estimateMinutes,
      riskTier: meta.riskTier,
      riskLabel: meta.riskLabel,
      hasConflict: false,
    }
  })

  // 标记冲突（只在 active 块之间）
  for (let i = 0; i < activeBlocks.length; i++) {
    for (let j = i + 1; j < activeBlocks.length; j++) {
      const a = activeBlocks[i], b = activeBlocks[j]
      const aStart = a.endMin - a.durationMin
      const bStart = b.endMin - b.durationMin
      if (aStart < b.endMin && bStart < a.endMin) {
        a.hasConflict = true
        b.hasConflict = true
      }
    }
  }

  // ── overdue 任务块（只作时间标记，不参与空闲/冲突）
  const overdueBlocks: TimeBlock[] = overdueTasks.map((t) => {
    const endMin = Math.round((t.deadline - axisStartMs) / 60_000)
    return {
      task: t,
      status: 'overdue',
      endMin,
      durationMin: 0,  // 用固定最小高度
      riskTier: 4,
      riskLabel: '已超时',
      hasConflict: false,
    }
  })

  // ── done 任务块（只作时间标记）
  const doneBlocks: TimeBlock[] = doneTasks.map((t) => {
    const endMin = Math.round((t.deadline - axisStartMs) / 60_000)
    return {
      task: t,
      status: 'done',
      endMin,
      durationMin: 0,
      riskTier: 4,
      riskLabel: '已完成',
      hasConflict: false,
    }
  })

  // 合并所有块，按 endMin 排序
  const blocks: TimeBlock[] = [...activeBlocks, ...overdueBlocks, ...doneBlocks]
    .sort((a, b) => a.endMin - b.endMin)

  // 空闲区间：仅基于 active 块
  const freeSlots: FreeSlot[] = []
  const activeForFree = activeBlocks.sort((a, b) => (a.endMin - a.durationMin) - (b.endMin - b.durationMin))
  const merged: [number, number][] = []
  for (const b of activeForFree) {
    const s = Math.max(0, b.endMin - b.durationMin)
    const e = Math.min(axisMinutes, b.endMin)
    if (merged.length === 0 || merged[merged.length - 1][1] < s) {
      merged.push([s, e])
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
    }
  }
  let cursor = 0
  for (const [s, e] of merged) {
    if (s - cursor >= FREE_SLOT_MIN) {
      freeSlots.push({ startMin: cursor, endMin: s, durationMin: s - cursor })
    }
    cursor = e
  }
  if (axisMinutes - cursor >= FREE_SLOT_MIN) {
    freeSlots.push({ startMin: cursor, endMin: axisMinutes, durationMin: axisMinutes - cursor })
  }

  return { axisStartHour, axisEndHour, axisMinutes, blocks, freeSlots }
}

// ─── 定位工具 — 底部锚定 deadline ────────────

/**
 * 计算任务块的 top（px），底部锚定 endMin
 * 短任务向上扩展，不向下溢出 deadline
 */
export function calcBlockTop(endMin: number, durationMin: number): number {
  const rawHeight = durationMin * PX_PER_MINUTE
  const visualHeight = Math.max(MIN_BLOCK_HEIGHT, rawHeight)
  const endPx = endMin * PX_PER_MINUTE
  return endPx - visualHeight
}

export function calcBlockHeight(durationMin: number): number {
  if (durationMin === 0) return MIN_BLOCK_HEIGHT
  return Math.max(MIN_BLOCK_HEIGHT, durationMin * PX_PER_MINUTE)
}

// ─── 其他工具函数 ─────────────────────────────

export function minutesToPx(min: number): number {
  return Math.max(MIN_BLOCK_HEIGHT, min * PX_PER_MINUTE)
}

export function minutesToTop(min: number): number {
  return min * PX_PER_MINUTE
}

export function minToHHmm(axisStartHour: number, offsetMin: number): string {
  const total = axisStartHour * 60 + offsetMin
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatMin(minutes: number): string {
  const abs = Math.abs(Math.round(minutes))
  if (abs < 60) return `${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function getNowOffsetMin(axisStartHour: number, axisEndHour: number): number | null {
  const now = new Date()
  const currentMin = now.getHours() * 60 + now.getMinutes()
  const startMin   = axisStartHour * 60
  const endMin     = axisEndHour * 60
  if (currentMin < startMin || currentMin > endMin) return null
  return currentMin - startMin
}
