import {MAP,landscapeHeight,riverWidth} from './map-layout.js';
let cache;
export function outerSwardRoots(){
 if(cache)return cache;
 let s=0x51ced5a7;
 const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296};
 const edge=(x,z)=>Math.hypot(Math.max(MAP.minX-x,0,x-MAP.maxX),Math.max(MAP.minZ-z,0,z-MAP.maxZ));
 const N=(x,z)=>.5+.27*Math.sin(x*.19+z*.13+1.7)+.23*Math.sin(z*.31-x*.23+.4);
 const out=[];
 const put=(x,z,far)=>{
  if(out.length>=14500||edge(x,z)<.82||Math.abs(x)<riverWidth(z)+1.1)return;
  out.push({x,y:landscapeHeight(x,z),z,h:far?.34+.26*R():.23+.27*R(),r:far?.7+.55*R():.4+.4*R(),yaw:R()*6.2832,tone:.82+.32*R(),variant:R()*4|0,wall:''});
 };
 // near band: fully jittered cells, soft fade 7.5–10.5 m
 const c=.72,n=10.5;
 for(let x=MAP.minX-n;x<MAP.maxX+n;x+=c)for(let z=MAP.minZ-n;z<MAP.maxZ+n;z+=c){
  const px=x+R()*c,pz=z+R()*c,e=edge(px,pz),k=R();
  if(e>n||k>(.8+.2*N(px,pz))*(e>7.5?(n-e)/3:1))continue;
  put(px,pz,false);
 }
 // slopes: clumped heavier tufts, ragged noise-driven limit 30–40 m
 const g=2.8,f=42;
 for(let x=MAP.minX-f;x<MAP.maxX+f;x+=g)for(let z=MAP.minZ-f;z<MAP.maxZ+f;z+=g){
  const cx=x+R()*g,cz=z+R()*g,e=edge(cx,cz),k=R(),m=5+(R()*6|0);
  const L=30+10*N(cx*.3,cz*.3);
  if(e<7.5||e>L||k>(.75+.25*N(cz,cx))*Math.min(1,(L-e)/8+.15))continue;
  for(let i=0;i<m;i++){
   const a=R()*6.2832,d=1.7*Math.sqrt(R());
   put(cx+Math.cos(a)*d,cz+Math.sin(a)*d,true);
  }
 }
 return cache=out;
}
