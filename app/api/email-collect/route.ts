import { NextResponse } from 'next/server'
import { getConfigs, upsertConfig, storageMode, type EmailCollectConfig } from '@/lib/email-collect-store'

export async function GET() {
  const configs = await getConfigs()
  return NextResponse.json({ configs, storageMode: storageMode() })
}

export async function POST(req: Request) {
  const body: EmailCollectConfig = await req.json()
  if (!body.automationId || !body.followUpDM?.trim()) {
    return NextResponse.json({ error: 'automationId and followUpDM required' }, { status: 400 })
  }
  const config: EmailCollectConfig = {
    ...body,
    replyTrigger: body.replyTrigger ?? 'email',
    updatedAt: new Date().toISOString(),
  }
  await upsertConfig(config)
  return NextResponse.json({ config })
}
