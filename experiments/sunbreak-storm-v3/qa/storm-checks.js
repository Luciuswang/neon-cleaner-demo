// Inline-scope diagnostic served ONLY at /storm-test. Synthetic fixtures are
// not human playtesting or a full continuous-motion/art review.
(async()=>{
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
 const waitFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const serial=()=>JSON.stringify({S,pos:pos.toArray(),vel:vel.toArray(),colliders:colliders.map(b=>[b.min.toArray(),b.max.toArray()]),anchors:enemies.map(e=>({g:e.g.position.toArray(),hp:e.hp,alive:e.alive,cd:e.cd,ph:e.ph}))});
 setPres(true);
 check('default storm weather',visual.info().weatherIndex===2);
 check('honest engine identity',visual.info().source.includes('not Unreal'));
 check('licensed MP5 loaded',visual.info().weapon.loaded&&visual.info().weapon.license==='CC-BY-4.0',visual.info().weapon);
 check('actual transformed muzzle matches original tracer origin',visual.info().weapon.fittedMuzzle.every((n,i)=>Math.abs(n-[0,.005,-1.85][i])<1e-6),visual.info().weapon.fittedMuzzle);
 check('six licensed tactical display skins loaded',visual.info().actors.loaded&&visual.info().actors.count===6&&visual.info().actors.license==='CC-BY-4.0',visual.info().actors);
 check('no missing render assets',visual.info().textureErrors.length===0,visual.info().textureErrors);
 check('storm HDR loaded',visual.info().loadedHDR);
 const before=serial();
 for(let s=0;s<2;s++)for(let w=0;w<3;w++){visual.setStyle(s);visual.setWeather(w);await waitFrame();check(`weather ${w} style ${s} draws`,visual.info().weatherIndex===w&&visual.info().style===s)}
 check('weather and style preserve all combat/layout state',serial()===before);
 visual.setStyle(0);visual.setWeather(2);
 const post=document.getElementById('bPost'),flashButton=document.getElementById('bFlash');
 post.click();check('post-processing can disable',visual.info().storm.post===false);
 post.click();check('post-processing restores',visual.info().storm.post===true);
 if(!visual.info().storm.reducedFlash)flashButton.click();
 check('flash-reduction control works',visual.info().storm.reducedFlash===true);
 const beforeAdvance=serial();
 // Explicit presentation-unit step, NOT a benchmark or real-time motion proof.
 let rngCalls=0;const oldRandom=Math.random;Math.random=()=>{rngCalls++;return .5};
 try{for(let i=0;i<510;i++)visual.update(1/60,{S,pres:false,cam,gun,live:false})}finally{Math.random=oldRandom}
 check('reduced-flash steps remain dark',visual.info().storm.flash===0);
 check('storm updates preserve game/layout state',serial()===beforeAdvance);
 check('storm updates do not consume combat RNG',rngCalls===0,{rngCalls});
 flashButton.click();check('lightning can re-enable',visual.info().storm.reducedFlash===false);
 let peak=0,events=visual.info().storm.flashes;
 for(let i=0;i<2100;i++){visual.update(1/60,{S,pres:false,cam,gun,live:false});peak=Math.max(peak,visual.info().storm.flash)}
 check('lightning event occurs and is bounded',visual.info().storm.flashes>events&&peak>0&&peak<=1,{peak,events:visual.info().storm.flashes-events});
 check('eight legacy facade lights, two real room lamps and four practicals',visual.info().storm.interiorLights===8&&visual.info().house.interiorLights===2&&visual.info().storm.practicalLights===4);
 check('peripheral vegetation installed',visual.info().storm.grassTufts===1600&&visual.info().storm.fernClusters===8);
 dispatchEvent(new Event('blur'));
 visual.update(1/60,{S,pres:false,cam,gun,live:true});
 check('weather audio remains inactive after blurred update',visual.info().storm.ambientAudio.active===false);
 dispatchEvent(new Event('focus'));
 for(const id of ['stormControls','soundControls'])for(const code of ['KeyW','KeyF']){
  dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));check(id+' does not break held '+code,keys[code]===true);
  const button=document.getElementById(id).querySelector('button');
  button.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
  check(id+' allows held '+code+' release',keys[code]===false);
  button.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
  check(id+' isolates fresh '+code,keys[code]===false);
 }
 check('diagnostic state still preserved',serial()===beforeAdvance);
 clearKeys();
 const report={date:new Date().toISOString(),method:'actual browser, synthetic rendering/lifecycle fixtures; time stepping is not real-time footage',checks,pass:checks.every(c=>c.pass),settings:visual.info(),viewport:[innerWidth,innerHeight],canvas:[cv.width,cv.height]};
 const out=document.createElement('pre');out.id='storm-result';out.style.cssText='position:fixed;inset:20px;background:#112029ef;color:#dfebdf;padding:24px;overflow:auto;z-index:1000;font:12px monospace';out.textContent=JSON.stringify(report,null,2);document.body.append(out);
 const response=await fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'storm-current',report,loadedBuildHashes:qaBuildHashes})});document.body.dataset.stormReport=response.ok?'saved':'failed';
})().catch(error=>{document.body.dataset.stormError=error.stack||String(error)});
