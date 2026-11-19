// Source/evidence-first local WIP collector. Importing is read-only; no tests,
// browser, package builder or publication process is launched by this module.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {runtimeHashes} from './source-binding.mjs';
import {localAssetRoot} from '../local-asset-store.mjs';

export const TASK='sunbreak-river-material-combat-polish-2026-11-19';
export const BASELINE='d5b2114d07e1496824b6b788757364412e18908e';
export const LEGACY_SHA256='f871365d9b6ed35566a313d242b4bebf4c5b8b0ff235984bce1680fe15fcfad8';
export const SUITES=Object.freeze(['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks','vegetation-clumps','water-checks','wildbank-checks','surface-checks','masonry-materials-checks','height-fog-checks','downloaded-dressing-checks','environment-polish-checks','shot-feedback-event-checks','polish-preservation-checks','stone-cover-checks','combat-feedback-checks']);
export const suiteArgs=name=>['--stdout-only',...(['map-checks','masonry-materials-checks'].includes(name)?['--polish']:[])];
export const IMAGES=Object.freeze({polish:['hero','stone-close','plaster-close','plaster-sun','ground-growth','forest-belt','forest-lateral','sun-gun','turned-gun','sheltered-gun','timber-close','stone-impact','earth-impact','water-impact','sky-miss','blocked-barrel','ads-clear','ads-shot'],checks:['checks-final'],cabins:['cabins-final'],traversal:['traversal-final'],weather:['weather-sunny'],'imported-fallback':['fallback-path']});
export const COUNTS=Object.freeze({polish:14,checks:32,cabins:17,traversal:54,weather:4,'imported-fallback':2});
export const EXTRA_EVIDENCE=Object.freeze(['quick.png','quick.json','quick-1.json'].map(n=>'qa/evidence/quick-2026-11-19T08-37-47-703Z/'+n));
const POLISH_CHECKS=['licensed weapon and all textures loaded','actual world sun rotates with view and indoor shelter attenuates direct light','bounded environmental and combat pools',...['stone-impact','earth-impact','water-impact','sky-miss','blocked-barrel'].flatMap(n=>[n+' real accepted shot: material, first-hit position, outward normal and barrel guard',n+' particles and flash expire']),'real ADS pose accepts a bounded shot (visual flare readability reviewed separately)'];
export const COMPANIONS=Object.freeze(['qa/polish-units.json','qa/polish-review.json','qa/polish-package.json','qa/downloaded-private-backup.json','qa/checkpoint-polish.mjs','qa/audit-polish-stage.mjs','qa/run-polish-units.mjs','qa/browser.mjs','qa/hooks.js','qa/source-binding.mjs','tools/package.mjs',...SUITES.map(n=>'qa/'+n+'.mjs')]);
const PACKAGE_RUNTIME=['index.html','world.js','village.js','ruins.js','fracture-geometry.js','buffer-house.js','buffer-house-logic.js','timber-house.js','house-logic.js','vegetation.js','map-layout.js','terrain-ray.js','weapon.js','actors.js','audio.js','storm-audio.js','tactical-ai.js','boot-ui.js','combat-controls.js','reload-pose.js','credits.html','asset-sources.json','foliage-derivatives.json','foliage-revision.json','fable-production.json','fable-art-revision.json','weapon-provenance.json','soldier-provenance.json','distant-landscape.js','riverbank-detail.js','river-water.js','ground-moisture.js','daylight-assets.json','afterrain-assets.json','wild-grass-assets.json','ground-surface.js','ground-surface-assets.json','height-fog.js','masonry-materials.js','downloaded-dressing.js','environment-polish.js','stone-cover.js','combat-feedback.js','shot-feedback-event.js'];
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..');
export const sha=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const exactSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&same([...a].sort(),[...b].sort());
const mismatch=(a,b)=>[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(k=>a?.[k]!==b?.[k]);
export function safeRelative(p){return typeof p==='string'&&p.length>0&&!p.includes('\\')&&!p.includes(':')&&!p.startsWith('/')&&p.split('/').every(s=>s&&s!=='.'&&s!=='..')}
export function phasePath(phase,p){return safeRelative(p)&&new RegExp('^qa/evidence/'+phase+'-2026-11-19T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z/'+phase+'-(failure-)?[1-9]\\d*\\.json$').test(p)}
export function validateSelection(selection){
 return !!selection&&exactSet(Object.keys(selection.reports||{}),Object.keys(IMAGES))&&Object.keys(IMAGES).every(p=>phasePath(p,selection.reports[p]))&&phasePath('sunny-benchmark',selection.sunnyBenchmark)&&Array.isArray(selection.stormBenchmarks)&&selection.stormBenchmarks.length===2&&new Set(selection.stormBenchmarks).size===2&&selection.stormBenchmarks.every(p=>phasePath('benchmark',p));
}
export function validateUnits(units,sources,testHashes){
 const failures=[];
 if(units.required!==21||!exactSet(Object.keys(units.units||{}),SUITES))failures.push('exact 21 suite names required');
 if(units.pass!==true||units.unchanged!==true||mismatch(sources,units.sources).length)failures.push('CPU result or initial/final source binding stale/failed');
 for(const name of SUITES){const u=units.units?.[name];if(!u||u.pass!==true||u.exit!==0||u.signal!=null||u.testUnchanged!==true||u.classification!=='required'||!same(u.args,suiteArgs(name))||u.testSHA256!==testHashes['qa/'+name+'.mjs']||u.result?.pass===false||u.result?.verdict==='FAIL')failures.push(name)}
 return{valid:failures.length===0,failures,required:21};
}
export function performanceIntegrity(b){
 const timeline=rows=>Array.isArray(rows)&&rows.length>0&&rows.every((r,i)=>Number.isFinite(r.frame_ms)&&r.frame_ms>0&&Number.isFinite(r.elapsed_ms)&&Math.abs(r.elapsed_ms-(i?rows[i-1].elapsed_ms:0)-r.frame_ms)<.001);
 if(!timeline(b?.raw)||!timeline(b?.warmupRaw))return false;
 const sorted=b.raw.map(r=>r.frame_ms).sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
 return b.duration===b.raw.at(-1).elapsed_ms&&b.warmup?.declaredSeconds===10&&b.warmupRaw.at(-1).elapsed_ms<10000&&b.warmupRaw.at(-1).elapsed_ms+b.raw[0].frame_ms>=10000&&b.p50===pct(.5)&&b.p95===pct(.95)&&b.p99===pct(.99)&&b.max===sorted.at(-1)&&b.over50===b.raw.filter(r=>r.frame_ms>50).length;
}

export async function collectPolishCheckpoint(){
 const sources=await runtimeHashes(),consumed=Object.fromEntries(Object.entries(sources).filter(([p])=>p.startsWith('local-only/'))),reads=new Map();
 const bytes=async p=>{assert.ok(safeRelative(p),'Unsafe collector path '+p);const b=await readFile(resolve(root,p)),h=sha(b);if(reads.has(p))assert.equal(reads.get(p),h,'Evidence changed while collecting '+p);reads.set(p,h);return b};
 const json=async p=>JSON.parse(await bytes(p));
 const optional=async p=>{try{return await json(p)}catch(e){if(e.code==='ENOENT')return {};throw e}};
 const localBytes=await readFile(resolve(localAssetRoot,'manifest.json')),local=JSON.parse(localBytes),privateManifestSHA256=sha(localBytes);
 const localValid=d=>d?.enabled===true&&d.status==='local-only'&&Array.isArray(d.errors)&&!d.errors.length&&Object.keys(consumed).length>2&&!mismatch(consumed,d.consumedHashes).length;
 const dressingValid=(phase,d)=>phase==='imported-fallback'?d?.enabled===false&&d.status==='baseline'&&Array.isArray(d.errors)&&!d.errors.length&&Object.keys(d.consumedHashes||{}).length===0:localValid(d);
 const review=await optional('qa/polish-review.json'),selection=review.selection||null,selectionValid=validateSelection(selection);
 const companions={};for(const p of COMPANIONS){try{companions[p]=sha(await bytes(p))}catch(e){if(e.code!=='ENOENT')throw e;companions[p]=null}}
 const units=await optional('qa/polish-units.json'),unitsValidation=validateUnits(units,sources,companions);
 const reports={},visuals=[],retained=[],allEvidence=[],phaseReports=new Map();
 const phases=[...Object.keys(IMAGES),'sunny-benchmark','benchmark'];
 // Retain EVERY report, including failed current runs and partial attempts.
 // Selection is explicit, never "latest passing" or a source-filtered sample.
 for(const dir of (await readdir(resolve(root,'qa/evidence'),{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort()){
  const phase=phases.find(p=>dir.startsWith(p+'-2026-11-19T'));if(!phase)continue;
  for(const file of (await readdir(resolve(root,'qa/evidence',dir))).sort()){
   const p='qa/evidence/'+dir+'/'+file;
   if(phasePath(phase,p)){
    const r=await json(p),first=r.results?.[0]?.details,last=r.results?.at(-1);
    const item={path:p,sha256:reads.get(p),pass:r.pass===true,checks:r.results?.length||0,initialSourceMismatches:mismatch(sources,first?.buildHashes),finalSourceMismatches:last?.source?mismatch(sources,last.source):null,localAssetsValid:dressingValid(phase,first?.dressing),errors:r.errors||[],resultFailures:(r.results||[]).filter(c=>c.pass!==true).map(c=>c.name),failure:r.error||null};
    phaseReports.set(p,{phase,raw:r,item});allEvidence.push({path:p,sha256:reads.get(p)});
   }else if((IMAGES[phase]||[]).some(n=>file===n+'.png'||file===n+'.json')){await bytes(p);allEvidence.push({path:p,sha256:reads.get(p)})}
  }
 }
 const development='qa/evidence/polish-cpu-development-2026-11-19.json';
 try{await bytes(development);allEvidence.push({path:development,sha256:reads.get(development)})}catch(e){if(e.code!=='ENOENT')throw e}
 for(const path of EXTRA_EVIDENCE){await bytes(path);allEvidence.push({path,sha256:reads.get(path)})}
 const quick=await json(EXTRA_EVIDENCE[2]);retained.push({path:EXTRA_EVIDENCE[2],sha256:reads.get(EXTRA_EVIDENCE[2]),pass:quick.pass===true,status:'INTERMEDIATE QUICK DIAGNOSTIC ONLY — never final acceptance',failure:quick.error||null});
 const selected=new Set();
 for(const [phase,names]of Object.entries(IMAGES)){
  const p=selection?.reports?.[phase],found=phasePath(phase,p)?phaseReports.get(p):null;
  if(!found){reports[phase]={missing:true,path:p||null,pass:false};continue}
  selected.add(p);const entry={...found.item},dir=p.slice(0,p.lastIndexOf('/'));
  entry.imageMembershipValid=exactSet((await readdir(resolve(root,dir))).filter(f=>f.endsWith('.png')),names.map(n=>n+'.png'));
  entry.checkContractValid=found.raw.phase===phase&&entry.checks===COUNTS[phase]&&entry.resultFailures.length===0&&entry.errors.length===0;
  if(phase==='polish')entry.checkContractValid&&=same(found.raw.results.map(r=>r.name),POLISH_CHECKS);
  for(const name of names){
   const path=dir+'/'+name+'.png',statePath=dir+'/'+name+'.json';
   try{
    const b=await bytes(path),state=await json(statePath),png=b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.toString('ascii',12,16)==='IHDR';
    const v={path,sha256:sha(b),statePath,stateSHA256:reads.get(statePath),width:png?b.readUInt32BE(16):0,height:png?b.readUInt32BE(20):0,sourceMismatches:mismatch(sources,state.buildHashes),localAssetsValid:dressingValid(phase,state.dressing),stateValid:same(state.viewport,[1920,1080])&&Array.isArray(state.errors)&&!state.errors.length};
    v.valid=v.width===1920&&v.height===1080&&v.sourceMismatches.length===0&&v.localAssetsValid&&v.stateValid;visuals.push(v);
    if(name===names.at(-1))entry.finalSourceMismatches=v.sourceMismatches;
   }catch(e){if(e.code!=='ENOENT')throw e;visuals.push({path,statePath,valid:false,missing:true})}
  }
  entry.valid=entry.pass&&entry.checkContractValid&&entry.imageMembershipValid&&entry.localAssetsValid&&entry.initialSourceMismatches.length===0&&entry.finalSourceMismatches?.length===0&&visuals.filter(v=>v.path.startsWith(dir+'/')).every(v=>v.valid);
  reports[phase]=entry;
 }
 const perfPaths=[selection?.sunnyBenchmark,...(Array.isArray(selection?.stormBenchmarks)?selection.stormBenchmarks:[])],perf=[];
 for(const [i,p]of perfPaths.entries()){
  const phase=i===0?'sunny-benchmark':'benchmark',found=phasePath(phase,p)?phaseReports.get(p):null;
  if(!found){perf.push({path:p||null,missing:true,pass:false,valid:false});continue}
  selected.add(p);const b=found.raw.results?.at(-1),entry={...found.item,weather:b?.weather,viewport:b?.viewport,renderer:b?.renderer,duration:b?.duration,p95:b?.p95,p99:b?.p99,max:b?.max,over50:b?.over50,timelineValid:performanceIntegrity(b),workloadValid:b?.stress?.shots>=90&&b?.stress?.tactical?.totalShots>0&&b?.stress?.tactical?.totalMovementMeters>0&&b?.audio?.byType?.magin>0&&b?.audio?.active===true&&b?.audio?.errors===0};
  entry.valid=found.raw.phase===phase&&entry.checks===2&&entry.errors.length===0&&entry.initialSourceMismatches.length===0&&entry.finalSourceMismatches?.length===0&&entry.localAssetsValid&&entry.timelineValid&&entry.workloadValid&&entry.weather===(i?2:0)&&same(entry.viewport,[1920,1080])&&typeof entry.renderer==='string'&&!/swiftshader|software/i.test(entry.renderer)&&entry.duration>=30000;
  perf.push(entry);
 }
 reports['sunny-benchmark']=perf[0];reports.benchmark=perf.slice(1);
 for(const [p,{item}]of phaseReports)if(!selected.has(p))retained.push(item);
 const performancePass=selectionValid&&perf.length===3&&perf.every(p=>p.valid&&p.pass&&p.p95<=33.3&&p.p99<=33.3&&p.max<=50&&p.over50===0);
 const expectedArt=visuals.filter(v=>v.path.startsWith((selection?.reports?.polish||'MISSING').replace(/\/[^/]+$/,'')+'/')).map(v=>v.path),declared=review.declaredReviewSet,evidence=review.evidence||[];
 const coverage=exactSet(declared,expectedArt)&&expectedArt.length===18&&exactSet(evidence.map(v=>v.path),declared);
 const reviewValid=selectionValid&&coverage&&review.sourcesDigest===sha(JSON.stringify(sources))&&['PASS','CONDITIONAL PASS','REVISE','BLOCKED'].includes(review.verdict)&&evidence.every(e=>visuals.some(v=>v.valid&&v.path===e.path&&v.sha256===e.sha256&&v.stateSHA256===e.stateSHA256));
 const packageReport=await optional('qa/polish-package.json'),packageErrors=[];
 try{
  const manifests={};for(const p of ['foliage-revision','afterrain-assets','wild-grass-assets','ground-surface-assets'])manifests[p]=await json(p+'.json');
  const assets=[];async function walk(dir){for(const d of await readdir(resolve(root,dir),{withFileTypes:true})){assert.ok(!d.isSymbolicLink(),'Package symlink '+dir+'/'+d.name);const p=dir+'/'+d.name;if(d.isDirectory())await walk(p);else{assert.ok(d.isFile(),'Nonregular package input');assets.push(p)}}}await walk('assets');
  const expected=[...PACKAGE_RUNTIME,...assets.filter(p=>(!p.startsWith('assets/island_tree_02/')||/\/(tree-lod\.glb|tree-far\.glb|alpha\.png)$/.test(p))&&(!p.startsWith('assets/foliage-revision/')||manifests['foliage-revision'].publicWhitelist.includes(p))&&(!p.startsWith('assets/afterrain-detail/')||manifests['afterrain-assets'].publicWhitelist.includes(p))&&(!p.startsWith('assets/wild-grass/')||manifests['wild-grass-assets'].publicWhitelist.includes(p))&&(!p.startsWith('assets/ground-surfaces/')||manifests['ground-surface-assets'].publicWhitelist.includes(p)))];
  assert.equal(packageReport.pass,true);assert.equal(packageReport.schema,'river-public-package-exclusion-v1');assert.equal(packageReport.builderSHA256,companions['tools/package.mjs']);assert.equal(packageReport.privateBinariesIncluded,false);assert.equal(packageReport.publiclyDeployed,false);
  assert.equal(packageReport.privateManifestSHA256,privateManifestSHA256);assert.equal(privateManifestSHA256,sources['local-only/manifest.json']);assert.equal(packageReport.privateGLBsChecked,local.assets.length);
  assert.ok(exactSet((packageReport.packageFiles||[]).map(f=>f.path),expected),'complete unique package membership');assert.equal(packageReport.files,expected.length);
  let total=0;for(const f of packageReport.packageFiles){assert.ok(safeRelative(f.path));const b=await bytes(f.path);assert.equal(b.length,f.bytes,'package size '+f.path);assert.equal(sha(b),f.sha256,'package hash '+f.path);assert.ok(!local.assets.some(a=>a.sha256===f.sha256||f.path.split('/').at(-1)===a.file),'renamed private asset in package');total+=b.length}assert.equal(total,packageReport.bytes,'complete package byte total');
  const shared=JSON.parse(execFileSync('git',['show','origin/main:sunbreak/public-release.json'],{cwd:repo,maxBuffer:12e6}));
  const files=shared.files.filter(f=>/^(assets\/|vendor\/|assets-manifest\.json$|weapon-provenance\.json$|soldier-provenance\.json$|credits\.html$)/.test(f.path));assert.equal(packageReport.sharedDependenciesVerified,files.length);
  for(const f of files){assert.ok(safeRelative(f.path));assert.equal(sha(await readFile(resolve(root,'../sunbreak-storm-v3',f.path))),f.sha256,'shared package dependency '+f.path)}
 }catch(e){packageErrors.push(e.message)}
 const legacyPath='qa/downloaded-release.json',legacyBlob=execFileSync('git',['show',BASELINE+':experiments/sunbreak-river-v4/'+legacyPath],{cwd:repo,maxBuffer:20e6}),legacyCurrent=await bytes(legacyPath);
 const legacy={path:legacyPath,baseline:BASELINE,baselineSHA256:sha(legacyBlob),sha256:sha(legacyCurrent),unchanged:sha(legacyBlob)===LEGACY_SHA256&&sha(legacyCurrent)===LEGACY_SHA256};
 const sourcesAfter=await runtimeHashes(),changedReads=[];for(const [p,h]of reads)if(sha(await readFile(resolve(root,p)))!==h)changedReads.push(p);
 const sourceStable=mismatch(sources,sourcesAfter).length===0&&changedReads.length===0&&sha(await readFile(resolve(localAssetRoot,'manifest.json')))===privateManifestSHA256;
 assert.ok(sourceStable,'Source/evidence changed during collection; do not replace the prior checkpoint');
 const functional=sourceStable&&unitsValidation.valid&&selectionValid&&Object.keys(IMAGES).every(p=>reports[p]?.valid)&&visuals.length===23&&visuals.every(v=>v.valid);
 return {schema:'river-material-combat-polish-checkpoint-v2',protocol:'offscreen-cinematic-v1',task:TASK,date:new Date().toISOString(),verdict:'BLOCKED',scope:'Local WebGL source/evidence WIP only; not Unreal/AAA/public release or continuous-motion acceptance.',sources,sourceBindings:{initialDigest:sha(JSON.stringify(sources)),finalDigest:sha(JSON.stringify(sourcesAfter)),stable:sourceStable,changedReads},functional,units:'qa/polish-units.json',unitsValidation,selection,selectionValid,reports,visuals,retained,allEvidence,performance:{verdict:performancePass?'PASS':'BLOCKED',samples:perf,requirements:{viewport:[1920,1080],warmupMS:10000,durationMS:30000,p95:33.3,p99:33.3,max:50,over50:0,sunnySamples:1,stormSamples:2}},review:{path:'qa/polish-review.json',current:reviewValid,coverage,verdict:review.verdict||'PENDING'},package:{path:'qa/polish-package.json',current:packageErrors.length===0,errors:packageErrors,files:packageReport.files,bytes:packageReport.bytes,privateManifestSHA256},legacy,companions,continuousMotion:'UNVERIFIED — stills are not continuous video',publicRelease:'UNCHANGED',privateBackup:{pointer:'qa/downloaded-private-backup.json',newBinaryChanges:false,canonicalUEVault:'Unrelated pre-existing dirty state preserved'},next:'Current evidence/art rework and strict pacing investigation; no public promotion.'};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const report=await collectPolishCheckpoint();
 if(!process.argv.includes('--stdout-only'))for(const p of ['qa/polish-release.json','qa/release.json'])await writeFile(resolve(root,p),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}
