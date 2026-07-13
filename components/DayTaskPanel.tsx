'use client'

import { Task } from '@/lib/types'
import { getTaskSchedulingMeta, sortActiveTasksByRisk, RiskTier } from '@/lib/priority'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { formatMinutes } from './CalendarMonth'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

interface Props {
  date: Date
  tasks: Task[]
}

// ─── 常量 ─────────────────────────────────────

const URGENCY_LABEL: Record<Task['urgency'], { label: string; cls: string }> = {
  high:   { label: '紧急', cls: 'bg-red-100 text-red-600' },
  medium: { label: '中等', cls: 'bg-yellow-100 text-yellow-700' },
  low:    { label: '普通', cls: 'bg-slate-100 text-slate-500' },
}

const TIER_LABEL: Record<RiskTier, { label: string; cls: string }> = {
  1: { label: '临界且时间不足', cls: 'bg-red-100 text-red-700' },
  2: { label: '时间不足',       cls: 'bg-orange-100 text-orange-700' },
  3: { label: '临界但可完成',   cls: 'bg-yellow-100 text-yellow-700' },
  4: { label: '正常任务',       cls: 'bg-blue-50 text-blue-600' },
}

// ─── 工具 ─────────────────────────────────────

function formatTimeHHmm(ts: number): string {
  return format(new Date(ts), 'HH:mm')
}

function OverdueAgo(deadline: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - deadline) / 60_000))
  return `已超时 ${formatMinutes(minutes)}`
}

// ─── 组件 ─────────────────────────────────────

export default function DayTaskPanel({ date, tasks }: Props) {
  const now = Date.now()
  const dayStr = format(date, 'yyyy-MM-dd')

  // 筛出当天所有任务
  const dayTasks = tasks.filter(
    (t) => format(new Date(t.deadline), 'yyyy-MM-dd') === dayStr
  )

  // 三个分组
  const activeTasks  = dayTasks.filter((t) => !t.completed && t.deadline > now)
  const overdueTasks = dayTasks.filter((t) => !t.completed && t.deadline <= now)
  const doneTasks    = dayTasks.filter((t) => t.completed)
    .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  const sortedActive = sortActiveTasksByRisk(activeTasks, now)

  // 标题
  const dateStr  = format(date, 'M月d日')
  const weekStr  = format(date, 'EEEE', { locale: zhCN }).replace('星期', '周')

  let countStr: string
  if (dayTasks.length === 0) {
    countStr = '暂无任务'
  } else if (activeTasks.length === 0 && doneTasks.length > 0 && overdueTasks.length === 0) {
    countStr = `已完成 ${doneTasks.length} 项`
  } else {
    const total = dayTasks.length
    countStr = `${total} 项任务`
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* 面板标题 */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {dateStr} {weekStr} · {countStr}
        </h3>
        <Link
          href={`/calendar/day?date=${format(date, 'yyyy-MM-dd')}`}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          <CalendarClock size={13} />
          <span>查看日视图</span>
        </Link>
      </div>

      {/* 空状态 */}
      {dayTasks.length === 0 && (
        <p className="px-4 py-5 text-sm text-slate-400 text-center">
          这天暂无任务，可以安排新事项 ✨
        </p>
      )}

      {/* ── 1. 待处理 (active) ── */}
      {sortedActive.length > 0 && (
        <Section title="待处理">
          {sortedActive.map((task) => {
            const meta = getTaskSchedulingMeta(task, now)
            const tierInfo    = TIER_LABEL[meta.riskTier]
            const urgencyInfo = URGENCY_LABEL[task.urgency]
            return (
              <TaskCard key={task.id}>
                <p className="text-sm font-medium text-slate-800 leading-snug mb-1.5">{task.name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-1.5">
                  <span>截止 {formatTimeHHmm(task.deadline)}</span>
                  <span>·</span>
                  <span>预计还需 {formatMinutes(task.estimateMinutes)}</span>
                  <span>·</span>
                  <span className={meta.slackMinutes < 0 ? 'text-red-500 font-medium' : ''}>
                    {meta.slackMinutes >= 0
                      ? `余裕 ${formatMinutes(meta.slackMinutes)}`
                      : `缺口 ${formatMinutes(Math.abs(meta.slackMinutes))}`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tierInfo.cls}`}>
                    {tierInfo.label}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${urgencyInfo.cls}`}>
                    {urgencyInfo.label}
                  </span>
                </div>
              </TaskCard>
            )
          })}
        </Section>
      )}

      {/* ── 2. 已超时 (overdue) ── */}
      {overdueTasks.length > 0 && (
        <Section title="已超时" titleCls="text-red-500">
          {overdueTasks.map((task) => {
            const urgencyInfo = URGENCY_LABEL[task.urgency]
            return (
              <TaskCard key={task.id}>
                <p className="text-sm font-medium text-red-600 leading-snug mb-1.5">{task.name}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mb-1.5">
                  <span>截止 {formatTimeHHmm(task.deadline)}</span>
                  <span>·</span>
                  <span className="text-red-500 font-medium">{OverdueAgo(task.deadline, now)}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-500">
                    已超时
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${urgencyInfo.cls}`}>
                    {urgencyInfo.label}
                  </span>
                </div>
              </TaskCard>
            )
          })}
        </Section>
      )}

      {/* ── 3. 已完成 (done) ── */}
      {doneTasks.length > 0 && (
        <Section title="已完成" titleCls="text-slate-400">
          {doneTasks.map((task) => (
            <TaskCard key={task.id} dim>
              <p className="text-sm font-medium text-gray-400 line-through leading-snug mb-1.5">{task.name}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 mb-1.5">
                <span>截止 {formatTimeHHmm(task.deadline)}</span>
                {task.completedAt && (
                  <>
                    <span>·</span>
                    <span>完成于 {format(new Date(task.completedAt), 'HH:mm')}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                  已完成
                </span>
                {task.completedOverdue && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-400">
                    逾期完成
                  </span>
                )}
              </div>
            </TaskCard>
          ))}
        </Section>
      )}

      {/* 有已完成但无待处理时的友好提示 */}
      {activeTasks.length === 0 && overdueTasks.length === 0 && doneTasks.length > 0 && (
        <p className="px-4 py-3 text-xs text-slate-400 text-center border-t border-slate-50">
          这天没有待处理任务，已完成 {doneTasks.length} 项 🎉
        </p>
      )}
    </div>
  )
}

// ─── 内部小组件 ───────────────────────────────

function Section({
  title, titleCls = 'text-slate-500', children,
}: {
  title: string; titleCls?: string; children: React.ReactNode
}) {
  return (
    <div>
      <div className={`px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide ${titleCls}`}>
        {title}
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  )
}

function TaskCard({ children, dim = false }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`px-4 py-3 ${dim ? 'bg-gray-50/50' : ''}`}>
      {children}
    </div>
  )
}
