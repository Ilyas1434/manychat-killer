/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getZernio, ACCOUNT_ID } from '@/lib/zernio'
import { getConfigForConversation, getConfigs, isProcessed, markProcessed } from '@/lib/email-collect-store'
import { sendEmail } from '@/lib/email-sender'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/

export async function POST(req: Request) {
  const payload = await req.json()

  // Only care about incoming DMs
  if (payload.event !== 'message.received') return NextResponse.json({ ok: true })
  if (payload.message?.direction !== 'incoming') return NextResponse.json({ ok: true })

  const text           = payload.message?.text ?? ''
  const conversationId = payload.message?.conversationId
  const senderName     = payload.message?.sender?.name ?? 'unknown'

  if (!conversationId || !text) return NextResponse.json({ ok: true })

  // Check if message contains an email address
  const emailMatch = EMAIL_RE.exec(text)
  if (!emailMatch) return NextResponse.json({ ok: true })
  const emailFound = emailMatch[0]

  // Don't double-send
  if (await isProcessed(conversationId)) return NextResponse.json({ ok: true, skipped: 'already_processed' })

  // Load email-collect configs
  const configs = await getConfigs()
  if (configs.length === 0) return NextResponse.json({ ok: true })

  // Fetch conversation messages to find which email-ask was sent
  const z = getZernio()
  const { data: msgData }: any = await z.messages.getInboxConversationMessages({
    path:  { conversationId },
    query: { accountId: ACCOUNT_ID, limit: 20 } as any,
  })
  const messages: any[] = (msgData?.messages ?? []).sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Match to the correct per-automation config
  const outgoingTexts = messages
    .filter((m: any) => m.direction === 'outgoing')
    .map((m: any) => m.message ?? '')
  const matchedConfig = await getConfigForConversation(outgoingTexts)
  if (!matchedConfig?.followUpDM) return NextResponse.json({ ok: true })

  // Make sure our email-ask came before their email reply
  const askMsg = messages.find((m: any) =>
    m.direction === 'outgoing' &&
    (m.message ?? '').trim().startsWith(matchedConfig.emailAskText.trim().slice(0, 60))
  )
  if (!askMsg) return NextResponse.json({ ok: true })

  // Guard: don't send if we already sent this exact follow-up DM
  const alreadyReplied = messages.some((m: any) =>
    m.direction === 'outgoing' &&
    (m.message ?? '').trim() === matchedConfig.followUpDM.trim()
  )
  if (alreadyReplied) {
    await markProcessed(conversationId)
    return NextResponse.json({ ok: true, skipped: 'already_replied' })
  }

  // Fire DM + email simultaneously
  const [dmResult, emailResult] = await Promise.allSettled([
    z.messages.sendInboxMessage({
      path: { conversationId } as any,
      body: { accountId: ACCOUNT_ID, message: matchedConfig.followUpDM },
    }),
    sendEmail({
      to:      emailFound,
      subject: matchedConfig.emailSubject || "Here's what you asked for!",
      body:    matchedConfig.followUpDM,
    }),
  ])

  await markProcessed(conversationId)

  console.log(`[webhook] ${senderName} replied with ${emailFound} — DM: ${dmResult.status}, email: ${emailResult.status}`)

  return NextResponse.json({
    ok:         true,
    emailFound,
    senderName,
    dmSent:     dmResult.status === 'fulfilled',
    emailSent:  emailResult.status === 'fulfilled',
  })
}

// Zernio sends a GET to verify the endpoint on registration
export async function GET() {
  return NextResponse.json({ ok: true })
}
