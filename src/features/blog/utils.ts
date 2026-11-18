import DOMPurify from 'dompurify';
import type { Article, ArticleBlock, ArticleDraft } from './types';

DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'A') {
    const href = safeUrl(node.getAttribute('href') || '');
    if (href) node.setAttribute('href',href); else node.removeAttribute('href');
    node.setAttribute('rel','noopener noreferrer');
  }
  if (node.hasAttribute('style')) {
    const cleaned = (node.getAttribute('style') || '').split(';').filter(rule => /^\s*(color\s*:\s*(#[a-f0-9]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))|font-size\s*:\s*\d+(\.\d+)?(px|em|rem|%)|text-align\s*:\s*(left|right|center|justify))\s*$/i.test(rule));
    if (cleaned.length) node.setAttribute('style',cleaned.join(';')); else node.removeAttribute('style');
  }
});

export const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export const slugify = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const articleSlug = (article: Article) => article.slug || `${slugify(article.title)}-${article.id}`;
export const articleHref = (article: Article) => `/blog/${articleSlug(article)}`;
export function safeUrl(value = '') {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function safeImage(value = '') { return /^\/(?!\/)[^\s]*$/.test(value) ? value : safeUrl(value); }
export function sanitizeRichText(value = '') {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'font', 'a', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'color', 'size'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}
export const editorialDate = (article: Article) => article.status === 'Agendado' ? article.scheduled_at : article.published_at || article.created_at;
export const effectiveStatus = (article: Article) => article.editorial_status || (article.status === 'Agendado' && article.scheduled_at && Date.parse(article.scheduled_at) <= Date.now() ? 'Publicado' : article.status);
export function isPublic(article: Article, now = Date.now()) {
  if (article.editorial_status) return !article.deleted_at && article.editorial_status === 'Publicado';
  return !article.deleted_at && ((article.status === 'Publicado' && Date.parse(article.published_at || article.created_at || '1970-01-01') <= now)
    || (article.status === 'Agendado' && !!article.scheduled_at && Date.parse(article.scheduled_at) <= now));
}
export function prioritize(articles: Article[]) {
  return [...articles].sort((first, second) => Number(!!second.featured) - Number(!!first.featured)
    || Date.parse(editorialDate(second) || '1970-01-01') - Date.parse(editorialDate(first) || '1970-01-01'));
}
export const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('pt-BR') : '—';
export function newBlock(type: ArticleBlock['type']): ArticleBlock {
  const base = { id: crypto.randomUUID(), span: 12, align: 'left' as const };
  switch (type) {
    case 'product': return { ...base, type, title: '', price: '', url: '', image: '' };
    case 'linklist': return { ...base, type, title: '', items: [] };
    case 'image': return { ...base, type, image: '', alt: '', caption: '', credit: '' };
    case 'button': return { ...base, type, title: '', url: '' };
    case 'bullets': case 'numbered': return { ...base, type, entries: [] };
    case 'divider': return { ...base, type };
    default: return { ...base, type, content: '' };
  }
}
export function emptyDraft(): ArticleDraft {
  return { title: '', excerpt: '', category: 'Novidades', category_id: null, image: '/images/1.jpg', cover_alt: '', status: 'Rascunho',
    blocks: [], tags: [], featured: false, slug: '', seo_title: '', seo_description: '', seo_image: '', published_at: null, scheduled_at: null };
}
export function draftOf(article: Article): ArticleDraft {
  const blank = emptyDraft();
  const draft = Object.fromEntries(Object.keys(blank).map(key => [key, article[key as keyof Article] ?? blank[key as keyof ArticleDraft]])) as ArticleDraft;
  if (effectiveStatus(article) === 'Publicado' && article.status === 'Agendado') {
    draft.status = 'Publicado'; draft.published_at = article.scheduled_at;
  }
  return draft;
}
export function validateDraft(draft: ArticleDraft) {
  if (!draft.title.trim() || !draft.excerpt.trim() || !draft.category.trim()) throw new Error('Preencha título, resumo e categoria.');
  if (draft.status === 'Agendado' && (!draft.scheduled_at || Date.parse(draft.scheduled_at) <= Date.now())) throw new Error('Escolha uma data futura para agendar.');
  if (draft.status === 'Publicado' && draft.published_at && Date.parse(draft.published_at) > Date.now()) throw new Error('Use Agendado para uma publicação futura.');
  if (draft.image && !safeImage(draft.image)) throw new Error('Imagem de capa inválida.');
  if (draft.seo_image && !safeImage(draft.seo_image)) throw new Error('Imagem social inválida.');
  for (const block of draft.blocks || []) {
    if ('url' in block && block.url && !safeUrl(block.url)) throw new Error('Os links devem começar com https:// ou http://.');
    if ('image' in block && block.image && !safeImage(block.image)) throw new Error('Endereço de imagem inválido.');
    if (block.type === 'linklist' && block.items?.some(item => !item.title.trim() || !safeUrl(item.url))) throw new Error('Preencha o nome e um endereço válido em cada item da lista.');
  }
}
