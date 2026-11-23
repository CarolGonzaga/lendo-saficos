import { useEffect, useRef, useState } from 'react';
import type { Article } from './features/blog/types';
import { articleHref, isPublic, prioritize, safeImage, slugify } from './features/blog/utils';
import './home-editorial.css';

const launchUrl = 'https://www.lendosaficos.com.br/lista120livrossaficos';
const clubUrl = 'https://www.lendosaficos.com.br/clubedascolecionadoras';

const featuredBooks = [
  {
    title: 'Eu me rendo', author: 'Márcia Camargo', cover: '/images/covers/1.jpg', asin: 'B0G756LCT4',
    description: 'Abigail e Ângela encaram as consequências de tornar público o relacionamento.',
  },
  {
    title: 'Love Me Like You Shouldn’t', author: 'Harper Bliss', cover: '/images/covers/24.jpeg', asin: 'B0GHZS4MN5',
    description: 'Uma atriz em ascensão e sua terapeuta se veem diante de uma atração proibida.',
  },
  {
    title: 'Além das câmeras', author: 'Gina Milbradt', cover: '/images/covers/47.jpeg', asin: 'B0GPDRJFK3',
    description: 'Duas atrizes descobrem que a química vai além das cenas que gravam juntas.',
  },
  {
    title: 'She’s My Eternity', author: 'Valerie Hunter', cover: '/images/covers/70.jpg', asin: 'B0GPY3TDT5',
    description: 'Uma vampira milenar se apaixona por uma barista humana em Nova York.',
  },
];

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function useRibbonVisibility() {
  const ribbon = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const section = ribbon.current;
    if (!section || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView((entry?.intersectionRatio ?? 0) >= .15);
    }, { threshold: .15 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return { ref: ribbon, 'data-in-view': inView || undefined };
}

function ClubRibbon() {
  const visibility = useRibbonVisibility();
  return <section {...visibility} className="home-club" aria-labelledby="home-club-title">
    <img className="home-club-art" src="/images/clube-pacote-figurinhas.png" width="1448" height="1086" alt="" loading="lazy" />
    <div className="home-club-copy">
      <p className="home-club-label">Comunidade exclusiva</p>
      <h2 id="home-club-title">Clube das Colecionadoras</h2>
      <p>Seu álbum virtual de literatura sáfica. Responda quizzes, colecione figurinhas e desbloqueie recompensas.</p>
    </div>
    <a className="home-pill home-club-link" href={clubUrl}>Entrar no Clube <Arrow /></a>
  </section>;
}

function Story({ article, lead = false }: { article: Article; lead?: boolean }) {
  const image = safeImage(article.image);
  return <article className={lead ? 'home-story home-story-lead' : 'home-story home-story-secondary'}>
    <a href={articleHref(article)} className="home-story-link">
      <div className="home-story-copy">
        <p className="home-story-category">{article.category}</p>
        <h3>{article.title.trim()}</h3>
        {lead && <p className="home-story-excerpt">{article.excerpt}</p>}
      </div>
      {image && <img className="home-story-image" src={image} alt={article.cover_alt || ''} loading="lazy" />}
    </a>
  </article>;
}

function Newsletter() {
  const visibility = useRibbonVisibility();
  const [submitted, setSubmitted] = useState(false);
  return <section {...visibility} className="home-newsletter" aria-labelledby="home-newsletter-title">
    <span className="home-ribbon-icon home-newsletter-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6M4 17l5-5m6 0 5 5" />
      </svg>
    </span>
    <div className="home-newsletter-copy">
      <h2 id="home-newsletter-title">Receba novidades no seu e-mail</h2>
      <p>Lançamentos, listas e matérias do Lendo Sáficos.</p>
    </div>
    <form className="home-newsletter-form" onSubmit={event => {
      event.preventDefault();
      setSubmitted(true);
    }}>
      <label className="cms-sr-only" htmlFor="home-newsletter-email">Seu e-mail</label>
      <input id="home-newsletter-email" type="email" autoComplete="email" placeholder="Seu e-mail" required onChange={() => setSubmitted(false)} />
      <button className="home-pill" type="submit">Inscrever-se <Arrow /></button>
      {submitted && <p className="home-newsletter-status" role="status">A inscrição estará disponível quando a newsletter for conectada.</p>}
    </form>
  </section>;
}

export function HomeEditorial({ articles }: { articles: Article[] }) {
  const published = prioritize(articles.filter(article => isPublic(article)));
  const [lead, ...secondary] = published.slice(0, 4);
  const categories = [...new Set(published.map(article => article.category).filter(Boolean))];
  return <div className="home-container home-editorial">
    <section className="home-stories" aria-labelledby="home-stories-title">
      <header className="home-section-heading">
        <div>
          <h2 id="home-stories-title">Para ler agora</h2>
          <p>Novidades, listas e conversas sobre literatura sáfica.</p>
        </div>
        <a className="home-editorial-link" href="/blog">Ver todas as matérias <Arrow /></a>
      </header>
      {lead && <div className="home-story-grid">
        <Story article={lead} lead />
        {secondary.length > 0 && <div className="home-story-stack">
          {secondary.map(article => <Story key={article.id} article={article} />)}
        </div>}
      </div>}
      <nav className="home-categories" aria-labelledby="home-categories-title">
        <h3 id="home-categories-title">Explore por categoria</h3>
        <ul className="home-category-list">
          <li><a href={launchUrl}>Lançamentos</a></li>
          {categories.map(category => <li key={category}><a href={`/blog?categoria=${encodeURIComponent(slugify(category))}`}>{category}</a></li>)}
        </ul>
        <a className="home-category-all" href="/blog">Ver todas <Arrow /></a>
      </nav>
    </section>
    <section className="home-books" aria-labelledby="home-books-title">
      <header className="home-section-heading">
        <div>
          <h2 id="home-books-title">Livros em destaque</h2>
          <p>Obras que apoiam o Lendo Sáficos e ajudam a manter o projeto no ar.</p>
        </div>
        <span className="home-sponsor-label">Patrocinados
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <circle cx="10" cy="10" r="8" /><path d="M10 9v5" /><circle cx="10" cy="6" r=".85" fill="currentColor" stroke="none" />
          </svg>
        </span>
      </header>
      <ul className="home-book-grid">
        {featuredBooks.map(book => <li key={book.asin}>
          <img src={book.cover} width="150" height="225" alt="" loading="lazy" />
          <div className="home-book-caption">
            <strong>{book.title}</strong>
            <span className="home-book-author">{book.author}</span>
            <p>{book.description}</p>
            <a className="home-book-buy" href={`https://www.amazon.com.br/dp/${book.asin}`} target="_blank" rel="sponsored noopener noreferrer"
              aria-label={`Conhecer o livro ${book.title} na Amazon (nova aba)`}>
              Conhecer o livro <Arrow />
            </a>
          </div>
        </li>)}
      </ul>
    </section>
    <ClubRibbon />
    <Newsletter />
  </div>;
}
