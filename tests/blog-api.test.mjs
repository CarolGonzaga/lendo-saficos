import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startBlogFixture } from './fixtures/blog-server.mjs';
import pageHandler from '../api/blog-page.js';
import indexHandler from '../api/blog-index.js';
import sitemapHandler from '../api/blog-sitemap.js';

let fixture;
const envBefore={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_ANON_KEY};
before(async () => { fixture=await startBlogFixture(54322);process.env.SUPABASE_URL='http://127.0.0.1:54322';process.env.SUPABASE_ANON_KEY='fixture-anon'; });
after(async () => {await fixture.close();if(envBefore.url) process.env.SUPABASE_URL=envBefore.url;else delete process.env.SUPABASE_URL;if(envBefore.key) process.env.SUPABASE_ANON_KEY=envBefore.key;else delete process.env.SUPABASE_ANON_KEY;});
async function invoke(handler,request={}) {
  const result={code:200,headers:{},body:''};
  const response={setHeader:(key,value) => {result.headers[key]=value;},status:code => {result.code=code;return response;},send:body => {result.body=body;}};
  await handler(request,response);return result;
}
test('dynamic article returns fresh SEO, then suspension immediately gives HTTP 404',async () => {
  const first=await invoke(pageHandler,{query:{slug:'saude-e-romance'}});assert.equal(first.code,200);assert.equal(first.headers['Cache-Control'],'no-store');assert.ok(first.body.includes('BlogPosting'));assert.ok(first.body.includes('Conteúdo antigo'));
  await fixture.pg.exec("update blog_articles set seo_title='SEO novo',seo_description='Meta nova' where id=1");
  const changed=await invoke(pageHandler,{query:{slug:'saude-e-romance'}});assert.ok(changed.body.includes('SEO novo'));assert.ok(changed.body.includes('Meta nova'));
  await fixture.pg.exec("update blog_articles set status='Suspenso' where id=1");
  const hidden=await invoke(pageHandler,{query:{slug:'saude-e-romance'}});assert.equal(hidden.code,404);assert.ok(hidden.body.includes('noindex'));
  await fixture.pg.exec("update blog_articles set status='Publicado' where id=1");
});
test('dynamic list and sitemap remove hidden content without a build',async () => {
  const first=await invoke(indexHandler,{url:'/blog?q=saude'});assert.equal(first.code,200);assert.ok(first.body.includes('Saúde e romance'));
  let sitemap=await invoke(sitemapHandler);assert.ok(sitemap.body.includes('/blog/saude-e-romance'));assert.ok(!sitemap.body.includes('/blog/segunda-materia'));
  await fixture.pg.exec("update blog_articles set status='Lixeira' where id=1");
  sitemap=await invoke(sitemapHandler);assert.ok(!sitemap.body.includes('/blog/saude-e-romance'));assert.equal(sitemap.headers['Cache-Control'],'no-store');
});
test('missing article is a real 404',async () => {assert.equal((await invoke(pageHandler,{query:{slug:'inexistente'}})).code,404);});
test('scheduled article is served automatically when database time arrives',async () => {
  await fixture.pg.exec("insert into blog_articles(title,excerpt,category,slug,status,scheduled_at) values('Agendamento HTTP','Resumo','Novidades','agendamento-http','Agendado',now()+interval '1 day')");
  assert.equal((await invoke(pageHandler,{query:{slug:'agendamento-http'}})).code,404);
  await fixture.pg.exec("update blog_articles set scheduled_at=now()-interval '1 second' where slug='agendamento-http'");
  assert.equal((await invoke(pageHandler,{query:{slug:'agendamento-http'}})).code,200);
  assert.ok((await invoke(sitemapHandler)).body.includes('/blog/agendamento-http'));
});
