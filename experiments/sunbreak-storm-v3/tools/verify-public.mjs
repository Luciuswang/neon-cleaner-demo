// Anonymous HTTPS verification; no credentials or local development server.
import {readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const repo=new URL('../../../',import.meta.url),game=new URL('../',import.meta.url);
const receipt=JSON.parse(readFileSync(new URL('.local/sunbreak-publication.json',repo)));
const base=receipt.url,hash=b=>createHash('sha256').update(b).digest('hex');
const releaseResponse=await fetch(base+'public-release.json',{cache:'no-store'});
if(!releaseResponse.ok)throw Error('Pages release is not live: '+releaseResponse.status);
const release=await releaseResponse.json();
if(release.sourceCommit!==receipt.sourceCommit)throw Error('Pages serves a different source release');
const reportArg=process.argv.find(a=>a.startsWith('--report=')),reportName=reportArg?reportArg.slice('--report='.length):'tactical-public-live';
if(!/^[a-z0-9-]+$/.test(reportName))throw Error('Invalid report basename');
const priorPath=new URL('qa/'+reportName+'.json',game);
const prior=process.argv.includes('--retry-failed')&&existsSync(priorPath)?JSON.parse(readFileSync(priorPath)):null;
if(prior&&(prior.sourceCommit!==receipt.sourceCommit||prior.publicCommit!==receipt.publicCommit))throw Error('Prior verification belongs to a different release');
const checked=prior?prior.files.filter(p=>release.files.some(f=>f.path===p.path&&f.sha256===p.sha256&&f.bytes===p.bytes)):[];
const queue=release.files.filter(f=>!checked.some(p=>p.path===f.path)),errors=[],retries=[];
if(prior&&!prior.pass&&!existsSync(new URL('qa/'+reportName+'-first-attempt.json',game)))copyFileSync(priorPath,new URL('qa/'+reportName+'-first-attempt.json',game));
await Promise.all(Array.from({length:6},async()=>{
 while(queue.length){
  const file=queue.shift();
  try{
   let r;
   for(let attempt=1;attempt<=3;attempt++){
    r=await fetch(new URL(file.path,base),{cache:'no-store',signal:AbortSignal.timeout(60000)});
    if(![429,502,503,504].includes(r.status)||attempt===3)break;
    retries.push({path:file.path,attempt,status:r.status});
    await r.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,attempt*500));
   }
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
 method:'anonymous HTTPS byte hashes of every release file and pinned original root/web entry; optional failed-file retry carries only exact same-release verified hashes; interactive browser smoke recorded separately',
 url:base,sourceCommit:release.sourceCommit,publicCommit:receipt.publicCommit,checkedFiles:checked.length,carriedVerifiedFiles:prior?.files.length||0,
 priorAttempt:prior?{date:prior.date,pass:prior.pass,errors:prior.errors}:null,retries,
 bytes:checked.reduce((n,f)=>n+f.bytes,0),errors,files:checked.sort((a,b)=>a.path.localeCompare(b.path))};
writeFileSync(priorPath,JSON.stringify(report,null,2)+'\n');
if(report.pass)writeFileSync(new URL('.local/sunbreak-publication.json',repo),JSON.stringify({...receipt,liveVerified:true,verifiedAt:report.date,checkedFiles:report.checkedFiles},null,2)+'\n');
console.log(JSON.stringify({...report,files:undefined},null,2));
if(!report.pass)process.exitCode=1;
