import { NextResponse } from 'next/server'
import { getZernio, ACCOUNT_ID } from '@/lib/zernio'

export async function GET() {
  const z = getZernio()
  const { data, error } = await z.comments.listInboxComments({
    query: { accountId: ACCOUNT_ID, limit: 25 },
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
