import { NextResponse } from 'next/server'
import { getConfigs, addConfig } from '@/lib/email-collect-store'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params
  const configs = await getConfigs()
  const next    = configs.filter(c => c.id !== id)

  // Persist — on env-var tier, just return the new list for the UI
  if (next.length < configs.length) {
    // Re-use addConfig's underlying write if KV is available; otherwise no-op
    for (const c of next) await addConfig(c) // will warn on env tier
  }

  return NextResponse.json({ configs: next })
}
