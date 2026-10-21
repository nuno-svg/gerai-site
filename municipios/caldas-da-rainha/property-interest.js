// Versioned, human-readable reference stored in the existing private space_needs
// field. The original inquiry remains the source of truth after conversion.
// The server replaces the V1 prefix with UNVERIFIED when the URL is not in the
// published catalogue snapshot; that text is never presented as a selected listing.
const PREFIX='[GERAI_SPACE_V1] ';
const UNVERIFIED='[GERAI_SPACE_UNVERIFIED] ';
const MAX_URL=440;
// Private/non-public suffixes and wildcard-DNS services that resolve to arbitrary (incl. private) IPs.
const BLOCKED_SUFFIX=/(^|\.)(local|localhost|localdomain|internal|intranet|corp|lan|home|test|invalid|example|arpa|nip\.io|sslip\.io|xip\.io|localtest\.me|lvh\.me)$/;
const DOTTED_QUAD=/(^|\.)\d{1,3}(\.\d{1,3}){3}(\.|$)/;
export function safePropertyUrl(value){
 if(typeof value!=='string'||value.length>MAX_URL||/[\u0000-\u001f\u007f]/.test(value))return null;
 try{const u=new URL(value);const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||h.endsWith('.')||h.includes(':')||DOTTED_QUAD.test(h)||BLOCKED_SUFFIX.test(h)||u.href.length>MAX_URL)return null;
  return u.href;
 }catch{return null}
}
export function encodePropertyInterest(sourceUrl,needs=''){
 const url=safePropertyUrl(sourceUrl);if(!url)throw Error('Invalid property reference');
 const text=PREFIX+url+'\n'+needs;
 if(text.length>600)throw Error('Space requirements too long');
 return text;
}
export function decodePropertyInterest(text){
 if(typeof text!=='string')return {sourceUrl:null,needs:''};
 if(text.startsWith(UNVERIFIED)){
  const line=text.indexOf('\n');const raw=text.slice(UNVERIFIED.length,line<0?undefined:line).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,MAX_URL);
  return {sourceUrl:null,unverifiedUrl:raw||null,needs:line<0?'':text.slice(line+1)};
 }
 if(!text.startsWith(PREFIX))return {sourceUrl:null,needs:text};
 const line=text.indexOf('\n');const sourceUrl=safePropertyUrl(text.slice(PREFIX.length,line<0?undefined:line));
 return sourceUrl?{sourceUrl,needs:line<0?'':text.slice(line+1)}:{sourceUrl:null,needs:text};
}
export const propertyNeedsLimit=sourceUrl=>600-encodePropertyInterest(sourceUrl).length;
