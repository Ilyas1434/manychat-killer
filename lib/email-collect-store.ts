/**
 * Storage adapter — three tiers:
 *  1. Vercel KV  (KV_REST_API_URL set — best, fully persistent)
 *  2. Env var    (EMAIL_COLLECT_CONFIGS JSON — works on Vercel without KV setup)
 *  3. Local file (dev only)
 *
 * Tier 2 is the production fallback: configs are stored as a JSON env var,
 * processedConversations use the stateless conversation-history check instead.
 */

export type EmailCollectConfig = {
  id:           string
  emailAskText: string
  followUpDM:   string
  emailSubject: string
  createdAt:    string
}

type Store = {
  configs:                EmailCollectConfig[]
  processedConversations: string[]
}

/* ── Tier 1: Vercel KV ── */
async function kvRead(): Promise<Store> {
  const { kv } = await import('@vercel/kv')
  return (await kv.get<Store>('email-collect-store')) ?? { configs: [], processedConversations: [] }
}
async function kvWrite(store: Store) {
  const { kv } = await import('@vercel/kv')
  await kv.set('email-collect-store', store)
}

/* ── Tier 2: env var (production without KV) ── */
function envRead(): Store {
  const raw = process.env.EMAIL_COLLECT_CONFIGS
  if (!raw) return { configs: [], processedConversations: [] }
  try {
    const configs = JSON.parse(raw) as EmailCollectConfig[]
    return { configs, processedConversations: [] } // processed state handled statlessly
  } catch { return { configs: [], processedConversations: [] } }
}

/* ── Tier 3: local file ── */
async function fileRead(): Promise<Store> {
  const { default: fs } = await import('fs')
  const { default: path } = await import('path')
  const file = path.join(process.cwd(), 'data', 'email-collect.json')
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch { return { configs: [], processedConversations: [] } }
}
async function fileWrite(store: Store) {
  const { default: fs } = await import('fs')
  const { default: path } = await import('path')
  const file = path.join(process.cwd(), 'data', 'email-collect.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(store, null, 2))
}

/* ── Adapter ── */
const useKV   = () => !!process.env.KV_REST_API_URL
const useEnv  = () => !useKV() && !!process.env.VERCEL

async function read(): Promise<Store> {
  if (useKV())  return kvRead()
  if (useEnv()) return envRead()
  return fileRead()
}

async function write(store: Store): Promise<void> {
  if (useKV())  return kvWrite(store)
  if (useEnv()) return  // env var is read-only at runtime — configs added via Vercel dashboard
  return fileWrite(store)
}

/* ── Public API ── */
export async function getConfigs(): Promise<EmailCollectConfig[]> {
  return (await read()).configs
}

export async function addConfig(config: EmailCollectConfig) {
  if (useEnv()) {
    // Can't write env vars at runtime — caller should update EMAIL_COLLECT_CONFIGS in Vercel
    console.warn('[store] Running on Vercel without KV — config not persisted. Add to EMAIL_COLLECT_CONFIGS env var.')
    return
  }
  const store = await read()
  store.configs.push(config)
  await write(store)
}

export async function isProcessed(conversationId: string): Promise<boolean> {
  if (useEnv()) return false // stateless in env mode — webhook uses conversation history check
  return (await read()).processedConversations.includes(conversationId)
}

export async function markProcessed(conversationId: string) {
  if (useEnv()) return // stateless in env mode
  const store = await read()
  if (!store.processedConversations.includes(conversationId)) {
    store.processedConversations.push(conversationId)
    await write(store)
  }
}
