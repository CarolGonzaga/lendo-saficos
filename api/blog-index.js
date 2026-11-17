import { BASE_URL, applyMetadata, articlePath, escapeHtml, safeImage, withBlogChrome } from '../server/blog-html.mjs';
import { freshResponse, getTemplate, publicClient } from '../server/blog-runtime.mjs';

export default async function handler(request,response) {
  freshResponse(response,'text/html; charset=utf-8');
  try {
    const params=new URL(request.url,BASE_URL).searchParams;
    const page=Math.max(1,Number(params.get('pagina')) || 1);
    const {data,error}=await publicClient().rpc('search_blog_articles',{query_text:params.get('q') || '',category_filter:params.get('categoria') || '',tag_filter:params.get('tag') || '',page_number:page,page_size:12});
    if (error) throw error;
    const cards=data.articles.map(article => `<a class="blog-card${article.featured ? ' blog-card-featured' : ''}" href="${escapeHtml(articlePath(article))}">${safeImage(article.image) ? `<img src="${escapeHtml(safeImage(article.image))}" alt="${escapeHtml(article.cover_alt)}">` : ''}<div><span class="category-tag">${escapeHtml(article.category)}</span><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.excerpt)}</p><span class="read-link">Ler matéria →</span></div></a>`).join('');
    const pageLink=next => { const target=new URLSearchParams(params); target.set('pagina',String(next)); return '/blog?'+target; };
    const body=`<main class="blog wrap"><header class="blog-intro"><p class="eyebrow">Notícias Lendo Sáficos</p><h1>Histórias para<br><em>ler e descobrir.</em></h1><p>Notícias, listas, lançamentos e recomendações de literatura sáfica.</p></header><form action="/blog"><label>Buscar notícias <input name="q" value="${escapeHtml(params.get('q') || '')}"></label><button>Buscar</button></form><p>${data.total} matérias encontradas</p><section class="blog-grid">${cards || '<p>Nenhuma matéria encontrada.</p>'}</section><nav>${page > 1 ? `<a href="${escapeHtml(pageLink(page-1))}">Anterior</a>` : ''} ${page*12 < data.total ? `<a href="${escapeHtml(pageLink(page+1))}">Próxima</a>` : ''}</nav></main>`;
    const html=applyMetadata(await getTemplate(),{title:'Blog de Literatura Sáfica: Livros, Autoras e Novidades | Lendo Sáficos',description:'Notícias, listas, lançamentos e recomendações de literatura sáfica.',image:'/images/5.jpeg',path:'/blog'});
    response.status(200).send(html.replace('<div id="root"></div>',`<div id="root">${withBlogChrome(body)}</div>`));
  } catch(error) { console.error('[blog-index]',error.message); response.status(503).send('<!doctype html><html lang="pt-BR"><meta name="robots" content="noindex"><title>Blog indisponível</title><p>Não foi possível carregar o blog. Tente novamente.</p></html>'); }
}
