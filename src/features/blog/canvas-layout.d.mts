export type CanvasBox = {
  version: 1; x: number; y: number; width: number; height: number | null;
  padding?: number; background?: string; fit?: 'cover' | 'contain' | 'crop';
  cropX?: number; cropY?: number; cropZoom?: number;
  tabletWidth?: number; mobileWidth?: number; tabletGap?: number; mobileGap?: number;
  compactAlign?: 'start' | 'center' | 'end';
};
export const CANVAS_WIDTH: number;
export const MIN_SIZE: number;
export const MAX_Y: number;
export const MAX_HEIGHT: number;
export const IMAGE_FITS: NonNullable<CanvasBox['fit']>[];
export function clamp(value: number, min: number, max: number): number;
export function isCanvasBox(box: unknown): box is CanvasBox;
export function boxStyles(box: unknown): Record<string, string | number>;
export function overlaps(a: Omit<CanvasBox, 'height' | 'version'> & { height: number }, b: Omit<CanvasBox, 'height' | 'version'> & { height: number }): boolean;

