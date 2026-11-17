import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Fixed-layout architectural contract. Material edits are free; geometry edits
// on structural parts must go through a reviewed collision update, not just GLB.
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
function meshPoints(T,mesh,inverse){
 const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),p=mesh.geometry.attributes.position,v=new T.Vector3(),unique=new Set();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);unique.add([v.x,v.y,v.z].map(x=>Math.round(x*1000)).join(','))}
 return [...unique].sort().join(';');
}
function exactPoints(T,mesh,inverse){
 const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),p=mesh.geometry.attributes.position,v=new T.Vector3(),unique=new Map();
 for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);unique.set(v.toArray().map(x=>Math.round(x*1e6)).join(','),v.toArray())}
 return [...unique.values()];
}
function samePointCloud(a,b,tolerance){
 // Indices/hard-normal/UV seam splits may legitimately change in Blender.
 // Compare geometry bidirectionally with a real distance tolerance, not rounding
 // hashes: points on a half-millimetre boundary otherwise spuriously disagree.
 const near=(p,q)=>p.every((x,i)=>Math.abs(x-q[i])<=tolerance);
 return a.every(p=>b.some(q=>near(p,q)))&&b.every(p=>a.some(q=>near(p,q)));
}
async function surfaceSignature(T,mesh,inverse,reference,tolerance){
 const matrix=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),p=mesh.geometry.attributes.position,v=new T.Vector3(),ids=[];
 for(let i=0;i<p.count;i++){
  const q=v.fromBufferAttribute(p,i).applyMatrix4(matrix).toArray();let best=-1,distance=Infinity;
  reference.forEach((r,id)=>{const d=q.reduce((s,x,j)=>s+(x-r[j])**2,0);if(q.every((x,j)=>Math.abs(x-r[j])<=tolerance)&&d<distance){distance=d;best=id}});
  if(best<0)throw Error('Structural surface vertex changed: '+mesh.name);ids.push(best);
 }
 const index=mesh.geometry.index,count=index?.count??p.count,triangles=[];
 if(count%3)throw Error('Incomplete triangle: '+mesh.name);
 const vertex=i=>{const n=index?index.getX(i):i;if(!Number.isInteger(n)||n<0||n>=ids.length)throw Error('Invalid triangle index: '+mesh.name);return ids[n]};
 for(let i=0;i<count;i+=3){
  const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
  // Cyclic rotations preserve winding; sorted vertex triples would miss
  // accidentally inverted faces. UV/hard-normal seam splits remain legal.
  triangles.push([[a,b,c],[b,c,a],[c,a,b]].map(t=>t.join(',')).sort()[0]);
 }
 return{triangleCount:triangles.length,surfaceSha256:await digest(triangles.sort().join(';'))};
}
function meshBounds(T,mesh,inverse){
 const b=new T.Box3(),p=mesh.geometry.attributes.position,v=new T.Vector3(),m=new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
 for(let i=0;i<p.count;i++)b.expandByPoint(v.fromBufferAttribute(p,i).applyMatrix4(m));
 return[...b.min.toArray(),...b.max.toArray()];
}
function geometryRoot(scene){return scene.getObjectByName('CabinAsset')}
export async function makeHouseContract(T,scene,dimensions){
 scene.updateWorldMatrix(true,true);const root=geometryRoot(scene);if(!root)throw Error('Missing CabinAsset');
 const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),meshes=[];
 root.traverse(o=>{if(o.isMesh)meshes.push(o)});
 const records=[];
 for(const mesh of meshes){
  if(!mesh.name||records.some(r=>r.name===mesh.name))throw Error('Export requires unique part names');
  const positions=exactPoints(T,mesh,inverse),cosmeticEditable=mesh.userData.cosmeticEditable===true;
  records.push({name:mesh.name,inDoor:!!root.getObjectByName('DoorPivot').getObjectByName(mesh.name),cosmeticEditable,
   bounds:meshBounds(T,mesh,inverse),points:await digest(meshPoints(T,mesh,inverse)),positions,
   ...(!cosmeticEditable?await surfaceSignature(T,mesh,inverse,positions,.00002):{})});
 }
 const pivot=root.getObjectByName('DoorPivot');
 return{schema:'sunbreak-house-fixed-layout-v1',units:'metres',upAxis:'+Y',forward:'+Z porch',localOrigin:[0,0,0],
  worldOrigin:[dimensions.x,0,dimensions.z],dimensions:{...dimensions},doorPivot:pivot.position.toArray(),
  geometryToleranceMetres:.00002,cosmeticBoundsToleranceMetres:.012,maximumTriangles:500000,
  rule:'All named parts required. Structural point clouds and oriented triangle surfaces must match within 20 micrometres, independent of indexing/seam splits. Missing, degenerate or reversed faces are rejected. Only DoorHandlePlate/Grip geometry may change within 12mm of their original bounds; material/UV edits allowed. Architecture/door/stair changes require a separate reviewed collision contract.',
  lighting:'Four runtime point lights retained once; exported fixture meshes and LightAnchor nodes are not duplicate game lights.',
  collision:'Original house-logic.js floor/door and authored movement AABBs remain authoritative. This is a cosmetic fixed-layout roundtrip, not general collision regeneration.',
  records};
}

