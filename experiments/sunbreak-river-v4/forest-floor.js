// Original, texture-free understory. Terrain colour is integrated by the caller;
// these meshes add silhouettes only, never terrain, navigation or collision.
import {MAP,TERRAIN_GRID,riverWidth,landscapeHeight} from './map-layout.js';

export const FOREST_FLOOR_REVISION='river-forest-floor-v1';
export const FOREST_FLOOR_LIMITS=Object.freeze({
 seed:0x46f07a21,terrainHalfExtent:TERRAIN_GRID.size/2,
 maxTufts:5600,bladesPerTuft:10,trianglesPerBlade:3,
 maxTriangles:180000,maxDrawCalls:8,maxHeight:.42,rootSink:.012,
});
const TAU=Math.PI*2;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
const pathDistance=(x,z)=>Math.abs(Math.abs(x)-(10+.32*Math.sin(z*.19)));
// The complete playable rectangle, including all foundations, door approaches,
// crossings, cover and spawn pads, stays brown. Do NOT call blocked() here: its
// outside-map result is true even on the forested terrain shoulders.
function villageDistance(x,z){
 const dx=Math.max(MAP.minX-x,0,x-MAP.maxX),dz=Math.max(MAP.minZ-z,0,z-MAP.maxZ);
 return Math.hypot(dx,dz);
}
function hash(x,z){
 let h=Math.imul(x,374761393)^Math.imul(z,668265263)^FOREST_FLOOR_LIMITS.seed;
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
}
function noise(x,z){
 const ix=Math.floor(x),iz=Math.floor(z),fx=smooth(0,1,x-ix),fz=smooth(0,1,z-iz);
 return mix(mix(hash(ix,iz),hash(ix+1,iz),fx),mix(hash(ix,iz+1),hash(ix+1,iz+1),fx),fz);
}
function randomStream(seed){
 let state=seed>>>0;
 return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
}

// Continuous metre-space carpet, including the hills beyond the old 90m grass
// limit. Broad coverage is independent of the finite number of 3D clumps.
// Evaluate on terrain-local x/z; world uses an untransformed terrain mesh.
export function forestCover(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
 const edge=FOREST_FLOOR_LIMITS.terrainHalfExtent-Math.max(Math.abs(x),Math.abs(z));
 const village=villageDistance(x,z),bank=Math.abs(x)-riverWidth(z),path=pathDistance(x,z);
 if(edge<=0||village<=1||bank<=2.8||path<=1.85)return 0;
 const broad=noise(x*.055,z*.055),detail=noise(x*.19+9.3,z*.19-4.1);
 const border=smooth(1,7.5+(broad-.5)*3,village);
 return clamp(border*smooth(2.8,6.3,bank)*smooth(1.85,3.4,path)*smooth(0,1.25,edge)*(.72+.22*broad+.06*detail));
}

export function applyForestAttributes(T,geometry){
 const p=geometry.getAttribute('position'),data=new Float32Array(p.count);
 for(let i=0;i<p.count;i++)data[i]=forestCover(p.getX(i),p.getZ(i));
 geometry.setAttribute('forestCover',new T.BufferAttribute(data,1));
 return geometry;
}

// Conservative whole-footprint clearance, including wind. The derivative
// bounds of riverWidth and the wandering longitudinal lanes cover every point
// of the footprint, not just a handful of sampled circle points.
export function forestAllowed(x,z,radius=0){
 if(!Number.isFinite(radius)||radius<0||forestCover(x,z)<.2)return false;
 return Math.max(Math.abs(x),Math.abs(z))+radius<FOREST_FLOOR_LIMITS.terrainHalfExtent-.25
  &&villageDistance(x,z)>1+radius
  &&Math.abs(x)-riverWidth(z)>2.8+radius*1.301
  &&pathDistance(x,z)>1.85+radius*1.061;
}

// Grove centres mirror the existing near forest's regions, not its RNG or tree
// placements. Additional continuous candidates join them into uneven swathes.
const GROVES=[[-43,-29],[-44,-8],[-43,17],[43,-28],[45,-7],[43,18],
 [-25,-45],[1,-48],[26,-45],[-24,39],[2,43],[26,39]];

