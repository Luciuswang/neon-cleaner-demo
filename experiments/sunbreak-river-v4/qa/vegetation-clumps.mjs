// CPU-only spatial, source-geometry and budget regression. Stdout only; no
// browser, servers, downloads, generated report files or art-acceptance claim.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {vegetationPlan,grassAllowed,grassBatches,GRASS_VARIANTS,inGrassGap} from '../vegetation.js';
import {MAP,vegetationAllowed,landscapeHeight,riverWidth,crossings,inBuffer,rubbleHeight,houses,bounds} from '../map-layout.js';

// Captured from the unedited source and local GLB accessor counts before this
// slice, not count targets for the new distribution. Trees dominate this cost.
const baseline={sourceSHA256:'b289362e5e91e062f39d7dac19c85d58a172165c81c6150728ff6d5c9fc70960',
 treeTransformsSHA256:'76ae613c0406d8854f2407e61828d29d5d9f93a9b91d8fe1d4ce9f7303f6562a',
 triangles:30842052,drawCalls:112,placements:13969,grassPlacements:13874};
const hash=b=>createHash('sha256').update(b).digest('hex'),checks=[],sources={},assets=new Map(),assetBytes=new Map();
for(const name of ['../vegetation.js','./vegetation-clumps.mjs','../map-layout.js'])sources[name]=hash(await readFile(new URL(name,import.meta.url)));
const assetNames=['island_tree_01','island_tree_01-far','tree_small_02','tree_small_02-far','grass_bermuda_01','wild_leafy_a','wild_leafy_b','wild_upright_a','wild_upright_b'];
for(const name of assetNames){
 const b=await readFile(new URL(`../assets/${name.startsWith('wild_')?'wild-grass':'foliage-revision'}/${name}.glb`,import.meta.url));
 assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);
 assets.set(name,JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString()));assetBytes.set(name,b);sources[`${name}.glb`]=hash(b);
}
const manifestBytes=await readFile(new URL('../wild-grass-assets.json',import.meta.url)),manifest=JSON.parse(manifestBytes),manifestContents=new Map();
sources['wild-grass-assets.json']=hash(manifestBytes);
for(const f of manifest.files){assert.match(f.file,/^assets\/wild-grass\/[\w/.-]+$/);assert.ok(!f.file.includes('..'));manifestContents.set(f.file,await readFile(new URL('../'+f.file,import.meta.url)))}
const prepareBytes=await readFile(new URL('../tools/prepare-wild-grass.mjs',import.meta.url)),vegetationSource=(await readFile(new URL('../vegetation.js',import.meta.url))).toString();
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function check(name,fn){try{const evidence=fn();checks.push({name,pass:true,...evidence===undefined?{}:{evidence}})}catch(e){checks.push({name,pass:false,error:e.message})}}
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
const inside=p=>p.x>=MAP.minX&&p.x<=MAP.maxX&&p.z>=MAP.minZ&&p.z<=MAP.maxZ;
const plan=vegetationPlan(),all=[...plan.low,...plan.medium,...plan.tall],byClump=new Map(plan.clumps.map(c=>[c.id,[]]));
for(const p of all)byClump.get(p.clumpId)?.push(p);
const foreground=all.filter(inside),clumpById=new Map(plan.clumps.map(c=>[c.id,c])),patchById=new Map(plan.patches.map(c=>[c.id,c]));
const trees=()=>JSON.stringify({near:plan.near,far:plan.far,shrubs:plan.shrubs,trunks:plan.trunks});
function spatial(points,size=.5){
 const cells=new Map();for(const p of points){const key=`${Math.floor(p.x/size)},${Math.floor(p.z/size)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p)}
 return {nearby(x,z,r){const found=[];for(let iz=Math.floor((z-r)/size);iz<=Math.floor((z+r)/size);iz++)for(let ix=Math.floor((x-r)/size);ix<=Math.floor((x+r)/size);ix++)for(const q of cells.get(`${ix},${iz}`)||[])if(Math.hypot(x-q.x,z-q.z)<=r)found.push(q);return found}};
}
const index=spatial(all),quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
const phaseCoherence=(points,axis,pitch)=>Math.hypot(points.reduce((s,p)=>s+Math.cos(p[axis]*Math.PI*2/pitch),0),points.reduce((s,p)=>s+Math.sin(p[axis]*Math.PI*2/pitch),0))/points.length;
// Decode source PNG rows on CPU: colorType alone does not prove useful alpha.
function alphaCoverage(png){
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20),stride=width*4,idat=[];
 assert.equal(png[24],8);assert.equal(png[25],6);assert.equal(png[28],0);
 for(let at=8;at<png.length;){const len=png.readUInt32BE(at),type=png.subarray(at+4,at+8).toString();if(type==='IDAT')idat.push(png.subarray(at+8,at+8+len));at+=12+len}
 const encoded=inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(stride*height);
 assert.equal(encoded.length,(stride+1)*height);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
 for(let y=0;y<height;y++){const filter=encoded[y*(stride+1)];assert.ok(filter<=4);for(let x=0;x<stride;x++){
  const i=y*stride+x,left=x>=4?pixels[i-4]:0,up=y?pixels[i-stride]:0,ul=x>=4&&y?pixels[i-stride-4]:0;
  pixels[i]=(encoded[y*(stride+1)+1+x]+[0,left,up,Math.floor((left+up)/2),paeth(left,up,ul)][filter])&255;
 }}
 let clear=0,leaf=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]<10)clear++;if(pixels[i]>245)leaf++}
 return {clear:clear/(width*height),leaf:leaf/(width*height),pixels,width,height};
}

check('original tree/shrub transforms and species/shadow flags byte-identical',()=>{
 assert.equal(hash(trees()),baseline.treeTransformsSHA256);return {sha256:hash(trees()),near:plan.near.map(a=>a.length),far:plan.far.map(a=>a.length),shrubs:plan.shrubs.length};
});
check('deterministic fresh plans independent of global RNG',()=>{
 const old=Math.random;Math.random=()=>{throw Error('global RNG used')};
 try{assert.deepEqual(vegetationPlan(),plan)}finally{Math.random=old}
 const copy=vegetationPlan();copy.clumps[0].x=999;copy.low[0].height=9;assert.deepEqual(vegetationPlan(),plan);
});
check('finite grounded transforms and three distinct plausible height classes',()=>{
 const result={};
 for(const layer of ['low','medium','tall']){
  const ps=plan[layer];assert.ok(ps.length,`Missing authored ${layer} height class`);
  for(const p of ps){
   const spec=GRASS_VARIANTS[p.variant];assert.equal(spec.layer,layer);
   for(const k of ['x','y','z','r','s','stretch','tone','height','rho','clearanceRadius'])assert.ok(Number.isFinite(p[k]),k);
   near(p.y,landscapeHeight(p.x,p.z)-.018);near(p.height,spec.height*p.s*p.stretch);
   assert.ok(p.height>=spec.range[0]&&p.height<=spec.range[1]);assert.ok(p.height>=.12&&p.height<=.55);
   assert.ok(p.s>0&&p.stretch>=.94&&p.stretch<=1.06&&p.tone>=0&&p.tone<=1);
  }
  result[layer]={count:ps.length,minHeight:Math.min(...ps.map(p=>p.height)),maxHeight:Math.max(...ps.map(p=>p.height))};
 }
 assert.ok(result.low.minHeight<result.medium.minHeight&&result.medium.minHeight<result.tall.minHeight);return result;
});
check('all roots preserve original river/path/crossing/cabin/house/rubble exclusions',()=>{
 for(const p of all){
  assert.ok(grassAllowed(p.x,p.z,.25));assert.equal(inGrassGap(p.x,p.z,plan.gaps,p.clearanceRadius),false);
  if(inside(p)){
   assert.ok(vegetationAllowed(p.x,p.z));assert.equal(inBuffer(p.x,p.z,.7),false);assert.ok(rubbleHeight(p.x,p.z)<=.01);
   assert.ok(Math.abs(Math.abs(p.x)-(10+.32*Math.sin(p.z*.19)))>1.7);
   assert.ok(crossings.every(z=>Math.abs(z-p.z)>2.25));
  }
 }return {rootsChecked:all.length,foregroundRoots:foreground.length};
});
check('rendered leaf radii including wind preserve footprint clearance',()=>{
 for(const p of all){
  for(let i=0;i<16;i++){const a=i*Math.PI/8;assert.ok(grassAllowed(p.x+Math.cos(a)*p.clearanceRadius,p.z+Math.sin(a)*p.clearanceRadius,.25),`${p.clumpId} leaf footprint`)}
 }
 return {perimeterProbes:all.length*16};
});
check('nonzero randomized root separation with overlapping leaf bodies in cores',()=>{
 let min=Infinity,overlap=0;const distances=[];
 for(const p of all){
  const ns=index.nearby(p.x,p.z,.5).filter(q=>q!==p),d=ns.length?Math.min(...ns.map(q=>Math.hypot(q.x-p.x,q.z-p.z))):Infinity;
  min=Math.min(min,d);if(Number.isFinite(d))distances.push(d);
  if(ns.some(q=>q.clumpId===p.clumpId&&Math.hypot(q.x-p.x,q.z-p.z)<p.clearanceRadius+q.clearanceRadius))overlap++;
 }
 assert.ok(min>=.075-1e-9);assert.ok(overlap>all.length/2,'Clumps require overlapping leaf bodies, not isolated vegetables');
 assert.ok(quantile(distances,.9)>quantile(distances,.1)*1.10,'Root spacing must vary, not a fixed lattice');
 return {min,nearestP10:quantile(distances,.1),nearestMedian:quantile(distances,.5),nearestP90:quantile(distances,.9),overlappingLeafFraction:overlap/all.length};
});
check('each root belongs to an actual irregular lobe and a valid species community',()=>{
 for(const p of all){
  const c=clumpById.get(p.clumpId),patch=patchById.get(p.patchId);assert.ok(c&&patch);assert.equal(c.patchId,p.patchId);assert.ok(patch.lobes.includes(c.id));
  const dx=p.x-c.x,dz=p.z-c.z,u=dx*Math.cos(c.angle)+dz*Math.sin(c.angle),v=-dx*Math.sin(c.angle)+dz*Math.cos(c.angle);
  assert.ok(Math.hypot(u/c.rx,v/c.rz)<=1.2*1.25+1e-9);assert.ok([c.baseVariant,4,5,c.tallVariant].includes(p.variant));
  if(p.zone==='satellite')assert.equal(p.variant,c.baseVariant);if(p.variant>=6)assert.equal(c.seedHeads,true);
 }
 for(const c of plan.clumps){assert.equal(byClump.get(c.id).length,c.rootCount);assert.equal(c.baseVariant,patchById.get(c.patchId).baseVariant)}
});
check('posture mix contracts old footprints and feathers existing clumps without new infill',()=>{
 for(const p of all){assert.ok(Number.isFinite(p.previousClearanceRadius));assert.ok(p.clearanceRadius<=p.previousClearanceRadius+1e-9)}
 const mixed=plan.clumps.filter(c=>{const ps=byClump.get(c.id).filter(p=>p.zone==='core');return ps.some(p=>p.variant<4)&&ps.some(p=>p.variant===4||p.variant===5)});
 assert.ok(mixed.some(c=>c.featured&&c.x<0)&&mixed.some(c=>c.featured&&c.x>0),'Both viewed banks need coherent short/tall core pockets');
 const a=all.filter(p=>p.variant===4),b=all.filter(p=>p.variant===5),low=all.filter(p=>p.zone==='core'&&p.variant<4),edge=all.filter(p=>p.zone==='satellite');
 assert.ok(quantile(b.map(p=>p.height),.5)<quantile(a.map(p=>p.height),.5)*.8,'Outward posture must actually render lower, not just rename the asset');
 assert.ok(quantile(a.map(p=>p.height),.9)>quantile(a.map(p=>p.height),.1)*1.5,'Clump shoulders require meaningful height variation');
 assert.ok(quantile(edge.map(p=>p.height),.5)<quantile(a.map(p=>p.height),.5));
 assert.ok(assets.get('wild_leafy_b').extras.sourceRadiusRatio>assets.get('wild_leafy_a').extras.sourceRadiusRatio*1.8);
 return {mixedClumps:mixed.length,lowCoreRoots:low.length,uprightHeightMedian:quantile(a.map(p=>p.height),.5),outwardHeightMedian:quantile(b.map(p=>p.height),.5),edgeHeightMedian:quantile(edge.map(p=>p.height),.5),rootCountReduced:all.length<baseline.grassPlacements};
});
check('core density exceeds feathered satellite density by sampled physical area',()=>{
 let core=0,satellite=0,coreArea=0,satelliteArea=0;
 for(const c of plan.clumps){
  const area=Math.PI*c.rx*c.rz;coreArea+=area*c.coreRadius**2;satelliteArea+=area*(1.2**2-(c.coreRadius+.06)**2);
  for(const p of byClump.get(c.id))if(p.zone==='core')core++;else satellite++;
 }
 const coreDensity=core/coreArea,satelliteDensity=satellite/satelliteArea;
 assert.ok(coreDensity>satelliteDensity*2,'Dense cores and sparse edges must be spatially distinct');assert.ok(satellite>0);
 return {core,satellite,coreDensity,satelliteDensity,ratio:coreDensity/satelliteDensity};
});
check('small/medium/large clumps and broad size variation; no identical whole tufts',()=>{
 const sizes=new Set(plan.clumps.map(c=>c.sizeClass)),areas=plan.clumps.map(c=>Math.PI*c.rx*c.rz),aspect=plan.clumps.map(c=>c.rx/c.rz);
 assert.deepEqual([...sizes].sort(),['large','medium','small']);
 assert.ok(quantile(areas,.9)>quantile(areas,.1)*3);assert.ok(Math.max(...aspect)-Math.min(...aspect)>.4);
 assert.equal(new Set(plan.clumps.map(c=>`${c.rx},${c.rz},${c.angle}`)).size,plan.clumps.length);
 return {areaP10:quantile(areas,.1),areaMedian:quantile(areas,.5),areaP90:quantile(areas,.9),aspectRange:[Math.min(...aspect),Math.max(...aspect)]};
});
check('bank patch orientation follows river tangent without mirrored rows',()=>{
 const bank=plan.patches.filter(p=>p.bank);assert.ok(bank.some(p=>p.x<0)&&bank.some(p=>p.x>0));
 for(const p of bank){const slope=-.136*Math.sin(p.z*.17)-.1645*Math.sin(p.z*.47),tangent=Math.atan2(1,Math.sign(p.x)*slope);assert.ok(Math.abs(p.angle-tangent)<=.35+1e-9)}
 for(const p of bank)assert.ok(!bank.some(q=>p!==q&&Math.abs(p.x+q.x)<1e-8&&Math.abs(p.z-q.z)<1e-8));
 assert.equal(new Set(bank.map(p=>p.z)).size,bank.length);return {riverOrientedPatches:bank.length};
});
check('reviewed near-bank envelope has substantial compound bodies on both sides',()=>{
 const evidence=[];
 for(const side of [-1,1]){
  const patches=plan.patches.filter(p=>p.featured&&Math.sign(p.x)===side);assert.ok(patches.length,'Missing reviewed bank envelope');
  for(const p of patches){assert.ok(Math.abs(p.x)>=5.6&&Math.abs(p.x)<=7.2&&p.z>=8&&p.z<=12)}
  const bodies=plan.clumps.filter(c=>c.featured&&Math.sign(c.x)===side),bodySizes=[];
  for(const c of bodies){
   const core=byClump.get(c.id).filter(p=>p.zone==='core'&&GRASS_VARIANTS[p.variant].layer==='medium');
   if(!core.length)continue;
   const width=Math.max(...core.map(p=>p.x+p.clearanceRadius))-Math.min(...core.map(p=>p.x-p.clearanceRadius));
   const depth=Math.max(...core.map(p=>p.z+p.clearanceRadius))-Math.min(...core.map(p=>p.z-p.clearanceRadius));
   assert.ok(core.every(p=>p.height<=.43));bodySizes.push({clumpId:c.id,coreTufts:core.length,width,depth});
  }
  assert.ok(bodySizes.length>1,'Multiple compound bodies required, not a jumbo single plant');
  assert.ok(bodySizes.some(b=>Math.min(b.width,b.depth)>=.4),'Body silhouette must have real width from overlapping source tuples');
  evidence.push({side,bodies:bodySizes});
 }return evidence;
});
check('intentional bare intervals are genuine allowed ground, not just forbidden crossings',()=>{
 const probes=[];
 for(const g of plan.gaps){
  let valid=0;
  for(let dz=-g.halfLength*.8;dz<=g.halfLength*.8;dz+=.2)for(let offset=2;offset<4.5;offset+=.2){
   const z=g.z+dz,x=g.side*(riverWidth(z)+offset);if(!grassAllowed(x,z,.25))continue;
   valid++;assert.equal(index.nearby(x,z,.02).length,0);
   for(const p of index.nearby(x,z,.6))assert.ok(Math.hypot(x-p.x,z-p.z)>=p.clearanceRadius-1e-9,'Leaf covers authored bare interval');
  }
  assert.ok(valid>0,'Gap must expose otherwise plantable soil');probes.push({side:g.side,z:g.z,validBareProbes:valid});
 }return probes;
});
check('foreground samples contain both dense growth and broad allowed bare gaps',()=>{
 const random=rng(9131),probeDistances=[];
 for(let i=0;i<6000;i++){
  const x=MAP.minX+random()*(MAP.maxX-MAP.minX),z=MAP.minZ+random()*(MAP.maxZ-MAP.minZ);
  if(!grassAllowed(x,z,.25))continue;
  const ns=index.nearby(x,z,2),d=ns.length?Math.min(...ns.map(p=>Math.hypot(p.x-x,p.z-z))):2;probeDistances.push(d);
 }
 const nearFraction=probeDistances.filter(d=>d<.3).length/probeDistances.length,bareFraction=probeDistances.filter(d=>d>1).length/probeDistances.length;
 assert.ok(nearFraction>0&&bareFraction>0);assert.ok(quantile(probeDistances,.9)>quantile(probeDistances,.1)*3);
 return {allowedProbes:probeDistances.length,within30cmOfGrass:nearFraction,over1mBare:bareFraction,distanceP10:quantile(probeDistances,.1),distanceP90:quantile(probeDistances,.9)};
});
check('local species coherence exceeds random global mix expectation',()=>{
 let agree=0,total=0;const frequency=new Map();
 for(const p of all){frequency.set(p.variant,(frequency.get(p.variant)||0)+1);const ns=index.nearby(p.x,p.z,.35).filter(q=>q!==p);if(!ns.length)continue;
  ns.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));total++;if(ns[0].variant===p.variant)agree++;
 }
 const independentChance=[...frequency.values()].reduce((s,n)=>s+(n/all.length)**2,0),actual=agree/total;
 assert.ok(actual>independentChance+6*Math.sqrt(independentChance*(1-independentChance)/total));
 return {sameSpeciesNearestNeighbor:actual,independentMixExpectation:independentChance,neighborPairs:total};
});
check('no 27cm phase lock on either axis; synthetic lattice is detected',()=>{
 const result={};
 for(const axis of ['x','z']){
  const actual=phaseCoherence(foreground,axis,.27),random=rng(axis==='x'?751:791),control=foreground.map(p=>({...p,[axis]:p[axis]+(random()-.5)*.27}));
  const nullValue=phaseCoherence(control,axis,.27),tolerance=6/Math.sqrt(foreground.length);
  assert.ok(actual<nullValue+tolerance,`${axis} phase locked`);
  const lattice=foreground.map(p=>({...p,[axis]:Math.round(p[axis]/.27)*.27}));assert.ok(phaseCoherence(lattice,axis,.27)>nullValue+tolerance);
  result[axis]={actual,randomPhaseControl:nullValue,sixSigmaTolerance:tolerance};
 }return result;
});
check('source GLB bounds support declared radius and plausible leaf scale',()=>{
 for(const b of grassBatches(plan)){
  const j=assets.get(b.asset),node=j.nodes.find(n=>n.name===b.node);assert.ok(node&&node.mesh!==undefined,b.node);
  assert.ok(!node.rotation||node.rotation.every((v,i)=>v===(i===3?1:0)));assert.ok(!node.scale||node.scale.every(v=>v===1));
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const primitive of j.meshes[node.mesh].primitives){const a=j.accessors[primitive.attributes.POSITION];for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],a.min[i]);hi[i]=Math.max(hi[i],a.max[i])}}
  const ratio=Math.hypot(hi[0]-lo[0],hi[2]-lo[2])/(2*(hi[1]-lo[1]));assert.ok(ratio<=b.radiusRatio,b.node);
  for(const p of b.placements)assert.ok(ratio*b.height*p.s+.03<=p.clearanceRadius+1e-9);
 }
});

check('CC0 source/license snapshots, derivative hashes and closed public whitelist',()=>{
 assert.equal(manifest.license,'CC0-1.0');assert.equal(hash(prepareBytes),manifest.preparation.sha256);
 assert.equal(new Set(manifest.files.map(f=>f.file)).size,manifest.files.length);
 for(const f of manifest.files){const b=manifestContents.get(f.file);assert.equal(b.length,f.bytes,f.file);assert.equal(hash(b),f.sha256,f.file);assert.equal(f.license,'CC0-1.0');assert.ok(f.source.startsWith('https://'));assert.ok(f.derivatives.length>10)}
 const official=manifestContents.get('assets/wild-grass/source/license/ambientcg-license.html').toString();
 assert.match(official,/All ambientCG assets are provided under/);assert.match(official,/Creative Commons CC0/);
 assert.match(manifestContents.get('assets/wild-grass/source/license/CC0-1.0.txt').toString(),/CC0 1.0 Universal/);
 assert.deepEqual(manifest.sourceAssets.map(a=>a.id),['Foliage001','Foliage006']);
 for(const file of manifest.publicWhitelist){assert.ok(manifestContents.has(file));assert.ok(!file.includes('/source/'));assert.ok(/\.(glb|txt)$/.test(file))}
 for(const spec of GRASS_VARIANTS.slice(4)){assert.ok(spec.asset.startsWith('wild_'));assert.ok(manifest.publicWhitelist.includes(`assets/wild-grass/${spec.asset}.glb`))}
 return {filesVerified:manifest.files.length,publicFiles:manifest.publicWhitelist.length,sourceAssets:manifest.sourceAssets.map(a=>a.source)};
});
const atlasMedians=[];
check('wild tufts have finite nondegenerate curved geometry, correct winding and embedded cutout atlas',()=>{
 const evidence=[];
 for(const def of manifest.definitions){
  const b=assetBytes.get(def.name),j=assets.get(def.name),binStart=20+b.readUInt32LE(12)+8;
  assert.equal(b.length,b.readUInt32LE(8));assert.equal(j.images.length,1);assert.ok(!j.images[0].uri);assert.ok(!j.buffers[0].uri);
  const imageView=j.bufferViews[j.images[0].bufferView],png=b.subarray(binStart+imageView.byteOffset,binStart+imageView.byteOffset+imageView.byteLength);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);assert.equal(png[25],6,'RGBA required, not opaque rectangular cards');
  const coverage=alphaCoverage(png);assert.ok(coverage.clear>.5,'Atlas must be mostly transparent');assert.ok(coverage.leaf>.01&&coverage.leaf<.5,'Actual leaves must survive alpha');
  const channels=[[],[],[]];for(let i=0;i<coverage.pixels.length;i+=4)if(coverage.pixels[i+3]>200)for(let c=0;c<3;c++)channels[c].push(coverage.pixels[i+c]);
  const median=channels.map(v=>quantile(v,.5));atlasMedians.push({id:def.id,median});
  const mat=j.materials[0];assert.equal(mat.alphaMode,'MASK');assert.equal(mat.doubleSided,true);assert.equal(mat.pbrMetallicRoughness.metallicFactor,0);assert.ok(mat.pbrMetallicRoughness.roughnessFactor>=.9);
  assert.equal(j.extras.blades,def.blades);assert.equal(j.extras.segments,6);assert.ok(j.extras.maxBladeWidth<=.009);assert.ok(j.extras.bladeInfo.every(v=>v.width>0&&v.reach>0&&v.crop[0]>=0&&v.crop[1]>=0&&v.crop[0]+v.crop[2]<=1024&&v.crop[1]+v.crop[3]<=1024));
  const blades=j.extras.bladeInfo;assert.ok(Math.max(...blades.map(v=>v.height))>Math.min(...blades.map(v=>v.height))*2);
  assert.ok(blades.some(v=>v.arc<Math.PI/2)&&blades.some(v=>v.arc>Math.PI/2),'Both upward and drooping tips required');
  assert.equal(new Set(blades.map(v=>v.root.join(','))).size,blades.length);assert.ok(Math.max(...blades.map(v=>Math.hypot(...v.root)))>.025);
  function values(i){const a=j.accessors[i],v=j.bufferViews[a.bufferView],width={VEC3:3,VEC2:2,SCALAR:1}[a.type],n=a.count*width,at=binStart+v.byteOffset+(a.byteOffset||0);return Array.from({length:n},(_,k)=>a.componentType===5126?b.readFloatLE(at+k*4):b.readUInt16LE(at+k*2))}
  const p=j.meshes[0].primitives[0],pos=values(p.attributes.POSITION),norm=values(p.attributes.NORMAL),uv=values(p.attributes.TEXCOORD_0),ix=values(p.indices);
  assert.ok(pos.every(Number.isFinite));assert.ok(norm.every(Number.isFinite));assert.ok(uv.every(v=>v>=0&&v<=1));assert.equal(ix.length/3,def.blades*6*2);
  for(let i=0;i<norm.length;i+=3)near(Math.hypot(...norm.slice(i,i+3)),1,1e-6);
  for(let i=0;i<ix.length;i+=3){const a=ix[i]*3,b=ix[i+1]*3,c=ix[i+2]*3;assert.ok(Math.max(a,b,c)<pos.length);const u=pos.slice(b,b+3).map((v,k)=>v-pos[a+k]),v=pos.slice(c,c+3).map((v,k)=>v-pos[a+k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);assert.ok(len>1e-9);assert.ok(n.reduce((sum,x,k)=>sum+x*norm[a+k],0)/len>.8,'Winding must match supplied normals')}
  const spec=GRASS_VARIANTS.find(v=>v.asset===def.name),positionAccessor=j.accessors[p.attributes.POSITION],sourceHeight=positionAccessor.max[1]-positionAccessor.min[1];
  for(const placement of all.filter(p=>GRASS_VARIANTS[p.variant].asset===def.name))assert.ok(j.extras.maxBladeWidth*spec.height/sourceHeight*placement.s<=.015,'Rendered blade width must remain physically narrow');
  evidence.push({name:def.name,blades:def.blades,triangles:ix.length/3,maxBladeWidth:j.extras.maxBladeWidth,transparentPixelFraction:coverage.clear,opaqueLeafFraction:coverage.leaf,opaqueRGBMedian:median});
 }return evidence;
});
check('two source atlases retain distinct but neighboring authored olive palettes',()=>{
 assert.equal(atlasMedians.length,4);for(const {id,median}of atlasMedians)for(let c=0;c<3;c++)assert.ok(Math.abs(median[c]-manifest.palette[id][c])<=7);
 const a=atlasMedians.find(v=>v.id==='Foliage001'),b=atlasMedians.find(v=>v.id==='Foliage006');
 assert.notDeepEqual(a.median,b.median);assert.ok(a.median.every((v,c)=>Math.abs(v-b.median[c])<=7));
 return {sourcePixelMedians:atlasMedians.slice(0,2),scope:'Authoring normalization only, not rendered art acceptance'};
});
check('root shading is grass-only; unchanged wind deformation also binds shadow materials',()=>{
 const start=vegetationSource.indexOf('function windMaterial('),end=vegetationSource.indexOf('function instances(',start);
 assert.ok(start>=0&&end>start);const compile=Function('time','return ('+vegetationSource.slice(start,end).trim()+')')({value:0});
 const shader=()=>({uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>'});
 const tree={},grass={},depth={},ts=shader(),gs=shader(),ds=shader();
 compile(tree,.34,.022,'probe',false);compile(grass,.34,.022,'probe',true);compile(depth,.34,.022,'probe');tree.onBeforeCompile(ts);grass.onBeforeCompile(gs);depth.onBeforeCompile(ds);
 assert.equal(ts.vertexShader,ds.vertexShader);assert.equal(ts.fragmentShader,ds.fragmentShader);assert.ok(!ts.fragmentShader.includes('vGrassRootHeight'));
 assert.match(gs.vertexShader,/position\.y\*length\(instanceMatrix\[1\]\.xyz\)/);assert.match(gs.fragmentShader,/mix\(\.55,1\.,smoothstep\(\.012,\.13,vGrassRootHeight\)\)/);
 assert.match(vegetationSource,/windMaterial\(mat,height,wind,label,!tree\)/);assert.match(vegetationSource,/windMaterial\(inst.customDepthMaterial,height,wind,label\)/);
 const wind=s=>s.slice(s.indexOf('float foliagePhase'));assert.equal(wind(ts.vertexShader),wind(gs.vertexShader));assert.notEqual(tree.customProgramCacheKey(),grass.customProgramCacheKey());
 return {rootHeightMeters:[.012,.13],minimumAlbedoFactor:.55,treeAndShadowRootShading:false};
});

const measurements={triangles:0,drawCalls:0,placements:0,grassTriangles:0,grassDrawCalls:0,byBatch:[]};
function measure(asset,nodeName,ps,label,grass=false){
 if(!ps.length)return;const j=assets.get(asset),nodes=nodeName?j.nodes.filter(n=>n.name===nodeName):j.nodes.filter(n=>n.mesh!==undefined);
 let sourceTriangles=0,primitives=0;
 for(const n of nodes)for(const p of j.meshes[n.mesh].primitives){assert.ok(p.mode===undefined||p.mode===4);sourceTriangles+=j.accessors[p.indices??p.attributes.POSITION].count/3;primitives++}
 const sectors=new Set(ps.map(p=>(p.x>=0?1:0)+(p.z>=-4?2:0))),triangles=sourceTriangles*ps.length,drawCalls=primitives*sectors.size;
 measurements.triangles+=triangles;measurements.drawCalls+=drawCalls;measurements.placements+=ps.length;
 if(grass){measurements.grassTriangles+=triangles;measurements.grassDrawCalls+=drawCalls}
 measurements.byBatch.push({asset,node:nodeName,label,placements:ps.length,triangles,drawCalls});
}
check('exact current GLB/sector budget does not exceed pre-edit geometry or object count',()=>{
 for(let species=0;species<2;species++){
  const asset=species?'tree_small_02':'island_tree_01';
  measure(asset,null,plan.near[species].filter(p=>p.shadow),'near-shadow');measure(asset,null,plan.near[species].filter(p=>!p.shadow),'near');
  measure(asset+'-far',null,plan.far[species],'far');
 }
 measure('tree_small_02-far',null,plan.shrubs,'shrubs');
 for(const b of grassBatches(plan))measure(b.asset,b.node,b.placements,b.label,true);
 assert.ok(measurements.triangles<=baseline.triangles);assert.ok(measurements.drawCalls<=baseline.drawCalls);assert.ok(measurements.placements<=baseline.placements);
 assert.equal(grassBatches(plan).reduce((n,b)=>n+b.placements.length,0),all.length);
 return measurements;
});
check('no old infill flags, no unmapped roots, no global gameplay mutation',()=>{
 assert.equal(plan.infill,undefined);assert.ok(all.every(p=>!Object.hasOwn(p,'infill')));
 assert.ok(all.every(p=>byClump.has(p.clumpId)));assert.equal(new Set(plan.clumps.map(c=>c.id)).size,plan.clumps.length);
 assert.equal(hash(trees()),baseline.treeTransformsSHA256);
 const before=JSON.stringify({MAP,crossings,houses,bounds});vegetationPlan();assert.equal(JSON.stringify({MAP,crossings,houses,bounds}),before);
});
const failed=checks.filter(c=>!c.pass);
console.log(JSON.stringify({suite:'vegetation-organic-clumps-v1',verdict:failed.length?'FAIL':'PASS',checksPassed:checks.length-failed.length,checksTotal:checks.length,
 scope:'CPU only; no GPU, visual or pacing acceptance. Tests use spatial relationships, authored physical sizes, actual GLB counts and unchanged exclusions, not minimum population targets.',
 baseline,sources,summary:{grassRoots:all.length,foregroundRoots:foreground.length,patches:plan.patches.length,clumps:plan.clumps.length,bareIntervals:plan.gaps.length,
 triangles:measurements.triangles,drawCalls:measurements.drawCalls,placements:measurements.placements,grassTriangles:measurements.grassTriangles},checks},null,2));
if(failed.length)process.exitCode=1;
