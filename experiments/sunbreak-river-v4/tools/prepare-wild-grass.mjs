// Reproducible CC0 atlas acquisition / original curved-blade tuft preparation.
// All writes are confined to assets/wild-grass and wild-grass-assets.json.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp')}catch{sharp=require('C:/Users/baomin.wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')}
const root=new URL('../',import.meta.url),base=new URL('assets/wild-grass/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const ids=['Foliage001','Foliage006'];
async function save(path,b){await mkdir(new URL('.',new URL(path,base)),{recursive:true});await writeFile(new URL(path,base),b)}
async function acquire(path,url){try{return await readFile(new URL(path,base))}catch{const r=await fetch(url);if(!r.ok)throw Error(`${r.status} ${url}`);const b=Buffer.from(await r.arrayBuffer());await save(path,b);return b}}
// Central-directory extraction rejects paths, unsupported codecs and size mismatch.
function unzip(b){let end=b.length-22;while(end>=0&&b.readUInt32LE(end)!==0x06054b50)end--;if(end<0)throw Error('Invalid ZIP');const files=new Map();let p=b.readUInt32LE(end+16);for(let i=0;i<b.readUInt16LE(end+10);i++){if(b.readUInt32LE(p)!==0x02014b50)throw Error('Bad ZIP directory');const method=b.readUInt16LE(p+10),size=b.readUInt32LE(p+20),plain=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),off=b.readUInt32LE(p+42),name=b.subarray(p+46,p+46+nl).toString();p+=46+nl+el+cl;if(!/^[\w.-]+$/.test(name))continue;const start=off+30+b.readUInt16LE(off+26)+b.readUInt16LE(off+28),raw=b.subarray(start,start+size),data=method===8?inflateRawSync(raw):method===0?raw:null;if(!data||data.length!==plain)throw Error(`Bad ZIP member ${name}`);files.set(name,data)}return files}
await acquire('source/license/ambientcg-license.html','https://docs.ambientcg.com/license/');
await acquire('source/license/CC0-1.0.txt','https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt');
const inputs=[];
for(const id of ids){
 const api=`https://ambientcg.com/api/v2/full_json?id=${id}&include=downloadData`,metadata=await acquire(`source/${id}/metadata.json`,api),a=JSON.parse(metadata).foundAssets.find(a=>a.assetId===id);
 const record=a.downloadFolders.default.downloadFiletypeCategories.zip.downloads.find(d=>d.attribute==='1K-JPG'),zip=await acquire(`source/${id}/${record.fileName}`,record.downloadLink);
 if(zip.length!==record.size)throw Error(`${id} official size mismatch`);
 const files=unzip(zip);for(const [name,b]of files)await save(`source/${id}/${name}`,b);
 console.log(id,[...files.keys()]);inputs.push({id,record,files});
}
if(process.argv.includes('--sources-only'))process.exit(0);

