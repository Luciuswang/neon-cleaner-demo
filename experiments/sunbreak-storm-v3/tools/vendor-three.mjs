// Vendor the exact r160 dependency graph (including license), never "latest".
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=new Map(),visited=new Set();
async function obtain(path){
 if(visited.has(path))return;visited.add(path);
 const url='https://cdn.jsdelivr.net/npm/three@0.160.0/'+path,dest=resolve(root,'vendor/three',path);
 let text;try{text=await readFile(dest,'utf8')}catch{}
 if(!text){const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);text=await r.text();await mkdir(dirname(dest),{recursive:true});await writeFile(dest,text)}
 files.set(path,{url,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')});
 const imports=[...text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)].map(m=>m[1]);
 for(const i of imports){if(i.startsWith('.'))await obtain(posix.normalize(posix.join(posix.dirname(path),i)));else if(i==='three')await obtain('build/three.module.js')}
}
for(const name of ['world.js','storm.js','weapon.js','actors.js']){
 const text=await readFile(resolve(root,name),'utf8');
 for(const m of text.matchAll(/['"]three\/addons\/([^'"]+)['"]/g))await obtain('examples/jsm/'+m[1]);
}
// Reserve the standard model loader for the separately provenance-checked gun.
await obtain('examples/jsm/loaders/GLTFLoader.js');
await obtain('build/three.module.js');await obtain('LICENSE');
const decoderLicenseUrl='https://raw.githubusercontent.com/zeux/meshoptimizer/v0.18/LICENSE.md';
const decoderLicenseResponse=await fetch(decoderLicenseUrl);
if(!decoderLicenseResponse.ok)throw Error('Meshoptimizer license unavailable');
const decoderLicense=Buffer.from(await decoderLicenseResponse.arrayBuffer());
await writeFile(resolve(root,'vendor/meshoptimizer-LICENSE.md'),decoderLicense);
const thirdParty=[{path:'vendor/meshoptimizer-LICENSE.md',url:decoderLicenseUrl,license:'MIT',bytes:decoderLicense.length,sha256:createHash('sha256').update(decoderLicense).digest('hex')}];
// The baseline game imports untouched upstream core directly. Only the visual
// dependency graph uses this explicitly recorded isolated-random variant.
// Never temporarily replace global Math.random across async asset loading.
const variants=[];
for(const [path,source]of files){
 let text=await readFile(resolve(root,'vendor/three',path),'utf8');
 const count=(text.match(/Math\.random\(\)/g)||[]).length;
 if(count)text='// SUNBREAK presentation-only RNG isolation; upstream MIT license retained.\nlet presentationSeed=0x6a09e667;\nfunction presentationRandom(){presentationSeed=(Math.imul(presentationSeed,1664525)+1013904223)>>>0;return presentationSeed/4294967296;}\n'+text.replaceAll('Math.random()','presentationRandom()');
 if(path.endsWith('/SSAOPass.js'))text=text.replace('new SimplexNoise()','new SimplexNoise( { random: presentationRandom } )');
 text=text.replaceAll('window.__THREE__','window.__SUNBREAK_PRESENTATION_THREE__');
 const target=resolve(root,'vendor/presentation',path);await mkdir(dirname(target),{recursive:true});await writeFile(target,text);
 variants.push({path:'vendor/presentation/'+path,upstreamPath:'vendor/three/'+path,upstreamSha256:source.sha256,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex'),randomCallsIsolated:count});
}
await writeFile(resolve(root,'vendor/manifest.json'),JSON.stringify({package:'three',version:'0.160.0',license:'MIT',files:Object.fromEntries([...files].sort()),thirdParty,variants,variantNote:'Baseline imports exact upstream core. Presentation graph has module-local PRNG replacing Math.random() and separate devtools instance marker; no global RNG swap.'},null,2)+'\n');
console.log('Pinned local Three.js files:',files.size);
