import { useState } from 'react';
import type { ArticleDraft } from '../types';
import { safeImage } from '../utils';
import { BlockRenderer } from './BlockRenderer';
import { Modal } from './Modal';

const viewports = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' } as const;

export function ArticlePreview({ article, onClose, source = 'draft' }: {
  article: ArticleDraft; onClose: () => void; source?: 'draft' | 'saved' | 'published';
}) {
  const [viewport, setViewport] = useState<keyof typeof viewports>('desktop');
  const date = article.status === 'Agendado' ? article.scheduled_at : article.published_at;
  const title = { draft: 'Prévia do rascunho', saved: 'Prévia da versão salva', published: 'Prévia da versão publicada' }[source];
  return <Modal title={title} onClose={onClose} className="cms-preview">
    <div className="cms-preview-tools" role="group" aria-label="Largura da prévia">
      {Object.entries(viewports).map(([value, label]) => <button key={value} type="button" aria-pressed={viewport === value} onClick={() => setViewport(value as keyof typeof viewports)}>{label}</button>)}
    </div>
    <div className={`cms-preview-viewport cms-preview-${viewport}`}>
      <main className="article-page cms-article">
        <span className="category-tag">{article.category}</span>
        <h1>{article.title}</h1>
        {(date || article.author_name) && <div className="article-byline">
          {date && <time dateTime={date}>{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(date))}</time>}
          {article.author_name && <span>Por {article.author_name}</span>}
        </div>}
        <p className="article-lead">{article.excerpt}</p>
        {safeImage(article.image) && <img className="article-cover" src={safeImage(article.image)} alt={article.cover_alt || ''} />}
        <BlockRenderer blocks={article.blocks} />
      </main>
    </div>
  </Modal>;
}
