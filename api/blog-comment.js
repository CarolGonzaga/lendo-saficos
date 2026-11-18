import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export default async function handler(request,response) {
  response.setHeader('Content-Type','application/json; charset=utf-8');
  response.setHeader('Cache-Control','no-store');
  response.setHeader('CDN-Cache-Control','no-store');
  response.setHeader('Vercel-CDN-Cache-Control','no-store');
  if (request.method !== 'POST') { response.setHeader('Allow','POST'); response.status(405).json({error:'Método não permitido.'}); return; }
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { response.status(503).json({error:'Comentários indisponíveis no momento.'}); return; }
  const input=request.body && typeof request.body === 'object' ? request.body : {};
  const slug=String(input.slug || '').trim();
  const name=String(input.name || '').trim();
  const email=String(input.email || '').trim();
  const body=String(input.body || '').trim();
  const website=String(input.website || '').trim();
  if (slug.length > 220 || name.length > 80 || email.length > 254 || body.length > 5000 || website.length > 500) {
    response.status(400).json({error:'Revise os campos do comentário.'}); return;
  }
  const forwarded=request.headers['x-forwarded-for'];
  const ip=String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const requestHash=createHash('sha256').update(`${key}:${ip}`).digest('hex');
  try {
    const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    const {data,error}=await db.rpc('blog_submit_comment',{
      article_slug:slug,commenter_name:name,commenter_email:email,comment_body:body,
      website,request_hash:requestHash,
    });
    if (error) {
      const status=error.message.includes('Limite') || error.message.includes('Aguarde') ? 429 : 400;
      response.status(status).json({error:error.message}); return;
    }
    response.status(200).json(data);
  } catch(error) {
    console.error('[blog-comment]',error instanceof Error ? error.message : error);
    response.status(503).json({error:'Não foi possível enviar o comentário. Tente novamente.'});
  }
}
