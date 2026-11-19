// Read-only CPU regression: no browser, GPU, server, reports or network writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {buildVillage} from '../village.js';
import {layout} from '../map-layout.js';
import {stoneCoverPlan,isStoneCover,STONE_COVER_LIMITS} from '../stone-cover.js';
import {createMasonryMaterial,composeMasonryHook,MASONRY_SCALE,MASONRY_FIELDS_GLSL} from '../masonry-materials.js';
import {createHeightFog} from '../height-fog.js';
const baseline={nonCoverGeometry:'3721e80f7902909666feb35c04e7734b4675801fa6e742b0bec186691292a7ea',colliders:'d59338d8eb067668142a7e3b277ad9c9c44d1fb9fa36581cd73a73d12b21f7bb',drawCalls:13,triangles:50224,solids:205};
// Fingerprints captured from the untouched village before this slice. Only six
// explicitly named cover visuals are excluded; no house/roof/debris exceptions.
let checks=0;function ok(v,msg){assert.ok(v,msg);checks++}function equal(a,b,msg){assert.deepEqual(a,b,msg);checks++}
const sha=x=>createHash('sha256').update(x).digest('hex'),hash=x=>sha(JSON.stringify(x));
const mapSlots=['map','normalMap','roughnessMap','aoMap'];
function sources(){return Object.fromEntries(['plaster','stone','brick','wood','metal','roof'].map(k=>{
 const m=new T.MeshStandardMaterial({color:0xffffff,roughness:.85});
 for(const slot of mapSlots){const t=new T.Texture();t.name=k+'-'+slot;t.colorSpace=slot==='map'?T.SRGBColorSpace:T.NoColorSpace;t.repeat.set(2,3);m[slot]=t}
 m.onBeforeCompile=s=>{s.fragmentShader+='\n// retained-upstream-'+k};m.customProgramCacheKey=()=>k+'-source';return[k,m];
}))}
function materialState(ms){return Object.fromEntries(Object.entries(ms).map(([k,m])=>[k,{color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,normalScale:m.normalScale.toArray(),hook:m.onBeforeCompile.toString(),key:m.customProgramCacheKey(),textures:mapSlots.map(s=>({uuid:m[s].uuid,repeat:m[s].repeat.toArray(),colorSpace:m[s].colorSpace,wrap:[m[s].wrapS,m[s].wrapT]}))}]))}
const materials=sources(),before=materialState(materials),layoutBefore=JSON.stringify(layout),world=new T.Group(),solids=[];
const village=buildVillage({T,world,materials,layout,solids});world.updateMatrixWorld(true);
equal(materialState(materials),before,'shared PBR inputs and hooks remain unchanged');equal(JSON.stringify(layout),layoutBefore,'authoritative layout unchanged');
const covers=layout.walls.filter(isStoneCover),plan=stoneCoverPlan(layout.walls),detail=world.getObjectByName('stone-cover'),info=village.info();
equal(plan,stoneCoverPlan(layout.walls),'pure deterministic placement/shape plan');equal(plan.covers.length,6,'exact six cover IDs');
equal(stoneCoverPlan([...layout.walls].reverse()).covers.reverse(),plan.covers,'no shared/random-stream dependence');
let irregularEdges=0,totalEdges=0;const polygonSizes=new Set();
for(const cover of plan.covers)for(const face of cover.faces)for(const cell of face.cells){
 polygonSizes.add(cell.ring.length);
 for(let i=0;i<cell.outer.length;i++){const p=cell.outer[i],q=cell.outer[(i+1)%cell.outer.length];totalEdges++;if(Math.abs(p[0]-q[0])>.005&&Math.abs(p[1]-q[1])>.005)irregularEdges++}
}
ok(polygonSizes.size>=3&&irregularEdges>totalEdges*.6,'varied polygon topology and predominantly non-axis-aligned seams, not brick courses');
const stoneCells=plan.covers.flatMap(w=>w.faces.flatMap(f=>f.cells)),range=values=>Math.max(...values)-Math.min(...values);
ok(range(stoneCells.map(c=>c.centreDepth))>.005,'stone centres no longer coplanar');
ok(stoneCells.every(c=>c.heights.every(h=>h>=.0003&&h<=.0105)),'uneven face depression bounded inside 12mm shell');
ok(range(stoneCells.flatMap(c=>c.bevels))>.025,'varied local bevel widths');
ok(range(stoneCells.map(c=>c.uvScale))>.5&&range(stoneCells.map(c=>c.response[0]))>.10,'grain scale and nonmetal roughness vary per stone');
const actualStone=detail.getObjectByName('stone-cover-stone'),response=actualStone.geometry.attributes.stoneResponse;
equal(response.count,actualStone.geometry.attributes.position.count,'all stone vertices carry physical response');
for(let i=0;i<response.count;i+=3)for(let j=1;j<3;j++)equal([response.getX(i+j),response.getY(i+j)],[response.getX(i),response.getY(i)],'per-stone response constant within each triangle');
const stoneShader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};actualStone.material.onBeforeCompile(stoneShader,{});
ok(stoneShader.vertexShader.includes('vStoneResponse=stoneResponse;')&&stoneShader.fragmentShader.includes('varying vec2 vStoneResponse;'),'actual cover shader response plumbing');
ok(stoneShader.fragmentShader.indexOf('roughnessFactor=clamp(roughnessFactor+vStoneResponse.x')<stoneShader.fragmentShader.indexOf('#include <lights_physical_fragment>'),'response applied before physical lighting');
ok(stoneShader.fragmentShader.includes('mix(nonPerturbedNormal,normal,vStoneResponse.y)'),'scan normal strength varies without modifying geometry');
equal(solids.length,baseline.solids,'no collision additions/removals');
const solidRecord=solids.map(o=>({matrix:o.matrixWorld.toArray(),ud:o.userData,position:[...o.geometry.attributes.position.array],normal:[...o.geometry.attributes.normal.array],index:[...o.geometry.index.array]}));
equal(hash(solidRecord),baseline.colliders,'every original collider vertex/normal/index/transform/userData exactly retained');
let groups=[];
world.traverse(o=>{
 if(!o.isMesh||!o.material.visible||o.userData.stoneCover)return;
 const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,idx=g.index,faces=[];
 for(let j=0;j<(idx?.count||p.count);j+=3){
  const ids=[0,1,2].map(k=>idx?idx.getX(j+k):j+k);
  if(covers.some(w=>ids.every(i=>Math.abs(p.getX(i)-w.x)<=w.w/2+1e-5&&Math.abs(p.getY(i)-w.y)<=w.h/2+1e-5&&Math.abs(p.getZ(i)-w.z)<=w.d/2+1e-5)))continue;
  faces.push(ids.flatMap(i=>[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv?.getX(i),uv?.getY(i)]));
 }
 if(faces.length)groups.push({name:o.name,matrix:o.matrixWorld.toArray(),faces,instanceMatrix:o.instanceMatrix?[...o.instanceMatrix.array]:null,instanceColor:o.instanceColor?[...o.instanceColor.array]:null,castShadow:o.castShadow,receiveShadow:o.receiveShadow,userData:o.userData});
});
groups.sort((a,b)=>a.name.localeCompare(b.name));equal(hash(groups),baseline.nonCoverGeometry,'all non-cover positions/normals/UVs/triangles/transforms/RNG-derived dressing unchanged');
let triangles=0,bytes=0;const perWall=plan.covers.map(()=>new T.Box3());
for(const mesh of detail.children){
 ok(mesh.material.transparent===false&&mesh.material.opacity===1&&mesh.material.alphaTest===0,'opaque stone and mortar, no alpha gaps');
 const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,ids=g.attributes.coverIndex;
 triangles+=p.count/3;for(const a of Object.values(g.attributes)){bytes+=a.array.byteLength;ok([...a.array].every(Number.isFinite),'finite cover attributes')}
 for(let i=0;i<p.count;i++){
  const w=plan.covers[ids.getX(i)],v=new T.Vector3().fromBufferAttribute(p,i);perWall[ids.getX(i)].expandByPoint(v);
  for(let axis=0;axis<3;axis++)ok(Math.abs(v.getComponent(axis)-w.centre[axis])<=w.size[axis]/2+2e-6,'no protrusion outside collision AABB');
  const depth=Math.min(...w.size.map((s,k)=>s/2-Math.abs(v.getComponent(k)-w.centre[k])));
  ok(depth>=-2e-6&&depth<=.012+2e-6,'vertex within original 12mm shell (stricter than 30mm gate)');
  ok(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5,'unit geometric normals');
 }
}
for(const [i,b]of perWall.entries())for(let k=0;k<3;k++){
 ok(Math.abs(b.min.getComponent(k)-(plan.covers[i].centre[k]-plan.covers[i].size[k]/2))<2e-6,'exact minimum bounding extent');
 ok(Math.abs(b.max.getComponent(k)-(plan.covers[i].centre[k]+plan.covers[i].size[k]/2))<2e-6,'exact maximum bounding extent');
}
equal(triangles,plan.triangles,'plan equals generated triangle count');equal(info.stoneCover.triangles,triangles,'runtime detail statistics exact');
ok(triangles-covers.length*12<=40000,'strict <=40k added triangles');ok(detail.children.length<=3,'strict <=3 beauty draws');
equal(info.triangles-baseline.triangles,info.stoneCover.addedTriangles,'village accounts for removal/replacement');equal(info.drawCalls-baseline.drawCalls,1,'two cover draws replace one old batch');
let actualDraws=0,actualTriangles=0;world.traverse(o=>{if(!o.isMesh||!o.visible||!o.material.visible)return;actualDraws++;actualTriangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1)});
equal(actualDraws,info.drawCalls,'actual visible draw count');equal(actualTriangles,info.triangles,'actual visible triangle count');
// A watertight welded mortar shell is required independently of the stone layer.
// Thus no spacing or chipped corner can imply a hole through solid cover.
const mortar=detail.getObjectByName('stone-cover-mortar'),mp=mortar.geometry.attributes.position,mi=mortar.geometry.attributes.coverIndex,edges=new Map();
const key=i=>mi.getX(i)+':'+[mp.getX(i),mp.getY(i),mp.getZ(i)].map(v=>v.toFixed(5)).join(',');
for(let i=0;i<mp.count;i+=3)for(const [a,b]of [[0,1],[1,2],[2,0]]){const pair=[key(i+a),key(i+b)].sort().join('|');edges.set(pair,(edges.get(pair)||0)+1)}
ok([...edges.values()].every(n=>n===2),'closed mortar topology: each welded edge has two incident triangles');
const ray=new T.Raycaster(),norm=new T.Vector3(),pos=new T.Vector3(),out=new T.Vector3();let faceRays=0,obliqueRays=0,projectedMarks=0,maxNormalGap=0,maxHitGap=0,maxMarkShift=0;
for(const [wi,w]of plan.covers.entries()){
 const collider=solids.find(o=>o.userData.wall===w.id);ok(!!collider,'original cover hit shell present');
 for(const face of w.faces){
  const [width,height]=face.span,us=[-width/2+.0005,...Array.from({length:15},(_,i)=>width*((i+.5)/15-.5)),width/2-.0005];
  const vs=[-height/2+.0005,...Array.from({length:11},(_,i)=>height*((i+.5)/11-.5)),height/2-.0005];
  for(const u of us)for(const v of vs){
   pos.set(...w.centre);for(let k=0;k<3;k++)pos.setComponent(k,pos.getComponent(k)+face.u[k]*u+face.v[k]*v+face.n[k]*face.offset);
   norm.set(...face.n);ray.set(pos.clone().addScaledVector(norm,.1),norm.clone().negate());ray.far=.2;
   const hit=ray.intersectObjects(detail.children,false)[0];ok(!!hit,'every face sample hits an opaque visual');
   const gap=Math.abs(hit.distance-.1);maxNormalGap=Math.max(maxNormalGap,gap);ok(gap<=.012+3e-6,'visual surface <=12mm from exact collision face');faceRays++;
   const mark=village.projectStoneCoverHit({point:pos,normal:norm,wallId:w.id});ok(mark&&mark.cosmeticOnly,'cosmetic mark projection available on stone/mortar');
   maxMarkShift=Math.max(maxMarkShift,mark.distance);ok(mark.distance<=.012+3e-6&&mark.point.distanceTo(hit.point)<1e-5,'cosmetic mark sits on actual rendered geometry');projectedMarks++;
   // Authoritative first hit vs visible first hit, including near edges, from
   // normal to 60deg incidence. This is geometric mark alignment, not a GPU
   // claim about the root-owned impact effect's rendering/lighting.
   for(const angle of [0,Math.PI/6,Math.PI/3]){
    out.copy(norm).multiplyScalar(Math.cos(angle)).addScaledVector(new T.Vector3(...face.u),Math.sin(angle));
    ray.set(pos.clone().addScaledVector(out,.1),out.clone().negate());ray.far=.2;
    const shell=ray.intersectObject(collider,false)[0],visual=ray.intersectObjects(detail.children,false)[0];
    ok(!!shell&&!!visual,'both authoritative and visual first hit exist');const distance=shell.point.distanceTo(visual.point);maxHitGap=Math.max(maxHitGap,distance);ok(distance<=.03+3e-6,'hit mark location <=3cm at tested 0/30/60deg incidence');obliqueRays++;
   }
  }
 }
}
equal(village.projectStoneCoverHit({point:pos,normal:norm,wallId:'not-a-cover'}),null,'mark hook cannot alter unrelated hits');
for(const role of ['stone','plaster','course','core','aggregate','mortar']){
 const source=materials[role==='stone'?'stone':'plaster'],mat=createMasonryMaterial(T,source,{role});
 equal(mat.metalness,0,'nonmetallic masonry');equal(mat.displacementMap,null,'no GPU silhouette displacement');equal(mat.metalnessMap,null,'no metallic map contamination');
 if(role==='stone'||role==='plaster'){
  for(const slot of mapSlots){ok(mat[slot]&&mat[slot]!==source[slot],'real PBR map retained as private clone');equal(mat[slot].source,source[slot].source,'reuse scan without new image');equal(mat[slot].colorSpace,slot==='map'?T.SRGBColorSpace:T.NoColorSpace,'only albedo is sRGB');equal(mat[slot].repeat.toArray(),[1/MASONRY_SCALE[role==='stone'?'stoneTile':'plasterTile'],1/MASONRY_SCALE[role==='stone'?'stoneTile':'plasterTile']],'all map channels aligned at metric scale')}
  ok(mat.normalScale.x>=.7&&mat.normalScale.x===mat.normalScale.y,'positive OpenGL normal amplitude');
 }else for(const slot of mapSlots)equal(mat[slot],null,'fractures/core/mortar do not inherit whole wall maps');
 composeMasonryHook(mat,'later-test',s=>{s.fragmentShader+='\n// later-test'});
 const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(),mat));createHeightFog(T).install(group);
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};mat.onBeforeCompile(shader,{});
 ok(shader.fragmentShader.includes('retained-upstream-')&&shader.fragmentShader.includes('// later-test')&&shader.fragmentShader.includes('hfAmount'),'upstream/masonry/later/heightfog hooks compose');
 equal((shader.fragmentShader.match(/#include <map_fragment>/g)||[]).length,1,'single standard albedo decode stage');
 ok(!/pow\s*\(\s*diffuseColor|sRGBToLinear|LinearTosRGB/.test(shader.fragmentShader),'no manual/double diffuse gamma conversion');
 ok(shader.vertexShader.includes('#include <project_vertex>'),'standard vertex projection intact');
 ok(mat.customProgramCacheKey().includes(source.name||'-source'),'retained program key');
}
// Retain the prior raw-core/soil field intent, without changing historical
// material-only tests that necessarily fingerprint the former six box visuals.
const names=[...MASONRY_FIELDS_GLSL.matchAll(/float (masonry\w+)\(/g)].map(m=>m[1]);
const js=MASONRY_FIELDS_GLSL.replace(/float (masonry\w+)\(([^)]*)\)/g,(_,name,args)=>'function '+name+'('+args.replace(/float /g,'')+')').replace(/\bfloat\s+/g,'let ');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const f=Function('fract','sin','floor','abs','max','min','step','mix','smoothstep',js+';return {'+names.join(',')+'}')(x=>x-Math.floor(x),Math.sin,Math.floor,Math.abs,Math.max,Math.min,(a,b)=>b<a?0:1,(a,b,t)=>a+(b-a)*t,smooth);
for(let i=0;i<200;i++){
 const x=i*.071,z=i*.031;equal(f.masonryExposure(0,10,x,z),0,'intact plaster remains coated');equal(f.masonryExposure(1,10,x,z),1,'small core fragments remain exposed');equal(f.masonryExposure(0,0,x,z),1,'fracture lip remains exposed');equal(f.masonrySoil(x,.46,z),0,'soil remains local to lower edge');
}
const sourceManifest=JSON.parse(await readFile(new URL('../asset-sources.json',import.meta.url),'utf8'));
equal(sourceManifest.assets.find(a=>a.id==='rocky_gravel').license,'CC0-1.0','stone input provenance');
for(const entry of sourceManifest.files.filter(f=>f.path.startsWith('assets/rocky_gravel/'))){const bytes=await readFile(new URL('../'+entry.path,import.meta.url));equal(bytes.length,entry.bytes,'original stone texture size');equal(sha(bytes),entry.sha256,'original stone texture checksum');if(entry.path.includes('normal'))ok(entry.url.includes('_nor_gl_'),'official OpenGL normal source')}
const inputs={};for(const p of ['village.js','masonry-materials.js','stone-cover.js','qa/stone-cover-checks.mjs'])inputs[p]=sha(await readFile(new URL('../'+p,import.meta.url)));
console.log(JSON.stringify({status:'CPU PASS; GPU/art/performance NOT evaluated',checks,inputs,nonCoverGeometry:baseline.nonCoverGeometry,exactColliderFingerprint:baseline.colliders,info,actualDraws,actualTriangles,geometryBytes:bytes,watertightMortarEdges:edges.size,polygonSizes:[...polygonSizes].sort((a,b)=>a-b),irregularEdges,totalEdges,faceRays,obliqueRays,projectedMarks,maxNormalGap,maxHitGap,maxMarkShift,limitations:['CPU shader assembly is not WebGL compilation.','First-hit tests cover 0/30/60 degrees; at grazing incidence ray-length separation can exceed normal surface recess; projectStoneCoverHit snaps cosmetic marks along the face normal.','Root owns cosmetic impact integration, GPU captures, draw/shadow/reflection totals and performance.']},null,2));
