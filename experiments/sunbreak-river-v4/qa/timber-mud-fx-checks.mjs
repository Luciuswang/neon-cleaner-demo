// CPU-only runtime checks for the 1s surface impact marks in combat-feedback.js.
// Uses the real pinned Three build and samples the real instanced effect pool
// (fxShape = width, height, alpha, mode). No GPU, browser, textures or network.
// Prints evidence only; writes no report. Deliberately no source-hash/snapshot
// identity checks and no claims about shader pixels, hut wood, boot tracks,
// muzzle-flash legibility or art/performance acceptance: those need a real
// rendered review. Not covered here: the actual village wood collision proxies
// and the terrain puddle classification (their source was not available to
// this check); only the classifier contract and a tagged proxy stand-in are run.
import assert from 'node:assert/strict';
const vendor=new URL('../../sunbreak-storm-v3/vendor/presentation/',import.meta.url);
const T=await import(new URL('build/three.module.js',vendor).href);
const {buildCombatFeedback,combatEventFromIntersection,combatMaterialKind,COMBAT_FEEDBACK_LIMITS:L}=await import('../combat-feedback.js');
const checks=[];
function check(name,fn){try{const evidence=fn();checks.push({name,pass:true,...(evidence===undefined?{}:{evidence})})}catch(error){checks.push({name,pass:false,error:String(error&&error.stack||error)})}}
const vec=(x,y,z)=>new T.Vector3(x,y,z);
function fixture(){
 const world=new T.Group(),fx=buildCombatFeedback({T,world}),root=world.children[0];
 return {world,fx,root,puffs:root.children.find(c=>c.name==='combat-dust-smoke'),flecks:root.children.find(c=>c.name==='combat-chips-sparks')};
}
function sample(mesh){
 const g=mesh.geometry,s=g.getAttribute('fxShape'),c=g.getAttribute('fxCenter'),n=g.getAttribute('fxNormal'),t=g.getAttribute('fxTangent'),k=g.getAttribute('fxContact'),out=[];
 for(let i=0;i<g.instanceCount;i++)out.push({mode:s.getW(i),alpha:s.getZ(i),width:s.getX(i),height:s.getY(i),center:vec(c.getX(i),c.getY(i),c.getZ(i)),normal:vec(n.getX(i),n.getY(i),n.getZ(i)),tangent:vec(t.getX(i),t.getY(i),t.getZ(i)),contact:vec(k.getX(i),k.getY(i),k.getZ(i))});
 return out;
}
const marks=mesh=>sample(mesh).filter(p=>p.mode>=4);
const floorHit=kind=>({hit:true,point:vec(2,0,-5),normal:vec(0,1,0),direction:vec(.2,-1,-.3).normalize(),kind});
const wallHit=kind=>({hit:true,point:vec(1,1.4,-4),normal:vec(0,0,1),direction:vec(0,0,-1),kind});
const expected={water:{base:4,count:2,event:floorHit},earth:{base:5,count:1,event:floorHit},wood:{base:6,count:1,event:wallHit},stone:{base:7,count:1,event:wallHit}};

for(const [kind,spec] of Object.entries(expected))check('actual '+kind+' hit: surface marks hold at .5s, fade by .85s, gone after 1s',()=>{
 const f=fixture(),event=spec.event(kind),result=f.fx.shot(event);
 assert.equal(result.impact,true);assert.equal(result.kind,kind);
 const m0=marks(f.puffs);
 assert.equal(m0.length,spec.count,'mark count at hit');
 for(const m of m0){
  assert.equal(Math.floor(m.mode),spec.base,'material mode');
  assert.ok(m.alpha>.3,'mark visible at hit');assert.ok(m.width>0&&m.height>0);
  // lies on the hit plane, lifted along the real normal only
  const lift=m.center.clone().sub(event.point);
  assert.ok(Math.abs(lift.dot(event.normal)-L.markOffset)<1e-5,'mark offset along normal');
  assert.ok(lift.clone().addScaledVector(event.normal,-L.markOffset).length()<1e-5,'mark centred on hit point');
  assert.ok(m.contact.distanceTo(event.point)<1e-5);
  assert.ok(Math.abs(m.normal.dot(event.normal)-1)<1e-5,'stored normal');
  assert.ok(Math.abs(m.tangent.length()-1)<1e-5&&Math.abs(m.tangent.dot(event.normal))<1e-5,'tangent in surface plane');
 }
 assert.equal(marks(f.flecks).length,0,'marks only in the normal-blend pool');
 assert.equal(f.puffs.material.blending,T.NormalBlending);assert.equal(f.flecks.material.blending,T.AdditiveBlending);
 assert.equal(f.puffs.material.depthWrite,false);assert.equal(f.puffs.material.transparent,true);
 assert.equal(f.root.children.length,2,'no extra draw objects');
 f.fx.update(.5);
 const m5=marks(f.puffs);assert.equal(m5.length,spec.count,'marks active at .5s');
 m5.forEach((m,i)=>assert.ok(Math.abs(m.alpha-m0[i].alpha)<1e-6,'no fade before late window'));
 f.fx.update(.35);
 const m85=marks(f.puffs);assert.equal(m85.length,spec.count,'marks active at .85s');
 m85.forEach((m,i)=>{assert.ok(m.alpha<m0[i].alpha*.9,'fading at .85s');assert.ok(m.alpha>.02,'still visible at .85s')});
 f.fx.update(.16);
 assert.equal(marks(f.puffs).length,0,'marks gone after 1s');
 assert.equal(f.puffs.geometry.instanceCount,0);assert.equal(f.flecks.geometry.instanceCount,0);
 assert.equal(f.puffs.visible,false);assert.equal(f.flecks.visible,false);
 const info=f.fx.info();assert.equal(info.drawCalls,0);assert.equal(info.decals,0);
 f.fx.dispose();
 return {modes:m0.map(m=>+m.mode.toFixed(3)),alpha0:m0.map(m=>+m.alpha.toFixed(3)),alpha85:m85.map(m=>+m.alpha.toFixed(3))};
});

