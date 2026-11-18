import { supabase } from '../../lib/supabase';

export type BlogComment = { id:number; commenter_name:string; commenter_email:string; body:string; status:'pending'|'approved'|'rejected'; created_at:string; article_id?:number; article_title?:string; article_slug?:string };
const client = () => { if (!supabase) throw new Error('Comentários indisponíveis no momento.'); return supabase; };

export async function getPublicComments(slug:string):Promise<BlogComment[]> {
  const { data,error } = await client().rpc('blog_public_comments',{article_slug:slug});
  if (error) throw error;
  return (data || []) as BlogComment[];
}

export async function submitPublicComment(input:{slug:string;name:string;email:string;body:string;website:string}):Promise<'pending'|'approved'|'ignored'> {
  const response = await fetch('/api/blog-comment',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({slug:input.slug,name:input.name,email:input.email,body:input.body,website:input.website}),
  });
  const data = await response.json().catch(() => null) as {status?:string;error?:string}|null;
  if (!response.ok) throw new Error(data?.error || 'Não foi possível enviar o comentário.');
  const status = data?.status;
  return status === 'approved' ? 'approved' : status === 'ignored' ? 'ignored' : 'pending';
}

export async function getAdminComments(status:'pending'|'approved'|'rejected'|'all'='pending'):Promise<BlogComment[]> {
  const { data,error } = await client().rpc('blog_admin_comments',{status_filter:status});
  if (error) throw error;
  return (data || []) as BlogComment[];
}

export async function moderateComment(id:number,status:'pending'|'approved'|'rejected'):Promise<void> {
  const { error } = await client().rpc('blog_moderate_comment',{target_comment_id:id,next_status:status});
  if (error) throw error;
}

export async function deleteComment(id:number):Promise<void> {
  const { error } = await client().rpc('blog_delete_comment',{target_comment_id:id});
  if (error) throw error;
}
