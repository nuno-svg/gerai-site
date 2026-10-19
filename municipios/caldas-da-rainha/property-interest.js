// Versioned, human-readable reference stored in the existing private space_needs
// field. The original inquiry remains the source of truth after conversion.
const PREFIX='[GERAI_SPACE_V1] ';
export function safePropertyUrl(value){
 try{const u=new URL(value);const h=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||h.endsWith('.')||h.includes(':')||/^\d+(\.\d+){3}$/.test(h)||/\.(local|localhost|internal|test|invalid)$/.test(h)||/[\r\n]/.test(value)||value.length>440)return null;
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
 if(!text.startsWith(PREFIX))return {sourceUrl:null,needs:text};
 const line=text.indexOf('\n');const sourceUrl=safePropertyUrl(text.slice(PREFIX.length,line<0?undefined:line));
 return sourceUrl?{sourceUrl,needs:line<0?'':text.slice(line+1)}:{sourceUrl:null,needs:text};
}
export const propertyNeedsLimit=sourceUrl=>600-encodePropertyInterest(sourceUrl).length;
