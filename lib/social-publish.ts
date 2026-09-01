/**
 * LinkedIn re-publish via Zernio.
 *
 * LinkedIn is NOT pay-per-call on Zernio (unlike X), so we keep it on Zernio
 * rather than building a native LinkedIn OAuth app. The reel's video URL is
 * handed to Zernio, which downloads and posts it natively to LinkedIn.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getZernio } from '@/lib/zernio'

export async function publishToLinkedIn(opts: { videoUrl: string; caption: string }) {
  const accountId = process.env.ZERNIO_LINKEDIN_ACCOUNT_ID
  if (!accountId) throw new Error('ZERNIO_LINKEDIN_ACCOUNT_ID not set')

  const z = getZernio()
  const { post }: any = await (z as any).posts.createPost({
    content:    opts.caption,
    mediaItems: [{ type: 'video', url: opts.videoUrl }],
    platforms:  [{ platform: 'linkedin', accountId }],
    publishNow: true,
  })
  return { postId: post?._id }
}

/**
 * Threads via Zernio (text-only). The user connected Threads to Zernio, and
 * Threads is not pay-per-call there (unlike X), so we route it through Zernio
 * rather than building a native Threads app.
 */
export async function publishToThreads(text: string) {
  const accountId = process.env.ZERNIO_THREADS_ACCOUNT_ID
  if (!accountId) throw new Error('ZERNIO_THREADS_ACCOUNT_ID not set')

  const z = getZernio()
  const { post }: any = await (z as any).posts.createPost({
    content:    text,
    platforms:  [{ platform: 'threads', accountId }],
    publishNow: true,
  })
  return { postId: post?._id }
}
