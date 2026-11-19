// Current local scan WIP, never a public-release promotion.
import {readFile,writeFile,readdir,copyFile,access} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runtimeHashes} from './source-binding.mjs';
import {localAssetRoot,localAssetSnapshot} from '../local-asset-store.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'qa'),ev=resolve(qa,'evidence'),sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8')),rel=p=>relative(root,p).replaceAll('\\','/');
const sources=await runtimeHashes(),mismatch=h=>[...new Set([...Object.keys(sources),...Object.keys(h||{})])].filter(k=>h?.[k]!==sources[k]);
const expectedLocal=Object.fromEntries(Object.entries(sources).filter(([k])=>k.startsWith('local-only/')));
const consumedCurrent=d=>d?.enabled===true&&[...new Set([...Object.keys(expectedLocal),...Object.keys(d.consumedHashes||{})])].every(k=>expectedLocal[k]===d.consumedHashes?.[k]);
for(const file of ['release.json','independent-review.json']){const backup=resolve(qa,'previous-surface-'+file);try{await access(backup)}catch{await copyFile(resolve(qa,file),backup)}}
const units={};
for(const name of ['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks','vegetation-clumps','water-checks','wildbank-checks','surface-checks','masonry-materials-checks','height-fog-checks','downloaded-dressing-checks']){
 const r=spawnSync(process.execPath,[resolve(qa,name+'.mjs')],{encoding:'utf8',windowsHide:true,maxBuffer:12e6});let result;try{result=JSON.parse(r.stdout)}catch{result={stdout:r.stdout}}
 units[name]={pass:r.status===0,testSHA256:sha(await readFile(resolve(qa,name+'.mjs'))),result,error:r.stderr||undefined};console.log(name+': '+(r.status===0?'PASS':'FAIL'));
}
await writeFile(resolve(qa,'downloaded-units.json'),JSON.stringify({sources,units},null,2)+'\n');
const store=await localAssetSnapshot(),local=await read(resolve(localAssetRoot,'manifest.json'));
let backup;try{backup=await read(resolve(qa,'downloaded-private-backup.json'))}catch{backup={status:'BLOCKED'}};
const backupVerified=backup.status==='VERIFIED'&&backup.manifestSHA256===store.hashes['local-only/manifest.json']&&backup.files===local.assets.length&&backup.bytes===store.manifest.bytes&&backup.remoteLFSFreshCacheVerified===true;
const sanitize=v=>typeof v==='string'?(/^[a-z]:[\\/]/i.test(v)?v.replaceAll('\\','/').split('/').at(-1):v):Array.isArray(v)?v.map(sanitize):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,sanitize(value)])):v;
const inventory={schema:'local-import-inventory-v1',manifestSHA256:store.hashes['local-only/manifest.json'],bytes:store.manifest.bytes,assets:sanitize(local.assets),publicRedistribution:false,
 excluded:[{id:'tree_goat_willow_01_usd',reason:'USD contains constant-colour materials and no supplied PBR texture maps; no fake replacement materials created.'},{id:'base_mesh',sha256:'8767f58475863abd4ba5c32b100d7c92d998a1b5d39a0ff6ebb108f4e57eb717',bytes:105978740,triangles:79060,reason:'Rigged humanoid/armour/hair/weapons, not an environment asset; 27 skins/131 joints, no animation and likely broken rest binding. Existing NPCs preserved.'},{id:'Modular_Rural_Cabin',reason:'UE Marketplace binaries, preserved/excluded from public Git; not directly usable in Three/WebGL.'}],
 restoration:backupVerified?'Selected derivatives: run tools/backup-downloaded-assets.py restore using authorized access to the existing private repository. Public pointer: qa/downloaded-private-backup.json. Originals remain in user Downloads; no complete UE portability claim.':'Use original user downloads and committed import-downloaded-assets.py / import-downloaded-house.py converters. Local GLBs are intentionally absent from public Git. Private backup is not currently verified; no full cross-PC portability claim.'};
