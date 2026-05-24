/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getZernio, ACCOUNT_ID, PROFILE_ID } from '@/lib/zernio'
import { getConfigById, getConfigForConversation, getConfigs, isProcessed, markProcessed } from '@/lib/email-collect-store'
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

/**
 * Resolve which Comment Automation most recently triggered for a given
 * Instagram user (commenterId). This is the canonical "which flow is this
 * person in" answer — comes from Zernio's own logs, not from inspecting
 * conversation text. Falls back to null if nothing found.
 */
async function findActiveAutomationId(z: any, commenterId: string): Promise<string | null> {
  const { data }: any = await z.commentautomations.listCommentAutomations({
    query: { profileId: PROFILE_ID } as any,
  })
  const automations: any[] = data?.automations ?? []
  if (!automations.length) return null

  const logHits = await Promise.all(automations.map(async (a) => {
    try {
      const res: any = await z.commentautomations.listCommentAutomationLogs({
        path:  { automationId: a.id },
        query: { limit: 50 } as any,
      })
      const logs: any[] = res.data?.logs ?? []
      const mine = logs.filter(l => l.commenterId === commenterId)
      if (!mine.length) return null
      const newest = mine.reduce((acc, l) =>
        new Date(l.createdAt) > new Date(acc.createdAt) ? l : acc)
      return { automationId: a.id, createdAt: newest.createdAt as string }
    } catch { return null }
  }))

  const valid = logHits.filter((x): x is { automationId: string; createdAt: string } => !!x)
  if (!valid.length) return null
  valid.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return valid[0].automationId
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
  // Sender's Instagram user ID — same value as `commenterId` on comment-automation logs.
  const senderIgId     = payload.message?.sender?.id
                      ?? payload.conversation?.participantId
                      ?? payload.conversation?.participant?.id
                      ?? null

  L(`convId=${conversationId} sender=${senderIgId} text="${text.slice(0,40)}"`)

  if (!conversationId || !text) return NextResponse.json({ ok: true, bail: 'no-conv-or-text', rawPayload: payload })

  const emailMatch = EMAIL_RE.exec(text)
  if (emailMatch) L(`email found: ${emailMatch[0]}`)

  if (await isProcessed(conversationId)) return NextResponse.json({ ok: true, bail: 'already-processed' })

  const configs = await getConfigs()
  L(`configs loaded: ${configs.length}`)
  if (configs.length === 0) return NextResponse.json({ ok: true, bail: 'no-configs' })

  const z = getZernio()

  // Primary: ask Zernio which automation this contact most recently triggered.
  let matchedConfig = null as Awaited<ReturnType<typeof getConfigById>>
  let matchSource = 'none'
  if (senderIgId) {
    try {
      const aid = await findActiveAutomationId(z, String(senderIgId))
      L(`active automationId for ${senderIgId} = ${aid ?? 'NONE'}`)
      if (aid) {
        matchedConfig = await getConfigById(aid)
        if (matchedConfig) matchSource = 'zernio-logs'
      }
    } catch (e: any) {
      L(`zernio-log lookup failed: ${e?.message ?? e}`)
    }
  }

  // Fallback: legacy conversation-text inference for cases where the log
  // lookup is unavailable (e.g. sender IG ID missing from the webhook payload).
  let messages: any[] = []
  if (!matchedConfig) {
    const { data: msgData }: any = await z.messages.getInboxConversationMessages({
      path:  { conversationId },
      query: { accountId: ACCOUNT_ID, limit: 50, sortOrder: 'desc' } as any,
    })
    messages = (msgData?.messages ?? []).sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    const outgoingTexts = messages
      .filter((m: any) => m.direction === 'outgoing')
      .map(messageText)
      .reverse()
    matchedConfig = await getConfigForConversation(outgoingTexts)
    if (matchedConfig) matchSource = 'text-prefix-fallback'
    L(`fallback match: ${matchedConfig?.automationId ?? 'NONE'}`)
  }

  L(`matched via ${matchSource}: ${matchedConfig?.automationId ?? 'NONE'}`)
  if (!matchedConfig?.followUpDM) return NextResponse.json({ ok: true, bail: 'no-matched-config' })
  const trigger = matchedConfig.replyTrigger ?? 'email'

  if (trigger === 'email' && !emailMatch) {
    return NextResponse.json({ ok: true, bail: 'no-email-in-text' })
  }

  const follower = isFollower(payload.message) || isFollower(payload.conversation)
  if (trigger === 'follow' && !follower) {
    return NextResponse.json({ ok: true, bail: 'not-a-follower' })
  }

  // Load conversation if we haven't yet — needed for duplicate-send check.
  if (!messages.length) {
    const { data: msgData }: any = await z.messages.getInboxConversationMessages({
      path:  { conversationId },
      query: { accountId: ACCOUNT_ID, limit: 50, sortOrder: 'desc' } as any,
    })
    messages = (msgData?.messages ?? []).sort(
      (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }

  const incomingTime = new Date(payload.message?.sentAt ?? payload.message?.createdAt ?? Date.now())
  const alreadyReplied = messages.some((m: any) =>
    m.direction === 'outgoing' &&
    new Date(m.createdAt ?? m.sentAt) > incomingTime &&
    messageText(m).trim() === matchedConfig.followUpDM.trim()
  )
  L(`alreadyReplied: ${alreadyReplied}`)
  if (alreadyReplied) {
    await markProcessed(conversationId)
    return NextResponse.json({ ok: true, bail: 'already-replied' })
  }

  L(`firing DM to convId=${conversationId} | config=${matchedConfig.automationId}`)
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
    ok: true, emailFound, follower, senderName, matchSource,
    automationId: matchedConfig.automationId,
    dmSent:    dmResult.status === 'fulfilled',
    emailSent: Boolean(emailFound) && emailResult.status === 'fulfilled',
    dmError:   dmResult.status === 'rejected' ? (dmResult as any).reason?.message : undefined,
  })
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
