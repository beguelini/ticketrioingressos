import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { BrowserRouter } from 'react-router'
import { AdminPage } from './admin'
import { supabase } from './store'
import './admin.css'

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<'login' | 'recover' | 'password'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    document.title = 'Painel administrativo | Ticket Rio'
    document.documentElement.lang = 'pt-BR'
    if (window.location.hash.includes('type=invite') || window.location.hash.includes('type=recovery')) setMode('password')
    let active = true
    void supabase?.auth.getUser().then(({ data }) => { if (active) { setUser(data.user); setReady(true) } })
    const listener = supabase?.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=invite')) setMode('password')
    })
    if (!supabase) setReady(true)
    return () => { active = false; listener?.data.subscription.unsubscribe() }
  }, [])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || busy) return
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    setBusy(true); setMessage('')
    if (mode === 'recover') {
      const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin` })
      setMessage(result.error ? result.error.message : 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.')
    } else if (mode === 'password') {
      const result = await supabase.auth.updateUser({ password })
      setMessage(result.error ? result.error.message : 'Senha definida. Seu painel está pronto.')
      if (!result.error) { setMode('login'); window.history.replaceState(null, '', '/admin') }
    } else {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) setMessage('Não foi possível entrar. Confira o e-mail e a senha.')
    }
    setBusy(false)
  }
  const signOut = () => { void supabase?.auth.signOut().then(() => { setUser(null); setMode('login') }) }
  if (!ready) return <div className="admin-loading">Verificando acesso…</div>
  if (user && mode !== 'password') return <BrowserRouter><AdminPage user={user} onSignOut={signOut} /></BrowserRouter>
  return <div className="admin-auth"><div className="admin-auth-brand"><span>TR</span><strong>Ticket Rio</strong><small>PAINEL ADMINISTRATIVO</small></div><form onSubmit={(event) => void submit(event)}><h1>{mode === 'recover' ? 'Recuperar acesso' : mode === 'password' ? 'Defina sua senha' : 'Entre no painel'}</h1><p>{mode === 'login' ? 'Gerencie vendas, leads e campanhas em um só lugar.' : 'Use o e-mail da sua conta interna.'}</p>{mode !== 'password' && <label>E-mail<input type="email" name="email" autoComplete="email" required /></label>}{mode !== 'recover' && <label>Senha<input type="password" name="password" autoComplete={mode === 'password' ? 'new-password' : 'current-password'} minLength={8} required /></label>}{message && <p className="admin-message" role="status">{message}</p>}<button type="submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'recover' ? 'Enviar link' : mode === 'password' ? 'Salvar senha' : 'Entrar'}</button><button className="admin-link-button" type="button" onClick={() => { setMode(mode === 'login' ? 'recover' : 'login'); setMessage('') }}>{mode === 'login' ? 'Esqueci minha senha' : 'Voltar ao login'}</button></form><small>Ticket Rio · Acesso exclusivo da equipe</small></div>
}
