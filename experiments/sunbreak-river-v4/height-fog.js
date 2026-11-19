// Original analytic height haze. No borrowed Godot shader, fog meshes, depth
// sampling, raymarch, interaction trails, shadow changes or extra render pass.
export const HEIGHT_FOG_REVISION='analytic-height-haze-v2-reflection';
export const HEIGHT_FOG_WEATHER=Object.freeze([
 Object.freeze({name:'sunny',density:.0032,falloff:.16,baseHeight:.25,nearClear:4,color:0xa6b9bb}),
 Object.freeze({name:'overcast',density:.0044,falloff:.13,baseHeight:.25,nearClear:4,color:0x9cada9}),
 Object.freeze({name:'storm',density:.0056,falloff:.11,baseHeight:.25,nearClear:4,color:0x899b99})
]);
function profile(value){
 if(typeof value==='number'){if(!Number.isInteger(value)||!HEIGHT_FOG_WEATHER[value])throw new RangeError('Height fog weather must be 0, 1 or 2');return HEIGHT_FOG_WEATHER[value]}
 if(!value||!['density','falloff','baseHeight','nearClear'].every(k=>Number.isFinite(value[k]))||value.density<0||value.falloff<0||value.nearClear<0)throw new TypeError('Invalid height fog coefficients');
 return value;
}
function expMean(x){return x<.001?1-x*.5+x*x/6:-Math.expm1(-x)/x}
// Exact segment mean of exp(-falloff * max(y-baseHeight,0)). Below-ground
// density is capped, including negative riverbed elevations. Symmetric and
// stable for horizontal/near-horizontal rays; no exp(large positive value).
export function heightFogMeanDensity(y0,y1,falloff=.16,baseHeight=.25){
 if(![y0,y1,falloff,baseHeight].every(Number.isFinite)||falloff<0)throw new TypeError('Invalid height fog heights');
 const low=Math.min(y0,y1)-baseHeight,high=Math.max(y0,y1)-baseHeight;
 if(high<=0)return 1;
 if(low>=0)return Math.exp(-falloff*low)*expMean(falloff*(high-low));
 const below=-low/(high-low);return below+(1-below)*expMean(falloff*high);
}
export function heightFogOpticalDepth(distance,cameraY,targetY,settings=0){
 const p=profile(settings);
 if(![distance,cameraY,targetY].every(Number.isFinite)||distance<0)throw new TypeError('Invalid height fog ray');
 if(distance<=p.nearClear||p.density===0)return 0;
 const startY=cameraY+(targetY-cameraY)*(p.nearClear/distance);
 return p.density*(distance-p.nearClear)*heightFogMeanDensity(startY,targetY,p.falloff,p.baseHeight);
}
export function heightFogCoefficient(distance,cameraY,targetY,settings=0){
 return -Math.expm1(-Math.min(80,heightFogOpticalDepth(distance,cameraY,targetY,settings)));
}
// Horizontal Reflector plane, viewed from its front (above-water) side. The
// mirrored eye is on/below the plane. Only plane-hit -> above-plane surface
// belongs in the reflection texture; real eye -> water is applied separately.
// Parallel/coplanar, reversed and non-crossing rays have no reflected segment.
export function heightFogReflectionSegment(distance,cameraY,targetY,planeY=0){
 if(![distance,cameraY,targetY,planeY].every(Number.isFinite)||distance<0)throw new TypeError('Invalid height fog reflection ray');
 const dy=targetY-cameraY;
 if(distance===0||!Number.isFinite(dy)||dy<=0||cameraY>planeY||targetY<=planeY)return null;
 const startFraction=(planeY-cameraY)/dy;
 if(!Number.isFinite(startFraction)||startFraction<0||startFraction>1)return null;
 // Use the direct remaining ratio rather than 1-startFraction, which loses
 // precision when the target is almost exactly on the water plane.
 const lengthFraction=(targetY-planeY)/dy;
 if(!Number.isFinite(lengthFraction)||lengthFraction<0||lengthFraction>1)return null;
 return {startFraction,distance:distance*lengthFraction,startY:planeY,endY:targetY};
}
export function heightFogReflectionOpticalDepth(distance,cameraY,targetY,planeY=0,settings=0){
 const p=profile(settings),segment=heightFogReflectionSegment(distance,cameraY,targetY,planeY);
 return segment?p.density*segment.distance*heightFogMeanDensity(segment.startY,segment.endY,p.falloff,p.baseHeight):0;
}
export function heightFogReflectionCoefficient(distance,cameraY,targetY,planeY=0,settings=0){
 return -Math.expm1(-Math.min(80,heightFogReflectionOpticalDepth(distance,cameraY,targetY,planeY,settings)));
}

