/**
 * Storage adapter:
 *  - Vercel KV  (when KV_REST_API_URL is set — production on Vercel)
 *  - Local file  (local dev)
 */

export type EmailCollectConfig = {
  id:           string
  emailAskText: string
  followUpDM:   string
  createdAt:    string
}

type Store = {
  configs:               EmailCollectConfig[]
  processedConversations: string[]
}

/* ── KV helpers (lazy-imported so local dev doesn't need the vars) ── */
async function kvRead(): Promise<Store> {
  const { kv } = await import('@vercel/kv')
  const data = await kv.get<Store>('email-collect-store')
  return data ?? { configs: [], processedConversations: [] }
}

async function kvWrite(store: Store) {
  const { kv } = await import('@vercel/kv')
  await kv.set('email-collect-store', store)
}

/* ── File helpers (local dev only) ── */
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
const useKV = () => !!process.env.KV_REST_API_URL

async function read(): Promise<Store>        { return useKV() ? kvRead()         : fileRead()          }
async function write(s: Store): Promise<void>{ return useKV() ? kvWrite(s)       : fileWrite(s)        }

/* ── Public API ── */
export async function getConfigs(): Promise<EmailCollectConfig[]> {
  return (await read()).configs
}

export async function addConfig(config: EmailCollectConfig) {
  const store = await read()
  store.configs.push(config)
  await write(store)
}

export async function isProcessed(conversationId: string): Promise<boolean> {
  return (await read()).processedConversations.includes(conversationId)
}

export async function markProcessed(conversationId: string) {
  const store = await read()
  if (!store.processedConversations.includes(conversationId)) {
    store.processedConversations.push(conversationId)
    await write(store)
  }
}
