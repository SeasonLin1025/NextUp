'use client'

import { Task } from '@/lib/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { format } from 'date-fns'

interface Props {
  task: Task
  onToggle: (id: string) => void
}

const urgencyConfig = {
  high:   { label: '紧急', className: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '中等', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  low:    { label: '普通', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

function formatDeadline(ts: number): string {
  try {
    return format(new Date(ts), 'M/d HH:mm')
  } catch {
    return ''
  }
}

function isOverdue(deadline: number): boolean {
  return deadline < Date.now()
}

export default function TaskCard({ task, onToggle }: Props) {
  const cfg = urgencyConfig[task.urgency]
  const overdue = !task.completed && isOverdue(task.deadline)

  return (
    <motion.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border bg-white shadow-sm
        ${task.completed ? 'opacity-50' : ''}
      `}
    >
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id)}
        className="mt-0.5 shrink-0"
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug break-words
          ${task.completed ? 'line-through text-gray-400' : 'text-gray-900'}
        `}>
          {task.name}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs ${task.completed ? 'text-gray-400' : overdue ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
            {overdue && !task.completed ? '⚠ ' : ''}{formatDeadline(task.deadline)}
          </span>
          <span className={`text-xs ${task.completed ? 'text-gray-400' : 'text-gray-400'}`}>
            {task.estimateMinutes}min
          </span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold
            ${task.completed ? 'bg-gray-100 text-gray-400 border-gray-200' : cfg.className}
          `}>
            {cfg.label}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
