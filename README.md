# NextUp — 个人任务优先级调度工具

> 智能排序，告诉你现在该做什么。

## 技术栈

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** 组件库
- **localStorage** 数据持久化（无需后端）
- **date-fns** 日期处理
- **lucide-react** 图标
- **framer-motion** 动画

## 项目结构

```
nextup/
├── app/
│   ├── layout.tsx          # 全局布局
│   ├── page.tsx            # 主页（当前任务 + 列表）
│   ├── calendar/
│   │   └── page.tsx        # 日历页（后续阶段实现）
│   └── globals.css
├── components/
│   ├── TaskInput.tsx        # 任务录入表单
│   ├── CurrentTask.tsx      # 顶部大字"现在做什么"
│   ├── TaskList.tsx         # 排序后的任务列表
│   ├── TaskCard.tsx         # 单个任务卡片
│   └── ui/                  # shadcn/ui 基础组件
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── checkbox.tsx
│       ├── tabs.tsx
│       ├── label.tsx
│       ├── badge.tsx
│       └── select.tsx
├── lib/
│   ├── types.ts             # Task 类型定义
│   ├── storage.ts           # localStorage 封装
│   ├── priority.ts          # 优先级排序算法
│   └── utils.ts             # 工具函数 (cn)
└── README.md
```

## 快速开始

```bash
# 使用官方 Node.js 20（项目所需，避免 SWC 签名问题）
export PATH="/tmp/node-v20.18.0-darwin-arm64/bin:$PATH"

# 安装依赖（已完成）
npm install --legacy-peer-deps

# 启动开发服务器
npm run dev

# 浏览器打开
open http://localhost:3000
```

> **注意**：每次开新终端需要重新 export PATH，或将以下内容加到 `~/.zshrc`：
> ```bash
> export PATH="/tmp/node-v20.18.0-darwin-arm64/bin:$PATH"
> ```

## 排序算法

优先级得分计算：

```
urgencyWeight: high=3, medium=2, low=1
hoursLeft = (deadline - now) / 3600000
tightness = estimateMinutes/60 / hoursLeft
score = urgencyWeight × 0.4 + tightness × 100 × 0.6
```

- 未完成任务：按 score 降序排列
- 已完成任务：沉到底部，按 completedAt 倒序
- 所有任务均保留，不过滤

## 开发阶段

- [x] 第一阶段：项目结构初始化
- [ ] 第二阶段：P0 任务录入 + 动态排序
- [ ] 第三阶段：日历视图（待规划）
