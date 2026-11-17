// Current-build evidence collector for this manual-control demonstration only.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const game=new URL('../',import.meta.url),checks=[],evidence=[];
const bytes=p=>readFileSync(new URL(p,game)),json=p=>JSON.parse(bytes(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}};
const names=[...bytes('serve.mjs').toString().match(/export const sourceNames=\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
const sourceHashes=Object.fromEntries(names.map(p=>[p,sha(bytes(p))]));
function record(path){const b=bytes(path);evidence.push({path,bytes:b.length,sha256:sha(b)});}
function bind(path,r){check('loaded current source '+path,()=>assert.deepEqual(r.buildHashes,sourceHashes));}
for(const path of ['qa/user-house-contract.json','qa/user-house-unit.json','qa/user-house-checks.json']){
 const r=json(path);check(path+' PASS',()=>assert.ok(r.pass));record(path);
}
for(const name of ['roundtrip-browser','house-current','tactical-browser']){
 const path='qa/user-house-evidence/'+name+'.json',r=json(path);
 check(name+' all assertions',()=>assert.ok(r.pass&&r.checks.every(c=>c.pass)));bind(path,r);record(path);
}
const captures=json('qa/user-house-after-captures.json');
check('six actual-game current canvas views',()=>assert.ok(captures.pass&&captures.results.length===6));
for(const r of captures.results){
 const path='qa/user-house-after-evidence/'+r.name+'.json',meta=json(path);
 bind(path,meta);
 check(r.name+' native1080p nonblank imported model',()=>assert.ok(meta.canvas[0]===1920&&meta.canvas[1]===1080&&meta.pixel_check.nonblank&&meta.render.house.asset.mode==='imported-glb'));
 record(path);record(path.replace(/json$/,'png'));
}
for(const r of json('qa/user-house-before-captures.json').results){
 record('qa/user-house-before-evidence/'+r.name+'.json');
 record('qa/user-house-before-evidence/'+r.name+'.png');
}
const strict=p=>p.duration_ms>=30000&&p.p95_ms<=33.3&&p.p99_ms<=33.3&&p.max_ms<=50&&p.hitches_over_50ms===0;
const attempts=readdirSync(new URL('qa/user-house-evidence/',game)).filter(n=>/^performance-\d+\.json$/.test(n))
 .sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0])).map(n=>{
  const path='qa/user-house-evidence/'+n,r=json(path);bind(path,r);record(path);
  record(path.replace('.json','-diagnostics.json'));
  return{path,pass:strict(r),p95_ms:r.p95_ms,p99_ms:r.p99_ms,max_ms:r.max_ms,hitches:r.hitches_over_50ms};
 });
const benchmark=json('qa/user-house-benchmark.json'),last=attempts.at(-1),perf=json(last.path);
check('final two consecutive current strict pacing samples pass',()=>assert.ok(attempts.length>=2&&attempts.slice(-2).every(r=>r.pass)));
check('latest hardware1080p30s combat/audio strict sample',()=>{
 assert.ok(benchmark.pass&&last.pass&&!/swiftshader|software|microsoft basic/i.test(perf.renderer));
 assert.deepEqual(perf.canvas,[1920,1080]);assert.ok(perf.raw.length>500&&perf.duration_ms>=30000);
 assert.ok(perf.audio.ready&&!perf.audio.failed&&perf.audio.errors===0&&perf.audio.byType.player>0&&perf.audio.byType.enemy>0);
 const sorted=perf.raw.map(r=>r.frame_ms).sort((a,b)=>a-b);
 for(const [key,p]of [['p95_ms',.95],['p99_ms',.99]])assert.equal(perf[key],sorted[Math.floor(sorted.length*p)]);
 assert.equal(perf.max_ms,sorted.at(-1));
 assert.equal(perf.hitches_over_50ms,sorted.filter(n=>n>50).length);
});
const review=json('qa/user-house-independent-review.json');
check('independent engineering and bounded art acceptance',()=>{
 assert.equal(review.engineering.verdict,'PASS');assert.equal(review.art.verdict,'PASS');
 assert.equal(review.art.blockerCount,0);assert.equal(review.art.majorCount,0);
});
for(const p of ['qa/user-house-independent-review.json','qa/user-house-after-captures.json','qa/user-house-before-captures.json','qa/user-house-benchmark.json',
 'assets/house/timber-house-edited.glb','assets/house/house-contract.json',
 'authoring/user-house-2026-11-17/source-audit.json','authoring/user-house-2026-11-17/timber-house-user-source.blend',
 'authoring/user-house-2026-11-17/timber-house-user.glb','authoring/user-house-2026-11-17/Image_4.png'])record(p);
if(process.argv.includes('--staged'))check('staged source/evidence and Git LFS exact bytes',()=>{
 const records=new Map([...Object.entries(sourceHashes),...evidence.map(r=>[r.path,r.sha256])]);
 for(const [p,expected]of records){
  const blob=execFileSync('git',['show',':experiments/sunbreak-storm-v3/'+p],{cwd:game,maxBuffer:128e6});
  const pointer=blob.subarray(0,200).toString().match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\n/);
  assert.equal(pointer?pointer[1]:sha(blob),expected,p);
 }
});
const report={schema:'sunbreak-user-house-release-v1',quality_profile:'offscreen-cinematic-v1',task:'sunbreak-user-house-2026-11-17',date:new Date().toISOString(),
 scope:'Three.js browser demo manual house-edit control proof only; NOT UE cinematic or continuous-animation approval',
 pass:checks.every(c=>c.pass),checks,sourceHashes,evidence,review,
 performance:{renderer:perf.renderer,latest:last,attempts,
  caveat:'Every attempt retained. First attempt had a568.5ms unexplained hitch; a subsequent strict pass does not establish universally hitch-free play.'},
 limits:['Shared wood texture deliberately repeats Hello/red test paint on all users of that texture.',
  'Two small below-floor foundation corner cutouts are preserved as authored, not certified watertight.',
  'Representative real canvas views, not full continuous visual review.',
  'Pre-existing private vault conflict preserved; isolated public web checkpoint only.',
  'Original downloadable art kit remains the old comparison baseline; saved latest user source is in authoring/user-house-2026-11-17.'],
 publication:'Source checkpoint and normal protected-main Pages publication/live hashes are separately recorded in user-house-public-live.json.'};
writeFileSync(new URL('./user-house-release.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass),performance:report.performance},null,2));
if(!report.pass)process.exitCode=1;
