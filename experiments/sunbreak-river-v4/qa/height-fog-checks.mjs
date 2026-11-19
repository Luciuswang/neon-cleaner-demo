// CPU only: real local Three r160 shader templates/objects, coefficient
// quadrature, composition and source-derived GLSL algebra. No GPU/server/writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import * as GameplayT from '../../sunbreak-storm-v3/vendor/three/build/three.module.js';
import {createHeightFog,HEIGHT_FOG_WEATHER,HEIGHT_FOG_GLSL,HEIGHT_FOG_REVISION,heightFogMeanDensity,heightFogOpticalDepth,heightFogCoefficient,heightFogReflectionSegment,heightFogReflectionOpticalDepth,heightFogReflectionCoefficient} from '../height-fog.js';
const checks=[],sources={},close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const path of ['../height-fog.js','./height-fog-checks.mjs','../vegetation.js','../river-water.js','../distant-landscape.js','../world.js'])sources[path]=hash(await readFile(new URL(path,import.meta.url)));
const vegetation=await readFile(new URL('../vegetation.js',import.meta.url),'utf8'),distant=await readFile(new URL('../distant-landscape.js',import.meta.url),'utf8'),water=await readFile(new URL('../river-water.js',import.meta.url),'utf8');
function check(name,fn){try{const evidence=fn();checks.push({name,pass:true,...evidence===undefined?{}:{evidence}})}catch(error){checks.push({name,pass:false,error:error.stack})}}
function shader(lib='standard'){return {uniforms:{},vertexShader:T.ShaderLib[lib].vertexShader,fragmentShader:T.ShaderLib[lib].fragmentShader}}
function group(material){const root=new T.Group();root.add(new T.Mesh(new T.BoxGeometry(),material));return root}
function quadrature(distance,y0,y1,p){
 if(distance<=p.nearClear)return 0;const n=4000,step=(distance-p.nearClear)/n;let sum=0;
 for(let i=0;i<n;i++){const t=(p.nearClear+(i+.5)*step)/distance,y=y0+(y1-y0)*t;sum+=Math.exp(-p.falloff*Math.max(y-p.baseHeight,0))}
 return sum*step*p.density;
}

