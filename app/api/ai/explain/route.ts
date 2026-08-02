import { NextRequest, NextResponse } from 'next/server'

// 只在服务端运行，key 绝不暴露给前端
export const runtime = 'nodejs'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-chat'

interface ExplainTaskPayload {
  name: string
  deadline: string
  estimateMinutes: number
  urgency: string
  progress?: number
  riskTier: number
  slackMinutes: number
  minutesUntilDeadline: number
}

function buildSystemPrompt(): string {
  return `你是一个任务调度解释助手。系统已经用确定的算法选出了当前最该做的任务，你的唯一职责是向用户解释这个选择的理由。

规则：
1. 不要质疑或改变推荐结果，不要建议用户做其他任务，不要重新判断哪个任务更重要。
2. 用 2-3 句中文说明为什么这个任务排在最前，必须引用具体数据（距截止时间、预计耗时、时间余裕/缺口、紧急程度、完成进度）。
3. 如果提供了排名第二的任务，用一句话对比说明为什么它排在后面。
4. 语气平实、直接，像一个靠谱的助理在陈述事实。不要煽情，不要用感叹号，不要说"加油"之类的鼓励话。
5. 不要输出 markdown 标记，只输出纯文本。
6. 总长度控制在 80 字以内。
7. 绝对不要在解释里出现"Tier1""Tier2""Tier3""Tier4""slack"这类内部术语。风险分层只用于你自己理解，对用户要用大白话表达，例如"时间最紧""风险最高""还很充裕"。
8. 解释必须自洽，不能自相矛盾。禁止出现"第二名风险更高，所以排在后面"这类病句。

排序算法的真实规则（供你理解排序依据，解释时要忠实于它）：
1. 先按风险层级排（Tier1 最优先，跨层顺序不可逾越）
2. 同一层级内，优先按时间余量排（slack 越小越靠前，即越紧张的越先做）
3. 两个任务的余量差值小于 15 分钟时，视为"同等紧张"，此时才按用户标记的紧急程度排（high > medium > low）
4. 再按截止时间排（越早越优先）
5. 再按预计耗时排（越长越优先）

因此可能出现这种情况：第二名被用户标记为"紧急"，但因为它的余量明显大于第一名（差值超过 15 分钟），所以排在后面。遇到这种情况要如实说明，例如"虽然测试111标记为紧急，但它的缓冲时间明显更充裕；测试222缓冲只剩几分钟，更为紧张，所以排在最前"。
也可能出现：两个任务余量接近（差值 15 分钟内），此时紧急程度决定先后，例如"两个任务余量相当，测试111被标记为紧急，所以先做它"。
不要使用与实际排序矛盾的解释。

风险分层含义（仅供你理解，不要写进输出）：
- Tier1：截止临近且剩余时间不足以完成，风险最高
- Tier2：剩余时间不足以完成
- Tier3：截止临近但仍能完成
- Tier4：时间充裕

slackMinutes 为正表示时间余裕，为负表示时间缺口。`
}

function describeTask(t: ExplainTaskPayload, includeProgress: boolean): string {
  const lines = [
    `- 任务：${t.name}`,
    `- 距截止：${Math.round(t.minutesUntilDeadline)} 分钟`,
    `- 预计耗时：${t.estimateMinutes} 分钟`,
    `- 时间余裕（slack）：${Math.round(t.slackMinutes)} 分钟（正为余裕，负为缺口）`,
    `- 紧急程度：${t.urgency}`,
    `- 风险分层（内部参考，解释时勿直接引用该词）：Tier ${t.riskTier}`,
  ]
  if (includeProgress) {
    lines.push(`- 完成进度：${t.progress ?? 0}%`)
  }
  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey || apiKey.trim() === '' || apiKey === '在这里粘贴我的key') {
      return NextResponse.json(
        { ok: false, error: 'AI 服务未配置' },
        { status: 200 }
      )
    }

    const body = await req.json().catch(() => null)
    const current: ExplainTaskPayload | undefined = body?.current
    const runnerUp: ExplainTaskPayload | undefined = body?.runnerUp
    const activeCount: number = body?.activeCount ?? 0

    if (!current || !current.name) {
      return NextResponse.json(
        { ok: false, error: '缺少任务数据' },
        { status: 200 }
      )
    }

    const userPrompt = [
      `当前共有 ${activeCount} 个待处理任务。算法推荐的第一名是：`,
      describeTask(current, true),
      runnerUp && runnerUp.name
        ? `\n排名第二的任务是：\n${describeTask(runnerUp, false)}`
        : '',
      '\n请解释为什么第一名排在最前。',
    ].join('\n')

    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[ai/explain] DeepSeek error:', res.status, errText)
      return NextResponse.json(
        { ok: false, error: '解释生成失败，请稍后再试' },
        { status: 200 }
      )
    }

    const json = await res.json()
    let explanation: string = json?.choices?.[0]?.message?.content ?? ''
    // 轻量清理：去首尾空白、去 markdown 围栏
    explanation = explanation
      .trim()
      .replace(/^```(?:\w+)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    if (!explanation) {
      return NextResponse.json(
        { ok: false, error: 'AI 未返回有效解释' },
        { status: 200 }
      )
    }

    return NextResponse.json({ ok: true, explanation }, { status: 200 })
  } catch (err) {
    console.error('[ai/explain] unexpected error:', err)
    return NextResponse.json(
      { ok: false, error: 'AI 服务异常，请稍后再试' },
      { status: 200 }
    )
  }
}
