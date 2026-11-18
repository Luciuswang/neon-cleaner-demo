import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runtimeHashes} from './source-binding.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sources=await runtimeHashes();
let checked=0,publicBytes=0;
for(const name of ['daylight-assets.json','afterrain-assets.json']){
 const m=JSON.parse(await readFile(resolve(root,name),'utf8'));assert.equal(m.license,'CC0-1.0');
 for(const f of [...m.files||[],...(m.assets||[]).flatMap(a=>a.files)]){
  const path=f.file||f.path,b=await readFile(resolve(root,path)),sha=createHash('sha256').update(b).digest('hex');
  assert.equal(b.length,f.bytes,path);assert.equal(sha,f.sha256,path);assert.equal(sources[path],sha,'Evidence must bind bytes: '+path);
  publicBytes+=b.length;checked++;
 }
 for(const a of m.assets||[])for(const f of a.sourceFiles){
  const b=await readFile(resolve(root,f.path));assert.equal(b.length,f.bytes);assert.equal(createHash('md5').update(b).digest('hex'),f.officialMD5);checked++;
 }
}
assert.ok(publicBytes<15e6);assert.ok(Object.keys(sources).some(n=>n.endsWith('.hdr')));
console.log({pass:true,checked,publicBytes,scope:'Official source integrity, derivatives and current-byte evidence binding; not visual acceptance'});
