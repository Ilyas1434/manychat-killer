import { NextResponse } from 'next/server'
import { getZernio } from '@/lib/zernio'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params
  const z = getZernio()
  const { data, error } = await z.commentautomations.getCommentAutomation({
    path: { automationId: id },
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = await req.json()
  const z = getZernio()
  const { data, error } = await z.commentautomations.updateCommentAutomation({
    path: { automationId: id },
    body,
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params
  const z = getZernio()
  const { error } = await z.commentautomations.deleteCommentAutomation({
    path: { automationId: id },
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ success: true })
}
