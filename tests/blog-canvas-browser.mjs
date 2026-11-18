import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, expect } from '@playwright/test';
import { PGlite } from '@electric-sql/pglite';
import { articleHtml } from '../server/blog-html.mjs';

const base = 'http://127.0.0.1:4178';
const artifacts = process.env.BLOG_CANVAS_ARTIFACTS;
const legacy = {
  id: 1, title: 'Artigo antigo', slug: 'artigo-antigo', excerpt: 'Resumo antigo', category: 'Novidades',
  category_id: 1, image: '', status: 'Publicado', author_name: 'Equipe Lendo Sáficos', comments_mode: 'off',
  created_at: '2026-01-01T12:00:00.000Z', updated_at: '2026-01-01T12:00:00.000Z', published_at: '2026-01-01T12:00:00.000Z',
  blocks: [{ id: 'legacy', type: 'text', span: 8, align: 'left', content: '<p><font color="#56132f" size="4">Texto antigo preservado</font></p>' }],
};
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'admin@example.com', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {} };
const pg = new PGlite();
await pg.exec('create table articles (id integer primary key, article jsonb not null); create table working_drafts (id integer primary key, draft jsonb not null)');
await pg.query('insert into articles values (1, $1)', [legacy]);
const read = async () => (await pg.query('select article from articles order by id')).rows.map(row => row.article);
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: base, VITE_SUPABASE_ANON_KEY: 'local-test' },
  windowsHide: true, stdio: 'pipe',
});
let browser;
let page;
const errors = [];

