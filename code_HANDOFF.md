# NextUp 项目交接文档

> 写给下一个完全没有上下文的新会话。最后更新：2026-07-13

---

## 一、项目是什么

**NextUp** 是一个移动端任务管理 PWA，核心理念是：
- 根据任务的 **deadline + estimateMinutes** 自动计算时间压力
- 按 **Risk Tier（1-4）** 和 **Slack（剩余可用时间）** 排序，把最紧急的任务顶到最上面
- 不是传统 TODO，而是"告诉你现在最应该做什么"的任务压力视图

**技术栈：**
- Next.js 14 App Router + TypeScript
- Tailwind CSS（强制 light mode，在 `layout.tsx` 里写了 `className="light"`）
- date-fns（日期处理）
- lucide-react（图标）
- 数据存在 `localStorage`，无后端

**项目路径：** `/Users/linxizhe/vibecoding/nextup`
**Git 远端：** `https://github.com/SeasonLin1025/NextUp.git`（main 分支）

---

## 二、已完成的功能

### P1.1 月视图日历（tag: `P1-month-calendar-stable`）
- **底部 Tab 导航**：`components/BottomNav.tsx`，首页 + 日历两个 tab
- **月视图**：`app/calendar/page.tsx` + `components/CalendarMonth.tsx`
  - 每天显示最多 2 个任务小圆点
  - 点击某天弹出 `DayTaskPanel`
- **DayTaskPanel**：`components/DayTaskPanel.tsx`
  - 展示当天已完成 / 进行中 / 已超时任务
  - 右上角有"查看日视图"按钮，跳转 `/calendar/day?date=yyyy-MM-dd`
- **"本月"按钮**：CalendarMonth 顶部，点击跳回当前月份（原来叫"今天"，已改名）

### P1.2 日视图时间轴（tag: `P1-day-timeline-v2-stable`）
- **路由：** `app/calendar/day/page.tsx`（用了 `Suspense` 包裹 `useSearchParams`）
- **顶部 Week Strip**：可以在当前周内切换日期
- **"今天"按钮**：只在查看非今天时出现，用普通灰色样式（不是蓝色高亮）
- **弹性小时行布局：** `components/DayTimeline.tsx` + `components/HourRow.tsx`
  - 每个小时是一个独立的 `<HourRow>`，内容多时自动撑高，不溢出到下一小时
  - **任务归属规则：所有任务按 deadline 所在小时归入对应 HourRow**（不是按开始时间）
  - 未完成活跃任务：显示 `startHHmm–endHHmm`、Risk Tier、urgency、预计时长
  - 已超时任务：聚合在 deadline 小时行，浅红色，显示"已超时 Xh Ym"
  - 已完成任务：聚合在 deadline 小时行，灰色，line-through，显示"已完成/逾期完成"
  - 多任务同小时：聚合展示，最多 4 条，超出显示"+N 项更多"
- **顶部已超时摘要栏**：紧凑单行，只作为概览
- **当前时间红线**：只在今天显示，贴在对应小时行内，每分钟更新

---

## 三、关键文件结构

```
nextup/
├── app/
│   ├── layout.tsx            # 强制 light mode（className="light"）
│   ├── page.tsx              # 首页，任务列表 + BottomNav + pb-28
│   ├── calendar/
│   │   ├── page.tsx          # 月视图
│   │   └── day/
│   │       └── page.tsx      # 日视图（含 Suspense）
├── components/
│   ├── BottomNav.tsx         # 底部 Tab
│   ├── CalendarMonth.tsx     # 月视图组件
│   ├── DayTaskPanel.tsx      # 月视图点击弹出面板
│   ├── DayTimeline.tsx       # 日视图时间轴主容器
│   ├── HourRow.tsx           # 弹性小时行（核心布局单元）
│   ├── HourGroupBlock.tsx    # 旧文件，已被 HourRow 取代，可删
│   ├── TimelineTaskBlock.tsx # 旧文件，已被 HourRow 内联取代，可删
│   └── FreeTimeBlock.tsx     # 旧文件，暂保留
├── lib/
│   ├── types.ts              # Task 等核心类型
│   ├── priority.ts           # Risk Tier + Slack 排序算法
│   ├── storage.ts            # localStorage 读写
│   └── timeBlocks.ts         # 时间轴辅助函数（calcBlockTop 等，部分已弃用）
```

---

## 四、核心数据结构

