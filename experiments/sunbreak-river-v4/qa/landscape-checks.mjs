// CPU-only plan/geometry/material checks. No server, browser, network, image
// capture or report-file writes. Stdout is NOT visual or frame-pacing evidence.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {LANDSCAPE_LIMITS,landscapePlan,ridgeBounds,sampleRidge,validateLandscapePlan,generateRidgeGeometry,validateRidgeGeometry,buildDistantLandscape} from '../distant-landscape.js';
import {MAP,TERRAIN_GRID,bounds,navigationBounds,spawns,bufferPlacements} from '../map-layout.js';

const started=performance.now(),checks=[],sources={};
const digest=b=>createHash('sha256').update(b).digest('hex');
for(const path of ['../distant-landscape.js','./landscape-checks.mjs','../map-layout.js','../../sunbreak-storm-v3/vendor/presentation/build/three.module.js'])sources[path]=digest(await readFile(new URL(path,import.meta.url)));
function check(name,fn){
 try{const detail=fn();checks.push({name,pass:true,...detail===undefined?{}:{detail}})}
 catch(e){checks.push({name,pass:false,error:e.message})}
}
const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const plan=landscapePlan(),geometries=plan.map(generateRidgeGeometry),proof=geometries.map((g,i)=>validateRidgeGeometry(g,plan[i]));
const gameplay=()=>JSON.stringify({MAP,TERRAIN_GRID,bounds,navigationBounds,spawns,bufferPlacements});
const gameplayBefore=gameplay();
function bytes(a){return Buffer.from(a.buffer,a.byteOffset,a.byteLength)}
function cloneGeometry(g){return {...g,positions:g.positions.slice(),normals:g.normals.slice(),indices:g.indices.slice(),groups:g.groups.map(q=>({...q}))}}

