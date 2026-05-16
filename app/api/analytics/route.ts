/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getZernio, PROFILE_ID } from '@/lib/zernio'

export async function GET() {
  const z = getZernio()

  const { data: autoData } = await z.commentautomations.listCommentAutomations({
    query: { profileId: PROFILE_ID },
  })

  const automations = autoData?.automations ?? []

  // Fetch full detail + logs for each automation in parallel
  type AutoItem = (typeof automations)[number]
  const details = await Promise.all(
    automations.map((a: AutoItem) =>
      a.id
        ? z.commentautomations.getCommentAutomation({ path: { automationId: a.id } })
        : Promise.resolve({ data: { logs: [] } })
    )
  )

  const allLogs: any[] = details.flatMap((r: any) => r.data?.logs ?? [])

  // ── Overview ─────────────────────────────────────────────
  const sum = (key: string) => automations.reduce((s: number, a: any) => s + (a.stats?.[key] ?? 0), 0)
  const totalTriggered = sum('triggered')
  const totalSent      = sum('dmsSent')
  const totalFailed    = sum('dmsFailed')
  const uniqueContacts = sum('uniqueContacts')
  const deliveryRate   = totalTriggered > 0 ? Math.round((totalSent / totalTriggered) * 100) : 0

  // ── Daily (last 14 days) ──────────────────────────────────
  const now = new Date()
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (13 - i))
    const prefix = d.toISOString().slice(0, 10)
    const dayLogs = allLogs.filter(l => l.createdAt?.startsWith(prefix))
    return {
      date:     prefix,
      label:    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      triggers: dayLogs.length,
      sent:     dayLogs.filter(l => l.status === 'sent').length,
      failed:   dayLogs.filter(l => l.status === 'failed').length,
    }
  })

  // ── Hourly distribution ───────────────────────────────────
  const hourly = Array.from({ length: 24 }, (_, h) => ({
    hour:  h,
    label: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
    count: allLogs.filter(l => l.createdAt && new Date(l.createdAt).getHours() === h).length,
  }))

  // ── Automation leaderboard ────────────────────────────────
  const leaderboard = automations
    .map((a: any) => ({
      id:        a.id,
      name:      (a.name ?? '').length > 28 ? (a.name ?? '').slice(0, 28) + '…' : (a.name ?? ''),
      triggered: a.stats?.triggered      ?? 0,
      sent:      a.stats?.dmsSent        ?? 0,
      failed:    a.stats?.dmsFailed      ?? 0,
      contacts:  a.stats?.uniqueContacts ?? 0,
      keywords:  a.keywords ?? [],
      isActive:  a.isActive,
    }))
    .sort((a: any, b: any) => b.triggered - a.triggered)

  // ── Recent feed ───────────────────────────────────────────
  const recentLogs = allLogs
    .filter(l => l.createdAt)
    .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
    .slice(0, 20)

  // ── Keyword breakdown ─────────────────────────────────────
  const kwMap: Record<string, number> = {}
  for (const a of automations) {
    if (!a.keywords?.length) continue
    const count = a.stats?.triggered ?? 0
    for (const kw of a.keywords) {
      kwMap[kw] = (kwMap[kw] ?? 0) + Math.round(count / a.keywords.length)
    }
  }
  const keywords = Object.entries(kwMap)
    .map(([kw, count]) => ({ kw, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return NextResponse.json({
    overview: { totalTriggered, totalSent, totalFailed, uniqueContacts, deliveryRate },
    daily,
    hourly,
    leaderboard,
    keywords,
    recentLogs,
  })
}
