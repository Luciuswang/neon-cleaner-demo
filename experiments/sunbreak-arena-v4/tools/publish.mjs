// Ordinary protected-main PR for ONLY sunbreak/v4/. No bypass or force-push.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../../../',import.meta.url)),game=fileURLToPath(new URL('../',import.meta.url));
const endpoint='https://api.github.com/repos/Luciuswang/neon-cleaner-demo',subtree='sunbreak/v4/';
const env={...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'};
const git=(args,cwd=repo)=>execFileSync('git',args,{cwd,env,encoding:'utf8',maxBuffer:8e6}).trim();
assert.equal(git(['remote','get-url','origin']),'https://github.com/Luciuswang/neon-cleaner-demo.git');
const raw=execFileSync('git',['credential','fill'],{cwd:repo,env,input:'protocol=https\nhost=github.com\n\n',encoding:'utf8'});
const credential=Object.fromEntries(raw.trim().split('\n').map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)]}));
assert.ok(credential.password);const hash=b=>createHash('sha256').update(b).digest('hex');
async function api(path,method='GET',body){
 const r=await fetch(endpoint+path,{method,headers:{Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const j=await r.json();if(!r.ok)throw Error(`GitHub ${method} ${path} HTTP ${r.status}: ${j.message||'failed'}`);return j;
}
let number=Number(process.argv.find(a=>a.startsWith('--pr='))?.slice(5)||0);
if(process.argv.includes('--prepare')){
 assert.equal(git(['status','--porcelain']),'','Source checkpoint must be clean first');
 const sourceCommit=git(['rev-parse','HEAD']),out=resolve(repo,'.local/sunbreak-v4-build');
 const release=JSON.parse(readFileSync(resolve(out,'public-release.json')));
 assert.equal(release.schema,'sunbreak-auto-overlay-v1');assert.equal(release.sourceCommit,sourceCommit);assert.equal(release.publicPath,subtree);
 for(const f of release.files){
  assert.match(f.path,/^[a-z0-9-]+\.(js|html|json)$/);assert.ok(!/(?:serve|hooks|qa)/.test(f.path));
  const bytes=readFileSync(resolve(out,f.path));assert.equal(hash(bytes),f.sha256);
  assert.equal(hash(readFileSync(resolve(game,f.path))),f.sha256,'Stale source '+f.path);
  assert.ok(!/(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/.test(bytes.toString()),'Credential-like output');
 }
 assert.ok(!/arenaQA|loadedBuildHashes/.test(readFileSync(resolve(out,'index.html'),'utf8')));
 git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main']);
 const beforeMain=git(['rev-parse','origin/main']);
 const currentShared=JSON.parse(git(['show',beforeMain+':sunbreak/public-release.json']));
 assert.equal(currentShared.sourceCommit,release.sharedReleaseSource,'Shared release advanced; re-evaluate instead of stale publishing');
 const staging=mkdtempSync(resolve(repo,'.local/pages-release-v4-')),checkout=resolve(staging,'checkout');
 git(['worktree','add','--detach',checkout,'origin/main']);
 const destination=resolve(checkout,'sunbreak/v4');mkdirSync(destination,{recursive:true});
 const all=[...release.files.map(f=>f.path),'public-release.json'];
 for(const path of all){assert.ok(!path.includes('/'));copyFileSync(resolve(out,path),resolve(destination,path))}
 git(['add','--',subtree],checkout);
 const staged=git(['diff','--cached','--name-only'],checkout).split('\n').filter(Boolean);
 assert.ok(staged.length&&staged.every(p=>p.startsWith(subtree)),'Publication escaped v4');
 assert.deepEqual(git(['ls-files','--',subtree],checkout).split('\n').sort(),all.map(p=>subtree+p).sort(),'Unexpected previous v4 files');
 for(const f of release.files){
  const bytes=execFileSync('git',['show',':'+subtree+f.path],{cwd:checkout,maxBuffer:16e6});assert.equal(hash(bytes),f.sha256,'Staged file changed '+f.path);
 }
 git(['diff','--cached','--check'],checkout);
 git(['commit','-m','publish: SUNBREAK v4 automatic fire and hand-driven reload'],checkout);
 const head=git(['rev-parse','HEAD'],checkout),branch='codex/sunbreak-auto-'+sourceCommit.slice(0,12);
 git(['push','origin',head+':refs/heads/'+branch],checkout);
 const existing=await api('/pulls?state=open&base=main&head='+encodeURIComponent('Luciuswang:'+branch));
 const pr=existing[0]||await api('/pulls','POST',{title:'Publish separate SUNBREAK v4 automatic fire and magazine reload',head:branch,base:'main',
  body:'Only sunbreak/v4/ from source '+sourceCommit+'. Earlier three playable demos and all shared assets are unchanged. Adds held left-button fire and authored visible hand/magazine reload with bounded QA; remains single-player, no multiplayer claim. Normal protected-main workflow, no bypass.'});
 number=pr.number;
 writeFileSync(resolve(repo,'.local/sunbreak-v4-prepared.json'),JSON.stringify({number,url:pr.html_url,sourceCommit,head,beforeMain,checkout},null,2)+'\n');
 console.log(JSON.stringify({pr:number,url:pr.html_url,sourceCommit,head}));
}
if(number){
 const pr=await api('/pulls/'+number),rules=await api('/rules/branches/main');
 const reviews=await api('/pulls/'+number+'/reviews'),checks=await api('/commits/'+pr.head.sha+'/check-runs'),status=await api('/commits/'+pr.head.sha+'/status');
 const latest=new Map();for(const r of reviews)if(['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state))latest.set(r.user.login,r.state);
 const required=rules.find(r=>r.type==='pull_request')?.parameters?.required_approving_review_count??0;
 console.log(JSON.stringify({pr:number,merged:pr.merged,state:pr.state,mergeable:pr.mergeable,mergeableState:pr.mergeable_state,requiredApprovals:required,checks:checks.check_runs.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion})),statuses:status.statuses.length}));
 if(process.argv.includes('--merge')){
  const files=await api('/pulls/'+number+'/files?per_page=100');
  assert.ok(files.length>0&&files.length<100&&files.every(f=>f.filename.startsWith(subtree)));
  assert.equal(pr.head.repo.full_name,'Luciuswang/neon-cleaner-demo');
  assert.ok(pr.state==='open'&&!pr.draft&&pr.mergeable===true&&pr.mergeable_state==='clean');
  assert.ok([...latest.values()].filter(v=>v==='APPROVED').length>=required&&![...latest.values()].includes('CHANGES_REQUESTED'));
  assert.ok(checks.check_runs.every(c=>c.status==='completed'&&['success','neutral','skipped'].includes(c.conclusion)));
  assert.ok(status.statuses.length===0||status.state==='success');
  const merged=await api('/pulls/'+number+'/merge','PUT',{sha:pr.head.sha,merge_method:'merge'});assert.ok(merged.merged);
  git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main']);git(['merge-base','--is-ancestor',merged.sha,'origin/main']);
  const release=JSON.parse(git(['show',merged.sha+':'+subtree+'public-release.json']));
  const receipt={pr:number,publicCommit:merged.sha,sourceCommit:release.sourceCommit,url:'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/v4/',uploaded:true,liveVerified:false};
  writeFileSync(resolve(repo,'.local/sunbreak-v4-publication.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }
}
