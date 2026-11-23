// Exercises the real runtime helper used by index.html (aim-assist.js).
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AIM_ASSIST,AIM_ASSIST_KEY,createAimAssist,actorCenter,pickTarget,nudge,anglesTo,readEnabled,writeEnabled} from '../aim-assist.js';

const origin={x:0,y:1.7,z:0};
const npc=(x,z,extra={})=>({alive:true,hp:100,g:{position:{x,y:0,z}},...extra});
const boundsOf=e=>({min:{x:e.g.position.x-.3,y:e.g.position.y+.9,z:e.g.position.z-.3},max:{x:e.g.position.x+.3,y:e.g.position.y+2.5,z:e.g.position.z+.3}});
const center=e=>actorCenter(e,boundsOf);
const memory=()=>{const m=new Map();return{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{m.set(k,String(v))},map:m}};
// By default the helper is given a fresh look input at frame.now, so the negative cases below are meaningful.
const make=(list,visible=()=>true,storage=memory(),looked=true)=>{const a=createAimAssist({actors:()=>list,center,visible,storage});if(looked)a.noteLook(frame.now);return a};
const frame={dt:1/60,now:1000,origin,yaw:0,pitch:0};

// Centre comes from the actor's hit bounds, with a fallback to its own position.
assert.deepEqual(center(npc(.5,-10)),{x:.5,y:1.7,z:-10});
const fallback=actorCenter(npc(2,-4,{tactical:{stance:1}}),()=>{throw Error('no bounds')});
assert.equal(fallback.x,2);assert.equal(fallback.z,-4);assert.ok(fallback.y>.5&&fallback.y<1.3);
assert.equal(actorCenter(null,null),null);

// Visible target in the cone while the player is moving the view: small smooth step, no snap, no overshoot.
{
 const list=[npc(.5,-10)],assist=make(list),want=anglesTo(origin,center(list[0]));
 const out=assist.update(frame);
 assert.equal(out.target,0);
 assert.ok(out.yaw<0&&out.yaw>want.yaw,'moves toward the target without reaching it in one frame');
 assert.ok(Math.hypot(out.yaw,out.pitch)<=AIM_ASSIST.rate*frame.dt+1e-9,'rate limited');
 assert.deepEqual(Object.keys(out).sort(),['pitch','target','yaw'],'returns look angles only, no fire command');
 let yaw=0,pitch=0,last=Math.abs(want.yaw);
 for(let i=0;i<600;i++){const o=assist.update({...frame,yaw,pitch});yaw=o.yaw;pitch=o.pitch;const err=Math.hypot(want.yaw-yaw,want.pitch-pitch);assert.ok(err<=last+1e-9,'error never grows');last=err}
 assert.ok(last<1e-3,'converges smoothly');
 assert.deepEqual(assist.snapshot(),{enabled:true,target:0});
}

// Occluded target: no assist at all.
{
 const assist=make([npc(.5,-10)],()=>false),out=assist.update(frame);
 assert.deepEqual(out,{yaw:0,pitch:0,target:null});
 assert.equal(assist.snapshot().target,null);
}

// Visibility is asked from the camera origin to the actor centre.
{
 const calls=[],list=[npc(.5,-10)];
 make(list,(a,b,e)=>{calls.push([a,b,e]);return true}).update(frame);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0][0],origin);assert.deepEqual(calls[0][1],{x:.5,y:1.7,z:-10});assert.equal(calls[0][2],list[0]);
}

// Dead targets are ignored.
assert.deepEqual(make([npc(.5,-10,{alive:false})]).update(frame),{yaw:0,pitch:0,target:null});
assert.deepEqual(make([npc(.5,-10,{hp:0})]).update(frame),{yaw:0,pitch:0,target:null});

// Outside the small cone, behind the camera, or out of range: ignored.
assert.deepEqual(make([npc(3,-10)]).update(frame),{yaw:0,pitch:0,target:null});
assert.deepEqual(make([npc(0,10)]).update(frame),{yaw:0,pitch:0,target:null});
assert.deepEqual(make([npc(0,-(AIM_ASSIST.range+5))]).update(frame),{yaw:0,pitch:0,target:null});

// No player input: the camera is never moved unaided.
{
 const assist=make([npc(.5,-10)]);
 assist.clear();
 assert.deepEqual(assist.update(frame),{yaw:0,pitch:0,target:null},'no look input, no assist');
 assert.deepEqual(assist.update({...frame,engaged:true,firing:true,aiming:true}),{yaw:0,pitch:0,target:null},'holding fire or ADS alone never rotates the view');
 assert.deepEqual(make([npc(.5,-10)],()=>true,memory(),false).update({...frame,engaged:true}),{yaw:0,pitch:0,target:null},'a fresh helper without look input does nothing');
 assist.noteLook(950);
 assert.equal(assist.update(frame).target,0,'recent look input counts as active');
 assert.deepEqual(assist.update({...frame,now:900}),{yaw:0,pitch:0,target:null},'a look stamp from the future is not fresh');
 assert.deepEqual(assist.update({...frame,engaged:true,firing:true,aiming:true,now:950+AIM_ASSIST.inputMs+1}),{yaw:0,pitch:0,target:null},'look input expires even while firing or aiming');
 // Sustained hold after one look: the nudge stops once the brief input window ends; no unaided tracking.
 {
  const held=make([npc(.5,-10)]);let yaw=0,pitch=0,moved=0;
  for(let i=1;i<=120;i++){
   const now=frame.now+i*1000/60,o=held.update({...frame,now,yaw,pitch,engaged:true,firing:true,aiming:true});
   if(now>frame.now+AIM_ASSIST.inputMs){assert.equal(o.target,null);assert.equal(o.yaw,yaw);assert.equal(o.pitch,pitch)}else moved++;
   yaw=o.yaw;pitch=o.pitch;
  }
  assert.ok(moved>0&&moved<=Math.ceil(AIM_ASSIST.inputMs/(1000/60)),'assist is limited to the brief look window');
 }
}

