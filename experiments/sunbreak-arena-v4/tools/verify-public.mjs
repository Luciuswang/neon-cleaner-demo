// Anonymous byte checks of the overlay and all pinned shared dependencies.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../../../',import.meta.url)),root=new URL('../',import.meta.url);
const receipt=JSON.parse(readFileSync(resolve(repo,'.local/sunbreak-v4-publication.json')));
const base=receipt.url,hash=b=>createHash('sha256').update(b).digest('hex');
const r=await fetch(base+'public-release.json',{cache:'no-store'});assert.ok(r.ok);
const release=await r.json();assert.equal(release.sourceCommit,receipt.sourceCommit);assert.equal(release.schema,'sunbreak-auto-overlay-v1');
const checked=[],errors=[],retries=[];
const queue=[...release.files.map(f=>({...f,url:new URL(f.path,base).href})),
 ...release.sharedFiles.map(f=>({...f,path:'../'+f.path,url:new URL('../'+f.path,base).href}))];
await Promise.all(Array.from({length:4},async()=>{
 while(queue.length){
  const f=queue.shift();
  try{
   let response;
   for(let attempt=1;attempt<=3;attempt++){
    response=await fetch(f.url,{cache:'no-store',signal:AbortSignal.timeout(60000)});
    if(![429,502,503,504].includes(response.status)||attempt===3)break;
    retries.push({path:f.path,attempt,status:response.status});await response.arrayBuffer();
    await new Promise(r=>setTimeout(r,attempt*500));
   }
   assert.ok(response.ok,'HTTP '+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(hash(bytes),f.sha256,'Live byte mismatch');
   checked.push({path:f.path,sha256:f.sha256,bytes:bytes.length});
  }catch(e){errors.push({path:f.path,error:e.message})}
 }
}));
// Verify unchanged earlier entries against the real pre-v4 public commit.
const previous='49d79ba1d23be88eec79dd3d951d802da321d959';
for(const path of ['index.html','web/index.html','sunbreak/index.html','sunbreak/original/index.html','sunbreak/v2/index.html']){
 try{
  const expected=execFileSync('git',['show',previous+':'+path],{cwd:repo,maxBuffer:8e6});
  const response=await fetch('https://luciuswang.github.io/neon-cleaner-demo/'+path,{cache:'no-store'});
  assert.ok(response.ok);assert.equal(hash(Buffer.from(await response.arrayBuffer())),hash(expected));
  checked.push({path:'preserved:'+path,sha256:hash(expected)});
 }catch(e){errors.push({path,error:e.message})}
}
const report={schema:'sunbreak-auto-public-v1',date:new Date().toISOString(),pass:errors.length===0,sourceCommit:receipt.sourceCommit,publicCommit:receipt.publicCommit,url:base,files:checked,errors,retries};
writeFileSync(new URL('qa/public-live.json',root),JSON.stringify(report,null,2)+'\n');
if(report.pass)writeFileSync(resolve(repo,'.local/sunbreak-v4-publication.json'),JSON.stringify({...receipt,liveVerified:true},null,2)+'\n');
console.log(JSON.stringify({...report,files:checked.length}));if(!report.pass)process.exitCode=1;
