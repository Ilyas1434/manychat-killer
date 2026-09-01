/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Telegram webhook — three jobs:
 *
 * 1. Button taps on the draft approval message:
 *    "approve:<reelId>" → post natively to X + via Zernio to Threads.
 *    "reject:<reelId>"  → discard.
 *
 * 2. Paste an Instagram reel URL → run the pipeline for that reel now
 *    (instant detection; video steps run if the URL has resolved, else queued).
 *
 * 3. Send the reel's VIDEO FILE → transcribe it directly and run the
 *    video-dependent steps immediately, bypassing Zernio's analytics sync lag.
 *    Pair it with a pasted URL (as caption or a preceding message) so we know
 *    which reel it is; otherwise we apply it to the most recent reel.
 *
 * Set the webhook once (see README):
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_BASE_URL>/api/telegram
 */
import { NextResponse } from 'next/server'
import { answerCallback, editMessageText, sendMessage } from '@/lib/telegram'
import { getPendingDraft, clearPendingDraft } from '@/lib/pipeline-store'
import { postToX } from '@/lib/x'
import { publishToThreads } from '@/lib/social-publish'
import { getLatestReel, type ReelMedia } from '@/lib/zernio-media'
import { runInstantSteps, runVideoSteps } from '@/lib/pipeline'

const L = (m: string) => console.log(`[telegram] ${m}`)
const IG_URL_RE = /https?:\/\/(?:www\.)?instagram\.com\/reel\/[A-Za-z0-9_-]+/

/** Resolve which reel a message refers to: a pasted URL wins, else newest. */
async function resolveReel(permalink?: string): Promise<ReelMedia | null> {
  let reel: ReelMedia | null = null
  try { reel = await getLatestReel() } catch (e: any) { L(`resolve failed: ${e.message}`) }
  if (permalink) {
    const clean = permalink.split('?')[0]
    if (!reel || !reel.permalink.startsWith(clean)) {
      reel = { id: clean, caption: reel?.caption ?? '', permalink: clean, createdTime: '', videoUrl: reel?.videoUrl ?? null }
    }
  }
  return reel
}

/** Download a Telegram file (video) by file_id → Buffer. */
async function fetchTelegramFile(fileId: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const meta = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`).then(r => r.json())
  const path = meta?.result?.file_path
  if (!path) throw new Error('could not resolve Telegram file path')
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (expected && req.headers.get('x-telegram-bot-api-secret-token') !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const update = await req.json().catch(() => null)
  const msg = update?.message

  /* ── 3. Video file upload ───────────────────────────────── */
  const fileId = msg?.video?.file_id ?? msg?.document?.file_id
  if (fileId) {
    const permalink = IG_URL_RE.exec(msg?.caption ?? '')?.[0]
    L(`video file received (permalink: ${permalink ?? 'newest reel'})`)
    await sendMessage('⏳ Got the video — transcribing and generating posts…').catch(() => {})
    try {
      const video = await fetchTelegramFile(fileId)
      const reel = await resolveReel(permalink)
      if (!reel) { await sendMessage('⚠️ Could not resolve which reel this is.'); return NextResponse.json({ ok: true }) }
      await runVideoSteps(reel, video)
    } catch (e: any) {
      await sendMessage(`⚠️ Video processing failed: ${e.message}`).catch(() => {})
    }
    return NextResponse.json({ ok: true, trigger: 'video-file' })
  }

  /* ── 2. Paste-link trigger ──────────────────────────────── */
  const text: string | undefined = msg?.text
  if (text) {
    const m = IG_URL_RE.exec(text)
    if (m) {
      const permalink = m[0]
      L(`paste-link trigger: ${permalink}`)
      await sendMessage(`⏳ Firing the pipeline for ${permalink}…`).catch(() => {})
      const reel = await resolveReel(permalink)
      if (reel) {
        await runInstantSteps(reel)
        const { done } = await runVideoSteps(reel)
        if (!done) await sendMessage('Detected — video not ready yet, the cron will retry it. Or send me the video file to do it now.').catch(() => {})
      } else {
        await sendMessage('⚠️ Couldn’t resolve that reel from Zernio yet — try again in a few seconds.').catch(() => {})
      }
      return NextResponse.json({ ok: true, trigger: 'paste-link' })
    }
    return NextResponse.json({ ok: true })
  }

  /* ── 1. Approve / reject buttons ────────────────────────── */
  const cb = update?.callback_query
  if (!cb) return NextResponse.json({ ok: true })

  const data: string     = cb.data ?? ''
  const messageId        = cb.message?.message_id
  const [action, reelId] = data.split(':')
  L(`callback ${action} for reel ${reelId}`)

  if (action === 'reject') {
    await clearPendingDraft(reelId)
    await answerCallback(cb.id, 'Rejected — nothing posted.')
    if (messageId) await editMessageText(messageId, '❌ *Rejected* — X/Threads posts discarded.').catch(() => {})
    return NextResponse.json({ ok: true })
  }

  if (action === 'approve') {
    const draft = await getPendingDraft(reelId)
    if (!draft) {
      await answerCallback(cb.id, 'Draft expired or already handled.')
      return NextResponse.json({ ok: true, note: 'no draft' })
    }
    await answerCallback(cb.id, 'Posting to X + Threads…')
    const [x, threads] = await Promise.allSettled([
      postToX(draft.xPost),
      publishToThreads(draft.threadsPost),
    ])
    await clearPendingDraft(reelId)

    const xLine = x.status === 'fulfilled'
      ? `✅ X: https://x.com/i/status/${(x.value as any).id}`
      : `❌ X failed: ${(x as any).reason?.message}`
    const tLine = threads.status === 'fulfilled' ? '✅ Threads posted' : `❌ Threads failed: ${(threads as any).reason?.message}`
    L(`${xLine} | ${tLine}`)
    if (messageId) await editMessageText(messageId, `📤 *Approved*\n${xLine}\n${tLine}`).catch(() => {})
    return NextResponse.json({ ok: true, x: x.status, threads: threads.status })
  }

  await answerCallback(cb.id)
  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({ ok: true, note: 'telegram webhook endpoint' })
}
