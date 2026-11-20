// Freeze the actual bounded checkpoint. Does not run GPU tests or waive failures.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {runtimeHashes} from './source-binding.mjs';
const game=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(game,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex'),canonical=v=>JSON.stringify(Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=a.match(/^--(visual|compat|units|regressions)=(.+)$/);assert.ok(m,'unknown argument');return[m[1],m[2]]}));
const reports={},bindings={};
for(const key of ['visual','compat','units','regressions']){
 assert.ok(args[key],key+' report required');const p=resolve(game,'qa/evidence',args[key],'report.json');
 assert.ok(p.startsWith(resolve(game,'qa/evidence')+ '\\')||p.startsWith(resolve(game,'qa/evidence')+'/'));
 const bytes=await readFile(p);reports[key]=JSON.parse(bytes);bindings[key]={path:relative(repo,p).replaceAll('\\','/'),sha256:hash(bytes)};
}
const sources=await runtimeHashes(),runtimeSHA256=hash(canonical(sources));
for(const [key,r]of Object.entries(reports))assert.equal(canonical(r.sources||r.sourcesBefore.runtime),canonical(sources),key+' runtime no longer current');
assert.ok(reports.visual.pass&&reports.visual.coverage.full&&reports.visual.historicalUnchanged,'full exact current visual collector required');
assert.ok(reports.compat.checksPass&&reports.compat.historicalUnchanged,'combined legacy variants required');
assert.ok(reports.units.functionalPass&&reports.units.historicalUnchanged,'CPU/history checks required');
assert.ok(reports.regressions.sourceUnchanged&&reports.regressions.historicalUnchanged,'regression identity required, failure verdicts remain');
const reviewPath=resolve(game,'qa/afterrain-look-review-2026-11-20.json'),reviewBytes=await readFile(reviewPath),review=JSON.parse(reviewBytes);
assert.equal(review.runtimeSHA256,runtimeSHA256,'independent review must name this build');
bindings.review={path:relative(repo,reviewPath).replaceAll('\\','/'),sha256:hash(reviewBytes)};

// Decode only existing browser-generated PNGs; no image edit or rewriting.
function decodePNG(buf){
 const width=buf.readUInt32BE(16),height=buf.readUInt32BE(20),type=buf[25],bpp=type===6?4:type===2?3:0;
 assert.ok(buf[24]===8&&bpp&&buf[28]===0,'8bit RGB/RGBA noninterlaced evidence');
 const chunks=[];for(let i=8;i<buf.length;){const n=buf.readUInt32BE(i),kind=buf.toString('ascii',i+4,i+8);if(kind==='IDAT')chunks.push(buf.subarray(i+8,i+8+n));i+=n+12}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*bpp,out=new Uint8Array(height*stride);let at=0;
 for(let y=0;y<height;y++){const filter=raw[at++];assert.ok(filter<=4);for(let x=0;x<stride;x++){
  const k=y*stride+x,a=x>=bpp?out[k-bpp]:0,b=y?out[k-stride]:0,c=y&&x>=bpp?out[k-stride-bpp]:0,p=a+b-c;
  const pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predict=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):pa<=pb&&pa<=pc?a:pb<=pc?b:c;
  out[k]=(raw[at++]+predict)&255;
 }}return{width,height,bpp,pixels:out};
}
const oldDir=resolve(game,'qa/evidence/migration-visual-2026-11-19T13-52-11-585Z-vUJROf'),newDir=resolve(game,'qa/evidence',args.visual),previousPixelComparisons=[];
for(const view of ['ground-lane','river-hero','river-wide']){
 const a=decodePNG(await readFile(resolve(oldDir,'procedural-'+view+'.png'))),b=decodePNG(await readFile(resolve(newDir,'previous-'+view+'.png')));
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);let changed=0,maxChannelDelta=0,loX=a.width,loY=a.height,hiX=-1,hiY=-1;
 for(let i=0;i<a.width*a.height;i++){let diff=false;for(let c=0;c<3;c++){const d=Math.abs(a.pixels[i*a.bpp+c]-b.pixels[i*b.bpp+c]);maxChannelDelta=Math.max(maxChannelDelta,d);if(d)diff=true}if(diff){changed++;const x=i%a.width,y=Math.floor(i/a.width);loX=Math.min(loX,x);loY=Math.min(loY,y);hiX=Math.max(hiX,x);hiY=Math.max(hiY,y)}}
 previousPixelComparisons.push({view,pass:changed===0,changedPixels:changed,maxChannelDelta,bounds:changed?[loX,loY,hiX,hiY]:null,policy:'exact decoded RGB; any mismatch remains FAIL, not normalized or tolerated'});
}
const artifacts=[];
for(const [key,dir]of Object.entries(args))for(const n of await readdir(resolve(game,'qa/evidence',dir))){
 const p=resolve(game,'qa/evidence',dir,n);const b=await readFile(p);artifacts.push({path:relative(repo,p).replaceAll('\\','/'),sha256:hash(b),bytes:b.length,phase:key});
}
const inheritedPath=resolve(game,'qa/migration-release.json'),inherited=await readFile(inheritedPath);
const release={schema:'river-afterrain-checkpoint-v1',task:'river-afterrain-light-understory-2026-11-20',profile:'offscreen-cinematic-v1',date:new Date().toISOString(),baseline:'8647a8fcdfaf9fcd199e4b0495628b894fd64aef',runtimeSHA256,sources,bindings,artifacts,
 delivery:'local playable lighting/ground/understory checkpoint; no Pages deployment',
 visualEngineering:reports.visual.pass?'PASS':'FAIL',cpuSuites:{count:reports.units.runs.length,pass:reports.units.functionalPass},functional:{pass:reports.regressions.functionalPass,runs:reports.regressions.runs.filter(r=>!r.phase.includes('benchmark'))},
 performance:{pass:reports.regressions.performancePass,thresholds:reports.regressions.thresholds,runs:reports.regressions.runs.filter(r=>r.phase.includes('benchmark'))},review,previousPixelComparisons,
 inherited:{path:relative(repo,inheritedPath).replaceAll('\\','/'),sha256:hash(inherited),failures:['three strict frame-pacing failures','timed legacy bridge traversal failure','seven historical CRLF-only raw-byte discrepancies'],waived:false},
 releaseVerdict:'BLOCKED',continuousMotion:'UNVERIFIED; actual stills and functional samples are not continuous subjective review',aaa:'NOT ACCEPTED; browser demo, not UE5 or ray-traced AAA output',
 localURLs:{current:'http://127.0.0.1:5190/river/',previous:'http://127.0.0.1:5190/river/?look=previous',previousLegacy:'http://127.0.0.1:5190/river/?look=previous&materials=legacy'},privateAssets:{changed:false,browserSnapshot:'cc1f9345cfb74e06e3b26f4ba9446bd7b5cf2407',canonicalUEVault:'pre-existing dirty state preserved; not full-project portability'}};
const destination=resolve(game,'qa/afterrain-release.json');await writeFile(destination,JSON.stringify(release,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path:destination,runtimeSHA256,previousPixelComparisons,releaseVerdict:release.releaseVerdict}));
