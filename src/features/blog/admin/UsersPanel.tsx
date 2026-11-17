import { useCallback, useEffect, useState } from 'react';
import { changeTeamRole, getCurrentTeamRole, getCurrentUserId, inviteTeamMember, listTeamMembers } from './adminSettingsServices';
import type { TeamMember } from './adminSettingsServices';
import './settingsUsers.css';

export function UsersPanel() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [role, setRole] = useState<'admin' | 'author' | null>(null);
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamMember['role']>('author');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [access, userId] = await Promise.all([getCurrentTeamRole(), getCurrentUserId()]);
    setRole(access); setMe(userId);
    if (access === 'admin') setMembers(await listTeamMembers());
  }, []);
  useEffect(() => {
    let active = true;
    void refresh().catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar a equipe.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  const setMemberRole = async (member: TeamMember, nextRole: TeamMember['role']) => {
    if (member.role === nextRole) return;
    setChanging(member.user_id); setMessage('');
    try { await changeTeamRole(member.user_id, nextRole); await refresh(); setMessage('Permissão atualizada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a permissão.'); }
    finally { setChanging(''); }
  };

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setInviting(true); setMessage('');
    try { await inviteTeamMember(inviteEmail, inviteRole); setInviteEmail(''); await refresh(); setMessage('Convite enviado e permissão cadastrada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o convite.'); }
    finally { setInviting(false); }
  };

  return <section className="folio-admin-panel" aria-labelledby="blog-users-title">
    <header className="folio-panel-heading"><div><p className="folio-eyebrow">Equipe</p><h2 id="blog-users-title">Usuários e permissões</h2><p>Quem escreve e quem administra o blog.</p></div></header>
    {loading ? <p role="status">Carregando equipe…</p> : role !== 'admin' ? <div className="folio-card"><h3>Acesso restrito</h3><p>Somente administradores podem gerenciar a equipe.</p></div> : <>
      <form className="folio-card folio-invite" onSubmit={event => void invite(event)}><div><h3>Convidar por e-mail</h3><div className="folio-invite-fields"><div><label htmlFor="folio-invite-email">E-mail</label><input id="folio-invite-email" type="email" required maxLength={254} placeholder="pessoa@dominio.com" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} /></div><div><label htmlFor="folio-invite-role">Permissão</label><select id="folio-invite-role" value={inviteRole} onChange={event => setInviteRole(event.target.value as TeamMember['role'])}><option value="author">Autor</option><option value="admin">Administrador</option></select></div></div></div><button type="submit" disabled={inviting}>{inviting ? 'Enviando…' : 'Convidar'}</button></form>
      <div className="folio-card folio-team-card"><h3>Equipe cadastrada</h3><div className="folio-table-scroll"><table><thead><tr><th scope="col">Pessoa</th><th scope="col">Desde</th><th scope="col">Permissão</th></tr></thead><tbody>
        {members.map(member => <tr key={member.user_id}><td><strong>{member.full_name || member.email}</strong><small>{member.email}</small></td><td>{new Date(member.created_at).toLocaleDateString('pt-BR')}</td><td><select aria-label={`Permissão de ${member.email}`} value={member.role} disabled={member.user_id === me || !!changing} onChange={event => void setMemberRole(member, event.target.value as TeamMember['role'])}><option value="author">Autor</option><option value="admin">Administrador</option></select>{member.user_id === me && <small>Sua conta</small>}</td></tr>)}
        {!members.length && <tr><td colSpan={3}>Nenhuma pessoa cadastrada na equipe.</td></tr>}
      </tbody></table></div></div>
      <p className="folio-note">Administradores gerenciam a equipe e as configurações. Autores têm acesso editorial às matérias pela política atual do CMS; publicação, exclusão, categorias e mídia ainda usam a mesma permissão editorial.</p>
    </>}
    {message && <p role="status" className="folio-feedback">{message}</p>}
  </section>;
}
