-- Execute este arquivo uma vez no SQL Editor do Supabase.
create table if not exists public.blog_articles (
  id bigint generated always as identity primary key,
  category text not null,
  title text not null,
  excerpt text not null,
  image text not null default '/images/1.jpg',
  slug text,
  blocks jsonb not null default '[]'::jsonb,
  status text not null default 'Rascunho' check (status in ('Publicado', 'Rascunho', 'Suspenso')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migração segura para instalações que já tinham a tabela antes do CMS por blocos.
alter table public.blog_articles
  add column if not exists blocks jsonb not null default '[]'::jsonb;

alter table public.blog_articles
  add column if not exists slug text;

create unique index if not exists blog_articles_slug_unique
on public.blog_articles (slug)
where slug is not null;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.blog_articles enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.admin_users where user_id = auth.uid()) $$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "published articles are public" on public.blog_articles;
create policy "published articles are public" on public.blog_articles
for select using (status = 'Publicado' or public.is_admin());

drop policy if exists "admins manage articles" on public.blog_articles;
create policy "admins manage articles" on public.blog_articles
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Política explícita para exclusão: útil também em projetos já criados
-- antes da política abrangente acima.
drop policy if exists "admins delete articles" on public.blog_articles;
create policy "admins delete articles" on public.blog_articles
for delete to authenticated using (public.is_admin());

-- Exclusão via RPC evita inconsistências de cache de políticas no cliente.
create or replace function public.delete_blog_article(article_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para excluir matérias';
  end if;
  delete from public.blog_articles where id = article_id;
end;
$$;

grant execute on function public.delete_blog_article(bigint) to authenticated;

drop policy if exists "admins view their role" on public.admin_users;
create policy "admins view their role" on public.admin_users
for select to authenticated using (user_id = auth.uid());

-- Imagens do blog: leitura pública, escrita exclusiva para administradoras.
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public blog media" on storage.objects;
create policy "public blog media" on storage.objects
for select using (bucket_id = 'blog-media');

drop policy if exists "admins upload blog media" on storage.objects;
create policy "admins upload blog media" on storage.objects
for insert to authenticated with check (bucket_id = 'blog-media' and public.is_admin());

drop policy if exists "admins update blog media" on storage.objects;
create policy "admins update blog media" on storage.objects
for update to authenticated using (bucket_id = 'blog-media' and public.is_admin()) with check (bucket_id = 'blog-media' and public.is_admin());

drop policy if exists "admins delete blog media" on storage.objects;
create policy "admins delete blog media" on storage.objects
for delete to authenticated using (bucket_id = 'blog-media' and public.is_admin());

-- Depois de criar o usuário administrador em Authentication > Users, execute:
-- insert into public.admin_users (user_id) values ('UUID_DO_USUARIO_ADMIN');
