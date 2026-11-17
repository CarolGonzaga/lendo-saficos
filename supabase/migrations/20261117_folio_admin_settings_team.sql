-- Folio-style settings and editorial team. Apply after 20260928_blog_cms.sql.
-- The Supabase CLI is unavailable in this workspace, so this migration uses
-- the repository's existing timestamped SQL convention.
begin;

alter table public.admin_users
  add column if not exists role text not null default 'admin';

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check
  check (role in ('admin', 'author'));

-- Existing administrators remain administrators. The legacy is_admin() helper
-- continues to mean editorial membership so existing article/media policies
-- also grant authors editorial access. Team/settings use the strict check below.
create or replace function public.blog_is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid()) and role = 'admin'
  )
$$;
revoke all on function public.blog_is_owner() from public, anon;
grant execute on function public.blog_is_owner() to authenticated;

create table if not exists public.blog_settings (
  id smallint primary key default 1 check (id = 1),
  blog_name text not null default 'Lendo Sáficos' check (length(trim(blog_name)) between 1 and 120),
  tagline text not null default '' check (length(tagline) <= 240),
  description text not null default '' check (length(description) <= 2000),
  contact_email text not null default '',
  posts_per_page integer not null default 12 check (posts_per_page between 3 and 40),
  updated_at timestamptz not null default now()
);
insert into public.blog_settings (id) values (1) on conflict (id) do nothing;
alter table public.blog_settings enable row level security;
drop policy if exists "blog owners read settings" on public.blog_settings;
create policy "blog owners read settings" on public.blog_settings
  for select to authenticated using (public.blog_is_owner());
drop policy if exists "blog owners update settings" on public.blog_settings;
create policy "blog owners update settings" on public.blog_settings
  for update to authenticated using (public.blog_is_owner())
  with check (public.blog_is_owner() and id = 1);
grant select, update on public.blog_settings to authenticated;

-- Public read model for the blog page and server-rendered index. Contact e-mail
-- deliberately stays private; the table itself remains restricted by RLS.
create or replace function public.blog_public_settings()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'blog_name', s.blog_name,
    'tagline', s.tagline,
    'description', s.description,
    'posts_per_page', s.posts_per_page
  )
  from public.blog_settings s where s.id = 1
$$;
revoke all on function public.blog_public_settings() from public;
grant execute on function public.blog_public_settings() to anon, authenticated;

create or replace function public.blog_team_list()
returns table(user_id uuid, email text, full_name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.blog_is_owner() then raise exception 'Sem permissão para consultar a equipe' using errcode = '42501'; end if;
  return query
    select m.user_id, coalesce(u.email, ''),
      coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), ''),
      m.role, m.created_at
    from public.admin_users m
    join auth.users u on u.id = m.user_id
    order by m.created_at desc, m.user_id;
end;
$$;
revoke all on function public.blog_team_list() from public, anon;
grant execute on function public.blog_team_list() to authenticated;

create or replace function public.blog_team_change_role(member_id uuid, next_role text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare previous_role text;
begin
  if not public.blog_is_owner() then raise exception 'Sem permissão para alterar a equipe' using errcode = '42501'; end if;
  if next_role not in ('admin', 'author') then raise exception 'Permissão inválida'; end if;
  if member_id = (select auth.uid()) then raise exception 'Você não pode alterar sua própria permissão'; end if;
  perform pg_advisory_xact_lock(20261117);
  select m.role into previous_role from public.admin_users m where m.user_id = member_id for update;
  if previous_role is null then raise exception 'Pessoa não encontrada na equipe'; end if;
  if previous_role = 'admin' and next_role = 'author'
    and (select count(*) from public.admin_users where role = 'admin') <= 1 then
    raise exception 'A equipe precisa manter pelo menos um administrador';
  end if;
  update public.admin_users set role = next_role where user_id = member_id;
end;
$$;
revoke all on function public.blog_team_change_role(uuid,text) from public, anon;
grant execute on function public.blog_team_change_role(uuid,text) to authenticated;

commit;
