'use client'

import { FreeSlot, minutesToPx, minutesToTop, minToHHmm, formatMin } from '@/lib/timeBlocks'

interface Props {
  slot: FreeSlot
  axisStartHour: number
}

export default function FreeTimeBlock({ slot, axisStartHour }: Props) {
  const topPx    = minutesToTop(slot.startMin)
  const heightPx = minutesToPx(slot.durationMin)

  const startHHmm = minToHHmm(axisStartHour, slot.startMin)
  const endHHmm   = minToHHmm(axisStartHour, slot.endMin)

  return (
    <div
      className="absolute left-0 right-1 overflow-hidden pointer-events-none"
      style={{ top: topPx, height: heightPx }}
    >
      {/* 仅顶部一条浅灰虚线 + 轻量文字，不做大面积填色 */}
      <div className="h-full flex items-center px-2 border-t border-dashed border-slate-200">
        <span className="text-[10px] text-slate-300 select-none">
          空闲 {formatMin(slot.durationMin)}
          <span className="ml-1 opacity-70">{startHHmm}–{endHHmm}</span>
        </span>
      </div>
    </div>
  )
}
