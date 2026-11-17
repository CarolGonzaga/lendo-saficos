import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

export const ADMIN_ID='00000000-0000-0000-0000-000000000001';
const publicId='00000000-0000-0000-0000-000000000002';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1kAAAAASUVORK5CYII=','base64');
export async function startBlogFixture(port=54321) {
  const pg=new PGlite({extensions:{unaccent}});
  await pg.exec(`create role anon; create role authenticated; create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text,created_at timestamptz default now());
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage,extensions to anon,authenticated;
    grant select,insert,update,delete on storage.objects to authenticated; grant select on storage.objects to anon;
    grant usage,select on sequence storage.objects_id_seq to authenticated;
    insert into auth.users values('${ADMIN_ID}'),('${publicId}');`);
  await pg.exec(await readFile('supabase/schema.sql','utf8'));
  await pg.exec(`grant select on public.blog_articles to anon; grant select,insert,update,delete on public.blog_articles to authenticated;
    grant select on public.admin_users to authenticated; grant usage,select on sequence public.blog_articles_id_seq to authenticated;
    insert into public.admin_users(user_id) values('${ADMIN_ID}');
    insert into public.blog_articles(title,excerpt,category,status,slug,featured,blocks) values
    ('Saúde e romance','Uma matéria antiga','Novidades','Publicado','saude-e-romance',true,'[{"id":"old","type":"text","content":"<b>Conteúdo antigo</b>","span":8,"align":"left"}]'),
    ('Segunda matéria','Resumo da segunda','Listas','Rascunho','segunda-materia',false,'[]');`);
  await pg.exec(await readFile('supabase/migrations/20260928_blog_cms.sql','utf8'));
  const server=createServer(async (request,response) => {
    response.setHeader('Access-Control-Allow-Origin','*'); response.setHeader('Access-Control-Allow-Headers','*'); response.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
    if(request.method === 'OPTIONS') {response.end();return;}
    const url=new URL(request.url,`http://127.0.0.1:${port}`);
    let raw=''; for await(const chunk of request) raw+=chunk.toString();
    const json=raw && request.headers['content-type']?.includes('json') ? JSON.parse(raw) : {};
    const userId=request.headers.authorization?.includes('fixture-admin') ? ADMIN_ID : request.headers.authorization?.includes('fixture-reader') ? publicId : '';
    const send=(data,status=200) => {response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data));};
    try {
      if(url.pathname === '/auth/v1/token') {
        if(json.password !== 'test-password') {send({msg:'Invalid login credentials'},400);return;}
        const admin=json.email === 'admin@example.com';
        send({access_token:admin ? 'fixture-admin' : 'fixture-reader',token_type:'bearer',refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:admin ? ADMIN_ID : publicId,email:json.email,aud:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()}});return;
      }
      if(url.pathname === '/auth/v1/user') {send({id:userId,email:userId === ADMIN_ID ? 'admin@example.com' : 'reader@example.com',aud:'authenticated',app_metadata:{},user_metadata:{}});return;}
      if(url.pathname === '/auth/v1/logout') {send({});return;}
      if(url.pathname.includes('/storage/v1/object/public/')) {response.setHeader('Content-Type','image/png');response.end(png);return;}
      const data=await pg.transaction(async tx => {
        await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub','${userId}',true);`);
        if(url.pathname.startsWith('/rest/v1/rpc/')) {
          const name=url.pathname.split('/').pop();
          if(!['search_blog_articles','related_blog_articles','blog_rename_category','blog_media_references','blog_media_usage','get_public_blog_article'].includes(name)) throw new Error('Unknown RPC');
          const keys=Object.keys(json);
          const argumentsSql=keys.map((key,index) => `${key} => $${index+1}`).join(',');
          const result=await tx.query(name === 'related_blog_articles' || name === 'blog_media_usage'
            ? `select to_jsonb(record) result from public.${name}(${argumentsSql}) record`
            : `select public.${name}(${argumentsSql}) result`,Object.values(json));
          if(name === 'related_blog_articles' || name === 'blog_media_usage') return result.rows.map(row => row.result);
          return result.rows[0]?.result;
        }
        if(url.pathname.startsWith('/storage/v1/object/list/')) {
          const result=await tx.query('select id::text,name,created_at from storage.objects where bucket_id=$1 order by created_at desc limit $2 offset $3',['blog-media',json.limit || 100,json.offset || 0]); return result.rows;
        }
        if(url.pathname === '/storage/v1/object/blog-media' && request.method === 'DELETE') {
          const result=await tx.query('delete from storage.objects where bucket_id=$1 and name=any($2::text[]) returning name',['blog-media',json.prefixes]); return result.rows;
        }
        if(url.pathname.startsWith('/storage/v1/object/blog-media/')) {
          const name=decodeURIComponent(url.pathname.split('/').slice(5).join('/')); await tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',['blog-media',name]); return {Key:'blog-media/'+name};
        }
        const table=url.pathname.split('/').pop();
        if(!['blog_articles','admin_users','blog_categories','blog_tags','blog_editor_drafts'].includes(table)) throw new Error('Unknown table');
        const params=[]; const where=[];
        for(const [key,value] of url.searchParams) {
          if(['select','order','limit','offset','on_conflict'].includes(key)) continue;
          if(key === 'or' && value === '(status.eq.Publicado,status.eq.Agendado)') {where.push("status in ('Publicado','Agendado')");continue;}
          if(!/^[a-z_]+$/.test(key) || !value.startsWith('eq.')) throw new Error('Unknown filter');
          params.push(value.slice(3));where.push(`${key}=$${params.length}`);
        }
        const clause=where.length ? ' where '+where.join(' and ') : '';
        let result;
        if(request.method === 'GET') {
          const order=url.searchParams.get('order'); const ordered=order && /^(name|created_at|updated_at)\.(asc|desc)$/.test(order) ? ` order by ${order.replace('.',' ')}` : '';
          result=await tx.query(`select * from public.${table}${clause}${ordered}`,params);
        } else if(request.method === 'POST') {
          const keys=Object.keys(json); if(keys.some(key => !/^[a-z_]+$/.test(key))) throw new Error('Unknown key');
          const values=keys.map(key => json[key] !== null && typeof json[key] === 'object' && !Array.isArray(json[key]) ? JSON.stringify(json[key]) : key === 'blocks' ? JSON.stringify(json[key]) : json[key]);
          const upsert=table === 'blog_editor_drafts' ? ` on conflict(article_id,user_id) do update set ${keys.filter(key => !['article_id','user_id'].includes(key)).map(key => `${key}=excluded.${key}`).join(',')}` : '';
          result=await tx.query(`insert into public.${table}(${keys.join(',')}) values(${keys.map((_,index) => '$'+(index+1)).join(',')})${upsert} returning *`,values);
        } else if(request.method === 'PATCH') {
          const keys=Object.keys(json); const values=keys.map(key => key === 'blocks' ? JSON.stringify(json[key]) : json[key]);
          result=await tx.query(`update public.${table} set ${keys.map((key,index) => `${key}=$${params.length+index+1}`).join(',')}${clause} returning *`,[...params,...values]);
        } else if(request.method === 'DELETE') { result=await tx.query(`delete from public.${table}${clause} returning *`,params); }
        else throw new Error('Unsupported request');
        if(result.rows.some(row => row.updated_at instanceof Date)) {
          result.rows=await Promise.all(result.rows.map(async row => {
            if(!row.id || !['blog_articles','blog_categories'].includes(table)) return row;
            const precise=await tx.query(`select to_jsonb(record) value from public.${table} record where id=$1`,[row.id]);
            return precise.rows[0]?.value || row;
          }));
        }
        if(request.headers.accept?.includes('application/vnd.pgrst.object+json')) {
          if(result.rows.length !== 1) { const error=new Error('Expected single row');error.code='PGRST116';throw error; }
          return result.rows[0];
        }
        return result.rows;
      });
      send(data);
    } catch(error) {send({message:error.message,code:error.code || 'FIXTURE_ERROR',details:null,hint:null},400);}
  });
  await new Promise(resolve => server.listen(port,'127.0.0.1',resolve));
  return {pg,close:async () => {await new Promise(resolve => server.close(resolve));await pg.close();}};
}
