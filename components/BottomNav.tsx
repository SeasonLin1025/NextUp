'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ListTodo, CalendarDays } from 'lucide-react'

const TABS = [
  { href: '/',         label: '任务',  Icon: ListTodo },
  { href: '/calendar', label: '日历',  Icon: CalendarDays },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-slate-100 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
      <div className="container mx-auto max-w-lg flex items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors
                ${active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}
              `}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[11px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-slate-900 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
