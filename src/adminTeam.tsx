import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './store'

type Staff = { user_id: string; email: string | null; role: string; created_at: string }
const roles = [
  { id: 'administrator', label: 'Administrador', detail: 'Acesso completo e gestão da equipe' },
  { id: 'commercial', label: 'Comercial', detail: 'CRM, catálogo, pedidos e clientes' },
  { id: 'marketing', label: 'Mídia', detail: 'Investimentos e resultados agregados' },
  { id: 'operations', label: 'Operação', detail: 'Pedidos, entregas e transfers' },
  { id: 'finance', label: 'Financeiro', detail: 'Pedidos, pagamentos e reembolsos' },
]
export default function Team({ user }: { user: User }) {
  const [staff, setStaff] = useState<Staff[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('staff_roles').select('user_id,email,role,created_at').order('created_at')
    setStaff((data ?? []) as Staff[])
    if (error) setMessage(`Não foi possível carregar a equipe: ${error.message}`)
  }, [])
  useEffect(() => { void load() }, [load])
  const act = async (body: Record<string,string>) => {
    if (!supabase) return
    setBusy(true); setMessage('')
    const { data, error } = await supabase.functions.invoke('manage-staff', { body })
    setBusy(false)
    if (error || !data?.ok) { setMessage(`Não foi possível concluir: ${data?.detail ?? data?.error ?? error?.message ?? 'erro desconhecido'}`); return }
    setMessage(body.action === 'invite' ? data.invited ? 'Convite enviado. O usuário definirá a senha pelo e-mail.' : 'Acesso atribuído ao usuário existente.' : 'Acesso atualizado.')
    void load()
  }
  const invite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void act({ action: 'invite', email: String(form.get('email')), role: String(form.get('role')) })
    event.currentTarget.reset()
  }
  return <section className="admin-panel"><div className="admin-panel-head"><div><span className="admin-eyebrow">ACESSOS</span><h1>Equipe</h1><p>Convide pessoas e defina o que cada função pode acessar.</p></div></div>{message && <p className="admin-message" role="status">{message}</p>}<div className="admin-media-grid"><div className="admin-card"><h2>Convidar usuário</h2><form className="admin-grid-form" onSubmit={invite}><label>E-mail<input type="email" name="email" required maxLength={254} /></label><label>Função<select name="role" required>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label><button className="admin-primary" disabled={busy}>Enviar convite</button></form><p className="admin-muted">Se a conta já existir, o acesso será atribuído sem novo convite.</p></div><div className="admin-card"><h2>Funções</h2><div className="admin-role-list">{roles.map((role) => <div key={role.id}><strong>{role.label}</strong><small>{role.detail}</small></div>)}</div></div></div><div className="admin-card"><h2>Usuários internos</h2><div className="admin-team-list">{staff.map((person) => <div key={person.user_id}><span><strong>{person.email ?? person.user_id}</strong><small>Desde {new Date(person.created_at).toLocaleDateString('pt-BR')}{person.user_id === user.id ? ' · Você' : ''}</small></span><select aria-label={`Função de ${person.email ?? person.user_id}`} value={person.role} disabled={busy || person.user_id === user.id} onChange={(event) => { if (window.confirm('Alterar a função deste usuário?')) void act({ action: 'update', user_id: person.user_id, role: event.target.value }); else event.target.value = person.role }}>{roles.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select><button type="button" disabled={busy || person.user_id === user.id} onClick={() => { if (window.confirm('Remover o acesso administrativo deste usuário?')) void act({ action: 'revoke', user_id: person.user_id }) }}>Remover</button></div>)}</div></div></section>
}
