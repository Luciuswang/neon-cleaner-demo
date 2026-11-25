// Visual-only backdrop. No terrain queries, collision, lights, fog, downloads
// or frame update. Distances are metres in the existing world coordinate frame.
export const LANDSCAPE_LIMITS=Object.freeze({terrainHalfExtent:130,minRange:120,maxRange:700,maxTriangles:100000,maxDrawCalls:12,valleyHalfWidth:36});

// Six authored elongated ranges, NOT radial peaks or a mirrored mountain ring.
// Crest keys retain the original sculpt units; heightScale compresses relief
// around the buried -9m base. +face points toward the valley/camera.
export function landscapePlan(){
 return [
  {id:'west-foothills',layer:0,heightScale:.46,axis:'z',along:[-240,250],across:[-280,-134],face:1,segments:[112,48],seed:71,
   crest:[[0,.44,38],[.13,.48,83],[.24,.43,65],[.37,.51,112],[.49,.46,72],[.63,.53,94],[.76,.47,59],[.87,.52,79],[1,.48,32]]},
  {id:'east-foothills',layer:0,heightScale:.46,axis:'z',along:[-260,230],across:[134,295],face:-1,segments:[112,48],seed:163,
   crest:[[0,.53,32],[.12,.49,109],[.23,.55,84],[.39,.47,121],[.55,.56,69],[.69,.48,102],[.82,.54,63],[.92,.48,77],[1,.5,30]]},
  {id:'west-escarpment',layer:1,heightScale:.475,axis:'x',along:[-410,-70],across:[-435,-215],face:1,segments:[128,64],seed:277,
   crest:[[0,.38,56],[.12,.44,162],[.24,.39,133],[.39,.46,201],[.52,.40,147],[.65,.45,181],[.79,.40,112],[.9,.43,142],[1,.39,42]]},
  {id:'east-broken-range',layer:1,heightScale:.475,axis:'x',along:[88,420],across:[-450,-210],face:1,segments:[128,64],seed:389,
   crest:[[0,.43,47],[.11,.48,149],[.25,.4,118],[.42,.47,220],[.53,.41,173],[.68,.46,199],[.8,.4,137],[.91,.46,177],[1,.42,52]]},
  {id:'west-distant-range',layer:2,heightScale:.455,axis:'x',along:[-340,-50],across:[-590,-425],face:1,segments:[112,56],seed:503,
   crest:[[0,.44,63],[.13,.5,201],[.26,.42,162],[.4,.48,239],[.54,.43,188],[.7,.49,218],[.83,.41,155],[.92,.45,179],[1,.42,45]]},
  {id:'east-distant-range',layer:2,heightScale:.455,axis:'x',along:[60,340],across:[-590,-430],face:1,segments:[112,56],seed:617,
   crest:[[0,.45,52],[.12,.49,179],[.27,.42,211],[.38,.48,171],[.54,.41,248],[.67,.47,184],[.8,.43,226],[.91,.48,164],[1,.44,57]]}
 ];
}

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
function hash(x,z,seed){
 let n=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^Math.imul(seed|0,1274126177);
 n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function noise(x,z,seed){
 const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);
 return mix(mix(hash(ix,iz,seed),hash(ix+1,iz,seed),u),mix(hash(ix,iz+1,seed),hash(ix+1,iz+1,seed),u),v);
}
function fbm(x,z,seed){return noise(x,z,seed)*.61+noise(x*2.07,z*2.07,seed+19)*.27+noise(x*4.11,z*4.11,seed+41)*.12}
function keyAt(keys,t,column){
 let k=0;while(k<keys.length-2&&t>keys[k+1][0])k++;
 const a=keys[k],b=keys[k+1],u=clamp((t-a[0])/(b[0]-a[0]));
 // Broader eased shoulders, retaining unequal authored saddles and summits.
 return mix(a[column],b[column],mix(u,u*u*(3-2*u),.78));
}
function crossSection(d,scarp){
 const keys=scarp?[[0,1],[.19,.91],[.42,.66],[.64,.32],[.82,.14],[1,0]]:[[0,1],[.28,.87],[.54,.54],[.82,.14],[1,0]];
 return keyAt(keys,d,1);
}
export function ridgeBounds(p){
 return p.axis==='x'?{minX:p.along[0],maxX:p.along[1],minZ:p.across[0],maxZ:p.across[1]}:
  {minX:p.across[0],maxX:p.across[1],minZ:p.along[0],maxZ:p.along[1]};
}

