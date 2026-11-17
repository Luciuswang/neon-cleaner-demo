// Anonymous HTTPS verification; no credentials or local development server.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repo=new URL('../../../',import.meta.url),game=new URL('../',import.meta.url);
const receipt=JSON.parse(readFileSync(new URL('.local/sunbreak-publication.json',repo)));
const base=receipt.url,hash=b=>createHash('sha256').update(b).digest('hex');
const releaseResponse=await fetch(base+'public-release.json',{cache:'no-store'});
if(!releaseResponse.ok)throw Error('Pages release is not live: '+releaseResponse.status);
const release=await releaseResponse.json();
if(release.sourceCommit!==receipt.sourceCommit)throw Error('Pages serves a different source release');
const queue=[...release.files],checked=[],errors=[];
await Promise.all(Array.from({length:6},async()=>{
 while(queue.length){
  const file=queue.shift();
  try{
   const r=await fetch(new URL(file.path,base),{cache:'no-store',signal:AbortSignal.timeout(60000)});
   if(!r.ok)throw Error('HTTP '+r.status);
   const bytes=Buffer.from(await r.arrayBuffer()),sha256=hash(bytes);
   if(sha256!==file.sha256)throw Error('Deployed hash mismatch');
   checked.push({path:file.path,bytes:bytes.length,sha256});
  }catch(e){errors.push({path:file.path,error:String(e)})}
 }
}));
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8'});
for(const path of ['index.html','web/index.html']){
 const expected=Buffer.from(git(['show','bde0b2011374404b167b72624003c345f49db41d:'+path]));
 const url=new URL('../'+path,base),r=await fetch(url,{cache:'no-store'}),bytes=Buffer.from(await r.arrayBuffer());
 if(!r.ok||hash(bytes)!==hash(expected))errors.push({path,error:'Original Neon Cleaner Pages entry changed or unavailable'});
}
const report={schema:'sunbreak-public-live-v1',date:new Date().toISOString(),pass:errors.length===0&&checked.length===release.files.length,
 method:'anonymous HTTPS fetch of all release files, byte hashes and pinned original root/web entry; interactive browser smoke recorded separately',
 url:base,sourceCommit:release.sourceCommit,publicCommit:receipt.publicCommit,checkedFiles:checked.length,bytes:checked.reduce((n,f)=>n+f.bytes,0),errors,files:checked.sort((a,b)=>a.path.localeCompare(b.path))};
writeFileSync(new URL('qa/tactical-public-live.json',game),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined},null,2));
if(!report.pass)process.exitCode=1;
