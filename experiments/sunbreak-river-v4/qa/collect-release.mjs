// Fail-closed binding to current render/game sources; historical failures retained.
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'qa'),evidence=resolve(qa,'evidence');
const read=p=>JSON.parse(readFileSync(p)),hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const foliage=read(resolve(root,'foliage-revision.json'));
const names=readdirSync(root).filter(n=>/\.(js|html)$/.test(n)).concat(['asset-sources.json','foliage-derivatives.json','foliage-revision.json','fable-art-revision.json','qa/hooks.js','qa/browser.mjs',...foliage.derivatives.map(f=>f.file)]);
const sources=Object.fromEntries(names.map(n=>[n,hash(resolve(root,n))]));
const dirs=readdirSync(evidence).sort(),latest=phase=>resolve(evidence,dirs.filter(n=>n.startsWith(phase+'-')).at(-1),phase+'-1.json');
function bind(h,label){for(const [n,sha]of Object.entries(sources))assert.equal(h?.[n],sha,'Stale '+label+' '+n)}
const chosen={},summaries={};
for(const phase of ['map','art','cabins','checks','traversal']){
 const path=latest(phase),r=read(path);assert.ok(r.pass,phase+' failed');bind(r.results[0].details.buildHashes,phase);chosen[phase]=relative(root,path).replaceAll('\\','/');summaries[phase]=r.results.length;
}
assert.ok(summaries.checks>=32&&summaries.traversal>=40);
assert.ok(summaries.cabins>=15);
for(const name of ['river-hero','west-village','east-village','river-ford','bridge','layout','wet-mud','ruin']){
 const dir=resolve(latest('map'),'..');bind(read(resolve(dir,name+'.json')).buildHashes,name);const b=readFileSync(resolve(dir,name+'.png'));assert.equal(b.readUInt32BE(16),1920);assert.equal(b.readUInt32BE(20),1080);
}
for(const name of ['west-buffer-front','west-buffer-side','west-buffer-interior','east-buffer-front','east-buffer-side','east-buffer-interior','ground-weather2','tree-root-weather2','ruin-break-weather2','ruin-inside-weather2','ground-weather0','tree-root-weather0','ruin-break-weather0','ruin-inside-weather0']){
 const dir=resolve(latest('art'),'..');bind(read(resolve(dir,name+'.json')).buildHashes,name);const b=readFileSync(resolve(dir,name+'.png'));assert.equal(b.readUInt32BE(16),1920);assert.equal(b.readUInt32BE(20),1080);
}
const performance=[];
for(const d of dirs.filter(n=>n.startsWith('benchmark-')).slice(-2)){
 const r=read(resolve(evidence,d,'benchmark-1.json')),b=r.results.at(-1);assert.ok(r.pass,'Final pair failed '+d);bind(b.source,d);
 assert.ok(b.duration>=30000&&b.p95<=33.3&&b.p99<=33.3&&b.max<=50&&b.over50===0&&b.viewport[0]>=1920&&b.viewport[1]>=1080);
 assert.ok(b.stress.shots>=180&&b.stress.finalAmmo.reserve>0&&b.audio.byType.enemy>0&&b.warmupRaw.length>0);
 performance.push({path:'qa/evidence/'+d+'/benchmark-1.json',p50:b.p50,p95:b.p95,p99:b.p99,max:b.max,over50:b.over50,renderer:b.renderer,shots:b.stress.shots,enemyShots:b.audio.byType.enemy});
}
assert.equal(performance.length,2);
const unit={};for(const name of ['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks']){const r=read(resolve(qa,name+'.json'));assert.ok(r.pass,name);for(const [p,sha]of Object.entries(r.sources||{}))assert.equal(hash(resolve(root,p)),sha);unit[name]=(Array.isArray(r.checks)?r.checks.length:0)||r.results?.length||r.traversals?.length||r.wallBoxes||r.supportChecks}
const review=read(resolve(qa,'independent-review.json'));for(const [p,sha]of Object.entries(review.sources))assert.equal(sources[p],sha);
assert.deepEqual(Object.keys(review.sources).sort(),Object.keys(sources).sort(),'Independent review must bind the complete current source/asset set');
assert.ok(['PASS','CONDITIONAL PASS'].includes(review.engineering.verdict));assert.ok(['PASS','CONDITIONAL PASS'].includes(review.art.verdict));
const artifacts=[];function walk(dir){for(const name of readdirSync(dir)){const p=resolve(dir,name);if(statSync(p).isDirectory())walk(p);else artifacts.push({path:relative(root,p).replaceAll('\\','/'),sha256:hash(p),bytes:statSync(p).size})}}walk(evidence);
const report={schema:'sunbreak-river-release-v1',date:new Date().toISOString(),verdict:'CONDITIONAL PASS',scope:'Independent single-player river-map experiment; not AAA parity, real4v4, continuous-motion approval or competitive-balance certification',currentSourceBinding:true,sources,chosen,summaries,unit,performance,review,artifacts,
 retainedFailures:['Two long Fable generations exceeded response length; compact extraction initially lost code; only complete visible-text candidate applied.','Early terrain/wind shader errors; rejected images retained.','Unchunked canvas transport timed out; corrected without changing renderer acceptance.','Navigation start/corner/doorway and terrain Float32/material-side defects found independently and fixed with regressions.','Initial terrain raycaster caused frequent long frames; exact grid DDA substituted and compared with stock raycasting.','Later benchmark13:14 had two176–191ms hitches with unknown cause; instrumented rerun passed, no universally hitch-free claim.','Input test initially outran asynchronous pointer-lock exit; harness now awaits lifecycle settlement before resuming.','Art first review REVISE: straight canal, noisy material, cloned silhouettes; source-bound rework reviewed separately.'],publication:'PENDING normal protected-main publication and live verification'};
report.protocol='offscreen-cinematic-v1';
report.task='sunbreak-river-art-2026-11-18';
report.engine='Actual browser WebGL canvas, not Unreal Engine rendering';
report.retainedFailures.push(...read(resolve(qa,'rework-history-2026-11-18.json')).failuresRetained);
report.scope='Two diagonally paired enterable timber cabins and reference-led river environment revision; independent single-player browser experiment. Not AAA parity, real4v4, continuous-motion approval, dynamic destruction or competitive-balance certification.';
if(process.argv.includes('--published')){const live=read(resolve(qa,'public-live.json')),smoke=read(latest('public'));assert.ok(live.pass&&smoke.pass&&smoke.results.length>=7);report.publication={url:live.url,sourceCommit:live.sourceCommit,publicCommit:live.publicCommit,hashes:live.files.length,inputChecks:smoke.results.length};}
writeFileSync(resolve(qa,'release.json'),JSON.stringify(report,null,2)+'\n');console.log({verdict:report.verdict,summaries,unit,performance,publication:report.publication});
