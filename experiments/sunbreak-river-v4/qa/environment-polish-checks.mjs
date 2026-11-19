import assert from 'node:assert/strict';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {polishEnvironmentPlan,groundGritGeometry,forestBakeCamera,forestAtlasTile,renderForestAtlas} from '../environment-polish.js';
import {MAP,terrainHeight,landscapeHeight,blocked,inBuffer,crossings,spawns,teamSpawns} from '../map-layout.js';
import {trafficDistance} from '../ground-surface.js';
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const p=polishEnvironmentPlan();assert.deepEqual(p,polishEnvironmentPlan());checks++;
ok(p.grass.length>2000&&p.grass.length<=3600,'bounded actual meadow population');
ok(p.forest.length>100&&p.forest.length<=190,'bounded distant canopy population');
const dummy=new T.Object3D(),g=groundGritGeometry(T),v=new T.Vector3();let maxGap=0;
for(const q of p.grit){
 dummy.position.set(q.x,q.y,q.z);dummy.rotation.y=q.yaw;dummy.scale.set(q.rx,q.height,q.rz);dummy.updateMatrix();
 for(let i=0;i<g.attributes.position.count;i++){
  v.fromBufferAttribute(g.attributes.position,i).applyMatrix4(dummy.matrix);const gap=v.y-terrainHeight(v.x,v.z);maxGap=Math.max(maxGap,gap);
  ok(gap<.03,'actual transformed grit vertex below unchanged 3cm support tolerance');
 }
 ok(trafficDistance(q.x,q.z)>.82&&!blocked(q.x,q.z,.18)&&!inBuffer(q.x,q.z,.65),'grit clear of travel/solid footprint');
}
for(const q of p.grass){
 ok(q.height>=.17&&q.height<=.33&&q.y===landscapeHeight(q.x,q.z)-.008,'grounded varied grass heights');
 ok(trafficDistance(q.x,q.z)>1.65+q.radius&&!blocked(q.x,q.z,q.radius+.22)&&!inBuffer(q.x,q.z,.8+q.radius),'full low-clump route clearance');
 ok([...spawns,...teamSpawns].every(s=>Math.hypot(q.x-s[0],q.z-s[2])>2.2+q.radius),'spawn clearance');
}
let nearest=Infinity;
for(const q of p.forest){const d=Math.hypot(Math.max(0,Math.abs(q.x)-32),Math.max(0,Math.abs(q.z+4)-30))-q.height*.72;
 nearest=Math.min(nearest,d);ok(d>45,'whole canopy farther than45m from any playable position');
 ok(Math.abs(q.x)<124&&Math.abs(q.z)<124&&q.y===landscapeHeight(q.x,q.z)-.18,'forest grounded inside real terrain');
}
// Actual normalized source tree occupies y=[0,1]. Both roots and crown must
// remain inside every camera, not the previous y=[.47,1.65] cropped window.
for(let view=0;view<4;view++)for(const y of [0,1]){
 const camera=forestBakeCamera(T,view),ndc=new T.Vector3(0,y,0).project(camera);
 ok(Math.abs(ndc.x)<1&&Math.abs(ndc.y)<1,'root and crown contained by real bake projection');
}
// r160 contract mock: target binding uses physical viewport; canvas setters
// multiply by DPR. Test both canvas and previous offscreen target restoration.
for(const dpr of [1,1.5])for(const useTarget of [false,true])for(const fail of [false,true]){
 const oldTarget=useTarget?{viewport:new T.Vector4(3,5,256,128),scissor:new T.Vector4(3,5,256,128),scissorTest:true}:null;
 const atlas=new T.WebGLRenderTarget(2048,1024),clones=[{visible:false},{visible:false}],renders=[];
 let target=oldTarget,viewport=new T.Vector4(1,2,1280,720),scissor=new T.Vector4(4,6,800,600),scissorTest=false,clearColor=new T.Color(.2,.3,.4),clearAlpha=.7,physical;
 const renderer={toneMapping:T.ACESFilmicToneMapping,autoClear:true,
  getRenderTarget:()=>target,getClearColor:c=>c.copy(clearColor),getClearAlpha:()=>clearAlpha,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>scissorTest,
  setRenderTarget(t){target=t;physical=t?t.viewport.clone():viewport.clone().multiplyScalar(dpr)},setViewport(v){viewport.copy(v);physical=v.clone().multiplyScalar(dpr)},setScissor(v){scissor.copy(v)},setScissorTest(v){scissorTest=v},setClearColor(c,a){clearColor.set(c);clearAlpha=a},clear(){},
  render(scene,camera){if(fail)throw Error('intentional bake interruption');renders.push({viewport:physical.toArray(),scissor:target.scissor.toArray(),species:clones.findIndex(c=>c.visible)});}
 };
 try{renderForestAtlas(T,renderer,atlas,{},clones,.72);ok(!fail,'expected bake completion')}catch(e){ok(fail&&e.message==='intentional bake interruption','known interrupted bake only')}
 if(!fail){ok(renders.length===8,'all species/view tiles rendered');for(let i=0;i<8;i++){const tile=forestAtlasTile(i>>2,i%4);assert.deepEqual(renders[i],{viewport:tile.viewport,scissor:tile.scissor,species:i>>2});checks++}}
 ok(target===oldTarget&&renderer.toneMapping===T.ACESFilmicToneMapping&&renderer.autoClear===true&&clearAlpha===.7&&!scissorTest,'renderer state restored on success and failure');
 assert.deepEqual(viewport.toArray(),[1,2,1280,720]);assert.deepEqual(scissor.toArray(),[4,6,800,600]);assert.deepEqual(physical.toArray(),(oldTarget?.viewport||viewport.clone().multiplyScalar(dpr)).toArray());checks+=3;
 ok(clones.every(c=>!c.visible),'temporary bake source visibility restored');atlas.dispose();
}
console.log(JSON.stringify({pass:true,checks,counts:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,v.length])),maxGap,minimumCanopyDistance:nearest,scope:'deterministic spatial/geometry and atlas camera/DPR/state contracts; not GPU/visual/performance acceptance'}));
