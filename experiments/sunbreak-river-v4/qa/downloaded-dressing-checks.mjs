import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {localAssetSnapshot,readLocalAsset,validateLocalGLB} from '../local-asset-store.mjs';
import {dressingPlan,clearGrassFootprint,DRESSING_BUDGET,buildDownloadedDressing} from '../downloaded-dressing.js';
import {MAP,layout,terrainHeight,landscapeHeight} from '../map-layout.js';
import {vegetationPlan} from '../vegetation.js';
import {buildRuins} from '../ruins.js';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
const root=fileURLToPath(new URL('../',import.meta.url)),results=[];
const check=(name,fn)=>{fn();results.push({name,pass:true})};
const {manifest,hashes}=await localAssetSnapshot();
assert.ok(manifest.enabled&&manifest.assets.length>=10);
const plan=dressingPlan(manifest.assets);
check('deterministic layout',()=>assert.deepEqual(plan,dressingPlan(manifest.assets)));
check('measured instance triangles within fixed cap',()=>assert.ok(plan.triangles<=DRESSING_BUDGET.triangles));
check('every converted model is represented in scene',()=>assert.ok(manifest.assets.every(a=>plan.counts[a.id]>0)));
check('dark dry stems are outside playable woodland only',()=>assert.ok(plan.placements.filter(p=>p.id.startsWith('grass-clumps')).every(p=>p.zone==='woodland-understorey'&&Math.abs(p.x)>MAP.maxX+1)));
check('source geometry files identified',()=>assert.ok(manifest.assets.every(a=>hashes['local-only/'+a.file]===a.sha256)));
check('grass circles clear paths, doors, spawns and crossings',()=>assert.ok(plan.placements.filter(p=>p.kind==='grass').every(p=>clearGrassFootprint(p.x,p.z,p.radius+.035))));
check('large solid decorations completely outside playable rectangle',()=>assert.ok(plan.placements.filter(p=>p.kind!=='grass'&&!p.micro).every(p=>p.x+p.radius<MAP.minX-1||p.x-p.radius>MAP.maxX+1||p.z+p.radius<MAP.minZ-1||p.z-p.radius>MAP.maxZ+1)));
check('micro debris below unchanged 3cm support tolerance, no cover',()=>assert.ok(plan.placements.filter(p=>p.micro).every(p=>p.height<=.026&&p.radius<.14&&clearGrassFootprint(p.x,p.z,p.radius+.035))));
const ruin=buildRuins({T,world:new T.Group(),solids:[],materials:Object.fromEntries(['plaster','brick','stone'].map(k=>[k,new T.MeshStandardMaterial()])),layout});
const tiny=await readLocalAsset('cement-rubble-small.glb'),doc=validateLocalGLB(tiny),binStart=28+tiny.readUInt32LE(12),points=[];
function readPoints(id,parent=new T.Matrix4()){
 const n=doc.nodes[id],matrix=n.matrix?new T.Matrix4().fromArray(n.matrix):new T.Matrix4().compose(new T.Vector3().fromArray(n.translation||[0,0,0]),new T.Quaternion().fromArray(n.rotation||[0,0,0,1]),new T.Vector3().fromArray(n.scale||[1,1,1]));matrix.premultiply(parent);
 for(const p of n.mesh===undefined?[]:doc.meshes[n.mesh].primitives){const a=doc.accessors[p.attributes.POSITION],v=doc.bufferViews[a.bufferView];assert.equal(a.componentType,5126);for(let i=0;i<a.count;i++){const offset=binStart+(v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||12);points.push(new T.Vector3(tiny.readFloatLE(offset),tiny.readFloatLE(offset+4),tiny.readFloatLE(offset+8)).applyMatrix4(matrix))}}
 for(const child of n.children||[])readPoints(child,matrix);
}
for(const id of doc.scenes[doc.scene||0].nodes)readPoints(id);
const box=new T.Box3().setFromPoints(points),center=box.getCenter(new T.Vector3());points.forEach(p=>p.sub(new T.Vector3(center.x,box.min.y,center.z)));
let surfaceSamples=0,maxVisibleGap=0,maxBuried=0;
for(const p of plan.placements.filter(p=>p.micro))for(const v of points){
 const q=v.clone().multiplyScalar(p.scale).applyAxisAngle(new T.Vector3(0,1,0),p.yaw).add(new T.Vector3(p.x,p.y,p.z)),floor=Math.max(terrainHeight(q.x,q.z),ruin.floorHeight(q.x,q.z)),gap=q.y-floor;
 maxVisibleGap=Math.max(maxVisibleGap,gap);maxBuried=Math.max(maxBuried,-gap);surfaceSamples++;
 assert.ok(gap<=.03,'actual rendered micro surface exceeds floor contract');
}
check('actual transformed micro mesh vertices vs current terrain and ruin support',()=>assert.ok(surfaceSamples>1000&&maxVisibleGap<=.03));
const trees=vegetationPlan().trunks,houseGrounding=[];
for(const p of plan.placements.filter(p=>p.kind==='house')){
 const nearestTrunk=Math.min(...trees.map(t=>Math.hypot(t.x-p.x,t.z-p.z)));assert.ok(nearestTrunk>p.radius+3.4,'tree crown/trunk intersects house envelope');
 let low=Infinity,high=-Infinity;for(let i=0;i<64;i++){const a=i*Math.PI/32,y=landscapeHeight(p.x+Math.cos(a)*p.radius,p.z+Math.sin(a)*p.radius);low=Math.min(low,y);high=Math.max(high,y)}
 assert.ok(p.y<=low+.03&&high-p.y<.3,'house base floats or excessive hillside burial');houseGrounding.push({id:p.id,x:p.x,z:p.z,lowestBase:p.y,minGround:low,maxGround:high,nearestTrunk});
}
check('two houses have clear trunks and near-flat grounded footprint envelopes',()=>assert.equal(houseGrounding.length,2));
const world=await readFile(resolve(root,'world.js'),'utf8');
check('no scan props in collision or support contract',()=>assert.ok(!/dressing\.(floor|blocks|solid|collid)/.test(world)));
const served=await readLocalAsset('manifest.json');
check('exact served manifest hash binds client bytes',()=>assert.equal(createHash('sha256').update(served).digest('hex'),hashes['local-only/served-manifest.json']));
check('public package only adds loader source',()=>{assert.ok(!manifest.assets.some(a=>a.url.startsWith('https:')))});
const dir=await mkdtemp(resolve(tmpdir(),'river-import-test-'));
try{
 check('absent optional pack has baseline manifest',()=>{});assert.equal((await localAssetSnapshot(dir)).manifest.enabled,false);
 await writeFile(resolve(dir,'manifest.json'),JSON.stringify({schema:1,enabled:false,assets:[]}));assert.equal((await localAssetSnapshot(dir)).manifest.enabled,false);results.push({name:'disabled optional pack baseline',pass:true});
 for(const bad of [{id:'x',kind:'wall',file:'../secret.glb',dimensions:[1,1,1],triangles:1},{id:'x',kind:'unknown',file:'x.glb',dimensions:[1,1,1],triangles:1}]){
  await writeFile(resolve(dir,'manifest.json'),JSON.stringify({schema:1,enabled:true,assets:[bad]}));await assert.rejects(localAssetSnapshot(dir));results.push({name:'reject unsafe name or unsupported kind '+bad.kind,pass:true});
 }
 const source={asset:{version:'2.0'},buffers:[{uri:'https://invalid.test/secret.bin',byteLength:1}]},body=Buffer.from(JSON.stringify(source)),json=Buffer.concat([body,Buffer.alloc((4-body.length%4)%4,32)]),b=Buffer.alloc(20+json.length);
 b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);
 check('external GLB dependency rejected',()=>assert.throws(()=>validateLocalGLB(b),/self-contained/));
 globalThis.location={hostname:'127.0.0.1',search:''};globalThis.fetch=async()=>({ok:false,status:503});
 class Group{constructor(){this.children=[]}traverse(fn){fn(this)}add(o){this.children.push(o)}}
 const fallback=await buildDownloadedDressing({Group},new Group());
 check('invalid optional manifest returns usable empty layer',()=>assert.ok(!fallback.info().enabled&&fallback.info().status==='fallback-error'));
 location.hostname='example.com';let fetched=false;globalThis.fetch=async()=>{fetched=true;throw Error('unexpected')};
 const remote=await buildDownloadedDressing({Group},new Group());check('public host never requests local assets',()=>assert.ok(!fetched&&!remote.info().enabled));
}finally{assert.ok(dir.startsWith(resolve(tmpdir(),'river-import-test-')));await rm(dir,{recursive:true,force:true})}
console.log(JSON.stringify({pass:true,checks:results.length,results,counts:plan.counts,triangles:plan.triangles,bytes:manifest.bytes,micro:{surfaceSamples,maxVisibleGap,maxBuried},houseGrounding},null,2));