// Pure sampler used by both renderer geometry and CPU checks. Returns null
// outside this patch, so it cannot accidentally become a new gameplay floor.
export function sampleRidge(p,x,z){
 const along=p.axis==='x'?x:z,across=p.axis==='x'?z:x;
 const u=(along-p.along[0])/(p.along[1]-p.along[0]),v=(across-p.across[0])/(p.across[1]-p.across[0]);
 if(u<0||u>1||v<0||v>1)return null;
 const c=clamp(keyAt(p.crest,u,1)+.025*(noise(along*.031,0,p.seed)-.5),.28,.72);
 const signed=v-c,d=Math.abs(signed)/(signed<0?c:1-c),scarp=Math.sign(signed)===p.face;
 const shoulder=d+.12*(noise(along*.022,across*.018,p.seed+37)-.5)*Math.sin(d*Math.PI);
 const taper=smooth(0,.10,u)*smooth(0,.10,1-u),profile=crossSection(shoulder,scarp);
 const crest=keyAt(p.crest,u,2)+(fbm(along*.025,0,p.seed+3)-.5)*(4.5+p.layer*2);
 let y=(crest+9)*profile;
 // Shallow, broad, laterally broken erosion replaces the previous deep narrow
 // longitudinal cuts that read as hanging cloth in the integrated frame.
 const flow=along+31*(noise(along*.014,across*.024,p.seed+5)-.5);
 const gully=Math.pow(1-Math.abs(noise(flow*.045,across*.046+along*.009,p.seed+7)*2-1),3);
 const tributary=Math.pow(1-Math.abs(noise(flow*.09,across*.061,p.seed+17)*2-1),4);
 const erode=smooth(.025,.17,d)*(1-smooth(.68,.98,d));
 y-=(crest*(scarp?.045:.028)*gully+crest*.006*tributary)*erode;
 const structure=(fbm(along*.043,across*.07,p.seed+23)-.5)*30*profile;
 // Tilted geological bedding, kept subordinate to the large eroded profile.
 const strata=Math.sin(y*.31+along*.027+noise(along*.023,across*.018,p.seed+29))*.45*profile;
 y=Math.max(0,y+structure+strata)*taper*p.heightScale-9;
 return {y,crest:(crest+9)*p.heightScale-9,cross:d,scarp,along,across};
}

