import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

import type { Article, ArticleBlock } from "./features/blog/types";
import { HomeEditorial } from "./HomeEditorial";
import { getHomeArticles } from "./features/blog/services";
import { BlogPage } from "./features/blog/BlogPage";
import "./features/blog/blog.css";

const BlogAdminPage = lazy(() => import("./features/blog/admin/BlogAdminPage").then(module => ({ default: module.BlogAdminPage })));

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

function Arrow() { return <span aria-hidden="true">→</span>; }
function SocialLink({ href, label, children }: SocialLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {children}
    </a>
  );
}

function Header({ home = false }: { home?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header" onKeyDown={event => {
      if (event.key !== "Escape" || !menuOpen) return;
      event.preventDefault();
      setMenuOpen(false);
      event.currentTarget.querySelector<HTMLButtonElement>(".home-menu-toggle")?.focus();
    }}>
      <a className="brand" href="/" aria-label="Lendo Sáficos, página inicial">
        <img src="/site-assets/lendo-saficos-logo.png" alt="Lendo Sáficos" />
      </a>
      {home && <button
        className="home-menu-toggle"
        type="button"
        aria-controls="home-main-nav"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        onClick={() => setMenuOpen(open => !open)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          {menuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>}
      <nav
        className="main-nav"
        id={home ? "home-main-nav" : undefined}
        data-open={home ? menuOpen : undefined}
        aria-label="Navegação principal"
        onClick={home ? event => {
          if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
        } : undefined}
      >
        <a href="/">Início</a>
        <a href="https://www.lendosaficos.com.br/lista120livrossaficos">
          Lançamentos
        </a>
        <a href="https://www.lendosaficos.com.br/clubedascolecionadoras">
          Clube das Colecionadoras
        </a>
        {!home && <a href="https://www.lendosaficos.com.br/mapasaficobienal">
          Mapa Sáfico
        </a>}
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

function Home({ articles }: { articles: Article[] }) {
  return (
    <div className="home-site">
      <SeoMetadata
        title="Livros Sáficos, Literatura e Lançamentos | Lendo Sáficos"
        description="Descubra livros sáficos, lançamentos, romances, autoras, recomendações e novidades da literatura sáfica no Lendo Sáficos."
        path="/"
      />

      <Header home />
      <main>
        <section className="hero home-container">
          <div className="hero-copy">
            <p className="eyebrow">Lendo Sáficos</p>
            <h1>O fandom da<br /><em>literatura sáfica</em></h1>
            <p className="description">
              Plataforma oficial do Lendo Sáficos, criada para reunir
              projetos, ideias e divulgações de livros, romances e leituras
              sáficas, lésbicas, bissexuais, pansexuais e queer, nacionais e
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
          </div>
        </section>
        <HomeEditorial articles={articles} />
      </main>
      <Footer />
    </div>
  );
}

type SeoMetadataProps = {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
};

function SeoMetadata({
  title,
  description,
  path,
  image = "/images/5.jpeg",
  type = "website",
  noindex = false,
}: SeoMetadataProps) {
  useEffect(() => {
    const baseUrl = "https://www.lendosaficos.com.br";
    const url = `${baseUrl}${path}`;
    const imageUrl = image.startsWith("http")
      ? image
      : `${baseUrl}${image}`;

    document.title = title;

    const setMeta = (
      selector: string,
      attribute: string,
      value: string,
    ) => {
      document
        .querySelector(selector)
        ?.setAttribute(attribute, value);
    };

    setMeta(
      'meta[name="description"]',
      "content",
      description,
    );

    setMeta(
      'meta[name="robots"]',
      "content",
      noindex ? "noindex, nofollow" : "index, follow",
    );

    setMeta(
      'meta[property="og:title"]',
      "content",
      title,
    );

    setMeta(
      'meta[property="og:description"]',
      "content",
      description,
    );

    setMeta(
      'meta[property="og:url"]',
      "content",
      url,
    );

    setMeta(
      'meta[property="og:type"]',
      "content",
      type,
    );

    setMeta(
      'meta[property="og:image"]',
      "content",
      imageUrl,
    );

    setMeta(
      'meta[name="twitter:title"]',
      "content",
      title,
    );

    setMeta(
      'meta[name="twitter:description"]',
      "content",
      description,
    );

    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }

    canonical.href = url;
  }, [
    title,
    description,
    path,
    image,
    type,
    noindex,
  ]);

  return null;
}

function AdminLogin({
  onLogin,
  onReset,
}: {
  onLogin: (email: string, password: string) => Promise<string | null>;
  onReset: (email: string) => Promise<string>;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
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
      <SeoMetadata
        title="Painel Administrativo | Lendo Sáficos"
        description="Área administrativa do Lendo Sáficos."
        path="/admin"
        noindex
      />

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
              value={email}
              onChange={event => setEmail(event.target.value)}
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
          <button type="button" disabled={busy || !email.trim()} onClick={() => { setBusy(true); void onReset(email).then(setMessage).finally(() => setBusy(false)); }}>Criar ou recuperar senha</button>
          {message && <small>{message}</small>}
        </form>
      </main>
      <Footer />
    </>
  );
}
function AdminPasswordSetup() {
  const [password,setPassword] = useState('');
  const [confirm,setConfirm] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) { setMessage('Use pelo menos 8 caracteres e confirme a mesma senha.'); return; }
    setBusy(true);
    const { error } = await supabase!.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    window.location.replace('/admin');
  };
  return <><SeoMetadata title="Definir senha | Lendo Sáficos" description="Acesso ao painel editorial." path="/admin/accept-invite" noindex /><Header /><main className="login-page"><form className="login-card" onSubmit={event => void save(event)}><img src="/site-assets/lendo-saficos-logo.png" alt="Lendo Sáficos" /><p className="eyebrow">Equipe editorial</p><h1>Definir senha</h1><p>Crie sua senha para acessar o painel nas próximas visitas.</p><label>Nova senha<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></label><label>Confirmar senha<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} /></label><button className="button button-primary" disabled={busy}>Salvar senha</button>{message && <small role="alert">{message}</small>}</form></main><Footer /></>;
}
function App() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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
    if (!window.location.pathname.startsWith("/blog") && !window.location.pathname.startsWith("/admin")) {
      void getHomeArticles().then(setArticles).catch(() => setArticles([]));
    }
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
    // O site principal não usa PWA. Remove somente um SW antigo da raiz,
    // que pode interceptar requisições do painel com cache incompatível.
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations
        .filter((registration) => registration.scope === `${window.location.origin}/`)
        .forEach((registration) => void registration.unregister());
    });
  }, []);
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
  const resetPassword = async (email: string) => {
    if (!supabase) return 'Supabase não está configurado.';
    const redirectTo='https://www.lendosaficos.com.br/admin/accept-invite';
    const { error } = await supabase.auth.resetPasswordForEmail(email,{ redirectTo });
    return error ? 'Não foi possível enviar o link. Tente novamente.' : 'Se o e-mail estiver cadastrado, você receberá um link para definir a senha.';
  };
  if (window.location.pathname === '/admin/accept-invite' && session) return <AdminPasswordSetup />;
  if (window.location.pathname.startsWith("/admin"))
    return session && isAdmin ? (
      <><SeoMetadata title="Painel Administrativo | Lendo Sáficos" description="Área administrativa do blog." path="/admin" noindex /><Suspense fallback={<main className="admin wrap"><p role="status">Carregando painel…</p></main>}><BlogAdminPage template={kindleTemplate} onLogout={logout} /></Suspense></>
    ) : (
      <AdminLogin onLogin={login} onReset={resetPassword} />
    );
  if (window.location.pathname.startsWith("/blog"))
    return <BlogPage header={<Header />} footer={<Footer />} />;
  return <Home articles={articles} />;
}
export default App;
