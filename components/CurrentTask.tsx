'use client'

import { Task } from '@/lib/types'
import { formatDistanceToNow, differenceInHours, differenceInMinutes } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'

interface Props {
  task: Task | null
}

function formatTimeLeft(deadline: number): string {
  const now = Date.now()
  const diffMs = deadline - now
  if (diffMs <= 0) return '已超时'
  const h = Math.floor(diffMs / 3_600_000)
  const m = Math.floor((diffMs % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function CurrentTask({ task }: Props) {
  if (!task) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-md">
          <CardContent className="py-10 text-center">
            <p className="text-4xl mb-2">✨</p>
            <p className="text-2xl font-bold text-green-700">全部搞定了，休息一下</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const timeLeft = formatTimeLeft(task.deadline)
  const isOverdue = task.deadline < Date.now()

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-gradient-to-br from-slate-900 to-slate-700 border-0 shadow-xl text-white">
        <CardContent className="py-8 px-7">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">
            现在做这个
          </p>
          <p className="text-4xl font-bold leading-tight break-words mb-4">
            {task.name}
          </p>
          <p className={`text-sm ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
            距截止 {timeLeft} · 预估 {task.estimateMinutes}min
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
