// Fail-closed current-source binding. Motion-density failures are kept separate
// and never promoted to continuous-review PASS by functional/sampled-art gates.
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..'),qa=resolve(root,'qa'),evidence=resolve(qa,'evidence');
const hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(p,'utf8'));
const dirs=readdirSync(evidence,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();
const latest=phase=>{const name=dirs.filter(n=>n.startsWith(phase+'-')).at(-1);assert.ok(name,'Missing '+phase);return resolve(evidence,name,phase+'-1.json')};
const chosen={checks:latest('checks'),inspect:latest('inspect'),movie:latest('movie')};
const checks=read(chosen.checks),snapshot=checks.results[0].details;
assert.ok(checks.pass&&checks.results.length>=32);
const sources=Object.fromEntries(Object.keys(snapshot.buildHashes).map(path=>[path,hash(readFileSync(resolve(root,path)))]));
function sameSources(actual,label){for(const [path,sha]of Object.entries(sources))assert.equal(actual?.[path],sha,'Stale evidence '+label+': '+path)}
for(const [phase,path]of Object.entries(chosen)){
 const report=read(path);assert.ok(report.pass,'Failed '+phase);sameSources(report.results[0].details.buildHashes,phase);
}
const imageDir=resolve(chosen.inspect,'..');
for(const name of ['held','reload-15','reload-24','reload-35','reload-48','reload-60','reload-73','reload-80','reload-92']){
 const image=readFileSync(resolve(imageDir,name+'.png'));assert.equal(image.readUInt32BE(16),1920);assert.equal(image.readUInt32BE(20),1080);
 sameSources(read(resolve(imageDir,name+'.json')).buildHashes,'image '+name);
}
const benchmarks=dirs.filter(n=>n.startsWith('benchmark-')).slice(-2).map(n=>resolve(evidence,n,'benchmark-1.json'));
assert.equal(benchmarks.length,2);
const performance=[];
for(const path of benchmarks){
 const report=read(path);assert.ok(report.pass,'Latest performance sample failed; do not pick an older PASS');
 const result=report.results.at(-1);sameSources(result.source,'benchmark');
 assert.ok(result.duration>=30000&&result.viewport[0]>=1920&&result.viewport[1]>=1080&&result.max<=50&&result.p95<=33.3&&result.p99<=33.3&&result.over50===0);
 assert.ok(result.warmup?.declaredSeconds===10&&result.warmupRaw.length>0);
 assert.ok(result.stress?.shots>=180&&result.stress.finalAmmo.reserve>0,'Final two samples must sustain firing/reloading, not exhaust reserve');
 assert.equal(report.harnessAdapter?.sourceSha256,hash(readFileSync(resolve(qa,'sustained.mjs'))));
 assert.equal(report.harnessAdapter?.baseSourceSha256,sources['qa/browser.mjs']);
 performance.push({path:relative(root,path).split(sep).join('/'),duration:result.duration,p50:result.p50,p95:result.p95,p99:result.p99,max:result.max,over50:result.over50,renderer:result.renderer,warmup:result.warmup,stress:result.stress,harnessAdapter:report.harnessAdapter});
}
const unit=read(resolve(qa,'unit.json'));assert.ok(unit.pass);for(const [p,sha]of Object.entries(unit.sources))assert.equal(sha,sources[p]);
const review=read(resolve(qa,'independent-review.json'));
assert.ok(['PASS','CONDITIONAL PASS'].includes(review.engineering.verdict));
assert.ok(['PASS','CONDITIONAL PASS'].includes(review.art.verdict));
for(const [p,sha]of Object.entries(review.sources))assert.equal(sha,sources[p]);
assert.ok(Object.keys(review.sources).includes('index.html')&&Object.keys(review.sources).includes('weapon.js')&&Object.keys(review.sources).includes('reload-pose.js'));
const overlay=read(resolve(repo,'.local/sunbreak-v4-build/public-release.json'));
for(const f of overlay.files)assert.equal(hash(readFileSync(resolve(root,f.path))),f.sha256,'Stale package '+f.path);
for(const f of overlay.sharedFiles)assert.equal(hash(readFileSync(resolve(root,'../sunbreak-storm-v3',f.path))),f.sha256,'Shared asset changed '+f.path);
const artifacts=[];
function walk(dir){
 for(const name of readdirSync(dir)){
  const path=resolve(dir,name);if(statSync(path).isDirectory())walk(path);
  else artifacts.push({path:relative(root,path).split(sep).join('/'),bytes:statSync(path).size,sha256:hash(readFileSync(path))});
 }
}
walk(evidence);
const densityPath=resolve(chosen.movie,'../decoded/decode.json'),density=read(densityPath);
assert.equal(density.source_sha256,hash(readFileSync(resolve(chosen.movie,'../reload-live.webm'))));
let publication='PENDING separate protected-main PR and anonymous hash/browser verification';
if(process.argv.includes('--published')){
 assert.equal(review.publicationEngineering?.verdict,'PASS','Separate publication engineering review required');
 const receipt=read(resolve(repo,'.local/sunbreak-v4-publication.json')),live=read(resolve(qa,'public-live.json'));
 assert.ok(receipt.uploaded&&receipt.liveVerified&&live.pass&&live.errors.length===0);
 assert.equal(live.sourceCommit,receipt.sourceCommit);assert.equal(live.publicCommit,receipt.publicCommit);
 assert.equal(overlay.sourceCommit,receipt.sourceCommit);assert.equal(live.files.length,126);
 for(const f of overlay.files)assert.equal(live.files.find(p=>p.path===f.path)?.sha256,f.sha256,'Published bytes '+f.path);
 for(const f of overlay.sharedFiles)assert.equal(live.files.find(p=>p.path==='../'+f.path)?.sha256,f.sha256,'Published shared bytes '+f.path);
 const path=latest('public'),smoke=read(path);
 assert.ok(smoke.pass&&smoke.results.length>=7&&smoke.errors.length===0);
 assert.equal(smoke.harnessAdapter?.sourceSha256,hash(readFileSync(resolve(qa,'public.mjs'))));
 assert.equal(smoke.harnessAdapter?.baseSourceSha256,sources['qa/browser.mjs']);
 publication={...receipt,hashVerification:'qa/public-live.json',anonymousFilesVerified:live.files.length,
  browserVerification:relative(root,path).split(sep).join('/'),browserAssertions:smoke.results.length,
  publicHarness:smoke.harnessAdapter,engineeringReview:review.publicationEngineering,singlePlayerOnly:true};
}
const report={schema:'sunbreak-auto-release-v1',date:new Date().toISOString(),verdict:'CONDITIONAL PASS',scope:'Single-player held automatic fire and authored reload prototype only; not 4v4, full continuous motion, subjective audio or UE/AAA acceptance',
 currentSourceBinding:true,sources,checks:checks.results.length,unitGroups:unit.results.length,sharedFiles:overlay.sharedFiles,performance,
 engineering:review.engineering,art:review.art,continuousMotion:{verdict:'UNVERIFIED',captureDensityPass:density.pass,frames:density.frames,reason:'Requested/container capture fps does not prove delivered frames; failed sparse recordings retained. Sampled actual game-canvas poses and functional clock tests only.'},
 retainedFailures:['Initial cuff/hand pose and sanitized twist-name mismatch; rejected images retained.','Independent review caught repeat-F and focused-control trigger defects; fixed and final32-group regression passed.','Initial strict benchmark failed with unexplained1333.2ms hitch. Two subsequent PASS samples used finite90reserve and are mixed combat/rendering, not sustained stress.','Sustained sample benchmark-2026-11-17T10-44-34-752Z failed with one52.6ms frame during reload.4667, cause unknown. Retained alongside all four sustained attempts; the final declared pair passed unchanged thresholds/runtime. No universally hitch-free claim.','Both initial live-timer recordings failed density; do not claim full continuous acceptance.','First public mouse-release smoke read the200ms HUD mirror and observed25 then24rounds. Failure retained. Public adapter instead reads the already-published synchronous production snapshot, without runtime/timing/assertion changes.'],
 releaseFiles:overlay.files,artifacts,publication};
writeFileSync(resolve(qa,'release.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({verdict:report.verdict,currentSourceBinding:true,checks:report.checks,unitGroups:report.unitGroups,sharedFiles:report.sharedFiles.length,artifacts:artifacts.length,performance,continuousMotion:report.continuousMotion}));
