/**
 * One-time OAuth helper to obtain refresh tokens for native X and YouTube.
 *
 *   node scripts/oauth-setup.js youtube
 *   node scripts/oauth-setup.js x
 *
 * It spins up a tiny localhost server, opens the consent URL, catches the
 * redirect, exchanges the code, and prints the refresh token to paste into
 * your .env (X_REFRESH_TOKEN or YOUTUBE_REFRESH_TOKEN).
 *
 * Prereqs (see README "Reel pipeline" section):
 *   YouTube: YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET in .env, and
 *            http://localhost:5599/callback added as an authorized redirect URI
 *            in the Google Cloud OAuth client.
 *   X:       X_CLIENT_ID / X_CLIENT_SECRET in .env, and
 *            http://localhost:5599/callback added as a redirect URI in the X app,
 *            with tweet.read tweet.write users.read offline.access scopes enabled.
 */
import 'dotenv/config'
import http from 'node:http'
import crypto from 'node:crypto'
import { exec } from 'node:child_process'

const PORT = 5599
const REDIRECT = `http://localhost:${PORT}/callback`
const provider = process.argv[2]

if (!['youtube', 'x'].includes(provider)) {
  console.error('Usage: node scripts/oauth-setup.js <youtube|x>')
  process.exit(1)
}

const open = (url) => {
  const cmd = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32'  ? 'start ""'
            : 'xdg-open'
  exec(`${cmd} "${url}"`)
}

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const cfg = provider === 'youtube'
  ? {
      clientId:     process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      authUrl:      'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl:     'https://oauth2.googleapis.com/token',
      scope:        'https://www.googleapis.com/auth/youtube.upload',
      extraAuth:    { access_type: 'offline', prompt: 'consent' },
      envVar:       'YOUTUBE_REFRESH_TOKEN',
      pkce:         false,
    }
  : {
      clientId:     process.env.X_CLIENT_ID,
      clientSecret: process.env.X_CLIENT_SECRET,
      authUrl:      'https://twitter.com/i/oauth2/authorize',
      tokenUrl:     'https://api.twitter.com/2/oauth2/token',
      scope:        'tweet.read tweet.write users.read offline.access',
      extraAuth:    {},
      envVar:       'X_REFRESH_TOKEN',
      pkce:         true,
    }

if (!cfg.clientId || !cfg.clientSecret) {
  console.error(`Missing ${provider === 'youtube' ? 'YOUTUBE' : 'X'}_CLIENT_ID / _SECRET in .env`)
  process.exit(1)
}

const state = b64url(crypto.randomBytes(16))
// PKCE (X requires it)
const verifier  = b64url(crypto.randomBytes(32))
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())

const authParams = new URLSearchParams({
  response_type: 'code',
  client_id:     cfg.clientId,
  redirect_uri:  REDIRECT,
  scope:         cfg.scope,
  state,
  ...cfg.extraAuth,
  ...(cfg.pkce ? { code_challenge: challenge, code_challenge_method: 'S256' } : {}),
})

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (!url.pathname.startsWith('/callback')) { res.writeHead(404); res.end(); return }

  const code = url.searchParams.get('code')
  if (url.searchParams.get('state') !== state || !code) {
    res.writeHead(400); res.end('State mismatch or missing code.'); return
  }

  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: REDIRECT,
    client_id:    cfg.clientId,
    ...(cfg.pkce ? { code_verifier: verifier } : { client_secret: cfg.clientSecret }),
  })

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  // X confidential client uses HTTP Basic auth for the token exchange.
  if (cfg.pkce) {
    headers.Authorization = 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  }

  const tokenRes = await fetch(cfg.tokenUrl, { method: 'POST', headers, body })
  const data = await tokenRes.json()

  if (!tokenRes.ok || !data.refresh_token) {
    res.writeHead(500); res.end('Token exchange failed: ' + JSON.stringify(data))
    console.error('\n❌ Token exchange failed:', data)
    server.close(); return
  }

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end('<h2>✅ Success — you can close this tab and return to the terminal.</h2>')

  console.log(`\n✅ Got refresh token for ${provider}. Add this to your .env:\n`)
  console.log(`${cfg.envVar}=${data.refresh_token}\n`)
  server.close()
})

server.listen(PORT, () => {
  const authUrl = `${cfg.authUrl}?${authParams}`
  console.log(`\nOpening browser for ${provider} consent…`)
  console.log(`If it doesn't open, visit:\n${authUrl}\n`)
  open(authUrl)
})
