// Scoped, reproducible Poly Haven acquisition/derivation. Never writes outside
// assets/foliage-revision and foliage-revision.json. Source files are not public.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=resolve(root,'assets/foliage-revision'),source=resolve(base,'source');
const require=createRequire(import.meta.url);
let sharp;try{sharp=require('sharp')}catch{sharp=require('C:/Users/baomin.wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')}
const sha=(b,algo='sha256')=>createHash(algo).update(b).digest('hex');
let simplifier,encoder;
const ids=['island_tree_01','tree_small_02','grass_medium_01','grass_medium_02','grass_bermuda_01'];
const manifest={schema:'river-foliage-revision-v1',date:new Date().toISOString(),license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',sources:[],derivatives:[],publicWhitelist:[],audit:{previousLeafRetention:[.13,.045],previousLeafEnlargement:[2.2,3.2],previousTreeHeight:14,findings:['Prior near/far retained only 13%/4.5% of whole leaves then enlarged each by 2.2x/3.2x; sparse detached silhouette follows directly.','Prior whole-tree scaling from 3.4m to 14m compounded oversized leaves and pale forked trunk repetition.','Poly Haven glTF diffuse JPEGs have no alpha channel although leaf materials request BLEND; separate official alpha must be embedded.','Prior procedural wind was applied to visible material only, not custom shadow depth.']},limits:['Runtime image/1080p performance acceptance belongs to main; no AAA pass.','Tree Small 02 is Burkea africana, a visual stand-in rather than a verified Vietnamese species.']};
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`${url}: ${r.status}`);return Buffer.from(await r.arrayBuffer())}
async function save(path,b){
 await mkdir(dirname(path),{recursive:true});
 // Same-directory rename: a concurrent asset request sees the complete old or
 // complete new file, never a partially rewritten compressed vertex buffer.
 const temp=path+'.pending-'+process.pid;await writeFile(temp,b);await rename(temp,path);
}
async function acquire(id){
 if(id==='grass_bermuda_01')return acquireExistingBermuda();
 const cached=process.argv.includes('--cached')?JSON.parse(await readFile(resolve(source,id,'official-api.json'),'utf8')):null;
 const api=cached?.files||JSON.parse(await get(`https://api.polyhaven.com/files/${id}`)),info=cached?.info||JSON.parse(await get(`https://api.polyhaven.com/info/${id}`));
 const entry={id,source:`https://polyhaven.com/a/${id}`,api:`https://api.polyhaven.com/files/${id}`,license:'CC0-1.0',authors:info.authors,files:[]};
 const f=api.gltf['1k'].gltf,alpha=api.leaves_alpha?.['1k']?.png||api.Alpha?.['1k']?.png;
 const parts={ [id+'.gltf']:f,...f.include,...alpha?{'alpha.png':alpha}:{}};
 for(const [name,item]of Object.entries(parts)){
  const path=resolve(source,id,name);let b;try{b=await readFile(path)}catch{}
  if(!b||sha(b,'md5')!==item.md5||b.length!==item.size){b=await get(item.url);if(b.length!==item.size||sha(b,'md5')!==item.md5)throw Error('Official checksum mismatch: '+id+'/'+name);await save(path,b)}
  entry.files.push({path:'assets/foliage-revision/source/'+id+'/'+name,url:item.url,bytes:b.length,officialMD5:item.md5,sha256:sha(b)});
 }
 await save(resolve(source,id,'official-api.json'),Buffer.from(JSON.stringify({info,files:api},null,2)+'\n'));
 manifest.sources.push(entry);console.log('Acquired and checked',id);
 return {id,path:resolve(source,id),json:JSON.parse(await readFile(resolve(source,id,id+'.gltf'),'utf8'))};
}
async function acquireExistingBermuda(){
 const id='grass_bermuda_01',provenanceBytes=await readFile(resolve(root,'asset-sources.json')),provenance=JSON.parse(provenanceBytes),asset=provenance.assets.find(a=>a.id===id),files=provenance.files.filter(f=>f.path.startsWith('assets/'+id+'/'));
 assert.equal(asset.license,'CC0-1.0');assert.equal(files.length,6,'complete existing official Bermuda package');
 const entry={id,source:asset.source,api:'https://api.polyhaven.com/files/'+id,license:asset.license,licenseURL:asset.licenseURL,provenance:{path:'asset-sources.json',sha256:sha(provenanceBytes),mode:'Existing local official package; no network download'},files:[]};
 for(const f of files){
  const bytes=await readFile(resolve(root,f.path));assert.equal(bytes.length,f.bytes);assert.equal(sha(bytes),f.sha256);assert.equal(sha(bytes,'md5'),f.officialMD5);
  const path='assets/foliage-revision/source/'+id+'/'+f.path.slice(('assets/'+id+'/').length);await save(resolve(root,path),bytes);entry.files.push({...f,path});
 }
 await save(resolve(source,id,'asset-sources-excerpt.json'),Buffer.from(JSON.stringify({asset,files,provenance:entry.provenance},null,2)+'\n'));
 manifest.sources.push(entry);console.log('Verified existing CC0 package, no download:',id);
 return{id,path:resolve(source,id),json:JSON.parse(await readFile(resolve(source,id,id+'.gltf'),'utf8'))};
}
const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16},types={5126:Float32Array,5125:Uint32Array,5123:Uint16Array,5121:Uint8Array};
function array(j,b,id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],C=types[a.componentType];if(v.byteStride)throw Error('Unexpected stride');const start=(v.byteOffset||0)+(a.byteOffset||0);return new C(Uint8Array.from(b.subarray(start,start+a.count*components[a.type]*C.BYTES_PER_ELEMENT)).buffer)}
function groups(p,idx){const parents=Int32Array.from({length:p.length/3},(_,i)=>i);function find(i){while(i!==parents[i]){parents[i]=parents[parents[i]];i=parents[i]}return i}for(let i=0;i<idx.length;i+=3){const a=find(idx[i]);parents[find(idx[i+1])]=a;parents[find(idx[i+2])]=a}const out=new Map();for(let i=0;i<parents.length;i++){const r=find(i);if(!out.has(r))out.set(r,[]);out.get(r).push(i)}return [...out.values()]}
export function surfaceStats(attrs,idx,{correctWinding=false}={}){
 const p=attrs.POSITION,n=attrs.NORMAL,uv=attrs.TEXCOORD_0;
 let area=0,uvArea=0,backwardsArea=0,flipped=0;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2],x=p[b*3]-p[a*3],y=p[b*3+1]-p[a*3+1],z=p[b*3+2]-p[a*3+2],u=p[c*3]-p[a*3],v=p[c*3+1]-p[a*3+1],w=p[c*3+2]-p[a*3+2];
  const nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u,ar=Math.hypot(nx,ny,nz)*.5;
  area+=ar;uvArea+=Math.abs((uv[b*2]-uv[a*2])*(uv[c*2+1]-uv[a*2+1])-(uv[b*2+1]-uv[a*2+1])*(uv[c*2]-uv[a*2]))*.5;
  const dot=nx*(n[a*3]+n[b*3]+n[c*3])+ny*(n[a*3+1]+n[b*3+1]+n[c*3+1])+nz*(n[a*3+2]+n[b*3+2]+n[c*3+2]);
  if(dot<0){backwardsArea+=ar;if(correctWinding){idx[i+1]=c;idx[i+2]=b;flipped++}}
 }
 return{area,uvArea,backwardsAreaFraction:area?backwardsArea/area:0,flipped};
}
function compact(attrs,idx){
 const used=new Map(),outIndex=new Uint32Array(idx.length);for(let k=0;k<idx.length;k++){const i=idx[k];if(!used.has(i))used.set(i,used.size);outIndex[k]=used.get(i)}
 const out={};for(const [key,a]of Object.entries(attrs)){const n=a.length/(attrs.POSITION.length/3),b=new Float32Array(used.size*n);for(const [old,k]of used)for(let c=0;c<n;c++)b[k*n+c]=a[old*n+c];out[key]=b}
 return{attrs:out,idx:outIndex};
}
const coverageCache=new Map();
function barycentric(uv,ia,ib,ic,x,y){
 const ax=uv[ia*2],ay=uv[ia*2+1],bx=uv[ib*2],by=uv[ib*2+1],cx=uv[ic*2],cy=uv[ic*2+1],d=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
 if(Math.abs(d)<1e-14)return null;
 const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/d,b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/d;
 return a>=-1e-5&&b>=-1e-5&&a+b<=1.00001?[a,b,1-a-b]:null;
}
export function compoundPatch(attrs,idx,far,alphaImage,diagnostic=false){
 if(!alphaImage||attrs.POSITION.length/3<50)return null;
 const p=attrs.POSITION,uv=attrs.TEXCOORD_0,n=attrs.NORMAL,vertices=Array.from({length:p.length/3},(_,i)=>i);
 const cross=(a,b,c)=>(uv[b*2]-uv[a*2])*(uv[c*2+1]-uv[a*2+1])-(uv[b*2+1]-uv[a*2+1])*(uv[c*2]-uv[a*2]);
 const sorted=vertices.sort((a,b)=>uv[a*2]-uv[b*2]||uv[a*2+1]-uv[b*2+1]),half=list=>{const h=[];for(const v of list){while(h.length>1&&cross(h.at(-2),h.at(-1),v)<=0)h.pop();h.push(v)}return h.slice(0,-1)};
 const ring=[...half(sorted),...half([...sorted].reverse())];
 while(ring.length>(far?10:12)){let drop=0,best=Infinity;for(let i=0;i<ring.length;i++){const a=Math.abs(cross(ring[(i+ring.length-1)%ring.length],ring[i],ring[(i+1)%ring.length]));if(a<best){best=a;drop=i}}ring.splice(drop,1)}
 if(ring.length<3)return null;
 const cx=ring.reduce((s,v)=>s+uv[v*2],0)/ring.length,cy=ring.reduce((s,v)=>s+uv[v*2+1],0)/ring.length;
 const pp=new Float32Array((ring.length+1)*3),nn=new Float32Array(pp.length),tt=new Float32Array((ring.length+1)*2),ii=new Uint32Array(ring.length*3);
 ring.forEach((v,i)=>{pp.set(p.subarray(v*3,v*3+3),(i+1)*3);nn.set(n.subarray(v*3,v*3+3),(i+1)*3);tt.set(uv.subarray(v*2,v*2+2),(i+1)*2);ii.set([0,i+1,(i+1)%ring.length+1],i*3)});tt[0]=cx;tt[1]=cy;
 let center=null;for(let i=0;i<idx.length;i+=3){const w=barycentric(uv,idx[i],idx[i+1],idx[i+2],cx,cy);if(w){center=[...w.map((weight,k)=>({v:idx[i+k],weight}))];break}}
 if(!center){center=vertices.map(v=>({v,d:(uv[v*2]-cx)**2+(uv[v*2+1]-cy)**2})).sort((a,b)=>a.d-b.d).slice(0,4);const sum=center.reduce((s,v)=>s+1/Math.max(v.d,1e-10),0);center.forEach(v=>v.weight=1/Math.max(v.d,1e-10)/sum)}
 for(const {v,weight}of center)for(let k=0;k<3;k++){pp[k]+=p[v*3+k]*weight;nn[k]+=n[v*3+k]*weight}
 const nl=Math.hypot(nn[0],nn[1],nn[2]);for(let k=0;k<3;k++)nn[k]/=nl;
 // The envelope is allowed only when it covers the same ACTUAL opaque atlas
 // pixels as the source compound twig. Blank UV gaps are not extra leaf area.
 const key=sha(Buffer.concat([Buffer.from(uv.buffer,uv.byteOffset,uv.byteLength),Buffer.from(idx.buffer,idx.byteOffset,idx.byteLength),Buffer.from(tt.buffer)]));
 let coverage=coverageCache.get(key);
 if(!coverage){
  const minU=Math.min(...vertices.map(v=>uv[v*2])),maxU=Math.max(...vertices.map(v=>uv[v*2])),minV=Math.min(...vertices.map(v=>uv[v*2+1])),maxV=Math.max(...vertices.map(v=>uv[v*2+1]));let original=0,retained=0,extra=0;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
   const u=minU+(maxU-minU)*(x+.5)/64,v=minV+(maxV-minV)*(y+.5)/64,px=Math.min(alphaImage.info.width-1,Math.max(0,Math.floor(u*alphaImage.info.width))),py=Math.min(alphaImage.info.height-1,Math.max(0,Math.floor(v*alphaImage.info.height)));
   if(alphaImage.data[py*alphaImage.info.width+px]<90)continue;
   let src=false,dst=false;for(let i=0;i<idx.length&&!src;i+=3)src=!!barycentric(uv,idx[i],idx[i+1],idx[i+2],u,v);for(let i=0;i<ii.length&&!dst;i+=3)dst=!!barycentric(tt,ii[i],ii[i+1],ii[i+2],u,v);
   if(src){original++;if(dst)retained++}else if(dst)extra++;
  }
  coverage={retained:retained/Math.max(1,original),extra:extra/Math.max(1,original)};coverageCache.set(key,coverage);
 }
 if(coverage.retained<(far?.95:.98)||(!alphaImage.atlas&&coverage.extra>.035))return diagnostic?{rejected:'alpha-footprint',coverage}:null;
 let error2=0,samples=0,maxError=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const v of vertices){for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[v*3+k]);max[k]=Math.max(max[k],p[v*3+k])}for(let i=0;i<ii.length;i+=3){const w=barycentric(tt,ii[i],ii[i+1],ii[i+2],uv[v*2],uv[v*2+1]);if(!w)continue;let e=0;for(let k=0;k<3;k++){const d=w.reduce((s,a,j)=>s+a*pp[ii[i+j]*3+k],0)-p[v*3+k];e+=d*d}error2+=e;samples++;maxError=Math.max(maxError,Math.sqrt(e));break}}
 const extent=Math.hypot(...min.map((v,k)=>max[k]-v)),rms=Math.sqrt(error2/Math.max(1,samples))/extent;
 if(rms>(far?.075:.05)||maxError/extent>(far?.20:.15))return diagnostic?{rejected:'warp',coverage,rms,max:maxError/extent}:null;
 const out={attrs:{POSITION:pp,NORMAL:nn,TEXCOORD_0:tt},idx:ii};surfaceStats(out.attrs,out.idx,{correctWinding:true});
 if(alphaImage.atlas){
  // A compound-twig envelope can overlap OTHER leaves in the official atlas.
  // Clip each tile's opacity to this component's SOURCE UV triangles. Never
  // display those extra leaves just because they lie inside its convex hull.
  const slot=alphaImage.atlas.add(uv,idx);if(!slot)return null;
  for(let i=0;i<tt.length;i+=2){tt[i]=(slot.x+8+(tt[i]-slot.minU)/(slot.maxU-slot.minU)*496)/2048;tt[i+1]=(slot.y+8+(tt[i+1]-slot.minV)/(slot.maxV-slot.minV)*496)/2048}
 }
 return{...out,coverage:{...coverage,extra:alphaImage.atlas?0:coverage.extra,unclippedExtra:coverage.extra},rms,maxError:maxError/extent};
}
async function makeLeafAtlas(model,j,alpha){
 if(model.id!=='tree_small_02')return null;
 const leaf=j.materials.find(m=>/leaves/.test(m.name)),imageIDs=[leaf.pbrMetallicRoughness.baseColorTexture.index,leaf.normalTexture.index,leaf.pbrMetallicRoughness.metallicRoughnessTexture.index].map(i=>j.textures[i].source);
 const raws=await Promise.all(imageIDs.map(async i=>(await sharp(resolve(model.path,j.images[i].uri)).removeAlpha().raw().toBuffer({resolveWithObject:true})).data)),buffers=raws.map((_,i)=>{const b=Buffer.alloc(2048*2048*3);if(i===1)for(let p=0;p<b.length;p+=3){b[p]=128;b[p+1]=128;b[p+2]=255}return b}),opacity=Buffer.alloc(2048*2048),slots=[],cache=new Map();
 for(let y=0;y<1024;y++){for(let k=0;k<3;k++)raws[k].copy(buffers[k],y*2048*3,y*1024*3,(y+1)*1024*3);alpha.data.copy(opacity,y*2048,y*1024,(y+1)*1024)}
 const atlas={imageIDs,buffers,opacity,slots,add(uv,idx){
  const key=sha(Buffer.concat([Buffer.from(uv.buffer,uv.byteOffset,uv.byteLength),Buffer.from(idx.buffer,idx.byteOffset,idx.byteLength)]));if(cache.has(key))return cache.get(key);
  if(slots.length>=12)return null;
  const n=slots.length,tile=n<8?{x:1024+(n%2)*512,y:Math.floor(n/2)*512}:{x:((n-8)%2)*512,y:1024+Math.floor((n-8)/2)*512};
  const vs=Array.from({length:uv.length/2},(_,i)=>i),slot={...tile,minU:Math.min(...vs.map(v=>uv[v*2])),maxU:Math.max(...vs.map(v=>uv[v*2])),minV:Math.min(...vs.map(v=>uv[v*2+1])),maxV:Math.max(...vs.map(v=>uv[v*2+1])),sourceUVTopologySHA256:key};
  const mask=new Uint8Array(512*512),localUV=new Float32Array(uv.length);
  for(let i=0;i<uv.length;i+=2){localUV[i]=8+(uv[i]-slot.minU)/(slot.maxU-slot.minU)*496;localUV[i+1]=8+(uv[i+1]-slot.minV)/(slot.maxV-slot.minV)*496}
  for(let k=0;k<idx.length;k+=3){const a=idx[k],b=idx[k+1],c=idx[k+2],x0=Math.max(0,Math.floor(Math.min(localUV[a*2],localUV[b*2],localUV[c*2]))),x1=Math.min(511,Math.ceil(Math.max(localUV[a*2],localUV[b*2],localUV[c*2]))),y0=Math.max(0,Math.floor(Math.min(localUV[a*2+1],localUV[b*2+1],localUV[c*2+1]))),y1=Math.min(511,Math.ceil(Math.max(localUV[a*2+1],localUV[b*2+1],localUV[c*2+1])));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(barycentric(localUV,a,b,c,x+.5,y+.5))mask[y*512+x]=1;
  }
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const u=slot.minU+(x+.5-8)/496*(slot.maxU-slot.minU),v=slot.minV+(y+.5-8)/496*(slot.maxV-slot.minV),sx=Math.max(0,Math.min(1023,Math.floor(u*1024))),sy=Math.max(0,Math.min(1023,Math.floor(v*1024))),src=sy*1024+sx,dst=(slot.y+y)*2048+slot.x+x;
   opacity[dst]=mask[y*512+x]?alpha.data[src]:0;for(let k=0;k<3;k++)for(let c=0;c<3;c++)buffers[k][dst*3+c]=raws[k][src*3+c];
  }
  slots.push(slot);cache.set(key,slot);return slot;
 }};return atlas;
}
// Simple leaves retain source-topology edge collapses. Complex twig patches
// additionally require source-UV-clipped opacity, original boundary positions,
// a source-supported center, explicit winding and bounded 3D warp. A raw hull
// alone is invalid: it can expose neighbouring leaves from the source atlas.
export function leaves(attrs,idx,far=false,optimizer=simplifier,probeLimit=Infinity,alphaImage=null){
 const {POSITION:p,TEXCOORD_0:uv}=attrs,parts=groups(p,idx),owner=new Int32Array(p.length/3),local=new Int32Array(p.length/3),partIndices=parts.map(()=>[]);
 parts.forEach((vs,k)=>vs.forEach((v,i)=>{owner[v]=k;local[v]=i}));
 for(let i=0;i<idx.length;i+=3){const k=owner[idx[i]];assert.equal(owner[idx[i+1]],k);assert.equal(owner[idx[i+2]],k);partIndices[k].push(local[idx[i]],local[idx[i+1]],local[idx[i+2]])}
 const indices=[],patches=[];let selected=0,seed=12931,totalArea=0,totalUVArea=0,retainedArea=0,retainedUVArea=0,correctedTriangles=0,maxError=0,sourceFallbacks=0;
 for(let k=0;k<Math.min(parts.length,probeLimit);k++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  if(far&&seed/4294967296>.86)continue;
  const vs=parts[k];if(vs.length<3||!partIndices[k].length)continue;selected++;
  const localAttrs={};for(const key of ['POSITION','NORMAL','TEXCOORD_0']){const width=key==='TEXCOORD_0'?2:3,b=new Float32Array(vs.length*width);vs.forEach((v,i)=>b.set(attrs[key].subarray(v*width,v*width+width),i*width));localAttrs[key]=b}
  const original=new Uint32Array(partIndices[k]),before=surfaceStats(localAttrs,original),target=Math.min(original.length,(far?4:6)*3);
  const patch=compoundPatch(localAttrs,original,far,alphaImage);
  if(patch){patches.push(patch);continue}
  let [simple,error]=optimizer.simplifyWithAttributes(original,localAttrs.POSITION,3,localAttrs.TEXCOORD_0,2,[.15,.15],null,target,far?.08:.055);
  let stats=surfaceStats(localAttrs,simple),lower=far?.84:.90;
  // Retry with the authored topology if simplification clips a blade or
  // increases its footprint. Never compensate by enlarging the whole leaf.
  if(stats.area<before.area*lower||stats.area>before.area*1.035||stats.uvArea<before.uvArea*lower||stats.uvArea>before.uvArea*1.035){
   [simple,error]=optimizer.simplifyWithAttributes(original,localAttrs.POSITION,3,localAttrs.TEXCOORD_0,2,[.25,.25],null,Math.min(original.length,Math.max(target,Math.floor(original.length*.5/3)*3)),.018);
   stats=surfaceStats(localAttrs,simple);
   if(stats.area<before.area*lower||stats.area>before.area*1.035||stats.uvArea<before.uvArea*lower||stats.uvArea>before.uvArea*1.035){simple=original;error=0;stats=before;sourceFallbacks++}
  }
  correctedTriangles+=surfaceStats(localAttrs,simple,{correctWinding:true}).flipped;
  maxError=Math.max(maxError,error);totalArea+=before.area;totalUVArea+=before.uvArea;retainedArea+=stats.area;retainedUVArea+=stats.uvArea;
  for(const v of simple)indices.push(vs[v]);
 }
 let out=compact(attrs,new Uint32Array(indices));
 // Only the primary UV set is used by leaf materials. Assemble the validated
 // source-scale compound-twig patches; wood keeps its separate UV1 untouched.
 if(alphaImage?.atlas)out.attrs.TEXCOORD_0=Float32Array.from(out.attrs.TEXCOORD_0,v=>v*.5);
 const oldVertices=out.attrs.POSITION.length/3,vertexCount=oldVertices+patches.reduce((n,p)=>n+p.attrs.POSITION.length/3,0),combined={};
 for(const key of ['POSITION','NORMAL','TEXCOORD_0']){const width=key==='TEXCOORD_0'?2:3,a=new Float32Array(vertexCount*width);a.set(out.attrs[key]);let offset=oldVertices*width;for(const patch of patches){a.set(patch.attrs[key],offset);offset+=patch.attrs[key].length}combined[key]=a}
 const combinedIndex=new Uint32Array(out.idx.length+patches.reduce((n,p)=>n+p.idx.length,0));combinedIndex.set(out.idx);let vertexOffset=oldVertices,indexOffset=out.idx.length;
 for(const patch of patches){for(const i of patch.idx)combinedIndex[indexOffset++]=i+vertexOffset;vertexOffset+=patch.attrs.POSITION.length/3}out={attrs:combined,idx:combinedIndex};
 return{...out,audit:{sourceComponents:parts.length,retainedComponents:selected,leafScale:1,positionPolicy:'Simple leaves: original topology/UV edge collapse. Compound twigs: source-boundary center-supported patch with opacity CLIPPED to original UV triangle footprint, retaining >=98% near/95% far sampled opaque silhouette and bounded 3D warp; otherwise source topology.',topologyOnlySurfaceAreaRetained:retainedArea/totalArea,topologyOnlyUVAreaRetained:retainedUVArea/totalUVArea,maximumLocalError:maxError,sourceFallbacks,correctedTriangles,compoundPatches:{count:patches.length,minOpaqueRetained:Math.min(1,...patches.map(p=>p.coverage.retained)),maxOpaqueExtra:Math.max(0,...patches.map(p=>p.coverage.extra)),maxRMSWarp:Math.max(0,...patches.map(p=>p.rms)),maxVertexWarp:Math.max(0,...patches.map(p=>p.maxError)),test:'64x64 stratified alpha silhouette samples per unique source UV topology; geometry warp checked per component; additional original-source UV opacity clip'},winding:surfaceStats(out.attrs,out.idx),triangles:out.idx.length/3}};
}
function padTransparentRGB(rgb,alpha,width,height){
 // Colour-only gutter for bilinear/mip filtering against the source's black
 // matte. Official opacity is copied unchanged, never dilated or inflated.
 let known=Uint8Array.from(alpha,a=>a>=90?1:0),pixels=Buffer.from(rgb);
 for(let pass=0;pass<8;pass++){
  const next=Buffer.from(pixels),nextKnown=Uint8Array.from(known);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const p=y*width+x;if(known[p])continue;
   const neighbors=[];if(x)neighbors.push(p-1);if(x+1<width)neighbors.push(p+1);if(y)neighbors.push(p-width);if(y+1<height)neighbors.push(p+width);
   let count=0,r=0,g=0,b=0;for(const n of neighbors)if(known[n]){count++;r+=pixels[n*3];g+=pixels[n*3+1];b+=pixels[n*3+2]}
   if(count){nextKnown[p]=1;next[p*3]=Math.round(r/count);next[p*3+1]=Math.round(g/count);next[p*3+2]=Math.round(b/count)}
  }
  pixels=next;known=nextKnown;
 }
 return pixels;
}
async function pack(model,{far=false}={}){
 const j=structuredClone(model.json),bin=await readFile(resolve(model.path,j.buffers[0].uri));
 if(model.id==='grass_bermuda_01'){
  const nodes=j.nodes.filter(n=>/_(small_[abc]|medium_c)$/.test(n.name));assert.equal(nodes.length,4);
  const meshes=nodes.map(n=>j.meshes[n.mesh]);nodes.forEach((n,i)=>n.mesh=i);j.nodes=nodes;j.meshes=meshes;j.scenes=[{nodes:nodes.map((_,i)=>i)}];j.scene=0;
 }
 const alphaPath=resolve(model.path,'alpha.png'),alpha=await sharp(alphaPath).greyscale().raw().toBuffer({resolveWithObject:true});
 const atlas=await makeLeafAtlas(model,j,alpha);if(atlas)alpha.atlas=atlas;
 const buffers=[],views=[],accessors=[];let size=0,virtualSize=0;const audits=[];
 function append(b,compression){
  const originalLength=b.length;if(compression)b=Buffer.from(encoder.encodeGltfBuffer(b,compression.count,compression.byteStride,compression.mode));
  const pad=(4-size%4)%4;if(pad){buffers.push(Buffer.alloc(pad));size+=pad}const i=views.length;
  if(compression){views.push({buffer:1,byteOffset:virtualSize,byteLength:originalLength,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:size,byteLength:b.length,...compression,filter:'NONE'}}});virtualSize+=originalLength}
  else views.push({buffer:0,byteOffset:size,byteLength:b.length});
  buffers.push(b);size+=b.length;return i;
 }
 function attr(data,type){const count=data.length/components[type],a={bufferView:append(Buffer.from(data.buffer,data.byteOffset,data.byteLength),{count,byteStride:components[type]*4,mode:type==='SCALAR'?'TRIANGLES':'ATTRIBUTES'}),componentType:data instanceof Float32Array?5126:5125,type,count};if(type==='VEC3'){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<data.length;i++){a.min[i%3]=Math.min(a.min[i%3],data[i]);a.max[i%3]=Math.max(a.max[i%3],data[i])}}const i=accessors.length;accessors.push(a);return i}
 for(const mesh of j.meshes)for(const prim of mesh.primitives){
  const attrs=Object.fromEntries(Object.entries(prim.attributes).map(([key,id])=>[key,array(model.json,bin,id)])),idx=array(model.json,bin,prim.indices),name=j.materials[prim.material].name;
  let out={attrs,idx};
  if(model.id.includes('tree')){
   if(/leaves/.test(name))out=leaves(attrs,idx,far,simplifier,Infinity,alpha);
   else {
    const target=Math.floor((/branch/.test(name)?(far?4200:11000):(far?2200:5800))*3);
    const [simple,error]=simplifier.simplify(idx,attrs.POSITION,3,Math.min(idx.length,target),.025);
    // Compact referenced vertices. No old unreferenced source buffers in GLB.
    const used=new Map(),newIndex=[];for(const i of simple){if(!used.has(i))used.set(i,used.size);newIndex.push(used.get(i))}
    const compact={};for(const [key,a]of Object.entries(attrs)){const n=a.length/(attrs.POSITION.length/3),b=new Float32Array(used.size*n);for(const [old,k]of used)for(let c=0;c<n;c++)b[k*n+c]=a[old*n+c];compact[key]=b}
    out={attrs:compact,idx:new Uint32Array(newIndex),audit:{simplification:'meshoptimizer 0.25.0 error-bound wood only',relativeError:error}};
   }
  }else if(idx.length>300){
   const [simple,error]=simplifier.simplifyWithAttributes(idx,attrs.POSITION,3,attrs.TEXCOORD_0,2,[.1,.1],null,Math.floor(idx.length*.4/3)*3,.007);
   out={...compact(attrs,simple),audit:{simplification:'UV-weighted source topology, 40% target and <=0.7% local tuft error; no whole-blade thinning',relativeError:error}};
  }
  if(!model.id.includes('tree')){const corrected=surfaceStats(out.attrs,out.idx,{correctWinding:true});out.audit={...out.audit,correctedTriangles:corrected.flipped,winding:surfaceStats(out.attrs,out.idx),sourceSurface:surfaceStats(attrs,idx)}}
  prim.attributes=Object.fromEntries(Object.entries(out.attrs).map(([key,data])=>[key,attr(data,model.json.accessors[prim.attributes[key]].type)]));prim.indices=attr(new Uint32Array(out.idx),'SCALAR');
  audits.push({name,variant:j.nodes.find(n=>j.meshes[n.mesh]===mesh)?.name,sourceTriangles:idx.length/3,triangles:out.idx.length/3,...out.audit});
 }
 let maskedPixels=0;for(const v of alpha.data)if(v>=90)maskedPixels++;
 for(const material of j.materials){
  const leaf=!model.id.includes('tree')||/leaves/.test(material.name);
  material.alphaMode=leaf?'MASK':'OPAQUE';if(leaf)material.alphaCutoff=.35;material.doubleSided=leaf;
  if(leaf){const texture=j.textures[material.pbrMetallicRoughness.baseColorTexture.index],im=j.images[texture.source],path=resolve(model.path,im.uri),rgb=atlas?{data:atlas.buffers[0],info:{width:2048,height:2048,channels:3}}:await sharp(path).removeAlpha().raw().toBuffer({resolveWithObject:true});
   const a=atlas?atlas.opacity:await sharp(alphaPath).resize(rgb.info.width,rgb.info.height).greyscale().raw().toBuffer();
   assert.equal(rgb.info.channels,3);assert.equal(a.length,rgb.info.width*rgb.info.height);
   const padded=padTransparentRGB(rgb.data,a,rgb.info.width,rgb.info.height);
   const rgba=await sharp(padded,{raw:rgb.info}).joinChannel(a,{raw:{width:rgb.info.width,height:rgb.info.height,channels:1}}).png().toBuffer();
   im.bufferView=append(rgba);im.mimeType='image/png';delete im.uri;
   if(atlas)for(let i=1;i<3;i++){const image=j.images[atlas.imageIDs[i]],bytes=await sharp(atlas.buffers[i],{raw:{width:2048,height:2048,channels:3}}).jpeg({quality:i===1?92:88}).toBuffer();image.bufferView=append(bytes);image.mimeType='image/jpeg';delete image.uri}
  }
 }
 for(const im of j.images)if(im.uri){const bytes=await sharp(resolve(model.path,im.uri)).jpeg({quality:/nor/.test(im.name)?88:82}).toBuffer();im.bufferView=append(bytes);delete im.uri}
 j.bufferViews=views;j.accessors=accessors;j.buffers=[{byteLength:size},{byteLength:virtualSize,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 j.extensionsUsed=[...new Set([...(j.extensionsUsed||[]),'EXT_meshopt_compression'])];j.extensionsRequired=[...new Set([...(j.extensionsRequired||[]),'EXT_meshopt_compression'])];
 j.asset.extras={license:'CC0-1.0',source:`https://polyhaven.com/a/${model.id}`,derivative:'Original leaf component topology/UVs, winding verified; embedded unmodified official alpha with colour-only transparent gutter; error-bounded woody simplification; lossless meshopt buffers'};
 const body0=Buffer.from(JSON.stringify(j)),body=Buffer.concat([body0,Buffer.alloc((4-body0.length%4)%4,32)]),data=Buffer.concat([...buffers,Buffer.alloc((4-size%4)%4)]),head=Buffer.alloc(20),bh=Buffer.alloc(8);
 head.writeUInt32LE(0x46546c67);head.writeUInt32LE(2,4);head.writeUInt32LE(28+body.length+data.length,8);head.writeUInt32LE(body.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(data.length);bh.writeUInt32LE(0x004e4942,4);
 const bytes=Buffer.concat([head,body,bh,data]),file=model.id+(far?'-far':'')+'.glb';await save(resolve(base,file),bytes);
 manifest.publicWhitelist.push('assets/foliage-revision/'+file);
 manifest.derivatives.push({file:'assets/foliage-revision/'+file,bytes:bytes.length,sha256:sha(bytes),primitives:audits,triangles:audits.reduce((n,a)=>n+a.triangles,0),alpha:{embedded:true,mode:'MASK',cutoff:.35,coverageAtCutoff:maskedPixels/alpha.data.length,orientation:'official unchanged; no flip',alphaInflation:false,RGBGutterPixels:8,...atlas?{atlas:{size:2048,sourceTile:1024,compoundTile:512,clipping:'Official alpha intersected with original component UV triangle coverage; no foreign atlas leaves',slots:atlas.slots}}:{}},selfContained:!j.images.some(i=>i.uri)&&!j.buffers.some(b=>b.uri)});
 console.log('Derived',file,bytes.length,'bytes',manifest.derivatives.at(-1).triangles,'triangles');
}
if(process.argv.includes('--acquire')||process.argv.includes('--build')){
 if(process.argv.includes('--build')){
  const url='https://cdn.jsdelivr.net/npm/meshoptimizer@0.25.0/meshopt_simplifier.module.js',path=resolve(source,'toolchain/meshopt_simplifier.mjs');
  const bytes=process.argv.includes('--cached')?await readFile(path):await get(url);await save(path,bytes);
  const licenseURL='https://cdn.jsdelivr.net/npm/meshoptimizer@0.25.0/LICENSE.md',license=process.argv.includes('--cached')?await readFile(resolve(source,'toolchain/LICENSE.md')):await get(licenseURL);await save(resolve(source,'toolchain/LICENSE.md'),license);
  manifest.processingTool={name:'meshoptimizer',version:'0.25.0',license:'MIT',source:url,sha256:sha(bytes),licenseURL};
  simplifier=(await import(new URL('../assets/foliage-revision/source/toolchain/meshopt_simplifier.mjs',import.meta.url))).MeshoptSimplifier;await simplifier.ready;
  const encodeURL='https://cdn.jsdelivr.net/npm/meshoptimizer@0.25.0/meshopt_encoder.module.js',encodeBytes=process.argv.includes('--cached')?await readFile(resolve(source,'toolchain/meshopt_encoder.mjs')):await get(encodeURL);await save(resolve(source,'toolchain/meshopt_encoder.mjs'),encodeBytes);
  manifest.processingTool.encoder={url:encodeURL,sha256:sha(encodeBytes)};
  encoder=(await import(new URL('../assets/foliage-revision/source/toolchain/meshopt_encoder.mjs',import.meta.url))).MeshoptEncoder;await encoder.ready;
 }
 for(const id of ids){const model=await acquire(id);if(process.argv.includes('--build')){await pack(model);if(id.includes('tree'))await pack(model,{far:true})}}
 await save(resolve(root,'foliage-revision.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
}

// Add/rebuild only the already-present Bermuda derivative. Preserve every
// existing tree/grass asset byte and manifest hash; no acquisition requests.
if(process.argv.includes('--bermuda')){
 Object.assign(manifest,JSON.parse(await readFile(resolve(root,'foliage-revision.json'),'utf8')));manifest.date=new Date().toISOString();
 manifest.sources=manifest.sources.filter(s=>s.id!=='grass_bermuda_01');manifest.derivatives=manifest.derivatives.filter(d=>!d.file.endsWith('/grass_bermuda_01.glb'));manifest.publicWhitelist=manifest.publicWhitelist.filter(p=>!p.endsWith('/grass_bermuda_01.glb'));
 simplifier=(await import(new URL('../assets/foliage-revision/source/toolchain/meshopt_simplifier.mjs',import.meta.url))).MeshoptSimplifier;await simplifier.ready;
 encoder=(await import(new URL('../assets/foliage-revision/source/toolchain/meshopt_encoder.mjs',import.meta.url))).MeshoptEncoder;await encoder.ready;
 await pack(await acquireExistingBermuda());await save(resolve(root,'foliage-revision.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
}

if(process.argv.includes('--audit')){
 const m=JSON.parse(await readFile(resolve(root,'foliage-revision.json'),'utf8'));
 let verifiedSources=0,sourceBytes=0;for(const entry of m.sources)for(const item of entry.files){const bytes=await readFile(resolve(root,item.path));assert.equal(bytes.length,item.bytes);assert.equal(sha(bytes),item.sha256);assert.equal(sha(bytes,'md5'),item.officialMD5);verifiedSources++;sourceBytes+=bytes.length}
 const T=await import('../../sunbreak-storm-v3/vendor/presentation/build/three.module.js');
 const {MeshoptDecoder}=await import('../../sunbreak-storm-v3/vendor/presentation/examples/jsm/libs/meshopt_decoder.module.js');await MeshoptDecoder.ready;
 const {vegetationPlan}=await import('../vegetation.js');const {vegetationAllowed,MAP,crossings,landscapeHeight}=await import('../map-layout.js');
 const scenes=new Map(),geometryChecks=[];let decodedViews=0,primitives=0,alphaImages=0,officialAlphaPixels=0;
 for(const item of m.derivatives){
  const bytes=await readFile(resolve(root,item.file));assert.equal(sha(bytes),item.sha256);assert.equal(bytes.length,item.bytes);
  const n=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+n).toString()),bin=bytes.subarray(28+n),decoded=[];
  for(const view of j.bufferViews){const e=view.extensions?.EXT_meshopt_compression;if(e){const out=new Uint8Array(e.count*e.byteStride);MeshoptDecoder.decodeGltfBuffer(out,e.count,e.byteStride,bin.subarray(e.byteOffset,e.byteOffset+e.byteLength),e.mode,e.filter);decoded.push(out);decodedViews++}else decoded.push(bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength))}
  assert.ok(j.images.every(i=>i.bufferView!==undefined&&!i.uri));
  const scene=new T.Group();
  const materials=j.materials.map(mat=>{
   const material=new T.MeshStandardMaterial({name:mat.name,alphaTest:mat.alphaCutoff||0,side:mat.doubleSided?T.DoubleSide:T.FrontSide});
   material.map=new T.Texture();material.roughnessMap=new T.Texture();material.normalMap=new T.Texture();return material;
  });
  // Validate decoded image alpha, not only glTF's declared MASK flag.
  for(const mat of j.materials)if(mat.alphaMode==='MASK'){
   const image=j.images[j.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source];
   const meta=await sharp(decoded[image.bufferView]).metadata();assert.ok(meta.hasAlpha);alphaImages++;
   const originalID=item.file.split('/').at(-1).replace('-far','').replace('.glb',''),official=await sharp(resolve(source,originalID,'alpha.png')).greyscale().raw().toBuffer(),embedded=await sharp(decoded[image.bufferView]).extractChannel(3).raw().toBuffer();
   // Atlas keeps the entire unmodified 1k source in its top-left tile. This
   // catches alpha channel conversion, flipping and accidental opacity growth.
   for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){assert.equal(embedded[y*meta.width+x],official[y*1024+x],'official opacity alignment');officialAlphaPixels++}
  }
  for(const node of j.nodes){if(node.mesh===undefined)continue;const group=new T.Group();group.name=node.name;
   if(node.translation)group.position.fromArray(node.translation);if(node.scale)group.scale.fromArray(node.scale);if(node.rotation)group.quaternion.fromArray(node.rotation);
   for(const p of j.meshes[node.mesh].primitives){
    const geo=new T.BufferGeometry();const count=j.accessors[p.attributes.POSITION].count;
    for(const [key,id]of Object.entries(p.attributes)){
     const a=j.accessors[id],C=types[a.componentType],raw=decoded[a.bufferView],data=new C(Uint8Array.from(raw).buffer);
     assert.ok(Number.isInteger(a.count));assert.equal(a.count,count);assert.equal(data.length,a.count*components[a.type]);assert.ok(data.every(Number.isFinite));
     const name=key==='POSITION'?'position':key==='NORMAL'?'normal':key==='TEXCOORD_0'?'uv':key==='TEXCOORD_1'?'uv1':key.toLowerCase();
     geo.setAttribute(name,new T.BufferAttribute(data,components[a.type]));
    }
    const a=j.accessors[p.indices],data=new types[a.componentType](Uint8Array.from(decoded[a.bufferView]).buffer);assert.ok(data.every(i=>i<count),`${item.file} ${node.name} ${j.materials[p.material].name}: index max ${data.reduce((n,i)=>Math.max(n,i),0)} >= vertex count ${count}; type ${a.componentType}`);geo.setIndex(new T.BufferAttribute(data,1));
    if(j.materials[p.material].alphaMode==='MASK'){
     const stats=surfaceStats({POSITION:geo.attributes.position.array,NORMAL:geo.attributes.normal.array,TEXCOORD_0:geo.attributes.uv.array},data);
     assert.ok(stats.backwardsAreaFraction<1e-8,`${item.file}/${node.name}: reversed leaf winding`);geometryChecks.push({file:item.file,node:node.name,triangles:data.length/3,backwardsAreaFraction:stats.backwardsAreaFraction});
    }
    group.add(new T.Mesh(geo,materials[p.material]));primitives++;
   }scene.add(group);
  }
  scenes.set(item.file.split('/').at(-1),scene);
 }
 const plan=vegetationPlan();assert.deepEqual(vegetationPlan(),plan,'deterministic ecology');
 const inside=p=>p.x>=MAP.minX&&p.x<=MAP.maxX&&p.z>=MAP.minZ&&p.z<=MAP.maxZ;
 let groundChecks=0;
 for(const p of [...plan.low,...plan.medium,...plan.tall]){
  assert.ok(Math.abs(p.y-(landscapeHeight(p.x,p.z)-.018))<1e-8,'grass grounded on landscape');
  if(inside(p)){assert.ok(vegetationAllowed(p.x,p.z),'map/cabin exclusion');assert.ok(Math.abs(Math.abs(p.x)-(10+.32*Math.sin(p.z*.19)))>1.55,'dirt paths');assert.ok(crossings.every(c=>Math.abs(p.z-c)>2.1),'crossings')}groundChecks++;
 }
 for(const p of [...plan.trunks,...plan.shrubs])assert.ok(!inside(p),'no uncollided tree inside map');
 const infill=plan.low.filter(p=>p.infill);
 assert.equal(infill.length,plan.infill.added);assert.ok(infill.length>=10000&&infill.length<=18000,'bounded playable infill only');
 assert.equal(plan.low.length-plan.infill.baselineLow,infill.length);
 assert.ok(infill.every(p=>inside(p)&&p.s>=.91&&p.s<=1.13),'only short playable infill');
 // Exercise actual runtime batching and wind hooks in Three.js without browser,
 // GPU, texture upload or starting any server/process. Loader is a scene fixture
 // from the exact decoded GLBs above; this is NOT a render/performance pass.
 class GLTFLoader {setMeshoptDecoder(){return this}async loadAsync(path){const scene=scenes.get(path.split('/').at(-1));assert.ok(scene);return {scene}}}
 const runtime=await readFile(resolve(root,'vegetation.js'),'utf8');
 const fnText=runtime.slice(runtime.indexOf('export async function buildVegetation')).replace('export async','async').replace(/ const \{GLTFLoader\}=await import\([^;]+;/,'').replace(/ const \{MeshoptDecoder\}=await import\([^;]+;/,'');
 const build=new Function('vegetationPlan','GLTFLoader','MeshoptDecoder','return '+fnText)(vegetationPlan,GLTFLoader,MeshoptDecoder),world=new T.Group();
 const result=await build(T,world);result.update(12.3);let shadowMatches=0,rootBounds=0;
 for(const mesh of world.children){
  assert.ok(Number.isFinite(mesh.boundingSphere.radius));
  if(mesh.castShadow){const input=()=>({uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>'}),visible=input(),depth=input(),distance=input();mesh.material.onBeforeCompile(visible);mesh.customDepthMaterial.onBeforeCompile(depth);mesh.customDistanceMaterial.onBeforeCompile(distance);assert.equal(visible.vertexShader,depth.vertexShader);assert.equal(visible.vertexShader,distance.vertexShader);assert.equal(visible.uniforms.uFoliageTime.value,12.3);shadowMatches++}
  if(/trunk|^island_tree_01$/.test(mesh.material.name)){
   mesh.geometry.computeBoundingBox();const matrix=new T.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const b=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);assert.ok(b.max.x<MAP.minX||b.min.x>MAP.maxX||b.max.z<MAP.minZ||b.min.z>MAP.maxZ,'transformed solid trunk bounds outside play');rootBounds++}
  }
 }
 const info=result.info();console.log('CPU batching totals',JSON.stringify(info));
 // The unchanged infill now uses 12–20 triangle green Bermuda, not the
 // 381–464 triangle seed-grass variants. Four variants add 16 sector draws.
 const planningCaps={triangles:38000000+18000*20,drawCalls:125,shadowCalls:24,shadowTriangles:6000000,additionalLowGrass:18000};
 assert.ok(info.triangles<planningCaps.triangles);assert.ok(info.drawCalls<=planningCaps.drawCalls);assert.ok(info.shadowCalls<=planningCaps.shadowCalls);assert.ok(info.shadowTriangles<planningCaps.shadowTriangles);
 assert.equal(info.counts['bermuda-base'],infill.length);assert.equal(info.counts['low-grass'],plan.infill.baselineLow);assert.ok(info.infill.triangles<=infill.length*20);assert.equal(info.infill.drawCalls,16);
 m.runtime={...info,allBatchesWorstCase:true,assetBytes:m.derivatives.reduce((s,a)=>s+a.bytes,0),decoder:'../vendor/presentation/examples/jsm/libs/meshopt_decoder.module.js',publicWhitelist:m.publicWhitelist};
 m.validation={date:new Date().toISOString(),verdict:'CPU-ONLY PASS / RENDER AND PERFORMANCE PENDING',verifiedOfficialSourceFiles:verifiedSources,sourceBytes,decodedViews,primitives,embeddedAlphaMaterials:alphaImages,officialAlphaPixelsMatched:officialAlphaPixels,geometryChecks,planningCaps,groundChecks,transformedRootBounds:rootBounds,matchingVisibleDepthDistanceWind:shadowMatches,deterministic:true,noBrowserOrGPUUsed:true,sourceHashes:{vegetation:sha(Buffer.from(runtime)),tool:sha(await readFile(fileURLToPath(import.meta.url))),layout:sha(await readFile(new URL('../map-layout.js',import.meta.url)))}};
 m.derivationNotes=['Near canopy retains all original connected leaf components; far retains 86% deterministically with no leaf enlargement. Simple leaves use source-topology/UV-weighted edge collapse and measured area bounds.','Compound-twig envelopes preserve source boundary positions and use a source-supported center. Their opacity is clipped to the original source UV triangles in a dedicated atlas tile: neighbouring atlas leaves are not exposed. >=98% near/95% far sampled opaque coverage; <=5% near/7.5% far RMS 3D warp. Full source-topology fallback if any constraint fails.','Trees use two authored crown/trunk shapes at near 10.4m/11.6m and far 12.8m/14m plus bounded instance scale. Whole-tree scale differs from the scan; individual leaf scale compensation is never used.','Official alpha remains unflipped and uninﬂated. RGB-only 8px transparent gutter prevents black-matte filtering fringes. ARM uses AO red/roughness green; leaf AO .18 and nearly neutral linear tint replace .65 AO and the dark sRGB multiplier.','Original grass_medium layers retain a 40% triangle target with <=0.7% local-extent error and UV weighting. They remain unchanged in the Bermuda follow-up.','Playable infill keeps the same jittered .27m lattice and coherent patch gaps: banks x~+/-6..8, outer house margins, and between houses. Only the infill species changes to grass_bermuda_01 small_a/b/c and medium_c. Their unchanged source topology totals 62 triangles across four variants; heights .14/.18/.22/.23m avoid inflating the flattened tufts. Runtime.infill records counts and cost.','Bermuda comes from the existing official CC0 package verified against asset-sources.json SHA256/MD5/size; no network download. Its separate compact GLB embeds official alpha with RGB gutter and verifies winding. The preceding six GLBs are unchanged. Four variants in four sectors add 16 non-shadow draws, no new trees or shadow batches.','Map predicate, cabin exclusions, dirt lanes and crossings remain enforced per tuft. No woody bounds intersect play. Visible/depth/distance wind is identical and bounded. Every public asset and manifest replaces atomically.'];
 m.integrationFixes=['Historical intermediate grass Uint16 data was incorrectly declared/encoded with a 32-bit stride; all emitted indices are now Uint32 and all decoded index/accessor checks pass.','Tree_small_02 UV1 is VEC2; branch textures preserve that channel.','03:33 raw convex-hull leaf derivation reversed area-weighted winding by 100% for island_tree_01 and ~70.7% for tree_small_02. Current decoded MASK geometry is checked for zero reversed area.','Raw compound UV envelopes exposed neighbouring atlas leaves (sampled excess 13%–122% depending source shape). Derived compound atlas opacity is now intersected with each component original UV footprint.','Official alpha/diffuse channel alignment was correct; neither is flipped. The prior dark tint multiplied linear albedo by roughly .47/.55/.39 before AO and instance colour, unnecessarily crushing leaf bodies.','No-post diagnostic retained the failure, so SSAO was not its primary cause. Main owns potential alpha-aware SSAO follow-up.'];
 m.limits=['CPU checks are not visual or runtime acceptance. Await main new headless frames and 1080p benchmark; no AAA pass.','Tree Small 02 is Burkea africana, a visual stand-in rather than a verified Vietnamese species.','More complete foliage geometry intentionally increases the prior ~10.9M worst-case triangle baseline. Spatial culling reduces actual visibility but is not a substitute for measured performance.','Compound leaves use bounded curvature approximation and 512px source-clipped tiles in a 2048px atlas. Far retains 86% components. Review movement/shimmer and silhouette, not merely one still.','Public deployment should include only the current publicWhitelist GLBs, foliage-revision.json and vegetation.js; source originals/toolchain stay off web.','Bermuda infill is much cheaper in triangles but introduces 16 additional draws and overlapping alpha-tested blades. Verify visible density, natural leaf scale, overdraw and movement shimmer in current-build evidence.','Whole-scene 1080p p95/p99<=33.3ms and max<=50ms remain unchanged. Main reported prior p99~16.8ms with two hitches; that does not qualify this revision.'];
 await save(resolve(root,'foliage-revision.json'),Buffer.from(JSON.stringify(m,null,2)+'\n'));console.log(JSON.stringify({runtime:m.runtime,validation:m.validation},null,2));
}
