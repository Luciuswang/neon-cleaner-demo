// CPU-only by default. Root exclusively schedules --phase=visual and its server.
// New immutable evidence only; no desktop capture, gameplay runs or Git mutations.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, createReadStream} from 'node:fs';
import {readFile, writeFile, readdir, mkdir, mkdtemp, stat, rm} from 'node:fs/promises';
import {resolve, relative, dirname, basename, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {GAME, TIME, CDP, assertNative, assertCapture, sha, canonical, pngDimensions, parseTree} from './migration.mjs';
import {runtimeHashes} from './source-binding.mjs';

export const TASK = 'river-afterrain-light-understory-2026-11-20';
export const BASELINE = '8647a8fcdfaf9fcd199e4b0495628b894fd64aef';
export const VIEWS = Object.freeze([
  {name:'ground-lane', camera:[-10,2.3,12,.65,-.9], weather:0},
  {name:'puddle-sun', camera:[10,1.45,12,-.7,-.20], weather:0},
  {name:'forest-hillside', camera:[-27,2,14,.9,.03], weather:0},
  {name:'cabin-edge', cabin:'west-buffer', camera:[-2.5,2,7.5,0,0], weather:0},
  {name:'river-hero', camera:[-7,1.7,24,-.24,-.1], weather:0},
  {name:'river-wide', camera:[0,16,33,0,-.60], weather:0},
  {name:'storm-ground-lane', camera:[-10,2.3,12,.65,-.9], weather:2}
].map(v=>Object.freeze({...v,camera:Object.freeze(v.camera)})));
export const VARIANTS = Object.freeze({
  previous:Object.freeze({look:'previous', materials:'procedural', enabled:false}),
  current:Object.freeze({look:null, materials:'procedural', enabled:true}),
  'previous-legacy':Object.freeze({look:'previous', materials:'legacy', enabled:false}),
  'current-legacy':Object.freeze({look:null, materials:'legacy', enabled:true})
});
const REPO=resolve(GAME,'../..'), PREFIX='experiments/sunbreak-river-v4/';
const json=value=>JSON.stringify(value,null,2)+'\n';
const equal=(a,b)=>canonical(a)===canonical(b);
const writeNew=(path,data)=>writeFile(path,data,{flag:'wx'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const PROTECTED=['index.html','boot-ui.js','map-layout.js','tactical-ai.js','reload-pose.js','actors.js','weapon.js','audio.js','combat-controls.js','storm-audio.js','terrain-ray.js','buffer-house.js','buffer-house-logic.js','house-logic.js','timber-house.js','village.js','ruins.js','fracture-geometry.js','shot-feedback-event.js','combat-feedback.js','stone-cover.js'];
const DEMOS=['sunbreak-fable52','sunbreak-realistic-v2','sunbreak-storm-v3','sunbreak-arena-v4','procedural-material-lab'].map(n=>'experiments/'+n);

export function parseOptions(args) {
  const out={phase:'units',url:process.env.RIVER_QA_URL||'http://127.0.0.1:5190/river/',views:VIEWS.map(v=>v.name),variants:['previous','current'],explicitSelection:false};
  const seen=new Set();
  for(const arg of args){
    if(arg==='--help'){out.help=true;continue}
    const m=arg.match(/^--(phase|url|views|variants)=(.+)$/);assert.ok(m,'Unknown/empty option: '+arg);
    const [,key,value]=m;assert.ok(!seen.has(key),'Duplicate option: '+key);seen.add(key);
    if(key==='views'||key==='variants'){
      out.explicitSelection=true;
      out[key]=value.split(',').map(s=>s.trim());
      if(key==='variants')out[key]=out[key].map(s=>s.replace('+legacy','-legacy'));
      const allowed=key==='views'?VIEWS.map(v=>v.name):Object.keys(VARIANTS);
      assert.ok(out[key].every(s=>allowed.includes(s)), 'Unknown '+key);
      assert.equal(new Set(out[key]).size,out[key].length,'Duplicate '+key);
    }else out[key]=value;
  }
  assert.ok(['units','visual'].includes(out.phase),'phase must be units or visual');
  const u=new URL(out.url);
  assert.ok(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname),'local QA server only');
  assert.ok(!u.username&&!u.password&&!u.hash&&!u.search,'use an unmodified local QA URL; harness owns all query options');
  assert.equal(u.pathname,'/river/','serve.mjs /river/ route required for source binding');
  return out;
}

export function variantURL(base,variant){
  const config=VARIANTS[variant];assert.ok(config,'Unknown variant');
  const u=new URL(base);u.search='';u.searchParams.set('materials',config.materials);
  if(config.look)u.searchParams.set('look',config.look);
  return u.href;
}

export function coverage(options,captures,pairs){
  const captured=new Set(captures.filter(c=>c.pass).map(c=>c.variant+'/'+c.view.name));
  const paired=new Set(pairs.filter(p=>p.pass).map(p=>p.a+'/'+p.b+'/'+p.view));
  const missing=[];
  for(const view of VIEWS){
    for(const variant of ['previous','current'])if(!captured.has(variant+'/'+view.name))missing.push(variant+'/'+view.name);
    if(!paired.has('previous/current/'+view.name))missing.push('pair/'+view.name);
  }
  return {full:!options.explicitSelection&&!missing.length,explicitSelection:options.explicitSelection,missing,
    selectedViews:options.views,selectedVariants:options.variants,requiredViews:VIEWS.map(v=>v.name),requiredVariants:['previous','current']};
}

export function expectedCamera(view,cabin){
  let [x,y,z,yaw,pitch]=view.camera;
  if(view.cabin){
    assert.ok(cabin?.point&&cabin?.origin&&cabin?.forward,'independent cabin transform points required');
    for(const p of [cabin.point,cabin.origin,cabin.forward])assert.ok(['x','y','z'].every(k=>Number.isFinite(p[k])),'finite cabin transform');
    ({x,y,z}=cabin.point);
    const dx=cabin.forward.x-cabin.origin.x,dz=cabin.forward.z-cabin.origin.z;
    assert.ok(Math.abs(Math.hypot(dx,dz)-1)<1e-8,'rigid cabin transform');
    yaw+=Math.atan2(-dx,-dz);
  }
  const sx=Math.sin(pitch/2),cx=Math.cos(pitch/2),sy=Math.sin(yaw/2),cy=Math.cos(yaw/2);
  return {position:[x,y,z],quaternion:[sx*cy,cx*sy,-sx*sy,cx*cy],forward:[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)]};
}

export function assertPreviousInvariants(info){
  assert.equal(info.afterrain?.enabled,false,'previous look must disable afterrain');
  assert.equal(info.afterrain.look,'previous','previous look identity');
  for(const key of ['forest','puddles','light'])assert.equal(info.afterrain[key],null,'previous disables '+key);
  // The existing migration contract provides these zero-cost baseline fields.
  // Do not apply this invariant to current, which may add a bounded reflection.
  assert.equal(info.migration?.extraReflectionPasses,0,'previous adds no reflection passes');
  assert.equal(info.migration?.extraGeometry,0,'previous adds no geometry');
  for(const key of ['extraReflectionPasses','extraGeometry'])if(key in info.afterrain)
    assert.equal(info.afterrain[key],0,'previous afterrain '+key);
}

export function assertLookCapture(capture,view,variant,sources,gpu,png){
  const config=VARIANTS[variant];assert.ok(config,'known capture variant');
  assertCapture(capture,view,config.materials,sources);
  assertNative(capture.snapshot.renderer,gpu);
  assert.equal(capture.info.afterrain?.enabled,config.enabled,'actual afterrain route');
  assert.equal(capture.info.afterrain.look,config.enabled?'afterrain':'previous','actual look identity');
  assert.equal(capture.url,variantURL(capture.baseURL,variant),'actual document URL');
  assert.deepEqual(pngDimensions(png),[1920,1080]);
  assert.equal(capture.decoded.pngSHA256,sha(png),'decoded PNG bytes must be the saved PNG');
  assert.ok(Number.isInteger(capture.decoded.nonBlackPixels)&&capture.decoded.nonBlackPixels<=1920*1080);
  const requested=expectedCamera(view,capture.cabinTransform),actual=capture.snapshot.camera;
  assert.ok(actual.position.every((v,i)=>Math.abs(v-requested.position[i])<1e-8),'requested position including cabin transform');
  assert.ok(Math.abs(Math.hypot(...actual.quaternion)-1)<1e-8,'unit quaternion');
  const [qx,qy,qz,qw]=actual.quaternion;
  const forward=[-2*(qx*qz+qw*qy),-2*(qy*qz-qw*qx),-(1-2*(qx*qx+qy*qy))];
  // Existing presentation includes a small roll. Verify requested aim independent
  // of that roll, then require the entire quaternion to match across each pair.
  assert.ok(forward.every((v,i)=>Math.abs(v-requested.forward[i])<1e-8),'requested yaw/pitch');
  assert.ok(actual.fov>0&&actual.fov<180,'valid camera fov');
  for(const key of ['camera','viewport','weather','buildHashes','renderer','presentation'])
    assert.ok(equal(capture.before[key],capture.snapshot[key]),'capture callback '+key+' drift');
  for(const key of ['time','weather','lighting','afterrain']){
    assert.notEqual(capture.beforeInfo?.[key],undefined,'pre-capture '+key+' required');
    assert.ok(equal(capture.beforeInfo[key],capture.info[key]),'capture callback info '+key+' drift');
  }
  for(const key of ['water','migration'])assert.equal(capture.beforeInfo[key]?.time,TIME,'pre-capture '+key+' clock');
  if(!config.enabled)assertPreviousInvariants(capture.info);
  else{
    const {forest,puddles,light}=capture.info.afterrain;
    assert.ok(light&&typeof light==='object','afterrain light metadata required');
    assert.ok(Number.isInteger(forest?.triangles)&&forest.triangles>0&&forest.triangles<=180000,'task forest triangle budget');
    assert.ok(Number.isInteger(forest.drawCalls)&&forest.drawCalls>0&&forest.drawCalls<=8,'task forest draw budget');
    assert.equal(forest.shadowCalls,0);assert.equal(forest.shadowTriangles,0);
    if(config.materials==='procedural'){
      assert.equal(puddles?.planeY,0,'flat ground reflection plane');assert.deepEqual(puddles.resolution,[768,432]);
      assert.equal(puddles.samples,0);assert.equal(puddles.maxPassesPerMainFrame,1);
      assert.equal(puddles.enabled,true);assert.ok(Number.isInteger(puddles.frames)&&puddles.frames>0,'reflection actually rendered');
      assert.equal(puddles.estimatedColorBytes,768*432*8,'half-float color target budget');
    }else assert.equal(puddles,null,'legacy materials do not bind procedural puddles');
  }
  if(config.materials==='procedural'){
    assert.ok(capture.info.migration.bake&&capture.info.migration.ground,'procedural bake and terrain inventory');
    assert.ok(capture.info.migration.materials?.length>0,'attached procedural materials');
    assert.equal(capture.info.migration.ground.perFrameBakes,0,'no per-frame procedural bakes');
  }else{
    assert.equal(capture.info.migration.bake,null,'legacy must not bake procedural maps');
    assert.deepEqual(capture.info.migration.materials,[],'legacy must not attach procedural maps');
  }
}

export function assertLookPair(a,b){
  // Lighting/material/vegetation/render-cost differences are the intended subject.
  // In particular, migration.assertPair incorrectly demands equal lighting here.
  for(const key of ['camera','viewport','weather','buildHashes','renderer','presentation']){
    assert.notEqual(a.snapshot[key],undefined,'pair requires '+key);
    assert.ok(equal(a.snapshot[key],b.snapshot[key]),'A/B '+key+' mismatch');
  }
  for(const key of ['time','weather','map']){
    assert.notEqual(a.info[key],undefined,'pair requires info '+key);
    assert.ok(equal(a.info[key],b.info[key]),'A/B info '+key+' mismatch');
  }
  for(const c of [a,b]){
    assert.equal(c.info.time,TIME);assert.equal(c.info.water?.time,TIME);
    assert.equal(c.info.migration?.time,TIME);assert.equal(c.info.migration?.frozen,true);
  }
  // Preserve weather effects without requiring key-light, sky, exposure equality.
  for(const key of ['rainVisible','flashIntensity','splashVisible','rainRippleStrength'])
    assert.ok(equal(a.info.lighting?.[key],b.info.lighting?.[key]),'A/B weather effect '+key);
}

export function diagnostics(events){
  return events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Inspector.targetCrashed'||
    e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||
    e.method==='Log.entryAdded'&&e.params.entry.level==='error'||e.method==='Network.loadingFailed'||
    e.method==='Network.responseReceived'&&e.params.response.status>=400);
}

