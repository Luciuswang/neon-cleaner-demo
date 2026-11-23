import {MAP,crossings,riverWidth,landscapeHeight,vegetationAllowed,inBuffer,bounds,houses,spawns,teamSpawns} from './map-layout.js';

export const RIVERBANK_REVISION='reference-substrate-mixed-gravel-v3';
export const RIVERBANK_LIMITS={micro:2500,cobbles:720,grass:360,outcrops:12,maxProtrusion:.065,crossingHalfWidth:2.7,maxTriangles:200000,maxDrawCalls:28};
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const outside=(x,z,pad=0)=>x<MAP.minX-pad||x>MAP.maxX+pad||z<MAP.minZ-pad||z>MAP.maxZ+pad;
export function footprintRadius(p){return Math.hypot(p.width,p.depth)*.5}
export function riverbankClearance(x,z,r=0){
 if(crossings.some(c=>Math.abs(z-c)<RIVERBANK_LIMITS.crossingHalfWidth+r)||inBuffer(x,z,r+1))return false;
 if([...spawns,...teamSpawns].some(p=>Math.hypot(x-p[0],z-p[2])<2+r))return false;
 // Preserve both the current mud lane and the earlier vegetation lane contract.
 if([10+.32*Math.sin(z*.19),11.2+.6*Math.sin(z*.15)].some(l=>Math.abs(Math.abs(x)-l)<1.65+r))return false;
 if(bounds.some(b=>x>b.min.x-r-.35&&x<b.max.x+r+.35&&z>b.min.z-r-.35&&z<b.max.z+r+.35))return false;
 return !houses.some(h=>Math.abs(x-h.x)<4.8+r&&Math.abs(z-h.z)<5.3+r);
}
export function footprintGround(p){
 // Conservative full rotated rectangle, not just the center on a bank slope.
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw);let low=Infinity,high=-Infinity;
 for(const u of [-.5,0,.5])for(const v of [-.5,0,.5]){
  const x=p.x+c*u*p.width+s*v*p.depth,z=p.z-s*u*p.width+c*v*p.depth,y=landscapeHeight(x,z);
  low=Math.min(low,y);high=Math.max(high,y);
 }
 return{low,high};
}
// Overlapping asymmetric sediment lobes. Bare intervals are intentional, not
// failed placement; this SAME field also masks the scanned bed material.
export function riverDepositPatches(){
 const anchors=[[-1,-31,.9,1.05,2.2],[-1,-17.2,.65,1.35,2.5],[-1,-9.5,.45,.95,1.5],[-1,2.2,1.05,1.3,2.7],[-1,9.6,.65,1.4,2.8],[-1,21,.8,1.2,2.0],
  [1,-29.2,.3,1.45,1.7],[1,-16.2,1.05,1.0,1.8],[1,-10.6,.6,1.3,1.8],[1,4.4,.7,1.55,2.6],[1,9.8,.3,1.05,2.1],[1,22.8,.7,1.05,1.8],
  [-1,-41,.5,1.8,3.6],[1,-39,.4,1.6,2.4],[-1,32,.5,1.8,2.4],[1,35,.5,1.65,3.2],[-1,-53,.2,1.5,3.2],[1,47,.2,1.7,2.5]];
 const patches=[];
 anchors.forEach(([side,z,offset,rx,rz],i)=>{
  patches.push({id:i*2,x:side*(riverWidth(z)+offset),z,rx,rz,side,submerged:false,weight:.75+(i%3)*.16});
  // Current-sorted tongues lie inside the wet channel, overlapping only the
  // lower tip of the dry shoal instead of drawing a second continuous stripe.
  patches.push({id:i*2+1,x:side*(riverWidth(z)-.8-(i%3)*.24),z:z+((i%2)?-.65:.55),rx:rx*.73,rz:rz*.72,side,submerged:true,weight:.75});
 });return patches;
}
const DEPOSITS=riverDepositPatches();
export function riverDepositField(x,z){
 let value=0;
 for(const p of DEPOSITS){
  const qz=(z-p.z)/p.rz,qx=(x-p.x)/p.rx+qz*.24+.11*Math.sin(qz*5.3+p.x),d=Math.hypot(qx,qz);
  value+=Math.max(0,1-d*d)*p.weight;
 }return clamp(value,0,1);
}
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
// The underwater scan is a SUBSTRATE, not just the tops of isolated shoals.
// Long, domain-warped mud pockets break it without erasing the entire channel.
// Same cheap analytic field is used by CPU placement and the bed shader.
export function riverSubstrateField(x,z){
 const channel=1-smooth(-.23,-.11,landscapeHeight(x,z));
 const variation=.53+.23*Math.sin(x*.67+Math.sin(z*.31)*1.7)+.17*Math.cos(z*.47-x*.29)+.10*Math.sin(z*.93+x*.82);
 return channel*smooth(.28,.49,variation);
}
export function riverBedField(x,z){return Math.max(riverDepositField(x,z),riverSubstrateField(x,z))}
function groundStone(p){
 // Match the local bank grade before burying. The old world-horizontal caps
 // vanished uphill and read as flat discs. This is geometry, NOT new support.
 const e=.08;p.slopeX=(landscapeHeight(p.x+e,p.z)-landscapeHeight(p.x-e,p.z))/(2*e);
 p.slopeZ=(landscapeHeight(p.x,p.z+e)-landscapeHeight(p.x,p.z-e))/(2*e);
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw);let residual=Infinity;
 for(const u of [-.5,-.25,0,.25,.5])for(const v of [-.5,-.25,0,.25,.5]){
  const dx=c*u*p.width+s*v*p.depth,dz=-s*u*p.width+c*v*p.depth;
  residual=Math.min(residual,landscapeHeight(p.x+dx,p.z+dz)-p.slopeX*dx-p.slopeZ*dz);
 }
 p.y=residual+p.protrusion-p.height-.0003;
}
export function riverbankPlacementMatrix(T,p,target=new T.Matrix4()){
 const c=Math.cos(p.yaw),s=Math.sin(p.yaw),sx=p.slopeX||0,sz=p.slopeZ||0;
 return target.set(c*p.width,0,s*p.depth,p.x,(sx*c-sz*s)*p.width,p.height,(sx*s+sz*c)*p.depth,p.y,-s*p.width,0,c*p.depth,p.z,0,0,0,1);
}
export function riverbankPlan(seed=18112607){
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const micro=[],cobbles=[],grass=[],outcrops=[],patches=DEPOSITS.map(p=>({...p})),grassIslands=[];
 function addStones(target,count,large){
  for(let attempt=0;target.length<count&&attempt<count*80;attempt++){
   const substrate=random()<(large?.23:.38),patch=patches[Math.floor(random()*patches.length)];
   // Favor near gameplay detail while retaining some out-of-bounds continuity.
   if(outside(patch.x,patch.z)&&random()<.72)continue;
   const a=random()*TAU,r=Math.pow(random(),.48),z=substrate?MAP.minZ+1+random()*(MAP.maxZ-MAP.minZ-2):patch.z+Math.sin(a)*patch.rz*r;
   const x=substrate?(random()*2-1)*(riverWidth(z)+.65):patch.x+Math.cos(a)*patch.rx*r;
   const sizeSample=random(),width=large?(sizeSample<.7?.085+random()*.115:.20+random()*.15):.024+Math.pow(sizeSample,1.45)*.105;
   const depth=width*(.53+random()*.82),height=width*(.58+random()*.34);
   const p={x,z,width,depth,height,yaw:random()*TAU,tone:random(),mineral:Math.floor(random()*4),variant:target.length%2,deposit:substrate?-1:patch.id};
   const radius=footprintRadius(p),offset=Math.abs(x)-riverWidth(z);
   if((!substrate&&offset< -2.5)||offset>2.4||!riverbankClearance(x,z,radius)||riverBedField(x,z)<.13)continue;
   if(substrate&&riverSubstrateField(x,z)<.13)continue;
   // Dense cores have embedded individual bodies, with loose satellite stones
   // near the edge. Small stones expose shoulders, not only a flattened cap.
   if(random()>clamp((substrate?riverSubstrateField(x,z):riverDepositField(x,z))*1.4,.15,.98))continue;
   p.protrusion=Math.min(height*(large?.62:.82),.061);groundStone(p);
   p.submerged=p.y+p.height+Math.hypot(p.slopeX,p.slopeZ)*radius<MAP.waterY-.018;
   target.push(p);
  }
 }
 addStones(micro,RIVERBANK_LIMITS.micro,false);addStones(cobbles,RIVERBANK_LIMITS.cobbles,true);
 for(const [side,z,rx,rz]of [[-1,-30.1,.58,.9],[-1,-17.1,.72,.8],[-1,2.4,.68,1.1],[1,-28.5,.62,.7],[1,-10.5,.55,.85],[1,3.5,.72,1.15],[1,22.4,.63,.9]])grassIslands.push({x:side*(riverWidth(z)+2.15),z,rx,rz});
 for(let attempt=0;grass.length<RIVERBANK_LIMITS.grass&&attempt<25000;attempt++){
  const island=grassIslands[Math.floor(random()*grassIslands.length)],angle=random()*TAU,r=Math.pow(random(),.7);
  const x=island.x+Math.cos(angle)*island.rx*r,z=island.z+Math.sin(angle)*island.rz*r,width=.22+random()*.14,depth=width;
  const p={x,z,width,depth,height:.115+random()*.065,yaw:random()*TAU,tone:random(),variant:grass.length%2,island:grassIslands.indexOf(island)};
  const radius=footprintRadius(p);
  if(!riverbankClearance(x,z,radius)||!vegetationAllowed(x,z))continue;
  if(![-1,1].every(a=>[-1,1].every(b=>vegetationAllowed(x+a*radius,z+b*radius))))continue;
  p.y=footprintGround(p).low-.012;grass.push(p);
 }
 // All large geometry is fully beyond the playable rectangle, not a new
 // invisible obstacle. Asymmetric groups, away from river/crossing sight lines.
 const anchors=[[-5.7,-38.8],[-7.8,-39.7],[-5.1,-42.4],[5.8,-39.9],[7.6,-41.4],[4.6,-44.2],[-5.2,31.5],[-7.3,32.4],[-4.9,35.2],[5.7,32.6],[7.5,34.1],[4.6,37.4]];
 for(const [x,z]of anchors){
  const p={x:x+(random()-.5)*.4,z:z+(random()-.5)*.5,width:1.3+random()*1.25,depth:1.0+random()*1.2,height:.8+random()*.75,yaw:random()*TAU,tone:random(),mineral:Math.floor(random()*4),variant:0};
  const r=footprintRadius(p);if(!outside(p.x,p.z,r+1))throw Error('Riverbank outcrop intrudes into playable rectangle');
  p.y=footprintGround(p).low-p.height*.34;outcrops.push(p);
 }
 for(const [name,list]of Object.entries({micro,cobbles,grass,outcrops}))if(list.length!==RIVERBANK_LIMITS[name])throw Error(`Riverbank ${name}: ${list.length} placements, expected ${RIVERBANK_LIMITS[name]}`);
 return{micro,cobbles,grass,outcrops,patches,grassIslands};
}

