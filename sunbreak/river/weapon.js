import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {createReloadPose} from './reload-pose.js';

// Rotuma MP5 + credited first-person arms, CC BY 4.0. See weapon-provenance.json
// and assets/mp5/NOTICE.md. No upstream weapon, recoil or animation code used.
// The baseline owns its gun parent, muzzle light, aim/fire/reload and all damage.
export async function buildWeapon({THREE:T,gun,gscene,cam,scene,sun,amb,solids=[]}){
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
   owned.add(m);m.envMapIntensity=m.name==='arms'?.28:.65;
   if(m.normalScale)m.normalScale.set(.85,.85);
   if(m.name==='arms'){m.metalness=0;m.roughness=.83}
   else{m.roughness=Math.max(.48,m.roughness);m.metalness=Math.min(.75,m.metalness)}
   for(const v of Object.values(m))if(v?.isTexture){v.anisotropy=8;maps.add(v)}
  }
 });
 // glTF's roughness texture MULTIPLIES the scalar. A scalar .83 alone does
 // not keep cloth matte when the source ORM has low green-channel values.
 for(const m of owned)installWeaponRoughness(T,m,m.name==='arms'?.78:.48);
 for(const child of gun.children.slice()){
  if(child.isLight)continue;
  const lights=[];child.traverse(o=>{if(o.isLight)lights.push(o)});lights.forEach(l=>gun.attach(l));
  gun.remove(child);
 }
 gun.add(fit);
 const magazine=root.getObjectByName('Magazine'),charging=root.getObjectByName('ChargingHandle');
 const chargeHome=charging?.position.clone();
 const reloadPose=createReloadPose(T,root,magazine);
 const baselineLight=gun.children.find(o=>o.isPointLight);
 const flash=createWeaponFlash(T,gun,baselineLight);
 const lighting=createWeaponLighting({T,gscene,cam,scene,sun,amb,solids,materials:[...owned]});
 let disposed=false,lastAim=0;
 return{
  // Explicit accepted-shot notification. Never infer shots from the light we
  // animate, or change ammo/cadence/damage. null muzzle means root blocked VFX.
  shot(event={}){if(!disposed)flash.shot(event)},
  reset(){flash.reset()},
  update(dt,state){
   reloadPose.update(state.reload);
   if(charging&&chargeHome)charging.position.copy(chargeHome);
   if(state.presentation||['pause','dead','win'].includes(state.state))flash.reset();
   flash.update(dt);lighting.update(dt);lastAim=state.aim;
  },
  info(){root.updateWorldMatrix(true,true);const actual=gun.worldToLocal(muzzle.getWorldPosition(new T.Vector3()));return{loaded:true,asset:'Rotuma MP5 / gloved first-person arms',license:'CC-BY-4.0',meshes,triangles,skinnedMeshes:skinned,sleeve,textureMaps:maps.size,uniformDisplayScale:displayScale,sourceMuzzle:sourceMuzzle.toArray(),fittedMuzzle:actual.toArray(),muzzleFitError:actual.distanceTo(new T.Vector3(0,.005,-1.85)),aim:lastAim,reload:reloadPose.info(),lighting:lighting.info(),flash:flash.info(),animation:'authored visible left-hand and magazine reload; fixed-length IK on repaired source arms; right grip retained, no mocap'}},
  dispose(){if(disposed)return;disposed=true;reloadPose.dispose();lighting.dispose();flash.dispose();fit.removeFromParent();root.traverse(o=>o.geometry?.dispose());for(const m of owned)m.dispose();for(const t of maps)t.dispose()}
 };
}

export const WEAPON_LIGHTING_REVISION='world-viewmodel-ibl-r160-v1';
export const WEAPON_LIGHTING_LIMITS=Object.freeze({probeInterval:.1,rayCountPerProbe:4,sunRange:100,skyRange:18});
const clamp01=x=>Math.max(0,Math.min(1,x));
const seconds=dt=>Number.isFinite(dt)?Math.max(0,dt):0;