export function validateLandscapePlan(plan=landscapePlan()){
 const errors=[],ids=new Set();let triangles=0,drawCalls=0;
 if(!Array.isArray(plan)||plan.length!==6)return {ok:false,errors:['Expected six ridge patches'],triangles,drawCalls};
 for(const p of plan){
  const fail=m=>errors.push(`${p?.id??'patch'}: ${m}`);
  if(!p||!['x','z'].includes(p.axis)||!Array.isArray(p.along)||!Array.isArray(p.across)||!Array.isArray(p.segments)){fail('invalid patch schema');continue}
  if(ids.has(p.id))fail('duplicate id');ids.add(p.id);
  if(![0,1,2].includes(p.layer)||![-1,1].includes(p.face)||!Number.isInteger(p.seed))fail('invalid layer/face/seed');
  if(!Number.isFinite(p.heightScale)||p.heightScale<=0||p.heightScale>1)fail('invalid relief scale');
  if(![p.along,p.across].every(a=>a.length===2&&a.every(Number.isFinite)&&a[0]<a[1])){fail('invalid extents');continue}
  if(p.segments.length!==2||p.segments.some(n=>!Number.isInteger(n)||n<2||n>256))fail('invalid subdivisions');
  triangles+=p.segments[0]*p.segments[1]*2;drawCalls+=2;
  const b=ridgeBounds(p),h=LANDSCAPE_LIMITS.terrainHalfExtent;
  if(b.minX<h&&b.maxX>-h&&b.minZ<h&&b.maxZ>-h)fail('overlaps existing terrain');
  if(b.minX<LANDSCAPE_LIMITS.valleyHalfWidth&&b.maxX>-LANDSCAPE_LIMITS.valleyHalfWidth)fail('closes central valley');
  const nearest=Math.hypot(clamp(0,b.minX,b.maxX),clamp(0,b.minZ,b.maxZ));
  const farthest=Math.max(...[b.minX,b.maxX].flatMap(x=>[b.minZ,b.maxZ].map(z=>Math.hypot(x,z))));
  if(nearest<LANDSCAPE_LIMITS.minRange||farthest>LANDSCAPE_LIMITS.maxRange)fail('outside distance budget');
  if(!Array.isArray(p.crest)||p.crest.length<7||p.crest[0]?.[0]!==0||p.crest.at(-1)?.[0]!==1)fail('insufficient authored ridge profile');
  else for(let i=0;i<p.crest.length;i++){
   const k=p.crest[i];
   if(!Array.isArray(k)||k.length!==3||!k.every(Number.isFinite)||k[1]<.25||k[1]>.75||k[2]<20||k[2]>270||(i&&k[0]<=p.crest[i-1]?.[0]))fail('invalid crest key');
  }
 }
 if(triangles>LANDSCAPE_LIMITS.maxTriangles)errors.push('Triangle budget exceeded');
 if(drawCalls>LANDSCAPE_LIMITS.maxDrawCalls)errors.push('Draw budget exceeded');
 if(new Set(plan.map(p=>p.layer)).size!==3)errors.push('Three atmospheric layers required');
 return {ok:errors.length===0,errors,triangles,drawCalls};
}

// All attributes are generated without Three/browser state or Math.random.
export function generateRidgeGeometry(p){
 const [na,nc]=p.segments,stride=na+1,count=stride*(nc+1);
 const positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3),uvs=new Float32Array(count*2);
 const samples=[],raw=[],rock=[],scrub=[];
 const bounds={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}};
 for(let j=0;j<=nc;j++)for(let i=0;i<=na;i++){
  const along=mix(...p.along,i/na),across=mix(...p.across,j/nc),x=p.axis==='x'?along:across,z=p.axis==='x'?across:along;
  const s=sampleRidge(p,x,z),k=j*stride+i;samples[k]=s;
  positions.set([x,s.y,z],k*3);
  // Height-aware metric projection keeps cliff texture from stretching as a
  // horizontal plane would. Both sides of a crest share the same UV frame.
  uvs.set([along/13,(across*.48+s.y*.88)/13],k*2);
  for(const [axis,value]of Object.entries({x,y:s.y,z})){bounds.min[axis]=Math.min(bounds.min[axis],value);bounds.max[axis]=Math.max(bounds.max[axis],value)}
 }
 function tri(a,b,c){
  if(p.axis==='x')[b,c]=[c,b];raw.push(a,b,c);
  const ai=a*3,bi=b*3,ci=c*3;
  const ux=positions[bi]-positions[ai],uy=positions[bi+1]-positions[ai+1],uz=positions[bi+2]-positions[ai+2];
  const vx=positions[ci]-positions[ai],vy=positions[ci+1]-positions[ai+1],vz=positions[ci+2]-positions[ai+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  for(const k of [ai,bi,ci]){normals[k]+=nx;normals[k+1]+=ny;normals[k+2]+=nz}
 }
 for(let j=0;j<nc;j++)for(let i=0;i<na;i++){
  const a=j*stride+i,b=a+1,c=a+stride,d=c+1;
  if((i+j)%2){tri(a,b,d);tri(a,d,c)}else{tri(a,b,c);tri(b,d,c)}
 }
 for(let k=0;k<count;k++){
  const n=k*3,len=Math.hypot(normals[n],normals[n+1],normals[n+2]);
  normals[n]/=len;normals[n+1]/=len;normals[n+2]/=len;
  const s=samples[k],nY=normals[n+1];
  const cover=smooth(.4,.78,nY)*(1-.25*smooth(.82,1,(s.y+9)/(s.crest+9)));
  const grain=fbm(s.along*.08,s.across*.085,p.seed+53),bedding=Math.sin(s.y*.63+s.along*.031);
  const contrast=[.7,.48,.27][p.layer],value=1+((grain-.5)*.12+bedding*.018)*contrast;
  const rocky=[[.61,.65,.56],[.56,.62,.63],[.49,.58,.65]][p.layer];
  const green=[[.2,.36,.27],[.25,.4,.36],[.31,.44,.47]][p.layer];
  for(let c=0;c<3;c++)colors[n+c]=clamp(mix(rocky[c],green[c],cover*.92)*value,.12,1);
 }
 for(let i=0;i<raw.length;i+=3){
  const a=raw[i],b=raw[i+1],c=raw[i+2],nY=(normals[a*3+1]+normals[b*3+1]+normals[c*3+1])/3;
  (nY>.6?scrub:rock).push(a,b,c);
 }
 const Index=count<=65535?Uint16Array:Uint32Array,indices=new Index([...rock,...scrub]);
 return {id:p.id,positions,normals,colors,uvs,indices,bounds,
  groups:[{start:0,count:rock.length,materialIndex:0},{start:rock.length,count:scrub.length,materialIndex:1}]};
}