// Bevelled/tumbled asymmetric stones, not scaled plastic spheres. The texture
// is a scanned rock surface; the individual meshes are procedural, not scans.
export function riverStoneGeometry(T,kind,variant=0){
 const segments=kind==='micro'?[8,4]:kind==='cobbles'?[10,6]:[16,10];
 const g=new T.SphereGeometry(1,...segments),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),power=variant?.81:.91;
  let a=Math.sign(x)*Math.pow(Math.abs(x),power),b=Math.sign(y)*Math.pow(Math.abs(y),.88),c=Math.sign(z)*Math.pow(Math.abs(z),power);
  // Unequal fracture planes with softened corners create broad mineral faces.
  const cap=variant?.64-.21*a+.16*c:.80+.17*a-.08*c;b=Math.min(b,cap);
  const cut=Math.max(1,(a*.68+b*.45+c*.58)/.94,(-a*.72+b*.3-c*.62)/.96);a/=cut;b/=cut;c/=cut;
  const f=1+.055*Math.sin(a*4.2+b*2.1+c*3.7+variant*2.7);
  p.setXYZ(i,(a+.13*b)*f,b*f,(c-.08*a)*f);
 }
 // Recompute actual sculpt normals, then weld only coincident seam normals.
 // Do not retain sphere normals after clipping/sculpting the silhouette.
 g.computeVertexNormals();const normals=g.attributes.normal,merged=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(n=>Math.round(n*1e5)).join(','),entry=merged.get(key)||{indices:[],normal:new T.Vector3()};entry.indices.push(i);entry.normal.add(new T.Vector3().fromBufferAttribute(normals,i));merged.set(key,entry)}
 for(const entry of merged.values()){entry.normal.normalize();for(const i of entry.indices)normals.setXYZ(i,entry.normal.x,entry.normal.y,entry.normal.z)}
 g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
 g.translate(-center.x,-b.min.y,-center.z);g.scale(1/size.x,1/size.y,1/size.z);g.computeBoundingBox();g.computeBoundingSphere();
 return g;
}
const NOISE_GLSL=`
 float bankHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float bankNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(bankHash(i),bankHash(i+vec2(1.,0.)),f.x),mix(bankHash(i+vec2(0.,1.)),bankHash(i+1.),f.x),f.y);}
`;
export function riverbankMaterialHook(material,{bed=false}={}){
 // The water surface owns the broad reflection. A second shiny bed beneath
 // it becomes a white sheet even when the water Fresnel is correct.
 if(bed)material.envMapIntensity=.22;
 material.onBeforeCompile=s=>{
  if(bed){
   s.uniforms.uBankDeposits={value:new Float32Array(DEPOSITS.flatMap(p=>[p.x,p.z,p.rx,p.rz]))};
   s.uniforms.uBankWeights={value:new Float32Array(DEPOSITS.map(p=>p.weight))};
  }
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBankWorld;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 bankLocal=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    bankLocal=instanceMatrix*bankLocal;
   #endif
   vBankWorld=(modelMatrix*bankLocal).xyz;`);
  if(!bed)s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
   #ifdef USE_INSTANCING
    float mineralScale=max(length(instanceMatrix[0].xyz),length(instanceMatrix[2].xyz))*1.4;
    vec2 mineralOffset=fract(instanceMatrix[3].xz*vec2(.173,.237));
    #ifdef USE_MAP
     vMapUv=vMapUv*mineralScale+mineralOffset;
    #endif
    #ifdef USE_NORMALMAP
     vNormalMapUv=vNormalMapUv*mineralScale+mineralOffset;
    #endif
    #ifdef USE_ROUGHNESSMAP
     vRoughnessMapUv=vRoughnessMapUv*mineralScale+mineralOffset;
    #endif
    #ifdef USE_AOMAP
     vAoMapUv=vAoMapUv*mineralScale+mineralOffset;
    #endif
   #endif`);
  if(!bed)s.vertexShader=s.vertexShader.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
   #ifdef USE_INSTANCING
    // Exact inverse-transpose direction for the bank-grade shear. Three's
    // default instance normal shortcut assumes rotation/scale without shear.
    mat3 bankBasis=mat3(instanceMatrix);
    mat3 bankNormal=mat3(cross(bankBasis[1],bankBasis[2]),cross(bankBasis[2],bankBasis[0]),cross(bankBasis[0],bankBasis[1]));
    transformedNormal=normalMatrix*(bankNormal*objectNormal);
    #ifdef FLIP_SIDED
     transformedNormal=-transformedNormal;
    #endif
   #endif`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBankWorld;\n'+NOISE_GLSL);
  if(bed)s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   uniform vec4 uBankDeposits[${DEPOSITS.length}];uniform float uBankWeights[${DEPOSITS.length}];
   float bankDepositField(vec2 p){float coverage=0.;for(int i=0;i<${DEPOSITS.length};i++){
    vec4 b=uBankDeposits[i];vec2 q=(p-b.xy)/b.zw;
    q.x+=q.y*.24+.11*sin(q.y*5.3+b.x);
    coverage+=max(0.,1.-dot(q,q))*uBankWeights[i];
   }return clamp(coverage,0.,1.);}
   float bankSubstrateField(vec3 p){
    float channel=1.-smoothstep(-.23,-.11,p.y-.008);
    float variation=.53+.23*sin(p.x*.67+sin(p.z*.31)*1.7)+.17*cos(p.z*.47-p.x*.29)+.10*sin(p.z*.93+p.x*.82);
    return channel*smoothstep(.28,.49,variation);
   }`);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float bankWet=1.-smoothstep(-.16,.12,vBankWorld.y+bankNoise(vBankWorld.xz*2.3)*.07);
   diffuseColor.rgb*=mix(vec3(1.),vec3(.72,.76,.77),bankWet);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',bed?`#include <roughnessmap_fragment>
   roughnessFactor=clamp(mix(max(roughnessFactor,.84),.76,bankWet*.74),.72,.98);`:`#include <roughnessmap_fragment>
   roughnessFactor=clamp(mix(roughnessFactor,.55,bankWet*.74),.48,.96);`);
  if(bed)s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`
   float brokenEdge=(bankNoise(vBankWorld.xz*2.1)-.5)*.26+(bankNoise(vBankWorld.xz*8.1)-.5)*.09;
   float deposit=max(bankDepositField(vBankWorld.xz),bankSubstrateField(vBankWorld));
   float fade=smoothstep(.10,.62,deposit+brokenEdge);
   float granular=bankNoise(vBankWorld.xz*15.7);
   // Fully transparent dry-mud interruptions, not dark paint on a full sheet.
   diffuseColor.a*=fade*smoothstep(.08,.48,deposit+granular*.19);
   diffuseColor.rgb*=vec3(.94,.89,.82);
   if(diffuseColor.a<.012)discard;
   #include <alphatest_fragment>`);
 };
 material.customProgramCacheKey=()=>`${RIVERBANK_REVISION}-${bed?'bed':'stones'}`;
}