// Off switch and persistence. Default is on; only the stored value 0 means off.
{
 const storage=memory(),assist=make([npc(.5,-10)],()=>true,storage);
 assert.equal(assist.enabled,true);
 assert.equal(assist.toggle(),false);
 assert.equal(storage.map.get(AIM_ASSIST_KEY),'0');
 assert.deepEqual(assist.update(frame),{yaw:0,pitch:0,target:null});
 assert.deepEqual(assist.snapshot(),{enabled:false,target:null});
 assert.equal(make([],()=>true,storage).enabled,false,'off persists');
 assist.setEnabled(true);
 assert.equal(storage.map.get(AIM_ASSIST_KEY),'1');
 assert.equal(make([],()=>true,storage).enabled,true);
 const broken={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 assert.equal(readEnabled(broken),true);assert.equal(writeEnabled(broken,false),false);
 assert.equal(readEnabled(null),true);
 const guarded=make([npc(.5,-10)],()=>true,broken);
 assert.equal(guarded.enabled,true);assert.equal(guarded.toggle(),false);
}

// Picks the target closest to the crosshair; a hidden nearer one falls through to a visible one.
{
 const list=[npc(.7,-10),npc(-.2,-12)];
 assert.equal(pickTarget({origin,yaw:0,pitch:0,actors:list,center,visible:()=>true}).index,1);
 assert.equal(pickTarget({origin,yaw:0,pitch:0,actors:list,center,visible:(a,b,e)=>e===list[0]}).index,0);
}

// clear() drops the target; the pitch clamp holds; zero dt is a no-op.
{
 const assist=make([npc(.5,-10)]);assert.equal(assist.update(frame).target,0);assist.clear();
 assert.deepEqual(assist.update(frame),{yaw:0,pitch:0,target:null},'clear resets the look input');
 assert.equal(assist.snapshot().target,null);
 assert.ok(nudge({yaw:0,pitch:1.29,origin,point:{x:0,y:200,z:-1},dt:1}).pitch<=AIM_ASSIST.maxPitch);
 assert.deepEqual(make([npc(.5,-10)]).update({...frame,dt:0}),{yaw:0,pitch:0,target:null});
}

// Source checks: the helper has no firing path; the page wires it with the base-relative path; the package ships it.
const helper=await readFile(new URL('../aim-assist.js',import.meta.url),'utf8');
assert.ok(!helper.includes('fire(')&&!helper.includes('setMouse')&&!helper.includes('setKeyboard'),'helper cannot fire');
const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert.ok(page.includes('from \'./river/aim-assist.js\''),'inline module import respects base href');
assert.ok(page.includes('id="bAssist"')&&page.includes('aimAssist:assist.snapshot()'));
assert.ok(page.includes('visible:(a,b)=>clearSight(a,b)'),'uses the existing line-of-sight ray');
assert.ok(page.indexOf('const assist=createAimAssist')<page.indexOf('function look(dx,dy)'),'ready before any look input or pointer lock');
// Integration wiring: only real nonzero mouse look or net arrow look feeds the assist; trigger, ADS and key fire never do.
assert.ok(!helper.includes('engaged'),'helper has no trigger or ADS engagement path');
const updates=page.match(/assist\.update\(\{[^}]*\}\)/g)||[];
assert.equal(updates.length,1,'one assist update per frame');
assert.equal(updates[0],'assist.update({dt,now:lookNow,origin:pos,yaw:S.yaw,pitch:S.pitch})','update receives no trigger, ADS or key state');
assert.equal(page.split('assist.noteLook(').length-1,2,'only mouse look and arrow look feed the assist');
assert.ok(page.includes('function look(dx,dy){if(dx||dy)assist.noteLook(performance.now());'),'mouse look must be nonzero');
assert.ok(page.includes('if((!!keys.ArrowLeft!==!!keys.ArrowRight)||(!!keys.ArrowUp!==!!keys.ArrowDown))assist.noteLook(lookNow);const a=assist.update('),'arrow look must be a net nonzero look this frame');
assert.ok(page.includes('if(!live)assist.clear()'),'look input is reset when play is not live');
const pack=await readFile(new URL('../tools/package.mjs',import.meta.url),'utf8');
assert.ok(pack.includes('\'aim-assist.js\''),'packaged for the public build');
console.log('assist-reference-checks: ok');
