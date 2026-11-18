// Actual native-headless browser; game canvas evidence only, never desktop UI.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const game=fileURLToPath(new URL('../',import.meta.url));
const phase=process.argv.find(a=>a.startsWith('--phase='))?.slice(8)||'inspect';
const live=phase==='public';
const output=resolve(game,'qa/evidence',phase+'-'+new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(output,{recursive:true});
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome);
const profile=await mkdtemp(resolve(tmpdir(),'sunbreak-auto-'));
let browser,socket,session,sequence=0;const pending=new Map(),errors=[],results=[],trace=[];let traceDone=false;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
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
async function wait(expression,timeout=120000){
 const start=Date.now();while(Date.now()-start<timeout){const value=await evaluate(expression);if(value)return value;await delay(100)}
 throw Error('Timed out: '+expression);
}
async function key(code,down=true,autoRepeat=false){await send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',autoRepeat,key:code.replace('Key','').toLowerCase(),code,windowsVirtualKeyCode:code.at(-1).charCodeAt(0)})}
async function mouse(down=true,button='left'){
 await send('Input.dispatchMouseEvent',{type:down?'mousePressed':'mouseReleased',x:1000,y:550,button,buttons:down?(button==='left'?1:button==='right'?2:4):0,clickCount:1});
}
async function snapshot(){return evaluate(live?"window.demoQA.snapshot()":"arenaQA.snapshot()")}
function check(name,pass,details){results.push({name,pass:!!pass,...details?{details}:{}});if(!pass)throw Error('FAIL '+name)}
async function capture(name){
 console.log('Capturing '+name);
 const length=await evaluate("window.__riverCapture=document.querySelector('#app canvas').toDataURL('image/png').split(',')[1];window.__riverCapture.length");
 console.log('Encoded '+name+' '+length);
 let data='';for(let i=0;i<length;i+=65536)data+=await evaluate(`window.__riverCapture.slice(${i},${i+65536})`);
 await evaluate('delete window.__riverCapture');
 await writeFile(resolve(output,name+'.png'),Buffer.from(data,'base64'));
 const state=await snapshot();await writeFile(resolve(output,name+'.json'),JSON.stringify(state,null,2)+'\n');return state;
}
try {
 const endpoint=await new Promise((resolve,reject)=>{
  browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update',
   '--use-angle=d3d11','--disable-software-rasterizer','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
   '--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--window-size=1920,1080',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  browser.once('error',reject);const timer=setTimeout(()=>reject(Error('Headless launch timeout')),30000);let output='';
  browser.stderr.on('data',d=>{output+=d;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1])}});
 });
 socket=new WebSocket(endpoint);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
 socket.addEventListener('message',event=>{
  const r=JSON.parse(event.data),p=pending.get(r.id);if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result)}
  if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);
  if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')errors.push(r.params.args.map(a=>a.value||a.description).join(' '));
  if(r.method==='Tracing.dataCollected')for(const e of r.params.value)if(e.dur>20000)trace.push({name:e.name,category:e.cat,ts:e.ts,durationMS:e.dur/1000,pid:e.pid,tid:e.tid});
  if(r.method==='Tracing.tracingComplete')traceDone=true;
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'},null);
 ({sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true},null));await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:live?'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/':process.env.RIVER_QA_URL||'http://127.0.0.1:5190/river/'});
 await wait("!!document.body?.dataset.qa&&!document.getElementById('bStart').disabled");
 if(!live)check('licensed weapon and all textures loaded',(await snapshot()).weapon?.loaded&&(await snapshot()).errors.length===0,await snapshot());
 const weatherArg=process.argv.find(a=>a.startsWith('--weather='));
 if(!live&&weatherArg)await evaluate(`arenaQA.weather(${Number(weatherArg.slice(10))})`);
 if(phase==='quick'){
  console.log('Ready');if(process.argv.includes('--no-post'))await evaluate("document.getElementById('bPost').click()");await evaluate('arenaQA.view(-7,1.7,24,-.24,-.1)');console.log('View set');await delay(300);await capture('quick');console.log('Captured');
 }else if(phase==='afterrain'){
  check('default weather is after-rain daylight',(await evaluate('arenaQA.mapInfo()')).weather===0);
  for(const [name,...v]of [['valley-hero',-7,1.7,24,-.24,-.1],['riverbank',-4.7,1.35,10,-.12,-.32],['valley-wide',0,3.5,25,0,.05],['sun-side',10,1.7,8,-1,-.07],['reference-close',-4.4,1.1,11,-.65,-.55]]){await evaluate(`arenaQA.view(${v.join(',')})`);await delay(400);await capture(name)}
  for(const weather of [0,2,1,0]){
   await evaluate(`arenaQA.weather(${weather})`);await delay(150);
   const state=await evaluate('arenaQA.mapInfo()');
   check(`weather ${weather} rain, ripple and splash consistent`,state.lighting.rainVisible===(weather===2)&&state.lighting.splashVisible===(weather===2)&&state.lighting.rainRippleStrength===(weather===2?1:0),state.lighting);
   if(weather!==2)check('dry modes clear lightning',state.lighting.flashIntensity===0);
  }
 }else if(phase==='weather'){
  await evaluate("document.getElementById('bStart').click();arenaQA.reset();arenaQA.weather(2)",true);
  await delay(11500);
  let s=await evaluate('arenaQA.mapInfo()');check('live storm produces audible rain and thunder',s.audio.active&&s.audio.effectiveGain>0&&s.audio.thunderCount>=1,s.audio);
  await evaluate('arenaQA.weather(0)');await delay(250);s=await evaluate('arenaQA.mapInfo()');
  check('sunny switch shuts down active and pending storm audio',!s.audio.active&&s.audio.effectiveGain===0&&s.audio.pending===0,s.audio);
  const thunder=s.audio.thunderCount;await delay(1500);s=await evaluate('arenaQA.mapInfo()');
  check('sunny play does not spawn thunder or visual rain',s.audio.thunderCount===thunder&&!s.lighting.rainVisible&&!s.lighting.splashVisible&&s.lighting.rainRippleStrength===0&&s.lighting.flashIntensity===0,s.lighting);
  await capture('weather-sunny');
 }else if(phase==='map'){
  const views=[['river-hero',-7,1.7,24,-.24,-.1],['west-village',-8,1.7,7,1.1,-.02],['east-village',8,1.7,7,-1.1,-.02],['river-ford',0,1.7,22,0,-.2],['bridge',7,1.7,2,.9,-.1],['layout',0,32,33,0,-.83],['wet-mud',-10,1.7,12,0,-.7],['ruin',-12,1.7,22,.9,-.05]];
  for(const [name,...v]of views){await evaluate(`arenaQA.view(${v.join(',')})`);await delay(300);await capture(name)}
  results.push({name:'map rendered multi-view evidence',pass:true,info:await evaluate('arenaQA.mapInfo()')});
 }else if(phase==='art'){
  for(const id of ['west-buffer','east-buffer'])for(const [name,x,y,z,yaw,pitch]of [['front',-7,2.0,12,-.50,.08],['side',-8,2.1,6,-.95,.05],['interior',0,2.36,1.3,.15,.04]]){
   await evaluate(`arenaQA.cabinView('${id}',${x},${y},${z},${yaw},${pitch})`);await delay(400);await capture(id+'-'+name);
  }
  for(const weather of [2,0]){
   await evaluate(`arenaQA.weather(${weather})`);
   for(const [name,...v]of [['ground',-10.7,1.7,3,.1,-.67],['tree-root',-27,1.7,-8,.8,-.1],['ruin-break',-13,1.7,22,.8,-.15],['ruin-inside',-17,1.7,19.5,.5,-.3]]){await evaluate(`arenaQA.view(${v.join(',')})`);await delay(350);await capture(name+'-weather'+weather)}
  }
  results.push({name:'cabins, ground, trees and ruins in default rain and neutral daylight',pass:true,info:await evaluate('arenaQA.mapInfo()')});
 }else if(phase==='cabins'){
  await evaluate("document.getElementById('bStart').click()",true);await delay(150);
  for(const id of ['west-buffer','east-buffer']){
   await evaluate(`arenaQA.cabinTravel('${id}',-1.08,6.8)`);
   await key('KeyW');await delay(380);await key('KeyW',false);
   let s=await evaluate('arenaQA.walkState()');check(id+' actual steps support player',s.support>.1&&Math.abs(s.position[1]-s.support-1.7)<.04,s);
   await evaluate(`arenaQA.cabinTravel('${id}',-1.08,3.8)`);await delay(100);
   await key('KeyE');await key('KeyE',false);await delay(950);
   let c=await evaluate('arenaQA.cabinState()');check(id+' actual E opens nearest door',c.houses.find(h=>h.id===id).door.open,c);
   check(id+' does not toggle other door',c.houses.filter(h=>h.id!==id).every(h=>h.door.toggles===0));
   await key('KeyW');await delay(600);await key('KeyW',false);
   s=await evaluate('arenaQA.walkState()');check(id+' player enters supported interior',Math.abs(s.support-.66)<.01&&!s.blocked,s);
   await key('KeyS');await delay(650);await key('KeyS',false);
   await key('KeyE');await key('KeyE',false);await delay(950);
   c=await evaluate('arenaQA.cabinState()');check(id+' actual E closes door',c.houses.find(h=>h.id===id).door.angle<.02,c);
   await evaluate(`arenaQA.cabinTravel('${id}',-1.08,3.8)`);await key('KeyW');await delay(500);await key('KeyW',false);
   s=await evaluate('arenaQA.walkState()');const door=await evaluate(`arenaQA.cabinPoint('${id}',-1.08,2.36,2.4)`);
   check(id+' closed leaf blocks actual movement',Math.hypot(s.position[0]-door.x,s.position[2]-door.z)>.42,s);
   // Pause releases pointer lock asynchronously. Settle that lifecycle before
   // the next cabin reset, or its late event pauses the next travel test.
   await evaluate('arenaQA.loseLock()');await key('KeyE');await key('KeyE',false);check(id+' paused E rejected',(await evaluate('arenaQA.cabinState()')).houses.every(h=>h.door.toggles===0));
  }
  await capture('cabins-final');
 }else if(phase==='traversal'){
  await evaluate("document.getElementById('bStart').click()",true);await delay(150);
  for(const z of [-23,-4,15,0])for(const side of [-1,1]){
   await evaluate(`arenaQA.travel(${side*9},${z},${side*Math.PI/2})`);
   await key('KeyW');await delay(4500);await key('KeyW',false);
   const s=await evaluate('arenaQA.walkState()');check(`actual player ${z} side ${side} crosses`,side*s.position[0]<-8,s);
   check(`player grounded ${z} side ${side}`,Math.abs(s.position[1]-s.support-1.7)<.03,s);
   check(`NPC feet track support ${z} side ${side}`,s.enemies.every(e=>Math.abs(e.position[1]-e.support)<.03),s.enemies);
  }
  for(const x of [-2,0,2])for(const direction of [-1,1]){
   await evaluate(`arenaQA.travel(${x},${-4-direction*4},${direction===1?'Math.PI':'0'})`);
   await key('KeyW');await delay(2000);await key('KeyW',false);
   const s=await evaluate('arenaQA.walkState()');check(`bridge long-edge crossing x${x} dir${direction}`,direction*(s.position[2]+4)>3,s);
   check(`bridge edge ends grounded x${x} dir${direction}`,Math.abs(s.position[1]-s.support-1.7)<.03,s);
  }
  await evaluate('arenaQA.travel(-17,-18,0)');await key('KeyW');await delay(800);await key('KeyW',false);
  const room=await evaluate('arenaQA.walkState()');check('actual doorway enters intact house',room.position[2]<-20&&room.position[2]>-25,room);
  check('wall blocks ray',!(await evaluate('arenaQA.lineOfSight({x:-25,y:1.6,z:-24},{x:-17,y:1.6,z:-24})')));
  check('doorway passes ray',await evaluate('arenaQA.lineOfSight({x:-17,y:1.6,z:-18},{x:-17,y:1.6,z:-23})'));
  await capture('traversal-final');
 }else if(phase==='inspect'){
  console.log(JSON.stringify({weapon:(await snapshot()).weapon,errors:(await snapshot()).errors},null,2));
  await capture('held');
  for(const p of [.15,.24,.35,.48,.60,.73,.80,.92]){
   await evaluate(`arenaQA.pose(${p})`);await delay(80);
   const s=await capture('reload-'+String(Math.round(p*100)).padStart(2,'0'));
   console.log(JSON.stringify({phase:p,pose:s.weapon?.reload}));
  }
 }else if(phase==='checks'||live){
  await evaluate("document.getElementById('bStart').click()",true);await delay(150);
  if(!live)await evaluate('arenaQA.reset()');
  // Aim away from targets; use actual browser mouse input, not direct fire().
  await key('ArrowUp');await delay(700);await key('ArrowUp',false);
  let before=await snapshot();
  await mouse();await delay(650);await mouse(false);await delay(60);
  let after=await snapshot();check('held actual left mouse fires repeatedly',before.ammo.mag-after.ammo.mag>=5,{before:before.ammo,after:after.ammo});
  const released=after.ammo.mag;await delay(250);check('released mouse stops immediately',(await snapshot()).ammo.mag===released);
  await mouse(true,'right');await delay(250);await mouse(false,'right');
  check('right mouse aims but never fires',(await snapshot()).ammo.mag===released);
  await mouse(true,'middle');await mouse(false,'middle');await delay(100);
  check('middle mouse never fires',(await snapshot()).ammo.mag===released);
  before=await snapshot();await key('KeyR');await key('KeyR',false);await delay(250);
  check('reload starts and defers replenishment',(await snapshot()).ammo.mag===before.ammo.mag&&(await snapshot()).reloadProgress>0);
  await mouse();await delay(250);await mouse(false);check('reload blocks fire',(await snapshot()).ammo.mag===before.ammo.mag);
  await delay(2100);after=await snapshot();check('reload completes once and conserves total ammunition',after.ammo.mag===30&&after.ammo.mag+after.ammo.reserve===before.ammo.mag+before.ammo.reserve,{before:before.ammo,after:after.ammo});
  if(!live){
   const stats=(await snapshot()).times;
   check('no shot interval below 105 ms',stats.every((t,i)=>!i||t-stats[i-1]>=104.99),stats);
   await evaluate('arenaQA.reset()');await mouse();await key('KeyF');await mouse(false);
   before=await snapshot();await delay(300);after=await snapshot();
   check('F remains held after mouse release',after.ammo.mag<before.ammo.mag);
   await key('KeyF',false);before=await snapshot();await delay(200);
   check('F release stops firing',(await snapshot()).ammo.mag===before.ammo.mag);
   await mouse();await evaluate("arenaQA.blur()");after=await snapshot();await delay(250);
   check('blur clears and pauses trigger',after.state==='pause'&&!after.firing.held&&(await snapshot()).ammo.mag===after.ammo.mag);
   await evaluate('arenaQA.resume()');before=await snapshot();await delay(200);
   check('resume does not inherit held input',(await snapshot()).ammo.mag===before.ammo.mag);await mouse(false);
   await key('KeyF');await evaluate("arenaQA.blur();arenaQA.resume()");before=await snapshot();
   await key('KeyF',true,true);await delay(250);after=await snapshot();
   check('OS F repeat cannot rearm trigger after clear/resume',!after.firing.held&&after.ammo.mag===before.ammo.mag);await key('KeyF',false);
   await key('KeyF');await evaluate("document.getElementById('soundVolume').focus()");before=await snapshot();await delay(250);after=await snapshot();
   check('UI focus clears an already held trigger',!after.firing.held&&after.ammo.mag===before.ammo.mag);
   await key('KeyF',true,true);await key('KeyF',false);await evaluate('document.activeElement.blur()');
   await mouse();await evaluate("dispatchEvent(new Event('pointercancel'))");before=await snapshot();await delay(200);
   check('pointer cancellation clears held fire',!before.firing.held&&(await snapshot()).ammo.mag===before.ammo.mag);await mouse(false);
   await mouse();await evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))");before=await snapshot();
   await delay(200);after=await snapshot();
   check('hidden-document lifecycle clears and pauses fire',before.state==='pause'&&!before.firing.held&&after.ammo.mag===before.ammo.mag);
   await evaluate("delete document.hidden;arenaQA.resume()");await mouse(false);
   await key('KeyF');await evaluate('arenaQA.loseLock()');after=await snapshot();
   check('pointer lock loss clears held input',!after.firing.held);await key('KeyF',false);await evaluate('arenaQA.resume()');
   await mouse();await evaluate("arenaQA.setPresentation(true)");check('presentation clears held input',!(await snapshot()).firing.held);
   await evaluate("arenaQA.setPresentation(false);arenaQA.resume()");
   await evaluate("arenaQA.setAmmo(28,1)");await key('KeyR');await key('KeyR',false);await delay(2450);
   after=await snapshot();check('partial reserve reload conserved',after.ammo.mag===29&&after.ammo.reserve===0,after.ammo);
   await key('KeyR');await key('KeyR',false);check('zero reserve rejects reload',(await snapshot()).remaining===0);
   await evaluate("arenaQA.setAmmo(30,40)");await key('KeyR');await key('KeyR',false);check('full magazine rejects reload',(await snapshot()).remaining===0);
   await evaluate("arenaQA.setAmmo(1,90)");await mouse();await delay(400);await mouse(false);
   check('empty magazine never negative',(await snapshot()).ammo.mag===0);
   await key('KeyR');await key('KeyR',false);await delay(500);await evaluate('arenaQA.pause()');before=await snapshot();await delay(300);after=await snapshot();
   check('pause freezes reload',after.remaining===before.remaining&&after.ammo.mag===0);
   await evaluate('arenaQA.resume()');await delay(2000);check('resumed reload completes',(await snapshot()).ammo.mag===30);
   await evaluate("arenaQA.setAmmo(8,60)");await key('KeyR');await key('KeyR',false);await delay(450);await evaluate('arenaQA.cancel()');
   await delay(2400);after=await snapshot();check('cancelled reload cannot add ammunition later',after.ammo.mag===8&&after.ammo.reserve===60&&after.remaining===0);
   await evaluate('arenaQA.resume()');
   await evaluate('arenaQA.setAmmo(8,60)');await key('KeyR');await key('KeyR',false);await delay(450);await evaluate('arenaQA.outcome()');
   await delay(2400);after=await snapshot();check('death cancels reload without later ammunition transfer',after.state==='dead'&&after.ammo.mag===8&&after.ammo.reserve===60&&after.remaining===0);
   await evaluate('arenaQA.reset();arenaQA.setAmmo(8,60)');await key('KeyR');await key('KeyR',false);await delay(350);await evaluate('arenaQA.reset()');
   await delay(2400);after=await snapshot();check('restart cancels prior reload with no late transfer',after.ammo.mag===30&&after.ammo.reserve===90&&after.remaining===0);
   await evaluate('arenaQA.setAmmo(10,50)');
   const cuesBefore=(await snapshot()).audio.byType||{};
   await key('KeyR');await key('KeyR',false);await delay(800);await key('KeyR');await key('KeyR',false);await delay(1800);
   after=await snapshot();const cuesAfter=after.audio.byType||{};
   check('repeated R never restarts or duplicates mechanical cues',(cuesAfter.magout||0)-(cuesBefore.magout||0)===1&&(cuesAfter.magin||0)-(cuesBefore.magin||0)===1&&after.ammo.mag===30,after.audio);
   await evaluate("const slider=document.getElementById('soundVolume');slider.focus()");
   before=await snapshot();await key('KeyF');await delay(250);await key('KeyF',false);after=await snapshot();
   check('focused UI cannot start firing',after.ammo.mag===before.ammo.mag&&!after.firing.held);
   await evaluate("document.activeElement.blur();arenaQA.pose(.4)");await delay(80);after=await snapshot();
   check('visible arm IK retains bone lengths',after.weapon.reload.maximumLengthError<1e-8,after.weapon.reload);
   await evaluate('arenaQA.pose(null)');await delay(80);check('reload restores held pose',(await snapshot()).weapon.reload.stage==='held');
  }
  await capture(live?'public-after-reload':'checks-final');
 }else if(phase==='water-samples'){
  await evaluate("document.getElementById('bStart').click();arenaQA.waterView()",true);
  await delay(250);const first=await snapshot(),samples=[];
  for(let i=0;i<6;i++){await delay(700);const s=await capture('flow-'+i);samples.push({name:'flow-'+i,time:s.water.time,weather:s.weather,camera:s.camera})}
  check('actual live flow advances without rain or camera travel',samples.every((s,i)=>s.weather===0&&JSON.stringify(s.camera)===JSON.stringify(samples[0].camera)&&(i===0||s.time>samples[i-1].time))&&samples.at(-1).time-first.water.time>4,{samples,scope:'Six timed live-rendered samples only. Not full continuous video review.'});
 }else if(phase==='water-motion'){
  console.log('Starting native water recording');
  await evaluate("document.getElementById('bStart').click()",true);
  const movie=await evaluate('arenaQA.waterMovie()',true);
  await writeFile(resolve(output,'water-live.webm'),Buffer.from(movie.data,'base64'));delete movie.data;
  check('actual live water clock advances over recording',movie.endTime-movie.startTime>9&&movie.durationMS>=10000,movie);
  await capture('water-end');
 }else if(phase==='movie'){
  await evaluate("document.getElementById('bStart').click()",true);
  const movie=await evaluate("arenaQA.movie()",true);
  await writeFile(resolve(output,'reload-live.webm'),Buffer.from(movie.data,'base64'));delete movie.data;
  results.push({name:'actual timer canvas recording',pass:true,...movie});
 }else if(phase==='benchmark'||phase==='profile'||phase==='sunny-benchmark'){
  await evaluate(`arenaQA.weather(${phase==='sunny-benchmark'?0:2})`);
  if(phase==='profile')await send('Tracing.start',{categories:'devtools.timeline,v8,blink,disabled-by-default-v8.gc',options:'record-continuously'},null);
  await evaluate("document.getElementById('bStart').click();arenaQA.reset()",true);
  const report=await evaluate('arenaQA.benchmark()');
  results.push({name:'30s actual combat reload native WebGL sample',pass:report.duration>=30000&&report.p95<=33.3&&report.p99<=33.3&&report.max<=50&&!/swiftshader|software/i.test(report.renderer),...report});
  if(phase==='profile'){await send('Tracing.end',{},null);for(let i=0;i<100&&!traceDone;i++)await delay(100);await writeFile(resolve(output,'long-trace.json'),JSON.stringify(trace,null,2));console.log({traceEvents:trace.length})}
 }
 const report={schema:'sunbreak-auto-browser-v1',date:new Date().toISOString(),phase,method:'native-headless actual WebGL canvas; no desktop/window interaction',pass:!errors.length&&results.every(r=>r.pass),results,errors};
 let n=1;while(existsSync(resolve(output,phase+'-'+n+'.json')))n++;
 await writeFile(resolve(output,phase+'-'+n+'.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({phase,pass:report.pass,checks:results.length,errors,report:resolve(output,phase+'-'+n+'.json')}));
 if(!report.pass)process.exitCode=1;
}catch(error){
 let diagnostics;try{diagnostics=await evaluate("({url:location.href,boot:document.getElementById('bootStatus')?.textContent,error:document.getElementById('err')?.textContent,qa:document.body?.dataset.qa,render:document.body?.dataset.render,resources:performance.getEntriesByType('resource').filter(r=>r.responseStatus>=400).map(r=>({name:r.name,status:r.responseStatus}))})")}catch{}
 let n=1;while(existsSync(resolve(output,phase+'-failure-'+n+'.json')))n++;
 await writeFile(resolve(output,phase+'-failure-'+n+'.json'),JSON.stringify({pass:false,date:new Date().toISOString(),error:error.stack,results,errors,diagnostics},null,2)+'\n');throw error;
}finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close',{},null)}catch{}socket.close()}
 if(browser&&browser.exitCode===null)await new Promise(r=>{const t=setTimeout(()=>{browser.kill();r()},5000);browser.once('exit',()=>{clearTimeout(t);r()})});
 assert.equal(dirname(profile),resolve(tmpdir()));assert.ok(basename(profile).startsWith('sunbreak-auto-'));
 await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(()=>{});
}
