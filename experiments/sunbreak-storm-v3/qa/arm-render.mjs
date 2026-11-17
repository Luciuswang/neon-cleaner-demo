// Isolated native WebGL canvas samples, never desktop/window capture.
// Run before editing with "before", inspect an unmodified held pose with "native",
// and validate the delivered runtime with "after". No actual-game QA is implied.
import http from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,basename,extname,sep,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const variant=process.argv[2]||'after';
assert.ok(['before','native','joint','after'].includes(variant));
const root=fileURLToPath(new URL('../',import.meta.url));
const weaponSource=await readFile(new URL(variant==='after'?'../weapon.js':'arm-before-weapon.js',import.meta.url),'utf8');
const servedSource=variant==='native'?weaponSource.replace('const sleeve=fitSleeveEnd(T,root);','const sleeve={nativePose:true};'):variant==='joint'?
 "import {repose} from '/qa/arm-joint-candidate.js';\n"+weaponSource.replace('const sleeve=fitSleeveEnd(T,root);',`const sleeve=repose(T,root,${Number(process.argv[3]||60)}*Math.PI/180,${Number(process.argv[4]||0)}*Math.PI/180,${Number(process.argv[5]||0)}*Math.PI/180);`):weaponSource;
if(variant==='native')assert.notEqual(servedSource,weaponSource,'Native diagnostic expects the unrepaired baseline');
const hash=b=>createHash('sha256').update(b).digest('hex');
const html=String.raw`<!DOCTYPE html><html><head><base href="/"><script type="importmap">{"imports":{"three":"/vendor/presentation/build/three.module.js","three/addons/":"/vendor/presentation/examples/jsm/"}}</script></head><body style="margin:0"><script type="module">
import * as T from '/vendor/three/build/three.module.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {buildWeapon} from '/weapon.js';
import {repose} from '/qa/arm-joint-candidate.js';
const scene=new T.Scene();scene.background=new T.Color(0x727c80);
const camera=new T.PerspectiveCamera(52,16/9,.01,10);scene.add(camera);
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);
renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
document.body.append(renderer.domElement);
const key=new T.DirectionalLight(0xffffff,2.2);key.position.set(.7,1.3,.9);scene.add(key);
const fill=new T.DirectionalLight(0xbcd8ff,2.4);fill.position.set(-1,.2,.5);scene.add(fill);
scene.add(new T.HemisphereLight(0xffffff,0x4b5560,1.05));
const gun=new T.Group();scene.add(gun);
const muzzleLight=new T.PointLight(0xffb070,0,4);muzzleLight.position.set(0,.01,-1.8);gun.add(muzzleLight);
const weapon=await buildWeapon({THREE:T,gun,gscene:scene});
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
const original=await loader.loadAsync('./assets/mp5/mp5a5.glb');original.scene.updateMatrixWorld(true);
let source,display;
original.scene.traverse(o=>{if(o.isSkinnedMesh&&o.name==='FPArms')source=o});
gun.traverse(o=>{if(o.isMesh&&o.material.name==='arms')display=o});
if(!source||!display)throw Error('Pinned arm mesh/material missing');
source.skeleton.update();
const n=source.geometry.attributes.position.count,sourcePoints=[],displayPoints=[],v=new T.Vector3(),d=new T.Vector3();
const bounds=p=>{const b=new T.Box3();for(const a of p)b.expandByPoint(new T.Vector3(...a));return{min:b.min.toArray(),max:b.max.toArray()}};
for(let i=0;i<n;i++){
 source.getVertexPosition(i,v);display.getVertexPosition(i,d);
 sourcePoints.push(v.toArray());displayPoints.push(d.toArray());
}
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
let maxDelta=0,changed=0,handMaxDelta=0,handVertices=0,contactMaxDelta=0,contactVertices=0,fingerTipMaxDelta=0;
const rigidGroups=[],sourceSides=[];
const joints=source.geometry.attributes.skinIndex,weights=source.geometry.attributes.skinWeight;
for(let i=0;i<n;i++){
 const delta=distance(sourcePoints[i],displayPoints[i]);maxDelta=Math.max(maxDelta,delta);if(delta>1e-6)changed++;
 let hand=false,handWeight=0,tip=false;const names=[],sides=new Set();
 for(let k=0;k<4;k++)if(weights.getComponent(i,k)>0){
  const name=source.skeleton.bones[joints.getComponent(i,k)].name;
  names.push(name);
  if(/_L|Twist_0\dL/.test(name))sides.add('left');
  if(/_R|Twist_0\dR/.test(name))sides.add('right');
  if(/Hand|Bone_[LR]\d/.test(name)){hand=true;handWeight+=weights.getComponent(i,k)}
  if(/^Bone_[LR](006|007|010|011|014|015|018|019|021|022)$/.test(name))tip=true;
 }
 if(hand){handVertices++;handMaxDelta=Math.max(handMaxDelta,delta)}
 if(handWeight>.999){contactVertices++;contactMaxDelta=Math.max(contactMaxDelta,delta)}
 if(tip)fingerTipMaxDelta=Math.max(fingerTipMaxDelta,delta);
 sourceSides.push([...sides]);
 rigidGroups.push(handWeight>.999||tip?'held':names.every(n=>/^(Arm_L|UpArm_L)$/.test(n))?'upper':
  names.every(n=>/^(Forearm_L|BoneTwist_0\dL(?:_end)?)$/.test(n))?'forearm':names.every(n=>/_R|Twist_0\dR/.test(n))?'right':null);
}
const uv={};
for(const attr of ['uv','uv1']){
 const a=source.geometry.attributes[attr],b=display.geometry.attributes[attr];let maxDelta=0;
 if(!a||!b){uv[attr]={present:false};continue}
 for(let i=0;i<a.count;i++)for(let k=0;k<a.itemSize;k++)maxDelta=Math.max(maxDelta,Math.abs(a.getComponent(i,k)-b.getComponent(i,k)));
 uv[attr]={present:true,count:a.count,maxDelta};
}
const index=source.geometry.index.array,edges=new Map(),weld=new Map(),weldIds=[],weldPoint=[],weldMembers=[];
for(let i=0;i<n;i++){
 const key=sourcePoints[i].map(v=>Math.round(v/1e-5)).join(',');
 if(!weld.has(key)){weld.set(key,weld.size);weldPoint.push(sourcePoints[i]);weldMembers.push([])}
 const id=weld.get(key);weldIds.push(id);weldMembers[id].push(i);
}
let edgeMaxRatio=0,edgeMinRatio=Infinity,edgeMaxRelativeChange=0,edgeCount=0,flippedFaces=0,normalMaxAngle=0,rigidEdgeMaxRelativeChange=0,rigidEdges=0;
const sn=source.geometry.attributes.normal,dn=display.geometry.attributes.normal;
// Native shader skinning normals are assessed below via transformed face normals,
// not by comparing bind-pose normals with baked normals.
for(let i=0;i<index.length;i+=3){
 const ids=[index[i],index[i+1],index[i+2]];
 const a=new T.Vector3(...sourcePoints[ids[1]]).sub(new T.Vector3(...sourcePoints[ids[0]]));
 const b=new T.Vector3(...sourcePoints[ids[2]]).sub(new T.Vector3(...sourcePoints[ids[0]]));
 const c=new T.Vector3(...displayPoints[ids[1]]).sub(new T.Vector3(...displayPoints[ids[0]]));
 const d=new T.Vector3(...displayPoints[ids[2]]).sub(new T.Vector3(...displayPoints[ids[0]]));
 const ns=a.cross(b),nd=c.cross(d);
 if(ns.lengthSq()>1e-16&&nd.lengthSq()>1e-16){const dot=ns.normalize().dot(nd.normalize());if(dot<0)flippedFaces++;normalMaxAngle=Math.max(normalMaxAngle,Math.acos(T.MathUtils.clamp(dot,-1,1)))}
 for(let k=0;k<3;k++){
  const a=ids[k],b=ids[(k+1)%3],s=distance(sourcePoints[a],sourcePoints[b]),t=distance(displayPoints[a],displayPoints[b]);
  if(s>1e-6){const r=t/s;edgeMaxRatio=Math.max(edgeMaxRatio,r);edgeMinRatio=Math.min(edgeMinRatio,r);edgeMaxRelativeChange=Math.max(edgeMaxRelativeChange,Math.abs(1-r));edgeCount++}
  if(s>1e-6&&rigidGroups[a]&&rigidGroups[a]===rigidGroups[b]){rigidEdges++;rigidEdgeMaxRelativeChange=Math.max(rigidEdgeMaxRelativeChange,Math.abs(t/s-1))}
  const wa=weldIds[a],wb=weldIds[b];if(wa===wb)continue;
  const key=wa<wb?wa+':'+wb:wb+':'+wa;
  if(edges.has(key))edges.get(key).count++;else edges.set(key,{a:wa,b:wb,count:1});
 }
}
const boundary=[...edges.values()].filter(e=>e.count===1),boundaryIds=[...new Set(boundary.flatMap(e=>[e.a,e.b]))];
const jointInfo=source.skeleton.bones.filter(b=>/^(Arm_|UpArm_|Forearm_|IK_Hand|Hand_)/.test(b.name)).map(b=>({
 name:b.name,localPosition:b.position.toArray(),localQuaternion:b.quaternion.toArray(),
 worldPosition:b.getWorldPosition(new T.Vector3()).toArray(),
 localAxesWorld:['x','y','z'].map((_,i)=>new T.Vector3(...[0,1,2].map(k=>k===i?1:0)).transformDirection(b.matrixWorld).toArray())
}));
const boundaryInfo=boundaryIds.map(id=>{
 const members=weldMembers[id],point=sourcePoints[members[0]],influences={};
 for(let k=0;k<4;k++){const name=source.skeleton.bones[joints.getComponent(members[0],k)].name;const w=weights.getComponent(members[0],k);if(w)influences[name]=w}
 return{id,vertex:members[0],point,influences};
});
const neighbors=Array.from({length:weld.size},()=>[]);
for(const e of edges.values()){neighbors[e.a].push(e.b);neighbors[e.b].push(e.a)}
const seen=new Set(),components=[];
for(let start=0;start<weld.size;start++){
 if(seen.has(start))continue;
 const queue=[start],ids=[],influences={};seen.add(start);
 for(let t=0;t<queue.length;t++){const id=queue[t];ids.push(...weldMembers[id]);for(const next of neighbors[id])if(!seen.has(next)){seen.add(next);queue.push(next)}}
 for(const i of ids)for(let k=0;k<4;k++){const name=source.skeleton.bones[joints.getComponent(i,k)].name;const w=weights.getComponent(i,k);if(w)influences[name]=(influences[name]||0)+w}
 components.push({vertices:ids.length,bounds:bounds(ids.map(i=>sourcePoints[i])),influences});
}
const metrics={vertices:n,sourceBounds:bounds(sourcePoints),displayBounds:bounds(displayPoints),maxVertexDelta:maxDelta,changedVertices:changed,
 handVertices,handMaxVertexDelta:handMaxDelta,contactVertices,contactMaxVertexDelta:contactMaxDelta,fingerTipMaxVertexDelta:fingerTipMaxDelta,uv,edgeCount,edgeMinRatio,edgeMaxRatio,edgeMaxRelativeChange,rigidEdges,rigidEdgeMaxRelativeChange,opposedSourceFaceNormals:flippedFaces,maxFaceNormalAngle:normalMaxAngle,
 boundaryEdges:boundary.length,boundaryVertices:boundaryInfo,components,joints:jointInfo,clips:original.animations.map(a=>({name:a.name,duration:a.duration,tracks:a.tracks.length}))};
// Inspect the displayed surface itself, not the source opening's projected ring.
// Side labels come from source bone weights; new closure vertices belong to left.
const edgeKey=(a,b)=>a<b?a+':'+b:b+':'+a;
const actualWeld=new Map(),actualIds=[],actualMembers=[],actualPoints=[],actualSides=[],actualEdges=new Map(),actualIndex=display.geometry.index.array;
for(let i=0;i<display.geometry.attributes.position.count;i++){
 display.getVertexPosition(i,v);const key=v.toArray().map(x=>Math.round(x/1e-5)).join(',');
 if(!actualWeld.has(key)){actualWeld.set(key,actualWeld.size);actualMembers.push([]);actualPoints.push(v.toArray());actualSides.push(new Set())}
 const id=actualWeld.get(key);actualIds.push(id);actualMembers[id].push(i);
 for(const side of i>=n?['left']:sourceSides[i])actualSides[id].add(side);
}
const links=actualMembers.map(()=>new Map()),actualNeighbors=actualMembers.map(()=>new Set()),faces=new Set();
let degenerateWeldedFaces=0,duplicateFaces=0,maxWeldSpread=0;
for(let id=0;id<actualMembers.length;id++)for(const i of actualMembers[id]){
 display.getVertexPosition(i,v);maxWeldSpread=Math.max(maxWeldSpread,distance(v.toArray(),actualPoints[id]));
}
for(let i=0;i<actualIndex.length;i+=3){
 const ids=[actualIds[actualIndex[i]],actualIds[actualIndex[i+1]],actualIds[actualIndex[i+2]]];
 if(new Set(ids).size!==3)degenerateWeldedFaces++;
 const faceKey=ids.slice().sort((a,b)=>a-b).join(':');if(faces.has(faceKey))duplicateFaces++;faces.add(faceKey);
 for(let k=0;k<3;k++){
  const a=ids[k],b=ids[(k+1)%3],c=ids[(k+2)%3];if(a===b)continue;
  const key=edgeKey(a,b);
  if(!actualEdges.has(key))actualEdges.set(key,{a,b,count:0,directionBalance:0,sourceFaces:0,closureFaces:0});
  const e=actualEdges.get(key);e.count++;e.directionBalance+=a<b?1:-1;e[i<index.length?'sourceFaces':'closureFaces']++;
  actualNeighbors[a].add(b);actualNeighbors[b].add(a);
  for(const [u,w]of [[b,c],[c,b]]){if(!links[a].has(u))links[a].set(u,new Set());links[a].get(u).add(w)}
 }
}
const actualBoundary=[...actualEdges.values()].filter(e=>e.count===1);
const leftBoundary=actualBoundary.filter(e=>actualSides[e.a].has('left')||actualSides[e.b].has('left'));
const rightBoundary=actualBoundary.filter(e=>actualSides[e.a].has('right')||actualSides[e.b].has('right'));
const sourceBoundaryEdges=side=>boundary.filter(e=>[e.a,e.b].every(id=>weldMembers[id].some(i=>sourceSides[i].includes(side))));
const mappedSourceEdge=e=>actualEdges.get(edgeKey(actualIds[weldMembers[e.a][0]],actualIds[weldMembers[e.b][0]]));
const originalLeftRing=sourceBoundaryEdges('left'),originalRightRing=sourceBoundaryEdges('right');
const originalRightKeys=new Set(originalRightRing.map(e=>edgeKey(actualIds[weldMembers[e.a][0]],actualIds[weldMembers[e.b][0]])));
const seamEdges=originalLeftRing.map(e=>{
 const actual=mappedSourceEdge(e);
 return{sourceVertices:[weldMembers[e.a][0],weldMembers[e.b][0]],incidence:actual?.count||0,
  sourceFaces:actual?.sourceFaces||0,closureFaces:actual?.closureFaces||0,directionBalance:actual?.directionBalance??null};
});
const invalidSeamEdges=seamEdges.filter(e=>e.incidence!==2||e.sourceFaces!==1||e.closureFaces!==1||e.directionBalance!==0);
const closureEdges=[...actualEdges.values()].filter(e=>e.closureFaces>0);
const invalidClosureEdges=closureEdges.filter(e=>e.count!==2||e.directionBalance!==0);
const nonManifoldVertices=[];
for(let id=0;id<links.length;id++){
 const link=links[id],todo=[link.keys().next().value],visited=new Set();
 while(todo.length){const p=todo.pop();if(visited.has(p))continue;visited.add(p);for(const q of link.get(p)||[])todo.push(q)}
 const degree=[...link.values()].map(s=>s.size),boundaryVertex=actualBoundary.some(e=>e.a===id||e.b===id);
 const validDegrees=boundaryVertex?degree.filter(d=>d===1).length===2&&degree.every(d=>d===1||d===2):degree.every(d=>d===2);
 if(visited.size!==link.size||!validDegrees)nonManifoldVertices.push({id,sides:[...actualSides[id]],linkComponentsDisconnected:visited.size!==link.size,boundaryVertex});
}
const actualComponents=[],componentSeen=new Set();
for(let start=0;start<actualMembers.length;start++){
 if(componentSeen.has(start))continue;
 const queue=[start],members=new Set(),sides=new Set();componentSeen.add(start);
 for(let i=0;i<queue.length;i++){
  const id=queue[i];members.add(id);for(const side of actualSides[id])sides.add(side);
  for(const next of actualNeighbors[id])if(!componentSeen.has(next)){componentSeen.add(next);queue.push(next)}
 }
 const componentEdges=[...actualEdges.values()].filter(e=>members.has(e.a));
 const faceCount=componentEdges.reduce((sum,e)=>sum+e.count,0)/3;
 actualComponents.push({sides:[...sides],weldedVertices:members.size,edges:componentEdges.length,faces:faceCount,
  eulerCharacteristic:members.size-componentEdges.length+faceCount,boundaryEdges:componentEdges.filter(e=>e.count===1).length});
}
metrics.openLeftShoulderEdges=leftBoundary.length;
metrics.nonManifoldEdges=[...actualEdges.values()].filter(e=>e.count>2).length;
metrics.topology={
 method:'Displayed positions welded at 1e-5 source units; side labels from source skin influences, never an x-coordinate cutoff. Edge incidence, directed winding, vertex links and connected components tested.',
 maxWeldSpread,degenerateWeldedFaces,duplicateFaces,nonManifoldVertices,
 inconsistentWindingEdges:[...actualEdges.values()].filter(e=>e.count===2&&e.directionBalance!==0).length,
 originalLeftRingEdges:originalLeftRing.length,originalLeftRingNowSewn:invalidSeamEdges.length===0,
 originalLeftRingAdjacency:seamEdges,invalidSeamEdges:invalidSeamEdges.length,
 closureEdges:closureEdges.length,invalidClosureEdges:invalidClosureEdges.length,
 actualBoundaryEdges:actualBoundary.length,actualLeftBoundaryEdges:leftBoundary.length,
 remainingOriginalRightShoulderEdges:actualBoundary.filter(e=>originalRightKeys.has(edgeKey(e.a,e.b))).length,
 originalRightShoulderEdges:originalRightRing.length,
 originalRightBoundaryUnchanged:originalRightRing.every(e=>mappedSourceEdge(e)?.count===1)&&
  originalRightRing.every(e=>[e.a,e.b].every(id=>weldMembers[id].every(i=>distance(sourcePoints[i],displayPoints[i])<1e-6))),
 unexpectedBoundaryEdges:actualBoundary.filter(e=>!originalRightKeys.has(edgeKey(e.a,e.b))).length,
 components:actualComponents
};
// Read-only counterfactual incidence tests: neither mesh nor render is mutated.
function counterfactualClosureFace(reverse){
 const copy=new Map([...actualEdges].map(([key,e])=>[key,{...e}]));
 const ids=[0,1,2].map(k=>actualIds[actualIndex[index.length+k]]);
 if(ids.some(id=>id===undefined))return{applicable:false};
 for(let k=0;k<3;k++){
  const a=ids[k],b=ids[(k+1)%3],e=copy.get(edgeKey(a,b)),sign=a<b?1:-1;
  e.count--;e.closureFaces--;e.directionBalance-=sign;
  if(reverse){e.count++;e.closureFaces++;e.directionBalance-=sign}
 }
 const openLeftEdges=[...copy.values()].filter(e=>e.count===1&&(actualSides[e.a].has('left')||actualSides[e.b].has('left'))).length;
 const inconsistentWindingEdges=[...copy.values()].filter(e=>e.count===2&&e.directionBalance!==0).length;
 return{applicable:true,openLeftEdges,inconsistentWindingEdges,rejectedByZeroDefectCriteria:openLeftEdges>0||inconsistentWindingEdges>0};
}
metrics.topology.negativeControls={method:'Virtual incidence changes to one added face; not modified/rendered production geometry.',
 removedClosureFace:counterfactualClosureFace(false),reversedClosureFace:counterfactualClosureFace(true)};
metrics.addedVertices=display.geometry.attributes.position.count-n;
metrics.addedTriangles=(actualIndex.length-index.length)/3;
metrics.newUVMinArea=Infinity;metrics.newFaceMinArea=Infinity;metrics.invalidNormals=0;
for(let i=0;i<display.geometry.attributes.normal.count;i++){
 const a=display.geometry.attributes.normal;v.set(a.getX(i),a.getY(i),a.getZ(i));if(!Number.isFinite(v.length())||Math.abs(v.length()-1)>.001)metrics.invalidNormals++;
}
for(let i=index.length;i<actualIndex.length;i+=3){
 const [a,b,c]=[actualIndex[i],actualIndex[i+1],actualIndex[i+2]],uv=display.geometry.attributes.uv;
 const area=Math.abs((uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getY(b)-uv.getY(a))*(uv.getX(c)-uv.getX(a)))/2;
 metrics.newUVMinArea=Math.min(metrics.newUVMinArea,area);
 const p=[a,b,c].map(i=>display.getVertexPosition(i,new T.Vector3()));
 metrics.newFaceMinArea=Math.min(metrics.newFaceMinArea,p[1].sub(p[0]).cross(p[2].sub(p[0])).length()/2);
}
function setState({aim=0,recoil=0,reload=0,bob=0,width=1600,height=900}={}){
 renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();
 const rdip=reload>0?Math.sin(Math.min(1,(1.2-reload)/1.2)*Math.PI):0;
 gun.position.set(.27-aim*.27,-.24+Math.sin(bob)*.012+aim*.09-rdip*.24,-.83+recoil*.1);
 gun.rotation.set(recoil*.16+Math.sin(bob*.5)*.01+rdip*.6,.1-aim*.1,Math.cos(bob)*.014-aim*.014+rdip*.32);
 gun.scale.setScalar(.78);muzzleLight.intensity=recoil*20;
 const parentBefore=[...gun.position.toArray(),...gun.quaternion.toArray(),...gun.scale.toArray()],state={aim,reload,live:true,presentation:false},stateBefore=JSON.stringify(state);
 weapon.update(1/60,state);
 const parentUnchanged=parentBefore.every((x,i)=>x===[...gun.position.toArray(),...gun.quaternion.toArray(),...gun.scale.toArray()][i]);
 gun.updateMatrixWorld(true);
 let originalRingVerticesInFrustum=0,originalLeftRingVerticesInFrustum=0;const originalLeftRingProjection=[];
 const inFrustum=p=>{const cameraZ=p.z;p.project(camera);return cameraZ<-.01&&Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1};
 for(const e of boundaryInfo){
  display.getVertexPosition(e.vertex,v);display.localToWorld(v);const inside=inFrustum(v);
  if(inside)originalRingVerticesInFrustum++;
  const left=sourceSides[e.vertex].includes('left');
  if(left&&inside)originalLeftRingVerticesInFrustum++;
  if(left)originalLeftRingProjection.push({vertex:e.vertex,ndc:v.toArray(),inFrustum:inside});
 }
 const boundaryVerticesInFrustum=edges=>{
  let count=0;for(const id of new Set(edges.flatMap(e=>[e.a,e.b]))){
   display.getVertexPosition(actualMembers[id][0],v);display.localToWorld(v);if(inFrustum(v))count++;
  }return count;
 };
 const actualLeftBoundaryVerticesInFrustum=boundaryVerticesInFrustum(leftBoundary);
 const unchangedRightBoundaryVerticesInFrustum=boundaryVerticesInFrustum(rightBoundary);
 const expected=gun.localToWorld(new T.Vector3(0,.005,-1.85));
 const actual=gun.getObjectByName('MuzzleSocket').getWorldPosition(new T.Vector3());
 return{info:weapon.info(),muzzleWorldError:expected.distanceTo(actual),
  sourceRingDiagnostic:{originalRingVerticesInFrustum,originalLeftRingVerticesInFrustum,originalLeftRingProjection},
  actualLeftBoundaryVerticesInFrustum,unchangedRightBoundaryVerticesInFrustum,parentUnchanged,stateUnchanged:stateBefore===JSON.stringify(state)};
}
window.armQA={
 ready:true,metrics,
 probe(){
  const root=gun.getObjectByName('sunbreak-licensed-mp5-viewmodel'),parent=root.parent,scale=root.scale.clone(),results=[],
   saved=display.skeleton.bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));
  for(const wa of [20,25,30,35,40])for(const ea of [10,20,30,40,50])for(const roll of [-30,0,30]){
   root.parent=null;root.scale.setScalar(1);
   display.skeleton.bones.forEach((b,i)=>{b.position.copy(source.skeleton.bones[i].position);b.quaternion.copy(source.skeleton.bones[i].quaternion)});
   repose(T,root,wa*Math.PI/180,ea*Math.PI/180,roll*Math.PI/180);root.parent=parent;root.scale.copy(scale);
   let visible=0,maxY=-Infinity;
   for(const state of [{},{aim:1},{recoil:1},{aim:1,recoil:1},...Array.from({length:13},(_,i)=>({reload:1.2-i*.0999999}))]){
    const r=setState(state);visible=Math.max(visible,r.sourceRingDiagnostic.originalLeftRingVerticesInFrustum);
    maxY=Math.max(maxY,...r.sourceRingDiagnostic.originalLeftRingProjection.map(p=>p.ndc[1]));
   }
   results.push({wrist:wa,elbow:ea,roll,visible,maxY});
  }
  display.skeleton.bones.forEach((b,i)=>{b.position.copy(saved[i].p);b.quaternion.copy(saved[i].q)});
  root.updateMatrixWorld(true);display.skeleton.update();return results;
 },
 sample(options={}){
  const result=setState(options);renderer.render(scene,camera);
  const width=renderer.domElement.width,height=renderer.domElement.height,gl=renderer.getContext(),pixels=new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let varied=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>24)varied++;
  return{...result,png:renderer.domElement.toDataURL('image/png'),width,height,variedPixels:varied,glError:gl.getError(),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};
 },
 sweep(){
  let frames=0,maxMuzzleError=0,maxOriginalLeftRingVerticesInFrustum=0,maxActualLeftBoundaryVerticesInFrustum=0,maxUnchangedRightBoundaryVerticesInFrustum=0;
  const originalRingExamplesInFrustum=[],failures=[],t=metrics.topology;
  if(metrics.openLeftShoulderEdges||metrics.nonManifoldEdges||t.nonManifoldVertices.length||t.inconsistentWindingEdges||
   t.invalidSeamEdges||t.invalidClosureEdges||t.unexpectedBoundaryEdges||t.degenerateWeldedFaces||t.duplicateFaces)
   failures.push({kind:'actual-surface-topology',openLeftEdges:metrics.openLeftShoulderEdges,nonManifoldEdges:metrics.nonManifoldEdges,
    nonManifoldVertices:t.nonManifoldVertices.length,windingEdges:t.inconsistentWindingEdges,invalidSeamEdges:t.invalidSeamEdges,
    invalidClosureEdges:t.invalidClosureEdges,unexpectedBoundaryEdges:t.unexpectedBoundaryEdges,degenerateFaces:t.degenerateWeldedFaces,duplicateFaces:t.duplicateFaces});
  for(const [width,height]of [[1600,900],[1760,775],[1200,900]]){
   for(let i=0;i<=120;i++){
    const states=[{aim:0,bob:i/120*Math.PI*2},{aim:i/120},{recoil:i/120},{reload:1.2-i/120*1.199999},{aim:1,recoil:i/120}];
    for(const s of states){
     const r=setState({...s,width,height});frames++;maxMuzzleError=Math.max(maxMuzzleError,r.muzzleWorldError);
     const count=r.sourceRingDiagnostic.originalLeftRingVerticesInFrustum;
     maxOriginalLeftRingVerticesInFrustum=Math.max(maxOriginalLeftRingVerticesInFrustum,count);
     if(count&&originalRingExamplesInFrustum.length<8)originalRingExamplesInFrustum.push({width,height,...s,originalLeftRingVerticesInFrustum:count});
     maxActualLeftBoundaryVerticesInFrustum=Math.max(maxActualLeftBoundaryVerticesInFrustum,r.actualLeftBoundaryVerticesInFrustum);
     maxUnchangedRightBoundaryVerticesInFrustum=Math.max(maxUnchangedRightBoundaryVerticesInFrustum,r.unchangedRightBoundaryVerticesInFrustum);
     if(r.actualLeftBoundaryVerticesInFrustum&&failures.length<8)failures.push({kind:'actual-open-left-boundary-in-frustum',width,height,...s,vertices:r.actualLeftBoundaryVerticesInFrustum});
    }
   }
  }
  return{frames,maxMuzzleError,sourceRingDiagnostic:{
   meaning:'Original GLB opening-ring vertices projected into the frustum, not occlusion-tested visibility or remaining holes. After repair this left ring is an internal sewn seam; see geometry.topology for actual adjacency.',
   maxOriginalLeftRingVerticesInFrustum,examplesInFrustum:originalRingExamplesInFrustum},
   actualSurface:{openLeftBoundaryEdges:metrics.openLeftShoulderEdges,maxActualLeftBoundaryVerticesInFrustum},
   unchangedRightOpening:{boundaryEdges:rightBoundary.length,maxBoundaryVerticesInFrustum:maxUnchangedRightBoundaryVerticesInFrustum,
    note:'Original right shoulder opening retained, outside this LEFT ARM repair. Frustum inclusion is not occlusion-tested exposure. No globally watertight mesh or whole-asset hole-free art verdict is claimed.'},
   failures,fullContinuousVisualReview:false};
 }
};
</script></body></html>`;
const types={'.js':'text/javascript','.mjs':'text/javascript','.glb':'model/gltf-binary','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);return}
  if(url.pathname==='/weapon.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(servedSource);return}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!path.startsWith(root.endsWith(sep)?root:root+sep))throw Error('Outside isolated source root');
  const bytes=await readFile(path);
  res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(bytes);
 }catch(error){res.writeHead(404);res.end(error.message)}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const address=`http://127.0.0.1:${server.address().port}`;
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(chrome,'Headless browser unavailable');
const profile=await mkdtemp(join(tmpdir(),'arm-webgl-'));
let browser,socket,sequence=0,session;
const pending=new Map(),exceptions=[],consoleErrors=[];
function send(method,params={},sessionId=session){
 const id=++sequence;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},60000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
 });
}
const evaluate=async expression=>{
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
};
const report={schema:'sunbreak-arm-native-canvas-v2',task:'sunbreak-house-roundtrip-arms-2026-11-17',variant,
 engineeringScope:'LEFT ARM repair only; original right shoulder opening retained and reported separately. Engineering PASS is not global watertightness or independent art acceptance.',
 fieldMigration:'v1 sweep.maxLeftVisibleBoundary and its eight capped failures were original source-ring frustum diagnostics, not actual exposed-boundary failures. v2 retains these observations in sweep.sourceRingDiagnostic, and gates actual surface topology separately; sweep.failures now contains real defects only.',
 captureMethod:'headless native Three WebGL renderer canvas.toDataURL; no desktop/window screenshots',
 rendering:'ANGLE SwiftShader software renderer; representative samples, not a hardware benchmark or continuous visual review',
 weaponSHA256:hash(weaponSource),servedSHA256:hash(servedSource),samples:[],exceptions,consoleErrors};
