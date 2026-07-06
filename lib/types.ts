export type Task = {
  id: string
  name: string
  deadline: number         // 时间戳 (ms)
  urgency: 'high' | 'medium' | 'low'
  estimateMinutes: number
  createdAt: number
  completed: boolean
  completedAt?: number
}