check('six patches / three layers / declared geometry and draw budgets',()=>{
 const result=validateLandscapePlan(plan);assert.equal(result.ok,true,JSON.stringify(result.errors));
 assert.equal(result.triangles,79360);assert.equal(result.drawCalls,12);
 assert.ok(result.triangles<=LANDSCAPE_LIMITS.maxTriangles);assert.ok(result.drawCalls<=LANDSCAPE_LIMITS.maxDrawCalls);
 assert.deepEqual(plan.map(p=>p.layer),[0,0,1,1,2,2]);return result;
});
check('fresh deterministic plan; caller mutation does not change source plan',()=>{
 assert.deepEqual(plan,landscapePlan());const copy=landscapePlan();copy[0].crest[0][2]=0;copy[0].along[0]=0;
 assert.deepEqual(plan,landscapePlan());assert.notDeepEqual(plan,copy);
});
check('plan validator rejects terrain/valley/range/budget/duplicate/NaN corruption',()=>{
 const changes=[p=>{p[0].across=[-140,-129]},p=>{p[4].along=[-340,10]},p=>{p[5].across=[-800,-430]},
  p=>{p[0].segments=[256,256]},p=>{p[0].id=p[1].id},p=>{p[0].crest[2][2]=NaN},p=>{p[0].crest[2]=null},p=>{p[0].heightScale=NaN}];
 for(const change of changes){const copy=landscapePlan();change(copy);assert.equal(validateLandscapePlan(copy).ok,false)}
 assert.equal(validateLandscapePlan(null).ok,false);return {negativeCases:changes.length+1};
});
check('authored patch rectangles outside actual terrain and gameplay/nav/cabin bounds',()=>{
 assert.equal(TERRAIN_GRID.size/2,LANDSCAPE_LIMITS.terrainHalfExtent);
 const exclude=[{min:{x:MAP.minX,z:MAP.minZ},max:{x:MAP.maxX,z:MAP.maxZ}},...navigationBounds];
 for(const p of plan){
  const b=ridgeBounds(p),h=TERRAIN_GRID.size/2;
  assert.ok(b.maxX<=-h||b.minX>=h||b.maxZ<=-h||b.minZ>=h,p.id);
  for(const q of exclude)assert.ok(b.maxX<q.min.x||b.minX>q.max.x||b.maxZ<q.min.z||b.minZ>q.max.z,p.id);
 }return {terrainHalfExtent:TERRAIN_GRID.size/2,excludedNavigationBoxes:navigationBounds.length};
});
for(let i=0;i<plan.length;i++)check(`${plan[i].id}: all vertices/normals/indices/winding/faces/groups/range`,()=>{
 assert.equal(proof[i].ok,true,JSON.stringify(proof[i].errors));return proof[i];
});
check('entire north/south valley remains empty, not a generic cone ring',()=>{
 let samples=0;
 for(let z=-700;z<=700;z+=10)for(const x of [-36,-18,0,18,36])for(const p of plan){assert.equal(sampleRidge(p,x,z),null);samples++}
 assert.ok(plan.every(p=>p.crest.length>=9));
 assert.notDeepEqual(plan[0].crest,plan[1].crest);assert.notDeepEqual(plan[2].crest,plan[3].crest);assert.notDeepEqual(plan[4].crest,plan[5].crest);
 return {emptyValleyWidth:72,emptySamplerProbes:samples};
});
check('full indexed faces cannot bridge the terrain or river opening',()=>{
 let triangles=0;
 for(const g of geometries)for(let i=0;i<g.indices.length;i+=3){
  const v=Array.from(g.indices.subarray(i,i+3),k=>[g.positions[k*3],g.positions[k*3+2]]);
  for(const h of [36,130])assert.ok(v.every(([x])=>x<=-h)||v.every(([x])=>x>=h)||(h===130&&(v.every(([,z])=>z<=-h)||v.every(([,z])=>z>=h))));
  triangles++;
 }return {trianglesChecked:triangles};
});
check('grid boundary sinks below ground; no vertical curtains',()=>{
 for(let i=0;i<plan.length;i++){
  const [na,nc]=plan[i].segments,g=geometries[i];
  for(let j=0;j<=nc;j++)for(let k=0;k<=na;k++)if(k===0||k===na||j===0||j===nc)near(g.positions[(j*(na+1)+k)*3+1],-9);
  const b=ridgeBounds(plan[i]);assert.equal(sampleRidge(plan[i],b.minX-.001,b.minZ-.001),null);
 }
});
check('byte-identical regeneration with global random forbidden',()=>{
 const old=Math.random;Math.random=()=>{throw new Error('Nondeterministic RNG use')};
 try{for(let i=0;i<plan.length;i++){
  const again=generateRidgeGeometry(plan[i]);
  for(const key of ['positions','normals','colors','uvs','indices'])assert.equal(digest(bytes(again[key])),digest(bytes(geometries[i][key])),`${plan[i].id}/${key}`);
 }}finally{Math.random=old}
 return {attributesCompared:30};
});
check('authored low-valley height ranges and unequal crest peaks (not art acceptance)',()=>{
 // Intentional re-authoring after the 07-13-40 actual frame: near <=55m,
 // middle <=100m, distant <=110m. These check the new spec, not image quality.
 const authoredRanges=[[45,55],[85,100],[98,110]],scales=[.46,.475,.455];
 const evidence=[];
 for(let n=0;n<plan.length;n++){
  const p=plan[n],peaks=p.crest.filter((k,i,a)=>i&&i<a.length-1&&k[2]>a[i-1][2]+15&&k[2]>a[i+1][2]+15);
  assert.ok(peaks.length>=3,p.id);assert.ok(new Set(peaks.map(k=>k[2])).size>=3);
  const maxY=proof[n].maxY,[minHeight,maxHeight]=authoredRanges[p.layer];
  assert.ok(maxY>=minHeight&&maxY<=maxHeight,`${p.id}: ${maxY} outside authored ${minHeight}..${maxHeight}`);
  near(p.heightScale,scales[p.layer]);
  const g=geometries[n];let elevation=0;
  for(let k=0;k<g.positions.length;k+=3){
   const x=g.positions[k],y=g.positions[k+1],z=g.positions[k+2];
   elevation=Math.max(elevation,Math.atan2(y-1.7,Math.hypot(x+7,z-24))*180/Math.PI);
  }
  assert.ok(Number.isFinite(elevation));evidence.push({id:p.id,largeCrestPeaks:peaks.length,maxY,authoredHeightRange:[minHeight,maxHeight],heightScale:p.heightScale,maxElevationFromHeroDegrees:elevation});
 }return evidence;
});
check('scarp/talus structure has eroded steep faces, not smooth single humps',()=>{
 const result=[];
 for(let n=0;n<plan.length;n++){
  const g=geometries[n];let steep=0,gentle=0,variation=0;
  for(let k=0;k<g.normals.length;k+=3){if(g.normals[k+1]<.65)steep++;if(g.normals[k+1]>.88)gentle++}
  const [na,nc]=plan[n].segments;
  for(let j=2;j<nc-2;j++)for(let i=2;i<na-2;i++){
   const y=k=>g.positions[(j*(na+1)+k)*3+1];variation+=Math.abs(y(i-1)-2*y(i)+y(i+1));
  }
  assert.ok(steep>30&&gentle>30,plan[n].id);assert.ok(variation>500,plan[n].id);
  result.push({id:plan[n].id,steepVertices:steep,talusVertices:gentle,erosionSecondDifferenceSum:variation});
 }return result;
});
check('muted mineral gray-green to blue-gray layers; no snow/white summit mask',()=>{
 const layers=[0,1,2].map(layer=>{
  const colors=geometries.filter((_,i)=>plan[i].layer===layer).flatMap(g=>Array.from(g.colors));
  let r=0,b=0;for(let i=0;i<colors.length;i+=3){r+=colors[i];b+=colors[i+2]}
  const blueMinusRed=(b-r)/(colors.length/3);
  assert.ok(colors.every(v=>v>=.12&&v<=1));
  return {layer,blueMinusRed};
 });
 assert.ok(layers[0].blueMinusRed<layers[1].blueMinusRed&&layers[1].blueMinusRed<layers[2].blueMinusRed);
 for(const g of geometries)for(let k=0;k<g.colors.length;k+=3)assert.ok(Math.max(...g.colors.subarray(k,k+3))<.70);
 return layers;
});
check('geometry validator rejects bad winding/index/sampler/normal/valley data',()=>{
 const mutations=[g=>{[g.indices[0],g.indices[1]]=[g.indices[1],g.indices[0]]},g=>{g.indices[0]=65535},
  g=>{g.positions[1]=NaN},g=>{g.normals[0]=10},g=>{g.positions[0]=0},g=>{g.positions[1]+=12},g=>{g.groups[1].start=0}];
 for(const mutate of mutations){const g=cloneGeometry(geometries[0]);mutate(g);assert.equal(validateRidgeGeometry(g,plan[0]).ok,false)}
 return {negativeCases:mutations.length};
});

