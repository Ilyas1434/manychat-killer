'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/',            label: 'Dashboard',   icon: '◈' },
  { href: '/automations', label: 'Automations', icon: '⚡' },
  { href: '/sequences',   label: 'Sequences',   icon: '⋮⋮' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-border">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <span className="text-green text-lg leading-none">◆</span>
          <div>
            <div className="font-mono text-[13px] font-semibold text-ink tracking-widest uppercase">Zernio</div>
            <div className="font-mono text-[9px] text-note tracking-[0.25em] mt-0.5">AUTOMATION OS</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-100 group
                ${active
                  ? 'bg-green-lo text-green'
                  : 'text-prose hover:text-ink hover:bg-raised'}
              `}
            >
              <span className={`font-mono text-base leading-none w-5 text-center ${active ? 'text-green' : 'text-note group-hover:text-prose'}`}>
                {icon}
              </span>
              {label}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green" />}
            </Link>
          )
        })}
      </nav>

      {/* CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/automations/new"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-green text-bg text-sm font-semibold hover:bg-[#16a34a] transition-colors"
        >
          <span className="text-base leading-none">+</span>
          New Automation
        </Link>
      </div>

      {/* Account */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-green animate-pulse-slow flex-shrink-0" />
          <span className="font-mono text-[12px] text-prose">{process.env.NEXT_PUBLIC_IG_USERNAME ?? '@yourhandle'}</span>
        </div>
        <div className="font-mono text-[10px] text-note mt-1 pl-[18px]">Instagram · Live</div>
      </div>
    </aside>
  )
}
