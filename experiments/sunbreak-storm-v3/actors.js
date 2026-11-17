import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:0));
const ease=n=>n*n*(3-2*n);

// Display only. The original anchor, hit proxies, weapon/muzzle transforms,
// life, combat state and AI clocks belong to the caller.
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
  const pose=makePose(T,enemy,root,entries.length);
  entries.push({pose,scale,meshes,triangles});
 }
 return{
  update(dt,{live=false,pres=false}={}){for(const a of entries)a.pose.update(dt,live&&!pres)},
  poseStats(){return entries.map(a=>a.pose.stats())},
  info(){return{
   loaded:true,count:entries.length,license:'CC-BY-4.0',author:'DanlyVostok',
   trianglesEach:entries[0]?.triangles,uniformFit:entries[0]?.scale,height:1.8,
   animation:'blended procedural skeleton; world-planted two-bone leg IK, weapon-relative arm IK, pelvis/spine weight, aim, crouch, lean, breathing and actual-shot recoil; not motion capture',
   importedAnimationClips:asset.animations.length,rigBonesEach:entries[0]?.pose.boneCount,drivenBonesEach:20,
   combat:'original anchors, life, hit proxies, wg2 and gunTip transforms are never written',
   input:'update(dt,{live,pres}); enemy.tactical visual state; phase uses measured anchor displacement',
   stance:'consume caller-smoothed stance directly; full crouch lowers the skin by 0.57m to approximately 1.23m',
   muzzle:'flash is a child of the unchanged gunTip; triggered only by a rising tactical.recoil',
   integration:'caller owns weapon height/pitch/recoil and hit posture; pose before sampling the combat muzzle'
  }}
 };
}

