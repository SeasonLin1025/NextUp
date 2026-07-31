'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { loadExplanation, saveExplanation } from '@/lib/storage'

interface ExplainTaskPayload {
  name: string
  deadline: string
  estimateMinutes: number
  urgency: string
  progress: number
  riskTier: number
  slackMinutes: number
  minutesUntilDeadline: number
}

interface Props {
  /** 缓存签名：任务id:deadline:estimateMinutes:progress，任务或字段变化后自动失效 */
  cacheKey: string
  current: ExplainTaskPayload
  runnerUp: ExplainTaskPayload | null
  activeCount: number
}

export default function RecommendReason({ cacheKey, current, runnerUp, activeCount }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleToggle() {
    if (expanded) {
      setExpanded(false)
      return
    }
    setExpanded(true)

    // 已有结果或正在请求：直接用，不重复请求
    if (explanation || loading) return

    // 缓存命中：直接用
    const cached = loadExplanation(cacheKey)
    if (cached) {
      setExplanation(cached)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nowISO: new Date().toISOString(),
          current,
          runnerUp: runnerUp ?? undefined,
          activeCount,
        }),
      })
      const json = await res.json()
      if (json.ok && json.explanation) {
        setExplanation(json.explanation)
        saveExplanation(cacheKey, json.explanation)
      } else {
        setError(json.error || '生成失败，请稍后再试')
      }
    } catch {
      setError('网络异常，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span>推荐理由</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mt-2">
          {loading && (
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> 生成中...
            </p>
          )}
          {!loading && error && (
            <p className="text-xs text-red-300">{error}</p>
          )}
          {!loading && !error && explanation && (
            <p className="text-xs text-slate-300 leading-relaxed">
              {explanation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