check('metal and actor hits create no surface marks',()=>{
 for(const kind of ['metal','actor']){const f=fixture();assert.equal(f.fx.shot(wallHit(kind)).impact,true);assert.equal(marks(f.puffs).length,0,kind);assert.equal(marks(f.flecks).length,0,kind);f.fx.dispose()}
});

check('true miss and invalid hits never create an impact or mark',()=>{
 const f=fixture(),muzzle=vec(0,1.5,0),direction=vec(0,0,-1);
 // miss carrying a max-range endpoint and a normal must still not impact
 const cases=[{hit:false,muzzle,direction},{hit:false,point:vec(0,1.5,-400),normal:vec(0,0,1),direction},{point:vec(0,1,-4),normal:vec(0,0,1),direction},{hit:true,point:vec(0,1,-4),normal:vec(NaN,0,0),direction},{hit:true,point:vec(0,1,-4),normal:vec(0,0,0),direction},{hit:true,point:vec(Infinity,1,-4),normal:vec(0,0,1),direction},{}];
 for(const event of cases){const r=f.fx.shot(event);assert.equal(r.accepted,true);assert.equal(r.impact,false);assert.equal(marks(f.puffs).length,0);assert.equal(f.flecks.geometry.instanceCount,0)}
 const active=sample(f.puffs);
 assert.equal(active.length,2,'only the muzzle smoke of the one miss with a muzzle');
 assert.ok(active.every(p=>p.mode<4));
 const info=f.fx.info();assert.equal(info.impacts,0);assert.equal(info.lastImpact,null);assert.equal(info.misses+info.invalidHits,cases.length);
 f.fx.update(1.01);assert.equal(f.puffs.geometry.instanceCount,0);
 f.fx.dispose();
 return {misses:info.misses,invalidHits:info.invalidHits};
});

check('repeated max-rate fire stays inside fixed pools and two draws, then fully expires',()=>{
 const f=fixture(),kinds=['water','earth','wood','stone','metal','actor'];let peak=0,peakMarks=0;
 const buffers=['fxCenter','fxShape','fxNormal'].map(k=>f.puffs.geometry.getAttribute(k).array);
 for(let i=0;i<900;i++){
  const kind=kinds[i%kinds.length],event=(i%2?floorHit:wallHit)(kind);event.muzzle=vec(0,1.5,0);
  f.fx.shot(event);if(i%3)f.fx.update(1/120);
  const a=f.puffs.geometry.instanceCount,b=f.flecks.geometry.instanceCount,m=marks(f.puffs).length;
  assert.ok(a<=L.puffs+L.marks,'normal pool capacity');assert.ok(b<=L.flecks,'additive pool capacity');assert.ok(m<=L.marks,'mark ring capacity');
  assert.ok((a+b)*2<=L.triangles,'triangle bound');
  peak=Math.max(peak,a+b);peakMarks=Math.max(peakMarks,m);
 }
 assert.equal(f.root.children.length,2,'no objects added while firing');
 assert.equal(f.world.children.length,1);
 ['fxCenter','fxShape','fxNormal'].forEach((k,i)=>assert.equal(f.puffs.geometry.getAttribute(k).array,buffers[i],'buffers reused, not reallocated'));
 const info=f.fx.info();assert.ok(info.drawCalls<=L.drawCalls,'two-draw bound');assert.equal(info.decals,0);
 f.fx.update(1.01);
 assert.equal(f.puffs.geometry.instanceCount,0);assert.equal(f.flecks.geometry.instanceCount,0);
 assert.equal(f.puffs.visible||f.flecks.visible,false);
 f.fx.dispose();
 return {peakInstances:peak,peakMarks};
});

