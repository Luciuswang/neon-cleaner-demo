// Wet/dry height-correlated material response adapted from the accepted lab.
// Lab utilities: Copyright (c) 2026 wquguru, MIT; see PROCEDURAL-NOTICE.txt.
// Valley zoning and r160 integration are original. No geometry/displacement.
import {SOIL_MOISTURE_GLSL} from './ground-moisture.js';

export const PROCEDURAL_GROUND_REVISION='river-procedural-surface-v1';
export const FILTERED_WATER_GLSL=`
 vec2 valleyWaterHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
 vec2 valleyWaterSlope(vec2 p,float time,float footprint){
  vec2 q=p*1.45,cell=floor(q),s=vec2(0.);
  float filtered=1.-smoothstep(.012,.045,footprint);
  if(filtered>.001){
   for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 id=cell+vec2(float(x),float(y)),rnd=valleyWaterHash(id),d=q-id-rnd;
    float r=length(d),age=fract(time*(.48+rnd.y*.22)+rnd.x);
    float ring=r-age*(.65+rnd.y*.3);
    float envelope=exp(-ring*ring*240.)*smoothstep(0.,.12,age)*(1.-age)*(1.-age);
    s+=d/max(r,.001)*sin(ring*62.)*envelope*(.05+rnd.y*.035);
   }
  }
  return s*filtered;
 }
`;

