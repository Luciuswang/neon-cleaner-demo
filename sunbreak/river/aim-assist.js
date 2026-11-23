// Optional light aim assistance for this game's own fictional NPCs.
// It only nudges the player's look angles toward a visible NPC near the crosshair
// while the player is actually moving the view (fresh nonzero mouse or arrow look input).
// Holding fire or ADS alone never rotates the camera, so it cannot track unaided.
// It never fires, never changes a shot, and never selects an occluded target.
export const AIM_ASSIST_KEY='sunbreak-river-aim-assist';
export const AIM_ASSIST=Object.freeze({cone:.085,range:70,rate:.4,gain:5,inputMs:180,maxPitch:1.3});
const TAU=Math.PI*2;
const wrap=a=>a-TAU*Math.round(a/TAU);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function defaultStorage(){try{return globalThis.localStorage||null}catch{return null}}
// Anything but '0' means on, so the default is on.
export function readEnabled(storage){try{return storage?.getItem(AIM_ASSIST_KEY)!=='0'}catch{return true}}
export function writeEnabled(storage,on){try{storage?.setItem(AIM_ASSIST_KEY,on?'1':'0');return true}catch{return false}}

// Camera convention of the game: rotation order YXZ, yaw 0 looks along -z, positive pitch looks up.
export function lookDirection(yaw,pitch){const c=Math.cos(pitch);return{x:-Math.sin(yaw)*c,y:Math.sin(pitch),z:-Math.cos(yaw)*c}}
export function anglesTo(origin,point){
 const dx=point.x-origin.x,dy=point.y-origin.y,dz=point.z-origin.z;
 return{yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(dy,Math.hypot(dx,dz)),distance:Math.hypot(dx,dy,dz)};
}

// Centre of the actor's real hit bounds; falls back to the actor's own position and stance.
export function actorCenter(actor,boundsOf){
 try{
  const b=boundsOf?.(actor);
  if(b?.min&&b?.max){
   const p={x:(b.min.x+b.max.x)/2,y:(b.min.y+b.max.y)/2,z:(b.min.z+b.max.z)/2};
   if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))return p;
  }
 }catch{}
 const p=actor?.g?.position;
 if(!p)return null;
 return{x:p.x,y:p.y+1.2-.35*(actor.tactical?.stance||0),z:p.z};
}

// Nearest-to-crosshair living actor inside the cone with a clear line of sight.
export function pickTarget({origin,yaw,pitch,actors,center,visible,cone=AIM_ASSIST.cone,range=AIM_ASSIST.range}){
 const from={x:origin.x,y:origin.y,z:origin.z},dir=lookDirection(yaw,pitch),found=[];
 const list=actors||[];
 for(let index=0;index<list.length;index++){
  const actor=list[index];
  if(!actor||!actor.alive||actor.hp<=0)continue;
  const point=center(actor);
  if(!point)continue;
  const dx=point.x-from.x,dy=point.y-from.y,dz=point.z-from.z,distance=Math.hypot(dx,dy,dz);
  if(!(distance>.5)||distance>range)continue;
  const angle=Math.acos(clamp((dx*dir.x+dy*dir.y+dz*dir.z)/distance,-1,1));
  if(angle>cone)continue;
  found.push({index,actor,point,angle,distance});
 }
 found.sort((a,b)=>a.angle-b.angle);
 for(const candidate of found)if(visible(from,candidate.point,candidate.actor))return candidate;
 return null;
}

// Smooth, rate-limited step toward the point. It never overshoots and never snaps.
export function nudge({yaw,pitch,origin,point,dt,rate=AIM_ASSIST.rate,gain=AIM_ASSIST.gain,maxPitch=AIM_ASSIST.maxPitch}){
 const want=anglesTo(origin,point),dy=wrap(want.yaw-yaw),dp=want.pitch-pitch,error=Math.hypot(dy,dp);
 if(!(dt>0)||error<1e-5)return{yaw,pitch};
 const step=Math.min(error*(1-Math.exp(-gain*dt)),rate*dt),f=step/error;
 return{yaw:yaw+dy*f,pitch:clamp(pitch+dp*f,-maxPitch,maxPitch)};
}

export function createAimAssist({actors,center,visible,storage=defaultStorage(),config=AIM_ASSIST}){
 let enabled=readEnabled(storage),target=null,lastLook=-Infinity;
 return{
  get enabled(){return enabled},
  setEnabled(value){enabled=!!value;if(!enabled){target=null;lastLook=-Infinity}writeEnabled(storage,enabled);return enabled},
  toggle(){return this.setEnabled(!enabled)},
  // Called only from the player's own nonzero look input (mouse or arrow look). Never from fire or ADS.
  noteLook(now){if(Number.isFinite(now))lastLook=now},
  clear(){target=null;lastLook=-Infinity},
  update({dt,now,origin,yaw,pitch}){
   target=null;
   if(!enabled||!(dt>0))return{yaw,pitch,target};
   // Only fresh look input enables the nudge; trigger and ADS state are deliberately not consulted.
   const age=now-lastLook;
   if(!(age>=0&&age<=config.inputMs))return{yaw,pitch,target};
   const hit=pickTarget({origin,yaw,pitch,actors:actors(),center,visible,cone:config.cone,range:config.range});
   if(!hit)return{yaw,pitch,target};
   target=hit.index;
   const next=nudge({yaw,pitch,origin,point:hit.point,dt,rate:config.rate,gain:config.gain,maxPitch:config.maxPitch});
   return{yaw:next.yaw,pitch:next.pitch,target};
  },
  snapshot(){return{enabled,target}}
 };
}
