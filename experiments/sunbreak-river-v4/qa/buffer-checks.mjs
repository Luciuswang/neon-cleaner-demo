// Pure Node / Three geometry regressions. No browser, GPU, asset downloads,
// gameplay-module edits or writes other than the adjacent JSON report.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url),vendor=new URL('../../sunbreak-storm-v3/vendor/presentation/',import.meta.url);
const sourceNames=['buffer-house.js','buffer-house-logic.js','timber-house.js','house-logic.js','map-layout.js','world.js','index.html','tactical-ai.js','qa/buffer-checks.mjs',
 '../sunbreak-storm-v3/timber-house.js','../sunbreak-storm-v3/house-logic.js',
 '../sunbreak-storm-v3/vendor/presentation/build/three.module.js',
 '../sunbreak-storm-v3/vendor/presentation/examples/jsm/utils/BufferGeometryUtils.js','../sunbreak-storm-v3/vendor/presentation/examples/jsm/geometries/RoundedBoxGeometry.js'];
const digest=b=>createHash('sha256').update(b).digest('hex'),texts={},sources={};
for(const name of sourceNames){const b=await readFile(new URL(name,root));texts[name]=b.toString('utf8');sources[name]=digest(b)}
registerHooks({resolve(spec,context,next){
 if(spec==='three')return next(new URL('build/three.module.js',vendor).href,context);
 if(spec.startsWith('three/addons/'))return next(new URL('examples/jsm/'+spec.slice(13),vendor).href,context);
 return next(spec,context);
}});
const T=await import('three');
const {buildBufferHouses}=await import('../buffer-house.js');
const {HOUSE}=await import('../house-logic.js');
const {BUFFER_PLACEMENTS,createHouseTransform,CABIN_NAVIGATION_LOCAL_BOUNDS}=await import('../buffer-house-logic.js');
const map=await import('../map-layout.js');
const checks=[],traversals=[],geometry=[],integrationEvidence=[],rayComparisons=[];
function check(name,fn,scope='unit'){
 try{const evidence=fn();checks.push({name,scope,pass:true,...evidence===undefined?{}:{evidence}})}
 catch(error){checks.push({name,scope,pass:false,error:error.message,stack:error.stack?.split('\n').slice(0,5).join('\n')})}
}
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,`${label??'value'}: ${actual} != ${expected}`);
const fakeListeners=new Map(),prompt={hidden:true,style:{},dataset:{},setAttribute(){},remove(){this.removed=true}};
// Explicit input-state stubs, not a claim of actual DOM / pointer-lock coverage.
globalThis.window={addEventListener(k,f){assert.ok(!fakeListeners.has(k));fakeListeners.set(k,f)},removeEventListener(k){fakeListeners.delete(k)}};
globalThis.document={hidden:false,activeElement:null,createElement(){return prompt},body:{append(){}}};
const world=new T.Group(),cam=new T.PerspectiveCamera(),solids=[],materials={wood:new T.MeshStandardMaterial(),plaster:new T.MeshStandardMaterial()};
const sentinel=new T.Mesh(new T.BoxGeometry(1,1,1),materials.wood);sentinel.position.set(99,99,99);world.add(sentinel);solids.push(sentinel);
let state={active:true,player:new T.Vector3()};
const buffers=buildBufferHouses({T,world,materials,solids,cam,getInteractionState:()=>state,placements:map.bufferPlacements});
world.updateMatrixWorld(true);
const event=extra=>({code:'KeyE',repeat:false,preventDefault(){this.prevented=true},...extra});
const footprintOverlap=(p,b,r=.4)=>p.x>b.min.x-r&&p.x<b.max.x+r&&p.z>b.min.z-r&&p.z<b.max.z+r&&p.y-1.5<(b.profileWall?map.wallTopAt(b.profileWall,p.x,p.z,r):b.max.y)&&p.y+.15>b.min.y;
const collision=(p,actor='player')=>buffers.blocksMovement(p,actor)||map.bounds.some(b=>footprintOverlap(p,b));
function rayHits(h,a,b){
 const start=new T.Vector3(a.x,a.y,a.z),end=new T.Vector3(b.x,b.y,b.z),ray=new T.Raycaster(start,end.clone().sub(start).normalize(),0,start.distanceTo(end)-.001);
 return ray.intersectObject(h.root,true);
}
function reset(){buffers.reset();state.active=true;document.hidden=false;document.activeElement=null}
function position(h,z,x=HOUSE.doorX,y=2.36){
 const p=h.logic.transform.localToWorld({x,y,z}),a=h.logic.doorAnchor;
 state.player.copy(p);cam.position.copy(p);cam.lookAt(a.x,a.y,a.z);
 buffers.update(0,{live:true,S:{state:'play'},player:state.player});return p;
}
function open(h){reset();position(h,4.1);assert.equal(buffers.qa.request(),true);buffers.update(1,{live:true,player:state.player});close(h.logic.door.angle,HOUSE.openAngle)}
function localRay(h,a,b,near=0,far=null){
 const origin=h.root.localToWorld(new T.Vector3(...a)),end=h.root.localToWorld(new T.Vector3(...b));
 return new T.Raycaster(origin,end.clone().sub(origin).normalize(),near,far??origin.distanceTo(end));
}
function compareRay(h,name,ray){
 const expected=ray.intersectObject(h.root,true),actual=ray.intersectObject(h.shotProxy,true),label=h.id+' / '+name;
 assert.equal(actual.length,expected.length,label+' hit count');
 for(let i=0;i<expected.length;i++){
  const a=actual[i],b=expected[i];assert.equal(a.object,b.object,label+' original mesh');assert.notEqual(a.object,h.shotProxy);
  assert.equal(a.instanceId,b.instanceId,label+' instanceId');assert.equal(a.faceIndex,b.faceIndex,label+' faceIndex');
  close(a.distance,b.distance,label+' distance');assert.deepEqual(a.face,b.face,label+' original face');
  for(const field of ['point','uv','uv1','normal','barycoord'])assert.deepEqual(a[field],b[field],label+' '+field);
 }
 rayComparisons.push({id:h.id,name,origin:ray.ray.origin.toArray(),direction:ray.ray.direction.toArray(),near:ray.near,far:Number.isFinite(ray.far)?ray.far:'Infinity',hits:expected.length,pass:true});
 return actual;
}
const rayCases=[
 {name:'door-outside',a:[-1.08,2,3.5],b:[-1.08,2,.5]},
 {name:'door-inside',a:[-1.08,2,.5],b:[-1.08,2,3.5]},
 {name:'side-wall',a:[6,2,-1],b:[0,2,-1]},
 {name:'back-wall',a:[-2,2,-6],b:[-2,2,-2]},
 {name:'roof-down',a:[0,9,-.8],b:[0,3,-.8]},
 {name:'ceiling-up-inside',a:[0,2,-.8],b:[0,8,-.8]},
 {name:'glass',a:[.64,2.85,4],b:[.64,2.85,0]},
 {name:'inside-to-wall',a:[0,2,0],b:[-5,2,0]},
 {name:'short-outside',a:[10,1.7,0],b:[0,1.7,0],far:2},
 {name:'short-inside',a:[0,2,0],b:[1,2,0],far:.2},
 {name:'away-from-house',a:[10,2,0],b:[20,2,0],far:140},
 {name:'near-clips-first-wall',a:[6,2,-1],b:[-6,2,-1],near:2.4,far:12},
 {name:'near-after-house',a:[6,2,-1],b:[-6,2,-1],near:12,far:13},
 {name:'inside-with-near',a:[0,2,0],b:[-5,2,0],near:.5,far:10},
 {name:'side-graze-inside',a:[4.11-1e-6,1.2,-6],b:[4.11-1e-6,1.2,5]},
 {name:'side-graze-exact',a:[4.11,1.2,-6],b:[4.11,1.2,5]},
 {name:'side-graze-outside',a:[4.11+1e-6,1.2,-6],b:[4.11+1e-6,1.2,5]},
 {name:'roof-edge-graze',a:[4.324999,9,-.8],b:[4.324999,3,-.8]},
 {name:'below-zero-stair-rail',a:[-1.91,.02,5.5],b:[-1.91,-.03,5.5]},
 {name:'unbounded-ray',a:[6,2,-1],b:[0,2,-1],far:Infinity}
];