export function sourceKey(url,base){
  const u=new URL(url),b=new URL(base);assert.equal(u.origin,b.origin,'served script must be local');
  const path=decodeURIComponent(u.pathname);
  assert.ok(!path.split('/').some(s=>s==='..'||s==='.')&&!path.includes('\\'),'canonical source path');
  return path.startsWith('/river/')?path.slice(7):'../sunbreak-storm-v3/'+path.slice(1);
}

export function assertNetworkSources(requests,sources,base){
  const scripts=requests.filter(r=>r.type==='Script'||/\.(?:m?js)(?:\?|$)/.test(r.url));
  assert.ok(scripts.length,'actual network scripts required');
  const bound=[];
  for(const r of scripts){
    const key=sourceKey(r.url,base);
    assert.match(sources[key]||'',/^[a-f0-9]{64}$/,'script absent from source binder: '+key);
    assert.equal(r.finished,true,'incomplete script '+key);assert.equal(r.status,200,'script HTTP status '+key);
    assert.equal(r.fromServiceWorker,false,'service worker response '+key);
    assert.equal(r.fromDiskCache,false,'cached script '+key);
    assert.equal(r.bodySHA256,sources[key],'served source differs: '+key);
    bound.push({key,sha256:r.bodySHA256,url:r.url});
  }
  assert.ok(bound.some(r=>r.key==='world.js'),'actual world.js response required');
  return bound;
}

