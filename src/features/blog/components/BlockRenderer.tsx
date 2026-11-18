import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import type { ArticleBlock } from '../types';
import type { CanvasBox } from '../canvas-layout.mjs';
import { blockPresentation, renderSharedBlocks } from '../block-presentation.mjs';
import { sanitizeRichText } from '../utils';

export function BlockRenderer({ blocks = [] }: { blocks?: ArticleBlock[] }) {
  return <div className="cms-rendered-content" dangerouslySetInnerHTML={{ __html: renderSharedBlocks(blocks, sanitizeRichText) }} />;
}

export function BlockSurface({ block, box, surface, editorHidden, children }: {
  block: ArticleBlock; box: CanvasBox; surface?: ReactNode; editorHidden?: boolean; children?: ReactNode;
}) {
  const richContent = block.type === 'text' ? block.content : undefined;
  const safeContent = useMemo(() => sanitizeRichText(richContent), [richContent]);
  const { className, style, html } = blockPresentation(block, () => safeContent, box);
  const { 'text-align': textAlign, ...customProperties } = style;
  return <div data-canvas-layer={block.id} data-editor-hidden={editorHidden || undefined} className={className} style={{ ...customProperties, textAlign } as CSSProperties}>
    {surface ? <div className="cms-block-surface">{surface}</div> : <div className="cms-block-surface" dangerouslySetInnerHTML={{ __html: html }} />}
    {children}
  </div>;
}
