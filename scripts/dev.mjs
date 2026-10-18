import {createServer} from 'node:http';
import {readFile,mkdir,stat} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {adaptDb} from './sqlite-adapter.mjs';
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
const {handleApi}=await import('../src/worker.mjs');
await mkdir('.local',{recursive:true});
const database=new DatabaseSync('.local/submissions.sqlite');
database.exec(await readFile('migrations/0001_submissions.sql','utf8'));
const port=Number(process.env.PORT||4321),origin=`http://localhost:${port}`,root=resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain; charset=utf-8','.png':'image/png'};
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    if(url.pathname.startsWith('/api/')){
      const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:req,duplex:'half'})});
      const response=await handleApi(request,{DB:adaptDb(database),LOCAL_PREVIEW:true,SITE_URL:origin});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let path=resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!path.startsWith(root+'/')&&path!==root){res.writeHead(403);res.end();return;}
    try{const info=await stat(path);if(info.isDirectory())path=join(path,'index.html');await stat(path);}catch{path=join(root,'404.html');res.statusCode=404;}
    res.setHeader('Content-Type',mime[extname(path)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
    if(req.method==='HEAD'){res.end();return;}res.end(await readFile(path));
  }catch(error){console.error(error.message);res.writeHead(500);res.end('Preview error');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: ${origin}\nLocal preview saves test submissions to .local/submissions.sqlite. Rebuild with npm run build after edits.`));
