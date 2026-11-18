import { useEffect, useState } from 'react';
import { getPublicComments, submitPublicComment } from '../comments';
import type { BlogComment } from '../comments';

export function CommentsSection({ slug,mode }:{slug:string;mode:'moderated'|'open'|'off'}) {
  const [comments,setComments] = useState<BlogComment[]>([]);
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [body,setBody] = useState('');
  const [website,setWebsite] = useState('');
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void getPublicComments(slug).then(result => { if(active) setComments(result); })
      .catch(error => { if(active) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os comentários.'); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active=false; };
  },[slug]);
  if (mode === 'off') return null;
  const submit = async (event:React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      const result = await submitPublicComment({slug,name,email,body,website});
      if (result === 'approved') {
        setComments(await getPublicComments(slug)); setMessage('Seu comentário foi publicado. Obrigada por participar!');
      } else if (result === 'ignored') {
        setMessage('Comentário recebido.');
      } else {
        setMessage('Comentário enviado para moderação. Ele aparecerá após a aprovação.');
      }
      setName(''); setEmail(''); setBody(''); setWebsite('');
    } catch(error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o comentário.'); }
    finally { setSaving(false); }
  };
  return <section className="blog-comments" id="comentarios" aria-labelledby="comments-title">
    <h2 id="comments-title">Comentários</h2>
    {loading ? <p role="status">Carregando comentários…</p> : comments.length ? <ol className="blog-comment-list">{comments.map(comment => <li key={comment.id}><header><strong>{comment.commenter_name}</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString('pt-BR')}</time></header><p>{comment.body}</p></li>)}</ol> : <p>Seja a primeira pessoa a comentar.</p>}
    <form className="blog-comment-form" onSubmit={event => void submit(event)}>
      <h3>Deixe seu comentário</h3>
      <label>Nome<input required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label>
      <label>E-mail<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>
      <small>Seu e-mail não será exibido publicamente.</small>
      <label>Comentário<textarea required minLength={1} maxLength={5000} rows={5} value={body} onChange={event => setBody(event.target.value)} /></label>
      <div className="comment-honeypot" aria-hidden="true"><label>Site<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)} /></label></div>
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Enviando…' : 'Enviar comentário'}</button>
      {message && <p role="status" aria-live="polite">{message}</p>}
    </form>
  </section>;
}