check('dispose releases resources and detaches; repeated max-rate cycles leave nothing',()=>{
 const f=fixture();let disposed=0;
 for(const m of [f.puffs,f.flecks]){m.geometry.addEventListener('dispose',()=>disposed++);m.material.addEventListener('dispose',()=>disposed++)}
 f.fx.shot(wallHit('wood'));f.fx.dispose();
 assert.equal(disposed,4);assert.equal(f.world.children.length,0);assert.equal(f.root.children.length,0);
 assert.equal(f.fx.shot(wallHit('wood')).accepted,false);f.fx.update(.1);f.fx.dispose();
 assert.equal(disposed,4,'second dispose is a no-op');
 const world=new T.Group();
 for(let c=0;c<25;c++){
  const fx=buildCombatFeedback({T,world});
  for(let i=0;i<200;i++){fx.shot(floorHit(i%2?'water':'earth'));fx.update(1/120)}
  fx.dispose();assert.equal(world.children.length,0,'cycle '+c);
 }
 return {disposeEvents:disposed,cycles:25};
});

check('classifier contract: explicit tag wins, names map puddle/mud/timber',()=>{
 const mesh=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial());
 assert.equal(combatMaterialKind(mesh),'stone');
 mesh.name='broad-puddle-3';assert.equal(combatMaterialKind(mesh),'water');
 mesh.name='riverbank-mud';assert.equal(combatMaterialKind(mesh),'earth');
 mesh.name='hut-timber-proxy';assert.equal(combatMaterialKind(mesh),'wood');
 mesh.name='riverbank-mud';mesh.userData.impactKind='wood';assert.equal(combatMaterialKind(mesh),'wood','tag overrides name');
 mesh.userData.impactKind='not-a-kind';assert.equal(combatMaterialKind(mesh),'earth','unknown tag ignored');
});

check('tagged wood proxy stand-in: real raycast hit gives wood mark, real miss gives none',()=>{
 const proxy=new T.Mesh(new T.BoxGeometry(2,2,.2),new T.MeshBasicMaterial());
 proxy.userData.impactKind='wood';proxy.position.set(0,1,-4);proxy.rotation.y=.4;proxy.updateMatrixWorld(true);
 const dir=vec(0,0,-1),hits=new T.Raycaster(vec(0,1,0),dir).intersectObject(proxy);
 assert.ok(hits.length>0,'ray hits proxy');
 const event=combatEventFromIntersection(T,hits[0],dir);
 assert.equal(event.hit,true);assert.equal(event.kind,'wood');
 const n=event.normal.clone().normalize();
 assert.ok(n.distanceTo(vec(Math.sin(.4),0,Math.cos(.4)))<1e-6,'world normal follows proxy rotation');
 assert.ok(n.dot(dir)<0,'normal faces the incoming ray');
 const f=fixture(),r=f.fx.shot(event);
 assert.equal(r.kind,'wood');
 const m=marks(f.puffs);assert.equal(m.length,1);assert.equal(Math.floor(m[0].mode),6);
 assert.ok(Math.abs(m[0].normal.dot(n)-1)<1e-5);
 f.fx.dispose();
 const up=vec(0,1,0),none=new T.Raycaster(vec(0,1,0),up).intersectObject(proxy);
 assert.equal(none.length,0,'ray misses proxy');
 const missEvent=combatEventFromIntersection(T,none[0],up);
 assert.equal(missEvent.hit,false);
 const g=fixture();assert.equal(g.fx.shot(missEvent).impact,false);
 assert.equal(g.puffs.geometry.instanceCount,0);assert.equal(g.flecks.geometry.instanceCount,0);
 g.fx.dispose();
 return {hitDistance:+hits[0].distance.toFixed(4)};
});

const failed=checks.filter(c=>!c.pass);
console.log(JSON.stringify({suite:'timber-mud-fx-checks',passed:checks.length-failed.length,failed:failed.length,notCovered:'Real village wood proxies, terrain puddle classification, hut wood, boot tracks, muzzle flash and all rendered pixels are not exercised here; GPU/art/performance review pending.',checks},null,1));
if(failed.length)process.exitCode=1;
