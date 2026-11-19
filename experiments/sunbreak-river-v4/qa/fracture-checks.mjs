import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {fracturedSlab} from '../fracture-geometry.js';
import {buildRuins} from '../ruins.js';
import {layout,rubbleHeight,terrainHeight} from '../map-layout.js';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
let samples=0,triangles=0;
for(let seed=1;seed<=160;seed++){
 const dims=[.06+seed*.017,.08+seed*.013,.025+seed*.001],g=fracturedSlab(T,...dims,seed),again=fracturedSlab(T,...dims,seed);
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,edges=new Map(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let volume=0;
 assert.deepEqual(p.array,again.attributes.position.array,'deterministic seed');
 assert.ok([...p.array,...n.array,...uv.array].every(Number.isFinite),'finite attributes');
 for(let i=0;i<3;i++)assert.ok(Math.abs(g.boundingBox.max.getComponent(i)-g.boundingBox.min.getComponent(i)-dims[i])<1e-5,'declared extents');
 const key=v=>v.toArray().map(x=>x.toFixed(6)).join(',');
 for(let i=0;i<p.count;i+=3){
  a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
  const cross=b.clone().sub(a).cross(c.clone().sub(a));assert.ok(cross.length()>1e-10,'nondegenerate triangle');
  assert.ok(cross.normalize().dot(new T.Vector3().fromBufferAttribute(n,i))>.999,'normal follows winding');
  volume+=a.dot(b.clone().cross(c))/6;
  const ks=[key(a),key(b),key(c)];for(let j=0;j<3;j++){const u=ks[j],v=ks[(j+1)%3],edge=[u,v].sort().join('|');const e=edges.get(edge)||{count:0,direction:0};e.count++;e.direction+=u<v?1:-1;edges.set(edge,e)}
 }
 assert.ok(volume>0,'positive closed volume');
 for(const e of edges.values())assert.ok(e.count===2&&e.direction===0,'closed manifold, opposite edge winding');
 assert.equal(g.groups.reduce((n,g)=>n+g.count,0),p.count);samples++;triangles+=p.count/3;g.dispose();again.dispose();
}
const world=new T.Group(),solids=[],materials=Object.fromEntries(['plaster','brick','stone'].map(k=>[k,new T.MeshStandardMaterial()]));
const ruin=buildRuins({T,world,materials,layout,solids});world.updateMatrixWorld(true);
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);let pileSamples=0;
for(const mound of layout.rubbleMounds){const mesh=solids.find(s=>s.name===mound.id);assert.ok(mesh);for(let i=0;i<37;i++)for(let j=0;j<5;j++){
 const a=i*Math.PI*2/37,r=(j+.1)/5,x=mound.x+Math.cos(a)*r*mound.rx,z=mound.z+Math.sin(a)*r*mound.rz;
 ray.set(new T.Vector3(x,2,z),down);const hit=ray.intersectObject(mesh)[0];if(hit){assert.ok(Math.abs(hit.point.y-rubbleHeight(x,z))<1e-5,'pile render and floor exact');assert.ok(Math.abs(hit.point.y-terrainHeight(x,z))<1e-5)}else assert.equal(rubbleHeight(x,z),0,'outside irregular outline has no pile support');pileSamples++;
}}
assert.equal(terrainHeight(0,0),-.58,'piles cannot flatten riverbed');
let supportChecks=0,maxDecorativeGap=0,maxStep=0;
for(const mound of layout.rubbleMounds)for(let ix=-13;ix<=13;ix++)for(let iz=-13;iz<=13;iz++){
 const x=mound.x+ix*.08,z=mound.z+iz*.08,support=Math.max(terrainHeight(x,z),ruin.floorHeight(x,z));
 ray.set(new T.Vector3(x,4,z),down);const hit=ray.intersectObjects(solids,true)[0];
 if(hit){const gap=Math.max(0,hit.point.y-support);maxDecorativeGap=Math.max(maxDecorativeGap,gap);assert.ok(gap<1e-5,'visible fragment must match exact support '+JSON.stringify({x,z,support,hit:hit.point.y,gap}))}
 const next=Math.max(terrainHeight(x+.04,z),ruin.floorHeight(x+.04,z));maxStep=Math.max(maxStep,Math.abs(next-support));
 assert.ok(Math.abs(next-support)<.4,'large slab cannot introduce a wall-height step '+JSON.stringify({x,z,support,next}));supportChecks++;
}
const sources={};for(const name of ['fracture-geometry.js','ruins.js','map-layout.js','qa/fracture-checks.mjs'])sources[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),pass:true,samples,triangles,pileSamples,supportChecks,maxSurfaceGap:maxDecorativeGap,maxStep,ruins:ruin.info(),sources,limits:'Static geometry and exact support for every fragment and coarse pile. Not dynamic destruction or visual acceptance.'};
if(!process.argv.includes('--stdout-only'))await writeFile(new URL('fracture-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
