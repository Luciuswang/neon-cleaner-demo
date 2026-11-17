import {cp,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..'),out=resolve(repo,'.local/sunbreak-river-build');
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:8e6}).trim(),hash=b=>createHash('sha256').update(b).digest('hex');
const runtime=['index.html','world.js','village.js','vegetation.js','map-layout.js','terrain-ray.js','weapon.js','actors.js','audio.js','storm-audio.js','tactical-ai.js','boot-ui.js','combat-controls.js','reload-pose.js','credits.html','asset-sources.json','foliage-derivatives.json','fable-production.json','weapon-provenance.json','soldier-provenance.json'];
const sharedRelease=JSON.parse(git(['show','origin/main:sunbreak/public-release.json']));
const sharedFiles=sharedRelease.files.filter(f=>/^(assets\/|vendor\/|assets-manifest\.json$|weapon-provenance\.json$|soldier-provenance\.json$|credits\.html$)/.test(f.path));
for(const f of sharedFiles)assert.equal(hash(await readFile(resolve(root,'../sunbreak-storm-v3',f.path))),f.sha256,'Shared dependency changed '+f.path);
async function walk(dir){for(const d of await readdir(resolve(root,dir),{withFileTypes:true})){const path=dir+'/'+d.name;if(d.isDirectory())await walk(path);else runtime.push(path)}}
await walk('assets');
// Full original tree is source-only; public game uses two simplified GLBs.
const included=runtime.filter(p=>!p.startsWith('assets/island_tree_02/')||/\/(tree-lod\.glb|tree-far\.glb|alpha\.png)$/.test(p));
const files=[];
for(const path of included){const b=await readFile(resolve(root,path));await mkdir(dirname(resolve(out,path)),{recursive:true});await cp(resolve(root,path),resolve(out,path));assert.equal(hash(await readFile(resolve(out,path))),hash(b));files.push({path,bytes:b.length,sha256:hash(b)})}
const release={schema:'sunbreak-river-overlay-v1',sourceCommit:git(['rev-parse','HEAD']),created:new Date().toISOString(),publicPath:'sunbreak/river/',files,sharedReleaseSource:sharedRelease.sourceCommit,sharedFiles,scope:'Separate single-player river map, retained v4 weapon/NPC animation; previous four pages unchanged. No multiplayer or AAA certification.'};
await writeFile(resolve(out,'public-release.json'),JSON.stringify(release,null,2)+'\n');console.log(JSON.stringify({out,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
