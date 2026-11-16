// Reproducible official-source acquisition; no credentials, no third-party models.
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {resolve, dirname, basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return Buffer.from(await r.arrayBuffer())}
const records=[];
for(const selection of [
 {id:'asphalt_02',maps:[['Diffuse','2k','jpg','base_color'],['nor_gl','2k','png','normal_opengl'],['Rough','2k','jpg','roughness']],role:'ground_worn_concrete',type:'texture'},
 {id:'kloofendal_overcast_puresky',maps:[['hdri','2k','hdr','environment']],role:'storm_environment',type:'hdri'},
 {id:'approaching_storm',maps:[['hdri','2k','hdr','environment']],role:'storm_environment',type:'hdri'}
]){
 const api='https://api.polyhaven.com/files/'+selection.id;
 const files=JSON.parse((await get(api)).toString()),items=[];
 for(const [channel,size,format,role]of selection.maps){
  const file=files[channel]?.[size]?.[format];if(!file?.url)throw Error('Official file missing: '+channel);
  const path='assets/'+selection.id+'/'+basename(new URL(file.url).pathname);
  let data;try{data=await readFile(resolve(root,path))}catch{}
  if(!data||data.length!==file.size||createHash('md5').update(data).digest('hex')!==file.md5)data=await get(file.url);
  if(data.length!==file.size||createHash('md5').update(data).digest('hex')!==file.md5)throw Error('Integrity mismatch '+path);
  await mkdir(dirname(resolve(root,path)),{recursive:true});await writeFile(resolve(root,path),data);
  items.push({role,path,url:file.url,bytes:data.length,sha256:sha(data),md5:file.md5});
  console.log('verified',path,data.length);
 }
 records.push({id:selection.id,type:selection.type,semantic_role:selection.role,source:'https://polyhaven.com/a/'+selection.id,files_api:api,license:'CC0-1.0',files:items});
}
const manifest=JSON.parse(await readFile(resolve(root,'assets-manifest.json'),'utf8'));
manifest.project='SUNBREAK STORM / v3';manifest.path_base='experiments/sunbreak-storm-v3/';
manifest.v3_acquisition={date:new Date().toISOString(),license:'https://polyhaven.com/license',assets:records};
// Keep the complete inherited acquisition/provenance; select new ground and HDR last.
manifest.assets=manifest.assets.filter(a=>!records.some(b=>a.id===b.id)).concat(records);
await writeFile(resolve(root,'assets-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
