import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=name=>execFileSync(process.execPath,[new URL(name,root).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8'});
if(!process.argv.includes('--collect')){
 const unit=JSON.parse(run('qa/timber-uv-check.mjs'));assert.equal(unit.pass,true);
 // Execute existing tests, changing only their output destination and URL base.
 const originalURL=new URL('qa/check-house-logic.mjs',root);
 const test=read('qa/check-house-logic.mjs').toString()
  .replace("'../house-logic.js'",JSON.stringify(new URL('house-logic.js',root).href))
  .replaceAll('import.meta.url',JSON.stringify(originalURL.href))
  .replace("'./house-unit.json'","'./timber-uv-house-unit.json'");
 await import('data:text/javascript;base64,'+Buffer.from(test).toString('base64'));
 const audit=JSON.parse(execFileSync(process.execPath,[new URL('qa/compare-gameplay.mjs',root).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'--self-test'],{encoding:'utf8'}));
 assert.equal(audit.wholeModuleEqualAfterExactRenderExceptions,true);
 assert.ok(audit.selfTest.startsWith('PASS'));
 writeFileSync(new URL('qa/timber-uv-gameplay.json',root),JSON.stringify(audit,null,2)+'\n');
 console.log(run('tools/build.mjs').trim());
 console.log('PASS: UV '+unit.checks.length+'; house logic; exact combat audit with mutation self-tests; static build.');
}else{
 const evidenceDir=new URL('qa/timber-uv-evidence/',root);mkdirSync(evidenceDir,{recursive:true});
 const names=['timber-uv-out','timber-uv-inside','timber-uv-angle','timber-uv-front'];
 const frames=[];
 for(const name of names){
  const meta=JSON.parse(read('qa/captures/'+name+'.json'));
  assert.equal(meta.capture_method,'browser-webgl-canvas');assert.equal(meta.pixel_check.nonblank,true);
  assert.deepEqual(meta.canvas,[1920,1080]);assert.deepEqual(meta.viewport,[1920,1080]);
  assert.deepEqual(meta.render.textureErrors,[]);assert.ok(meta.render.materialBindings.includes('wood'));
  for(const [path,expected]of Object.entries(meta.buildHashes))assert.equal(hash(read(path)),expected,`stale ${name}: ${path}`);
  for(const ext of ['png','json'])copyFileSync(new URL('qa/captures/'+name+'.'+ext,root),new URL(name+'.'+ext,evidenceDir));
  frames.push({path:'qa/timber-uv-evidence/'+name+'.png',sha256:hash(read('qa/captures/'+name+'.png'))});
 }
 for(const ext of ['png','json'])copyFileSync(new URL('qa/captures/timber-uv-before.'+ext,root),new URL('timber-uv-before.'+ext,evidenceDir));
 const browser=JSON.parse(read('qa/captures/house-current.json'));assert.equal(browser.pass,true);
 for(const [path,expected]of Object.entries(browser.buildHashes))assert.equal(hash(read(path)),expected,`stale house integration: ${path}`);
 copyFileSync(new URL('qa/captures/house-current.json',root),new URL('house-integration.json',evidenceDir));
 const uv=JSON.parse(read('qa/timber-uv-unit.json')),house=JSON.parse(read('qa/timber-uv-house-unit.json')),combat=JSON.parse(read('qa/timber-uv-gameplay.json'));
 assert.equal(uv.sourceSha256,hash(read('timber-house.js')));assert.equal(uv.pass,true);assert.equal(house.pass,true);
 assert.equal(house.sourceSha256,hash(read('house-logic.js')));assert.equal(combat.wholeModuleEqualAfterExactRenderExceptions,true);
 const artURL=new URL('qa/timber-uv-art-review.json',root);
 const art=existsSync(artURL)?JSON.parse(readFileSync(artURL)):null;
 if(art){
  assert.equal(art.runtimeSourceSha256,uv.sourceSha256);
  for(const frame of frames)assert.equal(art.frames.find(f=>f.path===frame.path)?.sha256,frame.sha256);
 }
 const report={
  schema:'sunbreak-scoped-timber-uv-v1',date:new Date().toISOString(),
  verdict:art?.verdict??'VISUAL_REVIEW_PENDING',engineering:'PASS',
  runtimeSourceSha256:uv.sourceSha256,buildHashes:browser.buildHashes,
  checks:{uv:uv.checks.length,houseLogic:house.checks.length,browserHouse:browser.checks.length,exactCombatAndMutationTests:combat.selfTest},
  frames,before:{path:'qa/timber-uv-evidence/timber-uv-before.png',sha256:hash(read('qa/captures/timber-uv-before.png')),note:'Pre-fix baseline only; its own source hashes retained in sidecar.'},
  artReview:art?'qa/timber-uv-art-review.json':null,
  scope:'Horizontal wall/gable/corner-lap UVs only. Door default UV, geometry, movement, combat, v1/v2 unchanged.',
  limits:'Representative still review + synthetic integration, not continuous/human playthrough. No new performance measurement, UE/cinematic or AAA acceptance. Earlier reports preserved. Pre-existing private-vault edits prevent full private sync; no private dependencies used.'
 };
 writeFileSync(new URL('qa/timber-uv-report.json',root),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({verdict:report.verdict,checks:report.checks,frames:frames.length},null,2));
}
