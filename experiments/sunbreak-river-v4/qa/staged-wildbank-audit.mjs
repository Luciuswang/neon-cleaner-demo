// Verify that source-bound evidence describes the exact bytes to be uploaded.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const release=JSON.parse(await readFile(resolve(root,'qa/release.json'),'utf8'));
assert.equal(release.task,'sunbreak-river-wildbank-2026-11-18');
const items=new Map(Object.entries(release.sources));
for(const f of [...release.visuals,...Object.values(release.reports),...release.performance.storm,release.performance.sunny]){assert.ok(f.path&&f.sha256,'missing frozen evidence');items.set(f.path,f.sha256)}
for(const f of release.visuals)items.set(f.statePath,f.stateSHA256);
for(const f of release.developmentEvidence)if(f.sha256)items.set(f.path,f.sha256);
const manifest=JSON.parse(await readFile(resolve(root,'wild-grass-assets.json'),'utf8'));
items.set(manifest.preparation.script,manifest.preparation.sha256);
// Summary/reviewer records are separately inspected, then must match the index
// exactly. This identity check does not manufacture independent QA approval.
for(const p of ['qa/release.json',release.unitReport,release.independentReview,'qa/wildbank-review.json','qa/checkpoint-wildbank.mjs','qa/staged-wildbank-audit.mjs'])items.set(p,hash(await readFile(resolve(root,p))));
const units=JSON.parse(await readFile(resolve(root,release.unitReport),'utf8'));
for(const [name,r]of Object.entries(units.units))items.set('qa/'+name+'.mjs',r.testSHA256);
for(const [p,expected]of items){
 const file=resolve(root,p),gitPath=relative(repo,file).replaceAll('\\','/');
 assert.ok(!gitPath.startsWith('../'),'outside repository');
 const working=await readFile(file);assert.equal(hash(working),expected,'working bytes changed: '+p);
 const staged=execFileSync('git',['show',':'+gitPath],{cwd:repo,maxBuffer:32e6});
 const pointer=staged.length<1024&&staged.toString().match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n$/);
 assert.equal(pointer?pointer[1]:hash(staged),expected,'staged bytes mismatch: '+p);
 if(pointer)assert.equal(Number(pointer[2]),working.length,'LFS declared size mismatch: '+p);
}
console.log(JSON.stringify({pass:true,verified:items.size,runtime:Object.keys(release.sources).length,method:'working raw SHA256 and Git index blob/LFS object identity; no upload acknowledgement implied'}));
