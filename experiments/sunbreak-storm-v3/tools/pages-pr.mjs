// Protected-main publication: ordinary PR and normal merge only. Never modify
// repository rules, request a bypass, approve our own PR or force-push.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const endpoint='https://api.github.com/repos/Luciuswang/neon-cleaner-demo';
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'};
const git=(args,cwd=repo)=>execFileSync('git',args,{cwd,env,encoding:'utf8',maxBuffer:8e6});
const raw=execFileSync('git',['credential','fill'],{cwd:repo,env,input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
const credential=Object.fromEntries(raw.trim().split('\n').map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)]}));
assert.ok(credential.password);
async function api(path,method='GET',body){
 const r=await fetch(endpoint+path,{method,headers:{Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok)throw Error(`GitHub ${method} ${path}: HTTP${r.status} ${j.message||'failed'}`);return j;
}
const rules=await api('/rules/branches/main'),metadata=await api('');
const prArg=process.argv.find(a=>a.startsWith('--pr=')),checkoutArg=process.argv.find(a=>a.startsWith('--checkout='));
let number=prArg?Number(prArg.split('=')[1]):null;
if(process.argv.includes('--submit')){
 assert.ok(checkoutArg,'Explicit validated prepared checkout required');
 const checkout=resolve(checkoutArg.slice('--checkout='.length));
 assert.ok(checkout.startsWith(resolve(repo,'.local')+sep+'pages-release-'));
 const head=git(['rev-parse','HEAD'],checkout).trim(),release=JSON.parse(readFileSync(resolve(checkout,'sunbreak/public-release.json')));
 const paths=git(['diff-tree','--no-commit-id','--name-only','-r',head],checkout).trim().split('\n');
 assert.ok(paths.length>0&&paths.every(p=>p.startsWith('sunbreak/')),'Prepared commit scope invalid');
 assert.equal(git(['status','--porcelain'],checkout).trim(),'');
 const branch='codex/sunbreak-public-'+release.sourceCommit.slice(0,12);
 git(['push','origin',head+':refs/heads/'+branch],checkout);
 let prs=await api('/pulls?state=open&base=main&head='+encodeURIComponent('Luciuswang:'+branch));
 const pr=prs[0]||await api('/pulls','POST',{title:'Publish SUNBREAK editable cabin roundtrip and arm repair',head:branch,base:'main',
  body:'Publish only the validated static sunbreak/ subtree (source '+release.sourceCommit+'). Preserve existing root/web and v1/v2. Includes the real Blender cabin roundtrip, public art handoff ZIP, licensed v3 assets and source-bound release hashes; no private/UE assets or server diagnostics. Current bounded QA and limitations are in the source task packet. This PR follows protected-main rules; no bypass or repository setting change.'});
 number=pr.number;
 console.log(JSON.stringify({preparedHead:head,sourceCommit:release.sourceCommit,pr:number,url:pr.html_url,state:pr.state},null,2));
}
if(number){
 assert.ok(Number.isSafeInteger(number)&&number>0);
 const pr=await api('/pulls/'+number),reviews=await api('/pulls/'+number+'/reviews');
 const checks=await api('/commits/'+pr.head.sha+'/check-runs'),status=await api('/commits/'+pr.head.sha+'/status');
 const approvals=new Map();for(const r of reviews)if(['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state))approvals.set(r.user.login,r.state);
 const required=rules.find(r=>r.type==='pull_request')?.parameters?.required_approving_review_count??0;
 const summary={pr:number,url:pr.html_url,state:pr.state,merged:pr.merged,mergeable:pr.mergeable,mergeable_state:pr.mergeable_state,
  requiredApprovals:required,approvals:[...approvals].filter(([,s])=>s==='APPROVED').length,
  checks:checks.check_runs.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion})),status:status.state,statusCount:status.statuses.length};
 console.log(JSON.stringify(summary,null,2));
 if(process.argv.includes('--merge')){
  assert.equal(pr.head.repo.full_name,'Luciuswang/neon-cleaner-demo','Only this repository publication head is in scope');
  const changed=[];
  for(let page=1;;page++){
   const batch=await api('/pulls/'+number+'/files?per_page=100&page='+page);changed.push(...batch);
   if(batch.length<100)break;
  }
  assert.ok(changed.length>0&&changed.every(f=>f.filename.startsWith('sunbreak/')),'PR escapes the public sunbreak subtree');
  assert.ok(pr.state==='open'&&!pr.draft&&pr.mergeable===true&&pr.mergeable_state==='clean','PR must be normally mergeable; never bypass a blocked review/check');
  assert.ok(summary.approvals>=required&&!([...approvals.values()].includes('CHANGES_REQUESTED')),'Required human reviews are not satisfied');
  assert.ok(checks.check_runs.every(c=>c.status==='completed'&&['success','neutral','skipped'].includes(c.conclusion)),'Checks incomplete/failed');
  assert.ok(status.statuses.length===0||status.state==='success','Commit statuses incomplete/failed');
  const allowed=rules.find(r=>r.type==='pull_request')?.parameters?.allowed_merge_methods||['merge','squash'];
  const method=metadata.allow_merge_commit&&allowed.includes('merge')?'merge':metadata.allow_squash_merge&&allowed.includes('squash')?'squash':null;
  assert.ok(method,'Supported ordinary merge method unavailable');
  const merged=await api('/pulls/'+number+'/merge','PUT',{sha:pr.head.sha,merge_method:method});
  assert.ok(merged.merged,'PR did not merge');
  git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main']);
  git(['merge-base','--is-ancestor',merged.sha,'origin/main']);
  const publicRelease=JSON.parse(git(['show',merged.sha+':sunbreak/public-release.json']));
  const pages=await api('/pages'),receipt={sourceCommit:publicRelease.sourceCommit,publicCommit:merged.sha,publicationHead:pr.head.sha,
   pr:number,prUrl:pr.html_url,url:pages.html_url.replace(/\/$/,'')+'/sunbreak/',files:publicRelease.files.length,
   bytes:publicRelease.files.reduce((n,f)=>n+f.bytes,0),uploaded:true,liveVerified:false,method:'normal protected-branch PR merge; no rule bypass'};
  writeFileSync(resolve(repo,'.local/sunbreak-publication.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
 }
}else console.log(JSON.stringify({rules,allowMerge:metadata.allow_merge_commit,allowSquash:metadata.allow_squash_merge},null,2));
