// Isolated native-asset WebGL QA. Captures the renderer canvas, never a desktop
// or window screenshot. Software-rendered fixed-step samples are not benchmarks.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,basename,extname,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const html=String.raw`<!DOCTYPE html><html><head><base href="/"><script type="importmap">{"imports":{"three":"/vendor/presentation/build/three.module.js","three/addons/":"/vendor/presentation/examples/jsm/"}}</script></head><body style="margin:0"><script type="module">
import * as T from '/vendor/three/build/three.module.js';
import {buildActors} from '/actors.js';
const scene=new T.Scene();scene.background=new T.Color(0xbcc7c6);
const camera=new T.PerspectiveCamera(36,1.5,.01,40);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,960);renderer.setPixelRatio(1);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;document.body.append(renderer.domElement);
scene.add(new T.HemisphereLight(0xe8f2ff,0x657664,2.2));
const sun=new T.DirectionalLight(0xffeddb,3.2);sun.position.set(-3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.02;scene.add(sun);
const floor=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0x777f7a,roughness:.94}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(40,80,0x8c9995,0x8c9995);grid.position.y=.002;scene.add(grid);
const g=new T.Group(),wg2=new T.Group(),gunTip=new T.Object3D();wg2.position.set(.30,1.43,0);gunTip.position.set(0,.02,.92);wg2.add(gunTip);g.add(wg2);scene.add(g);
const dark=new T.MeshStandardMaterial({color:0x20262a,metalness:.5,roughness:.55});
function box(w,h,d,x,y,z){const m=new T.Mesh(new T.BoxGeometry(w,h,d),dark);m.position.set(x,y,z);m.castShadow=true;wg2.add(m)}
box(.09,.10,.80,0,0,.45);box(.08,.18,.14,0,-.12,.14);box(.07,.06,.26,0,.06,.80);
const e={g,wg2,gunTip,alive:true,tactical:{}},actors=await buildActors({THREE:T,enemies:[e]});
function render(view='front'){
 const p=g.position;
 const views={front:[2.8,1.9,4.5],side:[4.4,1.7,.4],rear:[-2.8,1.8,-4.5],grip:[1.4,1.7,1.5]};
 camera.position.copy(p).add(new T.Vector3(...views[view]));camera.lookAt(p.x,p.y+(view==='grip'?1.10:.85),p.z+.05);camera.updateProjectionMatrix();
 renderer.render(scene,camera);
 const gl=renderer.getContext(),pixels=new Uint8Array(1440*960*4);gl.readPixels(0,0,1440,960,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let varied=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>24)varied++;
 const skin=g.getObjectByName('licensed-tactical-display');
 const bounds=new T.Box3().setFromObject(skin,true);
 return{png:renderer.domElement.toDataURL('image/png'),stats:actors.poseStats()[0],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),height:bounds.max.y-p.y},variedPixels:varied,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};
}
window.actorQA={
 sample(options={}){
  const {stance=0,lean=0,aimPitch=0,speed=0,angle=0,recoil=0,hurt=0,rootY=0,view='front',frames=120}=options;
  g.position.set(0,rootY,0);g.rotation.set(0,0,0);floor.position.y=rootY;
  let blended=e.tactical.stance||0;
  for(let i=0;i<frames;i++){
   blended+=(stance-blended)*(1-Math.exp(-7/60));
   wg2.position.y=1.43-.52*blended;wg2.rotation.x=aimPitch;
   e.tactical={mode:speed?'reposition':'aim',stance:blended,lean,speed,moveAngle:angle,aimPitch,recoil:i===frames-1?recoil:0,hurt:i>frames-10?hurt:0,alert:1};
   g.position.x+=Math.sin(angle)*speed/60;g.position.z+=Math.cos(angle)*speed/60;
   actors.update(1/60,{live:true,pres:false});
  }
  return render(view);
 },
 frame(n){
  const dt=1/60,t=n*dt,stance=(1-Math.cos(t*Math.PI/3))*.5,lean=Math.sin(t*1.5)*.13;
  wg2.position.y=1.43-.52*stance;wg2.rotation.x=Math.sin(t*.7)*.2;
  e.tactical={mode:'reposition',stance,lean,speed:1.3,moveAngle:Math.PI/2,aimPitch:wg2.rotation.x,recoil:n%90===0?1:0,hurt:0,alert:1};
  g.position.x+=1.3*dt;actors.update(dt,{live:true,pres:false});renderer.render(scene,camera);
  return actors.poseStats()[0];
 },info:actors.info(),ready:true
};
</script></body></html>`;

const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Outside isolated source root');
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(bytes);
 }catch(error){res.writeHead(404);res.end(error.message)}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const address=`http://127.0.0.1:${server.address().port}`;
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Headless Chrome/Edge unavailable');
const profile=await mkdtemp(join(tmpdir(),'tactical-actor-'));
let browser,socket,sequence=0,session;
const pending=new Map(),exceptions=[],consoleErrors=[],invariantFailures=[];
function send(method,params={},sessionId=session){
 const id=++sequence;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},45000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
 });
}
const evaluate=async expression=>{
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));
 return r.result.value;
};
const report={schema:'sunbreak-tactical-actor-webgl-samples-v1',task:'sunbreak-tactical-public-2026-11-17',
 captureMethod:'headless native Three WebGL renderer canvas.toDataURL; no desktop/window screenshots',
 rendering:'ANGLE SwiftShader software renderer, fixed 1/60 steps; not a hardware benchmark',
 visualVerdict:'UNVERIFIED: representative samples do not establish full continuous review',samples:[],exceptions,consoleErrors,invariantFailures};
