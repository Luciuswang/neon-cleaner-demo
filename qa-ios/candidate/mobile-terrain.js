// mobile-terrain.js: baked PC-look terrain, shallow river and pebbles for mobile (3 extra draws).
import {MAP,riverWidth,landscapeHeight} from './map-layout.js';
import {installTerrainRaycast} from './terrain-ray.js';
import {surfaceZones} from './ground-surface.js';
import {forestCover} from './forest-floor.js';
import {afterRainBasin} from './afterrain-ground.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const num=(v,...keys)=>{if(typeof v==='number')return v;for(const k of keys)if(typeof v?.[k]==='number')return v[k];return 0};
const IDS=['mud','dirt','wood','stone','plaster','brick','metal','forest_ground_04'];
const SIZE=180,SEG=180,HALF=SIZE/2;

export async function buildMobileTerrain({T,rnd,world,solids}){
 const loader=new T.TextureLoader(),aniso=Math.min(4,rnd.capabilities.getMaxAnisotropy());
 async function tex(path,color,flipY){
  const t=await loader.loadAsync(path);
  t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=aniso;
  if(flipY===false)t.flipY=false;
  return t;
 }
 const materials={};
 // Eight baked desktop procedural surfaces.
 await Promise.all(IDS.map(async id=>{
  const base='./river/assets/mobile-look/'+id+'-';
  const [map,normalMap,roughnessMap]=await Promise.all([tex(base+'color.jpg',true,false),tex(base+'normal.jpg',false,false),tex(base+'roughness.jpg',false,false)]);
  const m=new T.MeshStandardMaterial({map,normalMap,roughnessMap,roughness:1,metalness:id==='metal'?.6:0});
  m.normalScale.set(.65,.65);m.envMapIntensity=.7;m.name=id;materials[id]=m;
 }));
 // Roof and bark come from the shared manifest (paths read from JSON).
 const shared=await fetch('./assets-manifest.json').then(r=>{if(!r.ok)throw Error('assets-manifest.json');return r.json()});
 const roles={roof_terracotta:'roof',tree_bark:'bark'};
 const keys={base_color:'map',color:'map',normal_opengl:'normalMap',normal:'normalMap',roughness:'roughnessMap'};
 await Promise.all(shared.assets.filter(a=>roles[a.semantic_role]).map(async a=>{
  const m=new T.MeshStandardMaterial({roughness:.85,metalness:0});
  await Promise.all(a.files.map(async f=>{const k=keys[f.role];if(k)m[k]=await tex(f.path,k==='map')}));
  m.normalScale.set(.65,.65);m.envMapIntensity=.7;m.name=roles[a.semantic_role];materials[m.name]=m;
 }));

 // ---- Terrain: 180 m grid, 180 segments ----
 const n=SEG+1,count=n*n;
 const pos=new Float32Array(count*3),uv=new Float32Array(count*2),tan=new Float32Array(count*4),zone=new Float32Array(count*4);
 for(let j=0,v=0;j<n;j++)for(let i=0;i<n;i++,v++){
  const x=-HALF+i*SIZE/SEG,z=-HALF+j*SIZE/SEG;
  pos.set([x,landscapeHeight(x,z),z],v*3);uv.set([x/3,z/3],v*2);tan.set([1,0,0,1],v*4);
  const s=surfaceZones(x,z)||{},sd=Math.abs(x)-Math.abs(riverWidth(z));
  // Zone names are read defensively: the return of surfaceZones was not visible here.
  const path=Math.max(num(s.path??s.traffic),.8*num(s.foundation));
  const bank=1-smooth(-.2,2.4,sd);                       // wet mud only; no dry bank strip outside the river
  const forest=Math.max(num(s.forest??s.litter),forestCover(x,z))*(1-bank);
  const puddle=num(afterRainBasin(x,z),'wet','puddle','depth','basin','value')*smooth(.2,1.2,sd);
  zone.set([clamp(path),clamp(forest),bank,clamp(puddle)],v*4);
 }
 const idx=new Uint16Array(SEG*SEG*6);
 for(let j=0,k=0;j<SEG;j++)for(let i=0;i<SEG;i++){const a=j*n+i;idx.set([a,a+n,a+1,a+1,a+n,a+n+1],k);k+=6}
 const geo=new T.BufferGeometry();
 geo.setAttribute('position',new T.BufferAttribute(pos,3));
 geo.setAttribute('uv',new T.BufferAttribute(uv,2));
 geo.setAttribute('tangent',new T.BufferAttribute(tan,4));
 geo.setAttribute('aZone',new T.BufferAttribute(zone,4));
 geo.setIndex(new T.BufferAttribute(idx,1));
 geo.computeVertexNormals();geo.computeBoundingSphere();geo.computeBoundingBox();

 // Terrain uses the real PC dirt map/normal plus two extra samplers (mud, forest floor).
 const ground=new T.MeshStandardMaterial({map:materials.dirt.map,normalMap:materials.dirt.normalMap,roughness:.92,metalness:0});
 ground.normalScale.set(.65,.65);ground.envMapIntensity=.7;ground.name='terrain';
 const gu={uMud:{value:materials.mud.map},uForest:{value:materials.forest_ground_04.map}};
 ground.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,gu);
  sh.vertexShader=sh.vertexShader
   .replace('#include <common>','#include <common>\nattribute vec4 aZone;varying vec4 vZone;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvZone=aZone;');
  sh.fragmentShader=sh.fragmentShader
   .replace('#include <common>','#include <common>\nuniform sampler2D uMud,uForest;varying vec4 vZone;')
   .replace('#include <map_fragment>',`
    vec3 gD=texture2D(map,vMapUv).rgb,gM=texture2D(uMud,vMapUv).rgb,gF=texture2D(uForest,vMapUv*.7).rgb;
    float pud=smoothstep(.35,.75,vZone.w),wet=max(vZone.z,vZone.w);
    vec3 gC=mix(mix(gF*vec3(.85,1.,.7),gF,vZone.y),gD,vZone.x);   // grass -> forest floor -> worn path
    gC=mix(gC,gM,vZone.z)*mix(1.,.55,wet);                         // wet bank mud, moisture darkening
    diffuseColor.rgb*=mix(gC,gC*.45,pud);`)
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*mix(1.,.5,wet)*mix(1.,.1,pud);')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,pud));');
 };
 ground.customProgramCacheKey=()=>'mobile-terrain-ground-v1';
 materials.terrain=ground;
 const terrain=new T.Mesh(geo,ground);
 terrain.name='mobile-terrain';terrain.receiveShadow=true;
 installTerrainRaycast(T,terrain,SEG,SEG);
 world.add(terrain);solids?.push?.(terrain);

 // ---- River: transparent ribbon following riverWidth(z) ----
 const rp=new Float32Array(n*2*3),rn=new Float32Array(n*2*3),ri=new Uint16Array(SEG*6);
 for(let k=0;k<n;k++){
  const z=-HALF+k*SIZE/SEG,w=Math.abs(riverWidth(z))+.35;
  const y=MAP.waterY;
  rp.set([-w,y,z,w,y,z],k*6);rn.set([0,1,0,0,1,0],k*6);
  if(k<SEG){const a=k*2;ri.set([a,a+2,a+1,a+1,a+2,a+3],k*6)}
 }
 const rgeo=new T.BufferGeometry();
 rgeo.setAttribute('position',new T.BufferAttribute(rp,3));
 rgeo.setAttribute('normal',new T.BufferAttribute(rn,3));
 rgeo.setIndex(new T.BufferAttribute(ri,1));
 const water=new T.MeshStandardMaterial({color:0x2f4a44,roughness:.06,metalness:0,transparent:true,depthWrite:false});
 water.envMapIntensity=1.2;water.name='river';
 const time={value:0};
 water.onBeforeCompile=sh=>{
  sh.uniforms.uTime=time;
  sh.vertexShader=sh.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vWp;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader
   .replace('#include <common>','#include <common>\nuniform float uTime;varying vec3 vWp;')
   .replace('#include <normal_fragment_maps>',`
    vec2 wp=vWp.xz;float wt=uTime;
    vec2 rip=vec2(cos(wp.x*3.1+wp.y*1.3+wt*1.7)+.6*cos(wp.x*7.3-wp.y*2.1-wt*2.3),
                  cos(wp.y*2.3-wt*2.9+wp.x*.7)+.6*cos(wp.y*5.9+wp.x*3.3+wt*1.9))*.045;
    normal=normalize(normal+(viewMatrix*vec4(rip.x,0.,rip.y,0.)).xyz);
    float fres=pow(1.-abs(dot(normal,normalize(vViewPosition))),3.);
    diffuseColor.a=mix(.3,.92,fres);`);   // Fresnel: clear when looking down, reflective at grazing angles
 };
 water.customProgramCacheKey=()=>'mobile-terrain-river-v1';
 materials.river=water;
 const river=new T.Mesh(rgeo,water);
 river.name='mobile-river';river.renderOrder=2;
 world.add(river);

 // ---- Sunken pebble clumps: one instanced draw of real geometry ----
 let seed=0x9e3779b9;
 const rand=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
 const CLUMPS=60,PER=7;
 const pebbles=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),materials.stone,CLUMPS*PER);
 const d=new T.Object3D();
 for(let c=0,i=0;c<CLUMPS;c++){
  const cz=-HALF+2+rand()*(SIZE-4),cx=(rand()*2-1)*Math.abs(riverWidth(cz))*.75;
  for(let p=0;p<PER;p++,i++){
   const z=cz+(rand()-.5)*1.4,lim=Math.abs(riverWidth(z))*.9,x=Math.max(-lim,Math.min(lim,cx+(rand()-.5)*1.4)),s=.06+rand()*.14;
   d.position.set(x,landscapeHeight(x,z)+s*.2,z);
   d.rotation.set(rand()*6.28,rand()*6.28,rand()*6.28);
   d.scale.set(s,s*.55,s*(.7+rand()*.5));
   d.updateMatrix();pebbles.setMatrixAt(i,d.matrix);
  }
 }
 pebbles.instanceMatrix.needsUpdate=true;pebbles.name='mobile-pebbles';pebbles.receiveShadow=true;
 pebbles.computeBoundingSphere?.();
 world.add(pebbles);

 return {materials,update(t){time.value=t}};
}
