import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type ArticleStatus = "Publicado" | "Rascunho" | "Suspenso";
type ContentAlign = "left" | "center" | "right" | "justify";
type ListItem = { title: string; url: string };
type ArticleBlock = {
  id: string;
  type: "text" | "product" | "linklist";
  content?: string;
  title?: string;
  price?: string;
  url?: string;
  image?: string;
  items?: ListItem[];
  span: number;
  align: ContentAlign;
};
type Article = {
  id: number;
  category: string;
  title: string;
  excerpt: string;
  image: string;
  status: ArticleStatus;
  featured?: boolean;
  blocks?: ArticleBlock[];
  slug?: string;
};
const defaultCategories = ["Destaque", "Listas", "Tropes", "Novidades"];
const kindleTemplate: ArticleBlock[] = [
  {
    id: "kindle-intro-1",
    type: "text",
    content:
      "O Encha Seu Kindle acontece por apenas 24 horas e, como sempre, muita gente fica perdida tentando descobrir quais livros valem a pena baixar antes que o evento acabe.",
    span: 8,
    align: "left",
  },
  {
    id: "kindle-intro-2",
    type: "text",
    content:
      "Pensando nisso, eu separei uma lista com os livros sáficos que estão gratuitos na Amazon durante a ação. A ideia é facilitar a busca de quem acompanha o Lendo Sáficos e reunir, em um só lugar, títulos com romances, personagens e histórias sáficas para você conhecer.",
    span: 8,
    align: "left",
  },
  {
    id: "kindle-warning",
    type: "text",
    content:
      "Só fica o aviso: antes de baixar qualquer livro, confira se o valor está realmente zerado na Amazon. Como o evento dura pouco tempo, os preços podem mudar ao longo do dia, e cada autora ou editora é responsável pela participação do próprio título.",
    span: 8,
    align: "left",
  },
  {
    id: "kindle-romance",
    type: "linklist",
    title: "Romance | Comédia Romântica | Drama",
    span: 12,
    align: "left",
    items:
      `Stupid Wife: Lembre-se de Nós|https://amzn.to/3TISGxt;Águas de Março - Volume 1|https://amzn.to/45m2K1S;Águas de Março - Volume 2|https://amzn.to/4qaFv4v;Sob Medida|https://amzn.to/4gc7Gvh;Boa Sorte, Querida!|https://link.amazon/B06rJ5a9I;Tudo se tornou ela|https://amzn.to/4i1ciXt;Tela em Branco: Um conto de Natal|https://amzn.to/3S4cpqE;Dias de Chuva|https://amzn.to/4g2w43L;Cinco Minutos|https://amzn.to/4wlTdmi;O que eu quero de Natal é você|https://amzn.to/4wnHGDi;A crush do Karaokê|https://amzn.to/4zaJOAG;Anotações do Amor|https://amzn.to/45UEtA2;Minha Segunda Versão de Você|https://amzn.to/45mviIG;Young Love|https://amzn.to/4wok80S;Nem Tão Sozinha na Multidão|https://amzn.to/4cD2bEL;Um Natal Mágico|https://amzn.to/4i3aP2P;As Estrelas e Nós|https://amzn.to/3TSHYEy;Sentença|https://link.amazon/B05QpDV1h;Fantasma Da Meia-Noite|https://amzn.to/4zeoOJl;Cláusula da Paixão|https://amzn.to/4x57Uvl;Cerbeijada|https://amzn.to/45X6Tte;Uma Surpresa Natalina|https://amzn.to/4qeJvkz;O destino que roubei do universo|https://amzn.to/4qbSkv6;Como cheguei até você|https://amzn.to/4gsBwwI;Posso ser ela?|https://amzn.to/4qknnVW;Entre Auroras Boreais|https://amzn.to/45GzlzL;6.am: a hora mais curta|https://amzn.to/4g4eaw3;Óbvio demais|https://amzn.to/4g5zXDM;Isso não estava no protocolo|https://amzn.to/4wPgP3S;Seis é Demais|https://amzn.to/4gs6dlH;Cartas para a Lua|https://amzn.to/4xFE7tg;Ponto de Partida|https://amzn.to/4x1rGYQ;Tudo que eu não planejei|https://amzn.to/3RJE4gH;Encontros e desencontros|https://amzn.to/4ccNgB2;Desarmonia|https://amzn.to/4g7O0sw;Vegas Não Estava nos Planos... Nem Ela!|https://amzn.to/3S1RTam;Da Lua até Saturno|https://amzn.to/4wYt6Dg;O Nome Dela é Sophia|https://amzn.to/4ze04ky;Beijos com sabor de verão|https://amzn.to/4wUc60R;Tristeza|https://amzn.to/4c47yNh;Meu presente de Natal|https://amzn.to/4cf0HQU;Estigmatizadas|https://amzn.to/4ws7NZM;Um solo de Natal|https://link.amazon/B07Ipa82k;O sofá (quase) roubado|https://link.amazon/B00eO4liy;O contrato do nosso casamento|https://link.amazon/B02ms86hf;Tudo que eu não sabia sentir|https://link.amazon/B08ki0kUE;Daiquiris|https://link.amazon/B00CjlS1e;Sussurros de inverno|https://link.amazon/B0iQRH9ed;Muito barulho por você|https://link.amazon/B0iSFAnQs`
        .split(";")
        .map((item) => {
          const [title, url] = item.split("|");
          return { title, url };
        }),
  },
  {
    id: "kindle-dark",
    type: "linklist",
    title: "Suspense | Horror | Dark",
    span: 12,
    align: "left",
    items:
      `Xeque-Mate|https://amzn.to/45GzxPv;O Propósito das Sombras: Parte 01|https://amzn.to/4z9sLzb;Apague as Luzes ao Anoitecer|https://amzn.to/4wZHf32;Herdeira Vingança|https://amzn.to/4xBIIwo;Eu Não Te Vejo|https://amzn.to/4geJDMm;Venus Devotion|https://amzn.to/4xFEhAS;Unhas e dentes|https://link.amazon/B0e6e8abd`
        .split(";")
        .map((item) => {
          const [title, url] = item.split("|");
          return { title, url };
        }),
  },
  {
    id: "kindle-fantasy",
    type: "linklist",
    title: "Fantasia | Romantasia",
    span: 12,
    align: "left",
    items:
      `Que a melhor mordida vença|https://amzn.to/4xBhDcO;Um desejo ao destino|https://amzn.to/4zeQhux;Beleza monstruosa|https://amzn.to/4i4nB17;O natal da família Murray|https://amzn.to/4zswjwC;O Espelho da Lua|https://amzn.to/4qbSrqw;Como NÃO ressuscitar uma ex-namorada MORTA|https://amzn.to/4wVTgXm;WOUNDS - O Véu do Arcano|https://amzn.to/4wUFMeb;Mil corações por um reino|https://link.amazon/B08VBxQtc;Sementes podres|https://link.amazon/B0eGsrB5s;Asas negras|https://link.amazon/B06GSahIh;Presas|https://link.amazon/B0h8VC4hU`
        .split(";")
        .map((item) => {
          const [title, url] = item.split("|");
          return { title, url };
        }),
  },
  {
    id: "kindle-end",
    type: "text",
    content: "A lista será atualizada ao longo do evento!",
    span: 12,
    align: "center",
  },
];
type SocialLinkProps = { href: string; label: string; children: ReactNode };

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }
function articleSlug(article: Article) { return article.slug || `${slugify(article.title)}-${article.id}`; }
function articleHref(article: Article) { return `/blog/${articleSlug(article)}`; }

