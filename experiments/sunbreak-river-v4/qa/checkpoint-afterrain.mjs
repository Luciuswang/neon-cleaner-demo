// Honest WIP checkpoint: failures remain evidence, never converted into release.
import {readFile,writeFile,readdir,access,copyFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {runtimeHashes} from './source-binding.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=resolve(root,'qa'),evidence=resolve(qa,'evidence');
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const sources=await runtimeHashes(),dirs=(await readdir(evidence)).sort(),relativePath=p=>relative(root,p).replaceAll('\\','/');
const mismatch=h=>Object.entries(sources).filter(([p,v])=>h?.[p]!==v).map(([p])=>p);
async function report(dir,phase){
 const file=resolve(evidence,dir,phase+'-1.json'),r=await read(file),b=r.results?.at(-1),bound=b?.source||r.results?.[0]?.details?.buildHashes;
 return{path:relativePath(file),sha256:sha(await readFile(file)),pass:r.pass,checks:r.results.length,sourceMismatches:mismatch(bound),...(b?.duration?{weather:b.weather,duration:b.duration,p95:b.p95,p99:b.p99,max:b.max,over50:b.over50,viewport:b.viewport,renderer:b.renderer,shots:b.stress.shots,enemyShots:b.audio.byType.enemy}:{} )};
}
const reports={};for(const phase of ['afterrain','map','art','weather','cabins','checks','traversal'])reports[phase]=await report(dirs.filter(d=>d.startsWith(phase+'-')).at(-1),phase);
const storm=[];for(const dir of dirs.filter(d=>d.startsWith('benchmark-')).slice(-2))storm.push(await report(dir,'benchmark'));
const sunny=await report(dirs.filter(d=>d.startsWith('sunny-benchmark-')).at(-1),'sunny-benchmark');
const performancePass=storm.length===2&&storm.every(r=>r.weather===2&&r.pass&&r.sourceMismatches.length===0)&&sunny.weather===0&&sunny.pass&&sunny.sourceMismatches.length===0;
const units={};for(const name of ['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks']){
 const r=spawnSync(process.execPath,[resolve(qa,name+'.mjs')],{encoding:'utf8',windowsHide:true});
 let detail;try{detail=JSON.parse(r.stdout)}catch{detail={stdout:r.stdout}}
 units[name]={pass:r.status===0,...detail,error:r.stderr||undefined};
}
await writeFile(resolve(qa,'afterrain-units.json'),JSON.stringify({sources,units},null,2)+'\n');
const review=await read(resolve(qa,'afterrain-review.json'));review.sources=sources;
for(const [file,backup]of [['release.json','previous-art-release-2026-11-18.json'],['independent-review.json','previous-art-review-2026-11-18.json']]){
 try{await access(resolve(qa,backup))}catch{await copyFile(resolve(qa,file),resolve(qa,backup))}
}
await writeFile(resolve(qa,'independent-review.json'),JSON.stringify(review,null,2)+'\n');
const functional=Object.values(reports).every(r=>r.pass&&!r.sourceMismatches.length)&&Object.values(units).every(r=>r.pass);
const releaseAllowed=functional&&performancePass&&['PASS','CONDITIONAL PASS'].includes(review.art.verdict)&&['PASS','CONDITIONAL PASS'].includes(review.engineering.verdict);
const result={schema:'river-afterrain-checkpoint-v1',protocol:'offscreen-cinematic-v1',task:'sunbreak-river-afterrain-2026-11-18',date:new Date().toISOString(),verdict:releaseAllowed?'CONDITIONAL PASS':'BLOCKED',
 scope:'Local playable after-rain river valley WIP; not AAA/Delta Force parity, continuous-motion art acceptance, UE, multiplayer or full competitive balance.',sources,reports,unitReport:'qa/afterrain-units.json',functional,
 performance:{verdict:performancePass?'PASS':'BLOCKED',storm,sunny,requirements:{width:1920,height:1080,durationMS:30000,warmupMS:10000,p95MS:33.3,p99MS:33.3,maxMS:50,over50:0,consecutiveStormSamples:2}},independentReview:'qa/independent-review.json',
 changes:['Default clear after-rain sky; measured and jointly rotated HDR/key direction; sky IBL solar radiance capped16 to separate solar key.','Three asymmetric mountain layers, open valley, bounded rough ridges and dry matte distant shoulders.','Official CC0 pebble/rock scans; bounded buried stone clusters and short shore grass replace old faceted stones.','Partial redistribution of existing grass to leafy low growth; original combat geometry, weapon and actor animation preserved.','Rain, splashes, rain ripples and thunder gated by weather; puddle rims follow irregular shape.'],
 retainedRework:['Baseline art REVISE / storm max53ms failures preserved.','Initial integration giant cliff/cloth silhouette and pale pebble bed rejected.','Rotated sunlight revealed excessive bright mountain albedo and glossy distant soil; corrected before freeze.','07:35 east-cabin run failed when a late pointer-lock event paused the synthetic next travel. Removed duplicate exit request and drained native lifecycle in harness only; failure retained, same thresholds and unmodified gameplay.','Complete-binding audit added actual legacy vendor/three dependency and regenerated functional evidence; original failed performance samples are never backfilled.','Earlier evidence remains in qa/evidence; only listed frozen source-bound sets support this checkpoint.'],
 publication:{status:'NOT UPDATED',localPreview:'http://127.0.0.1:5190/river/',previousPublicURL:'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/',previousReleaseRecord:'qa/last-published-release-2026-11-17.json',reason:releaseAllowed?'Separate publication not performed by checkpoint collector':'Independent art and/or strict performance not accepted'},
 privateAssets:'Pre-existing unrelated dirty private vault preserved; private transfer explicitly skipped, no UE/private portability claim.'};
await writeFile(resolve(qa,'release.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({verdict:result.verdict,functional,performance:result.performance,art:review.art.verdict},null,2));
