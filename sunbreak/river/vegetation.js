import {vegetationAllowed,landscapeHeight,riverWidth,MAP,crossings} from './map-layout.js';
import {buildEnvironmentPolish} from './environment-polish.js';

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
 {asset:'wild_leafy_a',node:'wild_leafy_a',height:.34,range:[.18,.41],radiusRatio:.55,label:'wild-leafy-a',layer:'medium'},
 {asset:'wild_leafy_b',node:'wild_leafy_b',height:.22,range:[.12,.25],radiusRatio:1.35,label:'wild-leafy-b',layer:'medium'},
 {asset:'wild_upright_a',node:'wild_upright_a',height:.48,range:[.43,.55],radiusRatio:.36,label:'wild-upright-a',layer:'tall'},
 {asset:'wild_upright_b',node:'wild_upright_b',height:.48,range:[.42,.54],radiusRatio:.35,label:'wild-upright-b',layer:'tall'}
].map(v=>Object.freeze({...v,range:Object.freeze(v.range)})));
export const meadowSuperseded=(x,z)=>!outside(x,z)&&Math.abs(x)>riverWidth(z)+1.5;
export function grassBatches(plan){
 const grass=[...plan.low,...plan.medium,...plan.tall].filter(p=>!((p.variant===4||p.variant===5)&&meadowSuperseded(p.x,p.z)));
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
    // Preserve the already-reviewed candidate layout/RNG. The bounded posture
    // pass below only contracts these footprints; it never adds grass roots.
    const spec=variant===4?{...GRASS_VARIANTS[4],height:.34,range:[.27,.41],radiusRatio:.55}:variant===5?{...GRASS_VARIANTS[5],height:.34,range:[.28,.43],radiusRatio:.78}:GRASS_VARIANTS[variant],height=spec.range[0]+(spec.range[1]-spec.range[0])*(c.vigor*.55+random()*.30+(core?.15:0));
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
 // Smooth local fields make coherent low/outward/upright pockets rather than
 // per-root confetti. Feather the edge using a subset of existing roots only.
 const originals=[...low,...medium,...tall],clumpMap=new Map(clumps.map(c=>[c.id,c]));low.length=medium.length=tall.length=0;
 for(const p of originals){
  const c=clumpMap.get(p.clumpId),dx=p.x-c.x,dz=p.z-c.z,u=dx*Math.cos(c.angle)+dz*Math.sin(c.angle),v=-dx*Math.sin(c.angle)+dz*Math.cos(c.angle),
   field=Math.sin(u*5.1+c.phase)+.62*Math.cos(v*4.3-c.phase),heightWave=.5+.5*Math.sin(u*7.3+v*4.1+c.phase),oldRadius=p.clearanceRadius;
  if(p.zone==='satellite'&&p.rho>.87&&field<.15)continue;
  if(p.variant===4||p.variant===5)p.variant=field<-.38?c.baseVariant:field<.48?5:4;
  const spec=GRASS_VARIANTS[p.variant],vigor=p.variant===4?.12+.83*heightWave:p.variant===5?.15+.7*heightWave:p.zone==='satellite'?.12+.40*heightWave:.2+.45*heightWave;
  const desired=p.variant>=6?p.height:spec.range[0]+(spec.range[1]-spec.range[0])*vigor;
  p.height=Math.min(desired,(oldRadius-.03)/spec.radiusRatio*p.stretch);
  // A very wide low posture cannot fit every narrow old footprint: retain a
  // short upright tuft there, rather than expanding into a route or bare gap.
  if(p.height<spec.range[0]){p.variant=4;const a=GRASS_VARIANTS[4];p.height=Math.max(a.range[0],Math.min(.22,(oldRadius-.03)/a.radiusRatio*p.stretch))}
  const finalSpec=GRASS_VARIANTS[p.variant];p.s=p.height/(finalSpec.height*p.stretch);p.clearanceRadius=finalSpec.radiusRatio*finalSpec.height*p.s+.03;p.previousClearanceRadius=oldRadius;
  ({low,medium,tall}[finalSpec.layer]).push(p);
 }
 const surviving=new Map();for(const p of [...low,...medium,...tall])surviving.set(p.clumpId,(surviving.get(p.clumpId)||0)+1);
 for(const c of clumps)c.rootCount=surviving.get(c.id)||0;
 return{near,far,shrubs,low,medium,tall,patches,trunks,clumps,gaps};
}