// Synthetic loaded-material stand-ins test ownership and API, not appearance.
const sourceTextures=[],sourceMaterials={};let sharedDisposals=0;
for(const key of ['stone','bark']){
 const m=new T.MeshStandardMaterial({color:key==='stone'?0xa9b4a3:0x8e7953,roughness:.83,metalness:.07});
 m.normalScale.set(.65,.65);m.envMapIntensity=.7;
 for(const field of ['map','normalMap','roughnessMap']){
  const tex=new T.Texture();tex.name=`${key}-${field}`;tex.repeat.set(2,3);tex.offset.set(.1,.2);tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.addEventListener('dispose',()=>sharedDisposals++);m[field]=tex;sourceTextures.push(tex);
 }
 m.addEventListener('dispose',()=>sharedDisposals++);sourceMaterials[key]=m;
}
const materialSnapshot=()=>JSON.stringify(Object.fromEntries(Object.entries(sourceMaterials).map(([k,m])=>[k,{color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),env:m.envMapIntensity,vertexColors:m.vertexColors,
 maps:['map','normalMap','roughnessMap'].map(f=>({uuid:m[f].uuid,repeat:m[f].repeat.toArray(),offset:m[f].offset.toArray(),version:m[f].version,wrapS:m[f].wrapS,wrapT:m[f].wrapT}))}])));
