import {encodePropertyInterest} from './property-interest.js';
import tenant from './tenant-config.js';
export const areaIds=['cidade','tornada','santa-cecilia','sao-gregorio-i','sao-gregorio-ii','santa-catarina','zambujeiro','mouraria','casal-do-rei'];
export function validateRequest(raw) {
 const errors=[]; const limits={name:160,email:254,organisation:160,country:160,sector:160,title:200,message:4000,spaceNeeds:600,timeline:160,businessAreaId:40};
 const value={municipalityId:tenant.id,kind:raw.kind,language:raw.language,privacyAccepted:raw.privacyAccepted===true,website:raw.website||''};
 for(const [k,max] of Object.entries(limits)){value[k]=typeof raw[k]==='string'?raw[k].trim():'';if(value[k].length>max)errors.push(k)}
 for(const [k,min] of [['name',2],['country',2],['title',3],['message',10]])if(value[k].length<min)errors.push(k);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))errors.push('email');
 if(!['information','project'].includes(value.kind))errors.push('kind');
 if(!['pt','en'].includes(value.language))errors.push('language');
 if(value.businessAreaId&&!areaIds.includes(value.businessAreaId))errors.push('businessAreaId');
 if(!value.privacyAccepted)errors.push('privacyAccepted');
 if(value.website)errors.push('website');
 for(const [k,max] of [['forecastValue',90071992547409.91],['estimatedJobs',1000000]]){
  const input=raw[k]; const n=input==null||input===''?null:Number(String(input).replace(',','.'));
  value[k]=n;
  if(n!==null&&(!Number.isFinite(n)||n<0||n>max||(k==='estimatedJobs'?!Number.isInteger(n):Math.abs(n*100-Math.round(n*100))>0.001)))errors.push(k);
 }
 if(raw.propertySource){try{value.spaceNeeds=encodePropertyInterest(raw.propertySource,value.spaceNeeds)}catch{errors.push('spaceNeeds')}}
 return {valid:errors.length===0,errors:[...new Set(errors)],value};
}
