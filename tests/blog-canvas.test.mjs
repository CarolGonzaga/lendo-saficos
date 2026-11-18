import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderBlocks, sanitize } from '../server/blog-html.mjs';
import { isCanvasBox } from '../src/features/blog/canvas-layout.mjs';
import { manipulate, defaultGrid } from '../src/features/blog/editor/canvas-geometry.ts';

test('canvas coordinates round-trip as versioned JSON and render as desktop percentages', () => {
  const box = { version: 1, x: 450, y: 16, width: 360, height: 220, fit: 'contain', mobileWidth: 85 };
  assert.deepEqual(JSON.parse(JSON.stringify(box)), box);
  assert.equal(isCanvasBox(box), true);
  assert.equal(isCanvasBox({ ...box, x: 600 }), false);
  assert.equal(isCanvasBox({ ...box, fit: 'cover;background:url(javascript:alert(1))' }), false);
  const html = renderBlocks([{ id: '1', type: 'image', image: '/images/1.jpg', box }]);
  assert.match(html, /cms-canvas-layout/);
  assert.match(html, /--canvas-x:50%;--canvas-y:16px;--canvas-width:40%;--canvas-height:220px/);
  assert.match(html, /--canvas-mobile-width:85%/);
  assert.doesNotMatch(renderBlocks([{ type: 'image', image: '/images/1.jpg', box: { ...box, width: '30%;color:red' } }]), /color:red|cms-canvas-layout/);
});

test('geometry supports both axes, snaps, preserves anchored edges and limits corner size', () => {
  const start = { x: 16, y: 16, width: 200, height: 100 };
  const move = (direction, dx, dy, snap = false, proportional = false, limits) =>
    manipulate(start, direction, dx, dy, defaultGrid, [], snap, proportional, limits);
  assert.deepEqual(move('move', 350, 42).rect, { x: 366, y: 58, width: 200, height: 100 });
  assert.equal(move('move', 100, 7, true).guides.y, 24);
  assert.deepEqual(move('nw', -25, -10).rect, { x: 0, y: 6, width: 216, height: 110 });
  assert.deepEqual(move('se', 80, 40, false, true, { maxWidth: 240 }).rect, { x: 16, y: 16, width: 240, height: 120 });
  assert.deepEqual(move('e', -999, 0, false, false, { minWidth: 160 }).rect, { x: 16, y: 16, width: 160, height: 100 });
});

test('publication preserves the supported formatting and strips unsafe HTML and CSS', () => {
  const input = '<h1>Editorial</h1><p style="text-align:justify;line-height:1.5;margin-top:8px;margin-bottom:16px;background-color:#fff8fb;position:fixed"><span style="font-family:Playfair Display;font-size:21px;font-weight:700;letter-spacing:0.5px;color:#56132f;background-image:url(evil)"><u>Texto</u></span><a href="javascript:alert(1)">link</a></p>';
  const html = sanitize(input);
  for (const style of ['text-align:justify', 'line-height:1.5', 'margin-top:8px', 'margin-bottom:16px', 'background-color:#fff8fb', 'font-family:Playfair Display', 'font-size:21px', 'font-weight:700', 'letter-spacing:0.5px', 'color:#56132f']) {
    assert.ok(html.includes(style), style);
  }
  assert.match(html, /<h1>Editorial<\/h1>/);
  assert.match(html, /<u>Texto<\/u>/);
  assert.doesNotMatch(html, /position:fixed|background-image|javascript:/);
});

