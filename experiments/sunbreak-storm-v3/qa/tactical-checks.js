// Explicit synthetic browser fixtures, never included in the public build.
(async()=>{
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 const stateSave={...S},posSave=pos.clone(),wasPres=pres,h=visual.houseQA;
 S.state='play';setPres(false);pos.copy(SPAWNPOS);
 tactical.reset();
 check('six authorized tactical spawns, including raised cabin guard',enemies.every((e,i)=>[e.g.position.x,e.g.position.y,e.g.position.z].every((n,k)=>Math.abs(n-TACTICAL_SPAWNS[i][k])<1e-6)));
 check('all six initial actor bodies outside actual movement blockers',enemies.every(e=>!collide(e.g.position.clone().add(new THREE.Vector3(0,1.6,0)),'enemy')));
 check('actual navigation grid built around architecture',tactical.info().navigation.blocked>300&&tactical.info().coverPairs>30,tactical.info().navigation);
 check('actual building blocks shoulder sightline',!clearSight({x:-13,y:1.4,z:-10},{x:-13,y:1.4,z:-22}));
 const beforeHP=S.hp;
 const aimAt=(e,p)=>{
  const dx=p.x-e.g.position.x,dz=p.z-e.g.position.z,d=Math.hypot(dx,dz),offset=e.wg2.position.x;
  e.g.rotation.y=Math.atan2(dx,dz)-Math.asin(offset/d);
  e.wg2.rotation.x=-Math.atan2(p.y-e.g.position.y-e.wg2.position.y,Math.sqrt(d*d-offset*offset));
 };
 h.door.reset();h.pivot.rotation.y=0;h.refresh();
 const indoor=enemies[5];indoor.g.position.set(10.92,.66,-16.85);indoor.g.rotation.y=0;indoor.wg2.position.y=1.43;indoor.wg2.rotation.x=0;
 indoor.tactical.stance=0;
 aimAt(indoor,new THREE.Vector3(10.92,2.09,-14));
 check('closed real cabin door blocks actual enemy shot without damage',enemyShoot(indoor,new THREE.Vector3(10.92,2.09,-14))===false&&S.hp===beforeHP);
 indoor.g.position.z=-16.2;
 const gunPose=indoor.gunTip.getWorldPosition(new THREE.Vector3());
 check('shoulder to protruding actual weapon tip cannot skip a closed door',!clearSight({x:10.92,y:2.09,z:-16.2},gunPose));
 indoor.g.position.z=-16.85;
 h.door.toggle({near:true,visible:true,active:true});h.door.step(2,null);h.pivot.rotation.y=h.door.angle;h.refresh();
 check('open real door allows a geometrically valid doorway sightline',clearSight({x:10.92,y:2.09,z:-16.85},{x:10.92,y:2.09,z:-14}));
 const productionTarget=new THREE.Vector3(10.92,2.09,-14),tracersBefore=tracers.length;
 indoor.g.rotation.y+=Math.PI;
 check('production shooting rejects a backwards-pointing weapon without effects',enemyShoot(indoor,productionTarget)===false&&tracers.length===tracersBefore&&S.hp===beforeHP);
 aimAt(indoor,productionTarget);pos.copy(productionTarget);
 check('production shooting accepts aligned unobstructed weapon and emits tracer',enemyShoot(indoor,productionTarget)===true&&tracers.length===tracersBefore+1);
 h.door.reset();h.pivot.rotation.y=0;h.refresh();
 tactical.reset();S.hp=100000;pos.copy(SPAWNPOS);
 let accepted=0,badShots=0,overlap=0;const modes=new Set(),samples=[];
 const fixture=createTacticalAI({enemies,bounds:[...colliders,{min:{x:8,y:0,z:-22},max:{x:16,y:4.74,z:-15.6}}],
  isBlocked:p=>collide(new THREE.Vector3(p.x,p.y,p.z),'enemy'),canSee:clearSight,
  onShoot(e,p){
   const shoulder={x:e.g.position.x,y:e.g.position.y+1.43-.52*e.tactical.stance,z:e.g.position.z};
   const muzzle=e.gunTip.getWorldPosition(new THREE.Vector3());
   const approved=clearSight(shoulder,muzzle)&&clearSight(muzzle,p);
   if(!approved)return false;
   const count=tracers.length,fired=enemyShoot(e,p);
   if(fired){accepted++;if(tracers.length!==count+1||!clearSight(shoulder,muzzle)||!clearSight(muzzle,p))badShots++}
   return fired;
  }});
 const guardPlayer=new THREE.Vector3(10.92,2.36,-13.6);
 pos.copy(guardPlayer);
 fixture.reset();
 for(let frame=0;frame<360;frame++)fixture.update(1/60,{live:true,player:guardPlayer});
 check('cabin guard cannot engage through the closed real door',fixture.info().actors[5].shots===0);
 h.door.toggle({near:true,visible:true,active:true});h.door.step(2,null);h.pivot.rotation.y=h.door.angle;h.refresh();
 fixture.reset();
 for(let frame=0;frame<600;frame++){
  fixture.update(1/60,{live:true,player:guardPlayer});
  visual.update(1/60,{S,pres:false,live:true,player:guardPlayer});
 }
 check('cabin guard actually peeks and fires through the opened doorway',fixture.info().actors[5].shots>0,fixture.info().actors[5]);
 h.door.reset();h.pivot.rotation.y=0;h.refresh();fixture.reset();pos.copy(SPAWNPOS);
 accepted=badShots=overlap=0;
 // Deliberately fixed target and deterministic simulation for coverage, not FPS.
 for(let frame=0;frame<1200;frame++){
  fixture.update(1/60,{live:true,player:pos});
  visual.update(1/60,{S,pres:false,live:true,player:pos});
  for(const e of enemies){modes.add(e.tactical.mode);if(collide(e.g.position.clone().add(new THREE.Vector3(0,1.6,0)),'enemy'))overlap++}
  if(frame%60===0)samples.push({time:frame/60,tactical:fixture.info(),poses:visual.actorQA?.()});
 }
 check('actual geometry cover loop reaches movement/peek/aim/fire/retreat states',['advance','hide','peek','aim','burst','retreat'].every(m=>modes.has(m)),[...modes]);
 check('production shot callback approves aligned unobstructed shots and matching effects only',accepted>0&&badShots===0,{accepted,badShots});
 check('no actual NPC body crosses geometry during cover fixtures',overlap===0,{overlap});
 check('skeleton renderer ready without missing assets',visual.info().actors.loaded&&visual.info().textureErrors.length===0,visual.info().textureErrors);
 const before=JSON.stringify(fixture.info());
 fixture.update(.5,{live:false,player:pos});
 check('paused AI clock and actor decisions freeze',JSON.stringify(fixture.info())===before);
 const posesBefore=JSON.stringify(visual.actorQA?.());
 S.state='pause';visual.update(.2,{S,pres:false,live:false,player:pos});
 check('paused skeletal pose freezes',JSON.stringify(visual.actorQA?.())===posesBefore);
 const impacts=visual.stormQA?.impacts,oldClock=impacts?.clock();
 visual.update(.2,{S,pres:false,live:false,player:pos});
 check('paused rain impact clock freezes',!!impacts&&impacts.clock().elapsed===oldClock.elapsed);
 if(impacts){
  const rain=impacts.samples();
  check('all installed rain impacts lie on exposed real wet field',rain.length>250&&rain.every(s=>s.exposed&&s.wetness>=.579),{locations:rain.length});
  check('installed rings vary in size and timing',new Set(rain.map(s=>s.radius.toFixed(3))).size>50&&new Set(rain.map(s=>s.phase.toFixed(3))).size>50);
 }
 visual.setWeather(0);check('dry weather disables ring/crown/drop emitters',visual.info().storm.impacts.rainEnabled===false&&visual.info().storm.impacts.activeRipples===0);
 visual.setWeather(2);S.state='play';visual.update(.2,{S,pres:false,live:true,player:pos});
 check('rain resumes after pause and weather toggle',visual.info().storm.impacts.elapsed>oldClock.elapsed&&visual.info().storm.impacts.rainEnabled);
 check('black tile roof and jointed ridge installed',visual.info().house.roof?.tiles>650&&visual.info().house.roof?.ridgeCaps===27,visual.info().house.roof);
 enemies.forEach(e=>e.alive=false);const deadBefore=fixture.info().totalShots;
 fixture.update(.05,{live:true,player:pos});
 check('dead units cannot fire',fixture.info().totalShots===deadBefore);
 enemies.forEach(e=>{e.alive=true;e.hp=100;e.g.rotation.x=0});tactical.reset();
 Object.assign(S,stateSave);pos.copy(posSave);setPres(wasPres);clearKeys();visual.resetHouse();updHUD();
 const report={date:new Date().toISOString(),method:'actual WebGL browser synthetic tactical/geometry/pose/wet-field integration; fixed target, not performance or human walkthrough',pass:checks.every(c=>c.pass),checks,samples};
 const out=document.createElement('pre');out.id='tactical-result';out.style.cssText='position:fixed;inset:20px;z-index:1000;overflow:auto;background:#122027ef;color:#e3e9dc;padding:24px;font:12px monospace';out.textContent=JSON.stringify({pass:report.pass,checks},null,2);document.body.append(out);
 const response=await fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'tactical-browser',report,loadedBuildHashes:qaBuildHashes})});
 document.body.dataset.tacticalReport=response.ok?'saved':'failed';
})().catch(e=>document.body.dataset.tacticalError=e.stack||String(e));
