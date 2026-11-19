// Root-only serialized GPU regression schedule; never launch beside another GPU test.
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runtimeHashes} from './source-binding.mjs';
const game=fileURLToPath(new URL('../',import.meta.url));
const out=resolve(game,'qa/evidence/migration-regressions-'+new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const sources=await runtimeHashes(),runs=[];
const schedule=[
 ...['checks','cabins','traversal','weather','imported-fallback'].map(phase=>({mode:'procedural',phase})),
 ...['checks','cabins','traversal'].map(phase=>({mode:'legacy',phase})),
 {mode:'procedural',phase:'sunny-benchmark'},
 {mode:'procedural',phase:'benchmark',sample:'storm-A'},
 {mode:'procedural',phase:'benchmark',sample:'storm-B'}
];
for(const [index,task]of schedule.entries()){
 const url=new URL('http://127.0.0.1:5190/river/');url.searchParams.set('materials',task.mode);
 if(task.phase==='imported-fallback')url.searchParams.set('dressing','off');
 console.log('RUN '+JSON.stringify(task));
 const result=await new Promise(done=>{
  const child=spawn(process.execPath,[resolve(game,'qa/browser.mjs'),'--phase='+task.phase],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,RIVER_QA_URL:url.href}});
  let stdout='',stderr='',error=null;
  const timer=setTimeout(()=>{error='Bounded240s timeout';child.kill()},240000);
  child.stdout.on('data',d=>{stdout+=d;});child.stderr.on('data',d=>{stderr+=d;});
  child.on('error',e=>{error=e.stack});child.on('close',(exit,signal)=>{clearTimeout(timer);done({exit,signal,error,stdout,stderr})});
 });
 const stem=index+'-'+task.mode+'-'+task.phase;
 await writeFile(resolve(out,stem+'.stdout.log'),result.stdout);await writeFile(resolve(out,stem+'.stderr.log'),result.stderr);
 let childReport=null;for(const line of result.stdout.trim().split(/\r?\n/).reverse()){try{const x=JSON.parse(line);if(x.report){childReport=x;break}}catch{}}
 let report=null,sha256=null;try{if(childReport){const bytes=await readFile(childReport.report);report=JSON.parse(bytes);sha256=hash(bytes)}}catch(e){result.error=String(e)}
 const run={...task,exit:result.exit,signal:result.signal,error:result.error,report:childReport?.report?.replaceAll('\\','/'),sha256,checks:report?.results?.length,pass:result.exit===0&&report?.pass===true};
 if(task.phase.includes('benchmark')){
  const sample=report?.results.find(r=>r.raw);if(sample){
   const frames=sample.raw.map(r=>r.frame_ms),sorted=[...frames].sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
   run.performance={p50:pct(.5),p95:pct(.95),p99:pct(.99),max:Math.max(...frames),over50:frames.filter(t=>t>50).length,frames:frames.length,duration:sample.duration,viewport:sample.viewport,renderer:sample.renderer};
   run.strictPass=sample.duration>=30000&&sample.viewport[0]>=1920&&sample.viewport[1]>=1080&&run.performance.p95<=33.3&&run.performance.p99<=33.3&&run.performance.max<=50&&run.performance.over50===0&&/NVIDIA|AMD|Intel/.test(sample.renderer)&&/D3D11|Direct3D11/.test(sample.renderer);
   run.pass=run.pass&&run.strictPass;
  }else run.pass=false;
 }
 runs.push(run);console.log(JSON.stringify(run));
 await writeFile(resolve(out,'progress.json'),JSON.stringify({sources,runs},null,2)+'\n');
}
const sourcesAfter=await runtimeHashes(),sourceUnchanged=JSON.stringify(sources)===JSON.stringify(sourcesAfter);
const functional=runs.filter(r=>!r.phase.includes('benchmark')),performance=runs.filter(r=>r.phase.includes('benchmark'));
const report={task:'river-procedural-migration-2026-11-19',profile:'offscreen-cinematic-v1',method:'serialized native-headless WebGL; actual gameplay separate from fixed-time stills',sources,sourcesAfter,sourceUnchanged,schedule,runs,functionalPass:sourceUnchanged&&functional.length===8&&functional.every(r=>r.pass),performancePass:sourceUnchanged&&performance.length===3&&performance.every(r=>r.pass),thresholds:{warmupSeconds:10,sampleSeconds:30,p95:33.3,p99:33.3,max:50,over50:0},continuousMotion:'UNVERIFIED: no continuous subjective review'};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:resolve(out,'report.json'),functionalPass:report.functionalPass,performancePass:report.performancePass,sourceUnchanged}));
if(!report.functionalPass||!report.performancePass)process.exitCode=1;
