// Ordinary protected-main PR for ONLY sunbreak/river/. No bypass or force-push.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {validatePreparedPR,validateManifest} from './publication-contract.mjs';
const repo=fileURLToPath(new URL('../../../',import.meta.url)),game=fileURLToPath(new URL('../',import.meta.url));
const endpoint='https://api.github.com/repos/Luciuswang/neon-cleaner-demo',subtree='sunbreak/river/';
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
 const sourceCommit=git(['rev-parse','HEAD']),out=resolve(repo,'.local/sunbreak-river-build');
 const release=JSON.parse(readFileSync(resolve(out,'public-release.json')));
 assert.equal(release.schema,'sunbreak-river-overlay-v1');assert.equal(release.sourceCommit,sourceCommit);assert.equal(release.publicPath,subtree);
 for(const f of release.files){
  assert.match(f.path,/^[a-zA-Z0-9_\-./]+\.(js|html|json|glb|gltf|bin|png|jpg)$/);assert.ok(!f.path.split('/').includes('..'));assert.ok(!/(?:serve|hooks|qa)/.test(f.path));
  const bytes=readFileSync(resolve(out,f.path));assert.equal(hash(bytes),f.sha256);
  assert.equal(hash(readFileSync(resolve(game,f.path))),f.sha256,'Stale source '+f.path);
  assert.ok(!/(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/.test(bytes.toString()),'Credential-like output');
 }
 assert.ok(!/arenaQA|loadedBuildHashes/.test(readFileSync(resolve(out,'index.html'),'utf8')));
 git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main']);
 const beforeMain=git(['rev-parse','origin/main']);
 const currentShared=JSON.parse(git(['show',beforeMain+':sunbreak/public-release.json']));
 assert.equal(currentShared.sourceCommit,release.sharedReleaseSource,'Shared release advanced; re-evaluate instead of stale publishing');
 const staging=mkdtempSync(resolve(repo,'.local/pages-release-river-')),checkout=resolve(staging,'checkout');
 git(['worktree','add','--detach',checkout,'origin/main']);
 const destination=resolve(checkout,'sunbreak/river');mkdirSync(destination,{recursive:true});
 const all=[...release.files.map(f=>f.path),'public-release.json'];
 for(const path of all){assert.ok(!path.split('/').includes('..'));mkdirSync(dirname(resolve(destination,path)),{recursive:true});copyFileSync(resolve(out,path),resolve(destination,path))}
 git(['-c','core.autocrlf=false','add','--',subtree],checkout);
 const staged=git(['diff','--cached','--name-only'],checkout).split('\n').filter(Boolean);
 assert.ok(staged.length&&staged.every(p=>p.startsWith(subtree)),'Publication escaped river');
 assert.deepEqual(git(['ls-files','--',subtree],checkout).split('\n').sort(),all.map(p=>subtree+p).sort(),'Unexpected previous river files');
 for(const f of release.files){
  const bytes=execFileSync('git',['show',':'+subtree+f.path],{cwd:checkout,maxBuffer:64e6});assert.equal(hash(bytes),f.sha256,'Staged file changed '+f.path);
 }
 const manifestSha256=hash(readFileSync(resolve(out,'public-release.json')));
 assert.equal(hash(execFileSync('git',['show',':'+subtree+'public-release.json'],{cwd:checkout,maxBuffer:8e6})),manifestSha256,'Staged manifest changed');
 git(['diff','--cached','--check'],checkout);
 git(['commit','-m','publish: SUNBREAK Riverfall village map'],checkout);
 const head=git(['rev-parse','HEAD'],checkout),branch='codex/sunbreak-river-'+sourceCommit.slice(0,12);
 git(['push','origin',head+':refs/heads/'+branch],checkout);
 const existing=await api('/pulls?state=open&base=main&head='+encodeURIComponent('Luciuswang:'+branch));
 const pr=existing[0]||await api('/pulls','POST',{title:'Publish separate SUNBREAK Riverfall village map',head:branch,base:'main',
  body:'Only sunbreak/river/ from source '+sourceCommit+'. Earlier four demos and shared assets are unchanged. New mirrored river village with scanned mud/foliage, flowing water, ruins and retained v4 weapons/NPCs. Single-player map experiment; multiplayer, competitive balance and AAA parity are not claimed. Normal protected-main workflow, no bypass.'});
 number=pr.number;
 writeFileSync(resolve(repo,'.local/sunbreak-river-prepared.json'),JSON.stringify({number,url:pr.html_url,sourceCommit,head,beforeMain,checkout,manifestSha256},null,2)+'\n');
 console.log(JSON.stringify({pr:number,url:pr.html_url,sourceCommit,head}));
}
if(number){
 const pr=await api('/pulls/'+number),rules=await api('/rules/branches/main');
 const reviews=await api('/pulls/'+number+'/reviews'),checks=await api('/commits/'+pr.head.sha+'/check-runs'),status=await api('/commits/'+pr.head.sha+'/status');
 const latest=new Map();for(const r of reviews)if(['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state))latest.set(r.user.login,r.state);
 const required=rules.find(r=>r.type==='pull_request')?.parameters?.required_approving_review_count??0;
 console.log(JSON.stringify({pr:number,merged:pr.merged,state:pr.state,mergeable:pr.mergeable,mergeableState:pr.mergeable_state,requiredApprovals:required,checks:checks.check_runs.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion})),statuses:status.statuses.length}));
 if(process.argv.includes('--merge')){
  const prepared=JSON.parse(readFileSync(resolve(repo,'.local/sunbreak-river-prepared.json')));
  validatePreparedPR(pr,prepared);
  const pinnedRelease=validateManifest(execFileSync('git',['show',prepared.head+':'+subtree+'public-release.json'],{cwd:repo,maxBuffer:8e6}),prepared);
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
  validateManifest(execFileSync('git',['show',merged.sha+':'+subtree+'public-release.json'],{cwd:repo,maxBuffer:8e6}),prepared);
  assert.equal(release.sourceCommit,pinnedRelease.sourceCommit);
  const receipt={pr:number,publicCommit:merged.sha,sourceCommit:release.sourceCommit,url:'https://luciuswang.github.io/neon-cleaner-demo/sunbreak/river/',uploaded:true,liveVerified:false};
  writeFileSync(resolve(repo,'.local/sunbreak-river-publication.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }
}
