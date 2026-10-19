import {listingIds} from './listing-ids.mjs';
import {deliverNotifications} from './lib/form-notifications.ts';
import {parseWebcams,webcamFeedUrl} from './lib/webcams.ts';
import {parsePassStatus,parsePassHistory,passStatusUrl,passHistoryUrl,passRouteSlug} from './lib/pass.ts';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const maxBody=16000;
export function validateSubmission(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return 'Invalid request.';
  if(!['addition','correction','contact'].includes(body.type))return 'Choose a valid request type.';
  const fields={name:[1,100],email:[3,254],message:[20,4000],placeName:[0,160],town:[0,30],website:[0,500],listingId:[0,180],companyUrl:[0,500],turnstileToken:[0,2048]};
  for(const [key,[min,max]] of Object.entries(fields)){
    const value=body[key]??'';if(typeof value!=='string'||value.trim().length<min||value.length>max)return `Please check the ${key.replace(/([A-Z])/g,' $1').toLowerCase()} field.`;
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return 'Enter a valid email address.';
  if(body.consent!=='yes')return 'Please agree to the privacy notice.';
  if(body.type==='addition'&&!body.placeName?.trim())return 'Enter the place or business name.';
  if(body.type==='correction'&&!listingIds.has(body.listingId))return 'Select an existing listing.';
  if(body.town&&!['Victor','Driggs','Teton Valley','Nearby'].includes(body.town))return 'Choose a valid area.';
  if(body.website){try{const u=new URL(body.website);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return 'Enter a public HTTP or HTTPS website URL.';}catch{return 'Enter a valid website URL.';}}
  return null;
}
async function readBoundedJson(request){
  if(Number(request.headers.get('content-length'))>maxBody)throw new Error('too-large');
  const reader=request.body?.getReader();if(!reader)throw new Error('invalid-json');let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBody){await reader.cancel();throw new Error('too-large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('invalid-json');}
}
// The feed's CORS policy only admits the production origin, so every environment reads it through the Worker.
async function webcams(){
  try{
    const response=await fetch(webcamFeedUrl,{cf:{cacheTtl:60,cacheEverything:true},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('upstream');
    const cameras=parseWebcams(await response.json());
    if(!cameras.length)throw new Error('empty');
    return new Response(JSON.stringify({cameras}),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
  }catch{return json({error:'Webcams are temporarily unavailable.'},503);}
}
// tetonpasscam.com sends no CORS headers, so the page reads its public API through this Worker.
async function passApi(url,parse,ttl){
  try{
    const response=await fetch(url,{cf:{cacheTtl:ttl,cacheEverything:true},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('upstream');
    return new Response(JSON.stringify(parse(await response.json())),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':`public, max-age=${ttl}`,'X-Content-Type-Options':'nosniff'}});
  }catch{return json({error:'Teton Pass data is temporarily unavailable.'},503);}
}
export async function handleApi(request,env,ctx){
  const url=new URL(request.url),local=env.LOCAL_PREVIEW===true;
  const enabled=!!(env.DB&&(local||env.TURNSTILE_SECRET&&env.TURNSTILE_SITE_KEY));
  if(url.pathname==='/api/config'&&request.method==='GET')return json({enabled,siteKey:env.TURNSTILE_SITE_KEY||'',mode:local?'local-preview':env.ENVIRONMENT==='development'?'development':'production'});
  if(url.pathname==='/api/webcams'&&request.method==='GET')return webcams();
  if(url.pathname==='/api/pass'&&request.method==='GET')return passApi(passStatusUrl,parsePassStatus,60);
  if(url.pathname==='/api/pass-history'&&request.method==='GET'){
    const slug=url.searchParams.get('route')||'';
    if(!passRouteSlug.test(slug))return json({error:'Unknown route.'},400);
    return passApi(passHistoryUrl(slug),data=>parsePassHistory(data,slug),300);
  }
  if(url.pathname!=='/api/submissions')return json({error:'Not found.'},404);
  if(request.method!=='POST')return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
  const allowedOrigin=env.SITE_URL||'https://tetoncounty.us';
  if(request.headers.get('origin')!==allowedOrigin)return json({error:'Submit this request from the guide website.'},403);
  if(!enabled)return json({error:'The submission service is not configured yet. Please try again after launch.'},503);
  if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return json({error:'Send a JSON request.'},415);
  let body;try{body=await readBoundedJson(request);}catch(error){return json({error:error.message==='too-large'?'This request is too large.':'Invalid request body.'},error.message==='too-large'?413:400);}
  const validation=validateSubmission(body);if(validation)return json({error:validation},400);
  if(body.companyUrl)return json({error:'Unable to accept this request.'},400);
  if(!local){
    if(!body.turnstileToken)return json({error:'Complete the verification before submitting.'},400);
    try{
      const verification=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:body.turnstileToken,...(request.headers.get('CF-Connecting-IP')?{remoteip:request.headers.get('CF-Connecting-IP')}: {})}),signal:AbortSignal.timeout(8000)});
      if(!verification.ok)return json({error:'Verification is temporarily unavailable. Please try again.'},503);
      const result=await verification.json();
      if(!result.success||result.hostname!==new URL(allowedOrigin).hostname||result.action!=='suggest')return json({error:'Verification expired or failed. Please try again.'},400);
    }catch{return json({error:'Verification is temporarily unavailable. Please try again.'},503);}
  }
  try{
    const now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'local';
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${env.TURNSTILE_SECRET||'local'}|${Math.floor(now/3600000)}|${ip}`));
    const bucket=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const limit=await env.DB.prepare('INSERT INTO submission_rate_limits (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 RETURNING count').bind(bucket,now+86400000).first();
    if(limit.count>5)return json({error:'Too many requests. Please try again in an hour.'},429);
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO submissions (id, type, listing_id, name, email, place_name, town, website, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id,body.type,body.type==='correction'?body.listingId:null,body.name.trim(),body.email.trim(),body.type==='addition'?body.placeName.trim():'',body.type==='addition'?(body.town||''):'',body.type==='addition'?(body.website?.trim()||''):'',body.message.trim(),new Date(now).toISOString()).run();
    // Contact details stay out of logs and public exports. Formspree delivers private notifications.
    // Cleanup failure must never turn an already-saved request into a failed response.
    try {await env.DB.prepare('DELETE FROM submission_rate_limits WHERE expires_at < ?').bind(now).run();} catch {}
    if(!local&&env.ENVIRONMENT!=='development'&&env.FORMSPREE_FORM_ID){
      const delivery=deliverNotifications(env,{submissionId:id,limit:1}).catch(()=>console.error('Submission notification deferred; the saved request remains in D1.'));
      if(ctx?.waitUntil)ctx.waitUntil(delivery);else await delivery;
    }
    return json({ok:true,id},201);
  }catch{return json({error:'Your request could not be saved. Please try again.'},503);}
}
export default {
  async fetch(request,env,ctx){if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env,ctx);return env.ASSETS.fetch(request);},
  async scheduled(_event,env){await deliverNotifications(env);},
};
