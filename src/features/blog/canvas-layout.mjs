export const CANVAS_WIDTH = 900;
export const MIN_SIZE = 24;
export const MAX_Y = 30000;
export const MAX_HEIGHT = 4000;
export const IMAGE_FITS = ['cover', 'contain', 'crop'];

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function isCanvasBox(box) {
  return box?.version === 1
    && integer(box.x, 0, CANVAS_WIDTH - MIN_SIZE)
    && integer(box.y, 0, MAX_Y)
    && integer(box.width, MIN_SIZE, CANVAS_WIDTH - box.x)
    && (box.height === null || integer(box.height, MIN_SIZE, MAX_HEIGHT))
    && (box.padding === undefined || integer(box.padding, 0, 96))
    && (box.background === undefined || (typeof box.background === 'string' && /^#[a-f\d]{6}$/i.test(box.background)))
    && (box.fit === undefined || IMAGE_FITS.includes(box.fit))
    && (box.cropX === undefined || integer(box.cropX, 0, 100))
    && (box.cropY === undefined || integer(box.cropY, 0, 100))
    && (box.cropZoom === undefined || integer(box.cropZoom, 100, 300))
    && (box.tabletWidth === undefined || integer(box.tabletWidth, 25, 100))
    && (box.mobileWidth === undefined || integer(box.mobileWidth, 25, 100))
    && (box.tabletGap === undefined || integer(box.tabletGap, 0, 96))
    && (box.mobileGap === undefined || integer(box.mobileGap, 0, 96))
    && (box.compactAlign === undefined || ['start', 'center', 'end'].includes(box.compactAlign));
}

export function boxStyles(box) {
  if (!isCanvasBox(box)) return {};
  return {
    '--canvas-x': `${box.x / CANVAS_WIDTH * 100}%`,
    '--canvas-y': `${box.y}px`,
    '--canvas-width': `${box.width / CANVAS_WIDTH * 100}%`,
    '--canvas-height': box.height === null ? 'auto' : `${box.height}px`,
    '--canvas-padding': `${box.padding ?? 0}px`,
    '--canvas-background': box.background ?? 'transparent',
    '--canvas-fit': box.fit === 'contain' ? 'contain' : 'cover',
    '--canvas-crop': `${box.cropX ?? 50}% ${box.cropY ?? 50}%`,
    '--canvas-zoom': (box.fit === 'crop' ? box.cropZoom ?? 100 : 100) / 100,
    '--canvas-tablet-width': `${box.tabletWidth ?? 100}%`,
    '--canvas-mobile-width': `${box.mobileWidth ?? 100}%`,
    '--canvas-tablet-gap': `${box.tabletGap ?? 20}px`,
    '--canvas-mobile-gap': `${box.mobileGap ?? 20}px`,
  };
}

export const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;

