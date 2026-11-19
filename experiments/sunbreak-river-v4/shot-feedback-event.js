import {combatEventFromIntersection} from './combat-feedback.js';
import {MAP,groundHeight} from './map-layout.js';
import {sampleRiverSurface,FLOW_WAVES} from './river-water.js';

// Front-to-back brackets inside the finite water/wave envelope. Unlike a
// Newton-style plane correction this cannot jump over an earlier wave crest.
// 1cm search intervals, then bisection; grazing/tangent accuracy is bounded by
// that interval, not asserted to be an exact analytic intersection.
export function intersectRiverSurface(T,origin,dir,maxDistance,time){
 let near=0,far=maxDistance;const amplitude=FLOW_WAVES.reduce((n,w)=>n+w.amplitude,0);
 for(const [axis,min,max]of [['x',-7,7],['y',MAP.waterY-amplitude,MAP.waterY+amplitude],['z',-80,80]]){
  if(Math.abs(dir[axis])<1e-9){if(origin[axis]<min||origin[axis]>max)return null;continue}
  const a=(min-origin[axis])/dir[axis],b=(max-origin[axis])/dir[axis];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));
 }
 if(far<=near)return null;
 const p=new T.Vector3(),sample=t=>{p.copy(origin).addScaledVector(dir,t);return p.y-sampleRiverSurface(p.x,p.z,time).height};
 const steps=Math.ceil((far-near)/.01),step=(far-near)/steps;let a=near,fa=sample(a);
 for(let i=1;i<=steps;i++){
  const b=near+i*step,fb=sample(b);
  if(fa>=0&&fb<=0){let lo=a,hi=b;for(let n=0;n<16;n++){const mid=(lo+hi)*.5;if(sample(mid)>0)lo=mid;else hi=mid}
   p.copy(origin).addScaledVector(dir,(lo+hi)*.5);const surface=sampleRiverSurface(p.x,p.z,time);
   if(surface.depth>.015&&Math.abs(p.x)<7&&Math.abs(p.z)<80)return p.clone();
  }
  a=b;fa=fb;
 }
 return null;
}

// Presentation adapter only. Damage, enemy bounds and weapon cadence remain
// owned by the original fire function. Never creates a hit at a miss endpoint.
export function createShotFeedbackAdapter(T,solids,getWaterTime=()=>0){
 const guard=new T.Raycaster(),v=new T.Vector3();
 const stats={shots:0,muzzleBlocked:0,intercepted:0,misses:0};let lastShot=null;
 function firstBetween(a,b){v.copy(b).sub(a);const distance=v.length();if(distance<.025)return null;
  guard.set(a,v.multiplyScalar(1/distance));guard.near=.008;guard.far=distance-.012;return guard.intersectObjects(solids,true)[0]||null;
 }
 return {event({cam,gun,wall,best,end,direction}){
  stats.shots++;cam.updateWorldMatrix(true,false);gun.updateWorldMatrix(true,true);
  const origin=cam.getWorldPosition(new T.Vector3()),dir=direction.clone().normalize(),muzzle=gun.localToWorld(new T.Vector3(0,.005,-1.85)).applyMatrix4(cam.matrixWorld);
  const blocked=firstBetween(origin,muzzle);
  if(blocked)stats.muzzleBlocked++;
  const obstruction=blocked||firstBetween(muzzle,end);
  let event=best?{hit:true,point:end.clone(),normal:dir.clone().negate(),kind:'actor',direction:dir}:combatEventFromIntersection(T,wall,dir);
  // A camera shot can see past a corner while the displayed barrel cannot.
  // Keep baseline gameplay; put presentation on the first blocking surface.
  if(obstruction){stats.intercepted++;event=combatEventFromIntersection(T,obstruction,dir)}
  const start=blocked?origin:muzzle;
  if(dir.y<-.0001){const t=getWaterTime(),p=intersectRiverSurface(T,origin,dir,origin.distanceTo(event.hit?event.point:end),t);
   if(p){
    if(!firstBetween(start,p)){
     const dx=(sampleRiverSurface(p.x+.018,p.z,t).height-sampleRiverSurface(p.x-.018,p.z,t).height)/.036,dz=(sampleRiverSurface(p.x,p.z+.018,t).height-sampleRiverSurface(p.x,p.z-.018,t).height)/.036;
     event={hit:true,point:p,normal:new T.Vector3(-dx,1,-dz).normalize(),kind:'water',direction:dir};
    }
   }
  }
  if(event.object?.userData?.bridge)event.kind='wood';
  event.muzzle=blocked?null:muzzle;if(!event.hit)stats.misses++;
  lastShot={cameraHit:wall?.point?.toArray()||null,interception:obstruction?.point?.toArray()||null,point:event.point?.toArray()||null,normal:event.normal?.toArray()||null,kind:event.kind||null,hit:!!event.hit,muzzle:event.muzzle?.toArray()||null,direction:dir.toArray(),waterTime:getWaterTime()};
  return event;
 },info:()=>({...stats,lastShot})};
}
