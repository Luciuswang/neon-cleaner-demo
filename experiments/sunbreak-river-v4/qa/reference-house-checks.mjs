// Reference-house QA: the two intact (ruin===0) timber houses.
// Uses the real running modules (map-layout + village), ray casts against the built solids and
// floor/roof data. Read-only: performs no file writes; prints a JSON report to stdout.
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {buildVillage} from '../village.js';
import {layout,blocked,roofHeight,terrainHeight,rubbleHeight} from '../map-layout.js';
import assert from 'node:assert/strict';

const world=new T.Group(),solids=[],materials=Object.fromEntries(['plaster','brick','stone','wood','roof','metal'].map(k=>[k,new T.MeshStandardMaterial()]));
buildVillage({T,world,materials,layout,solids});world.updateMatrixWorld(true);
const ray=new T.Raycaster();
function sees(a,b){const origin=new T.Vector3(...a),end=new T.Vector3(...b);ray.set(origin,end.clone().sub(origin).normalize());ray.far=origin.distanceTo(end)-.001;return ray.intersectObjects(solids,true).length===0}

const R=.4,EPS=1e-6,near=(a,b,t=EPS)=>Math.abs(a-b)<=t;
const results=[];
function check(name,fn){try{fn();results.push({name,pass:true})}catch(e){results.push({name,pass:false,error:String(e&&e.message||e)})}}
// open intervals of a predicate sampled along one axis
function gaps(solid,from,to,step=.005){const out=[];let start=null;const n=Math.round((to-from)/step);
 for(let i=0;i<n;i++){const v=from+(i+.5)*step,open=!solid(v);if(open&&start===null)start=v-step/2;if(!open&&start!==null){out.push([start,v-step/2]);start=null}}
 if(start!==null)out.push([start,to]);return out}

const intact=layout.houses.filter(h=>h.ruin===0);
const wallsOf=h=>layout.walls.filter(w=>w.houseId===h.id);

check('exactly two intact houses, mirrored across the river, centres kept',()=>{
 assert.equal(intact.length,2);
 const [a,b]=intact;assert.equal(a.side,-b.side);assert.equal(a.x,-b.x);assert.equal(a.z,b.z);
 for(const h of intact){assert.equal(Math.abs(h.x),17);assert.equal(h.z,-23);assert.equal(Math.sign(h.x),h.side)}
});

check('reference timber parts exist only on ruin===0 houses',()=>{
 for(const h of layout.houses.filter(h=>h.ruin>0)){
  const ws=wallsOf(h);assert.ok(ws.length>0);
  assert.ok(ws.every(w=>w.material!=='wood'),h.id+' ruined house must not be wood');
  assert.ok(!ws.some(w=>/facade|post|bench/.test(w.id)),h.id+' ruined house must have no veranda parts');
 }
});

