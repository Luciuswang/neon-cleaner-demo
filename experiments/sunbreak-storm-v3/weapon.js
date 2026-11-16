import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

// Rotuma MP5 + credited first-person arms, CC BY 4.0. See weapon-provenance.json
// and assets/mp5/NOTICE.md. No upstream weapon, recoil or animation code used.
// The baseline owns its gun parent, muzzle light, aim/fire/reload and all damage.
export async function buildWeapon({THREE:T,gun,gscene}){
 const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
 const gltf=await loader.loadAsync('./assets/mp5/mp5a5.glb');
 const root=gltf.scene;root.name='sunbreak-licensed-mp5-viewmodel';
 root.updateMatrixWorld(true);
 const muzzle=root.getObjectByName('MuzzleSocket');
 if(!muzzle)throw Error('MP5 source has no authored muzzle socket');
 const sourceMuzzle=root.worldToLocal(muzzle.getWorldPosition(new T.Vector3()));
 const sleeve=fitSleeveEnd(T,root);
 // A uniform display fit, not a geometry stretch. The original oversized
 // viewmodel framing is retained for the comparison. Exact muzzle coincidence.
 const displayScale=1.70,fit=new T.Group();fit.name='mp5-original-muzzle-fit';
 root.scale.setScalar(displayScale);
 fit.position.set(-sourceMuzzle.x*displayScale,.005-sourceMuzzle.y*displayScale,-1.85-sourceMuzzle.z*displayScale);
 fit.add(root);
 const owned=new Set(),maps=new Set();let meshes=0,triangles=0,skinned=0;
 root.traverse(o=>{
  if(!o.isMesh)return;
  // The unused zero-weight source arm shape key is not animated here. Drop it
  // so the baseline renderer does not allocate an extra UUID/morph texture.
  if(o.morphTargetInfluences?.every(v=>v===0)){o.geometry.morphAttributes={};delete o.morphTargetInfluences;delete o.morphTargetDictionary}
  meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
  if(o.isSkinnedMesh){skinned++;if(!o.skeleton.boneTexture)o.skeleton.computeBoneTexture()}
  o.frustumCulled=false;o.castShadow=false;o.receiveShadow=false;
  const list=Array.isArray(o.material)?o.material:[o.material];
  for(const m of list){
   owned.add(m);m.envMapIntensity=.28;
   if(m.normalScale)m.normalScale.set(.85,.85);
   if(m.name==='arms'){m.metalness=0;m.roughness=.83}
   else{m.roughness=Math.max(.48,m.roughness);m.metalness=Math.min(.9,m.metalness)}
   for(const v of Object.values(m))if(v?.isTexture){v.anisotropy=8;maps.add(v)}
  }
 });
 // Do not remove the old visuals until the actual source model has loaded.
 for(const child of gun.children.slice()){
  if(child.isLight)continue;
  const lights=[];child.traverse(o=>{if(o.isLight)lights.push(o)});lights.forEach(l=>gun.attach(l));
  gun.remove(child);
 }
 gun.add(fit);
 const magazine=root.getObjectByName('Magazine'),charging=root.getObjectByName('ChargingHandle');
 const magHome=magazine?.position.clone(),chargeHome=charging?.position.clone();
 const flashMaterial=new T.MeshBasicMaterial({color:0xffd59d,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 const flashMesh=new T.Mesh(new T.ConeGeometry(.045,.22,7,1,true),flashMaterial);
 flashMesh.rotation.x=-Math.PI/2;flashMesh.position.set(0,.005,-1.94);flashMesh.frustumCulled=false;gun.add(flashMesh);
 const baselineLight=gun.children.find(o=>o.isPointLight);
 let disposed=false,lastAim=0;
 return{
  update(dt,state){
   // Cosmetic movement only; original 1.2 s reload timer and parent animation
   // remain authoritative. Arms retain the source's authored grip pose.
   const phase=state.reload>0?Math.max(0,Math.min(1,(1.2-state.reload)/1.2)):0;
   if(magazine&&magHome){magazine.position.copy(magHome);if(phase>0)magazine.position.y-=Math.sin(phase*Math.PI)**3*.18}
   if(charging&&chargeHome){charging.position.copy(chargeHome);if(phase>.75)charging.position.z+=Math.sin((phase-.75)*4*Math.PI)*.055}
   flashMaterial.opacity=Math.min(.75,(baselineLight?.intensity||0)*.035);
   flashMesh.visible=flashMaterial.opacity>.015;lastAim=state.aim;
  },
  info(){root.updateWorldMatrix(true,true);const actual=gun.worldToLocal(muzzle.getWorldPosition(new T.Vector3()));return{loaded:true,asset:'Rotuma MP5 / gloved first-person arms',license:'CC-BY-4.0',meshes,triangles,skinnedMeshes:skinned,sleeve,textureMaps:maps.size,uniformDisplayScale:displayScale,sourceMuzzle:sourceMuzzle.toArray(),fittedMuzzle:actual.toArray(),aim:lastAim,animation:'baseline root recoil/reload + cosmetic magazine/handle; source held pose baked with rear sleeve fit, original fabric and grip retained; not a full reload animation'}},
  dispose(){if(disposed)return;disposed=true;fit.removeFromParent();flashMesh.removeFromParent();root.traverse(o=>o.geometry?.dispose());for(const m of owned)m.dispose();for(const t of maps)t.dispose();flashMesh.geometry.dispose();flashMaterial.dispose()}
 };
}

function fitSleeveEnd(T,root){
 let source;root.traverse(o=>{if(o.isSkinnedMesh&&o.geometry.attributes.position.count>12529)source=o});
 if(!source)throw Error('Pinned source arm mesh missing');
 source.skeleton.update();
 const geometry=source.geometry.clone(),v=new T.Vector3(),rearOffset=new T.Vector3(-.13,-.18,.36),positions=[];let adjusted=0;
 for(let i=0;i<geometry.attributes.position.count;i++){
  source.getVertexPosition(i,v);
  // Only the rear upper sleeve is fitted toward the offscreen torso. The
  // original continuous fabric, UV0/UV1 and material are retained, not joined
  // to a different material. Hands and front grip have zero blend weight.
  const z=T.MathUtils.smoothstep(v.z,.015,.17),left=T.MathUtils.smoothstep(-v.x,.20,.30),weight=z*left;
  if(weight>0){v.addScaledVector(rearOffset,weight);adjusted++}
  positions.push(v.x,v.y,v.z);
 }
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.morphAttributes={};geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.deleteAttribute('tangent');geometry.deleteAttribute('normal');geometry.computeVertexNormals();
 const mesh=new T.Mesh(geometry,source.material);mesh.name='source-fabric-offscreen-sleeve-fit';
 mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
 source.parent.add(mesh);source.removeFromParent();
 return{bakedHeldPose:true,retainedSourceFabric:true,proceduralExtension:false,rearSleeveVerticesAdjusted:adjusted,note:'Original continuous sleeve fitted offscreen; no joined material, wrists/grip unchanged'};
}