// Seeded clustered canopy sites near the sampled crest. Noise-masked negative
// space, steep rock faces, the valley opening and the playable terrain stay clear.
function canopySites(p,maxLobes){
 const H=LANDSCAPE_LIMITS,L=[],xAxis=p.axis==='x',la=p.along[1]-p.along[0],lc=p.across[1]-p.across[0];
 const at=(a,c)=>xAxis?sampleRidge(p,a,c):sampleRidge(p,c,a);
 for(let n=0;n<maxLobes*12&&L.length<maxLobes;n++){
  const c=(n/6)|0,sp=9+24*hash(c,3,p.seed+211),u=.05+.9*hash(c,1,p.seed+101);
  const cv=clamp(keyAt(p.crest,u,1)+(hash(c,2,p.seed+113)-.5)*.7,.06,.94);
  const along=p.along[0]+la*u+(hash(n,5,p.seed+131)-.5)*sp,across=p.across[0]+lc*cv+(hash(n,6,p.seed+137)-.5)*sp;
  const r=(3.6+6*hash(n,7,p.seed+149)**2)*(1+p.layer*.3),m=r*1.25+4;
  if(along<p.along[0]+m||along>p.along[1]-m||across<p.across[0]+m||across>p.across[1]-m)continue;
  const x=xAxis?along:across,z=xAxis?across:along,d=Math.hypot(x,z);
  if(Math.abs(x)<H.valleyHalfWidth+m||(Math.abs(x)<H.terrainHalfExtent+m&&Math.abs(z)<H.terrainHalfExtent+m)||d-m<H.minRange||d+m>H.maxRange)continue;
  const s=at(along,across),sa=at(along+3,across),sc=at(along,across+3);
  if(!s||!sa||!sc||s.y<-5.5)continue;
  const slope=Math.hypot(sa.y-s.y,sc.y-s.y)/3;
  if(slope>1.15||fbm(along*.021,across*.027,p.seed+91)<.33+.1*s.cross)continue;
  L.push({n,x,z,y:s.y,r,slope});
 }
 return L;
}

