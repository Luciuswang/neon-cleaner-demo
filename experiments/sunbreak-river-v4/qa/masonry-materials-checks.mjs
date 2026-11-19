// Read-only CPU checks. No report files, browser, server or GPU process.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {buildVillage} from '../village.js';
import {buildRuins} from '../ruins.js';
import {layout,wallTopAt,terrainHeight} from '../map-layout.js';
import {createMasonryMaterial,composeMasonryHook,MASONRY_SCALE,MASONRY_PALETTE,MASONRY_FIELDS_GLSL} from '../masonry-materials.js';
import {createHeightFog} from '../height-fog.js';
const baseline={
 village:{geometry:'3b5a7c6053611f627bb5c2adccc13928ad531393af383dea330acbf0ad9556db',uv:'f8de58c354d5398b8ca42d40b4a92809c411eedfa7d3cd90e09c8c6016f24d2c',support:'4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',solids:205,drawCalls:13,triangles:50224,meshes:218},
 ruins:{geometry:'db2dab4d3ec94d84e23e67872dc0bf2c8d1618a372a8cc35c065492c5eb9abf0',uv:'4642b6c59969798047b14795851deed43b8c3a536cb9955701e972ef1305abea',support:'1febad319e60b36bbb99f5467f392d4ff4f63b7f14da82dcc8c3dfefa7f91459',solids:10,drawCalls:10,triangles:25026,meshes:10}
}; // Captured from untouched modules in this workspace BEFORE this correction.
const sha=a=>createHash('sha256').update(a).digest('hex');let checks=0;
function ok(v,label){assert.ok(v,label);checks++}
function equal(a,b,label){assert.deepEqual(a,b,label);checks++}
const slots=['map','normalMap','roughnessMap','aoMap'];
function sources(){return Object.fromEntries(['plaster','brick','stone','wood','roof','metal'].map((k,i)=>{
 const m=new T.MeshStandardMaterial({color:0x958c78,roughness:.73,metalness:i===5?.5:0});
 slots.forEach((slot,j)=>{const t=new T.Texture();t.name=k+'-'+slot;t.repeat.set(1+j*.1,1+j*.2);t.offset.set(.1,.2);t.wrapS=T.ClampToEdgeWrapping;t.wrapT=T.MirroredRepeatWrapping;m[slot]=t});
 m.onBeforeCompile=s=>{s.fragmentShader+='\n// upstream-'+k};m.customProgramCacheKey=()=> 'upstream-key-'+k;return[k,m];
 }))}