export function installWeaponRoughness(T,material,floor){
 if(!Number.isFinite(floor)||floor<0||floor>1)throw new TypeError('Weapon roughness floor must be in [0,1]');
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey;
 const isDefault=key?.toString()===T.Material.prototype.customProgramCacheKey.toString(),oldKey=isDefault?key.call(material):null;
 const token='#include <roughnessmap_fragment>';
 function hook(shader,renderer){
  previous?.call(this,shader,renderer);
  if(!shader.fragmentShader.includes(token))throw Error('Weapon roughness hook missing after prior material hook');
  shader.fragmentShader=shader.fragmentShader.replace(token,`${token}\nroughnessFactor=max(roughnessFactor,${floor.toFixed(4)});`);
 }
 function cacheKey(){return `${isDefault?oldKey:key?.call(this)??''}|weapon-final-roughness-${floor}`}
 material.onBeforeCompile=hook;material.customProgramCacheKey=cacheKey;material.userData.weaponRoughnessFloor=floor;material.needsUpdate=true;
 return()=>{if(material.onBeforeCompile===hook)material.onBeforeCompile=previous;if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=key;delete material.userData.weaponRoughnessFloor;material.needsUpdate=true};
}

// r160 has no Scene.environmentRotation. Rotate BOTH diffuse irradiance and
// specular PMREM lookup directions from the fixed gun world into actual world.
// No global ShaderChunk changes; preserve prior hooks and their cache identity.
export function installWeaponEnvironment(T,material,rotationUniform){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey;
 const isDefault=key?.toString()===T.Material.prototype.customProgramCacheKey.toString();
 const oldKey=isDefault?key.call(material):null;
 const chunk=T.ShaderChunk.envmap_physical_pars_fragment;
 if(!chunk?.includes('textureCubeUV( envMap, worldNormal, 1.0 )')||!chunk.includes('textureCubeUV( envMap, reflectVec, roughness )'))throw Error('Weapon IBL patch needs revalidation for this Three version');
 const rotated='uniform mat3 uWeaponViewToWorld;\n'+chunk
  .replace('textureCubeUV( envMap, worldNormal, 1.0 )','textureCubeUV( envMap, uWeaponViewToWorld * worldNormal, 1.0 )')
  .replace('textureCubeUV( envMap, reflectVec, roughness )','textureCubeUV( envMap, uWeaponViewToWorld * reflectVec, roughness )');
 function hook(shader,renderer){
  previous?.call(this,shader,renderer);
  if(!shader.fragmentShader.includes('#include <envmap_physical_pars_fragment>'))throw Error('Weapon IBL hook missing after prior material hook');
  shader.uniforms.uWeaponViewToWorld=rotationUniform;
  shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',rotated);
 }
 function cacheKey(){return `${isDefault?oldKey:key?.call(this)??''}|${WEAPON_LIGHTING_REVISION}`}
 material.onBeforeCompile=hook;material.customProgramCacheKey=cacheKey;material.needsUpdate=true;
 return()=>{if(material.onBeforeCompile===hook)material.onBeforeCompile=previous;if(material.customProgramCacheKey===cacheKey)material.customProgramCacheKey=key;material.needsUpdate=true};
}

/** Fixed identity gun camera/scene, as in index.html. World cam can be nested.
 * Four finite reverse rays at <=10Hz: sun plus three sky directions. Reverse
 * casting sees exterior-facing single-sided roofs without mutating materials.
 * This is a shelter approximation, not per-pixel shadows/GI/local lamp copying.
 */
