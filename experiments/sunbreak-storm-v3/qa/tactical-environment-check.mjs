// Run: node --experimental-vm-modules qa/tactical-environment-check.mjs
// Actual production modules and vendored Three geometry, isolated DOM/audio.
// Numerical checks only: no renderer, screenshots, game writes or Git calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SourceTextModule,createContext} from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url),cache=new Map(),checks=[],metrics={};
const read=name=>readFileSync(new URL(name,root),'utf8');
const hash=s=>createHash('sha256').update(s.replaceAll('\r\n','\n')).digest('hex');
const check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.stack||e.message})}};
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const elements=new Map();
function element(){
 return{style:{},hidden:false,textContent:'',value:65,addEventListener(){},append(){},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]??'false'}};
}
for(const id of ['weatherName','styleName','bMute','soundVolume','bFlash','bPost','stormControls'])elements.set(id,element());
let rngCalls=0;
const math=Object.create(Math);math.random=()=>{rngCalls++;return .371937};
const context=createContext({
 console,Math:math,Uint8Array,Uint8ClampedArray,Float32Array,
 innerWidth:1280,innerHeight:720,matchMedia:()=>({matches:false}),addEventListener(){},
 document:{hidden:false,hasFocus:()=>true,body:{append(){}},addEventListener(){},getElementById:id=>elements.get(id)??null,createElement:element}
});
function moduleAt(url){
 const key=url.href;if(cache.has(key))return cache.get(key);
 const m=new SourceTextModule(readFileSync(url,'utf8'),{context,identifier:key,initializeImportMeta(meta){meta.url=key}});
 cache.set(key,m);return m;
}
const entry=new SourceTextModule(`export * as THREE from './vendor/three/build/three.module.js';
 export * as storm from './storm.js';export * as house from './timber-house.js';export * as logic from './house-logic.js';`,{context,identifier:new URL('tactical-environment-entry.js',root).href});
await entry.link((specifier,reference)=>{
 const url=specifier==='three'?new URL('vendor/three/build/three.module.js',root):specifier.startsWith('three/addons/')?new URL('vendor/three/examples/jsm/'+specifier.slice('three/addons/'.length),root):new URL(specifier,reference.identifier);
 return moduleAt(url);
});
await entry.evaluate();
const {THREE:T,storm:{samplePuddleWetness,createPuddleImpactField,puddleSurfaceExposed,installStorm,buildPuddleImpactMeshes},house:{buildBlackTileRoof,buildTimberHouse},logic}=entry.namespace;

