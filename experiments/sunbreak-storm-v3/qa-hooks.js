// Local diagnostic route: does not change normal-play combat rules.
const qaParams=new URLSearchParams(location.search);
const captureName=qaParams.get('capture');
async function captureCanvas(name){
 const pixels=new Uint8Array(cv.width*cv.height*4);gl.readPixels(0,0,cv.width,cv.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let minLuma=255,maxLuma=0,sum=0,nonBlack=0,samples=0;const colorBins=new Set();
 for(let y=0;y<cv.height;y+=19)for(let x=0;x<cv.width;x+=19){const i=(y*cv.width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],l=r*.2126+g*.7152+b*.0722;minLuma=Math.min(minLuma,l);maxLuma=Math.max(maxLuma,l);sum+=l;nonBlack+=l>8?1:0;samples++;colorBins.add((r>>4)*256+(g>>4)*16+(b>>4))}
 const rect=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return{id,visible:getComputedStyle(e).display!=='none',x:r.x,y:r.y,width:r.width,height:r.height}};
 const metadata={date:new Date().toISOString(),capture_method:'browser-webgl-canvas',name,weaponPose:qaParams.get('weaponPose')||'normal',poseMethod:qaParams.has('weaponPose')?'paused diagnostic state using unchanged production pose/update; not an input/continuous-motion test':'normal production state',qa:window.demoQA.snapshot(),actorPoses:visual.actorQA?.(),render:visual.info(),viewport:[innerWidth,innerHeight],canvas:[cv.width,cv.height],renderer:rendererName,pixel_check:{samples,minLuma,maxLuma,meanLuma:sum/samples,nonBlackRatio:nonBlack/samples,colorBins:colorBins.size,nonblank:colorBins.size>24&&maxLuma-minLuma>45},ui_bounds:['bStyle','bWeather','bPause','bPresOff','ammo','kills','soundControls'].map(rect),colliders:colliders.map(b=>({min:b.min.toArray(),max:b.max.toArray()}))};
 const r=await fetch('/qa/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,png:cv.toDataURL('image/png'),metadata,loadedBuildHashes:qaBuildHashes})});
 if(!r.ok)throw Error('Capture rejected for '+name);
 document.body.dataset.capture='saved';return name;
}
if(captureName){
 setPres(true);
 const views={hero:[0,1.7,12,-.12,-.06],courtyard:[-1,1.7,3,-.45,-.03],wall:[-7,1.7,-10,.56,.06],interior:[-8.7,2.25,-9.5,.46,.03],ground:[0,1.7,10,0,-.65],npccover:[-1,1.7,6,.65,-.02],weapon:[0,1.7,12,-.12,-.19],wide:[1,3.8,15,0,-.12],sky:[0,1.7,12,0,.36],housefront:[11,2.15,-6.8,-.08,.10],houseangle:[21.5,3.1,-9.0,.83,.10],houseinside:[10.92,2.36,-16.6,0,-.03],houseout:[10.92,2.36,-19.0,Math.PI,-.035],housedoor:[10.92,2.36,-12.9,0,.035]};
 views.puddle=[-5.1,1.1,8.3,.2,-.55];
 views.househardware=[11.85,1.90,-14.75,.58,-.11];
 views.housestep=[9.75,1.05,-10.65,-.40,-.45];
 views.houseplinth=[6.2,1.05,-13.4,-1.06,-.13];
 const v=views[qaParams.get('view')||'hero'];if(v){pos.set(v[0],v[1],v[2]);S.yaw=v[3];S.pitch=v[4]}
 visual.setWeather(Number(qaParams.get('weather')??2));
 const weaponPose=qaParams.get('weaponPose');
 if(weaponPose?.startsWith('ads'))S.aim=1;
 if(weaponPose?.includes('fire')){recoil=.12;muz.intensity=12}
 if(weaponPose?.startsWith('reload'))S.reload=weaponPose==='reload-early'?.95:weaponPose==='reload-late'?.15:.60;
 if(qaParams.get('door')==='open'){
  const h=visual.houseQA;h.door.toggle({near:true,visible:true,active:true});h.door.step(2,null);h.pivot.rotation.y=h.door.angle;h.refresh();
 }
 if(qaParams.get('clean')==='1')document.getElementById('hud').style.display='none';
 if(qaParams.get('motion')==='1'){setPres(false);hideMenu();document.getElementById('hud').style.display='none'}
 if(qaParams.get('sequence')==='tactical'){setPres(false);S.state='play';hideMenu()}
 const captureDelay=Math.min(15000,Math.max(2500,Number(qaParams.get('delay')||2500)));
 if(qaParams.has('sequence')){
  // Actual rAF simulation continues between these sparse diagnostic samples.
  // Canvas encoding is not a performance sample or continuous video review.
  for(const [i,delay] of [2500,6000,10000].entries())setTimeout(()=>{
   captureCanvas(captureName+'-'+i).then(()=>{if(i===2)document.body.dataset.sequence='saved'}).catch(()=>document.body.dataset.sequence='failed');
  },delay);
 }else setTimeout(()=>captureCanvas(captureName).catch(()=>document.body.dataset.capture='failed'),captureDelay);
}
document.body.dataset.version='storm-v3';
setInterval(()=>{document.body.dataset.render=JSON.stringify(visual.info())},500);
if(location.pathname==='/test'){
 const saveResults=()=>{
  if(!window.sunbreakRuntimeQA?.result||!document.getElementById('smoke-result'))return;
  observer.disconnect();
  const report={date:new Date().toISOString(),method:'actual-browser-synthetic-integration',smoke:JSON.parse(document.getElementById('smoke-result').textContent),runtime:window.sunbreakRuntimeQA.result};
  fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'runtime-current',report,loadedBuildHashes:qaBuildHashes})}).then(r=>{document.body.dataset.report=r.ok?'saved':'failed'});
 };
 const observer=new MutationObserver(saveResults);observer.observe(document.body,{childList:true,subtree:true,characterData:true});
}
if(qaParams.get('bench')==='1'){
 const runBenchmark=()=>{
 const combat=qaParams.get('combat')==='1';let restarts=0;
 const motionRun=qaParams.get('motionRun')==='1',motionMilestones=[['motion-before',2.5],['motion-flash',7.78],['motion-after',11]],motionPromises=[];let motionIndex=0;
 if(motionRun)document.getElementById('hud').style.display='none';
 if(combat){setPres(false);resetGame();S.state='play';hideMenu()}
 visual.setWeather(Number(qaParams.get('weather')??2));
 const raw=[];let previous=0,origin=0,count=0;
 const sample=now=>{
  if(!previous){previous=now;requestAnimationFrame(sample);return}
  const dt=now-previous;previous=now;
  if(motionRun&&motionIndex<motionMilestones.length&&visual.info().storm.elapsed>=motionMilestones[motionIndex][1]){
   motionPromises.push(captureCanvas(motionMilestones[motionIndex++][0]));
   if(motionIndex===motionMilestones.length){
    Promise.all(motionPromises).then(()=>{clearKeys();S.state='pause';showMenu('继续作战');document.body.dataset.motionReport='saved'});
    return; // PNG encoding is intentionally never included in the performance report.
   }
  }
  if(count++<180){requestAnimationFrame(sample);return}
  if(!origin)origin=now-dt;
  if(combat){
   const phase=Math.floor((now-origin)/2200)%4;
   keys.KeyW=phase===0;keys.KeyA=phase===1;keys.KeyS=phase===2;keys.KeyD=phase===3;keys.KeyF=true;
   keys.ArrowLeft=phase===1;keys.ArrowRight=phase===3;
   if(S.mag===0&&S.reload===0)reload();
   if(S.state==='dead'||S.state==='win'){restarts++;resetGame();S.state='play';over.classList.add('hide');hideMenu()}
  }
  raw.push({elapsed_ms:now-origin,frame_ms:dt,weather:visual.info().weatherIndex,state:S.state,health:S.hp,mag:S.mag,kills:S.kills});
  if(now-origin<30000){requestAnimationFrame(sample);return}
  const sorted=raw.map(s=>s.frame_ms).sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
  if(combat){clearKeys();S.state='pause';showMenu('继续作战')}
  const report={date:new Date().toISOString(),method:'browser-requestAnimationFrame-realtime',warmup_frames:180,duration_ms:raw.at(-1).elapsed_ms,viewport:[innerWidth,innerHeight],canvas:[cv.width,cv.height],renderer:rendererName,settings:visual.info(),audio:sound.snapshot(),p50_ms:pct(.5),p95_ms:pct(.95),p99_ms:pct(.99),max_ms:sorted.at(-1),hitches_over_50ms:raw.filter(s=>s.frame_ms>50).length,mode:combat?'scripted real combat via original movement/fire/reload/AI, auto-restart after outcomes':'normal animated menu; no combat simulation',restarts,raw};
  if(!motionRun)fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'performance-current',report,loadedBuildHashes:qaBuildHashes})}).then(r=>{document.body.dataset.benchmark=r.ok?'saved':'failed'});
 };
 requestAnimationFrame(sample);
 };
 if(qaParams.get('audio')==='1'){
  const begin=document.createElement('button');begin.id='audioBenchmark';begin.textContent='开始有声音性能测试';begin.style.cssText='position:fixed;left:24px;top:110px;z-index:100;padding:12px';document.body.append(begin);
  begin.onclick=async()=>{visual.unlockAudio();initAudio();begin.disabled=true;for(let i=0;i<100&&!sound.snapshot().ready&&!sound.snapshot().failed;i++)await new Promise(r=>setTimeout(r,50));
   if(!sound.snapshot().ready){begin.textContent='音效未就绪，未运行';return}begin.remove();runBenchmark()};
 }else runBenchmark();
}
