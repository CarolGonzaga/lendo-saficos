# Entrega: Blog e painel editorial

Implementação local concluída e validada com a aplicação real em navegador e PostgreSQL isolado. A ativação no Supabase/Vercel de produção ainda depende da migração e configuração descritas em `docs/blog-cms.md`. Não foram alteradas contas ou matérias reais, nem feito deploy.

## Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `src/App.tsx` | Encaminhamento para módulos do blog; painel carregado sob demanda; remoção de dados de exemplo e do editor antigo; prioridade editorial na seção de notícias |
| `scripts/prerender-seo.mjs` | Preserva geração da home e prepara o shell; remove geração estática de blog/matérias/sitemap; permite build local sem credenciais |
| `vercel.json` | Rotas específicas para blog, matérias e sitemap; inclusão do shell nas funções |
| `package.json` | Editor/sanitização, ferramentas de teste, comandos de teste e Node 24 |
| `package-lock.json` | Lock das dependências adicionadas |

## Arquivo removido

`public/sitemap.xml`: substituído pela resposta dinâmica em `/sitemap.xml`. Sua permanência permitiria que um arquivo antigo fosse publicado junto ao build.

## Arquivos novos

| Arquivo | Responsabilidade |
|---|---|
| `src/features/blog/types.ts` | Tipos, estados editoriais e união discriminada dos blocos |
| `src/features/blog/utils.ts` | URLs, sanitização, slugs, validações e datas |
| `src/features/blog/services.ts` | Consultas, operações editoriais, taxonomia, rascunhos e mídia |
| `src/features/blog/BlogPage.tsx` | Listagem pública, filtros na URL, páginas individuais e metadata |
| `src/features/blog/blog.css` | Estilos exclusivos do CMS/blog e responsividade |
| `src/features/blog/admin/BlogAdminPage.tsx` | Dashboard, indicadores, filtros, ações, conflitos, categorias e biblioteca |
| `src/features/blog/editor/ArticleEditor.tsx` | Editor controlado, sidebar editorial, autosave e proteção de saída |
| `src/features/blog/editor/BlockEditor.tsx` | Edição, movimentação, duplicação e remoção de blocos |
| `src/features/blog/editor/RichTextEditor.tsx` | Tiptap, formatação, links, listas e conversão do HTML legado |
| `src/features/blog/editor/MediaUploader.tsx` | Upload, estado de envio, preview e associação de imagens |
| `src/features/blog/components/BlockRenderer.tsx` | Renderização segura dos blocos antigos e novos |
| `src/features/blog/components/ArticlePreview.tsx` | Prévia não publicada em desktop/mobile |
| `src/features/blog/components/Modal.tsx` | Dialog nativo, teclado, Escape e retorno de foco |
| `supabase/migrations/20260928_blog_cms.sql` | Migração preservando dados, triggers, RPCs, índices e RLS |
| `server/blog-html.mjs` | HTML e SEO seguros, JSON-LD, blocos e sitemap |
| `server/blog-runtime.mjs` | Cliente público do Supabase, shell e headers sem cache |
| `api/blog-index.js` | HTML dinâmico da listagem pública |
| `api/blog-page.js` | HTML dinâmico da matéria e HTTP 404/503 |
| `api/blog-sitemap.js` | Sitemap dinâmico em lotes |
| `tests/blog-database.test.mjs` | Migração, RLS, busca, estados, taxonomia e Storage |
| `tests/blog-html.test.mjs` | Blocos, sanitização, URLs, metadata e sitemap |
| `tests/blog-api.test.mjs` | Respostas HTTP, alterações sem rebuild, ocultação e agendamento |
| `tests/blog-browser.mjs` | Fluxos da aplicação em navegador real, desktop/mobile |
| `tests/fixtures/blog-server.mjs` | Supabase local de teste com PostgreSQL/RLS isolados |
| `tests/artifacts/.gitignore` | Mantém capturas geradas fora do versionamento |
| `docs/blog-cms.md` | Manual técnico/editorial, ativação e decisões de arquitetura |
| `docs/blog-entrega.md` | Este relatório |

## Funcionalidades implementadas

- Dashboard com indicadores e filtros por status, categoria e destaque; busca sem acento por título/resumo/categoria/tags/slug; ordenação e paginação no banco.
- Criação, edição, duplicação de matéria, prévia, publicação, suspensão, agendamento, lixeira, restauração e exclusão definitiva com confirmação.
- Editor principal com sidebar de publicação, organização, URL e SEO; tags reutilizáveis; categorias com criação e renomeação vinculadas às matérias.
- Autosave com debounce em edições separadas, recuperação e resolução explícita de conflitos; proteção contra saída com alterações não persistidas ou uploads.
- Blocos de texto, produto e links preservados; imagem com alt/legenda/crédito, H2/H3, citação, marcadores, lista numerada, separador e botão.
- Editor rico sem `execCommand`, incluindo links, títulos, listas, citação, alinhamento, cor e tamanho; drag-and-drop e setas acessíveis; duplicação de blocos.
- Upload com limites e validações de MIME/assinatura, otimização de imagens grandes, preview, substituição e biblioteca paginada com reutilização e exclusão protegida.
- Destaques reais ordenados pela publicação; datas editoriais; busca pública com nomes das listas; filtros combinados na URL; relacionadas por categoria/tags/data.
- SEO editável por matéria, JSON-LD BlogPosting, HTML e sitemap dinâmicos; matéria indisponível com HTTP 404.

## Bugs corrigidos

