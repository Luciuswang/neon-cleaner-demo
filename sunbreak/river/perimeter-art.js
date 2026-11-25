// river/perimeter-art.js
import {MAP,groundHeight,riverWidth} from './map-layout.js';

import {TH,TOP,perimeterBounds} from './perimeter-layout.js';

function rng(s){return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

function tri(o,A,B,C,ctr){
 const a=A.p,b=B.p,c=C.p,e=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],f=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 let n=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];
 const l=Math.hypot(n[0],n[1],n[2])||1;n=n.map(v=>v/l);
 const d=n[0]*((a[0]+b[0]+c[0])/3-ctr[0])+n[1]*((a[1]+b[1]+c[1])/3-ctr[1])+n[2]*((a[2]+b[2]+c[2])/3-ctr[2]);
 let V=[A,B,C];if(d<0){V=[A,C,B];n=n.map(v=>-v)}
 for(const v of V){o.pos.push(...v.p);o.nor.push(...n);if(v.c){o.col.push(...v.c);o.uv.push(...v.t)}}
 o.n++;
}

function hull(o,rings,caps){
 const all=rings.flat(),ctr=[0,1,2].map(k=>all.reduce((s,v)=>s+v.p[k],0)/all.length);
 for(let k=0;k<rings.length-1;k++){
  const a=rings[k],b=rings[k+1];
  for(let i=0;i<4;i++){const j=(i+1)%4;tri(o,a[i],a[j],b[j],ctr);tri(o,a[i],b[j],b[i],ctr)}
 }
 const cap=f=>{tri(o,f[0],f[1],f[2],ctr);tri(o,f[0],f[2],f[3],ctr)};
 cap(rings[rings.length-1]);if(caps>1)cap(rings[0]);
}

const CORNERS=[[0,0],[1,0],[1,1],[0,1]];

function coreBox(o,W,u0,u1,y0,y1,w0,w1){
 hull(o,[w0,w1].map(w=>CORNERS.map(([a,b])=>{const u=a?u1:u0,q=W.P(u,w);return{p:[q[0],b?y1:y0,q[1]]}})),2);
}

function stoneBlock(o,W,r,u0,u1,y0,y1,course,top){
 const D=top?.86:.5,f=r()*.1,ins=.05+r()*.04,tone=.5+r()*.4;
 const base=[tone*(.95+r()*.1),tone*(.93+r()*.1),tone*(.86+r()*.1)];
 const seam=[base[0]*.34,base[1]*.46,base[2]*.28],dark=[.34,.32,.27],tilt=Math.sin(u0*12.9+y0*7.7)*(top?.07:.02),clip=(a,b,s)=>1+.6*Math.sin(u0*7.3+y0*5.1+a*2.1+b*3.7+s);
 const moss=[base[0]*.55,base[1]*.72,base[2]*.42];
 const rings=[[D,0,0],[f+.07,0,.025],[f,ins,.02]].map(([w,inset,jit],k)=>CORNERS.map(([a,b])=>{
  const u=(a?u1-inset*clip(a,b,0):u0+inset*clip(a,b,0))+(r()-.5)*2*jit;
  const q=W.P(u,w+(k?(r()-.5)*.03:0));
  let y=(b?y1-inset*clip(a,b,1.9)+(a?tilt:-tilt):y0+inset*clip(a,b,1.9))+(r()-.5)*2*jit;
  if(course===0&&!b)y=Math.min(0,groundHeight(q[0],q[1]))-.15; // footing follows terrain
  const c=k===2?base:k===1?(top&&b?moss:seam):(top&&b?moss:dark);
  return{p:[q[0],y,q[1]],c,t:[(u+w)*.55,y*.55]};
 }));
 hull(o,rings,1);
}

function geo(T,o){
 const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(o.pos,3));
 g.setAttribute('normal',new T.Float32BufferAttribute(o.nor,3));
 if(o.col.length){
  g.setAttribute('color',new T.Float32BufferAttribute(o.col,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(o.uv,2));
 }
 g.computeBoundingSphere();
 return g;
}

export function buildPerimeter(T,world,stone,solids){
 const M=MAP,r=rng(0x51ab7e),S={pos:[],nor:[],col:[],uv:[],n:0},C={pos:[],nor:[],col:[],uv:[],n:0};
 const walls=[
  {ns:1,z:M.minZ,a:M.minX-TH,b:M.maxX+TH,P:(u,w)=>[u,M.minZ-w]},
  {ns:1,z:M.maxZ,a:M.minX-TH,b:M.maxX+TH,P:(u,w)=>[u,M.maxZ+w]},
  {ns:0,a:M.minZ,b:M.maxZ,P:(u,w)=>[M.minX-w,u]},
  {ns:0,a:M.minZ,b:M.maxZ,P:(u,w)=>[M.maxX+w,u]}];
 const CH=.37,COURSES=4;
 let stones=0;
 for(const W of walls){
  const hw=W.ns?riverWidth(W.z)+.7:0;
  // dark core: blocks light through seams, forms culvert recess
  if(W.ns){
   coreBox(C,W,W.a,-hw,-.9,1.28,.12,TH);
   coreBox(C,W,hw,W.b,-.9,1.28,.12,TH);
   coreBox(C,W,-hw,hw,.5,1.28,.12,TH);
   // lower culvert back plate removed: river stays visible through the opening
  }else coreBox(C,W,W.a,W.b,-.3,1.28,.12,TH);
  for(let c=0;c<COURSES;c++){
   const top=c===COURSES-1;
   let u=W.a-r()*.4;
   while(u<W.b-.05){
    const inSlot=W.ns&&Math.abs(u)<hw+1;
    let len=c===1&&inSlot?1.4+r()*.6:.5+r()*.55;
    if(top)len+=.15;
    if(W.ns&&c===0&&u>=-hw&&u<hw){u=hw;continue}
    let u1=u+len;
    if(W.ns&&c===0&&u<-hw&&u1>-hw)u1=-hw;
    if(W.b-u1<.3)u1=W.b;
    const y0=c*CH+(c?(r()-.5)*.04:0);
    const y1=top?TOP+(r()-.45)*.22:(c+1)*CH+(r()-.5)*.04;
    stoneBlock(S,W,r,Math.max(u,W.a)+.008,u1-.008,y0-.01,y1+.01,c,top);
    stones++;u=u1;
   }
  }
 }
 const group=new T.Group();
 group.name='perimeter-fieldstone-fence';
 const mat=stone&&stone.clone?stone.clone():new T.MeshStandardMaterial({color:0x8d8a7c,roughness:1});
 mat.vertexColors=true;mat.flatShading=true;mat.needsUpdate=true;
 if(mat.color&&mat.color.set)mat.color.set(0xffffff);
 const coreMat=new T.MeshStandardMaterial({color:0x3b382f,roughness:1,metalness:0});
 const stoneMesh=new T.Mesh(geo(T,S),mat);
 stoneMesh.name='perimeter-stones';stoneMesh.castShadow=true;stoneMesh.receiveShadow=true;
 const coreMesh=new T.Mesh(geo(T,C),coreMat);
 coreMesh.name='perimeter-core';coreMesh.castShadow=true;coreMesh.receiveShadow=false;
 group.add(coreMesh,stoneMesh);
 const bounds=perimeterBounds(M);
 group.userData={renderMarker:'perimeter-fieldstone-fence',drawCalls:2,stones,triangles:S.n+C.n,stoneTriangles:S.n,coreTriangles:C.n,height:TOP,culverts:2,bounds};
 if(world&&world.add)world.add(group);
 if(Array.isArray(solids))solids.push(coreMesh,stoneMesh);
 return group;
}
