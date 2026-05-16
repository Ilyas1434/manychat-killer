/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getZernio, ACCOUNT_ID } from '@/lib/zernio'
import { getConfigForConversation, isProcessed, markProcessed, getConfigs } from '@/lib/email-collect-store'
import { sendEmail } from '@/lib/email-sender'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/

export async function GET(req: Request) {
  // Allow open access locally; require secret header in production
  if (process.env.NODE_ENV === 'production' && process.env.POLLER_SECRET) {
    const header = req.headers.get('x-poller-secret')
    if (header !== process.env.POLLER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const configs = await getConfigs()
  if (configs.length === 0) return NextResponse.json({ message: 'No email-collect configs.', sent: [] })

  const z       = getZernio()
  const results: { conversationId: string; participantName: string; emailFound: string; dmSent: boolean; emailSent?: boolean; error?: string }[] = []

  // Pull conversations updated in last 72h
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  const conversations: any[] = []
  let cursor: string | undefined

  do {
    const { data }: any = await z.messages.listInboxConversations({
      query: { accountId: ACCOUNT_ID, limit: 50, ...(cursor ? { cursor } : {}) } as any,
    })
    const batch: any[] = data?.data ?? data?.conversations ?? []
    for (const conv of batch) {
      if (conv.updatedTime < cutoff) { cursor = undefined; break }
      conversations.push(conv)
    }
    cursor = data?.pagination?.nextCursor ?? undefined
  } while (cursor && conversations.length < 200)

  for (const conv of conversations) {
    if (await isProcessed(conv.id)) continue

    const { data: msgData }: any = await z.messages.getInboxConversationMessages({
      path:  { conversationId: conv.id },
      query: { accountId: ACCOUNT_ID, limit: 20 } as any,
    })
    const messages: any[] = (msgData?.messages ?? []).sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    if (messages.length === 0) continue

    // Match to the correct per-automation config
    const outgoingTexts = messages.filter((m: any) => m.direction === 'outgoing').map((m: any) => m.message ?? '')
    const matchedConfig = await getConfigForConversation(outgoingTexts)
    if (!matchedConfig) continue

    const askMsg = messages.find((m: any) =>
      m.direction === 'outgoing' &&
      (m.message ?? '').trim().startsWith(matchedConfig.emailAskText.trim().slice(0, 60))
    )
    if (!askMsg) continue

    // Find an incoming message with an email AFTER the ask
    const emailReply = messages.find((m: any) =>
      m.direction === 'incoming' &&
      new Date(m.createdAt) > new Date(askMsg.createdAt) &&
      EMAIL_RE.test(m.message ?? '')
    )
    if (!emailReply) continue

    // Check if we already replied AFTER the email reply (stateless double-send guard)
    const alreadyReplied = messages.some((m: any) =>
      m.direction === 'outgoing' &&
      new Date(m.createdAt) > new Date(emailReply.createdAt)
    )
    if (alreadyReplied) { await markProcessed(conv.id); continue }

    const emailFound = EMAIL_RE.exec(emailReply.message)![0]
    const followUpDM = matchedConfig.followUpDM

    if (!followUpDM) {
      await markProcessed(conv.id)
      results.push({ conversationId: conv.id, participantName: conv.participantName, emailFound, dmSent: false, error: 'No follow-up DM set' })
      continue
    }

    try {
      // 1. Send follow-up DM via Instagram
      await z.messages.sendInboxMessage({
        path: { conversationId: conv.id } as any,
        body: { accountId: ACCOUNT_ID, message: followUpDM },
      })

      // 2. Send email via Brevo (fires & forgets — DM already sent even if email fails)
      let emailSent = false
      try {
        await sendEmail({
          to:      emailFound,
          subject: matchedConfig.emailSubject || "Here's what you asked for!",
          body:    followUpDM,
        })
        emailSent = true
      } catch (emailErr: any) {
        console.error('[poller] Email send failed:', emailErr.message)
      }

      await markProcessed(conv.id)
      results.push({ conversationId: conv.id, participantName: conv.participantName, emailFound, dmSent: true, emailSent })
    } catch (err: any) {
      results.push({ conversationId: conv.id, participantName: conv.participantName, emailFound, dmSent: false, error: err.message })
    }
  }

  return NextResponse.json({
    checkedConversations: conversations.length,
    sent: results.filter(r => r.dmSent).length,
    results,
  })
}
