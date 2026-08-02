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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { endOfDay, addDays } from 'date-fns'
import { Sparkles, Pencil, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (task: Task) => void
}

type Urgency = Task['urgency']
type Mode = 'ai' | 'manual'

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

export default function TaskInput({ open, onClose, onAdd }: Props) {
  const [mode, setMode] = useState<Mode>('ai')

  // ── AI 模式状态 ──
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // ── 手动表单状态 ──
  const [name, setName] = useState('')
  const [deadlineTs, setDeadlineTs] = useState<number>(() =>
    endOfDay(new Date()).getTime()
  )
  const [urgency, setUrgency] = useState<Urgency>('medium')
  const [estimate, setEstimate] = useState<number>(30)
  const [estimateInput, setEstimateInput] = useState('30')
  const [estimateGuessed, setEstimateGuessed] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; deadline?: string }>({})

  function resetForm() {
    setMode('ai')
    setAiText('')
    setAiLoading(false)
    setAiError(null)
    setName('')
    setDeadlineTs(endOfDay(new Date()).getTime())
    setUrgency('medium')
    setEstimate(30)
    setEstimateInput('30')
    setEstimateGuessed(false)
    setErrors({})
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  // ── AI 解析 ──
  async function handleAiParse() {
    if (!aiText.trim()) {
      setAiError('请输入任务描述')
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText.trim(), nowISO: new Date().toISOString() }),
      })
      const json = await res.json()
      if (!json.ok) {
        setAiError(json.error || 'AI 解析失败，请改用手动填写')
        return
      }
      // 预填手动表单
      const data = json.data as {
        name: string
        deadline: string
        estimateMinutes: number
        urgency: Urgency
        estimateGuessed?: boolean
      }
      setName(data.name)
      const dl = new Date(data.deadline)
      if (!isNaN(dl.getTime())) setDeadlineTs(dl.getTime())
      setUrgency(data.urgency)
      setEstimate(data.estimateMinutes)
      setEstimateInput(String(data.estimateMinutes))
      setEstimateGuessed(Boolean(data.estimateGuessed))
      setErrors({})
      // 切换到手动填写让用户确认
      setMode('manual')
    } catch {
      setAiError('网络异常，请重试或改用手动填写')
    } finally {
      setAiLoading(false)
    }
  }

  // ── 手动表单逻辑 ──
  function validate(): boolean {
    const e: { name?: string; deadline?: string } = {}
    if (!name.trim()) e.name = '请输入任务名称'
    if (!deadlineTs || isNaN(deadlineTs)) e.deadline = '请选择截止时间'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    const task: Task = {
      id: crypto.randomUUID(),
      name: name.trim(),
      deadline: deadlineTs,
      urgency,
      estimateMinutes: estimate,
      originalEstimate: estimate,
      progress: 0,
      createdAt: Date.now(),
      lastProgressUpdatedAt: new Date().toISOString(),
      completed: false,
    }
    onAdd(task)
    resetForm()
    onClose()
  }

  function setDeadlineShortcut(ms: number) {
    setDeadlineTs(ms)
    setErrors((e) => ({ ...e, deadline: undefined }))
  }

  function handleDeadlineInput(val: string) {
    const d = new Date(val)
    if (!isNaN(d.getTime())) {
      setDeadlineTs(d.getTime())
      setErrors((e) => ({ ...e, deadline: undefined }))
    }
  }

  function handleEstimateInput(val: string) {
    setEstimateInput(val)
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) setEstimate(n)
    setEstimateGuessed(false) // 用户手动改过，不再是 AI 预估
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">添加任务</DialogTitle>
        </DialogHeader>

        {/* 模式切换 Tab */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('ai')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all
              ${mode === 'ai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Sparkles size={15} /> AI 智能录入
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all
              ${mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Pencil size={14} /> 手动填写
          </button>
        </div>

        {/* ── AI 模式 ── */}
        {mode === 'ai' && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-text">用一句话描述任务</Label>
              <textarea
                id="ai-text"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                placeholder="用一句话描述任务，例如：今晚8点前交竞品分析，大概2小时，挺急"
                value={aiText}
                onChange={(e) => {
                  setAiText(e.target.value)
                  if (aiError) setAiError(null)
                }}
                disabled={aiLoading}
                autoFocus
              />
              {aiError && (
                <p className="text-xs text-red-500">
                  {aiError}
                  <button
                    type="button"
                    onClick={() => setMode('manual')}
                    className="ml-1 underline hover:text-red-600"
                  >
                    改用手动填写
                  </button>
                </p>
              )}
            </div>
            <Button
              onClick={handleAiParse}
              disabled={aiLoading}
              className="w-full bg-slate-900 hover:bg-slate-700"
            >
              {aiLoading ? (
                <><Loader2 size={16} className="animate-spin mr-1.5" /> AI 解析中...</>
              ) : (
                <><Sparkles size={16} className="mr-1.5" /> 解析</>
              )}
            </Button>
            <p className="text-[11px] text-slate-400 text-center">
              解析后可在“手动填写”里确认和修改，再点创建
            </p>
          </div>
        )}

        {/* ── 手动模式 ── */}
        {mode === 'manual' && (
          <div className="space-y-5 py-2">
            {/* 任务名 */}
            <div className="space-y-1.5">
              <Label htmlFor="task-name">任务名称</Label>
              <Input
                id="task-name"
                placeholder="比如：写完周报"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (e.target.value.trim()) setErrors((v) => ({ ...v, name: undefined }))
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
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
                    onClick={() => setDeadlineShortcut(ts())}
                    className="text-xs px-3 py-1 rounded-full border border-slate-300 hover:bg-slate-100 transition-colors text-slate-600"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.deadline && <p className="text-xs text-red-500">{errors.deadline}</p>}
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

            {/* 预估耗时 */}
            <div className="space-y-1.5">
              <Label htmlFor="estimate">
                预估耗时（分钟）
                {estimateGuessed && (
                  <span className="ml-2 text-[11px] font-normal text-amber-600">
                    ✨ 耗时为 AI 预估，请确认
                  </span>
                )}
              </Label>
              <Input
                id="estimate"
                type="number"
                min={1}
                value={estimateInput}
                onChange={(e) => handleEstimateInput(e.target.value)}
                placeholder="分钟数"
              />
              <div className="flex gap-2">
                {ESTIMATE_SHORTCUTS.map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => {
                      setEstimate(min)
                      setEstimateInput(String(min))
                      setEstimateGuessed(false)
                    }}
                    className={`flex-1 py-1 rounded-lg border text-xs font-medium transition-all
                      ${estimate === min
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'border-slate-200 text-slate-500 hover:border-slate-400'
                      }
                    `}
                  >
                    {min}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          {mode === 'manual' && (
            <Button onClick={handleSubmit} className="bg-slate-900 hover:bg-slate-700">
              创建
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
