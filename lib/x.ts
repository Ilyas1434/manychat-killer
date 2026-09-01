/**
 * Native X (Twitter) posting via the v2 API, free tier.
 *
 * Auth is OAuth 2.0 user-context with PKCE. You obtain the initial refresh
 * token once via `node scripts/oauth-setup.js x`. X ROTATES the refresh token
 * on every refresh, so we persist the new one to KV (pipeline-store) and fall
 * back to the X_REFRESH_TOKEN env value on a cold store.
 *
 * Free tier allows 500 posts/month via POST /2/tweets — plenty here, $0.
 */
import { getStoredXRefreshToken, setStoredXRefreshToken } from '@/lib/pipeline-store'

const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
const TWEET_URL = 'https://api.twitter.com/2/tweets'

async function getAccessToken(): Promise<string> {
  const clientId     = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('X_CLIENT_ID / X_CLIENT_SECRET not set')

  // Prefer the rotated token from KV; fall back to the env seed.
  const refreshToken = (await getStoredXRefreshToken()) ?? process.env.X_REFRESH_TOKEN
  if (!refreshToken) throw new Error('No X refresh token (run scripts/oauth-setup.js x)')

  // Confidential client → HTTP Basic auth with client_id:client_secret.
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`X token refresh failed ${res.status}: ${await res.text()}`)
  const data = await res.json()

  // X returns a NEW refresh token each time — persist it or the next run breaks.
  if (data.refresh_token) await setStoredXRefreshToken(data.refresh_token)
  return data.access_token
}

/** Post a text tweet. Returns the new tweet id. */
export async function postToX(text: string): Promise<{ id: string }> {
  const accessToken = await getAccessToken()
  const res = await fetch(TWEET_URL, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) throw new Error(`X post failed ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { id: data.data?.id }
}
