# ManyChat Killer

A self-hosted Instagram automation dashboard built on the [Zernio API](https://zernio.com).

Someone comments a keyword on your reel, they get a DM. Optionally: collect their email and send a follow-up, and auto-cross-post every new reel to LinkedIn, YouTube, X, and Threads.

Next.js 15 · TypeScript · Tailwind · deploys to Vercel.

---

## Features

**Comment → DM automations.** Pick a reel, set trigger keywords (or fire on any comment), write the DM. Optionally reply publicly under the comment too.

**Trigger logs.** See who triggered each automation, what they commented, and whether the DM was delivered. Pause or activate any automation from the dashboard.

**Sequences.** Multi-step DM drip campaigns with delays (1 hour through 7 days).

**Email collection** *(optional)*. The DM asks for an email address. A poller watches replies, extracts the address, sends a templated email via Brevo, and sends a follow-up DM.

**Reel pipeline** *(optional)*. A cron detects reels you posted natively in the Instagram app and cross-posts them. See [Reel pipeline](#reel-pipeline) below.

---

## Requirements

- Node.js 18+
- A [Zernio](https://zernio.com) account with an API key
- Your Instagram account connected in the Zernio dashboard

---

## Setup

```bash
git clone https://github.com/Ilyas1434/manychat-killer.git
cd manychat-killer
npm install
cp .env.example .env
```

Fill in four variables in `.env`:

| Variable | Where to get it |
|---|---|
| `ZERNIO_API_KEY` | [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys) |
| `ZERNIO_PROFILE_ID` | `npm run list` |
| `ZERNIO_ACCOUNT_ID` | `npm run list` |
| `NEXT_PUBLIC_IG_USERNAME` | Your handle, e.g. `@yourhandle` |

Then:

```bash
npm run list   # prints your profile and Instagram account IDs
npm run dev
```

Open http://localhost:3000.

Everything else in `.env.example` is optional and only needed for the email-collection and reel-pipeline features.

---

## Creating an automation

1. **New Automation** in the sidebar
2. **Select Reel** — pick from your recent reels
3. **Set Trigger** — keywords (contains or exact match), or any comment
4. **Write Response** — the DM (max 1000 chars), plus an optional public reply
5. **Launch**

It goes live immediately. On the Automations page, **↓ Logs** expands the trigger history and the status dot toggles live/paused.

---

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve the production build
npm run list     # print Zernio profiles and connected accounts
npm run create   # create one automation from .env values
npm run oauth    # one-time OAuth setup: `npm run oauth youtube` | `npm run oauth x`
```

---

## Deploying

Deploy to Vercel and add the same variables from `.env` as project environment variables.

Add **Vercel KV** for persistent state. Without it the app still runs but forgets the last-seen reel, pending drafts, and the rotated X refresh token whenever a function cold-starts. If you'd rather not use KV, `CONFIG_GIST_ID` + `GITHUB_GIST_TOKEN` persist the email-collect configs in a GitHub Gist instead.

Set `CRON_SECRET` and `POLLER_SECRET` in production. The cron endpoints check them and are open without them.

---

## Email collection

Configure per automation on the **Settings** page: the message that asks for an email, the email subject and body, and the follow-up DM.

`GET /api/poller` scans recent DM replies for email addresses, sends the email through Brevo, then sends the follow-up DM. Run it on a schedule — the included [GitHub Actions workflow](.github/workflows/poller.yml) pings it every 5 minutes and needs two repository secrets, `DASHBOARD_URL` and `POLLER_SECRET`.

Requires `BREVO_API_KEY` and `BREVO_FROM_EMAIL`.

Seed configs live in `data/email-collect.json` and are bundled at build time, so anything defined there overrides the runtime KV/Gist copy for the same automation ID.

---

## Reel pipeline

Zernio only fires `post.published` for posts made *through* Zernio, so posting natively in the Instagram app produces no webhook. Instead, a cron hits `GET /api/reel-watcher` every minute and compares the newest reel in Zernio's media list against the last id stored in KV. The first run only records a baseline, so it won't fire on an old reel.

When a new reel appears:

1. **Telegram ping** with a link to set up a comment-to-DM automation for it
2. **LinkedIn** re-publish via Zernio
3. **YouTube** upload as a Short via the YouTube Data API
4. **Transcribe** the audio with Whisper and generate X and Threads drafts
5. **Telegram approval buttons** — approve to post the drafts to X (native API) and Threads (via Zernio)

Zernio exposes a downloadable video URL only after its analytics sync catches up, so steps 2–4 are queued and retried each tick for up to ~30 minutes. Apify resolves a fresh video URL because Instagram CDN URLs expire.

### One-time setup

**Telegram** — message [@BotFather](https://t.me/BotFather), send `/newbot`, copy the token into `TELEGRAM_BOT_TOKEN`. DM your bot anything, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your numeric chat id for `TELEGRAM_CHAT_ID`. After deploying, register the webhook once:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=$PUBLIC_BASE_URL/api/telegram"
```

**Apify** — sign up at [apify.com](https://apify.com) (free tier is enough) and copy your token into `APIFY_TOKEN`.

**OpenAI** — a key from [platform.openai.com](https://platform.openai.com) covers both Whisper transcription and draft generation.

**YouTube** — in [Google Cloud Console](https://console.cloud.google.com), create a project, enable **YouTube Data API v3**, and create an OAuth client with redirect URI `http://localhost:5599/callback`. Put the client id and secret in `.env`, then run `npm run oauth youtube` and paste the printed refresh token into `YOUTUBE_REFRESH_TOKEN`.

**X** — at [developer.x.com](https://developer.x.com), create a free-tier app with OAuth 2.0 and scopes `tweet.read tweet.write users.read offline.access`, redirect URI `http://localhost:5599/callback`. Put the client id and secret in `.env`, then run `npm run oauth x` and paste the printed refresh token into `X_REFRESH_TOKEN`.

**LinkedIn and Threads** — connect both accounts in the Zernio dashboard, then run `npm run list` and copy the IDs into `ZERNIO_LINKEDIN_ACCOUNT_ID` and `ZERNIO_THREADS_ACCOUNT_ID`. No separate tokens.

### Notes

A 1-minute cron requires Vercel Pro; Hobby plans run crons at most once a day. Either upgrade, or point an external scheduler at `GET /api/reel-watcher?secret=$CRON_SECRET`.

Testing locally, with no `CRON_SECRET` set:

```bash
curl localhost:3000/api/reel-watcher   # first call records the baseline
# post a reel, then:
curl localhost:3000/api/reel-watcher   # runs the pipeline
```

There is no comment-to-DM on YouTube — no provider offers it, because YouTube has no DM API.

---

## Environment variables

Every variable is documented inline in [`.env.example`](.env.example). Only these four are required:

`ZERNIO_API_KEY` · `ZERNIO_PROFILE_ID` · `ZERNIO_ACCOUNT_ID` · `NEXT_PUBLIC_IG_USERNAME`

`.env` is gitignored. Don't commit it.

---

## License

MIT. See [LICENSE](LICENSE).
