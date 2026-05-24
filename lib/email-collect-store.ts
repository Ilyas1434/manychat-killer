/**
 * Per-automation email-collect configs.
 *
 * SOURCE OF TRUTH: data/email-collect.json (committed to repo).
 * Loaded via static import so Next.js bundles it into the deployment —
 * no runtime filesystem reads, no missing-file surprises on Vercel.
 *
 * Optional secondary tiers (KV / Gist) layer on top for runtime UI edits
 * that don't require a redeploy. The committed file always wins for any
 * automationId it defines, so production behavior stays deterministic.
 */

import seedConfigs from '@/data/email-collect.json'

export type EmailCollectConfig = {
  automationId:   string
  automationName: string
  emailAskText:   string
  followUpDM:     string
  emailSubject:   string
  replyTrigger?:  'email' | 'follow'
  updatedAt:      string
}

const SEED: EmailCollectConfig[] = seedConfigs as EmailCollectConfig[]

/* ── Optional runtime tiers (UI edits) ─────────────────── */
async function kvGet(): Promise<EmailCollectConfig[]> {
  try {
    const { kv } = await import('@vercel/kv')
    return (await kv.get<EmailCollectConfig[]>('ec-configs')) ?? []
  } catch { return [] }
}
async function kvSet(configs: EmailCollectConfig[]) {
  const { kv } = await import('@vercel/kv')
  await kv.set('ec-configs', configs)
}

const GIST_FILE = 'email-collect.json'
async function gistGet(): Promise<EmailCollectConfig[]> {
  try {
    const res = await fetch(`https://api.github.com/gists/${process.env.CONFIG_GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_GIST_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return JSON.parse(data.files[GIST_FILE]?.content ?? '[]')
  } catch { return [] }
}
async function gistSet(configs: EmailCollectConfig[]) {
  await fetch(`https://api.github.com/gists/${process.env.CONFIG_GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_GIST_TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(configs, null, 2) } },
    }),
  })
}

const tier = () =>
  process.env.KV_REST_API_URL                                   ? 'kv'   :
  process.env.GITHUB_GIST_TOKEN && process.env.CONFIG_GIST_ID  ? 'gist' :
                                                                  'none'

/* ── Public API ─────────────────────────────────────────── */
async function getAll(): Promise<EmailCollectConfig[]> {
  // Layer order (last write wins): tier → committed seed.
  // Committed file is canonical and overrides tier entries with same automationId.
  const runtime = tier() === 'kv' ? await kvGet() : tier() === 'gist' ? await gistGet() : []
  const byId = new Map<string, EmailCollectConfig>()
  for (const c of runtime) byId.set(c.automationId, c)
  for (const c of SEED)    byId.set(c.automationId, c)
  return [...byId.values()]
}

export async function getConfigs(): Promise<EmailCollectConfig[]> {
  return getAll()
}

export async function getConfigById(automationId: string): Promise<EmailCollectConfig | null> {
  return SEED.find(c => c.automationId === automationId)
      ?? (await getAll()).find(c => c.automationId === automationId)
      ?? null
}

export async function upsertConfig(config: EmailCollectConfig) {
  if (tier() === 'none') {
    throw new Error('No persistent storage configured. Commit the config to data/email-collect.json, or set up Vercel KV / GitHub Gist env vars.')
  }
  const runtime = tier() === 'kv' ? await kvGet() : await gistGet()
  const idx = runtime.findIndex(c => c.automationId === config.automationId)
  if (idx >= 0) runtime[idx] = config
  else runtime.push(config)
  if (tier() === 'kv') await kvSet(runtime)
  else                 await gistSet(runtime)
}

export async function deleteConfig(automationId: string) {
  if (tier() === 'none') {
    throw new Error('No persistent storage configured. Remove the config from data/email-collect.json directly.')
  }
  const runtime = tier() === 'kv' ? await kvGet() : await gistGet()
  const filtered = runtime.filter(c => c.automationId !== automationId)
  if (tier() === 'kv') await kvSet(filtered)
  else                 await gistSet(filtered)
}

// Legacy text-prefix matcher — kept for backward compat, no longer the primary path.
export async function getConfigForConversation(outgoingMessages: string[]): Promise<EmailCollectConfig | null> {
  const all = await getAll()
  for (const msg of outgoingMessages) {
    const match = all.find(c => msg.trim().startsWith(c.emailAskText.trim().slice(0, 60)))
    if (match) return match
  }
  return null
}

// Idempotency: best-effort in-memory cache. Real dedup is the conversation-history scan in the webhook.
const _processed = new Set<string>()
export async function isProcessed(id: string): Promise<boolean> { return _processed.has(id) }
export async function markProcessed(id: string) { _processed.add(id) }

export const storageMode = () => tier()
