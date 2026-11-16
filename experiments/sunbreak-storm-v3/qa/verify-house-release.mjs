// Current timber slice only. Never relabel the historical pre-house reports.
import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root)),json=p=>JSON.parse(read(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const checks=[],artifacts=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
const names=JSON.parse(read('serve.mjs').toString().match(/export const sourceNames=(\[[^\n]+\]);/)[1].replaceAll("'",'"'));
const hashes=Object.fromEntries(names.map(p=>[p,sha(read(p))])),sourceFingerprint=sha(Buffer.from(JSON.stringify(hashes)));
for(const name of names.filter(n=>/\.(js|mjs)$/.test(n))){
 const r=spawnSync(process.execPath,['--check',fileURLToPath(new URL(name,root))],{encoding:'utf8'});
 check('syntax '+name,r.status===0,r.stderr||undefined);
}
const inline=read('index.html').toString().match(/<script type="module">([\s\S]*?)<\/script>/)[1];
check('inline syntax',spawnSync(process.execPath,['--input-type=module','--check'],{input:inline,encoding:'utf8'}).status===0);
const audit=spawnSync(process.execPath,[fileURLToPath(new URL('qa/compare-gameplay.mjs',root)),'--self-test'],{encoding:'utf8'});
check('exact source with enumerated target-local hooks and mutation self-tests',audit.status===0,audit.stderr||undefined);
if(audit.status===0)writeFileSync(new URL('qa/house-gameplay-audit.json',root),audit.stdout);
const pinned={
 '../sunbreak-fable52/index.html':'4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85',
 '../sunbreak-realistic-v2/index.html':'761c48f0b63a542c48f2f29d5b2021464736f583acda5f43244bc896deb7c991',
 '../sunbreak-realistic-v2/world.js':'7f073620646f939a3552203bcea8b4129451bac18e0fe547be687d2363747621',
 '../sunbreak-realistic-v2/weapon.js':'afe1d7bb36b1cac1bc6a4772c34b36a8f98dc504350ef3df5cefbc6300f5b5bd',
 '../sunbreak-realistic-v2/audio.js':'b1d79072ec9eb99c4fe5a2793e34f2c31dca8214f51b538a038569e171c48fff'
};
for(const [path,hash]of Object.entries(pinned))check('preserved '+path,sha(read(path))===hash);
check('v2 sound module unchanged',sha(read('audio.js'))===pinned['../sunbreak-realistic-v2/audio.js']);
function integrity(f){const b=read(f.path);check('licensed asset '+f.path,b.length===f.bytes&&sha(b)===f.sha256)}
const manifest=json('assets-manifest.json'),vendor=json('vendor/manifest.json');
for(const asset of [...manifest.assets,...manifest.v3_acquisition.assets])for(const f of asset.files)integrity(f);
for(const path of ['weapon-provenance.json','soldier-provenance.json','assets/audio/manifest.json'])for(const f of json(path).files)integrity(f);
for(const [path,meta]of Object.entries(vendor.files))integrity({path:'vendor/three/'+path,...meta});
for(const f of [...vendor.thirdParty,...vendor.variants])integrity(f);
check('visual vendor isolates global random',vendor.variants.filter(f=>f.path.endsWith('.js')).every(f=>!/\bMath\.random\b/.test(read(f.path).toString())));
const evidence=['house-current','storm-current','startup-test','startup-baseline','performance-current','housefront','houseangle','houseinside','houseout','housedoor'];
if(process.argv.includes('--collect')){
 mkdirSync(new URL('qa/house-evidence/',root),{recursive:true});
 for(const name of evidence)for(const ext of ['json',...(name.startsWith('house')&&name!=='house-current'?['png']:[])]){
  const p=new URL('qa/captures/'+name+'.'+ext,root);if(existsSync(p))copyFileSync(p,new URL('qa/house-evidence/'+name+'.'+ext,root));
 }
}
function bound(name,required=true){
 const path='qa/house-evidence/'+name+'.json';
 if(!existsSync(new URL(path,root))){if(required)check(name+' exists',false);return null}
 const r=json(path),current=Object.entries(hashes).every(([p,h])=>r.buildHashes?.[p]===h);
 if(required)check(name+' loaded current source',current);
 artifacts.push({path,sha256:sha(read(path)),currentSource:current});return{report:r,current};
}
const reports=Object.fromEntries(evidence.filter(n=>n!=='performance-current').map(n=>[n,bound(n)]));
const house=reports['house-current']?.report,storm=reports['storm-current']?.report;
check('browser architecture/routing/actual vertical-solver fixtures',house?.pass&&house.checks.length>=47&&house.checks.every(c=>c.pass),house?.checks.filter(c=>!c.pass));
check('browser weather fixtures',storm?.pass&&storm.checks.length>=38&&storm.checks.every(c=>c.pass),storm?.checks.filter(c=>!c.pass));
const startup=reports['startup-test']?.report,baseline=reports['startup-baseline']?.report;
check('no added global random at init/first frame',startup?.addedVisualInitRngCalls===0&&startup?.firstFrameRngCalls===baseline?.firstFrameRngCalls,{init:startup?.addedVisualInitRngCalls,firstFrame:startup?.firstFrameRngCalls,baseline:baseline?.firstFrameRngCalls});
const unit=json('qa/house-unit.json'),weather=json('qa/weather-audio-unit.json');
check('deterministic house unit fixtures current',unit.pass&&unit.checks.length>=28&&unit.sourceSha256===hashes['house-logic.js']);
check('weather audio unit fixtures current',weather.pass&&weather.checks.length===12&&weather.sourceSha256===hashes['storm-audio.js']);
for(const name of ['housefront','houseangle','houseinside','houseout','housedoor']){
 const m=reports[name]?.report,path='qa/house-evidence/'+name+'.png';
 if(!m||!existsSync(new URL(path,root))){check(name+' canvas exists',false);continue}
 const b=read(path);
 check(name+' actual nonblank1080p canvas',m.capture_method==='browser-webgl-canvas'&&m.viewport[0]===1920&&m.viewport[1]===1080&&m.canvas[0]>=1920&&m.canvas[1]>=1080&&m.pixel_check.nonblank&&b.readUInt32BE(16)===m.canvas[0]&&b.readUInt32BE(20)===m.canvas[1]);
 check(name+' current assets and real room loaded',m.render.textureErrors.length===0&&m.render.loadedHDR&&m.render.weapon.loaded&&m.render.actors.count===6&&m.render.house.realInterior);
 artifacts.push({path,sha256:sha(b)});
}
const build=spawnSync(process.execPath,[fileURLToPath(new URL('tools/build.mjs',root))],{encoding:'utf8'});
check('static build exact runtime and v1/v2 comparison pages',build.status===0,build.status===0?build.stdout.trim():build.stderr);
const perf=bound('performance-current',false),p=perf?.report;
const thresholds={p95MaxMs:33.3,p99MaxMs:33.3,maxFrameMs:50,maxHitchesOver50:0};
let perfVerdict='NOT_CURRENT';
if(perf?.current){
 const raw=p.raw.map(s=>s.frame_ms).sort((a,b)=>a-b),pct=n=>raw[Math.min(raw.length-1,Math.floor(raw.length*n))];
 const audioReady=p.audio?.context==='running'&&p.audio?.byType.player>20&&p.audio?.byType.enemy>0&&p.audio?.errors===0&&p.settings.storm.ambientAudio.context==='running'&&p.settings.storm.ambientAudio.thunderCount>0;
 const valid=p.duration_ms>=30000&&p.canvas[0]>=1920&&p.canvas[1]>=1080&&p.mode.startsWith('scripted real combat')&&p.p95_ms===pct(.95)&&p.p99_ms===pct(.99)&&p.max_ms===raw.at(-1)&&p.hitches_over_50ms===raw.filter(n=>n>50).length&&audioReady;
 perfVerdict=!valid?'INVALID_EVIDENCE':p.p95_ms<=33.3&&p.p99_ms<=33.3&&p.max_ms<=50&&p.hitches_over_50ms===0?'PASS':'FAIL';
}
const artPath='qa/house-art-review.json',art=existsSync(new URL(artPath,root))?json(artPath):null;
const artBound=art?.sourceFingerprint===sourceFingerprint&&art?.frames?.length>=5&&art.frames.every(f=>existsSync(new URL(f.path,root))&&sha(read(f.path))===f.sha256);
const functional=checks.every(c=>c.pass)?'PASS':'REWORK';
const report={schema:'sunbreak-timber-slice-v1',date:new Date().toISOString(),verifierSha256:sha(read('qa/verify-house-release.mjs')),buildToolSha256:sha(read('tools/build.mjs')),sourceFingerprint,sourceHashes:hashes,
 functional,art:artBound?art.verdict:'INDEPENDENT_REVIEW_REQUIRED',
 overall:functional!=='PASS'?'REWORK':!artBound?'REVIEW_REQUIRED':perfVerdict==='PASS'&&art.verdict==='PASS'?'PASS':'CONDITIONAL PASS',
 performance:{verdict:perfVerdict,thresholds,currentSource:perf?.current??false,durationMs:p?.duration_ms,samples:p?.raw.length,viewport:p?.viewport,canvas:p?.canvas,p95Ms:p?.p95_ms,p99Ms:p?.p99_ms,maxMs:p?.max_ms,hitchesOver50:p?.hitches_over_50ms,audio:{context:p?.audio?.context,playerShots:p?.audio?.byType.player,enemyShots:p?.audio?.byType.enemy,errors:p?.audio?.errors,thunder:p?.settings.storm.ambientAudio.thunderCount},reason:perfVerdict==='PASS'?'Current1080p30-second scripted combat with running recorded-gun/weather audio passed unchanged thresholds; not a full playthrough or all hardware claim.':perfVerdict==='FAIL'?'Frame pacing exceeded unchanged thresholds; foreground acceptance remains open.':'Only current bound real-time1080p combat/audio evidence can pass.'},
 checks,artifacts,contract:{unchanged:'six spawn anchors, original weapon/AI constants after exact local hooks, other17 movement bounds; v1/v2 preserved',changed:'only former MERCADO12 traversal/cover/LOS, door/stairs/player floor/headroom',original18ProxySuite:'Not claimed for changed house; pre-house reports remain historical.'},
 limitations:['Representative actual canvas frames and synthetic integration, not a complete human playthrough or full continuous review.','WebGL/Three.js, not Unreal Engine/Lumen/Nanite/hardware ray tracing or AAA parity.','Only the cabin has an enterable room. Other houses use decorative parallax. Unseen cabin parts are authored interpretation, not an exact photo reconstruction.','Enemies remain original ground-height agents; they cannot enter via the raised stair.','Recorded weapon audio is AR15/M4, not MP5. Weather ambience is synthetic.','No hosted deployment: prior Sites provider backfill invariant prevented site creation. GitHub save is distinct from hosting.','Public browser files only. Existing modified private vault was preserved; no new private/UE snapshot or portability claim.']};
writeFileSync(new URL('qa/house-release-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({functional:report.functional,art:report.art,overall:report.overall,performance:report.performance,checks:checks.length,failed:checks.filter(c=>!c.pass)},null,2));
if(functional!=='PASS')process.exitCode=1;
