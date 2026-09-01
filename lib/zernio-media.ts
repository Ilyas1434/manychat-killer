/**
 * Pre-comment reel detection via Zernio — no Meta Graph token required.
 *
 * Zernio's GET /v1/inbox/comments is misleadingly named: it returns the
 * account's FULL recent media list (verified: all 17 items incl. a
 * zero-comment reel), the same data the Zernio dashboard shows immediately
 * after you post. So it detects a native reel BEFORE any comment exists.
 *
 * The media list gives id/caption/permalink but only a thumbnail. Zernio's
 * stored video URLs go stale (403) and Instagram blocks scrapers, so we resolve
 * a FRESH downloadable video URL via Apify (lib/apify.ts) on demand.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ACCOUNT_ID } from '@/lib/zernio'
import { resolveReelVideo } from '@/lib/apify'

export type ReelMedia = {
  id:         string   // Instagram platform post id
  caption:    string
  permalink:  string
  createdTime: string
  videoUrl:   string | null
}

const ZERNIO_BASE = 'https://api.zernio.com'
const authHeader = () => ({ Authorization: `Bearer ${process.env.ZERNIO_API_KEY}` })

/** Newest media item for the account, or null. */
export async function getLatestReel(): Promise<ReelMedia | null> {
  const res = await fetch(
    `${ZERNIO_BASE}/v1/inbox/comments?accountId=${ACCOUNT_ID}&limit=30`,
    { headers: authHeader(), cache: 'no-store' },
  )
  if (!res.ok) throw new Error(`Zernio media list failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const items: any[] = data?.data ?? []
  if (!items.length) return null

  items.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
  const m = items[0]

  return {
    id:          m.id,
    caption:     m.content ?? '',
    permalink:   m.permalink,
    createdTime: m.createdTime,
    // Video URL is resolved separately (and freshly) via resolveVideoUrl, only
    // when the video-dependent steps actually need it — Apify costs per call.
    videoUrl:    null,
  }
}

/** Resolve a FRESH downloadable .mp4 URL for a reel via Apify. Returns the
 *  url plus a (possibly better) caption from the scrape. */
export async function resolveVideoUrl(permalink: string): Promise<{ videoUrl: string | null; caption: string }> {
  try {
    const r = await resolveReelVideo(permalink)
    return { videoUrl: r?.videoUrl ?? null, caption: r?.caption ?? '' }
  } catch (e: any) {
    console.log(`[zernio-media] Apify resolve failed: ${e.message}`)
    return { videoUrl: null, caption: '' }
  }
}

/** Download a media URL into a Buffer (for Whisper / YouTube). */
export async function downloadMedia(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`media download failed ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
