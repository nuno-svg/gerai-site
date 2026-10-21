// Classic worker (no imports): mirrors powPrefix/hexHasPrefix in intake-model.js; tests run both.
self.onmessage=async({data})=>{
 const encoder=new TextEncoder();
 const prefix=typeof data?.prefix==='string'&&/^0{4,6}$/.test(data.prefix)?data.prefix:'0000';
 const zero=(h,n)=>{for(let k=0;k<n;k++)if((k&1?h[k>>1]&15:h[k>>1]>>4)!==0)return false;return true};
 try{for(let i=0,max=16**prefix.length*64;i<max;i++){
  const h=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`${data.signature}:${i}`)));
  if(zero(h,prefix.length)){self.postMessage({solution:String(i)});return}
 }self.postMessage({error:true})}catch{self.postMessage({error:true})}
};
