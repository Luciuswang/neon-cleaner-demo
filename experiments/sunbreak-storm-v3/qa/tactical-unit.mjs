import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createNavigation,createTacticalAI,coverPairs,enemyHitBounds,segmentHitsBounds,TACTICAL_SPAWNS} from '../tactical-ai.js';
const checks=[],check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.stack})}};
const box=(x,z,w,d,h=2)=>({min:{x:x-w/2,y:0,z:z-d/2},max:{x:x+w/2,y:h,z:z+d/2}});
const obstacle=box(0,0,2,4);
const blocked=p=>p.x>obstacle.min.x-.4&&p.x<obstacle.max.x+.4&&p.z>obstacle.min.z-.4&&p.z<obstacle.max.z+.4;
check('segment slab detects occlusion and rejects parallel clear rays',()=>{
 assert.equal(segmentHitsBounds({x:-4,z:0},{x:4,z:0},obstacle),true);
 assert.equal(segmentHitsBounds({x:-4,z:4},{x:4,z:4},obstacle),false);
 assert.equal(segmentHitsBounds({x:-4,z:4},{x:-4,z:-4},obstacle),false);
});
check('A* routes around real inflated obstacle without cutting corners',()=>{
 const nav=createNavigation(blocked,{step:.5,minX:-6,maxX:6,minZ:-6,maxZ:6});
 const start={x:-4,z:0},end={x:4,z:0},path=nav.path(start,end);
 assert.ok(path.length>=2);let from=start;
 for(const to of path){assert.ok(nav.clear(from,to));from=to}
 assert.ok(path.some(p=>Math.abs(p.z)>=2.4));assert.deepEqual(path.at(-1),{...end,y:0});
});
check('navigation rejects unreachable destination',()=>{
 const nav=createNavigation(p=>Math.abs(p.x)<1,{step:.5,minX:-4,maxX:4,minZ:-3,maxZ:3});
 assert.deepEqual(nav.path({x:-3,z:0},{x:3,z:0}),[]);
});
check('standing/crouched hitbox follows stance and raised cabin floor',()=>{
 const e={g:{position:{x:12,y:.66,z:-17}},tactical:{stance:0}};
 assert.equal(enemyHitBounds(e).max.y,2.46);e.tactical.stance=1;
 assert.ok(Math.abs(enemyHitBounds(e).max.y-1.89)<1e-9);
 assert.equal(enemyHitBounds(e).min.y,.66);
});
check('cover pairs provide distinct hidden/peek stations outside solid',()=>{
 const b=box(0,0,1.5,1.5,1.3),pairs=coverPairs([b]);assert.equal(pairs.length,8);
 for(const c of pairs){assert.notDeepEqual(c.hide,c.peek);assert.equal(c.low,true)}
});
const fixtures=[
 box(-13,-16,9,7,4.2),box(-21,4,11,7,4.6),box(20,6,8,10,4),box(-4,-27,11,6,3.6),
 ...[[-6,2],[5,-4],[8,8],[-14,10],[0,-12],[14,-6]].map(([x,z])=>box(x,z,1.5,1.5,1.3))
];
function slab3(a,b,r){
 let near=0,far=1;
 for(const k of ['x','y','z']){
  const d=b[k]-a[k];
  if(Math.abs(d)<1e-9){if(a[k]<r.min[k]||a[k]>r.max[k])return false;continue}
  let l=(r.min[k]-a[k])/d,h=(r.max[k]-a[k])/d;if(l>h)[l,h]=[h,l];near=Math.max(near,l);far=Math.min(far,h);
  if(near>far)return false;
 }return near<.999&&far>.001;
}
const isBlocked=p=>fixtures.some(b=>p.x>b.min.x-.4&&p.x<b.max.x+.4&&p.z>b.min.z-.4&&p.z<b.max.z+.4);
const canSee=(a,b)=>!fixtures.some(r=>slab3(a,b,r));
const makeEnemies=()=>TACTICAL_SPAWNS.map(p=>({
 alive:true,g:{position:{x:p[0],y:p[1],z:p[2],set(x,y,z){Object.assign(this,{x,y,z})}},rotation:{y:0}},
 wg2:{position:{y:1.43},rotation:{x:0}}
}));
let sample;
function simulation(){
 const enemies=makeEnemies(),shots=[];
 const ai=createTacticalAI({enemies,bounds:fixtures,isBlocked,canSee,onShoot:(e,p)=>{
  const from={x:e.g.position.x,y:e.g.position.y+1.43-.52*e.tactical.stance,z:e.g.position.z};
  if(!canSee(from,p))return false;shots.push({i:enemies.indexOf(e),t:ai.info().elapsed,mode:e.tactical.mode});return true;
 }});
 const modes=new Set(),positions=[];let overlap=0;
 for(let frame=0;frame<1800;frame++){
  ai.update(1/60,{live:true,player:{x:0,y:1.7,z:12}});
  for(const e of enemies){modes.add(e.tactical.mode);if(isBlocked(e.g.position))overlap++}
  if(frame%120===0)positions.push(enemies.map(e=>({x:e.g.position.x,z:e.g.position.z,mode:e.tactical.mode})));
 }
 return{ai,enemies,shots,modes:[...modes].sort(),positions,overlap};
}
check('cover loop moves, aims, fires staggered bursts and returns without overlap',()=>{
 sample=simulation();assert.ok(sample.shots.length>0);
 assert.equal(sample.overlap,0);
 for(const mode of ['advance','hide','peek','aim','burst','retreat'])assert.ok(sample.modes.includes(mode),mode);
 assert.ok(new Set(sample.shots.map(s=>s.i)).size>=2);
 assert.ok(sample.ai.info().totalMovementMeters>3);
 assert.ok(new Set(sample.shots.slice(0,6).map(s=>s.t.toFixed(2))).size>1);
});
check('deterministic seeded state machine, no global randomness',()=>{
 const repeat=simulation();
 assert.deepEqual(repeat.shots,sample.shots);assert.deepEqual(repeat.positions,sample.positions);
 const source=readFileSync(new URL('../tactical-ai.js',import.meta.url),'utf8');assert.ok(!source.includes('Math.random'));
});
check('paused and dead NPCs cannot move or fire',()=>{
 const {ai,enemies}=sample,before=JSON.stringify(ai.info()),positions=enemies.map(e=>({...e.g.position}));
 ai.update(1,{live:false,player:{x:0,y:1.7,z:12}});assert.equal(JSON.stringify(ai.info()),before);
 enemies.forEach(e=>e.alive=false);const shots=ai.info().totalShots;
 ai.update(.05,{live:true,player:{x:0,y:1.7,z:12}});
 assert.equal(ai.info().totalShots,shots);
 enemies.forEach((e,i)=>{assert.equal(e.g.position.x,positions[i].x);assert.equal(e.g.position.z,positions[i].z)});
});
check('solid-wall occlusion suppresses all actual firing',()=>{
 const enemies=makeEnemies();let shots=0;
 const ai=createTacticalAI({enemies,bounds:fixtures,isBlocked,canSee:()=>false,onShoot:()=>{shots++;return false}});
 for(let i=0;i<900;i++)ai.update(1/60,{live:true,player:{x:0,y:1.7,z:12}});
 assert.equal(shots,0);assert.equal(ai.info().totalShots,0);
});
check('reset restores six authorized spawns, full state and raised indoor guard',()=>{
 sample.ai.reset();assert.equal(sample.ai.info().elapsed,0);assert.equal(sample.ai.info().totalShots,0);
 sample.enemies.forEach((e,i)=>assert.deepEqual([e.g.position.x,e.g.position.y,e.g.position.z],[...TACTICAL_SPAWNS[i]]));
});
const bytes=readFileSync(new URL('../tactical-ai.js',import.meta.url));
const report={date:new Date().toISOString(),method:'isolated deterministic AI/path/stance fixtures, not browser gameplay',
 sourceSha256:createHash('sha256').update(bytes).digest('hex'),pass:checks.every(c=>c.pass),checks,
 simulation:sample?{shots:sample.shots,modes:sample.modes,overlap:sample.overlap,positions:sample.positions}:null};
writeFileSync(new URL('./tactical-unit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass),simulation:sample&&{shots:sample.shots.length,modes:sample.modes,overlap:sample.overlap}},null,2));
if(!report.pass)process.exitCode=1;
