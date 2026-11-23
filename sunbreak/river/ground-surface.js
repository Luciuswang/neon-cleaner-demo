import {houses,bufferPlacements,bufferLocal,crossings,riverWidth,blocked,landscapeHeight,bounds} from './map-layout.js';
import {SOIL_MOISTURE_GLSL,soilMoisture} from './ground-moisture.js';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const rectangleDistance=(x,z,w,d)=>Math.hypot(Math.max(0,Math.abs(x)-w),Math.max(0,Math.abs(z)-d));
function segmentDistance(x,z,a,b,c,d){const dx=c-a,dz=d-b,t=clamp(((x-a)*dx+(z-b)*dz)/(dx*dx+dz*dz||1));return Math.hypot(x-a-t*dx,z-b-t*dz)}

// Metre-space wear network: longitudinal village lanes, fords/bridge and real
// door/porch approaches. No terrain/support/collider changes are involved.
export function trafficDistance(x,z){
 let d=Math.abs(Math.abs(x)-(10+.32*Math.sin(z*.19)));
 for(const c of crossings)d=Math.min(d,segmentDistance(x,z,-12,c,12,c));
 for(const h of houses)for(const end of [-1,1]){
  const dz=h.z+end*4.3;
  d=Math.min(d,segmentDistance(x,z,h.side*10,dz,h.x,dz),segmentDistance(x,z,h.x,dz,h.x,h.z+end*3.1));
 }
 for(const p of bufferPlacements){const side=Math.sign(p.x),z0=p.z+(p.yaw? -1:1)*6.2;
  d=Math.min(d,segmentDistance(x,z,side*22,z0,p.x,z0));
 }
 return d;
}
export function surfaceZones(x,z){
 const irregular=.18*Math.sin(x*2.7+z*1.4)+.10*Math.sin(z*5.1-x*2.3);
 const traffic=1-smooth(.64,1.63,trafficDistance(x,z)+irregular);
 let foundation=0,footprint=0;
 for(const h of houses){const d=rectangleDistance(x-h.x,z-h.z,3.65,3.65);foundation=Math.max(foundation,1-smooth(.2,1.65,d));footprint=Math.max(footprint,d===0?1:0)}
 for(const p of bufferPlacements){const q=bufferLocal(x,z,p),d=rectangleDistance(q.x,q.z-.65,4.45,5.10);foundation=Math.max(foundation,1-smooth(.05,1.3,d));footprint=Math.max(footprint,d===0?1:0)}
 const bank=soilMoisture(x,z,0),outskirts=smooth(22,40,Math.max(Math.abs(x),Math.abs(z+4)));
 const patch=.5+.28*Math.sin(x*.36+z*.16)+.22*Math.cos(z*.47-x*.19);
 const litter=(1-traffic)*(1-foundation)*(1-bank)*clamp(.30+outskirts*.65+patch*.30);
 let contact=0;
 for(const b of bounds){if(b.max.y<.15||b.min.y>landscapeHeight((b.max.x+b.min.x)/2,(b.max.z+b.min.z)/2)+.20)continue;const d=rectangleDistance(x-(b.max.x+b.min.x)/2,z-(b.max.z+b.min.z)/2,(b.max.x-b.min.x)/2,(b.max.z-b.min.z)/2);contact=Math.max(contact,(1-smooth(.05,.65,d))*.25)}
 return {path:traffic*(1-bank)*Math.max(1-foundation,.84*traffic)*(1-footprint),foundation,litter,contact};
}
export function applySurfaceAttributes(T,geometry){
 const p=geometry.attributes.position,data=new Float32Array(p.count*4);
 for(let i=0;i<p.count;i++){const z=surfaceZones(p.getX(i),p.getZ(i));data.set([z.path,z.foundation,z.litter,z.contact],i*4)}
 geometry.setAttribute('surfaceZones',new T.BufferAttribute(data,4));
}
export function installGroundSurface(T,material,{dirt,forest,rain}){
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{uDirtColor:{value:dirt.map},uDirtNormal:{value:dirt.normalMap},uDirtRough:{value:dirt.roughnessMap},uForestColor:{value:forest.map},uForestNormal:{value:forest.normalMap},uForestRough:{value:forest.roughnessMap},soilRain:rain});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 surfaceZones;varying vec4 vSurfaceZones;varying vec3 vGroundWorld;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceZones=surfaceZones;vGroundWorld=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec4 vSurfaceZones;varying vec3 vGroundWorld;uniform float soilRain;
   uniform sampler2D uDirtColor,uDirtNormal,uDirtRough,uForestColor,uForestNormal,uForestRough;
   ${SOIL_MOISTURE_GLSL}
   float earthHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float earthNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(earthHash(i),earthHash(i+vec2(1,0)),f.x),mix(earthHash(i+vec2(0,1)),earthHash(i+1.),f.x),f.y);}
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   vec2 gp=vGroundWorld.xz,dirtUV=gp/2.4,forestUV=gp/2.7;
   float macro=earthNoise(gp*.17)*.65+earthNoise(gp*.54)*.35;
   float soilWet=soilMoisture(gp,soilRain);
   float pathBlend=clamp(vSurfaceZones.x+(earthNoise(gp*3.7)-.5)*.32*vSurfaceZones.x*(1.-vSurfaceZones.x)*4.,0.,1.);
   float litterBlend=clamp(vSurfaceZones.z+(earthNoise(gp*2.1)-.5)*.22*vSurfaceZones.z*(1.-vSurfaceZones.z)*4.,0.,1.)*(1.-pathBlend);
   vec3 soil=texture2D(map,vMapUv).rgb;
   vec3 pathColor=texture2D(uDirtColor,dirtUV).rgb*vec3(1.52,1.39,1.19);
   vec3 litterColor=texture2D(uForestColor,forestUV).rgb*vec3(.86,.91,.77);
   vec3 surface=mix(mix(soil,pathColor,pathBlend),litterColor,litterBlend);
   surface*=mix(vec3(.86,.90,.80),vec3(1.12,1.05,.94),macro);
   // Saturation and reflectance change with real bank geography, not a global
   // wet varnish. Existing soil remains at foundations and along the river.
   surface*=mix(vec3(1.42,1.34,1.20),vec3(.66,.70,.67),soilWet);
   diffuseColor*=vec4(surface,1.);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,texture2D(uDirtRough,dirtUV).g,pathBlend);
   roughnessFactor=mix(roughnessFactor,texture2D(uForestRough,forestUV).g,litterBlend);
   roughnessFactor=mix(max(roughnessFactor,.86),.34+earthNoise(gp*2.3)*.14,soilWet);
  `);
  const normalChunk=T.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0',
   '(mix(mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(uDirtNormal,dirtUV).xyz,pathBlend),texture2D(uForestNormal,forestUV).xyz,litterBlend)*2.-1.)');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',normalChunk+`
   normal=normalize(mix(nonPerturbedNormal,normal,mix(1.,.76,soilWet)));
   // Centimetre-scale packed-earth lumps add directional grazing highlights.
   // Derivatives in view space compose with the real OpenGL scan normals;
   // this is sub-2cm shading relief, never fictitious traversable mounds.
   float earthRelief=(earthNoise(gp*7.)*.010+earthNoise(gp*21.)*.003)*(1.-pathBlend*.72)*(1.-soilWet*.38);
   vec3 earthDx=dFdx(-vViewPosition),earthDy=dFdy(-vViewPosition);
   vec3 earthR1=cross(earthDy,normal),earthR2=cross(normal,earthDx);float earthDet=dot(earthDx,earthR1);
   normal=normalize(max(abs(earthDet),1e-10)*normal-sign(earthDet)*(dFdx(earthRelief)*earthR1+dFdy(earthRelief)*earthR2));
  `);
  // Small persistent foundation contact in INDIRECT illumination only. Screen
  // AO handles movable and other contacts; never paint black halos in albedo.
  s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=1.-vSurfaceZones.w;');
 };
 material.customProgramCacheKey=()=> 'river-functional-surface-zones-relief-v2';
}

export function foundationWeedPlan(){
 let seed=751119;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const weeds=[];
 const sites=[...houses.map(h=>({x:h.x,z:h.z,w:3.85,d:3.85,yaw:0,id:h.id})),...bufferPlacements.map(p=>({...p,w:4.65,d:5.5}))];
 for(const h of sites)for(let k=0;k<28;k++){
  const side=k%4,along=random()*2-1,offset=.12+random()*.65;
  const x=side<2?(side?1:-1)*(h.w+offset):along*h.w,z=side<2?along*h.d:(side===2?1:-1)*(h.d+offset);
  const c=Math.cos(h.yaw),s=Math.sin(h.yaw),wx=h.x+c*x+s*z,wz=h.z-s*x+c*z;
  if(trafficDistance(wx,wz)<1.65||blocked(wx,wz,.4)||Math.abs(wx)<riverWidth(wz)+2)continue;
  for(let i=0;i<3+Math.floor(random()*5);i++){
   const px=wx+(random()-.5)*.34,pz=wz+(random()-.5)*.34;
   if(trafficDistance(px,pz)<1.5||blocked(px,pz,.3))continue;
   weeds.push({x:px,y:landscapeHeight(px,pz)-.012,z:pz,height:.09+random()*.13,yaw:random()*Math.PI*2,site:h.id,tone:.85+random()*.12});
  }
 }
 return weeds;
}
export async function buildFoundationWeeds(T,world){
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
 const source=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('./river/assets/wild-grass/wild_leafy_b.glb')).scene;
 source.updateMatrixWorld(true);const box=new T.Box3().setFromObject(source),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),plan=foundationWeedPlan(),dummy=new T.Object3D();
 let triangles=0,draws=0;
 source.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.translate(-center.x,-box.min.y,-center.z);g.scale(1/size.y,1/size.y,1/size.y);
  const m=o.material.clone();m.side=T.DoubleSide;m.transparent=false;m.alphaTest=.35;m.roughness=.95;m.metalness=0;m.envMapIntensity=.40;m.normalScale?.multiplyScalar(.4);
  const inst=new T.InstancedMesh(g,m,plan.length);inst.name='foundation-low-wild-weeds';
  plan.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.yaw;dummy.scale.setScalar(p.height);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,new T.Color().setRGB(p.tone*.88,p.tone,p.tone*.75))});
  inst.receiveShadow=true;inst.computeBoundingSphere();world.add(inst);triangles+=(g.index?g.index.count:g.attributes.position.count)/3*plan.length;draws++;
 });
 return{info:()=>({instances:plan.length,triangles,draws,heightRange:[.09,.22],placement:'low side-wall clumps; door/crossing clearances enforced',collision:false})};
}
