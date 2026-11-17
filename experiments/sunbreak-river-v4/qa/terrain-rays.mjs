import * as T from '../../sunbreak-storm-v3/vendor/three/build/three.module.js';
import {installTerrainRaycast} from '../terrain-ray.js';
import {landscapeHeight,TERRAIN_GRID} from '../map-layout.js';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const geo=new T.PlaneGeometry(TERRAIN_GRID.size,TERRAIN_GRID.size,TERRAIN_GRID.segments,TERRAIN_GRID.segments);geo.rotateX(-Math.PI/2);const p=geo.attributes.position;
for(let i=0;i<p.count;i++)p.setY(i,landscapeHeight(p.getX(i),p.getZ(i)));geo.computeVertexNormals();
const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide})),reference=mesh.raycast,raycaster=new T.Raycaster();installTerrainRaycast(T,mesh,TERRAIN_GRID.size,TERRAIN_GRID.segments);const fast=mesh.raycast;
let seed=77;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const results=[];
for(const side of [T.FrontSide,T.DoubleSide,T.BackSide])for(const origin of [new T.Vector3(4.8000001,1.7,0),new T.Vector3(-4.8000001,1.7,0),new T.Vector3(4.5500001,1.7,0),new T.Vector3(-4.5500001,1.7,0),new T.Vector3(10,-1,0)]){
 mesh.material.side=side;raycaster.set(origin,new T.Vector3(0,origin.y<0?1:-1,0));raycaster.near=0;raycaster.far=140;
 const expected=[],actual=[];reference.call(mesh,raycaster,expected);fast.call(mesh,raycaster,actual);expected.sort((a,b)=>a.distance-b.distance);
 assert.equal(!!actual.length,!!expected.length,'boundary/side hit');if(actual.length)assert.ok(Math.abs(actual[0].distance-expected[0].distance)<1e-5);
 results.push({regression:'Float32 boundary and material side',side,origin:origin.toArray(),pass:true});
}
mesh.material.side=T.DoubleSide;
for(let i=0;i<160;i++){
 const origin=new T.Vector3((rand()-.5)*210,i%3===0?1.7:rand()*12,(rand()-.5)*210),dir=new T.Vector3(i%7===0?0:rand()-.5,-rand()*.8,i%5===0?0:rand()-.5).normalize();
 raycaster.set(origin,dir);raycaster.near=i%4===0?2:0;raycaster.far=i%3===0?40:140;
 const expected=[],actual=[];reference.call(mesh,raycaster,expected);fast.call(mesh,raycaster,actual);expected.sort((a,b)=>a.distance-b.distance);
 assert.equal(!!actual.length,!!expected.length,'hit mismatch '+i);if(actual.length)assert.ok(Math.abs(actual[0].distance-expected[0].distance)<1e-5,'distance mismatch '+i);
 results.push({i,hit:!!actual.length,distance:actual[0]?.distance});
}
const sources={};for(const name of ['map-layout.js','terrain-ray.js','qa/terrain-rays.mjs'])sources[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),pass:true,sources,method:'Exact DDA versus stock Three.js triangle raycast on rendered terrain topology',results};await writeFile(new URL('terrain-rays.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log({pass:true,rays:results.length});