const crops={
 Foliage001:[[137,42,57,904],[332,75,62,867],[731,96,76,847],[541,97,58,851],[412,80,96,866]],
 Foliage006:[[199,25,67,430],[375,33,60,436],[521,13,58,467],[203,497,67,525],[379,511,64,506],[524,514,60,504]]
};
const definitions=[
 {name:'wild_leafy_a',id:'Foliage001',blades:20,height:.34,radiusRatio:.55,seed:221},
 {name:'wild_leafy_b',id:'Foliage006',blades:26,height:.22,radiusRatio:1.35,seed:746,posture:'outward'},
 {name:'wild_upright_a',id:'Foliage001',blades:16,height:.48,radiusRatio:.36,seed:821},
 {name:'wild_upright_b',id:'Foliage006',blades:18,height:.48,radiusRatio:.35,seed:962}
];
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function glb(def,texture){
 const random=rng(def.seed),pos=[],uv=[],indices=[],normal=[],bladeInfo=[];
 const segments=6;
 for(let blade=0;blade<def.blades;blade++){
  const outward=def.posture==='outward',rect=crops[def.id][blade%crops[def.id].length],h=def.height*(.30+Math.pow(random(),.85)*.70),angle=outward&&blade%4!==0?.4+(random()-.5)*2.5:random()*Math.PI*2,
   reach=def.height*(outward?.65+random()*.55:def.name.includes('upright')?.13+random()*.12:.20+random()*.20),rootR=.006+Math.pow(random(),.8)*.032,
   rootAngle=angle+(random()-.5)*2.4,x0=Math.cos(rootAngle)*rootR,z0=Math.sin(rootAngle)*rootR,width=Math.min(.009,h*rect[2]/rect[3]*.44),twist=(random()-.5)*.50,
   arc=blade%5===0?1.35+random()*.25:outward?2.55+random()*.35:1.90+random()*.42,first=pos.length/3;
  bladeInfo.push({height:h,width,reach,arc,root:[x0,z0],crop:rect});
  for(let s=0;s<=segments;s++){
   const t=s/segments,bend=reach*t*t,theta=angle+twist*t,xx=x0+Math.cos(angle)*bend,zz=z0+Math.sin(angle)*bend,yy=h*Math.sin(arc*t),
    sx=-Math.sin(theta),sz=Math.cos(theta),dy=h*arc*Math.cos(arc*t),nx=dy*Math.cos(theta),nz=dy*Math.sin(theta),ny=-2*reach*t*Math.cos(theta-angle),len=Math.hypot(nx,ny,nz);
   for(const side of [-1,1]){pos.push(xx+sx*width*.5*side,yy,zz+sz*width*.5*side);normal.push(nx/len,ny/len,nz/len);uv.push((rect[0]+(side===-1?0:rect[2]))/1024,(rect[1]+rect[3]*(1-t))/1024)}
   if(s<segments){const n=first+s*2;indices.push(n,n+2,n+1,n+1,n+2,n+3)}
  }
 }
 // Source geometry fits the pre-existing placement clearance; x/z uniformly
 // contract only when necessary. Blades retain narrow real-world proportions.
 const bounds=()=>{const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<pos.length;i++) {min[i%3]=Math.min(min[i%3],pos[i]);max[i%3]=Math.max(max[i%3],pos[i])}return {min,max}};
 let {min,max}=bounds();const ratio=Math.hypot(max[0]-min[0],max[2]-min[2])/(2*(max[1]-min[1])),shrink=Math.min(1,def.radiusRatio*.97/ratio);
 for(let i=0;i<pos.length;i++)if(i%3!==1)pos[i]*=shrink;
 for(let i=0;i<normal.length;i+=3){normal[i]/=shrink;normal[i+2]/=shrink;const len=Math.hypot(...normal.slice(i,i+3));for(let k=0;k<3;k++)normal[i+k]/=len}
 ({min,max}=bounds());
 // A drooping tip turns more sharply than a straight blade. Separate segment
 // corners so its analytic normal cannot flip across a coarsely sampled bend;
 // retain smoothing where it agrees with the actual segment face. Triangle
 // and material/draw counts are unchanged.
 const p2=[],n2=[],u2=[],i2=[];
 for(let blade=0;blade<def.blades;blade++)for(let s=0;s<segments;s++){
  const at=blade*(segments+1)*2+s*2,ids=[at,at+1,at+2,at+3],a=pos.slice(at*3,at*3+3),u=pos.slice((at+2)*3,(at+2)*3+3).map((v,k)=>v-a[k]),v=pos.slice((at+1)*3,(at+1)*3+3).map((v,k)=>v-a[k]),
   face=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...face),start=p2.length/3;
  for(let k=0;k<3;k++)face[k]/=len;
  for(const i of ids){p2.push(...pos.slice(i*3,i*3+3));u2.push(...uv.slice(i*2,i*2+2));const original=normal.slice(i*3,i*3+3),dot=original.reduce((sum,x,k)=>sum+x*face[k],0),n=dot>.65?original.map((x,k)=>x+face[k]):face,nlen=Math.hypot(...n);n2.push(...n.map(x=>x/nlen))}
  i2.push(start,start+2,start+1,start+1,start+2,start+3);
 }
 pos.splice(0,pos.length,...p2);normal.splice(0,normal.length,...n2);uv.splice(0,uv.length,...u2);indices.splice(0,indices.length,...i2);
 const doc={asset:{version:'2.0',generator:'prepare-wild-grass.mjs; original curved blade geometry / ambientCG CC0 leaf atlas'},scene:0,scenes:[{nodes:[0]}],
  nodes:[{name:def.name,mesh:0}],meshes:[{primitives:[]}],buffers:[{byteLength:0}],bufferViews:[],accessors:[],
  images:[],samplers:[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}],textures:[{sampler:0,source:0}],
  materials:[{name:`${def.id}-wild-leaves`,alphaMode:'MASK',alphaCutoff:.35,doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0},baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.94}}],
  extras:{source:`https://ambientcg.com/a/${def.id}`,license:'CC0-1.0',originalGeometry:true,blades:def.blades,segments,bladeInfo,sourceRadiusRatio:Math.hypot(max[0]-min[0],max[2]-min[2])/(2*(max[1]-min[1])),maxBladeWidth:Math.max(...bladeInfo.map(b=>b.width))*shrink}};
 const chunks=[];let offset=0;
 function view(b,target){const i=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:b.length,...target?{target}:{}});chunks.push(b);const pad=(4-b.length%4)%4;if(pad)chunks.push(Buffer.alloc(pad));offset+=b.length+pad;return i}
 function attr(values,type,componentType,bounds){const a=componentType===5123?new Uint16Array(values):new Float32Array(values),i=doc.accessors.length;doc.accessors.push({bufferView:view(Buffer.from(a.buffer),componentType===5123?34963:34962),componentType,count:values.length/({VEC3:3,VEC2:2,SCALAR:1}[type]),type,...bounds});return i}
 doc.meshes[0].primitives.push({attributes:{POSITION:attr(pos,'VEC3',5126,{min,max}),NORMAL:attr(normal,'VEC3',5126),TEXCOORD_0:attr(uv,'VEC2',5126)},indices:attr(indices,'SCALAR',5123),material:0});
 doc.images.push({bufferView:view(texture),mimeType:'image/png'});doc.buffers[0].byteLength=offset;
 const json=Buffer.from(JSON.stringify(doc)),jsonPad=Buffer.alloc((4-json.length%4)%4,32),body=Buffer.concat(chunks),head=Buffer.alloc(20),binHead=Buffer.alloc(8);
 head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(20+json.length+jsonPad.length+8+body.length,8);head.writeUInt32LE(json.length+jsonPad.length,12);head.writeUInt32LE(0x4e4f534a,16);binHead.writeUInt32LE(body.length);binHead.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([head,json,jsonPad,binHead,body]);
}
const palette={Foliage001:[64,72,45],Foliage006:[66,74,44]};
for(const input of inputs){
 const find=suffix=>input.files.get(`${input.id}_1K-JPG_${suffix}.jpg`),opacity=await sharp(find('Opacity')).greyscale().raw().toBuffer(),
  rgb=await sharp(find('Color')).removeAlpha().raw().toBuffer(),luminance=[];
 const luma=i=>rgb[i]*.2126+rgb[i+1]*.7152+rgb[i+2]*.0722;
 for(let p=0;p<opacity.length;p++)if(opacity[p]>200)luminance.push(luma(p*3));
 luminance.sort((a,b)=>a-b);const median=luminance[Math.floor(luminance.length/2)],target=palette[input.id];
 // Shared olive tonal envelope removes the cyan/lime island split while
 // retaining source veins, small chroma variation and real alpha silhouettes.
 for(let i=0;i<rgb.length;i+=3){const y=luma(i),contrast=Math.pow(Math.max(.48,Math.min(1.65,y/median)),.72);
  for(let c=0;c<3;c++)rgb[i+c]=Math.round(Math.max(0,Math.min(255,target[c]*contrast+(rgb[i+c]-y)*.04)));
 }
 const texture=await sharp(rgb,{raw:{width:1024,height:1024,channels:3}}).joinChannel(opacity,{raw:{width:1024,height:1024,channels:1}}).png().toBuffer();
 await save(`${input.id}-leaf-rgba.png`,texture);
 for(const def of definitions.filter(d=>d.id===input.id))await save(`${def.name}.glb`,glb(def,texture));
}
const license='CC0-1.0',licenseSource='https://docs.ambientcg.com/license/';
await save('LICENSE.txt',`Wild grass runtime derivatives\n\nCreated using Foliage001 and Foliage006 from ambientCG.com, licensed under Creative Commons CC0 1.0 Universal.\n${licenseSource}\nhttps://creativecommons.org/publicdomain/zero/1.0/\n\nOriginal deterministic curved-blade geometry and atlas preparation: this project. Source atlases are photographs with PBR maps, NOT scanned 3D tuft meshes. Source ZIPs and license snapshots remain in source/ and are not in the public runtime whitelist.\n`);
const files=[];
async function inventory(dir=''){for(const item of await readdir(new URL(dir,base),{withFileTypes:true})){const path=dir+item.name;if(item.isDirectory())await inventory(path+'/');else{const b=await readFile(new URL(path,base)),id=ids.find(id=>path.includes(id))||definitions.find(d=>path.includes(d.name))?.id;files.push({file:'assets/wild-grass/'+path,sha256:sha(b),bytes:b.length,license,source:id?`https://ambientcg.com/a/${id}`:licenseSource,derivatives:path.startsWith('source/')?'Unmodified source or official license/API snapshot':path.endsWith('.glb')?'Original 6-segment arched/drooping blades, width <=9mm before runtime scaling; narrow leaf crops; embedded olive-normalized RGBA atlas; deterministic seed':path.endsWith('.png')?'Color/opacity combined; opaque-median luminance normalized into shared subdued olive palette; 4% source chroma retained':'Attribution and derivative description'})}}}
await inventory();files.sort((a,b)=>a.file.localeCompare(b.file));
const manifest={schema:'wild-grass-assets-v1',license,licenseSource,sourceAssets:inputs.map(({id,record})=>({id,source:`https://ambientcg.com/a/${id}`,download:record.downloadLink,bytes:record.size,license})),
 preparation:{script:'tools/prepare-wild-grass.mjs',sha256:sha(await readFile(new URL(import.meta.url))),command:'node experiments/sunbreak-river-v4/tools/prepare-wild-grass.mjs',dependencies:{node:'24+',sharp:sharp.versions.sharp},offline:'Reuses checked source ZIPs and metadata; rebuilds runtime deterministically.'},
 definitions,palette,files,publicWhitelist:[...definitions.map(d=>'assets/wild-grass/'+d.name+'.glb'),'assets/wild-grass/LICENSE.txt'],limits:'CPU provenance and geometry only. Main owns actual rendered art/performance acceptance.'};
await writeFile(new URL('wild-grass-assets.json',root),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({ready:true,publicWhitelist:manifest.publicWhitelist,runtimeBytes:files.filter(f=>manifest.publicWhitelist.includes(f.file)).reduce((n,f)=>n+f.bytes,0)},null,2));
