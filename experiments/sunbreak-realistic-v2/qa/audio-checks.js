// Appended only on /audio-test. Explicit trusted click unlocks actual audio.
const audioTestButton=document.createElement('button');
audioTestButton.id='runAudioQA';audioTestButton.textContent='运行音效验收';
audioTestButton.style.cssText='position:fixed;z-index:99;left:24px;top:110px;padding:12px';
document.body.append(audioTestButton);
audioTestButton.onclick=async()=>{
 audioTestButton.disabled=true;initAudio();
 const checks=[],artifacts={},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 const {createGameAudio,createSamplePlayer,spatial}=await import('./audio.js');
 let testContext;
 try{
  for(let i=0;i<100&&!sound.snapshot().ready&&!sound.snapshot().failed;i++)await wait(50);
  check('gesture unlock and five local samples decoded',sound.snapshot().ready&&sound.snapshot().context==='running',sound.snapshot());
  setPres(true);S.state='pause';
  const before=JSON.stringify(window.demoQA.snapshot());
  document.getElementById('bMute').click();document.getElementById('bMute').click();
  const slider=document.getElementById('soundVolume');slider.value='40';slider.dispatchEvent(new Event('input',{bubbles:true}));
  check('volume and mute controls do not fire or mutate gameplay',before===JSON.stringify(window.demoQA.snapshot())&&sound.snapshot().volume===.4&&!sound.snapshot().muted);
  // Critical transition: the press began on the game, release lands on control.
  keys.KeyW=true;keys.KeyF=true;
  slider.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
  document.getElementById('bMute').dispatchEvent(new KeyboardEvent('keyup',{code:'KeyF',bubbles:true}));
  check('audio controls allow already-held movement and fire key releases',!keys.KeyW&&!keys.KeyF);
  slider.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyF',bubbles:true}));
  check('new control keystrokes never trigger gameplay fire',!keys.KeyF);
  slider.value='65';slider.dispatchEvent(new Event('input',{bubbles:true}));
  const raw=await Promise.all(['player','enemy','magout','magin','confirm'].map(async id=>{
   const r=await fetch(`./assets/audio/${id}.wav`);check('WAV MIME '+id,r.ok&&r.headers.get('content-type')==='audio/wav');return[id,await r.arrayBuffer()];
  }));
  testContext=new AudioContext();await testContext.resume();
  const buffers=Object.fromEntries(await Promise.all(raw.map(async([id,b])=>[id,await testContext.decodeAudioData(b.slice(0))])));
  for(const [id,b] of Object.entries(buffers)){
   const d=b.getChannelData(0);let peak=0,energy=0,finite=true;
   for(const value of d){finite&&=Number.isFinite(value);peak=Math.max(peak,Math.abs(value));energy+=value*value}
   check('finite nonblank decoded sample '+id,finite&&peak>.1&&peak<.9&&energy/d.length>1e-6,{duration:b.duration,peak,rms:Math.sqrt(energy/d.length)});
  }
  const left=spatial([-10,0,0],[0,0,0],0),right=spatial([10,0,0],[0,0,0],0),far=spatial([30,0,0],[0,0,0],0);
  check('distance attenuation, lowpass and stereo direction',left.pan===-1&&right.pan===1&&far.gain<right.gain&&far.cutoff<right.cutoff,{left,right,far});
  check('listener heading rotates directional sound',spatial([0,0,10],[0,0,0],Math.PI/2).pan<-.99);
  const player=createSamplePlayer(testContext,buffers);
  player.setScene(true,[0,0,0],0);player.notify('shot');player.notify('enemy',[-8,0,0]);player.notify('rel');player.notify('hit');
  check('real running player routes fire/enemy/reload/confirm',player.snapshot().started===5&&['player','enemy','magout','magin','confirm'].every(id=>player.snapshot().byType[id]===1),player.snapshot());
  await wait(1900);
  check('ended voices and nodes cleaned',player.snapshot().voices===0&&player.snapshot().started===player.snapshot().ended,player.snapshot());
  for(let i=0;i<160;i++)player.notify('shot');
  check('bounded polyphony under burst stress',player.snapshot().voices<=24&&player.snapshot().peakVoices===24&&player.snapshot().stolen>0,player.snapshot());
  player.setMuted(true);check('mute cancels active voices',player.snapshot().voices===0);
  const mutedCount=player.snapshot().started;player.notify('rel');
  check('muted events never schedule',player.snapshot().started===mutedCount);
  player.setMuted(false);player.notify('rel');player.setScene(false,[0,0,0],0);
  check('pause cancels both present and future reload voices',player.snapshot().voices===0);
  const pauseCount=player.snapshot().started;await wait(800);player.setScene(true,[0,0,0],0);await wait(50);
  check('resume never replays queued events',player.snapshot().voices===0&&player.snapshot().started===pauseCount);
  player.notify('shot');player.setVolume(0);check('zero volume cleans voices',player.snapshot().voices===0);
  player.setVolume(.65);player.notify('shot');await testContext.suspend();player.notify('shot');
  const suspendedCount=player.snapshot().started;player.silence();await testContext.resume();await wait(50);
  check('suspend/resume does not accumulate events',player.snapshot().voices===0&&player.snapshot().started===suspendedCount);
  player.setScene(true,[0,0,0],0);const oldRandom=Math.random;let calls=0;
  try{Math.random=()=>{calls++;return .5};for(let i=0;i<10;i++)player.notify('enemy',[i,0,-10])}finally{Math.random=oldRandom}
  check('audio never consumes gameplay RNG',calls===0);
  player.silence();
  const missing=createGameAudio({fetcher:async()=>({ok:false}),contextFactory:()=>testContext});
  missing.unlock();await wait(80);missing.notify('shot');
  check('unavailable samples fail silently with explicit status',missing.snapshot().failed&&!missing.snapshot().ready&&missing.snapshot().loaded===0);
  const unavailable=createGameAudio({fetcher:async()=>({ok:false}),contextFactory:()=>{throw Error('Unsupported')}});
  unavailable.unlock();unavailable.notify('shot');check('unsupported Web Audio cannot break combat',unavailable.snapshot().failed);

  // Real original functions, synchronous fixtures; timers/AI cannot interleave.
  const savedRandom=Math.random,savedNotify=sound.notify;const outcomes=[];
  try{
   for(const mode of ['enabled','muted','unavailable']){
    let seed=7654321,rngCalls=0;
    Math.random=()=>{rngCalls++;seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296};
    sound.notify=mode==='unavailable'?()=>{}:savedNotify;
    sound.setMuted(mode==='muted');sound.setScene(true,[0,1.7,12],0);
    resetGame();pres=false;S.state='play';enemies.forEach(e=>e.alive=false);
    const target=enemies[0];target.alive=true;target.hp=10000;target.g.position.set(0,0,5);
    cam.position.set(0,1.7,12);cam.rotation.set(0,0,0,'YXZ');cam.updateMatrixWorld(true);
    for(let i=0;i<30;i++){S.next=0;fire()}
    reload();const reloadDuration=S.reload;finishReload();
    outcomes.push({mode,hp:target.hp,mag:S.mag,res:S.res,kills:S.kills,reloadDuration,rngCalls,seed});
   }
  }finally{Math.random=savedRandom;sound.notify=savedNotify;sound.setMuted(false);resetGame();pres=true;S.state='pause';sound.silence();showMenu('继续作战')}
  artifacts.outcomes=outcomes;
  const comparable=outcomes.map(({mode,...value})=>JSON.stringify(value));
  check('enabled/muted/unavailable preserve actual shot outcomes and RNG',new Set(comparable).size===1&&outcomes[0].reloadDuration===1.2,outcomes);
  // Verify integrated adapter playback, presentation and focus, not just test instance.
  sound.setScene(true,[0,1.7,12],0);const shotCount=sound.snapshot().started;snd('shot');
  check('integrated original snd adapter plays decoded recording',sound.snapshot().started===shotCount+1);
  setPres(true);await wait(60);check('presentation mode drains integrated voices',sound.snapshot().voices===0);
  sound.setScene(true,[0,0,0],0);snd('rel');window.dispatchEvent(new Event('blur'));
  check('focus loss cancels scheduled integrated reload',sound.snapshot().voices===0);
  // Pause suite for a SECOND trusted UI gesture, exercising actual restart.
  const integratedContext=window.sunbreakAudioQAContext;
  await integratedContext.suspend();sound.silence();setPres(false);S.state='dead';over.classList.remove('hide');menu.classList.add('hide');
  const restarted=new Promise(resolve=>document.getElementById('bAgain').addEventListener('click',resolve,{once:true}));
  document.body.dataset.audioRestart='ready';audioTestButton.textContent='点击「重新开始」验收音频恢复';
  await restarted;
  for(let i=0;i<40&&integratedContext.state!=='running';i++)await wait(25);
  sound.setScene(true,[0,1.7,12],0);const afterSuspend=sound.snapshot().started;snd('shot');
  check('trusted restart resumes actual suspended context and plays',integratedContext.state==='running'&&sound.snapshot().started===afterSuspend+1);
  S.state='pause';setPres(true);sound.silence();

  async function offline(events,volume=1){
   const ctx=new OfflineAudioContext(2,44100*3,44100),m=createSamplePlayer(ctx,buffers);
   m.setVolume(volume);m.setScene(true,[0,0,0],0);
   for(const [kind,origin]of events)m.notify(kind,origin);
   const voice=m.snapshot(),rendered=await ctx.startRendering();
   let peak=0,energy=0,finite=true,clipped=0;const channels=[];
   for(let c=0;c<2;c++){
    const data=rendered.getChannelData(c);let channelEnergy=0;
    for(const v of data){finite&&=Number.isFinite(v);peak=Math.max(peak,Math.abs(v));clipped+=Math.abs(v)>=.999?1:0;energy+=v*v;channelEnergy+=v*v}
    channels.push(channelEnergy/data.length);
   }
   return {finite,peak,rms:Math.sqrt(energy/(rendered.length*2)),clipped,channels,voice,voicesAfter:m.snapshot().voices};
  }
  artifacts.stress=await offline(Array.from({length:200},(_,i)=>i%3?['shot']:['enemy',[i%2?6:-6,0,-2]]));
  check('production graph offline stress finite nonblank unclipped',artifacts.stress.finite&&artifacts.stress.peak>.01&&artifacts.stress.peak<.9&&artifacts.stress.clipped===0&&artifacts.stress.voicesAfter===0,artifacts.stress);
  const leftMix=await offline([['enemy',[-8,0,0]]]),rightMix=await offline([['enemy',[8,0,0]]]);
  check('rendered stereo channels confirm real routing',leftMix.channels[0]>leftMix.channels[1]*100&&rightMix.channels[1]>rightMix.channels[0]*100,{left:leftMix.channels,right:rightMix.channels});
  const nearMix=await offline([['enemy',[3,0,0]]]),farMix=await offline([['enemy',[30,0,0]]]);
  check('rendered far enemy quieter than near enemy',nearMix.rms>farMix.rms*1.5,{near:nearMix.rms,far:farMix.rms});
  const silent=await offline([['shot']],0);check('zero-volume output is silent',silent.peak===0,silent);
  artifacts.samplePlayer=player.snapshot();artifacts.integrated=sound.snapshot();
  const original=await fetch('/original/'),originalBytes=await original.arrayBuffer();
  const originalHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',originalBytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  check('separate original page returns exact untouched baseline bytes',original.ok&&originalHash==='4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85',{originalHash});
 }catch(error){check('test suite completes without exception',false,{error:String(error),stack:error.stack})}
 finally{await testContext?.close();sound.silence();S.state='pause';setPres(true);showMenu('继续作战')}
 const report={schema:'sunbreak-browser-audio-qa-v1',date:new Date().toISOString(),method:'trusted browser gesture, actual decoding/playback counters and production graph offline render',verdict:checks.every(c=>c.pass)?'PASS':'REWORK',checks,artifacts,limitations:['No subjective listening approval.','No measured hearing-safety certification.','Deterministic battle fixtures cover actual player shot/reload functions; not a manual full-playthrough.']};
 const r=await fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'audio-current',report})});
 document.body.dataset.audioQa=r.ok?report.verdict:'save-failed';audioTestButton.textContent=report.verdict;
};
