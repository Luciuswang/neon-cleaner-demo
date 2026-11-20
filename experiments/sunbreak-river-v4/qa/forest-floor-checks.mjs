// CPU only: no browser, GPU, network, captures or report-file writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {FOREST_FLOOR_LIMITS as L,FOREST_WIND_GLSL,FOREST_ROOT_SHADE_GLSL,forestCover,forestAllowed,applyForestAttributes,forestFloorPlan,buildForestFloor} from '../forest-floor.js';
import {MAP,TERRAIN_GRID,landscapeHeight,riverWidth,blocked,houses,bufferPlacements,bufferLocal,crossings,spawns,teamSpawns} from '../map-layout.js';
import {vegetationPlan} from '../vegetation.js';

const checks=[],sources={};
const digest=a=>createHash('sha256').update(a).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function check(name,fn){try{const detail=fn();checks.push({name,pass:true,...detail===undefined?{}:{detail}})}catch(e){checks.push({name,pass:false,error:e.message})}}
const moduleURL=new URL('../forest-floor.js',import.meta.url);
const source=await readFile(moduleURL,'utf8');
for(const p of ['./forest-floor-checks.mjs','../forest-floor.js','../map-layout.js','../vegetation.js','../../sunbreak-storm-v3/vendor/presentation/build/three.module.js'])sources[p]=digest(await readFile(new URL(p,import.meta.url)));
const plan=forestFloorPlan(),world=new T.Group(),floor=buildForestFloor(T,world),info=floor.info();
const outside=(x,z,pad=0)=>x<MAP.minX-pad||x>MAP.maxX+pad||z<MAP.minZ-pad||z>MAP.maxZ+pad;
const laneDistance=(x,z)=>Math.abs(Math.abs(x)-(10+.32*Math.sin(z*.19)));
function protectedPoint(x,z){
 return !outside(x,z)||Math.abs(x)<=riverWidth(z)+2.8||laneDistance(x,z)<=1.85;
}
function assertClear(x,z){
 assert.ok(outside(x,z),'complete gameplay rectangle excluded');
 assert.ok(Math.abs(x)>riverWidth(z)+2.8,'river and bank excluded');
 assert.ok(laneDistance(x,z)>1.85,'existing lane continuation excluded');
 assert.ok(Math.max(Math.abs(x),Math.abs(z))<TERRAIN_GRID.size/2,'inside real terrain');
}