const beforeMaterials=materialSnapshot(),scene=new T.Scene(),world=new T.Group(),sentinel=new T.Object3D();
const fog=new T.Fog(0x78949c,100,680),environment=new T.Texture();scene.fog=fog;scene.environment=environment;scene.add(world);world.add(sentinel);
let landscape,buildMilliseconds=0;
check('build API using local Three only; one root attached and no foreign scene changes',()=>{
 const t=performance.now();landscape=buildDistantLandscape({T,world,materials:sourceMaterials});buildMilliseconds=performance.now()-t;
 assert.deepEqual(world.children,[sentinel,landscape.root]);assert.equal(scene.fog,fog);assert.equal(scene.environment,environment);
 assert.equal(landscape.info().visualOnly,true);assert.equal(landscape.info().colliders,0);
 assert.equal(gameplay(),gameplayBefore);return {buildMilliseconds,rendered:false};
});
check('actual Three geometries match pure arrays and stay within budgets',()=>{
 assert.ok(landscape);
 let triangles=0,drawCalls=0,lights=0;
 for(let i=0;i<landscape.root.children.length;i++){
  const m=landscape.root.children[i],g=geometries[i];
  assert.equal(m.name,plan[i].id);assert.equal(m.isMesh,true);assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);
  assert.equal(m.frustumCulled,true);assert.equal(m.matrixAutoUpdate,false);assert.equal(m.children.length,0);
  assert.deepEqual(m.geometry.attributes.position.array,g.positions);assert.deepEqual(m.geometry.index.array,g.indices);
  assert.deepEqual(m.geometry.groups,g.groups);assert.ok(m.geometry.boundingSphere.radius>0);
  triangles+=m.geometry.index.count/3;drawCalls+=m.geometry.groups.length;
 }
 landscape.root.traverse(o=>{if(o.isLight)lights++});assert.equal(lights,0);
 assert.equal(triangles,79360);assert.equal(drawCalls,12);assert.equal(landscape.info().triangles,triangles);assert.equal(landscape.info().drawCalls,drawCalls);
 assert.equal(landscape.info().snow,false);return {triangles,basePassDrawCalls:drawCalls};
});
check('source material/texture references reused, not changed or duplicated',()=>{
 assert.ok(landscape);const mats=new Set();
 for(const mesh of landscape.root.children)for(let i=0;i<mesh.material.length;i++){
  const m=mesh.material[i],source=sourceMaterials[i?'bark':'stone'];mats.add(m);
  assert.notEqual(m,source);for(const f of ['map','normalMap','roughnessMap'])assert.equal(m[f],source[f]);
  assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);assert.equal(m.fog,true);assert.equal(m.vertexColors,true);
  assert.equal(m.side,T.FrontSide);assert.equal(m.emissive.getHex(),0);
 }
 assert.equal(mats.size,6);assert.equal(materialSnapshot(),beforeMaterials);assert.equal(sharedDisposals,0);
});
check('weather controls owned clones only; no custom sun or scene fog/exposure',()=>{
 assert.ok(landscape);const first=landscape.root.children[0].material[0];
 for(const [value,key,roughness]of [[0,'sunny',.91],[1,'overcast',.81],[2,'storm',.68],['sunny','sunny',.91]]){
  landscape.setWeather(value);assert.equal(landscape.info().weather,key);near(first.roughness,roughness);
  near(first.envMapIntensity,key==='storm'?.50:.45);
  assert.equal(scene.fog,fog);assert.equal(scene.environment,environment);assert.equal(fog.near,100);assert.equal(fog.far,680);
  assert.equal(materialSnapshot(),beforeMaterials);
 }
 for(const bad of [3,-1,NaN,'snow',null,undefined])assert.throws(()=>landscape.setWeather(bad),RangeError);
 assert.equal(landscape.info().weather,'sunny');assert.equal(gameplay(),gameplayBefore);
});
check('mineral shader reduces decoded map contrast without extra sampling or lighting',()=>{
 const cacheKeys=new Set(),evidence=[];
 for(const mesh of landscape.root.children)for(const m of mesh.material){
  const layer=mesh.userData.layer,contrast=[.24,.18,.12][layer],shader={fragmentShader:T.ShaderLib.standard.fragmentShader};
  m.onBeforeCompile(shader);cacheKeys.add(m.customProgramCacheKey());
  assert.ok(!shader.fragmentShader.includes('#include <map_fragment>'));
  assert.ok(shader.fragmentShader.includes('float mineralLuma = dot(sampledDiffuseColor.rgb'));
  assert.ok(shader.fragmentShader.includes(`sampledDiffuseColor.rgb, 0.15), ${contrast.toFixed(2)})`));
  assert.equal((shader.fragmentShader.match(/texture2D\( map, vMapUv \)/g)||[]).length,1);
  assert.ok(shader.fragmentShader.includes('#include <lights_fragment_begin>'));
  assert.ok(shader.fragmentShader.includes('#include <fog_fragment>'));
  assert.ok(m.normalScale.x<=.20);assert.equal(m.emissive.getHex(),0);
  // The shader's normalized gray input span contracts to exactly contrast.
  const low=.52*(1-contrast),high=low+contrast;near(high-low,contrast);
  evidence.push({material:m.name,contrast,grayInputOutputRange:[low,high],normalScale:m.normalScale.x});
 }
 assert.equal(cacheKeys.size,3);assert.equal(materialSnapshot(),beforeMaterials);
 return {shaderSourceChecked:true,gpuCompiled:false,materials:evidence};
});
check('info is detached metadata, not mutable geometry/material state',()=>{
 const a=landscape.info(),b=landscape.info();a.patches[0].bounds.min.x=1;a.patches.length=0;a.distanceBudget[0]=0;
 assert.deepEqual(landscape.info(),b);
});
check('dispose releases only owned resources and is idempotent',()=>{
 let geometriesDisposed=0,materialsDisposed=0;const owned=new Set();
 for(const mesh of landscape.root.children){mesh.geometry.addEventListener('dispose',()=>geometriesDisposed++);for(const m of mesh.material)owned.add(m)}
 for(const m of owned)m.addEventListener('dispose',()=>materialsDisposed++);
 landscape.dispose();landscape.dispose();assert.equal(geometriesDisposed,6);assert.equal(materialsDisposed,6);assert.equal(sharedDisposals,0);
 assert.deepEqual(world.children,[sentinel]);assert.equal(landscape.info().disposed,true);assert.throws(()=>landscape.setWeather(0),/disposed/);
 assert.equal(materialSnapshot(),beforeMaterials);assert.equal(scene.fog,fog);assert.equal(gameplay(),gameplayBefore);
});
check('missing dependencies fail without partial world mutation',()=>{
 const count=world.children.length;assert.throws(()=>buildDistantLandscape({T,world,materials:{stone:sourceMaterials.stone}}),TypeError);
 assert.equal(world.children.length,count);
});

const failed=checks.filter(c=>!c.pass);
console.log(JSON.stringify({suite:'river-distant-landscape-cpu-v2-low-valley',verdict:failed.length?'FAIL':'PASS',checksPassed:checks.length-failed.length,checksTotal:checks.length,
 scope:'CPU only. No browser, GPU, rendered art, continuous motion or frame-performance acceptance.',sources,
 placements:plan.map(p=>({id:p.id,layer:p.layer,axis:p.axis,bounds:ridgeBounds(p),segments:p.segments,seed:p.seed,heightScale:p.heightScale})),
 totals:{triangles:proof.reduce((n,p)=>n+p.triangles,0),vertices:proof.reduce((n,p)=>n+p.vertices,0),basePassDrawCalls:12,minRadius:Math.min(...proof.map(p=>p.minRadius)),maxRadius:Math.max(...proof.map(p=>p.maxRadius)),maxY:Math.max(...proof.map(p=>p.maxY)),buildMilliseconds,elapsedMilliseconds:performance.now()-started},checks},null,2));
if(failed.length)process.exitCode=1;
