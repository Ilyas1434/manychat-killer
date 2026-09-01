/**
 * Persistent state for the reel pipeline.
 *
 * Uses Vercel KV when configured (KV_REST_API_URL present), else falls back
 * to a best-effort in-memory store. In-memory survives within a warm
 * serverless instance but not across cold starts — fine for local dev,
 * recommended to set up KV for production so the "last seen reel" and
 * "pending drafts" survive deploys.
 */

export type PendingDraft = {
  reelId:      string
  permalink:   string
  xPost:       string
  threadsPost: string
  videoUrl:    string
  createdAt:   string
}

const useKv = () => Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

/* ── in-memory fallback ─────────────────────────────────────── */
const mem = new Map<string, unknown>()

async function kv() {
  const { kv } = await import('@vercel/kv')
  return kv
}

async function get<T>(key: string): Promise<T | null> {
  if (useKv()) return (await (await kv()).get<T>(key)) ?? null
  return (mem.get(key) as T) ?? null
}
async function set(key: string, value: unknown): Promise<void> {
  if (useKv()) { await (await kv()).set(key, value); return }
  mem.set(key, value)
}
async function del(key: string): Promise<void> {
  if (useKv()) { await (await kv()).del(key); return }
  mem.delete(key)
}

/* ── last-seen reel (idempotency for the cron) ─────────────── */
const LAST_SEEN = 'reel:last-seen-id'
export const getLastSeenReelId = () => get<string>(LAST_SEEN)
export const setLastSeenReelId = (id: string) => set(LAST_SEEN, id)

/* ── pending X/Threads drafts awaiting Telegram approval ───── */
const draftKey = (reelId: string) => `reel:draft:${reelId}`
export const savePendingDraft  = (d: PendingDraft) => set(draftKey(d.reelId), d)
export const getPendingDraft   = (reelId: string)  => get<PendingDraft>(draftKey(reelId))
export const clearPendingDraft = (reelId: string)  => del(draftKey(reelId))

/* ── reels awaiting their video URL (Zernio analytics sync lag) ─
 * Instant steps (Telegram ping, Threads/X-less detection) run once on
 * detection; video-dependent steps (Whisper transcript → drafts, YouTube,
 * LinkedIn) retry across cron ticks until the video resolves or we give up. */
export type PendingVideo = { reelId: string; permalink: string; caption: string; attempts: number }
const VIDEO_PENDING = 'reel:video-pending'
export const getPendingVideos = () => get<PendingVideo[]>(VIDEO_PENDING).then(v => v ?? [])
export const setPendingVideos = (v: PendingVideo[]) => set(VIDEO_PENDING, v)

/* ── rotating X refresh token (X rotates it on every refresh) ─ */
const X_REFRESH = 'x-refresh-token'
export const getStoredXRefreshToken = () => get<string>(X_REFRESH)
export const setStoredXRefreshToken = (t: string) => set(X_REFRESH, t)

export const storeMode = () => (useKv() ? 'kv' : 'memory')
