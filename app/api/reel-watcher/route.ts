/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Reel pipeline orchestrator — hit by a cron every ~1 min.
 *
 * Detection uses Zernio's media list (GET /v1/inbox/comments returns the full
 * recent media, pre-comment — the same data the dashboard shows instantly).
 * No Meta Graph token needed.
 *
 * On a NEW reel: run the instant step (Telegram ping) and queue it for the
 * video-dependent steps (LinkedIn, YouTube, transcript→drafts). Because Zernio
 * only exposes the downloadable video URL via its lagged analytics sync, the
 * queue is retried each tick until the video resolves or MAX_ATTEMPTS elapse.
 *
 * Idempotent: KV stores the last-processed reel id + a video-pending queue.
 */
import { NextResponse } from 'next/server'
import { getLatestReel, type ReelMedia } from '@/lib/zernio-media'
import { runInstantSteps, runVideoSteps } from '@/lib/pipeline'
import {
  getLastSeenReelId, setLastSeenReelId,
  getPendingVideos, setPendingVideos, type PendingVideo,
} from '@/lib/pipeline-store'
import { sendMessage } from '@/lib/telegram'

export const maxDuration = 300

const L = (m: string) => console.log(`[reel-watcher] ${m}`)
const MAX_ATTEMPTS = 30 // ~30 min at 1-min cadence before giving up on the video

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const url = new URL(req.url)
  return req.headers.get('x-cron-secret') === secret
      || url.searchParams.get('secret') === secret
      || req.headers.get('authorization') === `Bearer ${secret}`
}

/** Retry the video-dependent steps for every queued reel. */
async function drainVideoQueue() {
  const queue = await getPendingVideos()
  if (!queue.length) return { processed: 0, remaining: 0 }

  const still: PendingVideo[] = []
  for (const item of queue) {
    // Re-resolve the reel (picks up the video URL once analytics syncs).
    let reel: ReelMedia | null = null
    try { reel = await getLatestReel() } catch { /* keep waiting */ }
    // Match the queued reel by permalink (latest may differ if you posted again).
    if (!reel || reel.permalink !== item.permalink) {
      reel = { id: item.reelId, caption: item.caption, permalink: item.permalink, createdTime: '', videoUrl: null }
    }

    if (!reel.videoUrl) {
      const attempts = item.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        L(`giving up on video for ${item.permalink} after ${attempts} attempts`)
        await sendMessage(`⚠️ Video for ${item.permalink} never became available — skipped YouTube + drafts. You can send me the video file to do it manually.`).catch(() => {})
      } else {
        still.push({ ...item, attempts })
      }
      continue
    }

    const { done } = await runVideoSteps(reel)
    if (!done) {
      const attempts = item.attempts + 1
      if (attempts < MAX_ATTEMPTS) still.push({ ...item, attempts })
    }
  }

  await setPendingVideos(still)
  return { processed: queue.length - still.length, remaining: still.length }
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Always work the retry queue first.
  const queueResult = await drainVideoQueue()

  let reel: ReelMedia | null
  try { reel = await getLatestReel() }
  catch (e: any) { L(`getLatestReel failed: ${e.message}`); return NextResponse.json({ error: e.message }, { status: 500 }) }

  if (!reel) return NextResponse.json({ ok: true, note: 'no media', queue: queueResult })

  const lastSeen = await getLastSeenReelId()
  if (!lastSeen) {
    await setLastSeenReelId(reel.id)
    return NextResponse.json({ ok: true, note: 'baseline set', baselineReelId: reel.id })
  }
  if (reel.id === lastSeen) return NextResponse.json({ ok: true, note: 'no new reel', lastSeen, queue: queueResult })

  L(`NEW reel ${reel.id} (prev ${lastSeen})`)
  await setLastSeenReelId(reel.id)

  // Instant step now; queue the video-dependent steps.
  await runInstantSteps(reel)

  if (reel.videoUrl) {
    // Video already available (rare on a fresh reel) — run immediately.
    await runVideoSteps(reel)
  } else {
    const queue = await getPendingVideos()
    queue.push({ reelId: reel.id, permalink: reel.permalink, caption: reel.caption, attempts: 0 })
    await setPendingVideos(queue)
  }

  return NextResponse.json({ ok: true, processedReelId: reel.id, queuedForVideo: !reel.videoUrl, queue: queueResult })
}
