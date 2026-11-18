import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Article, ArticlePage, Category, Tag } from './types';
import { getArticleBySlug, getArticles, getRelated, getTaxonomy } from './services';
import { articleHref, isPublic, safeImage } from './utils';
import { BlockRenderer } from './components/BlockRenderer';
import { CommentsSection } from './components/CommentsSection';
import { defaultPublicBlogSettings, getPublicBlogSettings } from './publicSettings';
import type { PublicBlogSettings } from './publicSettings';

function routeState() {
  const params = new URLSearchParams(window.location.search);
  const segment = window.location.pathname.split('/')[2] || '';
  let slug = segment; try { slug = decodeURIComponent(segment); } catch { slug = 'endereco-invalido'; }
  return { slug, search:params.get('q') || '',category:params.get('categoria') || '',tag:params.get('tag') || '',page:Math.max(1,Math.floor(Number(params.get('pagina')) || 1)) };
}
function PublicMetadata({ article,notFound=false,settings=defaultPublicBlogSettings }: { article?: Article | null;notFound?:boolean;settings?:PublicBlogSettings }) {
  useEffect(() => {
    const base = 'https://www.lendosaficos.com.br';
    const title = notFound ? 'Matéria não encontrada | Lendo Sáficos' : article ? `${article.seo_title || article.title} | Lendo Sáficos` : settings.blog_name === 'Lendo Sáficos' ? 'Blog de Literatura Sáfica: Livros, Autoras e Novidades | Lendo Sáficos' : `${settings.blog_name} | Blog`;
    const description = article?.seo_description || article?.excerpt || settings.description;
    const url = `${base}${article ? articleHref(article) : '/blog'}`;
    const image = safeImage(article?.seo_image || article?.image || '/images/5.jpeg');
    const absoluteImage = image.startsWith('/') ? `${base}${image}` : image;
    document.title = title;
    const set = (attribute: string,key: string,value: string) => {
      let node = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      if (!node) { node = document.createElement('meta'); node.setAttribute(attribute,key); document.head.appendChild(node); }
      node.content = value;
    };
    set('name','description',description); set('name','robots',notFound ? 'noindex, nofollow' : 'index, follow');
    for (const [key,value] of Object.entries({title,description,url,image:absoluteImage,type:article ? 'article' : 'website'})) set('property',`og:${key}`,value);
    for (const [key,value] of Object.entries({title,description,image:absoluteImage,card:'summary_large_image'})) set('name',`twitter:${key}`,value);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel='canonical'; document.head.appendChild(canonical); } canonical.href=url;
    document.getElementById('blog-jsonld')?.remove();
    if (article) {
      const script = document.createElement('script'); script.id='blog-jsonld'; script.type='application/ld+json';
      script.textContent=JSON.stringify({'@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description,image:absoluteImage,datePublished:article.status === 'Agendado' ? article.scheduled_at : article.published_at,dateModified:article.updated_at,author:article.author_name ? {'@type':'Person',name:article.author_name} : undefined,url,mainEntityOfPage:url});
      document.head.appendChild(script);
    }
    return () => { document.getElementById('blog-jsonld')?.remove(); };
  },[article,notFound,settings]);
  return null;
}
export function BlogPage({ header,footer }: { header:ReactNode;footer:ReactNode }) {
  const [route,setRoute] = useState(routeState);
  const [search,setSearch] = useState(route.search);
  const [page,setPage] = useState<ArticlePage>({articles:[],total:0,counts:{}});
  const [selected,setSelected] = useState<Article|null>(null);
  const [related,setRelated] = useState<Article[]>([]);
  const [taxonomy,setTaxonomy] = useState<{categories:Category[];tags:Tag[]}>({categories:[],tags:[]});
  const [settings,setSettings] = useState<PublicBlogSettings>(defaultPublicBlogSettings);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  useEffect(() => { const sync = () => { const next = routeState(); setRoute(next); setSearch(next.search); }; window.addEventListener('popstate',sync); return () => window.removeEventListener('popstate',sync); },[]);
  const navigate = (url:string) => { window.history.pushState({},'',url); const next = routeState(); setRoute(next); setSearch(next.search); };
  const filters = (values: Partial<typeof route>) => {
    const next = {...route,...values,slug:'',page:values.page || 1}; const params = new URLSearchParams();
    if (next.search) params.set('q',next.search); if (next.category) params.set('categoria',next.category); if (next.tag) params.set('tag',next.tag); if (next.page > 1) params.set('pagina',String(next.page));
    navigate(`/blog${params.size ? `?${params}` : ''}`);
  };
  useEffect(() => {
    let cancelled = false; setLoading(true); setError(''); setSelected(null); setRelated([]);
    const load = async () => {
      const publicSettings = await getPublicBlogSettings();
      if (!cancelled) setSettings(publicSettings);
      if (route.slug) {
        const article = await getArticleBySlug(route.slug);
        if (!cancelled && article && isPublic(article)) { setSelected(article); const suggestions = await getRelated(article); if (!cancelled) setRelated(suggestions); }
      } else {
        const data = await getArticles({search:route.search,category:route.category,tag:route.tag,status:'Todos',featured:'Todos',sort:'recent',page:route.page},false,publicSettings.posts_per_page);
        if (!cancelled) setPage(data);
      }
      const taxonomies = await getTaxonomy(); if (!cancelled) setTaxonomy(taxonomies);
    };
    void load().catch(reason => { if (!cancelled) { setError(reason.message || 'Falha ao carregar o blog.'); setPage({articles:[],total:0,counts:{}}); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled=true; };
  },[route,revision]);
  const open = (event:React.MouseEvent<HTMLAnchorElement>,article:Article) => { if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate(articleHref(article)); window.scrollTo({top:0,behavior:'smooth'}); };
  const effectiveCommentsMode = selected?.comments_mode && selected.comments_mode !== 'inherit' ? selected.comments_mode : settings.comments_mode;
  return <><PublicMetadata article={selected} settings={settings} notFound={!!route.slug && !selected && !loading && !error} />{header}{loading ? <main className="blog wrap"><p role="status">Carregando matérias…</p></main> : error ? <main className="blog wrap"><p role="alert">{error}</p><button onClick={() => setRevision(current => current+1)}>Tentar novamente</button></main> : route.slug ? selected ? <main className="article-page cms-article"><button className="back-link" onClick={() => navigate('/blog')}>← Voltar para notícias</button><button className="category-tag" onClick={() => filters({category:selected.category})}>{selected.category}</button><h1>{selected.title}</h1><div className="article-byline"><time dateTime={selected.status === 'Agendado' ? selected.scheduled_at || undefined : selected.published_at || undefined}>{new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date((selected.status === 'Agendado' ? selected.scheduled_at : selected.published_at) || selected.created_at || Date.now()))}</time><span>Por {selected.author_name || 'Equipe Lendo Sáficos'}</span>{effectiveCommentsMode !== 'off' && <a href="#comentarios">Deixe um comentário</a>}</div><p className="article-lead">{selected.excerpt}</p>{safeImage(selected.image) && <img className="article-cover" src={safeImage(selected.image)} alt={selected.cover_alt || ''} />}<div className="cms-tags">{selected.tags?.map(tag => <button key={tag} onClick={() => filters({tag})}>{tag} </button>)}</div><BlockRenderer blocks={selected.blocks} /><nav className="article-navigation"><a className="text-link" href="/blog">← Voltar para todas as notícias</a></nav><CommentsSection slug={selected.slug || articleHref(selected).split('/').pop() || String(selected.id)} mode={effectiveCommentsMode} />{related.length > 0 && <section className="related-articles"><h2>Você também pode gostar</h2><div>{related.map(article => <a key={article.id} href={articleHref(article)} onClick={event => open(event,article)}><img src={safeImage(article.image)} alt={article.cover_alt || ''} loading="lazy" /><span><small>{article.category}</small><b>{article.title}</b><em>Ler matéria →</em></span></a>)}</div></section>}</main> : <main className="blog wrap"><h1>Matéria não encontrada</h1><p>Esta matéria não existe ou não está disponível para leitura.</p><a className="button button-primary" href="/blog">Voltar ao blog</a></main> : <main className="blog wrap"><header className="blog-intro"><p className="eyebrow">Notícias {settings.blog_name}</p><h1>Histórias para<br /><em>ler e descobrir.</em></h1><p>{settings.tagline}</p><p>{settings.description}</p></header><div className="news-tools"><form className="news-search" onSubmit={event => { event.preventDefault(); filters({search}); }}><label className="cms-sr-only" htmlFor="blog-search">Buscar notícias</label><span aria-hidden="true">⌕</span><input id="blog-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar livros, temas ou categorias" /><button type="submit">Buscar</button></form><nav className="category-menu" aria-label="Categorias"><button className={!route.category ? 'active' : ''} onClick={() => filters({category:''})}>Todas</button>{taxonomy.categories.map(category => <button className={route.category === category.name || route.category === category.slug ? 'active' : ''} key={category.id} onClick={() => filters({category:category.slug})}>{category.name}</button>)}</nav></div><label className="cms-public-tag">Filtrar por tag<select aria-label="Filtrar por tag" value={route.tag} onChange={event => filters({tag:event.target.value})}><option value="">Todas</option>{taxonomy.tags.map(tag => <option key={tag.slug}>{tag.name}</option>)}</select></label><section className="blog-results"><p>{route.category ? `Notícias em ${route.category}` : 'Todas as notícias'}{route.search && ` para “${route.search}”`}</p><span>{page.total} {page.total === 1 ? 'matéria encontrada' : 'matérias encontradas'}</span></section><section className="blog-grid">{page.articles.map((article,index) => <a key={article.id} href={articleHref(article)} className={index === 0 && article.featured ? 'blog-card blog-card-featured' : 'blog-card'} onClick={event => open(event,article)}><img src={safeImage(article.image)} alt={article.cover_alt || ''} loading="lazy" /><div><span className="category-tag">{article.category}{article.featured ? ' · Destaque' : ''}</span><h2>{article.title}</h2><p>{article.excerpt}</p><span className="read-link">Ler matéria →</span></div></a>)}</section>{!page.total && <p>Nenhuma matéria encontrada. Tente outro termo ou categoria.</p>}<nav className="cms-pagination" aria-label="Paginação do blog"><button disabled={route.page <= 1} onClick={() => filters({page:route.page-1})}>Anterior</button><span>{route.page} de {Math.max(1,Math.ceil(page.total/settings.posts_per_page))}</span><button disabled={route.page*settings.posts_per_page >= page.total} onClick={() => filters({page:route.page+1})}>Próxima</button></nav></main>}{footer}</>;
}
