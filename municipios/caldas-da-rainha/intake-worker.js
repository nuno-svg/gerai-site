self.onmessage=async({data})=>{
 const encoder=new TextEncoder();
 try{for(let i=0;i<2000000;i++){
  const h=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`${data.signature}:${i}`)));
  if(h[0]===0&&h[1]===0){self.postMessage({solution:String(i)});return}
 }self.postMessage({error:true})}catch{self.postMessage({error:true})}
};
