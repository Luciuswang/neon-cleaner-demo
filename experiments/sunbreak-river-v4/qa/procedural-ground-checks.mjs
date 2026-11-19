import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {installProceduralGround,FILTERED_WATER_GLSL} from '../procedural-ground.js';
import {createMasonryMaterial} from '../masonry-materials.js';
import {createHeightFog} from '../height-fog.js';
let checks=0;
function check(v,n){assert.ok(v,n);checks++}
const material=new T.MeshStandardMaterial(),layer={map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture()};
material.map=layer.map;material.normalMap=layer.normalMap;material.roughnessMap=layer.roughnessMap;
const rain={value:0},time={value:3};
installProceduralGround(T,material,{dirt:layer,forest:layer,rain,time});
const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
material.onBeforeCompile(shader);
check(shader.uniforms.soilRain===rain&&shader.uniforms.valleyTime===time,'live shared uniform references');
check(shader.vertexShader.includes('vSurfaceZones=surfaceZones')&&!shader.vertexShader.includes('position.y+='),'original geometry and zone attributes');
check(material.metalness===0&&material.roughness===1,'dielectric ground and calibrated map roughness');
check(shader.fragmentShader.includes('vec4 mudSample=texture2D(map,vMapUv)'),'generated height and color sampled together');
check(shader.fragmentShader.includes('roughnessFactor=mix(roughnessFactor,.075+soilRain*.045,puddle)'),'bounded puddle roughness');
check(shader.fragmentShader.includes('normal=normalize(mix(normal,nonPerturbedNormal,puddle*.985))'),'water flattens mud normals only in basins');
check(!shader.fragmentShader.includes('earthRelief')&&!shader.fragmentShader.includes('earthDet'),'old derivative earth overlay absent');
check(shader.fragmentShader.includes('if(puddle>.005)')&&shader.fragmentShader.includes('if(soilRain>.001)'),'rain work gated to wet pixels');
check(FILTERED_WATER_GLSL.includes('smoothstep(.012,.045,footprint)'),'ring frequency attenuated before pixel Nyquist');
check(!/dFdx|dFdy|fwidth/.test(FILTERED_WATER_GLSL),'conditionally invoked rain function contains no derivatives');
check(shader.fragmentShader.indexOf('float valleyWaterFootprint=')<shader.fragmentShader.indexOf('if(puddle>.005)'),'water footprint evaluated unconditionally before wet-pixel branch');
check(shader.fragmentShader.includes('valleyWaterSlope(gp,valleyTime,valleyWaterFootprint)'),'ring filter consumes precomputed footprint');
check(Object.keys(material.userData.proceduralGround.samplers).length===6,'six actual custom samplers inventoried after shader binding');
check(shader.fragmentShader.includes('reflectedLight.indirectDiffuse*=')&&!shader.fragmentShader.includes('radiance=mix'),'AO stays indirect and no wrong-plane reflection reuse');
const tangent=shader.fragmentShader.split('#elif defined( USE_NORMALMAP_TANGENTSPACE )')[1]?.split('#elif')[0];
check(tangent?.includes('uDirtNormal')&&tangent?.includes('uForestNormal'),'actual r160 tangent-space branch contains layer blend');
// Evaluate the emitted macro expressions over all attribute boundaries.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
for(const label of ['pathBlend','litterBlend']){
 const expression=shader.fragmentShader.match(new RegExp('float '+label+'=([^;]+);'))[1];
 const evaluate=new Function('vSurfaceZones','macro','pathBlend','clamp','return '+expression);
 for(const x of [0,.01,.2,.5,.8,.99,1])for(const z of [0,.2,.7,1])for(const macro of [0,.2,.5,.8,1]){
  const value=evaluate({x,z},macro,x,clamp);check(value>=0&&value<=1,'bounded emitted '+label);
  if(label==='litterBlend'&&(z===0||x===1))check(value===0,'preserved no-litter zone');
 }
}
for(const role of ['plaster','stone'])for(const generated of [false,true]){
 const base=new T.MeshStandardMaterial();base.map=new T.Texture();base.normalMap=new T.Texture();base.roughnessMap=new T.Texture();
 if(generated)base.userData.procedural={kind:role};
 const m=createMasonryMaterial(T,base,{role}),s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
 m.onBeforeCompile(s);
 check(s.fragmentShader.includes('normal=masonryBump(normal,-vViewPosition,masonryRelief);')===!generated,'legacy-only noisy derivative '+role);
 check(s.fragmentShader.includes('masonryDirt=masonrySoil'),'foundation weathering retained '+role);
 check(m.customProgramCacheKey().includes('generated-height-normal')===generated,'separate program cache '+role);
 if(role==='plaster')check(s.fragmentShader.includes('normal=normalize(mix(normal,nonPerturbedNormal,masonryCoreMix));')===!generated,'generated exposed plaster retains baked mineral relief; legacy unchanged');
}
for(const role of ['core','course','mortar','aggregate']){
 const base=new T.MeshStandardMaterial();base.userData.procedural={family:'brick'};base.map=new T.Texture();
 const m=createMasonryMaterial(T,base,{role});
 check(!m.userData.procedural&&m.userData.proceduralAnalytic?.bakedMaps===false,'mapless '+role+' is analytic, never relabelled baked');
 check(!m.map&&!m.normalMap&&!m.roughnessMap,'analytic '+role+' has no bound baked maps');
}
const world=new T.Group(),mesh=new T.Mesh(new T.PlaneGeometry(),material);world.add(mesh);
const fog=createHeightFog(T);fog.install(world);
const composed={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};
material.onBeforeCompile(composed);
check(composed.fragmentShader.includes('valleyWaterSlope')&&material.customProgramCacheKey().includes('analytic-height-haze'),'generated material composes with height fog');
const source=await readFile(new URL('../world.js',import.meta.url),'utf8');
check(source.includes("get('materials')!=='legacy'"),'explicit opt-out comparison');
check(source.includes('else installGroundSurface('),'legacy shader retained');
check(source.includes('if(procedural)pond.visible=false'),'no unfiltered circular puddle overlay in generated mode');
console.log(JSON.stringify({pass:true,checks,three:T.REVISION,scope:'emitted-shader/legacy invariants only; GPU/art separately reviewed'}));