check('coefficient agrees with independent numerical line integration including base crossing',()=>{
 let largestError=0;const rays=[];
 for(const p of HEIGHT_FOG_WEATHER)for(const distance of [0,3,4,4.00001,25,80,600])for(const [eye,target]of [[1.7,.2],[1.7,35],[25,25],[8,-.6],[-1,40],[-4,-.4],[1.7,1.70000001]]){
  const a=heightFogOpticalDepth(distance,eye,target,p),b=quadrature(distance,eye,target,p);largestError=Math.max(largestError,Math.abs(a-b));close(a,b,3e-7);rays.push(a);
 }return {rays:rays.length,largestError};
});
check('four-metre near clearing, monotone low haze and clearer high elevations',()=>{
 const evidence=[];
 for(let weather=0;weather<3;weather++){
  for(const d of [0,1,3,4])assert.equal(heightFogCoefficient(d,1.7,0,weather),0);
  const amounts=[5,25,50,80].map(d=>heightFogCoefficient(d,1.7,0,weather));
  assert.ok(amounts.every((a,i)=>i===0||a>amounts[i-1]));assert.ok(amounts[1]>.03&&amounts[1]<.15);assert.ok(amounts[3]>.12&&amounts[3]<.4);
  const high=heightFogCoefficient(80,25,25,weather);assert.ok(high<amounts[3]*.15);
  assert.ok(heightFogCoefficient(80,1.7,35,weather)<amounts[3]);evidence.push({weather,near5:amounts[0],low25:amounts[1],low80:amounts[3],high80:high});
 }return evidence;
});
check('stable horizontal, zero falloff, below-ground and extreme-height integrals',()=>{
 for(const y of [-1e4,-.6,0,.25,1.7,40,1e6])for(const dy of [0,1e-10,1e-5,1]){
  const mean=heightFogMeanDensity(y,y+dy);assert.ok(Number.isFinite(mean)&&mean>=0&&mean<=1);close(mean,heightFogMeanDensity(y+dy,y));
 }
 assert.equal(heightFogMeanDensity(-10,-.6),1);assert.equal(heightFogMeanDensity(30,-20,0),1);
 close(heightFogMeanDensity(5,5),Math.exp(-.16*(5-.25)));
 for(const x of [NaN,Infinity])assert.throws(()=>heightFogCoefficient(x,1,0));
 assert.throws(()=>heightFogMeanDensity(0,0,-1));assert.throws(()=>heightFogCoefficient(-1,1,0));assert.throws(()=>heightFogCoefficient(25,1,0,9));
});
function glslAmount(p,enabled=1,reflection=0,planeY=0){
 // Evaluate the exported GLSL algebra, not a hand-maintained second formula.
 const functions=[...HEIGHT_FOG_GLSL.matchAll(/float (hfExpMean|hfMeanDensity|hfAmount)\(([^)]*)\)\{([\s\S]*?)\n\}/g)].map(([,name,args,body])=>
  `function ${name}(${args.replace(/\b(?:float|vec3)\s+/g,'')}){${body.replace(/\bfloat\s+/g,'let ').replace('length(surface-eye)','length(sub(surface,eye))')}}`).join('\n');
 assert.equal((functions.match(/function /g)||[]).length,3);
 const evaluate=Function('uHeightFogEnabled','uHeightFogDensity','uHeightFogFalloff','uHeightFogBase','uHeightFogNear','uHeightFogReflection','uHeightFogReflectionPlane','min','max','exp','length','mix','sub',functions+';return hfAmount;');
 return evaluate(enabled,p.density,p.falloff,p.baseHeight,p.nearClear,reflection,planeY,Math.min,Math.max,Math.exp,v=>Math.hypot(v.x,v.y,v.z),(a,b,t)=>a+(b-a)*t,(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}));
}
check('actual GLSL scalar math matches CPU reference and disabled branch',()=>{
 let count=0;for(const p of HEIGHT_FOG_WEATHER)for(const enabled of [0,1]){
  const fn=glslAmount(p,enabled);
  for(const [x,y,z]of [[0,1.7,0],[3,0,0],[25,0,0],[80,35,-10],[0,-.6,50],[1e4,1e4,1e4]]){
   close(fn({x:0,y:1.7,z:0},{x,y,z}),enabled?heightFogCoefficient(Math.hypot(x,y-1.7,z),1.7,y,p):0,1e-9);count++;
  }
 }return {sourceDerivedSamples:count};
});
check('reflection intersection is finite for crossing, grazing, plane-endpoint and invalid-side rays',()=>{
 const valid=[[80,-2,6,0],[80,-2,6,-.6],[2,-1,1,0],[10,0,1,0],[80,-1e-12,1e-12,0],[1e6,-1e6,1e-10,0]];
 for(const ray of valid){
  const s=heightFogReflectionSegment(...ray);assert.ok(s);assert.ok(Object.values(s).every(Number.isFinite));
  assert.ok(s.startFraction>=0&&s.startFraction<=1&&s.distance>0&&s.distance<=ray[0]);assert.equal(s.startY,ray[3]);assert.equal(s.endY,ray[2]);
  close(ray[1]+(ray[2]-ray[1])*s.startFraction,ray[3],1e-9);
 }
 assert.deepEqual(heightFogReflectionSegment(80,-2,6,0),{startFraction:.25,distance:60,startY:0,endY:6});
 // A tiny remaining segment must not vanish through cancellation of 1-hitT.
 assert.ok(heightFogReflectionSegment(1e6,-1e6,1e-10,0).distance>0);
 const invalid=[[0,0,0,0],[10,0,0,0],[10,-2,-2,0],[10,-2,-1,0],[10,1,2,0],[10,2,-2,0],[10,-2,0,0],[10,0,-1,0],[10,-1e308,1e308,0]];
 for(const ray of invalid){assert.equal(heightFogReflectionSegment(...ray),null);assert.equal(heightFogReflectionCoefficient(...ray),0)}
 for(let i=0;i<4;i++)for(const bad of [NaN,Infinity,-Infinity]){const ray=[80,-2,6,0];ray[i]=bad;assert.throws(()=>heightFogReflectionSegment(...ray),/Invalid/)}
 assert.throws(()=>heightFogReflectionSegment(-1,-2,6,0));
 return {validCrossings:valid.length,emptyOrInvalidSideRays:invalid.length,nonfiniteInputsRejected:12};
});
check('reflected segment agrees with independent integration, including negative plane and zero near-clear',()=>{
 let count=0,largestError=0;
 for(const p of HEIGHT_FOG_WEATHER)for(const [d,eye,surface,plane]of [[80,-2,6,0],[80,-2,6,-.6],[25,-.6,25,-.4],[2,-1,1,0],[80,-1e-12,1e-12,0],[80,0,1,0],[600,-2,200,0]]){
  const hit=(plane-eye)/(surface-eye),length=d*(1-hit);
  const expected=quadrature(length,plane,surface,{...p,nearClear:0}),actual=heightFogReflectionOpticalDepth(d,eye,surface,plane,p);
  close(actual,expected,5e-7);largestError=Math.max(largestError,Math.abs(actual-expected));count++;
 }
 assert.equal(heightFogCoefficient(2,-1,1),0);
 assert.ok(heightFogReflectionCoefficient(2,-1,1,0)>0,'reflection segment must not get a second near-clear zone');
 const p=HEIGHT_FOG_WEATHER[0];
 close(heightFogReflectionOpticalDepth(80,-2,6,0,{...p,nearClear:1000}),heightFogReflectionOpticalDepth(80,-2,6,0,p));
 return {rays:count,largestError};
});
check('reflection GLSL source matches CPU on oblique, horizontal, grazing and out-of-plane rays',()=>{
 let count=0;
 for(const p of HEIGHT_FOG_WEATHER)for(const enabled of [0,1])for(const [eyeY,surfaceY,x,plane]of [[-2,6,80,0],[-2,6,80,-.6],[-1,1,0,0],[0,1,10,0],[-1e-12,1e-12,80,0],[-2,-2,80,0],[0,0,80,0],[0,0,0,0],[-2,-1,80,0],[1,2,80,0],[2,-2,80,0],[-2,0,80,0],[-1e6,1e-10,80,0]]){
  const eye={x:0,y:eyeY,z:0},surface={x,y:surfaceY,z:0},d=Math.hypot(x,surfaceY-eyeY);
  const actual=glslAmount(p,enabled,1,plane)(eye,surface);assert.ok(Number.isFinite(actual)&&actual>=0&&actual<=1);
  close(actual,enabled?heightFogReflectionCoefficient(d,eyeY,surfaceY,plane,p):0,1e-9);count++;
 }
 return {sourceDerivedReflectionSamples:count};
});
check('split optical path counts real eye-to-water once and never integrates below-water mirrored eye',()=>{
 // Mirrored eye=(0,-2), surface=(60,3), hit=(24,0). Real eye=(0,2).
 const full=Math.hypot(60,5),toWater=Math.hypot(24,2),reflected=Math.hypot(36,3),p=HEIGHT_FOG_WEATHER[0];
 const first=heightFogOpticalDepth(toWater,2,0,p),second=heightFogReflectionOpticalDepth(full,-2,3,0,p);
 close(second,quadrature(reflected,0,3,{...p,nearClear:0}),1e-8);
 close(first+second,quadrature(toWater,2,0,p)+quadrature(reflected,0,3,{...p,nearClear:0}),1e-8);
 const composedOpacity=1-(1-heightFogCoefficient(toWater,2,0,p))*(1-heightFogReflectionCoefficient(full,-2,3,0,p));
 close(composedOpacity,-Math.expm1(-(first+second)));
 assert.ok(heightFogOpticalDepth(full,-2,3,p)>second,'old reflection added the under-water near segment');
 return {realEyeToWater:first,planeToSurface:second,composedOpacity};
});
check('real standard/basic/physical templates preserve distance fog, alpha and output order',()=>{
 for(const [Ctor,lib]of [[T.MeshStandardMaterial,'standard'],[T.MeshPhysicalMaterial,'physical'],[T.MeshBasicMaterial,'basic']]){
  const m=new Ctor({alphaTest:.35}),fog=createHeightFog(T),g=group(m);fog.install(g);const s=shader(lib);m.onBeforeCompile(s,{});
  assert.ok(s.fragmentShader.includes('#include <fog_fragment>'));assert.ok(s.fragmentShader.includes('#include <alphatest_fragment>'));
  assert.ok(s.fragmentShader.indexOf('gl_FragColor.rgb=hfApply')<s.fragmentShader.indexOf('#include <tonemapping_fragment>'));
  assert.ok(s.fragmentShader.indexOf('#include <alphatest_fragment>')<s.fragmentShader.indexOf('gl_FragColor.rgb=hfApply'));
  assert.equal((s.fragmentShader.match(/HEIGHT_FOG_ANALYTIC_V1/g)||[]).length,1);assert.ok(!s.fragmentShader.includes('gl_FragColor.a='));
  assert.equal(m.alphaTest,.35);assert.equal(s.uniforms.uHeightFogDensity,fog.uniforms.uHeightFogDensity);
  assert.ok(s.vertexShader.indexOf('vec4 hfWorldPosition')>s.vertexShader.indexOf('#include <project_vertex>'));
 }
});
check('existing hook this/renderer semantics and dynamic custom cache key compose',()=>{
 const m=new T.MeshStandardMaterial(),fog=createHeightFog(T),renderer={},sentinel={value:42};m.userData.key='mud-v3';let calls=0;
 m.onBeforeCompile=function(s,r){assert.equal(this,m);assert.equal(r,renderer);calls++;s.uniforms.previous=sentinel;s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n// existing mud')};
 m.customProgramCacheKey=function(){return this.userData.key};fog.install(group(m));const s=shader();m.onBeforeCompile(s,renderer);
 assert.equal(calls,1);assert.equal(s.uniforms.previous,sentinel);assert.ok(s.fragmentShader.includes('// existing mud'));
 assert.equal(m.customProgramCacheKey(),`mud-v3|${HEIGHT_FOG_REVISION}`);m.userData.key='mud-v4';assert.equal(m.customProgramCacheKey(),`mud-v4|${HEIGHT_FOG_REVISION}`);
});
check('default cache keys preserve original hook identity across both local Three copies',()=>{
 for(const Three of [T,GameplayT]){
  const a=new Three.MeshBasicMaterial(),b=new Three.MeshBasicMaterial();a.onBeforeCompile=function(s){s.uniforms.a={value:1}};b.onBeforeCompile=function(s){s.uniforms.b={value:2}};
  const oldA=a.customProgramCacheKey(),oldB=b.customProgramCacheKey(),fog=createHeightFog(T);fog.install(group([a,b]));
  assert.equal(a.customProgramCacheKey(),oldA+'|'+HEIGHT_FOG_REVISION);assert.equal(b.customProgramCacheKey(),oldB+'|'+HEIGHT_FOG_REVISION);assert.notEqual(a.customProgramCacheKey(),b.customProgramCacheKey());
 }
});
check('duplicate installs/patches are idempotent; hook replacement and double ownership fail loudly',()=>{
 const m=new T.MeshStandardMaterial(),g=group([m,m]),f=createHeightFog(T);assert.equal(f.install(g).added,1);const version=m.version,hook=m.onBeforeCompile;
 assert.equal(f.install(g).added,0);assert.equal(m.onBeforeCompile,hook);assert.equal(m.version,version);
 const s=shader();f.shaderPatch(s);const strings=[s.vertexShader,s.fragmentShader];assert.equal(f.shaderPatch(s),false);assert.deepEqual([s.vertexShader,s.fragmentShader],strings);
 assert.throws(()=>createHeightFog(T).install(g),/another/);assert.throws(()=>createHeightFog(T).shaderPatch(s),/different/);
 m.onBeforeCompile=()=>{};assert.throws(()=>f.install(g),/changed after/);
});
check('normal/depth/distance overrides, custom water, exclusions and gun scene stay untouched',()=>{
 const f=createHeightFog(T),normal=new T.MeshNormalMaterial(),depth=new T.MeshDepthMaterial(),distance=new T.MeshDistanceMaterial(),custom=new T.ShaderMaterial(),off=new T.MeshBasicMaterial({fog:false});
 const g=group([normal,depth,distance,custom,off]),original=[normal,depth,distance,custom,off].map(m=>[m.onBeforeCompile,m.customProgramCacheKey,m.version]);
 const m=new T.MeshStandardMaterial(),hidden=group(m);hidden.userData.heightFog=false;g.add(hidden);
 const visible=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());visible.customDepthMaterial=depth;visible.customDistanceMaterial=distance;g.add(visible);
 f.install(g);assert.equal(f.info().materials,1);assert.equal(visible.customDepthMaterial,depth);assert.equal(visible.customDistanceMaterial,distance);
 [normal,depth,distance,custom,off].forEach((m,i)=>assert.deepEqual([m.onBeforeCompile,m.customProgramCacheKey,m.version],original[i]));
 assert.equal(m.version,0);assert.throws(()=>f.install(new T.Scene()),/never a Scene/);
 const gun=group(new T.MeshStandardMaterial());assert.equal(gun.children[0].material.version,0);
});
check('actual foliage wind/root hook composes and shadow materials remain byte-identical',()=>{
 const from=vegetation.indexOf('function windMaterial('),to=vegetation.indexOf('function instances(',from),wind=Function('time','return ('+vegetation.slice(from,to).trim()+')')({value:3});
 const m=new T.MeshStandardMaterial({alphaTest:.35}),d=new T.MeshDepthMaterial({alphaTest:.35}),x=new T.MeshDistanceMaterial({alphaTest:.35});wind(m,.34,.022,'proof',true);wind(d,.34,.022,'proof');wind(x,.34,.022,'proof');
 const inst=new T.InstancedMesh(new T.BoxGeometry(),m,2);inst.customDepthMaterial=d;inst.customDistanceMaterial=x;
 const ds={uniforms:{},vertexShader:T.ShaderLib.depth.vertexShader,fragmentShader:T.ShaderLib.depth.fragmentShader};d.onBeforeCompile(ds);const before=JSON.stringify(ds),depthHook=d.onBeforeCompile;
 const f=createHeightFog(T);f.install(inst);const s=shader();m.onBeforeCompile(s);assert.ok(s.vertexShader.includes('transformed.x+=sin'));assert.ok(s.fragmentShader.includes('vGrassRootHeight'));
 assert.ok(s.vertexShader.indexOf('transformed.x+=sin')<s.vertexShader.indexOf('vec4 hfWorldPosition'));assert.equal(d.onBeforeCompile,depthHook);assert.equal(JSON.stringify(ds),before);assert.equal(s.uniforms.uFoliageTime.value,3);
});
check('actual distant mineral hook composes without changing texture shading',()=>{
 const match=distant.match(/m\.onBeforeCompile=shader=>\{([\s\S]*?)\n  \};/);assert.ok(match);
 const m=new T.MeshStandardMaterial();m.onBeforeCompile=Function('T','contrast','return function(shader){'+match[1]+'}')(T,.24);m.customProgramCacheKey=()=> 'landscape-mineral-v2-0';
 const f=createHeightFog(T);f.install(group(m));const s=shader();m.onBeforeCompile(s);assert.ok(s.fragmentShader.includes('mineralLuma'));assert.ok(s.fragmentShader.includes('hfApply'));assert.equal(m.customProgramCacheKey(),'landscape-mineral-v2-0|'+HEIGHT_FOG_REVISION);
});
function worldFromPatch(transformed,model,instance,batch){
 const f=createHeightFog(T),s=shader();f.shaderPatch(s);
 const code=s.vertexShader.slice(s.vertexShader.indexOf('vec4 hfWorldPosition'),s.vertexShader.indexOf('vHeightFogWorld=(modelMatrix*hfWorldPosition).xyz;')+57);
 assert.match(code,/vec4\(transformed,1\.0\)/);assert.doesNotMatch(code,/vec4\(position,/);
 assert.ok(code.indexOf('batchingMatrix*')<code.indexOf('instanceMatrix*'));assert.ok(code.indexOf('instanceMatrix*')<code.indexOf('modelMatrix*'));
 const result=new T.Vector4(transformed.x,transformed.y,transformed.z,1);if(batch)result.applyMatrix4(batch);if(instance)result.applyMatrix4(instance);return result.applyMatrix4(model);
}
check('world position uses deformed local point and full nested instance/batch transforms',()=>{
 const parent=new T.Group(),inst=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial(),1);parent.position.set(-20,6,14);parent.rotation.set(.1,.6,-.2);parent.scale.set(1.2,.8,2);inst.position.set(2,-1,3);parent.add(inst);parent.updateMatrixWorld(true);
 const matrix=new T.Matrix4().compose(new T.Vector3(9,4,-2),new T.Quaternion().setFromEuler(new T.Euler(.4,.3,.2)),new T.Vector3(.8,1.8,1.1));inst.setMatrixAt(0,matrix);
 const batch=new T.Matrix4().makeTranslation(-3,2,8),deformed=new T.Vector3(.2,3.5,.8),actual=worldFromPatch(deformed,inst.matrixWorld,matrix,batch),expected=deformed.clone().applyMatrix4(batch).applyMatrix4(matrix).applyMatrix4(inst.matrixWorld);
 close(actual.x,expected.x);close(actual.y,expected.y);close(actual.z,expected.z);assert.ok(Math.abs(actual.y-deformed.y)>1);
 const s=shader();createHeightFog(T).shaderPatch(s);assert.ok(s.vertexShader.indexOf('#include <skinning_vertex>')<s.vertexShader.indexOf('vec4 hfWorldPosition'));
 assert.ok(s.vertexShader.indexOf('#include <displacementmap_vertex>')<s.vertexShader.indexOf('vec4 hfWorldPosition'));
});
check('real skinned vertex motion changes world height and therefore fog',()=>{
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([0,1,0],3));geo.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,0,0,0],4));geo.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0],4));
 const mesh=new T.SkinnedMesh(geo,new T.MeshStandardMaterial()),bone=new T.Bone();mesh.add(bone);mesh.updateMatrixWorld(true);mesh.bind(new T.Skeleton([bone]));mesh.position.set(20,3,-8);bone.position.y=4;mesh.updateMatrixWorld(true);mesh.skeleton.update();
 const vertex=mesh.getVertexPosition(0,new T.Vector3()),world=worldFromPatch(vertex,mesh.matrixWorld),expected=vertex.clone().applyMatrix4(mesh.matrixWorld);
 close(world.y,expected.y);assert.ok(world.y>5);assert.ok(heightFogCoefficient(80,1.7,world.y)<heightFogCoefficient(80,1.7,1));
});
check('custom water consumes shared uniforms and its already-displaced vRiver without touching alpha',()=>{
 const f=createHeightFog(T),m=new T.ShaderMaterial();
 const vertex=water.match(/material\.vertexShader=`([\s\S]*?)`;/)[1],fragment=water.match(/material\.fragmentShader=`([\s\S]*?)`;/)[1];m.vertexShader=vertex;m.fragmentShader=fragment;
 assert.ok(vertex.includes('vRiver=(modelMatrix*vec4(displaced,1.)).xyz'));
 f.shaderPatch(m,{worldPosition:'vRiver'});assert.equal(m.vertexShader,vertex);assert.ok(m.fragmentShader.includes('hfApply(gl_FragColor.rgb,cameraPosition,vRiver)'));
 assert.ok(m.fragmentShader.includes('if(edge<.005)discard'));assert.ok(m.fragmentShader.includes('gl_FragColor=vec4(water,edge*clamp(opacity+foam,0.,.86))'));
 assert.equal(m.uniforms.uHeightFogDensity,f.uniforms.uHeightFogDensity);assert.equal(f.shaderPatch(m,{worldPosition:'vRiver'}),false);
 f.setWeather(2);assert.equal(m.uniforms.uHeightFogDensity.value,.0056);assert.equal(f.info().explicitPatches,1);
});
check('weather/toggle reuse uniform objects and cache programs; unsupported patches fail atomically',()=>{
 const f=createHeightFog(T),m=new T.MeshStandardMaterial();f.install(group(m));const s=shader();m.onBeforeCompile(s);const key=m.customProgramCacheKey(),version=m.version,refs={...f.uniforms};
 for(let i=0;i<3;i++){f.setWeather(i);assert.equal(f.info().weather,i);assert.deepEqual(f.uniforms.uHeightFogColor.value,new T.Color(HEIGHT_FOG_WEATHER[i].color))}
 f.setEnabled(false);assert.equal(s.uniforms.uHeightFogEnabled.value,0);f.setWeather(0);assert.equal(s.uniforms.uHeightFogEnabled.value,0);f.setEnabled(true);
 for(const k of Object.keys(refs))assert.equal(f.uniforms[k],refs[k]);assert.equal(m.customProgramCacheKey(),key);assert.equal(m.version,version);
 const broken={uniforms:{},vertexShader:'void main(){}',fragmentShader:'void main(){}'},before=JSON.stringify(broken);assert.throws(()=>f.shaderPatch(broken),/hooks/);assert.equal(JSON.stringify(broken),before);
 const conflict=shader();conflict.uniforms.uHeightFogDensity={value:99};assert.throws(()=>f.shaderPatch(conflict),/collision/);
 assert.throws(()=>f.shaderPatch(shader(),{worldPosition:'vRiver; discard;'}),/identifier/);assert.throws(()=>f.setWeather(3));
 assert.equal(f.info().extraDrawCalls,0);assert.equal(f.info().depthTextures,0);assert.doesNotMatch(HEIGHT_FOG_GLSL,/sampler|texture2D|for\s*\(/);
});
check('reflection mode shares world/water uniforms, survives weather changes, and restores in finally without recompilation',()=>{
 const f=createHeightFog(T),m=new T.MeshStandardMaterial(),w=new T.ShaderMaterial();f.install(group(m));const s=shader();m.onBeforeCompile(s);
 w.vertexShader=water.match(/material\.vertexShader=`([\s\S]*?)`;/)[1];w.fragmentShader=water.match(/material\.fragmentShader=`([\s\S]*?)`;/)[1];f.shaderPatch(w,{worldPosition:'vRiver'});
 const refs={...f.uniforms},key=m.customProgramCacheKey(),versions=[m.version,w.version],receiver={},args=[{}, {}, {}];let calls=0,fail=false;
 const previous=function(...received){assert.equal(this,receiver);assert.deepEqual(received,args);calls++;assert.equal(s.uniforms.uHeightFogReflection.value,1);assert.equal(w.uniforms.uHeightFogReflectionPlane.value,-.4);if(fail)throw new Error('reflector test failure');return 42};
 const wrapped=function(...received){f.setReflection(true,-.4);try{return previous.apply(this,received)}finally{f.setReflection(false)}};
 assert.equal(wrapped.apply(receiver,args),42);assert.deepEqual(f.info().reflection,{enabled:false,planeY:-.4});
 fail=true;assert.throws(()=>wrapped.apply(receiver,args),/reflector test failure/);assert.equal(calls,2);assert.equal(s.uniforms.uHeightFogReflection.value,0);assert.equal(w.uniforms.uHeightFogReflection.value,0);
 f.setEnabled(false);f.setReflection(true,-.6);f.setWeather(2);assert.equal(f.info().reflection.enabled,true);assert.equal(f.info().enabled,false);
 for(const bad of [NaN,Infinity,-Infinity,'0']){assert.throws(()=>f.setReflection(false,bad),/finite/);assert.deepEqual(f.info().reflection,{enabled:true,planeY:-.6})}
 f.setReflection(false);f.setEnabled(true);assert.equal(f.info().weather,2);
 for(const name of Object.keys(refs)){assert.equal(f.uniforms[name],refs[name]);assert.equal(s.uniforms[name],refs[name]);assert.equal(w.uniforms[name],refs[name])}
 assert.equal(m.customProgramCacheKey(),key);assert.deepEqual([m.version,w.version],versions);
 const normal=glslAmount(HEIGHT_FOG_WEATHER[2],f.uniforms.uHeightFogEnabled.value,f.uniforms.uHeightFogReflection.value,f.uniforms.uHeightFogReflectionPlane.value);
 close(normal({x:0,y:1.7,z:0},{x:25,y:-.6,z:0}),heightFogCoefficient(Math.hypot(25,2.3),1.7,-.6,2));
 return {reflectionCalls:calls,exceptionRestored:true,sharedUniforms:Object.keys(refs).length,recompilations:0};
});
const failed=checks.filter(c=>!c.pass);
console.log(JSON.stringify({suite:'height-fog-cpu-v1',verdict:failed.length?'FAIL':'PASS',checksPassed:checks.length-failed.length,checksTotal:checks.length,threeRevision:T.REVISION,sources,
 scope:'CPU analytic integration, actual local shader-template/hook composition and transform tests only. No GLSL driver compilation, GPU visual, temporal or performance acceptance.',checks},null,2));
if(failed.length)process.exitCode=1;
