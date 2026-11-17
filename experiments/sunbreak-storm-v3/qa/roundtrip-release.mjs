// Bind this slice's new evidence to the actual final source, never historical QA.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const game=new URL('../',import.meta.url),checks=[],evidence=[];
const bytes=path=>readFileSync(new URL(path,game)),json=path=>JSON.parse(bytes(path));
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(name,test)=>{try{test();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}};
const names=[...bytes('serve.mjs').toString().match(/export const sourceNames=\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const sourceHashes=Object.fromEntries(names.map(name=>[name,sha(bytes(name))]));
function bind(path,report){check('current loaded source '+path,()=>assert.deepEqual(report.buildHashes,sourceHashes));}
function record(path){const b=bytes(path);evidence.push({path,bytes:b.length,sha256:sha(b)});}
for(const name of ['roundtrip-browser','house-current','tactical-browser']){
 const path='qa/roundtrip-evidence/'+name+'.json',r=json(path);
 check(name+' all assertions',()=>assert.ok(r.pass&&r.checks.every(c=>c.pass)));
 bind(path,r);record(path);
}
for(const name of ['contract','house-unit','ai-unit','weather-audio-unit','blend']){
 const path='qa/roundtrip-'+name+'.json',r=json(path);
 check(name+' report PASS',()=>assert.equal(r.pass,true));record(path);
}
const arm=json('qa/arm-after-report.json'),armVerify=json('qa/arm-verification.json');
check('left-arm fifteen engineering checks',()=>assert.ok(arm.engineeringVerdict==='PASS'&&Object.values(arm.engineeringChecks).every(Boolean)));
check('left-arm fifty-five verification assertions',()=>assert.ok(armVerify.verdict==='PASS'&&armVerify.checks.length>=55&&armVerify.checks.every(c=>c.pass)));
for(const p of ['qa/arm-after-report.json','qa/arm-verification.json','qa/arm-handoff.md'])record(p);
const captures=json('qa/roundtrip-captures.json');
check('current actual-game capture run',()=>assert.equal(captures.pass,true));
for(const result of captures.results){
 const path='qa/roundtrip-evidence/'+result.name+'.json',r=json(path);
 bind(path,r);
 check(result.name+' native 1080p nonblank',()=>assert.ok(r.canvas[0]===1920&&r.canvas[1]===1080&&r.pixel_check.nonblank));
 record(path);record('qa/roundtrip-evidence/'+result.name+'.png');
}
const benchmark=json('qa/roundtrip-benchmark.json'),run=benchmark.results[0].run;
const perfPath='qa/roundtrip-evidence/performance-'+run+'.json',perf=json(perfPath);
bind(perfPath,perf);
const strictPass=r=>!/swiftshader|software|microsoft basic/i.test(r.renderer)&&r.duration_ms>=30000&&r.p95_ms<=33.3&&r.p99_ms<=33.3&&r.max_ms<=50&&r.hitches_over_50ms===0;
const performanceAttempts=readdirSync(new URL('qa/roundtrip-evidence/',game)).filter(n=>/^performance-\d+\.json$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0])).map(n=>{
 const path='qa/roundtrip-evidence/'+n,r=json(path);record(path);
 return{path,currentBuild:JSON.stringify(r.buildHashes)===JSON.stringify(sourceHashes),pass:strictPass(r),p95_ms:r.p95_ms,p99_ms:r.p99_ms,max_ms:r.max_ms,hitches:r.hitches_over_50ms};
});
check('two consecutive current-build strict pacing passes; all attempts retained',()=>{
 const final=performanceAttempts.filter(r=>r.currentBuild).slice(-2);
 assert.ok(final.length===2&&final.every(r=>r.pass));
});
check('hardware 1080p real combat with audio >=30s and unchanged strict pacing limits',()=>{
 assert.ok(benchmark.pass&&!/swiftshader|software|microsoft basic/i.test(perf.renderer));
 assert.deepEqual(perf.canvas,[1920,1080]);assert.ok(perf.duration_ms>=30000&&perf.raw.length>500);
 assert.ok(perf.p95_ms<=33.3&&perf.p99_ms<=33.3&&perf.max_ms<=50&&perf.hitches_over_50ms===0);
 assert.ok(perf.audio.ready&&!perf.audio.failed&&perf.audio.errors===0&&perf.audio.byType.player>0&&perf.audio.byType.enemy>0);
});record(perfPath);
for(const path of ['assets/house/house-contract.json','assets/house/timber-house-edited.glb','assets/house/timber-house-art-kit.zip','authoring/timber-house/timber-house-source.glb','authoring/timber-house/timber-house-editable.blend','authoring/timber-house/package-manifest.json'])record(path);
const review=json('qa/roundtrip-independent-review.json');
check('independent bounded engineering and art clearance',()=>{
 assert.equal(review.engineering.verdict,'PASS');
 assert.ok(['PASS','CONDITIONAL PASS'].includes(review.art.verdict));
 assert.ok(review.art.blockerCount===0&&review.art.majorCount===0);
});
record('qa/roundtrip-independent-review.json');
if(process.argv.includes('--staged'))check('staged Git/LFS bytes preserve every source/evidence hash across PCs',()=>{
 const records=new Map([...Object.entries(sourceHashes).map(([path,sha256])=>[path,sha256]),...evidence.map(r=>[r.path,r.sha256])]);
 for(const [path,expected]of records){
  const blob=execFileSync('git',['show',':experiments/sunbreak-storm-v3/'+path],{cwd:game,maxBuffer:128e6});
  const pointer=blob.subarray(0,200).toString().match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\n/);
  assert.equal(pointer?pointer[1]:sha(blob),expected,'Staged content mismatch: '+path);
 }
});
const report={schema:'offscreen-cinematic-v1',slice:'sunbreak-house-roundtrip-arms-2026-11-17',date:new Date().toISOString(),
 scope:'Browser demo editable-house and left-arm slice only; NOT UE cinematic acceptance',
 pass:checks.every(c=>c.pass),engineering:checks.every(c=>c.pass)?'PASS':'REWORK',art:review.art.verdict,checks,sourceHashes,evidence,
 performance:{path:perfPath,renderer:perf.renderer,duration_ms:perf.duration_ms,p95_ms:perf.p95_ms,p99_ms:perf.p99_ms,max_ms:perf.max_ms,hitches:perf.hitches_over_50ms,attempts:performanceAttempts,
 caveat:'One retained current-build attempt had a 428.2ms hitch. Cause not established. Subsequent consecutive clean runs are bounded evidence, not a guarantee of hitch-free play on every machine.'},
 limitations:['Representative canvas and numerical pose review, not full continuous visual review.','Original right shoulder opening and baseline root-level reload cosmetics remain; no full hand-driven reload.','House architecture and collision layout fixed; arbitrary structural edits require a separate collision review.','Private asset vault pre-existing dirty state preserved; no full UE portability/AAA claim.'],
 publication:'Source checkpoint/public Pages/live smoke are separate; consult roundtrip-public-live.json and roundtrip-public-smoke.json after publishing.'};
writeFileSync(new URL('qa/roundtrip-release.json',game),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass),performance:report.performance},null,2));
if(!report.pass)process.exitCode=1;