export function createWeaponLighting({T,gscene,cam,scene,sun,amb,solids=[],materials=[]}){
 const enabled=!!(cam&&scene&&sun&&amb),rotation={value:new T.Matrix3()},restorers=[];
 if(!enabled)return {update(){},info:()=>({enabled:false,reason:'world camera/lights not supplied'}),dispose(){}};
 const keys=gscene.children.filter(o=>o.isDirectionalLight),hemi=gscene.children.find(o=>o.isHemisphereLight);
 const key=keys[0]||new T.DirectionalLight(),fill=hemi||new T.HemisphereLight();
 const saved=[...keys,...(hemi?[hemi]:[])].map(o=>({o,intensity:o.intensity,color:o.color.clone(),ground:o.groundColor?.clone(),position:o.position.clone(),target:o.target,castShadow:o.castShadow}));
 if(!keys.length)gscene.add(key);if(!hemi)gscene.add(fill);
 const target=new T.Object3D();target.name='weapon-world-sun-target';gscene.add(target);key.target=target;key.castShadow=false;
 const envBase=materials.map(m=>m.envMapIntensity??1);
 for(const material of new Set(materials))if(material.isMeshStandardMaterial)restorers.push(installWeaponEnvironment(T,material,rotation));
 const ray=new T.Raycaster(),hits=[],q=new T.Quaternion(),inverseQ=new T.Quaternion(),rot4=new T.Matrix4();
 const eye=new T.Vector3(),dir=new T.Vector3(),lightPosition=new T.Vector3(),toTarget=new T.Vector3(),start=new T.Vector3(),back=new T.Vector3();
 const sky=[new T.Vector3(0,1,0),new T.Vector3(.55,.835,0).normalize(),new T.Vector3(-.55,.835,0).normalize()];
 const materialAt=h=>Array.isArray(h.object.material)?h.object.material[h.face?.materialIndex??0]:h.object.material;
 let countdown=0,visibility=1,skyVisibility=1,wantedSun=1,wantedSky=1,probes=0,rays=0,disposed=false,first=true;
 function blocked(direction,distance){
  start.copy(eye).addScaledVector(direction,distance);back.copy(direction).negate();ray.set(start,back);ray.near=.02;ray.far=distance-.025;hits.length=0;rays++;
  // Existing terrain DDA/cabin finite proxies remain authoritative. No
  // manufactured AABB hits and no edits to the shared solids list/materials.
  ray.intersectObjects(solids,true,hits);
  for(const h of hits){
   // Membership in solids, NOT render visibility, is authoritative. Village
   // walls/roof/cover deliberately use invisible MeshBasic shot shells. The
   // cabin proxy instead returns actual meshes, including transparent glass.
   const m=materialAt(h);if(m?.visible!==false&&m?.transparent&&m.opacity<.65)continue;
   return true;
  }return false;
 }
 function update(dt){
  if(disposed)return;dt=seconds(dt);cam.updateWorldMatrix(true,false);cam.getWorldPosition(eye);cam.getWorldQuaternion(q);inverseQ.copy(q).invert();
  rotation.value.setFromMatrix4(rot4.makeRotationFromQuaternion(q));
  sun.getWorldPosition(lightPosition);sun.target.getWorldPosition(toTarget);dir.copy(lightPosition).sub(toTarget).normalize();
  countdown-=dt;
  if(countdown<=0){
   countdown=WEAPON_LIGHTING_LIMITS.probeInterval;probes++;
   wantedSun=dir.lengthSq()>0&&!blocked(dir,WEAPON_LIGHTING_LIMITS.sunRange)?1:0;
   wantedSky=sky.reduce((n,d)=>n+(!blocked(d,WEAPON_LIGHTING_LIMITS.skyRange)?1:0),0)/sky.length;
   if(first){visibility=wantedSun;skyVisibility=wantedSky;first=false}
  }
  const smooth=1-Math.exp(-dt*14);visibility+=(wantedSun-visibility)*smooth;skyVisibility+=(wantedSky-skyVisibility)*smooth;
  for(const other of keys)if(other!==key)other.intensity=0;
  key.position.copy(dir).applyQuaternion(inverseQ);target.position.set(0,0,0);target.updateMatrixWorld(true);
  key.color.copy(sun.color);key.intensity=sun.intensity*visibility;
  amb.getWorldPosition(lightPosition);if(lightPosition.lengthSq()<1e-10)lightPosition.set(0,1,0);
  fill.position.copy(lightPosition).normalize().applyQuaternion(inverseQ);fill.color.copy(amb.color);fill.groundColor.copy(amb.groundColor);
  fill.intensity=amb.intensity*(.45+.55*skyVisibility);
  gscene.environment=scene.environment;
  for(let i=0;i<materials.length;i++)materials[i].envMapIntensity=envBase[i]*(.45+.55*skyVisibility);
 }
 return {update,uniforms:{uWeaponViewToWorld:rotation},info(){return {enabled:true,revision:WEAPON_LIGHTING_REVISION,probeHz:10,probeRays:4,probes,rays,sunVisibility:visibility,skyVisibility,keyIntensity:key.intensity,hemisphereIntensity:fill.intensity,sunViewDirection:key.position.toArray(),skyViewDirection:fill.position.toArray(),environmentMatchesWorld:gscene.environment===scene.environment,environmentRotation:rotation.value.elements.slice(),materials:materials.map((m,i)=>({name:m.name,environmentBase:envBase[i],environment:m.envMapIntensity,roughnessFloor:m.userData.weaponRoughnessFloor??null})),extraDrawCalls:0,extraShadowLights:0,localPointLights:0,limitations:'Camera-position shelter probes, not per-pixel shadows; sky approximated by 3 directions. No room-light or lightning copy. Fixed identity gun camera/scene required.'}},
  dispose(){if(disposed)return;disposed=true;restorers.forEach(f=>f());materials.forEach((m,i)=>m.envMapIntensity=envBase[i]);target.removeFromParent();if(!keys.length)key.removeFromParent();if(!hemi)fill.removeFromParent();for(const s of saved){s.o.intensity=s.intensity;s.o.color.copy(s.color);s.o.position.copy(s.position);s.o.castShadow=s.castShadow;if(s.ground)s.o.groundColor.copy(s.ground);if(s.target)s.o.target=s.target}}
 };
}

