// Synthesized weather bed, clearly distinguished from recorded firearm samples.
// User-gesture only; no game-state access, globals or combat random stream.
export function createStormAudio(){
 let context,master,rainGain,failed=false,seed=0x745386,active=false,focused=document.hasFocus(),effectiveGain=0;
 const pending=new Set();let thunderCount=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 function noise(seconds){const b=context.createBuffer(1,Math.floor(context.sampleRate*seconds),context.sampleRate),a=b.getChannelData(0);let low=0;for(let i=0;i<a.length;i++){low=low*.97+(random()*2-1)*.03;a[i]=(random()*2-1)*.65+low*2}return b}
 function unlock(){
  if(failed)return;
  try{
   if(!context){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);
    rainGain=context.createGain();rainGain.gain.value=.12;
    const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=4300;
    const source=context.createBufferSource();source.buffer=noise(5);source.loop=true;source.connect(filter).connect(rainGain).connect(master);source.start();
   }
   context.resume().catch(()=>{});
  }catch{failed=true}
 }
 for(const id of ['bStart','bAgain','bMute','soundVolume'])for(const event of ['pointerdown','click'])document.getElementById(id)?.addEventListener(event,unlock);
 function silence(){active=false;if(master&&context){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(0,context.currentTime,.02)}for(const s of pending){try{s.stop()}catch{}}pending.clear()}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)silence()});
 addEventListener('blur',()=>{focused=false;silence()});addEventListener('focus',()=>{focused=true});
 return{
  unlock,
  update(on,muted,volume){active=!!on&&focused&&!document.hidden;const gain=active&&!muted?Math.max(0,Math.min(1,volume))*.5:0;effectiveGain=gain;if(!master||!context)return;master.gain.setTargetAtTime(gain,context.currentTime,.08);if(!active)for(const s of pending){try{s.stop()}catch{}pending.delete(s)}},
  thunder(live){if(!live||!active||!context||context.state!=='running'||pending.size>=2)return;try{const s=context.createBufferSource();s.buffer=noise(3.5);const f=context.createBiquadFilter();f.type='lowpass';f.frequency.value=240;const g=context.createGain(),t=context.currentTime+.65;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.45,t+.22);g.gain.exponentialRampToValueAtTime(.001,t+3.4);s.connect(f).connect(g).connect(master);pending.add(s);s.onended=()=>{pending.delete(s);s.disconnect();f.disconnect();g.disconnect()};s.start(t);thunderCount++}catch{}},
  info(){return{method:'synthesized noise, not a field recording',context:context?.state||'locked',failed,active,focused,effectiveGain,pending:pending.size,thunderCount}}
 };
}