export const HEIGHT_FOG_GLSL=`
// HEIGHT_FOG_ANALYTIC_V1
uniform float uHeightFogEnabled;
uniform float uHeightFogDensity;
uniform float uHeightFogFalloff;
uniform float uHeightFogBase;
uniform float uHeightFogNear;
uniform float uHeightFogReflection;
uniform float uHeightFogReflectionPlane;
uniform vec3 uHeightFogColor;
float hfExpMean(float x){
 if(x<0.001)return 1.0-x*0.5+x*x/6.0;
 return (1.0-exp(-x))/x;
}
float hfMeanDensity(float y0,float y1){
 float low=min(y0,y1)-uHeightFogBase,high=max(y0,y1)-uHeightFogBase;
 if(high<=0.0)return 1.0;
 if(low>=0.0)return exp(-uHeightFogFalloff*low)*hfExpMean(uHeightFogFalloff*(high-low));
 float below=-low/(high-low);
 return below+(1.0-below)*hfExpMean(uHeightFogFalloff*high);
}
float hfAmount(vec3 eye,vec3 surface){
 float rayLength=length(surface-eye);
 if(uHeightFogEnabled<0.5||rayLength<=0.0)return 0.0;
 float startY=eye.y,segmentLength=rayLength;
 if(uHeightFogReflection>0.5){
  float dy=surface.y-eye.y;
  if(dy<=0.0||eye.y>uHeightFogReflectionPlane||surface.y<=uHeightFogReflectionPlane)return 0.0;
  float hitT=(uHeightFogReflectionPlane-eye.y)/dy;
  if(hitT<0.0||hitT>1.0)return 0.0;
  segmentLength=rayLength*((surface.y-uHeightFogReflectionPlane)/dy);
  startY=uHeightFogReflectionPlane;
 }else{
  if(rayLength<=uHeightFogNear)return 0.0;
  segmentLength=rayLength-uHeightFogNear;
  startY=mix(eye.y,surface.y,uHeightFogNear/rayLength);
 }
 float optical=uHeightFogDensity*segmentLength*hfMeanDensity(startY,surface.y);
 return 1.0-exp(-min(80.0,max(0.0,optical)));
}
vec3 hfApply(vec3 linearColor,vec3 eye,vec3 surface){
 return mix(linearColor,uHeightFogColor,hfAmount(eye,surface));
}
`;
const WORLD_VERTEX=`
// Uses 'transformed' AFTER morphing, skinning, displacement and foliage wind.
// Mirrors project_vertex; do not use raw position or guarded worldpos_vertex.
vec4 hfWorldPosition=vec4(transformed,1.0);
#ifdef USE_BATCHING
 hfWorldPosition=batchingMatrix*hfWorldPosition;
#endif
#ifdef USE_INSTANCING
 hfWorldPosition=instanceMatrix*hfWorldPosition;
#endif
vHeightFogWorld=(modelMatrix*hfWorldPosition).xyz;
`;
const materialOwners=new WeakMap(),shaderOwners=new WeakMap();

