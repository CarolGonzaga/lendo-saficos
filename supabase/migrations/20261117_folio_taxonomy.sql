-- Complete Folio taxonomy fields and make deletion atomic with article saves.
begin;

alter table public.blog_categories add column if not exists description text not null default '';
alter table public.blog_categories drop constraint if exists blog_categories_description_length;
alter table public.blog_categories add constraint blog_categories_description_length check (length(description) <= 500);

create or replace function public.blog_delete_category(category_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare category_name text;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  perform pg_advisory_xact_lock(9282026);
  select name into category_name from public.blog_categories where id = category_id for update;
  if category_name is null then raise exception 'Categoria não encontrada'; end if;
  if exists(select 1 from public.blog_articles where blog_articles.category_id = blog_delete_category.category_id or category = category_name)
    or exists(select 1 from public.blog_editor_drafts where content->>'category_id' = category_id::text or content->>'category' = category_name) then
    raise exception 'Categoria em uso por uma matéria ou rascunho de edição';
  end if;
  delete from public.blog_categories where id = category_id;
end $$;

create or replace function public.blog_delete_tag(tag_slug text)
returns void language plpgsql security definer set search_path = ''
as $$
declare tag_name text;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  perform pg_advisory_xact_lock(9282026);
  select name into tag_name from public.blog_tags where slug = tag_slug for update;
  if tag_name is null then raise exception 'Tag não encontrada'; end if;
  if exists(select 1 from public.blog_articles where tag_name = any(tags))
    or exists(select 1 from public.blog_editor_drafts where content->'tags' ? tag_name) then
    raise exception 'Tag em uso por uma matéria ou rascunho de edição';
  end if;
  delete from public.blog_tags where slug = tag_slug;
end $$;

revoke all on function public.blog_delete_category(bigint), public.blog_delete_tag(text) from public, anon;
grant execute on function public.blog_delete_category(bigint), public.blog_delete_tag(text) to authenticated;

commit;
