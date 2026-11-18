import {CABIN_NAVIGATION_LOCAL_BOUNDS,createHouseTransform} from './buffer-house-logic.js';
// One shared geometric contract for rendering, movement, ray occlusion and AI.
export const MAP={minX:-32,maxX:32,minZ:-34,maxZ:26,waterY:-.18};
export const TERRAIN_GRID={size:260,segments:400};
export const crossings=[-23,-4,15];
export const teamSpawns=[[-27,0,22],[27,0,22]];
export const bufferPlacements=[{id:'west-buffer',x:-26,z:9,yaw:0},{id:'east-buffer',x:26,z:-17,yaw:Math.PI}];
export function bufferLocal(x,z,p){const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);return{x:dx*c-dz*s,z:dx*s+dz*c}}
export function inBuffer(x,z,padding=0){return bufferPlacements.some(p=>{const q=bufferLocal(x,z,p);return q.x>-4.45-padding&&q.x<4.45+padding&&q.z>-4.45-padding&&q.z<6.1+padding})}
export const houses=[];
for(const side of [-1,1])for(const [i,z]of [-23,-3,17].entries())houses.push({id:`house-${side}-${i}`,x:side*17,z,w:7,d:7,h:3.3,ruin:i,side});
export const rubbleMounds=houses.filter(h=>h.ruin>0).flatMap(h=>[-1,1].map(s=>({id:h.id+'-debris-'+s,x:h.x+s*2.4,z:h.z+(h.ruin===2?1.6:1),rx:1.08,rz:1.08,height:h.ruin===2?.40:.29,plateau:.44,segments:24,houseId:h.id,phase:(h.z+30)*.73+s*2.1})));
for(const m of rubbleMounds){
 const shiftX=Math.sin(m.phase)*.19,shiftZ=Math.cos(m.phase)*.16;
 m.vertices=[m.x+shiftX,m.height*.94,m.z+shiftZ];m.indices=[];
 for(const radius of [m.plateau,1])for(let i=0;i<m.segments;i++){
  const a=i/m.segments*Math.PI*2,edge=.83+.12*Math.sin(a*3+m.phase)+.05*Math.cos(a*7-m.phase);
  m.vertices.push(m.x+Math.cos(a)*m.rx*radius*edge+(radius<1?shiftX:0),radius===1?0:m.height*(.72+.20*Math.sin(a*2+m.phase)),m.z+Math.sin(a)*m.rz*radius*edge+(radius<1?shiftZ:0));
 }
 for(let i=0;i<m.segments;i++){const a=i+1,b=(i+1)%m.segments+1,c=a+m.segments,d=b+m.segments;m.indices.push(0,b,a,a,b,c,b,d,c)}
 m.triangles=[];for(let i=0;i<m.indices.length;i+=3){const [a,b,c]=m.indices.slice(i,i+3).map(j=>({x:m.vertices[j*3],y:m.vertices[j*3+1],z:m.vertices[j*3+2]}));m.triangles.push({a,b,c,d:(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z)})}
}
export function rubbleHeight(x,z){let y=0;for(const m of rubbleMounds){if(Math.abs(x-m.x)>m.rx||Math.abs(z-m.z)>m.rz)continue;for(const {a,b,c,d}of m.triangles){const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;if(u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8)y=Math.max(y,u*a.y+v*b.y+(1-u-v)*c.y)}}return y}
export const walls=[];
function wall(id,x,y,z,w,h,d,material,houseId=null){walls.push({id,x,y,z,w,h,d,material,houseId})}
for(const h of houses){
 const height=h.ruin===2?1.05:h.h;
 for(const end of [-1,1]){
  for(const side of [-1,1])wall(h.id+`-end-${end}-${side}`,h.x+side*2.2,height/2,h.z+end*3.5,2.6,height,.28,'plaster',h.id);
  if(h.ruin<2&&!(h.ruin===1&&end===1))wall(h.id+'-lintel-'+end,h.x,2.88,h.z+end*3.5,1.8,.84,.28,'plaster',h.id);
 }
 for(const side of [-1,1]){
  wall(h.id+`-side-base-${side}`,h.x+side*3.5,.5,h.z,.28,1,7,'brick',h.id);
  if(h.ruin<2){
   for(const end of [-1,1])wall(h.id+`-pier-${side}-${end}`,h.x+side*3.5,2.15,h.z+end*2.2,.28,2.3,2.6,'plaster',h.id);
   wall(h.id+`-window-head-${side}`,h.x+side*3.5,2.88,h.z,.28,.84,1.8,'plaster',h.id);
  }
 }
}
for(const side of [-1,1])for(const z of [-13,8]){
 wall(`cover-${side}-${z}`,side*7.8,.65,z,3.6,1.3,.65,'stone');
 if(!(side===-1&&z===8)&&!(side===1&&z===-13))wall(`outer-cover-${side}-${z}`,side*26,.7,z,2.6,1.4,1.1,'brick');
}
for(const w of walls){const h=houses.find(h=>h.id===w.houseId);if(h?.ruin===2||(h?.ruin===1&&w.z>h.z+1&&w.h>1)){
 const variant=Math.abs(Math.round((w.z-h.z+4)*7+Math.abs(w.x-h.x)*11+(w.w>w.d?0:3)))%3;
 const profiles=h.ruin===2?[[.93,.98,.94,.72,.32,.37,.41,.76,.80],[.41,.40,.56,.77,.94,.92,.95,.91,.83],[.82,.83,.72,.71,.53,.54,.56,.62,.63]]:[[1,.99,.97,.96,.71,.69,.42,.44,.43],[.48,.47,.46,.66,.68,.91,.96,.98,1],[.97,.97,.81,.79,.56,.54,.54,.72,.74]];
 const profile=profiles[variant];
 w.profile=w.w>=w.d&&w.x>h.x?[...profile].reverse():profile;
}}
export function wallTopAt(w,x,z,r=0){
 if(!w.profile)return w.y+w.h/2;
 const axis=w.w>=w.d?'x':'z',length=axis==='x'?w.w:w.d,coordinate=(axis==='x'?x:z)-w[axis];
 const sample=t=>{const u=Math.max(0,Math.min(w.profile.length-1,(t/length+.5)*(w.profile.length-1))),i=Math.min(w.profile.length-2,Math.floor(u));return w.profile[i]+(w.profile[i+1]-w.profile[i])*(u-i)};
 let top=Math.max(sample(coordinate-r),sample(coordinate+r));
 for(let i=0;i<w.profile.length;i++){const p=(i/(w.profile.length-1)-.5)*length;if(p>=coordinate-r&&p<=coordinate+r)top=Math.max(top,w.profile[i])}
 return w.y-w.h/2+top*w.h;
}
export const bounds=walls.map(b=>({min:{x:b.x-b.w/2,y:b.y-b.h/2,z:b.z-b.d/2},max:{x:b.x+b.w/2,y:b.y+b.h/2,z:b.z+b.d/2},id:b.id,...b.profile?{profileWall:b}:{}}));
// NPCs use the outside buffer routes; indoor navigation is not introduced.
export const navigationBounds=[...bounds,...bufferPlacements.map(p=>({id:p.id,...createHouseTransform(p).localBounds(CABIN_NAVIGATION_LOCAL_BOUNDS)}))];
export const spawns=[[-25,0,-25],[25,0,-25],[-9,0,-10],[9,0,-10],[-25,0,20],[25,0,20]];
export function riverWidth(z){return 3.4+.8*Math.cos(z*.17)+.35*Math.sin(z*.47)}
export function groundHeight(x,z){
 const ax=Math.abs(x),width=riverWidth(z);
 if(ax>=width+1.8)return 0;
 const meander=.32*Math.sin(ax*.9)+.14*Math.sin(ax*2.8);
 const distance=Math.min(Math.abs(z+23-meander),Math.abs(z-15-meander));
 const ford=Math.max(0,Math.min(1,(distance-1.2)/1.8));
 if(ford===0)return 0;
 const t=Math.max(0,Math.min(1,(ax-width+1.1)/2.9));
 return -.58*(1-t*t*(3-2*t))*ford*ford*(3-2*ford);
}
export function terrainHeight(x,z){
 // Center footbridge has a traversable deck while water flows under it.
 return Math.abs(x)<=6&&Math.abs(z+4)<=1.2?0:Math.max(groundHeight(x,z),rubbleHeight(x,z)||-Infinity);
}
export function landscapeHeight(x,z){
 const ax=Math.abs(x),az=Math.abs(z+4);let y=groundHeight(x,z);
 // Beyond the playable bounds only: rounded valley shoulders carry the forest
 // instead of leaving a bare flat horizon. The open river channel stays level.
 if(ax>38||az>40){const distance=Math.max(0,Math.max(ax-38,az-40)),bank=Math.max(0,Math.min(1,(ax-8)/18));
  y+=distance*.13*(.84+.18*Math.sin(x*.043+z*.036)+.12*Math.sin(z*.085-x*.04))*bank;
 }
 return y;
}
export function blocked(x,z,r=.4,y=1.6,actor='player'){
 return x<MAP.minX+r||x>MAP.maxX-r||z<MAP.minZ+r||z>MAP.maxZ-r||(actor==='enemy'?navigationBounds:bounds).some(b=>x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r&&y-1.5<(b.profileWall?wallTopAt(b.profileWall,x,z,r):b.max.y)&&y+.15>b.min.y);
}
export function roofHeight(x,z){
 for(const h of houses){
  if(Math.abs(x-h.x)>3.8||Math.abs(z-h.z)>3.8||h.ruin===2)continue;
  if(h.ruin===1&&z>h.z)continue;
  return h.h+1.7*(1-Math.abs(x-h.x)/3.8);
 }
 return Infinity;
}
export function vegetationAllowed(x,z){
 if(Math.abs(x)<riverWidth(z)+1.6||blocked(x,z,1)||inBuffer(x,z,.7)||rubbleHeight(x,z)>.01)return false;
 if(houses.some(h=>Math.abs(x-h.x)<4.5&&Math.abs(z-h.z)<5))return false;
 if(crossings.some(c=>Math.abs(z-c)<1.8))return false;
 return true;
}
export const layout={houses,walls,crossings,teamSpawns,bounds,spawns,bufferPlacements,rubbleMounds};
