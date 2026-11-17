import * as m from '../map-layout.js';
import {createTacticalAI} from '../tactical-ai.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const blocked=p=>m.blocked(p.x,p.z,.4,p.y);
const actor=()=>({alive:true,g:{position:{x:0,y:0,z:0},rotation:{y:0}},wg2:{position:{x:.22,y:0,z:0},rotation:{x:0}}});
const cases=[];
for(const z of [...m.crossings,0])for(const side of [-1,1])cases.push({name:`cross-${z}-${side}`,start:{x:side*10,z},end:{x:-side*10,z}});
for(const [x,,z]of m.spawns)cases.push({name:`spawn-${x}-${z}`,start:{x,z},end:{x:-x,z}});
for(const side of [-1,1])for(const z of m.crossings)cases.push({name:`entry-${side}-${z}`,start:{x:side*27,z:22},end:{x:side*5,z}});
for(const side of [-1,1])cases.push({name:`connector-${side}`,start:{x:side*13.6863833,z:21.1993733},end:{x:side*8.5262700,z:-18.3780100}});
cases.push({name:'second-repro',start:{x:-16.463536759838462,z:19.929647704586387},end:{x:-2.07291092723608,z:16.629392685368657}});
for(const x of [-2,0,2])for(const d of [-1,1])cases.push({name:`bridge-edge-${x}-${d}`,start:{x,z:-4-d*4},end:{x,z:-4+d*4}});
for(const side of [-1,1])cases.push({name:`doorway-${side}`,start:{x:side*15,z:-3},end:{x:0,z:0}});
const traversals=[];
for(const dt of [1/60,.05]){
 const enemy=actor(),ai=createTacticalAI({enemies:[enemy],bounds:m.bounds,isBlocked:blocked,canSee:()=>false,onShoot:()=>false});
 for(const c of cases){
  ai.reset();Object.assign(enemy.g.position,{...c.start,y:m.terrainHeight(c.start.x,c.start.z)});const s=ai.qa.states[0];
  Object.assign(s,{path:ai.qa.navigation.path(c.start,c.end),mode:'advance',think:1e9,timer:1e9});
  let steps=0,penetration=false,maxFloorError=0;
  while(s.path.length&&steps<Math.ceil(120/dt)){ai.update(dt,{live:true,player:{x:1000,y:1.7,z:1000}});steps++;const p=enemy.g.position;penetration||=blocked({...p,y:p.y+1.6});maxFloorError=Math.max(maxFloorError,Math.abs(p.y-m.terrainHeight(p.x,p.z)))}
  const p=enemy.g.position,error=Math.hypot(p.x-c.end.x,p.z-c.end.z),pass=steps>0&&error<.15&&!penetration&&maxFloorError<1e-10;
  traversals.push({name:c.name,dt,pass,error,steps,penetration,maxFloorError});
 }
}
const sources={};for(const name of ['map-layout.js','tactical-ai.js','qa/ai-movement.mjs'])sources[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),pass:traversals.every(r=>r.pass),method:'Actual AI update-loop movement along navigation-generated routes; decisions held, not shot approval or human playtesting',sources,traversals};await writeFile(new URL('ai-movement.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log({pass:report.pass,cases:traversals.length,failures:traversals.filter(r=>!r.pass)});assert.ok(report.pass);
