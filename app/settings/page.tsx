'use client'

import { useState, useEffect, useCallback } from 'react'

type Config = {
  id: string
  emailAskText: string
  followUpDM:   string
  emailSubject: string
  createdAt:    string
}

const BLANK = { emailAskText: '', followUpDM: '', emailSubject: "Here's what you asked for!" }

function ConfigCard({ config, onDelete }: { config: Config; onDelete: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const del = async () => {
    setDeleting(true)
    await fetch(`/api/email-collect/${config.id}`, { method: 'DELETE' })
    onDelete()
  }
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 group">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green" />
          <span className="text-xs font-mono text-note uppercase tracking-widest">Active Config</span>
        </div>
        <button
          onClick={del}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 text-xs text-note hover:text-danger transition-all font-medium disabled:opacity-40"
        >
          {deleting ? '…' : 'Delete'}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-1">Auto-sent DM (asks for email)</div>
          <div className="text-sm text-ink bg-raised rounded-xl px-4 py-3 leading-relaxed">
            {config.emailAskText}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-1">Follow-up DM (sent when they reply with email)</div>
          <div className="text-sm text-ink bg-raised rounded-xl px-4 py-3 leading-relaxed">
            {config.followUpDM}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-1">Email Subject</div>
          <div className="text-sm text-prose bg-raised rounded-xl px-4 py-2.5">
            {config.emailSubject}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddForm({ onAdd }: { onAdd: (c: Config) => void }) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [form,   setForm]   = useState(BLANK)
  const upd = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.emailAskText.trim() || !form.followUpDM.trim()) return
    setSaving(true)
    const res = await fetch('/api/email-collect', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (d.config) { onAdd(d.config); setForm(BLANK); setOpen(false) }
  }

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-2xl py-4 text-sm text-note hover:border-green/40 hover:text-green/70 transition-all font-medium"
    >
      + Add Email-Collect Config
    </button>
  )

  return (
    <div className="bg-surface border border-green/30 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">New Config</span>
        <button onClick={() => setOpen(false)} className="text-note hover:text-ink text-sm transition-colors">✕</button>
      </div>

      <div>
        <label className="font-mono text-[10px] text-note uppercase tracking-widest block mb-2">
          Auto-sent DM — asks for their email
        </label>
        <textarea
          value={form.emailAskText}
          onChange={e => upd('emailAskText', e.target.value)}
          rows={3}
          placeholder={"Hey! 👋 What's your email? I'll send everything straight to your inbox 📧"}
          className="w-full bg-raised border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 resize-none leading-relaxed transition-colors"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] text-note uppercase tracking-widest block mb-2">
          Follow-up DM — sent automatically when they reply with their email
        </label>
        <textarea
          value={form.followUpDM}
          onChange={e => upd('followUpDM', e.target.value)}
          rows={4}
          placeholder={"Here you go, as promised: https://..."}
          className="w-full bg-raised border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 resize-none leading-relaxed transition-colors"
        />
      </div>

      <div>
        <label className="font-mono text-[10px] text-note uppercase tracking-widest block mb-2">
          Email Subject Line
        </label>
        <input
          value={form.emailSubject}
          onChange={e => upd('emailSubject', e.target.value)}
          placeholder="Here's what you asked for!"
          className="w-full bg-raised border border-border rounded-xl px-4 py-2.5 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 transition-colors"
        />
      </div>

      <button
        onClick={save}
        disabled={saving || !form.emailAskText.trim() || !form.followUpDM.trim()}
        className="w-full bg-green hover:bg-[#16a34a] disabled:opacity-40 text-bg font-semibold text-sm py-3 rounded-xl transition-colors"
      >
        {saving ? 'Saving…' : 'Save Config'}
      </button>

      <p className="font-mono text-[10px] text-note text-center">
        Config saves to your storage. Set up Vercel KV in your Vercel dashboard → Storage to persist across deployments.
      </p>
    </div>
  )
}

export default function Settings() {
  const [configs,  setConfigs]  = useState<Config[]>([])
  const [loading,  setLoading]  = useState(true)
  const [usingEnv, setUsingEnv] = useState(false)

  const load = useCallback(() => {
    fetch('/api/email-collect')
      .then(r => r.json())
      .then(d => {
        setConfigs(d.configs ?? [])
        setUsingEnv(d.usingEnv ?? false)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-10 max-w-2xl">
      <div className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Settings</div>
        <h1 className="text-3xl font-semibold text-ink tracking-tight">Email Collect</h1>
        <p className="text-sm text-prose mt-2">
          When someone replies to your email-ask DM with their email address, the follow-up DM below fires automatically.
        </p>
      </div>

      {usingEnv && (
        <div className="bg-raised border border-amber/30 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber mt-1.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-ink mb-0.5">Using env var config</div>
            <p className="text-xs text-prose leading-relaxed">
              Your configs are loaded from <span className="font-mono text-amber">EMAIL_COLLECT_CONFIGS</span> in Vercel.
              New configs added here won't persist until you connect Vercel KV (Vercel dashboard → Storage → Create KV → link to project).
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-48 bg-surface border border-border rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map(c => (
            <ConfigCard
              key={c.id}
              config={c}
              onDelete={() => setConfigs(cs => cs.filter(x => x.id !== c.id))}
            />
          ))}
          <AddForm onAdd={c => setConfigs(cs => [...cs, c])} />
        </div>
      )}
    </div>
  )
}