export function forestFloorPlan(){
 const random=randomStream(FOREST_FLOOR_LIMITS.seed),clusters=[],tufts=[],occupied=new Map(),cell=.16;
 function reserve(x,z){
  const ix=Math.floor(x/cell),iz=Math.floor(z/cell);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   for(const p of occupied.get(`${ix+dx},${iz+dz}`)||[])if(Math.hypot(x-p.x,z-p.z)<cell)return false;
  }
  const key=`${ix},${iz}`;if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push({x,z});return true;
 }
 for(let attempt=0;attempt<2200&&clusters.length<360&&tufts.length<FOREST_FLOOR_LIMITS.maxTufts;attempt++){
  let x,z;
  if(attempt<GROVES.length*12){
   const g=GROVES[Math.floor(attempt/12)];x=g[0]+(random()-.5)*12;z=g[1]+(random()-.5)*12;
  }else{
   const region=random(),extent=region<.62?64:region<.88?98:FOREST_FLOOR_LIMITS.terrainHalfExtent-1;
   x=(random()*2-1)*extent;z=(random()*2-1)*extent;
  }
  if(!forestAllowed(x,z,.6))continue;
  const c={id:clusters.length,x,z,rx:2.5+random()*4.7,rz:1.7+random()*3.5,
   yaw:random()*TAU,phase:random()*TAU,tone:noise(x*.09,z*.09),tufts:0};
  const count=17+Math.floor(random()*15),cos=Math.cos(c.yaw),sin=Math.sin(c.yaw);
  for(let j=0;j<count&&tufts.length<FOREST_FLOOR_LIMITS.maxTufts;j++){
   const a=random()*TAU,r=Math.sqrt(random()),edge=1+.20*Math.sin(a*3+c.phase)+.12*Math.cos(a*5-c.phase);
   const u=Math.cos(a)*r*c.rx*edge,v=Math.sin(a)*r*c.rz*edge;
   const px=x+u*cos-v*sin,pz=z+u*sin+v*cos;
   const population=random(),layer=population<.52?0:population<.90?1:2;
   const height=layer===0?.09+random()*.075:layer===1?.17+random()*.10:.28+random()*.14;
   const spread=.11+random()*.15,radius=spread+height*(.43+.18)+.04;
   if(!forestAllowed(px,pz,radius)||!reserve(px,pz))continue;
   tufts.push({x:px,y:landscapeHeight(px,pz)-FOREST_FLOOR_LIMITS.rootSink,z:pz,height,spread,radius,layer,
    yaw:random()*TAU,phase:random()*TAU,tone:c.tone,cluster:c.id,seed:Math.floor(random()*4294967296)});
   c.tufts++;
  }
  if(c.tufts)clusters.push(c);
 }
 return {seed:FOREST_FLOOR_LIMITS.seed,clusters,tufts};
}

// Branch-free custom shader code. Standard material lighting, shadow receive,
// fog and colour-space/tone mapping chunks remain supplied by Three.js.
export const FOREST_WIND_GLSL=`
 uniform float forestTime;
 attribute vec3 forestBlade;
 varying float vForestBladeHeight;
 vec2 forestWind(float phase){
  return vec2(.12*(sin(forestTime*1.23+phase)+.35*sin(forestTime*2.07+phase*1.7)),
              .06*cos(forestTime*.91+phase));
 }
`;
export const FOREST_ROOT_SHADE_GLSL=`
 diffuseColor.rgb*=mix(.63,1.,smoothstep(.02,.72,vForestBladeHeight));
`;