export function validateProfile(profile,base=tmpdir()){
  const p=resolve(profile);assert.equal(dirname(p),resolve(base),'profile direct temporary child');
  assert.ok(basename(p).startsWith('river-afterrain-profile-')&&basename(p).length>'river-afterrain-profile-'.length,'unique afterrain profile');
  return p;
}

async function fileDigests(path){
  const bytes=(await stat(path)).size,blob=createHash('sha1').update(`blob ${bytes}\0`),raw=createHash('sha256');
  for await(const chunk of createReadStream(path)){blob.update(chunk);raw.update(chunk)}
  return {bytes,blob:blob.digest('hex'),sha256:raw.digest('hex')};
}

export function baselineSource(path){
  // Evidence has a separate before/after byte audit. This baseline is SOURCE only.
  return /\.(?:[cm]?js|html|css|json|txt)$/.test(path)&&!/(?:^|\/)qa\/evidence\//.test(path)&&
    !/(?:^|\/)qa\/.*\.(?:json|txt)$/.test(path);
}

export async function preservation(){
  const git=(...args)=>execFileSync('git',args,{cwd:REPO,windowsHide:true,maxBuffer:64e6});
  const paths=[...PROTECTED.map(p=>PREFIX+p),...DEMOS];
  const tree=parseTree(git('ls-tree','-r','-l','-z',BASELINE,'--',...paths));
  for(const p of paths)assert.ok(tree.some(e=>e.path===p||e.path.startsWith(p+'/')),'missing baseline path '+p);
  const entries=tree.filter(e=>baselineSource(e.path)),results=[];
  for(const e of entries){
    try{
      assert.equal(e.type,'blob','baseline entry must be blob');
      const current=await fileDigests(resolve(REPO,e.path));
      let pass=current.blob===e.oid,expected=e.oid,format='raw-git-blob';
      if(!pass&&e.size<1024){
        const pointer=git('cat-file','blob',e.oid).toString('utf8').match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([a-f0-9]{64})\nsize (\d+)\n?$/);
        if(pointer){format='LFS-materialized';expected=pointer[1];pass=current.sha256===expected&&current.bytes===Number(pointer[2])}
      }
      results.push({path:e.path,pass,expected,format,...current});
    }catch(error){results.push({path:e.path,pass:false,error:String(error)})}
  }
  const known=new Set(entries.map(e=>e.path));
  const present=git('ls-files','-z','--cached','--others','--exclude-standard','--',...DEMOS).toString('utf8').split('\0').filter(Boolean);
  const additions=[...new Set(present.filter(p=>baselineSource(p)&&!known.has(p)))].sort();
  return {pass:results.length>0&&results.every(r=>r.pass)&&!additions.length,baseline:BASELINE,
    policy:'Raw source bytes, no newline normalization or repaired historical evidence; read-only Git objects. Assets/gameplay regressions are independently gated.',results,additions};
}

