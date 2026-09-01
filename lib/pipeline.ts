/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The reel fan-out, split into two phases because Zernio exposes the video URL
 * only via its (lagged) analytics sync — a just-posted reel is detectable
 * instantly but its downloadable .mp4 may not be ready for a few minutes.
 *
 *   INSTANT (runs once on detection):
 *     - Telegram ping to set up the DM automation
 *
 *   VIDEO-DEPENDENT (retried each cron tick until the video resolves):
 *     - LinkedIn re-publish (needs the video URL)
 *     - YouTube Short upload (needs the bytes)
 *     - Whisper transcript → Claude X/Threads drafts → Telegram approval buttons
 *
 * Lives in lib/ (not the route) so the cron route and the Telegram fallbacks
 * can both import it — Next.js route files may only export HTTP handlers.
 */
import { downloadMedia, resolveVideoUrl, type ReelMedia } from '@/lib/zernio-media'
import { sendMessage, sendWithButtons } from '@/lib/telegram'
import { publishToLinkedIn } from '@/lib/social-publish'
import { uploadShort } from '@/lib/youtube'
import { transcribe } from '@/lib/transcribe'
import { generatePosts } from '@/lib/generate-posts'
import { savePendingDraft } from '@/lib/pipeline-store'

const L = (m: string) => console.log(`[pipeline] ${m}`)

/** Fires once when a reel is first detected — the steps that don't need video. */
export async function runInstantSteps(reel: ReelMedia) {
  const base = process.env.PUBLIC_BASE_URL ?? ''
  const setupLink = `${base}/automations/new?postUrl=${encodeURIComponent(reel.permalink)}`
  await sendMessage(
    `🎬 *New reel detected!*\n${reel.permalink}\n\n` +
    `👉 [Set up a DM automation for this reel](${setupLink})\n\n` +
    `_Cross-posting + drafts coming as soon as the video is ready (or send me the video file to do it now)._`,
  ).catch(e => L(`telegram notify failed: ${e.message}`))
}

/**
 * Video-dependent fan-out. Returns whether it completed (so the caller can
 * stop retrying). If `video` is provided (Telegram file upload) we use it
 * directly; otherwise we need reel.videoUrl resolved.
 */
export async function runVideoSteps(
  reel: ReelMedia,
  preloadedVideo?: Buffer,
): Promise<{ done: boolean }> {
  let video = preloadedVideo ?? null
  let caption = reel.caption || ''

  // Resolve a FRESH video URL via Apify unless the caller preloaded the bytes
  // (Telegram video-file upload). Zernio/IG URLs are unreliable, so this is the
  // canonical path for the download.
  if (!video) {
    let videoUrl = reel.videoUrl
    if (!videoUrl) {
      const resolved = await resolveVideoUrl(reel.permalink)
      videoUrl = resolved.videoUrl
      if (resolved.caption) caption = resolved.caption  // scrape caption is fuller
      reel = { ...reel, videoUrl, caption }
    }
    if (!videoUrl) { L(`no video URL resolved for ${reel.permalink}`); return { done: false } }
    try { video = await downloadMedia(videoUrl) }
    catch (e: any) { L(`download failed: ${e.message}`); return { done: false } }
  }

  const [linkedin, youtube, drafts] = await Promise.allSettled([
    reel.videoUrl
      ? publishToLinkedIn({ videoUrl: reel.videoUrl, caption })
      : Promise.reject(new Error('no video URL for LinkedIn')),
    uploadShort({
      video,
      title:       caption.split('\n')[0]?.slice(0, 90) || 'New Short',
      description: caption,
    }),
    (async () => {
      const transcript = await transcribe(video!)
      L(`transcript (${transcript.length} chars): ${transcript.slice(0, 80)}...`)
      return generatePosts(transcript, caption)
    })(),
  ])

  L(`linkedin: ${linkedin.status}${linkedin.status === 'rejected' ? ' ' + (linkedin as any).reason?.message : ''}`)
  L(`youtube:  ${youtube.status}${youtube.status === 'rejected' ? ' ' + (youtube as any).reason?.message : ''}`)
  L(`drafts:   ${drafts.status}${drafts.status === 'rejected' ? ' ' + (drafts as any).reason?.message : ''}`)

  if (drafts.status === 'fulfilled') {
    const { xPost, threadsPost } = drafts.value
    await savePendingDraft({
      reelId: reel.id, permalink: reel.permalink, xPost, threadsPost,
      videoUrl: reel.videoUrl ?? '', createdAt: new Date().toISOString(),
    })
    await sendWithButtons(
      `📝 *Drafts ready for ${reel.permalink}*\n\n*X:*\n${xPost}\n\n*Threads:*\n${threadsPost}`,
      [[
        { text: '✅ Approve & post both', callback_data: `approve:${reel.id}` },
        { text: '❌ Reject',              callback_data: `reject:${reel.id}` },
      ]],
    ).catch(e => L(`telegram drafts failed: ${e.message}`))
  }

  return { done: true }
}
