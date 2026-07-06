'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Task } from '@/lib/types'
import { loadTasks, saveTasks, loadSeenOverdueIds, markOverdueSeen } from '@/lib/storage'
import { groupTasks } from '@/lib/priority'
import CurrentTask from '@/components/CurrentTask'
import TaskCard from '@/components/TaskCard'
import TaskInput from '@/components/TaskInput'
import TaskEditDialog from '@/components/TaskEditDialog'
import SectionGroup from '@/components/SectionGroup'
import OverdueBanner from '@/components/OverdueBanner'
import { Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [mounted, setMounted] = useState(false)

  // Section open/close state
  const [pendingOpen, setPendingOpen] = useState(true)
  const [longTermOpen, setLongTermOpen] = useState(true)
  const [overdueOpen, setOverdueOpen] = useState(false)
  const [doneOpen, setDoneOpen] = useState(false)

  // Overdue banner & seen tracking
  const [newOverdueIds, setNewOverdueIds] = useState<string[]>([])
  const [bannerVisible, setBannerVisible] = useState(false)

  const overdueRef = useRef<HTMLDivElement>(null)

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadTasks()
    setTasks(saved)
    setMounted(true)
  }, [])

  // Compute groups whenever tasks change
  const groups = groupTasks(tasks)

  // Detect new overdue tasks
  useEffect(() => {
    if (!mounted) return
    const seenIds = loadSeenOverdueIds()
    const currentOverdueIds = groups.overdue.map((t) => t.id)
    const unseen = currentOverdueIds.filter((id) => !seenIds.includes(id))

    if (unseen.length > 0) {
      setNewOverdueIds(unseen)
      setBannerVisible(true)
      setOverdueOpen(true) // auto-expand
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, groups.overdue.length])

  // When overdue section opens + has new tasks → mark as seen
  useEffect(() => {
    if (overdueOpen && newOverdueIds.length > 0) {
      markOverdueSeen(newOverdueIds)
      setNewOverdueIds([])
    }
  }, [overdueOpen, newOverdueIds])

  // Persist tasks whenever they change
  useEffect(() => {
    if (mounted) saveTasks(tasks)
  }, [tasks, mounted])

  // Re-group every minute to keep deadline buckets fresh
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks((prev) => [...prev]) // trigger re-group
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  const handleToggle = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const nowCompleting = !t.completed
        return {
          ...t,
          completed: nowCompleting,
          completedAt: nowCompleting ? Date.now() : undefined,
          completedOverdue: nowCompleting ? t.deadline < Date.now() : undefined,
        }
      })
    )
  }, [])

  const handleAdd = useCallback((task: Task) => {
    setTasks((prev) => [...prev, task])
  }, [])

  const handleEdit = useCallback((updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }, [])

  // Banner click: scroll to overdue section, mark seen, hide banner
  const handleBannerClick = () => {
    setOverdueOpen(true)
    setBannerVisible(false)
    // Mark seen immediately
    markOverdueSeen(newOverdueIds)
    setNewOverdueIds([])
    // Scroll smooth
    setTimeout(() => {
      overdueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // Top task: first pending task (not overdue, not long-term)
  const topTask = groups.pending[0] ?? null

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
      <div className="container mx-auto max-w-lg py-8 px-4 pb-28">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">NextUp</h1>
            <p className="text-xs text-slate-400 mt-0.5">专注当下，一件一件来</p>
          </div>
          <span className="text-xs text-slate-400 bg-white border rounded-full px-3 py-1 shadow-sm">
            {groups.pending.length} 项待完成
          </span>
        </div>

        {/* 1. 顶部大卡片 */}
        <div className="mb-4">
          <CurrentTask task={topTask} />
        </div>

        {/* 2. 已超时通知横条 */}
        <div className="mb-4">
          <OverdueBanner
            count={newOverdueIds.length}
            visible={bannerVisible}
            onClick={handleBannerClick}
          />
        </div>

        {/* Task sections */}
        <div className="space-y-5">

          {/* 3. 待完成 */}
          {groups.pending.length > 0 && (
            <SectionGroup
              title="待完成"
              count={groups.pending.length}
              isOpen={pendingOpen}
              onToggle={() => setPendingOpen((v) => !v)}
              titleColor="text-slate-600"
            >
              <AnimatePresence mode="popLayout">
                {groups.pending.map((task) => (
                  <TaskCard key={task.id} task={task} variant="default" onToggle={handleToggle} onEdit={setEditTask} />
                ))}
              </AnimatePresence>
            </SectionGroup>
          )}

          {/* 4. 长线任务 */}
          {groups.longTerm.length > 0 && (
            <SectionGroup
              title="长线任务"
              count={groups.longTerm.length}
              isOpen={longTermOpen}
              onToggle={() => setLongTermOpen((v) => !v)}
              titleColor="text-blue-500"
            >
              <AnimatePresence mode="popLayout">
                {groups.longTerm.map((task) => (
                  <TaskCard key={task.id} task={task} variant="longTerm" onToggle={handleToggle} onEdit={setEditTask} />
                ))}
              </AnimatePresence>
            </SectionGroup>
          )}

          {/* 5. 已超时 */}
          {groups.overdue.length > 0 && (
            <SectionGroup
              ref={overdueRef}
              title="已超时"
              count={groups.overdue.length}
              isOpen={overdueOpen}
              onToggle={() => setOverdueOpen((v) => !v)}
              badge={newOverdueIds.length}
              titleColor="text-red-500"
            >
              <AnimatePresence mode="popLayout">
                {groups.overdue.map((task) => (
                  <TaskCard key={task.id} task={task} variant="overdue" onToggle={handleToggle} onEdit={setEditTask} />
                ))}
              </AnimatePresence>
            </SectionGroup>
          )}

          {/* 6. 已完成 */}
          {groups.done.length > 0 && (
            <SectionGroup
              title="已完成"
              count={groups.done.length}
              isOpen={doneOpen}
              onToggle={() => setDoneOpen((v) => !v)}
              titleColor="text-gray-400"
            >
              <AnimatePresence mode="popLayout">
                {groups.done.map((task) => (
                  <TaskCard key={task.id} task={task} variant="done" onToggle={handleToggle} onEdit={setEditTask} />
                ))}
              </AnimatePresence>
            </SectionGroup>
          )}

        </div>
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

      {/* Task Edit Dialog */}
      <TaskEditDialog
        task={editTask}
        open={editTask !== null}
        onClose={() => setEditTask(null)}
        onSave={handleEdit}
      />
    </main>
  )
}
