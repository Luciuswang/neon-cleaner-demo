// CPU-only, read-only QA. No server, browser, render process or report writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {MeshoptDecoder} from '../../sunbreak-storm-v3/vendor/presentation/examples/jsm/libs/meshopt_decoder.module.js';
import {MAP,crossings,vegetationAllowed,landscapeHeight,inBuffer,bounds,houses} from '../map-layout.js';
import {RIVERBANK_LIMITS,riverbankPlan,riverStoneGeometry,populateRiverbankInstances,riverbankMaterialHook,footprintRadius,footprintGround} from '../riverbank-detail.js';
const root=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
let assertions=0;function check(v,message){assert.ok(v,message);assertions++}
const a=riverbankPlan(),b=riverbankPlan();assert.deepEqual(a,b);assertions++;
check(sha(JSON.stringify(a))!==sha(JSON.stringify(riverbankPlan(18112608))),'different seeds must vary placements');
let maxVertexProtrusion=-Infinity,visibleStoneVertices=0,stoneVertices=0;
for(const kind of ['micro','cobbles','grass','outcrops']){
 check(a[kind].length===RIVERBANK_LIMITS[kind],kind+' count');
 for(const p of a[kind]){
  for(const k of ['x','y','z','yaw','width','height','depth','tone'])check(Number.isFinite(p[k]),`${kind} finite ${k}`);
  check(p.width>0&&p.height>0&&p.depth>0,kind+' positive scale');
  check(Math.abs(p.x)<20&&p.z>-64&&p.z<60,kind+' overall bounds');
  const r=footprintRadius(p);
  if(kind==='outcrops'){
   check(p.x+r<MAP.minX-1||p.x-r>MAP.maxX+1||p.z+r<MAP.minZ-1||p.z-r>MAP.maxZ+1,'whole outcrop outside playable rectangle');
   check(p.y<footprintGround(p).low,'outcrop embedded');continue;
  }
  for(const c of crossings)check(Math.abs(p.z-c)>=2.7+r,'full crossing footprint clearance');
  check(!inBuffer(p.x,p.z,r+1),'cabin routes');
  for(const h of houses)check(!(Math.abs(p.x-h.x)<4.8+r&&Math.abs(p.z-h.z)<5.3+r),'house footprint');
  for(const w of bounds)check(!(p.x>w.min.x-r-.35&&p.x<w.max.x+r+.35&&p.z>w.min.z-r-.35&&p.z<w.max.z+r+.35),'cover wall footprint');
  for(const lane of [10+.32*Math.sin(p.z*.19),11.2+.6*Math.sin(p.z*.15)])check(Math.abs(Math.abs(p.x)-lane)>=1.65+r,'long dirt lane');
  if(kind==='grass'){
   check(p.height<=.18,'short grounded grass');
   for(const x of [-r,0,r])for(const z of [-r,0,r])check(vegetationAllowed(p.x+x,p.z+z),'grass full footprint vegetationAllowed');
  }else{
   check(p.y<footprintGround(p).low,'stone root embedded');check(p.protrusion<=RIVERBANK_LIMITS.maxProtrusion,'stone protrusion budget');
  }
 }
}
// Decode the real reused asset. Test actual source transforms, counts, winding
// and bounded normalization instead of a fabricated grass geometry fixture.
await MeshoptDecoder.ready;
const grassBytes=await readFile(new URL('assets/foliage-revision/grass_bermuda_01.glb',root));
const jsonLength=grassBytes.readUInt32LE(12),gltf=JSON.parse(grassBytes.subarray(20,20+jsonLength).toString()),binOffset=20+jsonLength+8,bin=grassBytes.subarray(binOffset),decoded=new Map();
function view(id){
 if(decoded.has(id))return decoded.get(id);
 const v=gltf.bufferViews[id],e=v.extensions?.EXT_meshopt_compression;let bytes;
 if(e){bytes=new Uint8Array(e.count*e.byteStride);MeshoptDecoder.decodeGltfBuffer(bytes,e.count,e.byteStride,bin.subarray(e.byteOffset||0,(e.byteOffset||0)+e.byteLength),e.mode,e.filter)}
 else bytes=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
 decoded.set(id,bytes);return bytes;
}
function accessor(id){
 const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],bytes=view(a.bufferView),n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],width={5126:4,5125:4,5123:2,5121:1}[a.componentType],stride=v.byteStride||n*width;
 const out=a.componentType===5126?new Float32Array(a.count*n):new Uint32Array(a.count*n),data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const read={5126:'getFloat32',5125:'getUint32',5123:'getUint16',5121:'getUint8'}[a.componentType];
 for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)out[i*n+j]=data[read]((a.byteOffset||0)+i*stride+j*width,true);
 return new T.BufferAttribute(out,n,!!a.normalized);
}
const scene=new T.Group(),grassSources=[];
for(const suffix of ['small_a','small_b']){
 const node=gltf.nodes.find(n=>n.name==='grass_bermuda_01_'+suffix);check(!!node,'real grass node found');
 const primitive=gltf.meshes[node.mesh].primitives[0],geo=new T.BufferGeometry();
 for(const [key,attribute]of Object.entries({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}))geo.setAttribute(attribute,accessor(primitive.attributes[key]));
 geo.setIndex(accessor(primitive.indices));const mesh=new T.Mesh(geo,new T.MeshStandardMaterial());mesh.name=node.name;
 if(node.matrix)mesh.applyMatrix4(new T.Matrix4().fromArray(node.matrix));else{if(node.translation)mesh.position.fromArray(node.translation);if(node.rotation)mesh.quaternion.fromArray(node.rotation);if(node.scale)mesh.scale.fromArray(node.scale)}
 scene.add(mesh);grassSources.push(mesh);
 const pos=geo.attributes.position,norm=geo.attributes.normal,index=geo.index,va=new T.Vector3(),vb=new T.Vector3(),vc=new T.Vector3(),face=new T.Vector3(),avg=new T.Vector3();
 for(let i=0;i<index.count;i+=3){
  const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];va.fromBufferAttribute(pos,ids[0]);vb.fromBufferAttribute(pos,ids[1]);vc.fromBufferAttribute(pos,ids[2]);face.crossVectors(vb.sub(va),vc.sub(va));avg.set(0,0,0);
  for(const id of ids)avg.add(new T.Vector3().fromBufferAttribute(norm,id));check(face.dot(avg)>0,'source grass winding faces match normals');
 }
}
scene.updateMatrixWorld(true);
for(const kind of ['micro','cobbles','outcrops'])for(let variant=0;variant<(kind==='outcrops'?1:2);variant++){
 const geo=riverStoneGeometry(T,kind,variant),pos=geo.attributes.position,norm=geo.attributes.normal;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),n=new T.Vector3().fromBufferAttribute(norm,i);
  check(Number.isFinite(n.length())&&Math.abs(n.length()-1)<1e-5,'unit smooth stone normal');
  check(x>=-.50001&&x<=.50001&&y>=-.00001&&y<=1.00001&&z>=-.50001&&z<=.50001,'unit stone bounds');
  check(n.dot(new T.Vector3(x,y-.5,z))>0,'outward stone normal');
 }
 for(const p of a[kind].filter(p=>p.variant===variant)){
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  for(let i=0;i<pos.count;i++){
   const x=p.x+c*pos.getX(i)*p.width+s*pos.getZ(i)*p.depth,z=p.z-s*pos.getX(i)*p.width+c*pos.getZ(i)*p.depth,y=p.y+pos.getY(i)*p.height;
   if(kind==='outcrops')check(x<MAP.minX||x>MAP.maxX||z<MAP.minZ||z>MAP.maxZ,'actual outcrop vertices outside map');
   else{const height=y-landscapeHeight(x,z);maxVertexProtrusion=Math.max(maxVertexProtrusion,height);stoneVertices++;if(height>0)visibleStoneVertices++;check(height<=.0651,'actual stone vertices never protrude >6.5cm')}
  }
 }
 geo.dispose();
}
const world=new T.Group(),stoneMaterial=new T.MeshStandardMaterial(),{group,batches}=populateRiverbankInstances({T,world,plan:a,stoneMaterial,grassSources});
let actualTriangles=0,actualDraws=0,actualShadowTriangles=0,actualShadowDraws=0,instances=0;
for(const mesh of group.children){
 check(mesh.isInstancedMesh,'only bounded instance batches');check(mesh.material instanceof T.MeshStandardMaterial,'standard physical lighting response');
 const triangles=mesh.geometry.index.count/3*mesh.count;actualTriangles+=triangles;actualDraws++;instances+=mesh.count;
 if(mesh.castShadow){actualShadowTriangles+=triangles;actualShadowDraws++;check(mesh.name.includes('outcrops'),'tiny stones/grass must not cast extra shadows')}
 check(Number.isFinite(mesh.boundingSphere.radius)&&mesh.boundingSphere.radius>0,'valid instance culling bound');
 for(const n of mesh.instanceMatrix.array)check(Number.isFinite(n),'finite instance transform');
 if(mesh.name.includes('grass')){check(mesh.material.alphaTest===.35&&!mesh.material.transparent&&mesh.material.side===T.DoubleSide,'correct alpha cutout settings');check(mesh.geometry.attributes.uv.count===mesh.geometry.attributes.position.count,'source UV retained')}
}
check(actualTriangles===batches.reduce((s,b)=>s+b.triangles,0),'reported triangles are actual');
check(actualTriangles<=200000&&actualDraws<=28,'bounded geometry/draw budget');
check(instances===3730,'actual instance total');
for(const bed of [false,true]){
 const material=new T.MeshStandardMaterial();riverbankMaterialHook(material,{bed});
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
 check(shader.vertexShader.includes('bankLocal=instanceMatrix*bankLocal'),'wetness uses instanced world position');
 check(shader.fragmentShader.indexOf('float bankWet=')<shader.fragmentShader.indexOf('bankWet*.74'),'wetness in scope before roughness');
 if(bed)check(shader.fragmentShader.includes('float brokenEdge=')&&shader.fragmentShader.includes('diffuseColor.a*=fade'),'broken bank fade');
 check(shader.vertexShader.includes('#include <project_vertex>'),'standard projection preserved');
}
const manifest=JSON.parse(await readFile(new URL('afterrain-assets.json',root),'utf8'));let sourceFiles=0,publicFiles=0;
for(const asset of manifest.assets){
 check(asset.license==='CC0-1.0'&&asset.source.startsWith('https://polyhaven.com/a/'),'official source license');
 const official=JSON.parse(await readFile(new URL(`assets/afterrain-detail/source/${asset.id}/official-files.json`,root),'utf8'));
 for(const source of asset.sourceFiles){
  const data=await readFile(new URL(source.path,root));check(data.length===source.bytes&&sha(data)===source.sha256,'source SHA/size');check(createHash('md5').update(data).digest('hex')===source.officialMD5,'official MD5');
  check(JSON.stringify(official).includes(source.officialMD5)&&JSON.stringify(official).includes(source.url),'MD5 anchored in official API snapshot');sourceFiles++;
 }
 for(const file of asset.files){const data=await readFile(new URL(file.path,root));check(data.length===file.bytes&&sha(data)===file.sha256,'derivative SHA/size');check(manifest.publicWhitelist.includes(file.path),'public whitelist');publicFiles++}
}
check(manifest.publicWhitelist.every(p=>p.startsWith('assets/afterrain-detail/')&&!p.includes('/source/')),'no original/API snapshots published');
check(manifest.dependencies.some(d=>d.sha256===sha(grassBytes)&&d.path.endsWith('/grass_bermuda_01.glb')),'grass provenance binding');
const previousTriangles=new T.IcosahedronGeometry(1,2).attributes.position.count/3*850;
console.log(JSON.stringify({verdict:'CPU INVARIANTS PASS — NOT GPU/ART/PERFORMANCE ACCEPTANCE',assertions,counts:Object.fromEntries(['micro','cobbles','grass','outcrops','patches'].map(k=>[k,a[k].length])),actualTriangles,actualDraws,actualShadowTriangles,actualShadowDraws,instances,previous850StoneTriangles:previousTriangles,incrementalTriangles:actualTriangles-previousTriangles,incrementalDraws:actualDraws-1,maxVertexProtrusion,aboveGroundStoneVertexFraction:visibleStoneVertices/stoneVertices,sourceFiles,publicFiles,publicBytes:manifest.totalPublicBytes,placementSHA256:sha(JSON.stringify(a)),limits:'No server/browser/render process run. Shader hooks checked structurally only; native-headless GPU compilation/art/perf and movement QA owned by main.'},null,2));
