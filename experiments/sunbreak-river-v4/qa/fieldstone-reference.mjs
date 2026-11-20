// Serialized, native-headless WebGL evidence; never desktop capture/input.
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {GAME,CDP,sha,canonical,assertCapture,assertNative,TIME} from './migration.mjs';
import {diagnostics,assertNetworkSources} from './afterrain-look.mjs';
import {runtimeHashes} from './source-binding.mjs';
const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8)||'units';
assert.ok(['units','visual','regressions','scan-runtime'].includes(phase));
const baseline='f53de8504c71aa550f5af8b6431df180eef53c7e',repo=resolve(GAME,'../..');
const out=await mkdtemp(resolve(GAME,'qa/evidence/fieldstone-'+phase+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'));
const save=(n,v)=>writeFile(resolve(out,n),typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const equal=(a,b)=>canonical(a)===canonical(b);
const sources=await runtimeHashes(),harnessBytes=await readFile(new URL(import.meta.url)),harnessSHA256=sha(harnessBytes);
await save('harness.mjs',harnessBytes);
const report={task:'river-stone-cover-reference-2026-11-20',quality_profile:'offscreen-cinematic-v1',baseline,phase,harnessSHA256,sources,pass:false,limitations:['Browser WebGL, not UE rendering.','Sampled frames are not continuous motion review.','Full AAA release remains independently gated.']};
const views=[
 {name:'stone-front',camera:[-7.8,1.6,10.5,0,-.27],weather:0},
 {name:'stone-end',camera:[-5.3,1.45,9.9,.90,-.23],weather:0},
 {name:'stone-opposite',camera:[7.8,1.55,-15.6,Math.PI,-.24],weather:0},
 {name:'stone-outer',camera:[26,1.6,11,0,-.25],weather:0},
 {name:'river-wide',camera:[0,16,33,0,-.60],weather:0},
 {name:'stone-storm',camera:[-7.8,1.6,10.5,0,-.27],weather:2}
];
async function history(){const result={};async function walk(path){for(const d of await readdir(path,{withFileTypes:true})){const p=resolve(path,d.name);if(p===out)continue;if(d.isDirectory())await walk(p);else result[p.slice(GAME.length)]=sha(await readFile(p))}}await walk(resolve(GAME,'qa'));return result}
const historicalBefore=await history();
async function run(args,environment={}){return new Promise(done=>{let stdout='',stderr='',error;const c=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,...environment}});const timer=setTimeout(()=>{error='240s timeout';c.kill()},240000);c.stdout.on('data',d=>stdout+=d);c.stderr.on('data',d=>stderr+=d);c.on('error',e=>error=String(e));c.on('close',(exit,signal)=>{clearTimeout(timer);done({exit,signal,error,stdout,stderr})})})}
async function visual(){
 const profile=await mkdtemp(resolve(tmpdir(),'river-fieldstone-profile-'));
 let browser,cdp,stderr='';const requests=[],byID=new Map(),bodies=[],bodyErrors=[];
 report.captures=[];
 try{
  const flags=['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--use-angle=d3d11','--disable-software-rasterizer','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--window-size=1920,1080',`--user-data-dir=${profile}`,'about:blank'];
  const endpoint=await new Promise((yes,no)=>{const timer=setTimeout(()=>no(Error('launch timeout')),30000);browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',flags,{windowsHide:true,stdio:['ignore','ignore','pipe']});browser.once('error',e=>{clearTimeout(timer);no(e)});browser.stderr.on('data',d=>{stderr+=d;const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);yes(m[1])}})});
  const socket=new WebSocket(endpoint);cdp=new CDP(socket);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
  report.gpu=(await cdp.send('SystemInfo.getInfo',{},null)).gpu;
  report.browser={flags,version:await cdp.send('Browser.getVersion',{},null)};
  const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'},null);({sessionId:cdp.session}=await cdp.send('Target.attachToTarget',{targetId,flatten:true},null));
  cdp.listeners.push(e=>{
   if(e.sessionId!==cdp.session)return;const p=e.params;
   if(e.method==='Network.requestWillBeSent'){const r={id:p.requestId,url:p.request.url,type:p.type};requests.push(r);byID.set(r.id,r)}
   const r=byID.get(p.requestId);if(!r)return;
   if(e.method==='Network.responseReceived')Object.assign(r,{status:p.response.status,fromDiskCache:!!p.response.fromDiskCache,fromServiceWorker:!!p.response.fromServiceWorker});
   if(e.method==='Network.loadingFinished'){r.finished=true;if(r.type==='Script')bodies.push(cdp.send('Network.getResponseBody',{requestId:r.id}).then(b=>{r.bodySHA256=sha(Buffer.from(b.body,b.base64Encoded?'base64':'utf8'))}).catch(error=>bodyErrors.push(String(error))))}
  });
  for(const method of ['Runtime.enable','Page.enable','Log.enable'])await cdp.send(method);
  await cdp.send('Network.enable',{maxTotalBufferSize:64e6,maxResourceBufferSize:8e6});await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.setBypassServiceWorker',{bypass:true});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  const url='http://127.0.0.1:5190/river/';await cdp.send('Page.navigate',{url});
  await cdp.wait("!!window.arenaQA && !!document.body?.dataset.qa && !document.getElementById('bStart')?.disabled");
  if(phase==='scan-runtime'){
   const r=await run([resolve(GAME,'qa/scan-cover-checks.mjs')]);assert.equal(r.exit,0);const cpu=JSON.parse(r.stdout);await save('actual-glb-probes.json',cpu);
   const test=await readFile(resolve(GAME,'qa/scan-cover-checks.mjs'));await save('scan-cover-checks.mjs',test);report.probeSourceSHA256=sha(test);
   report.runtimeCover=await cdp.evaluate('arenaQA.polishInfo().cover');assert.ok(report.runtimeCover.localOnly&&report.runtimeCover.enabled);
   report.lineOfSight=[];assert.equal(cpu.runtimeProbes.length,12,'hit and miss for each of six covers');
   for(const p of cpu.runtimeProbes){const point=v=>JSON.stringify({x:v[0],y:v[1],z:v[2]});const clear=await cdp.evaluate(`arenaQA.lineOfSight(${point(p.from)},${point(p.to)})`);report.lineOfSight.push({...p,actualClear:clear,pass:clear===p.clear});assert.equal(clear,p.clear,'actual game LOS '+p.wall)}
  }
  for(const view of phase==='scan-runtime'?[]:views){
   await cdp.evaluate(`arenaQA.weather(${view.weather});arenaQA.view(${view.camera.join(',')});arenaQA.migrationFreeze(${TIME});true`);
   const lengths=await cdp.evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const canvas=document.querySelector('#app canvas'),before=arenaQA.snapshot(),beforeInfo=arenaQA.mapInfo();
    window.__fieldPNG=canvas.toDataURL('image/png').split(',')[1];
    window.__fieldState=JSON.stringify({before,beforeInfo,snapshot:arenaQA.snapshot(),info:arenaQA.mapInfo(),canvas:{width:canvas.width,height:canvas.height},url:location.href});resolve({image:window.__fieldPNG.length,state:window.__fieldState.length});})))`);
   const state=JSON.parse(await cdp.readString('window.__fieldState',lengths.state)),png=Buffer.from(await cdp.readString('window.__fieldPNG',lengths.image),'base64');
   state.decoded=await cdp.evaluate(`(async()=>{const bytes=Uint8Array.from(atob(window.__fieldPNG),c=>c.charCodeAt(0)),b=await createImageBitmap(new Blob([bytes],{type:'image/png'})),c=new OffscreenCanvas(b.width,b.height),x=c.getContext('2d');x.drawImage(b,0,0);const p=x.getImageData(0,0,b.width,b.height).data;let nonBlackPixels=0,lo=255,hi=0;for(let i=0;i<p.length;i+=4){let v=Math.max(p[i],p[i+1],p[i+2]);if(v>8)nonBlackPixels++;lo=Math.min(lo,v);hi=Math.max(hi,v)}const pixelSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',p)),x=>x.toString(16).padStart(2,'0')).join('');return{width:b.width,height:b.height,nonBlackPixels,range:hi-lo,pixelSHA256}})()`);
   await save(view.name+'.png',png);await save(view.name+'.json',state);
   assertCapture(state,view,'procedural',sources);assertNative(state.snapshot.renderer,report.gpu);
   assert.ok(equal(state.beforeInfo.lighting,state.info.lighting),'stable frozen illumination');
   report.captures.push({view,png:view.name+'.png',sha256:sha(png),state:view.name+'.json',stateSHA256:sha(await readFile(resolve(out,view.name+'.json'))),cover:state.info.village.stoneCover,pass:true});
   console.log('CAPTURE '+view.name);
  }
  await Promise.all(bodies);assert.deepEqual(bodyErrors,[]);report.bound=assertNetworkSources(requests,sources,url);report.errors=diagnostics(cdp.events);assert.deepEqual(report.errors,[]);
 }finally{
  await save('network.json',{requests,bodyErrors});await save('browser-stderr.log',stderr);
  if(cdp){await save('events.json',cdp.events);if(cdp.socket.readyState===WebSocket.OPEN){try{await cdp.send('Browser.close',{},null)}catch{}cdp.socket.close()}}
  if(browser&&browser.exitCode===null)await new Promise(r=>{const t=setTimeout(()=>{browser.kill();r()},5000);browser.once('exit',()=>{clearTimeout(t);r()})});
  assert.equal(dirname(resolve(profile)),resolve(tmpdir()));assert.ok(basename(profile).startsWith('river-fieldstone-profile-'));
  await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(e=>{report.cleanupError=String(e)});
 }
}
try{
 // World/village/downloaded-dressing are explicit reviewed integration writes
 // in the local-reference pivot, not protected baseline files in this phase.
 const protectedPaths=['map-layout.js','masonry-materials.js','index.html','qa/stone-cover-checks.mjs','actors.js','weapon.js','combat-feedback.js','buffer-house.js'];
 report.protected=protectedPaths.map(p=>{const b=execFileSync('git',['show',baseline+':experiments/sunbreak-river-v4/'+p],{cwd:repo,maxBuffer:8e6});return{path:p,baselineSHA256:sha(b)}});
 for(const p of report.protected){p.actualSHA256=sha(await readFile(resolve(GAME,p.path)));assert.equal(p.actualSHA256,p.baselineSHA256,'protected '+p.path)}
 if(['visual','scan-runtime'].includes(phase))await visual();
 else{
  const schedule=phase==='units'?['stone-cover-checks','scan-cover-checks','map-checks','terrain-rays','village-checks','shot-feedback-event-checks','combat-feedback-checks']:['checks','traversal','weather','polish','imported-fallback','sunny-benchmark'];report.runs=[];
  for(const name of schedule){
   console.log('RUN '+name);const args=phase==='units'?[resolve(GAME,'qa/'+name+'.mjs'),'--stdout-only',...name==='map-checks'?['--polish']:[]]:[resolve(GAME,'qa/browser.mjs'),'--phase='+name];
   const r=await run(args,{RIVER_QA_URL:'http://127.0.0.1:5190/river/'+(name==='imported-fallback'?'?dressing=off':'')});await save(name+'.stdout.log',r.stdout);await save(name+'.stderr.log',r.stderr);
   const record={name,exit:r.exit,signal:r.signal,error:r.error,pass:r.exit===0&&!!r.stdout.trim(),stdoutSHA256:sha(r.stdout),stderrSHA256:sha(r.stderr)};
   if(phase==='regressions'){
    for(const line of r.stdout.trim().split(/\r?\n/).reverse()){try{const result=JSON.parse(line);if(result.report){record.report=result.report;break}}catch{}}
    if(record.report){const bytes=await readFile(record.report),child=JSON.parse(bytes);record.sha256=sha(bytes);record.checks=child.results.length;record.pass=record.pass&&child.pass;
     if(name==='sunny-benchmark'){const s=child.results.find(r=>r.raw);if(s){const frames=s.raw.map(r=>r.frame_ms),ordered=[...frames].sort((a,b)=>a-b),pct=p=>ordered[Math.min(ordered.length-1,Math.floor(ordered.length*p))];record.performance={p95:pct(.95),p99:pct(.99),max:Math.max(...frames),over50:frames.filter(v=>v>50).length,duration:s.duration,frames:frames.length,viewport:s.viewport,renderer:s.renderer};const p=record.performance;record.pass=record.pass&&p.duration>=30000&&p.viewport[0]===1920&&p.viewport[1]===1080&&p.p95<=33.3&&p.p99<=33.3&&p.max<=50&&p.over50===0&&/Direct3D11|D3D11/.test(p.renderer)&&!/software|swiftshader/i.test(p.renderer)}else record.pass=false;}
    }else record.pass=false;
   }
   report.runs.push(record);
   console.log(name+' exit '+r.exit);
  }
  report.functionalPass=report.runs.filter(r=>!r.name.includes('benchmark')).every(r=>r.pass);
  report.performancePass=phase==='regressions'?report.runs.find(r=>r.name==='sunny-benchmark').pass:null;
  if(phase==='units'){
   const {bakeFieldstoneSurface,installFieldstoneSurface,FIELDSTONE_SURFACE_SCALE}=await import('../fieldstone-surface.js');
   const {stoneCoverPlan}=await import('../stone-cover.js'),{layout}=await import('../map-layout.js');
   const T=await import('../../sunbreak-storm-v3/vendor/presentation/build/three.module.js');
   const bake=bakeFieldstoneSurface(),second=bakeFieldstoneSurface(),size=FIELDSTONE_SURFACE_SCALE.size;
   for(const key of ['height','albedo','normal','orm'])assert.equal(sha(Buffer.from(bake[key].buffer)),sha(Buffer.from(second[key].buffer)),'deterministic '+key);
   let lengthError=0;for(let i=0;i<size*size;i++){
    assert.ok(Number.isFinite(bake.height[i])&&bake.height[i]>=0&&bake.height[i]<=1);
    const k=i*4;assert.equal(bake.orm[k+2],0,'dielectric rock');assert.ok(bake.orm[k+1]>=190,'rough stone');
    lengthError=Math.max(lengthError,Math.abs(Math.hypot(...[0,1,2].map(j=>bake.normal[k+j]/255*2-1))-1));
   }
   assert.ok(lengthError<.01,'encoded unit normals');
   const m=new T.MeshStandardMaterial();installFieldstoneSurface(T,m);
   assert.equal(m.map.colorSpace,T.SRGBColorSpace);assert.equal(m.normalMap.colorSpace,T.NoColorSpace);assert.equal(m.roughnessMap.colorSpace,T.NoColorSpace);
   assert.ok(m.map.generateMipmaps&&m.normalMap.generateMipmaps&&m.roughnessMap.generateMipmaps);
   assert.equal(m.userData.fieldstone.perFrameBakes,0);
   let sharedCells=0;for(const cover of stoneCoverPlan(layout.walls).covers){const byID=new Map();for(const face of cover.faces)for(const cell of face.cells){
    const appearance=[cell.tint,cell.warmth,cell.uvOffset,cell.uvScale,cell.response],prior=byID.get(cell.stoneId);
    if(prior){assert.deepEqual(appearance,prior,'same volume stone keeps appearance around corners');sharedCells++}else byID.set(cell.stoneId,appearance);
   }}assert.ok(sharedCells>30,'volume cells actually span multiple faces');
   report.fieldstone={pass:true,sharedCells,lengthError,scale:FIELDSTONE_SURFACE_SCALE,albedoSHA256:sha(bake.albedo),normalSHA256:sha(bake.normal),ormSHA256:sha(bake.orm)};
  }
 }
 report.pass=['visual','scan-runtime'].includes(phase)||report.runs.every(r=>r.pass);
}catch(error){report.error=error.stack;report.pass=false}
finally{
 report.sourcesAfter=await runtimeHashes();report.sourceUnchanged=equal(sources,report.sourcesAfter);
 // Existing files must remain byte-identical; new child regression evidence is allowed.
 const historicalAfter=await history();report.historyChanges=Object.keys(historicalBefore).filter(k=>historicalAfter[k]!==historicalBefore[k]);
 report.historyUnchanged=report.historyChanges.length===0;report.pass=report.pass&&report.sourceUnchanged&&report.historyUnchanged;
 await save('report.json',report);console.log(JSON.stringify({pass:report.pass,report:resolve(out,'report.json'),error:report.error}));if(!report.pass)process.exitCode=1;
}
