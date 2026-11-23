// Independent geometry and gameplay-scope evidence. Run from any checkout.
import assert from 'node:assert/strict';
import * as T from '../../../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {buildDistantLandscape,LANDSCAPE_LIMITS} from '../../../distant-landscape.js';
import {riverbankPlan,footprintRadius} from '../../../riverbank-detail.js';
import {MAP} from '../../../map-layout.js';
const mats={stone:new T.MeshStandardMaterial(),bark:new T.MeshStandardMaterial()};
const textures=['map','normalMap','roughnessMap'];for(const m of Object.values(mats))for(const key of textures)m[key]=new T.Texture();
const a=buildDistantLandscape({T,world:new T.Group(),materials:mats,forested:false});
const b=buildDistantLandscape({T,world:new T.Group(),materials:mats,forested:true});
const old=a.info(),current=b.info();assert.equal(old.triangles,79360);assert.equal(current.drawCalls,old.drawCalls);
assert.ok(current.triangles>old.triangles&&current.triangles<=LANDSCAPE_LIMITS.maxTriangles);assert.equal(current.colliders,0);
for(let i=0;i<a.root.children.length;i++){
 const x=a.root.children[i].geometry,y=b.root.children[i].geometry;
 for(const k of ['position','normal','color','uv'])assert.deepEqual(y.attributes[k].array.subarray(0,x.attributes[k].array.length),x.attributes[k].array,k);
 assert.deepEqual(Array.from(y.index.array.slice(0,x.index.count)),Array.from(x.index.array));
 const pos=y.attributes.position;
 for(let j=x.attributes.position.count;j<pos.count;j++){
  const px=pos.getX(j),py=pos.getY(j),pz=pos.getZ(j);
  assert.ok(Number.isFinite(px+py+pz));
  assert.ok(Math.abs(px)>=LANDSCAPE_LIMITS.terrainHalfExtent||Math.abs(pz)>=LANDSCAPE_LIMITS.terrainHalfExtent);
 }
}
const ledges=riverbankPlan().ledges;assert.ok(ledges.length>20);
for(const p of ledges){const r=footprintRadius(p);assert.ok(p.x+r<MAP.minX||p.x-r>MAP.maxX||p.z+r<MAP.minZ||p.z-r>MAP.maxZ);}
console.log(JSON.stringify({pass:true,base:old.triangles,forested:current.triangles,ridgeDraws:current.drawCalls,ledges:ledges.length,proof:'bare positions/normals/colors/UV/index prefix preserved exactly; additional vertices outside playable terrain; rock footprints outside play bounds'}));a.dispose();b.dispose();
