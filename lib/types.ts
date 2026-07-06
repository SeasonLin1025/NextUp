export type Task = {
  id: string
  name: string
  deadline: number          // 时间戳 (ms)
  urgency: 'high' | 'medium' | 'low'
  estimateMinutes: number   // 当前剩余预估耗时（随进度动态计算）
  originalEstimate: number  // 首次录入时的预估耗时，永不改变
  progress: number          // 0-100，完成百分比
  createdAt: number
  completed: boolean
  completedAt?: number
  completedOverdue?: boolean  // 是否逾期完成（勾选时 deadline < now）
}