check('placement contract and old shot-proxy preservation',()=>{
 assert.deepEqual(map.bufferPlacements,BUFFER_PLACEMENTS);assert.equal(solids.length,3);assert.equal(solids[0],sentinel);
 for(const h of buffers.qa.houses){assert.ok(solids.includes(h.shotProxy));assert.ok(!solids.includes(h.root));assert.equal(h.shotProxy.children.length,0);assert.equal(h.shotProxy.parent,null);assert.equal(h.root.parent,world);assert.equal(h.pivot.parent,h.root);assert.equal(h.broadphase.root,h.root)}
 assert.equal(fakeListeners.size,3);assert.equal(buffers.info().independentDoors,true);
});
check('copied house logic is unchanged from original normalized source',()=>{
 const normalized=s=>s.replace(/\r\n/g,'\n').trimEnd();assert.equal(normalized(texts['house-logic.js']),normalized(texts['../sunbreak-storm-v3/house-logic.js']));
});
check('source-coordinate roundtrip supports pi and arbitrary yaw/elevation',()=>{
 for(const placement of [...map.bufferPlacements,{id:'arbitrary',x:7,y:2,z:3,yaw:.7}]){
  const t=createHouseTransform(placement);
  for(const p of [{x:-2,y:1,z:-3},{x:1,y:2,z:5}]){
   const q=t.toSource(t.localToWorld(p));close(q.x,HOUSE.x+p.x);close(q.y,p.y);close(q.z,HOUSE.z+p.z);
   const returned=t.toWorld(q),expected=t.localToWorld(p);for(const axis of ['x','y','z'])close(returned[axis],expected[axis]);
  }
 }
});
check('outside floor returns null and never adds the absent artist step',()=>{
 for(const [x,z]of [[0,0],[0,8],[0,-10],[12,-18],[90,90]])assert.equal(buffers.floorHeight(x,z),null);
 for(const h of buffers.qa.houses){const p=h.logic.transform.localToWorld({x:-1.4,z:5.9});assert.equal(buffers.floorHeight(p.x,p.z),null)}
});
check('rayBroadphase false preserves the exact-root fallback without a proxy',()=>{
 const savedWindow=globalThis.window,savedDocument=globalThis.document;
 try{
  delete globalThis.window;delete globalThis.document;
  const alternateWorld=new T.Group(),alternateSolids=[];
  const alternate=buildBufferHouses({T,world:alternateWorld,materials,solids:alternateSolids,cam,placements:[BUFFER_PLACEMENTS[0]],rayBroadphase:false});
  const h=alternate.qa.houses[0];assert.equal(h.broadphase,null);assert.equal(h.shotProxy,h.root);assert.equal(alternateSolids[0],h.root);
  assert.equal(alternate.info().houses[0].raycastUsesVisibleAssembly,true);assert.equal(alternate.info().houses[0].rayBroadphase,null);alternate.dispose();
 }finally{globalThis.window=savedWindow;globalThis.document=savedDocument}
});