check('fresh deterministic ecology plan, isolated RNG and no shared layout mutation',()=>{
 const layout=JSON.stringify({MAP,TERRAIN_GRID,houses,bufferPlacements,crossings,spawns,teamSpawns});
 const savedRandom=Math.random;let repeat;
 try{Math.random=()=>{throw Error('forest planner must own its RNG')};repeat=forestFloorPlan()}finally{Math.random=savedRandom}
 assert.deepEqual(plan,repeat);repeat.tufts[0].x=NaN;repeat.clusters[0].x=NaN;
 assert.deepEqual(plan,forestFloorPlan());
 assert.equal(JSON.stringify({MAP,TERRAIN_GRID,houses,bufferPlacements,crossings,spawns,teamSpawns}),layout);
 assert.doesNotMatch(source,/import[^;]*vegetation\.js|Math\.random\s*\(/);
 return {seed:plan.seed,positionHash:digest(JSON.stringify(plan.tufts))};
});

check('bounded scalar, broad green carpet and uninterrupted near-grove/hill coverage',()=>{
 let total=0,green=0,sum=0;
 for(let z=-128;z<=128;z+=2)for(let x=-128;x<=128;x+=2){
  const c=forestCover(x,z);assert.ok(Number.isFinite(c)&&c>=0&&c<=1);
  if(outside(x,z,8)&&Math.abs(x)>14){total++;sum+=c;if(c>.60)green++}
 }
 assert.ok(green/total>.97,'broad land coverage must extend across the terrain');
 assert.ok(sum/total>.76,'forest must visibly dominate its ground blend');
 for(const side of [-1,1]){
  for(let z=-45;z<=43;z+=.5)assert.ok(forestCover(side*43,z)>.65,'connected near-grove carpet');
  for(let x=43;x<=128;x+=.5)assert.ok(forestCover(side*x,17)>.65,'green slope reaches terrain edge');
 }
 for(const p of [[NaN,0],[0,Infinity],[-Infinity,3],[131,12],[-131,12],[45,131],[45,-131]])assert.equal(forestCover(...p),0);
 assert.ok(blocked(70,20),'outside-map blocked() trap remains present in baseline');
 assert.ok(forestAllowed(70,20,.5),'forest must survive that trap');
 return {samples:total,coveredFraction:green/total,meanCover:sum/total,extent:L.terrainHalfExtent};
});

check('actual existing near/far trunks have green ground, with river/routes exempted',()=>{
 const vegetation=vegetationPlan(),eligible=vegetation.trunks.filter(p=>!protectedPoint(p.x,p.z)&&outside(p.x,p.z,5)&&Math.abs(p.x)>14);
 assert.ok(eligible.length>=35,'inspect actual near and far tree placements');
 const cover=eligible.map(p=>forestCover(p.x,p.z)),covered=cover.filter(c=>c>.55).length;
 assert.ok(covered/eligible.length>.90,'most actual trunks need continuous carpet');
 assert.ok(cover.reduce((a,b)=>a+b,0)/cover.length>.70);
 return {actualTrunks:vegetation.trunks.length,eligible:eligible.length,covered};
});

check('village combat, every foundation/door/porch, crossings and river remain bare',()=>{
 for(let z=MAP.minZ;z<=MAP.maxZ;z+=.5)for(let x=MAP.minX;x<=MAP.maxX;x+=.5){assert.equal(forestCover(x,z),0);assert.equal(forestAllowed(x,z),false)}
 for(const h of houses)for(let dz=-5;dz<=5;dz+=.5)for(let dx=-4.5;dx<=4.5;dx+=.5)assert.equal(forestCover(h.x+dx,h.z+dz),0);
 for(const p of bufferPlacements)for(let x=p.x-5.2;x<=p.x+5.2;x+=.5)for(let z=p.z-7;z<=p.z+7;z+=.5){
  const q=bufferLocal(x,z,p);if(Math.abs(q.x)<5.2&&q.z>-5.2&&q.z<6.9)assert.equal(forestCover(x,z),0);
 }
 for(const z of crossings)for(let x=-32;x<=32;x+=.25)assert.equal(forestCover(x,z),0);
 for(const [x,,z]of [...spawns,...teamSpawns])assert.equal(forestCover(x,z),0);
 for(let z=-129;z<=129;z+=.5)for(const side of [-1,1]){
  assert.equal(forestCover(side*(riverWidth(z)+2.79),z),0);
  assert.equal(forestCover(side*(10+.32*Math.sin(z*.19)),z),0);
 }
});

check('dense bounded population, multi-height growth and irregular off-grid clusters',()=>{
 assert.ok(plan.tufts.length>=5200&&plan.tufts.length<=L.maxTufts);
 assert.ok(plan.clusters.length>=200&&plan.clusters.length<=360);
 assert.equal(plan.clusters.reduce((n,c)=>n+c.tufts,0),plan.tufts.length);
 const layers=[0,0,0],quadrants=[0,0,0,0];let far=0,edge=0,slopes=0;
 const bins=new Set();
 for(const p of plan.tufts){
  assertClear(p.x,p.z);assert.ok(forestAllowed(p.x,p.z,p.radius));
  assert.equal(p.y,landscapeHeight(p.x,p.z)-L.rootSink);assert.ok(p.height>=.09&&p.height<=L.maxHeight);
  layers[p.layer]++;quadrants[(p.x>=0?1:0)+(p.z>=-4?2:0)]++;
  if(Math.max(Math.abs(p.x),Math.abs(p.z))>70)far++;
  if(Math.max(Math.abs(p.x),Math.abs(p.z))>110)edge++;
  if(landscapeHeight(p.x,p.z)>.35)slopes++;
  bins.add(`${Math.floor(p.x/8)},${Math.floor(p.z/8)}`);
 }
 assert.ok(layers[0]>2200&&layers[1]>1500&&layers[2]>350);
 assert.ok(quadrants.every(n=>n>950));assert.ok(far>550&&edge>60&&slopes>4000);
 assert.ok(bins.size>220,'spatial spread must not collapse into tiny islands');
 // An axis-aligned planting lattice would concentrate fractional coordinates.
 for(const axis of ['x','z']){
  const fractions=new Array(16).fill(0);for(const p of plan.tufts)fractions[Math.floor((p[axis]-Math.floor(p[axis]))*16)]++;
  assert.ok(Math.max(...fractions)<plan.tufts.length*.09&&Math.min(...fractions)>plan.tufts.length*.04,'no regular planting rows');
 }
 const sideGroves=[[-43,-29],[-44,-8],[-43,17],[43,-28],[45,-7],[43,18],[-25,-45],[26,-45],[-24,39],[26,39]];
 for(const [x,z]of sideGroves)assert.ok(plan.tufts.filter(p=>Math.hypot(p.x-x,p.z-z)<9).length>=55,'visible near groves retain dense tufts');
 return {tufts:plan.tufts.length,clusters:plan.clusters.length,layers,quadrants,far,edge,slopes,occupied8mCells:bins.size};
});

check('actual terrain attribute changes no positions, normals, UVs, indices or bounds',()=>{
 const g=new T.PlaneGeometry(TERRAIN_GRID.size,TERRAIN_GRID.size,130,130);g.rotateX(-Math.PI/2);
 const p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,landscapeHeight(p.getX(i),p.getZ(i)));
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
 const before=Object.fromEntries(Object.entries(g.attributes).map(([n,a])=>[n,digest(bytes(a.array))])),index=digest(bytes(g.index.array));
 const box=g.boundingBox.clone(),sphere=g.boundingSphere.clone();assert.equal(applyForestAttributes(T,g),g);
 const a=g.getAttribute('forestCover');assert.equal(a.itemSize,1);assert.equal(a.count,p.count);assert.ok(a.array instanceof Float32Array);
 for(let i=0;i<a.count;i++)assert.ok(Math.abs(a.getX(i)-forestCover(p.getX(i),p.getZ(i)))<3e-8);
 for(const [n,hash]of Object.entries(before))assert.equal(digest(bytes(g.attributes[n].array)),hash);
 assert.equal(digest(bytes(g.index.array)),index);assert.deepEqual(g.boundingBox,box);assert.deepEqual(g.boundingSphere,sphere);g.dispose();
 return {vertices:a.count};
});

