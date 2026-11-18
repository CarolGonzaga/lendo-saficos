import { supabase } from '../../lib/supabase';

export type PublicBlogSettings = { blog_name: string; tagline: string; description: string; posts_per_page: number; comments_mode:'moderated'|'open'|'off' };
export const defaultPublicBlogSettings: PublicBlogSettings = {
  blog_name: 'Lendo Sáficos', tagline: '',
  description: 'Notícias, listas, lançamentos e recomendações de literatura sáfica para encontrar sua próxima leitura.',
  posts_per_page: 12, comments_mode:'moderated',
};

export async function getPublicBlogSettings(): Promise<PublicBlogSettings> {
  if (!supabase) return defaultPublicBlogSettings;
  const { data, error } = await supabase.rpc('blog_public_settings');
  if (error || !data) return defaultPublicBlogSettings;
  const settings = data as Partial<PublicBlogSettings>;
  return {
    blog_name: settings.blog_name?.trim() || defaultPublicBlogSettings.blog_name,
    tagline: settings.tagline?.trim() || defaultPublicBlogSettings.tagline,
    description: settings.description?.trim() || defaultPublicBlogSettings.description,
    posts_per_page: Math.min(40, Math.max(3, Number(settings.posts_per_page) || 12)),
    comments_mode: settings.comments_mode === 'open' || settings.comments_mode === 'off' ? settings.comments_mode : 'moderated',
  };
}
