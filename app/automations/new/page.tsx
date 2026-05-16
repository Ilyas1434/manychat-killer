'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Reel = {
  id: string; content: string; picture?: string
  permalink: string; commentCount: number; likeCount: number; createdTime: string
}

type State = {
  reel: Reel | null; triggerType: 'keyword' | 'any'
  keywords: string[]; matchMode: 'contains' | 'exact'
  collectEmail: boolean; emailAsk: string; emailSubject: string
  dmMessage: string; commentReply: string; name: string
}

const STEPS = ['Select Reel', 'Set Trigger', 'Write Response', 'Launch']

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center mb-12">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-semibold transition-all ${
              i < step  ? 'bg-green text-bg' :
              i === step ? 'bg-green-lo text-green ring-1 ring-green/40' :
                           'bg-raised text-note'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium transition-colors ${
              i === step ? 'text-ink' : i < step ? 'text-prose' : 'text-note'
            }`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px mx-3 transition-colors ${i < step ? 'bg-green/40' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function NewAutomation() {
  const router  = useRouter()
  const [step,        setStep]        = useState(0)
  const [reels,       setReels]       = useState<Reel[]>([])
  const [loaded,      setLoaded]      = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [kwInput,     setKwInput]     = useState('')
  const [state, set_] = useState<State>({
    reel: null, triggerType: 'keyword', keywords: [],
    matchMode: 'contains', collectEmail: false,
    emailAsk: "Hey! 👋 What's your email? I'll send everything straight to your inbox 📧",
    emailSubject: "Here's what you asked for!",
    dmMessage: '', commentReply: '', name: '',
  })
  const set = (p: Partial<State>) => set_(s => ({ ...s, ...p }))

  useEffect(() => {
    if (!loaded) {
      fetch('/api/reels')
        .then(r => r.json())
        .then(d => { setReels(d.data ?? []); setLoaded(true) })
        .catch(() => setLoaded(true))
    }
  }, [loaded])

  const addKw = () => {
    const kw = kwInput.trim()
    if (kw && !state.keywords.includes(kw)) {
      set({ keywords: [...state.keywords, kw] })
      setKwInput('')
    }
  }

  const canNext = () => {
    if (step === 0) return !!state.reel
    if (step === 1) return state.triggerType === 'any' || state.keywords.length > 0
    if (step === 2) return state.collectEmail
      ? state.emailAsk.trim().length > 0
      : state.dmMessage.trim().length > 0
    return true
  }

  const launch = async () => {
    setSubmitting(true)
    // When collecting email first, the auto-sent DM is the email ask.
    // The actual content DM is stored in the name for reference.
    const sentDM = state.collectEmail ? state.emailAsk : state.dmMessage
    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platformPostId: state.reel!.id,
        postTitle:      state.reel!.content.slice(0, 80),
        name:           state.name.trim() || `${state.reel!.content.slice(0, 35)}… → DM`,
        dmMessage:      sentDM,
        ...(state.triggerType === 'keyword' && { keywords: state.keywords, matchMode: state.matchMode }),
        ...(state.commentReply.trim() && { commentReply: state.commentReply.trim() }),
      }),
    })

    // Register email-collect config so the poller knows to auto-send the follow-up
    if (state.collectEmail && state.emailAsk.trim()) {
      await fetch('/api/email-collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailAskText: state.emailAsk,
          followUpDM:   state.dmMessage,
          emailSubject: state.emailSubject,
        }),
      })
    }

    setSubmitting(false)
    router.push('/automations')
  }

  return (
    <div className="p-10 max-w-2xl">
      <div className="mb-10">
        <div className="font-mono text-[10px] tracking-[0.25em] text-note mb-2 uppercase">New Automation</div>
        <h1 className="text-3xl font-semibold text-ink tracking-tight">Create Automation</h1>
      </div>

      <StepBar step={step} />

      {/* Step 0: Reel */}
      {step === 0 && (
        <div className="step-in space-y-3">
          <div className="flex items-center justify-between mb-6">
            <p className="text-prose">Select the reel to monitor for comments</p>
            {!loaded && <span className="font-mono text-xs text-note animate-pulse">Fetching reels…</span>}
          </div>
          {loaded && reels.length === 0 && (
            <p className="text-prose text-center py-12">No reels found in your inbox</p>
          )}
          {reels.map(reel => (
            <div
              key={reel.id}
              onClick={() => set({ reel })}
              className={`flex gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${
                state.reel?.id === reel.id
                  ? 'border-green/60 bg-green-lo'
                  : 'border-border bg-surface hover:border-border-hi hover:bg-raised'
              }`}
            >
              {reel.picture && (
                <img src={reel.picture} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink leading-relaxed line-clamp-2 mb-2">{reel.content}</div>
                <div className="flex gap-5">
                  <span className="font-mono text-xs text-prose">♥ {reel.likeCount}</span>
                  <span className="font-mono text-xs text-prose">◎ {reel.commentCount} comments</span>
                  <span className="font-mono text-xs text-note">
                    {new Date(reel.createdTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
              {state.reel?.id === reel.id && (
                <div className="w-6 h-6 rounded-full bg-green flex items-center justify-center text-bg text-xs font-bold flex-shrink-0 self-start">✓</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Trigger */}
      {step === 1 && (
        <div className="step-in space-y-8">
          <p className="text-prose">What should trigger this automation?</p>

          <div className="grid grid-cols-2 gap-3">
            {([
              ['keyword', '⌨', 'Keyword Comments', 'Fires when a specific word is commented'],
              ['any',     '◉', 'Any Comment',      'Fires on every single comment'],
            ] as const).map(([val, icon, label, desc]) => (
              <div
                key={val}
                onClick={() => set({ triggerType: val })}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  state.triggerType === val
                    ? 'border-green/50 bg-green-lo'
                    : 'border-border bg-surface hover:border-border-hi'
                }`}
              >
                <div className="font-mono text-2xl mb-3 text-prose">{icon}</div>
                <div className="text-sm font-semibold text-ink mb-1">{label}</div>
                <div className="text-xs text-prose">{desc}</div>
              </div>
            ))}
          </div>

          {state.triggerType === 'keyword' && (
            <div className="space-y-5">
              <div>
                <label className="font-mono text-xs text-note uppercase tracking-widest block mb-2">
                  Trigger Keywords
                </label>
                <div className="flex gap-2">
                  <input
                    value={kwInput}
                    onChange={e => setKwInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKw() } }}
                    placeholder='e.g. LEADS'
                    className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-ink placeholder-note focus:outline-none focus:border-green/50 transition-colors"
                  />
                  <button
                    onClick={addKw}
                    className="px-5 py-2.5 bg-raised border border-border rounded-xl text-sm text-prose hover:text-ink hover:border-border-hi transition-all font-medium"
                  >
                    Add
                  </button>
                </div>
                {state.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {state.keywords.map(kw => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-2 bg-green-lo border border-green/25 text-green rounded-full px-3.5 py-1.5 text-sm font-medium"
                      >
                        "{kw}"
                        <button
                          onClick={() => set({ keywords: state.keywords.filter(k => k !== kw) })}
                          className="text-green/50 hover:text-green transition-colors"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-5">
                <label className="font-mono text-xs text-note uppercase tracking-widest block mb-3">
                  Match Mode
                </label>
                <div className="flex gap-3">
                  {([
                    ['contains', 'Contains',    '"I want LEADS please" → triggers'],
                    ['exact',    'Exact Match', '"LEADS" only → triggers'],
                  ] as const).map(([val, label, hint]) => (
                    <button
                      key={val}
                      onClick={() => set({ matchMode: val })}
                      className={`flex-1 py-3 px-4 rounded-xl border text-left transition-all ${
                        state.matchMode === val
                          ? 'bg-green-lo border-green/40 text-green'
                          : 'bg-surface border-border text-prose hover:border-border-hi hover:text-ink'
                      }`}
                    >
                      <div className="text-sm font-semibold mb-0.5">{label}</div>
                      <div className="font-mono text-[10px] opacity-70">{hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Response */}
      {step === 2 && (
        <div className="step-in space-y-7">
          <p className="text-prose">Write the messages your commenter receives</p>

          {/* Collect email toggle */}
          <div
            onClick={() => set({ collectEmail: !state.collectEmail })}
            className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all select-none ${
              state.collectEmail
                ? 'border-green/50 bg-green-lo'
                : 'border-border bg-surface hover:border-border-hi'
            }`}
          >
            <div>
              <div className="text-sm font-semibold text-ink mb-0.5">Collect Email First</div>
              <div className="text-xs text-prose">
                Auto-DM asks for their email — you follow up with the content manually
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 ml-4 relative ${
              state.collectEmail ? 'bg-green' : 'bg-raised border border-border'
            }`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                state.collectEmail ? 'left-6' : 'left-1'
              }`} />
            </div>
          </div>

          {/* Email collect flow */}
          {state.collectEmail ? (
            <div className="space-y-5">
              {/* Step 1 — auto DM */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-green flex items-center justify-center font-mono text-[10px] font-bold text-bg flex-shrink-0">1</div>
                  <label className="font-mono text-xs text-note uppercase tracking-widest">Auto-Sent DM — asks for email</label>
                  <span className={`ml-auto font-mono text-xs ${state.emailAsk.length > 900 ? 'text-danger' : 'text-note'}`}>
                    {state.emailAsk.length}/1000
                  </span>
                </div>
                <textarea
                  value={state.emailAsk}
                  onChange={e => set({ emailAsk: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 resize-none leading-relaxed transition-colors"
                />
              </div>

              {/* Email subject */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-green flex items-center justify-center font-mono text-[10px] font-bold text-bg flex-shrink-0">@</div>
                  <label className="font-mono text-xs text-note uppercase tracking-widest">Email Subject Line</label>
                </div>
                <input
                  value={state.emailSubject}
                  onChange={e => set({ emailSubject: e.target.value })}
                  placeholder="Here's what you asked for!"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 transition-colors"
                />
              </div>

              {/* Step 2 — manual content */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-raised border border-border flex items-center justify-center font-mono text-[10px] text-note flex-shrink-0">2</div>
                  <label className="font-mono text-xs text-note uppercase tracking-widest">Your Content DM — send manually after they reply</label>
                </div>
                <textarea
                  value={state.dmMessage}
                  onChange={e => set({ dmMessage: e.target.value })}
                  rows={4}
                  maxLength={1000}
                  placeholder={"Here's what you asked for 👇\n\n[your link, guide, or resource]"}
                  className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm text-ink placeholder-note focus:outline-none focus:border-green/30 resize-none leading-relaxed transition-colors opacity-70"
                />
                <div className="flex items-center gap-2 mt-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green flex-shrink-0" />
                  <p className="text-xs text-prose">
                    Sent automatically by the poller when they reply with their email — no action needed from you.
                  </p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-[#0c0c0c] border border-border rounded-2xl p-5">
                <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-4">Flow Preview</div>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-green-lo border border-green/30 flex items-center justify-center text-green text-xs flex-shrink-0">◆</div>
                    <div>
                      <div className="font-mono text-[10px] text-green mb-1">BOT · AUTO-SENT</div>
                      <div className="bg-raised rounded-2xl rounded-tl-none px-4 py-3 text-sm text-ink leading-relaxed max-w-xs">
                        {state.emailAsk}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start justify-end">
                    <div>
                      <div className="font-mono text-[10px] text-note text-right mb-1">THEM · REPLIES</div>
                      <div className="bg-[#1a1a1a] border border-border rounded-2xl rounded-tr-none px-4 py-3 text-sm text-prose">
                        their@email.com
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-full bg-raised border border-border flex items-center justify-center text-note text-xs flex-shrink-0">👤</div>
                    <div>
                      <div className="font-mono text-[10px] text-note mb-1">YOU · MANUAL FOLLOW-UP</div>
                      <div className="bg-raised border border-border border-dashed rounded-2xl rounded-tl-none px-4 py-3 text-sm text-note leading-relaxed max-w-xs">
                        {state.dmMessage || '[your content goes here]'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Standard DM flow */
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-mono text-xs text-note uppercase tracking-widest">DM Message</label>
                  <span className={`font-mono text-xs ${state.dmMessage.length > 900 ? 'text-danger' : 'text-note'}`}>
                    {state.dmMessage.length}/1000
                  </span>
                </div>
                <textarea
                  value={state.dmMessage}
                  onChange={e => set({ dmMessage: e.target.value })}
                  rows={5}
                  maxLength={1000}
                  placeholder={"Hey! Thanks for commenting — here's what you asked for 👇\n\n[your link or info]"}
                  className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 resize-none leading-relaxed transition-colors"
                />
              </div>

              {state.dmMessage && (
                <div className="bg-[#0c0c0c] border border-border rounded-2xl p-5">
                  <div className="font-mono text-[10px] text-note uppercase tracking-widest mb-4">DM Preview</div>
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-raised border border-border flex-shrink-0" />
                    <div className="bg-raised rounded-2xl rounded-tl-none px-4 py-3 text-sm text-ink leading-relaxed max-w-sm">
                      {state.dmMessage}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comment reply (always shown) */}
          <div>
            <label className="font-mono text-xs text-note uppercase tracking-widest block mb-2">
              Public Comment Reply <span className="text-[#333] normal-case tracking-normal font-sans">· optional</span>
            </label>
            <input
              value={state.commentReply}
              onChange={e => set({ commentReply: e.target.value })}
              placeholder="Check your DMs! 👀"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 transition-colors"
            />
            <p className="text-xs text-note mt-2">Appears publicly as a reply under their comment</p>
          </div>
        </div>
      )}

      {/* Step 3: Launch */}
      {step === 3 && (
        <div className="step-in space-y-7">
          <p className="text-prose">Review everything and go live</p>

          <div>
            <label className="font-mono text-xs text-note uppercase tracking-widest block mb-2">
              Automation Name
            </label>
            <input
              value={state.name}
              onChange={e => set({ name: e.target.value })}
              placeholder={`${state.reel?.content?.slice(0, 40) ?? 'My automation'}… → DM`}
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-ink placeholder-note focus:outline-none focus:border-green/40 transition-colors"
            />
          </div>

          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {[
              ['Reel',    state.reel?.content?.slice(0, 70) + '…'                                   ],
              ['Trigger', state.triggerType === 'any' ? 'Any comment' : state.keywords.map(k=>`"${k}"`).join(', ')],
              ['Match',   state.triggerType === 'any' ? '—' : state.matchMode                        ],
              ['Mode',    state.collectEmail ? '📧 Collect email first' : '⚡ Send DM immediately'   ],
              ['Auto DM', state.collectEmail
                ? state.emailAsk.slice(0, 60) + (state.emailAsk.length > 60 ? '…' : '')
                : state.dmMessage.slice(0, 60) + (state.dmMessage.length > 60 ? '…' : '')           ],
              ['Reply',   state.commentReply || '—'                                                  ],
            ].map(([label, value], i, arr) => (
              <div key={label} className={`flex gap-8 px-6 py-4 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="font-mono text-xs text-note w-16 flex-shrink-0 pt-0.5 uppercase tracking-wider">{label}</div>
                <div className="text-sm text-ink leading-relaxed">{value}</div>
              </div>
            ))}
          </div>

          <button
            onClick={launch}
            disabled={submitting}
            className="w-full bg-green hover:bg-[#16a34a] disabled:opacity-50 text-bg font-semibold text-base py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><span className="animate-spin">◆</span> Launching…</> : <>⚡ Launch Automation</>}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-12 pt-8 border-t border-border">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-sm text-prose hover:text-ink disabled:opacity-0 transition-colors font-medium"
        >
          ← Back
        </button>
        {step < 3 && (
          <button
            onClick={() => canNext() && setStep(s => s + 1)}
            disabled={!canNext()}
            className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              canNext()
                ? 'bg-green text-bg hover:bg-[#16a34a]'
                : 'bg-raised text-note border border-border cursor-not-allowed'
            }`}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