for(const h of buffers.qa.houses){
 const w=(x,y,z)=>h.logic.transform.localToWorld({x,y,z}),prefix=h.id+': ';
 check(prefix+'finite floor support matches room, porch and all four stairs',()=>{
  for(const [x,z,height]of [[0,0,.66],[-1.08,3.4,.66],[-1.08,5.4,.165],[-1.08,5,.33],[-1.08,4.6,.495],[-1.08,4.2,.66]]){const p=w(x,0,z);close(buffers.floorHeight(p.x,p.z),height)}
  for(const [x,z]of [[4.5,0],[-1.08,5.8],[2,3.4],[-4.1,-4.1]]){const p=w(x,0,z);assert.equal(buffers.floorHeight(p.x,p.z),null)}
 });
 check(prefix+'static batching retains UV attributes and articulated parts',()=>{
  reset();let lights=0,instances=0,glass=0,meshes=0,triangles=0;
  h.root.traverse(o=>{if(o.isPointLight)lights++;if(o.isInstancedMesh)instances++;if(o.isMesh){meshes++;if(o.material.transparent)glass++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);assert.ok(o.geometry.attributes.uv)}});
  assert.equal(lights,4);assert.equal(instances,2);assert.equal(glass,8);assert.ok(meshes<50);assert.equal(h.batching.staticBatches,9);assert.equal(h.roof.tiles,723);
  assert.equal(h.pivot.name,'DoorPivot');assert.ok(h.pivot.getObjectByName('DoorHandleGrip'));
  const box=new T.Box3().setFromObject(h.root),nav=h.logic.navigationBounds;
  assert.ok(box.min.x>=nav.min.x&&box.max.x<=nav.max.x&&box.min.z>=nav.min.z&&box.max.z<=nav.max.z);
  const entry={id:h.id,navigationBounds:nav,geometryBounds:{min:box.min.toArray(),max:box.max.toArray()},lights,instances,glass,meshes,triangles,batching:h.batching};geometry.push(entry);return entry;
 });
 check(prefix+'room is player-enterable but whole buffer/stair footprint blocks enemies',()=>{
  reset();assert.equal(collision(w(0,2.36,0),'player'),false);assert.equal(collision(w(4,2.36,0)),true);
  for(const [x,z]of [[0,0],[-1.08,5.5],[4.3,0],[-4.3,-4.3]])assert.equal(buffers.blocksMovement(w(x,1.7,z),'enemy'),true);
  assert.equal(buffers.blocksMovement(w(5,1.7,0),'enemy'),false);
 });
 check(prefix+'closed door blocks movement and actual geometry rays',()=>{
  reset();assert.equal(collision(w(-1.08,2.36,2.4)),true);
  const hits=rayHits(h,w(-1.08,2,3.5),w(-1.08,2,.5));assert.ok(hits.length);assert.ok(hits.some(hit=>{for(let o=hit.object;o;o=o.parent)if(o===h.pivot)return true;return false}));
 });
 check(prefix+'open door passage clears movement and actual rays; walls/glazing remain cover',()=>{
  open(h);assert.equal(collision(w(-1.08,2.36,2.4)),false);assert.equal(rayHits(h,w(-1.08,2,3.5),w(-1.08,2,.5)).length,0);
  assert.ok(rayHits(h,w(5,2,0),w(0,2,0)).length);assert.ok(rayHits(h,w(.64,2.85,3.5),w(.64,2.85,0)).some(hit=>hit.object.material.transparent));
 });
 check(prefix+'roof/porch coverage and upward ceiling collision transform correctly',()=>{
  reset();for(const [x,y,z]of [[0,2,0],[-1.08,3.1,3.9]]){const p=w(x,y,z);assert.ok(buffers.underRoof(p.x,p.y,p.z))}
  for(const [x,y,z]of [[0,9,0],[5,2,0],[-1.08,2,5.8]]){const p=w(x,y,z);assert.equal(buffers.underRoof(p.x,p.y,p.z),false)}
  close(buffers.ceilingY(w(0,4.6,0),4.2),4.349);close(buffers.ceilingY(w(-1.08,3.8,3.4),3.2),3.429);
  assert.equal(buffers.ceilingY(w(5,4.6,0),4.2),Infinity);
  assert.ok(rayHits(h,w(0,9,-.8),w(0,3,-.8)).length);assert.ok(rayHits(h,w(0,2,-.8),w(0,6,-.8)).length);
 });
 check(prefix+'one nearest prompt, real event-state pause/focus/repeat/distance/LOS guards',()=>{
  reset();position(h,4.1);assert.equal(prompt.hidden,false);assert.equal(buffers.qa.selected,h.id);assert.equal(prompt.dataset.house,h.id);
  assert.equal(buffers.qa.request({repeat:true}),false);assert.equal(buffers.qa.request({focusedUI:true}),false);
  state.active=false;assert.equal(buffers.qa.request(),false);state.active=true;
  document.hidden=true;assert.equal(buffers.qa.request(),false);document.hidden=false;
  document.activeElement={closest(){return true}};fakeListeners.get('keydown')(event());assert.equal(h.logic.door.target,0);document.activeElement=null;fakeListeners.get('keyup')(event());
  fakeListeners.get('keydown')(event({target:{closest(){return true}}}));assert.equal(h.logic.door.target,0);fakeListeners.get('keyup')(event());
  position(h,6.2);assert.equal(buffers.qa.request(),false);
  position(h,4.1);const away=w(-1.08,2.36,8);cam.lookAt(away.x,away.y,away.z);assert.equal(buffers.qa.request(),false);
  position(h,4.1);
  const obstacle=new T.Mesh(new T.BoxGeometry(1,.8,.12),materials.plaster);obstacle.position.copy(w(-1.08,2.12,3.2));obstacle.rotation.y=h.logic.transform.placement.yaw;world.add(obstacle);solids.push(obstacle);world.updateMatrixWorld(true);
  try{assert.equal(buffers.qa.request(),false)}finally{solids.splice(solids.indexOf(obstacle),1);obstacle.removeFromParent();obstacle.geometry.dispose()}
  fakeListeners.get('keydown')(event());assert.equal(h.logic.door.info().toggles,1);
  buffers.update(1,{live:true,player:state.player});fakeListeners.get('keydown')(event());assert.equal(h.logic.door.info().toggles,1);
  fakeListeners.get('keyup')(event());fakeListeners.get('keydown')(event({repeat:true}));assert.equal(h.logic.door.info().toggles,1);fakeListeners.get('keyup')(event());
  for(const other of buffers.qa.houses.filter(o=>o!==h))assert.equal(other.logic.door.info().toggles,0);
 });
 check(prefix+'door swing occupancy veto and mid-motion obstruction',()=>{
  reset();position(h,2.8);assert.equal(buffers.qa.request(),false);assert.equal(h.logic.door.info().toggles,0);
  position(h,4.1);assert.equal(buffers.qa.request(),true);buffers.update(.1,{live:true,player:state.player});
  const angle=h.logic.door.angle;assert.ok(angle>0);state.player.copy(w(-1.2,2.36,2.2));
  buffers.update(.05,{live:true,player:state.player});close(h.logic.door.angle,angle);assert.match(h.logic.door.message,/挡住/);
 });
 check(prefix+'paused/presentation/hidden frames do not advance doors; reset closes both',()=>{
  reset();position(h,4.1);assert.ok(buffers.qa.request());buffers.update(.1,{live:true,player:state.player});const angle=h.logic.door.angle;
  for(const options of [{live:false},{live:true,pres:true},{live:true,S:{state:'pause'}}]){buffers.update(.2,{...options,player:state.player});close(h.logic.door.angle,angle);assert.equal(prompt.hidden,true)}
  state.active=false;buffers.update(.2,{live:true,player:state.player});close(h.logic.door.angle,angle);state.active=true;
  document.hidden=true;buffers.update(.2,{live:true,player:state.player});close(h.logic.door.angle,angle);document.hidden=false;
  buffers.reset();assert.equal(prompt.hidden,true);for(const house of buffers.qa.houses){assert.equal(house.logic.door.angle,0);assert.equal(house.pivot.rotation.y,0)}
 });
 check(prefix+'both-direction stair/door traversal with previous-height horizontal collision',()=>{
  open(h);
  for(const dt of [1/60,.05])for(const speed of [4.2,7.4])for(const direction of [-1,1]){
   let z=direction<0?6.2:.5,end=direction<0?.5:6.2,p=w(-1.08,0,z),steps=0;p.y=(buffers.floorHeight(p.x,p.z)??map.terrainHeight(p.x,p.z))+1.7;
   while(Math.abs(end-z)>1e-9&&steps<1000){
    z+=direction*Math.min(Math.abs(end-z),dt*speed);const target=w(-1.08,p.y,z);
    assert.equal(collision(target),false,`${h.id} z=${z} dt=${dt} speed=${speed} direction=${direction}`);
    p=target;p.y=(buffers.floorHeight(p.x,p.z)??map.terrainHeight(p.x,p.z))+1.7;steps++;
   }
   assert.ok(steps>0&&steps<1000);traversals.push({id:h.id,dt,speed,direction,steps,end:p,pass:true});
  }
 });
 check(prefix+'childless finite proxy preserves all exact hits closed/part-open/open',()=>{
  for(const phase of [0,.5,1]){
   reset();position(h,4.1);
   if(phase){assert.ok(buffers.qa.request());buffers.update(HOUSE.openAngle*phase/1.8,{live:true,player:state.player})}
   for(const c of rayCases)compareRay(h,'door-'+phase+'/'+c.name,localRay(h,c.a,c.b,c.near??0,c.far??null));
   const covered=new T.Box3().setFromObject(h.root);h.broadphase.sync();assert.ok(h.broadphase.worldBounds.containsBox(covered));
  }
  const before=h.broadphase.stats.exactCalls;
  assert.equal(compareRay(h,'open-passage-not-AABB-cover',localRay(h,[-1.08,2,3.5],[-1.08,2,.5])).length,0);
  assert.equal(h.broadphase.stats.exactCalls,before+1,'empty doorway tested actual meshes, not only a rejected box');
 });
 check(prefix+'exact near/far boundary distances and preserved existing accumulator',()=>{
  reset();const full=localRay(h,[6,2,-1],[-6,2,-1]),hits=full.intersectObject(h.root,true);assert.ok(hits.length);
  const d=hits[0].distance;
  for(const epsilon of [-1e-7,0,1e-7]){
   compareRay(h,'far-boundary-'+epsilon,localRay(h,[6,2,-1],[-6,2,-1],0,d+epsilon));
   compareRay(h,'near-boundary-'+epsilon,localRay(h,[6,2,-1],[-6,2,-1],d+epsilon,12));
  }
  const existing={distance:.1,object:sentinel,point:new T.Vector3()},expected=[existing],actual=[existing];
  full.intersectObject(h.root,true,expected);full.intersectObject(h.shotProxy,true,actual);
  assert.equal(actual[0],existing);assert.equal(actual.length,expected.length);
  for(let i=0;i<expected.length;i++){assert.equal(actual[i].object,expected[i].object);close(actual[i].distance,expected[i].distance)}
 });
 check(prefix+'cached bounds follow changed translation/yaw/nonuniform scale',()=>{
  reset();const saved={position:h.root.position.clone(),quaternion:h.root.quaternion.clone(),scale:h.root.scale.clone()};
  try{
   h.root.position.add(new T.Vector3(3,.7,-2));h.root.rotation.y+=.37;h.root.scale.set(1.2,.85,1.1);h.root.updateWorldMatrix(true,true);
   for(const c of rayCases)compareRay(h,'transformed/'+c.name,localRay(h,c.a,c.b,c.near??0,c.far??null));
   h.broadphase.sync();assert.ok(h.broadphase.worldBounds.containsBox(new T.Box3().setFromObject(h.root)));
  }finally{h.root.position.copy(saved.position);h.root.quaternion.copy(saved.quaternion);h.root.scale.copy(saved.scale);h.root.updateWorldMatrix(true,true);h.broadphase.sync()}
 });
 check(prefix+'short rejected rays perform zero tile-instance tests after warmup',()=>{
  reset();const meshes=[];let instanceTests=0;
  h.root.traverse(o=>{if(o.isInstancedMesh){o.computeBoundingSphere();const original=o.getMatrixAt;meshes.push({o,original});o.getMatrixAt=function(...args){instanceTests++;return original.apply(this,args)}}});
  const cases=[];
  try{
   for(const y of [1.7,3]){
    const ray=localRay(h,[10,y,0],[0,y,0],0,2);instanceTests=0;
    const baseline=ray.intersectObject(h.root,true),before=instanceTests;instanceTests=0;
    const optimized=ray.intersectObject(h.shotProxy,true);
    assert.equal(baseline.length,0);assert.equal(optimized.length,0);assert.ok(before>0);assert.equal(instanceTests,0);
    cases.push({y,near:0,far:2,baselineInstanceTests:before,proxyInstanceTests:instanceTests});
   }
  }finally{for(const {o,original}of meshes)o.getMatrixAt=original}
  return cases;
 });
}

