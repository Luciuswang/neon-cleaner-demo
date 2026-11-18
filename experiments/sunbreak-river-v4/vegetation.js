import {vegetationAllowed,landscapeHeight,riverWidth,MAP,crossings} from './map-layout.js';

// Deterministic ecology plan is exported for CPU-only integration checks.
// Trees/woody understorey stay outside the playable rectangle: no hidden cover.
export function vegetationPlan(){
 let seed=925221;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const near=[[],[]],far=[[],[]],shrubs=[],low=[],medium=[],tall=[];
 const outside=(x,z,pad=0)=>x<MAP.minX-pad||x>MAP.maxX+pad||z<MAP.minZ-pad||z>MAP.maxZ+pad;
 const pathDistance=(x,z)=>Math.abs(Math.abs(x)-(10+.32*Math.sin(z*.19)));
 function allowed(x,z,margin=.4){
  if(!outside(x,z))return vegetationAllowed(x,z)&&pathDistance(x,z)>1.45+margin&&crossings.every(c=>Math.abs(z-c)>2+margin);
  return Math.abs(x)>riverWidth(z)+2.5&&outside(x,z,1)&&Math.abs(x)<63&&z>-61&&z<54;
 }
 const place=(x,z,s=1)=>({x,y:landscapeHeight(x,z)-.018,z,r:random()*Math.PI*2,s,stretch:.92+random()*.14,tone:random()});
 // Irregular groves, not a repeated circle. Near/far are spatial bands, not
 // camera LOD swaps; the source leaf dimensions are NEVER inflated by LOD.
 const groves=[[-43,-29],[-44,-8],[-43,17],[43,-28],[45,-7],[43,18],[-25,-45],[1,-48],[26,-45],[-24,39],[2,43],[26,39]];
 const trunks=[];
 for(let g=0;g<groves.length;g++)for(let i=0;i<5;i++){
  const angle=random()*6.283,radius=2+random()*6,x=groves[g][0]+Math.cos(angle)*radius,z=groves[g][1]+Math.sin(angle)*radius;
  if(!outside(x,z,6)||trunks.some(t=>Math.hypot(t.x-x,t.z-z)<3.7))continue;
  const species=(g+i)%2,p=place(x,z,.88+random()*.23);p.shadow=Math.abs(x)<45&&z>-40&&z<34;
  p.y-=.14;
  near[species].push(p);trunks.push(p);
 }
 for(let i=0;i<40;i++){
  const angle=random()*6.283,radius=63+random()*29,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius-4;
  if(trunks.some(t=>Math.hypot(t.x-x,t.z-z)<5))continue;
  const p=place(x,z,.84+random()*.3);p.y-=.22;far[i%2].push(p);trunks.push(p);
 }
 // Smaller woody growth closes the visible gap between roots and canopy, but
 // is never put inside the walkable rectangle without a collider contract.
 for(const [gx,gz]of groves)for(let i=0;i<2;i++){
  const x=gx+(random()-.5)*9,z=gz+(random()-.5)*9;
  if(outside(x,z,5)){const p=place(x,z,.85+random()*.35);p.y-=.06;shrubs.push(p)}
 }
 // Patches have dense cores, feathered edges and sparse linking growth. Each
 // individual placement rechecks the current map exclusion, including cabins.
 const patches=[];
 for(let i=0;i<180;i++){
  const x=random()*108-54,z=random()*102-55;
  if(!allowed(x,z,.6))continue;
  if(patches.some(p=>Math.hypot(p.x-x,p.z-z)<3.3))continue;
  patches.push({x,z,rx:2.5+random()*3.4,rz:1.4+random()*2.8});
 }
 // The playable banks need deliberate, visible roadside/wall-base growth as
 // well as forest-floor coverage. Thin grass only in the background is not a
 // substitute for foreground detail. Narrow centers follow the free strips.
 for(const side of [-1,1])for(const x0 of [6.5,12.6,23,29.7])for(const z0 of [-30,-17,-10,3,10,23]){
  const x=side*x0,z=z0+(random()-.5)*1.4;
  if(!allowed(x,z,.1))continue;
  patches.push({x,z,rx:x0<14?1.35:2.25,rz:2.6+random()*1.4,foreground:true});
 }
 for(const patch of patches)for(let i=0;i<(patch.foreground?430:140);i++){
  const a=random()*6.283,r=Math.sqrt(random()),x=patch.x+Math.cos(a)*patch.rx*r,z=patch.z+Math.sin(a)*patch.rz*r;
  if(!allowed(x,z,.25)||random()>(.98-.48*r*r))continue;
  const p=place(x,z,.74+random()*.55),edge=r>.77,choice=random();
  if(edge||choice<(patch.foreground?.24:.46))low.push(p);
  else if(choice<.93)medium.push(p);
  else if(pathDistance(x,z)>3.4&&crossings.every(c=>Math.abs(z-c)>4))tall.push(p);
 }
 // Root-adjacent and roadside linking tufts, never a continuous lawn/carpet.
 for(let i=0;i<1500;i++){
  const x=random()*100-50,z=random()*90-48;if(!allowed(x,z,.1))continue;
  if(random()<.6&&pathDistance(x,z)>3.5&&!outside(x,z))continue;
  low.push(place(x,z,.62+random()*.42));
 }
 // Bounded layout-only infill: low leafy tufts close bare gaps on the playable
 // banks and house margins. Appending here preserves every earlier placement,
 // including all trees, shadows and the medium/tall layer. A jittered 27cm
 // lattice gives dense bodies; coherent gaps prevent a uniform lawn read.
 const infill={added:0,banks:0,outerMargins:0,betweenHouses:0,nominalSpacing:.27,baselineLow:low.length};
 for(let gz=MAP.minZ+1.3;gz<MAP.maxZ-1.3;gz+=.27)for(let gx=MAP.minX+1.3;gx<MAP.maxX-1.3;gx+=.27){
  const x=gx+(random()-.5)*.29,z=gz+(random()-.5)*.29,ax=Math.abs(x);
  const bank=ax>=5.8&&ax<=8.2,outer=ax>=21.6&&ax<=30.7,between=ax>=12&&ax<21.6&&(Math.abs(z+13)<5.1||Math.abs(z-7)<5.1);
  if(!(bank||outer||between)||!allowed(x,z,.25))continue;
  const patchiness=.81+.12*Math.sin(x*.61+Math.sin(z*.29))+.10*Math.cos(z*.43-x*.18);
  if(random()>Math.min(.98,patchiness+(bank?.10:0)))continue;
  const p=place(x,z,.91+random()*.22);p.infill=true;low.push(p);infill.added++;
  if(bank)infill.banks++;else if(outer)infill.outerMargins++;else infill.betweenHouses++;
 }
 return{near,far,shrubs,low,medium,tall,patches,trunks,infill};
}

