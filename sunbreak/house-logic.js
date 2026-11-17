// Local architectural interaction only. No combat state, RNG, browser or Three.
export const HOUSE=Object.freeze({
 x:12,z:-18,halfWidth:4,back:-4,front:2.4,floor:.66,eave:4.74,ridge:6.88,
 doorX:-1.08,doorWidth:1.52,doorHeight:2.38,hingeX:-1.84,leafWidth:1.48,
 openAngle:1.48,stairLeft:-1.85,stairRight:-.31,stairStart:4,stairEnd:5.6
});
export const localPoint=p=>({x:p.x-HOUSE.x,y:p.y,z:p.z-HOUSE.z});
const inside=(x,z,a,b,c,d)=>x>a&&x<b&&z>c&&z<d;
export function floorHeight(x,z){
 x-=HOUSE.x;z-=HOUSE.z;
 if(inside(x,z,-4,4,-4,2.42)||inside(x,z,-3.85,1.78,2.4,4.02))return HOUSE.floor;
 if(inside(x,z,HOUSE.stairLeft,HOUSE.stairRight,4,5.6))return Math.min(4,Math.ceil((5.6-z)/.4))*.165;
 return 0;
}
export function underRoof(x,y,z){
 x-=HOUSE.x;z-=HOUSE.z;
 const roofY=HOUSE.ridge-Math.abs(z+.8)*(HOUSE.ridge-HOUSE.eave)/3.2;
 return (inside(x,z,-4.36,4.36,-4.36,2.83)&&y<roofY-.12)||
  (inside(x,z,-4.04,1.94,2.4,4.22)&&y<4.15-(z-2.4)*.22);
}
export function doorBounds(angle){
 const c=Math.cos(angle),s=Math.sin(angle),xs=[],zs=[];
 for(const x of [0,HOUSE.leafWidth])for(const z of [-.075,.075]){
  xs.push(HOUSE.x+HOUSE.hingeX+x*c+z*s);zs.push(HOUSE.z+HOUSE.front-x*s+z*c);
 }
 return{min:{x:Math.min(...xs),y:HOUSE.floor,z:Math.min(...zs)},max:{x:Math.max(...xs),y:HOUSE.floor+HOUSE.doorHeight,z:Math.max(...zs)}};
}
export function bodyOverlaps(p,b,r=.4){
 return p.x>b.min.x-r&&p.x<b.max.x+r&&p.z>b.min.z-r&&p.z<b.max.z+r&&p.y-1.5<b.max.y&&p.y+.15>b.min.y;
}
export function swingOccupied(p){
 const q=localPoint(p);
 return inside(q.x,q.z,HOUSE.hingeX-.43,HOUSE.hingeX+HOUSE.leafWidth+.43,HOUSE.front-HOUSE.leafWidth-.43,HOUSE.front+.43)&&q.y-1.5<HOUSE.floor+HOUSE.doorHeight;
}
export function createDoorState(){
 let angle=0,target=0,message='',toggles=0;
 return{
  get angle(){return angle},get target(){return target},get message(){return message},
  toggle({near,visible,active,occupied=false,repeat=false,focusedUI=false}){
   if(!near||!visible||!active||repeat||focusedUI||Math.abs(angle-target)>.025)return false;
   if(occupied){message='先离开门扇转动范围';return false}
   target=target?0:HOUSE.openAngle;toggles++;message='';return true;
  },
  step(dt,p,active=true){
   if(!active)return;
   // Per-step obstruction protects a player who enters after the initial check.
   const next=angle+Math.sign(target-angle)*Math.min(Math.abs(target-angle),Math.max(0,dt)*1.8);
   if(next!==angle&&p&&bodyOverlaps(p,doorBounds(next))){
    target=angle;message='门扇被挡住，请后退';return;
   }
   angle=next;
  },
  reset(){angle=target=0;message='';toggles=0},
  info(){return{angle,target,moving:Math.abs(angle-target)>.025,open:angle>1.35,message,toggles}}
 };
}
