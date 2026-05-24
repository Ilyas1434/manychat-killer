/**
 * Per-automation email-collect configs.
 *
 * Storage tiers (auto-detected):
 *  1. Vercel KV        — KV_REST_API_URL set
 *  2. GitHub Gist      — GITHUB_GIST_TOKEN + CONFIG_GIST_ID set (production default)
 *  3. Local file       — dev fallback
 *
 * The Gist tier reads/writes at runtime with no redeploy needed.
 */

export type EmailCollectConfig = {
  automationId:   string
  automationName: string
  emailAskText:   string
  followUpDM:     string
  emailSubject:   string
  replyTrigger?:  'email' | 'follow'
  updatedAt:      string
}

/* ── Tier 1: Vercel KV ──────────────────────────────────── */
async function kvGet(): Promise<EmailCollectConfig[]> {
  const { kv } = await import('@vercel/kv')
  return (await kv.get<EmailCollectConfig[]>('ec-configs')) ?? []
}
async function kvSet(configs: EmailCollectConfig[]) {
  const { kv } = await import('@vercel/kv')
  await kv.set('ec-configs', configs)
}

/* ── Tier 2: GitHub Gist (runtime R/W, no redeploy) ────── */
const GIST_FILE = 'email-collect.json'

async function gistGet(): Promise<EmailCollectConfig[]> {
  const res = await fetch(`https://api.github.com/gists/${process.env.CONFIG_GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_GIST_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  try { return JSON.parse(data.files[GIST_FILE]?.content ?? '[]') }
  catch { return [] }
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

/* ── Tier 3: Local file ─────────────────────────────────── */
async function fileGet(): Promise<EmailCollectConfig[]> {
  const fs   = (await import('fs')).default
  const path = (await import('path')).default
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'email-collect.json'), 'utf8')) }
  catch { return [] }
}
async function fileSet(configs: EmailCollectConfig[]) {
  const fs   = (await import('fs')).default
  const path = (await import('path')).default
  const file = path.join(process.cwd(), 'data', 'email-collect.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(configs, null, 2))
}

/* ── Adapter ────────────────────────────────────────────── */
const tier = () =>
  process.env.KV_REST_API_URL                                         ? 'kv'   :
  process.env.GITHUB_GIST_TOKEN && process.env.CONFIG_GIST_ID        ? 'gist' :
                                                                        'file'

async function getAll(): Promise<EmailCollectConfig[]> {
  // Always merge the committed data/email-collect.json on top of the active
  // tier — seeds new automations without needing tier write access.
  const primary = tier() === 'kv' ? await kvGet() : tier() === 'gist' ? await gistGet() : []
  const seed    = await fileGet()
  const byId    = new Map(primary.map(c => [c.automationId, c]))
  for (const c of seed) byId.set(c.automationId, c)  // seed wins
  return [...byId.values()]
}
async function setAll(configs: EmailCollectConfig[]) {
  switch (tier()) {
    case 'kv':   return kvSet(configs)
    case 'gist': return gistSet(configs)
    default:     return fileSet(configs)
  }
}

/* ── Public API ─────────────────────────────────────────── */
export async function getConfigs(): Promise<EmailCollectConfig[]> {
  return getAll()
}

export async function upsertConfig(config: EmailCollectConfig) {
  const all = await getAll()
  const idx = all.findIndex(c => c.automationId === config.automationId)
  if (idx >= 0) all[idx] = config
  else all.push(config)
  await setAll(all)
}

export async function deleteConfig(automationId: string) {
  const all = await getAll()
  await setAll(all.filter(c => c.automationId !== automationId))
}

export async function getConfigById(automationId: string): Promise<EmailCollectConfig | null> {
  const all = await getAll()
  return all.find(c => c.automationId === automationId) ?? null
}

export async function getConfigForConversation(outgoingMessages: string[]): Promise<EmailCollectConfig | null> {
  const all = await getAll()
  for (const msg of outgoingMessages) {
    const match = all.find(c => msg.trim().startsWith(c.emailAskText.trim().slice(0, 60)))
    if (match) return match
  }
  return null
}

// Processed conversations — stateless on Gist/env tier (webhook uses conversation history check)
const _processed = new Set<string>()
export async function isProcessed(id: string): Promise<boolean> {
  return tier() === 'file' ? _processed.has(id) : false
}
export async function markProcessed(id: string) {
  _processed.add(id)
}

export const storageMode = () => tier()
