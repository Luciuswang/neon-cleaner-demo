// Build the actual handoff from generated GLB/Blender files; never fake .blend.
import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=resolve(root,'authoring/timber-house'),runtime=resolve(root,'assets/house');
await mkdir(runtime,{recursive:true});await mkdir(resolve(dir,'textures'),{recursive:true});
const glb=await readFile(resolve(dir,'timber-house-source.glb'));
if(glb.readUInt32LE(0)!==0x46546c67)throw Error('Not a real GLB');
const jsonSize=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonSize).toString()),binStart=20+jsonSize+8,maps=[];
for(const [i,image]of (json.images||[]).entries()){
 const view=json.bufferViews[image.bufferView];if(!view)throw Error('Expected embedded PNG/JPEG');
 const path='textures/image_'+String(i).padStart(3,'0')+(image.mimeType==='image/jpeg'?'.jpg':'.png'),bytes=glb.subarray(binStart+(view.byteOffset||0),binStart+(view.byteOffset||0)+view.byteLength);
 await writeFile(resolve(dir,path),bytes);maps.push({index:i,name:image.name||null,path,mimeType:image.mimeType,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(resolve(dir,'material-textures.json'),JSON.stringify({images:maps,textures:json.textures,materials:json.materials},null,2)+'\n');
const license={houseGeometry:'Project-authored geometry; user-supplied photograph used only for structural reference, no source photograph/watermark included.',
 textureLicense:'CC0-1.0',textureProvider:'Poly Haven',sources:[]};
const manifest=JSON.parse(await readFile(resolve(root,'assets-manifest.json'),'utf8'));
for(const asset of manifest.assets.filter(a=>['wood_weathered','wall_worn_plaster'].includes(a.semantic_role)))license.sources.push({name:asset.name,source:asset.source_url,license:asset.license,authors:asset.authors,files:asset.files.map(f=>({path:f.path,sha256:f.sha256}))});
license.authoredRoofTextures='Project-authored deterministic normal/roughness data.';
license.excluded='No player arms, gun, NPC, recorded audio, Epic/Fab or private assets are included.';
await writeFile(resolve(dir,'LICENSES.json'),JSON.stringify(license,null,2)+'\n');
for(const name of ['timber-house-edited.glb','house-contract.json'])await copyFile(resolve(dir,name),resolve(runtime,name));
const files=['timber-house-source.glb','timber-house-edited.glb','timber-house-editable.blend','house-contract.json','blender-roundtrip.json','material-textures.json','LICENSES.json','README-美术交接.md',...maps.map(m=>m.path)];
const records=[];
for(const path of files){const bytes=await readFile(resolve(dir,path));records.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})}
await writeFile(resolve(dir,'package-manifest.json'),JSON.stringify({schema:'sunbreak-house-art-handoff-v1',created:new Date().toISOString(),files:records},null,2)+'\n');
// Python's ZIP implementation handles Unicode names and verifies the archive.
const code="import pathlib,zipfile,json; d=pathlib.Path("+JSON.stringify(dir)+"); z=pathlib.Path("+JSON.stringify(resolve(runtime,'timber-house-art-kit.zip'))+"); names=[f['path'] for f in json.loads((d/'package-manifest.json').read_text(encoding='utf8'))['files']]+['package-manifest.json']; files=[d/p for p in names]; assert all(p.resolve().is_relative_to(d.resolve()) for p in files); a=zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=6); [(a.write(p, 'timber-house/'+p.relative_to(d).as_posix())) for p in files]; a.close(); b=zipfile.ZipFile(z); assert b.testzip() is None; print('ZIP verified',len(files),'files',z.stat().st_size,'bytes')";
console.log(execFileSync('python',['-c',code],{encoding:'utf8'}));
console.log(JSON.stringify({package:resolve(runtime,'timber-house-art-kit.zip'),sourceGLB:(await stat(resolve(dir,'timber-house-source.glb'))).size,editedGLB:(await stat(resolve(dir,'timber-house-edited.glb'))).size,images:maps.length},null,2));
