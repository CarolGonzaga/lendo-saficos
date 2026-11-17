import { useCallback, useEffect, useState } from 'react';
import { listMedia, removeUnusedMedia, uploadMedia } from '../services';
import type { Media } from '../types';
import './folio-panels.css';

export function MediaPanel() {
  const [media, setMedia] = useState<Media[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const load = useCallback(async (nextPage: number) => {
    const files = await listMedia(nextPage);
    setMedia(files); setPage(nextPage);
  }, []);
  useEffect(() => {
    let active = true;
    listMedia(1).then(files => { if (active) setMedia(files); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a biblioteca.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setFeedback('');
    try { await operation(); setFeedback(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'A operação falhou.'); }
    finally { setBusy(false); setProgress(''); }
  };
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true); setError(''); setFeedback('');
    let sent = 0;
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Enviando ${index + 1} de ${files.length}: ${file.name}`);
        try { await uploadMedia(file); sent++; }
        catch (reason) { failures.push(`${file.name}: ${reason instanceof Error ? reason.message : 'Falha no envio.'}`); }
      }
      await load(1);
      if (sent) setFeedback(`${sent} ${sent === 1 ? 'imagem enviada' : 'imagens enviadas'}.`);
      if (failures.length) setError(failures.join(' '));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar a biblioteca.'); }
    finally { setBusy(false); setProgress(''); }
  };
  return <section className="folio-panel cms-admin" aria-label="Biblioteca de imagens">
    <header className="folio-panel-heading"><div><p className="eyebrow">Acervo</p><h1>Biblioteca de imagens</h1><p>Reutilize imagens enviadas em qualquer matéria.</p></div><label className="folio-upload-button">{busy ? 'Aguarde…' : '+ Enviar imagens'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={busy} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void upload(files); }} /></label></header>
    <p className="folio-hint">JPG, PNG, WebP ou GIF; até 10 MB por imagem. Imagens grandes são otimizadas.</p>
    {loading && <p role="status">Carregando imagens…</p>}{progress && <p role="status">{progress}</p>}
    {error && <p className="folio-error" role="alert">{error} {!loading && !busy && <button type="button" onClick={() => void run(() => load(page), 'Lista atualizada.')}>Tentar novamente</button>}</p>}
    {feedback && <p className="folio-success" role="status">{feedback}</p>}
    {!loading && (media.length ? <div className="folio-media-grid">{media.map(file => <figure className="folio-media-card" key={file.path}><img src={file.url} alt={file.name} loading="lazy" /><figcaption><strong title={file.name}>{file.name}</strong><small>{file.referenced ? 'Em uso' : 'Sem associação salva'}</small><div className="folio-row-actions"><button type="button" disabled={busy} onClick={() => void run(() => navigator.clipboard.writeText(file.url), 'URL copiada.')}>Copiar URL</button><button type="button" disabled={busy || file.referenced} aria-label={`Excluir imagem ${file.name}`} onClick={() => { if (window.confirm(`Excluir “${file.name}” da biblioteca?`)) void run(async () => { await removeUnusedMedia(file.path); const current = await listMedia(page); if (!current.length && page > 1) await load(page - 1); else setMedia(current); }, 'Imagem removida.'); }}>Excluir</button></div></figcaption></figure>)}</div> : <div className="folio-empty"><h2>Biblioteca vazia</h2><p>Envie a primeira imagem para começar o acervo.</p></div>)}
    {!loading && <nav className="folio-pagination" aria-label="Páginas da biblioteca"><button type="button" disabled={busy || page <= 1} onClick={() => void run(() => load(page - 1), 'Página carregada.')}>Anterior</button><span>Página {page}</span><button type="button" disabled={busy || media.length < 24} onClick={() => void run(() => load(page + 1), 'Página carregada.')}>Próxima</button></nav>}
  </section>;
}