export function installProceduralGround(T,material,{dirt,forest,rain,time}){
 material.color.set(0xffffff);material.roughness=1;material.metalness=0;
 material.normalScale.set(1,1);material.envMapIntensity=.75;
 // Geometry UVs stay byte-identical (x/3,z/3). Correct only this material's
 // transforms to the baker's 2.4m physical tile; clones share pixel storage.
 for(const slot of ['map','normalMap','roughnessMap','aoMap'])if(material[slot]){
  material[slot]=material[slot].clone();material[slot].repeat.set(3/2.4,3/2.4);
 }
 material.userData.proceduralGround={revision:PROCEDURAL_GROUND_REVISION,
  zones:'unchanged traffic/foundation/forest attributes; actual river wetness',
  reflection:'physical sky/environment specular; no planar terrain reflection',
  tiles:{mud:2.4,path:2.4,litter:2.7},perFrameBakes:0};
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{uDirtColor:{value:dirt.map},uDirtNormal:{value:dirt.normalMap},uDirtRough:{value:dirt.roughnessMap},uForestColor:{value:forest.map},uForestNormal:{value:forest.normalMap},uForestRough:{value:forest.roughnessMap},soilRain:rain,valleyTime:time});
  // Describe the actual six bound custom samplers, not merely allocated bakes.
  material.userData.proceduralGround.samplers=Object.fromEntries(['uDirtColor','uDirtNormal','uDirtRough','uForestColor','uForestNormal','uForestRough'].map(name=>{
   const t=s.uniforms[name].value;return[name,{name:t.name,source:t.isDataTexture?'generated':'external',size:[t.image?.width,t.image?.height],colorSpace:t.colorSpace,mipmaps:t.generateMipmaps,coordinates:'world.xz / tileMetres',tileMetres:name.startsWith('uDirt')?2.4:2.7}];
  }));
  s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
   attribute vec4 surfaceZones;varying vec4 vSurfaceZones;
   varying vec3 vGroundWorld;varying float vGroundSlope;`)
   .replace('#include <begin_vertex>',`#include <begin_vertex>
    vSurfaceZones=surfaceZones;vGroundWorld=(modelMatrix*vec4(position,1.)).xyz;
    vGroundSlope=1.-abs((modelMatrix*vec4(normal,0.)).y);`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
   varying vec4 vSurfaceZones;varying vec3 vGroundWorld;varying float vGroundSlope;
   uniform float soilRain,valleyTime;
   uniform sampler2D uDirtColor,uDirtNormal,uDirtRough,uForestColor,uForestNormal,uForestRough;
   ${SOIL_MOISTURE_GLSL}
   ${FILTERED_WATER_GLSL}
   float valleyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float valleyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(valleyHash(i),valleyHash(i+vec2(1,0)),f.x),mix(valleyHash(i+vec2(0,1)),valleyHash(i+1.),f.x),f.y);}
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
   vec2 gp=vGroundWorld.xz,dirtUV=gp/2.4,forestUV=gp/2.7;
   // Derivatives must be evaluated before any spatially divergent wetness branch.
   float valleyWaterFootprint=max(length(dFdx(gp*1.45)),length(dFdy(gp*1.45)));
   float macro=valleyNoise(gp*.27)*.64+valleyNoise(gp*.83+vec2(4.7,13.1))*.36;
   float soilWet=soilMoisture(gp,soilRain);
   float pathBlend=clamp(vSurfaceZones.x+(macro-.5)*.32*vSurfaceZones.x*(1.-vSurfaceZones.x)*4.,0.,1.);
   float litterBlend=clamp(vSurfaceZones.z+(macro-.5)*.22*vSurfaceZones.z*(1.-vSurfaceZones.z)*4.,0.,1.)*(1.-pathBlend);
   vec4 mudSample=texture2D(map,vMapUv),pathSample=texture2D(uDirtColor,dirtUV),litterSample=texture2D(uForestColor,forestUV);
   vec3 surface=mix(mix(mudSample.rgb,pathSample.rgb,pathBlend),litterSample.rgb,litterBlend);
   float microHeight=mix(mix(mudSample.a,pathSample.a,pathBlend),litterSample.a,litterBlend);
   // Low basins retain water; nearby grains dampen without becoming mirrors.
   // Zero procedural water on steep banks or under a building foundation.
   float basin=macro+(microHeight-.5)*.19;
   float basinFlatness=1.-smoothstep(.015,.13,vGroundSlope);
   float puddle=(1.-smoothstep(.34,.40,basin))*smoothstep(.33,.78,soilWet+soilRain*.14)*basinFlatness*(1.-vSurfaceZones.y);
   float damp=clamp(soilWet*.8+(1.-smoothstep(.38,.65,basin))*.22+soilRain*.20,0.,1.);
   damp*=1.-vSurfaceZones.y*.55;
   surface*=mix(.86,1.10,macro);
   surface*=mix(1.,.55,damp);
   surface=mix(surface,surface*.52,puddle);
   diffuseColor=vec4(diffuseColor.rgb*surface,1.);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   roughnessFactor=mix(roughnessFactor,texture2D(uDirtRough,dirtUV).g,pathBlend);
   roughnessFactor=mix(roughnessFactor,texture2D(uForestRough,forestUV).g,litterBlend);
   roughnessFactor=mix(clamp(roughnessFactor,.78,.99),.32+macro*.16,damp);
   roughnessFactor=mix(roughnessFactor,.075+soilRain*.045,puddle);
  `);
  const normalChunk=T.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0',
   '(mix(mix(texture2D(normalMap,vNormalMapUv).xyz,texture2D(uDirtNormal,dirtUV).xyz,pathBlend),texture2D(uForestNormal,forestUV).xyz,litterBlend)*2.-1.)');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',normalChunk+`
   normal=normalize(mix(normal,nonPerturbedNormal,puddle*.985));
   // Only wet visible pixels pay the ring cost. Rain drives rings; after-rain
   // basins retain a very restrained breeze disturbance instead of frozen glass.
   if(puddle>.005){
    vec2 slope=vec2(sin(gp.x*4.3+gp.y*3.1-valleyTime*1.1),cos(gp.y*5.2-gp.x*2.4-valleyTime*.85))*.003;
    if(soilRain>.001)slope+=valleyWaterSlope(gp,valleyTime,valleyWaterFootprint)*soilRain;
    normal=normalize(normal+(viewMatrix*vec4(-slope.x,0.,-slope.y,0.)).xyz*puddle);
   }
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <aomap_fragment>',`#include <aomap_fragment>
   float poreAO=mix(mix(texture2D(roughnessMap,vRoughnessMapUv).r,texture2D(uDirtRough,dirtUV).r,pathBlend),texture2D(uForestRough,forestUV).r,litterBlend);
   reflectedLight.indirectDiffuse*=mix(.80,1.,poreAO)*(1.-vSurfaceZones.w);`);
 };
 material.customProgramCacheKey=()=>PROCEDURAL_GROUND_REVISION;
}
