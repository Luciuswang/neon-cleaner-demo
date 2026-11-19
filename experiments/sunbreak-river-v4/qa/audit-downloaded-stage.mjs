import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runtimeHashes} from './source-binding.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..'),prefix='experiments/sunbreak-river-v4/',sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:20e6}).trim();
// Git performs its own index/working comparison (including text/LFS filters) in
// one batch. Avoid hundreds of separate filter-driver invocations.
const unstaged=new Set(git('diff','--name-only','-z').split('\0').filter(Boolean));
const index=new Map(git('ls-files','--stage','-z').split('\0').filter(Boolean).map(row=>{const m=row.match(/^\d+ ([0-9a-f]+) 0\t([\s\S]+)$/);assert.ok(m,'Unmerged index');return[m[2],m[1]]}));
const exceptional=new Set(git('ls-files','-v','-z').split('\0').filter(row=>row&&(/[a-z]/.test(row[0])||row[0]==='S')).map(row=>row.slice(2)));
const indexed=path=>{assert.ok(index.has(path),'Required file absent from index '+path);assert.ok(!exceptional.has(path),'Required path bypasses Git working comparison '+path);assert.ok(!unstaged.has(path),'Index differs from working evidence '+path);return index.get(path)};
const report=JSON.parse(await readFile(resolve(root,'qa/downloaded-release.json'),'utf8'));
assert.deepEqual(await readFile(resolve(root,'qa/downloaded-release.json')),await readFile(resolve(root,'qa/release.json')),'Canonical report copies differ');
assert.deepEqual(await runtimeHashes(),report.sources,'Runtime changed since canonical QA');
assert.ok(report.functional&&report.reviewBinding.valid&&report.publicPackage.current,'Incomplete WIP verification');
assert.equal(report.verdict,'BLOCKED','No release promotion allowed in this checkpoint');
for(const [path,hash]of Object.entries(report.companionHashes))if(hash)assert.equal(sha(await readFile(resolve(root,path))),hash,'Companion changed '+path);
const required=new Map();
for(const [path,hash]of Object.entries(report.sources))if(!path.startsWith('local-only/'))required.set(path,hash);
for(const v of report.visuals){required.set(v.path,v.sha256);required.set(v.statePath,v.stateSHA256)}
for(const r of [...Object.values(report.reports).flat(),...report.retained,...report.diagnostics])if(r.path)required.set(r.path,r.sha256);
for(const [path,hash]of Object.entries(report.companionHashes))if(hash)required.set(path,hash);
for(const path of ['qa/release.json','qa/downloaded-release.json','qa/audit-downloaded-stage.mjs'])required.set(path,sha(await readFile(resolve(root,path))));
const bound=[];
for(const [path,hash]of required){
 const file=resolve(root,path),repoPath=relative(repo,file).replaceAll('\\','/');
 assert.ok(!repoPath.startsWith('../'),'Evidence leaves repository');
 assert.equal(sha(await readFile(file)),hash,'Required current evidence changed '+path);
 const indexBlob=indexed(repoPath);
 bound.push({path:repoPath,indexBlob,workingSHA256:hash});
}
const rows=[];
for(const path of git('diff','--cached','--name-only').split('\n').filter(Boolean)){
 assert.ok(path.startsWith(prefix)||path==='.gitignore'||path==='docs/handoff.md'||path==='docs/tasks/sunbreak-river-downloaded-assets-2026-11-19.md'||path.startsWith('docs/worklog/'),'Unrelated staged scope '+path);
 assert.ok(!/\.(glb|uasset|umap|zip|fbx|usd)$/i.test(path),'Private model/archive must not be publicly staged '+path);
 if(path===prefix+'qa/downloaded-staged-audit.json')continue;
 const indexBlob=indexed(path);
 rows.push({path,indexBlob,workingSHA256:sha(await readFile(resolve(repo,path)))});
}
for(const path of ['qa/downloaded-release.json',...Object.keys(report.companionHashes).filter(p=>report.companionHashes[p])])assert.ok(rows.some(r=>r.path===prefix+path),'Unstaged canonical companion '+path);
const audit={schema:'river-downloaded-staged-audit-v1',pass:true,task:report.task,auditorSHA256:sha(await readFile(fileURLToPath(import.meta.url))),runtimeSourceDigest:sha(JSON.stringify(report.sources)),canonicalSHA256:sha(await readFile(resolve(root,'qa/downloaded-release.json'))),boundFiles:bound,files:rows,release:report.verdict,scope:'Every bound public runtime/evidence path compared with index, not only staged changes. Local-only hashes validated through runtimeHashes/private pointer, never staged. Finish appends authorized handoff/worklog; this audit does not claim remote upload.'};
await writeFile(resolve(root,'qa/downloaded-staged-audit.json'),JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify({pass:true,stagedFiles:rows.length,release:report.verdict,privateBackup:report.privateBackup.status}));
