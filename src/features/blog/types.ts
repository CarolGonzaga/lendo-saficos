export const ARTICLE_STATUSES = ['Rascunho', 'Agendado', 'Publicado', 'Suspenso', 'Lixeira'] as const;
export type ArticleStatus = typeof ARTICLE_STATUSES[number];
export type ContentAlign = 'left' | 'center' | 'right' | 'justify';
export type ListItem = { title: string; url: string };
type BlockBase = { id: string; span: number; align: ContentAlign };
export type ArticleBlock = BlockBase & (
  | { type: 'text'; content?: string }
  | { type: 'product'; title?: string; price?: string; url?: string; image?: string }
  | { type: 'linklist'; title?: string; items?: ListItem[] }
  | { type: 'image'; image?: string; alt?: string; caption?: string; credit?: string }
  | { type: 'h2' | 'h3' | 'quote'; content?: string }
  | { type: 'bullets' | 'numbered'; entries?: string[] }
  | { type: 'divider' }
  | { type: 'button'; title?: string; url?: string }
);
export type ArticleSeo = { seo_title?: string; seo_description?: string; seo_image?: string };
export type CommentsMode = 'inherit' | 'moderated' | 'open' | 'off';
export type Article = ArticleSeo & {
  id: number; category: string; category_id?: number | null; title: string; excerpt: string;
  image: string; cover_alt?: string; status: ArticleStatus; featured?: boolean;
  editorial_status?: ArticleStatus;
  blocks?: ArticleBlock[]; slug?: string; tags?: string[];
  created_at?: string; updated_at?: string; published_at?: string | null;
  author_user_id?: string | null; author_name?: string; comments_mode?: CommentsMode;
  scheduled_at?: string | null; deleted_at?: string | null;
};
export type ArticleDraft = Omit<Article, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'editorial_status'>;
export type Category = { id: number; name: string; slug: string; description?: string; created_at: string };
export type Tag = { name: string; slug: string };
export type Media = { path: string; url: string; name: string; referenced?: boolean };
export type AdminFilters = {
  search: string; category: string; tag: string; status: ArticleStatus | 'Todos';
  featured: 'Todos' | 'Destacados' | 'Não destacados'; sort: 'recent' | 'oldest' | 'updated' | 'az' | 'za'; page: number;
};
export type ArticlePage = { articles: Article[]; total: number; counts: Partial<Record<ArticleStatus, number>> };