for(const h of intact){
 const tag=h.id+': ',r=-h.side,fx=h.x-h.side*2.75,px=h.x-h.side*4.1,benchX=h.x+r*3.3;
 const ws=wallsOf(h);
 const facade=ws.filter(w=>near(w.x,fx)&&w.w<=.3);
 const posts=ws.filter(w=>near(w.x,px));
 const bench=ws.filter(w=>near(w.x,benchX));
 const facadeSolid=(y,zl)=>facade.some(w=>y>w.y-w.h/2&&y<w.y+w.h/2&&h.z+zl>w.z-w.d/2&&h.z+zl<w.z+w.d/2);

 check(tag+'all wall/post/bench records are wood, live in layout.walls and have exact matching solids',()=>{
  assert.ok(ws.length>0&&facade.length>0);
  for(const w of ws){
   assert.equal(w.material,'wood',w.id);assert.ok(layout.walls.includes(w),w.id);
   const s=solids.find(s=>s.userData.wall===w.id);assert.ok(s,'solid '+w.id);
   assert.ok(near(s.position.x,w.x)&&near(s.position.y,w.y)&&near(s.position.z,w.z),'solid position '+w.id);
   const p=s.geometry.parameters;assert.ok(near(p.width,w.w)&&near(p.height,w.h)&&near(p.depth,w.d),'solid size '+w.id);
  }
 });

 check(tag+'twin open bays centred z=+-2.1, clear 1.45 wide and 2.30 high',()=>{
  for(const y of [.05,1.2,2.25]){
   const g=gaps(zl=>facadeSolid(y,zl),-3.5,3.5).filter(([a,b])=>Math.abs((a+b)/2)>1);
   assert.equal(g.length,2,'two bays at y='+y);
   for(const [i,e] of [-1,1].entries()){assert.ok(near((g[i][0]+g[i][1])/2,e*2.1,.012),'bay centre');assert.ok(near(g[i][1]-g[i][0],1.45,.012),'bay width')}
  }
  for(const e of [-1,1]){const v=gaps(y=>facadeSolid(y,e*2.1),0,3.3);assert.equal(v.length,1);assert.ok(near(v[0][0],0,.012)&&near(v[0][1],2.3,.012),'bay height')}
 });

 check(tag+'central square window z=0, 1.00..1.85, width .85',()=>{
  const g=gaps(zl=>facadeSolid(1.4,zl),-3.5,3.5).filter(([a,b])=>Math.abs((a+b)/2)<1);
  assert.equal(g.length,1);assert.ok(near((g[0][0]+g[0][1])/2,0,.012)&&near(g[0][1]-g[0][0],.85,.012));
  const v=gaps(y=>facadeSolid(y,0),0,3.3);assert.equal(v.length,1);assert.ok(near(v[0][0],1,.012)&&near(v[0][1],1.85,.012));
 });

 check(tag+'four slender veranda posts at x offset 4.1 reaching the 2.65 eave',()=>{
  assert.equal(posts.length,4);
  assert.deepEqual(posts.map(p=>Math.round((p.z-h.z)*100)/100).sort((a,b)=>a-b),[-3.9,-1.3,1.3,3.9]);
  for(const p of posts){assert.ok(p.w<=.2&&p.d<=.2,'slender');assert.ok(near(p.y-p.h/2,0)&&near(p.y+p.h/2,2.65),'post height')}
 });

 check(tag+'low solid bench at x offset 3.30, z=0, blocks the player; side-base blockage kept',()=>{
  assert.ok(bench.length>=1);
  assert.ok(bench.some(b=>h.z>b.z-b.d/2&&h.z<b.z+b.d/2),'bench central');
  for(const b of bench){assert.ok(b.y+b.h/2<=.6,'bench low');assert.ok(near(b.y-b.h/2,0),'bench on floor')}
  assert.ok(blocked(benchX,h.z,R),'bench blocks');
  assert.ok(blocked(h.x+3.5,h.z,R),'x=+3.5 blocked');assert.ok(blocked(h.x-3.5,h.z,R),'x=-3.5 blocked');
  assert.ok(!sees([h.x+r*3.9,.3,h.z],[h.x+r*2.95,.3,h.z]),'bench occludes low ray');
 });

 check(tag+'player passage: veranda -> each bay -> interior -> legacy z-end doors, on level floor',()=>{
  for(const e of [-1,1]){
   for(const dz of [-.3,0,.3])for(let i=0;i<=110;i++){
    const x=h.x+r*(5.5-i*.05),z=h.z+e*2.1+dz;
    assert.ok(!blocked(x,z,R),`bay ${e} blocked at ${x.toFixed(2)},${z.toFixed(2)}`);
    assert.equal(terrainHeight(x,z),0,'level floor');assert.equal(rubbleHeight(x,z),0,'no rubble');
   }
   for(let i=0;i<=68;i++)assert.ok(!blocked(h.x,h.z+e*(2.1+i*.05),R),'interior to z-end door '+e);
   assert.ok(blocked(fx,h.z+e*2.1,R,1.6,'enemy'),'NPC navigation stays outside');
  }
  for(let i=0;i<=220;i++)assert.ok(!blocked(h.x,h.z-5.5+i*.05,R),'centred legacy entrances');
  let stopped=false;for(let i=0;i<=110;i++)stopped=stopped||blocked(h.x+r*(5.5-i*.05),h.z,R);assert.ok(stopped,'no walk-through at window/bench');
 });

 check(tag+'ray occlusion: bays and window open, boards solid',()=>{
  assert.ok(sees([h.x,1.6,h.z+4],[h.x,1.6,h.z-4]),'door passage');
  for(const e of [-1,1]){
   const zc=h.z+e*2.1;
   for(const y of [.3,1.2,2.2])assert.ok(sees([h.x+r*5,y,zc],[h.x,y,zc]),`bay ${e} open y=${y}`);
   for(const dz of [-.6,.6])assert.ok(sees([h.x+r*5,1.2,zc+dz],[h.x,1.2,zc+dz]),`bay ${e} open dz=${dz}`);
   assert.ok(!sees([h.x+r*3.7,2.6,zc],[h.x+r*1.5,2.6,zc]),'bay head solid');
   assert.ok(!sees([h.x+r*3.7,1.4,h.z+e*1.2],[h.x+r*1.5,1.4,h.z+e*1.2]),'jamb solid');
   assert.ok(!sees([h.x+r*3.7,1.2,h.z+e*3],[h.x+r*1.5,1.2,h.z+e*3]),'facade end solid');
   assert.ok(!sees([h.x+r*3.7,1.4,h.z+e*.6],[h.x+r*1.5,1.4,h.z+e*.6]),'beside window solid');
  }
  for(const [y,dz] of [[1.4,0],[1.1,0],[1.75,0],[1.4,-.35],[1.4,.35]])assert.ok(sees([h.x+r*3.9,y,h.z+dz],[h.x,y,h.z+dz]),`window open y=${y} dz=${dz}`);
  assert.ok(!sees([h.x+r*2.95,.8,h.z],[h.x+r*1.5,.8,h.z]),'below window solid');
  assert.ok(!sees([h.x+r*3.7,1.95,h.z],[h.x+r*1.5,1.95,h.z]),'above window solid');
  assert.ok(!sees([h.x+h.side*5,.5,h.z],[h.x,.5,h.z]),'back wall cover');
 });

 check(tag+'vertical wall tops stay beneath the roof at both x edges (bench/posts excluded)',()=>{
  const vs=ws.filter(w=>!/bench|post/.test(w.id));assert.ok(vs.length>0);
  for(const w of vs){
   const top=w.y+w.h/2,lim=Math.min(roofHeight(w.x-w.w/2,w.z),roofHeight(w.x+w.w/2,w.z));
   assert.ok(Number.isFinite(lim),'under roof '+w.id);
   assert.ok(top<=lim+EPS,`${w.id} top ${top} above roof ${lim}`);
   if(/-(end|pier|window-head)-/.test(w.id)&&!/facade/.test(w.id)){
    const o=w.w/2+.02,clear=Math.min(roofHeight(w.x-o,w.z),roofHeight(w.x+o,w.z))-.064;
    assert.ok(top<=clear+EPS,`${w.id} top ${top} not clear of roof slab ${clear}`);
   }
  }
 });

 check(tag+'broad low gable: halfspan 4.7, half-length 4.2, ridge 4.35, eave 2.65, deep eaves solid',()=>{
  assert.ok(near(roofHeight(h.x,h.z),4.35));
  for(const s of [-1,1]){
   assert.ok(near(roofHeight(h.x+s*4.69,h.z),2.65+1.7*(1-4.69/4.7),1e-6),'eave height');
   assert.equal(roofHeight(h.x+s*4.75,h.z),Infinity);
   assert.ok(Number.isFinite(roofHeight(h.x,h.z+s*4.19)));assert.equal(roofHeight(h.x,h.z+s*4.25),Infinity);
   for(const d of [.5,2,3.5,4.5])assert.ok(near(roofHeight(h.x+d,h.z+s),roofHeight(h.x-d,h.z+s)),'symmetric pitch');
  }
  assert.ok(!sees([h.x+1,2,h.z-1],[h.x+1,7,h.z-1]),'roof solid');
  for(const e of [-1,1]){
   assert.ok(!sees([h.x+r*3.8,2.4,h.z+e*2.1],[h.x+r*3.8,7,h.z+e*2.1]),'veranda covered by eave');
   assert.ok(!sees([h.x+h.side*4.3,2.4,h.z+e*2.1],[h.x+h.side*4.3,7,h.z+e*2.1]),'rear eave');
  }
 });
}

