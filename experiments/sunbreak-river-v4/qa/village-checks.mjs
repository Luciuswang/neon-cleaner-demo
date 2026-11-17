import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {buildVillage} from '../village.js';
import {layout} from '../map-layout.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const world=new T.Group(),solids=[],materials=Object.fromEntries(['plaster','brick','stone','wood','roof','metal'].map(k=>[k,new T.MeshStandardMaterial()]));
const village=buildVillage({T,world,materials,layout,solids});world.updateMatrixWorld(true);
for(const b of layout.walls){const s=solids.find(s=>s.userData.wall===b.id);assert.ok(s);assert.deepEqual(s.position.toArray(),[b.x,b.y,b.z]);assert.deepEqual([s.geometry.parameters.width,s.geometry.parameters.height,s.geometry.parameters.depth],[b.w,b.h,b.d])}
const ray=new T.Raycaster();
function sees(a,b){const origin=new T.Vector3(...a),end=new T.Vector3(...b);ray.set(origin,end.clone().sub(origin).normalize());ray.far=origin.distanceTo(end)-.001;return ray.intersectObjects(solids,true).length===0}
for(const h of layout.houses){assert.ok(sees([h.x,1.6,h.z+4],[h.x,1.6,h.z-4]),'door passage');assert.ok(!sees([h.x-5,.5,h.z],[h.x,.5,h.z]),'wall cover');if(h.ruin<2)assert.ok(!sees([h.x+1,2,h.z-1],[h.x+1,7,h.z-1]),'roof solid');if(h.ruin===1)assert.ok(sees([h.x+1,2,h.z+1],[h.x+1,7,h.z+1]),'ruined open roof')}
assert.ok(!sees([0,2,-4],[0,-1,-4]),'bridge blocks shot');assert.ok(village.info().drawCalls<100&&village.info().triangles<100000);
const sources={};for(const name of ['village.js','map-layout.js','qa/village-checks.mjs'])sources[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={pass:true,date:new Date().toISOString(),wallBoxes:layout.walls.length,architecture:village.info(),checks:'exact wall geometry; six clear passages and solid walls; roof slabs/half-collapse openings; bridge shot occlusion; batching budgets',sources};await writeFile(new URL('village-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
