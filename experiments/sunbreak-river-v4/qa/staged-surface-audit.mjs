// Byte identity audit. Review and upload acknowledgement remain independent.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..'),hash=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
const release=await read('qa/release.json');assert.equal(release.task,'sunbreak-river-surface-atmosphere-2026-11-19');
assert.ok(release.functional&&release.visualIntegrity&&release.pixelIntegrity&&release.reviewCurrent,'current functional/visual/pixel/review binding incomplete');
assert.ok(['PASS','CONDITIONAL PASS'].includes((await read(release.independentReview)).engineering.verdict),'engineering checkpoint not reviewed');
const items=new Map(Object.entries(release.sources));
for(const f of [...release.visuals,...Object.values(release.reports),...release.performance.storm,release.performance.sunny,...release.developmentEvidence]){
 assert.ok(f.path&&f.sha256,'missing frozen evidence');items.set(f.path,f.sha256);
 if(f.statePath)items.set(f.statePath,f.stateSHA256);
}
const manifest=await read('ground-surface-assets.json');items.set(manifest.preparation.script,manifest.preparation.sha256);
items.set('qa/release.json',hash(await readFile(resolve(root,'qa/release.json'))));
for(const [p,h]of Object.entries(release.companionHashes))items.set(p,h);
for(const [name,r]of Object.entries((await read(release.unitReport)).units))items.set('qa/'+name+'.mjs',r.testSHA256);
items.set('qa/surface-pixels.py',(await read(release.pixelReport)).testSHA256);
for(const [p,expected]of items){
 const file=resolve(root,p),gitPath=relative(repo,file).replaceAll('\\','/');assert.ok(!gitPath.startsWith('../'));
 const working=await readFile(file);assert.equal(hash(working),expected,'working changed: '+p);
 const staged=execFileSync('git',['show',':'+gitPath],{cwd:repo,maxBuffer:32e6});
 const pointer=staged.length<1024&&staged.toString().match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n$/);
 assert.equal(pointer?pointer[1]:hash(staged),expected,'index mismatch: '+p);if(pointer)assert.equal(+pointer[2],working.length);
}
console.log(JSON.stringify({pass:true,verified:items.size,runtime:Object.keys(release.sources).length,method:'working SHA256 vs index bytes/LFS identity; not upload acknowledgement'}));
