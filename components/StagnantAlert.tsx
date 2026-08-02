'use client'

import { Task } from '@/lib/types'
import { StagnantItem } from '@/lib/stagnant'
import { motion, AnimatePresence } from 'framer-motion'
import { Sprout, X } from 'lucide-react'

interface Props {
  items: StagnantItem[]
  hiddenCount: number
  onDismiss: (task: Task) => void
}

export default function StagnantAlert({ items, hiddenCount, onDismiss }: Props) {
  if (items.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden"
    >
      {/* 标题栏 */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <Sprout size={14} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs font-semibold text-amber-600 tracking-wide">
          长线任务停滞提醒
        </p>
      </div>

      {/* 提醒列表 */}
      <div className="px-2 pb-2 space-y-1.5">
        <AnimatePresence mode="popLayout">
          {items.map(({ task, stagnantDays, daysUntilDeadline }) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-start gap-2 rounded-lg bg-white border border-amber-100 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">
                  {task.name}
                </p>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  已 {stagnantDays} 天没有推进 · 进度 {task.progress ?? 0}% · 距截止 {daysUntilDeadline} 天
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  长期没有推进，建议今天推动一点
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
          ))}
        </AnimatePresence>

        {hiddenCount > 0 && (
          <p className="text-[11px] text-amber-500 px-1 pt-0.5">
            +{hiddenCount} 项也已停滞
          </p>
        )}
      </div>
    </motion.div>
  )
}
