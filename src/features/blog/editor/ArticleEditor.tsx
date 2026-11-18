import { useCallback, useEffect, useRef, useState } from 'react';
import type { Article, ArticleBlock, ArticleDraft, Category, Tag } from '../types';
import { clearWorkingDraft, saveArticle, saveWorkingDraft } from '../services';
import { draftOf, emptyDraft, formatDate, newBlock, normalize, slugify } from '../utils';
import { ArticlePreview } from '../components/ArticlePreview';
import { BlockEditor } from './BlockEditor';
import { CanvasEditor } from './CanvasEditor';
import { MediaUploader } from './MediaUploader';

function localDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
export function ArticleEditor({ article, workingDraft, categories, tags, template, onClose, onSaved }: {
  article: Article | null; workingDraft?: ArticleDraft | null; categories: Category[]; tags: Tag[]; template: ArticleBlock[];
  onClose: () => void; onSaved: () => void;
}) {
  const [original, setOriginal] = useState(article);
  const [draft, setDraft] = useState<ArticleDraft>(() => workingDraft || (article ? draftOf(article) : { ...emptyDraft(), blocks:[{ ...newBlock('text'),id:'new-article-text' }] }));
  const [persisted, setPersisted] = useState(() => JSON.stringify(workingDraft || (article ? draftOf(article) : { ...emptyDraft(), blocks:[{ ...newBlock('text'),id:'new-article-text' }] })));
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [message, setMessage] = useState(workingDraft ? 'Rascunho de edição recuperado. A versão publicada permanece igual até salvar/publicar.' : article ? 'Salvo' : 'Nova matéria. Preencha título e resumo para iniciar o salvamento automático.');
  const [preview, setPreview] = useState<ArticleDraft | null>(null);
  const [editorMode, setEditorMode] = useState<'basic' | 'advanced'>(() => (workingDraft || article)?.blocks?.some(block => block.box) ? 'advanced' : 'basic');
  const [tagInput, setTagInput] = useState('');
  const mounted = useRef(true);
  const draftRef = useRef(draft);
  const originalRef = useRef(original);
  const busyRef = useRef(false);
  const failedSnapshot = useRef('');
  const snapshot = JSON.stringify(draft);
  const dirty = snapshot !== persisted;
  const update = (values: Partial<ArticleDraft>) => setDraft(current => { const next={ ...current, ...values }; draftRef.current=next; return next; });
  useEffect(() => { draftRef.current = draft; originalRef.current = original; }, [draft,original]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!dirty && !uploads && !saving) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload',protect); return () => window.removeEventListener('beforeunload',protect);
  }, [dirty,uploads,saving]);
  const persist = useCallback(async (automatic: boolean, status?: ArticleDraft['status']) => {
    if (busyRef.current) return;
    busyRef.current = true; setSaving(true); setMessage('Salvando…');
    const current = structuredClone(draftRef.current);
    const sourceSnapshot = JSON.stringify(current);
    if (status) current.status = status;
    if (!automatic && current.status === 'Publicado' && !current.published_at) current.published_at = new Date().toISOString();
    try {
      if (automatic && originalRef.current) {
        await saveWorkingDraft(originalRef.current,current);
      } else {
        const saved = await saveArticle(automatic ? { ...current, status:'Rascunho', scheduled_at:null, published_at:null } : current,originalRef.current);
        originalRef.current = saved;
        if (mounted.current) setOriginal(saved);
        if (automatic) await saveWorkingDraft(saved,current);
        if (!automatic) {
          const next = draftOf(saved);
          if (JSON.stringify(draftRef.current) === sourceSnapshot) {
            draftRef.current = next;
            if (mounted.current) setDraft(next);
          }
          if (mounted.current) setPersisted(JSON.stringify(next));
          await clearWorkingDraft(saved.id);
        }
        onSaved();
      }
      if (mounted.current) {
        if (automatic) setPersisted(JSON.stringify(current));
        failedSnapshot.current = '';
        setMessage(automatic ? `Salvo automaticamente às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}. Edição preservada; publicação depende da sua confirmação.` : 'Matéria salva com sucesso.');
      }
    } catch (error) { failedSnapshot.current = JSON.stringify(draftRef.current); if (mounted.current) setMessage(`Erro ao salvar: ${error instanceof Error ? error.message : 'Tente novamente.'}`); }
    finally { busyRef.current = false; if (mounted.current) setSaving(false); }
  }, [onSaved]);
  useEffect(() => {
    if (!dirty || uploads || saving || failedSnapshot.current === snapshot || (!original && (!draft.title.trim() || !draft.excerpt.trim()))) return;
    const timer = window.setTimeout(() => void persist(true),2500); return () => window.clearTimeout(timer);
  }, [dirty,snapshot,uploads,saving,draft.title,draft.excerpt,persist,original]);
  const onBusy = (busy: boolean) => setUploads(current => Math.max(0,current+(busy ? 1 : -1)));
  const close = () => { if (uploads || saving) { setMessage('Aguarde o salvamento ou upload terminar.'); return; } if (!dirty || window.confirm('Há alterações não salvas. Sair e descartar essas alterações?')) onClose(); };
  const addTag = (name: string) => { const cleaned = name.trim(); if (cleaned && !draft.tags?.some(tag => normalize(tag) === normalize(cleaned))) update({ tags:[...(draft.tags || []),tags.find(tag => normalize(tag.name) === normalize(cleaned))?.name || cleaned] }); setTagInput(''); };
  return <div className={editorMode === 'advanced' ? 'cms-editor is-visual' : 'cms-editor'}><div className="cms-editor-heading"><button type="button" className="cms-editor-back" onClick={close} aria-label="Voltar às matérias">←</button><div className="cms-editor-title"><p className="eyebrow">{article ? 'EDITAR ARTIGO' : 'NOVO ARTIGO'}</p><h1>{draft.title || 'Sem título'}</h1></div><div className="cms-editor-top-actions"><button type="button" onClick={() => void persist(false,'Rascunho')} disabled={saving || !!uploads}>Salvar rascunho</button><button type="button" className="button button-primary" onClick={() => void persist(false,'Publicado')} disabled={saving || !!uploads}>▣ Publicar</button></div><p role="status" aria-live="polite">{saving ? 'Salvando…' : dirty && !message.startsWith('Erro') ? 'Alterações não salvas' : message}</p></div>
    <form onSubmit={event => { event.preventDefault(); void persist(false); }}><div className="cms-editor-layout"><div className="cms-editor-main">
      <section className="cms-editor-fields"><label>Título<input required value={draft.title} onChange={event => update({ title:event.target.value })} placeholder="Um título que valha a leitura" /></label><label>Endereço do artigo<div className="cms-slug-field"><span>/blog/</span><input aria-label="Endereço do artigo" value={draft.slug || ''} onChange={event => update({ slug:event.target.value })} placeholder={slugify(draft.title)} /></div></label><label>Resumo<textarea required aria-label="Resumo" value={draft.excerpt} onChange={event => update({ excerpt:event.target.value })} placeholder="Duas linhas que convencem à leitura" /></label></section>
      <section className="cms-panel cms-editor-body"><div className="cms-editor-mode"><div><h2>Editor de conteúdo</h2><p>Escolha como prefere montar esta matéria.</p></div><div role="group" aria-label="Modo do editor"><button type="button" aria-pressed={editorMode === 'basic'} onClick={() => setEditorMode('basic')}>Básico</button><button type="button" aria-pressed={editorMode === 'advanced'} onClick={() => setEditorMode('advanced')}>Avançado — Editor Visual</button></div></div>{editorMode === 'advanced' ? <CanvasEditor blocks={draft.blocks || []} onChange={blocks => update({ blocks })} onBusy={onBusy} onPreview={blocks => setPreview({ ...draft, blocks })} /> : <BlockEditor blocks={draft.blocks || []} onChange={blocks => update({ blocks })} onBusy={onBusy} />}{!draft.blocks?.length && <button type="button" onClick={() => update({ blocks: structuredClone(template).map(block => ({ ...block,id:crypto.randomUUID() })), category: 'Listas', category_id:categories.find(category => category.name === 'Listas')?.id, image:'/images/5.jpeg' })}>Usar modelo Encha Seu Kindle</button>}</section>
    </div><aside className="cms-editor-sidebar"><section className="cms-panel"><h2>Publicação</h2><label>Status<select aria-label="Status" value={draft.status} onChange={event => update({ status:event.target.value as ArticleDraft['status'] })}><option>Rascunho</option><option>Agendado</option><option>Publicado</option><option>Suspenso</option></select></label>
      {draft.status === 'Agendado' && <label>Agendar em (horário local)<input required type="datetime-local" value={localDate(draft.scheduled_at)} onChange={event => update({ scheduled_at:event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>}
      <label>Data de publicação (horário local)<input type="datetime-local" value={localDate(draft.published_at)} onChange={event => update({ published_at:event.target.value ? new Date(event.target.value).toISOString() : null })} /></label>
      <button type="submit" className="button button-primary" disabled={saving || !!uploads}>Salvar matéria</button><button type="button" disabled={saving || !!uploads} onClick={() => void persist(false,'Rascunho')}>Salvar rascunho</button><button type="button" disabled={saving || !!uploads} onClick={() => void persist(false,'Publicado')}>Publicar agora</button><button type="button" disabled={saving || !!uploads || !draft.scheduled_at} onClick={() => void persist(false,'Agendado')}>Confirmar agendamento</button><button type="button" onClick={() => setPreview(draft)}>Visualizar prévia</button>
      <p className="cms-help">O autosave preserva uma edição separada. Para atualizar o conteúdo público, use Salvar matéria ou Publicar agora.</p><small>Criada: {formatDate(original?.created_at)}<br />Atualizada: {formatDate(original?.updated_at)}</small>
    </section><section className="cms-panel"><h2>Comentários</h2><label>Como permitir comentários?<select aria-label="Configuração de comentários desta matéria" value={draft.comments_mode || 'inherit'} onChange={event => update({ comments_mode:event.target.value as ArticleDraft['comments_mode'] })}><option value="inherit">Usar regra geral</option><option value="moderated">Com moderação</option><option value="open">Livres, publicados imediatamente</option><option value="off">Desativados nesta matéria</option></select></label><small>A regra individual substitui a configuração geral só para esta matéria.</small></section><section className="cms-panel"><h2>Organização</h2><label>Categoria<select aria-label="Categoria" value={draft.category_id || categories.find(item => item.name === draft.category)?.id || ''} onChange={event => { const next = categories.find(item => item.id === Number(event.target.value)); if (next) update({ category:next.name,category_id:next.id }); }}><option value="" disabled>Selecione</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="cms-checkbox"><input type="checkbox" checked={!!draft.featured} onChange={event => update({ featured:event.target.checked })} />Destacar na capa do blog</label>
      <label>Adicionar tag<input value={tagInput} list="cms-tags" onChange={event => setTagInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addTag(tagInput); } }} /></label><datalist id="cms-tags">{tags.map(tag => <option key={tag.slug} value={tag.name} />)}</datalist><button type="button" onClick={() => addTag(tagInput)}>Adicionar tag</button><div className="cms-tags">{draft.tags?.map(tag => <button type="button" key={tag} onClick={() => update({ tags:draft.tags?.filter(item => item !== tag) })} aria-label={`Remover tag ${tag}`}>{tag} ×</button>)}</div>
    </section><section className="cms-panel cms-cover-panel"><h2>Imagem de capa</h2><MediaUploader label="Escolher imagem" value={draft.image} onChange={image => update({ image })} onBusy={onBusy} /><label>Texto alternativo<input value={draft.cover_alt || ''} onChange={event => update({ cover_alt:event.target.value })} placeholder="Descreva a imagem" /></label></section>
    <section className="cms-panel"><h2>SEO</h2><label>Título SEO<input value={draft.seo_title || ''} onChange={event => update({ seo_title:event.target.value })} placeholder={draft.title} /></label><label>Descrição SEO<textarea value={draft.seo_description || ''} onChange={event => update({ seo_description:event.target.value })} placeholder={draft.excerpt} /></label><MediaUploader label="Imagem social (opcional)" value={draft.seo_image || ''} onChange={seo_image => update({ seo_image })} onBusy={onBusy} /><div className="cms-seo-preview"><small>lendosaficos.com.br › blog › {slugify(draft.slug || draft.title)}</small><b>{draft.seo_title || draft.title || 'Título da matéria'}</b><p>{draft.seo_description || draft.excerpt || 'Descrição da matéria'}</p></div></section>
    </aside></div><p role="status" aria-live="polite" className="cms-feedback">{message}</p></form>{preview && <ArticlePreview article={preview} onClose={() => setPreview(null)} />}
  </div>;
}
