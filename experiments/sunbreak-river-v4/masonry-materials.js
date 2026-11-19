// Material-only correction. No geometry, support, collision or random calls.
// Scan input: existing Poly Haven worn_plaster_wall (CC0), local manifest
// suggested tile 1.8m. Core/course grain below is original procedural work;
// no pavement photograph is wrapped around small broken masonry chips.
export const MASONRY_REVISION='masonry-exposed-clay-aggregate-v2';
export const MASONRY_SCALE={plasterTile:1.8,brickLength:.235,courseHeight:.085,mortar:.008,corePatch:.075,aggregateCell:.012};
export const MASONRY_PALETTE=Object.freeze({clay:0x66564a,mortar:0x79776c,aggregate:0x55594f,course:0x7a6857});
const MAPS=['map','normalMap','roughnessMap','aoMap','bumpMap','metalnessMap','displacementMap'];

export function cloneSurfaceMaterial(T,source,color){
 if(!source)throw Error('Masonry source material missing');
 const material=source.clone(),hook=source.onBeforeCompile,key=source.customProgramCacheKey;
 // Three.Material.clone does not copy compile callbacks. Explicit chaining is
 // required for pre-existing atmosphere hooks and subsequent root-owned fog.
 material.onBeforeCompile=function(shader,renderer){hook?.call(this,shader,renderer)};
 material.customProgramCacheKey=()=>key?.call(source)||'';
 for(const slot of MAPS)if(source[slot]){
  material[slot]=source[slot].clone();material[slot].wrapS=material[slot].wrapT=T.RepeatWrapping;
 }
 if(color!==undefined)material.color.set(color);
 return material;
}
export function composeMasonryHook(material,label,hook){
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey,key=previousKey.call(material);
 material.onBeforeCompile=function(shader,renderer){previous?.call(this,shader,renderer);hook.call(this,shader,renderer)};
 material.customProgramCacheKey=()=>key+'|'+MASONRY_REVISION+'|'+label;
 return material;
}
// Scalar field functions are shared with source-derived CPU tests. All inputs
// are metres. These are material masks, never displacement or contact shading.
export const MASONRY_FIELDS_GLSL=`
 float masonryHash2(float x,float y){return fract(sin(x*127.1+y*311.7)*43758.5453);}
 float masonryNoise2(float x,float y){
  float ix=floor(x),iy=floor(y),fx=fract(x),fy=fract(y);
  fx=fx*fx*(3.-2.*fx);fy=fy*fy*(3.-2.*fy);
  return mix(mix(masonryHash2(ix,iy),masonryHash2(ix+1.,iy),fx),mix(masonryHash2(ix,iy+1.),masonryHash2(ix+1.,iy+1.),fx),fy);
 }
 float masonryBinder(float x,float y){
  float warp=masonryNoise2(x*19.+17.,y*19.-9.)-.5;
  return 1.-smoothstep(.32,.49,masonryNoise2(x/${MASONRY_SCALE.corePatch}+warp*.72,y/${MASONRY_SCALE.corePatch}-warp*.49));
 }
 float masonryInclusion(float x,float y,float footprint){
  float px=(x*.8+y*.6)/${MASONRY_SCALE.aggregateCell},py=(y*.8-x*.6)/${MASONRY_SCALE.aggregateCell};
  // Irregular fine aggregate, not circular cells that read as terrazzo dots.
  float grit=masonryNoise2(px,py)*.72+masonryNoise2(px*2.3+3.,py*2.3-7.)*.28;
  return smoothstep(.59,.72,grit)*(1.-smoothstep(.004,.014,footprint));
 }
 float masonryExposure(float coverage,float edgeDistance,float x,float y){
  float chip=masonryNoise2(x*23.+3.,y*23.-17.);
  float rim=.022+.065*chip;
  float missing=step(.001,coverage)*smoothstep(1.-coverage-.08,1.-coverage+.08,masonryNoise2(x*10.-6.,y*10.+31.));
  return max(max(step(.99,coverage),missing),1.-smoothstep(rim,rim+.018,edgeDistance));
 }
 float masonrySoil(float x,float y,float z){
  float soilPatch=masonryNoise2(x*2.7+9.,z*2.7-3.);
  float splash=masonryNoise2(x*18.+z*7.,y*19.-z*11.);
  float reach=.11+.34*soilPatch;
  return (1.-smoothstep(.015,reach,y))*smoothstep(.29,.64,soilPatch)*(.17+.17*splash);
 }
`;
const NOISE=`
 ${MASONRY_FIELDS_GLSL}
 float masonryHash(vec2 p){return masonryHash2(p.x,p.y);}
 float masonryNoise(vec2 p){return masonryNoise2(p.x,p.y);}
 vec3 masonryBump(vec3 n,vec3 viewPos,float h){vec3 dx=dFdx(viewPos),dy=dFdy(viewPos),r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);vec3 gradient=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);return normalize(max(abs(det),1e-10)*n-gradient);}
`;
export function createMasonryMaterial(T,source,{role='plaster',color=0xc1bfb3}={}){
 const material=cloneSurfaceMaterial(T,source,color),plaster=role==='plaster',course=role==='course';
 material.name='masonry-'+role;material.roughness=.94;material.metalness=0;material.envMapIntensity=.32;
 material.normalScale?.set(.38,.38);material.aoMapIntensity=.22;
 // Explicit defaults also make a standalone/test plaster mesh safe. Production
 // batches carry the per-surface mask; no geometry groups/draws are introduced.
 material.defaultAttributeValues={...material.defaultAttributeValues,masonryBreak:[0,10],masonryCore:[0]};
 material.userData={...material.userData,masonry:{revision:MASONRY_REVISION,role,metres:true,...MASONRY_SCALE,source:plaster?'existing CC0 worn_plaster_wall':'original procedural mineral/clay'}};
 if(plaster){
  for(const slot of MAPS)if(material[slot])material[slot].repeat.set(1/MASONRY_SCALE.plasterTile,1/MASONRY_SCALE.plasterTile);
 }else{
  // No whole bricks/pavers/gravel or baked moss lines on raw fracture cores.
  for(const slot of MAPS)material[slot]=null;
 }
 composeMasonryHook(material,role,s=>{
  s.uniforms.uMasonryClay={value:new T.Color(MASONRY_PALETTE.clay)};
  s.uniforms.uMasonryMortar={value:new T.Color(MASONRY_PALETTE.mortar)};
  s.uniforms.uMasonryAggregate={value:new T.Color(MASONRY_PALETTE.aggregate)};
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   varying vec3 vMasonryWorld;varying vec3 vMasonryNormal;
   ${plaster?'attribute vec2 masonryBreak;varying vec2 vMasonryBreak;':''}
   ${course?'attribute float masonryCore;varying float vMasonryCore;':''}`);
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec4 masonryLocal=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    masonryLocal=instanceMatrix*masonryLocal;
   #endif
   vMasonryWorld=(modelMatrix*masonryLocal).xyz;
   vMasonryNormal=normalize(mat3(modelMatrix)*normal);
   ${plaster?'vMasonryBreak=masonryBreak;':''}
   ${course?'vMasonryCore=masonryCore;':''}`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vMasonryWorld;varying vec3 vMasonryNormal;
   uniform vec3 uMasonryClay;uniform vec3 uMasonryMortar;uniform vec3 uMasonryAggregate;
   ${plaster?'varying vec2 vMasonryBreak;':''}
   ${course?'varying float vMasonryCore;':''}
   ${NOISE}`);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   vec3 masonryAxis=abs(normalize(vMasonryNormal));
   vec2 masonryUV=masonryAxis.y>.7?vMasonryWorld.xz:(masonryAxis.x>masonryAxis.z?vMasonryWorld.zy:vMasonryWorld.xy);
   float masonryMacro=masonryNoise(masonryUV*.72),masonryWeather=masonryNoise(masonryUV*2.4+vec2(7.,19.));
   float masonryFootprint=max(length(dFdx(masonryUV)),length(dFdy(masonryUV)));
   float masonryGrain=mix(.5,masonryNoise(masonryUV*250.),1.-smoothstep(.002,.010,masonryFootprint));
   float masonryBinderMask=masonryBinder(masonryUV.x,masonryUV.y);
   float masonryAggregateMask=max(masonryInclusion(masonryUV.x,masonryUV.y,masonryFootprint),masonryInclusion(masonryUV.x*.61+11.,masonryUV.y*.61-5.,masonryFootprint*.61)*.65);
   float masonryFracture=mix(.5,masonryNoise(masonryUV*39.+vec2(12.,6.)),1.-smoothstep(.012,.035,masonryFootprint));
   vec3 masonryRaw=mix(uMasonryClay*(.77+.35*masonryWeather),uMasonryMortar*(.84+.16*masonryMacro),masonryBinderMask);
   masonryRaw=mix(masonryRaw,uMasonryAggregate*(.8+.45*masonryWeather),masonryAggregateMask);
   masonryRaw*=.86+.20*masonryFracture+.08*masonryGrain;
   float masonryCoreMix=${plaster?'masonryExposure(vMasonryBreak.x,vMasonryBreak.y,masonryUV.x,masonryUV.y)':course?'max(vMasonryCore,smoothstep(.65,.90,masonryAxis.y))':'1.'};
   float masonryJoint=0.;
   ${course?`
   float masonryRow=floor(vMasonryWorld.y/${MASONRY_SCALE.courseHeight});
   vec2 masonryCourse=vec2(masonryUV.x/${MASONRY_SCALE.brickLength}+.5*mod(masonryRow,2.),vMasonryWorld.y/${MASONRY_SCALE.courseHeight});
   vec2 masonryEdge=min(fract(masonryCourse),1.-fract(masonryCourse))*vec2(${MASONRY_SCALE.brickLength},${MASONRY_SCALE.courseHeight});
   float masonryAA=max(fwidth(masonryUV.x),fwidth(vMasonryWorld.y));
   masonryJoint=(1.-smoothstep(.0035,.0055+masonryAA,min(masonryEdge.x,masonryEdge.y)))*(1.-masonryCoreMix);
   float masonryBrickTone=masonryHash(vec2(floor(masonryCourse.x),masonryRow));
   vec3 masonryClay=diffuse*mix(vec3(.70,.76,.80),vec3(1.06,1.02,.94),masonryBrickTone)*(.90+.15*masonryFracture);
   diffuseColor.rgb=mix(mix(masonryClay,uMasonryMortar*.80,masonryJoint),masonryRaw,masonryCoreMix);
   `:plaster?`
   // Preserve photographed fine plaster; avoid multiplying a dark tint and a
   // high-contrast baked stain into a third, artificially dirty surface.
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuse,.42)*(.92+.11*masonryMacro);
   diffuseColor.rgb*=mix(vec3(.94,.93,.90),vec3(1.),masonryWeather);
   diffuseColor.rgb=mix(diffuseColor.rgb,masonryRaw,masonryCoreMix);
   `:`
   diffuseColor.rgb=${role==='core'?'masonryRaw':`mix(diffuse*(.70+.25*masonryMacro+.16*masonryFracture),masonryRaw,${role==='aggregate'?'.42':'.18'})`};
   `}
   float masonryDirt=masonrySoil(vMasonryWorld.x,vMasonryWorld.y,vMasonryWorld.z);
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.095,.072,.045),masonryDirt);
   float masonryRelief=(masonryGrain-.5)*.00065-masonryJoint*.0014;
   masonryRelief+=masonryCoreMix*((masonryFracture-.5)*.0024-masonryBinderMask*.0016+masonryAggregateMask*.0013);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=clamp(max(roughnessFactor,.85)+masonryDirt*.04,.85,.98);`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   ${plaster?'normal=normalize(mix(normal,nonPerturbedNormal,masonryCoreMix));':''}
   normal=masonryBump(normal,-vViewPosition,masonryRelief);`);
 });
 return material;
}
