'use client'

import { useRef, forwardRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface Props {
  title: string
  count: number
  defaultOpen?: boolean
  isOpen: boolean
  onToggle: () => void
  /** 角标数（红点），> 0 时显示 */
  badge?: number
  /** 标题颜色类，默认灰色 */
  titleColor?: string
  children: React.ReactNode
}

const SectionGroup = forwardRef<HTMLDivElement, Props>(function SectionGroup(
  { title, count, isOpen, onToggle, badge = 0, titleColor = 'text-gray-500', children },
  ref
) {
  return (
    <div ref={ref} className="space-y-2">
      {/* Section header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-1 group"
      >
        <motion.span
          animate={{ rotate: isOpen ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400"
        >
          <ChevronDown size={14} />
        </motion.span>

        <span className={`text-xs font-semibold tracking-wide uppercase ${titleColor}`}>
          {title}
        </span>

        <span className="text-xs text-gray-400 font-normal">
          {count} 项
        </span>

        {badge > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {badge}
          </span>
        )}
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pb-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

export default SectionGroup
