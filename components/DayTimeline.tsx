'use client'

import { useEffect, useState, useMemo } from 'react'
import { Task } from '@/lib/types'
import { getTaskSchedulingMeta } from '@/lib/priority'
import { formatMin, minToHHmm } from '@/lib/timeBlocks'
import { format, isToday, parseISO } from 'date-fns'
import HourRow, { ActiveEntry, MarkerEntry } from './HourRow'

interface Props {
  tasks: Task[]
  dateStr: string
}

const DEFAULT_START = 8
const DEFAULT_END   = 24

export default function DayTimeline({ tasks, dateStr }: Props) {
  const now = Date.now()
  const isCurrentDay = isToday(parseISO(dateStr))

  const [year, month, day] = dateStr.split('-').map(Number)
  const dayBase = new Date(year, month - 1, day).getTime()

  const activeTasks  = tasks.filter((t) => !t.completed && t.deadline > now)
  const overdueTasks = tasks.filter((t) => !t.completed && t.deadline <= now)
  const doneTasks    = tasks.filter((t) => t.completed)

  // ── 计算时间轴起止小时 ──────────────────────
  let axisStart = DEFAULT_START
  let axisEnd   = DEFAULT_END

  for (const t of activeTasks) {
    const startMs  = t.deadline - t.estimateMinutes * 60_000
    const startH   = (startMs - dayBase) / 3_600_000
    const endH     = (t.deadline - dayBase) / 3_600_000
    if (startH < axisStart) axisStart = Math.floor(startH)
    if (endH > axisEnd)     axisEnd   = Math.ceil(endH)
  }
  for (const t of [...overdueTasks, ...doneTasks]) {
    const h = (t.deadline - dayBase) / 3_600_000
    if (h < axisStart) axisStart = Math.floor(h)
    if (h > axisEnd)   axisEnd   = Math.ceil(h)
  }
  axisStart = Math.max(0, axisStart)
  axisEnd   = Math.min(48, axisEnd)

  // ── 当前时间 ─────────────────────────────────
  const [nowTime, setNowTime] = useState<{ hour: number; minute: number } | null>(null)
  useEffect(() => {
    if (!isCurrentDay) { setNowTime(null); return }
    const update = () => {
      const d = new Date()
      setNowTime({ hour: d.getHours(), minute: d.getMinutes() })
    }
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [isCurrentDay])

  // ── 冲突检测（active 任务之间）────────────────
  const conflictIds = useMemo(() => {
    const ids = new Set<string>()
    for (let i = 0; i < activeTasks.length; i++) {
      for (let j = i + 1; j < activeTasks.length; j++) {
        const a = activeTasks[i], b = activeTasks[j]
        const aStart = a.deadline - a.estimateMinutes * 60_000
        const bStart = b.deadline - b.estimateMinutes * 60_000
        if (aStart < b.deadline && bStart < a.deadline) {
          ids.add(a.id); ids.add(b.id)
        }
      }
    }
    return ids
  }, [activeTasks])

  // ── 活跃任务 → startHour 归属 ────────────────
  const activeByStartHour = useMemo(() => {
    const map = new Map<number, ActiveEntry[]>()
    for (const t of activeTasks) {
      const meta      = getTaskSchedulingMeta(t, now)
      const startMs   = t.deadline - t.estimateMinutes * 60_000
      const startHour = Math.floor((startMs - dayBase) / 3_600_000)
      const endHour   = Math.floor((t.deadline - dayBase) / 3_600_000)
      const startMin  = Math.round((startMs - dayBase) / 60_000)
      const endMin    = Math.round((t.deadline - dayBase) / 60_000)
      const startHHmm = `${String(Math.floor(startMin / 60) % 24).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`
      const endHHmm   = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
      const entry: ActiveEntry = {
        task: t,
        startHour,
        startHHmm,
        endHHmm,
        riskTier: meta.riskTier,
        riskLabel: meta.riskLabel,
        hasConflict: conflictIds.has(t.id),
        urgency: t.urgency,
        estimateMinutes: t.estimateMinutes,
      }
      if (!map.has(startHour)) map.set(startHour, [])
      map.get(startHour)!.push(entry)
    }
    return map
  }, [activeTasks, conflictIds, dayBase, now])

  // ── 标记型任务 → deadline 小时归属 ────────────
  const markerByHour = useMemo(() => {
    const map = new Map<number, MarkerEntry[]>()
    const add = (t: Task, status: 'overdue' | 'done') => {
      const h = Math.floor((t.deadline - dayBase) / 3_600_000)
      if (!map.has(h)) map.set(h, [])
      const overdueMin = status === 'overdue'
        ? Math.max(0, Math.floor((now - t.deadline) / 60_000))
        : undefined
      map.get(h)!.push({ task: t, status, overdueMin })
    }
    overdueTasks.forEach((t) => add(t, 'overdue'))
    doneTasks.forEach((t) => add(t, 'done'))
    return map
  }, [overdueTasks, doneTasks, dayBase, now])

  // ── 小时列表 ─────────────────────────────────
  const hours: number[] = []
  for (let h = axisStart; h < axisEnd; h++) hours.push(h)

  const hasAnyContent = activeTasks.length + overdueTasks.length + doneTasks.length > 0

  return (
    <div className="w-full">

      {/* ── 已超时摘要（紧凑单行）── */}
      {overdueTasks.length > 0 && (
        <div className="mb-2 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50/50 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-[10px] font-semibold text-red-400 tracking-wide flex-shrink-0">
            ⚠ 已超时
          </span>
          {overdueTasks.map((t) => {
            const m = Math.max(0, Math.floor((now - t.deadline) / 60_000))
            return (
              <span key={t.id} className="text-[10px] text-red-400">
                {t.name} · {format(new Date(t.deadline), 'HH:mm')} · {formatMin(m)}
              </span>
            )
          })}
        </div>
      )}

      {/* ── 弹性小时行时间轴 ── */}
      <div className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
        {/* 无任何内容的轻提示（叠在第一行）*/}
        {!hasAnyContent && (
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-slate-300 leading-relaxed">
              {axisStart}:00 – {axisEnd % 24 === 0 ? '24:00' : `${axisEnd}:00`}<br />
              暂无待处理任务，可安排新事项
            </p>
          </div>
        )}

        {hours.map((hour, idx) => (
          <HourRow
            key={hour}
            hour={hour}
            activeEntries={activeByStartHour.get(hour) ?? []}
            markerEntries={markerByHour.get(hour) ?? []}
            isNowHour={isCurrentDay && nowTime?.hour === hour % 24}
            nowMinute={isCurrentDay && nowTime?.hour === hour % 24 ? nowTime?.minute : undefined}
            isAxisStart={idx === 0}
          />
        ))}
      </div>
    </div>
  )
}