await writeFile(resolve(qa,'downloaded-asset-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
const dirs=(await readdir(ev)).sort(),reports={},visuals=[],retained=[],diagnostics=[];
for(const phase of ['imported-assets','imported-fallback','checks','cabins','traversal','weather','sunny-benchmark','benchmark']){
 const matching=[];
 for(const d of dirs.filter(d=>d.startsWith(phase+'-2026-11-19T'))){
  for(const name of (await readdir(resolve(ev,d))).filter(n=>new RegExp('^'+phase+'-(failure-)?\\d+\\.json$').test(n))){
   const p=resolve(ev,d,name),r=await read(p),binding=r.results?.at(-1)?.source||r.results?.[0]?.details?.buildHashes;
   const mismatches=mismatch(binding),b=r.results?.at(-1);
   const dressing=r.results?.[0]?.details?.dressing;
   const identityValid=phase==='imported-fallback'?dressing?.enabled===false:consumedCurrent(dressing);
   const item={path:rel(p),sha256:sha(await readFile(p)),pass:!!r.pass&&identityValid,checks:r.results?.length||0,sourceMismatches:mismatches,imported:dressing?.enabled,identityValid};
   if(b?.raw){const sorted=b.raw.map(x=>x.frame_ms).sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
    const timeline=rows=>rows?.length&&rows.every((x,i)=>x.frame_ms>0&&Math.abs(x.elapsed_ms-(i?rows[i-1].elapsed_ms:0)-x.frame_ms)<.001);
    Object.assign(item,{weather:b.weather,duration:b.duration,p50:b.p50,p95:b.p95,p99:b.p99,max:b.max,over50:b.over50,viewport:b.viewport,renderer:b.renderer,
     workloadVerified:b.stress?.shots>=90&&b.stress?.tactical?.totalShots>0&&b.stress?.tactical?.totalMovementMeters>0&&b.audio?.byType?.magin>0&&b.audio?.active&&!b.audio?.errors,
     timelineVerified:!!timeline(b.raw)&&!!timeline(b.warmupRaw)&&b.duration===b.raw.at(-1).elapsed_ms&&b.warmup.declaredSeconds===10&&b.warmupRaw.at(-1).elapsed_ms<10000&&b.warmupRaw.at(-1).elapsed_ms+b.raw[0].frame_ms>=10000&&b.p50===pct(.5)&&b.p95===pct(.95)&&b.p99===pct(.99)&&b.max===sorted.at(-1)&&b.over50===b.raw.filter(x=>x.frame_ms>50).length});
   }
   if(dressing&&!!dressing.enabled!==(phase!=='imported-fallback'))diagnostics.push({...item,status:'DIAGNOSTIC ONLY: layer differs from acceptance target'});
   else if(!mismatches.length)matching.push(item);else retained.push({...item,status:'INTERMEDIATE / SOURCE SUPERSEDED'});
  }
 }
 reports[phase]=phase==='benchmark'?matching:matching.at(-1)||{missing:true};
 for(const r of matching.slice(0,phase==='benchmark'?matching.length:-1))if(!r.pass)retained.push({...r,status:'FAILED CURRENT RUN RETAINED'});
}
for(const phase of ['imported-assets','imported-fallback','checks','cabins','traversal','weather']){
 const r=reports[phase];if(!r.path)continue;const dir=resolve(root,r.path,'..');
 for(const name of (await readdir(dir)).filter(n=>n.endsWith('.png'))){const p=resolve(dir,name),b=await readFile(p),side=p.replace(/\.png$/,'.json'),s=await read(side);visuals.push({path:rel(p),sha256:sha(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20),statePath:rel(side),stateSHA256:sha(await readFile(side)),sourceMismatches:mismatch(s.buildHashes),imported:s.dressing?.enabled,consumedCurrent:phase==='imported-fallback'?s.dressing?.enabled===false:consumedCurrent(s.dressing)})}
}
let review;try{review=await read(resolve(qa,'downloaded-review.json'))}catch{review={status:'PENDING'}};
const reviewBinding={sourceValid:review.sourcesSHA256===sha(JSON.stringify(sources)),evidence:[]};
for(const item of review.evidence||[]){
 const actual=visuals.find(v=>v.path===item.path);
 reviewBinding.evidence.push({path:item.path,valid:!!actual&&actual.sha256===item.sha256&&actual.stateSHA256===item.stateSHA256&&!actual.sourceMismatches.length});
}
const declared=review.declaredReviewSet||[];
reviewBinding.coverage=declared.length>0&&new Set(declared).size===declared.length&&new Set((review.evidence||[]).map(e=>e.path)).size===declared.length&&declared.every(p=>review.evidence.some(e=>e.path===p));
reviewBinding.valid=reviewBinding.sourceValid&&reviewBinding.coverage&&reviewBinding.evidence.every(e=>e.valid);
let packageReport;try{packageReport=await read(resolve(qa,'downloaded-package.json'))}catch{packageReport={pass:false}};
let packageCurrent=packageReport.pass&&packageReport.privateGLBsChecked===local.assets.length&&packageReport.privateManifestSHA256===store.hashes['local-only/manifest.json']&&packageReport.builderSHA256===sha(await readFile(resolve(root,'tools/package.mjs')))&&packageReport.packageFiles?.length===packageReport.files&&packageReport.files>0&&['index.html','world.js','downloaded-dressing.js'].every(p=>packageReport.packageFiles.some(f=>f.path===p));
for(const f of packageReport.packageFiles||[])if(f.path.includes('..')||resolve(root,f.path).startsWith(root)===false||sha(await readFile(resolve(root,f.path)))!==f.sha256)packageCurrent=false;
const expectedViews=['path','ruin','grass','chips','boundary','settlement','house-north','house-south','wide'].map(n=>'imported-'+n).concat(local.assets.map(a=>'asset-'+a.id));
const visualCoverage=expectedViews.every(name=>visuals.some(v=>v.path.includes('/imported-assets-')&&v.path.endsWith('/'+name+'.png')&&v.imported))&&['fallback-path','checks-final','cabins-final','traversal-final','weather-sunny'].every(name=>visuals.some(v=>v.path.endsWith('/'+name+'.png')));
const minimumChecks={'imported-assets':3,'imported-fallback':2,checks:32,cabins:17,traversal:54,weather:4};
const functional=Object.values(units).every(r=>r.pass)&&Object.entries(minimumChecks).every(([p,n])=>reports[p].pass&&reports[p].checks>=n)&&visualCoverage&&visuals.every(v=>v.width===1920&&v.height===1080&&!v.sourceMismatches.length&&v.consumedCurrent);
const perf=[reports['sunny-benchmark'],...reports.benchmark],performancePass=perf.length===3&&perf.every((p,i)=>p.pass&&p.imported&&p.timelineVerified&&p.workloadVerified&&p.weather===(i?2:0)&&p.viewport?.[0]===1920&&p.viewport?.[1]===1080&&!/swiftshader|software/i.test(p.renderer||'software')&&p.duration>=30000&&p.p95<=33.3&&p.p99<=33.3&&p.max<=50&&p.over50===0);
const report={schema:'river-downloaded-local-assets-checkpoint-v1',protocol:'offscreen-cinematic-v1',task:'sunbreak-river-downloaded-assets-2026-11-19',date:new Date().toISOString(),verdict:'BLOCKED',scope:'Local imported-asset WIP; not AAA/UE5, public release or continuous-motion acceptance.',sources,functional,reports,visuals,retained,diagnostics,
 units:'qa/downloaded-units.json',inventory:'qa/downloaded-asset-inventory.json',review:'qa/downloaded-review.json',reviewStatus:reviewBinding.valid?review.status:'PENDING OR STALE',reviewBinding,publicPackage:{path:'qa/downloaded-package.json',current:!!packageCurrent},
 performance:{verdict:performancePass?'PASS':'BLOCKED',samples:perf,requirements:{width:1920,height:1080,durationMS:30000,warmupMS:10000,p95:33.3,p99:33.3,max:50,over50:0}},
 temporal:'UNVERIFIED; still previews do not establish continuous motion quality',publicRelease:'UNCHANGED; imported Fab-looking GLBs are local only',privateBackup:{status:backupVerified?'VERIFIED selected browser derivatives only':'BLOCKED',pointer:'qa/downloaded-private-backup.json',canonicalUEVault:'Pre-existing dirty vault preserved; no whole-project portability claim'},
 developmentFailures:['Initial grass wind-envelope check failed; increased placement clearance without reducing threshold.','Initial grouping had house/asset variable shadowing and missing wall/micro instances; corrected, explicit nonzero-count and support tests added.','Early grass asset-review clones missing SSAO alpha exclusions; QA preview fixed, original captures retained.','Earlier house placement intersected existing tree trunks; moved to measured clear sites; retained earlier captures.'],
 next:'Independent current-build art/engineering review and actual performance evidence; source checkpoint only until license and release gates clear.'};
report.companionHashes={};
report.companionHashes['qa/audit-downloaded-stage.mjs']=sha(await readFile(resolve(qa,'audit-downloaded-stage.mjs')));
for(const path of ['qa/downloaded-units.json','qa/downloaded-asset-inventory.json','qa/downloaded-review.json','qa/downloaded-package.json','qa/downloaded-private-backup.json','qa/checkpoint-imports.mjs','qa/downloaded-dressing-checks.mjs','qa/seal-downloaded-review.mjs','qa/downloaded-review-findings.json','tools/package.mjs','tools/backup-downloaded-assets.py','tools/import-downloaded-assets.py','tools/import-downloaded-house.py']){
 try{report.companionHashes[path]=sha(await readFile(resolve(root,path)))}catch(e){if(e.code==='ENOENT')report.companionHashes[path]=null;else throw e}
}
await writeFile(resolve(qa,'downloaded-release.json'),JSON.stringify(report,null,2)+'\n');await writeFile(resolve(qa,'release.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({functional,performancePass,review:report.reviewStatus,visuals:visuals.length,reports:Object.fromEntries(Object.entries(reports).map(([k,v])=>[k,Array.isArray(v)?v.map(x=>x.pass):v.pass??'MISSING']))}));