check('actual tapered geometry budgets, root contact, slope conformance and whole-blade clearance',()=>{
 let triangles=0,vertices=0,roots=0,maxHeight=0;const n=new T.Vector3();
 for(const mesh of world.children){
  assert.ok(mesh.isMesh&&!mesh.castShadow&&mesh.receiveShadow);assert.equal(mesh.geometry.groups.length,0);
  const g=mesh.geometry,p=g.attributes.position,b=g.attributes.forestBlade,normal=g.attributes.normal,indices=g.index.array;
  triangles+=indices.length/3;vertices+=p.count;
  assert.ok(p.count===b.count&&normal.count===p.count);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=b.getX(i),height=b.getZ(i);
   assertClear(x,z);assert.ok(Number.isFinite(y));
   const above=y-landscapeHeight(x,z);maxHeight=Math.max(maxHeight,above);
   assert.ok(Math.abs(above-(height*t-L.rootSink))<.00002,'each vertex follows terrain slope');
   if(t===0){roots++;assert.ok(Math.abs(above+L.rootSink)<.00002)}
   n.fromBufferAttribute(normal,i);assert.ok(Math.abs(n.length()-1)<.00001,'finite unit lighting normal');
   // Envelope of all possible wind extrema, not just a still at t=0.
   const wx=.162*height*t*t,wz=.06*height*t*t;
   for(const sx of [-1,1])for(const sz of [-1,1]){
    assertClear(x+sx*wx,z+sz*wz);
    assert.ok(g.boundingBox.containsPoint(n.set(x+sx*wx,y,z+sz*wz)));
    assert.ok(g.boundingSphere.containsPoint(n));
   }
  }
  for(let i=0;i<indices.length;i+=3){
   const a=new T.Vector3().fromBufferAttribute(p,indices[i]),b=new T.Vector3().fromBufferAttribute(p,indices[i+1]),c=new T.Vector3().fromBufferAttribute(p,indices[i+2]);
   assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,'nondegenerate actual blade triangles');
  }
 }
 assert.ok(triangles<=180000);assert.ok(world.children.length<=8);assert.equal(triangles,info.triangles);assert.equal(world.children.length,info.drawCalls);
 assert.equal(triangles,plan.tufts.length*L.bladesPerTuft*3);assert.equal(roots,plan.tufts.length*L.bladesPerTuft*2);
 assert.ok(maxHeight<.42);return {triangles,drawCalls:world.children.length,vertices,roots,maxHeight,shadowTriangles:info.shadowTriangles};
});