export function validateRidgeGeometry(g,p){
 const errors=[],n=g.positions.length/3;let minRadius=Infinity,maxRadius=0,minY=Infinity,maxY=-Infinity,minArea=Infinity;
 const fail=m=>{if(!errors.includes(m))errors.push(m)};
 if(g.normals.length!==n*3||g.colors.length!==n*3||g.uvs.length!==n*2)fail('Attribute count mismatch');
 for(const name of ['positions','normals','colors','uvs'])if(!g[name].every(Number.isFinite))fail(`Nonfinite ${name}`);
 for(let k=0;k<n;k++){
  const x=g.positions[k*3],y=g.positions[k*3+1],z=g.positions[k*3+2],r=Math.hypot(x,z);
  minRadius=Math.min(minRadius,r);maxRadius=Math.max(maxRadius,r);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  if(Math.abs(x)<130&&Math.abs(z)<130)fail('Inside existing terrain');
  if(Math.abs(x)<LANDSCAPE_LIMITS.valleyHalfWidth)fail('Inside valley opening');
  if(Math.abs(Math.hypot(...g.normals.subarray(k*3,k*3+3))-1)>1e-5||g.normals[k*3+1]<=0)fail('Invalid normal');
  const sample=sampleRidge(p,x,z);
  if(!sample||Math.abs(sample.y-y)>.001)fail('Sampler/mesh disagreement');
 }
 if(g.indices.length!==p.segments[0]*p.segments[1]*6)fail('Triangle count mismatch');
 for(let i=0;i<g.indices.length;i+=3){
  const [a,b,c]=g.indices.subarray(i,i+3);
  if(a>=n||b>=n||c>=n){fail('Index outside vertex range');continue}
  const ax=g.positions[a*3],az=g.positions[a*3+2],bx=g.positions[b*3],bz=g.positions[b*3+2],cx=g.positions[c*3],cz=g.positions[c*3+2];
  const area=(bz-az)*(cx-ax)-(bx-ax)*(cz-az);minArea=Math.min(minArea,area*.5);
  if(area<=1e-6)fail('Degenerate or downward triangle');
  // Every triangle must lie wholly on one side of the terrain and valley.
  if(!(Math.max(ax,bx,cx)<=-130||Math.min(ax,bx,cx)>=130||Math.max(az,bz,cz)<=-130||Math.min(az,bz,cz)>=130))fail('Triangle crosses terrain');
  if(!(Math.max(ax,bx,cx)<=-LANDSCAPE_LIMITS.valleyHalfWidth||Math.min(ax,bx,cx)>=LANDSCAPE_LIMITS.valleyHalfWidth))fail('Triangle closes valley');
 }
 if(minRadius<LANDSCAPE_LIMITS.minRange||maxRadius>LANDSCAPE_LIMITS.maxRange)fail('Distance budget exceeded');
 if(g.groups.length!==2||g.groups[0].start!==0||g.groups[1].start!==g.groups[0].count||g.groups.reduce((s,v)=>s+v.count,0)!==g.indices.length||g.groups.some(v=>v.count%3||v.count<=0))fail('Invalid material groups');
 return {ok:errors.length===0,errors,id:p.id,vertices:n,triangles:g.indices.length/3,minRadius,maxRadius,minY,maxY,minProjectedArea:minArea};
}

