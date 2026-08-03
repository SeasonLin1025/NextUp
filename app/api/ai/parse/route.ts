import { NextRequest, NextResponse } from 'next/server'
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from '@/lib/deepseek'

// 只在服务端运行，不使用 Edge（保证能读到 process.env）
export const runtime = 'nodejs'

/** DeepSeek 请求超时（毫秒），超时返回友好提示，不无限等待 */
const UPSTREAM_TIMEOUT_MS = 15_000

interface ParsedTask {
  name: string
  deadline: string
  estimateMinutes: number
  urgency: 'high' | 'medium' | 'low'
  estimateGuessed?: boolean
}

// ─── 时区上下文（代码可靠计算，不靠字符串猜测）───

interface TimeContext {
  timeZone: string
  offsetMinutes: number     // 如 480
  offsetISO: string         // 如 "+08:00"
  offsetLabel: string       // 如 "UTC+08:00"
  localDateTime: string     // 用户当地日期时间（含星期）
}

function buildTimeContext(
  nowISO: string,
  timeZone: unknown,
  offsetMinutes: unknown
): TimeContext {
  // 兜底：优先使用浏览器传来的真实时区，缺失时才用 Asia/Shanghai
  const tz =
    typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'Asia/Shanghai'
  const offset =
    typeof offsetMinutes === 'number' && isFinite(offsetMinutes) ? offsetMinutes : 480

  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const offsetISO = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`

  const date = new Date(nowISO)
  const localDateTime = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    hour12: false,
  }).format(date)

  return { timeZone: tz, offsetMinutes: offset, offsetISO, offsetLabel: `UTC${offsetISO}`, localDateTime }
}

/** 用户当地"今天 23:59"的带偏移 ISO（兜底用） */
function userEndOfDayISO(nowISO: string, ctx: TimeContext): string {
  const date = new Date(nowISO)
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: ctx.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date) // YYYY-MM-DD
  return `${day}T23:59:00${ctx.offsetISO}`
}

// ─── Prompt ──────────────────────────────────

function buildSystemPrompt(nowISO: string, ctx: TimeContext): string {
  return `你是一个任务解析助手，把用户的一句自然语言解析成任务 JSON。

时间上下文：
- 当前 UTC 时间：${nowISO}
- 用户时区：${ctx.timeZone}（${ctx.offsetLabel}）
- 用户当地日期时间：${ctx.localDateTime}

时间规则（最高优先级）：
1. "今晚""明天""周五"等相对时间，一律以【用户当地日期时间】为基准计算。
2. deadline 必须输出带明确时区偏移的 ISO 8601 字符串，格式如 2026-08-03T20:00:00${ctx.offsetISO}。
3. 禁止把用户当地的 20:00 输出为 2026-08-03T20:00:00Z（Z 表示 UTC，会产生时区偏差）。
4. "今晚8点"→用户当地今天20:00；"明天下午3点"→用户当地明天15:00；"周五"→用户当地最近的一个周五。
5. 模糊默认："今晚"未说具体点→当天23:59；"明天"未说具体点→明天23:59；只说某天未说时间点→那天23:59（均为用户当地时间）。

JSON 字段（只输出这个对象，不要任何其他文字）：
{"name": string, "deadline": string, "estimateMinutes": number, "urgency": "high"|"medium"|"low", "estimateGuessed": boolean}

- name：任务名，简洁，去掉时间/紧急程度修饰词，但保留用户原话的核心动宾结构（如"交PRD"不要改写成"写PRD"）。
- urgency："很急/紧急/马上/尽快"→high；"不急/有空再做"→low；未明确→medium。
- estimateMinutes："2小时"→120，"半小时"→30，"一个半小时"→90；用户未提及→60 且 estimateGuessed=true；明确说了→false。`
}

// ─── 解析与校验 ──────────────────────────────

function safeParseJSON(content: string): ParsedTask | null {
  let cleaned = content.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first !== -1 && last !== -1 && last > first) {
    cleaned = cleaned.slice(first, last + 1)
  }
  try {
    return JSON.parse(cleaned) as ParsedTask
  } catch {
    return null
  }
}

const TZ_SUFFIX_RE = /(Z|[+-]\d{2}:\d{2})$/i

function validateParsed(data: unknown, nowISO: string, ctx: TimeContext): ParsedTask | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  const name = typeof d.name === 'string' ? d.name.trim() : ''
  if (!name) return null

  // deadline 校验：必须合法；无时区后缀时按用户当地时间理解，补用户偏移（单一数据流，非 +8 补丁）
  let deadlineStr = typeof d.deadline === 'string' ? d.deadline.trim() : ''
  if (deadlineStr && !TZ_SUFFIX_RE.test(deadlineStr)) {
    deadlineStr = deadlineStr + ctx.offsetISO
  }
  const parsedDate = new Date(deadlineStr)
  const deadlineISO = isNaN(parsedDate.getTime())
    ? userEndOfDayISO(nowISO, ctx)
    : parsedDate.toISOString()

  // estimateMinutes 校验
  let estimateMinutes = Number(d.estimateMinutes)
  let estimateGuessed = Boolean(d.estimateGuessed)
  if (!Number.isFinite(estimateMinutes) || estimateMinutes <= 0) {
    estimateMinutes = 60
    estimateGuessed = true
  } else {
    estimateMinutes = Math.round(estimateMinutes)
  }

  // urgency 校验
  const urgency = d.urgency === 'high' || d.urgency === 'low' ? d.urgency : 'medium'

  return { name, deadline: deadlineISO, estimateMinutes, urgency, estimateGuessed }
}

// ─── 路由 ────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey || apiKey.trim() === '' || apiKey === '在这里粘贴我的key') {
      return NextResponse.json(
        { ok: false, error: 'AI 服务未配置，请改用手动填写' },
        { status: 200 }
      )
    }

    const body = await req.json().catch(() => null)
    const text: string = body?.text ?? ''
    const nowISO: string = body?.nowISO ?? new Date().toISOString()
    const ctx = buildTimeContext(nowISO, body?.timeZone, body?.timezoneOffsetMinutes)

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { ok: false, error: '请输入任务描述' },
        { status: 200 }
      )
    }

    // 超时保护：15 秒未响应则中断，不无限等待
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    const t1 = Date.now()
    let res: Response
    try {
      res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(nowISO, ctx) },
            { role: 'user', content: text.trim() },
          ],
          temperature: 0,
          max_tokens: 400,
          response_format: { type: 'json_object' },
          // 解析是简单结构化抽取，官方支持关闭推理，仅本接口关闭以提速
          thinking: { type: 'disabled' },
        }),
        signal: controller.signal,
      })
    } catch (fetchErr) {
      clearTimeout(timeoutId)
      if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
        console.log(`[AI parse] model=${DEEPSEEK_MODEL} timeout after ${UPSTREAM_TIMEOUT_MS}ms`)
        return NextResponse.json(
          { ok: false, error: 'AI 解析响应较慢，请重试或改用手动填写' },
          { status: 200 }
        )
      }
      throw fetchErr
    }
    clearTimeout(timeoutId)
    const t2 = Date.now()
    const upstreamMs = t2 - t1

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[AI parse] DeepSeek error:', res.status, errText)
      return NextResponse.json(
        { ok: false, error: 'AI 解析失败，请重试或改用手动填写' },
        { status: 200 }
      )
    }

    const json = await res.json()
    const content: string = json?.choices?.[0]?.message?.content ?? ''
    if (!content) {
      console.log(`[AI parse] model=${DEEPSEEK_MODEL} upstreamMs=${upstreamMs} totalMs=${Date.now() - t0} empty-content`)
      return NextResponse.json(
        { ok: false, error: 'AI 未返回有效结果，请改用手动填写' },
        { status: 200 }
      )
    }

    const parsed = safeParseJSON(content)
    const validated = validateParsed(parsed, nowISO, ctx)
    const totalMs = Date.now() - t0
    // 分段耗时日志：不含用户任务文本、不含 API key
    console.log(`[AI parse] model=${DEEPSEEK_MODEL} upstreamMs=${upstreamMs} totalMs=${totalMs}`)

    if (!validated) {
      return NextResponse.json(
        { ok: false, error: 'AI 结果解析失败，请改用手动填写' },
        { status: 200 }
      )
    }

    // debug timing 仅开发环境返回
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      {
        ok: true,
        data: validated,
        ...(isDev ? { debug: { upstreamMs, totalMs, model: DEEPSEEK_MODEL } } : {}),
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('[AI parse] unexpected error:', err)
    return NextResponse.json(
      { ok: false, error: 'AI 服务异常，请改用手动填写' },
      { status: 200 }
    )
  }
}