async function installFixture(context) {
  await context.route(`${base}/auth/v1/**`, async route => {
    if (route.request().url().includes('/token')) {
      await route.fulfill({ json: { access_token: 'local-admin', refresh_token: 'local-refresh', token_type: 'bearer', expires_in: 3600, user } });
    } else await route.fulfill({ json: user });
  });
  await context.route(`${base}/rest/v1/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split('/').at(-1);
    const method = request.method();
    const json = request.postDataJSON() || {};
    const id = Number((url.searchParams.get('id') || url.searchParams.get('article_id') || 'eq.0').slice(3));
    let result = [];
    switch (endpoint) {
      case 'admin_users':
        result = request.headers().accept?.includes('object') ? { user_id: user.id, role: 'admin' } : [{ user_id: user.id, role: 'admin' }];
        break;
      case 'search_blog_articles': {
        const articles = await read();
        result = { articles, total: articles.length, counts: {} };
        break;
      }
      case 'blog_categories': result = [{ id: 1, name: 'Novidades', slug: 'novidades' }]; break;
      case 'blog_public_settings': result = { comments_mode: 'off' }; break;
      case 'get_public_blog_article':
        result = (await read()).find(article => article.slug === json.article_slug && article.status === 'Publicado') || null;
        break;
      case 'blog_articles': {
        const previous = (await read()).find(article => article.id === id);
        const next = { ...previous, ...json, id: previous?.id || 2, created_at: previous?.created_at || new Date().toISOString(), updated_at: new Date().toISOString() };
        await pg.query('insert into articles values ($1, $2) on conflict(id) do update set article=excluded.article', [next.id, next]);
        result = next;
        break;
      }
      case 'blog_editor_drafts':
        if (method === 'POST') {
          await pg.query('insert into working_drafts values ($1, $2) on conflict(id) do update set draft=excluded.draft', [json.article_id, json]);
        } else if (method === 'DELETE') {
          await pg.query('delete from working_drafts where id=$1', [id]);
        } else {
          result = (await pg.query('select draft from working_drafts where id=$1', [id])).rows.map(row => row.draft);
        }
        break;
      default:
        break;
    }
    await route.fulfill({ json: result });
  });
  await context.route(`${base}/article-static`, async route => {
    const saved = (await read()).find(article => article.id === 2);
    const template = '<!doctype html><html lang="pt-BR"><head><title>Blog</title><link rel="stylesheet" href="/src/features/blog/blog.css?direct"><link rel="stylesheet" href="/src/styles.css?direct"></head><body><div id="root"></div></body></html>';
    await route.fulfill({ contentType: 'text/html; charset=utf-8', body: articleHtml(template, saved) });
  });
}

async function drag(target, dx, dy, { alt = true, midway } = {}) {
  const bounds = await target.boundingBox();
  assert.ok(bounds, 'Mouse target exists');
  await target.scrollIntoViewIfNeeded();
  const visible = await target.boundingBox();
  const x = visible.x + visible.width / 2;
  const y = visible.y + visible.height / 2;
  await page.mouse.move(x, y);
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 16 });
  if (midway) await midway();
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
}

async function layout(root) {
  return root.evaluate(canvas => {
    const origin = canvas.getBoundingClientRect();
    const geometry = element => {
      const rect = element.getBoundingClientRect();
      return [rect.x - origin.x, rect.y - origin.y, rect.width, rect.height].map(Math.round);
    };
    const text = canvas.querySelector('.cms-block-text p');
    const span = text.querySelector('span');
    const image = canvas.querySelector('figure img');
    const pStyle = getComputedStyle(text);
    const spanStyle = getComputedStyle(span);
    const imageStyle = getComputedStyle(image);
    return {
      width: Math.round(origin.width),
      blocks: Array.from(canvas.querySelectorAll(':scope > .cms-block')).map(geometry),
      text: [pStyle.textAlign, pStyle.lineHeight, pStyle.marginTop, pStyle.marginBottom, pStyle.backgroundColor],
      span: [spanStyle.fontFamily, spanStyle.fontSize, spanStyle.fontWeight, spanStyle.letterSpacing, spanStyle.color],
      image: [imageStyle.objectFit, ...geometry(image)],
    };
  });
}

async function capture(locator, name) {
  if (!artifacts) return;
  await locator.screenshot({ path: join(artifacts, name), animations: 'disabled', timeout: 10000 });
}

try {
  if (artifacts) await mkdir(artifacts, { recursive: true });
  await expect.poll(async () => (await fetch(base).catch(() => null))?.ok ?? false, { timeout: 15000 }).toBe(true);
  const browserOptions = process.env.BLOG_CANVAS_BROWSER ? { channel: process.env.BLOG_CANVAS_BROWSER } : process.platform === 'win32' ? { channel: 'msedge' } : {};
  browser = await chromium.launch(browserOptions);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await installFixture(context);
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const stage = page.locator('.cms-editing-stage');
  const publicLayout = page.locator('.cms-rendered-content .cms-canvas-layout');
  await page.goto(`${base}/admin/posts`);
  await page.getByLabel('E-mail', { exact: true }).fill(user.email);
  await page.getByLabel('Senha', { exact: true }).fill('senha-local');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await page.getByRole('button', { name: legacy.title, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Conteúdo do bloco de texto' })).toContainText('Texto antigo preservado');
  await page.getByRole('button', { name: /Avançado.*Editor Visual/ }).click();
  await page.getByRole('button', { name: 'Prévia da conversão' }).click();
  await expect(page.getByRole('dialog')).toContainText('Texto antigo preservado');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Voltar às matérias' }).click();
  assert.deepEqual((await read())[0].blocks, legacy.blocks);
  console.log('PASS artigo antigo abre no básico e a prévia de conversão preserva o original');

  await page.getByRole('button', { name: /Novo artigo/ }).click();
  await page.getByLabel('Título', { exact: true }).fill('Uma página editorial');
  await page.getByLabel('Resumo', { exact: true }).fill('Composição editorial de teste');
  await page.getByRole('button', { name: /Avançado.*Editor Visual/ }).click();
  const textLayer = page.getByRole('button', { name: 'Selecionar Texto no canvas' });
  await textLayer.click();
  const right = page.getByRole('button', { name: 'Redimensionar Texto, direito', exact: true });
  await drag(right, -490, 0);
  await expect(page.getByLabel('Largura (px)', { exact: true })).toHaveValue('410');
  const editor = page.getByRole('textbox', { name: 'Conteúdo do bloco de texto' });
  await editor.fill('Histórias que atravessam gerações. Uma conversa sobre literatura, memória e as autoras que abriram espaço para novas vozes.');
  await editor.press('Control+a');
  await page.getByLabel('Alinhamento do texto').selectOption('center');
  await expect(stage.locator('p')).toHaveCSS('text-align', 'center');
  await page.getByLabel('Alinhamento do texto').selectOption('justify');
  await page.getByLabel('Fonte', { exact: true }).selectOption('Playfair Display');
  await page.getByLabel('Tamanho do texto').selectOption('21px');
  await page.getByLabel('Peso', { exact: true }).selectOption('700');
  await page.getByLabel('Cor do texto').fill('#56132f');
  await page.getByLabel('Fundo do parágrafo').fill('#fff8fb');
  await page.getByLabel('Altura de linha').selectOption('1.5');
  await page.getByLabel('Espaço entre letras').selectOption('0.5px');
  await page.getByLabel('Antes do parágrafo').selectOption('8px');
  await page.getByLabel('Depois do parágrafo').selectOption('16px');
  await page.getByRole('button', { name: 'Sublinhado' }).click();
  await expect(stage.locator('p')).toHaveCSS('text-align', 'justify');
  await expect(stage.locator('p span')).toHaveCSS('font-size', '21px');
  await expect(stage.locator('p span')).toHaveCSS('font-weight', '700');
  await expect(stage.locator('u')).toBeVisible();
  await textLayer.click();
  await drag(page.getByRole('button', { name: 'Redimensionar Texto, inferior', exact: true }), 0, 58);
  assert.ok(Number(await page.getByLabel('Altura (px)', { exact: true }).inputValue()) > 130);
  console.log('PASS caixa de texto redimensionada pelo mouse e estilos do Tiptap aplicados ao canvas');

  await page.getByLabel('Adicionar elemento').selectOption('image');
  await page.getByLabel('Ou endereço da imagem').first().fill('/images/2.jpg');
  await page.getByLabel('Texto alternativo (descreva a imagem)').fill('Foto para a composição editorial');
  const imageLayer = page.getByRole('button', { name: 'Selecionar Imagem no canvas' });
  await imageLayer.click();
  assert.equal(await page.getByLabel('Posição X (px)').inputValue(), '16');
  await capture(stage, '01-imagem-antes.png');
  await drag(imageLayer, 456, 0, { midway: () => capture(stage, '01b-arraste-horizontal.png') });
  await expect(page.getByLabel('Posição X (px)')).toHaveValue('472');
  const y = Number(await page.getByLabel('Posição Y (px)').inputValue());
  await drag(imageLayer, 0, -y + 1, { alt: false, midway: async () => {
    await expect(stage.locator('.cms-canvas-guide-y')).toBeAttached();
  } });
  await expect(page.getByLabel('Posição Y (px)')).toHaveValue('0');
  await capture(stage, '02-imagem-ao-lado.png');
  await drag(page.getByRole('button', { name: 'Redimensionar Imagem, direito', exact: true }), 102, 0);
  await expect(page.getByLabel('Largura (px)', { exact: true })).toHaveValue('382');
  await capture(stage, '03-imagem-redimensionada.png');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(page.getByLabel('Largura (px)', { exact: true })).toHaveValue('280');
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  await expect(page.getByLabel('Largura (px)', { exact: true })).toHaveValue('382');
  await imageLayer.press('ArrowRight');
  await expect(page.getByLabel('Posição X (px)')).toHaveValue('473');
  await imageLayer.press('ArrowLeft');
  await page.getByLabel('Adicionar elemento').selectOption('quote');
  await page.locator('.cms-canvas-content-properties').getByLabel('Texto', { exact: true }).fill('A literatura também é um lugar de encontro.');
  const quote = page.getByRole('button', { name: 'Selecionar Citação no canvas' });
  await drag(page.getByRole('button', { name: 'Redimensionar Citação, direito', exact: true }), 280, 0);
  await expect(page.getByLabel('Largura (px)', { exact: true })).toHaveValue('560');
  await quote.focus();
  await quote.press('ArrowDown');
  await page.getByText('Layout em tablet e celular', { exact: true }).click();
  const quoteMobileWidth = page.getByLabel('Largura no celular (%)');
  await quoteMobileWidth.fill('90');
  await quoteMobileWidth.press('Enter');
  await page.getByRole('button', { name: 'Grade', exact: true }).click();
  await stage.click({ position: { x: 895, y: 405 } });
  await page.evaluate(() => document.fonts.ready);
  const editorLayout = await layout(stage);
  assert.deepEqual(editorLayout.blocks.slice(0, 2).map(([x, y, w]) => [x, y, w]), [[0, 0, 410], [472, 0, 382]]);
  assert.deepEqual(editorLayout.text, ['justify', '25.5px', '8px', '16px', 'rgb(255, 248, 251)']);
  assert.deepEqual(editorLayout.span.slice(1), ['21px', '700', '0.5px', 'rgb(86, 19, 47)']);
  const official = await page.locator('.cms-editor-top-actions .button-primary').evaluate(button => ({
    action: getComputedStyle(button).backgroundColor,
    pink: getComputedStyle(document.documentElement).getPropertyValue('--pink').trim(),
    ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
  }));
  assert.deepEqual(official, { action: 'rgb(212, 0, 98)', pink: '#d40062', ink: '#56132f' });
  await capture(stage, '04-editor.png');
  console.log('PASS imagem movida 456 px no eixo X, alinhada no eixo Y, ampliada 102 px com a alça, undo/redo e teclado');

  await page.getByRole('button', { name: 'Prévia do layout' }).click();
  const dialog = page.getByRole('dialog', { name: 'Prévia do rascunho' });
  await expect(dialog).toBeVisible();
  assert.deepEqual(await layout(publicLayout), editorLayout);
  await capture(publicLayout, '05-previa-desktop.png');
  const responsive = {};
  for (const mode of ['Tablet', 'Mobile']) {
    await dialog.getByRole('button', { name: mode, exact: true }).click();
    responsive[mode] = await layout(publicLayout);
    const [left, right, citation] = responsive[mode].blocks;
    assert.ok(right[1] >= left[1] + left[3] && citation[1] >= right[1] + right[3]);
    if (mode === 'Mobile') assert.equal(citation[2], Math.round(responsive[mode].width * 0.9));
    await capture(publicLayout, `07-previa-${mode.toLowerCase()}.png`);
  }
  await page.keyboard.press('Escape');
  await page.locator('.cms-editor-top-actions').getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByText('Matéria salva com sucesso.').first()).toBeVisible();
  const saved = (await read()).find(article => article.id === 2);
  assert.equal(saved.status, 'Rascunho');
  assert.deepEqual(saved.blocks[1].box, { version: 1, x: 472, y: 0, width: 382, height: 200 });
  await page.reload();
  await page.getByRole('button', { name: saved.title, exact: true }).click();
  await expect(stage).toBeVisible();
  assert.deepEqual(await layout(stage), editorLayout);
  await page.getByRole('button', { name: 'Selecionar Texto no canvas' }).click();
  await page.getByRole('textbox', { name: 'Conteúdo do bloco de texto' }).press('Control+a');
  await expect(page.getByLabel('Fonte', { exact: true })).toHaveValue('Playfair Display');
  await expect(page.getByLabel('Tamanho do texto')).toHaveValue('21px');
  await expect(page.getByLabel('Alinhamento do texto')).toHaveValue('justify');
  await page.getByRole('button', { name: 'Editar texto no canvas' }).click();
  await expect(stage.getByRole('textbox', { name: 'Conteúdo do bloco de texto' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(stage.getByRole('textbox', { name: 'Conteúdo do bloco de texto' })).toHaveCount(0);
  console.log('PASS geometria e estilos sobreviveram ao salvamento JSONB e ao reload; controles reabertos refletem o texto');

  await page.locator('.cms-editor-top-actions').getByRole('button', { name: /Publicar/ }).click();
  await expect(page.getByText('Matéria salva com sucesso.').first()).toBeVisible();
  await expect.poll(async () => (await read()).find(article => article.id === 2).status).toBe('Publicado');
  await page.goto(`${base}/blog/${saved.slug}`);
  await expect(page.getByRole('heading', { name: saved.title })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(await layout(publicLayout), editorLayout);
  await capture(publicLayout, '06-publicacao-desktop.png');
  for (const [mode, width] of [['Tablet', 768], ['Mobile', 390]]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.deepEqual(await layout(publicLayout), responsive[mode]);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${base}/article-static`);
  await expect(publicLayout).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  assert.deepEqual(await layout(publicLayout), editorLayout);
  await capture(publicLayout, '08-publicacao-html-servidor.png');

  await page.goto(`${base}/admin/posts`);
  await page.getByRole('button', { name: saved.title, exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar Imagem no canvas' }).click();
  const xField = page.getByLabel('Posição X (px)');
  await xField.fill('492');
  await xField.press('Enter');
  await expect(xField).toHaveValue('492');
  await expect(page.getByText(/Salvo automaticamente/).first()).toBeVisible();
  const working = (await pg.query('select draft from working_drafts where id=2')).rows[0].draft;
  assert.equal(working.content.blocks[1].box.x, 492);
  assert.equal((await read()).find(article => article.id === 2).blocks[1].box.x, 472);
  await page.reload();
  await page.getByRole('button', { name: saved.title, exact: true }).click();
  await page.getByRole('button', { name: 'Selecionar Imagem no canvas' }).click();
  await expect(page.getByLabel('Posição X (px)')).toHaveValue('492');
  console.log('PASS ajuste numérico, autosave e recuperação preservam a versão pública até publicar novamente');
  await page.getByText('Componentes para arrastar', { exact: true }).click();
  await stage.evaluate(element => window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 250, behavior: 'instant' }));
  const separatorBounds = await page.getByRole('button', { name: 'Separador', exact: true }).boundingBox();
  const stageBounds = await stage.boundingBox();
  await page.mouse.move(separatorBounds.x + separatorBounds.width / 2, separatorBounds.y + separatorBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(stageBounds.x + 609, stageBounds.y + 360, { steps: 16 });
  await page.mouse.move(stageBounds.x + 610, stageBounds.y + 360);
  await page.mouse.up();
  await expect(page.getByLabel('Posição X (px)')).toHaveValue('610');
  await expect(page.getByLabel('Posição Y (px)')).toHaveValue('360');
  await page.getByRole('button', { name: 'Grupo de colunas', exact: true }).click();
  const columns = stage.getByRole('button', { name: 'Selecionar Texto no canvas', exact: true });
  const firstColumn = columns.nth(1);
  await drag(firstColumn, 70, 17);
  await expect(page.getByLabel('Posição X (px)')).toHaveValue('86');
  await columns.nth(2).click();
  await expect(page.getByLabel('Posição X (px)')).toHaveValue('366');
  console.log('PASS inserção por arraste da biblioteca e movimentação conjunta de camadas agrupadas');
  assert.deepEqual(errors, []);
  console.log('PASS editor, prévia, publicação React e HTML do servidor têm a mesma geometria e formatação; tablet e celular preservam leitura sem overflow');
} catch (error) {
  if (page && artifacts) await page.screenshot({ path: join(artifacts, 'diagnostico.png'), fullPage: true }).catch(() => {});
  console.error('Erros no navegador:', errors);
  throw error;
} finally {
  await browser?.close();
  vite.kill();
  await pg.close();
}

