import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const base='https://raw.githubusercontent.com/cktang88/3d-fps/130ac2a5c856401ec36e7d35afcfefe40c5801f4/';
const folder=resolve(root,'assets/mp5');await mkdir(folder,{recursive:true});
const records=[];
for(const name of ['mp5a5.glb','arms_basecolor.webp','arms_normal.webp']){
 const url=base+'public/assets/models/fp/'+name,r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);
 const bytes=Buffer.from(await r.arrayBuffer()),sha256=createHash('sha256').update(bytes).digest('hex');
 if(name==='mp5a5.glb'&&sha256!=='90f223cbd44a75463a09b5cefaa594cbc8a61276ce31ba0b0734c8735701e1da')throw Error('Pinned model changed');
 await writeFile(resolve(folder,name),bytes);records.push({path:'assets/mp5/'+name,url,bytes:bytes.length,sha256});console.log(name,bytes.length,sha256);
}
const sources=[
 ['MP5 Submachine Gun','Rotuma','a73b61932a0e4eecb5db5c63c158aa24'],
 ['Fps arms','bumstrum / DJMaesen','9452ce4cddde4110a4fd73e555a8e412'],
 ['FPS AK-74m animations / rig contribution','ccransh','94be8385c402474cacd39bc096c6ca14']
];
for(const [title,author,id]of sources){
 const url='https://api.sketchfab.com/v3/models/'+id,r=await fetch(url);if(!r.ok)throw Error('Cannot verify author license: '+title);
 const data=await r.json();if(data.license?.slug!=='by'||!data.license.url.includes('/by/4.0'))throw Error('Unexpected source license: '+title);
 const evidence={verified:new Date().toISOString(),title:data.name,author:data.user?.displayName,license:data.license,source:data.viewerUrl,api:url,description:data.description};
 await writeFile(resolve(folder,id+'-license.json'),JSON.stringify(evidence,null,2)+'\n');
}
const glb=await readFile(resolve(folder,'mp5a5.glb')),json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)));
if(json.asset.version!=='2.0')throw Error('Not glTF 2');
const meta={schema:1,selection:'Rotuma MP5 with credited adapted gloved arm rig',license:'CC-BY-4.0',license_url:'https://creativecommons.org/licenses/by/4.0/',upstream_commit:'130ac2a5c856401ec36e7d35afcfefe40c5801f4',
 credits:sources.map(([title,author,id])=>({title,author,source:'https://sketchfab.com/3d-models/'+id})),
 adaptation_credit:'cktang88/3d-fps contributors: first-person rig assembly, posing, AO baking, optimization and texture encoding',
 files:records,extensions:json.extensionsRequired,original_units:'K=2 real metres, -Z forward / +Y up; source MuzzleSocket retained within imported model',
 changes:'SUNBREAK: display-only uniform fit and translation, storm material lighting; original parent, firing, damage, reload timing and gameplay anchors unchanged. No source animation or recoil code copied.',
 limits:'A detailed real-world-type game asset, not a photogrammetric firearm, not a claim of exact manufacturer dimensions; inherited recorded gun audio is AR-15/M4, not MP5.'};
await writeFile(resolve(root,'weapon-provenance.json'),JSON.stringify(meta,null,2)+'\n');
console.log(JSON.stringify(json.nodes.filter(n=>n.name==='FP_mp5a5'||n.name==='MuzzleSocket'||n.name?.includes('Magazine')||n.name?.includes('Charging')),null,2));