export function weaponFlashEnvelope(age){
 if(!Number.isFinite(age)||age<0||age>=.085)return 0;
 return age<.022?1:Math.pow(1-(age-.022)/.063,1.7);
}
export function createWeaponFlash(T,gun,light){
 const positions=[],uv=[],edge=[],part=[];
 // End-on axial cards vanish behind the barrel/front sight. This small,
 // irregular seven-lobed cap has actual transverse area, 11-14cm ahead of the
 // unchanged socket. Keep real depth testing, rather than overlaying the gun.
 const radii=[.101,.032,.079,.037,.108,.029,.088,.034,.096,.027,.076,.036,.104,.031];
 const ring=radii.map((r,i)=>{const a=i*Math.PI*2/radii.length+.13;return [Math.cos(a)*r,Math.sin(a)*r,-.125-.014*Math.sin(i*2.1)]});
 for(let i=0;i<ring.length;i++){
  for(const [p,e]of [[[0,0,-.11],0],[ring[i],1],[ring[(i+1)%ring.length],1]]){positions.push(...p);uv.push(.5+p[0]/.216,.5+p[1]/.216);edge.push(e);part.push(0)}
 }
 // Two short axial petals keep side/profile continuity; no long flame jet.
 for(let i=0;i<2;i++){
  const a=i*Math.PI/2+.4,c=Math.cos(a),s=Math.sin(a),w=.035;
  const quad=[[-w*c,-w*s,-.015],[w*c,w*s,-.015],[w*c,w*s,-.19],[-w*c,-w*s,-.19]];
  for(const j of [0,1,2,0,2,3]){positions.push(...quad[j]);uv.push(...[[0,0],[1,0],[1,1],[0,1]][j]);edge.push(0);part.push(1)}
 }
 // Fixed upper-side gas lobes clear the ADS receiver silhouette while their
 // roots remain at the bore. Only these narrow tongues extend beyond the
 // compact core; do not enlarge the whole star or disable weapon depth tests.
 for(const a of [Math.PI/6,5*Math.PI/6]){
  const c=Math.cos(a),s=Math.sin(a),point=(r,w,z)=>[c*r-s*w,s*r+c*w,z];
  const center=point(.17,0,-.12),outline=[point(.035,0,-.02),point(.17,.018,-.125),point(.205,0,-.155),point(.17,-.018,-.125)];
  for(let i=0;i<4;i++)for(const [p,e]of [[center,0],[outline[i],1],[outline[(i+1)%4],1]]){
   positions.push(...p);uv.push(.5+p[0]/.216,.5+p[1]/.216);edge.push(e);part.push(0);
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
 geometry.setAttribute('flashEdge',new T.Float32BufferAttribute(edge,1));geometry.setAttribute('flashPart',new T.Float32BufferAttribute(part,1));geometry.computeBoundingBox();
 const uniforms={uFlash:{value:0},uVariation:{value:0}};
 const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
  vertexShader:'attribute float flashEdge;attribute float flashPart;varying vec2 vUv;varying float vEdge;varying float vPart;void main(){vUv=uv;vEdge=flashEdge;vPart=flashPart;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec2 vUv;varying float vEdge;varying float vPart;uniform float uFlash;uniform float uVariation;
   void main(){float a,t;
    if(vPart<.5){vec2 q=(vUv-.5)*2.;t=clamp(length(q),0.,1.);a=1.-smoothstep(.48,1.,vEdge);
     a*=mix(.82,1.,sin(q.x*27.+q.y*17.+uVariation)*.5+.5)*mix(.62,1.,smoothstep(-.9,.5,q.y+q.x*.35*sin(uVariation)));
    }else{float taper=mix(.30,.78,sin(vUv.y*3.14159));float x=abs(vUv.x-.5)*2.;
     a=(1.-smoothstep(taper*.35,taper,x))*(1.-smoothstep(.35,1.,vUv.y))*.65;t=vUv.y;
    }
    gl_FragColor=vec4(mix(vec3(2.6,2.3,1.7),vec3(1.9,.62,.05),smoothstep(.18,.8,t)),min(a*uFlash*1.15,1.));}`});
 material.forceSinglePass=true;
 const mesh=new T.Mesh(geometry,material);mesh.name='mp5-socket-muzzle-flash';mesh.position.set(0,.005,-1.85);mesh.frustumCulled=false;mesh.visible=false;gun.add(mesh);
 if(light)light.castShadow=false;
 let age=Infinity,justFired=false,shots=0,blocked=0,disposed=false;
 function reset(){age=Infinity;justFired=false;mesh.visible=false;uniforms.uFlash.value=0;if(light)light.intensity=0}
 return {shot(event={}){if(disposed)return;if(event.muzzle===null){blocked++;reset();return}age=0;justFired=true;shots++;uniforms.uVariation.value=(shots*2.39996)%6.283185},
  update(dt){if(disposed)return;if(justFired)justFired=false;else age+=seconds(dt);const pulse=weaponFlashEnvelope(age);uniforms.uFlash.value=pulse;mesh.visible=pulse>.008;if(light)light.intensity=3.4*pulse},reset,
  info:()=>({revision:'compact-radial-flare-v3-ads-lobes',shots,suppressed:blocked,age:Number.isFinite(age)?age:null,visible:mesh.visible,envelope:uniforms.uFlash.value,duration:.085,fullIntensity:.022,triangles:26,drawCalls:1,lightPeak:3.4,maxRadius:.205,coreRadius:.108,forwardLength:.19,upperSideLobes:2,lobeAnglesDegrees:[30,150],randomMeshRotation:false,light:'existing no-shadow muzzle PointLight; no new light',socket:[0,.005,-1.85]}),
  dispose(){if(disposed)return;reset();disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose()}
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
