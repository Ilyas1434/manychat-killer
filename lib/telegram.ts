/**
 * Minimal Telegram Bot API wrapper.
 *
 * Used to (a) ping you when a new reel is detected, and (b) send the
 * generated X/Threads drafts with inline Approve / Reject buttons.
 * Button taps come back as `callback_query` updates to /api/telegram.
 */

const TOKEN   = () => process.env.TELEGRAM_BOT_TOKEN!
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID!
const api = (method: string) => `https://api.telegram.org/bot${TOKEN()}/${method}`

type InlineButton = { text: string; callback_data: string }

async function call(method: string, body: Record<string, unknown>) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN / CHAT_ID not set — skipping')
    return { skipped: true }
  }
  const res = await fetch(api(method), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: CHAT_ID(), ...body }),
  })
  const data = await res.json()
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`)
  return data.result
}

/** Plain message. Markdown by default. */
export function sendMessage(text: string, opts: { disablePreview?: boolean } = {}) {
  return call('sendMessage', {
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: opts.disablePreview ?? false,
  })
}

/**
 * Message with inline buttons. `buttons` is an array of rows; each row is an
 * array of { text, callback_data }. callback_data is what /api/telegram receives.
 */
export function sendWithButtons(text: string, buttons: InlineButton[][]) {
  return call('sendMessage', {
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: buttons },
  })
}

/** Acknowledge a button tap so Telegram stops the loading spinner. */
export async function answerCallback(callbackQueryId: string, text?: string) {
  const res = await fetch(api('answerCallbackQuery'), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
  })
  return res.json()
}

/** Edit a message's text (e.g. replace draft+buttons with "✅ Posted"). */
export function editMessageText(messageId: number, text: string) {
  return call('editMessageText', { message_id: messageId, text, parse_mode: 'Markdown' })
}
