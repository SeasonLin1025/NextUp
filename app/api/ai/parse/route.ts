import { NextRequest, NextResponse } from 'next/server'

// 只在服务端运行，不使用 Edge（保证能读到 process.env）
export const runtime = 'nodejs'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-chat'

interface ParsedTask {
  name: string
  deadline: string
  estimateMinutes: number
  urgency: 'high' | 'medium' | 'low'
  estimateGuessed?: boolean
}

function buildSystemPrompt(nowISO: string): string {
  return `你是一个任务解析助手。用户会用一句自然语言描述一个待办任务，你需要把它解析成结构化 JSON。

当前时间是：${nowISO}（ISO 8601 格式）。请以此为基准计算所有相对时间。

请只输出一个 JSON 对象，不要输出任何多余文字、解释或 markdown 代码块标记。JSON 字段如下：

{
  "name": string,            // 任务名，简洁清晰，去掉时间/紧急程度等修饰词
  "deadline": string,        // ISO 8601 格式的截止时间（带时区偏移或本地时间）
  "estimateMinutes": number, // 预估耗时（分钟，正整数）
  "urgency": "high" | "medium" | "low",
  "estimateGuessed": boolean // 若用户未明确说明耗时、由你估计，则为 true；用户明确说了则为 false
}

解析规则：
1. 相对时间：基于当前时间计算。"今晚8点"→今天20:00，"明天下午3点"→明天15:00，"周五"→本周或下周最近的周五。
2. 模糊时间默认值：
   - "今晚"若未说具体点，默认今天 23:59。
   - "明天"若未说具体点，默认明天 23:59。
   - 只说某天（如"周五"、"下周一"）而没说具体时间点，默认那天 23:59。
3. 紧急程度：
   - 用户说"很急/紧急/马上/尽快/立刻"→ high。
   - 用户说"不急/有空再做/慢慢来/随便什么时候"→ low。
   - 没有明确表达 → medium。
4. 预估耗时：
   - "2小时"→120，"半小时"→30，"一个半小时"→90，"45分钟"→45。
   - 用户未提及耗时 → 给合理默认值 60，并把 estimateGuessed 设为 true。
   - 用户明确说了耗时 → estimateGuessed 设为 false。
5. deadline 必须是可被 JavaScript new Date() 解析的 ISO 字符串。

再次强调：只输出 JSON，不要有其他任何内容。`
}

function safeParseJSON(content: string): ParsedTask | null {
  // 去掉可能的 markdown 代码块围栏
  let cleaned = content.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  // 尝试截取第一个 { 到最后一个 }
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

function validateParsed(data: unknown, nowISO: string): ParsedTask | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>

  const name = typeof d.name === 'string' ? d.name.trim() : ''
  if (!name) return null

  // deadline 校验
  let deadlineISO = typeof d.deadline === 'string' ? d.deadline : ''
  const parsedDate = new Date(deadlineISO)
  if (isNaN(parsedDate.getTime())) {
    // 兜底：默认今天结束
    const fallback = new Date(nowISO)
    fallback.setHours(23, 59, 0, 0)
    deadlineISO = fallback.toISOString()
  } else {
    deadlineISO = parsedDate.toISOString()
  }

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

export async function POST(req: NextRequest) {
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

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { ok: false, error: '请输入任务描述' },
        { status: 200 }
      )
    }

    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt(nowISO) },
          { role: 'user', content: text.trim() },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[ai/parse] DeepSeek error:', res.status, errText)
      return NextResponse.json(
        { ok: false, error: 'AI 解析失败，请重试或改用手动填写' },
        { status: 200 }
      )
    }

    const json = await res.json()
    const content: string = json?.choices?.[0]?.message?.content ?? ''
    if (!content) {
      return NextResponse.json(
        { ok: false, error: 'AI 未返回有效结果，请改用手动填写' },
        { status: 200 }
      )
    }

    const parsed = safeParseJSON(content)
    const validated = validateParsed(parsed, nowISO)
    if (!validated) {
      return NextResponse.json(
        { ok: false, error: 'AI 结果解析失败，请改用手动填写' },
        { status: 200 }
      )
    }

    return NextResponse.json({ ok: true, data: validated }, { status: 200 })
  } catch (err) {
    console.error('[ai/parse] unexpected error:', err)
    return NextResponse.json(
      { ok: false, error: 'AI 服务异常，请改用手动填写' },
      { status: 200 }
    )
  }
}
