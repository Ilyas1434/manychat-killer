'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

/* ─── Types ─────────────────────────────────────────────── */
type Overview = {
  totalTriggered: number; totalSent: number; totalFailed: number
  uniqueContacts: number; deliveryRate: number
}
type DayPoint    = { date: string; label: string; triggers: number; sent: number; failed: number }
type HourPoint   = { hour: number; label: string; count: number }
type LeaderRow   = { id?: string; name: string; triggered: number; sent: number; failed: number; contacts: number; keywords: string[]; isActive?: boolean }
type KwPoint     = { kw: string; count: number }
type Log         = { id?: string; commenterName?: string; commentText?: string; status?: string; createdAt?: string }

type AnalyticsData = {
  overview:    Overview
  daily:       DayPoint[]
  hourly:      HourPoint[]
  leaderboard: LeaderRow[]
  keywords:    KwPoint[]
  recentLogs:  Log[]
}

/* ─── Design tokens ──────────────────────────────────────── */
const G = {
  green:   '#22c55e',
  blue:    '#60a5fa',
  amber:   '#f59e0b',
  red:     '#ef4444',
  purple:  '#a78bfa',
  grid:    '#1e1e1e',
  axis:    '#4a4a4a',
  surface: '#111111',
  border:  '#252525',
}

/* ─── Helpers ────────────────────────────────────────────── */
function fmtTime(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0e0e0e] border border-border rounded-xl px-4 py-3 shadow-xl">
      <div className="font-mono text-xs text-note mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-prose capitalize">{p.name}</span>
          <span className="font-mono font-semibold text-ink ml-auto pl-4">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color, prefix = '' }: {
  label: string; value: number | string; sub: string; color: string; prefix?: string
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="font-mono text-[10px] tracking-[0.2em] text-note uppercase mb-4">{label}</div>
      <div className="font-mono text-5xl font-semibold tabular leading-none mb-3" style={{ color }}>
        {prefix}{value}
      </div>
      <div className="text-sm text-prose">{sub}</div>
    </div>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {sub && <p className="text-xs text-prose mt-0.5">{sub}</p>}
    </div>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  )
}