check('opposite-bank symmetry: mirrored wall records, collision and roof',()=>{
 assert.equal(intact.length,2);
 const key=h=>wallsOf(h).map(w=>[(w.x-h.x)*-h.side,w.y,w.z-h.z,w.w,w.h,w.d].map(v=>(Math.round(v*1e6)/1e6+0).toFixed(6)).join(',')).sort();
 assert.deepEqual(key(intact[0]),key(intact[1]));
 const h=intact[0];
 for(let i=0;i<=52;i++)for(let j=0;j<=52;j++){
  const x=h.x-6+i*.23+.011,z=h.z-6+j*.23+.011;
  assert.equal(blocked(x,z,R,1.6,'player'),blocked(-x,z,R,1.6,'player'),`collision mirror at ${x.toFixed(2)},${z.toFixed(2)}`);
  const a=roofHeight(x,z),b=roofHeight(-x,z);assert.ok(a===b||near(a,b),'roof mirror');
 }
 for(const g of intact)for(const e of [-1,1]){const bx=g.x-g.side*2.75,bz=g.z+e*2.1;
  assert.ok(blocked(bx,bz,R,1.6,'enemy'),`${g.id} enemy bay blocker ${e}`);
  assert.ok(blocked(-bx,bz,R,1.6,'enemy'),`${g.id} enemy bay blocker mirror ${e}`);
 }
 for(const [y,dz] of [[1.2,2.1],[1.2,-2.1],[1.4,0],[.5,0],[1.4,1.2],[2.6,2.1]])
  assert.equal(sees([h.x+5,y,h.z+dz],[h.x,y,h.z+dz]),sees([-h.x-5,y,h.z+dz],[-h.x,y,h.z+dz]),`ray mirror y=${y} dz=${dz}`);
});

const failed=results.filter(r=>!r.pass);
console.log(JSON.stringify({pass:failed.length===0,date:new Date().toISOString(),intactHouses:intact.map(h=>h.id),wallBoxes:layout.walls.length,solids:solids.length,passed:results.length-failed.length,failed:failed.length,results},null,2));
if(failed.length)process.exitCode=1;
