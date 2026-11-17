# Painel editorial inspirado no Folio

O painel em `/admin` usa o banco, a autenticação e as matérias do Lendo Sáficos. O HTML salvo do Folio e os módulos públicos das rotas administrativas serviram como referência funcional. Nenhum dado fictício do Folio foi importado.

## Seções

- **Visão geral:** total de publicações e rascunhos, leituras acumuladas, categorias, tags, imagens, gráfico de 30 dias e cinco matérias mais lidas. As leituras começam em zero quando o rastreamento é ativado; não há histórico retroativo.
- **Posts:** filtros Todos/Publicados/Rascunhos, busca, categoria, destaque, ordenação, leituras por matéria, edição, prévia, duplicação, publicação, suspensão e lixeira. O editor existente preserva blocos, SEO, tags, agendamento e salvamento automático.
- **Categorias e tags:** criação, slug e descrição de categoria, renomeação, criação e exclusão de tags. A exclusão é bloqueada enquanto houver referência em matérias ou rascunhos de edição.
- **Imagens:** envio múltiplo de JPG/PNG/WebP/GIF, otimização de imagens grandes, paginação, cópia de URL e exclusão apenas se não houver referências.
- **Usuários:** administradores enviam convites por e-mail, escolhem papel Autor/Administrador, consultam a equipe e alteram permissões. Autores têm acesso editorial; apenas administradores gerenciam equipe e configurações. O convite leva à tela de definição de senha.
- **Configurações:** nome, assinatura, descrição, e-mail de contato e quantidade de matérias por página. A listagem pública usa nome, assinatura, descrição e paginação; o e-mail de contato não é exposto pela RPC pública.

## Ativação

1. No projeto Supabase do Lendo Sáficos (`wmdfiwofkoxsjmomqjas`), aplique os SQLs, nesta ordem: `20261117_blog_overview_metrics.sql`, `20261117_folio_admin_settings_team.sql`, `20261117_folio_taxonomy.sql`, todos em `supabase/migrations/`. A migração `20260928_blog_cms.sql` já deve estar aplicada.
2. Na Vercel, crie `SUPABASE_SERVICE_ROLE_KEY` como variável **apenas de servidor**, nos ambientes usados pelo blog. Nunca use prefixo `VITE_` nessa chave. O projeto já usa `VITE_SUPABASE_URL` para identificar o Supabase.
3. Em Supabase Auth > URL Configuration, inclua `https://www.lendosaficos.com.br/admin/accept-invite` nos URLs de redirecionamento autorizados. Se definir `BLOG_ADMIN_INVITE_REDIRECT_URL` na Vercel, autorize também esse endereço.
4. Publique o código após as migrações e a variável de servidor estarem prontas. Teste `/admin`, `/admin/posts`, `/admin/categories`, `/admin/media`, `/admin/users`, `/admin/settings`, `/blog` e uma matéria publicada.

As métricas são registradas pela função de matéria publicada usando `service_role` no servidor. Uma falha no registro de leitura não impede a exibição da matéria. O endpoint de convite valida o token da sessão e o papel de administradora antes de usar a chave de serviço.
