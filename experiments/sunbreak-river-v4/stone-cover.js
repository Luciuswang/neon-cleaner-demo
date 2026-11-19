// Procedural masonry, existing CC0 scan materials. No layout/collision changes.
// A complete mortar/stone relief surface tiles each box face: never a pile of
// disconnected rocks with an invisible solid box behind apparent openings.
import {createMasonryMaterial,composeMasonryHook} from './masonry-materials.js';
export const STONE_COVER_REVISION='bounded-uneven-stone-cover-v3';
export const STONE_COVER_LIMITS=Object.freeze({maxRecess:.012,maxAddedTriangles:40000,maxBeautyDraws:3});
export const isStoneCover=w=>typeof w.id==='string'&&/^(cover-|outer-cover-)/.test(w.id);
function randomFor(id){let seed=2166136261;for(const c of id)seed=Math.imul(seed^c.charCodeAt(0),16777619);return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function clipCell(polygon,a,b,c){
 const out=[];for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=a*p[0]+b*p[1]-c,dq=a*q[0]+b*q[1]-c;
  if(dp<=1e-10)out.push(p);
  if((dp<0)!==(dq<0)){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}
 }
 return out.filter((p,i)=>{const q=out[(i+out.length-1)%out.length];return Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6});
}
function stoneCells(width,height,top,R){
 // Jittered anisotropic Voronoi cells form irregular interlocking fieldstone,
 // not repeated brick courses. The mortar backing closes every boundary.
 const cols=Math.max(1,Math.round(width/.51)),rows=Math.max(1,Math.round(height/(top?.39:.28))),sites=[];
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
  const px=width*((x+.5+(R()-.5)*.76)/cols-.5),py=height*((y+.5+(R()-.5)*.76)/rows-.5);
  if(x>0&&x<cols-1&&y>0&&y<rows-1&&R()<.07)continue;
  sites.push([px,py]);
 }
 const cells=[],aspect=top?1.25:1.7;
 for(const p of sites){
  let outer=[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]];
  for(const q of sites){if(p===q)continue;outer=clipCell(outer,2*(q[0]-p[0])/(aspect*aspect),2*(q[1]-p[1]),(q[0]*q[0]-p[0]*p[0])/(aspect*aspect)+q[1]*q[1]-p[1]*p[1]);if(outer.length<3)break}
  if(outer.length<3)continue;
  const centre=outer.reduce((s,q)=>[s[0]+q[0]/outer.length,s[1]+q[1]/outer.length],[0,0]);
  const inset=(q,d)=>{const len=Math.hypot(q[0]-centre[0],q[1]-centre[1]),t=Math.max(.35,1-d/len);return[centre[0]+(q[0]-centre[0])*t,centre[1]+(q[1]-centre[1])*t]};
  // Small inward chips break long sawn-looking edges. Every new point stays
  // inside its original convex cell; the continuous backing fills all seams.
  const chipped=[];
  for(let i=0;i<outer.length;i++){
   const a=outer[i],b=outer[(i+1)%outer.length];chipped.push(a);
   if(Math.hypot(b[0]-a[0],b[1]-a[1])>.16&&R()<.75){
    const t=.30+R()*.40,q=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
    chipped.push(inset(q,.002+R()*.007));
   }
  }
  outer=chipped;
  const ring=outer.map(q=>inset(q,.005+R()*.006)),bevels=outer.map(()=>.009+R()*.032),inner=outer.map((q,i)=>inset(q,bevels[i]+.009));
  const centreDepth=.0015+R()*.006,angle=R()*Math.PI*2,tilt=.002+R()*.0035;
  const radius=Math.max(...inner.map(q=>Math.hypot(q[0]-centre[0],q[1]-centre[1])));
  const heights=inner.map(q=>Math.max(.0003,Math.min(.0105,centreDepth+tilt*((q[0]-centre[0])*Math.cos(angle)+(q[1]-centre[1])*Math.sin(angle))/radius+(R()-.5)*.0018)));
  cells.push({outer,ring,inner,centre,centreDepth,bevels,recess:STONE_COVER_LIMITS.maxRecess,heights,
   tint:.71+R()*.38,warmth:(R()-.5)*.07,uvOffset:[R()*7,R()*7],uvScale:.72+R()*.65,
   response:[-.035+R()*.13,.48+R()*.55]});
 }
 return cells;
}
export function stoneCoverPlan(walls){
 const covers=walls.filter(isStoneCover).map(w=>{
  if(w.profile||![w.x,w.y,w.z,w.w,w.h,w.d].every(Number.isFinite)||Math.min(w.w,w.h,w.d)<=0)throw Error('Stone cover requires a finite positive axis-aligned box');
  const R=randomFor(w.id),faces=[
   {name:'front',n:[0,0,1],u:[1,0,0],v:[0,1,0],span:[w.w,w.h],offset:w.d/2},
   {name:'back',n:[0,0,-1],u:[-1,0,0],v:[0,1,0],span:[w.w,w.h],offset:w.d/2},
   {name:'right',n:[1,0,0],u:[0,0,-1],v:[0,1,0],span:[w.d,w.h],offset:w.w/2},
   {name:'left',n:[-1,0,0],u:[0,0,1],v:[0,1,0],span:[w.d,w.h],offset:w.w/2},
   {name:'top',n:[0,1,0],u:[1,0,0],v:[0,0,-1],span:[w.w,w.d],offset:w.h/2},
   {name:'bottom',n:[0,-1,0],u:[1,0,0],v:[0,0,1],span:[w.w,w.d],offset:w.h/2}
  ];
  for(const face of faces)face.cells=face.name==='bottom'?[]:stoneCells(...face.span,face.name==='top',R);
  return{id:w.id,centre:[w.x,w.y,w.z],size:[w.w,w.h,w.d],faces};
 });
 const cells=covers.flatMap(w=>w.faces.flatMap(f=>f.cells)),stones=cells.length,triangles=cells.reduce((n,c)=>n+c.ring.length*3,0)+covers.length*52;
 if(triangles-covers.length*12>STONE_COVER_LIMITS.maxAddedTriangles)throw Error('Stone cover triangle budget exceeded');
 return{revision:STONE_COVER_REVISION,covers,stones,triangles,maxRecess:STONE_COVER_LIMITS.maxRecess};
}
export function buildStoneCover({T,world,materials,walls,plan=stoneCoverPlan(walls)}){
 const group=new T.Group();group.name='stone-cover';world.add(group);
 const stone=createMasonryMaterial(T,materials.stone,{role:'stone',color:0x969e94});
 const mortar=createMasonryMaterial(T,materials.plaster,{role:'mortar',color:0x50594f});
 stone.vertexColors=mortar.vertexColors=true;
 // Per-stone response stays in one material/draw. Preserve standard albedo
 // decoding and the existing masonry/fog hooks; vary only physical response.
 composeMasonryHook(stone,STONE_COVER_REVISION,s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 stoneResponse;varying vec2 vStoneResponse;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStoneResponse=stoneResponse;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vStoneResponse;');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(nonPerturbedNormal,normal,vStoneResponse.y));');
  s.fragmentShader=s.fragmentShader.replace('#include <lights_physical_fragment>','roughnessFactor=clamp(roughnessFactor+vStoneResponse.x,.58,.96);\n#include <lights_physical_fragment>');
 });
 const batches={stone:{p:[],n:[],uv:[],color:[],wall:[],response:[]},mortar:{p:[],n:[],uv:[],color:[],wall:[],response:[]}};
 const ab=new T.Vector3(),ac=new T.Vector3(),normal=new T.Vector3();
 function emit(batch,cover,face,vertices,tint,offset,wallIndex,uvScale=1,response=[0,1]){
  const xyz=vertices.map(([u,v,depth])=>cover.centre.map((c,k)=>c+face.u[k]*u+face.v[k]*v+face.n[k]*(face.offset-depth)));
  ab.set(...xyz[1]).sub(new T.Vector3(...xyz[0]));ac.set(...xyz[2]).sub(new T.Vector3(...xyz[0]));normal.crossVectors(ab,ac).normalize();
  if(!Number.isFinite(normal.x)||normal.dot(new T.Vector3(...face.n))<=0)throw Error('Invalid stone cover winding');
  for(let i=0;i<3;i++){
   batch.p.push(...xyz[i]);batch.n.push(normal.x,normal.y,normal.z);
   batch.uv.push(vertices[i][0]*uvScale+offset[0],vertices[i][1]*uvScale+offset[1]);
   batch.color.push(...tint);batch.wall.push(wallIndex);batch.response.push(...response);
  }
 }
 for(const [wallIndex,cover]of plan.covers.entries())for(const face of cover.faces){
  if(face.name==='bottom'){
   const [w,h]=face.span,q=[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]];
   for(const ids of [[0,1,2],[0,2,3]])emit(batches.mortar,cover,face,ids.map(i=>q[i]),[1,1,1],[0,0],wallIndex);
   continue;
  }
  // Continuous opaque mortar behind every stone. A single closed face avoids
  // T-junction cracks between differently staggered rows. Its perimeter is
  // exactly on the box; only the interior is recessed, never the whole box.
  const [w,h]=face.span,edge=.016,outer=[[-w/2,-h/2,0],[w/2,-h/2,0],[w/2,h/2,0],[-w/2,h/2,0]];
  const base=outer.map(([u,v])=>[u-Math.sign(u)*edge,v-Math.sign(v)*edge,plan.maxRecess]);
  for(let i=0;i<4;i++){const j=(i+1)%4;
   for(const tri of [[outer[i],outer[j],base[j]],[outer[i],base[j],base[i]]])emit(batches.mortar,cover,face,tri,[1,1,1],[0,0],wallIndex);
  }
  for(const ids of [[0,1,2],[0,2,3]])emit(batches.mortar,cover,face,ids.map(i=>base[i]),[1,1,1],[0,0],wallIndex);
  for(const cell of face.cells){
   const ring=cell.ring.map(q=>[...q,cell.recess]);
   const inner=cell.inner.map((q,i)=>[...q,cell.heights[i]]),centre=[...cell.centre,cell.centreDepth],t=cell.tint;
   const tone=[t+cell.warmth,t,t-cell.warmth*.6];
   for(let i=0;i<ring.length;i++){
    const j=(i+1)%ring.length;
    for(const tri of [[ring[i],ring[j],inner[j]],[ring[i],inner[j],inner[i]],[inner[i],inner[j],centre]])emit(batches.stone,cover,face,tri,tone,cell.uvOffset,wallIndex,cell.uvScale,cell.response);
   }
  }
 }
 let actualTriangles=0;
 for(const [name,b]of Object.entries(batches))if(b.p.length){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.setAttribute('color',new T.Float32BufferAttribute(b.color,3));
  g.setAttribute('coverIndex',new T.Float32BufferAttribute(b.wall,1));g.computeBoundingBox();g.computeBoundingSphere();
  if(name==='stone')g.setAttribute('stoneResponse',new T.Float32BufferAttribute(b.response,2));
  const m=new T.Mesh(g,name==='stone'?stone:mortar);m.name='stone-cover-'+name;m.castShadow=m.receiveShadow=true;
  m.userData.stoneCover=true;group.add(m);actualTriangles+=b.p.length/9;
 }
 const info={revision:STONE_COVER_REVISION,covers:plan.covers.length,stones:plan.stones,drawCalls:group.children.length,
  triangles:actualTriangles,replacedTriangles:plan.covers.length*12,addedTriangles:actualTriangles-plan.covers.length*12,
  maxRecess:plan.maxRecess,outwardProtrusion:0,opaqueContinuousShell:true,collidersChanged:false,
  sources:['Poly Haven rocky_gravel (CC0-1.0)','Poly Haven worn_plaster_wall (CC0-1.0); procedural mortar'],
  budgets:{...STONE_COVER_LIMITS},drawCaveat:'Beauty draws only; shadow/reflection passes are measured by root.'};
 const markRay=new T.Raycaster(),wallIds=new Map(plan.covers.map((w,i)=>[w.id,i]));
 function projectHit({point,normal,wallId}){
  // Optional root-owned cosmetic hook. Never changes the authoritative shot,
  // damage or occlusion result. Project along the COLLIDER face normal so a
  // grazing shot's mark does not float over a recessed mortar seam.
  if(!wallIds.has(wallId)||!point?.isVector3||!normal?.isVector3||normal.lengthSq()<.5)return null;
  const axis=normal.clone().normalize();markRay.set(point.clone().addScaledVector(axis,.004),axis.clone().negate());markRay.far=.034;
  const hit=markRay.intersectObjects(group.children,false).find(h=>h.object.geometry.attributes.coverIndex.getX(h.face.a)===wallIds.get(wallId));
  if(!hit||hit.point.distanceTo(point)>.03)return null;
  return{point:hit.point.clone(),normal:hit.face.normal.clone().transformDirection(hit.object.matrixWorld),wallId,distance:hit.point.distanceTo(point),cosmeticOnly:true};
 }
 return{group,plan,info:()=>info,projectHit};
}
