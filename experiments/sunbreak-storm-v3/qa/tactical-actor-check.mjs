// Node numerical QA on the actual local GLB geometry/rig. Texture decoding and
// rendering are intentionally not covered; this is not a visual-quality pass.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/build/three.module.js';

const base=new URL('../',import.meta.url);
registerHooks({resolve(specifier,context,next){
 if(specifier==='three')return{url:new URL('vendor/presentation/build/three.module.js',base).href,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return{url:new URL('vendor/presentation/examples/jsm/'+specifier.slice(13),base).href,shortCircuit:true};
 return next(specifier,context);
}});
globalThis.ProgressEvent??=class extends Event{constructor(type,options){super(type);Object.assign(this,options)}};
const {GLTFLoader}=await import('../vendor/presentation/examples/jsm/loaders/GLTFLoader.js');
const {buildActors}=await import('../actors.js');
const glb=readFileSync(new URL('assets/soldier/soldier_tac.glb',base));
const jsonLength=glb.readUInt32LE(12),metadata=JSON.parse(glb.subarray(20,20+jsonLength));
const native=structuredClone(metadata),binary=glb.subarray(28+jsonLength);
// Preserve every accessor, skin, mesh and native transform. Only material image
// decode is omitted for Node; no synthetic skeleton or replacement geometry.
native.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
native.images=[];native.textures=[];native.materials=[];native.extensionsUsed=[];native.extensionsRequired=[];
for(const mesh of native.meshes)for(const p of mesh.primitives)delete p.material;
const originalLoad=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=function(url){
 assert.equal(url,'./assets/soldier/soldier_tac.glb');
 return this.parseAsync(JSON.stringify(native),'');
};
const scene=new T.Scene(),enemies=[];
function makeEnemy(x=0){
 const g=new T.Group(),wg2=new T.Group(),gunTip=new T.Object3D();
 g.position.x=x;wg2.position.set(.30,1.43,0);gunTip.position.set(0,.02,.92);wg2.add(gunTip);g.add(wg2);
 const e={g,wg2,gunTip,alive:true,hp:100,cd:1,warn:0,ph:.7,
  ll:new T.Group(),rl:new T.Group(),la:new T.Group(),ra:new T.Group(),
  tactical:{mode:'cover',stance:0,lean:0,speed:0,moveAngle:0,aimPitch:0,recoil:0,alert:0}};
 for(const l of [e.ll,e.rl,e.la,e.ra])g.add(l);
 scene.add(g);enemies.push(e);return e;
}
const e=makeEnemy(),e2=makeEnemy(5);
const actors=await buildActors({THREE:T,enemies});GLTFLoader.prototype.loadAsync=originalLoad;
const skin=e.g.getObjectByName('licensed-tactical-display');
const bones=[];skin.traverse(b=>{if(b.isBone)bones.push(b)});
const homeLengths=bones.map(b=>b.position.length()),homeScales=bones.map(b=>b.scale.toArray());
const checks=[],metrics={};
const check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(error){checks.push({name,pass:false,error:error.message})}};
const close=(a,b,t=1e-7)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b} (tolerance ${t})`);
const update=(dt=1/60,options={live:true,pres:false})=>actors.update(dt,options);
const pose=()=>actors.poseStats()[0];
const transforms=o=>({position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),parent:o.parent?.uuid});
const combat=()=>({alive:e.alive,hp:e.hp,cd:e.cd,warn:e.warn,ph:e.ph,tactical:structuredClone(e.tactical),
 g:transforms(e.g),wg2:transforms(e.wg2),gunTip:transforms(e.gunTip),pivots:[e.ll,e.rl,e.la,e.ra].map(transforms)});
const snapshot=()=>bones.map(b=>({p:b.position.toArray(),q:b.quaternion.toArray(),s:b.scale.toArray()}));
function step(frames,{speed=0,angle=0,stance=0,lean=0,aimPitch=0,recoil=0}={}){
 e.tactical={mode:speed?'reposition':'cover',speed,moveAngle:angle,stance,lean,aimPitch,recoil,alert:1};
 for(let i=0;i<frames;i++){
  e.wg2.position.y=1.43-.52*stance;e.wg2.rotation.x=aimPitch;
  const before=combat();e.g.position.x+=Math.sin(angle)*speed/60;e.g.position.z+=Math.cos(angle)*speed/60;
  before.g=transforms(e.g);update();assert.deepEqual(combat(),before);
 }
}

check('actual local GLB has 0 imported clips and 88 native joints',()=>{
 assert.equal(metadata.animations?.length||0,0);assert.equal(metadata.skins[0].joints.length,88);
 assert.equal(actors.info().importedAnimationClips,0);assert.equal(bones.length,88);
});
check('idle initializes without altering actor/weapon/combat transforms',()=>{
 const before=combat();update(0,{live:false,pres:true});assert.deepEqual(combat(),before);
 assert.equal(pose().time,0);assert.equal(pose().phase,0);
});
check('body, legs, ankles and arms use normalized finite quaternions',()=>{
 step(30);for(const b of bones){assert.ok(b.quaternion.toArray().every(Number.isFinite));close(b.quaternion.length(),1,2e-6)}
});
check('standing weapon grip IK residuals stay below 5mm',()=>{
 metrics.standing=pose();for(const h of pose().hands)assert.ok(h.ikError<.005,JSON.stringify(h));
});
check('full caller-blended crouch/lean/aim keeps planted feet, no segment rescaling',()=>{
 const feet=pose().feet.map(f=>f.actual);step(120,{stance:1,lean:1,aimPitch:.30});
 metrics.crouched=pose();assert.ok(pose().stance>.99);
 for(let i=0;i<2;i++){
  const f=pose().feet[i];assert.ok(f.ikError<.005,JSON.stringify(f));
  for(let j=0;j<3;j++)close(f.actual[j],feet[i][j],.005);
 }
 const hip=bones.find(b=>b.name.includes('Hips_'));
 for(let i=0;i<bones.length;i++){
  if(bones[i]!==hip)close(bones[i].position.length(),homeLengths[i]);
  assert.deepEqual(bones[i].scale.toArray(),homeScales[i]);
 }
 for(const h of pose().hands)assert.ok(h.ikError<.005,JSON.stringify(h));
});
check('crouched weapon height/pitch contract reaches both wrists',()=>{
 e.wg2.position.set(.30,.91,0);e.wg2.rotation.x=.30;step(60,{stance:1,lean:.7,aimPitch:.30});
 metrics.crouchedGrip=pose();for(const h of pose().hands)assert.ok(h.ikError<.005,JSON.stringify(h));
});
check('walking is driven by measured displacement, with ankle/knee articulation',()=>{
 e.wg2.position.set(.30,1.43,0);e.wg2.rotation.x=0;step(90);
 const before=snapshot(),start=pose().distance;let lifts=0,maxError=0,plantedFrames=0,last=new Map(),maxSlip=0,worst;
 for(let i=0;i<240;i++){
  step(1,{speed:2.4});
  const p=pose();lifts+=p.feet.filter(f=>f.lift>.01).length;
  if(Math.max(...p.feet.map(f=>f.ikError))>maxError){maxError=Math.max(...p.feet.map(f=>f.ikError));worst={i,pose:p}}
  for(const f of p.feet){
   const world=new T.Vector3(...f.actual);e.g.localToWorld(world);
   const old=last.get(f.side);
   if(!f.swing&&old&&!old.swing){maxSlip=Math.max(maxSlip,world.distanceTo(old.world));plantedFrames++}
   last.set(f.side,{swing:f.swing,world});
  }
 }
 metrics.walk={lifts,maxError,plantedFrames,maxSlip,distance:pose().distance-start,worst};
 assert.ok(lifts>100);assert.ok(plantedFrames>100);assert.ok(maxSlip<.008,JSON.stringify(metrics.walk));
 assert.ok(maxError<.02,JSON.stringify(metrics.walk));close(pose().distance-start,9.6,.001);
 for(const suffix of ['UpLeg','Leg','Foot','Spine']){
  const i=bones.findIndex(b=>b.name.includes('mixamorig'+suffix+'_')||b.name.includes('mixamorigLeft'+suffix+'_'));
  assert.ok(i>=0);assert.notDeepEqual(snapshot()[i].q,before[i].q,suffix+' did not articulate');
 }
});
check('blocked actor does not advance gait even when a stale speed requests movement',()=>{
 step(90);const phase=pose().phase,distance=pose().distance;e.tactical.speed=2.4;
 for(let i=0;i<90;i++)update();
 close(pose().phase,phase);close(pose().distance,distance);assert.ok(pose().speed<.001);
});
check('pause and presentation freeze skeletal pose and all animation clocks',()=>{
 step(15,{speed:1.6,stance:.5,lean:-.8,aimPitch:-.25});
 const before=snapshot(),p=pose();e.tactical.stance=0;e.tactical.recoil=1;
 for(const options of [{live:false,pres:false},{live:true,pres:true},{}]){
  for(let i=0;i<30;i++)actors.update(1/60,options);
  assert.deepEqual(snapshot(),before);close(pose().time,p.time);close(pose().phase,p.phase);close(pose().distance,p.distance);
 }
});
check('flash follows a rising actual-shot recoil, never aim/alert/mode/shot-age',()=>{
 e.tactical.recoil=0;update();assert.equal(pose().flash,false);
 e.tactical.mode='fire';e.tactical.shot=0;e.tactical.alert=1;update();assert.equal(pose().flash,false);
 e.tactical.recoil=1;update();assert.equal(pose().flash,true);
 const before=pose().time;for(let i=0;i<8;i++)update();assert.equal(pose().flash,false);assert.ok(pose().time>before);
});
check('death does not advance animation or change authoritative life/combat state',()=>{
 e.alive=false;const before=combat(),p=pose(),s=snapshot();
 for(let i=0;i<30;i++)update();
 assert.deepEqual(combat(),before);assert.deepEqual(snapshot(),s);close(pose().time,p.time);e.alive=true;
});
check('teleport is not interpreted as a stride or a very large gait step',()=>{
 const distance=pose().distance;e.g.position.x+=15;update();
 close(pose().distance,distance);assert.equal(pose().actualSpeed,0);
 assert.ok(pose().feet.every(f=>f.ikError<.005));
});
check('lateral/backward/diagonal movement stays finite without bone length drift',()=>{
 let maxError=0,maxHandError=0,worst,worstHand;
 for(const angle of [Math.PI/2,-Math.PI/2,Math.PI,.75,-2.3]){
  for(let i=0;i<120;i++){
   const stance=(1+Math.sin(i/35))*.5;
   e.wg2.position.set(.30,1.43-.52*stance,0);
   step(1,{speed:1.4,angle,stance,lean:Math.sin(i/27)*.8,aimPitch:.2});
   if(Math.max(...pose().feet.map(f=>f.ikError))>maxError){maxError=Math.max(...pose().feet.map(f=>f.ikError));worst={angle,i,pose:pose()}}
   if(Math.max(...pose().hands.map(f=>f.ikError))>maxHandError){maxHandError=Math.max(...pose().hands.map(f=>f.ikError));worstHand={angle,i,pose:pose()}}
   for(const b of bones)assert.ok(b.quaternion.toArray().every(Number.isFinite));
  }
 }
 metrics.directional={maxFootError:maxError,maxHandError,worst,worstHand};
 assert.ok(maxError<.025,JSON.stringify(metrics.directional));assert.ok(maxHandError<.005,JSON.stringify(worstHand));
});
check('smooth caller stance matches standing/crouched skin heights and the elevated guard floor',()=>{
 e.g.position.set(0,.66,0);e.g.rotation.set(0,0,0);e.wg2.rotation.x=0;step(90);
 scene.updateMatrixWorld(true);
 const standing=new T.Box3().setFromObject(skin,true);let stance=0;
 for(let i=0;i<120;i++){stance+=(1-stance)*(1-Math.exp(-7/60));step(1,{stance})}
 scene.updateMatrixWorld(true);
 const crouched=new T.Box3().setFromObject(skin,true);
 metrics.heights={standing:standing.max.y-.66,crouched:crouched.max.y-.66,feetWorldMin:crouched.min.y};
 close(metrics.heights.standing,1.80,.015);close(metrics.heights.crouched,1.23,.020);close(crouched.min.y,.66,.012);
 for(const f of pose().feet)assert.ok(f.ikError<.005);
});
check('vertical-only floor relocation replants feet without inventing travel',()=>{
 const distance=pose().distance;e.g.position.y=0;update();
 for(const f of pose().feet)assert.ok(f.ikError<.005,JSON.stringify(f));close(pose().distance,distance);
});
check('actual hurt drives only a bounded skeletal response, never a flash or combat write',()=>{
 step(60,{stance:.6});const before=snapshot();e.tactical.hurt=.45;
 const c=combat();for(let i=0;i<5;i++)update();
 assert.deepEqual(combat(),c);assert.notDeepEqual(snapshot(),before);assert.equal(pose().flash,false);assert.ok(pose().hurt>0);
});
check('finite pose and segment lengths survive facing turns while planted',()=>{
 e.tactical.hurt=0;step(90,{stance:.5});
 for(let i=0;i<180;i++){e.g.rotation.y+=Math.PI/180;update()}
 for(const b of bones)assert.ok(b.quaternion.toArray().every(Number.isFinite));
 for(let i=0;i<bones.length;i++)if(!bones[i].name.includes('Hips_'))close(bones[i].position.length(),homeLengths[i]);
});
check('pose stats are detached read-only diagnostics, not mutable rig references',()=>{
 const before=pose();const tamper=actors.poseStats();tamper[0].feet[0].actual[0]=100;tamper[0].stance=99;
 assert.deepEqual(pose(),before);
});
check('independent clones do not share animation quaternions',()=>{
 const p=actors.poseStats()[1];assert.equal(p.distance,0);assert.equal(p.stance,0);
 assert.notEqual(e.g.getObjectByName('licensed-tactical-display'),e2.g.getObjectByName('licensed-tactical-display'));
});

const report={
 schema:'sunbreak-tactical-actor-numerical-v1',task:'sunbreak-tactical-public-2026-11-17',
 method:'Node; actual vendored Three and native local GLB geometry/skeleton; no texture decode, renderer or visual acceptance',
 assetSHA256:createHash('sha256').update(glb).digest('hex'),
 sourceSHA256:createHash('sha256').update(readFileSync(new URL('actors.js',base))).digest('hex'),
 verdict:checks.every(c=>c.pass)?'PASS':'REWORK',checks,metrics
};
if(process.argv.includes('--report'))writeFileSync(new URL('tactical-actor-unit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;
