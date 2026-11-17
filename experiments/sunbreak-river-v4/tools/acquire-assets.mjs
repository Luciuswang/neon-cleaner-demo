import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),files=[],assets=[];
const digest=(b,kind)=>createHash(kind).update(b).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(url+' HTTP '+r.status);return Buffer.from(await r.arrayBuffer())}
async function save(path,entry){
 let b;try{b=await readFile(resolve(root,path));if(digest(b,'md5')!==entry.md5)b=null}catch{}
 if(!b){b=await get(entry.url);if(b.length!==entry.size||digest(b,'md5')!==entry.md5)throw Error('Download checksum '+path);await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),b)}
 files.push({path,url:entry.url,bytes:b.length,sha256:digest(b,'sha256'),officialMD5:entry.md5});
}
for(const [id,kind] of [['brown_mud_02','surface'],['rocky_gravel','surface'],['brick_moss_001','surface'],['fern_02','model'],['grass_bermuda_01','model'],['island_tree_02','model']]){
 const api=JSON.parse(await get('https://api.polyhaven.com/files/'+id));
 const base='assets/'+id,entry={id,kind,source:'https://polyhaven.com/a/'+id,license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',files:[]};
 if(kind==='surface'){
  for(const [name,key,format,res] of [['color','Diffuse','jpg','2k'],['normal','nor_gl','jpg','2k'],['roughness','Rough','jpg','2k']]){
   const f=api[key][res][format],path=base+'/'+name+'.'+format;await save(path,f);entry.files.push({role:name,path:'./river/'+path});
  }
 }else{
  const f=api.gltf['1k'].gltf;await save(base+'/'+id+'.gltf',f);entry.path='./river/'+base+'/'+id+'.gltf';
  for(const [rel,part]of Object.entries(f.include))await save(base+'/'+rel,part);
  const alpha=api[id==='island_tree_02'?'leaves_alpha':'Alpha']?.['1k']?.png;
  if(alpha){await save(base+'/alpha.png',alpha);entry.alphaPath='./river/'+base+'/alpha.png'}
 }
 assets.push(entry);console.log('Verified '+id);
}
const manifest={date:new Date().toISOString(),provider:'Poly Haven',license:'CC0-1.0',assets,files,totalBytes:files.reduce((n,f)=>n+f.bytes,0)};
await writeFile(resolve(root,'asset-sources.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({files:files.length,bytes:manifest.totalBytes}));
