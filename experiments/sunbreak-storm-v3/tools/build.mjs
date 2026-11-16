// Static-only package. Never include the parent UE project or private assets.
import {cp,mkdir,readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'dist');
await mkdir(out,{recursive:true});
const runtime=['index.html','world.js','weapon.js','actors.js','storm.js','audio.js','storm-audio.js','timber-house.js','house-logic.js','boot-ui.js','credits.html','assets-manifest.json','weapon-provenance.json','soldier-provenance.json'];
for(const path of [...runtime,'assets','vendor']){
 await cp(resolve(root,path),resolve(out,path),{recursive:true,filter:src=>!src.includes('assets\\evidence')&&!src.includes('assets/evidence')});
}
async function available(path){try{await stat(path);return true}catch{return false}}
const v1=await available(resolve(root,'../sunbreak-fable52/index.html'))?resolve(root,'../sunbreak-fable52'):resolve(root,'comparisons/original');
const v2=await available(resolve(root,'../sunbreak-realistic-v2/index.html'))?resolve(root,'../sunbreak-realistic-v2'):resolve(root,'comparisons/v2');
await mkdir(resolve(out,'original'),{recursive:true});
await cp(resolve(v1,'index.html'),resolve(out,'original/index.html'));
await mkdir(resolve(out,'v2'),{recursive:true});
for(const path of ['index.html','world.js','weapon.js','audio.js','assets-manifest.json','assets']){
 await cp(resolve(v2,path),resolve(out,'v2',path),{recursive:true,filter:src=>!src.includes('assets\\evidence')&&!src.includes('assets/evidence')});
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const name of runtime)if(hash(await readFile(resolve(root,name)))!==hash(await readFile(resolve(out,name))))throw Error('Build changed runtime bytes: '+name);
if(hash(await readFile(resolve(out,'original/index.html')))!=='4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85')throw Error('Original comparison mismatch');
console.log('PASS: exact-byte static runtime and separate v1/v2 comparisons in dist/');