// Visual-only canopy lobes appended to the existing scrub material group of a
// generated ridge (no new draw call). Seeded, clustered, crest-following; the
// pure generateRidgeGeometry output is copied, never mutated. Build-time only.
function appendCanopy(p,g,maxLobes){
 const H=LANDSCAPE_LIMITS,base=g.positions.length/3,L=canopySites(p,Math.min(maxLobes,Math.floor(H.maxTriangles/15))),xAxis=p.axis==='x';
 const nv=base+L.length*11,positions=new Float32Array(nv*3),normals=new Float32Array(nv*3),colors=new Float32Array(nv*3),uvs=new Float32Array(nv*2);
 positions.set(g.positions);normals.set(g.normals);colors.set(g.colors);uvs.set(g.uvs);
 const indices=new(nv<=65535?Uint16Array:Uint32Array)(g.indices.length+L.length*45);indices.set(g.indices);
 const bounds={min:{...g.bounds.min},max:{...g.bounds.max}},top=[[.22,.4,.28],[.27,.42,.37],[.32,.46,.48]][p.layer],s=p.seed+173;
 let q=g.indices.length;
 L.forEach((l,i)=>{
  const v0=base+i*11,ph=hash(l.n,11,s)*6.2832,h=l.r*(.6+.45*hash(l.n,13,s)),tone=.84+.3*hash(l.n,17,s),cy=l.y+h*.16;
  // Smooth normals radiate from a low centre: sunlit tops, darker undersides.
  const put=(k,px,py,pz,shade)=>{
   const o=(v0+k)*3,nx=px-l.x,ny=py-cy+l.r*.35,nz=pz-l.z,len=Math.hypot(nx,ny,nz)||1;
   positions[o]=px;positions[o+1]=py;positions[o+2]=pz;normals[o]=nx/len;normals[o+1]=ny/len;normals[o+2]=nz/len;
   for(let c=0;c<3;c++)colors[o+c]=clamp(top[c]*tone*shade,.1,1);
   uvs[(v0+k)*2]=(xAxis?px:pz)/13;uvs[(v0+k)*2+1]=((xAxis?pz:px)*.48+py*.88)/13;
   bounds.min.x=Math.min(bounds.min.x,px);bounds.max.x=Math.max(bounds.max.x,px);
   bounds.min.y=Math.min(bounds.min.y,py);bounds.max.y=Math.max(bounds.max.y,py);
   bounds.min.z=Math.min(bounds.min.z,pz);bounds.max.z=Math.max(bounds.max.z,pz);
  };
  for(let k=0;k<5;k++){
   const a=ph+k*1.2566,j=l.n*8+k,r0=l.r*.62*(.85+.3*hash(j,23,s)),r1=l.r*(.78+.44*hash(j,29,s)),k1=(k+1)%5;
   // Skirt ring is sunk below the sampled slope so no lobe floats.
   put(k,l.x+Math.cos(a)*r0,l.y-l.r*(.5+.6*l.slope),l.z+Math.sin(a)*r0,.5);
   put(5+k,l.x+Math.cos(a)*r1,l.y+h*(.34+.22*hash(j,31,s)),l.z+Math.sin(a)*r1,.76+.14*hash(j,37,s));
   indices.set([v0+k,v0+5+k,v0+k1,v0+k1,v0+5+k,v0+5+k1,v0+5+k,v0+10,v0+5+k1],q);q+=9;
  }
  put(10,l.x+(hash(l.n,19,s)-.5)*l.r*.5,l.y+h,l.z+(hash(l.n,41,s)-.5)*l.r*.5,1.08);
 });
 return {...g,positions,normals,colors,uvs,indices,bounds,canopyLobes:L.length,groups:[{...g.groups[0]},{...g.groups[1],count:g.groups[1].count+L.length*45}]};
}

/** Add once after stone/bark materials load; do NOT add this group to solids.
 * Inherits world environment, HDR sun and fog. Optional setWeather accepts
 * 0/'sunny', 1/'overcast', 2/'storm'; it only changes owned material clones.
 */
