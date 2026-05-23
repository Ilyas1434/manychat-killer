'use client'

import { useState, useEffect, useCallback } from 'react'

type Automation = {
  id?: string; name?: string; dmMessage?: string; isActive?: boolean
  stats?: { triggered?: number }
}
type Config = {
  automationId: string; automationName: string; emailAskText: string
  followUpDM: string; emailSubject: string; replyTrigger?: 'email' | 'follow'; updatedAt: string
}

function AutomationRow({
  automation, config, onSave, onDelete,
}: {
  automation: Automation
  config:     Config | undefined
  onSave:     (c: Config) => void
  onDelete:   (id: string) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [deleting,setDeleting]= useState(false)
  const [followUp,setFollowUp]= useState(config?.followUpDM     ?? '')

  const save = async () => {
    setSaving(true)
    const body: Config = {
      automationId:   automation.id!,
      automationName: automation.name!,
      emailAskText:   automation.dmMessage ?? '',
      followUpDM:     followUp,
      emailSubject:   '',
      replyTrigger:   'follow',
      updatedAt:      new Date().toISOString(),
    }
    const res = await fetch('/api/email-collect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (d.config) { onSave(d.config); setOpen(false) }
  }

  const del = async () => {
    setDeleting(true)
    await fetch(`/api/email-collect/${automation.id}`, { method: 'DELETE' })
    onDelete(automation.id!)
    setDeleting(false)
  }

  const hasConfig = !!config
  const badge = config?.replyTrigger === 'follow' ? 'FOLLOW GATE ON' : 'EMAIL COLLECT ON'

  return (
    <div className={`bg-surface border rounded-2xl overflow-hidden transition-all ${open ? 'border-green/40' : 'border-border hover:border-border-hi'}`}>
      {/* Row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${automation.isActive ? 'bg-green' : 'bg-note'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink truncate">{automation.name}</div>
          <div className="font-mono text-xs text-note mt-0.5 truncate">{automation.dmMessage?.slice(0, 70)}…</div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {hasConfig ? (
            <span className="font-mono text-[10px] bg-green-lo text-green px-2.5 py-1 rounded-lg">{badge}</span>
          ) : (
            <span className="font-mono text-[10px] bg-raised text-note px-2.5 py-1 rounded-lg">OFF</span>
          )}

          {hasConfig && (
            <button
              onClick={del}
              disabled={deleting}
              className="text-xs text-note hover:text-danger transition-colors font-medium disabled:opacity-40"
            >
              {deleting ? '…' : 'Remove'}
            </button>
          )}

          <button
            onClick={() => setOpen(o => !o)}
            className="text-xs text-prose hover:text-ink px-3 py-1.5 rounded-lg border border-border hover:border-border-hi transition-all font-medium"
          >
            {open ? 'Close' : hasConfig ? 'Edit' : 'Set Up'}
          </button>
        </div>
      </div>

      {/* Expand */}
      {open && (
        <div className="border-t border-border px-5 py-5 space-y-5 step-in">
          {/* Read-only: email ask */}
          <div>
            <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-2">
              Auto-sent DM (asks for follow) — pulled from your automation
            </div>
            <div className="bg-raised rounded-xl px-4 py-3 text-sm text-prose leading-relaxed opacity-70 select-none">
              {automation.dmMessage}
            </div>
          </div>

          {/* Editable: follow-up DM */}
          <div>
            <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-2">
              Follow-up DM — sent automatically after they follow and reply
            </div>
            <textarea
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              rows={4}
              placeholder="Here you go, as promised: https://..."
              className="w-full bg-raised border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 resize-none leading-relaxed transition-colors"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || !followUp.trim()}
            className="w-full bg-green hover:bg-[#16a34a] disabled:opacity-40 text-bg font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : hasConfig ? 'Save Changes' : 'Enable Follow Gate'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [configs,     setConfigs]     = useState<Config[]>([])
  const [mode,        setMode]        = useState('')
  const [loading,     setLoading]     = useState(true)

  const load = useCallback(async () => {
    const [aRes, cRes] = await Promise.all([
      fetch('/api/automations'),
      fetch('/api/email-collect'),
    ])
    const [aData, cData] = await Promise.all([aRes.json(), cRes.json()])
    setAutomations(aData.automations ?? [])
    setConfigs(cData.configs ?? [])
    setMode(cData.storageMode ?? '')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const configFor = (id?: string) => configs.find(c => c.automationId === id)

  return (
    <div className="p-10 max-w-3xl">
      <div className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Settings</div>
        <h1 className="text-3xl font-semibold text-ink tracking-tight">Follow Gate</h1>
        <p className="text-sm text-prose mt-2">
          Pick any automation and set what to DM people after they follow and reply. Each automation can send something different.
        </p>
      </div>

      {mode === 'env' && (
        <div className="bg-raised border border-amber/30 rounded-2xl px-5 py-4 mb-8 flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber mt-1.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-ink mb-1">Changes won't persist after redeployment</div>
            <p className="text-xs text-prose leading-relaxed">
              Connect Vercel KV to make configs permanent: Vercel dashboard → your project → Storage → Create KV → Connect to Project → Redeploy. One-time setup.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-surface border border-border rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => (
            <AutomationRow
              key={a.id}
              automation={a}
              config={configFor(a.id)}
              onSave={c => setConfigs(cs => {
                const idx = cs.findIndex(x => x.automationId === c.automationId)
                return idx >= 0 ? cs.map((x,i) => i === idx ? c : x) : [...cs, c]
              })}
              onDelete={id => setConfigs(cs => cs.filter(c => c.automationId !== id))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
