import type { CSSProperties } from 'react';
import type { ArticleBlock } from '../types';
import { safeImage, safeUrl, sanitizeRichText } from '../utils';

export function BlockRenderer({ blocks = [] }: { blocks?: ArticleBlock[] }) {
  return <div className="article-blocks cms-blocks">{blocks.map(block => {
    let content;
    switch (block.type) {
      case 'text': content = <div className="cms-rich-output" dangerouslySetInnerHTML={{ __html: sanitizeRichText(block.content) }} />; break;
      case 'h2': content = <h2>{block.content}</h2>; break;
      case 'h3': content = <h3>{block.content}</h3>; break;
      case 'quote': content = <blockquote>{block.content}</blockquote>; break;
      case 'divider': content = <hr />; break;
      case 'bullets': content = <ul>{block.entries?.map((entry, index) => <li key={index}>{entry}</li>)}</ul>; break;
      case 'numbered': content = <ol>{block.entries?.map((entry, index) => <li key={index}>{entry}</li>)}</ol>; break;
      case 'image': content = <figure>{safeImage(block.image) && <img src={safeImage(block.image)} alt={block.alt || ''} loading="lazy" />}{(block.caption || block.credit) && <figcaption>{block.caption}{block.credit && <small> Crédito: {block.credit}</small>}</figcaption>}</figure>; break;
      case 'button': content = safeUrl(block.url) && <a className="button button-primary" href={safeUrl(block.url)} target="_blank" rel="noopener noreferrer">{block.title || 'Abrir link'} →</a>; break;
      case 'linklist': content = <section className="book-link-list"><h2>{block.title}</h2><div>{block.items?.map((item, index) => safeUrl(item.url) ? <a key={index} href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true">→</span></a> : <span key={index}>{item.title}</span>)}</div></section>; break;
      case 'product': content = <article className="product-card">{safeImage(block.image) && <img src={safeImage(block.image)} alt={block.title || 'Produto recomendado'} loading="lazy" />}<div><h3>{block.title}</h3>{block.price && <p>{block.price}</p>}{safeUrl(block.url) && <a className="button button-primary" href={safeUrl(block.url)} target="_blank" rel="noopener noreferrer">Ver produto →</a>}</div></article>; break;
    }
    return <div key={block.id} className={`article-block cms-block align-${block.align}`} style={{ textAlign: block.align, '--cms-span': `span ${block.span || 12}` } as CSSProperties}>{content}</div>;
  })}</div>;
}
