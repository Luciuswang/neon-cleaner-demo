// Current-bound WIP checkpoint, not a release promotion. Retain failed runs.
import {readFile,writeFile,readdir,access,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runtimeHashes} from './source-binding.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'qa'),evidence=resolve(qa,'evidence');
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const sources=await runtimeHashes(),dirs=(await readdir(evidence)).sort(),rel=p=>relative(root,p).replaceAll('\\','/');
const mismatches=h=>[...new Set([...Object.keys(sources),...Object.keys(h||{})])].filter(p=>h?.[p]!==sources[p]);
const phaseDirs=phase=>dirs.filter(d=>new RegExp('^'+phase+'-\\d{4}-\\d{2}-\\d{2}T').test(d));
function timeline(rows){return rows?.length>0&&rows.every((r,i)=>Number.isFinite(r.frame_ms)&&r.frame_ms>0&&Math.abs(r.elapsed_ms-(i?rows[i-1].elapsed_ms:0)-r.frame_ms)<.001)}
function performanceIntegrity(b){
 if(!b?.raw?.length)return false;const sorted=b.raw.map(r=>r.frame_ms).sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
 return timeline(b.raw)&&timeline(b.warmupRaw)&&b.warmup.declaredSeconds===10&&b.warmupRaw.at(-1).elapsed_ms<10000&&b.warmupRaw.at(-1).elapsed_ms+b.raw[0].frame_ms>=10000&&b.duration===b.raw.at(-1).elapsed_ms&&b.p50===pct(.5)&&b.p95===pct(.95)&&b.p99===pct(.99)&&b.max===sorted.at(-1)&&b.over50===b.raw.filter(r=>r.frame_ms>50).length;
}
async function report(dir,phase){
 if(!dir)return{pass:false,missing:phase};
 let path=resolve(evidence,dir,phase+'-1.json');
 try{await access(path)}catch{path=resolve(evidence,dir,phase+'-failure-1.json')}
 try{const r=await read(path),b=r.results?.at(-1),bindings=b?.source||r.results?.[0]?.details?.buildHashes;
  return{path:rel(path),sha256:sha(await readFile(path)),pass:r.pass,checks:r.results.length,sourceMismatches:mismatches(bindings),
   ...(b?.duration?{weather:b.weather,duration:b.duration,p50:b.p50,p95:b.p95,p99:b.p99,max:b.max,over50:b.over50,viewport:b.viewport,renderer:b.renderer,shots:b.stress.shots,enemyShots:b.audio?.byType?.enemy,warmupFrames:b.warmupRaw.length,retainedTimelineVerified:performanceIntegrity(b)}:{})};
 }catch(e){return{pass:false,path:rel(path),missing:e.message}}
}
const reports={};for(const phase of ['surface','wildbank','afterrain','map','art','weather','cabins','checks','traversal','water-samples'])reports[phase]=await report(phaseDirs(phase).at(-1),phase);
const storm=[];for(const dir of phaseDirs('benchmark').slice(-2))storm.push(await report(dir,'benchmark'));
const sunny=await report(phaseDirs('sunny-benchmark').at(-1),'sunny-benchmark');
// Preserve old canonical evidence records before CPU suites overwrite them.
for(const [file,backup]of [['release.json','previous-wildbank-release-2026-11-19.json'],['independent-review.json','previous-wildbank-review-2026-11-19.json']]){
 try{await access(resolve(qa,backup))}catch{await copyFile(resolve(qa,file),resolve(qa,backup))}
}
const units={};for(const name of ['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks','vegetation-clumps','water-checks','wildbank-checks','surface-checks','masonry-materials-checks','height-fog-checks']){
 const r=spawnSync(process.execPath,[resolve(qa,name+'.mjs')],{encoding:'utf8',windowsHide:true,maxBuffer:8e6});let detail;
 try{detail=JSON.parse(r.stdout)}catch{detail={stdout:r.stdout}}
 units[name]={passed:r.status===0,testSHA256:sha(await readFile(resolve(qa,name+'.mjs'))),...detail,error:r.stderr||undefined};
}
await writeFile(resolve(qa,'surface-units.json'),JSON.stringify({sources,units},null,2)+'\n');
const review=await read(resolve(qa,'surface-review.json'));
const pixelScript=resolve(qa,'surface-pixels.py'),pixelRun=spawnSync('python',[pixelScript,resolve(root,reports.surface.path,'..')],{encoding:'utf8',windowsHide:true});
let pixelDetail;try{pixelDetail=JSON.parse(pixelRun.stdout)}catch{pixelDetail={stdout:pixelRun.stdout,error:pixelRun.stderr}}
const pixels={passed:pixelRun.status===0,testSHA256:sha(await readFile(pixelScript)),...pixelDetail};
await writeFile(resolve(qa,'surface-pixels.json'),JSON.stringify(pixels,null,2)+'\n');
const perfOK=r=>r.pass&&!r.sourceMismatches?.length&&r.retainedTimelineVerified&&r.duration>=30000&&r.viewport?.[0]>=1920&&r.viewport?.[1]>=1080&&r.p95<=33.3&&r.p99<=33.3&&r.max<=50&&r.over50===0&&r.shots>=180&&r.enemyShots>0&&r.warmupFrames>0&&!/swiftshader|software/i.test(r.renderer);
const performancePass=storm.length===2&&storm.every(r=>r.weather===2&&perfOK(r))&&sunny.weather===0&&perfOK(sunny);
let functional=Object.values(reports).every(r=>r.pass&&r.sourceMismatches?.length===0)&&Object.values(units).every(r=>r.passed)&&pixels.passed;
const visuals=[];
for(const [phase,r]of Object.entries(reports)){
 if(!r.path||r.missing)continue;const dir=resolve(root,r.path,'..');
 for(const name of await readdir(dir))if(name.endsWith('.png')){
  const p=resolve(dir,name),b=await readFile(p),state=await read(p.replace('.png','.json'));
  visuals.push({path:rel(p),sha256:sha(b),statePath:rel(p.replace('.png','.json')),stateSHA256:sha(await readFile(p.replace('.png','.json'))),width:b.readUInt32BE(16),height:b.readUInt32BE(20),sourceMismatches:mismatches(state.buildHashes),waterTime:state.water?.time});
 }
}
const expected={surface:['path','surface-close','foundation','ruin','rubble-contact','rubble-no-ao','fog-low','fog-low-off','fog-high','fog-high-off'],wildbank:['south-ford','north-ford','wet-to-dry','wild-grass'],afterrain:['valley-hero','riverbank','valley-wide','sun-side','reference-close'],map:['river-hero','west-village','east-village','river-ford','bridge','layout','wet-mud','ruin'],art:[...['west-buffer','east-buffer'].flatMap(id=>['front','side','interior'].map(v=>id+'-'+v)),...[2,0].flatMap(w=>['ground','tree-root','ruin-break','ruin-inside'].map(v=>v+'-weather'+w))],weather:['weather-sunny'],cabins:['cabins-final'],checks:['checks-final'],traversal:['traversal-final'],'water-samples':Array.from({length:6},(_,i)=>'flow-'+i)};
const visualIntegrity=Object.entries(expected).every(([phase,names])=>names.every(name=>visuals.some(v=>v.path===rel(resolve(root,reports[phase].path,'..',name+'.png'))&&v.width===1920&&v.height===1080&&v.sourceMismatches.length===0)));
const pixelIntegrity=pixels.passed&&pixels.pairs?.length===3&&pixels.pairs.every(pair=>Object.entries(pair.sha256).every(([n,h])=>visuals.some(v=>v.path===rel(resolve(root,reports.surface.path,'..',n+'.png'))&&v.sha256===h)));
functional&&=visualIntegrity&&pixelIntegrity&&reports.surface.checks>=12&&reports.checks.checks>=32&&reports.cabins.checks>=17&&reports.traversal.checks>=54;
const expectedReviewPaths=expected.surface.map(n=>rel(resolve(root,reports.surface.path,'..',n+'.png'))).sort(),reviewPaths=(review.art.evidence||[]).map(e=>e.path).sort();
const reviewCurrent=mismatches(review.reviewedSources).length===0&&JSON.stringify(reviewPaths)===JSON.stringify(expectedReviewPaths)&&new Set(reviewPaths).size===10&&review.art.evidence.every(e=>visuals.some(v=>v.path===e.path&&v.sha256===e.sha256&&v.stateSHA256===e.stateSHA256&&v.sourceMismatches.length===0));
// Never relabel an older review with current hashes. Its own reviewed identity
// is preserved, and stale/missing review evidence remains explicitly invalid.
await writeFile(resolve(qa,'independent-review.json'),JSON.stringify(review,null,2)+'\n');
const developmentEvidence=[];
const firstUnits='qa/surface-units-first-2026-11-19.json';try{developmentEvidence.push({path:firstUnits,sha256:sha(await readFile(resolve(root,firstUnits))),status:'FAIL RETAINED: legacy ground-shader inline token assertion invalid after module extraction; replaced by emitted-shader behavior checks, all terrain/support thresholds unchanged'})}catch(e){if(e.code!=='ENOENT')throw e}
for(const dir of dirs.filter(d=>d.includes('2026-11-19'))){
 for(const name of await readdir(resolve(evidence,dir)))if(/-\d+\.json$/.test(name)){
  const p=resolve(evidence,dir,name),r=await read(p);if(!r.results)continue;
  const bindings=r.results.at(-1)?.source||r.results[0]?.details?.buildHashes;
  if(r.pass===false||mismatches(bindings).length||name==='surface-preview-1.json')developmentEvidence.push({path:rel(p),sha256:sha(await readFile(p)),status:r.pass===false?'FAIL RETAINED':'INTERMEDIATE / SUPERSEDED; not final acceptance'});
 }
}
const result={schema:'river-surface-atmosphere-checkpoint-v1',protocol:'offscreen-cinematic-v1',captureMethod:'native-headless actual browser WebGL canvas, NOT Unreal or desktop capture',
 task:'sunbreak-river-surface-atmosphere-2026-11-19',date:new Date().toISOString(),verdict:'BLOCKED',
 scope:'Targeted playable visual WIP. Source checkpoint only; no AAA/UE5 parity, Pages release or continuous-motion acceptance.',
 sources,functional,visualIntegrity,pixelIntegrity,reviewCurrent,reports,visuals,developmentEvidence,unitReport:'qa/surface-units.json',pixelReport:'qa/surface-pixels.json',independentReview:'qa/independent-review.json',
 performance:{verdict:performancePass?'PASS':'BLOCKED',storm,sunny,requirements:{width:1920,height:1080,durationMS:30000,warmupMS:10000,p95MS:33.3,p99MS:33.3,maxMS:50,over50:0,stormSamples:2}},
 temporal:{verdict:'UNVERIFIED',note:'Six live-rendered water samples do not establish uninterrupted motion review. Prior recording failures and earlier performance failures remain in previous-wildbank-release-2026-11-19.json.'},
 changes:['Three PBR soil layers zoned by village traffic/foundation/river geography; low side-wall weeds.',
 'Material-only masonry course/core separation with unchanged geometry, transforms and collision.',
 'Corrected normalized SSAO depth thresholds and current ADS projection.',
 'Original height-dependent haze on world/foliage/NPC/water; gun/HUD excluded.'],
 research:{primary:'https://oddpotatodev.itch.io/godot-cheap-ground-fog',briefing:'2026-11-18 section5',authorRelease:'2026-11-14',reporting:'2026-11-17',relationship:'Low-cost inspiration; no Godot plugin/code port, no measured speedup or true volumetric-lighting claim.'},
 preserved:'weapon/actor/combat, all terrain/support/layout geometry and previous demos; no private asset edits',
 publication:{status:'NOT UPDATED',localPreview:'http://127.0.0.1:5190/river/',previousPublicURL:'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/'},
 privateAssets:'Unrelated dirty private vault preserved; isolated public-browser checkpoint skips private transfers, not full UE/private portability.'};
result.companionHashes={};for(const p of [result.unitReport,result.pixelReport,result.independentReview,'qa/surface-review.json','qa/checkpoint-surface.mjs','qa/staged-surface-audit.mjs'])result.companionHashes[p]=sha(await readFile(resolve(root,p)));
await writeFile(resolve(qa,'release.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({verdict:result.verdict,functional,performance:result.performance.verdict,art:review.art.verdict,sourceBindings:Object.keys(sources).length,reportMismatches:Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,v.sourceMismatches])),unitFailures:Object.keys(units).filter(k=>!units[k].passed)}));
