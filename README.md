# Automation OS — ManyChat Killer

A self-hosted Instagram automation dashboard built on the [Zernio API](https://zernio.com). Create comment-to-DM automations, build multi-step sequences, and monitor trigger logs — all from a clean dark-mode dashboard.

**Core feature:** Someone comments a keyword on your reel → they instantly receive a DM you wrote.

---

## What it does

- **Comment → DM automations** — pick a reel, set trigger keywords (or fire on any comment), write a DM, optionally reply publicly under their comment
- **Trigger logs** — see exactly who triggered each automation, what they commented, and whether the DM landed
- **Sequence builder** — create multi-step DM drip campaigns with timed delays (1hr, 24hr, 3 days, etc.)
- **Live dashboard** — pause/activate automations with one click, monitor trigger counts and DMs sent

---

## Prerequisites

- Node.js 18+
- A [Zernio](https://zernio.com) account with an API key
- Your Instagram account connected to Zernio (via the Zernio dashboard → Accounts)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Ilyas1434/manychat-killer.git
cd manychat-killer
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to find it |
|---|---|
| `ZERNIO_API_KEY` | [zernio.com/dashboard/api-keys](https://zernio.com/dashboard/api-keys) |
| `ZERNIO_PROFILE_ID` | Run `npm run list` (see below) |
| `ZERNIO_ACCOUNT_ID` | Run `npm run list` (see below) |
| `NEXT_PUBLIC_IG_USERNAME` | Your Instagram handle, e.g. `@yourhandle` |

### 3. Find your profile and account IDs

```bash
npm run list
```

This prints your Zernio profile ID and connected Instagram account ID. Copy both into `.env`.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Creating your first automation

1. Go to **New Automation** (sidebar or green button)
2. **Select Reel** — pick from your recent Instagram reels, shown with thumbnails and comment counts
3. **Set Trigger** — choose keyword mode (e.g. `"LEADS"`, `"link"`) or fire on any comment. Pick Contains vs Exact match
4. **Write Response** — your DM message (up to 1000 chars) and optional public comment reply
5. **Launch** — name it, review the summary, go live

The automation is active immediately. Anyone who comments the keyword gets the DM within seconds.

---

## Monitoring

On the **Automations** page, click **↓ Logs** on any card to expand the trigger log:

- Green dot = DM sent successfully
- Red dot = DM failed
- Shows commenter name, comment text, and date

Click the status dot (●/○) on any row to toggle it live/paused without leaving the page.

---

## Sequences

Go to **Sequences** to build multi-step DM drip campaigns:

1. Name your sequence
2. Write the first message (sends immediately on enrollment)
3. Add steps with delays — 1 hour, 6 hours, 24 hours, 3 days, 7 days
4. Hit **Create Sequence**

> Enrollment from automations is coming — for now, enroll contacts via the Zernio dashboard or CLI.

---

## CLI scripts

Two utility scripts for one-off tasks:

```bash
# List your Zernio profiles and Instagram accounts
npm run list

# Create a single automation from .env config (for quick testing)
npm run create
```

For `npm run create`, fill in these extra vars in `.env`:

```
INSTAGRAM_POST_ID=   # Platform media ID (from the Zernio dashboard or inbox)
AUTOMATION_NAME=     # e.g. "Reel DM Test"
KEYWORDS=            # Comma-separated, or leave blank to trigger on all comments
DM_MESSAGE=          # The DM to send
COMMENT_REPLY=       # Optional public reply
```

---

## Tech stack

- **Next.js 15** (App Router, Turbopack)
- **Tailwind CSS v3**
- **@zernio/node** SDK
- TypeScript throughout

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `ZERNIO_API_KEY` | ✅ | Zernio API key (`sk_...`) |
| `ZERNIO_PROFILE_ID` | ✅ | Your Zernio profile ID |
| `ZERNIO_ACCOUNT_ID` | ✅ | Your connected Instagram account ID |
| `NEXT_PUBLIC_IG_USERNAME` | — | Your Instagram handle for display (e.g. `@yourhandle`) |
| `INSTAGRAM_POST_ID` | — | Only needed for `npm run create` |

> **Never commit `.env`** — it contains your API key. The `.gitignore` already excludes it.
