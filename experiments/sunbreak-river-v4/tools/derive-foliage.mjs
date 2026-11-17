// Preserve whole scanned leaves, instead of simplifying each leaf into shards.
// Decimate disconnected leaf components, then broaden retained leaf silhouettes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL('../assets/island_tree_02/',import.meta.url);
const original=JSON.parse(await readFile(new URL('island_tree_02.gltf',base),'utf8'));
const source=await readFile(new URL(original.buffers[0].uri,base));
function array(j,bin,id){const a=j.accessors[id],v=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],C={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType];if(v.byteStride)throw Error('Unexpected stride');return new C(Uint8Array.from(bin.subarray((v.byteOffset||0)+(a.byteOffset||0),(v.byteOffset||0)+(a.byteOffset||0)+a.count*n*C.BYTES_PER_ELEMENT)).buffer)}
const primitive=original.meshes[0].primitives.find(p=>original.materials[p.material].name.endsWith('_leaves'));
const positions=array(original,source,primitive.attributes.POSITION),indices=array(original,source,primitive.indices),count=positions.length/3;
const parent=Int32Array.from({length:count},(_,i)=>i);
function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i}
for(let i=0;i<indices.length;i+=3){const r=root(indices[i]);parent[root(indices[i+1])]=r;parent[root(indices[i+2])]=r}
const groups=new Map();for(let i=0;i<count;i++){const r=root(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i)}
const attributes=Object.fromEntries(Object.entries(primitive.attributes).map(([key,id])=>[key,array(original,source,id)]));
const receipts=[];
for(const [name,keep,scale] of [['tree-lod.glb',.13,2.2],['tree-far.glb',.045,3.2]]){
 const bytes=await readFile(new URL(name,base)),jsonSize=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jsonSize).toString());
 const bin=bytes.subarray(28+jsonSize),parts=[bin];let length=bin.length;
 const selected=new Set(),centers=new Map();let seed=717111;
 for(const [r,vertices]of groups){seed=(Math.imul(seed,1664525)+1013904223)>>>0;if(seed/4294967296>keep)continue;const c=[0,0,0];for(const v of vertices)for(let k=0;k<3;k++)c[k]+=positions[v*3+k]/vertices.length;for(const v of vertices){selected.add(v);centers.set(v,c)}}
 const lookup=new Map(),newIndex=[];for(let i=0;i<indices.length;i+=3){if(!selected.has(indices[i]))continue;for(let k=0;k<3;k++){const v=indices[i+k];if(!lookup.has(v))lookup.set(v,lookup.size);newIndex.push(lookup.get(v))}}
 function append(data,type,componentType,min,max){const pad=(4-length%4)%4;if(pad){parts.push(Buffer.alloc(pad));length+=pad}const buffer=Buffer.from(data.buffer,data.byteOffset,data.byteLength),view=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:length,byteLength:buffer.length});parts.push(buffer);length+=buffer.length;const id=j.accessors.length;j.accessors.push({bufferView:view,componentType,count:data.length/({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type]),type,...min?{min,max}:{}});return id}
 const target=j.meshes.flatMap(m=>m.primitives).find(p=>j.materials[p.material].name.endsWith('_leaves'));target.attributes={};
 for(const [key,data]of Object.entries(attributes)){
  const a=original.accessors[primitive.attributes[key]],n=data.length/count,out=new Float32Array(lookup.size*n),min=Array(n).fill(Infinity),max=Array(n).fill(-Infinity);
  for(const [old,idx]of lookup)for(let k=0;k<n;k++){const value=key==='POSITION'?centers.get(old)[k]+(data[old*n+k]-centers.get(old)[k])*scale:data[old*n+k];out[idx*n+k]=value;min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value)}
  target.attributes[key]=append(out,a.type,5126,key==='POSITION'?min:undefined,max);
 }
 target.indices=append(new Uint32Array(newIndex),'SCALAR',5125);j.buffers=[{byteLength:length}];
 j.asset.extras={...j.asset.extras,foliageDerivative:'whole-leaf component thinning, broadened canopy; not scan-original geometry'};
 let body=Buffer.from(JSON.stringify(j));body=Buffer.concat([body,Buffer.alloc((4-body.length%4)%4,32)]);const binary=Buffer.concat([...parts,Buffer.alloc((4-length%4)%4)]),header=Buffer.alloc(20),bh=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+body.length+binary.length,8);header.writeUInt32LE(body.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
 const output=Buffer.concat([header,body,bh,binary]);await writeFile(new URL(name,base),output);receipts.push({name,leafTriangles:newIndex.length/3,wholeComponents:groups.size,keep,scale,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex')});
}
await writeFile(new URL('../foliage-derivatives.json',import.meta.url),JSON.stringify({method:'Original Poly Haven CC0 leaves retained as whole components with silhouette enlargement; trunk/branches glTF-Transform simplification',receipts},null,2)+'\n');console.log(receipts);
