-- Folio-style overview. Apply after 20260928_blog_cms.sql.
begin;

create table public.blog_article_views_daily (
  article_id bigint not null references public.blog_articles(id) on delete cascade,
  viewed_on date not null,
  views bigint not null default 0 check (views >= 0),
  primary key (article_id, viewed_on)
);
create index blog_article_views_daily_date_idx on public.blog_article_views_daily (viewed_on);
alter table public.blog_article_views_daily enable row level security;
revoke all on public.blog_article_views_daily from public, anon, authenticated;
grant select on public.blog_article_views_daily to authenticated;
create policy "admins read blog views" on public.blog_article_views_daily
  for select to authenticated using ((select public.is_admin()));

-- Invoke only from a trusted server after a successful public article response.
-- The browser must never receive the service role key.
create function public.record_blog_article_view(target_article_id bigint)
returns void language plpgsql security invoker set search_path = public
as $$
begin
  insert into public.blog_article_views_daily (article_id, viewed_on, views)
  select a.id, (now() at time zone 'America/Sao_Paulo')::date, 1
  from public.blog_articles a
  where a.id = target_article_id and public.blog_is_public(a)
  on conflict (article_id, viewed_on)
  do update set views = public.blog_article_views_daily.views + 1;
end;
$$;
revoke all on function public.record_blog_article_view(bigint) from public, anon, authenticated;
grant execute on function public.record_blog_article_view(bigint) to service_role;
grant insert, update, select on public.blog_article_views_daily to service_role;

create function public.blog_dashboard_overview()
returns jsonb language plpgsql stable security invoker set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'posts', (select count(*) from public.blog_articles where status <> 'Lixeira'),
      'published', (select count(*) from public.blog_articles a where public.blog_is_public(a)),
      'drafts', (select count(*) from public.blog_articles where status = 'Rascunho'),
      'views', (select coalesce(sum(views), 0) from public.blog_article_views_daily),
      'categories', (select count(*) from public.blog_categories),
      'tags', (select count(*) from public.blog_tags),
      'media', (select count(*) from storage.objects where bucket_id = 'blog-media')
    ),
    'viewsSeries', (
      select coalesce(jsonb_agg(jsonb_build_object('date', day::date, 'views', coalesce(v.views, 0)) order by day), '[]'::jsonb)
      from generate_series((now() at time zone 'America/Sao_Paulo')::date - 29,
                           (now() at time zone 'America/Sao_Paulo')::date,
                           interval '1 day') day
      left join (
        select viewed_on, sum(views) views from public.blog_article_views_daily
        where viewed_on >= (now() at time zone 'America/Sao_Paulo')::date - 29
        group by viewed_on
      ) v on v.viewed_on = day::date
    ),
    'topPosts', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.views desc, r.id desc), '[]'::jsonb)
      from (
        select a.*, coalesce(sum(v.views), 0)::bigint views
        from public.blog_articles a
        left join public.blog_article_views_daily v on v.article_id = a.id
        where public.blog_is_public(a)
        group by a.id
        order by views desc, a.id desc
        limit 5
      ) r
    )
  ) into result;
  return result;
end;
$$;
revoke all on function public.blog_dashboard_overview() from public, anon;
grant execute on function public.blog_dashboard_overview() to authenticated;

-- Small, bounded lookup for the current page of the Posts table.
create function public.blog_article_view_counts(article_ids bigint[])
returns table(article_id bigint, views bigint)
language plpgsql stable security invoker set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  if coalesce(array_length(article_ids, 1), 0) > 100 then raise exception 'Máximo de 100 matérias'; end if;
  return query
    select a.id, coalesce(sum(v.views), 0)::bigint
    from public.blog_articles a
    left join public.blog_article_views_daily v on v.article_id = a.id
    where a.id = any(article_ids)
    group by a.id;
end;
$$;
revoke all on function public.blog_article_view_counts(bigint[]) from public, anon;
grant execute on function public.blog_article_view_counts(bigint[]) to authenticated;

commit;
