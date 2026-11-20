// Root-only immutable verification; GPU work is strictly serialized.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runtimeHashes} from './source-binding.mjs';
import {SUITES} from './migration.mjs';
const game=fileURLToPath(new URL('../',import.meta.url));
const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8)||'units';
if(!['units','regressions'].includes(phase))throw Error('Unknown phase');
const out=resolve(game,'qa/evidence/afterrain-'+phase+'-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=await runtimeHashes(),runs=[];
const historyFiles=['ai-movement','buffer-checks','fracture-checks','map-checks','terrain-rays','village-checks'];
const historyHashes=async()=>Object.fromEntries(await Promise.all(historyFiles.map(async n=>[n,hash(await readFile(resolve(game,'qa/'+n+'.json')))])));
const historicalBefore=await historyHashes();
const schedule=phase==='units'?[...SUITES,'procedural-materials-checks','procedural-ground-checks','migration-checks','forest-floor-checks','afterrain-ground-checks','afterrain-look-checks'].map(name=>({name,phase:'unit'})):[
 ...['checks','cabins','traversal','weather','imported-fallback'].map(p=>({phase:p,look:'current'})),
 ...['checks','cabins','traversal'].map(p=>({phase:p,look:'previous',materials:'legacy'})),
 {phase:'sunny-benchmark',look:'current'},{phase:'benchmark',look:'current',sample:'storm-A'},{phase:'benchmark',look:'current',sample:'storm-B'}
];
for(const [index,task] of schedule.entries()){
 console.log('RUN '+JSON.stringify(task));const start=Date.now();
 const url=new URL('http://127.0.0.1:5190/river/');if(task.look==='previous')url.searchParams.set('look','previous');if(task.materials)url.searchParams.set('materials',task.materials);
 if(task.phase==='imported-fallback')url.searchParams.set('dressing','off');
 const args=task.phase==='unit'?[resolve(game,'qa/'+task.name+'.mjs'),'--stdout-only',...['map-checks','masonry-materials-checks'].includes(task.name)?['--polish']:[]]:[resolve(game,'qa/browser.mjs'),'--phase='+task.phase];
 const beforeDirs=new Set(await readdir(resolve(game,'qa/evidence')));
 const result=await new Promise(done=>{
  const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RIVER_QA_URL:url.href}});let stdout='',stderr='',error=null;
  const timer=setTimeout(()=>{error='Bounded240s timeout';child.kill()},240000);
  child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('error',e=>error=e.stack);
  child.on('close',(exit,signal)=>{clearTimeout(timer);done({exit,signal,error,stdout,stderr})});
 });
 const stem=index+'-'+(task.name||task.look+'-'+task.phase);
 await writeFile(resolve(out,stem+'.stdout.log'),result.stdout,{flag:'wx'});await writeFile(resolve(out,stem+'.stderr.log'),result.stderr,{flag:'wx'});
 let childPath=null,report=null;
 if(task.phase==='unit'){try{report=JSON.parse(result.stdout)}catch{}}
 else{
  for(const line of result.stdout.trim().split(/\r?\n/).reverse()){try{const x=JSON.parse(line);if(x.report){childPath=x.report;break}}catch{}}
  if(!childPath){const dirs=(await readdir(resolve(game,'qa/evidence'))).filter(d=>!beforeDirs.has(d)&&d.startsWith(task.phase+'-'));if(dirs.length===1){const p=resolve(game,'qa/evidence',dirs[0]);const files=await readdir(p);const name=files.find(n=>n===task.phase+'-failure-1.json')||files.find(n=>n===task.phase+'-1.json');if(name)childPath=resolve(p,name)}}
  if(childPath)try{report=JSON.parse(await readFile(childPath,'utf8'))}catch(e){result.error=String(e)}
 }
 const explicitFail=report?.pass===false||/\b(?:FAIL|BLOCKED)\b/.test(report?.verdict||'');
 const run={...task,exit:result.exit,signal:result.signal,error:result.error,durationMs:Date.now()-start,pass:result.exit===0&&!explicitFail&&!!result.stdout.trim(),stdoutSHA256:hash(result.stdout),stderrSHA256:hash(result.stderr),report:childPath?.replaceAll('\\','/'),sha256:childPath?hash(await readFile(childPath)):null,checks:report?.checks||report?.results?.length};
 if(task.phase!=='unit')run.pass=run.pass&&report?.pass===true;
 if(task.phase.includes('benchmark')){
  const sample=report?.results?.find(r=>r.raw);
  if(sample){const frames=sample.raw.map(r=>r.frame_ms),sorted=[...frames].sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
   run.performance={p50:pct(.5),p95:pct(.95),p99:pct(.99),max:Math.max(...frames),over50:frames.filter(t=>t>50).length,frames:frames.length,duration:sample.duration,viewport:sample.viewport,renderer:sample.renderer};
   run.strictPass=sample.duration>=30000&&sample.viewport[0]>=1920&&sample.viewport[1]>=1080&&run.performance.p95<=33.3&&run.performance.p99<=33.3&&run.performance.max<=50&&run.performance.over50===0&&/NVIDIA|AMD|Intel/.test(sample.renderer)&&/D3D11|Direct3D11/.test(sample.renderer);run.pass=run.pass&&run.strictPass;
  }else run.pass=false;
 }
 runs.push(run);console.log(JSON.stringify(run));
 await writeFile(resolve(out,'progress.json'),JSON.stringify({sources,runs},null,2)+'\n');
}
const sourcesAfter=await runtimeHashes(),sourceUnchanged=JSON.stringify(sources)===JSON.stringify(sourcesAfter);
const historicalAfter=await historyHashes(),historicalUnchanged=JSON.stringify(historicalBefore)===JSON.stringify(historicalAfter);
const functional=runs.filter(r=>!r.phase.includes('benchmark')),performance=runs.filter(r=>r.phase.includes('benchmark'));
const report={task:'river-afterrain-light-understory-2026-11-20',profile:'offscreen-cinematic-v1',phase,sourceUnchanged,sources,sourcesAfter,historicalBefore,historicalAfter,historicalUnchanged,schedule,runs,functionalPass:sourceUnchanged&&historicalUnchanged&&functional.every(r=>r.pass),performancePass:phase==='regressions'?sourceUnchanged&&performance.length===3&&performance.every(r=>r.pass):null,thresholds:{warmupSeconds:10,sampleSeconds:30,p95:33.3,p99:33.3,max:50,over50:0},continuousMotion:'UNVERIFIED: no continuous subjective review',inherited:'Prior migration FAILs preserved separately; this run cannot repair historical evidence bytes.'};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:resolve(out,'report.json'),functionalPass:report.functionalPass,performancePass:report.performancePass,sourceUnchanged}));
if(!report.functionalPass||report.performancePass===false)process.exitCode=1;
