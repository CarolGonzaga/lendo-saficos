import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const INDEX_FILE = path.join(DIST, "index.html");

const BASE_URL = "https://www.lendosaficos.com.br";

const viteEnv = loadEnv("production", ROOT);

const SUPABASE_URL =
    process.env.VITE_SUPABASE_URL ||
    viteEnv.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY =
    process.env.VITE_SUPABASE_ANON_KEY ||
    viteEnv.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        "VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrada durante o build."
    );
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
);

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeXml(value = "") {
    return escapeHtml(value);
}

function stripRichText(value = "") {
    return String(value)
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/p>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function slugify(value = "") {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

function articleSlug(article) {
    return (
        article.slug ||
        `${slugify(article.title)}-${article.id}`
    );
}

function articlePath(article) {
    return `/blog/${articleSlug(article)}`;
}

function absoluteUrl(value, fallback = "/images/5.jpeg") {
    const resolved = value || fallback;

    if (/^https?:\/\//i.test(resolved)) {
        return resolved;
    }

    return `${BASE_URL}${resolved.startsWith("/") ? resolved : `/${resolved}`
        }`;
}

function safeHref(value = "") {
    if (
        /^https?:\/\//i.test(value) ||
        value.startsWith("/")
    ) {
        return value;
    }

    return "#";
}

function insertBeforeHeadClose(html, value) {
    return html.replace(
        /<\/head>/i,
        `    ${value}\n  </head>`
    );
}

function setTitle(html, title) {
    const tag = `<title>${escapeHtml(title)}</title>`;

    if (/<title>[\s\S]*?<\/title>/i.test(html)) {
        return html.replace(
            /<title>[\s\S]*?<\/title>/i,
            tag
        );
    }

    return insertBeforeHeadClose(html, tag);
}

function setMeta(html, attribute, key, content) {
    const escapedKey = key.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );

    const regex = new RegExp(
        `<meta\\b[^>]*\\b${attribute}=["']${escapedKey}["'][^>]*>`,
        "i"
    );

    const tag =
        `<meta ${attribute}="${escapeHtml(key)}" ` +
        `content="${escapeHtml(content)}" />`;

    if (regex.test(html)) {
        return html.replace(regex, tag);
    }

    return insertBeforeHeadClose(html, tag);
}

function setCanonical(html, url) {
    const regex =
        /<link\b[^>]*\brel=["']canonical["'][^>]*>/i;

    const tag =
        `<link rel="canonical" ` +
        `href="${escapeHtml(url)}" />`;

    if (regex.test(html)) {
        return html.replace(regex, tag);
    }

    return insertBeforeHeadClose(html, tag);
}

function applySeo(
    template,
    {
        title,
        description,
        path: pathname,
        image = "/images/5.jpeg",
        type = "website",
    }
) {
    const url = `${BASE_URL}${pathname}`;
    const imageUrl = absoluteUrl(image);

    let html = template;

    html = setTitle(html, title);

    html = setMeta(
        html,
        "name",
        "description",
        description
    );

    html = setMeta(
        html,
        "name",
        "robots",
        "index, follow"
    );

    html = setMeta(
        html,
        "property",
        "og:title",
        title
    );

    html = setMeta(
        html,
        "property",
        "og:description",
        description
    );

    html = setMeta(
        html,
        "property",
        "og:url",
        url
    );

    html = setMeta(
        html,
        "property",
        "og:type",
        type
    );

    html = setMeta(
        html,
        "property",
        "og:image",
        imageUrl
    );

    html = setMeta(
        html,
        "property",
        "og:image:alt",
        title
    );

    html = setMeta(
        html,
        "name",
        "twitter:card",
        "summary_large_image"
    );

    html = setMeta(
        html,
        "name",
        "twitter:title",
        title
    );

    html = setMeta(
        html,
        "name",
        "twitter:description",
        description
    );

    html = setMeta(
        html,
        "name",
        "twitter:image",
        imageUrl
    );

    html = setCanonical(html, url);

    return html;
}

function replaceRoot(html, content) {
    const regex =
        /<div\b[^>]*\bid=["']root["'][^>]*>\s*<\/div>/i;

    if (!regex.test(html)) {
        throw new Error(
            'Não foi encontrado <div id="root"></div> no HTML gerado pelo Vite.'
        );
    }

    return html.replace(
        regex,
        `<div id="root">${content}</div>`
    );
}

function renderHeader() {
    return `
    <header class="site-header">
      <a
        class="brand"
        href="/"
        aria-label="Lendo Sáficos, página inicial"
      >
        <img
          src="/site-assets/lendo-saficos-logo.png"
          alt="Lendo Sáficos"
        />
      </a>

      <nav
        class="main-nav"
        aria-label="Navegação principal"
      >
        <a href="/">Início</a>
        <a href="/lista120livrossaficos">
          Lançamentos
        </a>
        <a href="/clubedascolecionadoras">
          Clube das Colecionadoras
        </a>
        <a href="/mapasaficobienal">
          Mapa Sáfico
        </a>
        <a href="/blog">Blog</a>
      </nav>
    </header>
  `;
}

function renderFooter() {
    return `
    <footer class="site-footer">
      <img
        src="/images/favicon.png"
        alt="Lendo Sáficos"
      />

      <span>
        © 2026 Lendo Sáficos.
        Todos os direitos reservados.
      </span>
    </footer>
  `;
}

function renderHome(articles) {
    const latest = articles
        .slice(0, 3)
        .map(
            (article) => `
        <article>
          <a href="${escapeHtml(articlePath(article))}">
            <h3>${escapeHtml(article.title)}</h3>
            <p>${escapeHtml(article.excerpt)}</p>
          </a>
        </article>
      `
        )
        .join("");

    return `
    ${renderHeader()}

    <main>
      <section class="hero wrap">
        <div class="hero-copy">
          <p class="eyebrow">Lendo Sáficos</p>

          <h1>
            O fandom da
            <em>literatura sáfica</em>
          </h1>

          <p class="description">
            Plataforma oficial do Lendo Sáficos,
            criada para reunir projetos, ideias,
            divulgações, lançamentos e recomendações
            de literatura sáfica.
          </p>
        </div>
      </section>

      <section class="wrap">
        <h2>Livros sáficos para descobrir em 2026</h2>

        <p>
          Conheça lançamentos, romances, autoras e
          novas histórias da literatura sáfica.
        </p>

        <a href="/lista120livrossaficos">
          Ver livros sáficos lançados em 2026
        </a>
      </section>

      <section class="wrap">
        <h2>Projetos Lendo Sáficos</h2>

        <p>
          <a href="/clubedascolecionadoras">
            Clube das Colecionadoras
          </a>
        </p>

        <p>
          <a href="/mapasaficobienal">
            Mapa Sáfico da Bienal do Livro de São Paulo 2026
          </a>
        </p>
      </section>

      <section class="wrap">
        <h2>Últimas matérias</h2>
        ${latest}
        <a href="/blog">Ver todas as matérias</a>
      </section>
    </main>

    ${renderFooter()}
  `;
}

function renderBlog(articles) {
    const cards = articles
        .map(
            (article) => `
        <article class="blog-card">
          ${article.image
                    ? `
                <img
                  src="${escapeHtml(article.image)}"
                  alt="${escapeHtml(article.title)}"
                />
              `
                    : ""
                }

          <div>
            <span class="category-tag">
              ${escapeHtml(article.category)}
            </span>

            <h2>
              <a href="${escapeHtml(articlePath(article))}">
                ${escapeHtml(article.title)}
              </a>
            </h2>

            <p>${escapeHtml(article.excerpt)}</p>

            <a href="${escapeHtml(articlePath(article))}">
              Ler matéria →
            </a>
          </div>
        </article>
      `
        )
        .join("");

    return `
    ${renderHeader()}

    <main class="blog wrap">
      <header class="blog-intro">
        <p class="eyebrow">
          Notícias Lendo Sáficos
        </p>

        <h1>
          Histórias para
          <em>ler e descobrir.</em>
        </h1>

        <p>
          Notícias, listas, lançamentos e
          recomendações de literatura sáfica
          para encontrar sua próxima leitura.
        </p>
      </header>

      <section class="blog-grid">
        ${cards}
      </section>
    </main>

    ${renderFooter()}
  `;
}

function renderBlocks(blocks) {
    if (!Array.isArray(blocks)) {
        return "";
    }

    return blocks
        .map((block) => {
            if (block.type === "text") {
                const text = stripRichText(block.content);

                return text
                    ? `<p>${escapeHtml(text)}</p>`
                    : "";
            }

            if (block.type === "linklist") {
                const items = Array.isArray(block.items)
                    ? block.items
                    : [];

                const links = items
                    .map(
                        (item) => `
              <li>
                <a
                  href="${escapeHtml(safeHref(item.url))}"
                  rel="noreferrer"
                >
                  ${escapeHtml(item.title)}
                </a>
              </li>
            `
                    )
                    .join("");

                return `
          <section>
            ${block.title
                        ? `<h2>${escapeHtml(block.title)}</h2>`
                        : ""
                    }

            <ul>
              ${links}
            </ul>
          </section>
        `;
            }

            if (block.type === "product") {
                return `
          <article>
            ${block.title
                        ? `<h2>${escapeHtml(block.title)}</h2>`
                        : ""
                    }

            ${block.price
                        ? `<p>${escapeHtml(block.price)}</p>`
                        : ""
                    }

            ${block.url
                        ? `
                  <a
                    href="${escapeHtml(safeHref(block.url))}"
                    rel="noreferrer"
                  >
                    Ver produto
                  </a>
                `
                        : ""
                    }
          </article>
        `;
            }

            return "";
        })
        .join("");
}

function renderArticle(article) {
    return `
    ${renderHeader()}

    <main class="article-page wrap">
      <p class="category-tag">
        ${escapeHtml(article.category)}
      </p>

      <h1>${escapeHtml(article.title)}</h1>

      <p class="article-lead">
        ${escapeHtml(article.excerpt)}
      </p>

      ${article.image
            ? `
            <img
              class="article-cover"
              src="${escapeHtml(article.image)}"
              alt="${escapeHtml(article.title)}"
            />
          `
            : ""
        }

      <article class="article-blocks">
        ${renderBlocks(article.blocks)}
      </article>

      <nav
        class="article-navigation"
        aria-label="Navegação entre matérias"
      >
        <a href="/blog">
          ← Voltar para todas as matérias
        </a>
      </nav>
    </main>

    ${renderFooter()}
  `;
}

async function writeRoute(pathname, html) {
    if (pathname === "/") {
        await writeFile(INDEX_FILE, html, "utf8");
        return;
    }

    const segments = pathname
        .split("/")
        .filter(Boolean);

    const directory = path.join(
        DIST,
        ...segments
    );

    await mkdir(directory, {
        recursive: true,
    });

    await writeFile(
        path.join(directory, "index.html"),
        html,
        "utf8"
    );
}

function buildSitemap(articles) {
    const staticPaths = [
        "/",
        "/blog",
        "/lista120livrossaficos",
        "/clubedascolecionadoras",
        "/mapasaficobienal",
    ];

    const paths = [
        ...staticPaths,
        ...articles.map(articlePath),
    ];

    const urls = paths
        .map(
            (pathname) => `
  <url>
    <loc>${escapeXml(`${BASE_URL}${pathname}`)}</loc>
  </url>`
        )
        .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`;
}

async function main() {
    console.log(
        "[SEO] Iniciando prerender..."
    );

    const template = await readFile(
        INDEX_FILE,
        "utf8"
    );

    const { data, error } = await supabase
        .from("blog_articles")
        .select(
            "id, category, title, excerpt, image, status, blocks, slug, created_at"
        )
        .eq("status", "Publicado")
        .order("created_at", {
            ascending: false,
        });

    if (error) {
        throw new Error(
            `[SEO] Erro ao consultar blog_articles: ${error.message}`
        );
    }

    const articles = data ?? [];

    /*
     * HOME
     */
    let homeHtml = applySeo(template, {
        title:
            "Livros Sáficos, Literatura e Lançamentos | Lendo Sáficos",
        description:
            "Descubra livros sáficos, lançamentos, romances, autoras, recomendações e novidades da literatura sáfica no Lendo Sáficos.",
        path: "/",
        image: "/images/5.jpeg",
        type: "website",
    });

    homeHtml = replaceRoot(
        homeHtml,
        renderHome(articles)
    );

    await writeRoute("/", homeHtml);

    /*
     * BLOG
     */
    let blogHtml = applySeo(template, {
        title:
            "Blog de Literatura Sáfica: Livros, Autoras e Novidades | Lendo Sáficos",
        description:
            "Notícias, listas, lançamentos, recomendações e matérias sobre livros, autoras e literatura sáfica.",
        path: "/blog",
        image: "/images/5.jpeg",
        type: "website",
    });

    blogHtml = replaceRoot(
        blogHtml,
        renderBlog(articles)
    );

    await writeRoute("/blog", blogHtml);

    /*
     * ARTIGOS
     */
    for (const article of articles) {
        const pathname = articlePath(article);

        let articleHtml = applySeo(template, {
            title: `${article.title} | Lendo Sáficos`,
            description: article.excerpt,
            path: pathname,
            image:
                article.image || "/images/5.jpeg",
            type: "article",
        });

        articleHtml = replaceRoot(
            articleHtml,
            renderArticle(article)
        );

        await writeRoute(
            pathname,
            articleHtml
        );
    }

    /*
     * SITEMAP
     */
    await writeFile(
        path.join(DIST, "sitemap.xml"),
        buildSitemap(articles),
        "utf8"
    );

    console.log(
        `[SEO] Prerender concluído: ${articles.length} artigo(s) publicado(s).`
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});