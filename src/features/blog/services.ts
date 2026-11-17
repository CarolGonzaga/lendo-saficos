import { supabase } from '../../lib/supabase';
import type { AdminFilters, Article, ArticleDraft, ArticlePage, Category, Media, Tag } from './types';
import { articleSlug, draftOf, slugify, validateDraft } from './utils';

function client() { if (!supabase) throw new Error('Supabase não configurado.'); return supabase; }
export async function getArticles(filters: AdminFilters, includeAll = false): Promise<ArticlePage> {
  const { data, error } = await client().rpc('search_blog_articles', { query_text: filters.search, category_filter: filters.category,
    tag_filter: filters.tag, status_filter: filters.status, featured_filter: filters.featured, sort_order: filters.sort,
    page_number: filters.page, page_size: 12, include_all: includeAll });
  if (error) throw new Error(`Não foi possível carregar matérias: ${error.message}`);
  return data as ArticlePage;
}
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data, error } = await client().rpc('get_public_blog_article',{article_slug:slug});
  if (error) throw error;
  return data as Article | null;
}
export async function getHomeArticles() {
  const { data, error } = await client().rpc('search_blog_articles', { page_size: 3 });
  if (error) throw error;
  return (data as ArticlePage).articles;
}
export async function getRelated(article: Article) {
  const { data, error } = await client().rpc('related_blog_articles', { article_id: article.id });
  if (error) throw error;
  return data as Article[];
}
export async function saveArticle(draft: ArticleDraft, existing?: Article | null) {
  validateDraft(draft);
  const payload = { ...draft, slug: slugify(draft.slug || draft.title), blocks: draft.blocks || [] };
  const query = existing ? client().from('blog_articles').update(payload).eq('id', existing.id).eq('updated_at', existing.updated_at!)
    : client().from('blog_articles').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error || !data) throw new Error(error?.code === 'PGRST116' ? 'A matéria mudou em outra sessão. Reabra antes de salvar para evitar perda de conteúdo.' : error?.message || 'Nenhum registro foi salvo.');
  return data as Article;
}
export async function saveWorkingDraft(article: Article, draft: ArticleDraft) {
  const { error } = await client().from('blog_editor_drafts').upsert({ article_id: article.id,
    user_id: (await client().auth.getUser()).data.user?.id, content: draft, base_updated_at: article.updated_at,
    updated_at: new Date().toISOString() });
  if (error) throw error;
}
export async function getWorkingDraft(article: Article): Promise<{ draft:ArticleDraft | null;conflict:boolean }> {
  const { data, error } = await client().from('blog_editor_drafts').select('content,base_updated_at').eq('article_id', article.id).maybeSingle();
  if (error) throw error;
  return { draft:data?.content as ArticleDraft | null,conflict:!!data && Date.parse(data.base_updated_at) !== Date.parse(article.updated_at!) };
}
export async function clearWorkingDraft(id: number) {
  const { error } = await client().from('blog_editor_drafts').delete().eq('article_id', id);
  if (error) throw error;
}
export async function changeStatus(article: Article, status: Article['status']) {
  const { data, error } = await client().from('blog_articles').update({ status,
    ...(status === 'Publicado' ? { published_at: new Date().toISOString(), scheduled_at: null } : {}),
    ...(status === 'Rascunho' ? { scheduled_at: null, published_at: null } : {}),
  }).eq('id', article.id).eq('updated_at', article.updated_at!).select('*').single();
  if (error || !data) throw new Error(error?.message || 'Nenhuma matéria foi alterada.');
  return data as Article;
}
export async function duplicateArticle(article: Article) {
  return saveArticle({ ...draftOf(article), title: `${article.title} (cópia)`, slug: `${articleSlug(article)}-copia`, status: 'Rascunho', featured: false, published_at: null, scheduled_at: null });
}
export async function deleteArticle(article: Article) {
  if (article.status !== 'Lixeira') throw new Error('Envie a matéria à lixeira antes de excluir.');
  const { data, error } = await client().from('blog_articles').delete().eq('id', article.id).eq('status', 'Lixeira').eq('updated_at', article.updated_at!).select('id').single();
  if (error || data?.id !== article.id) throw new Error(error?.message || 'A exclusão não afetou a matéria esperada.');
}
export async function getTaxonomy(): Promise<{ categories: Category[]; tags: Tag[] }> {
  const [categories, tags] = await Promise.all([client().from('blog_categories').select('*').order('name'), client().from('blog_tags').select('name,slug').order('name')]);
  if (categories.error || tags.error) throw categories.error || tags.error;
  return { categories: categories.data as Category[], tags: tags.data as Tag[] };
}
export async function createCategory(name: string) {
  const { data, error } = await client().from('blog_categories').insert({ name: name.trim().replace(/\s+/g, ' '), slug: slugify(name) }).select('*').single();
  if (error) throw new Error(error.code === '23505' ? 'Já existe uma categoria equivalente.' : error.message);
  return data as Category;
}
export async function renameCategory(id: number, name: string) {
  const { error } = await client().rpc('blog_rename_category', { category_id: id, category_name: name });
  if (error) throw error;
}
export async function uploadMedia(file: File): Promise<Media> {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Use JPG, PNG, WebP ou GIF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 10 MB.');
  const signature = new Uint8Array(await file.slice(0,12).arrayBuffer());
  const ascii = new TextDecoder().decode(signature);
  const valid = file.type === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 && signature[2] === 255
    : file.type === 'image/png' ? [137,80,78,71,13,10,26,10].every((byte,index) => signature[index] === byte)
    : file.type === 'image/gif' ? /^GIF8[79]a/.test(ascii) : ascii.startsWith('RIFF') && ascii.slice(8,12) === 'WEBP';
  if (!valid) throw new Error('O conteúdo do arquivo não corresponde ao tipo de imagem informado.');
  let body: Blob = file;
  let extension = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'} as Record<string,string>)[file.type];
  if (file.type !== 'image/gif') {
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    if (ratio < 1 || file.size > 2 * 1024 * 1024) {
      const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .92));
      if (compressed && compressed.size < file.size) { body = compressed; extension = 'webp'; }
    }
    bitmap.close();
  }
  const path = `${crypto.randomUUID()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}.${extension}`;
  const { error } = await client().storage.from('blog-media').upload(path, body, { contentType: body.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name, url: client().storage.from('blog-media').getPublicUrl(path).data.publicUrl };
}
export async function listMedia(page = 1): Promise<Media[]> {
  const { data, error } = await client().storage.from('blog-media').list('', { limit: 24, offset:(page-1)*24, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw error;
  const files = data.filter(file => file.id);
  const usage = await client().rpc('blog_media_usage',{ media_paths:files.map(file => file.name) });
  if (usage.error) throw usage.error;
  const references = usage.data as { path:string;referenced:boolean }[];
  return files.map(file => ({ path: file.name, name: file.name, referenced:references.find(item => item.path === file.name)?.referenced,
    url: client().storage.from('blog-media').getPublicUrl(file.name).data.publicUrl }));
}
export async function removeUnusedMedia(path: string) {
  const { data, error } = await client().rpc('blog_media_references', { media_path: path });
  if (error) throw error;
  if (data > 0) throw new Error('Imagem utilizada em uma matéria, inclusive rascunhos ou lixeira.');
  const result = await client().storage.from('blog-media').remove([path]);
  if (result.error || !result.data.some(file => file.name === path)) throw new Error(result.error?.message || 'Arquivo não removido.');
}
