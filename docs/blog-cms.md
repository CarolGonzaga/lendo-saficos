# Blog e CMS editorial

## Arquitetura e escopo

O site continua em React + Vite. `App.tsx` mantém o header, footer, home e login já existentes e encaminha as rotas de blog para `src/features/blog`. O painel é carregado sob demanda; o editor Tiptap não entra no bundle inicial da home. A única mudança funcional na seção de notícias da home é respeitar destaque e a data editorial.

O CMS usa Supabase Auth, PostgreSQL com RLS e o bucket público `blog-media`. Não há chave service-role no navegador ou nas funções públicas de SEO.

## Ativação no ambiente real

1. Faça backup do banco e do bucket antes de aplicar a migração. Em instalação nova, execute primeiro `supabase/schema.sql`; em instalação existente, execute somente `supabase/migrations/20260928_blog_cms.sql` pelo SQL Editor ou pelo fluxo de migrations do projeto.
2. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no Vite e na Vercel. As funções também aceitam `SUPABASE_URL` e `SUPABASE_ANON_KEY` (chaves públicas). Nunca use service-role nesses campos.
3. Preserve o cadastro de administradoras em `admin_users`. Não é criado nenhum usuário novo pela migração.
4. Use Node 24 na Vercel, compatível com a dependência de sanitização no servidor. Faça deploy após aplicar a migração.
5. Confira em produção `/admin`, `/blog`, `/blog/:slug` e `/sitemap.xml`. Publicações, suspensões e agendamentos posteriores não precisam de novo deploy.

Esta entrega não executou SQL ou deploy em produção: não havia conexão/credenciais de administração desse ambiente disponíveis. O build local sem variáveis conserva o HTML base da home e prepara `dist/blog-shell.html`; o blog conectado exige as variáveis e a migração acima.

## Banco e compatibilidade

A migração é transacional e preserva IDs, título, resumo, capa e blocos JSON existentes. URLs legadas sem slug são preenchidas com `titulo-normalizado-ID`, o formato usado anteriormente. Slugs existentes são preservados.

São adicionados `category_id`, `tags`, `cover_alt`, `published_at`, `scheduled_at`, `deleted_at`, `seo_title`, `seo_description` e `seo_image`. `category` permanece para clientes antigos. As categorias existentes são consolidadas em `blog_categories`; renomear uma categoria atualiza as matérias vinculadas. `blog_tags` é um catálogo de sugestões e cada matéria guarda um array de nomes normalizados, uma estrutura equivalente a múltiplas tags sem tabelas de junção desnecessárias.

`published_at` das matérias que já estavam publicadas é preenchido com `created_at`, pois não há histórico confiável de publicação anterior. Novas publicações usam a data editorial. Um trigger atualiza `updated_at`, valida o agendamento, consolida tags/categorias e resolve colisões de slug com `-2`, `-3`, etc. Índices atendem slug, status/datas, categoria, tags e atualização.

Os tipos `text`, `product` e `linklist` continuam válidos. Texto HTML legado é sanitizado e `font` é convertido ao abrir no Tiptap. Novos blocos incluem imagem, H2, H3, citação, marcadores, lista numerada, separador e botão. Larguras e alinhamento agora são respeitados no desktop; no mobile os blocos são empilhados.

## Fluxo editorial

O dashboard é centrado na listagem. Indicadores de publicadas, rascunhos, agendadas e suspensas funcionam como filtros. Há busca sem acentos, filtros por status/categoria/destaque, cinco ordenações e paginação de 12 itens no banco. A listagem mostra capa, organização, status, destaque e datas; as ações secundárias ficam em um menu.

O editor possui conteúdo principal e sidebar de publicação, organização, URL e SEO. Todos os campos são controlados. Categorias são administradas no dashboard e tags podem ser reutilizadas por sugestões. Prévia aceita mudanças ainda não salvas e oferece largura desktop/mobile, sem publicar.

Após 2,5 segundos sem digitação, o autosave preserva a edição. Para uma matéria nova com título/resumo válidos, cria um rascunho e salva a edição em `blog_editor_drafts`; para uma existente, guarda somente a edição separada da administradora. **Autosave não altera o conteúdo público.** Ao reabrir, a edição é recuperada. Salvar matéria ou Publicar agora aplica o conteúdo à matéria e remove a edição temporária. Autosave aguarda uploads e salvamentos; erros interrompem tentativas para o mesmo conteúdo até haver nova edição ou salvamento manual. Fechar a aba com mudanças ainda não persistidas ou upload em andamento aciona proteção de saída.

As atualizações explícitas comparam `updated_at` para evitar sobrescrever alterações de outra sessão. Um rascunho de edição baseado em versão antiga não é aplicado automaticamente: um modal permite visualizar ambas as versões, recuperar a edição para revisar ou descartá-la com confirmação e abrir a versão atual. Não há merge automático ou histórico completo de revisões.

Publicar, suspender, mover à lixeira, restaurar e excluir confirmam a linha afetada. A lixeira preserva o conteúdo; restauração retorna a Rascunho. Exclusão definitiva exige confirmação e só ocorre na lixeira. Duplicação cria ID/slug novos, status Rascunho e sem datas de publicação/agendamento ou destaque herdado.

## Agendamento real

A visibilidade é determinada por `blog_is_public` no PostgreSQL: Agendado com `scheduled_at <= now()` torna-se público automaticamente, mesmo com o painel fechado. Não depende de timer no navegador ou cron da Vercel. Consultas públicas, RLS, listagem e sitemap usam essa mesma regra.

