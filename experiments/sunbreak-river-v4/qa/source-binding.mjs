// Bind evidence to real runtime bytes, including both new and shared assets.
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function runtimeHashes(){
 const names=new Set((await readdir(root)).filter(n=>/\.(js|html|json)$/.test(n)));
 for(const p of ['serve.mjs','qa/hooks.js','qa/browser.mjs','qa/source-binding.mjs'])names.add(p);
 const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'));
 const foliage=await read('foliage-revision.json');for(const f of foliage.derivatives)names.add(f.file);
 const local=await read('asset-sources.json');for(const a of local.assets.filter(a=>a.kind==='surface'))for(const f of a.files)names.add(f.path.replace('./river/',''));
 for(const manifest of ['daylight-assets.json','afterrain-assets.json','wild-grass-assets.json','ground-surface-assets.json']){
  let m;try{m=await read(manifest)}catch(e){if(e.code==='ENOENT')continue;throw e}
  for(const f of m.files||[])names.add(f.file||f.path);
  for(const a of m.assets||[])for(const f of a.files||[])names.add(f.file||f.path);
 }
 const shared='../sunbreak-storm-v3/';
 const sm=await read(shared+'assets-manifest.json');names.add(shared+'assets-manifest.json');
 for(const a of sm.assets)for(const f of a.files||[])if(/\.(jpg|png|hdr)$/.test(f.path))names.add(shared+f.path.replace(/^\.\//,''));
 for(const p of ['assets/mp5/mp5a5.glb','assets/soldier/soldier_tac.glb','vendor/presentation/build/three.module.js'])names.add(shared+p);
 async function addTree(path){for(const d of await readdir(resolve(root,path),{withFileTypes:true})){const p=path+'/'+d.name;if(d.isDirectory())await addTree(p);else names.add(p)}}
 await addTree(shared+'vendor/presentation');await addTree(shared+'vendor/three');await addTree(shared+'assets/audio');
 const out={};for(const n of [...names].sort())out[n]=createHash('sha256').update(await readFile(resolve(root,n))).digest('hex');return out;
}
