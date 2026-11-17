import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),evidence=new URL('qa/tactical-evidence/',root);
mkdirSync(evidence,{recursive:true});
const archive=process.argv.find(a=>a.startsWith('--archive-performance='));
if(archive){
 const id=archive.split('=')[1];if(!/^\d+$/.test(id))throw Error('Numerical run id required');
 copyFileSync(new URL('qa/captures/performance-current.json',root),new URL('performance-'+id+'.json',evidence));
 console.log('Preserved untrimmed performance run '+id);
}else{
 const serve=readFileSync(new URL('serve.mjs',root),'utf8');
 const names=JSON.parse(serve.match(/export const sourceNames=(\[[^\n]+\]);/)[1].replaceAll("'",'"'));
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const buildHashes=Object.fromEntries(names.map(n=>[n,hash(readFileSync(new URL(n,root)))]));
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 const captures=['tactical-browser','house-current','tactical-roof',...[0,1,2].map(i=>'tactical-npc-'+i),...[0,1,2].map(i=>'tactical-rain-'+i)];
 const records={};
 for(const name of captures){
  const src=new URL('qa/captures/'+name+'.json',root),data=JSON.parse(readFileSync(src));
  records[name]=data;
  check(name+' current loaded source hashes',names.every(n=>data.buildHashes[n]===buildHashes[n]));
  copyFileSync(src,new URL(name+'.json',evidence));
  const png=new URL('qa/captures/'+name+'.png',root);
  if(existsSync(png)){
   const bytes=readFileSync(png);
   check(name+' nonblank1080p canvas',data.capture_method==='browser-webgl-canvas'&&data.pixel_check.nonblank&&bytes.readUInt32BE(16)===1920&&bytes.readUInt32BE(20)===1080);
   copyFileSync(png,new URL(name+'.png',evidence));
  }else check(name+' regression passes',data.pass);
 }
 const performance=[];
 for(let i=1;i<=4;i++){
  const path=new URL('performance-'+i+'.json',evidence);if(!existsSync(path))continue;
  const p=JSON.parse(readFileSync(path));
  performance.push({run:i,date:p.date,duration_ms:p.duration_ms,frames:p.raw.length,p50_ms:p.p50_ms,p95_ms:p.p95_ms,p99_ms:p.p99_ms,max_ms:p.max_ms,hitches_over_50ms:p.hitches_over_50ms,
   sameSource:names.every(n=>p.buildHashes[n]===buildHashes[n]),strictPass:p.p95_ms<=33.3&&p.p99_ms<=33.3&&p.max_ms<=50&&p.hitches_over_50ms===0,renderer:p.renderer,audio:p.audio});
 }
 check('recorded complete real-time combat performance',performance.some(p=>p.duration_ms>=30000&&p.sameSource));
 const npc=[0,1,2].map(i=>records['tactical-npc-'+i]);
 check('same real-time NPC sequence advances decisions and skeleton time',
  npc[2].qa.tactical.elapsed>npc[0].qa.tactical.elapsed&&npc[2].actorPoses.some((p,i)=>p.time>npc[0].actorPoses[i].time)&&npc[2].qa.tactical.totalShots>0);
 const rain=[0,1,2].map(i=>records['tactical-rain-'+i].render.storm.impacts);
 check('same real-time rain sequence advances and emits',rain[2].elapsed>rain[0].elapsed&&rain[2].emitted>rain[0].emitted);
 const units=['tactical-unit','tactical-player-contract','tactical-environment-unit','tactical-actor-unit'];
 for(const name of units){const r=JSON.parse(readFileSync(new URL('qa/'+name+'.json',root)));check(name,r.pass??r.verdict==='PASS')}
 const report={schema:'sunbreak-tactical-release-v1',date:new Date().toISOString(),engineeringPass:checks.every(c=>c.pass),strictPerformancePass:performance.length>0&&performance.every(p=>p.strictPass),
  method:'source-bound unit/integration checks, sparse real WebGL samples, untrimmed realtime combat benchmarks; not full continuous visual review',checks,performance,buildHashes,
  independentReviews:[
   {reviewer:'Planck',verdict:'CONDITIONAL PASS',scope:'read-only engineering source/report review; muzzle direction, actual production callback coverage and publication staged-tree checks closed',limits:'Reviewer did not run browser; actual public verification separate, strict hitch gate not closed.'},
   {reviewer:'Zeno',verdict:'PASS',confidence:'medium',scope:'bounded roof/rain art; three actual canvas images and advancing rain state sidecars',limits:'Not full continuous motion, all-scale ring visibility, NPC art or sustained performance acceptance.'}
  ],
  limitations:['Procedural animation, not mocap/human simulation.','Original NPC weapon mesh/fingers retained.','Desktop keyboard and mouse single-player.','Not UE5, ray tracing, AAA photoreal parity or final cinematic acceptance.','Public live verification recorded separately after Pages builds.']};
 writeFileSync(new URL('qa/tactical-release-report.json',root),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({engineeringPass:report.engineeringPass,strictPerformancePass:report.strictPerformancePass,failed:checks.filter(c=>!c.pass),performance},null,2));
 if(!report.engineeringPass)process.exitCode=1;
}
