// Presentation-only audio. No gameplay objects, global RNG or queued load events.
export function spatial(origin, listener, yaw) {
 const dx=origin[0]-listener[0],dy=origin[1]-listener[1],dz=origin[2]-listener[2];
 const distance=Math.hypot(dx,dy,dz),horizontal=Math.hypot(dx,dz)||1;
 return {distance,pan:Math.max(-1,Math.min(1,(dx*Math.cos(yaw)-dz*Math.sin(yaw))/horizontal)),
  gain:.62/(1+.09*distance),cutoff:Math.max(1800,15000/(1+.055*distance))};
}

export function createMixer(context) {
 const input=context.createGain(),compressor=context.createDynamicsCompressor();
 compressor.threshold.value=-12;compressor.knee.value=12;compressor.ratio.value=5;
 compressor.attack.value=.002;compressor.release.value=.14;
 const ceiling=context.createWaveShaper(),curve=new Float32Array(4097);
 // Bounded transfer, not a hearing-safety certification or a loudness target.
 for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=.88*Math.tanh(x/ .88)}
 ceiling.curve=curve;ceiling.oversample='none';
 const master=context.createGain();master.gain.value=.65;
 input.connect(compressor);compressor.connect(ceiling);ceiling.connect(master);master.connect(context.destination);
 return {input,master};
}

export function createSamplePlayer(context,buffers,{maxVoices=24,onStatus=()=>{}}={}) {
 const graph=createMixer(context),voices=new Set();
 const counts={events:0,started:0,ended:0,dropped:0,cancelled:0,stolen:0,peakVoices:0,byType:{},errors:0};
 let active=false,muted=false,volume=.65,listener=[0,0,0],yaw=0,seed=0x85ac32f1;
 const runnable=()=>context.state==='running'||(typeof context.startRendering==='function'&&context.state!=='closed');
 const variation=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
 function stopAll(){
  for(const voice of [...voices]){counts.cancelled++;try{voice.source.stop()}catch{}voice.cleanup()}
 }
 function play(id,{gain=1,pan=0,cutoff=18000,delay=0,rate=1}={}){
  if(!active||muted||volume===0||!runnable()){counts.dropped++;return}
  const buffer=buffers[id];if(!buffer){counts.dropped++;return}
  if(voices.size>=maxVoices){const oldest=voices.values().next().value;counts.stolen++;try{oldest.source.stop()}catch{}oldest.cleanup()}
  let source,filter,level,panner,voice;
  try{
   source=context.createBufferSource();source.buffer=buffer;source.playbackRate.value=rate;
   filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;filter.Q.value=.5;
   level=context.createGain();level.gain.value=gain;
   panner=context.createStereoPanner();panner.pan.value=pan;
   source.connect(filter);filter.connect(level);level.connect(panner);panner.connect(graph.input);
   let cleaned=false;
   voice={source,cleanup(){if(cleaned)return;cleaned=true;voices.delete(voice);source.onended=null;
    source.disconnect();filter.disconnect();level.disconnect();panner.disconnect();counts.ended++}};
   source.onended=voice.cleanup;voices.add(voice);
   const when=context.currentTime+delay;
   source.start(when);source.stop(when+buffer.duration/rate+.005);
   counts.started++;counts.byType[id]=(counts.byType[id]||0)+1;counts.peakVoices=Math.max(counts.peakVoices,voices.size);
  }catch{counts.errors++;if(voice)voice.cleanup();else for(const node of [source,filter,level,panner])try{node?.disconnect()}catch{}}
 }
 return {
  notify(type,origin){
   try{
    counts.events++;
    if(!active||muted||volume===0||!runnable()){counts.dropped++;return}
    const rate=.98+variation()*.04,v=.95+variation()*.1;
    if(type==='shot')play('player',{gain:.92*v,rate,pan:.06});
    else if(type==='enemy'&&Array.isArray(origin)&&origin.length===3&&origin.every(Number.isFinite)){
     const s=spatial([...origin],listener,yaw);play('enemy',{gain:s.gain*v,pan:s.pan,cutoff:s.cutoff,rate});
    }else if(type==='magout'){
     play('magout',{gain:.48,pan:-.10});
    }else if(type==='magin'){
     play('magin',{gain:.58,pan:-.10});
    }else if(type==='hit')play('confirm',{gain:.30,rate:1.12,pan:0});
   }catch{counts.errors++}
  },
  setScene(live,position,heading){
   const next=!!live;
   if(active&&!next)stopAll();active=next;
   if(position?.length===3&&position.every(Number.isFinite))listener=[...position];
   if(Number.isFinite(heading))yaw=heading;
  },
  silence(){active=false;stopAll()},
  setMuted(value){muted=!!value;if(muted)stopAll();graph.master.gain.setTargetAtTime(muted?0:volume,context.currentTime,.015);onStatus()},
  setVolume(value){if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));if(volume===0)stopAll();
   graph.master.gain.setTargetAtTime(muted?0:volume,context.currentTime,.015);onStatus()},
  snapshot(){return {...counts,byType:{...counts.byType},active,muted,volume,voices:voices.size,maxVoices,context:context.state}},
 };
}

export function createGameAudio({onStatus=()=>{},fetcher=globalThis.fetch?.bind(globalThis),contextFactory}={}) {
 let context=null,player=null,unlocked=false,decoding=null,failed=false;
 let live=false,position=[0,0,0],heading=0,muted=false,volume=.65,loaded=0,droppedBeforeReady=0;
 const status=()=>{try{onStatus(api.snapshot())}catch{}};
 // Fetch bytes before gesture; no AudioContext and no autoplay until unlock().
 const bytes=Promise.all(['player','enemy','magout','magin','confirm'].map(async id=>{
  const response=await fetcher(new URL(`./assets/audio/${id}.wav`,document.baseURI));
  if(!response.ok)throw Error('Audio unavailable');return [id,await response.arrayBuffer()];
 })).catch(()=>{failed=true;status();return null});
 const api={
  unlock(){
   try{
    if(!context){context=contextFactory?contextFactory():new (globalThis.AudioContext||globalThis.webkitAudioContext)();
     context.addEventListener('statechange',()=>{if(context.state!=='running')player?.silence();status()})}
    unlocked=true;
    // resume is invoked synchronously in the trusted gesture, never in combat.
    const resume=context.resume();resume?.catch(()=>{failed=true;status()});
    if(!decoding)decoding=bytes.then(async entries=>{
     if(!entries)return;
     const buffers=Object.fromEntries(await Promise.all(entries.map(async([id,raw])=>[id,await context.decodeAudioData(raw.slice(0))])));
     loaded=Object.keys(buffers).length;player=createSamplePlayer(context,buffers,{onStatus:status});
     player.setVolume(volume);player.setMuted(muted);player.setScene(live,position,heading);status();
    }).catch(()=>{failed=true;status()});
    status();
   }catch{failed=true;status()}
  },
  notify(type,origin){try{if(player)player.notify(type,origin);else droppedBeforeReady++}catch{}},
  setScene(value,p,y){live=!!value&&!document.hidden;position=[...p];heading=y;player?.setScene(live,position,heading)},
  silence(){live=false;player?.silence()},
  setMuted(value){muted=!!value;player?.setMuted(muted);status()},
  setVolume(value){if(Number.isFinite(value)){volume=Math.max(0,Math.min(1,value));player?.setVolume(volume);status()}},
  snapshot(){return {unlocked,failed,loaded,ready:loaded===5&&!failed,muted,volume,droppedBeforeReady,...player?.snapshot()}},
 };
 return api;
}