// These inspect/evaluate small actual integration expressions with real cabin
// geometry. They are source-bound Node contracts, not browser-render evidence.
check('world floor integration preserves negative riverbed outside cabins',()=>{
 const match=texts['world.js'].match(/floorHeight\s*\(\s*x\s*,\s*z\s*\)\s*\{\s*return\s+([^;}]+)\s*;?\s*\}/);assert.ok(match,'world floor adapter not recognized');
 const floor=new Function('buffers','terrainHeight','ruins','x','z',`return (${match[1]});`),ruins={floorHeight:()=>-Infinity};
 const probes=[];for(const [x,z]of [[0,0],[0,8],[0,-10],[1,0]]){assert.equal(buffers.floorHeight(x,z),null);const y=floor(buffers,map.terrainHeight,ruins,x,z);assert.ok(y<0);close(y,map.terrainHeight(x,z));probes.push({x,z,y})}
 integrationEvidence.push({kind:'negative-river-floor',expression:match[1],ruinsFloorStub:'-Infinity (no ruin support; real ruins verified separately by main)',probes});return probes;
},'integration');
check('map navigation rectangles exactly match transformed cabin enemy footprints',()=>{
 const pairs=buffers.qa.houses.map(h=>({id:h.id,map:map.navigationBounds.find(b=>b.id===h.id),runtime:h.logic.navigationBounds}));integrationEvidence.push({kind:'navigation-bounds',pairs});
 for(const pair of pairs){assert.ok(pair.map);for(const side of ['min','max'])for(const axis of ['x','y','z'])close(pair.map[side][axis],pair.runtime[side][axis],`${pair.id} ${side}.${axis}`)}
 for(const h of buffers.qa.houses)for(const [x,z]of [[4.7,0],[0,6.2]]){const p=h.logic.transform.localToWorld({x,y:1.6,z});assert.equal(map.blocked(p.x,p.z,.4,p.y,'enemy'),buffers.blocksMovement(p,'enemy'))}
},'integration');
check('placements remain clear of map covers and all spawn positions',()=>{
 for(const h of buffers.qa.houses){const n=h.logic.navigationBounds;for(const b of map.bounds)assert.ok(n.max.x<=b.min.x||n.min.x>=b.max.x||n.max.z<=b.min.z||n.min.z>=b.max.z,'overlapping '+h.id+' / '+b.id)}
 for(const [x,y,z]of [...map.spawns,...map.teamSpawns])assert.equal(collision({x,y:y+1.6,z},'enemy'),false);
},'integration');
check('world forwards current state, door updates, collision and reset',()=>{
 assert.match(texts['world.js'],/getInteractionState:ctx\.getInteractionState/);
 assert.match(texts['world.js'],/buffers\.update\(dt,\{S,pres,live,player\}\)/);
 assert.match(texts['world.js'],/blocksMovement:\(p,actor\)=>buffers\.blocksMovement\(p,actor\)/);
 assert.match(texts['world.js'],/resetHouse:\(\)=>buffers\.reset\(\)/);
 assert.match(texts['index.html'],/getInteractionState:\(\)=>\(\{active:S\.state==='play'&&!pres,player:pos\}\)/);
},'integration');
check('actual world rain expression hides fully covered porch rain segments',()=>{
 const match=texts['world.js'].match(/const floor=terrainHeight\(x,z\),roof=roofHeight\(x,z\),y=([^;]+?),k=i\*6;/);assert.ok(match,'world rain expression changed; update this source-contract probe');
 const rainY=new Function('buffers','terrainHeight','roofHeight','x','z','yy','s','i',`const floor=terrainHeight(x,z),roof=roofHeight(x,z);return (${match[1]});`);
 const probes=buffers.qa.houses.map(h=>{const p=h.logic.transform.localToWorld({x:-1.08,y:3.1,z:3.9});return{id:h.id,lower:p,lowerCovered:buffers.underRoof(p.x,p.y,p.z),upperCovered:buffers.underRoof(p.x+.08,p.y+.5,p.z+.03),renderY:rainY(buffers,map.terrainHeight,map.roofHeight,p.x,p.z,p.y,[0,0,0,0],0)}});
 integrationEvidence.push({kind:'porch-rain-source-expression',expression:match[1],probes});
 for(const probe of probes){assert.equal(probe.lowerCovered,true);assert.equal(probe.upperCovered,true);assert.ok(probe.renderY<-10,'covered rain is still rendered in '+probe.id)}
},'integration');
check('reset/disposal clears shared prompt and owned input listeners',()=>{buffers.reset();assert.equal(prompt.hidden,true);buffers.dispose();assert.equal(fakeListeners.size,0);assert.equal(prompt.removed,true)});

