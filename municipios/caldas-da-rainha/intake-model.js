import {encodePropertyInterest,propertyNeedsLimit} from './property-interest.js?v=20261021';
import tenant from './tenant-config.js?v=20261021';
export const areaIds=['cidade','tornada','santa-cecilia','sao-gregorio-i','sao-gregorio-ii','santa-catarina','zambujeiro','mouraria','casal-do-rei'];
export const textLimits={name:160,email:254,organisation:160,country:160,sector:160,title:200,message:4000,spaceNeeds:600,timeline:160,businessAreaId:40};
const minimums={name:2,country:2,title:3,message:10};
// Proof-of-work difficulty is set by the server; anything unexpected falls back to the original 16 bits.
export const powPrefix=challenge=>typeof challenge?.prefix==='string'&&/^0{4,6}$/.test(challenge.prefix)?challenge.prefix:'0000';
export const hexHasPrefix=(bytes,prefix)=>{for(let k=0;k<prefix.length;k++){const b=bytes[k>>1];if((k&1?b&15:b>>4)!==parseInt(prefix[k],16))return false}return true};
// Blank (including whitespace) means "not supplied", never zero. Comma or point decimals; spaces between thousands.
export function parseNumber(input,{integer=false}={}){
 if(input==null)return null;const s=String(input).replace(/[\s  ]/g,'');if(s==='')return null;
 return (integer?/^\d+$/:/^\d+(?:[.,]\d{1,2})?$/).test(s)?Number(s.replace(',','.')):NaN;
}
// Characters used/remaining; an attached property reference shares the 600-character space field.
export function textBudget(field,value='',propertySource=null){
 const total=textLimits[field];let limit=total;
 if(field==='spaceNeeds'&&propertySource){try{limit=propertyNeedsLimit(propertySource)}catch{limit=total}}
 const used=String(value??'').trim().length;
 return {used,limit,remaining:limit-used,propertyChars:total-limit,over:used>limit};
}
export function validateRequest(raw) {
 const errors=[],reasons={};const fail=(k,r)=>{errors.push(k);reasons[k]??=r};
 const value={municipalityId:tenant.id,kind:raw.kind,language:raw.language,privacyAccepted:raw.privacyAccepted===true,website:raw.website||''};
 for(const [k,max] of Object.entries(textLimits)){value[k]=typeof raw[k]==='string'?raw[k].trim():'';if(value[k].length>max)fail(k,'long')}
 for(const [k,min] of Object.entries(minimums))if(value[k].length<min)fail(k,value[k]?'short':'required');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))fail('email',value.email?'format':'required');
 if(!['information','project'].includes(value.kind))fail('kind','required');
 if(!['pt','en'].includes(value.language))fail('language','format');
 if(value.businessAreaId&&!areaIds.includes(value.businessAreaId))fail('businessAreaId','format');
 if(!value.privacyAccepted)fail('privacyAccepted','required');
 if(value.website)fail('website','format');
 for(const [k,max] of [['forecastValue',90071992547409.91],['estimatedJobs',1000000]]){
  const n=parseNumber(raw[k],{integer:k==='estimatedJobs'});
  value[k]=n;
  if(n!==null&&(!Number.isFinite(n)||n<0||n>max||(k==='estimatedJobs'?!Number.isInteger(n):Math.abs(n*100-Math.round(n*100))>0.001)))fail(k,Number.isFinite(n)&&n>max?'range':'format');
 }
 if(raw.propertySource){try{value.spaceNeeds=encodePropertyInterest(raw.propertySource,value.spaceNeeds)}catch{fail('spaceNeeds',textBudget('spaceNeeds',value.spaceNeeds,raw.propertySource).over?'long':'property')}}
 return {valid:errors.length===0,errors:[...new Set(errors)],reasons,value};
}