export async function buildVegetation(T,world,polishOptions){
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),time={value:0},plan=vegetationPlan(),meshes=[],counts={},batches=[];
 const names=['island_tree_01','island_tree_01-far','tree_small_02','tree_small_02-far','grass_bermuda_01','wild_leafy_a','wild_leafy_b','wild_upright_a','wild_upright_b'];
 const assets=await Promise.all(names.map(n=>loader.loadAsync('./river/assets/'+(n.startsWith('wild_')?'wild-grass/':'foliage-revision/')+n+'.glb')));
 const dummy=new T.Object3D(),color=new T.Color();
 function windMaterial(material,height,amplitude,label,rootShade=false,crown=!!material.userData?.crownLight){
  material.onBeforeCompile=s=>{
   s.uniforms.uFoliageTime=time;
   s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uFoliageTime;');
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float foliagePhase=instanceMatrix[3].x*.27+instanceMatrix[3].z*.19;
    float foliageBend=pow(clamp(position.y/${height.toFixed(4)},0.,1.),2.);
    transformed.x+=sin(uFoliageTime*1.1+foliagePhase+position.y*.65)*${amplitude.toFixed(4)}*foliageBend;
    transformed.z+=sin(uFoliageTime*.83+foliagePhase)*${(amplitude*.46).toFixed(4)}*foliageBend;`);
   if(crown){
    // Height-graded crown light: warm sunlit upper leaves, cool shaded undersides. Multiplies the existing map; no flat pigment.
    s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
varying float vCrownLight;`).replace('#include <begin_vertex>',`#include <begin_vertex>
vCrownLight=clamp(position.y/${height.toFixed(4)},0.,1.);`);
    s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying float vCrownLight;`).replace('#include <color_fragment>',`#include <color_fragment>
diffuseColor.rgb*=mix(vec3(.62,.68,.74),vec3(1.12,1.08,.93),smoothstep(.36,.95,vCrownLight));`);
   }
   if(rootShade){
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying float vGrassRootHeight;');
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGrassRootHeight=position.y*length(instanceMatrix[1].xyz);');
    s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vGrassRootHeight;');
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.55,1.,smoothstep(.012,.13,vGrassRootHeight));');
   }
  };
  material.customProgramCacheKey=()=>`foliage-revision-wind-${label}-${height}-${amplitude}-root${rootShade}-crown${crown}`;
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
   mat.envMapIntensity=tree?(leaf?.62:.5):.46;mat.roughness=Math.max(.84,mat.roughness);mat.metalness=0;
   // Official packed ARM: AO is RED, roughness GREEN. Keep leaf AO subtle;
   // stacking a dark sRGB tint and strong baked AO made every crown near black.
   if(mat.roughnessMap){mat.aoMap=mat.roughnessMap;mat.aoMapIntensity=leaf?.18:.65}
   mat.side=leaf?T.DoubleSide:T.FrontSide;mat.transparent=false;mat.depthWrite=true;mat.forceSinglePass=true;
   if(leaf){mat.alphaTest=.35;mat.color.multiply(new T.Color().setRGB(.96,1,.94));if(mat.normalScale)mat.normalScale.multiplyScalar(.4)}
   else mat.color.multiply(new T.Color(0x9e9b88));
   if(mat.map)mat.map.anisotropy=8;
   mat.userData.crownLight=tree&&leaf;windMaterial(mat,height,wind,label,!tree);
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
 // Static merged ribbon meadow: one draw call, own seeded RNG (the plan RNG is untouched),
 // decorative only (raycast no-op, no collider), every blade capped below .48m.
 const ribbon=(()=>{
  let s=71933;const rnd=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
  const MAX_BLADES=6000,MAX_H=.46,MAX_DRIFTS=16,pos=[],col=[],nor=[],idx=[],drifts=[];let blades=0,flecks=0,rejected=0,maxH=0;
  const ok=(x,z)=>{if(meadowSuperseded(x,z)||!grassAllowed(x,z,.6)||inGrassGap(x,z,plan.gaps,.5))return false;for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;if(!grassAllowed(x+Math.cos(a)*.35,z+Math.sin(a)*.35,.6))return false}return true};
  // The low-frequency field keeps broad areas bare: drifts never fill every gap.
  const field=(x,z)=>Math.sin(x*.21+1.3)*Math.cos(z*.17-.6)+.5*Math.sin((x+z)*.09+2.1);
  for(let a=0;a<700&&drifts.length<MAX_DRIFTS;a++){
   const x=MAP.minX-5+rnd()*(MAP.maxX-MAP.minX+10),z=MAP.minZ-5+rnd()*(MAP.maxZ-MAP.minZ+10),reach=1.2+rnd()*1.4,ang=.5+(rnd()-.5)*.7,flower=rnd()<.25,fa=rnd()*6.283,fr=rnd()*.5,ph=rnd()*6.283;
   if(field(x,z)<.12||!ok(x,z)||drifts.some(d=>Math.hypot(d.x-x,d.z-z)<(d.reach+reach)*.8+1.5))continue;
   drifts.push({x,z,reach,ang,flower,fa,fr,ph});
  }
  // Linear-space vertex colours.
  const BASE=[.089,.107,.024],TIP=[.57,.39,.107],SOFT=[.214,.243,.064],SHADE=[.04,.043,.036],RED=[.34,.04,.027];
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  for(const d of drifts){
   const roots=Math.ceil(Math.PI*d.reach*d.reach*.5*20),ca=Math.cos(d.ang),sa=Math.sin(d.ang),fu=Math.cos(d.fa)*d.fr*d.reach,fv=Math.sin(d.fa)*d.fr*d.reach*.5;
   for(let i=0;i<roots&&blades+3<=MAX_BLADES;i++){
    const th=rnd()*6.283,rho=Math.pow(rnd(),.7),edge=1+.28*Math.sin(th*3+d.ph)+.16*Math.cos(th*5-d.ph),u=Math.cos(th)*d.reach*rho*edge,v=Math.sin(th)*d.reach*.5*rho*edge,rx=d.x+u*ca-v*sa,rz=d.z+u*sa+v*ca;
    if(!ok(rx,rz)){rejected++;continue}
    const wet=Math.min(1,Math.max(0,1-(Math.abs(rx)-riverWidth(rz)-2)/5)),c0=mix(BASE,SHADE,.3+.4*(1-Math.min(1,rho))),inSpot=d.flower&&Math.hypot(u-fu,v-fv)<.7;
    for(let k=0;k<3;k++){
     const red=inSpot&&k===0&&rnd()<.35,h=Math.min(MAX_H,.17+rnd()*.29*(1-.35*Math.min(1,rho))),yaw=rnd()*6.283,w=.014+rnd()*.012,bx=rx+(rnd()-.5)*.12,bz=rz+(rnd()-.5)*.12,y=landscapeHeight(bx,bz)-.01,lean=h*(.25+rnd()*.3),sx=Math.cos(yaw)*w,sz=Math.sin(yaw)*w,tone=.85+rnd()*.3,tip=red?RED:mix(mix(TIP,SOFT,wet*.8),BASE,rnd()*.25).map(c=>c*tone),mid=mix(c0,tip,.55),b=pos.length/3;
     pos.push(bx-sx,y,bz-sz,bx+sx,y,bz+sz,bx+ca*lean*.35-sx*.7,y+h*.55,bz+sa*lean*.35-sz*.7,bx+ca*lean*.35+sx*.7,y+h*.55,bz+sa*lean*.35+sz*.7,bx+ca*lean,y+h,bz+sa*lean);
     col.push(...c0,...c0,...mid,...mid,...tip);
     for(let n=0;n<5;n++)nor.push(ca*.25,.94,sa*.25);
     idx.push(b,b+1,b+3,b,b+3,b+2,b+2,b+3,b+4);
     blades++;if(red)flecks++;if(h>maxH)maxH=h;
    }
   }
  }
  const budget={maxTriangles:18000,maxDrawCalls:1,frameBudgetMs:.3,frameTimeMeasured:false};
  const info={blades,triangles:blades*3,drawCalls:blades?1:0,drifts:drifts.length,flowerFlecks:flecks,rejectedRoots:rejected,maxBladeHeight:maxH,heightCap:MAX_H,static:true,raycast:'no-op',collider:'none',budget};
  if(!blades)return{mesh:null,triangles:0,info};
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeBoundingBox();g.computeBoundingSphere();
  const m=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  // Keep the up-biased normal on both faces so back faces are not lit as down-facing.
  m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
normal=normalize(vNormal);`)};
  m.customProgramCacheKey=()=>'foliage-ribbon-meadow-r1';
  const mesh=new T.Mesh(g,m);mesh.name='foliage-ribbon-meadow';mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.raycast=()=>{};mesh.userData.decorative=true;mesh.userData.noHit=true;mesh.userData.noCollision=true;
  mesh.matrixAutoUpdate=false;mesh.updateMatrix();world.add(mesh);meshes.push(mesh);
  return{mesh,triangles:blades*3,info};
 })();
 const bankCards=(()=>{
  const MAX=3600,MAX_CARD_H=.44;let seed=0x5eed1234;
  const r=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
  const cv=document.createElement('canvas');cv.width=cv.height=128;const g=cv.getContext('2d');g.clearRect(0,0,128,128);g.lineCap='round';
  const tones=['#6f7440','#7d7a45','#8a8350','#9c9160','#b0a26c','#5f6a3a','#857f4a'];
  for(let i=0;i<50;i++){
   const rx=64+(r()-.5)*70,lean=(r()-.5)*56,tipY=6+r()*58,tx=Math.min(124,Math.max(4,rx+lean)),bend=(r()-.5)*26;
   g.strokeStyle=tones[(r()*tones.length)|0];g.globalAlpha=.85+r()*.15;g.lineWidth=1.1+r()*1.5;
   g.beginPath();g.moveTo(rx,128);g.quadraticCurveTo(rx+lean*.25+bend,128-(128-tipY)*.55,tx,tipY);g.stroke();
  }
  g.globalAlpha=1;
  const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  const geo=new T.PlaneGeometry(1,1);geo.translate(0,.5,0);
  const mat=new T.MeshLambertMaterial({map,alphaTest:.4,side:T.DoubleSide});
  const mesh=new T.InstancedMesh(geo,mat,MAX),d=new T.Object3D(),c=new T.Color();let n=0,roots=0,stands=0,rejected=0,maxH=0;
  for(let s=0;s<900&&n+3<=MAX;s++){
   const side=r()<.5?-1:1,cz=(r()*2-1)*47,outer=r()<.3,cx=side*(outer?40+r()*8:riverWidth(cz)+2+r()*3),rad=.5+r()*1.3,k=3+((r()*8)|0),stretch=.7+r()*1.2;let used=0;
   for(let j=0;j<k&&n+3<=MAX;j++){
    const a=r()*6.2832,q=Math.sqrt(r())*rad*(.5+r()*.8),x=cx+Math.cos(a)*q,z=cz+Math.sin(a)*q*stretch,ax=Math.abs(x),rw=riverWidth(z);
    if(ax<rw+2||ax>48||Math.abs(z)>48||(!outer&&ax>rw+5)||!grassAllowed(x,z,.55)||inGrassGap(x,z,plan.gaps,.3)){rejected++;continue}
    const yaw=r()*3.1416,dry=r(),hBase=.26+r()*.16;
    for(let m=0;m<3;m++){
     const px=x+(r()-.5)*.14,pz=z+(r()-.5)*.14,h=Math.min(MAX_CARD_H,hBase*(.85+r()*.3)),w=.45+r()*.3;
     d.position.set(px,landscapeHeight(px,pz)-.015,pz);d.rotation.set(0,yaw+m*1.047+(r()-.5)*.5,0);d.scale.set(w,h,1);d.updateMatrix();mesh.setMatrixAt(n,d.matrix);
     c.setRGB(.72+dry*.2+r()*.06,.74+dry*.1+r()*.06,.62+dry*.12+r()*.06);mesh.setColorAt(n,c);maxH=Math.max(maxH,h);n++;
    }
    roots++;used++;
   }
   if(used)stands++;
  }
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.name='bank_grass_cards';mesh.receiveShadow=true;mesh.castShadow=false;mesh.frustumCulled=false;mesh.raycast=()=>{};
  const info={instances:n,roots,stands,rejected,maxInstances:MAX,triangles:n*2,drawCalls:1,maxHeight:+maxH.toFixed(3),texture:'128x128 procedural canvas, 50 strokes',wind:false,castsShadow:false};
  mesh.userData={bankGrassCards:true,...info};
  (world.add?world:world.scene).add(mesh);meshes.push(mesh);
  return{mesh,info};
 })();
 const polish=polishOptions?buildEnvironmentPolish({T,world,...polishOptions,grassSource:assets[4].scene.getObjectByName('grass_bermuda_01_small_a'),treeSources:[assets[0].scene,assets[2].scene]}):null;
 const triangles=batches.reduce((n,b)=>n+b.triangles,0)+ribbon.triangles+bankCards.info.triangles,shadowTriangles=batches.filter(b=>b.shadow).reduce((n,b)=>n+b.triangles,0);
 return{update(t){time.value=t;polish?.update(t)},setWeather(w){polish?.setWeather(w)},info(){return{revision:'wildbank-mixed-posture-r3-plus-meadow-canopy',counts,drawCalls:meshes.length,triangles,shadowCalls:batches.filter(b=>b.shadow).length,shadowTriangles,polish:polish?.info(),patches:plan.patches.length,clumps:plan.clumps.length,bareIntervals:plan.gaps.map(g=>({...g})),infill:{added:0,removed:true},bankCards:bankCards.info,ribbonMeadow:ribbon.info,crownLight:'height-graded leaf shader on tree and shrub leaves; maps, roots and geometry unchanged',treeCollidersNeeded:0,source:'Poly Haven CC0 trees/low Bermuda; ambientCG CC0 narrow blades; accepted original near forest and grass clusters plus separately budgeted meadow/mineral/distant canopy layer',limits:'CPU geometry budgets only; main must validate frame times and visual quality'}}};
}