check('physical lighting, shadow receive, branch-safe wind/root shade and uniform-only updates',()=>{
 const m=world.children[0].material;assert.ok(m.isMeshStandardMaterial&&m.vertexColors);
 assert.equal(m.transparent,false);assert.equal(m.depthWrite,true);assert.equal(m.side,T.DoubleSide);assert.equal(m.forceSinglePass,true);
 assert.ok(m.roughness>=.8&&m.metalness===0);assert.equal(m.map,null);assert.equal(m.emissive.getHex(),0);
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);
 assert.ok(shader.vertexShader.includes('transformed.xz+=forestWind')&&shader.vertexShader.includes('objectNormal.y-dot'));
 assert.ok(shader.fragmentShader.includes(FOREST_ROOT_SHADE_GLSL));
 for(const chunk of ['lights_physical_fragment','lights_fragment_begin','normal_fragment_maps','fog_fragment','tonemapping_fragment'])assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`),'preserve standard '+chunk);
 assert.ok(shader.vertexShader.includes('#include <shadowmap_vertex>'));
 const stripComments=s=>s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
 const custom=stripComments(FOREST_WIND_GLSL+FOREST_ROOT_SHADE_GLSL);
 // Stronger than allowing quad-unsafe calls only outside a branch: this new
 // material introduces neither derivatives/implicit texture LOD nor branches.
 assert.doesNotMatch(custom,/\b(?:dFdx|dFdy|fwidth|texture\w*)\s*\(/);
 assert.doesNotMatch(custom,/\b(?:if|for|while|switch|discard)\b|\?/);
 const injected=stripComments(shader.vertexShader.replace(T.ShaderLib.standard.vertexShader,''));
 assert.doesNotMatch(injected,/\b(?:dFdx|dFdy|fwidth)\s*\(/);
 const before=world.children.map(mesh=>digest(bytes(mesh.geometry.attributes.position.array)));
 floor.update(12.5);assert.equal(shader.uniforms.forestTime.value,12.5);floor.update(NaN);assert.equal(shader.uniforms.forestTime.value,12.5);
 assert.deepEqual(world.children.map(mesh=>digest(bytes(mesh.geometry.attributes.position.array))),before);
 assert.equal(new Set(world.children.map(mesh=>mesh.material)).size,1);
 const copy=floor.info();copy.layers[0]=0;copy.limits.triangles=0;assert.deepEqual(floor.info(),info);
});

check('rebuilding produces byte-identical blade positions, normals, colours, wind attributes and indices',()=>{
 const again=new T.Group(),copy=buildForestFloor(T,again);assert.deepEqual(copy.info(),info);
 for(let i=0;i<world.children.length;i++){
  const a=world.children[i].geometry,b=again.children[i].geometry;
  for(const key of Object.keys(a.attributes))assert.equal(digest(bytes(a.attributes[key].array)),digest(bytes(b.attributes[key].array)));
  assert.equal(digest(bytes(a.index.array)),digest(bytes(b.index.array)));b.dispose();
 }
 again.children[0].material.dispose();
});

for(const mesh of world.children)mesh.geometry.dispose();world.children[0].material.dispose();
const pass=checks.every(c=>c.pass);
console.log(JSON.stringify({schema:'river-forest-floor-cpu-v1',pass,sources,checks,info,scope:'CPU coverage/placement/geometry/shader-source only; no GPU compilation, visual, continuous wind or frame-pacing acceptance'},null,2));
if(!pass)process.exitCode=1;
