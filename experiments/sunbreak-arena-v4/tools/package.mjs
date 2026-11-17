// Small fourth-page overlay; do not duplicate or modify the first three demos.
import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const runtime=['index.html','world.js','weapon.js','actors.js','audio.js','storm.js','storm-audio.js','timber-house.js','house-asset.js','house-logic.js','tactical-ai.js','boot-ui.js','combat-controls.js','reload-pose.js','credits.html','assets-manifest.json','weapon-provenance.json','soldier-provenance.json'];
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..'),out=resolve(repo,'.local/sunbreak-v4-build');
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:8e6}).trim();
const hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const sharedRelease=JSON.parse(git(['show','origin/main:sunbreak/public-release.json']));
const sharedFiles=sharedRelease.files.filter(f=>/^(assets\/|vendor\/|assets-manifest\.json$|weapon-provenance\.json$|soldier-provenance\.json$|credits\.html$)/.test(f.path));
// Shared bytes must match the already published source, not an untracked cache.
for(const f of sharedFiles)assert.equal(hash(await readFile(resolve(root,'../sunbreak-storm-v3',f.path))),f.sha256,'Shared dependency changed '+f.path);
const files=[];
for(const path of runtime){
 const bytes=await readFile(resolve(root,path));await cp(resolve(root,path),resolve(out,path));
 assert.equal(hash(await readFile(resolve(out,path))),hash(bytes));
 files.push({path,bytes:bytes.length,sha256:hash(bytes)});
}
const release={schema:'sunbreak-auto-overlay-v1',sourceCommit:git(['rev-parse','HEAD']),created:new Date().toISOString(),
 publicPath:'sunbreak/v4/',files,sharedReleaseSource:sharedRelease.sourceCommit,sharedFiles,
 scope:'Single-player automatic-fire/reload fourth page only. Earlier three pages and shared assets remain unchanged. No 4v4 server or local QA hooks.'};
await writeFile(resolve(out,'public-release.json'),JSON.stringify(release,null,2)+'\n');
console.log(JSON.stringify({output:out,files:files.length,sharedFiles:sharedFiles.length,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
