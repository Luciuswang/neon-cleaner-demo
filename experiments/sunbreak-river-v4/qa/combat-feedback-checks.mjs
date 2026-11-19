// CPU only. Import real pinned Three/loaders without loading textures or using
// a browser/server/GPU. Prints evidence; deliberately writes no QA report.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
const vendor=new URL('../../sunbreak-storm-v3/vendor/presentation/',import.meta.url);
registerHooks({resolve(spec,context,next){
 if(spec==='three')return next(new URL('build/three.module.js',vendor).href,context);
 if(spec.startsWith('three/addons/'))return next(new URL('examples/jsm/'+spec.slice(13),vendor).href,context);
 return next(spec,context);
}});
const T=await import('three');
const GameplayT=await import('../../sunbreak-storm-v3/vendor/three/build/three.module.js');
const {buildWeapon,createWeaponLighting,installWeaponEnvironment,installWeaponRoughness,createWeaponFlash,weaponFlashEnvelope,WEAPON_LIGHTING_LIMITS}=await import('../weapon.js');
const {buildCombatFeedback,combatEventFromIntersection,normalizeCombatHit,combatMaterialKind,COMBAT_FEEDBACK_LIMITS}=await import('../combat-feedback.js');
const root=new URL('../',import.meta.url),texts={},sources={},checks=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const path of ['weapon.js','combat-feedback.js','qa/combat-feedback-checks.mjs','reload-pose.js','combat-controls.js','village.js','index.html','world.js']){
 const bytes=await readFile(new URL(path,root));texts[path]=bytes.toString('utf8');sources[path]=hash(bytes);
}
// Decode original meshopt geometry only. Texture image decoding is replaced
// explicitly, in memory, so no Image/browser/network/GPU is involved. This is
// geometric occlusion evidence, never a texture/render acceptance shortcut.
const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
const {MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
const sourceGLB=await readFile(new URL('../../sunbreak-storm-v3/assets/mp5/mp5a5.glb',import.meta.url));
sources['source-mp5a5.glb']=hash(sourceGLB);
const cpuLoader=new GLTFLoader();cpuLoader.setMeshoptDecoder(MeshoptDecoder);
cpuLoader.register(()=>({name:'EXT_texture_webp',loadTexture:()=>Promise.resolve(new T.Texture())}));
const sourceModel=(await cpuLoader.parseAsync(sourceGLB.buffer.slice(sourceGLB.byteOffset,sourceGLB.byteOffset+sourceGLB.byteLength),'')).scene;
function check(name,fn){try{const evidence=fn();checks.push({name,pass:true,...evidence===undefined?{}:{evidence}})}catch(error){checks.push({name,pass:false,error:error.stack})}}
const close=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const closeVec=(a,b,e=1e-8)=>{for(const k of ['x','y','z'])close(a[k],b[k],e)};
const normalizedHash=s=>hash(s.replace(/\r\n/g,'\n').trim());
const finite=a=>Array.from(a).every(Number.isFinite);
function lightingFixture(Three=T){
 const scene=new Three.Scene(),gscene=new Three.Scene(),cam=new Three.PerspectiveCamera(),sun=new Three.DirectionalLight(0xffe6c0,4),amb=new Three.HemisphereLight(0xbecdeb,0x77634d,1.6);
 const key=new Three.DirectionalLight(0xffffff,2),fill=new Three.DirectionalLight(0xbbccee,.8),hemi=new Three.HemisphereLight(0xffffff,0x112233,1);
 sun.position.set(0,10,0);amb.position.set(0,10,0);scene.add(cam,sun,sun.target,amb);gscene.add(key,fill,hemi);
 const steel=new T.MeshStandardMaterial({envMapIntensity:.72}),arms=new T.MeshStandardMaterial({envMapIntensity:.28}),solids=[];
 const lighting=createWeaponLighting({T,gscene,cam,scene,sun,amb,solids,materials:[steel,arms]});
 return {scene,gscene,cam,sun,amb,key,fill,hemi,steel,arms,solids,lighting};
}
function shotFixture(){const world=new T.Group(),fx=buildCombatFeedback({T,world});return {world,fx,root:world.children[0]}}
const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const hit=(kind='stone')=>({hit:true,point:vec(1,1,-4),normal:vec(0,0,1),direction:vec(0,0,-1),kind});

check('module imports and exact sleeve/reload/control invariants remain pinned',()=>{
 assert.equal(typeof buildWeapon,'function');
 const weaponText=texts['weapon.js'].replace(/\r\n/g,'\n');
 assert.equal(hash(weaponText.slice(0,weaponText.indexOf('export function createWeaponFlash'))),'48ea17ea5a04e1aed1e65c093da571300a5f94ce31f7bb6b62fcabd86318f78e','bounded flash patch must not change loader, fit, rig, materials or lighting');
 assert.equal(sources['source-mp5a5.glb'],'90f223cbd44a75463a09b5cefaa594cbc8a61276ce31ba0b0734c8735701e1da','source mesh and embedded texture bytes must remain exact');
 assert.equal(normalizedHash(texts['weapon.js'].slice(texts['weapon.js'].indexOf('function repairLeftSleeve'))),'dac1b1a62fe230e31f08e540db2c876e9c8d2ffcbfb4878a45fe6e37a1aee698');
 assert.equal(normalizedHash(texts['reload-pose.js']),'d7d443f8adf81b0d9f3d6dcc01bb6ef7753f9900c9db639a3a6feb649fbc7097');
 assert.equal(normalizedHash(texts['combat-controls.js']),'6184483143c891568980f1b0fd7d82ddd66d962ff11bf4de9717091cd8eb43bb');
 assert.match(texts['weapon.js'],/displayScale=1\.70/);assert.ok(texts['weapon.js'].includes('fit.position.set(-sourceMuzzle.x*displayScale,.005-sourceMuzzle.y*displayScale,-1.85-sourceMuzzle.z*displayScale)'));
 assert.ok(texts['weapon.js'].includes('reloadPose.update(state.reload)'));assert.ok(texts['weapon.js'].includes('charging.position.copy(chargeHome)'));
 assert.doesNotMatch(texts['combat-feedback.js'],/new T\.Raycaster|fetch\(|addEventListener|\.hp\s*[-+]?=|S\.mag|S\.next/);
 return {heldSleeve:'exact normalized SHA256 unchanged',reload:'unchanged',controls:'105ms cadence / 2.25s reload unchanged'};
});
check('IBL patch covers both r160 PMREM directions and composes prior hooks/cache keys',()=>{
 for(const Three of [T,GameplayT]){
  const material=new Three.MeshStandardMaterial(),uniform={value:new T.Matrix3()},renderer={},sentinel={value:42};let calls=0;
  material.onBeforeCompile=function(s,r){assert.equal(this,material);assert.equal(r,renderer);calls++;s.uniforms.previous=sentinel};
  const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey();
  const restore=installWeaponEnvironment(T,material,uniform),s={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(s,renderer);assert.equal(calls,1);assert.equal(s.uniforms.previous,sentinel);assert.equal(s.uniforms.uWeaponViewToWorld,uniform);
  assert.ok(s.fragmentShader.includes('textureCubeUV( envMap, uWeaponViewToWorld * worldNormal, 1.0 )'));
  assert.ok(s.fragmentShader.includes('textureCubeUV( envMap, uWeaponViewToWorld * reflectVec, roughness )'));
  assert.ok(material.customProgramCacheKey().startsWith(oldKey+'|'));assert.ok(s.vertexShader.includes('#include <skinning_vertex>'));
  assert.ok(s.fragmentShader.includes('#include <normal_fragment_maps>'));assert.ok(s.fragmentShader.includes('#include <alphatest_fragment>'));
  restore();assert.equal(material.onBeforeCompile,previous);assert.equal(material.customProgramCacheKey(),oldKey);
 }
 const m=new T.MeshStandardMaterial();m.userData.key='a';m.customProgramCacheKey=function(){return this.userData.key};installWeaponEnvironment(T,m,{value:new T.Matrix3()});const old=m.customProgramCacheKey();m.userData.key='b';assert.notEqual(m.customProgramCacheKey(),old);
 assert.throws(()=>installWeaponEnvironment({...T,ShaderChunk:{}},new T.MeshStandardMaterial(),{}),/revalidation/);
});
check('final roughness floor follows ORM multiplication, preserves authored texture variation and composes with IBL',()=>{
 for(const floor of [.78,.48]){
  const m=new T.MeshStandardMaterial(),map=new T.Texture(),uniform={value:new T.Matrix3()};m.roughnessMap=map;m.roughness=floor===.78?.83:1;
  const original=m.onBeforeCompile,restoreRoughness=installWeaponRoughness(T,m,floor),restoreIBL=installWeaponEnvironment(T,m,uniform);
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader,{});
  const clamp=`roughnessFactor=max(roughnessFactor,${floor.toFixed(4)});`;
  assert.ok(shader.fragmentShader.indexOf(clamp)>shader.fragmentShader.indexOf('#include <roughnessmap_fragment>'));
  assert.ok(shader.fragmentShader.indexOf(clamp)<shader.fragmentShader.indexOf('#include <lights_physical_fragment>'));
  assert.equal(shader.uniforms.uWeaponViewToWorld,uniform);assert.equal(m.roughnessMap,map);assert.equal(m.userData.weaponRoughnessFloor,floor);
  for(const mapValue of [0,.01,.1,.5,.9,1]){const effective=Math.max(m.roughness*mapValue,floor);assert.ok(effective>=floor);if(m.roughness*mapValue>floor)close(effective,m.roughness*mapValue)}
  assert.ok(m.customProgramCacheKey().includes(`weapon-final-roughness-${floor}`));restoreIBL();restoreRoughness();assert.equal(m.onBeforeCompile,original);
 }
 assert.ok(texts['weapon.js'].includes("m.envMapIntensity=m.name==='arms'?.28:.65"));
});
check('world light and IBL transforms preserve lighting under nested camera yaw pitch roll',()=>{
 const f=lightingFixture(GameplayT),parent=new GameplayT.Group();f.scene.add(parent);parent.add(f.cam);parent.position.set(-20,2,6);parent.rotation.set(.2,-.4,.1);
 const direction=vec(3,8,-7).normalize();f.sun.position.copy(direction).multiplyScalar(75);const localNormal=vec(.3,.5,1).normalize();let samples=0;
 for(const [yaw,pitch,roll]of [[0,0,0],[Math.PI/2,.4,-.1],[Math.PI,-.6,.2],[-2,1,.5]]){
  f.cam.rotation.set(pitch,yaw,roll,'YXZ');f.lighting.update(.1);
  const q=f.cam.getWorldQuaternion(new T.Quaternion()),sunLocal=direction.clone().applyQuaternion(q.clone().invert());closeVec(f.key.position,sunLocal);
  closeVec(f.hemi.position,vec(0,1,0).applyQuaternion(q.clone().invert()));
  const worldNormal=localNormal.clone().applyQuaternion(q),lookup=localNormal.clone().applyMatrix3(f.lighting.uniforms.uWeaponViewToWorld.value);closeVec(lookup,worldNormal);
  close(f.key.position.dot(localNormal),direction.dot(worldNormal));samples++;
 }f.lighting.dispose();return {orientations:samples,crossThreeCopies:true};
});
check('weather/color/environment update without shader recompile or unowned world edits',()=>{
 const f=lightingFixture(),envA=new T.Texture(),envB=new T.Texture(),version=f.steel.version;
 f.scene.environment=envA;f.lighting.update(0);assert.equal(f.gscene.environment,envA);close(f.key.intensity,4);close(f.hemi.intensity,1.6);close(f.fill.intensity,0);
 f.scene.environment=envB;f.sun.intensity=1.8;f.amb.intensity=.38;f.sun.color.set(0xaaccff);f.amb.groundColor.set(0x443322);f.lighting.update(0);
 assert.equal(f.gscene.environment,envB);close(f.key.intensity,1.8);close(f.hemi.intensity,.38);assert.ok(f.key.color.equals(f.sun.color));assert.ok(f.hemi.groundColor.equals(f.amb.groundColor));
 assert.equal(f.steel.version,version);close(f.steel.envMapIntensity,.72);close(f.arms.envMapIntensity,.28);close(f.sun.intensity,1.8);f.lighting.dispose();
 close(f.key.intensity,2);close(f.fill.intensity,.8);close(f.hemi.intensity,1);assert.equal(f.gscene.children.length,3);
});
check('authoritative invisible village roof and cover occlude (render invisibility never skips shells)',()=>{
 assert.match(texts['village.js'],/MeshBasicMaterial\(\{ visible: false \}\)/);
 const f=lightingFixture();const roof=new T.Mesh(new T.BoxGeometry(20,.12,20),new T.MeshBasicMaterial({visible:false}));roof.position.set(0,3,0);roof.userData={houseId:'proof',roof:true};f.scene.add(roof);f.solids.push(roof);f.scene.updateMatrixWorld(true);
 const originalMaterials=[roof.material.visible,roof.material.side,roof.visible],length=f.solids.length;f.lighting.update(0);
 close(f.lighting.info().sunVisibility,0);close(f.lighting.info().skyVisibility,0);close(f.key.intensity,0);close(f.hemi.intensity,1.6*.45);close(f.steel.envMapIntensity,.72*.45);
 assert.equal(f.solids.length,length);assert.deepEqual([roof.material.visible,roof.material.side,roof.visible],originalMaterials);
 roof.visible=false;f.lighting.update(.1);close(f.lighting.info().sunVisibility,0);
 roof.position.x=50;roof.updateMatrixWorld(true);for(let i=0;i<20;i++)f.lighting.update(.1);assert.ok(f.key.intensity>3.99);assert.ok(f.steel.envMapIntensity>.719);
 f.lighting.dispose();return {invisibleAuthoritativeShell:true,shelterAndExit:true};
});
check('single-sided roof, glass and finite probe range distinguish actual blockers',()=>{
 const f=lightingFixture(),plane=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshBasicMaterial());plane.rotation.x=-Math.PI/2;plane.position.y=3;f.scene.add(plane);f.solids.push(plane);f.scene.updateMatrixWorld(true);f.lighting.update(0);close(f.key.intensity,0);
 plane.material.transparent=true;plane.material.opacity=.2;for(let i=0;i<20;i++)f.lighting.update(.1);assert.ok(f.key.intensity>3.99);
 plane.material.opacity=1;plane.position.y=101;plane.updateMatrixWorld(true);for(let i=0;i<20;i++)f.lighting.update(.1);assert.ok(f.key.intensity>3.99);f.lighting.dispose();
});
check('probe budget is bounded at normal and stalled frame rates; freeze has no extra ray work',()=>{
 const f=lightingFixture();let calls=0;const spy=new T.Object3D();spy.raycast=ray=>{calls++;assert.ok(Number.isFinite(ray.far));assert.ok(ray.far<=WEAPON_LIGHTING_LIMITS.sunRange);assert.ok(ray.near>0)};f.solids.push(spy);
 f.lighting.update(0);assert.equal(calls,4);for(let i=0;i<60;i++)f.lighting.update(0);assert.equal(calls,4);
 for(let i=0;i<600;i++)f.lighting.update(1/60);assert.ok(calls<=404);assert.equal(f.lighting.info().rays,calls);
 const before=calls;f.lighting.update(30);assert.equal(calls-before,4,'no catch-up ray burst after stall');f.lighting.dispose();return {raysOver10s:calls-4,perTick:4};
});
check('explicit flash survives first update and several frames; no baseline intensity feedback loop',()=>{
 const gun=new T.Group(),light=new T.PointLight(0xffaa55,0,4);gun.add(light);const flash=createWeaponFlash(T,gun,light);
 flash.shot();flash.update(1/30);assert.equal(flash.info().envelope,1);assert.equal(light.intensity,3.4);assert.equal(flash.info().shots,1);
 flash.update(1/60);assert.equal(flash.info().envelope,1);flash.update(1/60);assert.ok(flash.info().envelope>.6);flash.update(.1);assert.equal(flash.info().visible,false);assert.equal(light.intensity,0);
 light.intensity=5;flash.update(0);assert.equal(flash.info().visible,false);assert.equal(flash.info().shots,1);assert.equal(light.intensity,0);
 flash.shot({muzzle:null});flash.update(0);assert.equal(flash.info().visible,false);assert.equal(flash.info().suppressed,1);
 flash.shot();flash.update(0);flash.reset();assert.equal(flash.info().visible,false);assert.equal(light.intensity,0);
 const mesh=gun.children.find(o=>o.isMesh);assert.deepEqual(mesh.position.toArray(),[0,.005,-1.85]);assert.equal(mesh.material.forceSinglePass,true);assert.equal(mesh.geometry.attributes.position.count/3,26);assert.equal(light.castShadow,false);
 assert.equal(mesh.material.depthTest,true);assert.ok(flash.info().forwardLength<.20);assert.equal(flash.info().maxRadius,.205);assert.equal(flash.info().coreRadius,.108);assert.equal(flash.info().lightPeak,3.4);
 const attributes=Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([k,a])=>[k,Array.from(a.array)])),startVariation=mesh.material.uniforms.uVariation.value;
 for(let i=0;i<20;i++){flash.shot();flash.update(0);assert.equal(mesh.rotation.z,0);assert.equal(flash.info().randomMeshRotation,false)}
 assert.notEqual(mesh.material.uniforms.uVariation.value,startVariation);
 for(const [k,a]of Object.entries(mesh.geometry.attributes))assert.deepEqual(Array.from(a.array),attributes[k],'shots vary shader flicker, never rotate/deform the fixed lobe geometry');
 for(let i=0;i<mesh.geometry.attributes.position.count;i++){const p=mesh.geometry.attributes.position;assert.ok(Math.hypot(p.getX(i),p.getY(i))<=.2050001);assert.ok(p.getZ(i)<0&&p.getZ(i)>=-.1900001)}
 flash.dispose();flash.dispose();assert.deepEqual(gun.children,[light]);assert.equal(weaponFlashEnvelope(NaN),0);assert.equal(weaponFlashEnvelope(-1),0);
});
check('fixed upper-side lobes clear actual decoded weapon and repaired arms in 100 aim/recoil/bob poses',()=>{
 const source=sourceModel,gun=new T.Group(),fit=new T.Group(),socket=source.getObjectByName('MuzzleSocket');source.updateMatrixWorld(true);
 const sourceMuzzle=source.worldToLocal(socket.getWorldPosition(vec())),body=source.getObjectByName('Body'),bodyBounds=new T.Box3().setFromObject(body);
 close(sourceMuzzle.z,bodyBounds.min.z,1e-7);
 // Use the exact pinned held-arm repair, not a substitute collider. This
 // invokes only the already-hashed function in memory; no asset/file edits.
 const repair=Function('return ('+texts['weapon.js'].slice(texts['weapon.js'].indexOf('function repairLeftSleeve'))+')')();repair(T,source);
 function sourceSnapshot(){const meshes=[],materials=new Set(),bytes=a=>{const array=a.isInterleavedBufferAttribute?a.data.array:a.array;return hash(new Uint8Array(array.buffer,array.byteOffset,array.byteLength))};
  source.traverse(o=>{if(!o.isMesh)return;meshes.push({name:o.name,index:o.geometry.index?bytes(o.geometry.index):null,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,a])=>[k,{hash:bytes(a),itemSize:a.itemSize,normalized:a.normalized}]))});for(const m of [].concat(o.material))materials.add(m)});
  return {meshes,materials:[...materials].map(m=>({uuid:m.uuid,color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),maps:Object.fromEntries(Object.entries(m).filter(([,t])=>t?.isTexture).map(([k,t])=>[k,{uuid:t.uuid,source:t.source.uuid,version:t.version,channel:t.channel,colorSpace:t.colorSpace,wrapS:t.wrapS,wrapT:t.wrapT,offset:t.offset.toArray(),repeat:t.repeat.toArray(),flipY:t.flipY}]))}))};
 }
 const untouched=sourceSnapshot();
 source.scale.setScalar(1.7);fit.position.set(-sourceMuzzle.x*1.7,.005-sourceMuzzle.y*1.7,-1.85-sourceMuzzle.z*1.7);fit.add(source);gun.add(fit);
 const flash=createWeaponFlash(T,gun,null),mesh=gun.getObjectByName('mp5-socket-muzzle-flash'),p=mesh.geometry.attributes.position,ray=new T.Raycaster(),proof=[];
 const rayObjects=[];source.traverse(o=>{if(o.isMesh)rayObjects.push(o)});
 for(const aim of [0,.5,.85,1])for(const recoil of [0,.25,.5,.75,1])for(const bob of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]){
  gun.position.set(.27-aim*.27,-.24+Math.sin(bob)*.012+aim*.09,-.83+recoil*.1);gun.rotation.set(recoil*.16+Math.sin(bob*.5)*.01,.1-aim*.1,Math.cos(bob)*.014-aim*.014);gun.scale.setScalar(.78);
  flash.shot();flash.update(0);gun.updateMatrixWorld(true);
  const actual=gun.worldToLocal(socket.getWorldPosition(vec()));closeVec(actual,vec(0,.005,-1.85));
  assert.equal(mesh.rotation.z,0);assert.equal(mesh.material.depthTest,true);
  let visible=0,samples=0,projectedArea=0;const camera=new T.PerspectiveCamera(52,16/9,.01,10);camera.updateMatrixWorld();
  // Appended triangles 18..25 are the two proposed four-triangle lobes. Test
  // their nontransparent interior, not alpha-zero tips or a proxy shape.
  for(let i=18;i<26;i++){
   const a=vec().fromBufferAttribute(p,i*3),b=vec().fromBufferAttribute(p,i*3+1),c=vec().fromBufferAttribute(p,i*3+2);
   for(const w of [[.45,.275,.275],[.6,.2,.2],[.25,.375,.375]]){
    const sample=a.clone().multiplyScalar(w[0]).addScaledVector(b,w[1]).addScaledVector(c,w[2]);mesh.localToWorld(sample);
    ray.set(vec(),sample.clone().normalize());ray.near=.001;ray.far=sample.length()-.0001;samples++;
    if(ray.intersectObjects(rayObjects,false).length===0)visible++;
   }
   [a,b,c].forEach(q=>mesh.localToWorld(q).project(camera));projectedArea+=Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))*.5;
  }
  assert.ok(visible>0,`fixed lobes hidden behind actual weapon/arms: aim=${aim} recoil=${recoil} bob=${bob}`);
  assert.ok(projectedArea>0,'flare collapsed end-on');proof.push({aim,recoil,bob,visibleLobeSamples:visible,total:samples,projectedAreaNDC:projectedArea});
 }
 assert.deepEqual(sourceSnapshot(),untouched,'flash creation/shots must preserve all source index/attribute bytes, material values and texture bindings');
 flash.dispose();source.removeFromParent();return {socketMatchesActualBarrelTip:true,poses:proof.length,samplesPerPose:24,minimumVisibleSamples:Math.min(...proof.map(p=>p.visibleLobeSamples)),fullyOccludedPoses:proof.filter(p=>p.visibleLobeSamples===0),ADSVisibleRange:[Math.min(...proof.filter(p=>p.aim===1).map(p=>p.visibleLobeSamples)),Math.max(...proof.filter(p=>p.aim===1).map(p=>p.visibleLobeSamples))],representative:proof.filter(p=>p.bob===0&&[0,1].includes(p.aim)&&[0,1].includes(p.recoil)),sourceArraysAndTextureBindings:'exactly preserved',limitation:'CPU geometric visibility only; center remains depth-occluded. GPU flash/readability and continuous-motion acceptance belong to root.'};
});
check('finite normalized hit validation, facing normal and no input mutation',()=>{
 const event=hit();event.normal.set(0,0,-3);const before=JSON.stringify(event),n=normalizeCombatHit(T,event);assert.ok(n);closeVec(n.normal,vec(0,0,1));assert.equal(JSON.stringify(event),before);
 for(const e of [{}, {...hit(),hit:false},{...hit(),point:vec(NaN,0,0)},{...hit(),normal:vec()},{...hit(),normal:vec(0,Infinity,0)}])assert.equal(normalizeCombatHit(T,e),null);
});
check('real first-hit adapter preserves point and inverse-transpose normals including instances',()=>{
 const parent=new T.Group();parent.position.set(3,2,-4);parent.rotation.set(.2,.7,-.1);parent.scale.set(1.5,.8,1.1);
 const mesh=new T.InstancedMesh(new T.BoxGeometry(),new T.MeshStandardMaterial({metalness:.7}),1),inst=new T.Matrix4().compose(vec(2,1,-1),new T.Quaternion().setFromEuler(new T.Euler(.3,.2,.4)),vec(.4,1.7,.8));mesh.setMatrixAt(0,inst);parent.add(mesh);parent.updateMatrixWorld(true);
 // InstancedMesh stores Float32 attributes, not the author's double matrix.
 const stored=new T.Matrix4();mesh.getMatrixAt(0,stored);
 const combined=mesh.matrixWorld.clone().multiply(stored),localNormal=vec(1,0,0),expected=localNormal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(combined));
 const point=vec(.5,0,0).applyMatrix4(combined),event=combatEventFromIntersection(T,{object:mesh,point,face:{normal:localNormal},instanceId:0},expected.clone().negate());
 assert.equal(event.hit,true);assert.equal(event.kind,'metal');closeVec(event.point,point);closeVec(event.normal,expected);assert.notEqual(event.point,point);assert.equal(event.object,mesh);
 const tangent=vec(0,1,0).transformDirection(combined);close(event.normal.dot(tangent),0);assert.equal(combatEventFromIntersection(T,{object:mesh,point,face:{normal:localNormal},instanceId:9},vec(0,0,-1)).hit,false);
 const front=new T.Mesh(new T.BoxGeometry(2,2,.1),new T.MeshStandardMaterial()),behind=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());front.position.z=-2;behind.position.z=-4;front.updateMatrixWorld();behind.updateMatrixWorld();
 const ray=new T.Raycaster(vec(),vec(0,0,-1),0,10),hits=ray.intersectObjects([behind,front]);assert.ok(hits.length>=2);const first=combatEventFromIntersection(T,hits[0],ray.ray.direction);assert.equal(first.object,front);close(first.point.z,-1.95,1e-7);assert.equal(combatEventFromIntersection(T,null,ray.ray.direction).hit,false);
});
check('material classification respects explicit event kind and metal wood soil water semantics',()=>{
 for(const [name,metal,kind]of [['Iron',.8,'metal'],['Timber',0,'wood'],['soil',0,'earth'],['water',0,'water'],['plaster',0,'stone']]){
  const object={name,material:{metalness:metal}};assert.equal(combatMaterialKind(object),kind);
  assert.equal(normalizeCombatHit(T,{...hit('actor'),object}).kind,'actor');
 }
 const object={material:[{name:'plank',metalness:0},{name:'steel',metalness:.8}]};assert.equal(combatMaterialKind(object,0),'wood');assert.equal(combatMaterialKind(object,1),'metal');
});
check('misses never spawn impacts, invalid hits never manufacture points, muzzle has separate suppression',()=>{
 const {fx}=shotFixture();fx.shot({hit:false,point:vec(0,0,-140),normal:vec(0,0,1)});assert.equal(fx.info().puffs.active,0);assert.equal(fx.info().flecks.active,0);
 fx.shot({hit:false,muzzle:vec(0,1,-1),direction:vec(0,0,-1)});assert.equal(fx.info().smoke,2);assert.equal(fx.info().puffs.active,2);assert.equal(fx.info().impacts,0);
 fx.reset();fx.shot({hit:true,muzzle:null,point:vec(),normal:vec()});assert.equal(fx.info().invalidHits,1);assert.equal(fx.info().puffs.active,0);
 fx.shot({...hit('metal'),muzzle:null});assert.equal(fx.info().impacts,1);assert.ok(fx.info().flecks.active>0);fx.dispose();
});
check('all surface effects start within 3cm of the exact hit, outgoing hemisphere and no decals',()=>{
 const proof=[];
 for(const kind of ['stone','wood','metal','earth','water','actor']){
  const {fx,root}=shotFixture(),event=hit(kind),before=JSON.stringify(event);fx.shot(event);
  for(const mesh of root.children){const g=mesh.geometry,p=g.attributes.fxCenter,n=g.attributes.fxNormal,c=g.attributes.fxContact;
   for(let i=0;i<g.instanceCount;i++){const center=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i),contact=new T.Vector3().fromBufferAttribute(c,i);closeVec(contact,event.point,1e-6);closeVec(normal,event.normal,1e-6);assert.ok(center.distanceTo(event.point)<=.03);assert.ok(center.sub(contact).dot(normal)>0)}
   assert.ok(mesh.material.fragmentShader.includes('dot(vFxWorld-vFxContact,vFxNormal)<.001'));
  }
  assert.equal(JSON.stringify(event),before);assert.equal(fx.info().decals,0);assert.equal(fx.info().kinds[kind],1);proof.push({kind,puffs:fx.info().puffs.active,flecks:fx.info().flecks.active});fx.dispose();
 }return proof;
});
check('stone wood earth water use normal blending; only metal sparks are additive',()=>{
 const {fx,root}=shotFixture();for(const kind of ['stone','wood','earth','water','actor'])fx.shot(hit(kind));assert.equal(fx.info().flecks.active,0);assert.ok(fx.info().puffs.active>0);
 assert.equal(root.children[0].material.blending,T.NormalBlending);assert.equal(root.children[1].material.blending,T.AdditiveBlending);fx.shot(hit('metal'));assert.ok(fx.info().flecks.active>0);fx.dispose();
});
check('bounded pools, lifetime expiry, zero-dt actual-event freeze and two single-pass beauty draws',()=>{
 const {fx,root}=shotFixture();for(let i=0;i<500;i++)fx.shot({...hit(i%2?'metal':'stone'),muzzle:vec(0,1,0)});
 const evidence=fx.info();assert.equal(root.children.length,2);assert.ok(evidence.puffs.active<=COMBAT_FEEDBACK_LIMITS.puffs);assert.ok(evidence.flecks.active<=COMBAT_FEEDBACK_LIMITS.flecks);assert.ok(evidence.puffs.overwritten>0);assert.ok(evidence.drawCalls<=2);
 const initial=root.children.map(m=>Array.from(m.geometry.attributes.fxCenter.array));fx.update(0);root.children.forEach((m,i)=>assert.deepEqual(Array.from(m.geometry.attributes.fxCenter.array),initial[i]));
 for(const m of root.children){assert.equal(m.material.forceSinglePass,true);assert.equal(m.material.depthTest,true);assert.equal(m.material.depthWrite,false);assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);assert.ok(finite(m.geometry.attributes.fxCenter.array))}
 fx.update(COMBAT_FEEDBACK_LIMITS.maxLifetime+.01);assert.equal(fx.info().drawCalls,0);assert.equal(fx.info().puffs.active,0);assert.equal(fx.info().flecks.active,0);fx.dispose();
 return {maxTriangles:2*(COMBAT_FEEDBACK_LIMITS.puffs+COMBAT_FEEDBACK_LIMITS.flecks),maxDraws:2,flashTriangles:26,decals:0,overflow:'oldest circular slot replaced, never pool growth'};
});
check('particle flight stays finite, ends at source plane, deterministic replay and no per-shot objects',()=>{
 const a=shotFixture(),b=shotFixture();const event=hit();event.normal.set(0,1,0);event.point.set(0,0,0);event.direction.set(0,-1,0);
 const childCount=a.root.children.length;
 for(let i=0;i<15;i++){
  a.fx.shot(event);b.fx.shot(event);a.fx.update(1/60);b.fx.update(1/60);
  a.root.children.forEach((mesh,j)=>{const g=mesh.geometry;for(const name of Object.keys(g.attributes))assert.deepEqual(Array.from(g.attributes[name].array),Array.from(b.root.children[j].geometry.attributes[name].array));
   for(let n=0;n<g.instanceCount;n++){assert.ok(g.attributes.fxCenter.getY(n)>=.003-1e-6);assert.ok(finite(g.attributes.fxShape.array))}
  });
 }
 assert.equal(a.root.children.length,childCount);a.fx.update(Infinity);a.fx.update(NaN);a.fx.update(-1);
 a.fx.reset();assert.equal(a.fx.info().drawCalls,0);a.fx.dispose();a.fx.dispose();assert.equal(a.world.children.length,0);assert.deepEqual(a.fx.shot(hit()),{accepted:false,reason:'disposed'});b.fx.dispose();
});
check('effect shaders retain distance fog and root-independent reflected-camera orientation',()=>{
 const {fx,root}=shotFixture();
 for(const mesh of root.children){const m=mesh.material;
  assert.ok(m.vertexShader.includes('viewMatrix*vec4(vFxWorld,1.)'));assert.doesNotMatch(m.vertexShader,/modelMatrix\s*\*/);
  assert.ok(m.fragmentShader.includes('#include <fog_fragment>'));assert.ok(m.vertexShader.includes('#include <fog_vertex>'));assert.ok(m.uniforms.fogColor);assert.equal(m.fog,true);
 }
 assert.equal(root.userData.heightFog,false);fx.dispose();
});
const failed=checks.filter(c=>!c.pass);
console.log(JSON.stringify({suite:'combat-feedback-cpu-v1',verdict:failed.length?'FAIL':'PASS',passed:checks.length-failed.length,total:checks.length,threeRevision:T.REVISION,sources,
 scope:'CPU imports, pinned rig/control code, actual Three math/raycast/material hooks, bounded particle state and shader-source checks. NOT GLSL driver compilation, GPU art/performance, actual controls or continuous animation acceptance.',checks},null,2));
if(failed.length)process.exitCode=1;