check('protected timber projection and moving-door/interior/movement blocks unchanged',()=>{
 const s=read('timber-house.js');
 assert.equal(hash(s.slice(s.indexOf(' function box('),s.indexOf(' function beam('))),'9352fa5445297a2263f2477ed81ab19a0be1bd0d5c0e8783f81661258e4b16cf');
 assert.equal(hash(s.slice(s.indexOf(' // Wooden hinged leaf'),s.indexOf(' // Batch static opaque'))),'0d96dac99e54ed2512e4dd118e776f6ca397828f1149163a7407986552da63bd');
 assert.equal(hash(s.slice(s.indexOf('  floorHeight,underRoof,'),s.indexOf('  info(){'))),'d2f5f33220ab05797602e8ab5d3130230c2aca6a06159a95c092384676da121e');
});
check('CPU sampler matches texel centres, flipY, bilinear interpolation and edges',()=>{
 const data=new Uint8Array([0,0,0,255,64,64,64,255,128,128,128,255,255,255,255,255]);
 close(samplePuddleWetness(data,2,2,true,-35,35),0);
 close(samplePuddleWetness(data,2,2,true,35,35),64/255);
 close(samplePuddleWetness(data,2,2,true,-35,-35),128/255);
 close(samplePuddleWetness(data,2,2,false,-35,-35),0);
 close(samplePuddleWetness(data,2,2,true,0,0),(0+64+128+255)/4/255);
 close(samplePuddleWetness(data,2,2,true,-70,-70),128/255);
 close(samplePuddleWetness(data,2,2,true,70,-70),1);
 assert.equal(samplePuddleWetness(data,2,2,true,71,0),0);
 assert.equal(samplePuddleWetness(data,2,2,true,NaN,0),0);
});
check('fixed cover excludes cabin/porch, all four houses, six crate stacks and promenade',()=>{
 for(const [x,z]of [[12,-18],[11,-14.3],[10.92,-12.6],[-13,-16],[-21,4],[20,6],[-4,-27],[-6,2],[5,-4],[8,8],[-14,10],[0,-12],[14,-6],[0,18.2],[-9,9],[10,12],[-18,-6],[18,-3],[2,14],[-24,14]])assert.equal(puddleSurfaceExposed(x,z),false,`${x},${z}`);
 // Roof overhangs, not just wall footprints.
 for(const [x,z]of [[7.7,-18],[16.3,-18],[-17.9,-16],[-21,7.95],[20,11.8]])assert.equal(puddleSurfaceExposed(x,z),false,`shelter ${x},${z}`);
 assert.equal(puddleSurfaceExposed(0,8),true);assert.equal(puddleSurfaceExposed(-3,0),true);
});
check('all six original curved palm collider projections are excluded, not just trunk centres',()=>{
 for(const [x,z,h]of [[-9,9,5.2],[10,12,6],[-18,-6,5.6],[18,-3,5],[2,14,5.8],[-24,14,6.2]]){
  const curve=new T.CatmullRomCurve3([0,.25,.5,.75,1].map(t=>new T.Vector3(Math.sin(t*1.6)*t*t*.8,t*h,Math.cos(t*2.2)*t*t*.4)));
  const geo=new T.TubeGeometry(curve,18,.3,10,false),p=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=0;i<p.count;i++){const t=uv.getX(i),c=curve.getPoint(t),s=1-t*.55;p.setXYZ(i,c.x+(p.getX(i)-c.x)*s,p.getY(i),c.z+(p.getZ(i)-c.z)*s)}
  geo.computeBoundingBox();const b=geo.boundingBox.clone().expandByScalar(.05);
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++)assert.equal(puddleSurfaceExposed(x+b.min.x+(b.max.x-b.min.x)*i/8,z+b.min.z+(b.max.z-b.min.z)*j/8),false);
 }
});

const parent=new T.Group(),roof=buildBlackTileRoof(T,parent),roofGroup=parent.children[0];
check('black tile roof uses three bounded draws, real courses/caps, not metallic sheets',()=>{
 assert.equal(roof.drawCalls,3);assert.equal(roofGroup.children.length,3);
 assert.ok(roof.tiles>650&&roof.tiles<1000);assert.equal(roof.ridgeCaps,27);assert.equal(roof.panels,3);
 assert.ok(roof.triangles<30000);assert.equal(roof.collisionChanged,false);
 const tiles=roofGroup.children[0],caps=roofGroup.children[1],material=tiles.material;
 assert.ok(tiles.isInstancedMesh);assert.ok(caps.isInstancedMesh);
 assert.ok(material.metalness<.06);assert.ok(material.color.r>.02&&material.color.r<.06);
 assert.ok(material.roughnessMap&&material.normalMap);assert.ok(material.roughness>.5);
 const colors=new Set(Array.from(tiles.instanceColor.array,v=>v.toFixed(3)));assert.ok(colors.size>50);
 const p=caps.geometry.attributes.position;for(let i=0;i<p.count;i++)assert.ok(p.getY(i)>-1e-6,'ridge cap curves upward');
 const m=new T.Matrix4(),v=new T.Vector3(),rows=new Map(),box=new T.Box3();
 for(let i=0;i<tiles.count;i++){tiles.getMatrixAt(i,m);v.setFromMatrixPosition(m);const key=v.z.toFixed(3);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(v.x);box.expandByPoint(v)}
 assert.ok(rows.size>20);assert.ok(box.min.x>=-4.33&&box.max.x<=4.33);assert.ok(box.min.z>-4.4&&box.max.z<4.3);
 metrics.roof={...roof,courseRows:rows.size,centerBounds:[box.min.toArray(),box.max.toArray()]};
});
check('roof geometry/material data are finite and seeded repeatable',()=>{
 const again=new T.Group();buildBlackTileRoof(T,again);
 for(let i=0;i<3;i++){
  const a=roofGroup.children[i],b=again.children[0].children[i];
  assert.ok(Array.from(a.geometry.attributes.position.array).every(Number.isFinite));
  assert.deepEqual(Array.from(a.geometry.attributes.position.array),Array.from(b.geometry.attributes.position.array));
  if(a.isInstancedMesh)assert.deepEqual(Array.from(a.instanceMatrix.array),Array.from(b.instanceMatrix.array));
 }
 const map=roofGroup.children[0].material.roughnessMap.image.data;assert.ok(new Set(map).size>60);
});

