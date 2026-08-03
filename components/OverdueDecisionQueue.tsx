'use client'

import { useState } from 'react'
import { Task } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { AlarmClock, CalendarClock } from 'lucide-react'
import { endOfDay, addDays } from 'date-fns'

interface Props {
  tasks: Task[]                              // 待决策任务（已超时、未完成、未放弃）
  onReschedule: (id: string, newDeadline: number) => void
  onAbandon: (id: string) => void
}

const MAX_COLLAPSED = 3

function formatOverdueDuration(deadline: number, now: number): string {
  const totalMin = Math.max(0, Math.floor((now - deadline) / 60_000))
  const d = Math.floor(totalMin / (60 * 24))
  const h = Math.floor((totalMin % (60 * 24)) / 60)
  const m = totalMin % 60
  if (d > 0) return h > 0 ? `${d}天${h}h` : `${d}天`
  if (h > 0) return m > 0 ? `${h}h${m}m` : `${h}h`
  return `${m}m`
}

function toLocalDatetimeValue(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function OverdueDecisionQueue({ tasks, onReschedule, onAbandon }: Props) {
  const [expandAll, setExpandAll] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<Task | null>(null)
  const [newDeadlineTs, setNewDeadlineTs] = useState<number>(Date.now() + 3_600_000)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [abandonConfirmId, setAbandonConfirmId] = useState<string | null>(null)

  if (tasks.length === 0) return null

  const now = Date.now()
  const showTasks = expandAll ? tasks : tasks.slice(0, MAX_COLLAPSED)
  const hiddenCount = tasks.length - showTasks.length

  function openReschedule(task: Task) {
    setRescheduleTarget(task)
    setNewDeadlineTs(Date.now() + 3_600_000)
    setRescheduleError(null)
  }

  function confirmReschedule() {
    if (!rescheduleTarget) return
    if (!newDeadlineTs || isNaN(newDeadlineTs) || newDeadlineTs <= Date.now()) {
      setRescheduleError('新截止时间必须晚于当前时间')
      return
    }
    onReschedule(rescheduleTarget.id, newDeadlineTs)
    setRescheduleTarget(null)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border-2 border-red-300 bg-red-50 shadow-md overflow-hidden"
      >
        {/* 标题栏（无关闭按钮，只有决策才能消除）*/}
        <div className="flex items-center gap-1.5 px-3 pt-3 pb-1.5">
          <AlarmClock size={15} className="text-red-600 flex-shrink-0" />
          <p className="text-sm font-bold text-red-700">
            {tasks.length} 项任务已超时，需要你决定
          </p>
        </div>

        {/* 任务列表 */}
        <div className="px-2 pb-2 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {showTasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg bg-white border border-red-200 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-[55%]">
                        {task.name}
                      </p>
                      {(task.rescheduleCount ?? 0) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium flex-shrink-0">
                          已重排 {task.rescheduleCount} 次
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-red-500 mt-0.5">
                      已超时 {formatOverdueDuration(task.deadline, now)}
                    </p>
                  </div>

                  {/* 操作按钮 / 放弃二次确认 */}
                  {abandonConfirmId === task.id ? (
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="text-[11px] text-slate-600">确认不再做这项任务？</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            onAbandon(task.id)
                            setAbandonConfirmId(null)
                          }}
                          className="text-[11px] px-2 py-1 rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                        >
                          确认
                        </button>
                        <button
                          onClick={() => setAbandonConfirmId(null)}
                          className="text-[11px] px-2 py-1 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1.5 flex-shrink-0 mt-0.5">
                      <button
                        onClick={() => openReschedule(task)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-700 transition-colors flex items-center gap-1"
                      >
                        <CalendarClock size={12} /> 重新安排
                      </button>
                      <button
                        onClick={() => setAbandonConfirmId(task.id)}
                        className="text-[11px] px-2.5 py-1 rounded-md border border-slate-300 text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        不做了
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 展开/收起 */}
          {hiddenCount > 0 && !expandAll && (
            <button
              onClick={() => setExpandAll(true)}
              className="w-full text-[11px] text-red-500 hover:text-red-600 py-1 text-center"
            >
              还有 {hiddenCount} 项待决策，点击展开
            </button>
          )}
          {expandAll && tasks.length > MAX_COLLAPSED && (
            <button
              onClick={() => setExpandAll(false)}
              className="w-full text-[11px] text-slate-400 hover:text-slate-500 py-1 text-center"
            >
              收起
            </button>
          )}
        </div>
      </motion.div>

      {/* 重新安排时间选择弹窗 */}
      <Dialog open={rescheduleTarget !== null} onOpenChange={(v) => !v && setRescheduleTarget(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">重新安排</DialogTitle>
          </DialogHeader>

          {rescheduleTarget && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-slate-600">
                为「<span className="font-semibold">{rescheduleTarget.name}</span>」选择新的截止时间
              </p>

              <input
                type="datetime-local"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={toLocalDatetimeValue(newDeadlineTs)}
                onChange={(e) => {
                  const d = new Date(e.target.value)
                  if (!isNaN(d.getTime())) {
                    setNewDeadlineTs(d.getTime())
                    setRescheduleError(null)
                  }
                }}
              />

              <div className="flex gap-2 flex-wrap">
                {[
                  { label: '1小时后', ts: () => Date.now() + 3_600_000 },
                  { label: '今晚 23:59', ts: () => endOfDay(new Date()).getTime() },
                  { label: '明天 23:59', ts: () => endOfDay(addDays(new Date(), 1)).getTime() },
                  { label: '后天 23:59', ts: () => endOfDay(addDays(new Date(), 2)).getTime() },
                ].map(({ label, ts }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setNewDeadlineTs(ts())
                      setRescheduleError(null)
                    }}
                    className="text-xs px-3 py-1 rounded-full border border-slate-300 hover:bg-slate-100 transition-colors text-slate-600"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {rescheduleError && (
                <p className="text-xs text-red-500">{rescheduleError}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              取消
            </Button>
            <Button onClick={confirmReschedule} className="bg-slate-900 hover:bg-slate-700">
              确认重新安排
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
