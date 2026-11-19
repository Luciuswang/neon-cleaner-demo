// User-owned scans are an optional LOCAL preview layer, not public assets.
import {MAP,landscapeHeight,groundHeight,riverWidth,crossings,spawns,teamSpawns,bufferPlacements,houses,blocked,inBuffer,rubbleHeight} from './map-layout.js';
import {grassAllowed} from './vegetation.js';
export const DRESSING_REVISION='downloaded-scans-local-v2';
export const DRESSING_BUDGET={bytes:25000000,triangles:500000,draws:60};
const outside=(x,z,r=0)=>x+r<MAP.minX-1||x-r>MAP.maxX+1||z+r<MAP.minZ-1||z-r>MAP.maxZ+1;
export function clearGrassFootprint(x,z,r){
 const clear=(px,pz)=>{
  const exterior=outside(px,pz);
  const base=exterior?grassAllowed(px,pz,.3):!blocked(px,pz,.22)&&!inBuffer(px,pz,.65)&&rubbleHeight(px,pz)<.001&&
   houses.every(h=>!(Math.abs(px-h.x)<3.65&&Math.abs(pz-h.z)<3.65)&&!(Math.abs(px-h.x)<1.35&&Math.abs(pz-h.z)<6))&&Math.abs(Math.abs(px)-(10+.32*Math.sin(pz*.19)))>1.85;
  return base&&Math.abs(px)>riverWidth(pz)+2&&crossings.every(v=>Math.abs(pz-v)>2.6)&&[...spawns,...teamSpawns].every(p=>Math.hypot(px-p[0],pz-p[2])>2.1);
 };
 if(!clear(x,z))return false;
 for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!clear(x+Math.cos(a)*r,z+Math.sin(a)*r))return false}return true;
}
export function dressingPlan(assets){
 let seed=7331964;const R=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const placements=[],counts={},cost={grass:0,rubble:0,wall:0,house:0,tree:0};
 const budgets={grass:260000,rubble:55000,wall:65000,house:80000,tree:90000};
 function add(a,x,z,height,yaw,zone){
  const s=height/a.dimensions[1],radius=Math.hypot(a.dimensions[0],a.dimensions[2])*s*.5;
  const micro=a.id==='cement-rubble-small';
  if(a.kind==='grass'||micro?!clearGrassFootprint(x,z,radius+.05):!outside(x,z,radius))return false;
  if(micro&&(height>.026||Math.abs(groundHeight(x+radius,z)-groundHeight(x-radius,z))>.003))return false;
  if((cost[a.kind]||0)+a.triangles>budgets[a.kind])return false;
  if(Object.values(cost).reduce((n,v)=>n+v,0)+a.triangles>DRESSING_BUDGET.triangles)return false;
  if(a.kind!=='grass'&&placements.some(p=>p.kind!=='grass'&&Math.hypot(p.x-x,p.z-z)<(p.radius+radius)*.75))return false;
  placements.push({id:a.id,kind:a.kind,micro,x,y:landscapeHeight(x,z)-(a.kind==='grass'?.014:micro?.006:.06),z,scale:s,height,yaw,radius,zone});
  counts[a.id]=(counts[a.id]||0)+1;cost[a.kind]+=a.triangles;return true;
 }
 const houseAssets=assets.filter(a=>a.kind==='house');
 // Source frame clearance is 3.003m at 9.1996m overall height: scale to a 2m doorway.
 for(const a of houseAssets.slice(0,1))for(const side of [-1,1])add(a,side*12,side===-1?-40.5:33,6.126,side===-1?.08:Math.PI+.08,'outer-settlement');
 const trees=assets.filter(a=>a.kind==='tree');
 for(const a of trees.slice(0,1))for(const [x,z,h]of [[-14,-46,8.1],[15,38,8.6],[-40,5,7.7],[40,-10,8.2]])add(a,x,z,h,R()*6.28,'river-end-grove');
 const walls=assets.filter(a=>a.kind==='wall');
 for(let i=0;i<walls.length;i++)for(const side of [-1,1]){
  const a=walls[i],anchorZ=side===-1?12:-9,z=anchorZ+[0,2.8,-1.7][i%3],x=side*([34.7,35.5,36.5][i%3]);
  add(a,x,z,Math.min(1.05+i*.25,a.dimensions[1]*1.12),[.4,1.35,.18][i%3]*side,'outer-mossy-boundary');
 }
 const rubble=assets.filter(a=>a.kind==='rubble');
 for(const a of rubble){
  if(a.id==='cement-rubble-small'){
   for(const h of houses.filter(h=>h.ruin>0))for(let i=0;i<30;i++){
    const side=i%2?-1:1,x=h.x+side*(3.9+R()*.65),z=h.z-2.8+R()*5.6;
    add(a,x,z,.018+R()*.008,R()*6.28,'plaster-ruin-chip-margin');
   }
  }else for(const side of [-1,1])add(a,side*20,side===-1?-36.5:29,.16,R()*6.28,'outer-plaster-ruin-collapse');
 }
 const grasses=assets.filter(a=>a.kind==='grass');
 if(grasses.length){
  // Random lobed patches, continuous sampling, and deliberately bare paths.
  const patches=houses.flatMap(h=>[-1,1].map(side=>({x:h.x+side*4.25,z:h.z+2.9,rx:.55,rz:1.35,angle:0,bank:false})));
  patches.push({x:-34.5,z:13,rx:1.5,rz:1.1,angle:.5,bank:false},{x:34.5,z:-8,rx:1.5,rz:1.1,angle:-.5,bank:false});
  for(let n=0;n<75;n++){
   const z=-32+R()*59,side=R()<.5?-1:1,bank=R()<.5,x=side*(bank?riverWidth(z)+2.8+R()*1.7:12+R()*20);
   if(!clearGrassFootprint(x,z,.25)||patches.some(p=>Math.hypot(x-p.x,z-p.z)<1.3))continue;
   patches.push({x,z,rx:bank?.65+R()*.5:1.2+R(),rz:.8+R()*.7,angle:bank?Math.PI*.5:R()*6.28,bank});
  }
  // Reserve a small mixed woodland strip before spending the foreground budget.
  for(let n=0;n<36;n++){
   const side=n%2?-1:1,x=side*(34+R()*12),z=-38+R()*72,a=grasses[n%grasses.length];
   add(a,x,z,.22+R()*.16,R()*6.28,'woodland-understorey');
  }
  // Thin dark dry stems belong in the woodland transition, not foreground lawns.
  const low=grasses.filter(a=>['tundra-grass-d','tundra-grass-h'].includes(a.id)),accents=grasses.filter(a=>a.id==='tundra-grass-a');
  for(const p of patches)for(let n=0;n<28;n++){
   const angle=R()*6.28,r=Math.sqrt(R()),u=Math.cos(angle)*r*p.rx,v=Math.sin(angle)*r*p.rz;
   const x=p.x+u*Math.cos(p.angle)-v*Math.sin(p.angle),z=p.z+u*Math.sin(p.angle)+v*Math.cos(p.angle),pool=R()<.86?low:accents,a=pool[Math.floor(R()*pool.length)]||grasses[0];
   const height=.15+R()*.15;if(placements.some(q=>q.kind==='grass'&&Math.hypot(q.x-x,q.z-z)<.19))continue;
   add(a,x,z,height,R()*6.28,p.bank?'wet-bank-grass':'idle-ground-grass');
  }
 }
 return{placements,counts,triangles:Object.values(cost).reduce((a,b)=>a+b,0),cost,budgets};
}
export async function buildDownloadedDressing(T,world){
 const state={revision:DRESSING_REVISION,enabled:false,status:'baseline',errors:[],assets:[],counts:{},batches:[],triangles:0,draws:0,textureBytes:0,consumedHashes:{}};
 const group=new T.Group();group.name='local-downloaded-dressing';
 const time={value:0},loaded=new Map();let preview=null,hidden=[];
 const info=()=>({...state,counts:{...state.counts},batches:state.batches.map(b=>({...b}))});
 const result={update(t){time.value=t},info,setVisible(v){group.visible=!!v},reviewAsset(id){
  if(preview){world.remove(preview);preview=null;for(const [o,v]of hidden)o.visible=v;hidden=[]}
  if(!id)return null;const source=loaded.get(id);if(!source)throw Error('Unknown review asset');
  hidden=world.children.map(o=>[o,o.visible]);world.children.forEach(o=>{o.visible=false});
  preview=new T.Group();preview.name='local-asset-review';const clone=source.scene.clone(true);preview.add(clone);
  clone.updateMatrixWorld(true);const box=new T.Box3().setFromObject(clone),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  clone.position.sub(new T.Vector3(center.x,box.min.y,center.z));
  const floor=new T.Mesh(new T.PlaneGeometry(300,300),new T.MeshStandardMaterial({color:0x72766a,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;preview.add(floor);world.add(preview);
  const distance=Math.max(size.x,size.y,size.z)*1.1;return{size:size.toArray(),camera:[distance*.55,size.y*.45+distance*.3,distance*.8,Math.atan2(distance*.55,distance*.8),-Math.atan2(distance*.3,distance*Math.hypot(.55,.8))]};
 }};
 const permitted=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&new URLSearchParams(location.search).get('dressing')!=='off';
 if(!permitted)return result;
 const abort=new AbortController();let deadline;
 const timeout=new Promise((_,reject)=>{deadline=setTimeout(()=>{abort.abort();reject(Error('Optional scan loading exceeded 25s'))},25000)});
 const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');
 const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[])){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose?.()}});
 try{
  const expectedEnabled=!!globalThis.__riverExpectedLocalHashes?.['local-only/manifest.json'];
  const response=await Promise.race([fetch('./river/local-assets/manifest.json',{signal:abort.signal}),timeout]);
  if(response.status===404){if(expectedEnabled)throw Error('Expected local scan pack became missing');state.status='missing';return result}if(!response.ok)throw Error('Local scan manifest unavailable');
  const manifestBytes=await response.arrayBuffer(),manifest=JSON.parse(new TextDecoder().decode(manifestBytes));
  if(!manifest.enabled){if(expectedEnabled)throw Error('Expected local scan pack became disabled');state.status='missing-or-disabled';return result}
  state.consumedHashes['local-only/served-manifest.json']=await hash(manifestBytes);
  state.consumedHashes['local-only/manifest.json']=manifest.sourceManifestSHA256;
  if(manifest.schema!==1||!Array.isArray(manifest.assets)||manifest.bytes>DRESSING_BUDGET.bytes)throw Error('Invalid local scans');
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
  const loader=new GLTFLoader();
  await Promise.race([Promise.all(manifest.assets.map(async a=>{
   const response=await fetch(a.url,{signal:abort.signal});if(!response.ok)throw Error('Local scan unavailable '+a.id);
   const buffer=await response.arrayBuffer(),digest=await hash(buffer);if(digest!==a.sha256||buffer.byteLength!==a.bytes)throw Error('Consumed scan mismatch '+a.id);
   state.consumedHashes['local-only/'+a.file]=digest;
   const parsed=await loader.parseAsync(buffer,'');if(abort.signal.aborted){dispose(parsed.scene);throw Error('Scan load cancelled')};loaded.set(a.id,parsed);
  })),timeout]);
  const expected=globalThis.__riverExpectedLocalHashes;
  if(expected&&[...new Set([...Object.keys(expected),...Object.keys(state.consumedHashes)])].some(k=>expected[k]!==state.consumedHashes[k]))throw Error('Local scan pack changed after page snapshot');
  const plan=dressingPlan(manifest.assets),matrix=new T.Object3D(),color=new T.Color(),textures=new Set();
  for(const asset of manifest.assets){
   const source=loaded.get(asset.id).scene;source.updateMatrixWorld(true);
   const box=new T.Box3().setFromObject(source),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   if(size.toArray().some((v,i)=>Math.abs(v-asset.dimensions[i])>Math.max(.02,v*.02)))throw Error('Asset dimension mismatch '+asset.id);
    const ps=plan.placements.filter(p=>p.id===asset.id),grass=asset.kind==='grass',shadow=!grass&&asset.id!=='cement-rubble-small';
   source.traverse(node=>{
    if(!node.isMesh)return;
    const geo=node.geometry.clone().applyMatrix4(node.matrixWorld);geo.translate(-center.x,-box.min.y,-center.z);
    const mat=node.material.clone();mat.metalness=0;mat.envMapIntensity=.5;mat.roughness=Math.max(.8,mat.roughness);mat.aoMapIntensity=.45;
    mat.forceSinglePass=true;
    if(asset.id==='cement-rubble-small')mat.color.multiply(new T.Color(.72,.64,.5));
    if(grass){mat.transparent=false;mat.depthWrite=true;mat.side=T.DoubleSide;mat.alphaTest=Math.max(.35,mat.alphaTest);mat.normalScale?.multiplyScalar(.5)}
    for(const [key,value]of Object.entries(mat))if(value?.isTexture){value.anisotropy=8;if(!textures.has(value)){textures.add(value);const im=value.image;state.textureBytes+=(im?.width||0)*(im?.height||0)*4*4/3}}
    if(grass){
     mat.onBeforeCompile=s=>{s.uniforms.uScanWind=time;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uScanWind;').replace('#include <begin_vertex>',`#include <begin_vertex>\nfloat scanBend=pow(clamp(position.y/${size.y.toFixed(5)},0.,1.),2.);transformed.x+=sin(uScanWind*1.35+instanceMatrix[3].x*.7+instanceMatrix[3].z*.4)*.025*scanBend;`)};
     mat.customProgramCacheKey=()=>`scan-grass-wind-${asset.id}`;
    }
    for(const side of [-1,1]){
     const places=ps.filter(p=>Math.sign(p.x)===side);if(!places.length)continue;
     const inst=new T.InstancedMesh(geo,mat,places.length);inst.name='scan-'+asset.id+'-'+side;
     places.forEach((p,i)=>{matrix.position.set(p.x,p.y,p.z);matrix.rotation.set(0,p.yaw,0);matrix.scale.setScalar(p.scale);matrix.updateMatrix();inst.setMatrixAt(i,matrix.matrix);const t=.94+(i%7)*.01;color.setRGB(t,t,t);inst.setColorAt(i,color)});
     inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();inst.boundingSphere.radius+=.1;group.add(inst);
     const triangles=(geo.index?.count||geo.attributes.position.count)/3*places.length;
     state.batches.push({asset:asset.id,side,instances:places.length,triangles,shadow});state.triangles+=triangles;state.draws++;
    }
   });
  }
  if(state.triangles>DRESSING_BUDGET.triangles||state.draws>DRESSING_BUDGET.draws)throw Error('Imported layer exceeds geometry/draw budget');
  state.enabled=true;state.status='local-only';state.assets=manifest.assets;state.counts=plan.counts;state.plan=plan;state.bytes=manifest.bytes;
  state.shadowTriangles=state.batches.filter(b=>b.shadow).reduce((n,b)=>n+b.triangles,0);state.shadowDraws=state.batches.filter(b=>b.shadow).length;
  state.reflectionMaximumAdditionalTriangles=state.triangles;state.reflectionMaximumAdditionalDraws=state.draws;
  world.add(group);
 }catch(e){abort.abort();state.errors.push(String(e.message));state.status='fallback-error';state.enabled=false;group.visible=false;dispose(group);for(const item of loaded.values())dispose(item.scene);loaded.clear()}
 finally{clearTimeout(deadline)}
 return result;
}
