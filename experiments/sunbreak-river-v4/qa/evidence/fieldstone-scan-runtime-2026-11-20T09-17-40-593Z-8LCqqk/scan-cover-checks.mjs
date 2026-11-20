// Actual private GLB triangles, no rendering or texture extraction/writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {localAssetSnapshot,localAssetRoot,validateLocalGLB} from '../local-asset-store.mjs';
import {buildScanCover} from '../scan-cover.js';
import {layout} from '../map-layout.js';
import {isStoneCover} from '../stone-cover.js';
import {combatEventFromIntersection} from '../combat-feedback.js';
const {manifest}=await localAssetSnapshot(),sources=[];
for(const a of manifest.assets.filter(a=>a.id==='mossy-wall-a'||a.id==='mossy-wall-b')){
 const bytes=await readFile(resolve(localAssetRoot,a.file)),j=validateLocalGLB(bytes),binStart=20+bytes.readUInt32LE(12)+8;
 assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);
 assert.equal(j.nodes.length,1);assert.equal(j.nodes[0].mesh,0);for(const k of ['translation','rotation','scale','matrix'])assert.equal(j.nodes[0][k],undefined,'verified source uses baked identity node');
 assert.equal(j.meshes.length,1);assert.equal(j.meshes[0].primitives.length,1);
 const p=j.meshes[0].primitives[0],geo=new T.BufferGeometry();
 function attribute(index){const a=j.accessors[index],v=j.bufferViews[a.bufferView],components={SCALAR:1,VEC2:2,VEC3:3}[a.type],ArrayType=a.componentType===5126?Float32Array:a.componentType===5123?Uint16Array:null;assert.ok(ArrayType);assert.equal(a.sparse,undefined);
  const out=new ArrayType(a.count*components),step=ArrayType.BYTES_PER_ELEMENT,stride=v.byteStride||components*step,offset=binStart+(v.byteOffset||0)+(a.byteOffset||0);
  for(let i=0;i<a.count;i++)for(let c=0;c<components;c++)out[i*components+c]=a.componentType===5126?bytes.readFloatLE(offset+i*stride+c*step):bytes.readUInt16LE(offset+i*stride+c*step);
  return new T.BufferAttribute(out,components);
 }
 geo.setAttribute('position',attribute(p.attributes.POSITION));geo.setAttribute('normal',attribute(p.attributes.NORMAL));geo.setAttribute('uv',attribute(p.attributes.TEXCOORD_0));geo.setIndex(attribute(p.indices));
 const scene=new T.Group();scene.add(new T.Mesh(geo,new T.MeshStandardMaterial({roughness:.8})));sources.push({...a,scene});
}
assert.equal(sources.length,2,'both pinned private reference walls required for this test');
const walls=layout.walls.filter(isStoneCover),world=new T.Group(),solids=walls.map(w=>{const m=new T.Mesh(new T.BoxGeometry(w.w,w.h,w.d),new T.MeshBasicMaterial());m.position.set(w.x,w.y,w.z);m.userData={wall:w.id};m.updateMatrixWorld(true);return m});
const original=solids.map(s=>s.raycast),positions=solids.map(s=>Array.from(s.geometry.attributes.position.array));
assert.equal(buildScanCover({T,world,walls,solids,sources:[]}),null,'missing/off pack does not replace fallback');
const scanned=buildScanCover({T,world,walls,solids,sources});assert.equal(scanned.info().enabled,false);assert.ok(solids.every((s,i)=>s.raycast===original[i]),'construction is atomic/inactive');
scanned.setEnabled(true);world.updateMatrixWorld(true);
assert.equal(scanned.info().drawCalls,2);assert.ok(scanned.info().triangles<=40000);
assert.deepEqual(solids.map(s=>Array.from(s.geometry.attributes.position.array)),positions,'movement/box data unchanged');
const ray=new T.Raycaster(),dir=new T.Vector3(),normal=new T.Vector3();let rays=0,hits=0,misses=0,maxGap=0,maxNormalError=0;
const runtimeProbes=[];
for(const [wi,w]of walls.entries()){
 const binding=scanned.bindings.find(b=>b.id===w.id),position=binding.proxy.geometry.attributes.position;
 for(let i=0;i<position.count;i++){const point=new T.Vector3().fromBufferAttribute(position,i).applyMatrix4(binding.proxy.matrixWorld);for(const [k,key,size]of [[0,'x','w'],[1,'y','h'],[2,'z','d']])assert.ok(Math.abs(point.getComponent(k)-w[key])<=w[size]/2+2e-5,'scan inside original movement envelope')}
 for(const side of [-1,1])for(let u=0;u<17;u++)for(let v=0;v<11;v++)for(const angle of [0,.52,1.047]){
  const point=new T.Vector3(w.x+w.w*((u+.5)/17-.5),w.y+w.h*((v+.5)/11-.5),w.z+side*w.d/2);
  normal.set(0,0,side);dir.copy(normal).multiplyScalar(-Math.cos(angle));dir.x=Math.sin(angle);
  ray.set(point.clone().addScaledVector(dir,-.75),dir);ray.near=0;ray.far=2;
  const visible=ray.intersectObjects(scanned.group.children,false)[0],shot=ray.intersectObject(solids[wi],false)[0];rays++;
  assert.equal(!!shot,!!visible,'visible holes/edges and authoritative shot agree');
  if(angle===0&&!runtimeProbes.some(p=>p.wall===w.id&&p.clear===!visible))runtimeProbes.push({wall:w.id,clear:!visible,from:ray.ray.origin.toArray(),to:ray.ray.origin.clone().addScaledVector(dir,2).toArray()});
  if(!visible){misses++;continue}hits++;
  assert.equal(shot.coverWallId,w.id);assert.equal(shot.object,visible.object,'actual rendered object identity');assert.equal(shot.instanceId,visible.instanceId,'actual rendered instance identity');
  maxGap=Math.max(maxGap,shot.point.distanceTo(visible.point));assert.ok(maxGap<=.03,'unchanged <=3cm actual shot alignment gate');
  const event=combatEventFromIntersection(T,shot,dir),expected=combatEventFromIntersection(T,visible,dir);
  assert.equal(event.kind,'stone');maxNormalError=Math.max(maxNormalError,event.normal.distanceTo(expected.normal));assert.ok(maxNormalError<2e-4,'impact normal matches nonuniformly scaled render instance');
 }
}
assert.ok(hits>100&&misses>0,'test includes real stone hits and real silhouette misses');
scanned.setEnabled(false);assert.equal(scanned.group.visible,false);assert.ok(solids.every((s,i)=>s.raycast===original[i]),'fallback restores all original ray functions');
scanned.setEnabled(true);assert.ok(scanned.group.visible);
console.log(JSON.stringify({pass:true,source:'actual verified GLB geometry; no image material/GPU claim',assets:sources.map(s=>({id:s.id,sha256:s.sha256})),info:scanned.info(),rays,hits,misses,maxGap,maxNormalError,runtimeProbes,fallbackRestored:true,movementBoxDataUnchanged:true},null,2));