```typescript
// lib/types.ts
interface Task {
  id: string
  name: string
  deadline: number          // ms timestamp
  estimateMinutes: number   // 预计还需多少分钟
  urgency: 'high' | 'medium' | 'low'
  completed: boolean
  completedAt?: number      // ms timestamp
  completedOverdue?: boolean // 是否逾期完成
}
```

**任务状态优先级：**
1. `completed === true` → 已完成
2. `completed === false && deadline <= now` → 已超时
3. `completed === false && deadline > now` → 活跃

**Risk Tier 颜色：**
- Tier 1 = 红色（最紧急）
- Tier 2 = 橙色
- Tier 3 = 黄色
- Tier 4 = 蓝色（宽松）

---

## 五、下一步计划（未做）

### P1.3 任务创建/编辑
- 首页右下角的"+"按钮目前是空的
- 需要实现：新建任务（name + deadline + estimate + urgency）
- 需要实现：点击任务 → 编辑/完成/删除

### P1.4 首页优化
- 任务列表支持滑动完成（swipe to complete）
- 空状态优化

### P2.x 远期
- 数据持久化（目前只有 localStorage，刷新不丢失，但清除浏览器会丢）
- 重复任务
- 提醒通知

---

## 六、踩过的坑——绝对不要再踩

### 1. `npm run build` 会杀死 dev server
每次跑 `build` 后，3000 端口进程被占用，必须手动重启：
```bash
lsof -ti:3000 | xargs kill -9 && npm run dev
```

### 2. `useSearchParams` 必须包在 `Suspense` 里
Next.js 14 App Router 静态预渲染时，`useSearchParams()` 不能裸用，必须：
```tsx
export default function Page() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <PageContent />  {/* 在这里用 useSearchParams */}
    </Suspense>
  )
}
```
否则 `npm run build` 会报 `useSearchParams() should be wrapped in a suspense boundary` 错误。

### 3. layout.tsx 必须强制 light mode
系统暗色模式会导致 Tailwind 颜色全部翻转，在 `app/layout.tsx` 的 `<html>` 标签上加：
```tsx
<html lang="zh" className="light">
```

### 4. 时间轴定位"底部锚定 deadline"
旧的绝对定位布局下，短任务最小高度会导致任务块向下超出 deadline 位置。
正确算法（已在 `calcBlockTop` 里实现，但当前已换用弹性行布局，不再用绝对定位）：
```
endPx = endMin * PX_PER_MINUTE
visualHeight = max(MIN_BLOCK_HEIGHT, duration * PX_PER_MINUTE)
top = endPx - visualHeight  // 向上扩展，底部锚定 deadline
```

### 5. 任务 HourRow 归属必须按 deadline，不是按 start time
NextUp 是截止压力视图，用户关心"几点前必须做完"。
任务归入哪个小时行，必须用 `deadline.getHours()`，绝对不要用 `(deadline - estimateMinutes).getHours()`。

### 6. overdueTasks 时间计算用 ms，不是 minutes
计算"已超时多久"：
```typescript
// ✅ 正确
const overdueMin = Math.floor((now - task.deadline) / 60_000)

// ❌ 错误（会得到类似 373613h 的结果）
const overdueMin = now - task.deadline
```

### 7. git 仓库在 nextup 子目录，不是 vibecoding 根目录
```bash
# ✅ 正确
cd /Users/linxizhe/vibecoding/nextup && git add .

# ❌ 错误（fatal: not a git repository）
cd /Users/linxizhe/vibecoding && git add .
```

### 8. "今天"按钮样式逻辑
日视图顶部"今天"按钮：
- 只在 `!isToday(selectedDate)` 时显示
- 样式用灰色（`border-slate-200 text-slate-600`），不要用蓝色高亮
- 蓝色高亮让用户误以为当前就是今天

---

## 七、当前代码健康状态

- `HourGroupBlock.tsx`、`TimelineTaskBlock.tsx`、`FreeTimeBlock.tsx` 是旧文件，已被 `HourRow.tsx` 取代，但 build 不报错（因为没有 import 了）。下次可以清理。
- `lib/timeBlocks.ts` 里的 `calcBlockTop`、`calcBlockHeight`、`minutesToPx`、`minutesToTop` 等函数在弹性行布局下已不再被使用，可以精简。

---

## 八、开发环境启动

```bash
cd /Users/linxizhe/vibecoding/nextup
npm run dev
# 访问 http://localhost:3000
```
