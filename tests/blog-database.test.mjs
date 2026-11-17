import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { before, after, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

const pg = new PGlite({extensions:{unaccent}});
const admin='00000000-0000-0000-0000-000000000001';
const reader='00000000-0000-0000-0000-000000000002';
async function role(name='postgres',id='') {
  await pg.exec(`reset role; set role ${name}; select set_config('request.jwt.claim.sub','${id}',false);`);
}
async function query(sql,params=[]) { return (await pg.query(sql,params)).rows; }
async function search(params={}) {
  const result=await query('select public.search_blog_articles($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[params.search || '',params.category || '',params.tag || '',params.status || 'Todos',params.featured || 'Todos',params.sort || 'recent',params.page || 1,params.size || 12,params.admin || false]);
  return result[0].result;
}
before(async () => {
  await pg.exec(`create role anon; create role authenticated; create schema auth; create schema storage; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage,extensions to anon,authenticated;
    grant select,insert,update,delete on storage.objects to authenticated; grant select on storage.objects to anon;
    grant usage,select on sequence storage.objects_id_seq to authenticated;
    insert into auth.users values('${admin}'),('${reader}');`);
  await pg.exec(await readFile('supabase/schema.sql','utf8'));
  await pg.exec(`grant select on public.blog_articles to anon; grant select,insert,update,delete on public.blog_articles to authenticated;
    grant select on public.admin_users to authenticated; grant usage,select on sequence public.blog_articles_id_seq to authenticated;
    insert into public.admin_users(user_id) values('${admin}');
    insert into public.blog_articles(title,excerpt,category,status,blocks) values('Saúde e romance','Resumo','Novidades','Publicado','[{"id":"old","type":"text","content":"Texto antigo","span":8,"align":"left"}]');`);
  await pg.exec(await readFile('supabase/migrations/20260928_blog_cms.sql','utf8'));
});
after(async () => { await pg.close(); });

test('migration preserves legacy article, URL and JSON blocks',async () => {
  const [article]=await query('select * from blog_articles where id=1');
  assert.equal(article.slug,'saude-e-romance-1'); assert.equal(article.blocks[0].content,'Texto antigo');
  assert.ok(article.category_id); assert.ok(article.published_at);
});
test('admin creates unique slugs, updates dates and normalizes tags',async () => {
  await role('authenticated',admin);
  await query("insert into blog_articles(title,excerpt,category,slug,tags) values('Romântico','Teste','Novidades','romantico',array['Saúde','saude'])");
  await query("insert into blog_articles(title,excerpt,category,slug) values('Romântico','Teste','novidades','romantico')");
  const articles=await query("select slug,tags,updated_at from blog_articles where title='Romântico' order by id");
  assert.equal(articles[0].slug,'romantico'); assert.equal(articles[1].slug,'romantico-2'); assert.equal(articles[0].tags.length,1);
  const before=articles[0].updated_at; await query("update blog_articles set excerpt='Alterado' where slug='romantico'");
  const [changed]=await query("select updated_at from blog_articles where slug='romantico'"); assert.ok(changed.updated_at > before);
});
test('accent-insensitive paged search and counts, public list ignores drafts',async () => {
  const adminPage=await search({search:'romantico',admin:true,size:1}); assert.equal(adminPage.total,2); assert.equal(adminPage.articles.length,1);
  const second=await search({search:'romantico',admin:true,size:1,page:2}); assert.notEqual(second.articles[0].id,adminPage.articles[0].id);
  await role('anon'); const publicPage=await search({search:'saude'}); assert.equal(publicPage.total,1);
  assert.equal((await search({search:'inexistente'})).articles.length,0);
});
test('RLS blocks unauthenticated writes and authenticated non-admin operations',async () => {
  await assert.rejects(() => query("insert into blog_articles(title,excerpt,category) values('Ataque','Teste','Novidades')"));
  await role('authenticated',reader);
  await assert.rejects(() => query("insert into blog_articles(title,excerpt,category) values('Ataque','Teste','Novidades')"));
  await assert.rejects(() => search({admin:true}));
  assert.equal((await query("update blog_articles set title='Ataque' where id=1 returning id")).length,0);
});
test('scheduled publication becomes public by database time, suspension and trash hide it',async () => {
  await role('authenticated',admin);
  await query("insert into blog_articles(title,excerpt,category,status,scheduled_at) values('Futura','Teste','Novidades','Agendado',now()+interval '1 day'),('Chegou','Teste','Novidades','Agendado',now()-interval '1 second')");
  await role('anon'); assert.equal((await search({search:'Futura'})).total,0); assert.equal((await search({search:'Chegou'})).total,1);
  await role('authenticated',admin); await query("update blog_articles set status='Suspenso' where title='Chegou'");
  await role('anon'); assert.equal((await search({search:'Chegou'})).total,0);
  await role('authenticated',admin); await query("update blog_articles set status='Lixeira' where title='Chegou'");
  const trash=await search({admin:true,status:'Lixeira'}); assert.equal(trash.total,1); assert.ok(trash.articles[0].deleted_at);
  await query("update blog_articles set status='Rascunho' where title='Chegou'");
  assert.equal((await search({admin:true,status:'Lixeira'})).total,0);
});
test('category rename cascades and equivalent categories collide',async () => {
  const [category]=await query("select id from blog_categories where slug='novidades'");
  await query('select blog_rename_category($1,$2)',[category.id,'Notícias']);
  const [article]=await query('select category from blog_articles where id=1'); assert.equal(article.category,'Notícias');
  await assert.rejects(() => query("insert into blog_categories(name,slug) values('noticias','noticias')"));
});
test('public search includes names inside old link lists and related excludes itself',async () => {
  await query("insert into blog_articles(title,excerpt,category,status,blocks) values('Lista','Livros','Notícias','Publicado','[{\"id\":\"list\",\"type\":\"linklist\",\"items\":[{\"title\":\"Coração Romântico\",\"url\":\"https://example.com\"}],\"span\":12,\"align\":\"left\"}]')");
  await role('anon'); assert.equal((await search({search:'coracao romantico'})).total,1);
  const related=await query('select * from related_blog_articles(1)'); assert.ok(related.every(article => article.id !== 1)); assert.ok(related.some(article => article.title === 'Lista'));
});
test('malicious links rejected and referenced storage cannot be deleted',async () => {
  await role('authenticated',admin);
  await assert.rejects(() => query("insert into blog_articles(title,excerpt,category,blocks) values('Malicioso','Teste','Notícias','[{\"type\":\"button\",\"url\":\"javascript:alert(1)\"}]')"));
  await query("insert into storage.objects(bucket_id,name) values('blog-media','shared.jpg'),('blog-media','unused.jpg')");
  await query("update blog_articles set image='https://example.com/storage/v1/object/public/blog-media/shared.jpg' where id=1");
  assert.equal((await query("delete from storage.objects where name='shared.jpg' returning id")).length,0);
  assert.equal((await query("delete from storage.objects where name='unused.jpg' returning id")).length,1);
});
test('autosaved working drafts stay private and do not modify publication',async () => {
  await query("insert into blog_editor_drafts(article_id,content,base_updated_at) select id,'{\"title\":\"Em edição\"}',updated_at from blog_articles where id=1");
  const [article]=await query('select title from blog_articles where id=1'); assert.equal(article.title,'Saúde e romance');
  await role('authenticated',reader); assert.equal((await query('select * from blog_editor_drafts')).length,0);
});
test('featured order, normalized tags, filters and title sorting use editorial data',async () => {
  await role('authenticated',admin);
  await query("insert into blog_articles(title,excerpt,category,status,featured,tags) values('AAA','Resumo','Notícias','Publicado',false,array['Saúde']),('ZZZ','Resumo','Notícias','Publicado',true,array['saude'])");
  await role('anon'); const featured=await search({tag:'saude'});assert.equal(featured.articles[0].title,'ZZZ');assert.equal(featured.total,2);
  await role('authenticated',admin); const alphabetical=await search({tag:'saude',admin:true,sort:'az',status:'Publicado'});assert.equal(alphabetical.articles[0].title,'AAA');
  const highlighted=await search({admin:true,featured:'Destacados',status:'Publicado'});assert.ok(highlighted.articles.every(article => article.featured));
});
test('storage refuses reattaching a file that was already removed',async () => {
  await role('authenticated',admin);
  await assert.rejects(() => query("update blog_articles set image='https://example.com/storage/v1/object/public/blog-media/missing.jpg' where id=1"));
});
