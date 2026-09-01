/**
 * Resolve a FRESH, downloadable reel video URL via Apify.
 *
 * Zernio's stored video URLs go stale (confirmed 403s), and Instagram serves a
 * login wall to scrapers — so neither is reliable for downloading the bytes we
 * need for Whisper transcription and the YouTube upload. The Apify
 * `instagram-reel-scraper` actor takes a reel URL and returns a fresh `videoUrl`
 * (+ caption), which we can download immediately.
 *
 * Needs APIFY_TOKEN. Run-sync endpoint blocks until the actor finishes (a few
 * seconds for one reel).
 */

const ACTOR = 'apify~instagram-reel-scraper'
const RUN_SYNC = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`

export type ApifyReel = { videoUrl: string | null; caption: string }

export async function resolveReelVideo(reelUrl: string): Promise<ApifyReel | null> {
  const token = process.env.APIFY_TOKEN
  if (!token) throw new Error('APIFY_TOKEN not set')

  const res = await fetch(`${RUN_SYNC}?token=${token}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username: [reelUrl], resultsLimit: 1 }),
  })
  if (!res.ok) throw new Error(`Apify run failed ${res.status}: ${await res.text()}`)

  const items = await res.json()
  const item = Array.isArray(items) ? items[0] : null
  if (!item) return null
  return {
    videoUrl: item.videoUrl ?? item.video_url ?? null,
    caption:  item.caption ?? '',
  }
}
