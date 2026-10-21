import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root = new URL('../municipios/caldas-da-rainha/investor-guide/', import.meta.url);
const context = { window: {} };
runInNewContext(readFileSync(new URL('catalog-index.js', root), 'utf8'), context);
const index = context.window.INVESTOR_CATALOG, editions = context.window.INVESTOR_EDITIONS;
// Full publications = index entry + its on-demand data file.
const docs = index.map(d => ({...d, ...JSON.parse(readFileSync(new URL(`data/${d.id}.json`, root), 'utf8'))}));
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
  assert.match(html, /Sem criar conta · Pedido privado/);
  assert.match(html, /href="investor-guide\/\?doc=guide-pt"/);
  assert.match(html, /Entrar no painel municipal/);
  assert.doesNotMatch(html, /type="password"/);
  assert.match(html, /<script type="module" src="investor-portal\.js(?:\?v=[\w-]+)?"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  for (const doc of docs) assert.ok(html.includes(`?doc=${doc.id}`));
});
const near = (declared, actual, label) => assert.ok(Math.abs(declared - actual) <= actual * .01, `${label}: ${declared} vs ${actual}`);
test('declared download sizes match the files (±1%)', () => {
  for (const d of index) near(d.bytes, statSync(new URL(d.pdf, root)).size, d.pdf);
  assert.deepEqual(Object.keys(editions), ['PT','EN']);
  for (const [lang, e] of Object.entries(editions)) for (const f of [e.dossier, e.kit]) {
    assert.ok(f.href.startsWith(`assets/dossier-${lang.toLowerCase()}/`)); near(f.bytes, statSync(new URL(f.href, root)).size, f.href);
  }
});
test('index carries no page data; each publication loads from its own data file', () => {
  assert.ok(statSync(new URL('catalog-index.js', root)).size < 20000);
  for (const d of index) {
    assert.equal(d.pages, undefined);
    const data = JSON.parse(readFileSync(new URL(`data/${d.id}.json`, root), 'utf8'));
    assert.equal(data.id, d.id); assert.equal(data.pages.length, d.pageCount);
    assert.equal(d.thumb.length, 2);
  }
  // Legacy full catalogue stays for pages cached before the split; it must describe the same pages.
  const legacy = { window: {} }; runInNewContext(readFileSync(new URL('catalog.js', root), 'utf8'), legacy);
  assert.deepEqual(JSON.parse(JSON.stringify(legacy.window.INVESTOR_CATALOG.map(d => d.pages))), JSON.parse(JSON.stringify(docs.map(d => d.pages))));
  const html = readFileSync(new URL('index.html', root), 'utf8'), js = readFileSync(new URL('reader.js', root), 'utf8');
  const v = html.match(/reader\.js\?v=(\d{8})/)[1];
  assert.match(html, new RegExp(`catalog-index\\.js\\?v=${v}`)); assert.match(html, new RegExp(`reader\\.css\\?v=${v}`));
  assert.match(js, new RegExp(`const V = '${v}'`)); assert.doesNotMatch(html, /src="catalog\.js/);
  assert.match(html, /default-src 'self'/); assert.doesNotMatch(html, /connect-src 'none'/);
});
// Minimal DOM: enough for reader.js to run without a page-flip engine or layout.
function runReader(search, {legacy = false} = {}) {
  const cache = new Map(), fetched = [];
  const el = tag => { const e = {tagName: tag.toUpperCase(), children: [], attributes: {}, dataset: {}, style: {}, firstChild: {nodeValue: ''}, _t: '',
    classList: {set: new Set(), add(k) {this.set.add(k);}, remove(k) {this.set.delete(k);}, toggle(k, v) {(v ?? !this.set.has(k)) ? this.set.add(k) : this.set.delete(k);}, contains(k) {return this.set.has(k);}},
    get textContent() { return this.children.length ? this.children.map(c => typeof c === 'string' ? c : c.textContent).join('') : this._t; },
    set textContent(v) { this._t = String(v); this.children = []; },
    append(...c) { this.children.push(...c); }, replaceChildren(...c) { this.children = c; },
    setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return this.attributes[k] ?? null; }, removeAttribute(k) { delete this.attributes[k]; },
    focus() {}, querySelectorAll() { return []; }};
    return e; };
  const one = key => cache.get(key) || cache.set(key, el('div')).get(key);
  const document = {getElementById: one, querySelector: one, querySelectorAll: () => [], createElement: el, documentElement: el('html'), body: el('body'), addEventListener() {}};
  const location = {href: `https://example.test/investor-guide/${search}`, get search() { return new URL(this.href).search; }};
  const ctx = {document, location, history: {replaceState(a, b, u) { location.href = String(u); }}, URL, URLSearchParams, Intl, Map, Promise, Error, JSON, console,
    matchMedia: () => ({matches: true}), innerWidth: 1200, setTimeout: () => 0, clearTimeout() {}, navigator: {}, addEventListener() {},
    fetch: async url => { fetched.push(url); const file = new URL(url.split('?')[0], root); return {ok: existsSync(file), json: async () => JSON.parse(readFileSync(file, 'utf8'))}; }};
  ctx.window = ctx;
  runInNewContext(readFileSync(new URL(legacy ? 'catalog.js' : 'catalog-index.js', root), 'utf8'), ctx);
  runInNewContext(readFileSync(new URL('reader.js', root), 'utf8'), ctx);
  return {$: one, fetched, location, settle: () => new Promise(r => setTimeout(r, 5))};
}
test('reader fetches only the opened publication, keeps deep links, aliases and search', async () => {
  const r = runReader('?doc=facts&page=3');
  await r.settle();
  assert.deepEqual(r.fetched, ['data/facts-pt.json?v=20261023']);
  assert.equal(r.$('page-input').value, 3); assert.equal(r.$('title').textContent, 'O concelho e os apoios');
  assert.match(r.location.href, /doc=facts-pt&page=3&lang=PT/);
  assert.equal(r.$('download').textContent, 'Descarregar PDF · 616 kB: O concelho e os apoios');
  assert.equal(r.$('download').children[1], 'PDF · 616 kB');
  assert.equal(r.$('download').children[0].className, 'visually-hidden');
  assert.equal(r.$('download-dossier').textContent, 'Dossier completo · PDF · 18,6 MB');
  assert.equal(r.$('download-package').textContent, 'Pacote em português · ZIP · 31,4 MB');
  assert.equal(r.$('thumbnails').children[0].children[0].width, index.find(d => d.id === 'facts-pt').thumb[0]);
  r.$('search').oninput({target: {value: 'economia@mcr'}});
  assert.match(r.$('search-results').children[0].textContent, /^[1-9]\d* página/);
  r.$('edition-language').value = 'EN'; await r.$('edition-language').onchange({target: r.$('edition-language')});
  assert.deepEqual(r.fetched, ['data/facts-pt.json?v=20261023', 'data/facts-en.json?v=20261023']);
  assert.equal(r.$('download-dossier').textContent, 'Complete dossier · PDF · 16.4 MB');
  assert.equal(r.$('download-package').textContent, 'English package · ZIP · 27 MB');
  assert.match(r.$('download').textContent, /^Download PDF · 632 kB: Municipality and support$/);
  await r.$('publication').onchange({target: {value: 'facts-pt'}});
  assert.equal(r.fetched.length, 2, 'already loaded publications are not fetched again');
});
test('reader still works with the legacy full catalogue of cached pages', async () => {
  const r = runReader('?doc=guide&page=2', {legacy: true});
  await r.settle();
  assert.deepEqual(r.fetched, []); assert.equal(r.$('page-input').value, 2); assert.equal(r.$('download').textContent, 'Download PDF: Investor Guide');
});
