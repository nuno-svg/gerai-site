import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root = new URL('../municipios/caldas-da-rainha/investor-guide/', import.meta.url);
const context = { window: {} };
runInNewContext(readFileSync(new URL('catalog.js', root), 'utf8'), context);
const docs = context.window.INVESTOR_CATALOG;
test('fourteen monolingual publications, complete local images and source PDFs', () => {
  assert.equal(docs.length, 14);
  assert.equal(docs.reduce((n,d) => n+d.pages.length, 0), 156);
  assert.equal(new Set(docs.map(d => d.id)).size, 14);
  for (const language of ['PT','EN']) {
    const edition = docs.filter(d => d.language === language);
    assert.equal(edition.length, 7);
    assert.equal(Array.from(edition,d => d.group).join(','),'guide,facts,assets,industrial,sectors,pitch,welcome');
  }
  for (const doc of docs) {
    assert.equal(readFileSync(new URL(doc.pdf, root)).subarray(0,5).toString(), '%PDF-');
    for (const [i,p] of doc.pages.entries()) {
      assert.equal(p.number, i+1);
      assert.ok(existsSync(new URL(p.image, root)));
      assert.ok(existsSync(new URL(p.thumb, root)));
      assert.equal(typeof p.text, 'string');
      for (const link of p.links) assert.match(link.url, /^(https?:|mailto:|tel:)/);
    }
    for (const chapter of doc.chapters) assert.ok(chapter.page>=1 && chapter.page<=doc.pages.length);
  }
});
test('revision includes industrial data, softlanding and current contact', () => {
  const all = docs.flatMap(d => d.pages.map(p => p.text)).join('\n');
  assert.match(all, /586/);
  assert.match(all, /economia@mcr\.pt/);
  assert.doesNotMatch(all, /via\.expresso@mcr\.pt|≈550 ha/);
  assert.ok(docs.some(d => d.id === 'industrial-en'));
  assert.ok(docs.some(d => d.id === 'industrial-pt'));
});
test('consolidated dossier and industrial sections follow the location material', () => {
  assert.equal(Array.from(docs,d => d.id).join(','), 'guide-pt,facts-pt,assets-pt,industrial-pt,sectors-pt,pitch,welcome-pt,guide,facts-en,assets-en,industrial-en,sectors-en,pitch-en,welcome-en');
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.match(html, /id="download-dossier"[^>]*href="assets\/dossier-pt\/document.pdf"/);
  assert.match(html, /id="edition-language"/);
  for (const lang of ['PT','EN']) {
    assert.equal(readFileSync(new URL(`assets/dossier-${lang.toLowerCase()}/document.pdf`, root)).subarray(0,5).toString(), '%PDF-');
    assert.equal(readFileSync(new URL(`assets/dossier-${lang.toLowerCase()}/Kit_Caldas_${lang}.zip`, root)).subarray(0,2).toString(), 'PK');
  }
});
test('self-hosted reader has no remote runtime scripts and no general landing entry', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8');
  assert.doesNotMatch(html, /<script[^>]*src="https?:/);
  assert.match(html, /noindex,nofollow/);
  assert.match(html, /href="\.\.\/"/);
  const landing = readFileSync(new URL('../municipios/index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(landing, /investor-guide|caldas-da-rainha/i);
  assert.ok(existsSync(new URL('vendor/LICENSE-page-flip.txt', root)));
});
test('reader preserves selected page when rebuilding layout', () => {
  const js = readFileSync(new URL('reader.js', root), 'utf8');
  assert.match(js, /const requestedPage = page/);
  assert.match(js, /flip.turnToPage\(requestedPage\)/);
  assert.match(js, /startPage:requestedPage/);
  assert.doesNotMatch(js, /innerHTML\s*=/);
});
test('Caldas public page offers the library independently of team login', () => {
  const html = readFileSync(new URL('../index.html', root), 'utf8');
  assert.match(html, /Acesso público · Sem conta ou palavra-passe/);
  assert.match(html, /href="investor-guide\/\?doc=guide-pt"/);
  assert.match(html, /Entrar no painel municipal/);
  assert.doesNotMatch(html, /<form|<script|type="password"/);
  for (const doc of docs) assert.ok(html.includes(`?doc=${doc.id}`));
});
