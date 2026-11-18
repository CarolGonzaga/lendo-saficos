import sanitizeHtml from 'sanitize-html';
import { escapeHtml, renderSharedBlocks, safeImage, safeUrl } from '../src/features/blog/block-presentation.mjs';
import { richAttributes, richStyles, richTags } from '../src/features/blog/rich-policy.mjs';

export { escapeHtml, safeImage, safeUrl };

export const BASE_URL = 'https://www.lendosaficos.com.br';
export const absoluteImage = value => { const image = safeImage(value); return image.startsWith('/') ? BASE_URL+image : image; };
export const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const articlePath = article => `/blog/${article.slug || `${slugify(article.title)}-${article.id}`}`;
export function withBlogChrome(body) {
  return `<header class="site-header"><a class="brand" href="/" aria-label="Lendo Sáficos, página inicial"><img src="/site-assets/lendo-saficos-logo.png" alt="Lendo Sáficos"></a><nav class="main-nav" aria-label="Navegação principal"><a href="/">Início</a><a href="${BASE_URL}/lista120livrossaficos">Lançamentos</a><a href="${BASE_URL}/clubedascolecionadoras">Clube das Colecionadoras</a><a href="${BASE_URL}/mapasaficobienal">Mapa Sáfico</a><a href="/blog">Blog</a></nav></header>${body}<footer class="site-footer"><img src="/images/favicon.png" alt="Lendo Sáficos"><span>© 2026 Lendo Sáficos. Todos os direitos reservados.</span><span>Desenvolvido por <a href="https://carolgonzaga.site/" target="_blank" rel="noopener noreferrer">CarolGonzaga</a></span></footer>`;
}
export const isPublic = (article, now = Date.now()) => !article.deleted_at && (article.editorial_status ? article.editorial_status === 'Publicado' : ((article.status === 'Publicado' && Date.parse(article.published_at || article.created_at || '1970-01-01') <= now) || (article.status === 'Agendado' && !!article.scheduled_at && Date.parse(article.scheduled_at) <= now)));
export const sanitize = value => sanitizeHtml(value || '', {
  allowedTags: richTags,
  allowedAttributes: richAttributes,
  allowedSchemes: ['http', 'https'],
  allowedStyles: { '*': richStyles },
  transformTags: { a: (_tag, attributes) => {
    const href = safeUrl(attributes.href);
    return { tagName: 'a', attribs: { ...attributes, href, rel: 'noopener noreferrer' } };
  } },
});

export const renderBlocks = (blocks = []) =>
  `<div class="cms-rendered-content">${renderSharedBlocks(blocks, sanitize)}</div>`;

export function applyMetadata(template,{title,description,image,path,type='website',noindex=false,jsonld}) {
  let html=template.replace(/<title>[\s\S]*?<\/title>/i,`<title>${escapeHtml(title)}</title>`);
  const tags = [
    ['name','description',description],['name','robots',noindex ? 'noindex, nofollow' : 'index, follow'],
    ['property','og:title',title],['property','og:description',description],['property','og:url',BASE_URL+path],['property','og:image',absoluteImage(image)],['property','og:type',type],
    ['name','twitter:title',title],['name','twitter:description',description],['name','twitter:image',absoluteImage(image)],['name','twitter:card','summary_large_image'],
  ];
  for (const [attribute,key,value] of tags) {
    const regex = new RegExp(`<meta\\b[^>]*${attribute}=["']${key}["'][^>]*>`, 'i');
    const tag=`<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
    html=regex.test(html) ? html.replace(regex,tag) : html.replace('</head>',`${tag}</head>`);
  }
  html=html.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi,'');
  html=html.replace('</head>',`<link rel="canonical" href="${escapeHtml(BASE_URL+path)}">${jsonld ? `<script id="blog-jsonld" type="application/ld+json">${JSON.stringify(jsonld).replace(/</g,'\\u003c')}</script>` : ''}</head>`);
  return html;
}
export function renderArticle(article) {
  const published = article.status === 'Agendado' ? article.scheduled_at : article.published_at;
  const date = published && !Number.isNaN(Date.parse(published)) ? new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}).format(new Date(published)) : '';
  const commentsMode = article.comments_effective_mode || (article.comments_mode === 'inherit' ? 'moderated' : article.comments_mode || 'moderated');
  const byline = `<div class="article-byline">${date ? `<time datetime="${escapeHtml(published)}">${escapeHtml(date)}</time>` : ''}<span>Por ${escapeHtml(article.author_name || 'Equipe Lendo Sáficos')}</span>${commentsMode !== 'off' ? '<a href="#comentarios">Deixe um comentário</a>' : ''}</div>`;
  const comments = commentsMode !== 'off' ? '<section class="blog-comments" id="comentarios"><h2>Comentários</h2><p>Carregando comentários…</p></section>' : '';
  return `<main class="article-page cms-article"><a class="back-link" href="/blog">← Voltar ao blog</a><span class="category-tag">${escapeHtml(article.category)}</span><h1>${escapeHtml(article.title)}</h1>${byline}<p class="article-lead">${escapeHtml(article.excerpt)}</p>${safeImage(article.image) ? `<img class="article-cover" src="${escapeHtml(safeImage(article.image))}" alt="${escapeHtml(article.cover_alt)}">` : ''}${renderBlocks(article.blocks)}<a class="text-link" href="/blog">Voltar a todas as matérias</a>${comments}</main>`;
}
export function articleHtml(template,article) {
  const path=articlePath(article);
  const description=article.seo_description || article.excerpt;
  const image=article.seo_image || article.image;
  const html=applyMetadata(template,{title:`${article.seo_title || article.title} | Lendo Sáficos`,description,image,path,type:'article',jsonld:{'@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description,image:absoluteImage(image),datePublished:article.status === 'Agendado' ? article.scheduled_at : article.published_at,dateModified:article.updated_at,url:BASE_URL+path,mainEntityOfPage:BASE_URL+path}});
  return html.replace(/<div\b[^>]*id=["']root["'][^>]*>[\s\S]*?<\/div>/i,() => `<div id="root">${withBlogChrome(renderArticle(article))}</div>`);
}
export function buildSitemap(articles) {
  const routes=['/','/blog','/lista120livrossaficos','/clubedascolecionadoras','/mapasaficobienal'];
  const staticEntries=routes.map(path => `<url><loc>${BASE_URL+path}</loc></url>`).join('');
  const entries=articles.filter(article => isPublic(article)).map(article => `<url><loc>${escapeHtml(BASE_URL+articlePath(article))}</loc>${article.updated_at ? `<lastmod>${escapeHtml(article.updated_at)}</lastmod>` : ''}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${entries}</urlset>`;
}
