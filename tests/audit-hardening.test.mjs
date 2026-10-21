import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {validateRequest,powPrefix,hexHasPrefix,parseNumber,textBudget} from '../municipios/caldas-da-rainha/intake-model.js';
import {readCatalogue,findCatalogueProperty} from '../municipios/caldas-da-rainha/spaces-catalogue.js';
import {propertyNeedsLimit,encodePropertyInterest} from '../municipios/caldas-da-rainha/property-interest.js';
import tenant from '../municipios/caldas-da-rainha/tenant-config.js';
const base=new URL('../municipios/caldas-da-rainha/',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,base),'utf8');
const valid={kind:'project',language:'pt',name:'Test User',email:'test@example.invalid',country:'Portugal',title:'Test project',message:'A request with sufficient detail.',privacyAccepted:true};
const sourceUrl='https://www.idealista.pt/imovel/123/';
function runWorker(challenge){return new Promise((resolve,reject)=>{const self={postMessage:resolve};runInNewContext(read('intake-worker.js'),{self,crypto:webcrypto,TextEncoder});self.onmessage({data:challenge}).catch(reject)})}
test('proof-of-work prefix comes from the server, with a safe fallback',()=>{
 assert.equal(powPrefix({prefix:'00000'}),'00000');assert.equal(powPrefix({prefix:'000000'}),'000000');
 for(const prefix of [undefined,'','000','0000000','ffff','00a0',7])assert.equal(powPrefix({prefix}),'0000',String(prefix));
 assert.equal(powPrefix(null),'0000');
 const hash=s=>new Uint8Array(createHash('sha256').update(s).digest());
 for(let i=0;i<20000;i++){const h=hash(`sig:${i}`),hex=Buffer.from(h).toString('hex');for(const p of ['0000','00000'])assert.equal(hexHasPrefix(h,p),hex.startsWith(p))}
 assert.equal(hexHasPrefix(Uint8Array.from([0,0,0x0f]),'00000'),true);assert.equal(hexHasPrefix(Uint8Array.from([0,0,0x10]),'00000'),false);
});
test('worker solves for the challenge prefix and falls back to 0000',async()=>{
 for(const prefix of ['0000','zz']){const signature=`test-signature-${prefix}`;const {solution}=await runWorker({nonce:'n',expires:'e',signature,prefix,version:1});
  assert.match(solution,/^\d+$/);assert.ok(createHash('sha256').update(`${signature}:${solution}`).digest('hex').startsWith('0000'))}
});
test('blank numbers stay empty and comma decimals are accepted',()=>{
 for(const blank of ['',' ',' ',null,undefined])assert.equal(parseNumber(blank),null);
 assert.equal(parseNumber('1200,5'),1200.5);assert.equal(parseNumber('1 250 000,50'),1250000.5);assert.equal(parseNumber('12.25'),12.25);
 assert.ok(Number.isNaN(parseNumber('1.200')));assert.ok(Number.isNaN(parseNumber('1e3')));assert.ok(Number.isNaN(parseNumber('-1')));assert.ok(Number.isNaN(parseNumber('2.5',{integer:true})));
 let r=validateRequest({...valid,forecastValue:' ',estimatedJobs:'  '});assert.equal(r.valid,true);assert.equal(r.value.forecastValue,null);assert.equal(r.value.estimatedJobs,null);
 r=validateRequest({...valid,forecastValue:'250000,50',estimatedJobs:'12'});assert.equal(r.valid,true);assert.equal(r.value.forecastValue,250000.5);assert.equal(r.value.estimatedJobs,12);
 r=validateRequest({...valid,forecastValue:'12,345'});assert.equal(r.valid,false);assert.equal(r.reasons.forecastValue,'format');
});
test('validation reports a reason per field for specific messages',()=>{
 const r=validateRequest({...valid,name:'',email:'bad',message:'short',title:'x'.repeat(201),privacyAccepted:false});
 assert.deepEqual({name:r.reasons.name,email:r.reasons.email,message:r.reasons.message,title:r.reasons.title,privacy:r.reasons.privacyAccepted},{name:'required',email:'format',message:'short',title:'long',privacy:'required'});
});
test('character budgets account for an attached property',()=>{
 assert.deepEqual(textBudget('message','abc'),{used:3,limit:4000,remaining:3997,propertyChars:0,over:false});
 const limit=propertyNeedsLimit(sourceUrl),b=textBudget('spaceNeeds','x'.repeat(limit+1),sourceUrl);
 assert.equal(b.limit,limit);assert.equal(b.propertyChars,encodePropertyInterest(sourceUrl).length);assert.equal(b.propertyChars+b.limit,600);assert.equal(b.over,true);assert.equal(b.remaining,-1);
 const r=validateRequest({...valid,propertySource:sourceUrl,spaceNeeds:'x'.repeat(limit+1)});assert.equal(r.valid,false);assert.equal(r.reasons.spaceNeeds,'long');
 assert.equal(validateRequest({...valid,propertySource:sourceUrl,spaceNeeds:'x'.repeat(limit)}).valid,true);
});
test('deep-linked property is accepted only when it is in the loaded catalogue',()=>{
 const row={sourceUrl,municipality:'Caldas da Rainha',title:'Loja',lastConfirmedAt:'2026-10-01T00:00:00Z',lastAttemptAt:'2026-10-20T00:00:00Z',lastAttemptOutcome:'failed'};
 const {items}=readCatalogue({municipalityId:tenant.id,sourceUrl:tenant.catalogueSource,listings:[row,{...row,sourceUrl:'https://www.idealista.pt/imovel/999/',municipality:'Lisboa'}]},tenant);
 assert.equal(findCatalogueProperty(items,sourceUrl)?.sourceUrl,sourceUrl);
 assert.equal(findCatalogueProperty(items,sourceUrl.slice(0,-1))?.sourceUrl,sourceUrl);
 for(const u of ['https://www.idealista.pt/imovel/999/','https://www.idealista.pt/imovel/1234/','javascript:alert(1)','"><img src=x onerror=alert(1)>','',null])assert.equal(findCatalogueProperty(items,u),null,String(u));
 assert.equal(items[0].checkedAt,'2026-10-20T00:00:00.000Z');assert.equal(items[0].checkOutcome,'failed');
 const source=read('investor-portal.js');
 assert.match(source,/findCatalogueProperty\(catalogue\.items,pendingProperty\)/);assert.doesNotMatch(source,/\$\{[^}]*pendingProperty/);
});
test('challenges are requested only on submit, retried once and never pre-fetched',()=>{
 const source=read('investor-portal.js');
 assert.equal(source.match(/municipal_intake_challenge/g).length,1);assert.doesNotMatch(source,/checkConnection/);
 const send=source.slice(source.indexOf('async function send('),source.indexOf('async function submit('));
 assert.match(send,/municipal_intake_challenge/);assert.match(send,/attempt===0&&challengeRejected\(error\)/);
 assert.match(source,/code==='22023'/);assert.match(source,/P0429/);assert.match(source,/3 pedidos por email/);assert.match(source,/Tentar novamente/);
 assert.match(source,/<form id="investor-request" novalidate>/);
});
test('module imports and entry script share one cache-busting version',()=>{
 const versions=new Set();
 for(const f of ['investor-portal.js','intake-model.js','spaces-catalogue.js'])for(const [,spec] of read(f).matchAll(/from '(\.[^']+)'/g)){const m=spec.match(/\.js\?v=(\d{8})$/);assert.ok(m,`${f}: ${spec}`);versions.add(m[1])}
 const html=read('index.html');const entry=html.match(/<script type="module" src="investor-portal\.js\?v=(\d{8})"><\/script>/);assert.ok(entry);versions.add(entry[1]);
 assert.match(read('investor-portal.js'),new RegExp(`intake-worker\\.js\\?v=${entry[1]}`));
 assert.equal(versions.size,1);
});
test('download sizes in data.json match the published files',()=>{
 const data=JSON.parse(read('areas/data.json'));assert.ok(data.reviewedAt);
 for(const [p,bytes] of Object.entries(data.downloads))assert.equal(fs.statSync(new URL(p,base)).size,bytes,p);
 for(const a of data.areas)assert.ok(data.downloads[a.pdf],a.pdf);
 assert.doesNotMatch(read('investor-portal.js'),/19\/10\/2026/);
});
test('public pages carry a restrictive CSP and the internal PTO dashboard is no longer published',()=>{
 for(const p of ['../municipios/index.html','../legal.html']){const html=fs.readFileSync(new URL(p,import.meta.url),'utf8');for(const d of ["script-src 'self'","object-src 'none'","base-uri 'none'","form-action 'none'","connect-src 'none'"])assert.ok(html.includes(d),`${p}: ${d}`)}
 // Material interno de um cliente (dados financeiros por empresa): não pode voltar ao site público.
 assert.ok(!fs.existsSync(new URL('../dashboard-pto.html',import.meta.url)));
});
test('reader starts in Portuguese, links back to the enquiry and leaves Home/End to text mode',()=>{
 const html=read('investor-guide/index.html'),js=read('investor-guide/reader.js');
 assert.match(html,/<html lang="pt-PT">/);assert.match(html,/<title>Caldas da Rainha · Biblioteca do Investidor<\/title>/);assert.match(html,/href="\.\.\/#pedido">Quer falar sobre o seu projeto\?/);
 assert.match(js,/if\(textMode\)return;[^\n]*\n\s*if\(e\.key==='Home'\)/);assert.match(js,/setAttribute\('aria-modal', 'true'\)/);assert.match(js,/e\.key==='Escape'/);
});
