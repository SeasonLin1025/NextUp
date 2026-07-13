'use client'

import { Task } from '@/lib/types'
import { getTaskSchedulingMeta, RiskTier } from '@/lib/priority'
import { formatMin, minToHHmm } from '@/lib/timeBlocks'
import { format } from 'date-fns'

// ─── 样式常量 ─────────────────────────────────

const TIER_STYLE: Record<RiskTier, { bg: string; border: string; text: string; label: string }> = {
  1: { bg: 'bg-red-50',    border: 'border-l-4 border-red-400',    text: 'text-red-700',    label: 'bg-red-100 text-red-700' },
  2: { bg: 'bg-orange-50', border: 'border-l-4 border-orange-400', text: 'text-orange-700', label: 'bg-orange-100 text-orange-700' },
  3: { bg: 'bg-yellow-50', border: 'border-l-4 border-yellow-400', text: 'text-yellow-800', label: 'bg-yellow-100 text-yellow-800' },
  4: { bg: 'bg-blue-50',   border: 'border-l-4 border-blue-300',   text: 'text-blue-700',   label: 'bg-blue-100 text-blue-700' },
}
const URGENCY_LABEL: Record<string, string> = { high: '紧急', medium: '中等', low: '普通' }
const URGENCY_CLS: Record<string, string>   = {
  high:   'bg-red-100 text-red-600',
  medium: 'bg-yellow-100 text-yellow-700',
  low:    'bg-slate-100 text-slate-500',
}

const MAX_SHOW = 4

// ─── 数据类型 ─────────────────────────────────

export interface ActiveEntry {
  task: Task
  startHour: number  // 任务开始所在小时
  startHHmm: string
  endHHmm: string
  riskTier: RiskTier
  riskLabel: string
  hasConflict: boolean
  urgency: Task['urgency']
  estimateMinutes: number
}

export interface MarkerEntry {
  task: Task
  status: 'overdue' | 'done'
  overdueMin?: number
}

interface Props {
  hour: number                   // 本行代表的整点小时
  activeEntries: ActiveEntry[]   // 跨入或开始于本小时的活跃任务
  markerEntries: MarkerEntry[]   // deadline 归属本小时的 overdue/done
  isNowHour: boolean             // 当前时刻是否在本小时
  nowMinute?: number             // 当前分钟（0-59），用于红线位置
  isAxisStart: boolean           // 第一行（顶部无分割线）
}

