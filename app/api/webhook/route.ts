/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getZernio, ACCOUNT_ID } from '@/lib/zernio'
import { getConfigForConversation, getConfigs, isProcessed, markProcessed } from '@/lib/email-collect-store'
import { sendEmail } from '@/lib/email-sender'

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/
const L = (msg: string) => console.log(`[webhook] ${msg}`)
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

export async function POST(req: Request) {
  const payload = await req.json()

  L(`FULL PAYLOAD: ${JSON.stringify(payload)}`)
  L(`event=${payload.event} direction=${payload.message?.direction}`)

  if (payload.event !== 'message.received') return NextResponse.json({ ok: true })
  if (payload.message?.direction !== 'incoming') return NextResponse.json({ ok: true })

  const text           = payload.message?.text ?? ''
  // Zernio webhook sends an internal conversationId — the inbox API uses platformConversationId
  const conversationId = payload.conversation?.platformConversationId ?? payload.message?.conversationId
  const senderName     = payload.message?.sender?.name ?? 'unknown'

  L(`convId=${conversationId} text="${text.slice(0,40)}"`)

  if (!conversationId || !text) return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'no-conv-or-text', rawPayload: payload })

  const emailMatch = EMAIL_RE.exec(text)
  if (emailMatch) L(`email found: ${emailMatch[0]}`)

  if (await isProcessed(conversationId)) return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'already-processed' })

  const configs = await getConfigs()
  L(`configs loaded: ${configs.length}`)
  if (configs.length === 0) return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'no-configs' })

  const z = getZernio()
  const { data: msgData }: any = await z.messages.getInboxConversationMessages({
    path:  { conversationId },
    query: { accountId: ACCOUNT_ID, limit: 50, sortOrder: 'desc' } as any,
  })
  const messages: any[] = (msgData?.messages ?? []).sort(
    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  L(`messages fetched: ${messages.length}`)

  const outgoingTexts = messages
    .filter((m: any) => m.direction === 'outgoing')
    .map(messageText)
  L(`outgoing msgs: ${outgoingTexts.length} | first60: "${outgoingTexts[0]?.slice(0,60)}"`)

  const matchedConfig = await getConfigForConversation(outgoingTexts)
  L(`matchedConfig: ${matchedConfig ? matchedConfig.automationId : 'NONE'}`)
  if (!matchedConfig?.followUpDM) return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'no-matched-config' })
  const trigger = matchedConfig.replyTrigger ?? 'email'

  if (trigger === 'email' && !emailMatch) {
    return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'no-email-in-text' })
  }

  const follower = isFollower(payload.message) || isFollower(payload.conversation)
  if (trigger === 'follow' && !follower) {
    return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'not-a-follower' })
  }

  const askMsg = messages.find((m: any) =>
    m.direction === 'outgoing' &&
    messageText(m).trim().startsWith(matchedConfig.emailAskText.trim().slice(0, 60))
  )
  L(`askMsg found: ${!!askMsg}`)
  if (!askMsg) return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'no-ask-msg' })

  const incomingTime = new Date(payload.message?.sentAt ?? payload.message?.createdAt ?? Date.now())
  L(`incomingTime: ${incomingTime.toISOString()}`)
  const alreadyReplied = messages.some((m: any) =>
    m.direction === 'outgoing' &&
    new Date(m.createdAt ?? m.sentAt) > incomingTime &&
    messageText(m).trim() === matchedConfig.followUpDM.trim()
  )
  L(`alreadyReplied: ${alreadyReplied}`)
  if (alreadyReplied) {
    await markProcessed(conversationId)
    return NextResponse.json({ ok: true, rawMsg: payload.message, bail: 'already-replied' })
  }

  L(`firing DM to convId=${conversationId}`)
  const emailFound = emailMatch?.[0]
  const [dmResult, emailResult] = await Promise.allSettled([
    z.messages.sendInboxMessage({
      path: { conversationId } as any,
      body: { accountId: ACCOUNT_ID, message: matchedConfig.followUpDM },
    }),
    emailFound
      ? sendEmail({
          to:      emailFound,
          subject: matchedConfig.emailSubject || "Here's what you asked for!",
          body:    matchedConfig.followUpDM,
        })
      : Promise.resolve(null),
  ])

  await markProcessed(conversationId)
  L(`done — DM: ${dmResult.status}${dmResult.status==='rejected'?' ERR:'+( dmResult as any).reason?.message:''} | email: ${emailResult.status}`)

  return NextResponse.json({
    ok: true, emailFound, follower, senderName,
    dmSent:    dmResult.status === 'fulfilled',
    emailSent: Boolean(emailFound) && emailResult.status === 'fulfilled',
    dmError:   dmResult.status === 'rejected' ? (dmResult as any).reason?.message : undefined,
  })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
