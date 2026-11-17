import { BASE_URL, applyMetadata, articlePath, escapeHtml, safeImage, withBlogChrome } from '../server/blog-html.mjs';
import { freshResponse, getTemplate, publicClient } from '../server/blog-runtime.mjs';

export default async function handler(request,response) {
  freshResponse(response,'text/html; charset=utf-8');
  try {
    const params=new URL(request.url,BASE_URL).searchParams;
    const page=Math.max(1,Number(params.get('pagina')) || 1);
    const db=publicClient();
    const settingsResult=await db.rpc('blog_public_settings');
    const settings=settingsResult.error || !settingsResult.data ? {} : settingsResult.data;
    const blogName=String(settings.blog_name || 'Lendo Sáficos');
    const tagline=String(settings.tagline || '');
    const description=String(settings.description || 'Notícias, listas, lançamentos e recomendações de literatura sáfica para encontrar sua próxima leitura.');
    const pageSize=Math.min(40,Math.max(3,Number(settings.posts_per_page) || 12));
    const {data,error}=await db.rpc('search_blog_articles',{query_text:params.get('q') || '',category_filter:params.get('categoria') || '',tag_filter:params.get('tag') || '',page_number:page,page_size:pageSize});
    if (error) throw error;
    const cards=data.articles.map(article => `<a class="blog-card${article.featured ? ' blog-card-featured' : ''}" href="${escapeHtml(articlePath(article))}">${safeImage(article.image) ? `<img src="${escapeHtml(safeImage(article.image))}" alt="${escapeHtml(article.cover_alt)}">` : ''}<div><span class="category-tag">${escapeHtml(article.category)}</span><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.excerpt)}</p><span class="read-link">Ler matéria →</span></div></a>`).join('');
    const pageLink=next => { const target=new URLSearchParams(params); target.set('pagina',String(next)); return '/blog?'+target; };
    const body=`<main class="blog wrap"><header class="blog-intro"><p class="eyebrow">Notícias ${escapeHtml(blogName)}</p><h1>Histórias para<br><em>ler e descobrir.</em></h1>${tagline ? `<p>${escapeHtml(tagline)}</p>` : ''}<p>${escapeHtml(description)}</p></header><form action="/blog"><label>Buscar notícias <input name="q" value="${escapeHtml(params.get('q') || '')}"></label><button>Buscar</button></form><p>${data.total} matérias encontradas</p><section class="blog-grid">${cards || '<p>Nenhuma matéria encontrada.</p>'}</section><nav>${page > 1 ? `<a href="${escapeHtml(pageLink(page-1))}">Anterior</a>` : ''} ${page*pageSize < data.total ? `<a href="${escapeHtml(pageLink(page+1))}">Próxima</a>` : ''}</nav></main>`;
    const title=blogName === 'Lendo Sáficos' ? 'Blog de Literatura Sáfica: Livros, Autoras e Novidades | Lendo Sáficos' : `${blogName} | Blog`;
    const html=applyMetadata(await getTemplate(),{title,description,image:'/images/5.jpeg',path:'/blog'});
    response.status(200).send(html.replace('<div id="root"></div>',`<div id="root">${withBlogChrome(body)}</div>`));
  } catch(error) { console.error('[blog-index]',error.message); response.status(503).send('<!doctype html><html lang="pt-BR"><meta name="robots" content="noindex"><title>Blog indisponível</title><p>Não foi possível carregar o blog. Tente novamente.</p></html>'); }
}
