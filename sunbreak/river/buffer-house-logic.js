import {HOUSE,floorHeight as sourceFloorHeight,underRoof as sourceUnderRoof,
 doorBounds,bodyOverlaps,swingOccupied,createDoorState} from './house-logic.js';

// Geometry still lives in the original authoring coordinate system. Only this
// adapter knows where an instance is placed; no original-map proxy is reused.
export const BUFFER_PLACEMENTS=Object.freeze([
 Object.freeze({id:'west-buffer',x:-26,z:9,yaw:0}),
 Object.freeze({id:'east-buffer',x:26,z:-17,yaw:Math.PI})
]);
// Overall roof/room/veranda/stair footprint, deliberately conservative for AI.
// These are navigation obstacles, NOT player collision boxes.
export const CABIN_NAVIGATION_LOCAL_BOUNDS=Object.freeze({
 min:Object.freeze({x:-4.45,y:0,z:-4.45}),
 max:Object.freeze({x:4.45,y:7.1,z:5.67})
});
const inRect=(x,z,a,b,c,d)=>x>=a&&x<=b&&z>=c&&z<=d;

export function createHouseTransform(placement){
 const {id,x,z,y=0,yaw=0}=placement;
 if(typeof id!=='string'||!id||![x,y,z,yaw].every(Number.isFinite))throw Error('Invalid buffer-house placement');
 const c=Math.cos(yaw),s=Math.sin(yaw),origin=Object.freeze({id,x,y,z,yaw});
 function toSourceXYZ(px,py,pz,out={}){
  const dx=px-x,dz=pz-z;
  out.x=HOUSE.x+c*dx-s*dz;out.y=py-y;out.z=HOUSE.z+s*dx+c*dz;return out;
 }
 function toSource(p,out={}){return toSourceXYZ(p.x,p.y??0,p.z,out)}
 function localToWorld(p,out={}){
  out.x=x+c*p.x+s*p.z;out.y=y+(p.y??0);out.z=z-s*p.x+c*p.z;return out;
 }
 function toWorld(p,out={}){
  return localToWorld({x:p.x-HOUSE.x,y:p.y??0,z:p.z-HOUSE.z},out);
 }
 function localBounds(b){
  const result={min:{x:Infinity,y:y+b.min.y,z:Infinity},max:{x:-Infinity,y:y+b.max.y,z:-Infinity}};
  for(const px of [b.min.x,b.max.x])for(const pz of [b.min.z,b.max.z]){
   const q=localToWorld({x:px,z:pz});
   result.min.x=Math.min(result.min.x,q.x);result.max.x=Math.max(result.max.x,q.x);
   result.min.z=Math.min(result.min.z,q.z);result.max.z=Math.max(result.max.z,q.z);
  }
  return result;
 }
 function sourceBounds(b){
  return localBounds({min:{x:b.min.x-HOUSE.x,y:b.min.y,z:b.min.z-HOUSE.z},max:{x:b.max.x-HOUSE.x,y:b.max.y,z:b.max.z-HOUSE.z}});
 }
 return{placement:origin,toSource,toSourceXYZ,toWorld,localToWorld,localBounds,sourceBounds};
}

export function createBufferHouseLogic({placement,movement=[]}){
 const transform=createHouseTransform(placement),door=createDoorState(),q={},probe={};
 const nav=CABIN_NAVIGATION_LOCAL_BOUNDS;
 const sourceNavigation={min:{x:HOUSE.x+nav.min.x,y:nav.min.y,z:HOUSE.z+nav.min.z},max:{x:HOUSE.x+nav.max.x,y:nav.max.y,z:HOUSE.z+nav.max.z}};
 const navigationBounds={id:placement.id,...transform.localBounds(nav)};
 // The authoring assembly does not include the later artist-added bottom step.
 // Do not import its invisible support or the old floor function's global 0.
 function floorHeight(x,z){
  transform.toSource({x,z},q);
  const lx=q.x-HOUSE.x,lz=q.z-HOUSE.z;
  const room=inRect(lx,lz,-4,4,-4,2.42),porch=inRect(lx,lz,-3.85,1.77,2.4,4.02);
  const stair=inRect(lx,lz,HOUSE.stairLeft,HOUSE.stairRight,HOUSE.stairStart,HOUSE.stairEnd);
  if(!room&&!porch&&!stair)return null;
  const top=sourceFloorHeight(q.x,q.z);
  // Inclusive tread seams/edges have real support, even where the original
  // strictly-interior helper returns its outdoor fallback.
  return transform.placement.y+(top>0?top:room||porch?HOUSE.floor:Math.max(1,Math.min(4,Math.ceil((5.6-lz)/.4)))*.165);
 }
 let cachedAngle=NaN,cachedDoor;
 function currentDoorBounds(){
  if(cachedAngle!==door.angle){cachedAngle=door.angle;cachedDoor=doorBounds(cachedAngle)}
  return cachedDoor;
 }
 function blocksMovement(p,actor='player'){
  transform.toSource(p,q);
  // Existing bots do not acquire indoor paths in this slice. This includes the
  // paired stair/buffer approaches under either rotation, not just the room.
  if(actor==='enemy')return bodyOverlaps(q,sourceNavigation);
  return movement.some(b=>bodyOverlaps(q,b))||bodyOverlaps(q,currentDoorBounds());
 }
 function ceilingY(p,previousY){
  transform.toSource(p,q);let limit=Infinity;
  const before=previousY-transform.placement.y;
  for(const b of movement)if(q.x>b.min.x-.4&&q.x<b.max.x+.4&&q.z>b.min.z-.4&&q.z<b.max.z+.4&&before+.15<=b.min.y+1e-6&&q.y+.15>=b.min.y)limit=Math.min(limit,b.min.y-.151+transform.placement.y);
  return limit;
 }
 function underRoof(x,y,z){transform.toSourceXYZ(x,y,z,q);return sourceUnderRoof(q.x,q.y,q.z)}
 function step(dt,player,active=true){door.step(Number.isFinite(dt)?Math.max(0,dt):0,player?transform.toSource(player,probe):null,active)}
 function toggle({player,...options}){
  return door.toggle({...options,occupied:!!player&&swingOccupied(transform.toSource(player,probe))});
 }
 return{transform,door,movement,navigationBounds,floorHeight,ceilingY,blocksMovement,underRoof,step,toggle,
  reset(){door.reset();cachedAngle=NaN},
  doorBounds(){return transform.sourceBounds(currentDoorBounds())},
  doorAnchor:transform.localToWorld({x:HOUSE.doorX,y:HOUSE.floor+1.18,z:HOUSE.front}),
  info(){return{id:placement.id,placement:{...transform.placement},navigationBounds,door:door.info()}}
 };
}
