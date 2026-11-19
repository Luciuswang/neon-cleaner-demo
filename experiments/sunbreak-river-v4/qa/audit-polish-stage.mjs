// Read-only validation until the final audit receipt write. No staging, commits,
// network, browser or test-suite execution. This is NOT release authorization.
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {runtimeHashes} from './source-binding.mjs';
import {localAssetRoot} from '../local-asset-store.mjs';
import {collectPolishCheckpoint,TASK,BASELINE,LEGACY_SHA256,SUITES,COMPANIONS,EXTRA_EVIDENCE,sha,safeRelative,phasePath,IMAGES} from './checkpoint-polish.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..'),prefix='experiments/sunbreak-river-v4/';
// Explicit code/QA/task paths, not the entire experiment or an extension denylist.
export const CODE_PATHS=Object.freeze(['world.js','index.html','vegetation.js','ground-surface.js','village.js','masonry-materials.js','stone-cover.js','environment-polish.js','weapon.js','combat-feedback.js','shot-feedback-event.js','timber-house.js','downloaded-dressing.js','river-water.js','tools/package.mjs']);
export const QA_PATHS=Object.freeze([...SUITES.map(n=>'qa/'+n+'.mjs'),'qa/browser.mjs','qa/hooks.js','qa/source-binding.mjs','qa/checkpoint-polish.mjs','qa/audit-polish-stage.mjs','qa/run-polish-units.mjs','qa/polish-units.json','qa/polish-review.json','qa/polish-package.json','qa/polish-release.json','qa/release.json']);
export const TASK_PATHS=Object.freeze(['docs/handoff.md','docs/sprint-2026-08-24.md','docs/tasks/'+TASK+'.md','docs/worklog/'+TASK+'.json']);
export function allowedEvidencePath(p){
 if(EXTRA_EVIDENCE.includes(p))return true;
 if(p==='qa/evidence/polish-cpu-development-2026-11-19.json')return true;
 for(const phase of [...Object.keys(IMAGES),'sunny-benchmark','benchmark']){
  if(phasePath(phase,p))return true;
  for(const name of IMAGES[phase]||[])if(new RegExp('^qa/evidence/'+phase+'-2026-11-19T\\d{2}-\\d{2}-\\d{2}-\\d{3}Z/'+name+'\\.(png|json)$').test(p))return true;
}return false;
}
export const finishWorklogPath=p=>/^docs\/worklog\/\d{8}T\d{6}Z-[0-9a-f]{10}\.json$/.test(p);
export function validateHandoffAppend(baseline,current){
 assert.ok(current.length>=baseline.length&&current.subarray(0,baseline.length).equals(baseline),'Legacy handoff bytes rewritten');
 assert.ok(current.subarray(baseline.length).every(b=>b===9||b===10||b===13||(b>=32&&b<=126)),'Only new ASCII handoff append authorized');
}
export function parseBlobBatch(output,ids){
 const result=new Map();let offset=0;
 for(const id of ids){const end=output.indexOf(10,offset);assert.ok(end>=offset,'Truncated cat-file header');const m=output.toString('ascii',offset,end).match(/^([0-9a-f]+) blob (\d+)$/);assert.ok(m&&m[1]===id,'Unexpected cat-file object');const size=Number(m[2]),start=end+1;assert.ok(start+size<output.length&&output[start+size]===10,'Truncated cat-file body');result.set(id,output.subarray(start,start+size));offset=start+size+1}
 assert.equal(offset,output.length,'Unexpected batch residue');return result;
}
export function lfsPointer(blob){
 const text=blob.toString('utf8');
 if(!text.startsWith('version https://git-lfs.github.com/spec/v1'))return null;
 const match=text.match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([0-9a-f]{64})\nsize (0|[1-9]\d*)\n$/);
 assert.ok(match,'Malformed/noncanonical LFS index pointer');return{sha256:match[1],bytes:Number(match[2])};
}
export function privateHashes(value,out=new Set()){
 if(Array.isArray(value))for(const v of value)privateHashes(v,out);
 else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value)){
  if(/sha256$/i.test(k)&&typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v))out.add(v.toLowerCase());
  else if(v&&typeof v==='object')privateHashes(v,out);
 }return out;
}
export async function auditPolishStage(){
 const gitBytes=(args,input)=>execFileSync('git',args,{cwd:repo,input,maxBuffer:50e6,windowsHide:true}),git=(...args)=>gitBytes(args).toString('utf8').trim();
 const initialSources=await runtimeHashes(),indexRaw=gitBytes(['ls-files','--stage','-z']),stagedRaw=gitBytes(['diff','--cached','--name-only','-z']);
 const index=new Map(indexRaw.toString('utf8').split('\0').filter(Boolean).map(row=>{const m=row.match(/^(\d+) ([0-9a-f]+) 0\t([\s\S]+)$/);assert.ok(m,'Unmerged index');return[m[3],{mode:m[1],blob:m[2]}]}));
 const exceptional=new Set(git('ls-files','-v','-z').split('\0').filter(row=>row&&(/[a-z]/.test(row[0])||row[0]==='S')).map(row=>row.slice(2)));
 const bytes=await readFile(resolve(root,'qa/polish-release.json')),report=JSON.parse(bytes);
 assert.deepEqual(bytes,await readFile(resolve(root,'qa/release.json')),'Canonical copies differ');
 assert.equal(report.task,TASK);assert.equal(report.schema,'river-material-combat-polish-checkpoint-v2');assert.equal(report.verdict,'BLOCKED');assert.equal(report.publicRelease,'UNCHANGED');
 assert.deepEqual(initialSources,report.sources,'Runtime changed since QA');
 const selfSHA=sha(await readFile(fileURLToPath(import.meta.url)));
 assert.equal(report.companions?.['qa/audit-polish-stage.mjs'],selfSHA,'Collector must pin this auditor, not a later replacement');
 // Recompute all collector contracts instead of trusting hand-edited booleans.
 // This only reads evidence; it does not run CPU suites or GPU work.
 const fresh=await collectPolishCheckpoint();
 for(const key of ['sources','sourceBindings','functional','units','unitsValidation','selection','selectionValid','reports','visuals','retained','allEvidence','performance','review','package','legacy','companions'])assert.deepEqual(report[key],fresh[key],'Stale/tampered checkpoint '+key);
 assert.ok(fresh.sourceBindings.stable&&fresh.functional&&fresh.selectionValid&&fresh.unitsValidation.valid,'Incomplete functional/source/evidence WIP');
 assert.ok(fresh.review.current&&fresh.package.current&&fresh.legacy.unchanged,'Stale review/package/legacy evidence');
 // REVISE art and BLOCKED strict performance are honest source-checkpoint
 // outcomes. Sample integrity is required even when pacing thresholds FAIL.
 assert.ok(['PASS','CONDITIONAL PASS','REVISE','BLOCKED'].includes(fresh.review.verdict));
 assert.equal(fresh.performance.samples.length,3);assert.ok(fresh.performance.samples.every(p=>p.valid),'Missing/malformed prescribed performance samples');
 const localBytes=await readFile(resolve(localAssetRoot,'manifest.json')),local=JSON.parse(localBytes),privateSet=privateHashes(local);
 privateSet.add(sha(localBytes));
 for(const [p,h]of Object.entries(initialSources))if(p.startsWith('local-only/'))privateSet.add(h);
 // Include known excluded downloads/source archives, not only active GLBs.
 const inventoryRelative='qa/downloaded-asset-inventory.json',inventoryPath=resolve(root,inventoryRelative),inventoryBytes=await readFile(inventoryPath);
 assert.deepEqual(inventoryBytes,gitBytes(['show',BASELINE+':'+prefix+inventoryRelative]),'Private exclusion inventory must retain the pinned baseline');privateHashes(JSON.parse(inventoryBytes),privateSet);
 const required=new Map(),add=(p,h)=>{assert.equal(typeof h,'string','Missing bound hash '+p);assert.match(h,/^[a-f0-9]{64}$/);if(required.has(p))assert.equal(required.get(p),h,'Conflicting evidence hash '+p);required.set(p,h)};
 for(const [p,h]of Object.entries(report.sources))if(!p.startsWith('local-only/'))add(p,h);
 for(const e of report.allEvidence){assert.ok(allowedEvidencePath(e.path),'Unexpected evidence path');add(e.path,e.sha256)}
 for(const e of report.visuals){add(e.path,e.sha256);add(e.statePath,e.stateSHA256)}
 for(const [p,h]of Object.entries(report.companions)){assert.ok(COMPANIONS.includes(p),'Unexpected companion');add(p,h)}
 const receipt=JSON.parse(await readFile(resolve(root,'qa/polish-package.json')));for(const f of receipt.packageFiles)add(f.path,f.sha256);
 add('qa/downloaded-release.json',LEGACY_SHA256);
 add(inventoryRelative,sha(inventoryBytes));
 for(const p of ['qa/release.json','qa/polish-release.json'])add(p,sha(await readFile(resolve(root,p))));
 assert.equal(sha(gitBytes(['show',BASELINE+':'+prefix+'qa/downloaded-release.json'])),LEGACY_SHA256,'Historical baseline changed');
 const verified=new Map(),auditPath=prefix+'qa/polish-staged-audit.json',stagedPaths=stagedRaw.toString('utf8').split('\0').filter(Boolean);
 const allowed=new Set([...CODE_PATHS,...QA_PATHS].map(p=>prefix+p).concat(TASK_PATHS)),evidenceAllowed=new Set(report.allEvidence.map(e=>prefix+e.path));
 for(const path of stagedPaths)assert.ok(path===auditPath||allowed.has(path)||evidenceAllowed.has(path)||finishWorklogPath(path),'Outside explicit code/task/QA/evidence allowlist '+path);
 const paths=[...new Set([...required.keys()].map(p=>relative(repo,resolve(root,p)).replaceAll('\\','/')).concat(stagedPaths))];
 for(const p of paths){assert.ok(safeRelative(p)&&!/[\r\n\x00\"]/g.test(p),'Unsafe batch path');assert.ok(index.has(p),'Missing index entry '+p)}
 // --stdin-paths applies the same per-path clean/EOL/LFS filters as
 // hash-object --path=<path> --stdin, without hundreds of Git launches.
 // Never use --no-filters or -w. Post-read SHA checks below bind the same bytes.
 const expectedBlobs=gitBytes(['hash-object','--stdin-paths'],Buffer.from(paths.join('\n')+'\n')).toString('utf8').trim().split('\n');assert.equal(expectedBlobs.length,paths.length);
 const cleanHashes=new Map(paths.map((p,i)=>[p,expectedBlobs[i].trim()]));
 const attrs=gitBytes(['check-attr','-z','--stdin','filter'],Buffer.from(paths.join('\0')+'\0')).toString('utf8').split('\0'),filters=new Map();
 for(let i=0;i<attrs.length-1;i+=3){assert.equal(attrs[i+1],'filter');filters.set(attrs[i],attrs[i+2])}
 const blobs=new Map(),ids=[...new Set(paths.map(p=>index.get(p).blob))];
 for(let i=0;i<ids.length;i+=8){const chunk=ids.slice(i,i+8);for(const [id,b]of parseBlobBatch(gitBytes(['cat-file','--batch'],Buffer.from(chunk.join('\n')+'\n')),chunk))blobs.set(id,b)}
 const priorWorklogs=new Set(git('ls-tree','-r','--name-only','HEAD','--','docs/worklog').split('\n'));
 async function verifyIndexed(path,expectedSHA){
  assert.ok(safeRelative(path),'Unsafe repository path '+path);assert.ok(index.has(path),'Required file absent from index '+path);assert.ok(!exceptional.has(path),'Git comparison bypass flag '+path);
  const i=index.get(path);assert.ok(['100644','100755'].includes(i.mode),'Symlink/submodule not allowed '+path);
  const file=resolve(repo,path),stat=await lstat(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Nonregular worktree file '+path);
  assert.equal((await realpath(file)).toLowerCase(),file.toLowerCase(),'Junction/symlink path '+path);
  const working=await readFile(file),workingSHA256=sha(working);if(expectedSHA)assert.equal(workingSHA256,expectedSHA,'Changed bound bytes '+path);
  assert.ok(!privateSet.has(workingSHA256),'Renamed private payload in stage '+path);
  const expectedBlob=cleanHashes.get(path);
  assert.equal(i.blob,expectedBlob,'Index blob does not equal clean-filtered current bytes '+path);
  const blob=blobs.get(i.blob),pointer=lfsPointer(blob);
  assert.ok(!privateSet.has(sha(blob)),'Private payload in index '+path);
  if(filters.get(path)==='lfs')assert.ok(pointer,'LFS path lacks pointer '+path);
  if(pointer){assert.equal(pointer.sha256,workingSHA256,'LFS SHA mismatch '+path);assert.equal(pointer.bytes,working.length,'LFS size mismatch '+path);assert.ok(!privateSet.has(pointer.sha256),'Private LFS oid staged under another name '+path)}
  const row={path,indexBlob:i.blob,workingSHA256,bytes:working.length,...pointer?{lfs:pointer}:{}};verified.set(path,row);return row;
 }
 const bound=[];for(const [p,h]of required){
  const path=relative(repo,resolve(root,p)).replaceAll('\\','/');assert.ok(safeRelative(path),'Evidence leaves repo');bound.push(await verifyIndexed(path,h));
 }
 const files=[];
 for(const path of stagedPaths){
  if(path===auditPath)continue; // Validated against the exact recomputed receipt below.
  // An exact allowlist excludes .gltf/.bin/.blend as well as GLB/archives;
  // payload hashing above also rejects private content renamed to an allowed path.
  files.push(verified.get(path)||await verifyIndexed(path));
 }
 // Status docs/worklogs are text, not an alternate binary upload channel.
 for(const row of files){
  const p=row.path,b=await readFile(resolve(repo,p));
  if(p==='docs/handoff.md')validateHandoffAppend(gitBytes(['show',BASELINE+':docs/handoff.md']),b);
  else if(p.endsWith('.png'))assert.ok(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Not PNG evidence '+p);
  else{assert.ok(!b.includes(0),'Binary disguised as text '+p);const text=new TextDecoder('utf-8',{fatal:true}).decode(b);if(p.endsWith('.json')){
   const record=JSON.parse(text);if(p.startsWith('docs/worklog/')){assert.equal(record.task_id,TASK,'Unrelated worklog');assert.ok(!priorWorklogs.has(p),'Existing immutable worklog changed');if(finishWorklogPath(p)){assert.equal(record.schema,1);assert.equal(record.event_id,p.split('/').at(-1).slice(0,-5))}}
  }}
 }
 assert.deepEqual(await runtimeHashes(),initialSources,'Runtime changed during staging audit');
 assert.deepEqual(gitBytes(['ls-files','--stage','-z']),indexRaw,'Index changed during audit');assert.deepEqual(gitBytes(['diff','--cached','--name-only','-z']),stagedRaw,'Staged set changed during audit');
 for(const row of verified.values())assert.equal(sha(await readFile(resolve(repo,row.path))),row.workingSHA256,'File changed during audit '+row.path);
 assert.equal(sha(await readFile(resolve(localAssetRoot,'manifest.json'))),sha(localBytes),'Private manifest changed during audit');
 const audit={schema:'river-material-polish-staged-audit-v2',pass:true,task:TASK,release:'BLOCKED',auditorSHA256:selfSHA,runtimeDigest:sha(JSON.stringify(initialSources)),canonicalSHA256:sha(bytes),legacySHA256:LEGACY_SHA256,selection:report.selection,boundFiles:bound,files,authorizedPostAuditFinish:{handoff:'docs/handoff.md: preserve every existing byte; ASCII append from prescribed finish -Note only',worklog:'docs/worklog/YYYYMMDDTHHMMSSZ-10hex.json: new immutable schema1 event; task_id must equal '+TASK,receipt:prefix+'qa/polish-staged-audit.json',validation:'These finish-generated additions are authorized but not claimed inspected by this pre-finish audit. Root must verify exact append/task binding before publication. Runtime, QA, package and evidence bytes remain frozen; changes there require recollection and re-audit.'},scope:'Pre-finish source/evidence index audit, NOT a claim that the final index can never change. Exact clean-filter/index/LFS identities checked; private payloads excluded. Art/performance acceptance and upload acknowledgement remain separate.'};
 if(stagedRaw.toString('utf8').split('\0').includes(auditPath)){
  const expected=Buffer.from(JSON.stringify(audit,null,2)+'\n');assert.deepEqual(await readFile(resolve(repo,auditPath)),expected,'Staged audit receipt is stale');await verifyIndexed(auditPath,sha(expected));
 }
 return audit;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 const audit=await auditPolishStage();if(!process.argv.includes('--stdout-only'))await writeFile(resolve(root,'qa/polish-staged-audit.json'),JSON.stringify(audit,null,2)+'\n');console.log(JSON.stringify(audit));
}
