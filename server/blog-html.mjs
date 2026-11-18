import sanitizeHtml from 'sanitize-html';

export const BASE_URL = 'https://www.lendosaficos.com.br';
export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export function safeUrl(value = '') {
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export const safeImage = (value = '') => /^\/(?!\/)[^\s]*$/.test(value) ? value : safeUrl(value);
export const absoluteImage = value => { const image = safeImage(value); return image.startsWith('/') ? BASE_URL+image : image; };
export const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const articlePath = article => `/blog/${article.slug || `${slugify(article.title)}-${article.id}`}`;
export function withBlogChrome(body) {
  return `<header class="site-header"><a class="brand" href="/" aria-label="Lendo Sáficos, página inicial"><img src="/site-assets/lendo-saficos-logo.png" alt="Lendo Sáficos"></a><nav class="main-nav" aria-label="Navegação principal"><a href="/">Início</a><a href="${BASE_URL}/lista120livrossaficos">Lançamentos</a><a href="${BASE_URL}/clubedascolecionadoras">Clube das Colecionadoras</a><a href="${BASE_URL}/mapasaficobienal">Mapa Sáfico</a><a href="/blog">Blog</a></nav></header>${body}<footer class="site-footer"><img src="/images/favicon.png" alt="Lendo Sáficos"><span>© 2026 Lendo Sáficos. Todos os direitos reservados.</span><span>Desenvolvido por <a href="https://carolgonzaga.site/" target="_blank" rel="noopener noreferrer">CarolGonzaga</a></span></footer>`;
}
export const isPublic = (article, now = Date.now()) => !article.deleted_at && (article.editorial_status ? article.editorial_status === 'Publicado' : ((article.status === 'Publicado' && Date.parse(article.published_at || article.created_at || '1970-01-01') <= now) || (article.status === 'Agendado' && !!article.scheduled_at && Date.parse(article.scheduled_at) <= now)));
export const sanitize = value => sanitizeHtml(value || '', {
  allowedTags: ['p','br','b','strong','i','em','u','span','font','a','h2','h3','ul','ol','li','blockquote'],
  allowedAttributes: { a: ['href','target','rel'], span: ['style'], font: ['color','size'], p: ['style'], h2: ['style'], h3: ['style'] },
  allowedSchemes: ['http','https'],
  allowedStyles: {
    '*': {
      color: [/^#[a-f0-9]{3,8}$/i, /^[a-z]+$/i, /^rgba?\([\d.,%\s]+\)$/i, /^hsla?\([\d.,%\s]+\)$/i],
      'font-size': [/^\d+(?:\.\d+)?(?:px|em|rem|%)$/i],
      'text-align': [/^(?:left|right|center|justify)$/i],
    },
  },
  transformTags: { a: (_tag, attributes) => ({ tagName: 'a', attribs: { ...attributes, rel: 'noopener noreferrer' } }) },
});

export function renderBlocks(blocks = []) {
  return `<div class="article-blocks cms-blocks">${blocks.map(block => {
    let content = '';
    const link = (url,title,classname='') => safeUrl(url) ? `<a class="${classname}" href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>` : escapeHtml(title);
    switch(block.type) {
      case 'text': content=sanitize(block.content); break;
      case 'h2': case 'h3': content=`<${block.type}>${escapeHtml(block.content)}</${block.type}>`; break;
      case 'quote': content=`<blockquote>${escapeHtml(block.content)}</blockquote>`; break;
      case 'divider': content='<hr>'; break;
      case 'bullets': case 'numbered': { const tag=block.type === 'bullets' ? 'ul' : 'ol'; content=`<${tag}>${(block.entries || []).map(entry => `<li>${escapeHtml(entry)}</li>`).join('')}</${tag}>`; break; }
      case 'image': content=`<figure>${safeImage(block.image) ? `<img src="${escapeHtml(safeImage(block.image))}" alt="${escapeHtml(block.alt)}" loading="lazy">` : ''}<figcaption>${escapeHtml(block.caption)} ${escapeHtml(block.credit)}</figcaption></figure>`; break;
      case 'button': content=link(block.url,block.title || 'Abrir link','button button-primary'); break;
      case 'linklist': content=`<section class="book-link-list"><h2>${escapeHtml(block.title)}</h2><div>${(block.items || []).map(item => link(item.url,item.title+' →')).join('')}</div></section>`; break;
      case 'product': content=`<article class="product-card">${safeImage(block.image) ? `<img src="${escapeHtml(safeImage(block.image))}" alt="${escapeHtml(block.title)}" loading="lazy">` : ''}<div><h3>${escapeHtml(block.title)}</h3><p>${escapeHtml(block.price)}</p>${link(block.url,'Ver produto →','button button-primary')}</div></article>`; break;
    }
    const align=['left','center','right','justify'].includes(block.align) ? block.align : 'left';
    const span=[4,6,8,12].includes(block.span) ? block.span : 12;
    return `<div class="article-block cms-block" style="text-align:${align};--cms-span:span ${span}">${content}</div>`;
  }).join('')}</div>`;
}

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
  return `<main class="article-page cms-article"><a class="back-link" href="/blog">← Voltar ao blog</a><span class="category-tag">${escapeHtml(article.category)}</span><h1>${escapeHtml(article.title)}</h1><p class="article-lead">${escapeHtml(article.excerpt)}</p>${safeImage(article.image) ? `<img class="article-cover" src="${escapeHtml(safeImage(article.image))}" alt="${escapeHtml(article.cover_alt)}">` : ''}${renderBlocks(article.blocks)}<a class="text-link" href="/blog">Voltar a todas as matérias</a></main>`;
}
export function articleHtml(template,article) {
  const path=articlePath(article);
  const description=article.seo_description || article.excerpt;
  const image=article.seo_image || article.image;
  const html=applyMetadata(template,{title:`${article.seo_title || article.title} | Lendo Sáficos`,description,image,path,type:'article',jsonld:{'@context':'https://schema.org','@type':'BlogPosting',headline:article.title,description,image:absoluteImage(image),datePublished:article.status === 'Agendado' ? article.scheduled_at : article.published_at,dateModified:article.updated_at,url:BASE_URL+path,mainEntityOfPage:BASE_URL+path}});
  return html.replace(/<div\b[^>]*id=["']root["'][^>]*>[\s\S]*?<\/div>/i,`<div id="root">${withBlogChrome(renderArticle(article))}</div>`);
}
export function buildSitemap(articles) {
  const routes=['/','/blog','/lista120livrossaficos','/clubedascolecionadoras','/mapasaficobienal'];
  const staticEntries=routes.map(path => `<url><loc>${BASE_URL+path}</loc></url>`).join('');
  const entries=articles.filter(article => isPublic(article)).map(article => `<url><loc>${escapeHtml(BASE_URL+articlePath(article))}</loc>${article.updated_at ? `<lastmod>${escapeHtml(article.updated_at)}</lastmod>` : ''}</url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${entries}</urlset>`;
}
