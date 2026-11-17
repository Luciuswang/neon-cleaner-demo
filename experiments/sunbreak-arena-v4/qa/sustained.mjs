// Reuse the exact native-browser harness with ONE QA-state adaptation: after
// benchmark reset, give ample reserve before the first gameplay frame. Never
// change runtime damage/fire/reload, timings, thresholds, viewport or raw samples.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const url=new URL('./browser.mjs',import.meta.url);
const hash=text=>createHash('sha256').update(text).digest('hex');
let code=readFileSync(url,'utf8');
const original="const report=await evaluate('arenaQA.benchmark()');";
if(code.split(original).length!==2)throw Error('Harness changed; review adapter');
code=code.replace(original,`const report=await evaluate('setTimeout(()=>arenaQA.setAmmo(30,3000),0);arenaQA.benchmark()');
  report.stress=await evaluate('({reserveConfigured:3000,shots:arenaQA.snapshot().shots,finalAmmo:arenaQA.snapshot().ammo})');
  check('sustained workload fires at least180 shots without reserve exhaustion',report.stress.shots>=180&&report.stress.finalAmmo.reserve>0,report.stress);`);
code=code.replaceAll('import.meta.url',JSON.stringify(url.href));
const adapter={method:'exact base harness plus documented QA-only initial reserve3000 adaptation; no threshold/timing changes',
 source:'qa/sustained.mjs',sourceSha256:hash(readFileSync(new URL(import.meta.url))),baseSourceSha256:hash(readFileSync(url)),adaptedProgramSha256:hash(code)};
code=code.replace("schema:'sunbreak-auto-browser-v1'","schema:'sunbreak-auto-browser-v1',harnessAdapter:"+JSON.stringify(adapter));
await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
