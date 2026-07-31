'use client'

import { Task } from '@/lib/types'
import { TaskSchedulingMeta } from '@/lib/priority'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

// ─── 格式化工具 ───────────────────────────────

function formatMinutes(minutes: number): string {
  const abs = Math.abs(Math.round(minutes))
  if (abs < 60) return `${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTimeLeft(deadline: number, now: number): string {
  const diffMs = deadline - now
  if (diffMs <= 0) return '已超时'
  return formatMinutes(diffMs / 60_000)
}

interface Props {
  items: Array<{ task: Task; meta: TaskSchedulingMeta }>
  hiddenCount: number
  onDismiss: (task: Task) => void
}

export default function MustStartAlert({ items, hiddenCount, onDismiss }: Props) {
  if (items.length === 0) return null

  const now = Date.now()

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-red-200 bg-red-50 shadow-sm overflow-hidden"
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
        <p className="text-xs font-bold text-red-600 tracking-wide">
          必须立即处理
        </p>
      </div>

      {/* 提醒列表 */}
      <div className="px-2 pb-2 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {items.map(({ task, meta }) => {
            const timeLeft = formatTimeLeft(task.deadline, now)
            const isDeficit = meta.slackMinutes < 0
            const slackLabel = isDeficit
              ? `已缺口 ${formatMinutes(meta.slackMinutes)}`
              : `缓冲仅 ${formatMinutes(meta.slackMinutes)}`

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 rounded-lg bg-white border border-red-100 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {task.name}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                    距截止 {timeLeft} · 预计还需 {formatMinutes(meta.remainingEstimateMinutes)}
                    {' · '}
                    <span className={isDeficit ? 'text-red-500 font-semibold' : 'text-slate-500'}>
                      {slackLabel}
                    </span>
                  </p>
                  <p className="text-[11px] text-red-500 font-medium mt-0.5">
                    现在必须开始，否则可能来不及
                  </p>
                </div>

                {/* 关闭按钮 */}
                <button
                  onClick={() => onDismiss(task)}
                  className="flex-shrink-0 -mr-1 -mt-0.5 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label="知道了"
                >
                  <X size={15} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {hiddenCount > 0 && (
          <p className="text-[11px] text-red-400 px-1 pt-0.5">
            +{hiddenCount} 项也需立即处理
          </p>
        )}
      </div>
    </motion.div>
  )
}
