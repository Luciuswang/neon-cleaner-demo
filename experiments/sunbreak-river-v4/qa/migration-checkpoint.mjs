// Collect a bounded checkpoint, never promote a failing gate to release PASS.
// Usage: node qa/migration-checkpoint.mjs <visual-report> <units-report> <regression-report> [failure-report]
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runtimeHashes} from './source-binding.mjs';
const game=fileURLToPath(new URL('../',import.meta.url));
const repo=resolve(game,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const portable=p=>relative(repo,p).replaceAll('\\','/');
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
async function record(path){const absolute=resolve(path),bytes=await readFile(absolute);return{ref:{path:portable(absolute),sha256:sha(bytes)},data:JSON.parse(bytes)}}
assert.ok(process.argv.length===5||process.argv.length===6,'explicit completed visual, unit and regression reports; optional failure artifact');
const visual=await record(process.argv[2]);
const units=await record(process.argv[3]);
const regressions=await record(process.argv[4]);
const review=await record(resolve(game,'qa/migration-review.json'));
const failureArtifact=process.argv[5]?await record(process.argv[5]):null;
const sources=await runtimeHashes();
for(const r of [visual,units]){
 assert.equal(r.data.sourceUnchanged,true,'collection source drift');
 assert.equal(canonical(r.data.sourcesBefore.runtime),canonical(sources),'current runtime differs from reviewed evidence');
 for(const [name,expected]of Object.entries(r.data.sourcesBefore.harness))assert.equal(sha(await readFile(resolve(game,'qa',name))),expected,'harness drift: '+name);
}
assert.equal(regressions.data.sourceUnchanged,true);
assert.equal(canonical(regressions.data.sources),canonical(sources));
assert.equal(review.data.sourceManifestSHA256,visual.data.sourceManifestSHA256);
assert.equal(review.data.visualReportSHA256,visual.ref.sha256);
const artifacts=[];
for(const c of visual.data.captures){
 for(const [file,expected]of [[c.png,c.sha256],[c.state,c.stateSHA256]]){
  const path=resolve(repo,dirname(visual.ref.path),file),bytes=await readFile(path);
  assert.equal(sha(bytes),expected,'capture drift: '+file);artifacts.push({path:portable(path),sha256:expected,bytes:bytes.length});
 }
}
const functional=regressions.data.runs.filter(r=>!r.phase.includes('benchmark'));
const performance=regressions.data.runs.filter(r=>r.phase.includes('benchmark'));
const childReports=[];
for(const run of regressions.data.runs){
 if(!run.report){childReports.push({phase:run.phase,mode:run.mode,missing:true});continue}
 const child=await record(run.report);assert.equal(child.ref.sha256,run.sha256,'regression evidence drift');
 childReports.push({...child.ref,phase:run.phase,mode:run.mode,pass:run.pass});
 const raw=child.data.results.find(r=>r.raw);
 if(raw)assert.equal(canonical(raw.source),canonical(sources),'timed build differs');
}
const failures=units.data.preservation.results.filter(r=>!r.pass);
const report={
 schema:'river-procedural-migration-checkpoint-v1',task:'river-procedural-migration-2026-11-19',date:new Date().toISOString(),profile:'offscreen-cinematic-v1',
 baseline:visual.data.baseline,sourceManifestSHA256:visual.data.sourceManifestSHA256,sources,
 userApproval:'User accepts isolated lab appearance and explicitly authorizes Riverfall migration; not a waiver of technical failures.',
 scope:'Eight material families baked; five families attached through standard slots plus path/litter through six terrain samplers. Brick/core/course uses analytic masonry shaders rather than the allocated brick bake. Zoned damp/puddle response. Existing map, collisions, AI, doors, weapon/NPC animations, river flow, lighting, AO and fog retained. Legacy URL retained.',
 links:{procedural:'http://127.0.0.1:5190/river/',legacy:'http://127.0.0.1:5190/river/?materials=legacy'},
 reports:{visual:visual.ref,units:units.ref,regressions:regressions.ref,independentReview:review.ref,...failureArtifact?{additionalFailure:failureArtifact.ref}:{}},
 gates:{
  visualEngineering:{pass:visual.data.pass,captures:visual.data.captures.length,pairs:visual.data.pairs.length,description:'Native 1080p actual WebGL, source/material/network assertions; not art PASS'},
  cpuSuites:{pass:Object.values(units.data.units).every(v=>v.pass),count:Object.keys(units.data.units).length},
  historicalRawPreservation:{pass:units.data.preservation.pass,checked:units.data.preservation.results.length,failures,unchangedDuringRun:units.data.historicalUnchanged,explanation:'Seven inherited CRLF-only historical evidence differences remain raw-byte FAIL. Old files were not rewritten or waived.'},
  functional:{pass:regressions.data.functionalPass,runs:functional,proceduralPass:functional.filter(r=>r.mode==='procedural').length===5&&functional.filter(r=>r.mode==='procedural').every(r=>r.pass),legacyPass:functional.filter(r=>r.mode==='legacy').length===3&&functional.filter(r=>r.mode==='legacy').every(r=>r.pass),additionalFailure:failureArtifact?{error:failureArtifact.data.error,assertions:failureArtifact.data.results.filter(r=>!r.pass)}:null},
  performance:{pass:regressions.data.performancePass,thresholds:regressions.data.thresholds,runs:performance},
  engineering:review.data.engineering,sampledArt:review.data.sampledArt,
  continuousMotion:'UNVERIFIED: representative stills and timing records are not continuous visual review',
  fullGameAAA:'NOT ACCEPTED',publicRelease:'BLOCKED: no Pages deployment in this checkpoint'
 },
 limitations:[
  'Not an asset-free game: river substrate, HDR, foliage, imported models, guns and NPC resources remain external assets.',
  'Terrain puddles use environment specular, not planar world reflections; existing river reflection pass is unchanged.',
  'Coarse stone silhouettes, simple building geometry/wood, sparse repeating vegetation and terrain composition still limit full-scene fidelity.',
  'No new Fable execution or UE renderer used. No claim of final cinematic or AAA quality.',
  'All failed and superseded evidence retained; strict test thresholds were not relaxed.'
 ],
 portability:{publicCodeAndEvidence:'Git/LFS delivery must be verified through containing commit on origin; not inferred by this collector',privateSnapshot:'cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407',privateResourcesChanged:false,privateVault:'pre-existing dirty UE vault preserved; private transfer skipped for this public-only change, not full-project portability'},
 childReports,artifacts,collector:{path:portable(fileURLToPath(import.meta.url)),sha256:sha(await readFile(fileURLToPath(import.meta.url)))}
};
const output=resolve(game,'qa/migration-release.json');
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:portable(output),sha256:sha(await readFile(output)),gates:{visual:report.gates.visualEngineering.pass,cpu:report.gates.cpuSuites.pass,preservation:report.gates.historicalRawPreservation.pass,functional:report.gates.functional.pass,performance:report.gates.performance.pass}}));
