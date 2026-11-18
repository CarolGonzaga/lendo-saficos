import { articleHtml, applyMetadata, isPublic } from '../server/blog-html.mjs';
import { freshResponse, getTemplate, publicClient } from '../server/blog-runtime.mjs';
import { createClient } from '@supabase/supabase-js';

async function recordView(articleId) {
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {error}=await admin.rpc('record_blog_article_view',{target_article_id:articleId});
    if (error) console.error('[blog-view]',error.message);
  } catch(error) { console.error('[blog-view]',error instanceof Error ? error.message : error); }
}

export default async function handler(request,response) {
  freshResponse(response,'text/html; charset=utf-8');
  try {
    const slug=String(request.query?.slug || '').replace(/\/$/,'');
    const template=await getTemplate();
    const db=publicClient();
    const [{data,error},{data:settings}]=await Promise.all([
      db.rpc('get_public_blog_article',{article_slug:slug}),
      db.rpc('blog_public_settings'),
    ]);
    if (error) throw error;
    if (!data || !isPublic(data)) {
      response.status(404).send(applyMetadata(template,{title:'Matéria não encontrada | Lendo Sáficos',description:'Esta matéria não está disponível.',image:'/images/5.jpeg',path:'/blog/'+encodeURIComponent(slug),noindex:true}).replace('<div id="root"></div>','<div id="root"><main class="blog wrap"><h1>Matéria não encontrada</h1><p>Esta matéria não existe ou não está disponível para leitura.</p><a href="/blog">Voltar ao blog</a></main></div>'));
      return;
    }
    await recordView(data.id);
    const comments_effective_mode=data.comments_mode && data.comments_mode !== 'inherit'
      ? data.comments_mode : settings?.comments_mode || 'moderated';
    response.status(200).send(articleHtml(template,{...data,comments_effective_mode}));
  } catch(error) { console.error('[blog-page]',error.message); response.status(503).send('<!doctype html><html lang="pt-BR"><meta name="robots" content="noindex"><title>Blog indisponível</title><p>Não foi possível carregar a matéria. Tente novamente em instantes.</p></html>'); }
}
