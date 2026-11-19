// Loopback-only development assets, deliberately outside the public tree.
import {readFile,realpath} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const localAssetRoot=fileURLToPath(new URL('../../.local/river-downloaded-assets/',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const safeName=n=>typeof n==='string'&&/^[a-z0-9][a-z0-9_-]*\.glb$/.test(n);
export function validateLocalGLB(data){
 if(data.length<28||data.readUInt32LE(0)!==0x46546c67||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length||data.readUInt32LE(16)!==0x4e4f534a)throw Error('Invalid GLB header');
 const end=20+data.readUInt32LE(12);if(end>data.length)throw Error('Invalid GLB JSON size');
 const gltf=JSON.parse(data.subarray(20,end).toString().trim());
 if(gltf.asset?.version!=='2.0'||(gltf.buffers||[]).some(b=>b.uri)||(gltf.images||[]).some(i=>i.uri))throw Error('Local GLB must be self-contained');
 return gltf;
}
export async function localAssetSnapshot(root=localAssetRoot){
 let bytes;try{bytes=await readFile(resolve(root,'manifest.json'))}catch(e){if(e.code==='ENOENT')return{manifest:{schema:1,enabled:false,assets:[]},hashes:{}};throw e}
 const source=JSON.parse(bytes.toString());
 if(source.schema===1&&source.enabled===false)return{manifest:{schema:1,enabled:false,assets:[]},hashes:{'local-only/disabled-manifest.json':sha(bytes)}};
 if(source.schema!==1||source.enabled!==true||!Array.isArray(source.assets)||source.assets.length>24)throw Error('Invalid local asset manifest');
 const canonical=await realpath(root),assets=[],hashes={'local-only/manifest.json':sha(bytes)},seen=new Set(),ids=new Set(),families=new Set();let total=0;
 for(const a of source.assets){
  if(!safeName(a.file)||typeof a.id!=='string'||ids.has(a.id)||seen.has(a.file)||!['grass','rubble','wall','tree','house'].includes(a.kind)||!Array.isArray(a.dimensions)||a.dimensions.length!==3||!a.dimensions.every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(a.triangles)||a.triangles<1)throw Error('Invalid local asset entry');
  seen.add(a.file);ids.add(a.id);families.add(a.source?.assetId||a.source?.archive||a.id);if(families.size>8)throw Error('Too many imported asset families');const file=await realpath(resolve(root,a.file));
  if(!file.startsWith(canonical+sep))throw Error('Local asset outside approved directory');
  const data=await readFile(file),hash=sha(data);total+=data.length;
  if(hash!==a.sha256||data.length!==a.bytes||data.readUInt32LE(0)!==0x46546c67||total>25000000)throw Error('Local asset identity/budget mismatch: '+a.id);
  validateLocalGLB(data);
  hashes['local-only/'+a.file]=hash;
  assets.push({id:a.id,file:a.file,url:'./river/local-assets/'+a.file,sha256:hash,bytes:data.length,dimensions:a.dimensions,triangles:a.triangles,kind:a.kind||a.id,license:'local preview only; public redistribution not verified'});
 }
 const manifest={schema:1,enabled:true,assets,bytes:total,sourceManifestSHA256:sha(bytes)};
 hashes['local-only/served-manifest.json']=sha(Buffer.from(JSON.stringify(manifest)));
 return{manifest,hashes};
}
export async function readLocalAsset(name,root=localAssetRoot){
 const snapshot=await localAssetSnapshot(root);
 if(name==='manifest.json')return Buffer.from(JSON.stringify(snapshot.manifest));
 if(!safeName(name)||!snapshot.manifest.assets.some(a=>a.file===name))return null;
 const bytes=await readFile(resolve(root,name));
 // Recheck after the manifest read to fail closed on a concurrent replacement.
 if(sha(bytes)!==snapshot.hashes['local-only/'+name])throw Error('Local asset changed during request');
 return bytes;
}
