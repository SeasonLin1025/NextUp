'use client'

import { Task } from '@/lib/types'
import { formatMin, minToHHmm, PX_PER_MINUTE, PX_PER_HOUR } from '@/lib/timeBlocks'
import { format } from 'date-fns'

export interface GroupedEntry {
  task: Task
  status: 'overdue' | 'done'
  overdueMin?: number   // 已超时分钟数
}

interface Props {
  hour: number          // 整点小时（例如 19）
  entries: GroupedEntry[]
  axisStartHour: number
}

const MAX_SHOW = 3

export default function HourGroupBlock({ hour, entries, axisStartHour }: Props) {
  const topPx = (hour - axisStartHour) * PX_PER_HOUR + PX_PER_MINUTE * 4  // 距整点线稍微下沉 4min

  const overdueEntries = entries.filter((e) => e.status === 'overdue')
  const doneEntries    = entries.filter((e) => e.status === 'done')
  const hasOverdue = overdueEntries.length > 0
  const hasDone    = doneEntries.length > 0

  // 外层样式：有超时用浅红，纯已完成用灰
  const outerCls = hasOverdue
    ? 'border-l-4 border-red-300 bg-red-50/70'
    : 'border-l-4 border-gray-300 bg-gray-50'

  // 标题文案
  let titleText = ''
  if (hasOverdue && hasDone) {
    titleText = `${overdueEntries.length} 项已超时 · ${doneEntries.length} 项已完成`
  } else if (hasOverdue) {
    titleText = overdueEntries.length === 1 ? '已超时' : `${overdueEntries.length} 项已超时`
  } else {
    titleText = doneEntries.length === 1 ? '已完成' : `${doneEntries.length} 项已完成`
  }

  const showEntries = entries.slice(0, MAX_SHOW)
  const hiddenCount = entries.length - showEntries.length

  return (
    <div
      className={`absolute left-0 right-1 rounded-r overflow-hidden z-[1] ${outerCls}`}
      style={{ top: topPx }}
    >
      <div className="px-2 pt-1 pb-1.5">
        {/* 标题行 */}
        <p className={`text-[10px] font-semibold mb-1 ${hasOverdue ? 'text-red-400' : 'text-gray-400'}`}>
          {titleText}
        </p>

        {/* 条目列表 */}
        <div className="space-y-0.5">
          {showEntries.map(({ task, status, overdueMin }) => (
            <div key={task.id} className="flex items-baseline gap-1 flex-wrap">
              <span className={`text-[10px] font-medium truncate max-w-[40%] ${
                status === 'overdue' ? 'text-red-500' : 'text-gray-400 line-through'
              }`}>
                {task.name}
              </span>
              <span className={`text-[10px] flex-shrink-0 ${
                status === 'overdue' ? 'text-red-400' : 'text-gray-400'
              }`}>
                {format(new Date(task.deadline), 'HH:mm')}
              </span>
              {status === 'overdue' && overdueMin !== undefined && (
                <span className="text-[10px] text-red-400 flex-shrink-0">
                  +{formatMin(overdueMin)}
                </span>
              )}
              {status === 'done' && (
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {task.completedOverdue ? '逾期完成' : '已完成'}
                </span>
              )}
            </div>
          ))}

          {hiddenCount > 0 && (
            <p className="text-[10px] text-slate-400">+{hiddenCount} 项更多</p>
          )}
        </div>
      </div>
    </div>
  )
}
