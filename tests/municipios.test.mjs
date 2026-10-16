import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const html = readFileSync(new URL('../municipios/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../municipios/municipios.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../municipios/municipios.js', import.meta.url), 'utf8');

test('Landing neutral to municipality, including links and metadata', () => {
  assert.doesNotMatch(html, /↗/);
  assert.doesNotMatch(html + css + js, /caldas|rainha|caldasready|municipio=/i);
  assert.match(html, /<html lang="pt-PT">/);
  assert.equal((html.match(/<h1>/g) || []).length, 1);
  assert.match(html, /https:\/\/app.gerai.pt\/\?canal=municipios/);
});
test('Internal anchors and tab associations resolve to unique IDs', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const match of html.matchAll(/(?:href="#|aria-controls="|aria-labelledby=")([^"]+)"/g)) {
    assert.ok(ids.includes(match[1]), `Missing target: ${match[1]}`);
  }
});
test('Real screenshots are disclosed, present and replace illustrative mockups', () => {
  for (const text of ['Capturas reais da interface','identificação municipal neutralizada','formulário de projetos vazio','não dados em tempo real','não significa novos dados diários','ausência no mapa não significa ausência de atividade']) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /map-illustration|hero-chart|class="pipeline"|Projetos fictícios|VISTA ILUSTRATIVA/);
  const images=[...html.matchAll(/<img[^>]+src="([^"]+)"/g)];
  assert.equal(images.length,4);
  for(const [,src] of images){const bytes=readFileSync(new URL('../municipios/'+src,import.meta.url));assert.equal(bytes[0],255);assert.equal(bytes[1],216);}
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(html, /O botão abre o seu email/);
  assert.equal((html.match(/class="feature reveal"/g) || []).length, 6);
});
function fixture(reduced = false) {
  const make = (id, attributes={}) => ({ id, attributes, tabIndex: 0, hidden: false, listeners: {}, classList: { add(){}, remove(){} }, setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},addEventListener(k,f){this.listeners[k]=f;},focus(){this.focused=true;} });
  const tabs = ['territorio','oportunidades','investimento'].map((id,i)=>make(`tab-${id}`, {'aria-controls':`panel-${id}`,'aria-selected':String(i===0)}));
  const panels = tabs.map((t,i)=>Object.assign(make(t.attributes['aria-controls']), {hidden:i!==0}));
  const toggle = make('motion-toggle');
  const classes = new Set();
  const media = {matches: reduced, addEventListener(k,f){this.change=f;}};
  const context = { window:{matchMedia:()=>media}, document:{
    querySelectorAll:selector=>selector==='[role="tab"]'?tabs:[],
    getElementById:id=>id==='motion-toggle'?toggle:panels.find(p=>p.id===id),
    documentElement:{classList:{toggle(k,v){v?classes.add(k):classes.delete(k);}}}
  }};
  runInNewContext(js, context);
  return {tabs,panels,toggle,media,classes};
}
test('Each tab selects exactly one panel and updates keyboard order', () => {
  const {tabs,panels}=fixture();
  for (let i=0;i<tabs.length;i++) {
    tabs[i].listeners.click();
    assert.equal(panels.filter(p=>!p.hidden).length,1);
    assert.equal(panels[i].hidden,false);
    assert.equal(tabs.filter(t=>t.tabIndex===0).length,1);
    assert.equal(tabs[i].attributes['aria-selected'],'true');
  }
});
test('Keyboard navigation wraps, supports Home/End and moves focus', () => {
  const {tabs}=fixture();
  const key=(i,key)=>tabs[i].listeners.keydown({key,preventDefault(){}});
  key(0,'ArrowLeft'); assert.equal(tabs[2].attributes['aria-selected'],'true'); assert.equal(tabs[2].focused,true);
  key(2,'Home'); assert.equal(tabs[0].attributes['aria-selected'],'true');
  key(0,'End'); assert.equal(tabs[2].attributes['aria-selected'],'true');
  key(2,'ArrowDown'); assert.equal(tabs[0].attributes['aria-selected'],'true');
});
test('Motion can be paused and respects changes to system preference', () => {
  const {toggle,classes,media}=fixture();
  assert.equal(toggle.hidden,false);
  toggle.listeners.click(); assert.ok(classes.has('motion-paused')); assert.equal(toggle.attributes['aria-pressed'],'true');
  toggle.listeners.click(); assert.ok(!classes.has('motion-paused'));
  media.matches=true; media.change(); assert.ok(classes.has('motion-paused')); assert.equal(toggle.hidden,true);
  const reduced=fixture(true); assert.ok(reduced.classes.has('motion-paused'));
});
