'use client'

import { useState } from 'react'

const DELAYS = [
  { label: 'Immediately',   value: 0     },
  { label: 'After 1 hour',  value: 60    },
  { label: 'After 6 hours', value: 360   },
  { label: 'After 1 day',   value: 1440  },
  { label: 'After 3 days',  value: 4320  },
  { label: 'After 7 days',  value: 10080 },
]

type Step = { id: string; message: string; delayMinutes: number }

let _n = 0
const uid = () => String(++_n)

export default function Sequences() {
  const [name,    setName]    = useState('')
  const [steps,   setSteps]   = useState<Step[]>([{ id: '0', message: '', delayMinutes: 0 }])
  const [saving,  setSaving]  = useState(false)
  const [done,    setDone]    = useState(false)

  const addStep = () => setSteps(s => [...s, { id: uid(), message: '', delayMinutes: 1440 }])
  const rmStep  = (id: string) => setSteps(s => s.length > 1 ? s.filter(x => x.id !== id) : s)
  const upd     = (id: string, p: Partial<Step>) => setSteps(s => s.map(x => x.id === id ? { ...x, ...p } : x))

  const valid = name.trim() && steps.every(s => s.message.trim())

  const save = async () => {
    if (!valid) return
    setSaving(true)
    await new Promise(r => setTimeout(r, 900))
    setSaving(false)
    setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <div className="p-10 max-w-2xl">
      <div className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">Sequences</div>
        <h1 className="text-3xl font-semibold text-ink tracking-tight">Sequence Builder</h1>
        <p className="text-sm text-prose mt-2">
          Multi-step drip campaigns — contacts enrolled from automations receive each step in order
        </p>
      </div>

      {/* Name */}
      <div className="mb-10">
        <label className="font-mono text-xs text-note uppercase tracking-widest block mb-2">
          Sequence Name
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Welcome Series, Lead Nurture"
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 transition-colors"
        />
      </div>

      {/* Timeline */}
      <div className="relative mb-6">
        <div className="absolute left-[15px] top-7 bottom-0 w-px bg-border" />

        {steps.map((step, i) => (
          <div key={step.id}>
            {/* Delay row */}
            {i > 0 && (
              <div className="flex items-center gap-4 ml-[3px] py-2">
                <div className="w-[24px] h-[24px] rounded-full bg-sidebar border border-border flex items-center justify-center text-xs text-note z-10 flex-shrink-0">
                  ↓
                </div>
                <select
                  value={step.delayMinutes}
                  onChange={e => upd(step.id, { delayMinutes: Number(e.target.value) })}
                  className="bg-raised border border-border rounded-lg px-3 py-1.5 text-xs text-prose focus:outline-none focus:border-green/40 cursor-pointer"
                >
                  {DELAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            )}

            {/* Step card */}
            <div className="flex gap-4 group">
              <div className="flex flex-col items-center pt-5 flex-shrink-0">
                <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center font-mono text-xs font-semibold z-10 border transition-all ${
                  step.message
                    ? 'bg-green-lo border-green/40 text-green'
                    : 'bg-surface border-border text-note'
                }`}>
                  {i + 1}
                </div>
              </div>

              <div className="flex-1 mb-4">
                <div className="bg-surface border border-border rounded-2xl p-5 group-hover:border-border-hi transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] text-note uppercase tracking-widest">
                      {i === 0 ? 'Step 1 · Sends immediately' : `Step ${i + 1}`}
                    </span>
                    {steps.length > 1 && (
                      <button
                        onClick={() => rmStep(step.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-note hover:text-danger transition-all font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    value={step.message}
                    onChange={e => upd(step.id, { message: e.target.value })}
                    rows={3}
                    placeholder={i === 0
                      ? "Hey! Thanks for connecting — here's what I promised…"
                      : 'Follow-up message…'}
                    className="w-full bg-raised border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/30 resize-none leading-relaxed transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add step */}
        <div className="flex gap-4">
          <div className="w-[30px] flex-shrink-0" />
          <button
            onClick={addStep}
            className="flex-1 flex items-center justify-center gap-2 border border-dashed border-border rounded-2xl py-4 text-sm text-note hover:border-green/30 hover:text-green/70 transition-all font-medium"
          >
            + Add Step
          </button>
        </div>
      </div>

      {/* Launch */}
      <div className="border-t border-border pt-8 space-y-4">
        <button
          onClick={save}
          disabled={!valid || saving}
          className={`w-full py-4 rounded-2xl text-base font-semibold transition-all flex items-center justify-center gap-2 ${
            valid
              ? 'bg-green hover:bg-[#16a34a] text-bg'
              : 'bg-surface border border-border text-note cursor-not-allowed'
          }`}
        >
          {saving ? <><span className="animate-spin font-mono">◆</span> Creating…</>
          : done   ? <>✓ Sequence Created!</>
          :           <>⋮⋮ Create Sequence</>}
        </button>
        <p className="text-xs text-note text-center">
          Contacts enrolled via automations receive each step in order, on delay
        </p>
      </div>
    </div>
  )
}
