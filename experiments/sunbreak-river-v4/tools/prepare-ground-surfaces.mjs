import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=(b,type='sha256')=>createHash(type).update(b).digest('hex');
const manifest={schema:'river-surface-assets-v1',license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',assets:[],files:[],publicWhitelist:[]};
async function download(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer())}
for(const id of ['dirt','forest_ground_04']){
 const path=`assets/ground-surfaces/${id}`,dir=resolve(root,path);await mkdir(dir,{recursive:true});
 const raw=await download(`https://api.polyhaven.com/files/${id}`),official=JSON.parse(raw);
 const record={id,source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0',files:[]};
 const metadata=path+'/official-files.json';await writeFile(resolve(root,metadata),raw);
 manifest.files.push({file:metadata,bytes:raw.length,sha256:hash(raw)});
 for(const [key,role]of [['Diffuse','color'],['nor_gl','normal'],['Rough','roughness']]){
  const f=official[key]['1k'].jpg,file=`${path}/${role}.jpg`;let bytes;
  try{bytes=await readFile(resolve(root,file))}catch{}
  if(!bytes||hash(bytes,'md5')!==f.md5){bytes=await download(f.url);assert.equal(hash(bytes,'md5'),f.md5);await writeFile(resolve(root,file),bytes)}
  assert.equal(bytes.length,f.size);const entry={file,role,url:f.url,officialMD5:f.md5,sha256:hash(bytes),bytes:bytes.length};
  record.files.push(entry);manifest.files.push(entry);manifest.publicWhitelist.push(file);
 }
 manifest.assets.push(record);
}
manifest.preparation={script:'tools/prepare-ground-surfaces.mjs',sha256:hash(await readFile(fileURLToPath(import.meta.url)))};
await writeFile(resolve(root,'ground-surface-assets.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({assets:manifest.assets.length,files:manifest.files.length,publicBytes:manifest.files.filter(f=>manifest.publicWhitelist.includes(f.file)).reduce((n,f)=>n+f.bytes,0)}));