try{
 if(variant==='after'){
  try{
   const prior=JSON.parse(await readFile(new URL('arm-after-report.json',import.meta.url),'utf8'));
   if(prior.geometry.edgeMaxRatio>2){
    prior.engineeringVerdict='REWORK';prior.rejectionReason='Binary contact pinning stretched the mixed cuff seam; replaced with authored skin blending.';
    for(const sample of prior.samples){const previous=sample.path;sample.path=previous.replace('arm-after-','arm-rejected-hard-pin-');await writeFile(new URL(sample.path,import.meta.url),await readFile(new URL(previous,import.meta.url)))}
    await writeFile(new URL('arm-rejected-hard-pin-report.json',import.meta.url),JSON.stringify(prior,null,2)+'\n');
   }
  }catch(error){if(error.code!=='ENOENT')throw error}
 }
 const endpoint=await new Promise((resolve,reject)=>{
  browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--enable-unsafe-swiftshader','--use-angle=swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  browser.once('error',reject);let output='';const timer=setTimeout(()=>reject(Error('Browser startup timeout')),30000);
  browser.stderr.on('data',d=>{output+=d;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1])}});
 });
 socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});
 socket.addEventListener('message',event=>{
  const r=JSON.parse(event.data),p=pending.get(r.id);
  if(p){clearTimeout(p.timer);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result)}
  if(r.method==='Runtime.exceptionThrown')exceptions.push(r.params.exceptionDetails);
  if(r.method==='Runtime.consoleAPICalled'&&r.params.type==='error')consoleErrors.push(r.params.args.map(a=>a.value||a.description).join(' '));
 });
 const {targetId}=await send('Target.createTarget',{url:address},null);
 ({sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true},null));
 await send('Runtime.enable');const started=Date.now();
 while(!await evaluate('!!window.armQA?.ready')){
  if(exceptions.length||Date.now()-started>60000)throw Error('Asset initialization failed: '+JSON.stringify(exceptions));
  await new Promise(r=>setTimeout(r,250));
 }
 report.geometry=await evaluate('window.armQA.metrics');
 if(variant==='joint')report.probe=await evaluate('window.armQA.probe()');
 for(const [name,options]of [
  ['idle',{}],['ads',{aim:1}],['fire',{recoil:1}],['ads-fire',{aim:1,recoil:1}],
  ['reload-early',{reload:.95}],['reload-mid',{reload:.6}],['reload-late',{reload:.25}],
  ['wide-idle',{width:1760,height:775}],['narrow-idle',{width:1200,height:900}]
 ]){
  const sample=await evaluate(`window.armQA.sample(${JSON.stringify(options)})`),bytes=Buffer.from(sample.png.split(',')[1],'base64');delete sample.png;
  assert.ok(sample.variedPixels>5000,'Blank canvas');assert.equal(sample.glError,0,'WebGL error');
  const path=`arm-${variant}-${name}.png`;await writeFile(new URL(path,import.meta.url),bytes);
  report.samples.push({name,path,sha256:hash(bytes),options,...sample});
 }
 report.sweep=await evaluate('window.armQA.sweep()');
 report.assetHashes={};
 for(const path of ['assets/mp5/mp5a5.glb','assets/mp5/arms_basecolor.webp','assets/mp5/arms_normal.webp'])report.assetHashes[path]=hash(await readFile(new URL('../'+path,import.meta.url)));
 const g=report.geometry,t=g.topology;
 report.engineeringChecks={
  sourceUVs:g.uv.uv.maxDelta<1e-7&&g.uv.uv1.maxDelta<1e-7,
  heldContact:g.contactMaxVertexDelta<1e-6&&g.fingerTipMaxVertexDelta<1e-6,
  sourceSurfaceStrain:g.edgeMaxRatio<1.7&&g.edgeMinRatio>.5&&g.rigidEdgeMaxRelativeChange<.001,
  noOpenLeftSleeve:g.openLeftShoulderEdges===0&&g.nonManifoldEdges===0,
  sewnClosureTopology:t.originalLeftRingEdges===24&&t.originalLeftRingNowSewn&&t.invalidSeamEdges===0&&t.invalidClosureEdges===0,
  manifoldSurface:t.nonManifoldVertices.length===0&&t.inconsistentWindingEdges===0&&t.degenerateWeldedFaces===0&&t.duplicateFaces===0&&t.maxWeldSpread<1e-6,
  onlyOriginalRightOpening:t.originalRightShoulderEdges===24&&t.remainingOriginalRightShoulderEdges===24&&t.actualBoundaryEdges===24&&t.originalRightBoundaryUnchanged&&t.unexpectedBoundaryEdges===0,
  closedLeftComponent:t.components.filter(c=>c.sides.includes('left')).length===1&&t.components.some(c=>c.sides.length===1&&c.sides[0]==='left'&&c.boundaryEdges===0&&c.eulerCharacteristic===2),
  actualSurfaceSweep:report.sweep.failures.length===0&&report.sweep.actualSurface.maxActualLeftBoundaryVerticesInFrustum===0,
  topologyNegativeControls:t.negativeControls.removedClosureFace.rejectedByZeroDefectCriteria===true&&t.negativeControls.reversedClosureFace.rejectedByZeroDefectCriteria===true,
  validSurface:g.invalidNormals===0&&g.newUVMinArea>1e-12&&g.newFaceMinArea>1e-10,
  unchangedBoneLengths:report.samples[0].info.sleeve.maxJointLengthError<1e-6,
  muzzleCoincidence:report.sweep.maxMuzzleError<1e-6,
  baselineParentAndState:report.samples.every(s=>s.parentUnchanged&&s.stateUnchanged),
  cleanConsole:!exceptions.length&&!consoleErrors.length
 };
 report.engineeringVerdict=variant==='after'?(Object.values(report.engineeringChecks).every(Boolean)?'PASS':'REWORK'):'DIAGNOSTIC';
 await writeFile(new URL(`arm-${variant}-report.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({variant,engineeringVerdict:report.engineeringVerdict,checks:report.engineeringChecks,
  geometry:{contactVertices:g.contactVertices,contactMaxVertexDelta:g.contactMaxVertexDelta,fingerTipMaxVertexDelta:g.fingerTipMaxVertexDelta,
   mixedHandCuffMaxVertexDelta:g.handMaxVertexDelta,edgeMinRatio:g.edgeMinRatio,edgeMaxRatio:g.edgeMaxRatio,
   openLeftShoulderEdges:g.openLeftShoulderEdges,addedVertices:g.addedVertices,addedTriangles:g.addedTriangles,
   uv0MaxDelta:g.uv.uv.maxDelta,uv1MaxDelta:g.uv.uv1.maxDelta},
  samples:report.samples.length,sweptStates:report.sweep.frames,maxMuzzleError:report.sweep.maxMuzzleError,exceptions,consoleErrors},null,2));
 if(variant==='after'&&report.engineeringVerdict!=='PASS')process.exitCode=1;
}finally{
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close',{},null)}catch{}socket.close()}
 if(browser&&browser.exitCode===null)await new Promise(resolve=>{const timer=setTimeout(()=>{browser.kill();resolve()},5000);browser.once('exit',()=>{clearTimeout(timer);resolve()})});
 server.close();assert.equal(dirname(profile),resolve(tmpdir()));assert.ok(basename(profile).startsWith('arm-webgl-'));
 await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(error=>console.warn('Temporary profile cleanup:',error.message));
}