function makePose(T,enemy,root,index){
 const V=()=>new T.Vector3(),Q=()=>new T.Quaternion();
 const bones=[],byName=new Map();
 root.traverse(b=>{if(b.isBone){bones.push({bone:b,q:b.quaternion.clone()});byName.set(b.name.replace(/^mixamorig:?/,'').replace(/_\d+$/,''),b)}});
 const bone=name=>{const b=byName.get(name);if(!b)throw Error('Tactical rig missing '+name);return b};
 const hips=bone('Hips'),spines=['Spine','Spine1','Spine2'].map(bone),neck=bone('Neck'),head=bone('Head');
 const shoulders=[bone('LeftShoulder'),bone('RightShoulder')];
 const hipHome=hips.position.clone(),hipAt=V(),worldQ=Q(),actorQ=Q(),parentQ=Q(),deltaQ=Q(),inverseQ=Q(),boneQ=Q(),euler=new T.Euler();
 const p0=V(),p1=V(),p2=V(),dir=V(),bend=V(),joint=V(),target=V(),worldTarget=V(),from=V(),to=V();
 enemy.g.updateWorldMatrix(true,true);
 const point=(b,out)=>enemy.g.worldToLocal(out.setFromMatrixPosition(b.matrixWorld));
 const orientation=(b,out)=>out.copy(enemy.g.getWorldQuaternion(actorQ)).invert().multiply(b.getWorldQuaternion(worldQ));
 const hipBind=point(hips,V());
 function setWorldQ(b,q){
  b.parent.getWorldQuaternion(parentQ).invert();
  b.quaternion.copy(parentQ.multiply(q)).normalize();b.updateWorldMatrix(false,true);
 }
 function rotate(b,x,y,z){
  enemy.g.getWorldQuaternion(actorQ);
  deltaQ.setFromEuler(euler.set(x,y,z,'YXZ'));
  inverseQ.copy(actorQ).invert();b.getWorldQuaternion(boneQ);
  worldQ.copy(actorQ).multiply(deltaQ).multiply(inverseQ).multiply(boneQ);
  setWorldQ(b,worldQ);
 }
 function align(b,child,at){
  from.setFromMatrixPosition(child.matrixWorld).sub(p0.setFromMatrixPosition(b.matrixWorld)).normalize();
  worldTarget.copy(at).applyMatrix4(enemy.g.matrixWorld);
  to.copy(worldTarget).sub(p0).normalize();
  deltaQ.setFromUnitVectors(from,to);
  worldQ.copy(deltaQ).multiply(b.getWorldQuaternion(actorQ));setWorldQ(b,worldQ);
 }
 function chain(a,b,c){
  return{a:bone(a),b:bone(b),c:bone(c),l1:0,l2:0,error:0,target:V(),pole:V()};
 }
 const legs=['Left','Right'].map((side,i)=>{
  const c=chain(side+'UpLeg',side+'Leg',side+'Foot');
  return{...c,side:i===0?1:-1,home:point(c.c,V()),
   homeQ:orientation(c.c,Q()),anchor:V(),foot:V(),start:V(),goal:V(),footQ:Q(),startQ:Q(),goalQ:Q(),
   offset:i*.5,swing:false,settling:false,settle:0,lift:0,cycle:0};
 });
 const arms=['Left','Right'].map((side,i)=>{
  const c=chain(side+'Arm',side+'ForeArm',side+'Hand');
  return{...c,side:i===0?1:-1,homeQ:orientation(c.c,Q()),
   // Wrist offsets account for the authored inward/upward palm direction.
   grip:new T.Vector3(i===0?.052:-.078,-.09,i===0?.245:.16)};
 });
 for(const c of [...legs,...arms]){
  c.l1=point(c.a,p0).distanceTo(point(c.b,p1));c.l2=p1.distanceTo(point(c.c,p2));
 }
 function solve(c){
  point(c.a,p0);dir.copy(c.target).sub(p0);
  const length=dir.length(),d=clamp(length,Math.abs(c.l1-c.l2)+.001,c.l1+c.l2-.002);
  dir.multiplyScalar(1/Math.max(.00001,length));
  bend.copy(c.pole).sub(p0);bend.addScaledVector(dir,-bend.dot(dir));
  if(bend.lengthSq()<.000001)bend.set(0,0,1).addScaledVector(dir,-dir.z);
  bend.normalize();
  const along=(c.l1*c.l1-c.l2*c.l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,c.l1*c.l1-along*along));
  joint.copy(p0).addScaledVector(dir,along).addScaledVector(bend,height);
  target.copy(p0).addScaledVector(dir,d);
  align(c.a,c.b,joint);align(c.b,c.c,target);
  c.error=point(c.c,p2).distanceTo(c.target);
 }
 const flash=new T.Mesh(new T.ConeGeometry(.043,.16,6,1,true),new T.MeshBasicMaterial({
  color:0xffd18a,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,toneMapped:false
 }));
 flash.name='tactical-actual-shot-flash';flash.rotation.x=Math.PI/2;flash.position.z=.07;flash.visible=false;
 enemy.gunTip.add(flash);
 const previous=enemy.g.getWorldPosition(V()),now=V(),movement=V(),moveDir=new T.Vector3(0,0,1),desiredDir=V(),hipOffset=V();
 let time=0,phase=0,distance=0,speed=0,actualSpeed=0,stance=0,lean=0,aim=0,alert=0,recoil=0,hurt=0,lastRecoil=0,flashTime=0,initialized=false,wasMoving=false;
 function plant(){
  enemy.g.updateWorldMatrix(true,true);
  for(const l of legs){
   l.anchor.copy(l.home).applyMatrix4(enemy.g.matrixWorld);l.foot.copy(l.anchor);
   l.footQ.copy(enemy.g.getWorldQuaternion(actorQ)).multiply(l.homeQ);
   l.swing=l.settling=false;l.lift=0;
  }
 }
 plant();
 function beginSwing(l,cycleLength,settling=false){
  l.start.copy(l.foot);l.startQ.copy(l.footQ);
  l.goal.copy(l.home);
  l.takeoff=l.cycle;
  if(!settling)l.goal.addScaledVector(moveDir,cycleLength*(1-l.takeoff+.30));
  l.goal.applyMatrix4(enemy.g.matrixWorld);
  l.goalQ.copy(enemy.g.getWorldQuaternion(actorQ)).multiply(l.homeQ);
  l.swing=true;l.settling=settling;l.settle=0;
 }
 function feet(dt,moving,cycleLength){
  for(const l of legs){
   const cycle=(phase+l.offset)%1;l.cycle=cycle;
   if(moving){
    if(cycle>=.60){
     if(!l.swing||l.settling)beginSwing(l,cycleLength);
     const u=clamp((cycle-l.takeoff)/(1-l.takeoff),0,1);
     l.foot.lerpVectors(l.start,l.goal,ease(u));
     l.lift=Math.sin(Math.PI*u)*(.075+.018*speed)*(1-.22*stance);
     l.foot.y+=l.lift;l.footQ.slerpQuaternions(l.startQ,l.goalQ,ease(u));
    }else{
     if(l.swing){l.anchor.copy(l.goal);l.footQ.copy(l.goalQ);l.swing=l.settling=false}
     l.foot.copy(l.anchor);l.lift=0;
    }
   }else{
    if(l.swing&&!l.settling)beginSwing(l,cycleLength,true);
    // A short recovery step permits turning in place without stretching legs.
    desiredDir.copy(l.home).applyMatrix4(enemy.g.matrixWorld);
    if(!l.swing&&l.anchor.distanceTo(desiredDir)>.27&&!legs.some(other=>other!==l&&other.swing))beginSwing(l,cycleLength,true);
    if(l.swing){
     l.settle=Math.min(1,l.settle+dt*5);
     l.foot.lerpVectors(l.start,l.goal,ease(l.settle));
     l.lift=Math.sin(Math.PI*l.settle)*.055;l.foot.y+=l.lift;
     l.footQ.slerpQuaternions(l.startQ,l.goalQ,ease(l.settle));
     if(l.settle===1){l.anchor.copy(l.goal);l.swing=l.settling=false;l.lift=0}
    }else{l.foot.copy(l.anchor);l.lift=0}
   }
  }
 }
 function pose(){
  for(const b of bones)b.bone.quaternion.copy(b.q);
  hips.position.copy(hipHome);root.updateWorldMatrix(true,true);
  const gait=Math.sin(phase*Math.PI*2),weight=clamp(speed/2.5,0,1),breath=Math.sin(time*2.05+index*1.73);
  hipOffset.set(lean*.045+gait*.017*weight,-.57*stance-.12*weight+Math.cos(phase*Math.PI*4)*.014*weight+breath*.002,-.115*stance-.012*recoil);
  hipAt.copy(hipBind).add(hipOffset).applyMatrix4(enemy.g.matrixWorld);
  hips.position.copy(hips.parent.worldToLocal(hipAt));hips.updateWorldMatrix(false,true);
  rotate(hips,.025*stance+moveDir.z*.035*weight,-gait*.035*weight,-lean*.025-gait*.015*weight);
  const blade=clamp(enemy.wg2.position.x,-.35,.35)*.60;
  for(let i=0;i<spines.length;i++)rotate(spines[i],.035*stance+aim*.13-recoil*.014-hurt*.022+breath*.002,blade+moveDir.x*.018*weight+gait*.014*weight,-lean*.018+hurt*.012*(index%2?1:-1));
  rotate(neck,aim*.25,0,lean*.028);rotate(head,aim*.18,0,lean*.025);
  // Clavicle protraction brings the support shoulder forward instead of
  // stretching its upper arm to reach an offset rifle.
  rotate(shoulders[0],0,-.45-.12*stance,0);rotate(shoulders[1],0,.28,0);
  for(const l of legs){
   l.target.copy(l.foot);enemy.g.worldToLocal(l.target);
   point(l.a,p0);l.pole.set(p0.x+l.side*.065,p0.y-.30,p0.z+.65);
   solve(l);setWorldQ(l.c,l.footQ);
   if(l.swing)rotate(l.c,-Math.sin(Math.PI*(l.settling?l.settle:clamp((l.cycle-l.takeoff)/(1-l.takeoff),0,1)))*.12,0,0);
  }
  // No gun transform is changed here: both hands solve to the same weapon
  // hierarchy whose gunTip the combat ray/tracer samples after posing.
  enemy.wg2.updateWorldMatrix(true,true);
  for(const arm of arms){
   arm.target.copy(arm.grip).applyMatrix4(enemy.wg2.matrixWorld);enemy.g.worldToLocal(arm.target);
   point(arm.a,p0);arm.pole.set(p0.x+arm.side*.36,p0.y-.48,p0.z+.10);
   solve(arm);
   enemy.wg2.getWorldQuaternion(worldQ);worldQ.multiply(arm.homeQ);setWorldQ(arm.c,worldQ);
  }
 }
 function update(dt,live){
  enemy.g.getWorldPosition(now);
  const state=enemy.tactical||{};
  if(!initialized){
   stance=clamp(state.stance,0,1);lean=clamp(state.lean,-1,1);aim=clamp(state.aimPitch,-.75,.75);
   pose();initialized=true;
  }
  if(!live||enemy.alive===false||!Number.isFinite(dt)||dt<=0){
   if(now.distanceTo(previous)>.25)plant();
   previous.copy(now);flash.visible=false;return;
  }
  const elapsed=Math.min(dt,.10),blend=1-Math.exp(-elapsed*12);
  const floorChange=Math.abs(now.y-previous.y);
  movement.copy(now).sub(previous);movement.y=0;previous.copy(now);
  const traveled=movement.length(),teleported=traveled>Math.max(.75,dt*8)||floorChange>.18;
  actualSpeed=teleported?0:traveled/dt;
  const moving=actualSpeed>.035;
  if(teleported){plant();phase=0}
  let turned=false;
  if(moving){
   desiredDir.set(Math.sin(clamp(state.moveAngle,-Math.PI,Math.PI)),0,Math.cos(clamp(state.moveAngle,-Math.PI,Math.PI)));
   if(!Number.isFinite(state.moveAngle))desiredDir.copy(movement).applyQuaternion(enemy.g.getWorldQuaternion(actorQ).invert()).normalize();
   // Feet follow actual travel immediately, including a 180-degree reversal.
   // Normalizing a damped antiparallel vector can otherwise lock its old sign.
   turned=wasMoving&&moveDir.dot(desiredDir)<.45;moveDir.copy(desiredDir);
  }
  speed+=(Math.min(actualSpeed,4.5)-speed)*blend;
  // This is the caller's already-blended visual stance, not an AI target.
  // A second low-pass would desynchronize the skin from weapon/hit height.
  stance=clamp(state.stance,0,1);
  lean+=(clamp(state.lean,-1,1)-lean)*blend;
  aim+=(clamp(state.aimPitch,-.75,.75)-aim)*blend;
  alert+=(clamp(state.alert,0,1)-alert)*blend;
  hurt+=(clamp(state.hurt,0,.45)/.45-hurt)*(1-Math.exp(-elapsed*22));
  const shotRecoil=clamp(state.recoil,0,1);
  recoil+=(shotRecoil-recoil)*(1-Math.exp(-elapsed*(shotRecoil>recoil?55:20)));
  flashTime=Math.max(0,flashTime-elapsed);
  if(shotRecoil>.65&&shotRecoil>lastRecoil+.2)flashTime=.045;
  lastRecoil=shotRecoil;flash.visible=flashTime>0;
  time+=elapsed;
  const cycleLength=(.68+Math.min(3.5,actualSpeed)*.12)*(1-.22*stance);
  if(moving&&(!wasMoving||turned)){
   // Start with the trailing foot rather than pinning it through another
   // half-cycle after an abrupt AI direction change.
   const leftTrail=enemy.g.worldToLocal(p0.copy(legs[0].foot)).sub(legs[0].home).dot(moveDir);
   const rightTrail=enemy.g.worldToLocal(p1.copy(legs[1].foot)).sub(legs[1].home).dot(moveDir);
   phase=!wasMoving?.25:leftTrail<rightTrail?.60:.10;
   for(const l of legs)l.swing=l.settling=false;
  }
  if(moving){distance+=traveled;phase=(phase+traveled/cycleLength)%1}
  feet(elapsed,moving,cycleLength);pose();wasMoving=moving;
 }
 function stats(){
  return{
   index,bones:bones.length,time,phase,distance,actualSpeed,speed,stance,lean,aimPitch:aim,alert,recoil,hurt,
   flash:flash.visible,mode:enemy.tactical?.mode||'idle',
   feet:legs.map(l=>({side:l.side===1?'left':'right',swing:l.swing,lift:l.lift,ikError:l.error,
    target:enemy.g.worldToLocal(l.foot.clone()).toArray(),actual:point(l.c,V()).toArray()})),
   hands:arms.map(a=>({side:a.side===1?'left':'right',ikError:a.error,target:a.target.toArray(),actual:point(a.c,V()).toArray()}))
  };
 }
 return{update,stats,boneCount:bones.length};
}
