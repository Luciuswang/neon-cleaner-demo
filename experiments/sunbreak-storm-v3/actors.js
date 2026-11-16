import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Licensed display skins only. Never replace an enemy anchor, hit proxy,
// weapon group, life state, transform, movement clock or combat animation pivot.
export async function buildActors({THREE:T,enemies}){
 const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
 const asset=await loader.loadAsync('./assets/soldier/soldier_tac.glb');
 const entries=[];
 for(const enemy of enemies){
  const root=clone(asset.scene);
  root.name='licensed-tactical-display';
  const detached=root.getObjectByName('Object_111');detached?.removeFromParent();
  root.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(root,true),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  const scale=1.8/size.y,fit=new T.Group();fit.name='soldier-original-anchor-fit';
  root.scale.setScalar(scale);root.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
  fit.add(root);
  let meshes=0,triangles=0;
  root.traverse(o=>{
   if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;
   o.frustumCulled=false;o.castShadow=o.receiveShadow=true;
   if(o.isSkinnedMesh&&!o.skeleton.boneTexture)o.skeleton.computeBoneTexture();
   for(const m of Array.isArray(o.material)?o.material:[o.material]){
    m.envMapIntensity=.20;
    m.roughness=Math.max(.56,m.roughness);
    for(const value of Object.values(m))if(value?.isTexture)value.anisotropy=4;
   }
  });
  // Old procedural clothing is hidden; keep the original authoritative
  // weapon node and its cosmetic gun, which the baseline tilts when aiming.
  const underWeapon=o=>{for(let p=o;p;p=p.parent)if(p===enemy.wg2)return true;return false};
  enemy.g.traverse(o=>{if(o.isMesh&&!underWeapon(o))o.visible=false});
  enemy.g.add(fit);
  const leg=side=>{let result;root.traverse(o=>{if(o.isBone&&o.name.includes(side+'UpLeg'))result=o});return result};
  const left=leg('Left'),right=leg('Right');
  entries.push({enemy,root,left,right,leftHome:left?.quaternion.clone(),rightHome:right?.quaternion.clone(),scale,meshes,triangles});
 }
 const axis=new T.Vector3(1,0,0),q=new T.Quaternion();
 return{
  update(){
   for(const a of entries){
    if(a.left){a.left.quaternion.copy(a.leftHome);a.left.quaternion.multiply(q.setFromAxisAngle(axis,a.enemy.ll.rotation.x*.45))}
    if(a.right){a.right.quaternion.copy(a.rightHome);a.right.quaternion.multiply(q.setFromAxisAngle(axis,a.enemy.rl.rotation.x*.45))}
   }
  },
  info(){return{loaded:true,count:entries.length,license:'CC-BY-4.0',author:'DanlyVostok',trianglesEach:entries[0]?.triangles,uniformFit:entries[0]?.scale,height:1.8,animation:'authored bent-arm grip pose; visual leg swing follows original pivots, no imported animation clips',combat:'original six anchors and invisible hit proxies unchanged'}}
 };
}
