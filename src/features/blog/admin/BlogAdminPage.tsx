import { useCallback, useEffect, useState } from 'react';
import type { AdminFilters, Article, ArticleBlock, ArticleDraft, ArticlePage, Category, Media, Tag } from '../types';
import { changeStatus, clearWorkingDraft, createCategory, deleteArticle, duplicateArticle, getArticles, getTaxonomy, getWorkingDraft, listMedia, removeUnusedMedia, renameCategory } from '../services';
import { effectiveStatus, formatDate, safeImage } from '../utils';
import { ArticleEditor } from '../editor/ArticleEditor';
import { ArticlePreview } from '../components/ArticlePreview';
import { Modal } from '../components/Modal';
import { OverviewPanel, getArticleViewCounts } from './OverviewPanel';
import { TaxonomyPanel } from './TaxonomyPanel';
import { MediaPanel } from './MediaPanel';
import { SettingsPanel } from './SettingsPanel';
import { UsersPanel } from './UsersPanel';
import { getCurrentTeamRole } from './adminSettingsServices';
import './admin.css';

type AdminSection = 'overview' | 'posts' | 'categories' | 'media' | 'users' | 'settings';
const adminSections: { id: AdminSection; label: string; icon: string }[] = [
  { id:'overview',label:'Visão geral',icon:'◫' },
  { id:'posts',label:'Posts',icon:'▤' },
  { id:'categories',label:'Categorias e tags',icon:'♧' },
  { id:'media',label:'Imagens',icon:'▧' },
  { id:'users',label:'Usuários',icon:'♙' },
  { id:'settings',label:'Configurações',icon:'⚙' },
];
const sectionFromPath = (): AdminSection => {
  const segment = window.location.pathname.split('/')[2];
  return adminSections.find(section => section.id === segment)?.id || 'overview';
};

