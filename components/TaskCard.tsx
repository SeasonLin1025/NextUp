'use client'

import { Task } from '@/lib/types'
import { Checkbox } from '@/components/ui/checkbox'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Pencil } from 'lucide-react'

export type TaskVariant = 'default' | 'overdue' | 'longTerm' | 'done'

interface Props {
  task: Task
  variant?: TaskVariant
  onToggle: (id: string) => void
  onEdit: (task: Task) => void
}

const urgencyConfig = {
  high:   { label: '紧急', className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '中等', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:    { label: '普通', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

// Progress bar color by urgency (for non-done tasks)
const progressColor = {
  high:   'bg-red-400',
  medium: 'bg-orange-400',
  low:    'bg-blue-400',
}

function formatDeadline(ts: number): string {
  try { return format(new Date(ts), 'M/d HH:mm') } catch { return '' }
}

function formatOverdueDuration(deadline: number): string {
  const now = Date.now()
  const diffMs = now - deadline
  const h = Math.floor(diffMs / 3_600_000)
  const m = Math.floor((diffMs % 3_600_000) / 60_000)
  if (h >= 24) return `已超时 ${Math.floor(h / 24)}天${h % 24}h`
  if (h > 0) return `已超时 ${h}h${m}m`
  return `已超时 ${m}m`
}

function formatDaysLeft(deadline: number): string {
  const days = Math.ceil((deadline - Date.now()) / 86_400_000)
  return `还有 ${days} 天`
}

export default function TaskCard({ task, variant = 'default', onToggle, onEdit }: Props) {
  const cfg = urgencyConfig[task.urgency]
  const isDone = task.completed || task.abandoned === true
  const isOverdue = variant === 'overdue'
  const isLongTerm = variant === 'longTerm'

  const progress = isDone ? 100 : (task.progress ?? 0)

  // Container styles
  const containerBase = 'relative flex flex-col rounded-xl border shadow-sm overflow-hidden'
  const containerVariant = isDone
    ? 'bg-white opacity-50 border-slate-100'
    : isOverdue
    ? 'bg-red-50 border-l-4 border-l-red-500 border-red-100'
    : isLongTerm
    ? 'bg-blue-50 border-l-4 border-l-blue-500 border-blue-100'
    : 'bg-white border-slate-100'

  const nameColor = isDone
    ? 'line-through text-gray-400'
    : isOverdue
    ? 'text-red-700 font-medium'
    : 'text-gray-900'

  function renderMeta() {
    if (isDone) return <span className="text-xs text-gray-400">{formatDeadline(task.deadline)}</span>
    if (isOverdue) return <span className="text-xs text-red-500 font-semibold">{formatOverdueDuration(task.deadline)}</span>
    if (isLongTerm) return (
      <>
        <span className="text-xs text-blue-500 font-medium">{formatDaysLeft(task.deadline)}</span>
        <span className="text-xs text-slate-400">{formatDeadline(task.deadline)}</span>
      </>
    )
    return <span className="text-xs text-gray-500">{formatDeadline(task.deadline)}</span>
  }

  // Progress bar
  const showProgressBar = progress > 0
  const progressBarColor = isDone ? 'bg-gray-300' : progressColor[task.urgency]

  return (
    <motion.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`${containerBase} ${containerVariant}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => onToggle(task.id)}
          className="mt-0.5 shrink-0"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={`text-sm leading-snug break-words ${nameColor}`}>
              {task.name}
            </p>
            {task.completedOverdue && (
              <span className="inline-block bg-red-100 text-red-500 text-xs rounded px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                逾期完成
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {renderMeta()}
            <span className="text-xs text-gray-400">{task.estimateMinutes}min</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold
              ${isDone ? 'bg-gray-100 text-gray-400 border-gray-200' : cfg.className}
            `}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Edit button */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(task) }}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="编辑任务"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* Progress bar + percentage */}
      {showProgressBar && (
        <div className="px-4 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 shrink-0 w-8 text-right">{progress}%</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
