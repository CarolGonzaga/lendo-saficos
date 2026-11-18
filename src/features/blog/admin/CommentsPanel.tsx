import { useCallback, useEffect, useState } from 'react';
import { deleteComment, getAdminComments, moderateComment } from '../comments';
import type { BlogComment } from '../comments';

type Filter = 'pending'|'approved'|'rejected'|'all';
const labels:Record<Filter,string> = {pending:'Aguardando',approved:'Publicados',rejected:'Rejeitados',all:'Todos'};
export function CommentsPanel() {
  const [filter,setFilter] = useState<Filter>('pending');
  const [comments,setComments] = useState<BlogComment[]>([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState<number|null>(null);
  const [message,setMessage] = useState('');
  const [revision,setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1),[]);
  useEffect(() => {
    let active = true; setLoading(true);
    void getAdminComments(filter).then(result => { if(active) setComments(result); })
      .catch(error => { if(active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os comentários.'); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active=false; };
  },[filter,revision]);
  const changeStatus = async (comment:BlogComment,status:'approved'|'rejected') => {
    setBusy(comment.id); setMessage('');
    try { await moderateComment(comment.id,status); setMessage(status === 'approved' ? 'Comentário publicado.' : 'Comentário rejeitado.'); refresh(); }
    catch(error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o comentário.'); }
    finally { setBusy(null); }
  };
  const remove = async (comment:BlogComment) => {
    if (!window.confirm(`Excluir definitivamente o comentário de ${comment.commenter_name}?`)) return;
    setBusy(comment.id); setMessage('');
    try { await deleteComment(comment.id); setMessage('Comentário excluído.'); refresh(); }
    catch(error) { setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o comentário.'); }
    finally { setBusy(null); }
  };
  return <section className="folio-admin-panel" aria-labelledby="blog-comments-title">
    <header className="folio-panel-heading"><div><p className="folio-eyebrow">Comunidade</p><h2 id="blog-comments-title">Comentários</h2><p>Revise os comentários enviados às matérias do blog.</p></div></header>
    <nav className="folio-tabs" aria-label="Filtrar comentários">{(Object.keys(labels) as Filter[]).map(status => <button key={status} type="button" aria-selected={filter === status} onClick={() => setFilter(status)}>{labels[status]}</button>)}</nav>
    {message && <p role="status" className="folio-feedback">{message}</p>}
    {loading ? <p role="status">Carregando comentários…</p> : !comments.length ? <div className="folio-empty"><h2>Nenhum comentário nesta lista</h2></div> : <div className="blog-admin-comments">{comments.map(comment => <article key={comment.id}>
      <header><div><strong>{comment.commenter_name}</strong><a href={`mailto:${comment.commenter_email}`}>{comment.commenter_email}</a></div><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('pt-BR')}</time></header>
      <p className="blog-comment-article">Em <a href={`/blog/${comment.article_slug}`} target="_blank" rel="noopener noreferrer">{comment.article_title}</a></p>
      <p className="blog-admin-comment-body">{comment.body}</p>
      <footer><span className={`blog-comment-status is-${comment.status}`}>{comment.status === 'pending' ? 'Aguardando moderação' : comment.status === 'approved' ? 'Publicado' : 'Rejeitado'}</span>
        {comment.status !== 'approved' && <button type="button" disabled={busy === comment.id} onClick={() => void changeStatus(comment,'approved')}>Aprovar e publicar</button>}
        {comment.status !== 'rejected' && <button type="button" disabled={busy === comment.id} onClick={() => void changeStatus(comment,'rejected')}>Rejeitar</button>}
        <button type="button" disabled={busy === comment.id} onClick={() => void remove(comment)}>Excluir</button></footer>
    </article>)}</div>}
  </section>;
}
