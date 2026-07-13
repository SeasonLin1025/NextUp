'use client'

import {
  TimeBlock, BlockStatus,
  calcBlockTop, calcBlockHeight,
  minToHHmm, formatMin,
} from '@/lib/timeBlocks'
import { RiskTier } from '@/lib/priority'
import { format } from 'date-fns'

// ─── 样式 ─────────────────────────────────────

const TIER_STYLE: Record<RiskTier, { bg: string; border: string; text: string; label: string }> = {
  1: { bg: 'bg-red-50',    border: 'border-l-4 border-red-400',    text: 'text-red-700',    label: 'bg-red-100 text-red-700' },
  2: { bg: 'bg-orange-50', border: 'border-l-4 border-orange-400', text: 'text-orange-700', label: 'bg-orange-100 text-orange-700' },
  3: { bg: 'bg-yellow-50', border: 'border-l-4 border-yellow-400', text: 'text-yellow-800', label: 'bg-yellow-100 text-yellow-800' },
  4: { bg: 'bg-blue-50',   border: 'border-l-4 border-blue-300',   text: 'text-blue-700',   label: 'bg-blue-100 text-blue-700' },
}

const URGENCY_LABEL: Record<string, string> = { high: '紧急', medium: '中等', low: '普通' }
const URGENCY_CLS: Record<string, string> = {
  high:   'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-slate-100 text-slate-500',
}

interface Props {
  block: TimeBlock
  axisStartHour: number
  now: number
}

export default function TimelineTaskBlock({ block, axisStartHour, now }: Props) {
  const { task, status, endMin, durationMin, riskTier, riskLabel, hasConflict } = block

  const topPx    = calcBlockTop(endMin, durationMin)
  const heightPx = calcBlockHeight(durationMin)
  const compact  = heightPx < 56

  const endHHmm = minToHHmm(axisStartHour, endMin)

  // ── 已完成任务块 ──────────────────────────────
  if (status === 'done') {
    return (
      <div
        className="absolute left-0 right-1 rounded-r overflow-hidden border-l-4 border-gray-300 bg-gray-50 opacity-80 z-[1]"
        style={{ top: topPx, height: heightPx }}
      >
        <div className="px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
          <div>
            <p className="text-xs font-medium text-gray-400 line-through leading-tight truncate">
              {task.name}
            </p>
            <p className="text-[10px] text-gray-400">截止 {endHHmm}</p>
          </div>
          {!compact && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">
                已完成
              </span>
              {task.completedOverdue && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-300 font-medium">
                  逾期完成
                </span>
              )}
              {task.completedAt && (
                <span className="text-[9px] text-gray-300">
                  完成于 {format(new Date(task.completedAt), 'HH:mm')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 已超时任务块 ──────────────────────────────
  if (status === 'overdue') {
    const overdueMin = Math.max(0, Math.floor((now - task.deadline) / 60_000))
    return (
      <div
        className="absolute left-0 right-1 rounded-r overflow-hidden border-l-4 border-red-300 bg-red-50/70 z-[1]"
        style={{ top: topPx, height: heightPx }}
      >
        <div className="px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
          <div>
            <p className="text-xs font-medium text-red-500 leading-tight truncate">{task.name}</p>
            <p className="text-[10px] text-red-400">截止 {endHHmm}</p>
          </div>
          {!compact && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-500 font-medium">
                已超时
              </span>
              <span className="text-[9px] text-red-400">
                {formatMin(overdueMin)}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── 正常活跃任务块 ────────────────────────────
  const style = TIER_STYLE[riskTier]

  return (
    <div
      className={`
        absolute left-0 right-1 rounded-r-lg overflow-hidden shadow-sm z-[2]
        ${style.bg} ${style.border}
        ${hasConflict ? 'ring-1 ring-red-400' : ''}
      `}
      style={{ top: topPx, height: heightPx }}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-between overflow-hidden">
        <div>
          <p className={`text-xs font-semibold leading-tight truncate ${style.text}`}>
            {task.name}
          </p>
          <p className="text-[10px] text-slate-500 leading-tight">截止 {endHHmm}</p>
        </div>
        {!compact && (
          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {hasConflict && (
              <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-red-100 text-red-600">
                时间冲突
              </span>
            )}
            <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${style.label}`}>
              {riskLabel}
            </span>
            <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${URGENCY_CLS[task.urgency]}`}>
              {URGENCY_LABEL[task.urgency]}
            </span>
            <span className="text-[9px] text-slate-400">{formatMin(task.estimateMinutes)}</span>
          </div>
        )}
        {compact && hasConflict && (
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-red-100 text-red-600 self-start">
            时间冲突
          </span>
        )}
      </div>
    </div>
  )
}