/** Install LAST, after existing material hooks and asynchronous assets load:
 * const haze=createHeightFog(T); haze.install(world);
 * enemies.forEach(e=>haze.install(e.g)); haze.setWeather(weather);
 * Never pass scene/gscene/gun. Scene roots are rejected; use only world groups.
 * userData.heightFog=false skips a subtree/material. Shared materials must not
 * also be used by excluded gun/HUD objects (clone them before installation).
 * Reinstall after adding new meshes; duplicate materials are idempotent.
 * Custom water: AFTER its shader strings are built, BEFORE first compilation:
 * haze.shaderPatch(water.mesh.material,{worldPosition:'vRiver'});
 * This shares uniforms, leaves the water vertex/discard/alpha/reflection hooks
 * unchanged and inserts hfApply before tonemapping. No per-frame patch needed.
 * Wrap the EXISTING water.mesh.onBeforeRender with setReflection(true,waterY)
 * before its call, then setReflection(false) in finally. The nested reflected
 * world integrates plane -> surface with NO near clearing. The subsequent
 * water draw uses the real camera and the usual near-clear eye -> water path.
 * Only horizontal, front-side Reflector planes are supported. Existing distance
 * fog is not rewritten; this clips the added height haze only.
 */
export function createHeightFog(T){
 if(!T?.Color)throw new TypeError('createHeightFog requires THREE.Color');
 let weather=0,enabled=true,reflection=false,compilations=0,explicitPatches=0;
 const installed=new Set(),skipped=new Set(),uniforms={
  uHeightFogEnabled:{value:1},uHeightFogDensity:{value:0},uHeightFogFalloff:{value:0},
  uHeightFogBase:{value:0},uHeightFogNear:{value:4},uHeightFogColor:{value:new T.Color()},
  uHeightFogReflection:{value:0},uHeightFogReflectionPlane:{value:0}
 },owner={};
 function setWeather(i){const p=profile(i);if(typeof i!=='number')throw new RangeError('setWeather accepts 0, 1 or 2');weather=i;
  uniforms.uHeightFogDensity.value=p.density;uniforms.uHeightFogFalloff.value=p.falloff;
  uniforms.uHeightFogBase.value=p.baseHeight;uniforms.uHeightFogNear.value=p.nearClear;uniforms.uHeightFogColor.value.set(p.color);
 }
 function setReflection(value,planeY=uniforms.uHeightFogReflectionPlane.value){
  if(!Number.isFinite(planeY))throw new TypeError('Height fog reflection plane must be finite');
  reflection=!!value;uniforms.uHeightFogReflection.value=reflection?1:0;uniforms.uHeightFogReflectionPlane.value=planeY;
 }
 function shaderPatch(shader,{worldPosition}={}){
  const custom=worldPosition!==undefined,position=custom?worldPosition:'vHeightFogWorld';
  if(!/^[A-Za-z_]\w*(?:\.[xyzrgb]{3})?$/.test(position))throw new TypeError('worldPosition must be an existing vec3 GLSL identifier');
  if(!shader?.uniforms||typeof shader.fragmentShader!=='string'||(!custom&&typeof shader.vertexShader!=='string'))throw new TypeError('Height fog requires shader strings and uniforms');
  const prior=shaderOwners.get(shader);
  if(prior){if(prior.owner!==owner||prior.position!==position)throw new Error('Shader already belongs to a different height fog binding');return false}
  if(shader.fragmentShader.includes('HEIGHT_FOG_ANALYTIC_V1'))throw new Error('Already-patched shader strings copied without their fog ownership');
  for(const [key,value]of Object.entries(uniforms))if(shader.uniforms[key]&&shader.uniforms[key]!==value)throw new Error(`Height fog uniform collision: ${key}`);
  const common='#include <common>',project='#include <project_vertex>',tone='#include <tonemapping_fragment>';
  if(!shader.fragmentShader.includes(common)||!shader.fragmentShader.includes(tone)||(!custom&&(!shader.vertexShader.includes(common)||!shader.vertexShader.includes(project))))throw new Error('Height fog needs common/project_vertex/tonemapping_fragment hooks; install after existing material hooks');
  // Validate first, then mutate. Existing distance fog and alpha discard remain.
  if(!custom)shader.vertexShader=shader.vertexShader.replace(common,common+'\nvarying vec3 vHeightFogWorld;').replace(project,project+'\n'+WORLD_VERTEX);
  shader.fragmentShader=shader.fragmentShader.replace(common,common+'\n'+(!custom?'varying vec3 vHeightFogWorld;\n':'')+HEIGHT_FOG_GLSL)
   .replace(tone,`gl_FragColor.rgb=hfApply(gl_FragColor.rgb,cameraPosition,${position});\n${tone}`);
  Object.assign(shader.uniforms,uniforms);shaderOwners.set(shader,{owner,position});
  if(custom){explicitPatches++;if(shader.isMaterial)shader.needsUpdate=true}
  return true;
 }
 function install(root){
  if(!root||root.isScene)throw new TypeError('Install height fog on world/enemy groups, never a Scene or gun scene');
  let added=0;
  function visit(object){
   if(object.userData?.heightFog===false)return;
   if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!material)continue;
    if(material.userData?.heightFog===false||material.fog===false||!(material.isMeshStandardMaterial||material.isMeshBasicMaterial)){skipped.add(material);continue}
    const current=materialOwners.get(material);
    if(current){
     if(current.owner!==owner)throw new Error('Material already installed by another height fog controller');
     if(material.onBeforeCompile!==current.hook||material.customProgramCacheKey!==current.key)throw new Error('Material hooks changed after height fog installation; install fog last');
     continue;
    }
    const previousHook=material.onBeforeCompile,previousKey=material.customProgramCacheKey,
     defaultKey=!!previousKey&&(previousKey===T.Material?.prototype.customProgramCacheKey||previousKey.toString()===T.Material?.prototype.customProgramCacheKey?.toString()),
     // The stock key reads this.onBeforeCompile; capture it BEFORE wrapping or
     // unrelated custom shaders would collapse to our identical wrapper key.
     savedKey=defaultKey?String(previousKey.call(material)):null;
    function hook(shader,renderer){previousHook?.call(this,shader,renderer);shaderPatch(shader);compilations++}
    function key(){return `${defaultKey?savedKey:previousKey?.call(this)??previousHook?.toString()??''}|${HEIGHT_FOG_REVISION}`}
    material.onBeforeCompile=hook;material.customProgramCacheKey=key;material.needsUpdate=true;
    materialOwners.set(material,{owner,hook,key});installed.add(material);added++;
   }
   for(const child of object.children||[])visit(child);
  }
  visit(root);return {added,materials:installed.size};
 }
 setWeather(0);
 return {install,setWeather,setReflection,setEnabled(value){enabled=!!value;uniforms.uHeightFogEnabled.value=enabled?1:0},uniforms,shaderPatch,
  info(){return {revision:HEIGHT_FOG_REVISION,enabled,weather,weatherName:HEIGHT_FOG_WEATHER[weather].name,materials:installed.size,skippedMaterials:skipped.size,compilations,explicitPatches,
   reflection:{enabled:reflection,planeY:uniforms.uHeightFogReflectionPlane.value},
   coefficients:{density:uniforms.uHeightFogDensity.value,falloff:uniforms.uHeightFogFalloff.value,baseHeight:uniforms.uHeightFogBase.value,nearClear:uniforms.uHeightFogNear.value},
   technique:'Analytic integral of capped exponential height density; original implementation',extraDrawCalls:0,depthTextures:0,raymarchSteps:0,
   limitations:'Not volumetric lighting or interaction trails; no indoor occlusion. Existing distance fog remains. Gun/HUD must stay outside installed roots. GPU/art/performance acceptance separate.'}}
 };
}
