begin;

create extension if not exists unaccent with schema extensions;

create or replace function public.blog_normalize(value text)
returns text language sql stable set search_path = public, extensions
as $$ select lower(unaccent(coalesce(value, ''))) $$;

create table if not exists public.blog_categories (
  id bigint generated always as identity primary key,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.blog_tags (
  slug text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.blog_articles
  add column if not exists slug text,
  add column if not exists blocks jsonb not null default '[]'::jsonb,
  add column if not exists category_id bigint references public.blog_categories(id),
  add column if not exists tags text[] not null default '{}',
  add column if not exists cover_alt text not null default '',
  add column if not exists published_at timestamptz,
  add column if not exists scheduled_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '',
  add column if not exists seo_image text not null default '';

alter table public.blog_articles drop constraint if exists blog_articles_status_check;
alter table public.blog_articles add constraint blog_articles_status_check
  check (status in ('Rascunho', 'Agendado', 'Publicado', 'Suspenso', 'Lixeira'));

create or replace function public.blog_slug(value text)
returns text language sql stable set search_path = public, extensions
as $$ select trim(both '-' from regexp_replace(public.blog_normalize(value), '[^a-z0-9]+', '-', 'g')) $$;

insert into public.blog_categories (name, slug)
select min(trim(regexp_replace(category, '\s+', ' ', 'g'))), public.blog_slug(category)
from public.blog_articles where trim(category) <> ''
group by public.blog_slug(category) on conflict (slug) do nothing;
insert into public.blog_categories (name, slug) values
('Destaque','destaque'),('Listas','listas'),('Tropes','tropes'),('Novidades','novidades')
on conflict (slug) do nothing;

update public.blog_articles a set category_id = c.id, category = c.name
from public.blog_categories c where c.slug = public.blog_slug(a.category);
update public.blog_articles set published_at = created_at where status = 'Publicado' and published_at is null;
do $$ declare article record; base text; candidate text; suffix integer;
begin
  for article in select id,title from public.blog_articles where slug is null or slug = '' order by id loop
    base := public.blog_slug(article.title) || '-' || article.id; candidate := base; suffix := 1;
    while exists(select 1 from public.blog_articles where slug = candidate and id <> article.id) loop
      suffix := suffix + 1; candidate := base || '-' || suffix;
    end loop;
    update public.blog_articles set slug = candidate where id = article.id;
  end loop;
end $$;

create unique index if not exists blog_articles_slug_unique on public.blog_articles(slug) where slug is not null;

create or replace function public.blog_is_public(article public.blog_articles)
returns boolean language sql stable set search_path = public
as $$ select article.deleted_at is null and (
  (article.status = 'Publicado' and coalesce(article.published_at, article.created_at) <= now())
  or (article.status = 'Agendado' and article.scheduled_at <= now())
) $$;

create or replace function public.blog_assert_media_exists(document jsonb)
returns void language plpgsql set search_path = public
as $$ declare media_value jsonb; media_path text;
begin
  for media_value in select jsonb_path_query(document, '$.**.image') union select jsonb_path_query(document, '$.**.seo_image') loop
    media_path := split_part(trim(both '"' from media_value::text), '/storage/v1/object/public/blog-media/', 2);
    if media_path <> '' and not exists(select 1 from storage.objects where bucket_id = 'blog-media' and name = media_path) then
      raise exception 'Imagem removida da biblioteca. Selecione outra imagem antes de salvar.';
    end if;
  end loop;
end $$;

create or replace function public.blog_before_save()
returns trigger language plpgsql set search_path = public, extensions
as $$
declare base text; candidate text; suffix integer := 1; taxonomy public.blog_categories; tag_name text; link_value jsonb;
begin
  perform pg_advisory_xact_lock(9282026);
  perform public.blog_assert_media_exists(to_jsonb(new));
  for link_value in select jsonb_path_query(new.blocks, '$.**.url') loop
    if trim(both '"' from link_value::text) <> '' and trim(both '"' from link_value::text) !~* '^https?://' then
      raise exception 'Links devem utilizar http ou https';
    end if;
  end loop;
  new.updated_at := clock_timestamp();
  if new.status = 'Publicado' and (tg_op = 'INSERT' or old.status <> 'Publicado') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status = 'Agendado' and new.scheduled_at is null then
    raise exception 'Informe a data de agendamento';
  end if;
  if new.status = 'Lixeira' then new.deleted_at := coalesce(new.deleted_at, now());
  else new.deleted_at := null; end if;
  if new.category_id is not null then
    select * into taxonomy from public.blog_categories where id = new.category_id;
    if taxonomy.id is null then raise exception 'Categoria inválida'; end if;
    new.category := taxonomy.name;
  else
    select * into taxonomy from public.blog_categories where slug = public.blog_slug(new.category);
    if taxonomy.id is null then
      insert into public.blog_categories(name,slug) values(trim(new.category), public.blog_slug(new.category)) returning * into taxonomy;
    end if;
    new.category_id := taxonomy.id; new.category := taxonomy.name;
  end if;
  base := coalesce(nullif(public.blog_slug(new.slug), ''), nullif(public.blog_slug(new.title), ''), 'materia');
  candidate := base;
  while exists(select 1 from public.blog_articles where slug = candidate and id <> coalesce(new.id, -1)) loop
    suffix := suffix + 1; candidate := base || '-' || suffix;
  end loop;
  new.slug := candidate;
  new.tags := array(select min(trim(tag)) from unnest(new.tags) tag where trim(tag) <> '' group by public.blog_slug(tag));
  foreach tag_name in array new.tags loop
    insert into public.blog_tags(slug,name) values(public.blog_slug(tag_name),tag_name) on conflict(slug) do nothing;
  end loop;
  new.tags := array(select catalog.name from unnest(new.tags) tag join public.blog_tags catalog on catalog.slug = public.blog_slug(tag));
  return new;
end;
$$;
drop trigger if exists blog_before_save on public.blog_articles;
create trigger blog_before_save before insert or update on public.blog_articles
for each row execute function public.blog_before_save();

create or replace function public.blog_rename_category(category_id bigint, category_name text)
returns void language plpgsql security definer set search_path = public
as $$ begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  if trim(category_name) = '' then raise exception 'Informe o nome'; end if;
  update public.blog_categories set name = trim(category_name), slug = public.blog_slug(category_name) where id = category_id;
  if not found then raise exception 'Categoria não encontrada'; end if;
  update public.blog_articles set category = trim(category_name) where blog_articles.category_id = blog_rename_category.category_id;
end $$;

alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
create policy "blog categories readable" on public.blog_categories for select using (true);
create policy "blog categories managed" on public.blog_categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "blog tags readable" on public.blog_tags for select using (true);
create policy "blog tags managed" on public.blog_tags for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "published articles are public" on public.blog_articles;
create policy "published articles are public" on public.blog_articles
for select using (public.blog_is_public(blog_articles) or public.is_admin());

create index if not exists blog_articles_status_dates on public.blog_articles(status, published_at desc, scheduled_at);
create index if not exists blog_articles_category on public.blog_articles(category_id);
create index if not exists blog_articles_tags on public.blog_articles using gin(tags);
create index if not exists blog_articles_updated on public.blog_articles(updated_at desc);

create or replace function public.search_blog_articles(
  query_text text default '', category_filter text default '', tag_filter text default '',
  status_filter text default 'Todos', featured_filter text default 'Todos', sort_order text default 'recent',
  page_number integer default 1, page_size integer default 12, include_all boolean default false
)
returns jsonb language plpgsql stable set search_path = public, extensions
as $$
declare result jsonb;
begin
  if include_all and not public.is_admin() then raise exception 'Sem permissão'; end if;
  with visible as (
    select a.*, case when a.status = 'Agendado' and a.scheduled_at <= now() then 'Publicado' else a.status end as editorial_status,
      coalesce(case when a.status = 'Agendado' then a.scheduled_at else a.published_at end, a.created_at) as editorial_date
    from public.blog_articles a where include_all or public.blog_is_public(a)
  ), filtered as (
    select * from visible a where
      (not include_all or (status_filter = 'Todos' and a.status <> 'Lixeira') or a.editorial_status = status_filter)
      and (category_filter = '' or a.category = category_filter or public.blog_slug(a.category) = category_filter)
      and (tag_filter = '' or exists(select 1 from unnest(a.tags) tag where public.blog_normalize(tag) = public.blog_normalize(tag_filter)))
      and (featured_filter = 'Todos' or a.featured = (featured_filter = 'Destacados'))
      and (query_text = '' or position(public.blog_normalize(query_text) in public.blog_normalize(
        concat_ws(' ', a.title, a.excerpt, a.category, array_to_string(a.tags,' '), a.slug,
          case when include_all then '' else a.blocks::text end))) > 0)
  ), paged as (
    select * from filtered order by
      case when not include_all then featured end desc,
      case when sort_order = 'oldest' then editorial_date end asc,
      case when sort_order = 'updated' then updated_at end desc,
      case when sort_order = 'az' then public.blog_normalize(title) end asc,
      case when sort_order = 'za' then public.blog_normalize(title) end desc,
      editorial_date desc, id desc
    limit least(greatest(page_size,1),100) offset (greatest(page_number,1)-1)*least(greatest(page_size,1),100)
  ) select jsonb_build_object(
    'articles', coalesce((select jsonb_agg(to_jsonb(p) - 'editorial_date') from paged p),'[]'::jsonb),
    'total', (select count(*) from filtered),
    'counts', (select coalesce(jsonb_object_agg(editorial_status, amount),'{}'::jsonb) from (select editorial_status,count(*) amount from visible group by editorial_status) counts)
  ) into result;
  return result;
end $$;

create or replace function public.blog_media_references(media_path text)
returns bigint language plpgsql stable security definer set search_path = public
as $$ declare amount bigint;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  select count(*) into amount from public.blog_articles where
    image like '%/blog-media/' || media_path or seo_image like '%/blog-media/' || media_path
    or position('/blog-media/' || media_path in blocks::text) > 0;
  return amount;
end $$;

grant select on public.blog_categories, public.blog_tags to anon, authenticated;
grant insert, update, delete on public.blog_categories, public.blog_tags to authenticated;
grant usage, select on sequence public.blog_categories_id_seq to authenticated;
grant execute on function public.search_blog_articles(text,text,text,text,text,text,integer,integer,boolean) to anon, authenticated;
revoke all on function public.blog_rename_category(bigint,text), public.blog_media_references(text) from public, anon;
grant execute on function public.blog_rename_category(bigint,text), public.blog_media_references(text) to authenticated;

create table if not exists public.blog_editor_drafts (
  article_id bigint not null references public.blog_articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  content jsonb not null,
  base_updated_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(article_id, user_id)
);
alter table public.blog_editor_drafts enable row level security;
create policy "admin working drafts" on public.blog_editor_drafts for all to authenticated
using(public.is_admin() and user_id = auth.uid()) with check(public.is_admin() and user_id = auth.uid());
grant select,insert,update,delete on public.blog_editor_drafts to authenticated;

create or replace function public.related_blog_articles(article_id bigint)
returns setof public.blog_articles language sql stable set search_path = public
as $$ select a.* from public.blog_articles a, public.blog_articles origin
where origin.id = article_id and public.blog_is_public(origin) and public.blog_is_public(a) and a.id <> origin.id
order by (a.category_id = origin.category_id) desc,
  (select count(*) from unnest(a.tags) tag where exists(select 1 from unnest(origin.tags) other where public.blog_normalize(tag) = public.blog_normalize(other))) desc,
  coalesce(a.scheduled_at,a.published_at,a.created_at) desc limit 3 $$;
grant execute on function public.related_blog_articles(bigint) to anon,authenticated;

create or replace function public.get_public_blog_article(article_slug text)
returns jsonb language sql stable set search_path = public
as $$ select to_jsonb(a) || jsonb_build_object('editorial_status','Publicado','status','Publicado',
  'published_at',case when a.status = 'Agendado' then a.scheduled_at else a.published_at end)
from public.blog_articles a where a.slug = article_slug and public.blog_is_public(a) limit 1 $$;
grant execute on function public.get_public_blog_article(text) to anon,authenticated;

create or replace function public.blog_media_can_delete(media_path text)
returns boolean language plpgsql volatile security definer set search_path = public
as $$ begin
  if not public.is_admin() then return false; end if;
  perform pg_advisory_xact_lock(9282026);
  return not exists(select 1 from public.blog_articles where
    image like '%/blog-media/' || media_path or seo_image like '%/blog-media/' || media_path
    or position('/blog-media/' || media_path in blocks::text) > 0)
    and not exists(select 1 from public.blog_editor_drafts where position('/blog-media/' || media_path in content::text) > 0);
end $$;
drop policy if exists "admins delete blog media" on storage.objects;
create policy "admins delete blog media" on storage.objects for delete to authenticated
using(bucket_id = 'blog-media' and public.blog_media_can_delete(name));

create or replace function public.blog_working_draft_lock()
returns trigger language plpgsql set search_path = public
as $$ begin perform pg_advisory_xact_lock(9282026); perform public.blog_assert_media_exists(new.content); return new; end $$;
create trigger blog_working_draft_lock before insert or update on public.blog_editor_drafts
for each row execute function public.blog_working_draft_lock();

create or replace function public.blog_media_usage(media_paths text[])
returns table(path text, referenced boolean) language plpgsql stable security definer set search_path = public
as $$ begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  return query select media_path, exists(select 1 from public.blog_articles where
    image like '%/blog-media/' || media_path or seo_image like '%/blog-media/' || media_path
    or position('/blog-media/' || media_path in blocks::text) > 0)
    or exists(select 1 from public.blog_editor_drafts where position('/blog-media/' || media_path in content::text) > 0)
  from unnest(media_paths) media_path;
end $$;
revoke all on function public.blog_media_usage(text[]) from public,anon;
grant execute on function public.blog_media_usage(text[]) to authenticated;

update storage.buckets set file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'blog-media';

commit;
