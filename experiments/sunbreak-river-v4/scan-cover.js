// Optional local-only reuse of the user's existing reference walls. No downloads.
// Movement AABBs stay authoritative. Shot/LOS rays use the real visible mesh.
import {isStoneCover} from './stone-cover.js';
export function buildScanCover({T,world,walls,solids,sources}){
 const required=['mossy-wall-a','mossy-wall-b'];
 if(!required.every(id=>sources?.some(s=>s.id===id)))return null;
 const covers=walls.filter(isStoneCover),group=new T.Group(),bindings=[],batches=[],resources=[];
 group.name='reference-scan-cover';group.visible=false;
 // No changes to active visuals or raycasts until every source/instance validates.
 try{
  for(const id of required){
   const source=sources.find(s=>s.id===id),meshes=[];source.scene.updateMatrixWorld(true);source.scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
   if(meshes.length!==1||Array.isArray(meshes[0].material))throw Error('Expected one opaque reference wall primitive');
   const node=meshes[0],geo=node.geometry.clone().applyMatrix4(node.matrixWorld);geo.computeBoundingBox();
   const size=geo.boundingBox.getSize(new T.Vector3()),centre=geo.boundingBox.getCenter(new T.Vector3());
   if(size.toArray().some((v,i)=>!Number.isFinite(v)||v<=0||Math.abs(v-source.dimensions[i])>.02))throw Error('Reference wall dimensions changed');
   geo.translate(-centre.x,-centre.y,-centre.z);geo.scale(1/size.x,1/size.y,1/size.z);geo.computeBoundingSphere();geo.computeBoundingBox();
   const mat=node.material.clone();mat.name='stone-reference-'+id;mat.metalness=0;mat.envMapIntensity=.5;mat.roughness=Math.max(.8,mat.roughness);mat.aoMapIntensity=.45;
   if(mat.transparent||mat.opacity!==1||mat.alphaTest>0)throw Error('Reference wall must be opaque');
   resources.push(geo,mat);
   const places=covers.filter(w=>w.id.startsWith('outer-')?id==='mossy-wall-b':id==='mossy-wall-a');
   const inst=new T.InstancedMesh(geo,mat,places.length);inst.name='stone-reference-'+id;inst.castShadow=inst.receiveShadow=true;
   inst.userData.scanCover=true;
   for(const [i,w]of places.entries()){
    const solid=solids.find(o=>o.userData.wall===w.id);if(!solid)throw Error('Missing original cover shot shell '+w.id);
    // Same mesh and scale on opposing banks; 180-degree paired rotation.
    const matrix=new T.Matrix4().compose(new T.Vector3(w.x,w.y,w.z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),w.x>0?Math.PI:0),new T.Vector3(w.w,w.h,w.d));
    inst.setMatrixAt(i,matrix);
    const proxy=new T.Mesh(geo,mat);proxy.name='stone-reference-hit-'+w.id;proxy.userData={wall:w.id,impactKind:'stone'};
    proxy.matrixAutoUpdate=false;proxy.matrix.copy(matrix);proxy.updateMatrixWorld(true);
    bindings.push({solid,original:solid.raycast,proxy,delegated(ray,hits){
     const found=[];proxy.raycast(ray,found);
     // Same unbaked geometry and instance transform: face/vertex normals remain
     // in render-local space. Preserve actual render identity for future decals.
     for(const hit of found){hit.object=inst;hit.instanceId=i;hit.coverWallId=w.id;hits.push(hit)}
    },id:w.id});
   }
   inst.computeBoundingSphere();group.add(inst);
   batches.push({id,instances:places.length,triangles:(geo.index?.count||geo.attributes.position.count)/3*places.length,sha256:source.sha256});
  }
  const triangles=batches.reduce((n,b)=>n+b.triangles,0);
  if(batches.length!==2||triangles>40000||bindings.length!==covers.length)throw Error('Reference cover budget/coverage failure');
  // The game builds this static map in identity world space. Fail closed if a
  // future caller adds a transformed world rather than silently misaligning rays.
  world.updateWorldMatrix(true,false);if(!world.matrixWorld.equals(new T.Matrix4()))throw Error('Reference cover requires static identity map root');
  world.add(group);let enabled=false;
  return{group,bindings,setEnabled(value){
   enabled=!!value;for(const b of bindings)b.solid.raycast=enabled?b.delegated:b.original;group.visible=enabled;
  },info:()=>({revision:'local-reference-scanned-cover-v1',enabled,covers:covers.length,drawCalls:2,triangles,addedTriangles:triangles-covers.length*12,replacedTriangles:covers.length*12,
   movementCollidersChanged:false,shotAndLOSColliders:'exact rendered scan geometry; old box raycast disabled',cosmeticProjection:false,localOnly:true,batches,
   limitations:['Movement retains the original broad AABB; irregular edges are not precision body collision.','Private models are not licensed for public redistribution; missing/local-off uses procedural fallback.','Geometry relief is real; no12mm restriction applies because shot/LOS use the same visible triangles.']})};
 }catch(e){for(const r of resources)r.dispose();throw e}
}
