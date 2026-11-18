import type { ArticleBlock } from './types';
import type { CanvasBox } from './canvas-layout.mjs';

export function escapeHtml(value?: unknown): string;
export function safeUrl(value?: string): string;
export function safeImage(value?: string): string;
export const canvasSection: string;
export const flowSection: string;
export function blockPresentation(block: ArticleBlock, sanitize: (html?: string) => string, box?: CanvasBox): {
  className: string; style: Record<string, string | number>; html: string;
};
export function blockSections(blocks: ArticleBlock[]): { positioned: boolean; blocks: ArticleBlock[] }[];
export function renderSharedBlocks(blocks: ArticleBlock[], sanitize: (html?: string) => string): string;

