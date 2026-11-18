// Owns only assets/afterrain-detail/** and afterrain-assets.json. No reports,
// shared asset edits or runtime/render processes. Originals stay private to QA.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url)),base=resolve(root,'assets/afterrain-detail');
const require=createRequire(import.meta.url);let sharp;
try{sharp=require('sharp')}catch{sharp=require('C:/Users/baomin.wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')}
const hash=(b,kind='sha256')=>createHash(kind).update(b).digest('hex');
async function save(path,bytes){await mkdir(dirname(path),{recursive:true});const temp=path+'.pending-'+process.pid;await writeFile(temp,bytes);await rename(temp,path)}
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw Error(`${url}: ${response.status}`);return Buffer.from(await response.arrayBuffer())}
if(process.argv.includes('--build')){
 const manifest={schema:'river-afterrain-detail-v1',task:'sunbreak-river-afterrain-2026-11-18',date:new Date().toISOString(),license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',assets:[],publicWhitelist:[],dependencies:[],notes:['Scanned surface textures, not scanned individual rock meshes. Dimensional stones are bounded procedural geometry.','Original official files are preserved and verified against API MD5/size; public JPEG derivatives have independent SHA256.','No source/ originals or API snapshots in the public whitelist. No generated QA reports.']};
 for(const id of ['ganges_river_pebbles','dry_riverbed_rock']){
  const apiBytes=await get(`https://api.polyhaven.com/files/${id}`),infoBytes=await get(`https://api.polyhaven.com/info/${id}`),api=JSON.parse(apiBytes),info=JSON.parse(infoBytes);
  await save(resolve(base,'source',id,'official-files.json'),apiBytes);await save(resolve(base,'source',id,'official-info.json'),infoBytes);
  const entry={id,source:`https://polyhaven.com/a/${id}`,api:`https://api.polyhaven.com/files/${id}`,license:'CC0-1.0',licenseURL:manifest.licenseURL,authors:info.authors,officialDimensions:info.dimensions,tileMeters:id==='ganges_river_pebbles'?2.16:2,sourceFiles:[],files:[]};
  const specs=[['color','Diffuse','2k',88],['normal','nor_gl','2k',92],['arm','arm','1k',90]];
  const results=await Promise.all(specs.map(async([role,key,res,quality])=>{
   const official=api[key][res].jpg,sourcePath=`assets/afterrain-detail/source/${id}/${role}-${res}.jpg`;let bytes;
   try{bytes=await readFile(resolve(root,sourcePath))}catch{}
   if(!bytes||bytes.length!==official.size||hash(bytes,'md5')!==official.md5)bytes=await get(official.url);
   assert.equal(bytes.length,official.size);assert.equal(hash(bytes,'md5'),official.md5);await save(resolve(root,sourcePath),bytes);
   const original={path:sourcePath,url:official.url,bytes:bytes.length,officialMD5:official.md5,sha256:hash(bytes)};
   const output=await sharp(bytes).jpeg({quality,chromaSubsampling:role==='normal'?'4:4:4':'4:2:0'}).toBuffer(),meta=await sharp(output).metadata(),path=`assets/afterrain-detail/${id}/${role}.jpg`;
   await save(resolve(root,path),output);
   return{original,derived:{role,path,bytes:output.length,sha256:hash(output),width:meta.width,height:meta.height,sourceSHA256:original.sha256,processing:`JPEG quality ${quality}; ${role==='normal'?'OpenGL normal, 4:4:4':'4:2:0'}; no invented detail`}};
  }));
  for(const r of results){entry.sourceFiles.push(r.original);entry.files.push(r.derived);manifest.publicWhitelist.push(r.derived.path)}manifest.assets.push(entry);
  console.log('Verified and prepared',id,entry.files.reduce((n,f)=>n+f.bytes,0),'public bytes');
 }
 const foliage=JSON.parse(await readFile(resolve(root,'foliage-revision.json'),'utf8')),grass=foliage.derivatives.find(d=>d.file.endsWith('/grass_bermuda_01.glb'));
 assert.ok(grass);const grassBytes=await readFile(resolve(root,grass.file));assert.equal(hash(grassBytes),grass.sha256);assert.equal(grassBytes.length,grass.bytes);
 manifest.dependencies.push({path:grass.file,bytes:grass.bytes,sha256:grass.sha256,source:'https://polyhaven.com/a/grass_bermuda_01',license:'CC0-1.0',licenseManifest:'foliage-revision.json',alreadyPublic:true,purpose:'Reuse only low green shore tufts; no new source download'});
 manifest.totalPublicBytes=manifest.assets.flatMap(a=>a.files).reduce((n,f)=>n+f.bytes,0);
 await save(resolve(root,'afterrain-assets.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
}
if(process.argv.includes('--record-runtime')){
 const manifest=JSON.parse(await readFile(resolve(root,'afterrain-assets.json'),'utf8'));
 const {riverbankPlan,riverStoneGeometry,RIVERBANK_REVISION}=await import('../riverbank-detail.js');
 const T=await import('../../sunbreak-storm-v3/vendor/presentation/build/three.module.js'),plan=riverbankPlan();
 const bytes=await readFile(resolve(root,'assets/foliage-revision/grass_bermuda_01.glb')),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const batches=[];
 function batch(kind,variant,triangles,placements,shadow=false){for(let sector=0;sector<4;sector++){
  const count=placements.filter(p=>(p.x>=0?1:0)+(p.z>=-4?2:0)===sector).length;
  if(count)batches.push({kind,variant,sector,instances:count,triangles:count*triangles,shadow});
 }}
 for(const kind of ['micro','cobbles','outcrops'])for(let variant=0;variant<(kind==='outcrops'?1:2);variant++){
  const geo=riverStoneGeometry(T,kind,variant);batch(kind,variant,geo.index.count/3,plan[kind].filter(p=>p.variant===variant),kind==='outcrops');geo.dispose();
 }
 for(const [variant,suffix]of ['small_a','small_b'].entries()){
  const node=gltf.nodes.find(n=>n.name==='grass_bermuda_01_'+suffix),primitive=gltf.meshes[node.mesh].primitives[0];
  batch('grass',variant,gltf.accessors[primitive.indices].count/3,plan.grass.filter(p=>p.variant===variant));
 }
 const triangles=batches.reduce((n,b)=>n+b.triangles,0),shadow=batches.filter(b=>b.shadow),old=new T.IcosahedronGeometry(1,2),oldTriangles=old.attributes.position.count/3*850;old.dispose();
 const ownedInputs=[];for(const path of ['riverbank-detail.js','tools/afterrain-assets.mjs','qa/riverbank-checks.mjs']){const data=await readFile(resolve(root,path));ownedInputs.push({path,bytes:data.length,sha256:hash(data)})}
 manifest.runtime={revision:RIVERBANK_REVISION,counts:Object.fromEntries(['micro','cobbles','grass','outcrops','patches'].map(k=>[k,plan[k].length])),placementSHA256:hash(JSON.stringify(plan)),triangles,drawCalls:batches.length,shadowTriangles:shadow.reduce((n,b)=>n+b.triangles,0),shadowCalls:shadow.length,incrementalTriangles:triangles-oldTriangles,incrementalDrawCalls:batches.length-1,bedAdditionalDraws:0,bedSourceUV:'x/2,z/2',bedTileMeters:2.16,maxPlayableStoneProtrusionMeters:.061,largeOutcropsFullyOutsidePlayableBounds:true,collidersNeeded:0,ownedInputs,batches,acceptance:'CPU invariants only. GPU compile, visual, frame times and gameplay remain main-owned validation.',tradeoffs:['Procedural rounded stones use scanned surface textures; not scanned individual meshes.','No shadow casts for tiny stones/shore grass; only 10 inaccessible outcrops cast shadows. Existing scene contact/AO provides near grounding.','28 maximum color batches before frustum culling; reflection/normal/post passes can resubmit geometry. Draw/triangle counts are not a frame-time pass.','Short shore grass is static; no unmatched shadow/wind deformation.','Existing bed geometry is reused; no parallax/tessellation/displacement or duplicated overlay planes added.']};
 await save(resolve(root,'afterrain-assets.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 console.log('Recorded exact runtime geometry, placement hash and owned-source hashes',triangles,'triangles',batches.length,'draws');
}
if(process.argv.includes('--verify')){
 const m=JSON.parse(await readFile(resolve(root,'afterrain-assets.json'),'utf8'));let originals=0,derivatives=0;
 for(const a of m.assets){assert.equal(a.license,'CC0-1.0');for(const f of a.sourceFiles){const b=await readFile(resolve(root,f.path));assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert.equal(hash(b,'md5'),f.officialMD5);originals++}for(const f of a.files){const b=await readFile(resolve(root,f.path));assert.equal(b.length,f.bytes);assert.equal(hash(b),f.sha256);assert.ok(m.publicWhitelist.includes(f.path));derivatives++}}
 for(const f of m.dependencies){const b=await readFile(resolve(root,f.path));assert.equal(hash(b),f.sha256);assert.equal(b.length,f.bytes)}
 for(const f of m.runtime?.ownedInputs||[]){const b=await readFile(resolve(root,f.path));assert.equal(hash(b),f.sha256);assert.equal(b.length,f.bytes)}
 assert.ok(m.publicWhitelist.every(p=>p.startsWith('assets/afterrain-detail/')&&!p.includes('/source/')));
 console.log(JSON.stringify({verdict:'SOURCE/DERIVATIVE CHECKS PASS — NOT VISUAL QA',originals,derivatives,dependencies:m.dependencies.length,totalPublicBytes:m.totalPublicBytes,publicWhitelist:m.publicWhitelist},null,2));
}
