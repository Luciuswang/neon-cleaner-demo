// Records current evidence without promoting WIP art or missing continuous video.
import {readFile,writeFile,readdir,access,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runtimeHashes} from './source-binding.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'qa'),evidence=resolve(qa,'evidence');
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const sources=await runtimeHashes(),dirs=(await readdir(evidence)).sort(),rel=p=>relative(root,p).replaceAll('\\','/');
const mismatches=h=>Object.entries(sources).filter(([p,v])=>h?.[p]!==v).map(([p])=>p);
async function report(dir,phase){
 if(!dir)return{pass:false,missing:phase};
 const path=resolve(evidence,dir,phase+'-1.json');
 try{
  const r=await read(path),b=r.results?.at(-1),bindings=b?.source||r.results?.[0]?.details?.buildHashes;
  return{path:rel(path),sha256:sha(await readFile(path)),pass:r.pass,checks:r.results.length,sourceMismatches:mismatches(bindings),
   ...(b?.duration?{weather:b.weather,duration:b.duration,p50:b.p50,p95:b.p95,p99:b.p99,max:b.max,over50:b.over50,viewport:b.viewport,renderer:b.renderer,shots:b.stress.shots}:{})};
 }catch(e){return{pass:false,path:rel(path),missing:e.message}}
}
const reports={};for(const phase of ['wildbank','afterrain','map','art','weather','cabins','checks','traversal','water-samples'])reports[phase]=await report(dirs.filter(d=>d.startsWith(phase+'-')).at(-1),phase);
const storm=[];for(const dir of dirs.filter(d=>d.startsWith('benchmark-')).slice(-2))storm.push(await report(dir,'benchmark'));
const sunny=await report(dirs.filter(d=>d.startsWith('sunny-benchmark-')).at(-1),'sunny-benchmark');
const units={};for(const name of ['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks','vegetation-clumps','water-checks','wildbank-checks']){
 const r=spawnSync(process.execPath,[resolve(qa,name+'.mjs')],{encoding:'utf8',windowsHide:true,maxBuffer:8e6});let detail;
 try{detail=JSON.parse(r.stdout)}catch{detail={stdout:r.stdout}}
 units[name]={passed:r.status===0,testSHA256:sha(await readFile(resolve(qa,name+'.mjs'))),...detail,error:r.stderr||undefined};
}
await writeFile(resolve(qa,'wildbank-units.json'),JSON.stringify({sources,units},null,2)+'\n');
const review=await read(resolve(qa,'wildbank-review.json'));
const performancePass=storm.length===2&&storm.every(r=>r.weather===2&&r.pass&&!r.sourceMismatches?.length)&&sunny.weather===0&&sunny.pass&&!sunny.sourceMismatches?.length;
const functional=Object.values(reports).every(r=>r.pass&&r.sourceMismatches?.length===0)&&Object.values(units).every(r=>r.passed);
const visuals=[];
for(const phase of ['wildbank','afterrain','water-samples']){
 const dir=dirs.filter(d=>d.startsWith(phase+'-')).at(-1);if(!dir)continue;
 for(const name of await readdir(resolve(evidence,dir)))if(name.endsWith('.png')){
  const p=resolve(evidence,dir,name),b=await readFile(p),state=await read(p.replace('.png','.json'));
  visuals.push({path:rel(p),sha256:sha(b),statePath:rel(p.replace('.png','.json')),stateSHA256:sha(await readFile(p.replace('.png','.json'))),width:b.readUInt32BE(16),height:b.readUInt32BE(20),sourceMismatches:mismatches(state.buildHashes),waterTime:state.water?.time});
 }
}
for(const [file,backup]of [['release.json','previous-reference-water-release-2026-11-18.json'],['independent-review.json','previous-reference-water-review-2026-11-18.json']]){
 try{await access(resolve(qa,backup))}catch{await copyFile(resolve(qa,file),resolve(qa,backup))}
}
await writeFile(resolve(qa,'independent-review.json'),JSON.stringify({...review,sources},null,2)+'\n');
const result={schema:'river-wildbank-checkpoint-v1',protocol:'offscreen-cinematic-v1',captureMethod:'native-headless actual browser WebGL canvas, NOT UE SceneCapture or desktop capture',
 task:'sunbreak-river-wildbank-2026-11-18',date:new Date().toISOString(),verdict:'BLOCKED',
 scope:'Targeted playable visual WIP. Source checkpoint only; no AAA/UE5 parity, Pages release or continuous-motion acceptance.',
 developmentEvidence:[
  {path:'qa/evidence/wildbank-2026-11-18T11-09-47-525Z/',status:'INTERMEDIATE',note:'Old pale grass; early wet/dry and ford correction.'},
  {path:'qa/evidence/traversal-2026-11-18T11-13-05-439Z/traversal-failure-1.json',status:'FAIL RETAINED',note:'New assertion incorrectly required continuous contact in unchanged deep channel z=0; observed3.728cm positive ballistic gap, no sinking. Modified fords keep original3cm bound; deepchannel retains no-penetration and endpoint contact.'},
  {path:'qa/evidence/cabins-2026-11-18T11-38-35-358Z/cabins-failure-1.json',status:'FAIL RETAINED',note:'East close E had no selected door: near=true, visible=false, toggles1. Exact pre-close player position was not captured, so precise cause remains unproven. Replaced open-loop timed retreat with actual key movement to measured porch position and explicit selection assertion; no runtime door change. Corrected test passes17 checks.'},
  {path:'qa/evidence/wildbank-2026-11-18T11-16-51-494Z/',status:'REJECTED',note:'First grass atlas pass fluorescent and broad paper-ribbon silhouettes.'},
  {path:'qa/evidence/wildbank-2026-11-18T11-24-16-085Z/',status:'REVISE',note:'Olive palette, ford continuity and wet/dry approved within still scope; repeated upright grass fan silhouettes need more variation.'}
 ],
 sources,functional,reports,visuals,unitReport:'qa/wildbank-units.json',independentReview:'qa/independent-review.json',
 performance:{verdict:performancePass?'PASS':'BLOCKED',storm,sunny,requirements:{width:1920,height:1080,durationMS:30000,warmupMS:10000,p95MS:33.3,p99MS:33.3,maxMS:50,over50:0,stormSamples:2}},
 temporal:{verdict:'UNVERIFIED',sampledFrames:'Six timed live-gameplay native renders; not a complete sequence review',
  recordingFailures:['qa/evidence/water-motion-2026-11-18T09-35-21-053Z/water-motion-failure-1.json','qa/evidence/water-motion-2026-11-18T09-38-02-368Z/water-motion-failure-1.json'],cause:'Unknown; retain prior direct/copied-canvas recording timeouts. No unchanged retry or video acceptance.'},
 changes:['Former dry earth fords now submerged gravel shelves; matching terrain support and GLSL depth, central bridge preserved.',
 'Geographic irregular wet-bank to dry-village transition changes albedo, roughness, normal response and puddle visibility.',
 'Redistributable source-backed mixed wild-grass replacement with provenance and bounded runtime budget.'],
 preserved:'weapon/actor/combat, buildings, original tree transforms and earlier four demos; no private asset edits',
 publication:{status:'NOT UPDATED',localPreview:'http://127.0.0.1:5190/river/',previousPublicURL:'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/'},
 privateAssets:'Unrelated dirty private vault preserved; isolated public-browser checkpoint skips private transfers, not full UE/private portability.'};
for(const d of result.developmentEvidence)if(d.path.endsWith('.json'))d.sha256=sha(await readFile(resolve(root,d.path)));
await writeFile(resolve(qa,'release.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({verdict:result.verdict,functional,performance:result.performance.verdict,art:review.art.verdict,sourceBindings:Object.keys(sources).length,reportMismatches:Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,v.sourceMismatches])),unitFailures:Object.keys(units).filter(k=>!units[k].passed)}));
