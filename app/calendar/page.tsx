'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Task } from '@/lib/types'
import { loadTasks } from '@/lib/storage'
import CalendarMonth from '@/components/CalendarMonth'
import DayTaskPanel from '@/components/DayTaskPanel'
import BottomNav from '@/components/BottomNav'

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [mounted, setMounted] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = loadTasks()
    setTasks(saved.map((t) => ({
      ...t,
      progress: t.progress ?? 0,
      originalEstimate: t.originalEstimate ?? t.estimateMinutes,
    })))
    setMounted(true)
    setSelectedDate(new Date())
  }, [])

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date)
    // 平滑滚动到详情面板（给 DOM 更新一帧再滚）
    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  if (!mounted) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto max-w-lg py-6 px-4 pb-24">
          <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-4" />
          <div className="h-80 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto max-w-lg py-6 px-4 pb-28">

        {/* 月视图 */}
        <CalendarMonth
          tasks={tasks}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          onMonthChange={setCurrentMonth}
          onSelectDate={handleSelectDate}
        />

        {/* 选中日期详情面板 — 加 ref 用于滚动 + pt-2 避免被 Tab 遮住 */}
        {selectedDate && (
          <div ref={panelRef} className="scroll-mt-4">
            <DayTaskPanel date={selectedDate} tasks={tasks} />
          </div>
        )}

      </div>

      <BottomNav />
    </main>
  )
}
