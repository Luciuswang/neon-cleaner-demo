// Only /audio-load-failure rewrites the one audio-module URL to an intentional
// missing module. All production fallback/combat functions otherwise unmodified.
const failureChecks=[];
const failureCheck=(name,pass)=>failureChecks.push({name,pass:!!pass});
try{
 failureCheck('missing audio module exposes explicit unavailable status',sound.snapshot().failed&&document.getElementById('audioStatus').textContent==='音效不可用');
 initAudio();resetGame();setPres(false);S.state='play';enemies.forEach(e=>e.alive=false);
 S.next=0;fire();failureCheck('actual original firing works with absent audio module',S.mag===29);
 reload();failureCheck('reload remains original 1.2 seconds without audio module',S.reload===1.2);
 finishReload();failureCheck('reload ammo outcome preserved',S.mag===30&&S.res===89);
 sound.setMuted(true);sound.setVolume(.3);snd('shot');
 failureCheck('fallback controls and notifications do not throw',sound.snapshot().muted&&sound.snapshot().volume===.3);
 resetGame();S.state='menu';setPres(false);showMenu('开始作战');
}catch{failureCheck('failure fixture completes',false)}
const failureReport={schema:'sunbreak-audio-module-failure-v1',date:new Date().toISOString(),verdict:failureChecks.every(c=>c.pass)?'PASS':'REWORK',method:'actual browser; exact server test-route import URL substitution to an intentional HTTP404; unmodified production fallback and original combat functions',checks:failureChecks};
fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'audio-load-failure-current',report:failureReport})}).then(r=>{document.body.dataset.audioFailure=r.ok?failureReport.verdict:'save-failed'});
