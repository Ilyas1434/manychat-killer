import { NextResponse } from 'next/server'
import { deleteConfig } from '@/lib/email-collect-store'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params
  await deleteConfig(id)
  return NextResponse.json({ success: true })
}
