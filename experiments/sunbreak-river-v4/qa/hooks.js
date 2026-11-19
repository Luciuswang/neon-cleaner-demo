// Injected by the local server only; never packaged into the public HTML.
window.arenaQA={
 view(x,y,z,yaw,pitch){clearKeys();pres=true;S.state='pause';hideMenu();over.classList.add('hide');pos.set(x,y,z);S.yaw=yaw;S.pitch=pitch;S.reload=0;bob=recoil=0;return this.snapshot()},
 travel(x,z,yaw){this.reset();pres=false;pos.set(x,1.7+visual.floorHeight(x,z),z);S.yaw=yaw;S.pitch=-.08;return this.snapshot()},
 mapInfo(){return visual.info()},
 dressingInfo(){return visual.dressingQA.info()},
 assetView(id){const v=visual.dressingQA.reviewAsset(id);gscene.visible=!id;enemies.forEach(e=>{e.g.visible=!id});if(v)this.view(...v.camera);return v},
 surfaceInfo(){return visual.surfaceQA.info()},
 setAO(value){visual.surfaceQA.setAO(value)},
 setFog(value){visual.surfaceQA.setFog(value)},
 waterView(){this.reset();pos.set(-4.7,visual.floorHeight(-4.7,10)+1.7,10);S.yaw=-.12;S.pitch=-.32;S.hp=10000;return this.snapshot()},
 weather(i){visual.setWeather(i)},
 cabinState(){return visual.info().buffers},
 cabinPoint(id,x,y,z){return visual.houseQA.house(id).logic.transform.localToWorld({x,y,z})},
 cabinView(id,x,y,z,yaw=0,pitch=0){const h=visual.houseQA.house(id),p=h.logic.transform.localToWorld({x,y,z});return this.view(p.x,p.y,p.z,yaw+h.logic.transform.placement.yaw,pitch)},
 cabinTravel(id,x,z,yaw=0){const h=visual.houseQA.house(id),p=h.logic.transform.localToWorld({x,z});return this.travel(p.x,p.z,yaw+h.logic.transform.placement.yaw)},
 lineOfSight(a,b){scene.updateMatrixWorld(true);return clearSight(a,b)},
 walkState(){return{position:pos.toArray(),support:visual.floorHeight(pos.x,pos.z),blocked:collide(pos),enemies:enemies.map(e=>({position:e.g.position.toArray(),support:visual.floorHeight(e.g.position.x,e.g.position.z)}))}},
 snapshot(){return {...window.demoQA.snapshot(),remaining:S.reload,presentation:pres,
  audio:sound.snapshot(),weapon:visual.info().weapon,lighting:visual.info().lighting,weather:visual.info().weather,water:visual.info().water,errors:visual.info().textureErrors,
  dressing:visual.dressingQA.info(),surface:visual.surfaceQA.info(),camera:{position:cam.position.toArray(),quaternion:cam.quaternion.toArray(),fov:cam.fov},times:[...fireStats.times],buildHashes:loadedBuildHashes,viewport:[cv.width,cv.height],renderer:rendererName}},
 reset(){resetGame();S.state='play';hideMenu();over.classList.add('hide');S.hp=10000;S.yaw=0;S.pitch=.85;return this.snapshot()},
 pose(phase){clearKeys();S.state='pause';pres=true;hideMenu();S.reload=phase===null?0:RELOAD_SECONDS*(1-phase);return this.snapshot()},
 reload(){reload()},
 setAmmo(mag,res){S.mag=mag;S.res=res;S.reload=0;reloadCuePhase=0;updHUD()},
 pause(){togglePause()},
 blur(){dispatchEvent(new Event('blur'))},
 async loseLock(){
  if(document.pointerLockElement===cv)await new Promise(resolve=>{document.addEventListener('pointerlockchange',resolve,{once:true});document.exitPointerLock()});
  else document.dispatchEvent(new Event('pointerlockchange'));
  // Allow queued native lifecycle events to drain before a synthetic travel
  // reset. This never resumes the game or bypasses runtime input handling.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 },
 outcome(){S.hp=0;S.state='dead';cancelReload();updHUD();showOver('作战失败','测试死亡取消换弹')},
 cancel(){cancelReload()},
 async setPresentation(value){
  // Presentation exits browser pointer lock asynchronously. Let that lifecycle
  // event settle before the harness switches back to play; runtime unchanged.
  setPres(value);if(value)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 },
 resume(){clearKeys();S.state='play';pres=false;hideMenu();sound.setScene(true,[pos.x,pos.y,pos.z],S.yaw)},
 capture(){return cv.toDataURL('image/png')},
 async benchmark(){
  // Declared before measurement: contiguous 10s of the SAME combat/reload
  // workload to warm shaders, animation and audio. Retain every warmup frame.
  const raw=[],warmupRaw=[];let previous=0,origin=0,warmupOrigin=0;
  const cpu={},restore=[];
  for(const [object,key,name]of [[visual,'update','visualUpdate'],[visual,'render','render'],[tactical,'update','ai']]){
   const original=object[key];object[key]=function(...args){const start=performance.now();const result=original.apply(this,args);cpu[name]=performance.now()-start;return result};restore.push(()=>object[key]=original);
  }
  this.reset();S.res=3000;S.pitch=-.06;S.yaw=-1.35;await new Promise(resolve=>{
   function frame(t){
    if(!previous){previous=t;requestAnimationFrame(frame);return}
    const dt=t-previous;previous=t;
    if(!warmupOrigin)warmupOrigin=t-dt;
    trigger.setKeyboard(true);keys.KeyW=Math.floor((t-warmupOrigin)/2000)%2===0;keys.KeyS=!keys.KeyW;
    if(S.mag===0&&S.reload===0)reload();
    if(S.state!=='play'){resetGame();S.hp=10000;S.state='play';hideMenu();over.classList.add('hide')}
    if(t-warmupOrigin<10000){warmupRaw.push({elapsed_ms:t-warmupOrigin,frame_ms:dt,reload:S.reload,mag:S.mag});requestAnimationFrame(frame);return}
    if(!origin)origin=t-dt;
    raw.push({elapsed_ms:t-origin,frame_ms:dt,reload:S.reload,mag:S.mag,...dt>33.3?{cpu:{...cpu},weather:visual.info().audio}:{}});
    if(t-origin<30000)requestAnimationFrame(frame);else resolve();
   }requestAnimationFrame(frame);
  });
  restore.forEach(f=>f());clearKeys();const sorted=raw.map(v=>v.frame_ms).sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
  return {raw,warmupRaw,weather:visual.info().weather,warmup:{declaredSeconds:10,method:'contiguous same combat/reload workload; every frame retained',max:warmupRaw.length?Math.max(...warmupRaw.map(v=>v.frame_ms)):0},duration:raw.at(-1).elapsed_ms,viewport:[cv.width,cv.height],renderer:rendererName,p50:pct(.5),p95:pct(.95),p99:pct(.99),max:sorted.at(-1),over50:raw.filter(v=>v.frame_ms>50).length,audio:sound.snapshot(),stress:{shots:fireStats.count,finalAmmo:{mag:S.mag,reserve:S.res},tactical:tactical.info()},source:loadedBuildHashes};
 },
 async waterMovie(){
  this.waterView();
  // Direct WebGL captureStream timed out; root cause is unverified. This is a
  // diagnostic same-size pixel-copy path, never desktop UI. Both recording
  // failures are retained; successful sampled frames do not accept video.
  const recording=document.createElement('canvas');recording.width=cv.width;recording.height=cv.height;
  const recordingContext=recording.getContext('2d',{alpha:false});
  const stream=recording.captureStream(0),track=stream.getVideoTracks()[0],chunks=[],frameTimes=[];
  const mimeType=['video/webm;codecs=vp8','video/webm;codecs=vp9'].find(MediaRecorder.isTypeSupported);
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8000000});
  const finished=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=resolve});
  const start=performance.now(),startTime=visual.info().water.time;
  let running=true,last=-Infinity;
  const copyFrame=t=>{if(!running)return;if(t-last>=1000/30-1){recordingContext.drawImage(cv,0,0);track.requestFrame();frameTimes.push(t-start);last=t}requestAnimationFrame(copyFrame)};
  recorder.start();requestAnimationFrame(copyFrame);await new Promise(resolve=>setTimeout(resolve,10500));running=false;recorder.stop();await finished;
  stream.getTracks().forEach(t=>t.stop());
  const bytes=new Uint8Array(await new Blob(chunks,{type:mimeType}).arrayBuffer());
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {mimeType,data:btoa(binary),durationMS:performance.now()-start,startTime,endTime:visual.info().water.time,frameTimes,snapshot:this.snapshot(),water:visual.info().water,method:'Actual WebGL copied into same-size 2D recording target, requested30fps, 10.5s live gameplay clock; not fixed-time or desktop capture. Decode actual frame density before motion acceptance'};
 },
 async movie(){
  const stream=cv.captureStream(30),chunks=[];
  const mimeType=['video/webm;codecs=vp8','video/webm;codecs=vp9'].find(MediaRecorder.isTypeSupported);
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:5000000});
  const finished=new Promise(resolve=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onstop=resolve});
  this.reset();S.yaw=-.12;S.pitch=-.06;S.mag=8;S.aim=0;bob=0;updHUD();
  recorder.start();setTimeout(reload,250);
  await new Promise(resolve=>setTimeout(resolve,3000));recorder.stop();await finished;
  stream.getTracks().forEach(t=>t.stop());
  const bytes=new Uint8Array(await new Blob(chunks,{type:mimeType}).arrayBuffer());
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {mimeType,data:btoa(binary),snapshot:this.snapshot(),method:'actual WebGL canvas captureStream(30), real reload timer; not desktop/window capture or a performance test'};
 }
};
document.body.dataset.version='arena-v4';
setInterval(()=>document.body.dataset.render=JSON.stringify(visual.info()),200);
