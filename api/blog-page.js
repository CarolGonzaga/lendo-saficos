import { articleHtml, applyMetadata, isPublic } from '../server/blog-html.mjs';
import { freshResponse, getTemplate, publicClient } from '../server/blog-runtime.mjs';

export default async function handler(request,response) {
  freshResponse(response,'text/html; charset=utf-8');
  try {
    const slug=String(request.query?.slug || '').replace(/\/$/,'');
    const template=await getTemplate();
    const {data,error}=await publicClient().rpc('get_public_blog_article',{article_slug:slug});
    if (error) throw error;
    if (!data || !isPublic(data)) {
      response.status(404).send(applyMetadata(template,{title:'Matéria não encontrada | Lendo Sáficos',description:'Esta matéria não está disponível.',image:'/images/5.jpeg',path:'/blog/'+encodeURIComponent(slug),noindex:true}).replace('<div id="root"></div>','<div id="root"><main class="blog wrap"><h1>Matéria não encontrada</h1><p>Esta matéria não existe ou não está disponível para leitura.</p><a href="/blog">Voltar ao blog</a></main></div>'));
      return;
    }
    response.status(200).send(articleHtml(template,data));
  } catch(error) { console.error('[blog-page]',error.message); response.status(503).send('<!doctype html><html lang="pt-BR"><meta name="robots" content="noindex"><title>Blog indisponível</title><p>Não foi possível carregar a matéria. Tente novamente em instantes.</p></html>'); }
}
