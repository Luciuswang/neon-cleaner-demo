// mobile-ecology.js — bounded-poly mobile vegetation sharing the desktop canonical plan.
// NOTE: the desktop module path below is assumed; point it at the file exporting vegetationPlan().
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {landscapeHeight as layoutHeight,riverWidth as layoutWidth} from './map-layout.js';
import * as desktop from './vegetation.js';

const FOLIAGE='./river/assets/foliage-revision/',WILD='./river/assets/wild-grass/',LOOK='./river/assets/mobile-look/';
const NEAR_H=[11.6,10.4],FAR_H=[14,12.8],SHRUB_H=3.2;      // identical to desktop species heights
const TREE_TRI_BUDGET=300000,MAX_3D_PER_SPECIES=10,MAX_3D_SHRUBS=8,GRASS_TRI_BUDGET=240000;
// Desktop variant index -> one of the two wild grass GLBs that mobile loads (true heights retained).
const GRASS_SOURCE=[0,0,0,0,0,0,1,1],GRASS_NODES=['wild_leafy_a','wild_upright_a'];

export async function buildMobileEcology({T,world,landscapeHeight:lhArg=layoutHeight,riverWidth:rwArg=layoutWidth}){
 const plan=desktop.vegetationPlan();
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),texLoader=new T.TextureLoader();
 const [tree0,tree1,grassA,grassB,bb0,bb1]=await Promise.all([
  loader.loadAsync(FOLIAGE+'island_tree_01-far.glb'),loader.loadAsync(FOLIAGE+'tree_small_02-far.glb'),
  loader.loadAsync(WILD+'wild_leafy_a.glb'),loader.loadAsync(WILD+'wild_upright_a.glb'),
  texLoader.loadAsync(LOOK+'tree-0.png'),texLoader.loadAsync(LOOK+'tree-1.png')]);
 const meshes=[],batches=[],textures=new Set(),dummy=new T.Object3D(),color=new T.Color();
 const stats={trees3D:0,shrubs3D:0,treeBillboards:0,infillBillboards:0,horizonBillboards:0,grassRoots:0,grassKeptFraction:1};

 // ---------- terrain helpers (real functions when available, sampled plan heights otherwise)
 const samples=[...plan.near.flat(),...plan.far.flat(),...plan.shrubs,...plan.low.filter((_,i)=>i%24===0)];
 const sampledHeight=(x,z)=>{let best=1e9,y=0;for(const s of samples){const d=(s.x-x)**2+(s.z-z)**2;if(d<best){best=d;y=s.y}}return y+.018};
 const landscapeHeight=lhArg||desktop.landscapeHeight||world.userData?.landscapeHeight||sampledHeight;
 const riverWidth=rwArg||desktop.riverWidth||world.userData?.riverWidth||null;
 const clearOfRiver=(x,z,pad)=>!riverWidth||Math.abs(x)>riverWidth(z)+pad;
 let seed=73129;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const hash=n=>(Math.imul((n|0)+1,2654435761)>>>0)/4294967296;
 const sectorOf=p=>(p.x>=0?1:0)+(p.z>=-4?2:0);

 // ---------- real GLB sources baked to unit height (base at y=0, centred in xz)
 function bake(source,leafTest){
  source.updateWorldMatrix(true,true);
  const box=new T.Box3().setFromObject(source),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),k=1/size.y,parts=[];
  source.traverse(node=>{
   if(!node.isMesh)return;
   const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
   geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(k,k,k);
   const src=node.material,leaf=leafTest(src);
   // Only the original albedo+alpha map is kept: one texture per material on iOS.
   const material=new T.MeshLambertMaterial({map:src.map||null,color:src.color?src.color.clone():new T.Color(1,1,1),
    alphaTest:leaf?.35:0,side:leaf?T.DoubleSide:T.FrontSide});
   material.name=src.name;
   if(leaf)material.color.multiply(new T.Color().setRGB(.96,1,.94));else material.color.multiply(new T.Color(0x9e9b88));
   if(material.map){material.map.anisotropy=4;textures.add(material.map)}
   parts.push({geometry,material,leaf,triangles:(geometry.index?geometry.index.count:geometry.attributes.position.count)/3});
  });
  return{parts,triangles:parts.reduce((a,p)=>a+p.triangles,0),lateral:Math.max(size.x,size.z)/size.y};
 }
 function instance3D(baked,items,label,sectored){
  if(!items.length)return;
  const groups=sectored?[[],[],[],[]]:[items];if(sectored)items.forEach(it=>groups[sectorOf(it.p)].push(it));
  for(const part of baked.parts)groups.forEach((group,sector)=>{
   if(!group.length)return;
   const inst=new T.InstancedMesh(part.geometry,part.material,group.length);inst.name=`mobile-${label}-${sector}`;
   group.forEach(({p,h},i)=>{
    dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.set(h*p.s,h*p.s*p.stretch,h*p.s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
    const tone=part.leaf?.94+p.tone*.06:.83+p.tone*.17;color.setRGB(tone,tone,tone*(part.leaf?.97:.94));inst.setColorAt(i,color);
   });
   inst.castShadow=false;inst.receiveShadow=false;inst.raycast=()=>{};
   inst.instanceMatrix.needsUpdate=true;if(inst.instanceColor)inst.instanceColor.needsUpdate=true;
   inst.computeBoundingSphere();inst.boundingSphere.radius+=.12;world.add(inst);meshes.push(inst);
   batches.push({label,sector,kind:'mesh',instances:group.length,triangles:part.triangles*group.length});
  });
 }
 const isLeaf=m=>/leaves|leaf/i.test(m.name||'')||!!m.alphaTest||m.alphaMode==='MASK'||m.transparent;
 const treeBaked=[bake(tree0.scene,isLeaf),bake(tree1.scene,isLeaf)];

 // ---------- trees: nearest groves get real 3D canopies, the rest go to baked billboards
 const dist=p=>p.x*p.x+p.z*p.z;                              // play area centre = opening view focus
 const billboards=[[],[]];                                   // per texture: {x,y,z,w,h,flip,yaw,tone,haze}
 const pushBillboard=(tex,p,h,haze=0,toneScale=1)=>billboards[tex].push({x:p.x,y:p.y-.05,z:p.z,
  h:h*p.s*p.stretch*treeBaked[tex].square,w:h*p.s*treeBaked[tex].square,
  flip:hash(Math.round(p.x*31+p.z*17))>.5?1:-1,yaw:(hash(Math.round(p.x*13-p.z*29))-.5)*.5,tone:(.9+p.tone*.1)*toneScale,haze});
 // Square ortho bake: the quad side equals the larger of tree height and lateral extent, trunk on the bottom edge.
 treeBaked.forEach(b=>{b.square=Math.max(1,b.lateral)});
 const items3D=[[],[]];
 for(let species=0;species<2;species++){
  const near=[...plan.near[species]].sort((a,b)=>dist(a)-dist(b));
  const n3D=Math.min(MAX_3D_PER_SPECIES,near.length,Math.floor(TREE_TRI_BUDGET*.42/treeBaked[species].triangles));
  near.forEach((p,i)=>{if(i<n3D)items3D[species].push({p,h:NEAR_H[species]});else{pushBillboard(species,p,NEAR_H[species]);stats.treeBillboards++}});
  stats.trees3D+=n3D;
  for(const p of plan.far[species]){pushBillboard(species,p,FAR_H[species]);stats.treeBillboards++}
 }
 const shrubs=[...plan.shrubs].sort((a,b)=>dist(a)-dist(b));
 const nShrub3D=Math.min(MAX_3D_SHRUBS,shrubs.length,Math.floor(TREE_TRI_BUDGET*.16/treeBaked[1].triangles));
 shrubs.forEach((p,i)=>{if(i<nShrub3D)items3D[1].push({p,h:SHRUB_H});else{pushBillboard(p.tone>.62?0:1,p,SHRUB_H,0,.94);stats.treeBillboards++}});
 stats.shrubs3D=nShrub3D;
 instance3D(treeBaked[0],items3D[0],'canopy-3d-0',false);
 instance3D(treeBaked[1],items3D[1],'canopy-3d-1',false);
 // ---------- infill: densify the treeline and understory strictly outward from the play area
 const ghost=(x,z,s)=>({x,z,y:landscapeHeight(x,z)-.018,s,stretch:.9+random()*.2,tone:random(),r:0});
 for(let species=0;species<2;species++)for(const p of plan.far[species]){
  const len=Math.hypot(p.x,p.z)||1,ox=p.x/len,oz=p.z/len;
  if(random()<.72){                                           // back-row tree, irregular spacing
   const d=2.2+random()*3.2,j=(random()-.5)*3.4,x=p.x+ox*d-oz*j,z=p.z+oz*d+ox*j;
   if(clearOfRiver(x,z,4)){pushBillboard(random()<.8?species:1-species,ghost(x,z,p.s*(.76+random()*.34)),FAR_H[species],.04,.9);stats.infillBillboards++}
  }
  const understory=random()<.55?2:1;                          // uneven woody understory, mixed sizes
  for(let k=0;k<understory;k++){
   const d=.8+random()*3.6,j=(random()-.5)*5,x=p.x+ox*d-oz*j,z=p.z+oz*d+ox*j;
   if(random()<.7&&clearOfRiver(x,z,3.5)){pushBillboard(random()<.35?0:1,ghost(x,z,.55+random()*.95),SHRUB_H,0,.86+random()*.1);stats.infillBillboards++}
  }
 }
 // ---------- far horizon: three haze-tinted layers of the same billboards on landscapeHeight
 const RADII=[104,124,148],CLUSTERS=[72,62,52];
 for(let layer=0;layer<3;layer++)for(let c=0;c<CLUSTERS[layer];c++){
  const a=(c+random()*.9)/CLUSTERS[layer]*Math.PI*2,r=RADII[layer]+(random()-.5)*12,cx=Math.cos(a)*r*1.08,cz=Math.sin(a)*r-4;
  const members=1+Math.floor(random()*3),tex=random()<.6?0:1;
  for(let m=0;m<members;m++){
   const x=cx+(random()-.5)*9,z=cz+(random()-.5)*9;
   if(!clearOfRiver(x,z,6))continue;                          // the river corridor stays open to the horizon
   const t=m===0?tex:(random()<.75?tex:1-tex);
   pushBillboard(t,ghost(x,z,(.85+random()*.4)*(1+layer*.16)),FAR_H[t],.26+layer*.2+random()*.06,.9);stats.horizonBillboards++;
  }
 }
 // ---------- billboard rendering: y-locked camera-facing quads, no crossed planes
 let scene=world;while(scene.parent)scene=scene.parent;
 const hazeColor=(scene.fog&&scene.fog.color?scene.fog.color.clone():new T.Color(0xb9c9cf)).lerp(new T.Color(0x9aa08c),.65);
 const quad=new T.PlaneGeometry(1,1);quad.translate(0,.5,0);
 [bb0,bb1].forEach((tex,t)=>{
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;tex.needsUpdate=true;textures.add(tex);
  const material=new T.MeshBasicMaterial({map:tex,alphaTest:.4,side:T.DoubleSide,transparent:false,depthWrite:true});
  material.name='mobile-tree-billboard-'+t;
  material.onBeforeCompile=shader=>{
   shader.uniforms.uHaze={value:hazeColor};
   shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nattribute vec3 aVar;\nvarying float vHaze;')
    .replace('#include <project_vertex>',`
     vHaze=aVar.y;
     vec3 bbO=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
     vec2 bbS=vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
     vec3 bbD=cameraPosition-bbO;bbD.y=0.;bbD/=max(length(bbD),1e-4);
     float bbC=cos(aVar.z),bbN=sin(aVar.z);
     bbD=vec3(bbD.x*bbC-bbD.z*bbN,0.,bbD.x*bbN+bbD.z*bbC);
     vec3 bbR=vec3(bbD.z,0.,-bbD.x);
     vec3 bbW=bbO+bbR*(transformed.x*bbS.x*aVar.x)+vec3(0.,transformed.y*bbS.y,0.);
     vec4 mvPosition=viewMatrix*vec4(bbW,1.);
     gl_Position=projectionMatrix*mvPosition;`);
   shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\nuniform vec3 uHaze;\nvarying float vHaze;')
    .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=vec3(1.04,.98,.86);diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),uHaze,.4),vHaze*.32);');
  };
  const sectors=[[],[],[],[]];billboards[t].forEach(b=>sectors[sectorOf(b)].push(b));
  sectors.forEach((group,sector)=>{
   if(!group.length)return;
   const geometry=quad.clone(),vars=new Float32Array(group.length*3),inst=new T.InstancedMesh(geometry,material,group.length);
   const box=new T.Box3();let reach=0;
   group.forEach((b,i)=>{
    dummy.position.set(b.x,b.y,b.z);dummy.rotation.set(0,0,0);dummy.scale.set(b.w,b.h,1);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
    color.setRGB(b.tone,b.tone,b.tone*.97);inst.setColorAt(i,color);
    vars[i*3]=b.flip;vars[i*3+1]=b.haze;vars[i*3+2]=b.yaw;
    box.expandByPoint(dummy.position);reach=Math.max(reach,b.h,b.w);
   });
   geometry.setAttribute('aVar',new T.InstancedBufferAttribute(vars,3));
   inst.instanceMatrix.needsUpdate=true;inst.instanceColor.needsUpdate=true;
   inst.boundingSphere=box.getBoundingSphere(new T.Sphere());inst.boundingSphere.radius+=reach;   // quads rotate on GPU
   inst.name=`mobile-tree-billboard-${t}-${sector}`;inst.castShadow=false;inst.receiveShadow=false;inst.raycast=()=>{};
   world.add(inst);meshes.push(inst);
   batches.push({label:'tree-billboard-'+t,sector,kind:'billboard',instances:group.length,triangles:2*group.length});
  });
 });
 // ---------- grass: desktop clump positions, original alpha maps, true .12–.55 m heights
 const GRASS_HEIGHT=desktop.GRASS_VARIANTS?desktop.GRASS_VARIANTS.map(v=>v.height):[.14,.18,.22,.23,.34,.22,.48,.48];
 const grassBaked=[grassA,grassB].map((gltf,i)=>bake(gltf.scene.getObjectByName(GRASS_NODES[i])||gltf.scene,()=>true));
 const roots=[...plan.low,...plan.medium,...plan.tall];
 const grassTotal=roots.reduce((a,p)=>a+grassBaked[GRASS_SOURCE[p.variant]??0].triangles,0);
 const keep=Math.min(1,GRASS_TRI_BUDGET/Math.max(1,grassTotal));
 const grassItems=[[],[]];
 roots.forEach((p,i)=>{
  if(keep<1&&hash(p.clumpId??i)>keep)return;                  // thin whole clumps, never single blades out of a cluster
  grassItems[GRASS_SOURCE[p.variant]??0].push({p,h:GRASS_HEIGHT[p.variant]??.3});
 });
 stats.grassRoots=grassItems[0].length+grassItems[1].length;stats.grassKeptFraction=roots.length?stats.grassRoots/roots.length:1;
 instance3D(grassBaked[0],grassItems[0],'grass-leafy',true);
 instance3D(grassBaked[1],grassItems[1],'grass-upright',true);

 // ---------- actual measurement
 const sum=kind=>batches.filter(b=>!kind||b.kind===kind).reduce((a,b)=>a+b.triangles,0);
 const measured=Object.freeze({
  drawCalls:meshes.length,triangles:Math.round(sum()),meshTriangles:Math.round(sum('mesh')),billboardTriangles:sum('billboard'),
  textures:textures.size,billboardTextures:2,
  trees3D:stats.trees3D,shrubs3D:stats.shrubs3D,treeBillboards:stats.treeBillboards,infillBillboards:stats.infillBillboards,
  horizonBillboards:stats.horizonBillboards,grassRoots:stats.grassRoots,grassKeptFraction:+stats.grassKeptFraction.toFixed(3),
  planTrees:plan.near.flat().length+plan.far.flat().length,planShrubs:plan.shrubs.length,planGrassRoots:roots.length,
  terrainSource:landscapeHeight===sampledHeight?'sampled-plan-heights':'landscapeHeight',riverGuard:!!riverWidth,
  budgets:{tree:TREE_TRI_BUDGET,grass:GRASS_TRI_BUDGET}
 });
 return{info(){return{...measured,batches:batches.map(b=>({...b}))}}};
}
