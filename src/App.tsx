import type { ReactNode } from 'react';

type SocialLinkProps = {
  href: string;
  label: string;
  children: ReactNode;
};

function SocialLink({ href, label, children }: SocialLinkProps) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}>
      {children}
    </a>
  );
}

function App() {
  return (
    <>
      <main className="landing">
        <section className="intro">
          <header className="topbar">
            <a className="brand" href="/" aria-label="Lendo Sáficos, página inicial">
              <img src="/assets/lendo-saficos-logo.png" alt="Lendo Sáficos" />
            </a>
            <span className="status"># Em construção</span>
          </header>

          <div className="intro-copy">
            <p className="eyebrow">Uma nova história começa aqui</p>
            <h1>
              Novidades<br />
              <em>em breve</em>
            </h1>
            <p className="description">
              Em breve, uma plataforma para ficar por dentro de tudo que acontece no universo da literatura sáfica e acompanhar as novidades compartilhadas pelo Lendo Sáficos.
            </p>
            <div className="books-callout">
              <p>
                Já disponível: <strong>120 livros sáficos lançados em 2026</strong>
              </p>
              <a className="books-button" href="/lista120livrossaficos">
                Ver a lista completa <span>→</span>
              </a>
            </div>
          </div>

          <footer className="left-footer">
            <p>Encontre o Lendo Sáficos</p>
            <nav className="socials" aria-label="Redes sociais">
              <SocialLink href="https://www.instagram.com/olendosaficos/" label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle className="dot" cx="17.2" cy="6.8" r="1" />
                </svg>
              </SocialLink>
              <SocialLink href="https://x.com/lendosaficos" label="X, antigo Twitter">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4l6.2 8.3L4.3 20H7l4.4-5.2L15.3 20H20l-6.6-8.8L18.9 4h-2.7l-4 4.8L8.7 4H4z" />
                </svg>
              </SocialLink>
              <SocialLink href="https://www.tiktok.com/@olendosaficos?_r=1&_t=ZS-97gDxhCwscb" label="TikTok">
                <svg className="filled-icon tiktok-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19.59 6.69a4.79 4.79 0 0 1-3.77-4.7h-3.08v12.03a2.9 2.9 0 1 1-2.01-2.76V8.14a6.04 6.04 0 1 0 5.18 5.99V8.03a7.87 7.87 0 0 0 4.68 1.54V6.69Z" />
                </svg>
              </SocialLink>
              <SocialLink href="https://www.whatsapp.com/channel/0029Vb6HNUhFHWptCJYOEF24" label="WhatsApp">
                <svg className="filled-icon whatsapp-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.52 3.48A11.87 11.87 0 0 0 12.06 0C5.49 0 .15 5.34.15 11.91c0 2.1.55 4.14 1.6 5.94L.05 24l6.31-1.65a11.9 11.9 0 0 0 5.69 1.45h.01c6.56 0 11.9-5.34 11.9-11.91 0-3.18-1.24-6.17-3.44-8.41ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.05-1.39l-.36-.21-3.74.98 1-3.64-.23-.38a9.9 9.9 0 1 1 8.39 4.64Zm5.43-7.42c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.22-.66.07a8.16 8.16 0 0 1-2.4-1.48 9 9 0 0 1-1.66-2.07c-.17-.3 0-.46.13-.61.14-.14.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.68-1.64-.93-2.24-.24-.58-.49-.5-.68-.51h-.58c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.13-.28-.2-.58-.35Z" />
                </svg>
              </SocialLink>
            </nav>
          </footer>
        </section>

        <section className="club" aria-label="Clube das Colecionadoras">
          <div className="aurora" />
          <article className="club-card">
            <div className="card-kicker">
              <span className="heart">♥</span> Clube das Colecionadoras
            </div>
            <h2>
              O Clube das<br />
              Colecionadoras chegou<br />
              ao <i>Lendo Sáficos.</i>
            </h2>
            <p>
              Um álbum virtual feito para quem ama literatura sáfica.
              <br />
              Responda quizzes, colecione figurinhas e desbloqueie recompensas exclusivas.
            </p>
            <a className="club-button" href="/clube" aria-label="Entrar no Clube das Colecionadoras">
              Entrar no Clube <span>→</span>
            </a>
          </article>
        </section>
      </main>

      <footer className="site-footer">
        © 2026 Lendo Sáficos. Todos os direitos reservados.{' '}
        <span>
          Desenvolvido por{' '}
          <a href="https://carolgonzaga.site/" target="_blank" rel="noreferrer">
            CarolGonzaga
          </a>
        </span>
      </footer>
    </>
  );
}

export default App;
