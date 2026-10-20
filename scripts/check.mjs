import {readFile,readdir,stat} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {loadListings} from '../src/data.ts';
const listings=await loadListings(),ids=new Set();
for(const l of listings){assert(!ids.has(l.id),`Duplicate ${l.id}`);ids.add(l.id);assert(l.sourceUrls.length,`Missing source: ${l.name}`);assert(l.sourceCheckedAt,`Missing checked date: ${l.name}`);assert(l.sourceStatus==='source-listed');assert(l.description&&l.description.length<600);for(const u of [...l.sourceUrls,l.website].filter(Boolean)){assert(['https:','http:'].includes(new URL(u).protocol),`Unsafe URL ${u}`);}if(l.latitude!=null){assert(l.latitude>40&&l.latitude<46);assert(l.longitude>-115&&l.longitude<-108);}}
assert.equal(listings.filter(l=>l.trail).length,31,'All source hiking records must survive merging');
async function walk(dir){const results=[];for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())results.push(...await walk(p));else results.push(p);}return results;}
const files=await walk('dist'),htmlFiles=files.filter(f=>f.endsWith('.html'));let checked=0;const missing=new Set();
for(const file of htmlFiles){const html=await readFile(file,'utf8');assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${file}: one H1`);assert(/<link rel="canonical"/.test(html));assert(/<meta name="description"/.test(html));for(const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(match[1]);for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){const path=match[1];if(path.startsWith('/api/'))continue;const target=join('dist',path.endsWith('/')?path+'index.html':path);try{await stat(target);}catch{missing.add(target);}checked++;}}
assert.equal(missing.size,0,'Missing local links/assets: '+[...missing].join(', '));
// Share crawlers read server HTML without running the client script.
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const socialImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
  assert(socialImage?.startsWith('https://'), `${file}: absolute HTTPS social image`);
  assert(html.includes('<meta property="og:image:width" content="1200"'));
  assert(html.includes('<meta property="og:image:height" content="630"'));
  assert(html.includes(`<meta name="twitter:image" content="${socialImage}"`));
  assert(/<meta name="twitter:description" content="[^"]+"/.test(html));
  await stat(join('dist', new URL(socialImage).pathname));
}
const appFiles=files.filter(f=>f.startsWith('dist/_astro/')&&f.endsWith('.js'));
assert(appFiles.length>0,'Astro must emit the client script as an external file for CSP');
// Budget the scripts each page actually loads; page-specific scripts (webcams, pass, live) never load together.
const scriptBytes=new Map(await Promise.all(appFiles.map(async f=>[f.slice(4),gzipSync(await readFile(f)).length])));
// Shared chunks (form-service, pass-status) load via static imports: follow `from"./x.js"` and `import"./x.js"`, never dynamic `import("./x.js")`.
async function scriptGraph(src,seen){if(seen.has(src))return;seen.add(src);for(const m of(await readFile('dist'+src,'utf8')).matchAll(/(?:\bfrom|\bimport)\s*["'](\.[^"']+\.js)["']/g))await scriptGraph(new URL(m[1],'http://x'+src).pathname,seen);}
let appBytes=0,heaviest='';
for(const file of htmlFiles){const seen=new Set();for(const src of new Set((await readFile(file,'utf8')).match(/\/_astro\/[^"]+\.js/g)||[]))await scriptGraph(src,seen);const bytes=[...seen].reduce((sum,src)=>sum+(scriptBytes.get(src)||0),0);if(bytes>appBytes){appBytes=bytes;heaviest=file;}}
const cssBytes=gzipSync(await readFile('dist/assets/styles.css')).length;
assert(appBytes<9000,`Client script too large on ${heaviest}: ${appBytes}`);assert(cssBytes<12000,`CSS too large: ${cssBytes}`);
console.log(`Verified ${htmlFiles.length} HTML pages, ${checked} internal references, ${listings.length} unique records, 31 trails and structured data.`);
console.log(`Compressed payload: heaviest page JS ${appBytes.toLocaleString()} bytes (${heaviest.slice(5)}) + CSS ${cssBytes.toLocaleString()} bytes. Maps load on demand.`);
