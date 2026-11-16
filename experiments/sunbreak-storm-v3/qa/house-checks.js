// Explicit /house-test synthetic integration. Never used as real-time performance.
(async()=>{
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 const h=visual.houseQA,save={S:{...S},pos:pos.clone(),camera:cam.position.clone(),quaternion:cam.quaternion.clone(),pres,vy,onGround};
 setPres(true);
 const baselineBytes=await(await fetch('./qa/evidence/final-hero.json')).arrayBuffer();
 const baselineSha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',baselineBytes)),v=>v.toString(16).padStart(2,'0')).join('');
 if(baselineSha!=='c40854b2293dda1beeaffb950edbfae4d7c12c6989c4e6dfccf7bd921a79a232')throw Error('Historical proxy baseline changed');
 const baseline=JSON.parse(new TextDecoder().decode(baselineBytes));
 check('historical proxy baseline hash pinned',true,baselineSha);
 const expected=baseline.colliders.filter((_,i)=>i!==1);
 check('other17 movement proxy bounds unchanged',JSON.stringify(expected)===JSON.stringify(colliders.map(b=>({min:b.min.toArray(),max:b.max.toArray()}))));
 check('six spawn anchors unchanged',JSON.stringify(SPAWN)===JSON.stringify([[-8,-10],[9,-9],[-13,3],[14,3],[-3,-20],[9,-13]]),SPAWN);
 check('legacy body no longer ray blocker',solids[1]===h.root&&solids[1]!==h.originalBody&&solids.length===18);
 check('actual room and reference components installed',visual.info().house.realInterior&&visual.info().house.logs>100&&visual.info().house.lapEnds>40&&visual.info().house.windows===8,visual.info().house);
 const cast=(x,z,dz,far=2.7)=>{
  const r=new THREE.Raycaster(new THREE.Vector3(x,2.36,z),new THREE.Vector3(0,0,dz),0,far);h.root.updateWorldMatrix(true,true);return r.intersectObject(h.root,true);
 };
 const advance=angle=>{h.door.reset();if(angle){h.door.toggle({near:true,visible:true,active:true});h.door.step(angle/1.8,null)}h.pivot.rotation.y=h.door.angle;h.refresh()};
 advance(0);
 check('closed door blocks outside shot',cast(10.92,-14.5,-1).length>0);
 check('closed door blocks inside shot',cast(10.92,-16.7,1).length>0);
 check('closed door blocks player movement',visual.blocksMovement({x:10.92,y:2.36,z:-15.6}));
 advance(1.48);
 check('open door permits outside shot through opening',cast(10.92,-14.5,-1).length===0);
 check('open door permits inside shot through opening',cast(10.92,-16.7,1).length===0);
 check('open door permits walking through threshold',!visual.blocksMovement({x:10.92,y:2.36,z:-15.6}));
 advance(.65);
 const cx=12-1.84+.74*Math.cos(.65),cz=-18+2.4-.74*Math.sin(.65);
 check('partly open real leaf still blocks rays',cast(cx,cz+1,-1,2).length>0);
 check('partly open leaf blocks matching movement bounds',visual.blocksMovement({x:cx,y:2.36,z:cz}));
 advance(1.48);
 check('walls block from outdoors',cast(14.5,-14.5,-1).length>0&&visual.blocksMovement({x:14.5,y:2.36,z:-15.6}));
 check('walls block from inside',cast(14.5,-16.7,1).length>0);
 check('fixed enemy9,-13 stays clear',!collide(new THREE.Vector3(9,1.6,-13),'enemy'));
 let routeClear=true;for(let i=0;i<8;i++)routeClear&&=!collide(new THREE.Vector3(9-i*.13,1.6,-13+i*.35),'enemy');
 check('fixed enemy westward exit stays clear',routeClear);
 check('ground-height enemy cannot climb stairs',collide(new THREE.Vector3(10.92,1.6,-13),'enemy'));
 for(const x of [10.09,11.75])check('stair rail blocks side crossing '+x,visual.blocksMovement({x,y:2.1,z:-13.2}));
 const traverse=(speed,dt,reverse=false)=>{
  pos.set(10.92,reverse?2.36:1.7,reverse?-19:-12.25);vy=0;onGround=true;let clear=true,steps=0;
  for(;steps<600&&(reverse?pos.z<-12.1:pos.z>-19);steps++){
   const np=pos.clone();np.z+=(reverse?1:-1)*speed*dt;
   if(!collide(np))pos.copy(np);else{clear=false;break}
   stepVertical(dt,false);
  }
  for(let i=0;i<120;i++)stepVertical(dt,false);
  return{clear,position:pos.toArray(),steps,grounded:onGround};
 };
 for(const dt of [1/60,.05])for(const speed of [4.2,7.4])for(const reverse of [false,true]){
  const t=traverse(speed,dt,reverse);
  check(`actual vertical solver ${reverse?'exit':'enter'} speed${speed} dt${dt}`,t.clear&&t.grounded&&(reverse?t.position[2]>-12.2&&t.position[1]===1.7:t.position[2]<-18&&Math.abs(t.position[1]-2.36)<1e-6),t);
 }
 for(const [label,z,maxHead]of [['lintel',-15.6,3.04],['inside',-18,4.5],['porch',-14.7,3.58]]){
  pos.set(10.92,2.36,z);vy=0;onGround=true;let peak=0;
  for(let i=0;i<120;i++){stepVertical(1/60,i===0);peak=Math.max(peak,pos.y+.15)}
  check('actual jump resolves '+label,peak<maxHead&&onGround&&Math.abs(pos.y-2.36)<1e-6,{peak,maxHead});
 }
 pos.set(0,1.7,12);vy=0;onGround=true;let oldY=1.7,oldVy=0,outdoorSame=true;
 for(let i=0;i<120;i++){if(i===0)oldVy=5.1;oldVy-=15/60;oldY+=oldVy/60;if(oldY<=1.7){oldY=1.7;oldVy=0}stepVertical(1/60,i===0);outdoorSame&&=pos.y===oldY&&vy===oldVy}
 check('outside jump trajectory exactly baseline',outdoorSame);
 pos.set(10.92,2.36,-12.1);vy=0;onGround=true;
 stepVertical(1/60,true);
 check('leaving raised stair clears grounded before mid-air jump',!onGround&&vy<0&&pos.y<2.36,{y:pos.y,vy,onGround});
 check('outdoor support unchanged',visual.floorHeight(0,12)===0);
 // Use actual interaction handler, real camera line-of-sight and state gating.
 advance(0);cam.position.set(10.92,2.36,-14.1);cam.lookAt(10.92,1.9,-15.6);
 setPres(false);S.state='play';pos.copy(cam.position);visual.update(0,{S,pres:false,live:true,cam,gun,player:pos});
 check('actual near aimed door exposes interaction',h.last.near&&h.last.visible);
 check('actual repeat guard',h.request({repeat:true})===false);
 check('actual focused UI guard',h.request({focusedUI:true})===false);
 dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
 check('actual E key event opens door',h.door.target===1.48);
 dispatchEvent(new KeyboardEvent('keyup',{code:'KeyE',bubbles:true}));
 visual.update(1,{S,pres:false,live:true,cam,gun,player:pos});
 const angle=h.door.angle;
 S.state='pause';
 check('pause blocks immediately before another frame',h.request()===false);
 visual.update(1,{S,pres:false,live:false,cam,gun,player:pos});
 check('actual pause freezes door and hides prompt',h.door.angle===angle&&document.getElementById('housePrompt').hidden);
 check('paused handler cannot change target',h.request()===false);
 visual.resetHouse();check('reset closes actual rendered leaf',h.door.angle===0&&h.pivot.rotation.y===0);
 S.state='play';setPres(false);visual.update(0,{S,pres:false,live:true,cam,gun,player:pos});
 setPres(true);check('presentation blocks immediately before another frame',h.request()===false);
 setPres(false);dispatchEvent(new Event('blur'));
 dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));
 check('blur pauses and blocks actual E event',S.state==='pause'&&h.door.target===0);
 S.state='play';visual.update(0,{S,pres:false,live:true,cam,gun,player:pos});
 const ui=document.createElement('input');document.body.append(ui);
 ui.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyE',bubbles:true}));ui.remove();
 check('text input E event cannot toggle door',h.door.target===0);
 document.getElementById('bHouseDoor').click();check('actual proximity button opens',h.door.target===1.48);
 dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));
 document.getElementById('bHouseDoor').dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
 check('door UI does not swallow held movement release',keys.KeyW===false);
 visual.resetHouse();
 Object.assign(S,save.S);pos.copy(save.pos);vy=save.vy;onGround=save.onGround;cam.position.copy(save.camera);cam.quaternion.copy(save.quaternion);setPres(save.pres);clearKeys();
 const report={date:new Date().toISOString(),method:'actual browser synthetic house geometry/input integration; not human walkthrough or real-time performance',pass:checks.every(c=>c.pass),checks,house:visual.info().house};
 const out=document.createElement('pre');out.id='house-result';out.style.cssText='position:fixed;inset:20px;z-index:1000;overflow:auto;background:#122027ef;color:#e3e9dc;padding:24px;font:12px monospace';out.textContent=JSON.stringify(report,null,2);document.body.append(out);
 const response=await fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'house-current',report,loadedBuildHashes:qaBuildHashes})});document.body.dataset.houseReport=response.ok?'saved':'failed';
})().catch(e=>{document.body.dataset.houseError=e.stack||String(e)});
