import {vegetationAllowed,landscapeHeight,riverWidth,MAP,crossings} from './map-layout.js';

const outside=(x,z,pad=0)=>x<MAP.minX-pad||x>MAP.maxX+pad||z<MAP.minZ-pad||z>MAP.maxZ+pad;
const pathDistance=(x,z)=>Math.abs(Math.abs(x)-(10+.32*Math.sin(z*.19)));
// The existing combat exclusions remain authoritative for every grass root.
export function grassAllowed(x,z,margin=.4){
 if(!outside(x,z))return vegetationAllowed(x,z)&&pathDistance(x,z)>1.45+margin&&crossings.every(c=>Math.abs(z-c)>2+margin);
 return Math.abs(x)>riverWidth(z)+2.5&&outside(x,z,1)&&Math.abs(x)<91&&z>-88&&z<80;
}
export const GRASS_VARIANTS=Object.freeze([
 {asset:'grass_bermuda_01',node:'grass_bermuda_01_small_a',height:.14,range:[.12,.17],radiusRatio:1.32,label:'bermuda-base',layer:'low'},
 {asset:'grass_bermuda_01',node:'grass_bermuda_01_small_b',height:.18,range:[.15,.22],radiusRatio:.99,label:'bermuda-base',layer:'low'},
 {asset:'grass_bermuda_01',node:'grass_bermuda_01_small_c',height:.22,range:[.18,.27],radiusRatio:.62,label:'bermuda-base',layer:'low'},
 {asset:'grass_bermuda_01',node:'grass_bermuda_01_medium_c',height:.23,range:[.20,.29],radiusRatio:.81,label:'bermuda-base',layer:'low'},
 {asset:'grass_medium_02',node:'grass_medium_02_a',height:.34,range:[.27,.41],radiusRatio:.55,label:'dense-grass',layer:'medium'},
 {asset:'grass_medium_02',node:'grass_medium_02_c',height:.34,range:[.28,.43],radiusRatio:.78,label:'dense-grass',layer:'medium'},
 {asset:'grass_medium_01',node:'grass_medium_01_tall_a_LOD0',height:.48,range:[.43,.55],radiusRatio:.36,label:'seed-grass',layer:'tall'},
 {asset:'grass_medium_01',node:'grass_medium_01_tall_b_LOD0',height:.48,range:[.42,.54],radiusRatio:.35,label:'seed-grass',layer:'tall'}
].map(v=>Object.freeze({...v,range:Object.freeze(v.range)})));
export function grassBatches(plan){
 const grass=[...plan.low,...plan.medium,...plan.tall];
 return GRASS_VARIANTS.map((spec,variant)=>({...spec,variant,placements:grass.filter(p=>p.variant===variant)}));
}
export function inGrassGap(x,z,gaps,padding=0){
 return gaps.some(g=>Math.sign(x)===g.side&&Math.abs(z-g.z)<g.halfLength+padding&&Math.abs(x)<riverWidth(z)+g.bankDepth+padding);
}

