'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Automation = {
  id?: string
  name?: string
  keywords?: string[]
  matchMode?: string
  platformPostId?: string
  dmMessage?: string
  commentReply?: string
  isActive?: boolean
  stats?: { triggered?: number; dmsSent?: number; dmsFailed?: number; uniqueContacts?: number }
  createdAt?: string
}

type Log = {
  id?: string
  commenterName?: string
  commentText?: string
  status?: 'sent' | 'failed' | 'skipped'
  createdAt?: string
}

function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Automations() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [logs,        setLogs]        = useState<Record<string, Log[]>>({})
  const [expanded,    setExpanded]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [deleting,    setDeleting]    = useState<string | null>(null)

  const load = useCallback(() => {
    fetch('/api/automations')
      .then(r => r.json())
      .then(d => { setAutomations(d.automations ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const loadLogs = async (id: string) => {
    if (logs[id]) return
    const r = await fetch(`/api/automations/${id}`)
    const d = await r.json()
    setLogs(prev => ({ ...prev, [id]: d.logs ?? [] }))
  }

  const expand = (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    loadLogs(id)
  }

  const toggle = async (id: string, cur: boolean) => {
    setAutomations(p => p.map(a => a.id === id ? { ...a, isActive: !cur } : a))
    await fetch(`/api/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !cur }),
    })
  }

  const remove = async (id: string) => {
    setDeleting(id)
    await fetch(`/api/automations/${id}`, { method: 'DELETE' })
    setAutomations(p => p.filter(a => a.id !== id))
    if (expanded === id) setExpanded(null)
    setDeleting(null)
  }

  return (
    <div className="p-10 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Automations</div>
          <h1 className="text-3xl font-semibold text-ink tracking-tight">All Automations</h1>
          {!loading && (
            <p className="text-sm text-prose mt-1.5">
              {automations.filter(a => a.isActive).length} live · {automations.length} total
            </p>
          )}
        </div>
        <Link
          href="/automations/new"
          className="flex items-center gap-2 bg-green text-bg px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#16a34a] transition-colors"
        >
          <span className="text-base">+</span> New
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-surface border border-border rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <div className="text-xl font-semibold text-ink mb-2">No automations yet</div>
          <p className="text-prose mb-8 max-w-xs">Create your first comment-to-DM automation and start capturing leads automatically</p>
          <Link
            href="/automations/new"
            className="bg-green text-bg px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#16a34a] transition-colors"
          >
            Create Automation
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {automations.map(a => (
            <div
              key={a.id}
              className={`bg-surface border rounded-2xl overflow-hidden transition-all ${
                expanded === a.id ? 'border-border-hi' : 'border-border hover:border-border-hi'
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-5 px-6 py-5">
                {/* Live dot */}
                <button
                  onClick={() => toggle(a.id!, a.isActive!)}
                  title={a.isActive ? 'Click to pause' : 'Click to activate'}
                  className={`w-3 h-3 rounded-full flex-shrink-0 transition-all ${
                    a.isActive ? 'bg-green glow-active' : 'bg-border hover:bg-prose'
                  }`}
                />

                {/* Name + trigger */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => expand(a.id!)}>
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-base font-semibold text-ink">{a.name}</span>
                    <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      a.isActive ? 'bg-green-lo text-green' : 'bg-raised text-note'
                    }`}>
                      {a.isActive ? 'LIVE' : 'OFF'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-prose">
                    {a.keywords?.length
                      ? <>Triggers on: {a.keywords.map((k, i) => (
                          <span key={k}>
                            {i > 0 && <span className="text-note"> · </span>}
                            <span className="text-ink">"{k}"</span>
                          </span>
                        ))}</>
                      : 'Triggers on: any comment'}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-8 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-xl font-semibold text-green tabular">{a.stats?.triggered ?? 0}</div>
                    <div className="font-mono text-[10px] text-note">triggered</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xl font-semibold text-blue tabular">{a.stats?.dmsSent ?? 0}</div>
                    <div className="font-mono text-[10px] text-note">DMs sent</div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => expand(a.id!)}
                    className="text-xs text-prose hover:text-ink px-3 py-2 rounded-lg hover:bg-raised transition-all font-medium"
                  >
                    {expanded === a.id ? '↑ Hide' : '↓ Logs'}
                  </button>
                  <button
                    onClick={() => remove(a.id!)}
                    disabled={deleting === a.id}
                    className="text-xs text-note hover:text-danger px-3 py-2 rounded-lg hover:bg-raised transition-all font-medium disabled:opacity-40"
                  >
                    {deleting === a.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>

              {/* DM preview */}
              <div className="px-6 pb-5 -mt-2">
                <div className="flex items-start gap-3 bg-raised border border-border rounded-xl px-4 py-3">
                  <span className="font-mono text-[10px] text-note pt-0.5 flex-shrink-0">→ DM</span>
                  <span className="text-sm text-prose leading-relaxed">{a.dmMessage}</span>
                </div>
                {a.commentReply && (
                  <div className="font-mono text-xs text-prose mt-2 pl-1">
                    ↩ Public reply: <span className="text-ink">"{a.commentReply}"</span>
                  </div>
                )}
              </div>

              {/* Logs panel */}
              {expanded === a.id && (
                <div className="border-t border-border step-in">
                  <div className="px-6 py-3 bg-[#0c0c0c]">
                    <span className="font-mono text-[10px] tracking-[0.2em] text-note uppercase">Trigger Log</span>
                  </div>
                  {!logs[a.id!] ? (
                    <div className="text-sm text-prose p-6 text-center">Loading logs…</div>
                  ) : logs[a.id!].length === 0 ? (
                    <div className="text-sm text-prose p-8 text-center">
                      No triggers yet — comment on your reel to test
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {logs[a.id!].slice(0, 12).map(log => (
                        <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-raised transition-colors">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            log.status === 'sent'   ? 'bg-green'  :
                            log.status === 'failed' ? 'bg-danger' : 'bg-note'
                          }`} />
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{log.commenterName ?? 'unknown'}</span>
                            <span className="text-sm text-note">commented</span>
                            <span className="text-sm text-prose">"{log.commentText}"</span>
                          </div>
                          <div className={`font-mono text-xs font-semibold ${
                            log.status === 'sent'   ? 'text-green'  :
                            log.status === 'failed' ? 'text-danger' : 'text-note'
                          }`}>
                            {log.status?.toUpperCase()}
                          </div>
                          <div className="font-mono text-xs text-note flex-shrink-0">{fmtDate(log.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
