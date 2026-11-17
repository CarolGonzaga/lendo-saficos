import { createClient } from '@supabase/supabase-js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reply(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Método não permitido.' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return reply(res, 503, { error: 'Convites não estão configurados no servidor.' });

  const authorization = req.headers?.authorization || '';
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  if (!match) return reply(res, 401, { error: 'Entre novamente para enviar convites.' });

  let body;
  try {
    if (typeof req.body === 'string' && req.body.length > 4096) return reply(res, 413, { error: 'Solicitação muito grande.' });
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return reply(res, 400, { error: 'Dados inválidos.' });
  }
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = body?.role;
  if (email.length > 254 || !emailPattern.test(email) || !['admin', 'author'].includes(role))
    return reply(res, 400, { error: 'Informe um e-mail válido e uma permissão.' });

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser(match[1]);
    if (authError || !auth.user) return reply(res, 401, { error: 'Sessão inválida ou expirada.' });

    const { data: member, error: memberError } = await supabase.from('admin_users')
      .select('role').eq('user_id', auth.user.id).maybeSingle();
    if (memberError) throw memberError;
    if (member?.role !== 'admin') return reply(res, 403, { error: 'Somente administradores podem convidar pessoas.' });

    const redirectTo = process.env.BLOG_ADMIN_INVITE_REDIRECT_URL || 'https://www.lendosaficos.com.br/admin/accept-invite';
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email,
      { redirectTo });
    if (inviteError) return reply(res, 400, { error: inviteError.message || 'Não foi possível enviar o convite.' });
    const invitedId = invited.user?.id;
    if (!invitedId) throw new Error('Convite criado sem identificador de usuário.');

    const { error: insertError } = await supabase.from('admin_users')
      .insert({ user_id: invitedId, role });
    if (insertError) {
      // The invite e-mail may already be in transit. Report the incomplete state
      // so an administrator can repair it instead of claiming success.
      console.error('[blog-team-invite] membership insert failed', { userId: invitedId, code: insertError.code });
      return reply(res, 500, { error: 'Convite enviado, mas o acesso não foi vinculado. Verifique a equipe antes de reenviar.' });
    }
    return reply(res, 201, { user_id: invitedId, email, role });
  } catch (error) {
    console.error('[blog-team-invite] unexpected failure', error);
    return reply(res, 500, { error: 'Não foi possível concluir o convite.' });
  }
}
