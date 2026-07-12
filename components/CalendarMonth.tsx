'use client'

import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, addMonths, subMonths,
} from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Task } from '@/lib/types'
import { getTaskSchedulingMeta, RiskTier } from '@/lib/priority'

// ─── 工具函数 ─────────────────────────────────

export function formatMinutes(minutes: number): string {
  const abs = Math.abs(Math.round(minutes))
  if (abs < 60) return `${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// ─── 月格子任务胶囊样式 ───────────────────────
// 优先级：completed > overdue > active(Tier)

const TIER_PILL: Record<RiskTier, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border border-red-300' },
  2: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border border-orange-300' },
  3: { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border border-yellow-300' },
  4: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border border-blue-200' },
}

const COMPLETED_PILL = { bg: 'bg-gray-100', text: 'text-gray-400', border: '' }
const OVERDUE_PILL   = { bg: 'bg-red-50',   text: 'text-red-400',  border: 'border border-dashed border-red-300' }

// ─── 忙碌度背景 ───────────────────────────────

function busyBg(dayLoadMinutes: number): string {
  const ratio = dayLoadMinutes / 480
  if (ratio <= 0)  return 'bg-white'
  if (ratio < 0.3) return 'bg-blue-50'
  if (ratio < 0.6) return 'bg-yellow-50'
  if (ratio < 0.9) return 'bg-orange-50'
  return 'bg-red-50'
}

// ─── Props ────────────────────────────────────

interface Props {
  tasks: Task[]
  currentMonth: Date
  selectedDate: Date | null
  onMonthChange: (d: Date) => void
  onSelectDate: (d: Date) => void
}

const WEEK_HEADERS = ['一', '二', '三', '四', '五', '六', '日']

export default function CalendarMonth({
  tasks, currentMonth, selectedDate, onMonthChange, onSelectDate,
}: Props) {
  const now = Date.now()

  // 42 格日期数组
  const monthStart = startOfMonth(currentMonth)
  const monthEnd   = endOfMonth(currentMonth)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  while (days.length < 42) {
    days.push(new Date(days[days.length - 1].getTime() + 86_400_000))
  }

  // 按 deadline 日期分组所有任务（含已完成）
  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    const dateKey = format(new Date(task.deadline), 'yyyy-MM-dd')
    if (!tasksByDate.has(dateKey)) tasksByDate.set(dateKey, [])
    tasksByDate.get(dateKey)!.push(task)
  }

  const titleStr = format(currentMonth, 'yyyy年M月', { locale: zhCN })

  return (
    <div className="w-full">
      {/* 导航栏 */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{titleStr}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMonthChange(new Date())}
            className="text-xs px-3 py-1 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => onMonthChange(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 周表头 + 日期格子 */}
      <div className="grid grid-cols-7 border-t border-l border-slate-100">
        {WEEK_HEADERS.map((d) => (
          <div key={d} className="border-r border-b border-slate-100 py-1.5 text-center text-xs font-semibold text-slate-400">
            {d}
          </div>
        ))}

        {days.map((day) => {
          const dateKey  = format(day, 'yyyy-MM-dd')
          const inMonth  = isSameMonth(day, currentMonth)
          const todayDay = isToday(day)
          const selected = selectedDate ? isSameDay(day, selectedDate) : false
          const dayTasks = tasksByDate.get(dateKey) ?? []

          // 忙碌度：只算未完成、未超时
          const loadMinutes = dayTasks
            .filter((t) => !t.completed && t.deadline > now)
            .reduce((s, t) => s + t.estimateMinutes, 0)
          const bgColor = inMonth ? busyBg(loadMinutes) : 'bg-white'

          // 胶囊展示：最多 2 条（按 completed → overdue → active 优先级排序）
          const sorted = [
            ...dayTasks.filter((t) => !t.completed && t.deadline <= now), // overdue
            ...dayTasks.filter((t) => !t.completed && t.deadline > now),  // active
            ...dayTasks.filter((t) => t.completed),                        // done
          ]
          const showTasks   = sorted.slice(0, 2)
          const hiddenCount = sorted.length - showTasks.length

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDate(day)}
              className={`
                relative border-r border-b border-slate-100 cursor-pointer
                min-h-[72px] sm:min-h-[80px] px-1 pt-1.5 pb-1
                transition-all
                ${bgColor}
                ${selected ? 'ring-2 ring-inset ring-slate-900' : ''}
                ${!inMonth ? 'opacity-40' : ''}
                hover:brightness-95
              `}
            >
              {/* 日期数字 + 负荷 */}
              <div className="flex items-center justify-between mb-0.5">
                <span className={`
                  inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold leading-none
                  ${todayDay ? 'bg-blue-500 text-white' : selected ? 'bg-slate-900 text-white' : 'text-slate-700'}
                `}>
                  {format(day, 'd')}
                </span>
                {loadMinutes > 0 && inMonth && (
                  <span className="text-[9px] text-slate-400 pr-0.5">{formatMinutes(loadMinutes)}</span>
                )}
              </div>

              {/* 任务胶囊 */}
              <div className="space-y-0.5">
                {showTasks.map((task) => {
                  const isCompleted = task.completed
                  const isOverdue   = !task.completed && task.deadline <= now

                  let pillStyle = COMPLETED_PILL
                  if (!isCompleted && isOverdue) {
                    pillStyle = OVERDUE_PILL
                  } else if (!isCompleted && !isOverdue) {
                    const meta = getTaskSchedulingMeta(task, now)
                    pillStyle = TIER_PILL[meta.riskTier]
                  }

                  return (
                    <div
                      key={task.id}
                      className={`
                        truncate text-[9px] sm:text-[10px] font-medium leading-tight
                        rounded px-1 py-0.5
                        ${pillStyle.bg} ${pillStyle.text} ${pillStyle.border}
                        ${isCompleted ? 'line-through' : ''}
                      `}
                    >
                      {isCompleted ? '✓ ' : ''}{task.name}
                    </div>
                  )
                })}
                {hiddenCount > 0 && (
                  <div className="text-[9px] text-slate-400 pl-0.5">+{hiddenCount} 更多</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
