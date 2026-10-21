import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateRequest,areaIds} from '../municipios/caldas-da-rainha/intake-model.js';
import {header,hero,nav} from '../municipios/caldas-da-rainha/portal-shell.js';
import tenant from '../municipios/caldas-da-rainha/tenant-config.js';
const base=new URL('../municipios/caldas-da-rainha/',import.meta.url);
const valid={kind:'project',language:'en',name:'Test User',email:'test@example.invalid',organisation:'Test entity',country:'Portugal',sector:'Industry',title:'Test project',message:'A request with sufficient detail.',spaceNeeds:'',timeline:'',businessAreaId:'cidade',forecastValue:'1200.50',estimatedJobs:'3',privacyAccepted:true,website:''};
test('opening prioritises a project enquiry while preserving guide and space routes in PT/EN',()=>{
 const source=fs.readFileSync(new URL('investor-portal.js',base),'utf8'),shell=fs.readFileSync(new URL('portal-shell.js',base),'utf8');
 const hero=shell.slice(shell.indexOf('export function hero'),shell.indexOf('<nav class="portal-nav"'));
 assert.match(hero,/class="primary" href="#pedido" data-kind="project"/);
 assert.match(hero,/Apresentar o meu projeto','Introduce my project/);
 assert.match(hero,/href="#espacos"/);
 assert.match(hero,/href="#pedido" data-kind="information"/);
 assert.match(hero,/hero-guide/);assert.match(hero,/Descarregar PDF','Download PDF/);
 assert.doesNotMatch(hero,/↗|48h|14 days/);
 assert.match(source,/if\(busy\|\|submitted\)return;if\(!kindChosen\)\{document.querySelector\(`input\[name=kind\]/);
});
test('intake validates both languages and optional figures without inventing zero',()=>{for(const language of ['pt','en']){const r=validateRequest({...valid,language});assert.equal(r.valid,true);assert.equal(r.value.forecastValue,1200.5)}assert.equal(validateRequest({...valid,forecastValue:'',estimatedJobs:''}).value.forecastValue,null)});
test('intake rejects missing consent, bad email, invalid numbers and unknown areas',()=>{for(const change of [{privacyAccepted:false},{email:'bad'},{message:'short'},{businessAreaId:'other'},{estimatedJobs:2.5},{forecastValue:-1},{website:'spam'},{name:'x'.repeat(161)},{language:'xx'},{kind:'licensing'}])assert.equal(validateRequest({...valid,...change}).valid,false,JSON.stringify(change))});
test('all nine area maps and previews exist locally',()=>{const data=JSON.parse(fs.readFileSync(new URL('areas/data.json',base)));assert.deepEqual(data.areas.map(a=>a.id),areaIds);for(const a of data.areas){assert.ok(fs.existsSync(new URL(a.pdf,base)));assert.ok(fs.existsSync(new URL(a.image,base)));assert.equal(a.availability,null)}});
test('all separate PT and EN publications and packages remain available',()=>{for(const id of ['guide-pt','guide','facts-pt','facts-en','assets-pt','assets-en','industrial-pt','industrial-en','sectors-pt','sectors-en','pitch','pitch-en','welcome-pt','welcome-en','dossier-pt','dossier-en'])assert.ok(fs.existsSync(new URL(`investor-guide/assets/${id}/document.pdf`,base)),id);for(const lang of ['pt','en'])assert.ok(fs.existsSync(new URL(`investor-guide/assets/dossier-${lang}/Kit_Caldas_${lang.toUpperCase()}.zip`,base)))});
test('public configuration exposes only an anonymous key and restricts connections',async()=>{const {default:config}=await import('../municipios/caldas-da-rainha/public-config.js');if(config.key.startsWith('sb_'))assert.match(config.key,/^sb_publishable_[A-Za-z0-9_-]+$/);else assert.equal(JSON.parse(Buffer.from(config.key.split('.')[1],'base64url')).role,'anon');assert.ok(!/sb_secret_|service_role/.test(fs.readFileSync(new URL('public-config.js',base),'utf8')));const html=fs.readFileSync(new URL('index.html',base),'utf8');assert.ok(html.includes("form-action 'none'"));assert.ok(html.includes("object-src 'none'"));assert.ok(!fs.readFileSync(new URL('investor-portal.js',base),'utf8').includes('localStorage'))});
test('guide leads the page in both languages and reconciliation note is removed',()=>{const source=fs.readFileSync(new URL('investor-portal.js',base),'utf8');const body=source.slice(source.indexOf('const body=()=>'));assert.match(source,/root\.innerHTML=hero\(t,\{esc,url,size\}\)\+nav\(t\)\+\(data\?body\(\)/);assert.ok(body.indexOf('${library()}')<body.indexOf('id="areas"'));assert.ok(body.indexOf('id="areas"')<body.indexOf('${form()}'));assert.ok(fs.readFileSync(new URL('portal-shell.js',base),'utf8').includes("t('Guia do Investidor','Investor Guide')"));assert.ok(!source.includes('Não são apresentados totais'));assert.ok(!source.includes('Totals and growth rates are not shown'));assert.ok(source.includes("v==null?t('Por confirmar','Unconfirmed')"));});
// The static first screen must be exactly what the module renders in Portuguese: no jump, no changing H1.
const read=p=>fs.readFileSync(new URL(p,base),'utf8');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pt=pt=>pt,text=h=>h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
test('static first screen equals the Portuguese render (header, hero, H1, section links)',()=>{
 const html=read('index.html'),data=JSON.parse(read('areas/data.json'));
 const size=p=>{const b=data.downloads[p];return new Intl.NumberFormat('pt-PT',{maximumFractionDigits:1}).format(b/1e6)+' MB'};
 const first=hero(pt,{esc,url:p=>p,size}),links=nav(pt);
 assert.ok(html.includes(`<header>${header(pt,{lang:'pt',esc,team:tenant.teamUrl})}</header>`),'header');
 assert.ok(html.includes(first),'hero');assert.ok(html.includes(links),'nav');
 assert.ok(html.indexOf(first)<html.indexOf(links));assert.match(html,/<main id="conteudo" data-static="pt">\s*<section class="portal-hero/);
 const h1=html.match(/<h1[^>]*>(.*?)<\/h1>/)[1];assert.equal(h1,first.match(/<h1[^>]*>(.*?)<\/h1>/)[1]);assert.equal(text(h1),'O seu próximo projeto. Em Caldas da Rainha.');
 assert.equal((html.match(/<h1/g)||[]).length,1);assert.match(text(first),/Descarregar PDF · 6,3 MB/);
 // English differs only by language; without sizes the shell still renders (before data.json arrives).
 assert.match(hero((p,e)=>e,{esc,url:p=>p,size:()=>''}),/Your next venture\.<br><span>In Caldas da Rainha\.<\/span>[\s\S]*Download PDF<\/a>/);
 assert.match(read('investor-portal.js'),/^render\(\);\n(?:\/\/.*\n)?dataReady\.then\(/m);
});
test('index.html preloads the whole module graph and data.json with the current version, without inline scripts',()=>{
 const html=read('index.html'),v=html.match(/<script type="module" src="investor-portal\.js\?v=(\d{8})"><\/script>/)[1];
 const graph=new Set(),walk=f=>{if(graph.has(f))return;graph.add(f);for(const [,spec,ver] of read(f).matchAll(/from '\.\/([^'?]+)\?v=(\d{8})'/g)){assert.equal(ver,v,`${f}: ${spec}`);walk(spec)}};walk('investor-portal.js');
 const preloaded=[...html.matchAll(/<link rel="modulepreload" href="([^"?]+)\?v=(\d{8})">/g)];
 assert.deepEqual(new Set(preloaded.map(m=>m[1])),graph);for(const m of preloaded)assert.equal(m[2],v,m[1]);
 assert.match(html,/<link rel="preload" href="areas\/data\.json" as="fetch" crossorigin>/);
 for(const css of ['investor-portal.css','spaces.css'])assert.match(html,new RegExp(`${css.replace('.','\\.')}\\?v=${v}`));
 assert.doesNotMatch(html,/<script(?![^>]*\ssrc=)[^>]*>/);assert.match(html,/script-src 'self';/);
});
test('small covers use thumbnails with srcset and fixed dimensions; area maps offer WebP with PNG fallback',()=>{
 const shell=read('portal-shell.js'),js=read('investor-portal.js'),data=JSON.parse(read('areas/data.json'));
 for(const src of [shell,js]){assert.match(src,/srcset="[^"]*-thumb\.webp[^"]*220w, [^"]*-440\.webp[^"]*440w" sizes="[^"]+" width="440" height="570" alt="\$\{t\(/)}
 assert.match(js,/<img loading="lazy" decoding="async" src="\$\{esc\(url\(`investor-guide/);assert.doesNotMatch(shell+js,/01\.webp/);
 assert.match(js,/<picture><source type="image\/webp" srcset="\$\{esc\(url\(a\.image\.replace\(\/\\\.png\$\/,'\.webp'\)\)\)\}"><img loading="lazy" decoding="async" src="\$\{esc\(url\(a\.image\)\)\}"/);
 for(const doc of ['guide-pt','guide']){const b=fs.readFileSync(new URL(`investor-guide/assets/${doc}/01-440.webp`,base));assert.equal(b.subarray(8,12).toString(),'WEBP')}
 for(const a of data.areas){const png=fs.readFileSync(new URL(a.image,base)),webp=fs.readFileSync(new URL(a.image.replace(/\.png$/,'.webp'),base));
  assert.equal(webp.subarray(0,4).toString()+webp.subarray(8,12).toString(),'RIFFWEBP',a.image);assert.ok(webp.length<png.length,a.image);
  assert.deepEqual(a.imageSize,[png.readUInt32BE(16),png.readUInt32BE(20)],a.image)}
 assert.match(read('investor-portal.css'),/\.library-layout>img,\.area-detail img\{height:auto\}/);
});
