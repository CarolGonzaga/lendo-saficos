import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export function publicClient() {
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Configuração pública do Supabase indisponível.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
let template;
export async function getTemplate() {
  if (!template) template=await readFile(path.join(process.cwd(),'dist','blog-shell.html'),'utf8');
  return template;
}
export const freshResponse = (response,type) => { response.setHeader('Content-Type',type); response.setHeader('Cache-Control','no-store'); response.setHeader('CDN-Cache-Control','no-store'); response.setHeader('Vercel-CDN-Cache-Control','no-store'); };
