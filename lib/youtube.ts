/**
 * Native YouTube upload via the YouTube Data API v3.
 *
 * Uploads the reel as a Short (vertical video <= 3 min with #Shorts in the
 * description gets treated as a Short by YouTube). Auth is OAuth 2.0 with a
 * permanent refresh token obtained once via `node scripts/oauth-setup.js
 * youtube`. The refresh token does NOT rotate (unlike X), so it lives in env.
 *
 * Uses the resumable upload protocol so large videos stream reliably.
 */

const TOKEN_URL  = 'https://oauth2.googleapis.com/token'
const UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.YOUTUBE_CLIENT_ID
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN not set (run scripts/oauth-setup.js youtube)')
  }

  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`YouTube token refresh failed ${res.status}: ${await res.text()}`)
  return (await res.json()).access_token
}

export async function uploadShort(opts: {
  video:       Buffer
  title:       string
  description: string
  privacyStatus?: 'public' | 'unlisted' | 'private'
}): Promise<{ videoId: string; url: string }> {
  const accessToken = await getAccessToken()

  const metadata = {
    snippet: {
      // YouTube titles cap at 100 chars.
      title:       opts.title.slice(0, 100),
      description: `${opts.description}\n\n#Shorts`,
    },
    status: { privacyStatus: opts.privacyStatus ?? 'public' },
  }

  // 1. Initiate resumable session — returns an upload URL in the Location header.
  const initRes = await fetch(UPLOAD_URL, {
    method:  'POST',
    headers: {
      Authorization:            `Bearer ${accessToken}`,
      'Content-Type':           'application/json',
      'X-Upload-Content-Type':  'video/mp4',
      'X-Upload-Content-Length': String(opts.video.length),
    },
    body: JSON.stringify(metadata),
  })
  if (!initRes.ok) throw new Error(`YouTube init failed ${initRes.status}: ${await initRes.text()}`)
  const sessionUrl = initRes.headers.get('location')
  if (!sessionUrl) throw new Error('YouTube did not return a resumable upload URL')

  // 2. Upload the bytes in a single PUT (sufficient for short reels).
  const uploadRes = await fetch(sessionUrl, {
    method:  'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(opts.video.length) },
    body:    new Uint8Array(opts.video),
  })
  if (!uploadRes.ok) throw new Error(`YouTube upload failed ${uploadRes.status}: ${await uploadRes.text()}`)
  const data = await uploadRes.json()
  return { videoId: data.id, url: `https://youtube.com/shorts/${data.id}` }
}