/* ─── Main ───────────────────────────────────────────────── */
export default function Analytics() {
  const [data,    setData]    = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="p-10 max-w-6xl space-y-6">
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Analytics</div>
        <h1 className="text-3xl font-semibold text-ink">Performance</h1>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({length:5}).map((_,i)=><div key={i} className="h-36 bg-surface border border-border rounded-2xl animate-pulse"/>)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({length:4}).map((_,i)=><div key={i} className="h-64 bg-surface border border-border rounded-2xl animate-pulse"/>)}
      </div>
    </div>
  )

  if (!data) return (
    <div className="p-10 text-prose">Failed to load analytics.</div>
  )

  const { overview, daily, hourly, leaderboard, keywords, recentLogs } = data

  // Delivery breakdown for pie
  const deliveryPie = [
    { name: 'Sent',    value: overview.totalSent,   color: G.green  },
    { name: 'Failed',  value: overview.totalFailed, color: G.red    },
    { name: 'Skipped', value: Math.max(0, overview.totalTriggered - overview.totalSent - overview.totalFailed), color: G.axis },
  ].filter(d => d.value > 0)

  // Peak hour
  const peakHour = [...hourly].sort((a,b) => b.count - a.count)[0]

  return (
    <div className="p-10 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Analytics</div>
        <h1 className="text-3xl font-semibold text-ink tracking-tight">Performance</h1>
        <p className="text-sm text-prose mt-1.5">All-time stats across every automation</p>
      </div>

      {/* ── Stat row ── */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Triggered"    value={overview.totalTriggered} sub="total comment hits"      color={G.green}  />
        <StatCard label="DMs Sent"     value={overview.totalSent}      sub="delivered successfully"  color={G.blue}   />
        <StatCard label="Failed"       value={overview.totalFailed}    sub="delivery errors"         color={G.red}    />
        <StatCard label="Contacts"     value={overview.uniqueContacts} sub="unique people reached"   color={G.amber}  />
        <StatCard label="Delivery"     value={overview.deliveryRate}   sub="success rate"            color={G.green} prefix="" />
      </div>

      {/* ── Row 1: Line chart + Delivery pie ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Line chart — 2/3 width */}
        <Panel className="col-span-2">
          <SectionHeader title="Triggers Over Time" sub="Daily comment hits and DMs sent — last 14 days" />
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={daily} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid stroke={G.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: G.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: G.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Line type="monotone" dataKey="triggers" name="Triggers" stroke={G.green} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: G.green }} />
              <Line type="monotone" dataKey="sent"     name="Sent"     stroke={G.blue}  strokeWidth={2} dot={false} activeDot={{ r: 4, fill: G.blue  }} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-green rounded"/><span className="text-xs text-prose">Triggers</span></div>
            <div className="flex items-center gap-2"><div className="w-6 h-0.5 bg-blue rounded" style={{backgroundImage:'repeating-linear-gradient(90deg,#60a5fa 0,#60a5fa 4px,transparent 4px,transparent 6px)'}}/><span className="text-xs text-prose">DMs sent</span></div>
          </div>
        </Panel>

        {/* Delivery donut — 1/3 width */}
        <Panel>
          <SectionHeader title="Delivery Rate" sub={`${overview.deliveryRate}% of triggers delivered`} />
          {deliveryPie.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-note">No data yet</div>
          ) : (
            <>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={deliveryPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                      {deliveryPie.map((d, i) => <Cell key={i} fill={d.color} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<DarkTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="font-mono text-3xl font-semibold text-green">{overview.deliveryRate}%</div>
                  <div className="font-mono text-[10px] text-note">delivered</div>
                </div>
              </div>
              <div className="space-y-2 mt-2">
                {deliveryPie.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-prose">{d.name}</span>
                    </div>
                    <span className="font-mono text-xs text-ink">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ── Row 2: Automation leaderboard + Hourly ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Leaderboard — 2/3 */}
        <Panel className="col-span-2">
          <SectionHeader title="Automation Performance" sub="Ranked by total triggers" />
          {leaderboard.length === 0 ? (
            <div className="text-sm text-note py-8 text-center">No automations yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={leaderboard.length * 52 + 20}>
              <BarChart data={leaderboard} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid stroke={G.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fill: G.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fill: '#a8a8a8', fontSize: 11, fontFamily: 'var(--font-sans)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} />
                <Bar dataKey="triggered" name="Triggered" fill={G.green} radius={[0,4,4,0]} />
                <Bar dataKey="sent"      name="Sent"      fill={G.blue}  radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Hourly heatmap — 1/3 */}
        <Panel>
          <SectionHeader
            title="Best Time of Day"
            sub={peakHour?.count > 0 ? `Peak at ${peakHour.label} (${peakHour.count} triggers)` : 'No data yet'}
          />
          <div className="grid grid-cols-4 gap-1.5">
            {hourly.map(h => {
              const max   = Math.max(...hourly.map(x => x.count), 1)
              const alpha = h.count === 0 ? 0.04 : 0.1 + (h.count / max) * 0.9
              return (
                <div
                  key={h.hour}
                  title={`${h.label}: ${h.count} triggers`}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center cursor-default transition-all hover:scale-105"
                  style={{ background: `rgba(34,197,94,${alpha})` }}
                >
                  <div className="font-mono text-[9px] text-prose">{h.label}</div>
                  {h.count > 0 && (
                    <div className="font-mono text-[10px] font-bold text-green">{h.count}</div>
                  )}
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* ── Row 3: Keywords + Recent feed ── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Keyword bar */}
        <Panel>
          <SectionHeader title="Keyword Breakdown" sub="Estimated triggers per keyword" />
          {keywords.length === 0 ? (
            <div className="text-sm text-note py-8 text-center">No keyword automations yet</div>
          ) : (
            <div className="space-y-3">
              {keywords.map(k => {
                const max = keywords[0].count || 1
                const pct = Math.round((k.count / max) * 100)
                return (
                  <div key={k.kw} className="flex items-center gap-3">
                    <div className="font-mono text-xs text-ink w-20 flex-shrink-0">"{k.kw}"</div>
                    <div className="flex-1 bg-raised rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="font-mono text-xs text-prose w-6 text-right">{k.count}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>

        {/* Recent activity feed */}
        <Panel>
          <SectionHeader title="Recent Triggers" sub="Latest comment hits across all automations" />
          {recentLogs.length === 0 ? (
            <div className="text-sm text-note py-8 text-center">No triggers yet</div>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {recentLogs.map((log, i) => (
                <div
                  key={log.id ?? i}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-raised transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    log.status === 'sent'   ? 'bg-green' :
                    log.status === 'failed' ? 'bg-red'   : 'bg-note'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-ink">{log.commenterName ?? 'unknown'}</span>
                    <span className="text-sm text-note mx-1.5">·</span>
                    <span className="text-sm text-prose truncate">"{log.commentText}"</span>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`font-mono text-[10px] font-semibold ${
                      log.status === 'sent'   ? 'text-green' :
                      log.status === 'failed' ? 'text-danger' : 'text-note'
                    }`}>{log.status?.toUpperCase()}</div>
                    <div className="font-mono text-[10px] text-note">{fmtDate(log.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Full-width daily bar chart ── */}
      <Panel>
        <SectionHeader title="Daily Activity" sub="Triggers and DMs sent per day" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={daily} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={G.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: G.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: G.axis, fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="triggers" name="Triggers" fill={G.green} radius={[3,3,0,0]} opacity={0.8} />
            <Bar dataKey="sent"     name="Sent"     fill={G.blue}  radius={[3,3,0,0]} opacity={0.8} />
            <Bar dataKey="failed"   name="Failed"   fill={G.red}   radius={[3,3,0,0]} opacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}