export function populateRiverbankInstances({T,world,plan,stoneMaterial,grassSources}){
 const batches=[],matrix=new T.Matrix4(),color=new T.Color(),group=new T.Group();group.name='Reference riverbank shoals';
 function add(geometry,material,placements,label,shadow=false){
  for(let sector=0;sector<4;sector++){
   const ps=placements.filter(p=>(p.x>=0?1:0)+(p.z>=-4?2:0)===sector);if(!ps.length)continue;
   const mesh=new T.InstancedMesh(geometry,material,ps.length);mesh.name=`riverbank-${label}-${sector}`;
   ps.forEach((p,i)=>{
    riverbankPlacementMatrix(T,p,matrix);mesh.setMatrixAt(i,matrix);
    const tone=.76+p.tone*.24,mineral=[[.89,.79,.65],[.72,.75,.72],[.46,.54,.60],[.94,.74,.53]][p.mineral||0];
    if(label.startsWith('grass'))color.setRGB(tone,tone,tone*.98);else color.setRGB(tone*mineral[0],tone*mineral[1],tone*mineral[2]);mesh.setColorAt(i,color);
   });
   mesh.receiveShadow=true;mesh.castShadow=shadow;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
   batches.push({label,sector,instances:ps.length,triangles:(geometry.index?geometry.index.count:geometry.attributes.position.count)/3*ps.length,shadow});
  }
 }
 for(const kind of ['micro','cobbles'])for(let variant=0;variant<2;variant++)add(riverStoneGeometry(T,kind,variant),stoneMaterial,plan[kind].filter(p=>p.variant===variant),kind+'-'+variant);
 add(riverStoneGeometry(T,'outcrops'),stoneMaterial,plan.outcrops,'outcrops',true);
 for(let variant=0;variant<2;variant++){
  const source=grassSources[variant];if(!source?.isMesh)throw Error('Bermuda shore grass mesh missing');source.updateWorldMatrix(true,false);
  const g=source.geometry.clone().applyMatrix4(source.matrixWorld);g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
  g.translate(-center.x,-b.min.y,-center.z);g.scale(1/Math.max(size.x,size.z),1/size.y,1/Math.max(size.x,size.z));
  const m=source.material.clone();m.color.setRGB(.97,1,.96);m.alphaTest=.35;m.transparent=false;m.depthWrite=true;m.side=T.DoubleSide;m.forceSinglePass=true;
  m.roughness=.88;m.metalness=0;m.envMapIntensity=.62;if(m.roughnessMap){m.aoMap=m.roughnessMap;m.aoMapIntensity=.15}if(m.normalScale)m.normalScale.multiplyScalar(.4);
  // Static low blades: no unmatched wind/shadow deformation and no additional
  // alpha-tested shadow draws. Existing scene foliage supplies wind movement.
  add(g,m,plan.grass.filter(p=>p.variant===variant),'grass-'+variant);
 }
 world.add(group);
 return{group,batches};
}

