import { CANVAS_WIDTH, MAX_HEIGHT, MAX_Y, MIN_SIZE, clamp, isCanvasBox } from '../canvas-layout.mjs';
import type { CanvasBox } from '../canvas-layout.mjs';
import type { ArticleBlock } from '../types';

export type Rect = Pick<CanvasBox, 'x' | 'y' | 'width'> & { height: number };
export type Direction = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type Grid = { columns: number; gutter: number; margin: number; row: number };
export type Guides = { x?: number; y?: number };
export type SizeLimits = NonNullable<NonNullable<ArticleBlock['layer']>['limits']>;

export const defaultGrid: Grid = { columns: 12, gutter: 16, margin: 16, row: 8 };

export function gridColumns({ columns, gutter, margin }: Grid) {
  const width = (CANVAS_WIDTH - 2 * margin - (columns - 1) * gutter) / columns;
  return Array.from({ length: columns }, (_, index) => ({ x: margin + index * (width + gutter), width }));
}

export function provisionalBoxes(blocks: ArticleBlock[]) {
  let y = Math.max(0, ...blocks.map(block => isCanvasBox(block.box) ? block.box.y + (block.box.height ?? 200) + 20 : 0));
  return blocks.map(block => {
    if (isCanvasBox(block.box)) return block as ArticleBlock & { box: CanvasBox };
    const span = [3, 4, 6, 8, 9, 12].includes(block.span) ? block.span : 12;
    const width = Math.round(CANVAS_WIDTH * span / 12);
    const box: CanvasBox = { version: 1, x: 0, y: Math.min(y, MAX_Y), width, height: block.type === 'image' ? 220 : null };
    y += block.type === 'text' ? 240 : 250;
    return { ...block, box };
  });
}

function nearest(source: number[], targets: number[], threshold = 6) {
  let delta = threshold + 1;
  let guide: number | undefined;
  for (const value of source) {
    for (const target of targets) {
      if (Math.abs(target - value) < Math.abs(delta) && Math.abs(target - value) <= threshold) {
        delta = target - value;
        guide = target;
      }
    }
  }
  return { delta: guide === undefined ? 0 : delta, guide };
}

export function manipulate(
  start: Rect, direction: Direction, dx: number, dy: number, grid: Grid, siblings: Rect[], snap: boolean, proportional: boolean, limits: SizeLimits = {},
) {
  const move = direction === 'move';
  const west = direction.includes('w') && !move;
  const east = direction.includes('e') && !move;
  const north = direction.includes('n');
  const south = direction.includes('s');
  let left = start.x + (move || west ? dx : 0);
  let right = start.x + start.width + (move || east ? dx : 0);
  let top = start.y + (move || north ? dy : 0);
  let bottom = start.y + start.height + (move || south ? dy : 0);
  const guides: Guides = {};

  if (snap) {
    const xTargets = [0, CANVAS_WIDTH, ...gridColumns(grid).flatMap(column => [column.x, column.x + column.width]),
      ...siblings.flatMap(item => [item.x, item.x + item.width / 2, item.x + item.width])];
    const ySource = move && dy !== 0 ? [top, bottom, (top + bottom) / 2] : north ? [top] : south ? [bottom] : [];
    const yTargets = [...siblings.flatMap(item => [item.y, item.y + item.height / 2, item.y + item.height]),
      ...ySource.map(value => Math.round(value / grid.row) * grid.row)];
    const x = nearest(move && dx !== 0 ? [left, right, (left + right) / 2] : west ? [left] : east ? [right] : [], xTargets);
    const y = nearest(ySource, yTargets);
    if (move || west) left += x.delta;
    if (move || east) right += x.delta;
    if (move || north) top += y.delta;
    if (move || south) bottom += y.delta;
    guides.x = x.guide;
    guides.y = y.guide;
  }
  if (move) {
    return { rect: { ...start, x: Math.round(clamp(left, 0, CANVAS_WIDTH - start.width)), y: Math.round(clamp(top, 0, MAX_Y)) }, guides };
  }

  const minWidth = Math.min(start.width, limits.minWidth ?? MIN_SIZE);
  const maxWidth = Math.max(start.width, limits.maxWidth ?? CANVAS_WIDTH);
  const minHeight = Math.min(start.height, limits.minHeight ?? MIN_SIZE);
  const maxHeight = Math.max(start.height, limits.maxHeight ?? MAX_HEIGHT);
  if (proportional && (west || east) && (north || south)) {
    const ratio = start.width / start.height;
    const availableWidth = west ? right : CANVAS_WIDTH - left;
    const availableHeight = north ? bottom : maxHeight;
    const widthFromHeight = (bottom - top) * ratio;
    const desiredWidth = Math.abs(dx) >= Math.abs(dy * ratio) ? right - left : widthFromHeight;
    const width = clamp(desiredWidth, Math.max(minWidth, minHeight * ratio), Math.min(maxWidth, availableWidth, maxHeight * ratio, availableHeight * ratio));
    const height = width / ratio;
    if (west) left = right - width;
    else right = left + width;
    if (north) top = bottom - height;
    else bottom = top + height;
    guides.y = undefined;
  }
  if (west) left = clamp(left, Math.max(0, right - maxWidth), right - minWidth);
  if (east) right = clamp(right, left + minWidth, Math.min(CANVAS_WIDTH, left + maxWidth));
  if (north) top = clamp(top, Math.max(0, bottom - maxHeight), Math.min(MAX_Y, bottom - minHeight));
  if (south) bottom = clamp(bottom, top + minHeight, top + maxHeight);

  return { rect: {
    x: Math.round(left), y: Math.round(top), width: Math.round(right) - Math.round(left),
    height: Math.round(bottom) - Math.round(top),
  }, guides };
}

