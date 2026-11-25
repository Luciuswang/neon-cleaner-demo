// qa/bank-screens.mjs — read-only regression for the bank screens (writes no files).
// The active 4v4 pairing regression is run separately; no nav or other features are tested here.
import assert from 'node:assert/strict';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {buildPerimeter} from '../perimeter-art.js';
import {bankScreens,bounds,blocked,crossings,spawns} from '../map-layout.js';

const EYE=1.7,HEAD=1.95,LOW=.3,ACTORS=['player','enemy'];

// 1. Exactly four stone screens, two per bank, each with a shared static bound.
assert.equal(bankScreens.length,4,'exactly four bank screens');
assert.equal(new Set(bankScreens.map(s=>s.id)).size,4,'unique ids');
assert.equal(bankScreens.filter(s=>s.x<0).length,2,'two on west bank');
assert.equal(bankScreens.filter(s=>s.x>0).length,2,'two on east bank');
const ids=new Set(bankScreens.map(s=>s.id));
for(const s of bankScreens){
 assert.equal(s.material,'stone',`${s.id} material`);
 assert.ok(bounds.some(b=>b.id===s.id),`${s.id} present in bounds`);
 for(const a of ACTORS)assert.ok(blocked(s.x,s.z,.4,1.6,a),`${s.id} solid for ${a}`);
}

// 2. Rendered solids: rays along X only, from centre±1.0 with range 2.0.
const world=new T.Group(),solids=[];
buildPerimeter(T,world,new T.MeshStandardMaterial(),solids);
world.updateMatrixWorld(true);
const shown=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return [].concat(o.material).every(m=>m&&m.visible!==false)};
const cast=(s,side,y,z)=>new T.Raycaster(new T.Vector3(s.x+side,y,z),new T.Vector3(-side,0,0),0,2)
 .intersectObjects(solids,true).filter(h=>shown(h.object));
for(const s of bankScreens){
 const top=s.y+s.h/2,row={id:s.id,top:+top.toFixed(2)};
 assert.ok(top>EYE,`${s.id} top ${top} above eye`);
 for(const side of [-1,1]){
  const f=side<0?'W':'E';
  const low=cast(s,side,LOW,s.z).length,eye=cast(s,side,EYE,s.z).length;
  const over=cast(s,side,top+.3,s.z).length;
  const endN=cast(s,side,EYE,s.z-s.d/2-.5).length,endS=cast(s,side,EYE,s.z+s.d/2+.5).length;
  Object.assign(row,{[f+'low']:low,[f+'eye']:eye,[f+'over']:over,[f+'end-']:endN,[f+'end+']:endS});
  assert.ok(low>0,`${s.id} ${f} face low ray hits visible mesh`);
  assert.ok(eye>0,`${s.id} ${f} face eye ray hits visible mesh`);
  assert.equal(over,0,`${s.id} ${f} clear above wall`);
  assert.equal(endN+endS,0,`${s.id} ${f} clear past both ends`);
 }
 console.log('screen hits',JSON.stringify(row));
}

// 3. All three crossings walkable for x in [-10,10]; all existing spawns unblocked.
assert.equal(crossings.length,3,'three crossings');
for(const z of crossings)for(const a of ACTORS)for(let x=-10;x<=10;x+=.25)
 assert.ok(!blocked(x,z,.4,1.6,a),`crossing z=${z} blocked for ${a} at x=${x}`);
for(const [x,,z] of spawns)for(const a of ACTORS)
 assert.ok(!blocked(x,z,.4,1.6,a),`spawn ${x},${z} blocked for ${a}`);
console.log(`crossings ok: ${crossings.join(', ')} | spawns unblocked: ${spawns.length}`);

// 4. Solo-spawn LOS, before and after. CAVEAT: this uses modelled AABBs from the
// shared static bounds (profile walls count as full boxes), not rendered village
// meshes, and eastern spawns stand in for eastern NPC centres.
const hit=(o,t,b)=>{let a=0,e=1;for(const k of ['x','y','z']){const d=t[k]-o[k];
 if(Math.abs(d)<1e-9){if(o[k]<b.min[k]||o[k]>b.max[k])return false;continue}
 let p=(b.min[k]-o[k])/d,q=(b.max[k]-o[k])/d;if(p>q)[p,q]=[q,p];
 a=Math.max(a,p);e=Math.min(e,q);if(a>e)return false}return true};
const from={x:-26,y:1.7,z:22},base=bounds.filter(b=>!ids.has(b.id));
let before=0,after=0,n=0;
for(const [x,y,z] of spawns.filter(p=>p[0]>0))for(const [name,h] of [['eye',EYE],['head',HEAD]]){
 const to={x,y:y+h,z},b=base.filter(k=>hit(from,to,k)).length;
 const by=bounds.filter(k=>ids.has(k.id)&&hit(from,to,k)).map(k=>k.id);
 n++;if(b)before++;if(b||by.length)after++;
 console.log(`LOS -> (${x},${to.y},${z}) ${name}: baseline blockers=${b}, screens=[${by}]`);
}
console.log(`LOS blocked BEFORE (screens excluded): ${before}/${n}`);
console.log(`LOS blocked AFTER  (screens included): ${after}/${n}`);
assert.equal(n,6,'three enemy spawn positions, two heights per position');
assert.equal(after,n,'no exposed opposing eye/head from solo start');
console.log('bank-screens: all assertions passed');
