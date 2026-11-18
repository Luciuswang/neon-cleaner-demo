import {MAP,crossings,riverWidth,landscapeHeight,vegetationAllowed,inBuffer,bounds,houses} from './map-layout.js';

export const RIVERBANK_REVISION='afterrain-bank-clusters-v1';
export const RIVERBANK_LIMITS={micro:2400,cobbles:600,grass:720,outcrops:10,maxProtrusion:.065,crossingHalfWidth:2.7,maxTriangles:200000,maxDrawCalls:28};
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const outside=(x,z,pad=0)=>x<MAP.minX-pad||x>MAP.maxX+pad||z<MAP.minZ-pad||z>MAP.maxZ+pad;
export function footprintRadius(p){return Math.hypot(p.width,p.depth)*.5}
export function riverbankClearance(x,z,r=0){
 if(crossings.some(c=>Math.abs(z-c)<RIVERBANK_LIMITS.crossingHalfWidth+r)||inBuffer(x,z,r+1))return false;
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
export function riverbankPlan(seed=18112607){
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const micro=[],cobbles=[],grass=[],outcrops=[],patches=[];
 // Uneven wet-edge deposits; no continuous row of equally spaced boulders.
 for(const side of [-1,1])for(let z=-59;z<53;z+=2.1+random()*2.8){
  const pz=z+(random()-.5)*1.2;
  if(crossings.some(c=>Math.abs(pz-c)<2.8))continue;
  patches.push({x:side*(riverWidth(pz)+.6+random()*.85),z:pz,rx:.38+random()*.8,rz:.6+random()*1.9,side});
 }
 function addStones(target,count,large){
  for(let attempt=0;target.length<count&&attempt<count*80;attempt++){
   const patch=patches[Math.floor(random()*patches.length)];
   // Favor near gameplay detail while retaining some out-of-bounds continuity.
   if(outside(patch.x,patch.z)&&random()<.58)continue;
   const a=random()*TAU,r=Math.sqrt(random()),x=patch.x+Math.cos(a)*patch.rx*r,z=patch.z+Math.sin(a)*patch.rz*r;
   const width=large?.13+random()*.21:.048+random()*.105,depth=width*(.7+random()*.6),height=width*(.40+random()*.15);
   const p={x,z,width,depth,height,yaw:random()*TAU,tone:random(),variant:target.length%2};
   const radius=footprintRadius(p),offset=Math.abs(x)-riverWidth(z);
   if(offset<.05||offset>2.35||!riverbankClearance(x,z,radius))continue;
   const ground=footprintGround(p);p.protrusion=Math.min(height*.44,large?.061:.032);p.y=ground.low+p.protrusion-height;
   // Very steep edge fragments would disappear entirely; do not count them as
   // visible geometry. Upper hemispheres remain buried on the uphill side.
   if(ground.high-ground.low>height*.9)continue;
   target.push(p);
  }
 }
 addStones(micro,RIVERBANK_LIMITS.micro,false);addStones(cobbles,RIVERBANK_LIMITS.cobbles,true);
 for(let attempt=0;grass.length<RIVERBANK_LIMITS.grass&&attempt<25000;attempt++){
  const z=MAP.minZ+1+random()*(MAP.maxZ-MAP.minZ-2),side=random()<.5?-1:1;
  const x=side*(riverWidth(z)+1.9+random()*1.15),width=.24+random()*.14,depth=width;
  const p={x,z,width,depth,height:.115+random()*.065,yaw:random()*TAU,tone:random(),variant:grass.length%2};
  const radius=footprintRadius(p);
  if(!riverbankClearance(x,z,radius)||!vegetationAllowed(x,z))continue;
  if(![-1,1].every(a=>[-1,1].every(b=>vegetationAllowed(x+a*radius,z+b*radius))))continue;
  // Connected short blades in lobed patches; bare mud gaps remain deliberate.
  if(random()>.67+.23*Math.sin(z*.83+Math.sin(x*1.9)))continue;
  p.y=footprintGround(p).low-.012;grass.push(p);
 }
 // All large geometry is fully beyond the playable rectangle, not a new
 // invisible obstacle. Asymmetric groups, away from river/crossing sight lines.
 const anchors=[[-9,-40],[-12,-42],[-9,-47],[13,-43],[15,-45],[-11,34],[-13,36],[10,36],[13,39],[15,41]];
 for(const [x,z]of anchors){
  const p={x:x+(random()-.5)*.7,z:z+(random()-.5)*.9,width:1.15+random()*1.6,depth:.9+random()*1.35,height:.55+random()*.65,yaw:random()*TAU,tone:random(),variant:0};
  const r=footprintRadius(p);if(!outside(p.x,p.z,r+1))throw Error('Riverbank outcrop intrudes into playable rectangle');
  p.y=footprintGround(p).low-p.height*.34;outcrops.push(p);
 }
 for(const [name,list]of Object.entries({micro,cobbles,grass,outcrops}))if(list.length!==RIVERBANK_LIMITS[name])throw Error(`Riverbank ${name}: ${list.length} placements, expected ${RIVERBANK_LIMITS[name]}`);
 return{micro,cobbles,grass,outcrops,patches};
}

// Round normals, bounded deformation and smooth low silhouettes. The texture
// is a scanned rock surface; the individual meshes are procedural, not scans.
export function riverStoneGeometry(T,kind,variant=0){
 const segments=kind==='micro'?[8,4]:kind==='cobbles'?[10,6]:[16,10];
 const g=new T.SphereGeometry(1,...segments),p=g.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+.035*Math.sin(x*3.1+y*2.8+z*4.2+variant*2.7);
  p.setXYZ(i,x*f,y*f,z*f);
 }
 // Keep analytic smooth sphere normals: small radial changes must not turn
 // duplicated UV seam/pole vertices into sharp faceted highlights.
 g.computeBoundingBox();const b=g.boundingBox,size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3());
 g.translate(-center.x,-b.min.y,-center.z);g.scale(1/size.x,1/size.y,1/size.z);g.computeBoundingBox();g.computeBoundingSphere();
 return g;
}
const NOISE_GLSL=`
 float bankHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float bankNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(bankHash(i),bankHash(i+vec2(1.,0.)),f.x),mix(bankHash(i+vec2(0.,1.)),bankHash(i+1.),f.x),f.y);}
`;
export function riverbankMaterialHook(material,{bed=false}={}){
 material.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBankWorld;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 bankLocal=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    bankLocal=instanceMatrix*bankLocal;
   #endif
   vBankWorld=(modelMatrix*bankLocal).xyz;`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBankWorld;\n'+NOISE_GLSL);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float bankWet=1.-smoothstep(-.16,.12,vBankWorld.y+bankNoise(vBankWorld.xz*2.3)*.07);
   diffuseColor.rgb*=mix(vec3(1.),vec3(.72,.76,.77),bankWet);`);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(mix(roughnessFactor,.31,bankWet*.74),.27,.96);`);
  if(bed)s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`
   float bankWidth=3.4+.8*cos(vBankWorld.z*.17)+.35*sin(vBankWorld.z*.47);
   float brokenEdge=(bankNoise(vBankWorld.xz*1.5)-.5)*.63+(bankNoise(vBankWorld.xz*5.1)-.5)*.18;
   float shore=abs(vBankWorld.x)-bankWidth+brokenEdge;
   float fade=1.-smoothstep(.8,2.35,shore);
   float granular=bankNoise(vBankWorld.xz*10.7);
   diffuseColor.a*=fade*smoothstep(.02,.28,fade+granular*.3);
   if(diffuseColor.a<.012)discard;
   #include <alphatest_fragment>`);
 };
 material.customProgramCacheKey=()=>`${RIVERBANK_REVISION}-${bed?'bed':'stones'}`;
}