const changedSources=[];for(const name of sourceNames)if(digest(await readFile(new URL(name,root)))!==sources[name])changedSources.push(name);
check('source files remained unchanged throughout run',()=>assert.deepEqual(changedSources,[]),'source-binding');
const report={schema:'sunbreak-buffer-node-v1',date:new Date().toISOString(),pass:checks.every(c=>c.pass),
 unitPass:checks.filter(c=>c.scope==='unit').every(c=>c.pass),integrationPass:checks.filter(c=>c.scope==='integration').every(c=>c.pass),
 method:'Actual Three.js cabin assembly, rays and source-space controller; stubbed DOM input; previous-height horizontal movement followed by floor support. Small integration expressions evaluated from hashed world source.',
 limitations:['No browser keyboard/pointer-lock verification','No WebGL material/light/continuous animation or performance verdict','Traversal descent snaps to support; actual gravity/browser traversal belongs to main QA'],
 placements:map.bufferPlacements,localNavigationBounds:CABIN_NAVIGATION_LOCAL_BOUNDS,sources,changedSources,
 checks,geometry,traversals,rayComparisons,integrationEvidence};
await writeFile(new URL('buffer-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,unitPass:report.unitPass,integrationPass:report.integrationPass,checks:checks.length,traversals:traversals.length,rayComparisons:rayComparisons.length,failures:checks.filter(c=>!c.pass).map(({name,error})=>({name,error}))},null,2));
if(!report.pass)process.exitCode=1;
