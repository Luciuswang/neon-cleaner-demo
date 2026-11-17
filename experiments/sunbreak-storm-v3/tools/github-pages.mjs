// Publish only the explicitly selected public browser build under existing
// main:/sunbreak/. Never change the existing site/root, credentials or UE files.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync,lstatSync,mkdirSync,mkdtempSync,copyFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative,dirname,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../../../',import.meta.url)),game=fileURLToPath(new URL('../',import.meta.url));
const endpoint='https://api.github.com/repos/Luciuswang/neon-cleaner-demo';
const git=(args,cwd=repo)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:8e6,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
assert.equal(git(['remote','get-url','origin']).trim(),'https://github.com/Luciuswang/neon-cleaner-demo.git');
const raw=execFileSync('git',['credential','fill'],{cwd:repo,input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
const credential=Object.fromEntries(raw.trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)]}));
assert.ok(credential.password,'Existing GitHub credential required; never record it.');
async function api(path){
 const r=await fetch(endpoint+path,{headers:{Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 const j=await r.json();if(!r.ok)throw Error(`GitHub ${path}: HTTP ${r.status}, ${j.message||'request failed'}`);
 return j;
}
const pages=await api('/pages');
if(!process.argv.includes('--publish')){
 const builds=await api('/pages/builds?per_page=1');
 console.log(JSON.stringify({url:pages.html_url,status:pages.status,source:pages.source,build_type:pages.build_type,latest:builds.map(b=>({status:b.status,commit:b.commit,error:b.error,updated_at:b.updated_at}))},null,2));
}else{
 assert.equal(pages.build_type,'legacy');assert.equal(pages.source.branch,'main');assert.equal(pages.source.path,'/');
 assert.equal(git(['status','--porcelain']).trim(),'','Commit the validated source before public publishing.');
 const sourceCommit=git(['rev-parse','HEAD']).trim(),out=resolve(game,'dist');
 const required=['index.html','world.js','actors.js','weapon.js','storm.js','storm-audio.js','audio.js','timber-house.js','house-asset.js','house-logic.js','tactical-ai.js','boot-ui.js','credits.html','assets-manifest.json','weapon-provenance.json','soldier-provenance.json'];
 const allowedRoot=new Set([...required,'assets','vendor','original','v2']);
 const digest=b=>createHash('sha256').update(b).digest('hex');
 const files=[];
 function walk(dir){
  for(const name of readdirSync(dir)){
   const absolute=resolve(dir,name),rel=relative(out,absolute).split(sep).join('/'),s=lstatSync(absolute);
   assert.ok(!s.isSymbolicLink(),'Do not publish symlinks');
   assert.ok(!name.startsWith('.')&&!['qa','evidence','node_modules'].includes(name),'Unapproved output path '+rel);
   assert.ok(allowedRoot.has(rel.split('/')[0]),'Unapproved root '+rel);
   if(s.isDirectory())walk(absolute);
   else{
    assert.ok(['.html','.js','.json','.png','.jpg','.webp','.hdr','.wav','.glb','.gltf','.bin','.txt','.md'].includes(extname(name))||rel==='assets/house/timber-house-art-kit.zip'||name==='LICENSE','Unapproved output type '+rel);
    const bytes=readFileSync(absolute);
    assert.ok(!bytes.subarray(0,80).toString().startsWith('version https://git-lfs.github.com/spec'),'Unresolved LFS pointer '+rel);
    if(['.js','.html','.json','.txt','.md'].includes(extname(name))){
     assert.ok(!/(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/.test(bytes.toString()),'Credential-like content: '+rel);
    }
    files.push({path:rel,bytes:s.size,sha256:digest(bytes)});
   }
  }
 }
 walk(out);assert.ok(files.reduce((n,f)=>n+f.bytes,0)<900e6,'Static site size budget exceeded');
 for(const path of required)assert.equal(digest(readFileSync(resolve(game,path))),files.find(f=>f.path===path)?.sha256,'Stale build '+path);
 for(const f of files.filter(f=>f.path.startsWith('assets/')||f.path.startsWith('vendor/'))){
  assert.ok(existsSync(resolve(game,f.path)),'Stale/untracked public asset '+f.path);
  assert.equal(digest(readFileSync(resolve(game,f.path))),f.sha256,'Stale public asset '+f.path);
 }
 assert.equal(digest(readFileSync(resolve(out,'original/index.html'))),'4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85');
 git(['fetch','origin','+refs/heads/main:refs/remotes/origin/main']);
 const localRoot=resolve(repo,'.local');mkdirSync(localRoot,{recursive:true});
 const staging=mkdtempSync(resolve(localRoot,'pages-release-'));
 // Git worktree requires an absent target, so use a child of the reserved dir.
 const checkout=resolve(staging,'checkout');
 git(['worktree','add','--detach',checkout,'origin/main']);
 const destination=resolve(checkout,'sunbreak');
 if(existsSync(destination))assert.ok(existsSync(resolve(destination,'public-release.json')),'Existing unrelated sunbreak content must not be overwritten.');
 for(const f of files){
  const target=resolve(destination,f.path);assert.ok(target.startsWith(destination+sep));
  mkdirSync(dirname(target),{recursive:true});copyFileSync(resolve(out,f.path),target);
 }
 const release={schema:'sunbreak-public-static-v1',created:new Date().toISOString(),sourceCommit,
  publicPath:'sunbreak/',scope:'Public browser assets and v1/v2 comparisons only; no private/UE sources or server diagnostics.',
  navigationAdaptation:'v2 comparison href only is ../original/ for nested hosting; original v2 source/game module preserved.',
  files};
 writeFileSync(resolve(destination,'public-release.json'),JSON.stringify(release,null,2)+'\n');
 git(['add','--','sunbreak'],checkout);
 const staged=git(['diff','--cached','--name-only'],checkout).trim().split('\n').filter(Boolean);
 assert.ok(staged.length>0&&staged.every(p=>p.startsWith('sunbreak/')),'Publish scope escaped sunbreak/');
 // Validate actual staged Git objects, not just worktree bytes: inherited
 // attribute filters must never replace playable binaries with LFS pointers.
 for(const f of files){
  const blob=execFileSync('git',['show',':sunbreak/'+f.path],{cwd:checkout,maxBuffer:128e6});
  assert.equal(digest(blob),f.sha256,'Staged publication bytes differ: '+f.path);
 }
 const publishedPaths=git(['ls-files','--','sunbreak'],checkout).trim().split('\n');
 assert.deepEqual(publishedPaths.sort(),[...files.map(f=>'sunbreak/'+f.path),'sunbreak/public-release.json'].sort(),'Unexpected stale/public paths');
 // Preserved upstream license snapshots and pinned vendor libraries retain
 // whitespace. Their exact staged hashes were checked above; do not rewrite
 // provenance bytes merely to make the authored-code formatting check pass.
 const preservedArchives=[
  'sunbreak/assets/audio/provenance/firearm-source.html.txt',
  'sunbreak/assets/audio/provenance/reload-source.html.txt',
  'sunbreak/v2/assets/audio/provenance/firearm-source.html.txt',
  'sunbreak/v2/assets/audio/provenance/reload-source.html.txt',
  ...['presentation','three'].flatMap(tree=>[
   'sunbreak/vendor/'+tree+'/build/three.module.js',
   'sunbreak/vendor/'+tree+'/examples/jsm/shaders/OutputShader.js',
   'sunbreak/vendor/'+tree+'/examples/jsm/shaders/SSAOShader.js'
  ])
 ];
 git(['diff','--cached','--check','--','sunbreak',...preservedArchives.map(p=>':(exclude)'+p)],checkout);
 git(['commit','-m',`publish: SUNBREAK tactical demo from ${sourceCommit.slice(0,12)}`],checkout);
 const publicCommit=git(['rev-parse','HEAD'],checkout).trim();
 const prepared={sourceCommit,preparedCommit:publicCommit,checkout,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),liveVerified:false};
 writeFileSync(resolve(localRoot,'sunbreak-prepared.json'),JSON.stringify(prepared,null,2)+'\n');
 // main requires a PR. Follow that protection; never change rules or bypass it.
 const prTool=fileURLToPath(new URL('./pages-pr.mjs',import.meta.url));
 console.log(execFileSync(process.execPath,[prTool,'--submit','--checkout='+checkout],{cwd:repo,encoding:'utf8',maxBuffer:8e6}));
 console.log('Prepared PR only. Review normal mergeability/checks via pages-pr.mjs --pr=N; merge separately, then verify Pages live.');
}
