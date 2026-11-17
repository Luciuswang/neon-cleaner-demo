// Diagnostic only. The shipped repair will live in weapon.js.
export function repose(T,root,angle=Math.PI/3,elbowAngle=0,roll=0){
 root.updateMatrixWorld(true);
 const upper=root.getObjectByName('UpArm_L'),elbow=root.getObjectByName('Forearm_L'),arm=root.getObjectByName('Arm_L'),hand=root.getObjectByName('IK_Hand_Cntrl_L');
 const pivot=hand.getWorldPosition(new T.Vector3()),shoulder=upper.getWorldPosition(new T.Vector3()),wrist=elbow.getWorldPosition(new T.Vector3());
 const axis=wrist.clone().sub(pivot).cross(new T.Vector3(0,-1,0)).normalize();
 const rotation=new T.Quaternion().setFromAxisAngle(axis,angle).multiply(new T.Quaternion().setFromAxisAngle(wrist.clone().sub(pivot).normalize(),roll));
 const armPosition=arm.getWorldPosition(new T.Vector3()).sub(pivot).applyQuaternion(rotation).add(pivot);
 const armQuaternion=rotation.clone().multiply(arm.getWorldQuaternion(new T.Quaternion()));
 arm.position.copy(arm.parent.worldToLocal(armPosition));
 arm.quaternion.copy(arm.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(armQuaternion));
 root.updateMatrixWorld(true);
 if(elbowAngle){
  const p=elbow.getWorldPosition(new T.Vector3()),s=upper.getWorldPosition(new T.Vector3()),q=elbow.getWorldQuaternion(new T.Quaternion());
  const a=s.clone().sub(p).cross(p.clone().sub(hand.getWorldPosition(new T.Vector3()))).normalize(),r=new T.Quaternion().setFromAxisAngle(a,elbowAngle);
  const pos=arm.getWorldPosition(new T.Vector3()).sub(p).applyQuaternion(r).add(p),quat=r.clone().multiply(arm.getWorldQuaternion(new T.Quaternion()));
  arm.position.copy(arm.parent.worldToLocal(pos));arm.quaternion.copy(arm.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(quat));
  root.updateMatrixWorld(true);elbow.quaternion.copy(elbow.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));root.updateMatrixWorld(true);
 }
 root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update()});
 return{angle,axis:axis.toArray(),wristResidual:root.getObjectByName('BoneTwist_01L_end')?.getWorldPosition(new T.Vector3()).distanceTo(pivot)};
}
