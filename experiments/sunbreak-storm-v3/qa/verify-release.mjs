import {readFileSync,writeFileSync,existsSync,copyFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[],artifacts=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
const names=JSON.parse(read('serve.mjs').toString().match(/export const sourceNames=(\[[^\n]+\]);/)[1].replaceAll("'",'"'));
const hashes=Object.fromEntries(names.map(p=>[p,sha(read(p))]));
for(const name of names.filter(n=>/\.(?:js|mjs)$/.test(n))){
 const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(name,root))],{encoding:'utf8'});
 check('syntax '+name,result.status===0,result.stderr||undefined);
}
const inline=read('index.html').toString().match(/<script type="module">([\s\S]*?)<\/script>/)[1];
check('inline module syntax',spawnSync(process.execPath,['--input-type=module','--check'],{input:inline,encoding:'utf8'}).status===0);
const audit=spawnSync(process.execPath,[fileURLToPath(new URL('./compare-gameplay.mjs',import.meta.url)),'--self-test'],{encoding:'utf8'});
check('exact gameplay and mutation audit',audit.status===0,audit.stderr||undefined);
if(audit.status===0)writeFileSync(new URL('./gameplay-audit.json',import.meta.url),audit.stdout);
const pinned={
 '../sunbreak-fable52/index.html':'4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85',
 '../sunbreak-realistic-v2/index.html':'761c48f0b63a542c48f2f29d5b2021464736f583acda5f43244bc896deb7c991',
 '../sunbreak-realistic-v2/world.js':'7f073620646f939a3552203bcea8b4129451bac18e0fe547be687d2363747621',
 '../sunbreak-realistic-v2/weapon.js':'afe1d7bb36b1cac1bc6a4772c34b36a8f98dc504350ef3df5cefbc6300f5b5bd',
 '../sunbreak-realistic-v2/audio.js':'b1d79072ec9eb99c4fe5a2793e34f2c31dca8214f51b538a038569e171c48fff'
};
for(const [path,hash]of Object.entries(pinned))check('preserved '+path,sha(read(path))===hash);
check('v2 recorded sound module unchanged',sha(read('audio.js'))===pinned['../sunbreak-realistic-v2/audio.js']);
function integrity(file,prefix=''){
 const path=prefix+file.path,b=read(path);
 check('integrity '+path,b.length===file.bytes&&sha(b)===file.sha256);
}
const manifest=json('assets-manifest.json');
for(const asset of [...manifest.assets,...manifest.v3_acquisition.assets])for(const file of asset.files)integrity(file);
for(const path of ['weapon-provenance.json','soldier-provenance.json','assets/audio/manifest.json'])for(const file of json(path).files)integrity(file);
const vendor=json('vendor/manifest.json');
for(const [path,meta]of Object.entries(vendor.files))integrity({path:'vendor/three/'+path,...meta});
for(const file of [...vendor.thirdParty,...vendor.variants])integrity(file);
check('presentation variant keeps global RNG isolated',vendor.variants.filter(f=>f.path.endsWith('.js')).every(f=>!/\bMath\.random\b/.test(read(f.path).toString())));
const evidence=['startup-baseline','startup-test','runtime-current','storm-current','performance-current','final-hero','final-courtyard','final-interior','final-ground','final-weapon','motion-before','motion-flash','motion-after'];
if(process.argv.includes('--collect')){
 mkdirSync(new URL('./evidence/',import.meta.url),{recursive:true});
 for(const name of evidence)for(const ext of ['json',...(name.startsWith('final-')||name.startsWith('motion-')?['png']:[])]){
  const source=new URL('qa/captures/'+name+'.'+ext,root);
  if(existsSync(source))copyFileSync(source,new URL('./evidence/'+name+'.'+ext,import.meta.url));
 }
}
function bound(name){
 const path='qa/evidence/'+name+'.json';
 if(!existsSync(new URL(path,root))){check(name+' exists',false);return null}
 const report=json(path);
 check(name+' current loaded source',Object.entries(hashes).every(([p,h])=>report.buildHashes?.[p]===h));
 artifacts.push({path,sha256:sha(read(path))});return report;
}
const reports=Object.fromEntries(evidence.map(name=>[name,bound(name)]));
for(const name of evidence.filter(n=>n.startsWith('final-')||n.startsWith('motion-'))){
 const m=reports[name];if(!m)continue;const path='qa/evidence/'+name+'.png',b=read(path);
 check(name+' genuine 1080p nonblank canvas',m.capture_method==='browser-webgl-canvas'&&m.viewport[0]===1920&&m.viewport[1]===1080&&m.canvas[0]>=1920&&m.canvas[1]>=1080&&m.pixel_check.nonblank&&b.readUInt32BE(16)===m.canvas[0]&&b.readUInt32BE(20)===m.canvas[1]);
 check(name+' loaded current licensed assets',m.render.loadedHDR&&m.render.textureErrors.length===0&&m.render.weapon.loaded&&m.render.actors?.count===6);
 artifacts.push({path,sha256:sha(b)});
}
const baseline=reports['startup-baseline'],startup=reports['startup-test'];
if(baseline&&startup)check('no added initialization/first-frame global RNG draws',startup.addedVisualInitRngCalls===0&&startup.firstFrameRngCalls===baseline.firstFrameRngCalls,{addedVisualInitRngCalls:startup.addedVisualInitRngCalls,firstFrameRngCalls:startup.firstFrameRngCalls,baselineFirstFrame:baseline.firstFrameRngCalls});
const runtime=reports['runtime-current'];
if(runtime){check('original19 smoke',runtime.smoke.checks.length===19&&runtime.smoke.checks.every(c=>c.pass),runtime.smoke.checks.filter(c=>!c.pass));check('original proxy/runtime217',runtime.runtime.verdict==='PASS'&&runtime.runtime.rngCalls===0&&runtime.runtime.checks.length>=217,{verdict:runtime.runtime.verdict,reason:runtime.runtime.reason,failed:runtime.runtime.failedChecks})}
const storm=reports['storm-current'];
if(storm)check('weather input rendering fixtures',storm.pass&&storm.checks.length>=38&&storm.checks.every(c=>c.pass),storm.checks.filter(c=>!c.pass));
const unit=json('qa/weather-audio-unit.json');
check('weather audio unit lifecycle',unit.pass&&unit.checks.length===12&&unit.sourceSha256===hashes['storm-audio.js']);
const perf=reports['performance-current'];
if(perf){
 const raw=perf.raw.map(s=>s.frame_ms).sort((a,b)=>a-b),pct=p=>raw[Math.min(raw.length-1,Math.floor(raw.length*p))];
 check('1080p real combat >=30 seconds',perf.canvas[0]>=1920&&perf.canvas[1]>=1080&&perf.duration_ms>=30000&&perf.mode.startsWith('scripted real combat'));
 check('all raw frame samples included',perf.p95_ms===pct(.95)&&perf.p99_ms===pct(.99)&&perf.max_ms===raw.at(-1)&&perf.hitches_over_50ms===raw.filter(n=>n>50).length);
 check('strict frame pacing (threshold unchanged)',perf.p95_ms<=33.3&&perf.p99_ms<=33.3&&perf.max_ms<=50&&perf.hitches_over_50ms===0,{p50:perf.p50_ms,p95:perf.p95_ms,p99:perf.p99_ms,max:perf.max_ms,hitchesOver50:perf.hitches_over_50ms});
 check('recorded shots and weather audio exercised',perf.audio?.context==='running'&&perf.audio?.byType.player>20&&perf.audio?.byType.enemy>0&&perf.audio?.errors===0&&perf.settings.storm.ambientAudio.context==='running'&&perf.settings.storm.ambientAudio.thunderCount>0,perf.settings.storm.ambientAudio);
}
const before=reports['motion-before'],during=reports['motion-flash'],after=reports['motion-after'];
if(before&&during&&after)check('time-separated actual weather/flash frames',before.render.storm.elapsed>0&&during.render.storm.flash>.15&&after.render.storm.elapsed>during.render.storm.elapsed&&after.render.storm.flash<.1);
const sourceFingerprint=sha(Buffer.from(JSON.stringify(hashes))),artReview=existsSync(new URL('./art-review.json',import.meta.url))?json('qa/art-review.json'):null;
const report={schema:'sunbreak-current-build-qa-v3',date:new Date().toISOString(),engineering:checks.every(c=>c.pass)?'PASS':'REWORK',art:artReview?.sourceFingerprint===sourceFingerprint?artReview.verdict:'INDEPENDENT_REVIEW_REQUIRED',sourceFingerprint,sourceHashes:hashes,checks,artifacts,publication:{status:'UNAVAILABLE',reason:'Sites create_site returned project_invariant_error: Sites backfill is in progress in this destination. No site created; no deployment claimed.'},limits:['WebGL/Three.js, not Unreal Engine/Lumen/Nanite/ray tracing.','Actual sampled frames and scripted combat are not a full continuous subjective review or human playthrough.','Background browser throttling was observed at approximately1fps: wall-time smoke checks can fail before simulation timers advance. This is not a PASS and must be rerun in a foreground session.','Motion images are actual time-separated combat frames, sometimes background-throttled; they are not normal-speed continuous video.','Engineering results never establish AAA/photorealistic parity.','Decorative parallax rooms; simple enemy pose/leg animation; no full reload choreography.','Weapon audio remains CC0 AR15/M4 recording, not MP5. Weather audio is synthetic.','Original upper stacked crates remain visual-only by baseline design.','Only v3 runtime is fully local; preserved v1/v2 comparisons retain their original CDN dependency.','Pre-existing dirty private vault was preserved; checkpoint contains only browser code/public assets, not UE/private assets.']};
writeFileSync(new URL('./release-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({engineering:report.engineering,checks:checks.length,failed:checks.filter(c=>!c.pass),artifacts:artifacts.length},null,2));
if(report.engineering!=='PASS')process.exitCode=1;
