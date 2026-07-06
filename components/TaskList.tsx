'use client'

import { Task } from '@/lib/types'
import TaskCard from './TaskCard'
import { AnimatePresence, motion } from 'framer-motion'

interface Props {
  tasks: Task[]
  onToggle: (id: string) => void
}

export default function TaskList({ tasks, onToggle }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm">暂无任务，点击右下角 + 添加</p>
      </div>
    )
  }

  const pending = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {pending.map((task) => (
          <TaskCard key={task.id} task={task} onToggle={onToggle} />
        ))}
      </AnimatePresence>

      {done.length > 0 && (
        <>
          <motion.div
            layout
            className="pt-2 pb-1"
          >
            <p className="text-xs text-gray-400 font-medium tracking-wide">
              已完成 {done.length} 项
            </p>
          </motion.div>
          <AnimatePresence mode="popLayout">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} onToggle={onToggle} />
            ))}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}