function materialSnapshot(materials){return Object.fromEntries(Object.entries(materials).map(([k,m])=>[k,{color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),env:m.envMapIntensity,version:m.version,hook:m.onBeforeCompile.toString(),key:m.customProgramCacheKey(),maps:slots.map(slot=>{const t=m[slot];return{slot,uuid:t.uuid,repeat:t.repeat.toArray(),offset:t.offset.toArray(),wrap:[t.wrapS,t.wrapT],rotation:t.rotation,channel:t.channel,colorSpace:t.colorSpace,version:t.version}})}]))}
function fingerprint(world,solids,result){
 world.updateMatrixWorld(true);const h=createHash('sha256'),uv=createHash('sha256'),meshes=[];
 world.traverse(o=>{if(!o.isMesh)return;
  h.update(JSON.stringify({name:o.name,matrix:o.matrix.toArray(),world:o.matrixWorld.toArray(),ud:o.userData,visible:o.visible,castShadow:o.castShadow,receiveShadow:o.receiveShadow,instanced:o.isInstancedMesh||false}));
  for(const key of ['position','normal']){const a=o.geometry.attributes[key]?.array;if(a)h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength))}
  const i=o.geometry.index?.array;if(i)h.update(Buffer.from(i.buffer,i.byteOffset,i.byteLength));
  if(o.instanceMatrix)h.update(Buffer.from(o.instanceMatrix.array.buffer));if(o.instanceColor)h.update(Buffer.from(o.instanceColor.array.buffer));
  if(o.geometry.attributes.uv)uv.update(Buffer.from(o.geometry.attributes.uv.array.buffer));meshes.push({name:o.name,vertices:o.geometry.attributes.position.count,indices:o.geometry.index?.count||0});
 });
 h.update(JSON.stringify(solids.map(s=>meshes.findIndex(m=>m.name===s.name))));
 const support=[];if(result.floorHeight)for(let x=-24;x<=24;x+=.25)for(let z=-29;z<=23;z+=.25)support.push([x,z,result.floorHeight(x,z)]);
 return{geometry:h.digest('hex'),uv:uv.digest('hex'),support:sha(JSON.stringify(support)),solids:solids.length,meshes:meshes.length,...result.info()};
}
const cases={};
for(const [name,build]of [['village',buildVillage],['ruins',buildRuins]]){
 const world=new T.Group(),solids=[],materials=sources(),before=materialSnapshot(materials),result=build({T,world,solids,materials,layout}),state=fingerprint(world,solids,result);
 equal(materialSnapshot(materials),before,name+' shared materials/textures/hooks must remain untouched');
 for(const field of ['geometry','support','solids','meshes','drawCalls','triangles'])equal(state[field],baseline[name][field],name+' exact baseline '+field);
 ok(state.uv!==baseline[name].uv,name+' UV scale corrected');
 cases[name]={world,solids,result,state};
 world.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,n=o.geometry.attributes.normal,uv=o.geometry.attributes.uv;
  ok([...p.array,...n.array,...(uv?.array||[])].every(Number.isFinite),name+' finite geometry');
  if(!o.material.visible)return;
  for(const slot of slots)if(o.material[slot])for(const src of Object.values(materials))ok(o.material[slot]!==src[slot],name+' texture objects privately owned');
 });
}
// Existing navigation/occlusion expectations, separate from surface appearance.
const ray=new T.Raycaster();function sees(a,b){const origin=new T.Vector3(...a),end=new T.Vector3(...b);ray.set(origin,end.clone().sub(origin).normalize());ray.far=origin.distanceTo(end)-.001;return !ray.intersectObjects(cases.village.solids,true).length}
for(const w of layout.walls){const s=cases.village.solids.find(s=>s.userData.wall===w.id);ok(!!s,'wall collider exists');equal(s.position.toArray(),[w.x,w.y,w.z],'exact collider position');equal([s.geometry.parameters.width,s.geometry.parameters.height,s.geometry.parameters.depth],[w.w,w.h,w.d],'exact collider extents')}
for(const h of layout.houses){ok(sees([h.x,1.6,h.z+4],[h.x,1.6,h.z-4]),'door passage');ok(!sees([h.x-5,.5,h.z],[h.x,.5,h.z]),'wall cover');if(h.ruin<2)ok(!sees([h.x+1,2,h.z-1],[h.x+1,7,h.z-1]),'roof solid');if(h.ruin===1)ok(sees([h.x+1,2,h.z+1],[h.x+1,7,h.z+1]),'ruined roof opening')}
ok(!sees([0,2,-4],[0,-1,-4]),'bridge occlusion');
ray.far=Infinity;const down=new T.Vector3(0,-1,0);let supportSamples=0,maxGap=0;
for(const mound of layout.rubbleMounds)for(let ix=-13;ix<=13;ix++)for(let iz=-13;iz<=13;iz++){
 const x=mound.x+ix*.08,z=mound.z+iz*.08,height=Math.max(terrainHeight(x,z),cases.ruins.result.floorHeight(x,z));
 ray.set(new T.Vector3(x,4,z),down);const hit=ray.intersectObjects(cases.ruins.solids,true)[0];if(hit){const gap=Math.max(0,hit.point.y-height);maxGap=Math.max(maxGap,gap);ok(gap<1e-5,'unchanged visible fracture support')}
 const next=Math.max(terrainHeight(x+.04,z),cases.ruins.result.floorHeight(x+.04,z));ok(Math.abs(next-height)<.4,'unchanged debris step bound');supportSamples++;
}
// Material-only region flags select raw cores without splitting/reindexing any
// original batch, adding draw calls, or consuming another production RNG value.
const brick=cases.village.world.getObjectByName('village_brick'),mask=brick.geometry.attributes.masonryCore;
ok(mask&&mask.count===brick.geometry.attributes.position.count,'brick core attribute covers original vertices');
let coreTriangles=0,courseTriangles=0;const idx=brick.geometry.index;
for(let i=0;i<idx.count;i+=3){const values=[0,1,2].map(j=>mask.getX(idx.getX(i+j)));ok(values.every(v=>v===values[0])&&(values[0]===0||values[0]===1),'no interpolated core/course borders within triangles');if(values[0])coreTriangles++;else courseTriangles++}
ok(coreTriangles>200&&courseTriangles>0,'both individual cores and complete wall courses remain');
for(const name of ['broken-brick-edges',...layout.rubbleMounds.map(m=>m.id)]){const mat=cases.ruins.world.getObjectByName(name).material;for(const slot of slots)equal(mat[slot],null,'fracture core/aggregate has no whole brick or gravel map')}
const plaster=cases.village.world.getObjectByName('village_ochre').material;
for(const slot of slots)equal(plaster[slot].repeat.toArray(),[1/1.8,1/1.8],'plaster maps use same documented 1.8m tile');
equal(MASONRY_SCALE.brickLength,.235,'23.5cm brick');equal(MASONRY_SCALE.courseHeight,.085,'8.5cm course');
const luma=m=>m.color.r*.2126+m.color.g*.7152+m.color.b*.0722;
const ruinFace=cases.ruins.world.getObjectByName('fallen-plaster-faces').material,ruinCore=cases.ruins.world.getObjectByName('broken-brick-edges').material;
ok(luma(ruinCore)<luma(ruinFace)*.58,'raw core distinctly darker than pale plaster, not chalk-white chips');
ok(Math.abs(ruinFace.color.r-ruinFace.color.b)<.13,'plaster warm grey, not saturated cream');
// Execute the actual scalar GLSL fields on the CPU (JS doubles, not a GPU
// compiler). This catches a mask collapsing to a constant without a screenshot
// or a hand-maintained duplicate of the shader's formulas.
const scalarNames=[...MASONRY_FIELDS_GLSL.matchAll(/float (masonry\w+)\(/g)].map(m=>m[1]);
const scalarJS=MASONRY_FIELDS_GLSL.replace(/float (masonry\w+)\(([^)]*)\)/g,(_,name,args)=>'function '+name+'('+args.replace(/float /g,'')+')').replace(/\bfloat\s+/g,'let ');
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),mix=(a,b,t)=>a+(b-a)*t,smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const fields=Function('fract','sin','floor','abs','max','min','step','mix','smoothstep',scalarJS+';return {'+scalarNames.join(',')+'}')(x=>x-Math.floor(x),Math.sin,Math.floor,Math.abs,Math.max,Math.min,(a,b)=>b<a?0:1,mix,smoothstep);
let binderSamples=0,claySamples=0,aggregateSamples=0,fieldSamples=0,baseClear=0,baseStained=0,smallSpalled=0,smallCoated=0;
for(let ix=0;ix<128;ix++)for(let iz=0;iz<64;iz++){
 const x=-1.2+ix*.019,z=2.1+iz*.027,binder=fields.masonryBinder(x,z),aggregate=fields.masonryInclusion(x,z,.001),soil=fields.masonrySoil(x,.04,z),spall=fields.masonryExposure(.68,.2,x,z);
 ok([binder,aggregate,soil,spall].every(v=>Number.isFinite(v)&&v>=0&&v<=1),'finite bounded actual shader masks');
 if(binder>.9)binderSamples++;if(binder<.1)claySamples++;if(aggregate>.5)aggregateSamples++;if(soil<.003)baseClear++;if(soil>.08)baseStained++;if(spall>.9)smallSpalled++;if(spall<.1)smallCoated++;fieldSamples++;
 equal(fields.masonryExposure(0,10,x,z),0,'unbroken plaster not accidentally exposed');
 equal(fields.masonryExposure(1,10,x,z),1,'small plaster box core on every face');
 equal(fields.masonryExposure(0,0,x,z),1,'profile fracture perimeter genuinely exposed');
 equal(fields.masonrySoil(x,.46,z),0,'soil staining bounded below 46cm, not global AO');
 equal(fields.masonryInclusion(x,z,.05),0,'small aggregate anti-alias fade at distance');
}
ok(binderSamples>fieldSamples*.12&&claySamples>fieldSamples*.3,'coherent clay and binder areas both present');
ok(aggregateSamples>fieldSamples*.04&&aggregateSamples<fieldSamples*.32,'mineral inclusions sparse but readable, not white noise');
ok(baseClear>fieldSamples*.08&&baseStained>fieldSamples*.2,'discontinuous soil staining has clean and stained intervals');
ok(smallSpalled>fieldSamples*.4&&smallCoated>fieldSamples*.05,'small flakes keep irregular coating remnants, not all-white caps');
equal(MASONRY_SCALE.corePatch,.075,'75mm mixed core scale');equal(MASONRY_SCALE.aggregateCell,.012,'12mm fine aggregate field; no circular cellular pattern');
const palette=Object.fromEntries(Object.entries(MASONRY_PALETTE).map(([k,v])=>[k,new T.Color(v)])),paletteLuma=c=>luma({color:c});
ok(paletteLuma(palette.clay)<luma(ruinFace)*.30,'clay albedo clearly separated from plaster');
ok(paletteLuma(palette.mortar)>paletteLuma(palette.clay)*1.35&&paletteLuma(palette.mortar)<luma(ruinFace)*.55,'grey binder distinct without chalk-white patches');
ok(paletteLuma(palette.aggregate)<paletteLuma(palette.mortar)*.6,'aggregate inclusions visibly distinct');
let brokenProfileVertices=0,coatedFragmentVertices=0,exposedFragmentVertices=0,materialAttributeBytes=0;
for(const [name,c]of Object.entries(cases))c.world.traverse(o=>{
 if(!o.isMesh||!o.material.visible)return;
 const p=o.geometry.attributes.position,region=o.geometry.attributes.masonryBreak,core=o.geometry.attributes.masonryCore;
 materialAttributeBytes+=(region?.array.byteLength||0)+(core?.array.byteLength||0);
 if(o.material.userData.masonry?.role!=='plaster')return;
 ok(region&&region.count===p.count,'plaster region attribute covers all original vertices');
 for(let i=0;i<p.count;i++){
  const coverage=region.getX(i),distance=region.getY(i);ok(Number.isFinite(coverage)&&coverage>=0&&coverage<=1&&Number.isFinite(distance)&&distance>=0,'valid material-only coating metadata');
  if(name==='village'&&distance<9){
   const candidates=layout.walls.filter(w=>w.profile&&Math.abs(p.getX(i)-w.x)<=w.w/2+1e-5&&Math.abs(p.getZ(i)-w.z)<=w.d/2+1e-5);
   ok(candidates.some(w=>Math.abs(wallTopAt(w,p.getX(i),p.getZ(i))-p.getY(i)-distance)<2e-5),'break band follows exact existing fracture profile');brokenProfileVertices++;
  }
  if(name==='ruins'){if(coverage<.2&&distance>.15)coatedFragmentVertices++;if(coverage>.6||distance===0)exposedFragmentVertices++}
 }
});
ok(brokenProfileVertices>0&&coatedFragmentVertices>0&&exposedFragmentVertices>0,'profile lips, retained large slab coating and stripped small flakes all encoded');
// The current production village small blocks are brick, not plaster. Exercise
// the explicit small-plaster guard using a separate deterministic test layout.
const guardWorld=new T.Group();buildVillage({T,world:guardWorld,materials:sources(),solids:[],layout:{houses:[],walls:[{id:'test-small-plaster',x:0,y:.06,z:0,w:.3,h:.12,d:.2,material:'plaster'}]}});
const guard=guardWorld.getObjectByName('village_ochre');ok(!!guard,'test plaster box retains original plaster batch');
equal(guard.geometry.index.count,36,'guard keeps box indices');equal(guard.geometry.attributes.position.count,24,'guard keeps box vertices');
ok([...guard.geometry.attributes.masonryBreak.array].filter((_,i)=>i%2===0).every(v=>v===1),'non-profile small plaster boxes all-face core guard');
// Test hook composition before AND after masonry. This is shader-source QA,
// not a browser compile or a height-fog visual acceptance claim.
const keys=new Set();
for(const role of ['plaster','course','core','stone','aggregate']){
 const src=sources().plaster,mat=createMasonryMaterial(T,src,{role});
 composeMasonryHook(mat,'test-later-fog',s=>{s.fragmentShader+='\n// later-heightfog-hook'});
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader,{});
 ok(shader.fragmentShader.includes('// upstream-plaster'),'upstream shader hook preserved');ok(shader.fragmentShader.includes('// later-heightfog-hook'),'later fog hook composes');
 ok(shader.fragmentShader.includes('masonryBump(normal,-vViewPosition,masonryRelief)'),'fine surface relief uses fragment normal only');
 ok(shader.fragmentShader.indexOf('float masonryDirt=')<shader.fragmentShader.indexOf('roughnessFactor=clamp(max('),'material variables in scope');
 ok(shader.vertexShader.includes('#include <project_vertex>')&&shader.vertexShader.includes('#include <defaultnormal_vertex>'),'no vertex/normal deformation');
 ok(mat.customProgramCacheKey().includes('upstream-key-plaster'),'upstream cache identity retained');keys.add(mat.customProgramCacheKey());
 if(role==='course'){
  ok(shader.fragmentShader.includes('*(1.-masonryCoreMix)'),'whole-wall mortar omitted on cut cores');
  ok(shader.fragmentShader.includes('max(vMasonryCore,smoothstep(.65,.90,masonryAxis.y))'),'unprofiled horizontal wall tops also expose raw core');
 }
 if(role==='plaster')ok(shader.fragmentShader.includes('mix(normal,nonPerturbedNormal,masonryCoreMix)'),'exposed core does not inherit intact plaster normal pattern');
 equal(shader.uniforms.uMasonryClay.value.toArray(),palette.clay.toArray(),'explicit raw-clay shader albedo');
 equal(shader.uniforms.uMasonryMortar.value.toArray(),palette.mortar.toArray(),'explicit grey-binder shader albedo');
 ok(mat.roughness>=.85&&mat.metalness===0,'matte nonmetal masonry');
 const fogRoot=new T.Group();fogRoot.add(new T.Mesh(new T.BoxGeometry(),mat));const fog=createHeightFog(T);fog.install(fogRoot);
 const withFog={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(withFog,{});
 ok(withFog.fragmentShader.includes('hfAmount')&&withFog.fragmentShader.includes('masonryRaw')&&withFog.fragmentShader.includes('// later-heightfog-hook'),'actual current height-fog hook composes after masonry');
 ok(Object.hasOwn(withFog.uniforms,'uMasonryClay'),'fog retains masonry uniforms');
}
equal(keys.size,5,'role-specific shader cache keys');
const inputs={};for(const path of ['village.js','ruins.js','masonry-materials.js','qa/masonry-materials-checks.mjs'])inputs[path]=sha(await readFile(new URL('../'+path,import.meta.url)));
const actualVisible={};for(const [name,c]of Object.entries(cases)){let drawCalls=0,triangles=0;c.world.traverse(o=>{if(!o.isMesh||!o.visible||!o.material.visible)return;drawCalls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1)});actualVisible[name]={drawCalls,triangles}}
console.log(JSON.stringify({status:'CPU material/geometry checks completed; NOT GPU or art acceptance',checks,baselineOrigin:'pre-edit local module captures, 2026-11-19',village:cases.village.state,ruins:cases.ruins.state,actualVisible,note:'Legacy ruins.info triangles exclude 576 unchanged mound triangles; actualVisible includes them.',supportSamples,maxGap,coreTriangles,courseTriangles,materialAttributeBytes,brokenProfileVertices,coatedFragmentVertices,exposedFragmentVertices,scalarFields:{fieldSamples,binderSamples,claySamples,aggregateSamples,baseClear,baseStained,smallSpalled,smallCoated,note:'Source-derived scalar GLSL evaluated in JS doubles; NOT GPU shader or visual validation.'},incrementalDrawCalls:0,incrementalTriangles:0,sources:inputs,limits:'No browser/GPU, source/publication or visual PASS claim. Root must independently render/review current frozen hashes.'},null,2));
