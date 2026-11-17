import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createReloadPose} from './reload-pose.js';

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
 const sleeve=repairLeftSleeve(T,root);
 // The baseline's uniform fit and exact authoritative muzzle are unchanged.
 const displayScale=1.70,fit=new T.Group();fit.name='mp5-original-muzzle-fit';
 root.scale.setScalar(displayScale);
 fit.position.set(-sourceMuzzle.x*displayScale,.005-sourceMuzzle.y*displayScale,-1.85-sourceMuzzle.z*displayScale);
 fit.add(root);
 const owned=new Set(),maps=new Set();let meshes=0,triangles=0,skinned=0;
 root.traverse(o=>{
  if(!o.isMesh)return;
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
 for(const child of gun.children.slice()){
  if(child.isLight)continue;
  const lights=[];child.traverse(o=>{if(o.isLight)lights.push(o)});lights.forEach(l=>gun.attach(l));
  gun.remove(child);
 }
 gun.add(fit);
 const magazine=root.getObjectByName('Magazine'),charging=root.getObjectByName('ChargingHandle');
 const chargeHome=charging?.position.clone();
 const reloadPose=createReloadPose(T,root,magazine);
 const flashMaterial=new T.MeshBasicMaterial({color:0xffd59d,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 const flashMesh=new T.Mesh(new T.ConeGeometry(.045,.22,7,1,true),flashMaterial);
 flashMesh.rotation.x=-Math.PI/2;flashMesh.position.set(0,.005,-1.94);flashMesh.frustumCulled=false;gun.add(flashMesh);
 const baselineLight=gun.children.find(o=>o.isPointLight);
 let disposed=false,lastAim=0;
 return{
  update(dt,state){
   reloadPose.update(state.reload);
   if(charging&&chargeHome)charging.position.copy(chargeHome);
   flashMaterial.opacity=Math.min(.75,(baselineLight?.intensity||0)*.035);
   flashMesh.visible=flashMaterial.opacity>.015;lastAim=state.aim;
  },
  info(){root.updateWorldMatrix(true,true);const actual=gun.worldToLocal(muzzle.getWorldPosition(new T.Vector3()));return{loaded:true,asset:'Rotuma MP5 / gloved first-person arms',license:'CC-BY-4.0',meshes,triangles,skinnedMeshes:skinned,sleeve,textureMaps:maps.size,uniformDisplayScale:displayScale,sourceMuzzle:sourceMuzzle.toArray(),fittedMuzzle:actual.toArray(),muzzleFitError:actual.distanceTo(new T.Vector3(0,.005,-1.85)),aim:lastAim,reload:reloadPose.info(),animation:'authored visible left-hand and magazine reload; fixed-length IK on repaired source arms; right grip retained, no mocap'}},
  dispose(){if(disposed)return;disposed=true;reloadPose.dispose();fit.removeFromParent();flashMesh.removeFromParent();root.traverse(o=>o.geometry?.dispose());for(const m of owned)m.dispose();for(const t of maps)t.dispose();flashMesh.geometry.dispose();flashMaterial.dispose()}
 };
}

function repairLeftSleeve(T,root){
 let source;root.traverse(o=>{if(o.isSkinnedMesh&&o.name==='FPArms')source=o});
 if(!source||source.geometry.attributes.position.count!==13137)throw Error('Pinned source arm mesh changed; sleeve repair requires revalidation');
 const bone=name=>{const b=root.getObjectByName(name);if(!b)throw Error('Missing source arm joint: '+name);return b};
 const arm=bone('Arm_L'),upper=bone('UpArm_L'),elbow=bone('Forearm_L'),hand=bone('IK_Hand_Cntrl_L');
 const wp=o=>o.getWorldPosition(new T.Vector3()),wq=o=>o.getWorldQuaternion(new T.Quaternion());
 const positions=[],original=[],grip=[],left=[],joints=source.geometry.attributes.skinIndex,weights=source.geometry.attributes.skinWeight,v=new T.Vector3();
 source.skeleton.update();
 for(let i=0;i<13137;i++){
  source.getVertexPosition(i,v);original.push(v.clone());
  let contactWeight=0,isLeft=false,tip=false;
  for(let k=0;k<4;k++)if(weights.getComponent(i,k)>0){
   const name=source.skeleton.bones[joints.getComponent(i,k)].name;
   if(/^(Hand_[LR]|Bone_[LR]\d)/.test(name))contactWeight+=weights.getComponent(i,k);
   if(/^Bone_[LR](006|007|010|011|014|015|018|019|021|022)$/.test(name))tip=true;
   if(/_L|Twist_0\dL/.test(name))isLeft=true;
  }
  grip.push(contactWeight>.999||tip);left.push(isLeft);
 }
 const wrist=wp(hand),elbowHome=wp(elbow),shoulderHome=wp(upper);
 const lengths=[wrist.distanceTo(elbowHome),elbowHome.distanceTo(shoulderHome)];
 // Axes derive from actual joint positions. Rigid joint reposing, never
 // position-weighted rear translation, bone scaling, or forearm elongation.
 function turnArm(pivot,axis,angle,keepForearm=false){
  const rotation=new T.Quaternion().setFromAxisAngle(axis.normalize(),angle),q=keepForearm?wq(elbow):null;
  const position=wp(arm).sub(pivot).applyQuaternion(rotation).add(pivot),quaternion=rotation.clone().multiply(wq(arm));
  arm.position.copy(arm.parent.worldToLocal(position));
  arm.quaternion.copy(wq(arm.parent).invert().multiply(quaternion));
  root.updateMatrixWorld(true);
  if(q){elbow.quaternion.copy(wq(elbow.parent).invert().multiply(q));root.updateMatrixWorld(true)}
 }
 const wristAxis=elbowHome.clone().sub(wrist).cross(new T.Vector3(0,-1,0)).normalize();
 turnArm(wrist,wristAxis.clone(),25*Math.PI/180);
 const pivot=wp(elbow),elbowAxis=wp(upper).sub(pivot).cross(new T.Vector3(0,-1,0)).normalize();
 turnArm(pivot,elbowAxis.clone(),15*Math.PI/180,true);source.skeleton.update();
 let changed=0,gripCount=0,maxGripDelta=0;
 for(let i=0;i<13137;i++){
  source.getVertexPosition(i,v);
  // Pure hand/digit vertices and finger tips preserve exact contact; retain
  // authored mixed wrist weights
  // instead of hard-pinning their cuff transition into a stretched seam.
  if(grip[i]){v.copy(original[i]);gripCount++}
  if(v.distanceTo(original[i])>1e-6)changed++;
  positions.push(v.x,v.y,v.z);
 }
 // Complete the missing shoulder garment to its measured joint. Do not
 // stretch original cloth to fake a longer forearm. Weld only for discovery;
 // the real source positions, UV seams, indices and hand contact are retained.
 const old=source.geometry,index=Array.from(old.index.array),weld=new Map(),ids=[],members=[],edges=new Map();
 for(let i=0;i<13137;i++){
  const key=original[i].toArray().map(x=>Math.round(x/1e-5)).join(',');
  if(!weld.has(key)){weld.set(key,weld.size);members.push(i)}
  ids.push(weld.get(key));
 }
 for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){
  const a=ids[index[i+k]],b=ids[index[i+(k+1)%3]];if(a===b)continue;
  const key=a<b?a+':'+b:b+':'+a;
  if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});
 }
 const boundary=[...edges.values()].filter(e=>e.count===1&&left[members[e.a]]&&left[members[e.b]]);
 if(boundary.length!==24)throw Error('Pinned source shoulder opening changed');
 const next=new Map();for(const e of boundary){if(!next.has(e.a))next.set(e.a,[]);if(!next.has(e.b))next.set(e.b,[]);next.get(e.a).push(e.b);next.get(e.b).push(e.a)}
 const loop=[boundary[0].a];let prev=-1;
 while(loop.length<24){const choices=next.get(loop.at(-1));if(choices?.length!==2)throw Error('Non-manifold sleeve opening');const id=choices.find(id=>id!==prev);prev=loop.at(-1);if(loop.includes(id))throw Error('Incomplete sleeve loop');loop.push(id)}
 const ring=loop.map(id=>members[id]);
 const sameDirection=index.some((_,i)=>i%3===0&&[index[i],index[i+1],index[i+2]].some((a,k,tri)=>ids[a]===loop[0]&&ids[tri[(k+1)%3]]===loop[1]));
 if(sameDirection)ring.reverse();
 const center=new T.Vector3();for(const i of ring)center.add(new T.Vector3().fromArray(positions,i*3));center.divideScalar(24);
 const shoulder=source.worldToLocal(wp(upper)),extension=shoulder.clone().sub(center);
 const uv=Array.from({length:old.attributes.uv.count},(_,i)=>[old.attributes.uv.getX(i),old.attributes.uv.getY(i)]).flat();
 const uv1=Array.from({length:old.attributes.uv1.count},(_,i)=>[old.attributes.uv1.getX(i),old.attributes.uv1.getY(i)]).flat();
 const meanUV=new T.Vector2(),meanUV1=new T.Vector2();
 for(const i of ring){meanUV.add(new T.Vector2().fromArray(uv,i*2));meanUV1.add(new T.Vector2().fromArray(uv1,i*2))}
 meanUV.divideScalar(24);meanUV1.divideScalar(24);
 const start=positions.length/3;
 for(const i of ring){
  v.fromArray(positions,i*3).sub(center).multiplyScalar(.86).add(center).add(extension);
  positions.push(v.x,v.y,v.z);
  // Use the source fabric island interior for new faces, never a zero-width
  // UV strip. Original UV0/UV1 retain their values to Float32 precision.
  for(const [data,mean]of [[uv,meanUV],[uv1,meanUV1]])data.push(data[i*2]+(mean.x-data[i*2])*.4,data[i*2+1]+(mean.y-data[i*2+1])*.4);
 }
 const cap=positions.length/3;positions.push(shoulder.x,shoulder.y,shoulder.z);uv.push(meanUV.x,meanUV.y);uv1.push(meanUV1.x,meanUV1.y);
 for(let k=0;k<24;k++){const j=(k+1)%24,a=ring[k],b=ring[j],c=start+k,d=start+j;index.push(a,b,c,b,d,c,c,d,cap)}
 const geometry=old.clone();
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setIndex(index);
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('uv1',new T.Float32BufferAttribute(uv1,2));
 geometry.morphAttributes={};for(const name of ['skinIndex','skinWeight','tangent','normal'])geometry.deleteAttribute(name);
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 for(let i=0;i<13137;i++)if(grip[i]){v.fromBufferAttribute(geometry.attributes.position,i);maxGripDelta=Math.max(maxGripDelta,v.distanceTo(original[i]))}
 const afterLengths=[wp(hand).distanceTo(wp(elbow)),wp(elbow).distanceTo(wp(upper))];
 const mesh=new T.Mesh(geometry,source.material);mesh.name='source-fabric-articulated-held-arms';
 mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);
 const reloadWeights=new Float32Array(positions.length),palm=new T.Vector3();let palmCount=0;
 for(let i=0;i<13137;i++){
  for(let k=0;k<4;k++){
   const weight=weights.getComponent(i,k),name=source.skeleton.bones[joints.getComponent(i,k)].name;
   const group=/^(Hand_L|IK_Hand_Cntrl_L|Bone_L)/.test(name)?2:/^(Forearm_L|BoneTwist_.*L)/.test(name)?1:/^(Arm_L|UpArm_L)$/.test(name)?0:-1;
   if(group>=0)reloadWeights[i*3+group]+=weight;
  }
  if(reloadWeights[i*3+2]>.999){palm.add(new T.Vector3().fromArray(positions,i*3));palmCount++}
 }
 for(let i=13137;i<positions.length/3;i++)reloadWeights[i*3]=1;
 mesh.userData.reloadRig={weights:reloadWeights,palm:palm.divideScalar(palmCount),
  shoulder:source.worldToLocal(wp(upper)),elbow:source.worldToLocal(wp(elbow)),wrist:source.worldToLocal(wp(hand))};
 source.parent.add(mesh);source.removeFromParent();old.dispose();source.skeleton.dispose();
 return{repair:'rigid-joint-repose-and-shoulder-closure',bakedHeldPose:true,retainedSourceFabric:true,
  proceduralExtension:true,extensionKind:'new tapered shoulder garment closure, not stretched original vertices',
  rearSleeveVerticesAdjusted:0,nonrigidRearTranslation:false,wristDegrees:25,upperArmDegrees:15,
  wristAxis:wristAxis.toArray(),upperArmAxis:elbowAxis.toArray(),sourceVertices:13137,articulatedVertices:changed,
  lockedGripVertices:gripCount,maxGripVertexDelta:maxGripDelta,sourceJointLengths:lengths,posedJointLengths:afterLengths,
  maxJointLengthError:Math.max(...lengths.map((x,i)=>Math.abs(x-afterLengths[i]))),
  addedGarmentVertices:25,addedGarmentTriangles:72,garmentClosureLength:extension.length(),garmentEnd:'measured source shoulder joint',garmentEndRadiusScale:.86,
  sourceBounds:new T.Box3().setFromPoints(original),posedBounds:geometry.boundingBox.clone(),
  note:'Source GLB unchanged; pure hand/digit contact vertices locked; authored mixed wrist skin blends retained. Original UVs retained to Float32 precision. Joint repose then bake and short shoulder closure. No arm widening, bone-length scaling, full reload clip or mocap.'};
}