try{
 const endpoint=await new Promise((resolve,reject)=>{
  browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  browser.once('error',reject);let output='';
  const timer=setTimeout(()=>reject(Error('Browser startup timeout')),30000);
  browser.stderr.on('data',d=>{output+=d;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}});
 });
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 socket.addEventListener('message',event=>{
  const r=JSON.parse(event.data),p=pending.get(r.id);
  if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result)}
  if(r.method==='Runtime.exceptionThrown')exceptions.push(r.params.exceptionDetails);
  if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')consoleErrors.push(r.params.args.map(a=>a.value||a.description).join(' '));
 });
 const {targetId}=await send('Target.createTarget',{url:address},null);
 ({sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true},null));
 await send('Runtime.enable');
 const started=Date.now();
 while(!await evaluate('!!window.actorQA?.ready')){
  if(Date.now()-started>60000)throw Error('Native GLB/render initialization timeout');
  await new Promise(r=>setTimeout(r,250));
 }
 report.info=await evaluate('window.actorQA.info');
 for(const [name,options]of [
  ['standing-front',{}],['standing-grip',{view:'grip'}],
  ['crouch-side',{stance:1,view:'side'}],['crouch-front',{stance:1}],
  ['walking-front',{speed:2.4,stance:.18,frames:137}],
  ['lean-aim-grip',{stance:.65,lean:-.8,aimPitch:-.25,view:'grip'}],
  ['shot',{stance:.45,recoil:1}],['raised-guard',{rootY:.66,stance:1,view:'side'}]
 ]){
  const sample=await evaluate(`window.actorQA.sample(${JSON.stringify(options)})`),bytes=Buffer.from(sample.png.split(',')[1],'base64');
  delete sample.png;
  assert.ok(sample.variedPixels>5000,'Blank renderer canvas');
  if(sample.stats.feet.some(f=>f.ikError>.010))invariantFailures.push(name+': ankle residual exceeds 10mm');
  if(sample.stats.hands.some(h=>h.ikError>.005))invariantFailures.push(name+': wrist residual exceeds 5mm');
  if(name.startsWith('crouch')||name==='raised-guard')if(Math.abs(sample.bounds.height-1.23)>.025)invariantFailures.push(name+': crouch height does not match caller hit bounds');
  const path=`qa/tactical-actor-${name}.png`;await writeFile(new URL(path,new URL('../',import.meta.url)),bytes);
  report.samples.push({name,path,sha256:createHash('sha256').update(bytes).digest('hex'),options,...sample});
 }
 // This exercises every temporal step numerically. It is NOT a watched video.
 report.temporal=await evaluate(`(()=>{
  let maxFootError=0,maxHandError=0,frames=0;
  window.actorQA.sample({frames:30});
  for(let n=0;n<600;n++){const p=window.actorQA.frame(n);frames++;maxFootError=Math.max(maxFootError,...p.feet.map(f=>f.ikError));maxHandError=Math.max(maxHandError,...p.hands.map(h=>h.ikError))}
  return{frames,seconds:frames/60,maxFootError,maxHandError,fullContinuousVisualReview:false};
 })()`);
 report.sourceSHA256=createHash('sha256').update(await readFile(new URL('../actors.js',import.meta.url))).digest('hex');
 if(report.temporal.maxFootError>.010||report.temporal.maxHandError>.005)invariantFailures.push('temporal sweep: contact residual exceeds threshold');
 report.engineeringVerdict=exceptions.length||consoleErrors.length||invariantFailures.length?'REWORK':'PASS';
 await writeFile(new URL('tactical-actor-webgl.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({engineeringVerdict:report.engineeringVerdict,samples:report.samples.map(s=>({name:s.name,path:s.path,height:s.bounds.height,maxFootError:Math.max(...s.stats.feet.map(f=>f.ikError)),maxHandError:Math.max(...s.stats.hands.map(h=>h.ikError))})),temporal:report.temporal,exceptions,consoleErrors,invariantFailures},null,2));
 if(report.engineeringVerdict!=='PASS')process.exitCode=1;
}finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close',{},null)}catch{}socket.close()}
 if(browser&&browser.exitCode===null){
  await new Promise(resolve=>{const timer=setTimeout(()=>{browser.kill();resolve()},5000);browser.once('exit',()=>{clearTimeout(timer);resolve()})});
 }
 server.close();
 // Only the unique profile created above is eligible for recursive cleanup.
 assert.equal(dirname(profile),resolve(tmpdir()));assert.ok(basename(profile).startsWith('tactical-actor-'));
 await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(error=>console.warn('Temporary headless profile cleanup:',error.message));
}
