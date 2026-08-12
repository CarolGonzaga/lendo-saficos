import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const env = await readFile('.env.local', 'utf8');
const setting = (name) => env.match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]?.trim();
const source = await readFile('src/App.tsx', 'utf8');
const templateMatch = source.match(/const kindleTemplate: ArticleBlock\[\] = (\[[\s\S]*?\n\]);\ntype SocialLinkProps/);

if (!templateMatch) throw new Error('Modelo Encha Seu Kindle não encontrado.');
const kindleTemplate = Function(`return ${templateMatch[1]}`)();
const supabase = createClient(setting('VITE_SUPABASE_URL'), setting('VITE_SUPABASE_ANON_KEY'));
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
if (authError || !auth.session) throw new Error('Não foi possível autenticar a conta de administradora.');

const { data: role, error: roleError } = await supabase
  .from('admin_users')
  .select('user_id')
  .eq('user_id', auth.session.user.id)
  .maybeSingle();
if (roleError || !role) throw new Error('A conta autenticada não está vinculada como administradora.');

const { error } = await supabase.from('blog_articles').insert({
  category: 'Listas',
  title: 'Livros sáficos gratuitos no Encha Seu Kindle — veja a lista completa',
  excerpt: 'Uma seleção de livros sáficos gratuitos para aproveitar durante o Encha Seu Kindle, organizada por gênero e com links diretos para a Amazon.',
  image: '/images/5.jpeg',
  blocks: kindleTemplate,
  status: 'Rascunho',
  featured: false,
});
await supabase.auth.signOut();
if (error) throw error;
console.log('Rascunho criado com sucesso.');