async function sourceSnapshot(){
  const harness={};
  for(const name of ['afterrain-look.mjs','afterrain-look-checks.mjs','migration.mjs','source-binding.mjs'])
    harness[name]=sha(await readFile(new URL(name,import.meta.url)));
  return {runtime:await runtimeHashes(),harness};
}

async function historicalSnapshot(exclude){
  const out={};
  async function visit(dir){
    for(const d of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const p=resolve(dir,d.name);if(p===exclude)continue;
      assert.ok(!d.isSymbolicLink(),'no QA symlink traversal: '+p);
      if(d.isDirectory())await visit(p);
      else if(d.isFile())out[relative(GAME,p).split(sep).join('/')]=(await fileDigests(p)).sha256;
    }
  }
  await visit(resolve(GAME,'qa'));return out;
}

async function settleNetwork(cdp,requests,bodies){
  const start=Date.now();let previous='',quiet=0;
  while(Date.now()-start<45000){
    await Promise.all(bodies);
    const fingerprint=requests.map(r=>r.id+':'+(r.finished||r.failed||false)).join('|');
    if(requests.every(r=>r.finished||r.failed)&&fingerprint===previous)quiet++;else quiet=0;
    if(quiet>=3)return;
    previous=fingerprint;await delay(150);
  }
  throw Error('Network did not settle: '+requests.filter(r=>!r.finished&&!r.failed).map(r=>r.url).join(', '));
}

