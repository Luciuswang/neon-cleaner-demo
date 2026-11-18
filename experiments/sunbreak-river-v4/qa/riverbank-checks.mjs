// CPU-only, read-only QA. No server, browser, render process or report writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {MeshoptDecoder} from '../../sunbreak-storm-v3/vendor/presentation/examples/jsm/libs/meshopt_decoder.module.js';
import {MAP,crossings,vegetationAllowed,landscapeHeight,inBuffer,bounds,houses,spawns,teamSpawns,riverWidth} from '../map-layout.js';
import {RIVERBANK_LIMITS,riverbankPlan,riverStoneGeometry,populateRiverbankInstances,riverbankMaterialHook,footprintRadius,footprintGround,riverbankPlacementMatrix,riverDepositField,riverDepositPatches,riverSubstrateField,riverBedField} from '../riverbank-detail.js';
const root=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex');
let assertions=0;function check(v,message){assert.ok(v,message);assertions++}
const a=riverbankPlan(),b=riverbankPlan();assert.deepEqual(a,b);assertions++;
check(sha(JSON.stringify(a))!==sha(JSON.stringify(riverbankPlan(18112608))),'different seeds must vary placements');
let maxVertexProtrusion=-Infinity,visibleStoneVertices=0,stoneVertices=0,actualSubmergedStones=0,actualExposedStones=0;
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
  for(const s of [...spawns,...teamSpawns])check(Math.hypot(p.x-s[0],p.z-s[2])>=2+r,'full spawn footprint clearance');
  check(!inBuffer(p.x,p.z,r+1),'cabin routes');
  for(const h of houses)check(!(Math.abs(p.x-h.x)<4.8+r&&Math.abs(p.z-h.z)<5.3+r),'house footprint');
  for(const w of bounds)check(!(p.x>w.min.x-r-.35&&p.x<w.max.x+r+.35&&p.z>w.min.z-r-.35&&p.z<w.max.z+r+.35),'cover wall footprint');
  for(const lane of [10+.32*Math.sin(p.z*.19),11.2+.6*Math.sin(p.z*.15)])check(Math.abs(Math.abs(p.x)-lane)>=1.65+r,'long dirt lane');
  if(kind==='grass'){
   check(p.height<=.18,'short grounded grass');
   for(const x of [-r,0,r])for(const z of [-r,0,r])check(vegetationAllowed(p.x+x,p.z+z),'grass full footprint vegetationAllowed');
  }else{
   check(p.y<landscapeHeight(p.x,p.z),'sloped stone center root embedded');check(p.protrusion<=RIVERBANK_LIMITS.maxProtrusion,'stone protrusion budget');
   check(riverBedField(p.x,p.z)>=.13,'modeled stone bound to shared scanned deposit or underwater substrate');
   check(p.deposit===-1?riverSubstrateField(p.x,p.z)>=.13:a.patches.some(d=>d.id===p.deposit),'stone deposit/substrate origin recorded');
   const matrix=riverbankPlacementMatrix(T,p);
   for(const x of [-.5,0,.5])for(const z of [-.5,0,.5]){const v=new T.Vector3(x,0,z).applyMatrix4(matrix);check(v.y<landscapeHeight(v.x,v.z),'whole sloped bottom footprint embedded')}
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
  const matrix=riverbankPlacementMatrix(T,p);let top=-Infinity,visible=false;
  for(let i=0;i<pos.count;i++){
   const {x,y,z}=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(matrix);top=Math.max(top,y);
   if(kind==='outcrops')check(x<MAP.minX||x>MAP.maxX||z<MAP.minZ||z>MAP.maxZ,'actual outcrop vertices outside map');
   else{const height=y-landscapeHeight(x,z);maxVertexProtrusion=Math.max(maxVertexProtrusion,height);stoneVertices++;if(height>0){visibleStoneVertices++;visible=true}check(height<=.0651,'actual stone vertices never protrude >6.5cm')}
  }
  if(kind!=='outcrops'){
   check(visible,'every placed stone has actual above-ground geometry');
   if(top<MAP.waterY-.018)actualSubmergedStones++;else if(top>MAP.waterY+.015)actualExposedStones++;
   if(p.submerged)check(top<MAP.waterY-.018,'submerged classification actual geometry');
   // Also sample triangle interiors: a ground saddle can hide between vertices.
   const q=new T.Vector3(),v=new T.Vector3();
   for(let i=0;i<geo.index.count;i+=3){q.set(0,0,0);for(let j=0;j<3;j++)q.add(v.fromBufferAttribute(pos,geo.index.getX(i+j)));q.multiplyScalar(1/3).applyMatrix4(matrix);check(q.y-landscapeHeight(q.x,q.z)<=.0651,'actual triangle center support mismatch <=6.5cm')}
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
check(instances===3592,'actual instance total');
check(actualSubmergedStones>900&&actualExposedStones>500,'both actual submerged and exposed deposit clusters');
check(visibleStoneVertices/stoneVertices>.36,'sculpted shoulders visible instead of only flattened caps');
check(a.grassIslands.length===7,'few shore grass islands instead of even scattering');
for(const p of a.grass){const island=a.grassIslands[p.island];check(!!island&&Math.hypot((p.x-island.x)/island.rx,(p.z-island.z)/island.rz)<=1.00001,'grass lies in its bounded clump')}
let fieldSamples=0,fieldEmpty=0,fieldDense=0;const bankBins=[];
for(const side of [-1,1])for(let z=-33;z<=25;z+=.5){
 let occupied=0;
 for(const offset of [.1,.5,.9,1.3,1.7,2.1]){const f=riverDepositField(side*(riverWidth(z)+offset),z);fieldSamples++;if(f<.03)fieldEmpty++;if(f>.65)fieldDense++;if(f>.12)occupied++}
 bankBins.push(occupied);
}
check(fieldEmpty/fieldSamples>.45,'more than 45 percent open bank field prevents continuous gravel berm');
check(fieldDense/fieldSamples>.06,'dense deposits retained instead of making everything sparse');
check(bankBins.filter(n=>n===0).length>bankBins.length*.4,'complete lateral mud breaks, not only noisy edges');
check(riverDepositPatches().some(p=>p.submerged),'explicit inner-channel deposit tongues');
// New regression: a broken shoreline must not delete nearly all submerged
// pebble substrate, nor turn it back into an uninterrupted specular sheet.
let underwaterSamples=0,underwaterCovered=0,underwaterMud=0;
for(let z=MAP.minZ+1;z<MAP.maxZ-1;z+=.5)for(let x=-5;x<=5;x+=.25){
 if(landscapeHeight(x,z)>MAP.waterY-.06)continue;
 const field=riverBedField(x,z);underwaterSamples++;if(field>.6)underwaterCovered++;if(field<.08)underwaterMud++;
}
check(underwaterCovered/underwaterSamples>.55,'broad scanned underwater substrate, not isolated ovals');
check(underwaterMud/underwaterSamples>.05,'actual mud pockets retained between underwater gravel');
const stones=[...a.micro,...a.cobbles],substrateStones=stones.filter(p=>p.deposit===-1).length;
check(substrateStones>800,'real geometry linking deposits across underwater substrate');
check(a.micro.filter(p=>p.width<.045).length>650,'numerous fine modeled gravel, not only same-size cobbles');
check(a.cobbles.filter(p=>p.width>.28).length>70,'occasional broad embedded stone shoulders');
const foregroundStones=stones.filter(p=>p.x< -1.6&&p.x> -6&&p.z>6&&p.z<12.3).length;
check(foregroundStones>150,'reference-close foreground has actual geometry, not only a texture');
for(const bed of [false,true]){
 const material=new T.MeshStandardMaterial();riverbankMaterialHook(material,{bed});
 const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};material.onBeforeCompile(shader);
 check(shader.vertexShader.includes('bankLocal=instanceMatrix*bankLocal'),'wetness uses instanced world position');
 check(shader.fragmentShader.indexOf('float bankWet=')<shader.fragmentShader.indexOf('bankWet*.74'),'wetness in scope before roughness');
 if(bed)check(shader.fragmentShader.includes('float brokenEdge=')&&shader.fragmentShader.includes('diffuseColor.a*=fade'),'broken bank fade');
 if(bed){check(shader.fragmentShader.includes('bankDepositField(vBankWorld.xz)'),'bed uses placement deposit field');check(shader.fragmentShader.includes('bankSubstrateField(vBankWorld)'),'underwater scanned substrate restored');check(shader.uniforms.uBankDeposits.value.length===riverDepositPatches().length*4,'all CPU deposits bound to GPU');check(!shader.fragmentShader.includes('float bankWidth='),'no continuous width-based berm mask');check(material.envMapIntensity<=.25,'bed reflection does not duplicate water highlight');check(shader.fragmentShader.includes('max(roughnessFactor,.84)')&&shader.fragmentShader.includes(',.72,.98)'),'bed roughness hard minimum .72, dry >=.8')}
 else{check(shader.vertexShader.includes('bankNormal*objectNormal'),'sculpt/shear normals corrected');for(const role of ['vMapUv','vNormalMapUv','vRoughnessMapUv','vAoMapUv'])check(shader.vertexShader.includes(role+'='+role+'*mineralScale+mineralOffset'),'physical scan crop aligned '+role)}
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
console.log(JSON.stringify({verdict:'CPU INVARIANTS PASS — NOT GPU/ART/PERFORMANCE ACCEPTANCE',assertions,counts:Object.fromEntries(['micro','cobbles','grass','outcrops','patches','grassIslands'].map(k=>[k,a[k].length])),actualTriangles,actualDraws,actualShadowTriangles,actualShadowDraws,instances,previous850StoneTriangles:previousTriangles,incrementalTriangles:actualTriangles-previousTriangles,incrementalDraws:actualDraws-1,maxVertexProtrusion,aboveGroundStoneVertexFraction:visibleStoneVertices/stoneVertices,actualSubmergedStones,actualExposedStones,openBankFieldFraction:fieldEmpty/fieldSamples,denseBankFieldFraction:fieldDense/fieldSamples,underwaterGravelCoverage:underwaterCovered/underwaterSamples,underwaterMudPockets:underwaterMud/underwaterSamples,substrateStones,foregroundStones,sourceFiles,publicFiles,publicBytes:manifest.totalPublicBytes,placementSHA256:sha(JSON.stringify(a)),runtimeManifestNote:'afterrain-assets.json runtime block belongs to prior slice; main must refresh source binding/budgets. Asset file hashes unchanged.',limits:'No server/browser/render process run. Shader hooks checked structurally only; native-headless GPU compilation/art/perf and movement QA owned by main.'},null,2));
