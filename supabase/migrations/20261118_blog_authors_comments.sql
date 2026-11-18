-- Author bylines and configurable public comments.
-- Apply after the existing blog CMS and settings/team migrations.
begin;

alter table public.admin_users
  add column if not exists display_name text not null default ''
  check (length(display_name) <= 80);

alter table public.blog_articles
  add column if not exists author_user_id uuid references auth.users(id) on delete set null,
  add column if not exists author_name text not null default '',
  add column if not exists comments_mode text not null default 'inherit';
alter table public.blog_articles drop constraint if exists blog_articles_comments_mode_check;
alter table public.blog_articles add constraint blog_articles_comments_mode_check
  check (comments_mode in ('inherit','moderated','open','off'));

alter table public.blog_settings
  add column if not exists comments_mode text not null default 'moderated';
alter table public.blog_settings drop constraint if exists blog_settings_comments_mode_check;
alter table public.blog_settings add constraint blog_settings_comments_mode_check
  check (comments_mode in ('moderated','open','off'));

create table if not exists public.blog_comments (
  id bigint generated always as identity primary key,
  article_id bigint not null references public.blog_articles(id) on delete cascade,
  commenter_name text not null check (length(trim(commenter_name)) between 1 and 80),
  commenter_email text not null check (length(trim(commenter_email)) between 3 and 254),
  body text not null check (length(trim(body)) between 1 and 5000),
  source_hash text not null check (length(source_hash) = 64),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists blog_comments_article_status_created
  on public.blog_comments(article_id,status,created_at desc);
create index if not exists blog_comments_email_created
  on public.blog_comments(article_id,lower(commenter_email),created_at desc);
create index if not exists blog_comments_source_created
  on public.blog_comments(source_hash,created_at desc);
alter table public.blog_comments enable row level security;
revoke all on public.blog_comments from public, anon, authenticated;

create or replace function public.blog_current_display_name()
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce((select m.display_name from public.admin_users m where m.user_id = (select auth.uid())), '')
$$;
revoke all on function public.blog_current_display_name() from public, anon;
grant execute on function public.blog_current_display_name() to authenticated;

create or replace function public.blog_update_my_display_name(new_display_name text)
returns text language plpgsql volatile security definer set search_path = ''
as $$
declare clean_name text := trim(coalesce(new_display_name,''));
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  ) then raise exception 'Somente integrantes do painel podem alterar o nome público' using errcode = '42501'; end if;
  if length(clean_name) > 80 then raise exception 'O nome público deve ter até 80 caracteres'; end if;
  update public.admin_users set display_name = clean_name where user_id = (select auth.uid());
  return clean_name;
end;
$$;
revoke all on function public.blog_update_my_display_name(text) from public, anon;
grant execute on function public.blog_update_my_display_name(text) to authenticated;

create or replace function public.blog_stamp_article_author()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare current_author uuid; display_label text;
begin
  if tg_op = 'UPDATE' and old.status in ('Publicado','Agendado') and new.status in ('Publicado','Agendado') then
    new.author_user_id := old.author_user_id;
    new.author_name := old.author_name;
    return new;
  end if;
  if new.status not in ('Publicado','Agendado') then return new; end if;
  current_author := (select auth.uid());
  if current_author is null then return new; end if;
  select coalesce(
    nullif(trim(m.display_name),''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'),''),
    nullif(trim(u.raw_user_meta_data ->> 'name'),''),
    'Equipe Lendo Sáficos'
  ) into display_label
  from auth.users u left join public.admin_users m on m.user_id = u.id
  where u.id = current_author;
  new.author_user_id := current_author;
  new.author_name := coalesce(display_label,'Equipe Lendo Sáficos');
  return new;
end;
$$;
revoke all on function public.blog_stamp_article_author() from public, anon, authenticated;
drop trigger if exists blog_stamp_article_author on public.blog_articles;
create trigger blog_stamp_article_author before insert or update on public.blog_articles
for each row execute function public.blog_stamp_article_author();

create or replace function public.blog_public_settings()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'blog_name', s.blog_name,
    'tagline', s.tagline,
    'description', s.description,
    'posts_per_page', s.posts_per_page,
    'comments_mode', s.comments_mode
  )
  from public.blog_settings s where s.id = 1
$$;
revoke all on function public.blog_public_settings() from public;
grant execute on function public.blog_public_settings() to anon, authenticated;

-- The only member profile field exposed publicly is the byline attached to a public article.
create or replace function public.get_public_blog_article(article_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select (to_jsonb(a) - 'author_user_id') || jsonb_build_object(
    'editorial_status','Publicado',
    'status','Publicado',
    'published_at',case when a.status = 'Agendado' then a.scheduled_at else a.published_at end,
    'author_name',coalesce(nullif(trim(m.display_name),''),nullif(trim(a.author_name),''),'Equipe Lendo Sáficos')
  )
  from public.blog_articles a
  left join public.admin_users m on m.user_id = a.author_user_id
  where a.slug = article_slug and public.blog_is_public(a)
  limit 1
$$;
revoke all on function public.get_public_blog_article(text) from public;
grant execute on function public.get_public_blog_article(text) to anon, authenticated;

-- Keep the internal Auth UUID out of public article search results.
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
    'articles', coalesce((select jsonb_agg(case when include_all then to_jsonb(p) - 'editorial_date'
      else to_jsonb(p) - 'editorial_date' - 'author_user_id' end) from paged p),'[]'::jsonb),
    'total', (select count(*) from filtered),
    'counts', (select coalesce(jsonb_object_agg(editorial_status, amount),'{}'::jsonb) from (select editorial_status,count(*) amount from visible group by editorial_status) counts)
  ) into result;
  return result;
