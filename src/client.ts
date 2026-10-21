// The browser only talks to the same-origin API. MongoDB credentials never enter this module.
export type User = { id: string; email: string; email_confirmed_at?: string | null }
// Database rows are dynamic because the shared admin editor supports multiple collections.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>
type Result = { data: (Row[] & Row) | null; error: { message: string } | null; count?: number | null }
async function request(input: Row): Promise<Row> {
  try {
    const response = await fetch('/api/backend', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    const result = await response.json() as Row
    if (!response.ok && !result.error) return { data: null, error: { message: 'Não foi possível concluir.' } }
    return result
  } catch { return { data: null, error: { message: 'Não foi possível conectar. Tente novamente.' } } }
}
class Query implements PromiseLike<Result> {
  private input: Row
  constructor(table: string) { this.input = { kind: 'query', table, operation: 'select', filters: [], sort: [] } }
  select(fields = '*', options: { count?: string; head?: boolean } = {}) { this.input.select = fields; this.input.count = Boolean(options.count); this.input.head = options.head; return this }
  eq(field: string, value: unknown) { this.input.filters.push({ field, op: 'eq', value }); return this }
  neq(field: string, value: unknown) { this.input.filters.push({ field, op: 'neq', value }); return this }
  in(field: string, value: unknown[]) { this.input.filters.push({ field, op: 'in', value }); return this }
  gte(field: string, value: unknown) { this.input.filters.push({ field, op: 'gte', value }); return this }
  lte(field: string, value: unknown) { this.input.filters.push({ field, op: 'lte', value }); return this }
  order(field: string, options: { ascending?: boolean } = {}) { this.input.sort.push({ field, ascending: options.ascending !== false }); return this }
  limit(limit: number) { this.input.limit = limit; return this }
  insert(values: unknown) { this.input.operation = 'insert'; this.input.values = values; return this }
  update(values: unknown) { this.input.operation = 'update'; this.input.values = values; return this }
  upsert(values: unknown) { this.input.operation = 'upsert'; this.input.values = values; return this }
  delete() { this.input.operation = 'delete'; return this }
  single() { this.input.single = true; return this }
  maybeSingle() { this.input.single = true; return this }
  then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
    return request(this.input).then((r) => r as Result).then(onfulfilled, onrejected)
  }
}
type Listener = (event: string, session: { user: User } | null) => void
const listeners = new Set<Listener>()
let activeUser: User | null = null
const notify = (event: string, user: User | null) => { activeUser = user; for (const listener of listeners) listener(event, user ? { user } : null); window.dispatchEvent(new Event('ticketrio-auth')) }
async function action(name: string, values: Row = {}) {
  const result = await request({ kind: 'auth', action: name, ...values })
  const user = result.data?.user as User | undefined
  if (!result.error && user) notify('SIGNED_IN', user)
  return { data: { user: user ?? null }, error: result.error ?? null }
}
function fragment() { return new URLSearchParams(window.location.hash.slice(1)) }
let verification: Promise<ReturnType<typeof action> extends Promise<infer T> ? T : never> | null = null
export const api = {
  from: (table: string) => new Query(table),
  rpc: (name: string, body: Row) => request({ kind: 'rpc', name, body }),
  functions: { invoke: (name: string, options: { body: unknown }) => request({ kind: 'function', name, body: options.body }) },
  auth: {
    async getUser() {
      if (fragment().get('type') === 'verify') {
        verification ??= action('verify', { token: fragment().get('token') }).then((result) => { if (!result.error) window.history.replaceState(null, '', window.location.pathname); return result })
        return verification
      }
      const result = await action('user'); activeUser = result.data.user; return result
    },
    signInWithPassword: (values: { email: string; password: string }) => action('login', values),
    signUp: (values: { email: string; password: string; options?: unknown }) => action('register', { email: values.email, password: values.password }),
    resetPasswordForEmail: (email: string, _options?: unknown) => { void _options; return action('recover', { email }) },
    async updateUser(values: { password: string }) {
      const result = await action('password', { ...values, token: fragment().get('token') })
      if (!result.error) window.history.replaceState(null, '', window.location.pathname)
      return result
    },
    async signOut() { const result = await action('logout'); if (!result.error) notify('SIGNED_OUT', null); return result },
    onAuthStateChange(listener: Listener) {
      listeners.add(listener)
      if (fragment().get('type') === 'recovery') queueMicrotask(() => listener('PASSWORD_RECOVERY', activeUser ? { user: activeUser } : null))
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
    },
  },
  storage: { from: (bucket: string) => ({
    async upload(path: string, file: File, _options?: unknown) {
      void _options
      if (file.size > 2 * 1024 * 1024) return { data: null, error: { message: 'Limite de 2 MB por imagem.' } }
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file) })
      return request({ kind: 'upload', bucket, path, base64 })
    },
    getPublicUrl(path: string) { return { data: { publicUrl: `/api/backend?bucket=${encodeURIComponent(bucket)}&file=${encodeURIComponent(path)}` } } },
  }) },
}
