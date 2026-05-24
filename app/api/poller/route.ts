/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getZernio, ACCOUNT_ID } from '@/lib/zernio'
import { getConfigForConversation, isProcessed, markProcessed, getConfigs } from '@/lib/email-collect-store'
import { sendEmail } from '@/lib/email-sender'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
const messageText = (m: any) => m.message ?? m.text ?? ''
const isFollower = (value: any): boolean => {
  if (!value) return false
  if (value.instagramProfile?.isFollower === true) return true
  if (value.participant?.instagramProfile?.isFollower === true) return true
  if (value.sender?.instagramProfile?.isFollower === true) return true
  if (Array.isArray(value.participants)) {
    return value.participants.some((p: any) => p?.instagramProfile?.isFollower === true)
  }
  return false
}

export async function GET(req: Request) {
  // Allow open access locally; require secret header in production
  if (process.env.NODE_ENV === 'production' && process.env.POLLER_SECRET) {
    const header = req.headers.get('x-poller-secret')
    if (header !== process.env.POLLER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const configs = await getConfigs()
  if (configs.length === 0) return NextResponse.json({ message: 'No follow-up configs.', sent: [] })

  const z       = getZernio()
  const results: {
    conversationId: string
    participantName: string
    replyFound?: string
    emailFound?: string
    follower?: boolean
    dmSent: boolean
    emailSent?: boolean
    error?: string
  }[] = []

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
      query: { accountId: ACCOUNT_ID, limit: 50, sortOrder: 'desc' } as any,
    })
    const messages: any[] = (msgData?.messages ?? []).sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    if (messages.length === 0) continue

    // Match to the correct per-automation config
    const outgoingTexts = messages.filter((m: any) => m.direction === 'outgoing').map(messageText)
    const matchedConfig = await getConfigForConversation(outgoingTexts)
    if (!matchedConfig) continue

    const askMsg = messages.find((m: any) =>
      m.direction === 'outgoing' &&
      messageText(m).trim().startsWith(matchedConfig.emailAskText.trim().slice(0, 60))
    )
    if (!askMsg) continue

    const trigger = matchedConfig.replyTrigger ?? 'email'

    // Find an incoming reply AFTER the ask. Legacy email configs still require an email.
    const qualifyingReply = messages.find((m: any) =>
      m.direction === 'incoming' &&
      new Date(m.createdAt) > new Date(askMsg.createdAt) &&
      (trigger === 'follow' || EMAIL_RE.test(messageText(m)))
    )
    if (!qualifyingReply) continue

    const follower = isFollower(conv) || isFollower(qualifyingReply)
    if (trigger === 'follow' && !follower) continue

    // Check if we already replied AFTER the qualifying reply (stateless double-send guard)
    const alreadyReplied = messages.some((m: any) =>
      m.direction === 'outgoing' &&
      new Date(m.createdAt) > new Date(qualifyingReply.createdAt)
    )
    if (alreadyReplied) { await markProcessed(conv.id); continue }

    const replyFound = messageText(qualifyingReply)
    const emailFound = trigger === 'email' ? EMAIL_RE.exec(replyFound)?.[0] : undefined
    const followUpDM = matchedConfig.followUpDM

    if (!followUpDM) {
      await markProcessed(conv.id)
      results.push({ conversationId: conv.id, participantName: conv.participantName, replyFound, emailFound, follower, dmSent: false, error: 'No follow-up DM set' })
      continue
    }

    try {
      // 1. Send follow-up DM via Instagram.
      await z.messages.sendInboxMessage({
        path: { conversationId: conv.id } as any,
        body: { accountId: ACCOUNT_ID, message: followUpDM },
      })

      // 2. Legacy email configs also send the content by email.
      let emailSent = false
      if (emailFound) {
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
      }

      await markProcessed(conv.id)
      results.push({ conversationId: conv.id, participantName: conv.participantName, replyFound, emailFound, follower, dmSent: true, emailSent })
    } catch (err: any) {
      results.push({ conversationId: conv.id, participantName: conv.participantName, replyFound, emailFound, follower, dmSent: false, error: err.message })
    }
  }

  return NextResponse.json({
    checkedConversations: conversations.length,
    sent: results.filter(r => r.dmSent).length,
    results,
  })
}