end;
$$;

create or replace function public.blog_submit_comment(
  article_slug text, commenter_name text, commenter_email text, comment_body text,
  website text, request_hash text
)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare target public.blog_articles; mode text; clean_name text := trim(coalesce(commenter_name,''));
  clean_email text := lower(trim(coalesce(commenter_email,''))); clean_body text := trim(coalesce(comment_body,''));
  saved_status text;
begin
  -- Honeypot submissions are acknowledged without being stored.
  if length(trim(coalesce(website,''))) > 0 then return jsonb_build_object('status','pending'); end if;
  if request_hash is null or request_hash !~ '^[a-f0-9]{64}$' then raise exception 'Solicitação inválida'; end if;
  perform pg_advisory_xact_lock(hashtext(request_hash));
  select a.* into target from public.blog_articles a
    where a.slug = trim(article_slug) and public.blog_is_public(a) limit 1;
  if target.id is null then raise exception 'Matéria indisponível'; end if;
  select case when target.comments_mode = 'inherit' then s.comments_mode else target.comments_mode end
    into mode from public.blog_settings s where s.id = 1;
  if mode is null or mode = 'off' then raise exception 'Comentários desativados nesta matéria'; end if;
  if length(clean_name) not between 1 and 80 then raise exception 'Informe um nome de até 80 caracteres'; end if;
  if length(clean_email) not between 3 and 254 or clean_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe um e-mail válido'; end if;
  if length(clean_body) not between 1 and 5000 then raise exception 'O comentário deve ter de 1 a 5000 caracteres'; end if;
  if exists(select 1 from public.blog_comments c where c.article_id = target.id
    and lower(c.commenter_email) = clean_email and c.created_at > now() - interval '30 seconds') then
    raise exception 'Aguarde antes de enviar outro comentário';
  end if;
  if (select count(*) from public.blog_comments c where c.source_hash = request_hash
    and c.created_at > now() - interval '1 hour') >= 15 then
    raise exception 'Limite de comentários atingido. Tente novamente mais tarde';
  end if;
  saved_status := case when mode = 'open' then 'approved' else 'pending' end;
  insert into public.blog_comments(article_id,commenter_name,commenter_email,body,source_hash,status)
    values(target.id,clean_name,clean_email,clean_body,request_hash,saved_status);
  return jsonb_build_object('status',saved_status);
end;
$$;
revoke all on function public.blog_submit_comment(text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.blog_submit_comment(text,text,text,text,text,text) to service_role;

create or replace function public.blog_public_comments(article_slug text)
returns table(id bigint, commenter_name text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare target public.blog_articles; mode text;
begin
  select a.* into target from public.blog_articles a
    where a.slug = trim(article_slug) and public.blog_is_public(a) limit 1;
  if target.id is null then return; end if;
  select case when target.comments_mode = 'inherit' then s.comments_mode else target.comments_mode end
    into mode from public.blog_settings s where s.id = 1;
  if mode is null or mode = 'off' then return; end if;
  return query select c.id,c.commenter_name,c.body,c.created_at from public.blog_comments c
    where c.article_id = target.id and c.status = 'approved' order by c.created_at asc;
end;
$$;
revoke all on function public.blog_public_comments(text) from public;
grant execute on function public.blog_public_comments(text) to anon, authenticated;

create or replace function public.blog_admin_comments(status_filter text default 'pending')
returns table(id bigint, article_id bigint, article_title text, article_slug text,
  commenter_name text, commenter_email text, body text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão para moderar comentários' using errcode = '42501'; end if;
  if status_filter not in ('pending','approved','rejected','all') then raise exception 'Filtro inválido'; end if;
  return query select c.id,c.article_id,a.title,a.slug,c.commenter_name,c.commenter_email,c.body,c.status,c.created_at
    from public.blog_comments c join public.blog_articles a on a.id = c.article_id
    where status_filter = 'all' or c.status = status_filter order by c.created_at desc limit 300;
end;
$$;
revoke all on function public.blog_admin_comments(text) from public, anon;
grant execute on function public.blog_admin_comments(text) to authenticated;

create or replace function public.blog_moderate_comment(target_comment_id bigint, next_status text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão para moderar comentários' using errcode = '42501'; end if;
  if next_status not in ('pending','approved','rejected') then raise exception 'Status inválido'; end if;
  update public.blog_comments set status = next_status where id = target_comment_id;
  if not found then raise exception 'Comentário não encontrado'; end if;
end;
$$;
revoke all on function public.blog_moderate_comment(bigint,text) from public, anon;
grant execute on function public.blog_moderate_comment(bigint,text) to authenticated;

create or replace function public.blog_delete_comment(target_comment_id bigint)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão para excluir comentários' using errcode = '42501'; end if;
  delete from public.blog_comments where id = target_comment_id;
  if not found then raise exception 'Comentário não encontrado'; end if;
end;
$$;
revoke all on function public.blog_delete_comment(bigint) from public, anon;
grant execute on function public.blog_delete_comment(bigint) to authenticated;

commit;