export function buildDistantLandscape({T,world,materials,forested=false}){
 if(!T?.BufferGeometry||!world?.add||!materials?.stone?.clone||!materials?.bark?.clone)throw new TypeError('Distant landscape requires T, world and loaded stone/bark materials');
 const plan=landscapePlan(),validation=validateLandscapePlan(plan);
 if(!validation.ok)throw new Error(validation.errors.join('; '));
 // Real headroom: limit minus terrain triangles, 15 tris per lobe, 0 new draws.
 const lobeBudget=Math.max(0,Math.min(320,Math.floor((LANDSCAPE_LIMITS.maxTriangles-validation.triangles)/plan.length/15)));
 const root=new T.Group();root.name='Riverfall distant eroded ranges';root.userData.visualOnly=true;
 const ownedMaterials=[],meshes=[],records=[];let weather='sunny',disposed=false;
 for(let layer=0;layer<3;layer++)for(const kind of ['stone','bark']){
  const m=materials[kind].clone();m.name=`landscape-${layer}-${kind==='stone'?'rock':'scrub'}`;
  m.color.setRGB(1,1,1);m.vertexColors=true;m.metalness=0;m.emissive?.set(0);
  m.transparent=false;m.opacity=1;m.alphaTest=0;m.depthWrite=true;m.fog=true;m.side=T.FrontSide;
  if(m.normalScale)m.normalScale.setScalar((kind==='stone'?.20:.12)*(1-layer*.25));
  // Reuse the loaded maps with subdued mineral albedo, preserving decoded
  // texture alpha and standard PBR lighting. No extra samplers, lights or fog.
  const contrast=[.24,.18,.12][layer];
  m.onBeforeCompile=shader=>{
   const mapChunk=T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`
    float mineralLuma = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    sampledDiffuseColor.rgb = mix(vec3(0.18), mix(vec3(mineralLuma), sampledDiffuseColor.rgb, 0.15), ${contrast.toFixed(2)});
    diffuseColor *= sampledDiffuseColor;
    ${forested ? `vec3 lwp = cameraPosition + (-vViewPosition) * mat3(viewMatrix);
    float dap = sin(lwp.x*.42+sin(lwp.z*.31)*2.3+lwp.y*.2)*sin(lwp.z*.47+sin(lwp.x*.27)*2.1)*.6+sin(lwp.x*1.7+lwp.y+sin(lwp.z*1.3)*1.7)*sin(lwp.z*1.9+sin(lwp.x*1.1))*.4/(1.+length(vViewPosition)*.004);
    diffuseColor.rgb *= 1. + dap * ${(kind==='bark'?.26:.08).toFixed(2)};` : ''}`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',mapChunk);
  };
  m.customProgramCacheKey=()=>forested?`landscape-canopy-v3-${layer}-${kind}`:`landscape-mineral-v2-${layer}`;
  ownedMaterials.push(m);
 }
 for(const p of plan){
  const base=generateRidgeGeometry(p),g=forested?appendCanopy(p,base,lobeBudget):base,geo=new T.BufferGeometry();
  for(const [name,array,itemSize]of [['position',g.positions,3],['normal',g.normals,3],['color',g.colors,3],['uv',g.uvs,2]])geo.setAttribute(name,new T.BufferAttribute(array,itemSize));
  geo.setIndex(new T.BufferAttribute(g.indices,1));
  for(const group of g.groups)geo.addGroup(group.start,group.count,group.materialIndex);
  geo.computeBoundingBox();geo.computeBoundingSphere();
  const mesh=new T.Mesh(geo,ownedMaterials.slice(p.layer*2,p.layer*2+2));mesh.name=p.id;
  mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=true;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
  mesh.userData.visualOnly=true;mesh.userData.layer=p.layer;root.add(mesh);meshes.push(mesh);
  records.push({id:p.id,layer:p.layer,axis:p.axis,bounds:g.bounds,triangles:g.indices.length/3,vertices:g.positions.length/3,drawCalls:g.groups.filter(q=>q.count).length});
 }
 function setWeather(mode){
  if(disposed)throw new Error('Landscape is disposed');
  const key=typeof mode==='number'?['sunny','overcast','storm'][mode]:mode;
  if(!['sunny','overcast','storm'].includes(key))throw new RangeError('Landscape weather must be sunny/overcast/storm or 0/1/2');
  weather=key;
  ownedMaterials.forEach((m,i)=>{
   const rock=i%2===0;
   m.roughness=key==='storm'?(rock?.68:.88):key==='overcast'?(rock?.81:.95):(rock?.91:.98);
   m.envMapIntensity=key==='storm'?.50:.45;
   // Main scene owns exposure, sun and haze. No emissive fake fog or baked sun.
  });
 }
 setWeather(0);world.add(root);
 return {root,setWeather,
  info(){return {version:'eroded-ridges-v2-low-valley',weather,disposed,seeded:true,snow:false,visualOnly:true,colliders:0,shadows:false,
   triangles:records.reduce((n,p)=>n+p.triangles,0),drawCalls:records.reduce((n,p)=>n+p.drawCalls,0),meshes:meshes.length,materials:ownedMaterials.length,
   terrainHalfExtent:130,valleyOpening:{minX:-36,maxX:36},distanceBudget:[120,700],layers:3,
   patches:records.map(p=>({...p,bounds:{min:{...p.bounds.min},max:{...p.bounds.max}}}))}},
  dispose(){if(disposed)return;root.removeFromParent();for(const mesh of meshes)mesh.geometry.dispose();for(const m of ownedMaterials)m.dispose();disposed=true}
 };
}
