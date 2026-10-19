import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import tenant from '../municipios/caldas-da-rainha/tenant-config.js';
import {readCatalogue,filterSpaces,spaceLabel} from '../municipios/caldas-da-rainha/spaces-catalogue.js';
import {encodePropertyInterest,decodePropertyInterest,safePropertyUrl,propertyNeedsLimit} from '../municipios/caldas-da-rainha/property-interest.js';
import {validateRequest} from '../municipios/caldas-da-rainha/intake-model.js';
const sourceUrl='https://www.idealista.pt/imovel/123/';
const row={sourceUrl,municipality:'Caldas da Rainha',title:'Loja central',functionType:'Comércio',transactionType:'Venda',parish:'Centro',priceEur:0,areaSqm:40,verificationStatus:'recent',lastConfirmedAt:'2026-10-01T00:00:00Z',email:'private@example.invalid'};
const data={municipalityId:tenant.id,sourceUrl:tenant.catalogueSource,retrievedAt:'2026-10-19T12:00:00Z',listings:[row]};
test('property reference round trips through the existing server field without extra permissions',()=>{
 const raw=encodePropertyInterest(sourceUrl,'Need loading access');assert.deepEqual(decodePropertyInterest(raw),{sourceUrl,needs:'Need loading access'});
 assert.equal(encodePropertyInterest(sourceUrl,'a'.repeat(propertyNeedsLimit(sourceUrl))).length,600);
 assert.throws(()=>encodePropertyInterest(sourceUrl,'a'.repeat(601)));
});
test('unsafe URLs and malformed markers cannot become clickable references',()=>{
 for(const u of ['javascript:alert(1)','http://example.org/a','https://user:pass@example.org/','https://127.0.0.1/','https://[::1]/','https://a.internal/','https://example.org:8443/','https://example.org/a\nb'])assert.equal(safePropertyUrl(u),null,u);
 assert.equal(decodePropertyInterest('[GERAI_SPACE_V1] javascript:alert(1)').sourceUrl,null);
 assert.deepEqual(decodePropertyInterest('Historical needs'),{sourceUrl:null,needs:'Historical needs'});
});
test('both form languages retain the selected property',()=>{
 for(const language of ['pt','en']){
 const result=validateRequest({name:'Test User',email:'test@example.invalid',country:'Portugal',kind:'information',language,title:'A question',message:'This is a test enquiry.',privacyAccepted:true,propertySource:sourceUrl,spaceNeeds:'Loading access'});
 assert.equal(result.valid,true);assert.equal(decodePropertyInterest(result.value.spaceNeeds).sourceUrl,sourceUrl);
 }
});
test('catalogue excludes other municipalities, inactive listings, duplicates and private fields',()=>{
 const result=readCatalogue({...data,listings:[row,row,{...row,sourceUrl:sourceUrl+'2',municipality:'Lisboa'},{...row,sourceUrl:sourceUrl+'3',active:false}]},tenant);
 assert.equal(result.items.length,1);assert.equal(result.items[0].price,null);assert.equal(result.items[0].email,undefined);assert.equal(result.items[0].recent,false);
 assert.throws(()=>readCatalogue({...data,municipalityId:'other'},tenant));
});
test('filters and translations return real empty results',()=>{
 const {items}=readCatalogue(data,tenant);assert.equal(filterSpaces(items,{query:'central'}).length,1);assert.equal(filterSpaces(items,{type:'Indústria'}).length,0);
 assert.equal(spaceLabel('Comércio','en'),'Retail');assert.equal(spaceLabel('Arrendamento','en'),'Rent');
});
test('guide remains first, catalogue mounts before enquiry and email stays disabled',()=>{
 const source=fs.readFileSync(new URL('../municipios/caldas-da-rainha/investor-portal.js',import.meta.url),'utf8');
 assert.match(source,/querySelector\('#pedido'\)\.before\(section\)/);assert.match(source,/municipal_public_snapshots\?select=payload/);assert.match(source,/No automatic email has been sent/);assert.doesNotMatch(source,/api\/scrape/);
});
