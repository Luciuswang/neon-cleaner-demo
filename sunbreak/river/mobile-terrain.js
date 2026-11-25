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
  const puddle=(1-smooth(.33,.45,num(afterRainBasin(x,z),'wet','puddle','depth','basin','value')))*smooth(.2,1.2,sd);
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
 const pebbleMap=await tex('./river/assets/afterrain-detail/ganges_river_pebbles/color.jpg',true);
 const gu={uMud:{value:materials.mud.map},uForest:{value:materials.forest_ground_04.map},uPebble:{value:pebbleMap}};
 ground.onBeforeCompile=sh=>{
  Object.assign(sh.uniforms,gu);
  sh.vertexShader=sh.vertexShader
   .replace('#include <common>','#include <common>\nattribute vec4 aZone;varying vec4 vZone;varying vec2 vGp;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvZone=aZone;vGp=(modelMatrix*vec4(transformed,1.)).xz;');
  sh.fragmentShader=sh.fragmentShader
   .replace('#include <common>','#include <common>\nuniform sampler2D uMud,uForest,uPebble;varying vec4 vZone;varying vec2 vGp;')
   .replace('#include <map_fragment>',`
    vec3 gD=texture2D(map,vMapUv).rgb,gM=texture2D(uMud,vMapUv).rgb,gF=texture2D(uForest,vMapUv*.7).rgb,gP=texture2D(uPebble,vMapUv*1.7).rgb;
    float gN=smoothstep(.2,.7,texture2D(map,vMapUv*.19+.37).g),gB=smoothstep(.15,.65,texture2D(uForest,vMapUv*.043+.11).r);
    float pud=smoothstep(.47,.55,vZone.w+(gN-.5)*.22),wet=max(vZone.z,pud),rim=pud*(1.-pud)*4.;
    float rS=vGp.x<0.?-1.:1.,rW=smoothstep(8.,13.,vGp.y)*(1.-smoothstep(31.,36.,vGp.y));
    float rD=min(abs(abs(abs(vGp.x)-(10.+.55*sin(vGp.y*.16-rS*.8)+.25*sin(vGp.y*.53+2.)))-.75),abs(abs(vGp.x+26.-.7*sin((vGp.y-22.)*.19))-.75)+(1.-rW)*9.);
    float rN=.5+.5*sin(vGp.y*5.3+sin(vGp.y*1.7+vGp.x*2.1)*2.5),rM=(1.-vZone.y*.5)*(1.-pud);
    float rG=(1.-smoothstep(.08,.24+.06*rN,rD))*rM,rR=smoothstep(.16,.3,rD)*(1.-smoothstep(.34,.52,rD))*(.45+.55*rN)*rM;
    pud=max(pud,rG*smoothstep(.35,.7,sin(vGp.y*.83+rS*2.)*sin(vGp.y*.29+1.)));
    float foot=(max(vZone.x*smoothstep(.5,.72,texture2D(uMud,vMapUv*.83+.5).g)*1.25,rG*.9)-rR*.3)*(1.-pud);
    vec2 bq=vec2(abs(vGp.x)-(21.5+.35*sin(vGp.y*.4)),vGp.y-(21.+.3*sin(vGp.x*.5)));
    float bA=step(abs(bq.y),.4)*step(12.,abs(vGp.x))*step(abs(vGp.x),30.),bW=max(bA,step(abs(bq.x),.4)*step(14.,vGp.y)*step(vGp.y,29.));
    vec2 bt=bA>.5?vec2(abs(vGp.x),bq.y):vec2(vGp.y,bq.x);
    float bi=floor(bt.x/.74),bs=mod(bi,2.)*2.-1.,bH=fract(sin(bi*12.99+bA*7.)*43758.5);
    vec2 bp=vec2(fract(bt.x/.74)*.74-.37,bt.y-bs*.11);
    float bS=min(length(vec2(max(abs(bp.x-.05)-.04,0.),bp.y))-.05,length(vec2(bp.x+.09,bp.y))-.04),bM=bW*step(.25,bH)*(1.-vZone.y)*(1.-pud);
    float bF=(1.-smoothstep(-.01,.012,bS))*bM,bR=smoothstep(0.,.02,bS)*(1.-smoothstep(.03,.06,bS))*bM;
    foot=max(foot,bF*.95)-bR*.35;pud=max(pud,bF*step(.8,bH)*.8);
    float soil=max(vZone.x,(1.-vZone.y)*smoothstep(.4,.6,gB+(gN-.5)*.3)*.75);
    vec3 gC=mix(mix(gF*vec3(.85,1.,.7),gF,vZone.y),gD*vec3(.84,.74,.62),soil)*mix(.72,1.06,gB);   // grass -> forest floor -> worn path
    gC=mix(gC,mix(gM*.7,gP*.8,smoothstep(.5,.95,vZone.z+(gN-.5)*.3)),vZone.z)*mix(1.,.7,foot)*mix(1.,.8,rim);                         // wet bank mud, moisture darkening
    diffuseColor.rgb*=mix(gC,gM*vec3(.34,.31,.27),pud);`)
   .replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*mix(1.,.78,vZone.z*gN)*mix(1.,.62,foot);roughnessFactor=mix(roughnessFactor,.08,pud*(1.-.8*rim));')
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,pud));');
 };
 ground.customProgramCacheKey=()=>'mobile-terrain-ground-v4';
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
 const water=new T.MeshStandardMaterial({color:0x4a4a3a,roughness:.2,metalness:0,transparent:true,depthWrite:false});
 water.envMapIntensity=.55;water.name='river';
 const time={value:0};
 water.onBeforeCompile=sh=>{
  sh.uniforms.uTime=time;
  sh.vertexShader=sh.vertexShader
   .replace('#include <common>','#include <common>\nvarying vec3 vWp;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvWp=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader
   .replace('#include <common>','#include <common>\nuniform float uTime;varying vec3 vWp;float wH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float wN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(wH(i),wH(i+vec2(1.,0.)),f.x),mix(wH(i+vec2(0.,1.)),wH(i+1.),f.x),f.y);}')
   .replace('#include <normal_fragment_maps>',`
    vec2 wp=vWp.xz;float wt=uTime;
    vec2 rip=vec2(cos(wp.x*3.1+wp.y*1.3+wt*1.7)+.6*cos(wp.x*7.3-wp.y*2.1-wt*2.3),
                  cos(wp.y*2.3-wt*2.9+wp.x*.7)+.6*cos(wp.y*5.9+wp.x*3.3+wt*1.9))*.014;
    vec2 wf=wp*vec2(8.,4.5)+vec2(0.,wt*2.4),wg=wp*vec2(19.,11.)+vec2(wt*.6,wt*3.8);
    float w0=wN(wf),w1=wN(wg);
    rip+=vec2(wN(wf+vec2(.4,0.))-w0,wN(wf+vec2(0.,.4))-w0)*.16+vec2(wN(wg+vec2(.4,0.))-w1,wN(wg+vec2(0.,.4))-w1)*.09;
    float wk=wN(wp*vec2(1.7,.8)+vec2(w0*.6,wt*.4));
    roughnessFactor=mix(.12,.34,wk);
    normal=normalize(normal+(viewMatrix*vec4(rip.x,0.,rip.y,0.)).xyz);
    float fres=pow(1.-abs(dot(normal,normalize(vViewPosition))),4.);
    diffuseColor.rgb*=mix(.7,1.1,w0);
    diffuseColor.a=mix(.12,.58,fres)*mix(.65,1.,wk);`);   // Fresnel: clear when looking down, reflective at grazing angles
 };
 water.customProgramCacheKey=()=>'mobile-terrain-river-v2';
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