export default function HourRow({
  hour, activeEntries, markerEntries, isNowHour, nowMinute, isAxisStart,
}: Props) {
  const hourLabel = `${String(hour % 24).padStart(2, '0')}:00`

  const overdueEntries = markerEntries.filter((e) => e.status === 'overdue')
  const doneEntries    = markerEntries.filter((e) => e.status === 'done')
  // 展示顺序：超时优先，同状态按 deadline 升序
  const sortedMarkers = [
    ...overdueEntries.sort((a, b) => a.task.deadline - b.task.deadline),
    ...doneEntries.sort((a, b) => a.task.deadline - b.task.deadline),
  ]
  const showMarkers  = sortedMarkers.slice(0, MAX_SHOW)
  const hiddenCount  = sortedMarkers.length - showMarkers.length

  const hasContent = activeEntries.length > 0 || markerEntries.length > 0

  // 聚合标题
  let markerTitle = ''
  if (overdueEntries.length > 0 && doneEntries.length > 0) {
    markerTitle = `${overdueEntries.length} 项已超时 · ${doneEntries.length} 项已完成`
  } else if (overdueEntries.length > 0) {
    markerTitle = overdueEntries.length === 1 ? '已超时' : `${overdueEntries.length} 项已超时`
  } else if (doneEntries.length > 0) {
    markerTitle = doneEntries.length === 1 ? '已完成' : `${doneEntries.length} 项已完成`
  }

  return (
    <div className={`flex min-h-[64px] ${!isAxisStart ? 'border-t border-slate-100' : ''}`}>
      {/* 左侧时间刻度 */}
      <div className="w-12 flex-shrink-0 pt-1 pr-2 text-right border-r border-slate-100 bg-slate-50/40">
        <span className="text-[10px] text-slate-400 leading-none">{hourLabel}</span>
        {isNowHour && nowMinute !== undefined && (
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
            style={{ top: `${(nowMinute / 60) * 100}%` }}
          >
          </div>
        )}
      </div>

      {/* 右侧内容区 */}
      <div className="flex-1 relative px-2 pt-1 pb-2 overflow-hidden">
        {/* 当前时间红线（只在本小时显示）*/}
        {isNowHour && nowMinute !== undefined && (
          <div
            className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
            style={{ top: `${(nowMinute / 60) * 64}px` }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            <div className="flex-1 border-t-2 border-red-400" />
            <span className="text-[10px] text-red-500 font-medium pr-1 bg-white leading-none">
              {String(hour % 24).padStart(2, '0')}:{String(nowMinute).padStart(2, '0')}
            </span>
          </div>
        )}

        {/* 活跃任务块 */}
        {activeEntries.map(({ task, startHHmm, endHHmm, riskTier, riskLabel, hasConflict, urgency, estimateMinutes }) => {
          const style = TIER_STYLE[riskTier]
          return (
            <div
              key={task.id}
              className={`mb-1.5 rounded-r px-2 py-1.5 ${style.bg} ${style.border} ${hasConflict ? 'ring-1 ring-red-400' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-1 flex-wrap">
                <p className={`text-xs font-semibold leading-tight ${style.text}`}>{task.name}</p>
                <span className="text-[10px] text-slate-500 flex-shrink-0">
                  {startHHmm}–{endHHmm}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {hasConflict && (
                  <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-red-100 text-red-600">时间冲突</span>
                )}
                <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${style.label}`}>{riskLabel}</span>
                <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${URGENCY_CLS[urgency]}`}>
                  {URGENCY_LABEL[urgency]}
                </span>
                <span className="text-[9px] text-slate-400">预计 {formatMin(estimateMinutes)}</span>
              </div>
            </div>
          )
        })}

        {/* 标记型任务（超时/已完成）聚合 */}
        {markerEntries.length > 0 && (
          <div className={`rounded-r px-2 pt-1 pb-1.5 ${overdueEntries.length > 0 ? 'bg-red-50/60 border-l-4 border-red-200' : 'bg-gray-50 border-l-4 border-gray-200'}`}>
            {markerTitle && (
              <p className={`text-[10px] font-semibold mb-1 ${overdueEntries.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {markerTitle}
              </p>
            )}
            <div className="space-y-0.5">
              {showMarkers.map(({ task, status, overdueMin }) => (
                <div key={task.id} className="flex items-baseline gap-1 flex-wrap">
                  {status === 'done' && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0">✓</span>
                  )}
                  <span className={`text-[10px] font-medium truncate max-w-[45%] ${
                    status === 'overdue' ? 'text-red-500' : 'text-gray-400 line-through'
                  }`}>
                    {task.name}
                  </span>
                  <span className={`text-[10px] flex-shrink-0 ${status === 'overdue' ? 'text-red-400' : 'text-gray-400'}`}>
                    {format(new Date(task.deadline), 'HH:mm')}
                  </span>
                  {status === 'overdue' && overdueMin !== undefined && (
                    <span className="text-[10px] text-red-400 flex-shrink-0">+{formatMin(overdueMin)}</span>
                  )}
                  {status === 'done' && (
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {task.completedOverdue ? '逾期完成' : '已完成'}
                    </span>
                  )}
                </div>
              ))}
              {hiddenCount > 0 && (
                <p className="text-[10px] text-slate-400">+{hiddenCount} 项更多</p>
              )}
            </div>
          </div>
        )}

        {/* 纯空行：轻量占位，不填色 */}
        {!hasContent && (
          <div className="h-full min-h-[40px]" />
        )}
      </div>
    </div>
  )
}