async function captureView(cdp,view,baseURL){
  const args=view.camera.join(','),id=JSON.stringify(view.cabin);
  const cabinTransform=view.cabin?await cdp.evaluate(`({point:arenaQA.cabinPoint(${id},${view.camera.slice(0,3).join(',')}),origin:arenaQA.cabinPoint(${id},0,0,0),forward:arenaQA.cabinPoint(${id},0,0,-1)})`):null;
  await cdp.evaluate(`arenaQA.weather(${view.weather});${view.cabin?`arenaQA.cabinView(${id},${args})`:`arenaQA.view(${args})`};arenaQA.migrationFreeze(${TIME});true`);
  const lengths=await cdp.evaluate(`new Promise((resolve,reject)=>requestAnimationFrame(()=>requestAnimationFrame(raf=>{try{
    const canvas=document.querySelector('#app canvas'),before=arenaQA.snapshot(),beforeInfo=arenaQA.mapInfo();
    const png=canvas.toDataURL('image/png'),snapshot=arenaQA.snapshot(),info=arenaQA.mapInfo();
    window.__afterrainLookPNG=png.split(',')[1];
    window.__afterrainLookState=JSON.stringify({before,beforeInfo,snapshot,info,canvas:{width:canvas.width,height:canvas.height},raf,url:location.href});
    resolve({image:window.__afterrainLookPNG.length,state:window.__afterrainLookState.length});
  }catch(error){reject(error)}})))`);
  const state=JSON.parse(await cdp.readString('window.__afterrainLookState',lengths.state));
  state.baseURL=baseURL;state.cabinTransform=cabinTransform;
  state.decoded=await cdp.evaluate(`(async()=>{
    const bytes=Uint8Array.from(atob(window.__afterrainLookPNG),c=>c.charCodeAt(0));
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);
    const pixels=ctx.getImageData(0,0,bitmap.width,bitmap.height).data;let nonBlackPixels=0,low=255,high=0;
    for(let i=0;i<pixels.length;i+=4){const n=Math.max(pixels[i],pixels[i+1],pixels[i+2]);if(n>8)nonBlackPixels++;low=Math.min(low,n);high=Math.max(high,n)}
    const hash=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
    const decoded={width:bitmap.width,height:bitmap.height,nonBlackPixels,range:high-low,pixelSHA256:await hash(pixels),pngSHA256:await hash(bytes)};
    bitmap.close();return decoded;
  })()`);
  const png=Buffer.from(await cdp.readString('window.__afterrainLookPNG',lengths.image),'base64');
  await cdp.evaluate('delete window.__afterrainLookPNG;delete window.__afterrainLookState;true');
  return {state,png};
}