function sanitizeRichText(value = "") {
  const allowed = new Set(["B", "STRONG", "I", "EM", "SPAN", "FONT", "BR"]);
  const template = document.createElement("template");
  template.innerHTML = value;
  const clean = (node: Element) => {
    Array.from(node.children).forEach((child) => {
      if (!allowed.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      Array.from(child.attributes).forEach((attribute) => {
        const permittedStyle =
          child.tagName === "SPAN" &&
          attribute.name === "style" &&
          /^(color|font-size)\s*:/i.test(attribute.value.trim());
        const permittedFontAttribute =
          child.tagName === "FONT" && ["color", "size"].includes(attribute.name);
        if (!permittedStyle && !permittedFontAttribute)
          child.removeAttribute(attribute.name);
      });
      clean(child);
    });
  };
  clean(template.content as unknown as Element);
  return template.innerHTML;
}

function RichTextEditor({
  value = "",
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const format = (command: string, argument?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    if (editorRef.current) onChange(sanitizeRichText(editorRef.current.innerHTML));
  };
  return (
    <div className="rich-editor">
      <div className="rich-toolbar">
        <button
          type="button"
          aria-label="Negrito"
          onMouseDown={(event) => {
            event.preventDefault();
            format("bold");
          }}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          aria-label="Itálico"
          onMouseDown={(event) => {
            event.preventDefault();
            format("italic");
          }}
        >
          <i>I</i>
        </button>
        <label aria-label="Cor do texto">
          <input
            type="color"
            defaultValue="#56132f"
            onInput={(event) =>
              format("foreColor", (event.target as HTMLInputElement).value)
            }
          />
        </label>
        <select
          defaultValue="3"
          aria-label="Tamanho do texto"
          onChange={(event) => format("fontSize", event.target.value)}
        >
          <option value="2">Pequeno</option>
          <option value="3">Normal</option>
          <option value="4">Grande</option>
          <option value="5">Destaque</option>
        </select>
      </div>
      <div
        ref={editorRef}
        className="rich-content"
        contentEditable
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
        onInput={(event) =>
          onChange(sanitizeRichText(event.currentTarget.innerHTML))
        }
      />
    </div>
  );
}

const initialArticles: Article[] = [
  {
    id: 1,
    category: "Destaque",
    title: "Romances sáficos para colocar na sua próxima lista de leitura",
    excerpt:
      "Uma seleção para descobrir novas autoras, histórias intensas e romances que ficam na memória.",
    image: "/images/1.jpg",
    status: "Publicado",
    featured: true,
    blocks: [
      {
        id: "intro",
        type: "text",
        content:
          "Descubra histórias de amor, personagens inesquecíveis e novas autoras para acompanhar.",
        span: 8,
        align: "left",
      },
    ],
  },
  {
    id: 2,
    category: "Listas",
    title: "10 romances sáficos para aquecer o coração",
    excerpt: "Livros que vão te fazer suspirar, rir e se apaixonar.",
    image: "/images/2.jpg",
    status: "Publicado",
  },
  {
    id: 3,
    category: "Tropes",
    title: "Enemies to lovers: por que amamos essa tensão?",
    excerpt: "Entenda por que esse trope é um dos favoritos das leitoras.",
    image: "/images/3.jpg",
    status: "Publicado",
  },
  {
    id: 4,
    category: "Novidades",
    title: "Lançamentos sáficos para acompanhar neste ano",
    excerpt: "Histórias que merecem entrar no seu radar de leituras.",
    image: "/images/4.jpg",
    status: "Publicado",
  },
];
const coverFiles = Array.from({ length: 129 }, (_, index) => {
  const number = index + 1;
  const extension =
    number <= 9 || (number >= 66 && number <= 85) ? "jpg" : "jpeg";
  return `/images/covers/${number}.${extension}`;
});

function Arrow() {
  return <span aria-hidden="true">→</span>;
}
function SocialLink({ href, label, children }: SocialLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {children}
    </a>
  );
}

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Lendo Sáficos, página inicial">
        <img src="/site-assets/lendo-saficos-logo.png" alt="Lendo Sáficos" />
      </a>
      <nav className="main-nav" aria-label="Navegação principal">
        <a href="/">Início</a>
        <a href="https://www.lendosaficos.com.br/lista120livrossaficos">
          Lançamentos
        </a>
        <a href="https://www.lendosaficos.com.br/clubedascolecionadoras">
          Clube das Colecionadoras
        </a>
        <a href="https://www.lendosaficos.com.br/mapasaficobienal/login">
          Mapa Sáfico
        </a>
        <a href="/blog">Blog</a>
      </nav>
    </header>
  );
}
function Footer() {
  return (
    <footer className="site-footer">
      <img src="/images/favicon.png" alt="Lendo Sáficos" />
      <span>© 2026 Lendo Sáficos. Todos os direitos reservados.</span>
      <span>
        Desenvolvido por{" "}
        <a href="https://carolgonzaga.site/" target="_blank" rel="noreferrer">
          CarolGonzaga
        </a>
      </span>
    </footer>
  );
}
function Socials() {
  return (
    <nav className="socials" aria-label="Redes sociais">
      <SocialLink
        href="https://www.instagram.com/olendosaficos/"
        label="Instagram"
      >
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle className="dot" cx="17.2" cy="6.8" r="1" />
        </svg>
      </SocialLink>
      <SocialLink href="https://x.com/lendosaficos" label="X">
        <svg viewBox="0 0 24 24">
          <path d="M4 4l6.2 8.3L4.3 20H7l4.4-5.2L15.3 20H20l-6.6-8.8L18.9 4h-2.7l-4 4.8L8.7 4H4z" />
        </svg>
      </SocialLink>
      <SocialLink href="https://www.tiktok.com/@olendosaficos" label="TikTok">
        <svg className="filled-icon" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.79 4.79 0 0 1-3.77-4.7h-3.08v12.03a2.9 2.9 0 1 1-2.01-2.76V8.14a6.04 6.04 0 1 0 5.18 5.99V8.03a7.87 7.87 0 0 0 4.68 1.54V6.69Z" />
        </svg>
      </SocialLink>
      <SocialLink
        href="https://www.whatsapp.com/channel/0029Vb6HNUhFHWptCJYOEF24"
        label="WhatsApp"
      >
        <svg className="filled-icon" viewBox="0 0 24 24">
          <path d="M20.52 3.48A11.87 11.87 0 0 0 12.06 0C5.49 0 .15 5.34.15 11.91c0 2.1.55 4.14 1.6 5.94L.05 24l6.31-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.56 0 11.9-5.34 11.9-11.91 0-3.18-1.24-6.17-3.44-8.41Z" />
        </svg>
      </SocialLink>
    </nav>
  );
}

