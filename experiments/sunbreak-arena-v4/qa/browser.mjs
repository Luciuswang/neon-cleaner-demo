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
let browser,socket,session,sequence=0;const pending=new Map(),errors=[],results=[];
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
async function snapshot(){return evaluate(live?"({...JSON.parse(document.body.dataset.qa),weapon:JSON.parse(document.body.dataset.render||'{}').weapon})":"arenaQA.snapshot()")}
function check(name,pass,details){results.push({name,pass:!!pass,...details?{details}:{}});if(!pass)throw Error('FAIL '+name)}
async function capture(name){
 const data=await evaluate("document.querySelector('#app canvas').toDataURL('image/png')");
 await writeFile(resolve(output,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
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
 });
 const {targetId}=await send('Target.createTarget',{url:'about:blank'},null);
 ({sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true},null));await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:live?'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/v4/':'http://127.0.0.1:5189/v4/'});
 await wait("!!document.body?.dataset.qa&&!document.getElementById('bStart').disabled");
 if(!live)check('licensed weapon and all textures loaded',(await snapshot()).weapon?.loaded&&(await snapshot()).errors.length===0,await snapshot());
 if(phase==='inspect'){
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
 }else if(phase==='movie'){
  await evaluate("document.getElementById('bStart').click()",true);
  const movie=await evaluate("arenaQA.movie()",true);
  await writeFile(resolve(output,'reload-live.webm'),Buffer.from(movie.data,'base64'));delete movie.data;
  results.push({name:'actual timer canvas recording',pass:true,...movie});
 }else if(phase==='benchmark'){
  await evaluate("document.getElementById('bStart').click();arenaQA.reset()",true);
  const report=await evaluate('arenaQA.benchmark()');
  results.push({name:'30s actual combat reload native WebGL sample',pass:report.duration>=30000&&report.p95<=33.3&&report.p99<=33.3&&report.max<=50&&!/swiftshader|software/i.test(report.renderer),...report});
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
