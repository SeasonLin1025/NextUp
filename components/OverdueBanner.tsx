'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface Props {
  count: number           // 新增超时任务数量
  visible: boolean        // 是否显示横条
  onClick: () => void     // 点击后触发滚动+消失
}

export default function OverdueBanner({ count, visible, onClick }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onClick={onClick}
          className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl
            bg-red-50 border-l-4 border-l-red-500 border border-red-100
            hover:bg-red-100 transition-colors overflow-hidden"
        >
          <span className="flex-1 text-sm font-medium text-red-700">
            ⚠️ 有 {count} 项任务已超时，点击查看
          </span>
          <ChevronDown size={16} className="text-red-500 shrink-0" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