const initialFilters: AdminFilters = { search:'',category:'',tag:'',status:'Todos',featured:'Todos',sort:'recent',page:1 };
export function BlogAdminPage({ template, onLogout }: { template: ArticleBlock[]; onLogout: () => Promise<void> }) {
  const [section,setSection] = useState<AdminSection>(sectionFromPath);
  const [teamRole,setTeamRole] = useState<'admin' | 'author' | null>(null);
  const visibleSections = adminSections.filter(item => teamRole === 'admin' || (item.id !== 'users' && item.id !== 'settings'));
  const [filters,setFilters] = useState(initialFilters);
  const [debounced,setDebounced] = useState(filters);
  const [page,setPage] = useState<ArticlePage>({articles:[],total:0,counts:{}});
  const [viewCounts,setViewCounts] = useState<Record<number,number> | null>(null);
  const [taxonomy,setTaxonomy] = useState<{categories:Category[];tags:Tag[]}>({categories:[],tags:[]});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
  const [revision,setRevision] = useState(0);
  const [editor,setEditor] = useState<{article:Article|null;draft:ArticleDraft|null}|null>(null);
  const [conflict,setConflict] = useState<{article:Article;draft:ArticleDraft}|null>(null);
  const [preview,setPreview] = useState<Article|null>(null);
  const [manager,setManager] = useState<'categories'|'media'|null>(null);
  const [categoryName,setCategoryName] = useState('');
  const [categoryId,setCategoryId] = useState<number|null>(null);
  const [media,setMedia] = useState<Media[]>([]);
  const [mediaPage,setMediaPage] = useState(1);
  const [busy,setBusy] = useState(false);
  const refresh = useCallback(() => setRevision(current => current+1),[]);
  useEffect(() => { void getCurrentTeamRole().then(setTeamRole).catch(() => setTeamRole(null)); },[]);
  useEffect(() => { const sync = () => setSection(sectionFromPath()); window.addEventListener('popstate',sync); return () => window.removeEventListener('popstate',sync); },[]);
  const navigate = (next: AdminSection) => {
    if (editor && !window.confirm('Sair da edição e abrir outra seção? Suas alterações automáticas ficarão preservadas.')) return;
    setEditor(null); setSection(next);
    const path = next === 'overview' ? '/admin' : `/admin/${next}`;
    if (window.location.pathname !== path) window.history.pushState({},'',path);
  };
  useEffect(() => { const timer = setTimeout(() => setDebounced(filters),300); return () => clearTimeout(timer); },[filters]);
  useEffect(() => {
    if (section !== 'posts') return;
    let cancelled = false; setLoading(true); setError('');
    Promise.all([getArticles(debounced,true),getTaxonomy()]).then(([data,taxonomies]) => { if (!cancelled) { setPage(data); setTaxonomy(taxonomies); } }).catch(reason => { if (!cancelled) { setPage({articles:[],total:0,counts:{}}); setError(reason.message); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  },[debounced,revision,section]);
  useEffect(() => {
    if (section !== 'posts' || loading || error || !page.articles.length) return;
    let active = true;
    void getArticleViewCounts(page.articles.map(article => article.id)).then(counts => { if (active) setViewCounts(counts); }).catch(() => { if (active) setViewCounts(null); });
    return () => { active = false; };
  },[section,loading,error,page.articles]);
  const filter = (values: Partial<AdminFilters>) => setFilters(current => ({...current,...values,page:values.page || 1}));
  const action = async (operation: () => Promise<unknown>, success: string) => {
    document.querySelectorAll<HTMLDetailsElement>('.cms-row-actions details[open]').forEach(menu => { menu.open=false; });
    setBusy(true); setMessage('Processando…');
    try { await operation(); setMessage(success); refresh(); }
    catch(reason) { setMessage(reason instanceof Error ? reason.message : 'A operação falhou.'); }
    finally { setBusy(false); }
  };
  const openEditor = async (article: Article) => {
    if (article.status === 'Lixeira') { setMessage('Restaure a matéria antes de editar.'); return; }
    setBusy(true);
    try { const working = await getWorkingDraft(article); if (working.conflict && working.draft) setConflict({article,draft:working.draft}); else setEditor({article,draft:working.draft}); }
    catch(reason) { setMessage(reason instanceof Error ? reason.message : 'Não foi possível abrir a edição.'); }
    finally { setBusy(false); }
  };
  return <div className="cms-admin-shell"><aside className="cms-admin-sidebar" aria-label="Painel editorial"><div className="cms-admin-brand"><a href="/admin" onClick={event => { event.preventDefault(); navigate('overview'); }}>Lendo Sáficos<span>.</span></a><small>Painel editorial</small></div><nav aria-label="Seções do painel">{visibleSections.map(item => <a key={item.id} href={item.id === 'overview' ? '/admin' : `/admin/${item.id}`} aria-current={section === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(item.id); }}><span aria-hidden="true">{item.icon}</span>{item.label}</a>)}</nav><div className="cms-admin-sidebar-footer"><a href="/blog" target="_blank" rel="noopener noreferrer">Ver blog ↗</a><button type="button" onClick={() => void onLogout()}>Sair</button></div></aside><div className="cms-admin-content"><div className="cms-admin-mobile-top"><a href="/blog" target="_blank" rel="noopener noreferrer">Ver blog ↗</a><button type="button" onClick={() => void onLogout()}>Sair</button></div><nav className="cms-admin-mobile-nav" aria-label="Seções do painel">{visibleSections.map(item => <a key={item.id} href={item.id === 'overview' ? '/admin' : `/admin/${item.id}`} aria-current={section === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(item.id); }}>{item.label}</a>)}</nav><main className="cms-admin wrap">{editor ? <ArticleEditor key={editor.article?.id || 'new'} article={editor.article} workingDraft={editor.draft} categories={taxonomy.categories} tags={taxonomy.tags} template={template} onClose={() => { setEditor(null); refresh(); }} onSaved={refresh} /> : section === 'overview' ? <OverviewPanel onNewArticle={() => { navigate('posts'); setEditor({article:null,draft:null}); }} onEditArticle={article => { navigate('posts'); void openEditor(article); }} /> : section === 'categories' ? <TaxonomyPanel /> : section === 'media' ? <MediaPanel /> : section === 'users' ? <UsersPanel /> : section === 'settings' ? <SettingsPanel /> : <>
    <div className="cms-dashboard-heading"><div><p className="eyebrow">Conteúdo</p><h1>Posts</h1><p>Todo o acervo do blog — publique, edite e organize suas matérias.</p></div><div><button className="button button-primary" disabled={loading || !!error || busy} onClick={() => setEditor({article:null,draft:null})}>+ Novo artigo</button></div></div>
    <div className="cms-post-tabs" role="group" aria-label="Filtrar posts por status">{(['Todos','Publicado','Rascunho'] as const).map(status => <button key={status} type="button" aria-pressed={filters.status === status} onClick={() => filter({status})}>{status === 'Publicado' ? 'Publicados' : status === 'Rascunho' ? 'Rascunhos' : 'Todos'}</button>)}</div>
    <div className="cms-indicators">{(['Publicado','Rascunho','Agendado','Suspenso'] as const).map(status => <button key={status} aria-pressed={filters.status === status} onClick={() => filter({status})}><strong>{page.counts[status] || 0}</strong><span>{({Publicado:'Publicadas',Rascunho:'Rascunhos',Agendado:'Agendadas',Suspenso:'Suspensas'})[status]}</span></button>)}</div>
    <section className="cms-panel cms-filters" aria-label="Filtros das matérias"><label>Pesquisar<input type="search" value={filters.search} onChange={event => filter({search:event.target.value})} placeholder="Título, resumo, categoria, tags ou slug" /></label><label>Status<select aria-label="Status" value={filters.status} onChange={event => filter({status:event.target.value as AdminFilters['status']})}>{['Todos','Publicado','Rascunho','Agendado','Suspenso','Lixeira'].map(status => <option key={status}>{status}</option>)}</select></label><label>Categoria<select aria-label="Categoria" value={filters.category} onChange={event => filter({category:event.target.value})}><option value="">Todas</option>{taxonomy.categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><label>Destaque<select aria-label="Destaque" value={filters.featured} onChange={event => filter({featured:event.target.value as AdminFilters['featured']})}><option>Todos</option><option>Destacados</option><option>Não destacados</option></select></label><label>Ordenar<select aria-label="Ordenar" value={filters.sort} onChange={event => filter({sort:event.target.value as AdminFilters['sort']})}><option value="recent">Mais recentes</option><option value="oldest">Mais antigas</option><option value="updated">Atualizadas recentemente</option><option value="az">Título A–Z</option><option value="za">Título Z–A</option></select></label></section>
    <div className="cms-list-heading"><p>{page.total} matérias · Página {filters.page}</p><div><button disabled={busy} onClick={() => { setCategoryName(''); setCategoryId(null); setManager('categories'); }}>Categorias</button><button disabled={busy} onClick={() => void action(async () => { setMedia(await listMedia()); setMediaPage(1); setManager('media'); },'Biblioteca carregada.')}>Biblioteca de imagens</button></div></div>
    {loading && <p role="status">Carregando matérias…</p>}{error && <div role="alert"><p>{error}</p><p>Confirme se a migração do CMS foi aplicada no Supabase.</p><button onClick={refresh}>Tentar novamente</button></div>}
    {!loading && !error && <section className="cms-article-list" aria-label="Matérias">{page.articles.length ? page.articles.map(article => <article key={article.id}><img src={safeImage(article.image)} alt={article.cover_alt || ''} /><div><span className={`cms-status status-${effectiveStatus(article).toLowerCase()}`}>{effectiveStatus(article)}</span>{article.featured && <small> ★ Destaque</small>}<h2>{article.title}</h2><p>{article.category} {article.tags?.length ? `· ${article.tags.join(', ')}` : ''}</p><small>Publicação: {formatDate(article.status === 'Agendado' ? article.scheduled_at : article.published_at)} · Atualização: {formatDate(article.updated_at)} · Leituras: {viewCounts?.[article.id] === undefined ? '—' : new Intl.NumberFormat('pt-BR').format(viewCounts[article.id])}</small></div><div className="cms-row-actions"><button disabled={busy} onClick={() => void openEditor(article)}>Editar</button><details><summary aria-label={`Mais ações para ${article.title}`}>•••</summary><div><button onClick={() => setPreview(article)}>Visualizar</button><button disabled={busy} onClick={() => void action(() => duplicateArticle(article),'Cópia criada como rascunho.')}>Duplicar</button>{article.status === 'Lixeira' ? <><button disabled={busy} onClick={() => void action(() => changeStatus(article,'Rascunho'),'Restaurada como rascunho.')}>Restaurar</button><button disabled={busy} onClick={() => { if (window.confirm(`Excluir definitivamente “${article.title}”? Não será possível recuperar.`)) void action(() => deleteArticle(article),'Matéria excluída definitivamente. Imagens preservadas na biblioteca.'); }}>Excluir definitivamente</button></> : <>{effectiveStatus(article) !== 'Publicado' && <button disabled={busy} onClick={() => void action(() => changeStatus(article,'Publicado'),'Matéria publicada.')}>Publicar</button>}{(effectiveStatus(article) === 'Publicado' || article.status === 'Agendado') && <button disabled={busy} onClick={() => void action(() => changeStatus(article,'Suspenso'),'Matéria suspensa.')}>Suspender</button>}<button disabled={busy} onClick={() => void action(() => changeStatus(article,'Lixeira'),'Enviada à lixeira. Você pode restaurá-la.')}>Enviar para lixeira</button></>}</div></details></div></article>) : <p>Nenhuma matéria encontrada. Ajuste os filtros ou crie uma nova.</p>}</section>}
    <nav className="cms-pagination" aria-label="Paginação administrativa"><button disabled={loading || filters.page <= 1} onClick={() => filter({page:filters.page-1})}>Anterior</button><span>{filters.page} de {Math.max(1,Math.ceil(page.total/12))}</span><button disabled={loading || filters.page*12 >= page.total} onClick={() => filter({page:filters.page+1})}>Próxima</button></nav>
  </>}<p className="cms-feedback" role="status" aria-live="polite">{message}</p></main></div>
    {preview && <ArticlePreview article={preview} onClose={() => setPreview(null)} />}
    {conflict && <Modal title="A matéria foi alterada em outra sessão" onClose={() => setConflict(null)}><p>Sua edição automática foi feita sobre uma versão anterior. Confira as duas versões antes de escolher.</p><p><b>Versão atual:</b> {conflict.article.title} · {conflict.article.excerpt}</p><p><b>Sua edição:</b> {conflict.draft.title} · {conflict.draft.excerpt}</p><button onClick={() => setPreview(conflict.article)}>Ver versão atual</button><button onClick={() => setPreview({ ...conflict.article,...conflict.draft })}>Ver minha edição</button><button onClick={() => { setEditor({article:conflict.article,draft:conflict.draft}); setConflict(null); }}>Recuperar minha edição para revisar</button><button disabled={busy} onClick={() => { if (window.confirm('Descartar seu rascunho de edição e abrir a versão atual?')) void action(async () => { await clearWorkingDraft(conflict.article.id); setEditor({article:conflict.article,draft:null}); setConflict(null); },'Versão atual aberta.'); }}>Descartar minha edição e abrir versão atual</button><p>Recuperar não publica automaticamente. Um salvamento explícito aplica sua edição sobre a versão atual.</p></Modal>}
    {manager === 'categories' && <Modal title="Categorias" onClose={() => setManager(null)}><form onSubmit={event => { event.preventDefault(); void action(async () => { if (categoryId) await renameCategory(categoryId,categoryName); else await createCategory(categoryName); setCategoryName(''); setCategoryId(null); },'Categoria salva.'); }}><label>Nome da categoria<input required value={categoryName} onChange={event => setCategoryName(event.target.value)} /></label><button disabled={busy}>{categoryId ? 'Renomear categoria' : 'Criar categoria'}</button></form><p>Renomear atualiza também as matérias vinculadas.</p>{taxonomy.categories.map(category => <p key={category.id}>{category.name} <button onClick={() => { setCategoryName(category.name); setCategoryId(category.id); }}>Renomear</button></p>)}</Modal>}
    {manager === 'media' && <Modal title="Biblioteca de imagens" onClose={() => setManager(null)}><p>Arquivos enviados podem ser reutilizados copiando o endereço. A exclusão verifica matérias e rascunhos de edição no banco.</p><div className="cms-media-library">{media.map(file => <article key={file.path}><img src={file.url} alt={file.name} /><small>{file.name}</small><small>{file.referenced ? 'Em uso por uma matéria/edição' : 'Sem associação salva'}</small><button onClick={() => void action(() => navigator.clipboard.writeText(file.url),'Endereço copiado.')}>Copiar endereço</button><button disabled={busy || !!file.referenced} onClick={() => { if (window.confirm('Excluir esta imagem da biblioteca? A operação só será permitida se não houver referências salvas.')) void action(async () => { await removeUnusedMedia(file.path); setMedia(await listMedia(mediaPage)); },'Imagem não utilizada removida.'); }}>Excluir se não utilizada</button></article>)}</div><nav className="cms-pagination"><button disabled={busy || mediaPage <= 1} onClick={() => void action(async () => { const nextPage=mediaPage-1; setMedia(await listMedia(nextPage)); setMediaPage(nextPage); },'Biblioteca carregada.')}>Anterior</button><span>Página {mediaPage}</span><button disabled={busy || media.length < 24} onClick={() => void action(async () => { const nextPage=mediaPage+1; setMedia(await listMedia(nextPage)); setMediaPage(nextPage); },'Biblioteca carregada.')}>Próxima</button></nav></Modal>}
  </div>;
}
