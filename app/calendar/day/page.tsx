'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  format, addDays, subDays, parseISO, isToday, isSameDay,
  startOfWeek, eachDayOfInterval,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'
import { Task } from '@/lib/types'
import { loadTasks } from '@/lib/storage'
import DayTimeline from '@/components/DayTimeline'
import BottomNav from '@/components/BottomNav'

// ─── 一周日期横条 ─────────────────────────────

const WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六']

function WeekStrip({ dateObj, onSelect }: {
  dateObj: Date
  onSelect: (d: Date) => void
}) {
  // 从周日开始，取 7 天
  const weekStart = startOfWeek(dateObj, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  return (
    <div className="flex items-stretch justify-around border-b border-slate-100 bg-white mb-4 rounded-xl overflow-hidden shadow-sm">
      {days.map((d) => {
        const selected = isSameDay(d, dateObj)
        const today    = isToday(d)
        return (
          <button
            key={d.toISOString()}
            onClick={() => onSelect(d)}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors
              ${selected ? 'bg-transparent' : 'hover:bg-slate-50'}
            `}
          >
            <span className={`text-[10px] font-medium ${selected ? 'text-blue-500' : 'text-slate-400'}`}>
              {WEEK_SHORT[d.getDay()]}
            </span>
            <span className={`
              w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold leading-none
              ${selected
                ? 'bg-blue-500 text-white'
                : today
                  ? 'text-blue-500 font-bold'
                  : 'text-slate-700'
              }
            `}>
              {format(d, 'd')}
            </span>
            {today && !selected && (
              <span className="w-1 h-1 rounded-full bg-blue-400" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── 页面主体 ─────────────────────────────────

function DayPageContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [tasks, setTasks]     = useState<Task[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = loadTasks()
    setTasks(saved.map((t) => ({
      ...t,
      progress: t.progress ?? 0,
      originalEstimate: t.originalEstimate ?? t.estimateMinutes,
    })))
    setMounted(true)
  }, [])

  const dateStr = useMemo(() => {
    const q = searchParams.get('date')
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q
    return format(new Date(), 'yyyy-MM-dd')
  }, [searchParams])

  const dateObj = useMemo(() => parseISO(dateStr), [dateStr])

  function goDate(d: Date) {
    router.push(`/calendar/day?date=${format(d, 'yyyy-MM-dd')}`)
  }

  const dayTasks = useMemo(() => {
    return tasks.filter(
      (t) => format(new Date(t.deadline), 'yyyy-MM-dd') === dateStr
    )
  }, [tasks, dateStr])

  const dateLabel = format(dateObj, 'M月d日', { locale: zhCN })
  const weekLabel = format(dateObj, 'EEEE', { locale: zhCN }).replace('星期', '周')
  const todayMark = isToday(dateObj)

  if (!mounted) {
    return (
      <div className="container mx-auto max-w-lg py-4 px-4 pb-24">
        <div className="h-14 bg-white rounded-xl animate-pulse mb-4" />
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-lg py-4 px-4 pb-28">

      {/* 顶部：返回 + 前后导航 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => router.push('/calendar')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} />
          <span>月视图</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => goDate(subDays(dateObj, 1))}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
          >
            前一天
          </button>
          {!todayMark && (
            <button
              onClick={() => goDate(new Date())}
              className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
            >
              今天
            </button>
          )}
          <button
            onClick={() => goDate(addDays(dateObj, 1))}
            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
          >
            后一天
          </button>
        </div>
      </div>

      {/* 一周日期横条 */}
      <WeekStrip dateObj={dateObj} onSelect={goDate} />

      {/* 日期标题 */}
      <div className="mb-4 flex items-baseline gap-2">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {dateLabel}
        </h1>
        <span className="text-sm font-medium text-slate-500">{weekLabel}</span>
        {todayMark && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
            今天
          </span>
        )}
      </div>

      {/* 时间轴（始终渲染）*/}
      <DayTimeline tasks={dayTasks} dateStr={dateStr} />
    </div>
  )
}

// ─── 导出页面 ─────────────────────────────────

export default function DayPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="container mx-auto max-w-lg py-4 px-4">
          <div className="h-14 bg-white rounded-xl animate-pulse mb-4" />
          <div className="h-96 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      }>
        <DayPageContent />
      </Suspense>
      <BottomNav />
    </main>
  )
}