- Lista vazia realmente vazia, sem placeholders ou conteúdo antigo; falhas de consulta ficam visíveis com tentativa novamente.
- Troca entre artigos atualiza todos os campos, eliminando o uso de `defaultValue` no editor.
- `updated_at` é atualizado pelo banco; `published_at` substitui `created_at` como data editorial.
- Slugs recebem sufixos em caso de colisão; título editado não troca automaticamente a URL existente.
- `featured` passa a determinar prioridade; busca não depende de caixa ou acentos e alcança livros dentro de listas.
- Largura/alinhamento dos blocos deixam de ser anulados pelo CSS antigo; mobile empilha o conteúdo.
- Protocolos perigosos e HTML executável são bloqueados; operações verificam os registros afetados.
- Exclusão normal passa a ser lixeira; imagens compartilhadas ou presentes em rascunhos não podem ser apagadas pela biblioteca.
- O SEO das matérias e o sitemap deixam de depender de build após cada alteração editorial.

## Banco, agendamento e compatibilidade

A migração é transacional e não apaga artigos. Preserva IDs e JSON; mantém `category` para compatibilidade e acrescenta sua referência normalizada. Categorias/tags são consolidadas sem duplicar nomes equivalentes. Matérias antes publicadas recebem `published_at` a partir da criação, pois não existe histórico melhor disponível.

Slugs existentes permanecem. Slugs antigos ausentes recebem o formato anterior `titulo-ID`; em colisões já ambíguas, recebem sufixo para não bloquear a migração. Os blocos legados continuam renderizando e são sanitizados.

O agendamento é liberado por `now()` no PostgreSQL, dentro das regras públicas e das RPCs: não requer painel aberto, cron ou relógio correto do visitante. O status físico pode continuar Agendado após a data; o estado efetivo passa a Publicado. Não há Realtime para atualizar automaticamente abas já abertas.

## SEO

`/blog`, `/blog/:slug` e `/sitemap.xml` consultam dados públicos por funções Node da Vercel. Título/descrição/imagem SEO opcionais têm fallback. JSON-LD inclui datas e URL, sem inventar autoria. HTML, atributos e JSON-LD são escapados e o conteúdo rico é sanitizado no servidor.

As respostas usam `no-store`. Suspensão/lixeira deixam de retornar conteúdo de matéria; ausência retorna 404. O sitemap exclui rascunhos, futuras agendadas e conteúdos ocultos, com `lastmod`. Um novo deploy é necessário para instalar esta implementação; as mudanças editoriais seguintes dispensam rebuild.

## Segurança

As permissões continuam no banco: visitante só lê conteúdo público, e login sem vínculo em `admin_users` não permite administração. RLS também protege categorias, tags, rascunhos de edição e Storage. As funções públicas usam chave pública, sem service-role.

DOMPurify substitui a sanitização artesanal. URLs externas só aceitam HTTP/HTTPS e abrem com `noopener noreferrer`. Uploads validam formato, assinatura e tamanho; o bucket restringe MIME/tamanho. A exclusão de mídia verifica todas as referências e é protegida por política e lock transacional. Um salvamento não pode reanexar um arquivo local já removido.

## Testes executados

| Comando/verificação | Resultado |
|---|---|
| `npm test` | Build + 19 testes automatizados de banco/HTML/HTTP + fluxos de navegador |
| `npm run build` | TypeScript e Vite aprovados; bundles de painel separados da home |
| `npx tsc -b` | Aprovado |
| `npx eslint src` | Aprovado, sem erros/warnings introduzidos |
| `git diff --check` | Aprovado |
| Comparação AST com versão anterior | Header, Footer, Home, BooksStrip, Socials e SocialLink preservados |
| `npm run lint` | Dois erros e um warning preexistentes na pasta independente `lendo-saficos-links`; fora do escopo e não modificados |
| `npm audit --json` online | Seis avisos em ferramentas já existentes; as versões afetadas foram comparadas com o lock anterior e permanecem iguais |

O navegador testa login, senha inválida, usuário sem papel administrativo, busca/lista vazia, autosave sem publicação, recuperação/conflito, troca de matérias, prévia/Escape, reordenação/duplicação de blocos, criação/duplicação/publicação/suspensão/lixeira/restauração/exclusão definitiva, categorias, tags, slug, SEO, agendamento, destaque, upload válido/inválido/substituição, biblioteca, busca pública/URL, conteúdo antigo, matéria inexistente e desktop/mobile sem overflow horizontal. Não foram observados erros JavaScript nos fluxos aprovados.

Os testes PostgreSQL executam a migração e RLS reais em PGlite; o login e o protocolo Supabase são fornecidos por um servidor local de teste. Os testes HTTP executam os handlers reais. Isso valida o código local, sem equivaler a uma validação do projeto cloud de produção.

Capturas locais geradas: `tests/artifacts/admin-desktop.png`, `tests/artifacts/admin-mobile.png` e `tests/artifacts/editor-desktop.png`. A revisão visual conferiu hierarquia, responsividade e identidade visual.

## Pendências de ativação

1. Aplicar a migração no Supabase real após backup. Não houve acesso/credenciais administrativas disponíveis para executar esse passo.
2. Configurar as variáveis públicas do Supabase na Vercel e publicar a nova versão com Node 24.
3. Validar Auth/Storage e as rotas de funções no domínio real. Os handlers foram testados localmente; o empacotamento/roteamento e as configurações da conta Vercel só podem ser confirmados após deploy.

O build local informa a ausência de variáveis reais e conserva o HTML base da home. O CMS conectado não deve ser ativado sem a migração. Comentários, pagamentos, newsletter, IA, leitores autenticados e demais recursos excluídos do pedido não foram adicionados.

A pasta `lendo-saficos-links` e o arquivo `og-lendo-saficos.png`, que já estavam não rastreados, permanecem preservados. O envio para `main` deve ocorrer após a migração do banco, pois essa branch publica automaticamente na Vercel.
