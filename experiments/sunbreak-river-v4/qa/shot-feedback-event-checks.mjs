import assert from 'node:assert/strict';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {createShotFeedbackAdapter,intersectRiverSurface} from '../shot-feedback-event.js';
import {sampleRiverSurface} from '../river-water.js';
const camera=new T.PerspectiveCamera();camera.position.set(10,1.6,10);camera.updateMatrixWorld();
const gun=new T.Group(),solids=[],adapter=createShotFeedbackAdapter(T,solids),direction=new T.Vector3(0,0,-1);
const args={cam:camera,gun,direction,end:new T.Vector3(10,1.6,-120),best:null,wall:null};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const miss=adapter.event(args);ok(!miss.hit&&!!miss.muzzle,'true sky/range miss has no invented impact');
const wall=new T.Mesh(new T.BoxGeometry(4,4,.3),new T.MeshBasicMaterial({visible:false}));wall.position.set(10,1.7,4);wall.updateMatrixWorld();solids.push(wall);
const ray=new T.Raycaster(camera.position,direction,0,140),hit=ray.intersectObjects(solids)[0];
const event=adapter.event({...args,wall:hit,end:hit.point});ok(event.hit&&event.kind==='stone','actual invisible authoritative shot shell retained');ok(event.point.distanceTo(hit.point)<1e-6&&event.normal.z>.99,'point and incoming normal match true hit');
wall.position.z=9;wall.updateMatrixWorld();const blocked=adapter.event({...args,best:{},end:new T.Vector3(10,1.6,0)});
ok(blocked.muzzle===null&&blocked.kind==='stone'&&blocked.point.z>9,'barrel behind wall cannot produce flash or actor puff beyond wall');
solids.length=0;const actor=adapter.event({...args,best:{},end:new T.Vector3(10,1.6,5)});ok(actor.kind==='actor'&&actor.hit,'winning enemy remains hit');
camera.position.set(0,1.7,10);camera.updateMatrixWorld();const waterDir=new T.Vector3(0,-.8,-1).normalize();
const water=adapter.event({...args,direction:waterDir,end:camera.position.clone().addScaledVector(waterDir,20)});
ok(water.kind==='water'&&water.hit&&Math.abs(water.point.y-sampleRiverSurface(water.point.x,water.point.z,0).height)<.002,'actual animated river surface crossing generates water response');
camera.position.set(0,1.7,26);camera.updateMatrixWorld();const farDir=new T.Vector3(0,-1.88,74).normalize();
const beyond=adapter.event({...args,direction:farDir,end:camera.position.clone().addScaledVector(farDir,140)});
ok(!beyond.hit,'finite river ends at80m; no water impacts at100m');
// Independent dense front-to-back reference, including almost tangent rays
// crossing many wave crests. No unbracketed convergence can select later roots.
let maxWaterError=0;
for(const t of [0,1.7,5.3])for(const x of [-2,0,2])for(const slope of [.001,.003,.01,.04,.4]){
 const origin=new T.Vector3(x,-.14,10),dir=new T.Vector3(.01,-slope,-1).normalize(),limit=40;
 let expected=null,last=origin.y-sampleRiverSurface(origin.x,origin.z,t).height;
 for(let d=.001;d<=limit;d+=.001){const q=origin.clone().addScaledVector(dir,d),surface=sampleRiverSurface(q.x,q.z,t),delta=q.y-surface.height;
  if(last>=0&&delta<=0&&surface.depth>.015&&Math.abs(q.x)<7&&Math.abs(q.z)<80){expected=q;break}last=delta;
 }
 const hit=intersectRiverSurface(T,origin,dir,limit,t);ok(!!hit===!!expected,'grazing first-hit/miss agrees with dense independent sampling');
 if(hit){const error=hit.distanceTo(expected);maxWaterError=Math.max(error,maxWaterError);ok(error<.011,'first wave crest intersection within1cm sampling tolerance')}
}
console.log(JSON.stringify({pass:true,checks,maxWaterError,stats:adapter.info(),scope:'visual adapter and finite first-water-hit1cm bracket contract; unchanged original damage contract tested separately'}));