export async function buildRiverbankDetail({T,world,materials}){
 // All URLs relative to THIS module; works under the local /river mount and
 // the packaged demo without a hard-coded port or origin.
 const textureLoader=new T.TextureLoader(),assetURL=p=>new URL(p,import.meta.url).href;
 async function surface(id,repeat=1){
  const ts=await Promise.all(['color','normal','arm'].map(role=>textureLoader.loadAsync(assetURL(`assets/afterrain-detail/${id}/${role}.jpg`))));
  ts.forEach((t,i)=>{t.colorSpace=i===0?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8});
  const m=new T.MeshStandardMaterial({map:ts[0],normalMap:ts[1],roughnessMap:ts[2],aoMap:ts[2],aoMapIntensity:.28,roughness:.92,metalness:0,envMapIntensity:.65});
  m.normalScale.set(.55,.55);return m;
 }
 const [{GLTFLoader},{MeshoptDecoder},bedMaterial,stoneMaterial]=await Promise.all([
  import('three/addons/loaders/GLTFLoader.js'),import('three/addons/libs/meshopt_decoder.module.js'),
  surface('ganges_river_pebbles',2/2.16),surface('dry_riverbed_rock')
 ]);
 bedMaterial.name='CC0 Ganges pebble riverbed';bedMaterial.transparent=true;bedMaterial.depthWrite=false;bedMaterial.normalScale.set(.68,.68);riverbankMaterialHook(bedMaterial,{bed:true});
 stoneMaterial.name='CC0 weathered river stone';riverbankMaterialHook(stoneMaterial);
 const asset=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(assetURL('assets/foliage-revision/grass_bermuda_01.glb'));
 const grassSources=['small_a','small_b'].map(v=>asset.scene.getObjectByName('grass_bermuda_01_'+v));
 const plan=riverbankPlan(),{group,batches}=populateRiverbankInstances({T,world,plan,stoneMaterial,grassSources});
 const triangles=batches.reduce((n,b)=>n+b.triangles,0),shadow=batches.filter(b=>b.shadow);
 if(triangles>RIVERBANK_LIMITS.maxTriangles||batches.length>RIVERBANK_LIMITS.maxDrawCalls)throw Error('Riverbank geometry budget exceeded');
 // materials is deliberately untouched: ownership stays with the integrator.
 return{bedMaterial,group,info(){return{revision:RIVERBANK_REVISION,counts:{micro:plan.micro.length,cobbles:plan.cobbles.length,grass:plan.grass.length,outcrops:plan.outcrops.length,patches:plan.patches.length,grassIslands:plan.grassIslands.length,submergedStones:[...plan.micro,...plan.cobbles].filter(p=>p.submerged).length,substrateStones:[...plan.micro,...plan.cobbles].filter(p=>p.deposit===-1).length},triangles,drawCalls:batches.length,shadowCalls:shadow.length,shadowTriangles:shadow.reduce((n,b)=>n+b.triangles,0),bed:{additionalDrawCalls:0,replacesExistingBed:true,sourceUV:'x/2,z/2',scanTileMeters:2.16,continuousSheet:false,sharedDepositField:true,underwaterSubstrateWithMudPockets:true},replacesOld850Stones:true,collidersRequired:0,limits:'CPU submitted geometry budget only. Main must verify actual WebGL art, frame times and route regressions.'}}};
}
