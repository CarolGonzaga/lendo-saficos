import { buildSitemap } from '../server/blog-html.mjs';
import { freshResponse, publicClient } from '../server/blog-runtime.mjs';

export default async function handler(_request,response) {
  freshResponse(response,'application/xml; charset=utf-8');
  try {
    const client=publicClient(); const articles=[]; let offset=0;
    while (true) {
      const {data,error}=await client.from('blog_articles').select('id,slug,title,status,published_at,scheduled_at,created_at,updated_at,deleted_at').or('status.eq.Publicado,status.eq.Agendado').order('id').range(offset,offset+499);
      if (error) throw error;
      articles.push(...data.map(article => ({...article,editorial_status:'Publicado'}))); if (data.length < 500) break; offset+=500;
    }
    response.status(200).send(buildSitemap(articles));
  } catch(error) { console.error('[blog-sitemap]',error.message); response.status(503).send('<?xml version="1.0"?><error>Sitemap temporariamente indisponível</error>'); }
}