let pixels;
const canvas={width:1024,height:1024,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:img=>{pixels=img.data}})};
const wetMap=new T.CanvasTexture(canvas);
const materials={glass:new T.MeshPhysicalMaterial(),roof:new T.MeshStandardMaterial(),leaf:new T.MeshStandardMaterial(),wood:new T.MeshStandardMaterial(),plaster:new T.MeshStandardMaterial()};
const world=new T.Group(),scene=new T.Scene(),cam=new T.PerspectiveCamera();cam.position.set(0,1.7,12);
const windTrees=[{crown:new T.Group(),phase:.3}];
const sun=new T.DirectionalLight(),amb=new T.HemisphereLight(),grade={material:new T.ShaderMaterial()},groundMat=new T.MeshStandardMaterial();
const ctx={
 T,world,scene,cam,materials,groundMat,windTrees,wetMap,wetCanvas:canvas,wetStrength:{value:1},
 reflection:{material:new T.ShaderMaterial({uniforms:{wetness:{value:1}},fragmentShader:'void main(){gl_FragColor=vec4(1.);}'})},
 skyMaterial:new T.ShaderMaterial({uniforms:{uSky:{value:new T.Color()},uHorizon:{value:new T.Color()}}}),
 sun,amb,grade,atmosphere:new T.Group(),hdrSky:null,gscene:new T.Scene(),rnd:{toneMappingExposure:1},
 weaponKeys:[],weaponHemi:null,practicals:[],lampGlass:new T.MeshStandardMaterial(),facadeMaterials:[],
 rainMaterial:new T.LineBasicMaterial(),composer:{insertPass(){}}
};
const storm=await installStorm(ctx);storm.setWeather(2,0);
const impactInfo=storm.info().impacts,qa=storm.qa.impacts;
metrics.impacts=JSON.parse(JSON.stringify(impactInfo));
check('actual generated wet pixels produce all requested impacts and matching GPU filters',()=>{
 assert.equal(impactInfo.locations,360);assert.equal(impactInfo.drawCalls,3);
 assert.equal(wetMap.flipY,true);assert.equal(wetMap.generateMipmaps,false);
 assert.equal(wetMap.minFilter,T.LinearFilter);assert.equal(wetMap.magFilter,T.LinearFilter);
 assert.ok(impactInfo.placementAttempts<360*220);
});
check('all impact footprints remain wet/exposed, including dense circumference/drop-range probes',()=>{
 let minimum=1;
 for(const s of qa.samples()){
  assert.ok(s.exposed&&s.wetness>=.58);assert.equal(qa.permits(s.x,s.z,s.radius),true);
  close(s.wetness,samplePuddleWetness(pixels,1024,1024,true,s.x,s.z));
  for(let ring=0;ring<=4;ring++)for(let i=0;i<64;i++){
   const a=i/64*Math.PI*2,r=(s.radius+.01)*ring/4,x=s.x+Math.cos(a)*r,z=s.z+Math.sin(a)*r;
   minimum=Math.min(minimum,qa.wetness(x,z));assert.ok(qa.wetness(x,z)>.52);assert.equal(qa.exposed(x,z),true);
  }
 }
 metrics.minimumDenseFootprintWetness=minimum;
});
check('radii, ages, lives, cadence and spatial distribution are independently varied',()=>{
 const samples=qa.samples(),span=key=>Math.max(...samples.map(s=>s[key]))-Math.min(...samples.map(s=>s[key]));
 assert.ok(span('radius')>.22);assert.ok(span('life')>.7);assert.ok(span('period')>2.6);assert.ok(span('age')>3);
 const bins=key=>new Set(samples.map(s=>Math.floor(s[key]*20))).size;
 assert.ok(bins('radius')>=5);assert.ok(bins('life')>10);
 const cells=new Set(samples.map(s=>`${Math.floor(s.x/4)},${Math.floor(s.z/4)}`));assert.ok(cells.size>12);
 const active=impactInfo.activeRipples;assert.ok(active>70&&active<280);assert.ok(impactInfo.airborneDroplets>100);
 metrics.distribution={radiusSpan:span('radius'),lifeSpan:span('life'),periodSpan:span('period'),ageSpan:span('age'),fourMeterCells:cells.size};
});
check('read-only QA returns copies, no renderer/state mutation capability',()=>{
 assert.ok(Object.isFrozen(qa));const a=qa.sample(0),buffers=qa.buffers(),clock=qa.clock();
 a.x=999;buffers.centers[0]=999;buffers.events[0]=999;
 assert.notEqual(qa.sample(0).x,999);assert.notEqual(qa.sample(0).radius,999);assert.ok(Object.isFrozen(clock));
 assert.equal(qa.setRain,undefined);assert.equal(qa.update,undefined);assert.equal(qa.sample(-1),null);
});
check('deterministic rejection sampling honours optional exposure veto and never spawns on dry pixels',()=>{
 const input={data:pixels,width:1024,height:1024,count:80,flipY:true,isSurfaceExposed:(x,z)=>x<0&&z<8};
 const a=createPuddleImpactField(input),b=createPuddleImpactField(input);
 assert.equal(a.info().locations,80);assert.deepEqual(Array.from(a.positions),Array.from(b.positions));
 for(const s of a.qa.samples())assert.ok(s.x<0&&s.z<8);
 const dry=createPuddleImpactField({data:new Uint8Array(64*64*4),width:64,height:64,count:8});
 assert.equal(dry.info().locations,0);assert.equal(dry.info().drawCalls,0);
 const veto=createPuddleImpactField({...input,count:4,isSurfaceExposed:()=>false});assert.equal(veto.info().locations,0);
});
check('rings expand/fade and airborne motion rises then returns ballistically',()=>{
 const data=qa.buffers(),n=data.centers.length/2;let found=false;
 for(let i=0;i<n;i++){
  const p=qa.sample(i),start=p.period-p.phase+.04,early=qa.sample(i,start),late=qa.sample(i,start+p.life*.65);
  if(early.rippleOpacity<=0||late.rippleOpacity<=0)continue;
  assert.ok(late.rippleRadius>early.rippleRadius);assert.ok(late.rippleOpacity<early.rippleOpacity);
  const flight=.30+p.radius*.48,takeoff=qa.sample(i,p.period-p.phase+.01),apex=qa.sample(i,p.period-p.phase+flight/2),land=qa.sample(i,p.period-p.phase+flight+.01);
  assert.ok(apex.dropHeight>takeoff.dropHeight&&apex.dropHeight>.1);assert.equal(land.dropHeight,0);assert.equal(land.airborneActive,false);found=true;break;
 }
 assert.ok(found);
});
check('actual storm pause/presentation freezes all effect clocks and buffers without consuming combat RNG',()=>{
 storm.update(.25,{live:true,pres:false,paused:false});
 const before=JSON.stringify(storm.qa.clock()),buffers=JSON.stringify(qa.buffers()),rotation=windTrees[0].crown.rotation.z,calls=rngCalls;
 for(let i=0;i<120;i++)storm.update(1/60,{live:true,pres:false,paused:true});
 assert.equal(JSON.stringify(storm.qa.clock()),before);assert.equal(windTrees[0].crown.rotation.z,rotation);
 for(let i=0;i<120;i++)storm.update(1/60,{live:true,pres:true});
 assert.equal(JSON.stringify(storm.qa.clock()),before);assert.equal(JSON.stringify(qa.buffers()),buffers);
 assert.equal(rngCalls,calls);assert.equal(storm.info().impacts.frozen,true);
 storm.update(.25,{live:true,pres:false,paused:false});assert.equal(qa.clock().elapsed,.5);
});
check('rain off stops emission/opacity and clocks; re-enable resumes without hidden births',()=>{
 storm.setWeather(0,0);const start=storm.info().impacts;
 for(let i=0;i<240;i++)storm.update(1/60,{live:false,pres:false});
 const off=storm.info().impacts;assert.equal(off.elapsed,start.elapsed);assert.equal(off.emitted,start.emitted);
 assert.equal(off.activeRipples,0);assert.equal(off.activeCrowns,0);assert.equal(off.airborneDroplets,0);assert.equal(qa.sample(0).rippleOpacity,0);
 storm.setWeather(2,0);storm.update(.1,{live:true,pres:false});close(qa.clock().elapsed,start.elapsed+.1);
});
check('impact frames only update uniforms, with a bounded three shared mesh batches',()=>{
 const field=createPuddleImpactField({data:pixels,width:1024,height:1024,count:12}),group=buildPuddleImpactMeshes(T,field,wetMap);
 assert.equal(group.children.length,3);
 for(const [i,m]of group.children.entries()){
  assert.ok(m.geometry.isInstancedBufferGeometry);assert.equal(m.geometry.instanceCount,i===2?108:12);
  assert.equal(m.material.depthWrite,false);assert.equal(m.material.forceSinglePass,true);assert.equal(m.material.uniforms.uTime,field.time);assert.equal(m.material.uniforms.uRain,field.rain);
  assert.equal(m.material.uniforms.uWetMap.value,wetMap);assert.ok(m.material.fragmentShader.includes('wetMask()'));
 }
 const before=group.children.map(m=>Array.from(m.geometry.attributes.aEvent.array)),calls=rngCalls;
 for(let i=0;i<600;i++)field.update(1/60);
 group.children.forEach((m,i)=>assert.deepEqual(Array.from(m.geometry.attributes.aEvent.array),before[i]));assert.equal(rngCalls,calls);
});
check('existing house geometry batching retains all tile instances, bounds and real hinged leaf',()=>{
 const solids=[new T.Group(),new T.Group()],colliders=[new T.Box3(),new T.Box3(new T.Vector3(8,0,-22),new T.Vector3(16,5.2,-14))];
 const h=buildTimberHouse({T,world:new T.Group(),materials,solids,colliders,cam,getInteractionState:()=>({active:false,player:null})});
 const info=h.info();assert.equal(info.roof.tiles,roof.tiles);assert.equal(info.raycastUsesVisibleAssembly,true);assert.equal(colliders.length,1);
 assert.equal(h.qa.root.getObjectByName('staggered-black-tile-courses').count,roof.tiles);
 assert.ok(h.qa.movement.length>20);assert.equal(info.door.angle,0);
 assert.equal(logic.floorHeight(12,-18),.66);assert.equal(logic.floorHeight(9,-13),0);
 assert.equal(logic.underRoof(11,2.8,-14.4),true);assert.equal(logic.underRoof(0,2,0),false);
 assert.equal(logic.bodyOverlaps({x:10.92,y:2.36,z:-15.6},logic.doorBounds(0)),true);
 assert.equal(logic.bodyOverlaps({x:10.92,y:2.36,z:-15.6},logic.doorBounds(logic.HOUSE.openAngle)),false);
});

const report={schema:'sunbreak-tactical-environment-numerical-v1',date:new Date().toISOString(),method:'actual production modules and vendored Three geometry; isolated DOM/compositor; no WebGL/art/performance claim',verdict:checks.every(c=>c.pass)?'NUMERICAL PASS / BROWSER QA PENDING':'REWORK',pass:checks.every(c=>c.pass),sourceSha256:Object.fromEntries(['storm.js','timber-house.js','house-logic.js'].map(name=>[name,hash(read(name))])),checks,metrics,integration:{required:'Forward paused flag to storm.update(dt,{live,pres,paused}).',qa:'Optionally expose storm.qa as visual.stormQA. All hooks are read-only copies.',optional:'isSurfaceExposed(x,z) in installStorm context adds a veto to fixed original cover checks. Current fixed layout needs no hook.'}};
writeFileSync(new URL('./tactical-environment-unit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass),metrics,report:fileURLToPath(new URL('./tactical-environment-unit.json',import.meta.url))},null,2));
if(!report.pass)process.exitCode=1;
