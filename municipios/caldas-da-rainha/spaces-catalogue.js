import {safePropertyUrl} from './property-interest.js?v=20261022';
const clean=(s,n=240)=>typeof s==='string'?s.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n):'';
const num=n=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:null;
const fold=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const outcome=s=>['failed','error'].includes(s)?'failed':['success','ok','confirmed','unchanged','changed','updated'].includes(s)?'ok':null;
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
export function readCatalogue(snapshot,tenant,now=Date.now()){
 if(snapshot?.municipalityId!==tenant.id||snapshot?.sourceUrl!==tenant.catalogueSource||!Array.isArray(snapshot.listings))throw Error('Invalid catalogue');
 const rows=new Map();
 for(const r of snapshot.listings){
  const sourceUrl=safePropertyUrl(r.sourceUrl);
  if(!sourceUrl||r.active===false||r.active===0||fold(clean(r.municipality))!==fold(tenant.name))continue;
  const confirmed=date(r.lastConfirmedAt),attempt=date(r.lastAttemptAt);
  const recent=r.verificationStatus==='recent'&&confirmed&&Date.parse(confirmed)<=now&&now-Date.parse(confirmed)<=7*86400000&&!(r.lastAttemptOutcome==='failed'&&attempt&&Date.parse(attempt)>Date.parse(confirmed));
  if(!rows.has(sourceUrl))rows.set(sourceUrl,{sourceUrl,title:clean(r.title),type:clean(r.functionType,100),transaction:clean(r.transactionType,100),parish:clean(r.parish,180),area:num(r.areaSqm),price:num(r.priceEur),source:clean(r.sourceName,120),confirmed,checkedAt:attempt,checkOutcome:outcome(r.lastAttemptOutcome),recent:!!recent});
 }
 return {items:[...rows.values()],retrievedAt:date(snapshot.retrievedAt),partial:true};
}
// Deep links may name a property; only an exact catalogue listing (ignoring a trailing slash) is accepted.
export function findCatalogueProperty(items,raw){
 const url=typeof raw==='string'?safePropertyUrl(raw.trim()):null;if(!url||!Array.isArray(items))return null;
 const key=u=>u.replace(/\/+$/,'');return items.find(r=>key(r.sourceUrl)===key(url))||null;
}
export function filterSpaces(items,{query='',type='',transaction=''}={}){
 return items.filter(r=>(!type||r.type===type)&&(!transaction||r.transaction===transaction)&&(!query||fold([r.title,r.parish,r.type].join(' ')).includes(fold(query))));
}
const labels={'Comércio':['Comércio','Retail'],'Serviços':['Serviços','Services'],'Indústria':['Indústria','Industry'],'Industrial':['Industrial','Industrial'],'Armazém':['Armazém','Warehouse'],'Armazéns':['Armazéns','Warehouses'],'Logística':['Logística','Logistics'],'Terreno':['Terreno','Land'],'Terrenos':['Terrenos','Land'],'Outros':['Outros','Other'],'Venda':['Venda','Sale'],'Arrendamento':['Arrendamento','Rent'],'Trespasse':['Trespasse','Business transfer']};
export const spaceLabel=(v,lang)=>labels[v]?.[lang==='en'?1:0]||v;
