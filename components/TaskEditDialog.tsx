'use client'

import { useState, useEffect } from 'react'
import { Task } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addDays, endOfDay } from 'date-fns'

interface Props {
  task: Task | null
  open: boolean
  onClose: () => void
  onSave: (updated: Task) => void
}

type Urgency = Task['urgency']

const URGENCY_OPTIONS: { value: Urgency; label: string; color: string }[] = [
  { value: 'high',   label: '🔴 紧急', color: 'bg-red-100 border-red-400 text-red-700' },
  { value: 'medium', label: '🟡 中等', color: 'bg-yellow-100 border-yellow-400 text-yellow-700' },
  { value: 'low',    label: '🟢 普通', color: 'bg-green-100 border-green-400 text-green-700' },
]

const ESTIMATE_SHORTCUTS = [30, 60, 90, 120]

function toLocalDatetimeValue(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TaskEditDialog({ task, open, onClose, onSave }: Props) {
  const [name, setName] = useState('')
  const [deadlineTs, setDeadlineTs] = useState(Date.now())
  const [urgency, setUrgency] = useState<Urgency>('medium')
  const [estimateInput, setEstimateInput] = useState('60')
  const [progress, setProgress] = useState(0)
  const [progressInput, setProgressInput] = useState('0')
  const [errors, setErrors] = useState<{ name?: string }>({})

  // Populate form when task changes
  useEffect(() => {
    if (!task) return
    setName(task.name)
    setDeadlineTs(task.deadline)
    setUrgency(task.urgency)
    setEstimateInput(String(task.originalEstimate))
    setProgress(task.progress ?? 0)
    setProgressInput(String(task.progress ?? 0))
    setErrors({})
  }, [task])

  if (!task) return null

  // estimateMinutes derived from originalEstimate × (1 - progress/100)
  const parsedOriginalEstimate = Math.max(1, parseInt(estimateInput, 10) || 1)
  const derivedEstimate = Math.round(parsedOriginalEstimate * (1 - progress / 100))

  function handleProgressSlider(val: number) {
    const clamped = Math.max(0, Math.min(100, val))
    setProgress(clamped)
    setProgressInput(String(clamped))
  }

  function handleProgressInput(val: string) {
    setProgressInput(val)
    const n = parseInt(val, 10)
    if (!isNaN(n)) {
      setProgress(Math.max(0, Math.min(100, n)))
    }
  }

  function handleDeadlineInput(val: string) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) setDeadlineTs(d.getTime())
  }

  function validate(): boolean {
    const e: { name?: string } = {}
    if (!name.trim()) e.name = '请输入任务名称'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (!validate()) return
    if (!task) return
    const progressChanged = progress !== (task.progress ?? 0)
    const updated: Task = {
      ...task,
      name: name.trim(),
      deadline: deadlineTs,
      urgency,
      originalEstimate: parsedOriginalEstimate,
      estimateMinutes: derivedEstimate,
      progress,
      // 只有进度真的变化才算"有推进"，才更新停滞追踪时间戳
      lastProgressUpdatedAt: progressChanged
        ? new Date().toISOString()
        : task.lastProgressUpdatedAt,
    }
    onSave(updated)
    onClose()
  }

  const isCompleted = task.completed

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">编辑任务</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 任务名 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">任务名称</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (e.target.value.trim()) setErrors({})
              }}
              autoFocus
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 截止时间 */}
          <div className="space-y-1.5">
            <Label>截止时间</Label>
            <input
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={toLocalDatetimeValue(deadlineTs)}
              onChange={(e) => handleDeadlineInput(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              {[
                { label: '1小时后', ts: () => Date.now() + 3_600_000 },
                { label: '今晚 23:59', ts: () => endOfDay(new Date()).getTime() },
                { label: '明天 23:59', ts: () => endOfDay(addDays(new Date(), 1)).getTime() },
              ].map(({ label, ts }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDeadlineTs(ts())}
                  className="text-xs px-3 py-1 rounded-full border border-slate-300 hover:bg-slate-100 transition-colors text-slate-600"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 紧急程度 */}
          <div className="space-y-1.5">
            <Label>紧急程度</Label>
            <div className="flex gap-2">
              {URGENCY_OPTIONS.map(({ value, label, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setUrgency(value)}
                  className={`flex-1 py-1.5 rounded-lg border-2 text-sm font-medium transition-all
                    ${urgency === value ? color + ' border-current' : 'border-slate-200 text-slate-500 hover:border-slate-300'}
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 预估耗时（原始） */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-estimate">
              原始预估耗时（分钟）
              {!isCompleted && (
                <span className="text-slate-400 font-normal ml-2 text-xs">
                  → 剩余 {derivedEstimate}min
                </span>
              )}
            </Label>
            <Input
              id="edit-estimate"
              type="number"
              min={1}
              value={estimateInput}
              onChange={(e) => setEstimateInput(e.target.value)}
              disabled={isCompleted}
            />
            <div className="flex gap-2">
              {ESTIMATE_SHORTCUTS.map((min) => (
                <button
                  key={min}
                  type="button"
                  disabled={isCompleted}
                  onClick={() => setEstimateInput(String(min))}
                  className={`flex-1 py-1 rounded-lg border text-xs font-medium transition-all
                    ${parsedOriginalEstimate === min
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400'}
                    ${isCompleted ? 'opacity-40 cursor-not-allowed' : ''}
                  `}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>

          {/* 进度 */}
          {!isCompleted && (
            <div className="space-y-2">
              <Label>
                当前进度
                <span className="text-slate-400 font-normal ml-2 text-xs">{progress}%</span>
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={progress}
                  onChange={(e) => handleProgressSlider(Number(e.target.value))}
                  className="flex-1 h-2 accent-slate-700"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={progressInput}
                  onChange={(e) => handleProgressInput(e.target.value)}
                  className="w-20 text-center"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
              <p className="text-xs text-slate-400">
                剩余耗时 = {parsedOriginalEstimate}min × {100 - progress}% = <span className="font-semibold text-slate-600">{derivedEstimate}min</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-700">保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
