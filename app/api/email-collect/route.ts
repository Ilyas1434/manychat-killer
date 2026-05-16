import { NextResponse } from 'next/server'
import { getConfigs, addConfig, type EmailCollectConfig } from '@/lib/email-collect-store'
import { randomUUID } from 'crypto'

export async function GET() {
  const configs = await getConfigs()
  return NextResponse.json({ configs })
}

export async function POST(req: Request) {
  const { emailAskText, followUpDM } = await req.json()
  if (!emailAskText?.trim()) {
    return NextResponse.json({ error: 'emailAskText required' }, { status: 400 })
  }
  const config: EmailCollectConfig = {
    id:           randomUUID(),
    emailAskText: emailAskText.trim(),
    followUpDM:   followUpDM?.trim() ?? '',
    createdAt:    new Date().toISOString(),
  }
  await addConfig(config)
  return NextResponse.json({ config })
}