// Deterministic ecology plan is exported for CPU-only integration checks.
// Trees/woody understorey stay outside the playable rectangle: no hidden cover.
export function vegetationPlan(){
 let seed=925221;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const near=[[],[]],far=[[],[]],shrubs=[],low=[],medium=[],tall=[];
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
 // Everything above this point retains the exact original tree RNG sequence.
 // Grass uses continuous candidates, compact lobes and explicit empty bank
 // intervals. No foreground anchor rows, lattice infill or uniform linking.
 const patches=[],clumps=[],gaps=[];
 for(const side of [-1,1])for(let attempt=0;attempt<50&&gaps.filter(g=>g.side===side).length<3;attempt++){
  const z=MAP.minZ+3+random()*(MAP.maxZ-MAP.minZ-6),halfLength=.8+random()*1.1;
  if(crossings.some(c=>Math.abs(c-z)<3+halfLength)||gaps.some(g=>g.side===side&&Math.abs(g.z-z)<g.halfLength+halfLength+3))continue;
  gaps.push({side,z,halfLength,bankDepth:5.3});
 }
 const occupied=new Map(),cell=.08;
 function rootFree(x,z){
  const ix=Math.floor(x/cell),iz=Math.floor(z/cell);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)for(const q of occupied.get(`${ix+dx},${iz+dz}`)||[])if(Math.hypot(x-q.x,z-q.z)<.075)return false;
  return true;
 }
 function reserve(p){const k=`${Math.floor(p.x/cell)},${Math.floor(p.z/cell)}`;if(!occupied.has(k))occupied.set(k,[]);occupied.get(k).push(p)}
 function footprintAllowed(x,z,r){
  if(!grassAllowed(x,z,.25)||inGrassGap(x,z,gaps,r))return false;
  for(let i=0;i<32;i++){const a=i*Math.PI/16;if(!grassAllowed(x+Math.cos(a)*r*1.005,z+Math.sin(a)*r*1.005,.25))return false}
  return true;
 }
 for(let attempt=0;attempt<420;attempt++){
  // Prioritize a continuous near-bank envelope identified in the real camera
  // review. This is random sampling in an area, NOT a list of foreground rows.
  const featured=attempt<24,region=random(),bank=featured||region<.55,foreground=featured||region<.82,side=random()<.5?-1:1;
  const z=featured?8+random()*4:foreground?MAP.minZ+2+random()*(MAP.maxZ-MAP.minZ-4):random()*158-83;
  const x=featured?side*(5.6+random()*1.6):bank?side*(riverWidth(z)+2.1+random()*1.35):foreground?MAP.minX+2+random()*(MAP.maxX-MAP.minX-4):random()*168-84;
  if(!grassAllowed(x,z,.5)||inGrassGap(x,z,gaps,.4))continue;
  const reach=featured?.60+random()*.65:.75+Math.pow(random(),1.7)*2.5;
  if(patches.some(p=>Math.hypot(p.x-x,p.z-z)<p.reach*.65+reach*.65+.6))continue;
  const derivative=-.136*Math.sin(z*.17)-.1645*Math.sin(z*.47);
  const angle=bank?Math.atan2(1,side*derivative)+(random()-.5)*.7:random()*Math.PI*2;
  const patch={id:`grass-patch-${patches.length}`,x,z,reach,angle,bank,foreground,featured,community:random()<(featured?1:foreground?.84:.45)?'rush':'meadow',baseVariant:Math.floor(random()*4),tone:.25+random()*.55,lobes:[]};
  const lobeCount=2+Math.floor(random()*4);
  for(let l=0;l<lobeCount;l++){
   const a=random()*Math.PI*2,r=l===0?0:reach*(.25+random()*.6),across=(bank?.38:.8);
   const u=Math.cos(a)*r,v=Math.sin(a)*r*across,cx=x+u*Math.cos(angle)-v*Math.sin(angle),cz=z+u*Math.sin(angle)+v*Math.cos(angle);
   if(!grassAllowed(cx,cz,.25)||inGrassGap(cx,cz,gaps,.4))continue;
   const sizeClass=random(),radius=sizeClass<.28?(foreground?.40:.28)+random()*.18:sizeClass<.79?(foreground?.58:.48)+random()*.27:.8+random()*.33;
   if(clumps.some(c=>Math.hypot(cx-c.x,cz-c.z)<Math.min(radius,c.rx)*.8))continue;
   const c={id:`grass-clump-${clumps.length}`,patchId:patch.id,x:cx,z:cz,angle:angle+(random()-.5)*1.1,rx:radius,rz:radius*(.50+random()*.40),
    sizeClass:sizeClass<.28?'small':sizeClass<.79?'medium':'large',baseVariant:patch.baseVariant,mediumVariant:patch.baseVariant%2+4,tallVariant:patch.baseVariant%2+6,
    seedHeads:random()<.28&&pathDistance(cx,cz)>3.7&&crossings.every(z0=>Math.abs(cz-z0)>4.5),community:patch.community,featured,coreRadius:foreground?.64:.52,vigor:(foreground?.55:.25)+random()*(foreground?.40:.7),phase:random()*Math.PI*2};
   const placements=[],area=Math.PI*c.rx*c.rz,attempts=Math.ceil(area*(foreground?260:150));
   for(let i=0;i<attempts;i++){
    const theta=random()*Math.PI*2,core=random()<(foreground?.88:.78),rho=core?Math.sqrt(random())*c.coreRadius:c.coreRadius+.06+Math.sqrt(random())*(1.14-c.coreRadius);
    // Noncircular lobes and a denser root core, with a few feathered satellites.
    const edge=1+.16*Math.sin(theta*3+c.phase)+.09*Math.cos(theta*5-c.phase),u=Math.cos(theta)*c.rx*rho*edge,v=Math.sin(theta)*c.rz*rho*edge;
    const px=c.x+u*Math.cos(c.angle)-v*Math.sin(c.angle),pz=c.z+u*Math.sin(c.angle)+v*Math.cos(c.angle);
    if(!rootFree(px,pz))continue;
    const variant=c.seedHeads&&rho<.24&&i%5===0?c.tallVariant:c.community==='rush'&&core?c.mediumVariant:c.baseVariant;
    const spec=GRASS_VARIANTS[variant],height=spec.range[0]+(spec.range[1]-spec.range[0])*(c.vigor*.55+random()*.30+(core?.15:0));
    const stretch=.94+random()*.12,s=height/(spec.height*stretch),radius=spec.radiusRatio*spec.height*s+.03;
    if(!footprintAllowed(px,pz,radius))continue;
    const p=place(px,pz,s);p.stretch=stretch;p.tone=Math.min(1,Math.max(0,patch.tone+(random()-.5)*.09));
    Object.assign(p,{variant,height,clearanceRadius:radius,clumpId:c.id,patchId:patch.id,zone:core?'core':'satellite',rho});
    placements.push(p);reserve(p);
   }
   if(!placements.length)continue;
   c.rootCount=placements.length;clumps.push(c);patch.lobes.push(c.id);
   for(const p of placements)({low,medium,tall}[GRASS_VARIANTS[p.variant].layer]).push(p);
  }
  if(patch.lobes.length)patches.push(patch);
 }
 return{near,far,shrubs,low,medium,tall,patches,trunks,clumps,gaps};
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
   mat.envMapIntensity=leaf?.62:.5;mat.roughness=Math.max(.84,mat.roughness);mat.metalness=0;
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
 // Variant identity is assigned per ecological clump, not interleaved modulo
 // placement index. Layers retain distinct real-world heights of .12–.55m.
 for(const batch of grassBatches(plan)){
  const source=assets[names.indexOf(batch.asset)].scene.getObjectByName(batch.node);
  if(!source)throw Error(`Foliage variant missing: ${batch.node}`);
  instances(source,batch.placements,batch.height,batch.label,{wind:batch.layer==='low'?.013:batch.layer==='medium'?.022:.028});
 }
 const triangles=batches.reduce((n,b)=>n+b.triangles,0),shadowTriangles=batches.filter(b=>b.shadow).reduce((n,b)=>n+b.triangles,0);
 return{update(t){time.value=t},info(){return{revision:'organic-clumps-2026-11-18',counts,drawCalls:meshes.length,triangles,shadowCalls:batches.filter(b=>b.shadow).length,shadowTriangles,patches:plan.patches.length,clumps:plan.clumps.length,bareIntervals:plan.gaps.map(g=>({...g})),infill:{added:0,removed:true},treeCollidersNeeded:0,source:'Poly Haven CC0; original tree transforms; compact species-coherent grass cores and irregular satellites; spatial instance culling',limits:'CPU geometry budgets only; main must validate frame times and visual quality'}}};
}
