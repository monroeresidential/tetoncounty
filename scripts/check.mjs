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
const appBytes=(await Promise.all(appFiles.map(async f=>gzipSync(await readFile(f)).length))).reduce((a,b)=>a+b,0),cssBytes=gzipSync(await readFile('dist/assets/styles.css')).length;
assert(appBytes<9000,`Client script too large: ${appBytes}`);assert(cssBytes<12000,`CSS too large: ${cssBytes}`);
console.log(`Verified ${htmlFiles.length} HTML pages, ${checked} internal references, ${listings.length} unique records, 31 trails and structured data.`);
console.log(`Compressed core payload: JS ${appBytes.toLocaleString()} bytes + CSS ${cssBytes.toLocaleString()} bytes. Maps load on demand.`);