async function visual(report,output,options){
  const executable=[process.env.RIVER_QA_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
  assert.ok(executable,'native Chrome/Edge required');
  const profile=validateProfile(await mkdtemp(resolve(tmpdir(),'river-afterrain-profile-')));
  const flags=['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--use-angle=d3d11','--disable-software-rasterizer','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--window-size=1920,1080',`--user-data-dir=${profile}`,'about:blank'];
  let browser,cdp,stderr='';const states={};
  report.browser={executable,flags};report.captures=[];report.pairs=[];report.network={};report.errors=[];
  try{
    const endpoint=await new Promise((accept,reject)=>{
      const timer=setTimeout(()=>reject(Error('native-headless launch timeout')),30000);
      browser=spawn(executable,flags,{windowsHide:true,stdio:['ignore','ignore','pipe']});report.browser.pid=browser.pid;
      browser.once('error',e=>{clearTimeout(timer);reject(e)});
      browser.once('exit',(code,signal)=>{report.browser.exit={code,signal};clearTimeout(timer);reject(Error('browser exited during launch'))});
      browser.stderr.on('data',b=>{stderr+=b;const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);accept(m[1])}});
    });
    const socket=new WebSocket(endpoint);cdp=new CDP(socket);
    await new Promise((accept,reject)=>{
      const timer=setTimeout(()=>{socket.close();reject(Error('CDP connection timeout'))},15000);
      socket.addEventListener('open',()=>{clearTimeout(timer);accept()},{once:true});
      socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connection failed'))},{once:true});
    });
    report.browser.version=await cdp.send('Browser.getVersion',{},null);
    report.gpu=(await cdp.send('SystemInfo.getInfo',{},null)).gpu;
    for(const variant of options.variants){
      const pageURL=variantURL(options.url,variant);
      const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'},null);
      ({sessionId:cdp.session}=await cdp.send('Target.attachToTarget',{targetId,flatten:true},null));
      const session=cdp.session,start=cdp.events.length,requests=[],byID=new Map(),bodies=[],bodyErrors=[];
      const listener=event=>{
        if(event.sessionId!==session)return;
        const p=event.params;
        if(event.method==='Network.requestWillBeSent'){
          const r={id:p.requestId,url:p.request.url,type:p.type,method:p.request.method};requests.push(r);byID.set(p.requestId,r);
        }
        const r=byID.get(p.requestId);if(!r)return;
        if(event.method==='Network.responseReceived')Object.assign(r,{status:p.response.status,mimeType:p.response.mimeType,fromDiskCache:!!p.response.fromDiskCache,fromServiceWorker:!!p.response.fromServiceWorker});
        if(event.method==='Network.loadingFailed')r.failed=true;
        if(event.method==='Network.loadingFinished'){
          r.finished=true;r.encodedDataLength=p.encodedDataLength;
          if(r.type==='Script'||/\.(?:m?js|json)(?:\?|$)/.test(r.url))bodies.push(cdp.send('Network.getResponseBody',{requestId:p.requestId},session).then(v=>{r.bodySHA256=sha(Buffer.from(v.body,v.base64Encoded?'base64':'utf8'))}).catch(e=>bodyErrors.push({url:r.url,error:String(e)})));
        }
      };
      cdp.listeners.push(listener);states[variant]={};
      try{
        await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');
        await cdp.send('Network.enable',{maxTotalBufferSize:64e6,maxResourceBufferSize:8e6});
        await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.setBypassServiceWorker',{bypass:true});
        await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
        await cdp.send('Page.navigate',{url:pageURL});
        await cdp.wait("!!window.arenaQA && !!document.body?.dataset.qa && !document.getElementById('bStart')?.disabled");
        assert.ok(await cdp.evaluate("typeof arenaQA.migrationFreeze==='function' && typeof arenaQA.mapInfo().afterrain?.enabled==='boolean'"),'afterrain metadata and migration freeze hooks required');
        for(const name of options.views){
          const view=VIEWS.find(v=>v.name===name),{state,png}=await captureView(cdp,view,options.url),stem=variant+'-'+name;
          const stateBytes=json(state);
          // Keep the failed capture too. A failed assertion never overwrites/retries.
          await writeNew(resolve(output,stem+'.png'),png);await writeNew(resolve(output,stem+'.json'),stateBytes);
          const item={variant,view,time:TIME,png:stem+'.png',sha256:sha(png),state:stem+'.json',stateSHA256:sha(stateBytes),dimensions:pngDimensions(png),pass:false};
          report.captures.push(item);
          assertLookCapture(state,view,variant,report.sourcesBefore.runtime,report.gpu,png);
          states[variant][name]=state;item.pass=true;
          console.log(stem+': native 1920x1080 t='+TIME);
        }
        await settleNetwork(cdp,requests,bodies);
        report.network[variant]={requests,bound:assertNetworkSources(requests,report.sourcesBefore.runtime,options.url)};
      }finally{
        await Promise.all(bodies);
        const events=cdp.events.slice(start).filter(e=>e.sessionId===session),errors=[...diagnostics(events),...bodyErrors];
        report.errors.push(...errors);
        await writeNew(resolve(output,variant+'-network.json'),json({requests,bodyErrors,bound:report.network[variant]?.bound}));
        await writeNew(resolve(output,variant+'-events.json'),json(events));
        cdp.listeners=cdp.listeners.filter(fn=>fn!==listener);
        if(cdp.socket.readyState===WebSocket.OPEN)await cdp.send('Target.closeTarget',{targetId},null);
        cdp.session=null;
      }
      assert.equal(report.errors.length,0,'runtime/console/network errors');
    }
    for(const [a,b] of [['previous','current'],['previous-legacy','current-legacy'],['previous','previous-legacy'],['current','current-legacy']]){
      if(!states[a]||!states[b])continue;
      for(const name of options.views){assertLookPair(states[a][name],states[b][name]);report.pairs.push({a,b,view:name,pass:true})}
    }
  }finally{
    if(cdp){
      report.errors.push(...diagnostics(cdp.events).filter(e=>!report.errors.includes(e)));
      await writeNew(resolve(output,'cdp-events.json'),json(cdp.events));
      await writeNew(resolve(output,'cdp-transport.json'),json({transport:cdp.transport,commands:cdp.commands,pending:[...cdp.pending.values()].map(p=>p.command)}));
      if(cdp.socket.readyState===WebSocket.OPEN){try{await cdp.send('Browser.close',{},null)}catch(error){report.browser.closeError=String(error)}cdp.socket.close()}
    }
    if(browser&&browser.exitCode===null)await new Promise(r=>{
      const timer=setTimeout(()=>{browser.kill();r()},5000);browser.once('exit',()=>{clearTimeout(timer);r()});
    });
    await writeNew(resolve(output,'browser-stderr.log'),stderr);
    await rm(validateProfile(profile),{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(e=>{report.profileCleanupError=String(e)});
  }
  assert.equal(report.errors.length,0,'all-session runtime/network diagnostics');
}

export async function main(args=process.argv.slice(2)){
  const options=parseOptions(args);
  if(options.help){
    console.log('CPU only (no writes): node qa/afterrain-look-checks.mjs OR node qa/afterrain-look.mjs [--phase=units]\nRoot GPU slot only: node qa/afterrain-look.mjs --phase=visual [--url=http://127.0.0.1:5190/river/] [--views=ground-lane,puddle-sun,forest-hillside,cabin-edge,river-hero,river-wide,storm-ground-lane] [--variants=previous,current,previous-legacy,current-legacy]\nAny explicit selection is PARTIAL, never full PASS. +legacy aliases are accepted. Default visual runs all seven views in previous/current with materials=procedural. Current omits look to test the default route. Requires existing server; no server launch, desktop actions, performance/art verdict, Git mutations or historical writes. Exit 0 full technical PASS/CPU checks, 2 successful PARTIAL, 1 failure.');return;
  }
  if(options.phase==='units'){
    const {runChecks}=await import('./afterrain-look-checks.mjs');const report=await runChecks();console.log(json(report));return report;
  }
  const base=resolve(GAME,'qa/evidence');await mkdir(base,{recursive:true});
  const output=await mkdtemp(resolve(base,'afterrain-look-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'));
  const report={schema:'river-afterrain-look-v1',quality_profile:'offscreen-cinematic-v1',task:TASK,baseline:BASELINE,date:new Date().toISOString(),options,
    pass:false,checksPass:false,verdict:'FAIL',capture_method:'native-headless-webgl-canvas',time:TIME,
    limitations:{art:'UNREVIEWED: independent full-resolution art review required',temporal:'NOT RUN: sampled stills cannot establish continuous quality',performance:'NOT RUN: root schedules unchanged strict sun/storm benchmarks',gameplay:'NOT RUN: source preservation does not replace functional regressions',previous:'Metadata and protected source invariants only; exact historical lighting fidelity needs independent baseline review',UE:'Browser evidence only; this profile label does not establish UE/AI-video acceptance'}};
  try{
    report.sourcesBefore=await sourceSnapshot();report.historicalBefore=await historicalSnapshot(output);
    report.preservationBefore=await preservation();
    assert.ok(report.preservationBefore.pass,'baseline source preservation failed');
    await visual(report,output,options);report.checksPass=true;
  }catch(error){report.error=error.stack;report.checksPass=false}
  finally{
    try{
      report.sourcesAfter=await sourceSnapshot();report.sourceUnchanged=equal(report.sourcesBefore,report.sourcesAfter);
      report.historicalAfter=await historicalSnapshot(output);report.historicalUnchanged=equal(report.historicalBefore,report.historicalAfter);
      report.preservationAfter=await preservation();
    }catch(error){report.integrityError=error.stack;report.checksPass=false}
    report.checksPass=report.checksPass&&report.sourceUnchanged===true&&report.historicalUnchanged===true&&report.preservationAfter?.pass===true;
    report.coverage=coverage(options,report.captures?.filter(c=>c.pass)||[],report.pairs||[]);
    report.pass=report.checksPass&&report.coverage.full;
    report.verdict=report.pass?'PASS':report.checksPass?'PARTIAL':'FAIL';
    const manifest=json({before:report.sourcesBefore,after:report.sourcesAfter,unchanged:report.sourceUnchanged});
    await writeNew(resolve(output,'source-manifest.json'),manifest);report.sourceManifestSHA256=sha(manifest);
    await writeNew(resolve(output,'report.json'),json(report));
    console.log(json({pass:report.pass,checksPass:report.checksPass,verdict:report.verdict,report:resolve(output,'report.json'),sha256:sha(json(report))}));
    process.exitCode=report.pass?0:report.checksPass?2:1;
  }
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