function coverAt(round: number, position: number) {
  return coverFiles[(round * 13 + position * 23) % coverFiles.length];
}

function BooksStrip() {
  const [round, setRound] = useState(0);
  const [replacingSlot, setReplacingSlot] = useState(-1);

  useEffect(() => {
    const delay = replacingSlot === -1 ? 3000 : 620;
    const timer = window.setTimeout(() => {
      if (replacingSlot < 4) setReplacingSlot((slot) => slot + 1);
      else {
        setRound((current) => current + 1);
        setReplacingSlot(-1);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [replacingSlot]);

  return (
    <section className="books-strip">
      <div className="wrap books-content">
        <div className="books-number">+120</div>
        <div className="books-copy">
          <h2>
            Livros sáficos
            <br />
            para descobrir em 2026
          </h2>
          <a
            className="text-link"
            href="https://www.lendosaficos.com.br/lista120livrossaficos"
            target="_blank"
            rel="noreferrer"
          >
            Ver lista completa <Arrow />
          </a>
        </div>
        <div
          className="covers-viewport"
          aria-label="Cinco capas de livros sáficos em movimento"
        >
          <div className="covers-track covers-count-5">
            {Array.from({ length: 5 }, (_, position) => {
              const isReplaced = position <= replacingSlot;
              const src = coverAt(round + (isReplaced ? 1 : 0), position);
              return (
                <div
                  className={`cover-slot cover-slot-${position + 1}`}
                  key={position}
                >
                  <img
                    className={`cover-orbit ${position === replacingSlot ? "cover-replacing" : ""}`}
                    key={src}
                    src={src}
                    alt="Capa de livro sáfico"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
function News({ articles }: { articles: Article[] }) {
  const published = articles.filter(
    (article) => article.status === "Publicado",
  );
  const [featured, ...others] = published;
  if (!featured) return null;
  return (
    <section className="news wrap">
      <div className="news-heading">
        <p className="eyebrow">
          Para ler
          <br />
          agora
        </p>
        <a className="text-link" href="/blog">
          Ver todas as matérias <Arrow />
        </a>
      </div>
      <a className="news-feature" href={articleHref(featured)}>
        <img src={featured.image} alt="" />
        <div>
          <p className="eyebrow">{featured.category}</p>
          <h3>{featured.title}</h3>
          <p>{featured.excerpt}</p>
          <b>
            Ler matéria <Arrow />
          </b>
        </div>
      </a>
      <div className="news-list">
        {others.slice(0, 2).map((article) => (
          <a className="news-small" href={articleHref(article)} key={article.id}>
            <div>
              <p className="eyebrow">{article.category}</p>
              <h3>{article.title}</h3>
              <p>{article.excerpt}</p>
              <b>
                Ler agora <Arrow />
              </b>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Home({ articles }: { articles: Article[] }) {
  return (
    <>
      <Header />
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <p className="eyebrow">Lendo Sáficos</p>
            <h1>O fandom da<br /><em>literatura sáfica</em></h1>
            <p className="description">
              Plataforma oficial do Lendo Sáficos, criada para reunir
              projetos, ideias e divulgações de livros sáficos nacionais e
              internacionais.
            </p>
            <Socials />
          </div>
          <div className="hero-art" aria-label="Universo visual Lendo Sáficos">
            <div className="art-background">
              <span />
              <span />
            </div>
            <img
              className="hero-photo hero-photo-main"
              src="/images/5.jpeg"
              alt="Pessoa em uma livraria"
            />
            <img
              className="hero-photo hero-photo-small"
              src="/images/hero2.jpeg"
              alt="Imagem complementar do universo Lendo Sáficos"
            />
            <span className="spark spark-one">✦</span>
            <span className="spark spark-two">✦</span>
          </div>
        </section>
        <BooksStrip />
        <section className="features wrap">
          <article className="feature-card club-feature">
            <div className="feature-copy">
              <p className="eyebrow">Colecione histórias</p>
              <h2>
                Clube das
                <br />
                Colecionadoras
              </h2>
              <p>
                Um álbum virtual para quem ama literatura sáfica. Responda
                quizzes, colecione figurinhas, complete pôsteres e ganhe
                recompensas exclusivas!
              </p>
              <a
                className="button button-primary"
                href="https://www.lendosaficos.com.br/clubedascolecionadoras"
              >
                Entrar no Clube <Arrow />
              </a>
            </div>
            <img
              className="feature-image"
              src="/images/clube.jpg"
              alt="Clube das Colecionadoras"
            />
          </article>
          <article className="feature-card map-feature">
            <div className="feature-copy">
              <p className="eyebrow">Encontre histórias pelo caminho</p>
              <h2>Mapa Sáfico</h2>
              <p>
                Explore o Mapa Sáfico e encontre editoras, autoras e histórias
                para celebrar na Bienal do Livro de São Paulo em 2026.
              </p>
              <a
                className="button button-purple"
                href="https://www.lendosaficos.com.br/mapasaficobienal/login"
              >
                Abrir Mapa Sáfico <Arrow />
              </a>
            </div>
            <img
              className="feature-image"
              src="/images/mapa.jpg"
              alt="Mapa Sáfico Bienal do Livro 2026"
            />
          </article>
        </section>
        <News articles={articles} />
      </main>
      <Footer />
    </>
  );
}

function ArticleBlocks({ blocks }: { blocks?: ArticleBlock[] }) {
  return (
    <div className="article-blocks">
      {blocks?.map((block) => (
        <div
          key={block.id}
          className={`article-block article-block-${block.type} align-${block.align}`}
          style={{ "--span": block.span } as CSSProperties}
        >
          {block.type === "text" ? (
            <p
              dangerouslySetInnerHTML={{
                __html: sanitizeRichText(block.content),
              }}
            />
          ) : block.type === "linklist" ? (
            <section className="book-link-list">
              <h2>{block.title}</h2>
              <div>
                {block.items?.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.title} <Arrow />
                  </a>
                ))}
              </div>
            </section>
          ) : (
            <article className="product-card">
              {block.image && (
                <img
                  src={block.image}
                  alt={block.title || "Produto recomendado"}
                />
              )}
              <div>
                <h3>{block.title}</h3>
                {block.price && <p>{block.price}</p>}
                {block.url && (
                  <a
                    className="button button-primary"
                    href={block.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver produto <Arrow />
                  </a>
                )}
              </div>
            </article>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryTag({
  category,
  onClick,
}: {
  category: string;
  onClick: () => void;
}) {
  return (
    <button className="category-tag" onClick={onClick}>
      {category}
    </button>
  );
}

function ArticleMetadata({ article }: { article: Article }) {
  useEffect(() => {
    const url = `https://www.lendosaficos.com.br${articleHref(article)}`;
    const title = `${article.title} | Lendo Sáficos`;
    document.title = title;
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", article.excerpt);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", url);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", title);
    document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", article.excerpt);
  }, [article]);
  return null;
}

function Blog({ articles }: { articles: Article[] }) {
  const published = articles.filter(
    (article) => article.status === "Publicado",
  );
  const categories = Array.from(
    new Set([
      ...defaultCategories,
      ...published.map((article) => article.category),
    ]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const requestedSlug = window.location.pathname.split("/").filter(Boolean)[1];
  const [selected, setSelected] = useState<Article | null>(() => requestedSlug ? published.find(article => articleSlug(article) === requestedSlug) ?? null : null);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      published.filter((article) => {
        const text =
          `${article.title} ${article.excerpt} ${article.category} ${article.blocks?.map((block) => `${block.content || ""} ${block.title || ""}`).join(" ") || ""}`.toLocaleLowerCase(
            "pt-BR",
          );
        return (
          (!category || article.category === category) &&
          (!search || text.includes(search.toLocaleLowerCase("pt-BR")))
        );
      }),
    [published, category, search],
  );
  const chooseCategory = (next: string) => {
    window.history.pushState({}, "", "/blog");
    setSelected(null);
    setCategory(next);
    setSearch("");
  };
  if (selected)
    return (
      <>
        <Header />
        <ArticleMetadata article={selected} />
        <main className="article-page wrap">
          <button className="back-link" onClick={() => { window.history.pushState({}, "", "/blog"); setSelected(null); }}>
            ← Voltar para notícias
          </button>
          <CategoryTag
            category={selected.category}
            onClick={() => chooseCategory(selected.category)}
          />
          <h1>{selected.title}</h1>
          <p className="article-lead">{selected.excerpt}</p>
          <img className="article-cover" src={selected.image} alt="" />
          <ArticleBlocks blocks={selected.blocks} />
          <nav className="article-navigation" aria-label="Navegação entre matérias">
            <a className="text-link" href="/blog">← Voltar para todas as notícias</a>
            <span>Continue explorando o Lendo Sáficos</span>
          </nav>
          <section className="related-articles" aria-labelledby="related-title">
            <h2 id="related-title">Você também pode gostar</h2>
            <div>{published.filter(article => article.id !== selected.id).slice(0, 3).map(article => <a href={articleHref(article)} key={article.id}><img src={article.image} alt="" /><span><small>{article.category}</small><b>{article.title}</b><em>Ler matéria →</em></span></a>)}</div>
          </section>
        </main>
        <Footer />
      </>
    );
  return (
    <>
      <Header />
      <main className="blog wrap">
        <header className="blog-intro">
          <p className="eyebrow">Notícias Lendo Sáficos</p>
          <h1>
            Histórias para
            <br />
            <em>ler e descobrir.</em>
          </h1>
          <p>
            Notícias, listas, lançamentos e recomendações de literatura sáfica
            para encontrar sua próxima leitura.
          </p>
        </header>
        <div className="news-tools">
          <label className="news-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar menções, temas ou categorias"
              aria-label="Buscar notícias"
            />
          </label>
          <nav className="category-menu" aria-label="Categorias de notícias">
            <button
              className={!category ? "active" : ""}
              onClick={() => chooseCategory("")}
            >
              Todas
            </button>
            {categories.map((item) => (
              <button
                className={category === item ? "active" : ""}
                key={item}
                onClick={() => chooseCategory(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        <section className="blog-results">
          <p>
            {category ? `Notícias em ${category}` : "Todas as notícias"}
            {search && ` para “${search}”`}
          </p>
          <span>
            {filtered.length}{" "}
            {filtered.length === 1
              ? "matéria encontrada"
              : "matérias encontradas"}
          </span>
        </section>
        <section className="blog-grid">
          {filtered.map((article, index) => (
            <a
              href={articleHref(article)}
              className={
                index === 0 ? "blog-card blog-card-featured" : "blog-card"
              }
              key={article.id}
            >
              <img src={article.image} alt="" />
              <div>
                <span className="category-tag">{article.category}</span>
                <h2>{article.title}</h2>
                <p>{article.excerpt}</p>
                <span
                  className="read-link"
                >
                  Ler matéria <Arrow />
                </span>
              </div>
            </a>
          ))}
        </section>
        {filtered.length === 0 && (
          <p className="empty-results">
            Nenhuma matéria encontrada. Tente outro termo ou categoria.
          </p>
        )}
      </main>
      <Footer />
    </>
  );
}

function ListEditorModal({ block, onClose, onSave }: { block: ArticleBlock; onClose: () => void; onSave: (block: ArticleBlock) => void }) {
  const [draft, setDraft] = useState<ArticleBlock>(() => structuredClone(block));
  const items = draft.items ?? [];
  const updateItem = (index: number, values: Partial<ListItem>) => setDraft(current => ({ ...current, items: (current.items ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) }));
  const removeItem = (index: number) => setDraft(current => ({ ...current, items: (current.items ?? []).filter((_, itemIndex) => itemIndex !== index) }));
  return <div className="list-modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar lista de livros"><section className="list-modal"><header><div><p className="eyebrow">Lista de links</p><h2>Editar livros</h2></div><button onClick={onClose}>×</button></header><label>Título da lista<input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label><div className="list-modal-items">{items.map((item, index) => <div key={`${item.url}-${index}`}><input value={item.title} onChange={event => updateItem(index, { title: event.target.value })} placeholder="Nome do livro" /><input value={item.url} onChange={event => updateItem(index, { url: event.target.value })} placeholder="Link" /><button type="button" onClick={() => removeItem(index)}>Remover</button></div>)}</div><button className="add-list-item" type="button" onClick={() => setDraft(current => ({ ...current, items: [...(current.items ?? []), { title: '', url: '' }] }))}>+ Adicionar livro</button><footer><button className="button button-secondary" onClick={onClose}>Cancelar</button><button className="button button-primary" onClick={() => onSave(draft)}>Salvar lista <Arrow /></button></footer></section></div>;
}

function AdminLogin({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    const error = await onLogin(
      String(data.get("email")),
      String(data.get("password")),
    );
    setBusy(false);
    setMessage(error ?? "");
  };
  return (
    <>
      <Header />
      <main className="login-page">
        <form className="login-card" onSubmit={login}>
          <img src="/site-assets/lendo-saficos-logo.png" alt="Lendo Sáficos" />
          <p className="eyebrow">Área restrita</p>
          <h1>Entrar no painel</h1>
          <p>Use seu e-mail e senha para gerenciar as matérias do blog.</p>
          <label>
            E-mail
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="seuemail@exemplo.com"
            />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </label>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Entrando…" : "Entrar"} <Arrow />
          </button>
          {message && <small>{message}</small>}
        </form>
      </main>
      <Footer />
    </>
  );
}
function Admin({
  articles,
  refresh,
  onLogout,
}: {
  articles: Article[];
  refresh: (includeAll?: boolean) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const categories = Array.from(
    new Set([
      ...defaultCategories,
      ...articles.map((article) => article.category),
    ]),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const [editing, setEditing] = useState<Article | null>(null);
  const [message, setMessage] = useState("");
  const [blocks, setBlocks] = useState<ArticleBlock[]>([]);
  const [image, setImage] = useState("/images/1.jpg");
  const [uploading, setUploading] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [category, setCategory] = useState("Novidades");
  const [formKey, setFormKey] = useState(0);
  const [preview, setPreview] = useState<Article | null>(null);
  const [editingList, setEditingList] = useState<ArticleBlock | null>(null);
  const beginEdit = (article: Article) => {
    setEditing(article);
    setBlocks(article.blocks ?? []);
    setImage(article.image);
    setCategory(article.category);
  };
  const addBlock = (type: ArticleBlock["type"]) =>
    setBlocks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        type,
        content: "",
        title: "",
        price: "",
        url: "",
        image: "",
        items: [],
        span: 6,
        align: "left",
      },
    ]);
  const applyKindleTemplate = () => {
    setEditing(null);
    setBlocks(structuredClone(kindleTemplate));
    setImage("/images/5.jpeg");
    setCategory("Listas");
    setNewCategory("");
    setFormKey((current) => current + 1);
    setMessage(
      "Modelo Encha Seu Kindle carregado. Revise e salve como rascunho ou publique.",
    );
  };
  void applyKindleTemplate;
  const updateBlock = (id: string, values: Partial<ArticleBlock>) =>
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...values } : block,
      ),
    );
  const removeBlock = (id: string) =>
    setBlocks((current) => current.filter((block) => block.id !== id));
  const saveList = (next: ArticleBlock) => {
    updateBlock(next.id, next);
    setEditingList(null);
  };
  const upload = async (
    event: ChangeEvent<HTMLInputElement>,
    target: "cover" | string,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !supabase) return;
    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage
      .from("blog-media")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      setMessage(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("blog-media").getPublicUrl(path);
    if (target === "cover") setImage(data.publicUrl);
    else updateBlock(target, { image: data.publicUrl });
    setUploading(false);
  };
  const articleFromForm = (form: HTMLFormElement): Omit<Article, "id"> => {
    const data = new FormData(form);
    const normalizedCategory = (newCategory.trim() || category)
      .replace(/\s+/g, " ")
      .trim();
    const existing = categories.find(
      (item) =>
        item.localeCompare(normalizedCategory, "pt-BR", {
          sensitivity: "accent",
        }) === 0,
    );
    const title = String(data.get("title"));
    return {
      category: existing || normalizedCategory,
      title,
      excerpt: String(data.get("excerpt")),
      image,
      blocks,
      status: data.get("status") as ArticleStatus,
      featured: editing?.featured ?? articles.length === 0,
      slug: editing?.slug || slugify(title),
    };
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    const values = articleFromForm(event.currentTarget);
    if (!values.category) {
      setMessage("Selecione ou crie uma categoria.");
      return;
    }
    const result = editing
      ? await supabase.from("blog_articles").update(values).eq("id", editing.id)
      : await supabase.from("blog_articles").insert(values);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage("Matéria salva com sucesso.");
    setEditing(null);
    setBlocks([]);
    setImage("/images/1.jpg");
    setNewCategory("");
    setCategory("Novidades");
    setFormKey((current) => current + 1);
    await refresh(true);
  };
  const previewForm = (form: HTMLFormElement) => {
    const article = articleFromForm(form);
    if (!article.title || !article.excerpt || !article.category) {
      setMessage("Preencha título, resumo e categoria para abrir a prévia.");
      return;
    }
    setPreview({ ...article, id: editing?.id ?? 0 });
  };
  const event = {
    currentTarget: {
      get form() {
        return document.querySelector<HTMLFormElement>(".article-form")!;
      },
    },
  };
  const TextEditor = ({ block }: { block: ArticleBlock }) => (
    <RichTextEditor
      value={block.content}
      onChange={(content) => updateBlock(block.id, { content })}
    />
  );
  const toggleStatus = async (article: Article) => {
    if (!supabase) return;
    const status: ArticleStatus =
      article.status === "Suspenso" ? "Publicado" : "Suspenso";
    const { error } = await supabase
      .from("blog_articles")
      .update({ status })
      .eq("id", article.id);
    if (error) setMessage(error.message);
    else await refresh(true);
  };
  const publish = async (article: Article) => {
    if (!supabase) return;
    const { error } = await supabase.from("blog_articles").update({ status: "Publicado" }).eq("id", article.id);
    if (error) setMessage(error.message); else await refresh(true);
  };
  const removeArticle = async (article: Article) => {
    if (!supabase || !window.confirm(`Excluir “${article.title}”? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.rpc("delete_blog_article", {
      article_id: article.id,
    });
    if (error) {
      setMessage(`Não foi possível excluir: ${error.message}`);
      return;
    }
    setMessage("Matéria excluída.");
    await refresh(true);
  };
  return (
    <>
      <Header />
      {editingList && <ListEditorModal block={editingList} onClose={() => setEditingList(null)} onSave={saveList} />}
      {preview && (
        <div className="preview-overlay">
          <div className="preview-bar">
            <b>Prévia — não publicada</b>
            <button onClick={() => setPreview(null)}>Fechar prévia</button>
          </div>
          <main className="article-page wrap">
            <CategoryTag
              category={preview.category}
              onClick={() => undefined}
            />
            <h1>{preview.title}</h1>
            <p className="article-lead">{preview.excerpt}</p>
            <img className="article-cover" src={preview.image} alt="" />
            <ArticleBlocks blocks={preview.blocks} />
          </main>
        </div>
      )}
      <main className="admin wrap">
        <section className="admin-top">
          <div>
            <p className="eyebrow">Painel administrativo</p>
            <h1>Gerenciar matérias</h1>
            <p>Textos, fotos e produtos são salvos diretamente no Supabase.</p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => void onLogout()}
          >
            Sair
          </button>
        </section>
        <div className="admin-layout">
          <form className="article-form" key={formKey} onSubmit={save}>
            <h2>{editing ? "Editar matéria" : "Nova matéria"}</h2>
            <label>
              Título
              <input required name="title" defaultValue={editing?.title} />
            </label>
            <label>
              Resumo
              <textarea
                required
                name="excerpt"
                defaultValue={editing?.excerpt}
              />
            </label>
            <fieldset className="category-editor">
              <legend>Categoria</legend>
              <label>
                Escolher categoria
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value);
                    setNewCategory("");
                  }}
                >
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Ou adicionar nova
                <input
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                  placeholder="Ex.: Entrevistas"
                />
              </label>
              <small>
                O nome será normalizado para evitar duplicações por diferença de
                maiúsculas ou espaços.
              </small>
            </fieldset>
            <label>
              Imagem de capa
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void upload(event, "cover")}
              />
              {image && (
                <img
                  className="admin-preview"
                  src={image}
                  alt="Prévia da capa"
                />
              )}
            </label>
            <label>
              Status
              <select
                name="status"
                defaultValue={editing?.status || "Rascunho"}
              >
                <option>Rascunho</option>
                <option>Publicado</option>
                <option>Suspenso</option>
              </select>
            </label>
            <div className="block-toolbar">
              <b>Conteúdo da matéria</b>
              <button type="button" onClick={() => addBlock("text")}>
                + Texto
              </button>
              <button type="button" onClick={() => addBlock("product")}>
                + Produto
              </button>
              <button type="button" onClick={() => addBlock("linklist")}>
                + Lista de links
              </button>
            </div>
            {blocks.map((block) => (
              <fieldset className="editor-block" key={block.id}>
                <legend>
                  {block.type === "text" ? "Bloco de texto" : block.type === "linklist" ? "Lista de links" : "Produto"}
                </legend>
                {block.type === "text" ? (
                  <TextEditor block={block} />
                ) : block.type === "linklist" ? (
                  <>
                    <input value={block.title} onChange={(event) => updateBlock(block.id, { title: event.target.value })} placeholder="Título da lista" />
                    <button className="list-editor-button" type="button" onClick={() => setEditingList(block)}>Editar {block.items?.length ?? 0} livros e links</button>
                  </>
                ) : (
                  <>
                    <input
                      value={block.title}
                      onChange={(event) =>
                        updateBlock(block.id, { title: event.target.value })
                      }
                      placeholder="Nome do produto"
                    />
                    <input
                      value={block.price}
                      onChange={(event) =>
                        updateBlock(block.id, { price: event.target.value })
                      }
                      placeholder="Preço ou chamada"
                    />
                    <input
                      value={block.url}
                      onChange={(event) =>
                        updateBlock(block.id, { url: event.target.value })
                      }
                      placeholder="Link de compra"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void upload(event, block.id)}
                    />
                    {block.image && (
                      <img
                        className="admin-preview"
                        src={block.image}
                        alt="Prévia do produto"
                      />
                    )}
                  </>
                )}
                <div className="block-controls">
                  <label>
                    Largura
                    <select
                      value={block.span}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          span: Number(event.target.value),
                        })
                      }
                    >
                      <option value="4">1/3</option>
                      <option value="6">1/2</option>
                      <option value="8">2/3</option>
                      <option value="12">Inteira</option>
                    </select>
                  </label>
                  <label>
                    Alinhar
                    <select
                      value={block.align}
                      onChange={(event) =>
                        updateBlock(block.id, {
                          align: event.target.value as ContentAlign,
                        })
                      }
                    >
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                      <option value="justify">Justificado</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => removeBlock(block.id)}>
                    Remover
                  </button>
                </div>
              </fieldset>
            ))}
            <div className="form-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => previewForm(event.currentTarget.form!)}
              >
                Visualizar como blog
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={uploading}
              >
                {uploading ? "Enviando imagem…" : "Salvar matéria"} <Arrow />
              </button>
              {editing && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setBlocks([]);
                    setImage("/images/1.jpg");
                    setCategory("Novidades");
                    setFormKey((current) => current + 1);
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
            {message && <p className="admin-message">{message}</p>}
          </form>
          <section className="admin-table">
            <h2>Matérias</h2>
            {articles.map((article) => (
              <article key={article.id}>
                <img src={article.image} alt="" />
                <div>
                  <small>
                    {article.category} ·{" "}
                    <b className={`status-${article.status.toLowerCase()}`}>
                      {article.status}
                    </b>
                  </small>
                  <h3>{article.title}</h3>
                </div>
                <div className="row-actions">
                  <button onClick={() => beginEdit(article)}>Editar</button>
                  <button onClick={() => setPreview(article)}>
                    Ver prévia
                  </button>
                  {article.status !== "Publicado" && <button onClick={() => void publish(article)}>Publicar</button>}
                  {article.status === "Publicado" && <button onClick={() => toggleStatus(article)}>Suspender</button>}
                  <button className="delete-action" onClick={() => void removeArticle(article)}>Excluir</button>
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
function App() {
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const refresh = async (includeAll = false) => {
    if (!supabase) return;
    const query = supabase
      .from("blog_articles")
      .select("*")
      .order("created_at", { ascending: false });
    const { data } = includeAll
      ? await query
      : await query.eq("status", "Publicado");
    if (data && data.length > 0) setArticles(data as Article[]);
  };
  const checkAdmin = async (currentSession: Session | null) => {
    if (!supabase || !currentSession) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", currentSession.user.id)
      .maybeSingle();
    setIsAdmin(Boolean(data));
  };
  useEffect(() => {
    void refresh();
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void checkAdmin(data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        void checkAdmin(nextSession);
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (isAdmin) void refresh(true);
  }, [isAdmin]);
  const login = async (email: string, password: string) => {
    if (!supabase) return "Supabase não está configurado.";
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return "E-mail ou senha inválidos.";
    await checkAdmin(data.session);
    const { data: role, error: roleError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.session?.user.id ?? "")
      .maybeSingle();
    if (roleError)
      return "Não foi possível validar a permissão. Confirme se o SQL do painel foi executado no Supabase.";
    return role
      ? null
      : "Login realizado, mas esta conta ainda não foi vinculada como administradora na tabela admin_users.";
  };
  const logout = async () => {
    await supabase?.auth.signOut();
    setSession(null);
    setIsAdmin(false);
  };
  if (window.location.pathname.startsWith("/admin"))
    return session && isAdmin ? (
      <Admin articles={articles} refresh={refresh} onLogout={logout} />
    ) : (
      <AdminLogin onLogin={login} />
    );
  if (window.location.pathname.startsWith("/blog"))
    return <Blog articles={articles} />;
  return <Home articles={articles} />;
}
export default App;
