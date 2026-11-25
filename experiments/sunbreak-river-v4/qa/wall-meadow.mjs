// qa/wall-meadow.mjs — read-only; never mutates source, collision or spawns.
import assert from 'node:assert/strict';
import {meadowRoots} from '../meadow-roots.js';
import {trafficDistance} from '../ground-surface.js';
import {groundHeight,bankScreens,MAP,bufferLocal,bufferPlacements,crossings,houses} from '../map-layout.js';

const R=meadowRoots(),near=.9,HW=3.64,MIN=.75;
assert(R.length>10000,`roots ${R.length}`);
for(const r of R)for(const k of ['x','z','y','h','r'])assert(Number.isFinite(r[k]),`non-finite ${k}`);

const fam={};
for(const f of ['house','ruin','cabin','cover','bank','perimeter']){
 fam[f]=R.filter(r=>r.wall.startsWith(f)).length;
 assert(fam[f]>=200,`${f} roots ${fam[f]}`);
}
const bank=R.filter(r=>r.wall.startsWith('bank')),peri=R.filter(r=>r.wall.startsWith('perimeter'));
bankScreens.forEach((s,i)=>{
 const hx=s.hx??s.w/2,hz=s.hz??s.d/2;
 assert(Number.isFinite(hx+hz),`bank screen ${i}: unknown footprint shape`);
 const n=bank.filter(r=>Math.hypot(Math.max(Math.abs(r.x-s.x)-hx,0),Math.max(Math.abs(r.z-s.z)-hz,0))<near).length;
 assert(n>0,`bank screen ${i} has no roots within ${near}m`);
});
for(const [side,d] of [['W',r=>r.x-MAP.minX],['E',r=>MAP.maxX-r.x],['N',r=>r.z-MAP.minZ],['S',r=>MAP.maxZ-r.z]])
 assert(peri.some(r=>d(r)<near),`perimeter ${side} bare`);

const inHouse=(x,z)=>houses.some(h=>Math.abs(x-h.x)<HW&&Math.abs(z-h.z)<HW);
const inDoor=(x,z)=>houses.some(h=>{const o=-(x-h.x)*h.side;return o>3.2&&o<5.3&&Math.abs(Math.abs(z-h.z)-2.1)<.95});
const inBuf=(x,z)=>bufferPlacements.some(p=>{const q=bufferLocal(x,z,p);return q.x>-4.5&&q.x<4.5&&q.z>-4.5&&q.z<6.15});
const B=new Map(),key=(x,z)=>Math.floor(x)+','+Math.floor(z);
for(const r of R){
 assert(groundHeight(r.x,r.z)>=-.085,`river root ${r.x},${r.z}`);
 assert(trafficDistance(r.x,r.z)>.8-.002,`traffic root ${r.x},${r.z}`);
 assert(!inDoor(r.x,r.z),`door root ${r.x},${r.z}`);
 assert(!inBuf(r.x,r.z),`buffer root ${r.x},${r.z}`);
 const k=key(r.x,r.z);B.has(k)?B.get(k).push(r):B.set(k,[r]);
}

let tot=0,hit=0;
for(let x=Math.ceil(MAP.minX+1);x<=MAP.maxX-1;x++)for(let z=Math.ceil(MAP.minZ+1);z<=MAP.maxZ-1;z++){
 if(groundHeight(x,z)<-.08||(Math.abs(x)<6.4&&Math.abs(z+4)<1.6)||inHouse(x,z)||inBuf(x,z)||trafficDistance(x,z)<=.8)continue;
 tot++;
 search:for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)
  for(const r of B.get(key(x+i,z+j))||[])if(Math.hypot(r.x-x,r.z-z)<=.65){hit++;break search}
}
const pct=100*hit/tot;
assert(tot>100&&pct>=MIN*100,`coverage ${pct.toFixed(1)}% of ${tot}`);
console.log(`wall-meadow OK roots=${R.length} field=${R.filter(r=>r.wall==='').length} fam=${JSON.stringify(fam)} `+
 `bankScreens=${bankScreens.length} crossings=${crossings.length} cover=${pct.toFixed(1)}% (${hit}/${tot} 1m pts, r=.65)`);
console.log('scope: bank screens and perimeter sides tested individually; house/ruin/cabin/cover by family count only, NOT per wall');