export async function validateHouseAsset(T,scene,contract){
 if(contract.schema!=='sunbreak-house-fixed-layout-v1')throw Error('Unknown house contract');
 scene.updateWorldMatrix(true,true);const root=geometryRoot(scene);
 if(!root)throw Error('Missing CabinAsset; preserve the root name');
 if(root.position.length()>1e-5||root.scale.toArray().some(v=>Math.abs(v-1)>1e-6)||root.quaternion.toArray().some((v,i)=>Math.abs(v-[0,0,0,1][i])>1e-6))throw Error('CabinAsset must retain its identity transform');
 const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),pivot=root.getObjectByName('DoorPivot');
 if(!pivot||pivot.parent!==root)throw Error('DoorPivot must remain a direct child of CabinAsset');
 if(pivot.position.toArray().some((v,i)=>Math.abs(v-contract.doorPivot[i])>1e-5)||pivot.scale.toArray().some(v=>Math.abs(v-1)>1e-6)||pivot.quaternion.toArray().some((v,i)=>Math.abs(v-[0,0,0,1][i])>1e-6))throw Error('Door pivot transform changed');
 const byName=new Map();let triangles=0,lights=0;
 root.traverse(o=>{
  if(o.isLight)lights++;
  if(o.isMesh){
   if(byName.has(o.name))throw Error('Duplicate house part: '+o.name);
   byName.set(o.name,o);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
  }
 });
 if(lights||byName.size!==contract.records.length||triangles>contract.maximumTriangles)throw Error('Unexpected house mesh/light count or triangle budget');
 for(const record of contract.records){
  const mesh=byName.get(record.name);if(!mesh)throw Error('Missing house part: '+record.name);
  if(!mesh.geometry.attributes.uv||!mesh.geometry.attributes.normal)throw Error('Missing UV/normal: '+mesh.name);
  for(const a of Object.values(mesh.geometry.attributes))for(const v of a.array)if(!Number.isFinite(v))throw Error('Non-finite house vertex data');
  const inDoor=!!pivot.getObjectByName(mesh.name);
  // Door frame parts are static, so test membership recorded in the package.
  if(record.inDoor!==undefined&&inDoor!==record.inDoor)throw Error('Door membership changed: '+mesh.name);
  if(record.cosmeticEditable){
   const b=meshBounds(T,mesh,inverse),t=contract.cosmeticBoundsToleranceMetres;
   if(b.slice(0,3).some((x,i)=>x<record.bounds[i]-t)||b.slice(3).some((x,i)=>x>record.bounds[i+3]+t))throw Error('Cosmetic edit escaped bounds: '+mesh.name);
  }else{
   if(!samePointCloud(exactPoints(T,mesh,inverse),record.positions,contract.geometryToleranceMetres))throw Error('Structural geometry changed: '+mesh.name+'; review collision before importing');
   const surface=await surfaceSignature(T,mesh,inverse,record.positions,contract.geometryToleranceMetres);
   if(!record.surfaceSha256||surface.surfaceSha256!==record.surfaceSha256||surface.triangleCount!==record.triangleCount)throw Error('Structural triangle surface changed: '+mesh.name+'; missing, degenerate or reversed faces are not cosmetic');
  }
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(materials.some(m=>!m?.isMeshStandardMaterial||m.isShaderMaterial))throw Error('Use glTF metallic/roughness PBR materials');
 }
 return{validated:true,meshes:byName.size,triangles,lightsInAsset:lights,doorPivot:pivot.position.toArray(),contract:contract.schema};
}

export async function installHouseAsset({T,house,url='./assets/house/timber-house-edited.glb',contractURL='./assets/house/house-contract.json'}){
 const response=await fetch(contractURL);if(!response.ok)throw Error('House contract HTTP '+response.status);
 const contract=await response.json(),gltf=await new GLTFLoader().loadAsync(url);
 return applyHouseAsset({T,house,scene:gltf.scene,contract,url});
}

export async function applyHouseAsset({T,house,scene,contract,url='test-loaded-asset',merge=mergeGeometries}){
 const proof=await validateHouseAsset(T,scene,contract),asset=geometryRoot(scene),loadedPivot=asset.getObjectByName('DoorPivot'),{root,pivot}=house.qa;
 // Prepare only the candidate, detached from the live root and door. A loader,
 // validation or batching error must leave the original world fully intact.
 loadedPivot.removeFromParent();
 // Batch imported static surfaces after validation. Artist file stays semantic.
 const opaque=new Map(),remove=[];
 asset.updateWorldMatrix(true,true);
 const inverse=new T.Matrix4().copy(asset.matrixWorld).invert();
 asset.traverse(o=>{
  if(!o.isMesh)return;o.castShadow=o.receiveShadow=true;
  const list=Array.isArray(o.material)?o.material:[o.material];
  for(const m of list){m.envMapIntensity=.42;for(const t of Object.values(m))if(t?.isTexture)t.anisotropy=8}
  if(Array.isArray(o.material)||o.material.transparent)return;
  const g=o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
  if(!opaque.has(o.material))opaque.set(o.material,[]);opaque.get(o.material).push(g.index?g.toNonIndexed():g);remove.push(o);
 });
 let batches=0;
 try{
  for(const [material,geometries]of opaque){
   const g=merge(geometries,false);if(!g)throw Error('House batching attributes mismatch');
   const mesh=new T.Mesh(g,material);mesh.name='RuntimeBatch_'+material.name;mesh.castShadow=mesh.receiveShadow=true;asset.add(mesh);batches++;
  }
 }finally{
  for(const geometries of opaque.values())geometries.forEach(g=>g.dispose());
 }
 for(const o of remove)o.removeFromParent();
 // Commit synchronously only after the candidate is fully ready. Preserve the
 // existing physics/LOS/input references and four game-owned practical lights.
 for(const child of root.children.slice())if(child!==pivot&&!child.isLight)root.remove(child);
 for(const child of pivot.children.slice())pivot.remove(child);
 for(const child of loadedPivot.children.slice())pivot.add(child);
 root.add(asset);root.updateWorldMatrix(true,true);
 Object.assign(house.qa.asset,{...proof,mode:'imported-glb',url,staticBatches:batches,roundtrip:'Blender edited derivative; source authoring GLB retained'});
 return{...house.qa.asset};
}