O status persistido pode continuar `Agendado` depois da data; o painel mostra o estado editorial efetivo como Publicado e usa a data agendada como data de publicação. O estado efetivo é retornado pelo banco, e a RPC de consulta pública por slug impede que o relógio do dispositivo decida a liberação. Ao salvar a matéria novamente, o editor normaliza para Publicado. Uma aba aberta anteriormente precisa atualizar/consultar novamente; não há assinatura Realtime.

Datas são armazenadas em UTC e os campos `datetime-local` e a exibição usam o fuso do dispositivo da administradora. Para agendar no horário de Brasília, o dispositivo deve estar configurado nesse fuso.

## Imagens

Uploads permitem JPG, PNG, WebP e GIF até 10 MB; o bucket recebe os mesmos limites. Além do MIME, o cliente verifica a assinatura binária para recusar arquivos falsamente identificados como imagem. O cliente decodifica imagens estáticas, limita o maior lado a 2400 px quando necessário e tenta WebP com qualidade 92%; só usa o arquivo otimizado se for menor. GIF não é reprocessado. Há estado de envio, preview, substituição/remoção de associação, alt, legenda e crédito nos blocos de imagem.

A biblioteca lista arquivos em páginas e permite copiar URLs/reutilizar imagens. Arquivos não associados ficam disponíveis na biblioteca; não há limpeza automática destrutiva. A exclusão manual verifica referências em **todas** as matérias, incluindo lixeira/rascunhos, e nas edições temporárias. A política do Storage repete a verificação dentro da transação, com o mesmo lock dos salvamentos. Salvamentos recusam URLs locais do bucket cujo arquivo já foi removido. Substituir/remover uma imagem do formulário não exclui o arquivo.

Como o bucket já era público, imagens de rascunhos continuam públicas para quem tiver a URL. Apenas o conteúdo editorial é protegido por status/RLS.

## Blog público

Busca, categoria e tag podem ser combinadas e ficam na URL (`q`, `categoria`, `tag`, `pagina`). A busca inclui título, resumo, categoria, tags, conteúdo dos blocos e nomes das listas, sem distinguir caixa/acentos. A paginação também é no banco. Destaques aparecem primeiro, ordenados pela data editorial; demais matérias seguem pela publicação. A home usa essa mesma prioridade.

Relacionadas priorizam mesma categoria, quantidade de tags em comum e publicação recente; excluem a própria matéria e limitam a três. Matéria ausente, suspensa, na lixeira ou ainda agendada recebe estado de indisponibilidade em React e HTTP 404 na rota dinâmica de produção.

## SEO sem rebuild editorial

As funções Node `api/blog-index.js`, `api/blog-page.js` e `api/blog-sitemap.js` são encaminhadas pelas rotas específicas na Vercel antes do proxy de outras áreas. Usam chave pública e RLS, sem sessão administrativa. O shell inclui os assets produzidos pelo Vite e o conteúdo HTML é consultado a cada requisição, com `no-store` no navegador e nas CDNs.

Título, descrição e imagem SEO usam os campos opcionais e fazem fallback para título/resumo/capa. A página de matéria produz `BlogPosting` com headline, descrição, imagem, datas e URL, sem autoria inventada. JSON-LD e atributos são escapados; texto rico usa DOMPurify também no servidor. O sitemap consulta em lotes de 500 e inclui somente conteúdo efetivamente público, com `lastmod`.

O script de prerender continua cuidando da home e preparando o shell, mas não gera versões estáticas de blog/matérias/sitemap que poderiam ficar antigas. `robots.txt` continua indicando `/sitemap.xml`. Cache externo de redes sociais ou mecanismos de busca pode demorar a atualizar, embora o servidor passe a responder com o conteúdo novo imediatamente.

## Segurança e testes

RLS protege matérias, categorias, tags, edições temporárias e Storage. Uma conta autenticada sem `admin_users` não recebe acesso de administração. O cliente e o renderizador validam URLs; links externos usam `noopener noreferrer`. O banco também rejeita protocolos perigosos em blocos. DOMPurify remove HTML executável e restringimos os estilos a cor, tamanho e alinhamento.

`npm test` executa build, testes Node e navegador. Testes de PostgreSQL usam PGlite com a migração e políticas reais, em banco isolado. Os testes HTTP executam as funções com um servidor local que usa esse banco. Os testes de interface usam Playwright com Microsoft Edge e Supabase local de teste, sem tocar em contas ou matérias reais. Para outra plataforma, ajuste o canal do navegador em `tests/blog-browser.mjs` para um Chromium instalado.

`npx tsc -b` e `npx eslint src` verificam o código da aplicação. `npm run lint` também alcança a pasta independente não rastreada `lendo-saficos-links`; nela já existiam erros em `.next/types/routes.d.ts` e um warning em `app/layout.tsx` antes das mudanças. Não foram alterados. A auditoria npm identificou seis avisos em dependências de ferramentas existentes (baseline-browser-mapping, brace-expansion, browserslist, js-yaml, nanoid e postcss); não foi feito upgrade global fora do escopo do blog.

## Limites e validação em produção

A migração e os fluxos são validados localmente com PostgreSQL e navegador isolados. Configuração real de Supabase Auth, limites operacionais do Storage, permissões do projeto, empacotamento das funções e roteamento/cache da Vercel precisam de validação após ativação. O Vite local não fornece as funções Vercel; os testes HTTP as executam diretamente. Não há publicação automática nesta entrega.

## Referências técnicas

O editor segue a integração oficial [React com Tiptap](https://tiptap.dev/docs/editor/getting-started/install/react). A hospedagem usa [funções Node da Vercel](https://vercel.com/docs/functions/runtimes/node-js) com [rewrites](https://vercel.com/docs/routing/rewrites); Node 24 é uma versão [suportada pela plataforma](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). O banco isolado dos testes usa a extensão [unaccent do PGlite](https://pglite.dev/extensions/).
