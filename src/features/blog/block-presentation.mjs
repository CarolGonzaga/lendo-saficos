import { boxStyles, isCanvasBox } from './canvas-layout.mjs';

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function safeUrl(value = '') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

export const safeImage = (value = '') => /^\/(?![\/\\])[^\s\\]*$/.test(value) ? value : safeUrl(value);
export const canvasSection = 'cms-blocks article-blocks cms-canvas-layout';
export const flowSection = 'cms-blocks article-blocks';

function link(url, label, className = '', suffix = '') {
  const href = safeUrl(url);
  return href ? `<a class="${className}" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${suffix}</a>` : '';
}

function image(url, alt) {
  const source = safeImage(url);
  return source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="lazy" draggable="false">` : '';
}

function blockContent(block, sanitize) {
  switch (block.type) {
    case 'text':
      return `<div class="cms-rich-output">${sanitize(block.content)}</div>`;
    case 'h1': case 'h2': case 'h3':
      return `<${block.type}>${escapeHtml(block.content)}</${block.type}>`;
    case 'quote':
      return `<blockquote>${escapeHtml(block.content)}</blockquote>`;
    case 'divider':
      return '<hr>';
    case 'spacer':
      return '';
    case 'card': case 'callout':
      return `<section class="cms-editorial-note">${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ''}<p>${escapeHtml(block.content)}</p>${link(block.url, 'Abrir link →')}</section>`;
    case 'bullets': case 'numbered': {
      const tag = block.type === 'bullets' ? 'ul' : 'ol';
      return `<${tag}>${(block.entries || []).map(entry => `<li>${escapeHtml(entry)}</li>`).join('')}</${tag}>`;
    }
    case 'image': {
      const caption = block.caption || block.credit
        ? `<figcaption>${escapeHtml(block.caption)}${block.credit ? `<small> Crédito: ${escapeHtml(block.credit)}</small>` : ''}</figcaption>` : '';
      return `<figure><div class="cms-image-frame">${image(block.image, block.alt)}</div>${caption}</figure>`;
    }
    case 'button':
      return link(block.url, block.title || 'Abrir link', 'button button-primary', ' →');
    case 'linklist':
      return `<section class="book-link-list"><h2>${escapeHtml(block.title)}</h2><div>${(block.items || []).map(item =>
        link(item.url, item.title, '', '<span aria-hidden="true">→</span>') || `<span>${escapeHtml(item.title)}</span>`).join('')}</div></section>`;
    case 'product':
      return `<article class="product-card">${image(block.image, block.title || 'Produto recomendado')}<div><h3>${escapeHtml(block.title)}</h3>${block.price ? `<p>${escapeHtml(block.price)}</p>` : ''}${link(block.url, 'Ver produto →', 'button button-primary')}</div></article>`;
    default:
      return '';
  }
}

export function blockPresentation(block, sanitize, box = block.box) {
  const align = ['left', 'right', 'center', 'justify'].includes(block.align) ? block.align : 'left';
  const span = [3, 4, 6, 8, 9, 12].includes(block.span) ? block.span : 12;
  const positioned = isCanvasBox(box);
  const type = ['image', 'spacer', 'text'].includes(block.type) ? ` cms-block-${block.type}` : '';
  const compact = positioned && box.compactAlign ? ` cms-compact-${box.compactAlign}` : '';
  return {
    className: `cms-block article-block${type} align-${align}${compact}${positioned && box.height !== null ? ' cms-block-sized' : ''}`,
    style: { 'text-align': align, '--cms-span': `span ${span}`, ...boxStyles(box) },
    html: blockContent(block, sanitize),
  };
}

export function blockSections(blocks) {
  const sections = [];
  for (const block of blocks) {
    const positioned = isCanvasBox(block.box);
    const last = sections.at(-1);
    if (last?.positioned === positioned) last.blocks.push(block);
    else sections.push({ positioned, blocks: [block] });
  }
  return sections;
}

export function renderSharedBlocks(blocks, sanitize) {
  return blockSections(blocks).map(section =>
    `<div class="cms-content-frame"><div class="${section.positioned ? canvasSection : flowSection}">${section.blocks.map(block => {
      const { className, style, html } = blockPresentation(block, sanitize);
      const css = Object.entries(style).map(([name, value]) => `${name}:${value}`).join(';');
      return `<div class="${className}" style="${escapeHtml(css)}"><div class="cms-block-surface">${html}</div></div>`;
    }).join('')}</div></div>`).join('');
}

