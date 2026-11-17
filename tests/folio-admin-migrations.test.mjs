import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';

test('Folio migrations protect settings, views and taxonomy changes', async () => {
  const pg = new PGlite({ extensions: { unaccent } });
  const admin = '00000000-0000-0000-0000-000000000001';
  const author = '00000000-0000-0000-0000-000000000002';
  const rows = async (sql, params = []) => (await pg.query(sql, params)).rows;
  const role = async (name, id = '') => pg.exec(`reset role; set role ${name}; select set_config('request.jwt.claim.sub','${id}',false);`);
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage; create schema extensions;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage,extensions to anon,authenticated,service_role;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
      grant usage,select on sequence storage.objects_id_seq to authenticated;
      insert into auth.users(id,email) values('${admin}','admin@example.com'),('${author}','author@example.com');`);
    await pg.exec(await readFile('supabase/schema.sql', 'utf8'));
    await pg.exec(`grant select on public.blog_articles to anon;
      grant select,insert,update,delete on public.blog_articles to authenticated;
      grant select on public.admin_users to authenticated;
      grant usage,select on sequence public.blog_articles_id_seq to authenticated;
      insert into public.admin_users(user_id) values('${admin}');
      insert into public.blog_articles(title,excerpt,category,status) values('Matéria','Resumo','Novidades','Publicado');`);
    for (const file of ['20260928_blog_cms.sql','20261117_blog_overview_metrics.sql','20261117_folio_admin_settings_team.sql','20261117_folio_taxonomy.sql'])
      await pg.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));

    await rows(`insert into public.admin_users(user_id,role) values('${author}','author')`);
    await role('authenticated',admin);
    await rows("update public.blog_settings set blog_name='Novo blog',posts_per_page=9 where id=1");
    await role('anon');
    const publicSettings = (await rows('select public.blog_public_settings() as value'))[0].value;
    assert.equal(publicSettings.blog_name, 'Novo blog');
    assert.equal(publicSettings.posts_per_page, 9);
    assert.equal('contact_email' in publicSettings, false);
    await assert.rejects(rows('select public.blog_dashboard_overview()'));

    await role('authenticated',author);
    assert.equal((await rows("update public.blog_settings set blog_name='Intruso' where id=1 returning id")).length, 0);
    assert.ok((await rows('select public.blog_dashboard_overview() as value'))[0].value.totals.published >= 1);

    await role('authenticated',admin);
    const [category] = await rows("insert into public.blog_categories(name,slug,description) values('Nova','nova','Descrição') returning id");
    await rows('select public.blog_delete_category($1)', [category.id]);
    await assert.rejects(rows('select public.blog_delete_category($1)', [1]));
    await rows("insert into public.blog_tags(slug,name) values('livre','Livre')");
    await rows("select public.blog_delete_tag('livre')");
  } finally { await pg.close(); }
});
