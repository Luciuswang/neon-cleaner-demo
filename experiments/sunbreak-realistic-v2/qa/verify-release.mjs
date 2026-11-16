import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const sha=data=>createHash('sha256').update(data).digest('hex');
const read=path=>readFileSync(new URL(path,root));
const json=path=>JSON.parse(read(path));
const checks=[];
const check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
const hashes=Object.fromEntries(['index.html','world.js','weapon.js','audio.js','assets/audio/manifest.json','qa-hooks.js','qa/runtime-checks.js','qa/audio-checks.js','qa/audio-failure-checks.js','serve.mjs'].map(p=>[p,sha(read(p))]));
check('baseline preserved',sha(readFileSync(new URL('../sunbreak-fable52/index.html',root)))==='4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85');
const auditArgs=[fileURLToPath(new URL('./compare-gameplay.mjs',import.meta.url)),'--self-test'];
const audit=spawnSync(process.execPath,auditArgs,{encoding:'utf8'});
check('static audit and mutation self-tests',audit.status===0,audit.error?.message||audit.stderr||undefined);
if(audit.status===0){writeFileSync(new URL('./gameplay-audit.json',import.meta.url),audit.stdout);const refreshed=spawnSync(process.execPath,auditArgs,{encoding:'utf8'});if(refreshed.status!==0)throw Error(refreshed.stderr);writeFileSync(new URL('./gameplay-audit.json',import.meta.url),refreshed.stdout)}
const manifest=json('assets-manifest.json');
for(const page of json('qa/audio-license-evidence.json').pages){
 check('preserved audio license page '+page.local,sha(read(page.local))===page.sha256&&page.licenseLabel==='CC0');
}
for(const asset of json('assets/audio/manifest.json').files){
 const bytes=read(asset.path);
 check('recorded audio integrity '+asset.path,bytes.length===asset.bytes&&sha(bytes)===asset.sha256&&asset.license==='CC0-1.0');
}
for(const asset of manifest.assets)for(const file of asset.files){
 const bytes=read(file.path);
 check('asset integrity '+file.path,bytes.length===file.bytes&&sha(bytes)===file.sha256);
}
const artifacts=[];
function bound(name){
 const p='qa/evidence/'+name+'.json';
 if(!existsSync(new URL(p,root))){check(name+' exists',false);return null}
 const report=json(p);
 check(name+' same source build',Object.entries(hashes).every(([path,hash])=>report.buildHashes?.[path]===hash));
 artifacts.push({path:p,sha256:sha(read(p))});return report;
}
for(const name of ['final-hero','final-courtyard','final-wall','final-ground','final-weapon','final-rain','final-overcast','final-mobile']){
 const meta=bound(name);if(!meta)continue;
 check(name+' requested viewport',name==='final-mobile'?meta.viewport[0]===390&&meta.viewport[1]===844:meta.viewport[0]===1920&&meta.viewport[1]===1080);
 const pngPath='qa/evidence/'+name+'.png',png=read(pngPath);
 check(name+' valid PNG header',png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&png.readUInt32BE(16)===meta.canvas[0]&&png.readUInt32BE(20)===meta.canvas[1]);
 check(name+' actual nonblank canvas',meta.pixel_check?.nonblank===true,meta.pixel_check);
 check(name+' assets loaded',meta.render.textureErrors.length===0&&meta.render.loadedHDR===true);
 check(name+' HUD stays in viewport',meta.ui_bounds.every(r=>!r.visible||(r.x>=0&&r.y>=0&&r.x+r.width<=meta.viewport[0]+1&&r.y+r.height<=meta.viewport[1]+1)));
 artifacts.push({path:pngPath,sha256:sha(png)});
}
const runtime=bound('runtime-current');
if(runtime){
 check('original smoke 19/19',runtime.smoke.checks.length===19&&runtime.smoke.checks.every(c=>c.pass));
 check('runtime invariants',runtime.runtime.verdict==='PASS'&&runtime.runtime.rngCalls===0,{checks:runtime.runtime.checks.length,failed:runtime.runtime.failedChecks});
}
const perf=bound('performance-current');
if(perf){
 const raw=perf.raw.map(s=>s.frame_ms).sort((a,b)=>a-b),pct=p=>raw[Math.min(raw.length-1,Math.floor(raw.length*p))];
 check('1080p real combat >=30 seconds',perf.canvas[0]>=1920&&perf.canvas[1]>=1080&&perf.duration_ms>=30000&&perf.mode.startsWith('scripted real combat'));
 check('performance values derived from all samples',perf.p95_ms===pct(.95)&&perf.p99_ms===pct(.99)&&perf.max_ms===raw.at(-1)&&perf.hitches_over_50ms===raw.filter(n=>n>50).length);
 check('combat frame pacing',perf.p95_ms<=33.3&&perf.p99_ms<=33.3&&perf.max_ms<=50);
 check('benchmark actually played recorded audio',perf.audio?.ready&&perf.audio?.context==='running'&&perf.audio?.byType.player>20&&perf.audio?.byType.enemy>0&&perf.audio?.errors===0,perf.audio);
}
const audio=bound('audio-current');
if(audio)check('browser gesture, lifecycle, offline audio stress and original page',audio.verdict==='PASS'&&audio.checks.length>=30&&audio.checks.every(c=>c.pass),{checks:audio.checks.length,failed:audio.checks.filter(c=>!c.pass)});
const absentAudio=bound('audio-load-failure-current');
if(absentAudio)check('missing audio module never prevents original combat',absentAudio.verdict==='PASS'&&absentAudio.checks.length===5&&absentAudio.checks.every(c=>c.pass));
const report={schema:'sunbreak-current-build-qa-v1',date:new Date().toISOString(),engineering:checks.every(c=>c.pass)?'PASS':'REWORK',visual:'INDEPENDENT_REVIEW_REQUIRED',sourceHashes:hashes,checks,artifacts,limitations:['Synthetic fixtures and scripted combat are not a manual full-playthrough.','Static/current PNG evidence does not prove full continuous subjective motion quality.','Engineering PASS cannot establish reference visual parity.','Original upper crates are visual-only above their bottom collision box.','Browser demo uses external pinned Three.js CDN; first load requires network.','UE/private vault restoration is outside this browser-only checkpoint.']};
writeFileSync(new URL('./release-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({engineering:report.engineering,checks:checks.length,failed:checks.filter(c=>!c.pass),artifacts:artifacts.length},null,2));
if(report.engineering!=='PASS')process.exitCode=1;