export async function buildVegetation(T,world){
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),time={value:0},plan=vegetationPlan(),meshes=[],counts={},batches=[];
 const names=['island_tree_01','island_tree_01-far','tree_small_02','tree_small_02-far','grass_medium_01','grass_medium_02','grass_bermuda_01'];
 const assets=await Promise.all(names.map(n=>loader.loadAsync('./river/assets/foliage-revision/'+n+'.glb')));
 const dummy=new T.Object3D(),color=new T.Color();
 function windMaterial(material,height,amplitude,label){
  material.onBeforeCompile=s=>{
   s.uniforms.uFoliageTime=time;
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uFoliageTime;');
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float foliagePhase=instanceMatrix[3].x*.27+instanceMatrix[3].z*.19;
    float foliageBend=pow(clamp(position.y/${height.toFixed(4)},0.,1.),2.);
    transformed.x+=sin(uFoliageTime*1.1+foliagePhase+position.y*.65)*${amplitude.toFixed(4)}*foliageBend;
    transformed.z+=sin(uFoliageTime*.83+foliagePhase)*${(amplitude*.46).toFixed(4)}*foliageBend;`);
  };
  material.customProgramCacheKey=()=>`foliage-revision-wind-${label}-${height}-${amplitude}`;
 }
 function instances(source,placements,height,label,{shadow=false,wind=.015,tree=false}={}){
  if(!placements.length)return;
  source.updateWorldMatrix(true,true);
  const box=new T.Box3().setFromObject(source),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),scale=height/size.y;
  // Four sectors let off-camera groves be culled, rather than submitting the
  // entire forest and all alpha-tested grass in a single giant instance batch.
  const sectors=[[],[],[],[]];placements.forEach(p=>sectors[(p.x>=0?1:0)+(p.z>=-4?2:0)].push(p));
  source.traverse(node=>{
   if(!node.isMesh)return;
   const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
   geometry.translate(-center.x,-box.min.y,-center.z);geometry.scale(scale,scale,scale);
   const mat=node.material.clone(),leaf=!tree||/leaves/.test(mat.name);
   mat.envMapIntensity=leaf?.7:.5;mat.roughness=Math.max(.74,mat.roughness);mat.metalness=0;
   // Official packed ARM: AO is RED, roughness GREEN. Keep leaf AO subtle;
   // stacking a dark sRGB tint and strong baked AO made every crown near black.
   if(mat.roughnessMap){mat.aoMap=mat.roughnessMap;mat.aoMapIntensity=leaf?.18:.65}
   mat.side=leaf?T.DoubleSide:T.FrontSide;mat.transparent=false;mat.depthWrite=true;mat.forceSinglePass=true;
   if(leaf){mat.alphaTest=.35;mat.color.multiply(new T.Color().setRGB(.96,1,.94));if(mat.normalScale)mat.normalScale.multiplyScalar(.4)}
   else mat.color.multiply(new T.Color(0x9e9b88));
   if(mat.map)mat.map.anisotropy=8;
   windMaterial(mat,height,wind,label);
   for(let sector=0;sector<4;sector++){
    const ps=sectors[sector];if(!ps.length)continue;
    const inst=new T.InstancedMesh(geometry,mat,ps.length);inst.name=`foliage-${label}-${sector}`;
    ps.forEach((p,i)=>{
     dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.set(p.s,p.s*p.stretch,p.s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);
     // Small coherent tone differences: no white/pastel trunks or random neon.
     const tone=leaf?.94+p.tone*.06:.83+p.tone*.17;color.setRGB(tone,tone,tone*(leaf?.97:.94));inst.setColorAt(i,color);
    });
    inst.castShadow=shadow;inst.receiveShadow=true;
    if(shadow){
     const common={map:mat.map,alphaTest:mat.alphaTest,side:mat.side};
     inst.customDepthMaterial=new T.MeshDepthMaterial({...common,depthPacking:T.RGBADepthPacking});
     inst.customDistanceMaterial=new T.MeshDistanceMaterial(common);
     windMaterial(inst.customDepthMaterial,height,wind,label);windMaterial(inst.customDistanceMaterial,height,wind,label);
    }
    inst.computeBoundingSphere();inst.boundingSphere.radius+=.12;world.add(inst);meshes.push(inst);
    batches.push({label,sector,instances:ps.length,triangles:(geometry.index?geometry.index.count:geometry.attributes.position.count)/3*ps.length,shadow});
   }
  });counts[label]=(counts[label]||0)+placements.length;
 }
 for(let species=0;species<2;species++){
  const close=plan.near[species];
  instances(assets[species*2].scene,close.filter(p=>p.shadow),species===0?11.6:10.4,`canopy-${species}-shadow`,{tree:true,shadow:true,wind:.025});
  instances(assets[species*2].scene,close.filter(p=>!p.shadow),species===0?11.6:10.4,`canopy-${species}`,{tree:true,wind:.025});
  instances(assets[species*2+1].scene,plan.far[species],species===0?14:12.8,`forest-${species}`,{tree:true,wind:.025});
 }
 instances(assets[3].scene,plan.shrubs,3.2,'woody-understorey',{tree:true,wind:.018});
 const grass01=assets[4].scene.children,grass02=assets[5].scene.children;
 const lowTypes=grass01.filter(n=>/(tiny_a|small_[ab])_/.test(n.name)),mediumTypes=grass02.filter(n=>/_[ac]$/.test(n.name)),tallTypes=grass01.filter(n=>/tall_[ab]_/.test(n.name));
 if(!lowTypes.length||!mediumTypes.length||!tallTypes.length)throw Error('Foliage variant names changed: refusing silent empty ground cover');
 const tiny=lowTypes.find(n=>/tiny_a_/.test(n.name)),short=lowTypes.filter(n=>/small_/.test(n.name));
 // Thin linking stems are a small accent, not half the entire low layer.
 instances(tiny,plan.low.filter((p,k)=>!p.infill&&k%10===0),.20,'low-grass',{wind:.013});
 short.forEach((n,i)=>instances(n,plan.low.filter((p,k)=>!p.infill&&k%10!==0&&k%2===i),.25,'low-grass',{wind:.013}));
 // Existing CC0 Bermuda has green, short leaf bodies, not seed heads. Keep
 // the exact infill layout, replace only its species. The flatter variants
 // stay lower so their width is ~0.32–0.35m, not giant enlarged grass blades.
 const baseTypes=assets[6].scene.children.filter(n=>/_(small_[abc]|medium_c)$/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name));
 if(baseTypes.length!==4)throw Error('Bermuda low-layer variants missing');
 const infill=plan.low.filter(p=>p.infill),baseHeight={small_a:.14,small_b:.18,small_c:.22,medium_c:.23};
 baseTypes.forEach((n,i)=>instances(n,infill.filter((_,k)=>k%4===i),baseHeight[n.name.replace('grass_bermuda_01_','')],'bermuda-base',{wind:.013}));
 mediumTypes.forEach((n,i)=>instances(n,plan.medium.filter((_,k)=>k%mediumTypes.length===i),.43,'dense-grass',{wind:.022}));
 tallTypes.forEach((n,i)=>instances(n,plan.tall.filter((_,k)=>k%tallTypes.length===i),.66,'seed-grass',{wind:.028}));
 const triangles=batches.reduce((n,b)=>n+b.triangles,0),shadowTriangles=batches.filter(b=>b.shadow).reduce((n,b)=>n+b.triangles,0);
 return{update(t){time.value=t},info(){return{revision:'layered-foliage-2026-11-18-bermuda-base',counts,drawCalls:meshes.length,triangles,shadowCalls:batches.filter(b=>b.shadow).length,shadowTriangles,patches:plan.patches.length,infill:{...plan.infill,asset:'grass_bermuda_01',variants:4,triangles:batches.filter(b=>b.label==='bermuda-base').reduce((n,b)=>n+b.triangles,0),drawCalls:batches.filter(b=>b.label==='bermuda-base').length},treeCollidersNeeded:0,source:'Poly Haven CC0; full near components, verified winding and source-clipped compound alpha; spatial instance culling',limits:'CPU geometry budgets only; main must validate frame times and visual quality'}}};
}
