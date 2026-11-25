// meadow-roots.js — deterministic sward root placement (pure data, no three/browser deps).
import {MAP,houses,bufferPlacements,bufferLocal,rubbleMounds,bounds,groundHeight} from './map-layout.js';
import {trafficDistance} from './ground-surface.js';
import {afterRainPuddleInterior} from './afterrain-ground.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function hash(x,y){let h=(Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1))>>>0;h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;h=(h^(h>>>15))>>>0;return(h>>>8)/16777216}
const H=(a,b,s)=>hash(a+s*7919,b-s*10473);
const HW=3.64; // outer face of house walls
const solid=bounds.filter(b=>b.min.y<.3&&b.max.y>.05);

// Returns traffic distance when a root may stand here, otherwise 0.
function open(x,z){
 if(x<MAP.minX+.3||x>MAP.maxX-.3||z<MAP.minZ+.3||z>MAP.maxZ-.3)return 0;
 if(groundHeight(x,z)<-.08||(Math.abs(x)<6.4&&Math.abs(z+4)<1.6))return 0; // water, bridge
 for(const h of houses){
  const dx=x-h.x,dz=z-h.z;
  if(Math.abs(dx)<HW&&Math.abs(dz)<HW)return 0; // interior
  const out=-dx*h.side; // river-facing twin doorways
  if(out>3.2&&out<5.3&&Math.abs(Math.abs(dz)-2.1)<.95)return 0;
 }
 for(const p of bufferPlacements){const q=bufferLocal(x,z,p);if(q.x>-4.5&&q.x<4.5&&q.z>-4.5&&q.z<6.15)return 0}
 for(const m of rubbleMounds){const a=(x-m.x)/(m.rx+.15),b=(z-m.z)/(m.rz+.15);if(a*a+b*b<1)return 0}
 for(const b of solid)if(x>b.min.x-.1&&x<b.max.x+.1&&z>b.min.z-.1&&z<b.max.z+.1)return 0;
 const td=trafficDistance(x,z);
 return td>.8?td:0;
}

let cache;
export function meadowRoots(){
 if(cache)return cache;
 const out=[],f=v=>+v.toFixed(3);
 const push=(x,z,td,wall)=>{
  const n=out.length,a=H(n,7,3),b=H(n,11,5);
  const patch=clamp(.5+.3*Math.sin(x*.31+z*.17)+.2*Math.cos(z*.43-x*.21)+.12*Math.sin(x*1.1-z*.9));
  const hue=clamp(.5+.32*Math.sin(x*.19-z*.27+1.3)+.2*Math.cos(x*.07+z*.33));
  out.push({x:f(x),y:f(groundHeight(x,z)),z:f(z),
   h:f((.2+.3*patch)*(.75+.5*a)*(wall?1.3:1)*(.6+.4*smooth(.8,2.2,td))),
   r:f(.22+.18*clamp(.55*patch+.45*b)),
   yaw:f(.6+.5*Math.sin(x*.11+z*.07)+(b-.5)*.9),
   tone:f(.8+.4*clamp(.5+.6*(hue-.5)+.3*(a-.5)-(wall?.08:0))),
   variant:Math.floor(H(n,3,9)*4)&3,wall});
 };
 // 1) Contiguous field: jittered grid, thinned beside routes, puddle interiors kept clear.
 const S=.38,nx=Math.ceil((MAP.maxX-MAP.minX)/S),nz=Math.ceil((MAP.maxZ-MAP.minZ)/S);
 for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
  const x=MAP.minX+(i+.15+.7*H(i,j,1))*S,z=MAP.minZ+(j+.15+.7*H(i,j,2))*S,td=open(x,z);
  if(!td||(td<1.5&&H(i,j,4)>.1+.85*smooth(.8,1.5,td))||afterRainPuddleInterior(x,z))continue;
  push(x,z,td,'');
 }
 // 2) Wall bands: two rows .1-.8m off each ground face, wrapped .4m around corners.
 let seq=0;
 const skirt=(x0,z0,x1,z1,fam,map)=>{
  for(const [ax,az,bx,bz,px,pz] of [[x0,z0,x1,z0,0,-1],[x1,z0,x1,z1,1,0],[x1,z1,x0,z1,0,1],[x0,z1,x0,z0,-1,0]]){
   const L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/(L||1),uz=(bz-az)/(L||1),n=Math.ceil((L+.8)/.2);
   for(let i=0;i<n;i++)for(let row=0;row<2;row++){
    const k=seq++,t=-.4+(i+H(k,1,6))*.2,d=.1+(row+H(k,2,7))*.35;
    let x=ax+ux*t+px*d,z=az+uz*t+pz*d;
    if(map)[x,z]=map(x,z);
    const td=open(x,z);
    if(td)push(x,z,td,fam);
   }
  }
 };
 for(const h of houses)skirt(h.x-HW,h.z-HW,h.x+HW,h.z+HW,h.ruin?'ruin':'house');
 for(const p of bufferPlacements){const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  skirt(-4.5,-4.5,4.5,4.5,'cabin',(lx,lz)=>[p.x+lx*c+lz*s,p.z-lx*s+lz*c]); // porch side rejected by open()
 }
 const cx=v=>Math.max(MAP.minX,Math.min(MAP.maxX,v)),cz=v=>Math.max(MAP.minZ,Math.min(MAP.maxZ,v));
 for(const b of solid){
  const id=String(b.id||'');
  if(id.startsWith('house-')||bufferPlacements.some(p=>p.id===id))continue;
  const fam=/^(outer-)?cover-/.test(id)?'cover':id.startsWith('bank-screen')?'bank':'perimeter';
  skirt(cx(b.min.x),cz(b.min.z),cx(b.max.x),cz(b.max.z),fam); // clamped: perimeter gets its inside face only
 }
 return cache=out;
}
