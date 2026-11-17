// One shared geometric contract for rendering, movement, ray occlusion and AI.
export const MAP={minX:-32,maxX:32,minZ:-34,maxZ:26,waterY:-.18};
export const TERRAIN_GRID={size:260,segments:400};
export const crossings=[-23,-4,15];
export const teamSpawns=[[-27,0,22],[27,0,22]];
export const houses=[];
for(const side of [-1,1])for(const [i,z]of [-23,-3,17].entries())houses.push({id:`house-${side}-${i}`,x:side*17,z,w:7,d:7,h:3.3,ruin:i,side});
export const walls=[];
function wall(id,x,y,z,w,h,d,material,houseId=null){walls.push({id,x,y,z,w,h,d,material,houseId})}
for(const h of houses){
 const height=h.ruin===2?1.05:h.h;
 for(const end of [-1,1]){
  for(const side of [-1,1])wall(h.id+`-end-${end}-${side}`,h.x+side*2.2,height/2,h.z+end*3.5,2.6,height,.28,'plaster',h.id);
  if(h.ruin<2)wall(h.id+'-lintel-'+end,h.x,2.88,h.z+end*3.5,1.8,.84,.28,'plaster',h.id);
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
 wall(`outer-cover-${side}-${z}`,side*26,.7,z,2.6,1.4,1.1,'brick');
}
export const bounds=walls.map(b=>({min:{x:b.x-b.w/2,y:b.y-b.h/2,z:b.z-b.d/2},max:{x:b.x+b.w/2,y:b.y+b.h/2,z:b.z+b.d/2},id:b.id}));
export const spawns=[[-25,0,-25],[25,0,-25],[-9,0,-10],[9,0,-10],[-25,0,6],[25,0,6]];
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
 return Math.abs(x)<=6&&Math.abs(z+4)<=1.2?0:groundHeight(x,z);
}
export function landscapeHeight(x,z){
 const ax=Math.abs(x),az=Math.abs(z+4);let y=groundHeight(x,z);
 if(ax>38||az>40)y+=Math.max(0,Math.max(ax-38,az-40))*.13+Math.sin(x*.08)*Math.sin(z*.09)*Math.max(0,ax-40)*.04;
 return y;
}
export function blocked(x,z,r=.4,y=1.6){
 return x<MAP.minX+r||x>MAP.maxX-r||z<MAP.minZ+r||z>MAP.maxZ-r||bounds.some(b=>x>b.min.x-r&&x<b.max.x+r&&z>b.min.z-r&&z<b.max.z+r&&y-1.5<b.max.y&&y+.15>b.min.y);
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
 if(Math.abs(x)<riverWidth(z)+1.6||blocked(x,z,1))return false;
 if(houses.some(h=>Math.abs(x-h.x)<4.5&&Math.abs(z-h.z)<5))return false;
 if(crossings.some(c=>Math.abs(z-c)<1.8))return false;
 return true;
}
export const layout={houses,walls,crossings,teamSpawns,bounds,spawns};
