import assert from 'node:assert/strict';
import { test } from 'node:test';
import { articleHtml, buildSitemap, isPublic, renderBlocks, safeUrl, sanitize } from '../server/blog-html.mjs';

const article={id:1,slug:'romance',title:'Romance <script>alert(1)</script>',excerpt:'Resumo',category:'Listas',image:'/images/1.jpg',status:'Publicado',published_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-02T00:00:00Z',blocks:[]};
const template='<!doctype html><html><head><title>Site</title></head><body><div id="root"></div><script src="/assets/app.js"></script></body></html>';
test('nested hostile HTML and protocols are sanitized',() => {
  const output=sanitize('<div><img src=x onerror=alert(1)><a href="javascript:alert(1)">Link</a><script>alert(1)</script><strong>Seguro</strong></div>');
  assert.ok(!output.includes('onerror')); assert.ok(!output.includes('javascript:')); assert.ok(!output.includes('<script')); assert.ok(output.includes('<strong>Seguro</strong>'));
  for(const url of ['javascript:alert(1)','data:text/html,test','//evil.com','file:///test']) assert.equal(safeUrl(url),'');
});
test('all legacy and new blocks render with safe links and accessible image',() => {
  const blocks=[{type:'text',content:'<b>Antigo</b>'},{type:'product',title:'Produto',url:'https://example.com',image:'/book.jpg'},{type:'linklist',title:'Livros',items:[{title:'Livro',url:'https://example.com'}]},{type:'image',image:'/photo.jpg',alt:'Descrição',caption:'Legenda'},{type:'h2',content:'Subtítulo'},{type:'h3',content:'Seção'},{type:'quote',content:'Citação'},{type:'bullets',entries:['Item']},{type:'numbered',entries:['Item']},{type:'divider'},{type:'button',title:'Abrir',url:'javascript:alert(1)'}];
  const html=renderBlocks(blocks); assert.ok(html.includes('Antigo')); assert.ok(html.includes('alt="Descrição"')); assert.ok(html.includes('<blockquote>')); assert.ok(html.includes('<ol>')); assert.ok(html.includes('rel="noopener noreferrer"')); assert.ok(!html.includes('javascript:'));
});
test('article metadata and JSON-LD are escaped without inventing an author',() => {
  const html=articleHtml(template,{...article,seo_title:'SEO personalizado',seo_description:'Descrição SEO'});
  assert.ok(html.includes('SEO personalizado')); assert.ok(html.includes('Descrição SEO')); assert.ok(html.includes('BlogPosting')); assert.ok(html.includes('datePublished')); assert.ok(!html.includes('"author"')); assert.ok(!html.includes('<script>alert(1)</script>')); assert.ok(html.includes('/assets/app.js'));
});
test('sitemap contains only effective public URLs with modification date',() => {
  const entries=[article,{...article,slug:'suspensa',status:'Suspenso'},{...article,slug:'lixeira',status:'Lixeira',deleted_at:new Date().toISOString()},{...article,slug:'futura',status:'Agendado',scheduled_at:'2999-01-01T00:00:00Z'},{...article,slug:'agendada-liberada',status:'Agendado',scheduled_at:'2020-01-01T00:00:00Z'}];
  const xml=buildSitemap(entries); assert.ok(xml.includes('/blog/romance')); assert.ok(xml.includes('agendada-liberada')); assert.ok(!xml.includes('suspensa')); assert.ok(!xml.includes('lixeira')); assert.ok(!xml.includes('futura')); assert.ok(xml.includes('<lastmod>'));
  assert.equal(isPublic(entries[3]),false);
});
