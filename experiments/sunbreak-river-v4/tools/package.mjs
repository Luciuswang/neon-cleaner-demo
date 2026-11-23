import {cp,mkdir,mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..');
// Fresh output: an old build must not silently retain excluded local files.
const out=await mkdtemp(resolve(repo,'.local/sunbreak-river-build-'));
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:8e6}).trim(),hash=b=>createHash('sha256').update(b).digest('hex');
const runtime=['index.html','world.js','village.js','ruins.js','fracture-geometry.js','buffer-house.js','buffer-house-logic.js','timber-house.js','house-logic.js','vegetation.js','map-layout.js','terrain-ray.js','weapon.js','actors.js','audio.js','storm-audio.js','tactical-ai.js','boot-ui.js','combat-controls.js','reload-pose.js','credits.html','asset-sources.json','foliage-derivatives.json','foliage-revision.json','fable-production.json','fable-art-revision.json','weapon-provenance.json','soldier-provenance.json'];
runtime.push('distant-landscape.js','riverbank-detail.js','river-water.js','ground-moisture.js','daylight-assets.json','afterrain-assets.json','wild-grass-assets.json');
runtime.push('ground-surface.js','ground-surface-assets.json','height-fog.js','masonry-materials.js');
runtime.push('aim-assist.js');
runtime.push('squads-sim.js','squads-net.js','squads-view.js','peer-runtime.js','peer-notice.html'); // Opt-in ?mode=squads only; peer-notice.html carries the PeerJS MIT credit.
runtime.push('downloaded-dressing.js'); // Local preview loader; no scan binaries/manifests in public output.
runtime.push('environment-polish.js','stone-cover.js','combat-feedback.js','shot-feedback-event.js');
runtime.push('procedural-materials.js','procedural-ground.js','afterrain-ground.js','afterrain-light.js','forest-floor.js','puddle-reflection.js','fieldstone-surface.js','scan-cover.js','PROCEDURAL-NOTICE.txt');
const sharedRelease=JSON.parse(git(['show','origin/main:sunbreak/public-release.json']));
const sharedFiles=sharedRelease.files.filter(f=>/^(assets\/|vendor\/|assets-manifest\.json$|weapon-provenance\.json$|soldier-provenance\.json$|credits\.html$)/.test(f.path));
for(const f of sharedFiles)assert.equal(hash(await readFile(resolve(root,'../sunbreak-storm-v3',f.path))),f.sha256,'Shared dependency changed '+f.path);
async function walk(dir){for(const d of await readdir(resolve(root,dir),{withFileTypes:true})){const path=dir+'/'+d.name;if(d.isDirectory())await walk(path);else runtime.push(path)}}
await walk('assets');
// Full original tree is source-only; public game uses two simplified GLBs.
const foliage=JSON.parse(await readFile(resolve(root,'foliage-revision.json')));
const afterrain=JSON.parse(await readFile(resolve(root,'afterrain-assets.json'))),daylight=JSON.parse(await readFile(resolve(root,'daylight-assets.json')));
const wild=JSON.parse(await readFile(resolve(root,'wild-grass-assets.json')));
const ground=JSON.parse(await readFile(resolve(root,'ground-surface-assets.json')));
const included=runtime.filter(p=>(!p.startsWith('assets/island_tree_02/')||/\/(tree-lod\.glb|tree-far\.glb|alpha\.png)$/.test(p))&&(!p.startsWith('assets/foliage-revision/')||foliage.publicWhitelist.includes(p))&&(!p.startsWith('assets/afterrain-detail/')||afterrain.publicWhitelist.includes(p))&&(!p.startsWith('assets/wild-grass/')||wild.publicWhitelist.includes(p))&&(!p.startsWith('assets/ground-surfaces/')||ground.publicWhitelist.includes(p)));
for(const f of ground.files){const b=await readFile(resolve(root,f.file));assert.equal(hash(b),f.sha256,'Ground manifest stale');assert.equal(b.length,f.bytes)}
for(const f of wild.files){const b=await readFile(resolve(root,f.file||f.path));assert.equal(hash(b),f.sha256,'Wild grass manifest stale');assert.equal(b.length,f.bytes)}
for(const f of [...afterrain.assets.flatMap(a=>a.files),...daylight.files])assert.equal(hash(await readFile(resolve(root,f.file||f.path))),f.sha256,'Afterrain manifest stale '+(f.file||f.path));
for(const f of foliage.derivatives)assert.equal(hash(await readFile(resolve(root,f.file))),f.sha256,'Foliage manifest stale '+f.file);
const files=[];
for(const path of included){const b=await readFile(resolve(root,path));await mkdir(dirname(resolve(out,path)),{recursive:true});await cp(resolve(root,path),resolve(out,path));assert.equal(hash(await readFile(resolve(out,path))),hash(b));files.push({path,bytes:b.length,sha256:hash(b)})}
const emitted=new Set(files.map(f=>f.path)),sharedNames=new Set(sharedFiles.map(f=>f.path)),importClosure=[];
for(const f of files.filter(f=>/\.(js|html)$/.test(f.path))){
 const text=await readFile(resolve(out,f.path),'utf8');
 for(const match of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)){
  const spec=match[1],html=f.path.endsWith('.html');
  const target=html?spec.replace(/^\.\//,''):posix.normalize(posix.join(posix.dirname(f.path),spec));
  const local=html?target.startsWith('river/'):!target.startsWith('../');
  const key=html&&local?target.slice(6):!html&&!local?target.slice(3):target;
  assert.ok((local?emitted:sharedNames).has(key),'Unpackaged runtime import '+f.path+' -> '+spec);importClosure.push({from:f.path,spec,target:key,shared:!local});
 }
}
const release={schema:'sunbreak-river-overlay-v1',sourceCommit:git(['rev-parse','HEAD']),created:new Date().toISOString(),publicPath:'sunbreak/river/',files,sharedReleaseSource:sharedRelease.sourceCommit,sharedFiles,scope:'Separate single-player river map, retained v4 weapon/NPC animation; previous four pages unchanged. Opt-in ?mode=squads adds an unranked friendly 4v4 prototype (browser-host WebRTC via PeerJS, host-labeled AI fill); solo loads no network code. No ranked play or AAA certification.'};
await writeFile(resolve(out,'public-release.json'),JSON.stringify(release,null,2)+'\n');
let privateAssets=[];try{privateAssets=JSON.parse(await readFile(resolve(repo,'.local/river-downloaded-assets/manifest.json'),'utf8')).assets}catch(e){if(e.code!=='ENOENT')throw e}
for(const f of files){
 assert.ok(!privateAssets.some(a=>f.sha256===a.sha256||f.path.split('/').at(-1)===a.file),'Private imported model leaked into public build');
 assert.ok(!/local-assets|local-only|downloaded-private-backup|manifest\.json$/.test(f.path)||f.path==='assets-manifest.json','Local metadata leaked into public build');
}
async function actualTree(dir,prefix=''){const result=[];for(const d of await readdir(dir,{withFileTypes:true})){const name=prefix+d.name;if(d.isDirectory())result.push(...await actualTree(resolve(dir,d.name),name+'/'));else result.push(name)}return result}
assert.deepEqual((await actualTree(out)).sort(),[...files.map(f=>f.path),'public-release.json'].sort(),'Unexpected package residue');
const receipt={schema:'river-public-package-exclusion-v1',pass:true,builderSHA256:hash(await readFile(fileURLToPath(import.meta.url))),releaseSHA256:hash(await readFile(resolve(out,'public-release.json'))),files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),sharedDependenciesVerified:sharedFiles.length,privateGLBsChecked:privateAssets.length,privateManifestSHA256:hash(await readFile(resolve(repo,'.local/river-downloaded-assets/manifest.json'))),privateBinariesIncluded:false,publiclyDeployed:false,packageFiles:files,importClosure,checks:['fresh output directory','all emitted file bytes match source','no imported model filename or content hash','no local metadata manifest','exact recursive output whitelist','shared public dependency hashes unchanged','relative JS and HTML runtime import closure']};
const reportName=process.argv.find(a=>a.startsWith('--report='))?.slice(9)||'downloaded-package.json';
assert.match(reportName,/^[a-z0-9-]+\.json$/,'Unsafe package receipt filename');
// --local-report: postcommit exact-HEAD build keeps the tree clean; receipt goes to a fresh .local sibling of the build, never inside the bundle.
const reportDir=process.argv.includes('--local-report')?await mkdtemp(resolve(repo,'.local/sunbreak-river-report-')):resolve(root,'qa');
const reportPath=resolve(reportDir,reportName);
assert.ok(!reportPath.startsWith(out),'Package receipt must stay outside the bundle');
await writeFile(reportPath,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({out,report:reportPath,files:receipt.files,bytes:receipt.bytes,privateAssetsExcluded:privateAssets.length,sharedVerified:sharedFiles.length}));
