'use client'

import { useState, useEffect, useCallback } from 'react'
import { Task } from '@/lib/types'
import { loadTasks, saveTasks } from '@/lib/storage'
import { sortTasks } from '@/lib/priority'
import CurrentTask from '@/components/CurrentTask'
import TaskList from '@/components/TaskList'
import TaskInput from '@/components/TaskInput'
import { Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [sorted, setSorted] = useState<Task[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadTasks()
    setTasks(saved)
    setMounted(true)
  }, [])

  // Re-sort whenever tasks change
  useEffect(() => {
    setSorted(sortTasks(tasks))
  }, [tasks])

  // Persist whenever tasks change (after mount)
  useEffect(() => {
    if (mounted) saveTasks(tasks)
  }, [tasks, mounted])

  // Re-sort every minute so scores stay fresh
  useEffect(() => {
    const timer = setInterval(() => {
      setSorted((prev) => sortTasks(prev))
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const handleToggle = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? Date.now() : undefined,
            }
          : t
      )
    )
  }, [])

  const handleAdd = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task])
  }, [])

  // Top task = first uncompleted in sorted list
  const topTask = sorted.find((t) => !t.completed) ?? null

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-lg py-8 px-4">
          <div className="h-40 rounded-xl bg-slate-200 animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-lg py-8 px-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">NextUp</h1>
            <p className="text-xs text-slate-400 mt-0.5">专注当下，一件一件来</p>
          </div>
          <span className="text-xs text-slate-400 bg-white border rounded-full px-3 py-1 shadow-sm">
            {sorted.filter((t) => !t.completed).length} 项待完成
          </span>
        </div>

        {/* Current Task Card */}
        <div className="mb-6">
          <CurrentTask task={topTask} />
        </div>

        {/* Task List */}
        <AnimatePresence>
          <TaskList tasks={sorted} onToggle={handleToggle} />
        </AnimatePresence>
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center z-40"
        aria-label="添加任务"
      >
        <Plus size={26} strokeWidth={2.5} />
      </motion.button>

      {/* Task Input Dialog */}
      <TaskInput
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={handleAdd}
      />
    </main>
  )
}