function makeGeometry(T,tufts){
 const vertexCount=tufts.length*FOREST_FLOOR_LIMITS.bladesPerTuft*5;
 const positions=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3),blade=new Float32Array(vertexCount*3);
 const indices=new Uint32Array(tufts.length*FOREST_FLOOR_LIMITS.bladesPerTuft*9);
 let vertex=0,index=0;
 for(const p of tufts){
  const random=randomStream(p.seed);
  for(let b=0;b<FOREST_FLOOR_LIMITS.bladesPerTuft;b++){
   const angle=random()*TAU,rad=Math.sqrt(random())*p.spread;
   const x=p.x+Math.cos(angle)*rad,z=p.z+Math.sin(angle)*rad;
   const yaw=p.yaw+random()*TAU,dx=Math.cos(yaw),dz=Math.sin(yaw);
   const lean=yaw+(random()-.5)*1.2,lx=Math.cos(lean),lz=Math.sin(lean);
   const height=p.height*(.56+random()*.44),bend=height*(.18+random()*.25);
   const width=(p.layer===0?.035:.022)+random()*.024,phase=p.phase+(random()-.5)*.7;
   const tone=.88+p.tone*.18+random()*.06,first=vertex;
   // Two tapered sections and an actual pointed tip, never alpha-cut cards.
   for(const [t,side]of [[0,-1],[0,1],[.52,-.64],[.52,.64],[1,0]]){
    const px=x+lx*bend*t*t-dz*width*.5*side,pz=z+lz*bend*t*t+dx*width*.5*side;
    const k=vertex*3;positions[k]=px;positions[k+1]=landscapeHeight(px,pz)+height*t-FOREST_FLOOR_LIMITS.rootSink;positions[k+2]=pz;
    colors[k]=(.068+.029*t)*tone;colors[k+1]=(.143+.052*t)*tone;colors[k+2]=(.023+.013*t)*tone;
    blade[k]=t;blade[k+1]=phase;blade[k+2]=height;vertex++;
   }
   indices.set([first,first+1,first+2,first+1,first+3,first+2,first+2,first+3,first+4],index);index+=9;
  }
 }
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3));
 geometry.setAttribute('color',new T.BufferAttribute(colors,3));
 geometry.setAttribute('forestBlade',new T.BufferAttribute(blade,3));geometry.setIndex(new T.BufferAttribute(indices,1));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 // Max horizontal sway is hypot(.162,.06)*height < .18*height.
 const windMargin=FOREST_FLOOR_LIMITS.maxHeight*.18;
 geometry.boundingBox.expandByScalar(windMargin);geometry.boundingSphere.radius+=windMargin;
 return geometry;
}

export function buildForestFloor(T,world){
 const plan=forestFloorPlan(),time={value:0},meshes=[];
 const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.88,metalness:0,side:T.DoubleSide});
 material.name=FOREST_FLOOR_REVISION;material.envMapIntensity=.65;material.forceSinglePass=true;
 material.onBeforeCompile=shader=>{
  shader.uniforms.forestTime=time;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\n${FOREST_WIND_GLSL}`)
   .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
    vec2 forestShear=forestWind(forestBlade.y)*2.*forestBlade.x;
    objectNormal=normalize(vec3(objectNormal.x,objectNormal.y-dot(objectNormal.xz,forestShear),objectNormal.z));`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vForestBladeHeight=forestBlade.x;
    transformed.xz+=forestWind(forestBlade.y)*forestBlade.z*forestBlade.x*forestBlade.x;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vForestBladeHeight;')
   .replace('#include <color_fragment>',`#include <color_fragment>\n${FOREST_ROOT_SHADE_GLSL}`);
 };
 material.customProgramCacheKey=()=>FOREST_FLOOR_REVISION;
 // Four compass sectors, each split into near/far. No extra depth/shadow draws.
 const sectors=Array.from({length:FOREST_FLOOR_LIMITS.maxDrawCalls},()=>[]);
 for(const p of plan.tufts){const sector=(p.x>=0?1:0)+(p.z>=-4?2:0)+(Math.max(Math.abs(p.x),Math.abs(p.z+4))>70?4:0);sectors[sector].push(p)}
 for(let i=0;i<sectors.length;i++){
  if(!sectors[i].length)continue;
  const mesh=new T.Mesh(makeGeometry(T,sectors[i]),material);mesh.name=`forest-floor-${i}`;
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.userData.forestFloor={sector:i,tufts:sectors[i].length};world.add(mesh);meshes.push(mesh);
 }
 const triangles=meshes.reduce((n,m)=>n+m.geometry.index.count/3,0);
 const layers=plan.tufts.reduce((n,p)=>{n[p.layer]++;return n},[0,0,0]);
 return {
  update(seconds){if(Number.isFinite(seconds))time.value=seconds},
  info(){return {revision:FOREST_FLOOR_REVISION,seed:plan.seed,tufts:plan.tufts.length,clusters:plan.clusters.length,
   blades:plan.tufts.length*FOREST_FLOOR_LIMITS.bladesPerTuft,layers:[...layers],triangles,drawCalls:meshes.length,
   shadowCalls:0,shadowTriangles:0,terrainHalfExtent:FOREST_FLOOR_LIMITS.terrainHalfExtent,
   source:'code-generated tapered blades; no external textures/assets',
   groundCover:'forestCover attribute on unchanged terrain, blended by caller',
   limits:{triangles:FOREST_FLOOR_LIMITS.maxTriangles,drawCalls:FOREST_FLOOR_LIMITS.maxDrawCalls},
   validation:'CPU geometry/placement only; visual, wind motion and frame pacing require root integration QA'}},
 };
}
