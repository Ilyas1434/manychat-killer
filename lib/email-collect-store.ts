/**
 * Per-automation email-collect configs.
 * Storage tiers: Vercel KV → env var (read-only) → local file
 */

export type EmailCollectConfig = {
  automationId:   string   // Zernio automation ID — one config per automation
  automationName: string   // display label
  emailAskText:   string   // must match the automation's dmMessage exactly
  followUpDM:     string   // what to send after they give their email
  emailSubject:   string
  updatedAt:      string
}

type Store = {
  configs:                EmailCollectConfig[]
  processedConversations: string[]
}

const KV_KEY = 'email-collect-store'

async function kvRead(): Promise<Store> {
  const { kv } = await import('@vercel/kv')
  return (await kv.get<Store>(KV_KEY)) ?? { configs: [], processedConversations: [] }
}
async function kvWrite(s: Store) {
  const { kv } = await import('@vercel/kv')
  await kv.set(KV_KEY, s)
}

function envRead(): Store {
  try {
    const configs = JSON.parse(process.env.EMAIL_COLLECT_CONFIGS ?? '[]') as EmailCollectConfig[]
    return { configs, processedConversations: [] }
  } catch { return { configs: [], processedConversations: [] } }
}

async function fileRead(): Promise<Store> {
  const fs   = (await import('fs')).default
  const path = (await import('path')).default
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'email-collect.json'), 'utf8')) }
  catch { return { configs: [], processedConversations: [] } }
}
async function fileWrite(s: Store) {
  const fs   = (await import('fs')).default
  const path = (await import('path')).default
  const file = path.join(process.cwd(), 'data', 'email-collect.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(s, null, 2))
}

const useKV  = () => !!process.env.KV_REST_API_URL
const useEnv = () => !useKV() && !!process.env.VERCEL

async function read(): Promise<Store> {
  if (useKV())  return kvRead()
  if (useEnv()) return envRead()
  return fileRead()
}
async function write(s: Store) {
  if (useKV())  return kvWrite(s)
  if (useEnv()) return   // read-only; user must set up Vercel KV
  return fileWrite(s)
}

/* ── Public API ── */
export async function getConfigs(): Promise<EmailCollectConfig[]> {
  return (await read()).configs
}

export async function upsertConfig(config: EmailCollectConfig) {
  const store = await read()
  const idx   = store.configs.findIndex(c => c.automationId === config.automationId)
  if (idx >= 0) store.configs[idx] = config
  else          store.configs.push(config)
  await write(store)
}

export async function deleteConfig(automationId: string) {
  const store = await read()
  store.configs = store.configs.filter(c => c.automationId !== automationId)
  await write(store)
}

export async function getConfigForConversation(outgoingMessages: string[]): Promise<EmailCollectConfig | null> {
  const configs = await getConfigs()
  for (const msg of outgoingMessages) {
    const match = configs.find(c => msg.trim().startsWith(c.emailAskText.trim().slice(0, 60)))
    if (match) return match
  }
  return null
}

export async function isProcessed(conversationId: string): Promise<boolean> {
  if (useEnv()) return false
  return (await read()).processedConversations.includes(conversationId)
}
export async function markProcessed(conversationId: string) {
  if (useEnv()) return
  const store = await read()
  if (!store.processedConversations.includes(conversationId)) {
    store.processedConversations.push(conversationId)
    await write(store)
  }
}

export const storageMode = () => useKV() ? 'kv' : useEnv() ? 'env' : 'file'
