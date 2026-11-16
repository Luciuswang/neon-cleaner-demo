// Runs only on the local /test route. Synthetic fixtures exercise actual game functions.
const smoke=[];
const check=(name,ok,detail='')=>smoke.push({name,pass:!!ok,detail});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runSmoke(){
 try {
  const before=window.demoQA.snapshot();setPres(true);toggleStyle();
  const after=window.demoQA.snapshot();
  check('style changes',before.style!==after.style);
  check('style preserves camera',JSON.stringify(before.camera)===JSON.stringify(after.camera));
  check('style preserves combat',before.health===after.health&&JSON.stringify(before.ammo)===JSON.stringify(after.ammo)&&JSON.stringify(before.enemies)===JSON.stringify(after.enemies));
  toggleStyle();check('style round trip',window.demoQA.snapshot().style===before.style);
  await sleep(250);check('presentation freezes camera',JSON.stringify(window.demoQA.snapshot().camera)===JSON.stringify(before.camera));
  setPres(false);resetGame();S.state='play';hideMenu();
  enemies.forEach(e=>{e.alive=false;e.g.visible=false});
  const walkStart=pos.clone();keys.KeyW=true;await sleep(180);keys.KeyW=false;
  check('forward movement loop',pos.distanceTo(walkStart)>.1);
  const yawStart=S.yaw;keys.ArrowLeft=true;await sleep(120);keys.ArrowLeft=false;
  check('keyboard look loop',S.yaw>yawStart);
  pos.copy(SPAWNPOS);S.yaw=-.12;S.pitch=-.06;
  cam.position.copy(pos);cam.rotation.set(0,0,0,'YXZ');cam.updateMatrixWorld(true);
  fire();check('fire consumes round',S.mag===29);reload();
  check('reload timed, not instant',S.mag===29&&S.reload>0);
  S.next=0;fire();check('cannot fire while reloading',S.mag===29);
  await sleep(1450);check('reload completes',S.mag===30&&S.res===89,JSON.stringify({mag:S.mag,res:S.res,reload:S.reload}));
  check('building collision',collide(new THREE.Vector3(-13,1.7,-16)));
  check('spawn clear',!collide(SPAWNPOS));
  check('all enemy spawns clear',SPAWN.every(([x,z])=>!collide(new THREE.Vector3(x,1.7,z))));
  const target=enemies[0];target.alive=true;target.hp=100;target.g.position.set(-13,0,-21);
  cam.position.set(-13,1.7,-10);cam.rotation.set(0,0,0,'YXZ');cam.updateMatrixWorld(true);
  S.next=0;fire();check('wall blocks player shot',target.hp===100);
  target.g.position.set(0,0,5);target.hp=1;S.kills=5;S.next=0;
  cam.position.set(0,1.7,12);cam.rotation.set(0,0,0,'YXZ');cam.updateMatrixWorld(true);
  fire();check('hit and victory',S.kills===6&&S.state==='win');
  resetGame();enemies.forEach(e=>e.alive=false);target.alive=true;
  pos.set(-13,1.7,-10);target.g.position.set(-13,0,-21);target.cd=0;S.state='play';S.hp=1;
  const savedRandom=Math.random;Math.random=()=>0;
  try {
   await sleep(180);check('wall blocks enemy attack',S.hp===1);
   pos.set(0,1.7,12);target.g.position.set(2,0,10);target.cd=0;
   await sleep(180);check('enemy damage and defeat',S.hp===0&&S.state==='dead');
  } finally {Math.random=savedRandom}
  resetGame();S.state='menu';over.classList.add('hide');showMenu('开始作战');
  enemies.forEach(e=>e.g.visible=true);
  check('reset state',S.hp===100&&S.mag===30&&S.res===90&&S.kills===0&&S.reload===0&&vy===0&&enemies.every(e=>e.alive&&e.hp===100));
 } catch(e){check('uncaught exception',false,String(e))}
 const panel=document.createElement('pre');panel.id='smoke-result';
 panel.style='position:fixed;inset:12px;z-index:100;background:#07151f;color:#b5edbe;overflow:auto;padding:20px;font:14px/1.5 monospace;';
 panel.textContent=JSON.stringify({kind:'synthetic integration fixtures; not manual full-playthrough',checks:smoke},null,2);
 document.body.appendChild(panel);
}
runSmoke();
