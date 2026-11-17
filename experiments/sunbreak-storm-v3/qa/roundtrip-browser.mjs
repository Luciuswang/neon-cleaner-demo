// Locked-desktop-safe QA: actual game in headless native hardware WebGL.
// Images are canvas exports from the game, never desktop/window screenshots.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const prefix=process.argv.find(a=>a.startsWith('--report-prefix='))?.slice('--report-prefix='.length)||'roundtrip';
assert.match(prefix,/^[a-z0-9-]+$/);
const game=fileURLToPath(new URL('../',import.meta.url)),evidence=resolve(game,'qa/'+prefix+'-evidence');
await mkdir(evidence,{recursive:true});
const phase=process.argv.find(a=>a.startsWith('--phase='))?.split('=')[1]||'checks';
assert.ok(['export','review-contract','checks','captures','benchmark','public-smoke'].includes(phase));
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome);
const profile=await mkdtemp(resolve(tmpdir(),'sunbreak-roundtrip-'));
let browser,socket,session,sequence=0;const pending=new Map(),errors=[],results=[];
function send(method,params={},sessionId=session){
 const id=++sequence;return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},45000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
 });
}
async function evaluate(expression,userGesture=false){
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
}
async function wait(expression,timeout=70000){
 const start=Date.now();while(Date.now()-start<timeout){
  try{const value=await evaluate(expression);if(value)return value}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error('Timed out: '+expression);
}
async function navigate(path){await send('Page.navigate',{url:path.startsWith('https:')?path:'http://127.0.0.1:5188'+path});await wait("document.body?.dataset.version==='storm-v3'");}
try{
 const endpoint=await new Promise((resolve,reject)=>{
  browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',
   '--use-angle=d3d11','--disable-software-rasterizer','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
   '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--window-size=1920,1080',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  browser.once('error',reject);let output='';const timer=setTimeout(()=>reject(Error('Headless launch timeout')),30000);
  browser.stderr.on('data',d=>{output+=d;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1])}});
 });
 socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
 socket.addEventListener('message',event=>{
  const r=JSON.parse(event.data),p=pending.get(r.id);if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result)}
  if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);
  if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')errors.push(r.params.args.map(a=>a.value||a.description).join(' '));
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'},null);
 ({sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true},null));await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 if(phase==='export'){
  await send('Page.navigate',{url:'http://127.0.0.1:5188/tools/house-authoring.html'});
  await wait("document.body?.dataset.export==='saved'||document.body?.dataset.export==='failed'");
  const result=await evaluate("({pass:document.body.dataset.export==='saved',status:document.getElementById('status').textContent})");
  results.push(result);console.log(result);assert.ok(result.pass);
 }else if(phase==='review-contract'){
  await navigate('/');
  await wait("!!document.body.dataset.render");
  const generated=await evaluate(`(async()=>{
   const T=await import('three'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
   const {makeHouseContract,validateHouseAsset}=await import('./house-asset.js');
   const baseline=await(await fetch('./assets/house/house-contract.json')).json();
   const gltf=await new GLTFLoader().loadAsync('./authoring/user-house-2026-11-17/timber-house-user.glb');
   const candidate=await makeHouseContract(T,gltf.scene,baseline.dimensions);
   const allowed=['Foundation_part_0001','Foundation_part_0002','Foundation_part_0075'];
   const byName=new Map(candidate.records.map(r=>[r.name,r]));
   const reviewed={...baseline,records:baseline.records.map(r=>allowed.includes(r.name)?byName.get(r.name):r)};
   await validateHouseAsset(T,gltf.scene,reviewed);
   return reviewed;
  })()`);
  const baseline=JSON.parse(await readFile(resolve(game,'assets/house/house-contract.json'),'utf8'));
  const changed=baseline.records.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(generated.records[i]));
  assert.deepEqual(generated.records.map(r=>r.name),baseline.records.map(r=>r.name));
  assert.deepEqual(changed.map(r=>r.name),['Foundation_part_0001','Foundation_part_0002','Foundation_part_0075']);
  for(const key of ['schema','units','upAxis','dimensions','doorPivot','geometryToleranceMetres','cosmeticBoundsToleranceMetres','maximumTriangles'])
   assert.deepEqual(generated[key],baseline[key],key);
  const audit=JSON.parse(await readFile(resolve(game,'authoring/user-house-2026-11-17/source-audit.json'),'utf8'));
  const reviewed={...baseline,records:baseline.records.map((r,i)=>changed.includes(r)?generated.records[i]:r),
   artistRevision:{id:'user-house-2026-11-17',sourceSha256:audit.sourceSha256,assetSha256:audit.candidateSha256,
    reviewedStructuralParts:changed.map(r=>r.name),support:{minX:-1.90152734,maxX:-.84757660,minZ:5.60000038,maxZ:6.03162861,top:.07477977},
    notes:'Explicit candidate for review, not automatic arbitrary architecture acceptance. Two below-floor plinth side-corner cutouts retain original movement envelope; added low step has matched local walk support. All other structural records and strict tolerances remain pinned.'}};
  await writeFile(resolve(game,'authoring/user-house-2026-11-17/house-contract.json'),JSON.stringify(reviewed,null,2)+'\n');
  results.push({pass:true,changed:changed.map(r=>r.name),status:'candidate contract only; independent review required before live swap'});
 }else if(phase==='checks'){
  for(const [path,flag,name]of [['/roundtrip-test','roundtripReport','roundtrip-browser'],['/tactical-house-test','houseReport','house-current'],['/tactical-test','tacticalReport','tactical-browser']]){
   await navigate(path);await wait(`document.body.dataset.${flag}==='saved'`);
   const report=JSON.parse(await readFile(resolve(game,'qa/captures/'+name+'.json'),'utf8'));
   await copyFile(resolve(game,'qa/captures/'+name+'.json'),resolve(evidence,name+'.json'));
   results.push({path,pass:report.pass,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass)});
   console.log(name,report.pass,report.checks.length);assert.ok(report.pass);
  }
 }else if(phase==='captures'){
  const houseViews=[
   ['house-inside','view=houseinside'],['house-outside','view=houseangle&door=open'],
   ['hardware-close','view=househardware'],['door-hardware','view=housedoor&door=open'],
   ['step-close','view=housestep'],['plinth-close','view=houseplinth']
  ].map(([n,q])=>[prefix+'-'+n,q]);
  const views=process.argv.includes('--house-only')?houseViews:[
   ['roundtrip-house-inside','view=houseinside'],['roundtrip-house-outside','view=houseangle&door=open'],
   ['roundtrip-hardware-close','view=househardware'],
   ['roundtrip-door-hardware','view=housedoor&door=open'],
   ...['idle','ads','fire','ads-fire','reload-early','reload-mid','reload-late'].map(p=>['roundtrip-arm-'+p,'view=houseinside&weaponPose='+p])
  ];
  for(const [name,query]of views){
   await navigate('/?capture='+name+'&clean=1&'+query);await wait("document.body.dataset.capture==='saved'");
   for(const extension of ['png','json'])await copyFile(resolve(game,'qa/captures/'+name+'.'+extension),resolve(evidence,name+'.'+extension));
   results.push({name,pass:true});console.log('canvas',name);
  }
 }else if(phase==='benchmark'){
  await navigate('/?bench=1&combat=1&weather=2&audio=1');await wait("!!document.getElementById('audioBenchmark')");
  await evaluate("window.roundtripLongTasks=[];new PerformanceObserver(list=>{for(const e of list.getEntries())window.roundtripLongTasks.push({startTime:e.startTime,duration:e.duration,name:e.name,attribution:e.attribution?.map(a=>({name:a.name,containerType:a.containerType,containerName:a.containerName}))})}).observe({entryTypes:['longtask']})");
  await evaluate("document.getElementById('audioBenchmark').click()",true);
  await wait("document.body.dataset.benchmark==='saved'",85000);
  const report=JSON.parse(await readFile(resolve(game,'qa/captures/performance-current.json'),'utf8'));
  // Every attempt gets its own immutable retained name; never trim hitches.
  let n=1;while(existsSync(resolve(evidence,'performance-'+n+'.json')))n++;
  await copyFile(resolve(game,'qa/captures/performance-current.json'),resolve(evidence,'performance-'+n+'.json'));
  const diagnostics=await evaluate("({longTasks:window.roundtripLongTasks,timeOrigin:performance.timeOrigin,visibility:document.visibilityState})");
  await writeFile(resolve(evidence,'performance-'+n+'-diagnostics.json'),JSON.stringify(diagnostics,null,2)+'\n');
  const hardware=!/swiftshader|software|microsoft basic/i.test(report.renderer);
  const pass=hardware&&report.duration_ms>=30000&&report.p95_ms<=33.3&&report.p99_ms<=33.3&&report.max_ms<=50&&report.hitches_over_50ms===0;
  results.push({run:n,pass,hardware,renderer:report.renderer,duration_ms:report.duration_ms,p95_ms:report.p95_ms,p99_ms:report.p99_ms,max_ms:report.max_ms,hitches:report.hitches_over_50ms,audio:report.audio});
  console.log(JSON.stringify(results.at(-1),null,2));
 }else{
  await send('Page.navigate',{url:'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/'});
  await wait("!!document.getElementById('bStart')&&!document.getElementById('bStart').disabled&&!!document.body.dataset.qa");
  const before=await evaluate("JSON.parse(document.body.dataset.qa)");
  await evaluate("document.getElementById('bStart').click()",true);
  await wait("JSON.parse(document.body.dataset.qa).state==='play'");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF',windowsVirtualKeyCode:70});
  await new Promise(r=>setTimeout(r,180));await send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF',windowsVirtualKeyCode:70});
  await wait("JSON.parse(document.body.dataset.qa).ammo.mag<30");
  const fired=await evaluate("JSON.parse(document.body.dataset.qa)");
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'r',code:'KeyR',windowsVirtualKeyCode:82});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'r',code:'KeyR',windowsVirtualKeyCode:82});
  await wait("JSON.parse(document.body.dataset.qa).ammo.mag===30");
  const reloaded=await evaluate("JSON.parse(document.body.dataset.qa)");
  const link=await evaluate("document.querySelector('a[download]')?.getAttribute('href')");
  results.push({pass:before.ammo.mag===30&&fired.ammo.mag<30&&reloaded.ammo.mag===30&&link?.includes('timber-house-art-kit.zip'),before,fired,reloaded,downloadLink:link});
  await evaluate("document.getElementById('bPause').click()");
 }
 const report={schema:'sunbreak-roundtrip-browser-run-v1',phase,date:new Date().toISOString(),captureMethod:'Actual native hardware headless WebGL, game-owned canvas export only; no desktop or window pixels',pass:errors.length===0&&results.every(r=>r.pass),results,errors};
 await writeFile(resolve(game,'qa/'+prefix+'-'+phase+'.json'),JSON.stringify(report,null,2)+'\n');
 if(!report.pass)process.exitCode=1;
}finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close',{},null)}catch{}socket.close()}
 if(browser&&browser.exitCode===null)await new Promise(r=>{const t=setTimeout(()=>{browser.kill();r()},5000);browser.once('exit',()=>{clearTimeout(t);r()})});
 assert.equal(dirname(profile),resolve(tmpdir()));assert.ok(basename(profile).startsWith('sunbreak-roundtrip-'));
 await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(e=>console.warn('Retained isolated temporary profile:',e.message));
}
