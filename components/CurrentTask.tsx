'use client'

import { Task } from '@/lib/types'
import { getTaskSchedulingMeta, getAttentionTasks, sortActiveTasksByRisk, RiskTier, TaskSchedulingMeta } from '@/lib/priority'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import RecommendReason from './RecommendReason'

interface Props {
  task: Task | null
  allTasks?: Task[]
}

// ─── 格式化工具 ───────────────────────────────

function formatMinutes(minutes: number): string {
  const abs = Math.abs(Math.round(minutes))
  if (abs < 60) return `${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatTimeLeft(deadline: number, now: number): string {
  const diffMs = deadline - now
  if (diffMs <= 0) return '已超时'
  return formatMinutes(diffMs / 60_000)
}

function formatSlack(slackMinutes: number): { label: string; isDeficit: boolean } {
  const str = formatMinutes(slackMinutes)
  if (slackMinutes >= 0) return { label: `余裕 ${str}`, isDeficit: false }
  return { label: `缺口 ${str}`, isDeficit: true }
}

// ─── Risk Tier 样式 ───────────────────────────

const RISK_TIER_STYLE: Record<RiskTier, { bg: string; text: string; dot: string }> = {
  1: { bg: 'bg-red-500/20',    text: 'text-red-300',    dot: '🔴' },
  2: { bg: 'bg-orange-500/20', text: 'text-orange-300', dot: '🟠' },
  3: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', dot: '🟡' },
  4: { bg: 'bg-slate-500/20',  text: 'text-slate-400',  dot: '🔵' },
}

// attention 列表只展示 Tier 1-3
const ATTENTION_TIER_BADGE: Partial<Record<RiskTier, { bg: string; text: string; label: string }>> = {
  1: { bg: 'bg-red-500/25',    text: 'text-red-300',    label: '临界且时间不足' },
  2: { bg: 'bg-orange-500/25', text: 'text-orange-300', label: '时间不足' },
  3: { bg: 'bg-yellow-500/25', text: 'text-yellow-300', label: '临界但可完成' },
}

const MAX_ATTENTION = 2

// ─── AI 推荐理由数据组装 ─────────────────────

function toExplainPayload(t: Task, m: TaskSchedulingMeta) {
  return {
    name: t.name,
    deadline: new Date(t.deadline).toISOString(),
    estimateMinutes: t.estimateMinutes,
    urgency: t.urgency,
    progress: t.progress,
    riskTier: m.riskTier,
    slackMinutes: Math.round(m.slackMinutes),
    minutesUntilDeadline: Math.round(m.minutesUntilDeadline),
  }
}

// ─── 组件 ─────────────────────────────────────

export default function CurrentTask({ task, allTasks = [] }: Props) {
  if (!task) {
    const now = Date.now()
    const overdueCount = allTasks.filter((t) => !t.completed && t.deadline <= now).length

    // 仅有超时任务：警示卡（与绿色明确区分，不用正面词汇）
    if (overdueCount > 0) {
      return (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200 shadow-md">
            <CardContent className="py-10 text-center">
              <p className="text-4xl mb-2">⚠️</p>
              <p className="text-2xl font-bold text-red-700">
                有 {overdueCount} 项已超时未处理
              </p>
              <p className="text-sm text-red-500 mt-2">
                先决定这些怎么办：补做，或直接关掉
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )
    }

    // 真空状态：绿色卡片
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

  const now = Date.now()
  const meta = getTaskSchedulingMeta(task, now)
  const timeLeft = formatTimeLeft(task.deadline, now)
  const slack = formatSlack(meta.slackMinutes)
  const tierStyle = RISK_TIER_STYLE[meta.riskTier]

  // 其他需要关注的任务
  const attentionAll = getAttentionTasks(allTasks, task.id, now)
  const attentionShow = attentionAll.slice(0, MAX_ATTENTION)
  const attentionHidden = attentionAll.length - attentionShow.length

  // AI 推荐理由：取现有排序结果，第一名=当前推荐，第二名=runnerUp
  // （排序完全由算法决定，AI 只做解释）
  const activeSorted = sortActiveTasksByRisk(
    allTasks.filter((t) => !t.completed && t.deadline > now),
    now
  )
  const runnerUpTask = activeSorted.find((t) => t.id !== task.id) ?? null
  // 缓存 key 包含上下文：推荐任务换人、第二名变化、任务总数变化都会使缓存失效
  const reasonCacheKey = [
    'v3',
    task.id, task.deadline, task.estimateMinutes, task.progress,
    runnerUpTask?.id ?? 'none', runnerUpTask?.deadline ?? 0,
    activeSorted.length,
  ].join(':')

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-gradient-to-br from-slate-900 to-slate-700 border-0 shadow-xl text-white">
        <CardContent className="py-8 px-7">

          {/* 标题行 */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              现在做这个
            </p>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tierStyle.bg} ${tierStyle.text}`}>
              {tierStyle.dot} {meta.riskLabel}
            </span>
          </div>

          {/* 任务名 */}
          <p className="text-4xl font-bold leading-tight break-words mb-4">
            {task.name}
          </p>

          {/* 副标题 */}
          <p className="text-sm text-slate-400">
            距截止 {timeLeft}
            {' · '}
            预计还需 {formatMinutes(meta.remainingEstimateMinutes)}
            {' · '}
            <span className={slack.isDeficit ? 'text-red-400 font-semibold' : 'text-slate-400'}>
              {slack.label}
            </span>
          </p>

          {/* 其他需要关注区域 */}
          {attentionShow.length > 0 && (
            <div className="mt-4 bg-white/10 rounded-lg px-3 py-2.5 space-y-2">
              <p className="text-xs font-semibold text-slate-300 mb-1.5">
                其他需要关注（{attentionAll.length}）
              </p>

              {attentionShow.map(({ task: at, meta: am }) => {
                const atTimeLeft = formatTimeLeft(at.deadline, now)
                const atSlack = formatSlack(am.slackMinutes)
                const badge = ATTENTION_TIER_BADGE[am.riskTier as 1 | 2 | 3]

                return (
                  <div key={at.id} className="flex flex-col gap-0.5">
                    {/* 任务名 + 标签 */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-white/90 truncate max-w-[160px]">
                        {at.name}
                      </span>
                      {badge && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    {/* 时间信息 */}
                    <p className="text-[11px] text-slate-400 leading-snug">
                      距截止 {atTimeLeft} · 预计还需 {formatMinutes(am.remainingEstimateMinutes)}
                      {' · '}
                      <span className={atSlack.isDeficit ? 'text-red-400' : ''}>
                        {atSlack.label}
                      </span>
                    </p>
                  </div>
                )
              })}

              {attentionHidden > 0 && (
                <p className="text-[11px] text-slate-400 pt-0.5">
                  +{attentionHidden} 项未展示
                </p>
              )}
            </div>
          )}

          {/* AI 推荐理由（点击才请求，结果按签名缓存）*/}
          <RecommendReason
            cacheKey={reasonCacheKey}
            current={toExplainPayload(task, meta)}
            runnerUp={runnerUpTask ? toExplainPayload(runnerUpTask, getTaskSchedulingMeta(runnerUpTask, now)) : null}
            activeCount={activeSorted.length}
          />

        </CardContent>
      </Card>
    </motion.div>
  )
}
