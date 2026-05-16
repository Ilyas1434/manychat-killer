'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'

type PollerResult = { conversationId: string; participantName: string; emailFound: string; dmSent: boolean; emailSent?: boolean; error?: string }
type PollerStatus = { state: 'idle' | 'running' | 'done' | 'error'; sent: number; checked: number; results: PollerResult[]; lastRun?: string }

function EmailPoller() {
  const [status, setStatus] = useState<PollerStatus>({ state: 'idle', sent: 0, checked: 0, results: [] })
  const [hasConfigs, setHasConfigs] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const runPoll = useCallback(async () => {
    setStatus(s => ({ ...s, state: 'running' }))
    try {
      const r = await fetch('/api/poller')
      const d = await r.json()
      setStatus({ state: 'done', sent: d.sent ?? 0, checked: d.checkedConversations ?? 0, results: d.results ?? [], lastRun: new Date().toLocaleTimeString() })
    } catch {
      setStatus(s => ({ ...s, state: 'error', lastRun: new Date().toLocaleTimeString() }))
    }
  }, [])

  useEffect(() => {
    fetch('/api/email-collect').then(r => r.json()).then(d => {
      if (d.configs?.length > 0) {
        setHasConfigs(true)
        runPoll()
        intervalRef.current = setInterval(runPoll, 2 * 60 * 1000)
      }
    })
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [runPoll])

  if (!hasConfigs) return null

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            status.state === 'running' ? 'bg-amber animate-pulse' :
            status.state === 'done'    ? 'bg-green' : 'bg-note'
          }`} />
          <span className="text-sm font-semibold text-ink">Email Poller</span>
          <span className="font-mono text-xs text-note">· auto-runs every 2 min</span>
        </div>
        <button
          onClick={runPoll}
          disabled={status.state === 'running'}
          className="font-mono text-xs text-prose hover:text-ink disabled:opacity-40 transition-colors border border-border hover:border-border-hi px-3 py-1.5 rounded-lg"
        >
          {status.state === 'running' ? '⟳ Scanning…' : '↺ Run Now'}
        </button>
      </div>

      <div className="flex items-center gap-6 mb-4">
        <div>
          <div className="font-mono text-2xl font-semibold text-green">{status.sent}</div>
          <div className="font-mono text-[10px] text-note">follow-ups sent</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold text-prose">{status.checked}</div>
          <div className="font-mono text-[10px] text-note">convos scanned</div>
        </div>
        {status.lastRun && (
          <div className="ml-auto font-mono text-[10px] text-note">last run {status.lastRun}</div>
        )}
      </div>

      {status.results.filter(r => r.dmSent).length > 0 && (
        <div className="border-t border-border pt-4 space-y-2">
          {status.results.filter(r => r.dmSent).map(r => (
            <div key={r.conversationId} className="flex items-center gap-3 text-sm slide-in">
              <div className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0" />
              <span className="text-ink font-medium">{r.participantName}</span>
              <span className="text-note">replied with</span>
              <span className="font-mono text-prose text-xs">{r.emailFound}</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-green text-xs font-mono">DM ✓</span>
                {r.emailSent && <span className="text-blue text-xs font-mono">EMAIL ✓</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type Automation = {
  id?: string
  name?: string
  keywords?: string[]
  platformPostId?: string
  dmMessage?: string
  isActive?: boolean
  stats?: { triggered?: number; dmsSent?: number }
}

function StatCard({
  label, value, sub, color,
}: {
  label: string; value: number | string; sub: string; color: string
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
      <div className="font-mono text-[10px] tracking-[0.2em] text-note uppercase">{label}</div>
      <div className="font-mono text-5xl font-semibold tabular leading-none" style={{ color }}>
        {value}
      </div>
      <div className="text-sm text-prose">{sub}</div>
    </div>
  )
}

export default function Dashboard() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch('/api/automations')
      .then(r => r.json())
      .then(d => { setAutomations(d.automations ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (id: string, isActive: boolean) => {
    setAutomations(p => p.map(a => a.id === id ? { ...a, isActive: !isActive } : a))
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
  }

  const active     = automations.filter(a => a.isActive).length
  const triggered  = automations.reduce((s, a) => s + (a.stats?.triggered ?? 0), 0)
  const dms        = automations.reduce((s, a) => s + (a.stats?.dmsSent ?? 0), 0)
  const reels      = new Set(automations.map(a => a.platformPostId).filter(Boolean)).size

  return (
    <div className="p-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Overview</div>
          <h1 className="text-3xl font-semibold text-ink tracking-tight">Dashboard</h1>
        </div>
        <Link
          href="/automations/new"
          className="flex items-center gap-2 bg-green text-bg px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#16a34a] transition-colors"
        >
          <span className="text-base">+</span> New Automation
        </Link>
      </div>

      <EmailPoller />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-10">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-surface border border-border rounded-2xl animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Active"    value={active}    sub="automations running"  color="#22c55e" />
            <StatCard label="Triggered" value={triggered} sub="total comment hits"   color="#f5f5f5" />
            <StatCard label="DMs Sent"  value={dms}       sub="messages delivered"   color="#60a5fa" />
            <StatCard label="Reels"     value={reels}     sub="posts being monitored" color="#f59e0b" />
          </>
        )}
      </div>

      {/* Automations table */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-semibold text-ink">Automations</span>
          <Link href="/automations" className="text-sm text-prose hover:text-ink transition-colors">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-raised rounded-xl animate-pulse" />
            ))}
          </div>
        ) : automations.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-prose mb-2">No automations yet</div>
            <Link href="/automations/new" className="text-sm text-green hover:underline">
              Create your first →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {automations.map(a => (
              <div key={a.id} className="flex items-center gap-5 px-6 py-4 hover:bg-raised transition-colors group">
                {/* Dot toggle */}
                <button
                  onClick={() => toggle(a.id!, a.isActive!)}
                  title={a.isActive ? 'Pause' : 'Activate'}
                  className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
                    a.isActive ? 'bg-green glow-active' : 'bg-border hover:bg-prose'
                  }`}
                />

                {/* Name + keywords */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{a.name}</div>
                  <div className="font-mono text-xs text-prose mt-0.5">
                    {a.keywords?.length
                      ? a.keywords.map(k => `"${k}"`).join(' · ')
                      : 'any comment'}
                  </div>
                </div>

                {/* DM preview */}
                <div className="hidden lg:block flex-1 min-w-0 max-w-xs">
                  <div className="text-xs text-prose truncate">{a.dmMessage}</div>
                </div>

                {/* Count */}
                <div className="text-right flex-shrink-0 w-20">
                  <div className="font-mono text-base font-semibold text-green tabular">
                    {a.stats?.triggered ?? 0}
                  </div>
                  <div className="font-mono text-[10px] text-note">triggered</div>
                </div>

                {/* Badge */}
                <div className={`font-mono text-[11px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 ${
                  a.isActive ? 'bg-green-lo text-green' : 'bg-raised text-note'
                }`}>
                  {a.isActive ? '● LIVE' : '○ OFF'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: '/automations/new', icon: '⚡', label: 'New Automation',  desc: 'Comment keyword → instant DM' },
          { href: '/sequences',       icon: '⋮⋮', label: 'Build Sequence',  desc: 'Multi-step drip campaign'     },
          { href: '/automations',     icon: '◈',  label: 'Manage All',      desc: 'Edit, pause, view logs'       },
        ].map(({ href, icon, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-surface border border-border rounded-2xl p-5 hover:border-border-hi hover:bg-raised transition-all group"
          >
            <div className="font-mono text-xl text-note group-hover:text-prose mb-3 transition-colors">{icon}</div>
            <div className="text-sm font-semibold text-ink mb-1">{label}</div>
            <div className="text-xs text-prose">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
