import { supabase } from '../../../lib/supabase';

export type BlogSettings = {
  blog_name: string;
  tagline: string;
  description: string;
  contact_email: string;
  posts_per_page: number;
};

export type TeamMember = {
  user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'author';
  created_at: string;
};

export const defaultSettings: BlogSettings = {
  blog_name: 'Lendo Sáficos', tagline: '', description: '', contact_email: '', posts_per_page: 12,
};

function client() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

export async function getCurrentTeamRole(): Promise<'admin' | 'author' | null> {
  const { data: auth, error: authError } = await client().auth.getUser();
  if (authError || !auth.user) throw new Error('Sua sessão expirou. Entre novamente.');
  const { data, error } = await client().from('admin_users').select('role').eq('user_id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data?.role === 'admin' || data?.role === 'author' ? data.role : null;
}

export async function getBlogSettings(): Promise<BlogSettings> {
  const { data, error } = await client().from('blog_settings').select('blog_name,tagline,description,contact_email,posts_per_page').eq('id', 1).maybeSingle();
  if (error) throw error;
  return { ...defaultSettings, ...data };
}

export async function saveBlogSettings(settings: BlogSettings): Promise<BlogSettings> {
  const clean: BlogSettings = {
    blog_name: settings.blog_name.trim(),
    tagline: settings.tagline.trim(),
    description: settings.description.trim(),
    contact_email: settings.contact_email.trim(),
    posts_per_page: Number(settings.posts_per_page),
  };
  if (!clean.blog_name || clean.blog_name.length > 120) throw new Error('Informe um nome de até 120 caracteres.');
  if (clean.tagline.length > 240 || clean.description.length > 2000) throw new Error('Assinatura ou descrição muito longa.');
  if (clean.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.contact_email)) throw new Error('E-mail de contato inválido.');
  if (!Number.isInteger(clean.posts_per_page) || clean.posts_per_page < 3 || clean.posts_per_page > 40) throw new Error('Escolha de 3 a 40 matérias por página.');
  const { data, error } = await client().from('blog_settings').update(clean).eq('id', 1).select('blog_name,tagline,description,contact_email,posts_per_page').single();
  if (error || !data) throw new Error(error?.message || 'Configurações não foram salvas.');
  return data as BlogSettings;
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await client().rpc('blog_team_list');
  if (error) throw error;
  return data as TeamMember[];
}

export async function changeTeamRole(userId: string, role: TeamMember['role']): Promise<void> {
  const { error } = await client().rpc('blog_team_change_role', { member_id: userId, next_role: role });
  if (error) throw error;
}

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) throw new Error('Sua sessão expirou. Entre novamente.');
  return data.user.id;
}

export async function inviteTeamMember(email: string, role: TeamMember['role']): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Informe um e-mail válido.');
  const { data, error } = await client().auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.');
  const response = await fetch('/blog-team-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({ email: cleanEmail, role }),
  });
  const result = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(result?.error || 'Não foi possível enviar o convite.');
}
