// Exact preservation and real packed-paint provenance, separate from visual QA.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const game=new URL('../',import.meta.url),repo=new URL('../../../',import.meta.url);
const base='4d3bd53dfdd60848ce2239129d39fd5068336c5e',checks=[];
const bytes=p=>readFileSync(new URL(p,game)),json=p=>JSON.parse(bytes(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',args,{cwd:repo,maxBuffer:128e6});
const previous=p=>git(['show',base+':experiments/sunbreak-storm-v3/'+p]);
const check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}};
const audit=json('authoring/user-house-2026-11-17/source-audit.json');
check('exact saved user Blender project preserved without resave',()=>{
 assert.equal(sha(bytes('authoring/user-house-2026-11-17/timber-house-user-source.blend')),audit.sourceSha256);
 assert.equal(sha(readFileSync('F:/AIshootgame/timber-house/timber-house-editable.blend')),audit.sourceSha256);
 assert.equal(audit.sourceSha256,'bf6ac17ae69835ad8f54e20c5c90b6c0610e43924a95b2e9095a29e7c1b6a2a8');
});
check('runtime bytes are exact user-project GLB export',()=>{
 assert.equal(sha(bytes('assets/house/timber-house-edited.glb')),audit.candidateSha256);
 assert.equal(sha(bytes('authoring/user-house-2026-11-17/timber-house-user.glb')),audit.candidateSha256);
});
check('all UV intact; only four expected edited objects',()=>{
 assert.ok(audit.pass&&audit.fullUV&&audit.meshCount===1372&&audit.unchangedMeshes===1368);
 assert.deepEqual(audit.changes.map(c=>c.name),['DoorHandlePlate','Foundation_part_0001','Foundation_part_0002','Foundation_part_0075']);
});
check('painted texture is a real pixel edit, not only file reencoding',()=>{
 const changed=audit.imageDiffs.filter(i=>i.changedChannels>0);
 assert.deepEqual(changed.map(i=>i.name),['Image_4']);
 assert.equal(changed[0].changedChannels,167896);
});
const glb=bytes('assets/house/timber-house-edited.glb'),jsonLength=glb.readUInt32LE(12);
const gltf=JSON.parse(glb.subarray(20,20+jsonLength).toString()),binary=glb.subarray(28+jsonLength);
check('actual loaded GLB embeds user painted wood pixels byte-exact',()=>{
 const image=gltf.images.find(i=>i.name==='Image_4');
 assert.ok(image);
 const view=gltf.bufferViews[image.bufferView],packed=binary.subarray(view.byteOffset,view.byteOffset+view.byteLength);
 assert.equal(sha(packed),audit.packedImages.Image_4.sha256);
 assert.equal(sha(packed),sha(bytes('authoring/user-house-2026-11-17/Image_4.png')));
 for(const name of ['Timber','TimberLight','TimberDark']){
  const material=gltf.materials.find(m=>m.name===name);
  assert.equal(gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index].source,gltf.images.indexOf(image));
 }
});
const contract=json('assets/house/house-contract.json'),oldContract=json('authoring/timber-house/house-contract.json');
check('only three explicitly reviewed structural pins changed',()=>{
 assert.deepEqual(contract.records.filter((r,i)=>JSON.stringify(r)!==JSON.stringify(oldContract.records[i])).map(r=>r.name),
  ['Foundation_part_0001','Foundation_part_0002','Foundation_part_0075']);
 assert.equal(contract.geometryToleranceMetres,oldContract.geometryToleranceMetres);
 assert.equal(contract.cosmeticBoundsToleranceMetres,oldContract.cosmeticBoundsToleranceMetres);
 assert.deepEqual(contract.doorPivot,oldContract.doorPivot);
 assert.equal(contract.artistRevision.assetSha256,audit.candidateSha256);
});
for(const file of ['index.html','world.js','weapon.js','weapon-provenance.json','actors.js','tactical-ai.js','audio.js','storm.js','storm-audio.js','house-asset.js','timber-house.js'])
 check(file+' exact previous released bytes',()=>assert.equal(sha(bytes(file)),sha(previous(file))));
check('v1/v2 source, previous authoring kit, ZIP and historical evidence exact',()=>{
 git(['diff','--exit-code',base,'--','experiments/sunbreak-fable52','experiments/sunbreak-realistic-v2',
  'experiments/sunbreak-storm-v3/authoring/timber-house','experiments/sunbreak-storm-v3/assets/house/timber-house-art-kit.zip',
  'experiments/sunbreak-storm-v3/qa/roundtrip-evidence','experiments/sunbreak-storm-v3/qa/roundtrip-release.json']);
});
check('floor logic change is only the reviewed added block support',()=>{
 const current=bytes('house-logic.js').toString()
  .replace(/\/\/ Exact walk support[\s\S]*?\n\}\);\n/,'')
  .replace(' if(inside(x,z,ARTIST_STEP.minX,ARTIST_STEP.maxX,ARTIST_STEP.minZ,ARTIST_STEP.maxZ))return ARTIST_STEP.top;\n','');
 assert.equal(current,previous('house-logic.js').toString());
});
const report={schema:'sunbreak-user-house-preservation-v1',date:new Date().toISOString(),base,
 pass:checks.every(c=>c.pass),checks,sourceSha256:audit.sourceSha256,candidateSha256:audit.candidateSha256,
 method:'Exact source/material/embedded paint checks and narrowly scoped collision contract; not runtime or art acceptance.'};
writeFileSync(new URL('./user-house-contract.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass)},null,2));
if(!report.pass)process.exitCode=1;
