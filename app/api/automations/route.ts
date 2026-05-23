import { NextResponse } from 'next/server'
import { getZernio, PROFILE_ID, ACCOUNT_ID } from '@/lib/zernio'

export async function GET() {
  const z = getZernio()
  const { data, error } = await z.commentautomations.listCommentAutomations({
    query: { profileId: PROFILE_ID },
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const z = getZernio()
  const commentReply =
    typeof body.commentReply === 'string' && body.commentReply.trim()
      ? body.commentReply.trim()
      : 'Check your DMs!'

  const { data, error } = await z.commentautomations.createCommentAutomation({
    body: { profileId: PROFILE_ID, accountId: ACCOUNT_ID, ...body, commentReply },
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