export function populateRiverbankInstances({T,world,plan,stoneMaterial,grassSources}){
 const batches=[],dummy=new T.Object3D(),color=new T.Color(),group=new T.Group();group.name='After-rain riverbank detail';
 function add(geometry,material,placements,label,shadow=false){
  for(let sector=0;sector<4;sector++){
   const ps=placements.filter(p=>(p.x>=0?1:0)+(p.z>=-4?2:0)===sector);if(!ps.length)continue;
   const mesh=new T.InstancedMesh(geometry,material,ps.length);mesh.name=`riverbank-${label}-${sector}`;
   ps.forEach((p,i)=>{
    dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(p.width,p.height,p.depth);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    const tone=.87+p.tone*.13;color.setRGB(tone,tone,tone*(label.startsWith('grass')?.98:.97));mesh.setColorAt(i,color);
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
 return{bedMaterial,group,info(){return{revision:RIVERBANK_REVISION,counts:{micro:plan.micro.length,cobbles:plan.cobbles.length,grass:plan.grass.length,outcrops:plan.outcrops.length,patches:plan.patches.length},triangles,drawCalls:batches.length,shadowCalls:shadow.length,shadowTriangles:shadow.reduce((n,b)=>n+b.triangles,0),bed:{additionalDrawCalls:0,replacesExistingBed:true,sourceUV:'x/2,z/2',scanTileMeters:2.16},replacesOld850Stones:true,collidersRequired:0,limits:'CPU submitted geometry budget only. Main must verify actual WebGL art, frame times and route regressions.'}}};
}
