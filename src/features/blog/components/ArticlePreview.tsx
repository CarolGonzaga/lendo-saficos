import { useState } from 'react';
import type { ArticleDraft } from '../types';
import { safeImage } from '../utils';
import { BlockRenderer } from './BlockRenderer';
import { Modal } from './Modal';

export function ArticlePreview({ article, onClose }: { article: ArticleDraft; onClose: () => void }) {
  const [mobile, setMobile] = useState(false);
  return <Modal title="Prévia da matéria — sem publicar" onClose={onClose} className="cms-preview">
    <div className="cms-preview-tools"><button aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</button><button aria-pressed={mobile} onClick={() => setMobile(true)}>Mobile</button></div>
    <div className={mobile ? 'cms-preview-mobile' : ''}><main className="article-page cms-article"><span className="category-tag">{article.category}</span><h1>{article.title}</h1><p className="article-lead">{article.excerpt}</p>{safeImage(article.image) && <img className="article-cover" src={safeImage(article.image)} alt={article.cover_alt || ''} />}<BlockRenderer blocks={article.blocks} /></main></div>
  </Modal>;
}
