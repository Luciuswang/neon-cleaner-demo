import * as T from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {buildWeapon} from './weapon.js';
import {buildCombatFeedback} from './combat-feedback.js';
import {buildActors} from './actors.js';
import {createStormAudio} from './storm-audio.js';
import {buildVillage} from './village.js';
import {buildPerimeter} from './perimeter-art.js';
import {buildVegetation} from './vegetation.js';
import {installTerrainRaycast} from './terrain-ray.js';
import {buildBufferHouses} from './buffer-house.js';
import {buildRuins} from './ruins.js';
import {buildRiverbankDetail} from './riverbank-detail.js';
import {buildDistantLandscape} from './distant-landscape.js';
import {buildRiverWater} from './river-water.js';
import {SOIL_MOISTURE_GLSL,soilMoisture} from './ground-moisture.js';
import {applySurfaceAttributes,installGroundSurface,buildFoundationWeeds,surfaceZones} from './ground-surface.js';
import {createHeightFog} from './height-fog.js';
import {buildDownloadedDressing} from './downloaded-dressing.js';
import {buildScanCover} from './scan-cover.js';
import {buildProceduralMaterials} from './procedural-materials.js';
import {installProceduralGround} from './procedural-ground.js';
import {lowerSkySun,AFTERRAIN_LIGHT} from './afterrain-light.js';
import {installLegacyForestTint,afterRainPuddleInterior} from './afterrain-ground.js';
import {buildPuddleReflection} from './puddle-reflection.js';
import {applyForestAttributes,buildForestFloor} from './forest-floor.js';
import {MAP,TERRAIN_GRID,layout,bounds,terrainHeight,groundHeight,landscapeHeight,roofHeight,riverWidth,bufferPlacements,vegetationAllowed,wallTopAt} from './map-layout.js';

export async function buildWorld(ctx){
 const {scene,cam,rnd,gscene,gun,sun,amb,enemies,solids,colliders}=ctx;
 const keep=new Set([sun,amb,...enemies.map(e=>e.g)]);
 for(const child of scene.children)if(!keep.has(child))child.visible=false;
 // Remove old-map proxies before creating the new authoritative map.
 solids.length=colliders.length=0;
 for(const b of bounds){const box=new T.Box3(new T.Vector3(b.min.x,b.min.y,b.min.z),new T.Vector3(b.max.x,b.max.y,b.max.z));if(b.profileWall)box.topAt=(x,z,r)=>wallTopAt(b.profileWall,x,z,r);colliders.push(box)}
 const world=new T.Group();world.name='Riverfall village';scene.add(world);
 const textureErrors=[],loader=new T.TextureLoader(),materials={};
 const procedural=new URLSearchParams(location.search).get('materials')!=='legacy';
 const afterRain=new URLSearchParams(location.search).get('look')!=='previous';
 const puddleBinding={uniforms:{}};
 let proceduralPack=null,migrationFrozen=false;
 let seed=519214,time=0,weather=0,style=0,post=true,flashes=true,flash=0,lightningAt=9;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const weatherAudio=createStormAudio(),windTime={value:0},rainStrength={value:0};
 async function map(path,color){const t=await loader.loadAsync(path);t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,rnd.capabilities.getMaxAnisotropy());return t}
 window.riverBootStep?.(4,'材质与贴图');const [shared,local]=await Promise.all(['./assets-manifest.json','./river/asset-sources.json'].map(p=>fetch(p).then(r=>{if(!r.ok)throw Error(p);return r.json()})));
 async function surface(name,files,tint=0xffffff,roughness=.85){
  const m=new T.MeshStandardMaterial({color:tint,roughness,metalness:0});
  await Promise.all(files.map(async f=>{const role=f.role,key={base_color:'map',normal_opengl:'normalMap',roughness:'roughnessMap',color:'map',normal:'normalMap'}[role];if(key)m[key]=await map(f.path,key==='map')}));
  m.normalScale.set(.65,.65);m.envMapIntensity=.7;m.name=name;materials[name]=m;return m;
 }
 const roles={wall_worn_plaster:'plaster',wood_weathered:'wood',roof_terracotta:'roof',tree_bark:'bark'};
 const proceduralNames=new Set(['plaster','wood','mud','stone','brick','dirt','forest_ground_04','metal']);
 await Promise.all([...shared.assets.filter(a=>roles[a.semantic_role]&&(!procedural||!proceduralNames.has(roles[a.semantic_role]))).map(a=>surface(roles[a.semantic_role],a.files)),
  ...local.assets.filter(a=>a.kind==='surface'&&!procedural).map(a=>surface(({brown_mud_02:'mud',rocky_gravel:'stone',brick_moss_001:'brick'})[a.id],a.files))]);
 if(procedural){proceduralPack=await buildProceduralMaterials(T,rnd);Object.assign(materials,proceduralPack.materials)}
 else materials.metal=new T.MeshStandardMaterial({color:0x4e5149,roughness:.65,metalness:.6});
 materials.roof.color.set(0x5f5445);materials.wood.color.set(0x9b9280);materials.plaster.color.set(0xdbceb0);
 const groundAssets=await fetch('./river/ground-surface-assets.json').then(r=>r.json());
 if(!procedural)await Promise.all(groundAssets.assets.map(a=>surface(a.id,a.files.map(f=>({role:f.role,path:'./river/'+f.file})))));
 const legacyTextureURLs=[...shared.assets.filter(a=>['plaster','wood'].includes(roles[a.semantic_role])).flatMap(a=>a.files.map(f=>f.path)),...local.assets.filter(a=>a.kind==='surface').flatMap(a=>a.files.map(f=>f.path)),...groundAssets.assets.flatMap(a=>a.files.map(f=>'./river/'+f.file))].map(p=>new URL(p,document.baseURI).href);
 window.riverBootStep?.(4,'天空与光照');const [hdr,cloudHDR]=await Promise.all([
  new RGBELoader().setDataType(T.FloatType).loadAsync('./river/assets/afterrain-light/kloofendal_43d_clear_puresky_2k.hdr'),
  new RGBELoader().loadAsync('./assets/kloofendal_overcast_puresky/kloofendal_overcast_puresky_2k.hdr')]);
 hdr.mapping=cloudHDR.mapping=T.EquirectangularReflectionMapping;
 // Equirectangular sky, physical environment and key share the measured sun.
 // RGBE rows are top-down; loader flips them for texture sampling.
 const hd=hdr.image;let brightest=-1,sunPixel=0;
 for(let i=0;i<hd.data.length;i+=4){const l=hd.data[i]*.2126+hd.data[i+1]*.7152+hd.data[i+2]*.0722;if(l>brightest){brightest=l;sunPixel=i/4}}
 // Rotate the entire panorama in integer texels so sunlight crosses the river
 // from behind-left of the northbound hero view, lighting the visible stone
 // faces instead of backlighting all banks. Environment/reflections
 // receive the same rotated pixels, not an independently faked key direction.
 const originalSunX=sunPixel%hd.width,desiredSunU=afterRain?.36:.86,skyShift=Math.round(desiredSunU*hd.width-.5-originalSunX),rotated=new Float32Array(hd.data.length);
 for(let y=0;y<hd.height;y++)for(let x=0;x<hd.width;x++){const nx=(x+skyShift+hd.width)%hd.width,i=(y*hd.width+x)*4,j=(y*hd.width+nx)*4;rotated[j]=hd.data[i];rotated[j+1]=hd.data[i+1];rotated[j+2]=hd.data[i+2];rotated[j+3]=hd.data[i+3]}
 hd.data=rotated;hdr.needsUpdate=true;
 if(afterRain){const lowered=lowerSkySun(hd,Math.floor(sunPixel/hd.width)*hd.width+(originalSunX+skyShift+hd.width)%hd.width);hd.data=lowered.data;sunPixel=lowered.sunPixel}
 const u=afterRain?(sunPixel%hd.width+.5)/hd.width:((originalSunX+skyShift+hd.width)%hd.width+.5)/hd.width,v=1-(Math.floor(sunPixel/hd.width)+.5)/hd.height;
 const phi=(u-.5)*Math.PI*2,latitude=(v-.5)*Math.PI;
 const sunDirection=new T.Vector3(Math.cos(latitude)*Math.cos(phi),Math.sin(latitude),Math.cos(latitude)*Math.sin(phi));
 // The scan's solar disc peaks at >111,000 while ordinary sky is ~0.17–3.
 // Separate sky fill from our shadow-casting solar key to avoid counting that
 // sun twice and turning wet soil into a white specular sheet. Background keeps
 // full range; IBL is radiance-limited, with identical spatial orientation.
 const lightingPixels=new Float32Array(hd.data);
 for(let i=0;i<lightingPixels.length;i+=4){const l=lightingPixels[i]*.2126+lightingPixels[i+1]*.7152+lightingPixels[i+2]*.0722,f=Math.min(1,16/Math.max(l,.0001));lightingPixels[i]*=f;lightingPixels[i+1]*=f;lightingPixels[i+2]*=f}
 const lightingHDR=new T.DataTexture(lightingPixels,hd.width,hd.height,T.RGBAFormat,T.FloatType);lightingHDR.mapping=T.EquirectangularReflectionMapping;lightingHDR.colorSpace=T.LinearSRGBColorSpace;lightingHDR.flipY=true;lightingHDR.needsUpdate=true;
 const pmrem=new T.PMREMGenerator(rnd),env=pmrem.fromEquirectangular(lightingHDR),cloudEnv=pmrem.fromEquirectangular(cloudHDR);pmrem.dispose();lightingHDR.dispose();
 scene.background=hdr;scene.backgroundBlurriness=0;
 sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=sun.shadow.camera.bottom=-46;sun.shadow.camera.right=sun.shadow.camera.top=46;
 sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.bias=-.00012;sun.shadow.normalBias=.035;sun.shadow.radius=3;
 const target=new T.Object3D();target.position.set(0,0,-4);scene.add(target);sun.target=target;
 rnd.setPixelRatio(Math.min(devicePixelRatio,1.5));rnd.toneMappingExposure=1.08;

 const mud=materials.mud.clone();mud.roughness=.94;mud.normalScale.set(1.18,1.18);mud.envMapIntensity=.38;mud.color.set(0xd5c9b4);
 if(procedural)installProceduralGround(T,mud,{dirt:materials.dirt,forest:materials.forest_ground_04,rain:rainStrength,time:windTime,afterRain:afterRain?puddleBinding:null});
 else installGroundSurface(T,mud,{dirt:materials.dirt,forest:materials.forest_ground_04,rain:rainStrength});
 if(afterRain&&!procedural)installLegacyForestTint(mud);
 const geo=new T.PlaneGeometry(TERRAIN_GRID.size,TERRAIN_GRID.size,TERRAIN_GRID.segments,TERRAIN_GRID.segments);geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),ax=Math.abs(x),az=Math.abs(z+4);
  let y=landscapeHeight(x,z);
  p.setY(i,y);uv.setXY(i,x/3,z/3);
 }geo.computeVertexNormals();
 applySurfaceAttributes(T,geo);
 if(afterRain)applyForestAttributes(T,geo);
 const terrain=new T.Mesh(geo,mud);terrain.receiveShadow=true;installTerrainRaycast(T,terrain,TERRAIN_GRID.size,TERRAIN_GRID.segments);world.add(terrain);solids.push(terrain);
 // A separate measured riverbed follows the same height contract, with gravel.
 // Same 0.5m cells/diagonals as the ground underneath. Finer mismatched
 // triangles could dip through it between vertices and reveal straight seams.
 const bedGeo=new T.PlaneGeometry(18,160,36,320);bedGeo.rotateX(-Math.PI/2);
 const bp=bedGeo.attributes.position,bu=bedGeo.attributes.uv;
 for(let i=0;i<bp.count;i++){const x=bp.getX(i),z=bp.getZ(i);bp.setY(i,groundHeight(x,z)+.008);bu.setXY(i,x/2,z/2)}bedGeo.computeVertexNormals();
 const gravel=materials.stone.clone();gravel.color.set(0x9ca28d);gravel.roughness=.78;gravel.transparent=true;gravel.depthWrite=false;
 gravel.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 bedPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nbedPos=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 bedPos;').replace('#include <alphatest_fragment>',`float bank=3.4+.8*cos(bedPos.z*.17)+.35*sin(bedPos.z*.47);float noise=sin(bedPos.z*4.1+sin(bedPos.x*6.))*sin(bedPos.z*1.3)*.35;
   diffuseColor.a*=1.-smoothstep(bank+.6,bank+2.5,abs(bedPos.x)+noise);if(diffuseColor.a<.01)discard;\n#include <alphatest_fragment>`);
 };
 const bed=new T.Mesh(bedGeo,gravel);bed.receiveShadow=true;world.add(bed);
 const village=buildVillage({T,world,materials,layout,solids});
 buildPerimeter(T,world,materials.stone,solids);
 const ruins=buildRuins({T,world,materials,layout,solids});
 const buffers=buildBufferHouses({T,world,materials,solids,cam,getInteractionState:ctx.getInteractionState,placements:bufferPlacements});
 window.riverBootStep?.(5,'村落与植被');const foliage=await buildVegetation(T,world,{renderer:rnd,stoneMaterial:materials.stone,sunDirection,environment:env.texture});
 const foundationWeeds=await buildFoundationWeeds(T,world);
 const bankDetail=await buildRiverbankDetail({T,world,materials});bed.material=bankDetail.bedMaterial;bed.material.color.set(0xc8c5ba);bed.material.normalScale.set(.54,.54);gravel.dispose();
 const distant=buildDistantLandscape({T,world,materials,forested:afterRain});
 if(afterRain){let s=20261123;const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};const tp=[],tc=[],ti=[],fp=[],fc=[];const mix=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];const add=(p,d,k)=>[p[0]+d[0]*k,p[1]+d[1]*k,p[2]+d[2]*k];const V=(p,c)=>{fp.push(p[0],p[1],p[2]);fc.push(c[0],c[1],c[2]);};const tri=(a,ca,b,cb,c,cc)=>{V(a,ca);V(b,cb);V(c,cc);};const spots=[[12.4+R()*.6,MAP.maxZ+8.6+R(),10.6,3.9],[14.9+R()*.6,MAP.maxZ+11.2+R(),7.9,3],[13.3+R()*.6,MAP.maxZ+14+R(),6.3,2.3],[-12,MAP.minZ-8.8-R(),9.3,3.5],[-12,MAP.minZ-12.6-R(),6.8,2.6]];for(const [px,pz,H,W] of spots){const y0=landscapeHeight(px,pz)-.25,la=R()*6.283,L=H*(.12+.14*R()),dx=Math.cos(la),dz=Math.sin(la),R0=.17+H*.011,b0=tp.length/3;for(let i=0;i<16;i++){const t=i/15,k=L*(1-(1-t)*(1-t)),rad=R0*(1-.5*t)*(1+.45*Math.exp(-t*9))*(i%2?1:1.13),g=(i%2?.74:1)*(.85+.25*t);for(let j=0;j<6;j++){const a=j*1.0472;tp.push(px+dx*k+Math.cos(a)*rad,y0+H*t,pz+dz*k+Math.sin(a)*rad);tc.push(.4*g,.34*g,.26*g);if(i<15){const p=b0+i*6+j,q=b0+i*6+(j+1)%6;ti.push(p,p+6,q,q,p+6,q+6);}}}const top=[px+dx*L,y0+H,pz+dz*L],fl=W*.62;for(let k=0;k<14;k++){const u=k/13,az0=k*2.39996+R()*.5,el=1.2-1.65*u+R()*.15,Lf=fl*(.78+.3*R()),ds=Lf/14,o=Math.max(0,Math.min(1,(u-.62)/.3))*(.5+.5*R()),v=.85+.3*R(),cb=mix([.17*v,.3*v,.12*v],[.5,.4,.2],o),ct=mix([.42*v,.5*v,.2*v],[.68,.56,.27],o),c2=mix(cb,ct,.5);let p=top;for(let j=0;j<14;j++){const q=j/14,az=az0+.3*q,pt=Math.max(-1.35,el-(1+u)*Math.pow(q,1.3)),F=[Math.cos(pt)*Math.cos(az),Math.sin(pt),Math.cos(pt)*Math.sin(az)],S=[-Math.sin(az),0,Math.cos(az)],n=add(p,F,ds),w=.012+.035*(1-q),cm=mix(cb,ct,q*.5);tri(add(p,S,-w),cm,add(p,S,w),cm,add(n,S,w),cm);tri(add(p,S,-w),cm,add(n,S,w),cm,add(n,S,-w),cm);const ll=Lf*.36*Math.sin(3.1416*(.1+.82*(j+1)/14))*(.85+.3*R()),lw=.03+ll*.07;for(const sd of [-1,1]){const d=[S[0]*sd*.8+F[0]*.45,-.3-.45*u+F[1]*.45,S[2]*sd*.8+F[2]*.45],m=add(n,d,ll*.5),e=add(n,d,ll);e[1]-=ll*.22;const a2=add(n,F,lw),m2=add(m,F,lw*.7);tri(n,cb,a2,cb,m2,c2);tri(n,cb,m2,c2,m,c2);tri(m,c2,m2,c2,e,ct);}p=n;}}}const mk=(pos,col,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));if(idx)g.setIndex(idx);g.computeVertexNormals();return g;};const palms=new T.Group();palms.name='palmGrove';const tm=new T.Mesh(mk(tp,tc,ti),new T.MeshStandardMaterial({vertexColors:true,roughness:.95,metalness:0}));const fm=new T.Mesh(mk(fp,fc),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0,side:T.DoubleSide}));for(const m of [tm,fm]){m.castShadow=false;m.receiveShadow=true;m.raycast=()=>{};palms.add(m);}palms.userData={palms:5,groups:2,draws:2,triangles:ti.length/3+fp.length/9,decorative:true,collision:false};world.add(palms);}
 window.riverBootStep?.(5,'装饰与掩体');const dressing=await buildDownloadedDressing(T,world);
 try{const scanned=buildScanCover({T,world,walls:layout.walls,solids,sources:dressing.coverSources()});if(scanned)village.setCoverReplacement(scanned)}
 catch(error){textureErrors.push('Reference cover fallback: '+error.message)}
 const forestFloor=afterRain?buildForestFloor(T,world):null;

 const water=buildRiverWater({T,Reflector,world,time:windTime,rain:rainStrength,sunDirection});

 const puddleMaterial=new T.MeshPhysicalMaterial({color:0x303b2c,roughness:.19,metalness:0,transparent:true,opacity:.32,clearcoat:1,clearcoatRoughness:.1,envMapIntensity:.75,depthWrite:false});
 const puddleGeometry=new T.CircleGeometry(1,72),puddles=[];
 const pp=puddleGeometry.attributes.position;for(let i=1;i<pp.count;i++){const a=Math.atan2(pp.getY(i),pp.getX(i)),r=.85+.1*Math.sin(a*5)+.05*Math.sin(a*9+.7);pp.setXY(i,pp.getX(i)*r,pp.getY(i)*r)}puddleGeometry.computeVertexNormals();
 for(const side of [-1,1])for(const z of [-28,-17,-9,3,11,22]){
  const pond=new T.Mesh(puddleGeometry,puddleMaterial);pond.rotation.x=-Math.PI/2;pond.position.set(side*(10+random()*2),.019,z);pond.scale.set(1.1+random(),.42+random()*.6,1);world.add(pond);puddles.push(pond);
  // Generated basins belong to the actual terrain, not a floating circular decal.
  if(procedural)pond.visible=false;
 }
 puddleMaterial.onBeforeCompile=s=>{s.uniforms.uTime=windTime;s.uniforms.uRain=rainStrength;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 wetPos;varying vec2 wetLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nwetLocal=position.xy;wetPos=(modelMatrix*vec4(position,1.)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;uniform float uRain;varying vec3 wetPos;varying vec2 wetLocal;\n'+SOIL_MOISTURE_GLSL).replace('#include <alphatest_fragment>',`float irregular=sin(wetPos.x*11.+sin(wetPos.z*6.))*sin(wetPos.z*14.)*.035;
  float wetAngle=atan(wetLocal.y,wetLocal.x),wetBoundary=.85+.1*sin(wetAngle*5.)+.05*sin(wetAngle*9.+.7);
  diffuseColor.a*=(1.-smoothstep(wetBoundary-.24,wetBoundary-.055,length(wetLocal)+irregular))*smoothstep(.30,.70,soilMoisture(wetPos.xz,uRain));if(diffuseColor.a<.005)discard;
  #include <alphatest_fragment>`).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec2 q=wetPos.xz*2.3,id=floor(q),f=fract(q)-.5;float t=fract(uTime*1.3+fract(sin(dot(id,vec2(12.1,78.2)))*4375.));
  float wave=sin((length(f)-t*.65)*60.)*exp(-abs(length(f)-t*.65)*26.)*(1.-t);
  normal=normalize(normal+vec3(f.x*wave*.14*uRain,f.y*wave*.14*uRain,0.));`)};

 const rainCount=1800,rainPositions=new Float32Array(rainCount*6),rainSeeds=Array.from({length:rainCount},()=>[random()*56-28,random()*21,random()*56-28,random()]);
 const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(rainPositions,3));
 const rainMat=new T.LineBasicMaterial({color:0xc3d5d1,transparent:true,opacity:.13,depthWrite:false});
 const rain=new T.LineSegments(rainGeo,rainMat);rain.frustumCulled=false;world.add(rain);
 const splashCount=360,splashData=new Float32Array(splashCount*3),splashSeeds=[];
 for(let i=0;i<splashCount;i++){const z=random()*60-34,x=(random()-.5)*4.4;splashSeeds.push([x,z,random(),random()*6.28])}
 const splashGeo=new T.BufferGeometry();splashGeo.setAttribute('position',new T.BufferAttribute(splashData,3));
 const splashes=new T.Points(splashGeo,new T.PointsMaterial({color:0xc9d5c7,size:.035,transparent:true,opacity:.5,depthWrite:false}));world.add(splashes);
 const flashLight=new T.DirectionalLight(0xd8e7ff,0);flashLight.position.set(8,35,-18);scene.add(flashLight);
 // Low warm practicals remain localized inside intact/partly ruined houses.
 const lamps=[];
 for(const h of layout.houses.filter(h=>h.ruin<2)){
  const light=new T.PointLight(0xffb36c,9,8,2);light.position.set(h.x+2,2.35,h.z+1.8);world.add(light);lamps.push(light);
  const shade=new T.Mesh(new T.SphereGeometry(.095,8,6),new T.MeshStandardMaterial({color:0xffbd76,emissive:0xffa347,emissiveIntensity:3}));shade.position.copy(light.position);world.add(shade);
 }
 window.riverBootStep?.(5,'武器与角色');const [weapon,actors]=await Promise.all([buildWeapon({THREE:T,gun,gscene,cam,scene,sun,amb,solids}),buildActors({THREE:T,enemies})]);
 const feedback=buildCombatFeedback({T,world});
 // Install last so terrain, masonry and wind hooks compose rather than replace
 // one another. Gun/HUD are deliberately outside these world/enemy roots.
 const haze=createHeightFog(T);haze.install(world);enemies.forEach(e=>haze.install(e.g));
 const puddleReflection=afterRain&&procedural?buildPuddleReflection({T,Reflector,world,scene,terrain,water,cam,haze}):null;
 if(puddleReflection)Object.assign(puddleBinding.uniforms,puddleReflection.uniforms);
 // Presentation only. Tags a true terrain hit that lands inside a broad visible
 // puddle so feedback can show the water impact style. No raycast, accuracy or
 // damage change; a miss or a non-terrain hit is returned untouched. Gates mirror
 // the shader: shared basin noise, then flat y=0 height, slope, foundation and
 // forest cover read from the same vertex attributes the shader interpolates.
 // combatFeedback reads event.kind, so a qualifying earth hit on the terrain is
 // returned as a copy with kind 'water'. The input event is never mutated.
 const puddleHitEvent=event=>{
  if(!procedural||!afterRain||!puddleReflection||event?.kind!=='earth'||event.object!==terrain||!event.point)return event;
  const x=event.point.x,z=event.point.z;
  if(!afterRainPuddleInterior(x,z))return event;
  const g=terrain.geometry,P=g.attributes.position,N=g.attributes.normal,Z=g.attributes.surfaceZones,F=g.attributes.forestCover;
  if(!P||!N||!Z||!F)return event;
  const S=TERRAIN_GRID.segments,half=TERRAIN_GRID.size/2,step=TERRAIN_GRID.size/S,ix=Math.min(S-1,Math.max(0,Math.floor((x+half)/step))),iz=Math.min(S-1,Math.max(0,Math.floor((z+half)/step)));let near=0;
  for(const i of [iz*(S+1)+ix,iz*(S+1)+ix+1,(iz+1)*(S+1)+ix,(iz+1)*(S+1)+ix+1]){
   if(Math.abs(P.getY(i))>.006||1-Math.abs(N.getY(i))>.015||Z.getY(i)>=.08||F.getX(i)>=.08)return event;
   near++;
  }
  return near>=4?{...event,kind:'water'}:event;
 };
 haze.shaderPatch(water.mesh.material,{worldPosition:'vRiver'});
 const reflectedRender=water.mesh.onBeforeRender;
 water.mesh.onBeforeRender=function(...args){
  haze.setReflection(true,MAP.waterY);
  try{return reflectedRender.apply(this,args)}finally{haze.setReflection(false,MAP.waterY)}
 };
 const composer=new EffectComposer(rnd);composer.addPass(new RenderPass(scene,cam));
 const ao=new SSAOPass(scene,cam,innerWidth,innerHeight);ao.kernelRadius=.9;
 // SSAO delta is normalized linear camera depth; values are NOT world metres.
 // Old .003 meant ~3m, rejecting contacts inside a .55m sample hemisphere.
 const aoSettings={radius:.9,minMetres:.02,maxMetres:1.4};
 const refreshAO=()=>{const span=cam.far-cam.near;ao.minDistance=aoSettings.minMetres/span;ao.maxDistance=aoSettings.maxMetres/span;
  ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix);ao.ssaoMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse);
  ao.ssaoMaterial.uniforms.cameraNear.value=cam.near;ao.ssaoMaterial.uniforms.cameraFar.value=cam.far;};
 refreshAO();composer.addPass(ao);
 // Transparent water/bed decals have their own depth-shaped shading. The SSAO
 // normal override would replace their clipping shader with a solid rectangle,
 // creating phantom occlusion and burying stones below an invisible plane.
 const aoCutouts=[];world.traverse(o=>{if(o.isMesh&&[].concat(o.material).some(m=>m?.alphaTest>0))aoCutouts.push(o)});
 const hideAO=ao.overrideVisibility.bind(ao);
 // Leaf cards likewise cannot use an opaque normal override. Their authored AO
 // and alpha-correct directional shadows remain; no invented solid-card SSAO.
 const feedbackMeshes=[];world.getObjectByName('authoritative-combat-feedback')?.traverse(o=>{if(o.isMesh)feedbackMeshes.push(o)});
 ao.overrideVisibility=function(){hideAO();water.mesh.visible=false;bed.visible=false;puddles.forEach(p=>p.visible=false);aoCutouts.forEach(p=>p.visible=false);feedbackMeshes.forEach(p=>p.visible=false)};
 const renderAOOverride=ao.renderOverride.bind(ao);
 ao.renderOverride=function(renderer,...args){
  const auto=renderer.shadowMap.autoUpdate,needs=renderer.shadowMap.needsUpdate;
  // Hidden cutouts in the normal pass must never overwrite the real leaf
  // shadow cache; the beauty pass updates it with the proper alpha/wind maps.
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
  try{return renderAOOverride(renderer,...args)}finally{renderer.shadowMap.autoUpdate=auto;renderer.shadowMap.needsUpdate=needs}
 };
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.03);c*=mix(.95,1.,1.-smoothstep(.1,.8,distance(vUv,vec2(.5))));gl_FragColor=vec4(c,1.);}'});composer.addPass(grade);composer.addPass(new OutputPass());composer.addPass(new SMAAPass(innerWidth*rnd.getPixelRatio(),innerHeight*rnd.getPixelRatio()));
 addEventListener('resize',()=>composer.setSize(innerWidth,innerHeight));
 function applyWeather(){
  const wet=weather===2,day=weather===0;
  sun.position.copy(sunDirection).multiplyScalar(75).add(target.position);sun.color.set(afterRain&&day?AFTERRAIN_LIGHT.key:style?0xffdfba:0xfff1df);sun.intensity=day?(afterRain?AFTERRAIN_LIGHT.sun:4.0):wet?2.1:1.8;
  amb.color.set(afterRain&&day?AFTERRAIN_LIGHT.skyFill:0xc6dbf1);amb.groundColor.set(afterRain&&day?AFTERRAIN_LIGHT.groundFill:0x928b75);amb.intensity=day?(afterRain?AFTERRAIN_LIGHT.ambient:1.6):.38;
  scene.environment=gscene.environment=(day?env:cloudEnv).texture;scene.background=day?hdr:cloudHDR;
  scene.fog=new T.Fog(day?0x9db7ce:0x889996,day?95:65,day?920:230);scene.backgroundIntensity=day?1:.44;
  rnd.toneMappingExposure=day?1.18:style?.95:.90;rain.visible=splashes.visible=wet;rainStrength.value=wet?1:0;water.setDay(day);mud.roughness=procedural?1:wet?.76:.91;
  if(afterRain&&day){rnd.toneMappingExposure=AFTERRAIN_LIGHT.exposure;scene.backgroundIntensity=AFTERRAIN_LIGHT.sky}
  flash=0;flashLight.intensity=0;
  distant.setWeather(weather);
  foliage.setWeather(weather);
  haze.setWeather(weather);
  const visited=new Set();world.traverse(o=>{if(o.isPointLight){o.userData.weatherBase??=o.intensity;o.intensity=o.userData.weatherBase*(day?.20:1)}if(o.isMesh)for(const m of [].concat(o.material)){if(!m||visited.has(m))continue;visited.add(m);
   if(m.name==='WindowTrim')m.color.set(0x999d92);
   if(m.envMapIntensity!==undefined&&!m.name.startsWith('landscape-')){m.userData.baseEnvironment??=m.envMapIntensity;m.envMapIntensity=m.userData.baseEnvironment*(day?(afterRain?.72:1.05):1)}
   if(m.emissiveIntensity>0){m.userData.weatherBase??=m.emissiveIntensity;m.emissiveIntensity=m.userData.weatherBase*(day?.15:1)}
  }});
  document.getElementById('weatherName').textContent=['雨后 · 湿润河谷','阴天 · 山林薄雾','降雨 · 双岸村落'][weather];
  document.getElementById('styleName').textContent=style?'暖调 · 雨后天光':'自然 · 山谷日照';
  // The viewmodel consumes actual world lights in weapon.update, never a
  // camera-fixed studio rig with an unrelated highlight direction.
 }
 document.getElementById('bPost').onclick=e=>{post=!post;ao.enabled=grade.enabled=post;e.currentTarget.textContent='后期：'+(post?'开':'关');e.currentTarget.setAttribute('aria-pressed',String(post))};
 document.getElementById('bFlash').onclick=e=>{flashes=!flashes;flash=0;flashLight.intensity=0;e.currentTarget.textContent='闪电：'+(flashes?'开启':'关闭');e.currentTarget.setAttribute('aria-pressed',String(flashes))};
 const comparison=document.createElement('a');comparison.className='btn';comparison.id='materialCompare';
 const comparisonURL=new URL(location.href);comparisonURL.searchParams.set('materials',procedural?'legacy':'procedural');
 comparison.href=comparisonURL.href;comparison.textContent=procedural?'材质：程序化 · 切回旧版':'材质：旧版 · 查看程序化';
 comparison.title='保留同一张地图和玩法；重新加载切换材质';document.getElementById('stormControls').append(comparison);
 const lookCompare=document.createElement('a');lookCompare.className='btn';lookCompare.id='lookCompare';
 const lookURL=new URL(location.href);if(afterRain)lookURL.searchParams.set('look','previous');else lookURL.searchParams.delete('look');
 lookCompare.href=lookURL.href;lookCompare.textContent=afterRain?'雨后光感 · 对比修改前':'修改前 · 查看雨后新版';document.getElementById('stormControls').append(lookCompare);
 let migrationMaterials=null,migrationAnalytic=null;
 function migrationInfo(){
  const visited=new Set(),used=[],analytic=[];
  // Only report actually attached whitelisted generated materials; scans used
  // by foliage, river substrate, gun and optional imports are not relabelled.
  if(!migrationMaterials)world.traverse(o=>{if(!o.isMesh)return;for(const m of [].concat(o.material)){if(!m||visited.has(m))continue;visited.add(m);
   if(m.userData.proceduralAnalytic)analytic.push({name:m.name,...m.userData.proceduralAnalytic});
   if(!m.userData.procedural)continue;
   used.push({name:m.name,procedural:true,definition:m.userData.procedural,maps:Object.fromEntries(['map','normalMap','roughnessMap','metalnessMap','aoMap'].filter(k=>m[k]).map(k=>{const t=m[k];return[k,{name:t.name,source:t.isDataTexture?'generated':'external',size:[t.image?.width,t.image?.height],colorSpace:t.colorSpace,repeat:t.repeat.toArray(),mipmaps:t.generateMipmaps}]}))});
  }});
  migrationMaterials??=used;
  migrationAnalytic??=analytic;
  return{enabled:procedural,mode:procedural?'procedural':'legacy',frozen:migrationFrozen,time,materials:migrationMaterials,analyticMaterials:migrationAnalytic,legacyTextureURLs,bake:proceduralPack?.info||null,resources:{geometries:rnd.info.memory.geometries,textures:rnd.info.memory.textures,programs:rnd.info.programs?.length},ground:procedural?mud.userData.proceduralGround:null,river:'existing scanned substrate, modeled stones and planar flow preserved',sky:afterRain?'CC0 sky remapped in memory with measured matching 26-degree sun':'existing CC0 HDR and matching sun preserved',extraReflectionPasses:puddleReflection?1:0,extraGeometry:(forestFloor?.info().triangles||0)+(puddleReflection?.info().proxyTriangles||0)};
 }
 applyWeather();
 return{
  migrationQA:{freeze(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid migration time');migrationFrozen=true;time=seconds;windTime.value=seconds;foliage.update(seconds);dressing.update(seconds);forestFloor?.update(seconds);flash=0;flashLight.intensity=0;lightningAt=seconds+9;return migrationInfo()}},
  waterTime(){return time},
  shot(event){const projected=event.hit&&event.object?.userData.wall?village.projectStoneCoverHit?.({point:event.point,normal:event.normal,wallId:event.object.userData.wall}):null;
   if(projected)event={...event,point:projected.point,normal:projected.normal};weapon.shot(event);feedback.shot(puddleHitEvent(event))},resetFeedback(){weapon.reset();feedback.reset()},
  polishInfo(){return{environment:foliage.info().polish,cover:village.info().stoneCover,combat:feedback.info(),weapon:weapon.info()}},
  floorHeight(x,z){return buffers.floorHeight(x,z)??Math.max(terrainHeight(x,z),ruins.floorHeight(x,z))},ceilingY(p,previousY){const roof=roofHeight(p.x,p.z);return Math.min(previousY<roof?roof-.15:Infinity,buffers.ceilingY(p,previousY))},blocksMovement:(p,actor)=>buffers.blocksMovement(p,actor),resetHouse:()=>buffers.reset(),
  update(dt,{S,pres,live,player}){
   const active=!pres&&!['pause','dead','win'].includes(S.state);if(active&&!migrationFrozen)time+=dt;
   windTime.value=time;foliage.update(time);dressing.update(time);forestFloor?.update(time);village.update?.(dt,time);buffers.update(dt,{S,pres,live,player});
   if(weather===2){for(let i=0;i<rainCount;i++){
    const s=rainSeeds[i],x=s[0]+cam.position.x,z=s[2]+cam.position.z,yy=((s[1]-time*(14+s[3]*7))%21+21)%21;
    const floor=terrainHeight(x,z),roof=roofHeight(x,z),y=(floor+yy<roof&&Number.isFinite(roof))||buffers.underRoof(x,floor+yy,z)||buffers.underRoof(x+.08,floor+yy+.5+s[3]*.35,z+.03)?-20:floor+yy,k=i*6;
    rainPositions[k]=x;rainPositions[k+1]=y;rainPositions[k+2]=z;rainPositions[k+3]=x+.08;rainPositions[k+4]=y+.5+s[3]*.35;rainPositions[k+5]=z+.03;
   }rainGeo.attributes.position.needsUpdate=true;
   for(let i=0;i<splashCount;i++){const [x,z,phase,a]=splashSeeds[i],t=(time*1.7+phase)%1,surface=terrainHeight(x,z)<MAP.waterY?MAP.waterY:-20,k=i*3;splashData[k]=x+Math.cos(a)*t*.16;splashData[k+1]=surface+Math.sin(t*Math.PI)*.12;splashData[k+2]=z+Math.sin(a)*t*.16}splashGeo.attributes.position.needsUpdate=true;}
   if(active&&!migrationFrozen&&weather===2&&flashes&&time>lightningAt){flash=.28;lightningAt=time+14+random()*12;weatherAudio.thunder(live)}
   if(active)flash=Math.max(0,flash-dt);flashLight.intensity=flashes?Math.max(0,flash)*8:0;
   const muted=document.getElementById('bMute').getAttribute('aria-pressed')==='true',volume=Number(document.getElementById('soundVolume').value)/100;
   weatherAudio.update(live&&weather===2,muted,volume);weapon.update(dt,{...S,presentation:pres,live});actors.update(dt,{live,pres});
   if(active)feedback.update(dt);else feedback.reset();
  },
  render(){refreshAO();water.beginFrame();puddleReflection?.render(rnd);composer.render()},unlockAudio(){weatherAudio.unlock()},
  surfaceQA:{setAO(value){ao.enabled=!!value},setFog(value){haze.setEnabled(value)},info(){return{aoEnabled:ao.enabled,aoSettings,aoMin:ao.minDistance,aoMax:ao.maxDistance,projection:ao.ssaoMaterial.uniforms.cameraProjectionMatrix.value.elements.slice(),cameraProjection:cam.projectionMatrix.elements.slice(),fog:haze.info(),gunFogged:(()=>{let n=0;gscene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.customProgramCacheKey?.().includes('analytic-height-haze'))n++});return n})(),weeds:foundationWeeds.info(),zones:[[-10,12],[-17,17],[-22,12],[-4,10]].map(([x,z])=>({x,z,...surfaceZones(x,z)}))}}},
  setStyle(i){style=i;applyWeather()},setWeather(i){weather=(i+3)%3;applyWeather()},cycleWeather(){weather=(weather+1)%3;applyWeather()},
  info(){return{version:'river-v4-wildbank',afterrain:{enabled:afterRain,look:afterRain?'afterrain':'previous',forest:forestFloor?.info()||null,puddles:puddleReflection?.info()||null,light:afterRain?AFTERRAIN_LIGHT:null},migration:migrationInfo(),textureErrors,weapon:weapon.info(),actors:actors.info(),village:village.info(),buffers:buffers.info(),ruins:ruins.info(),foliage:foliage.info(),bankDetail:bankDetail.info(),distant:distant.info(),water:water.info(),map:{houses:layout.houses.length,buffers:bufferPlacements.length,walls:bounds.length,crossings:layout.crossings,water:'continuous channel; two shallow submerged fords and one dry bridge',soil:[2,5,8,12].map(x=>({x,z:10,moisture:soilMoisture(x,10,rainStrength.value)}))},weather,lighting:{sunDirection:sunDirection.toArray(),latitudeDegrees:latitude*180/Math.PI,sky:weather===0?'kloofendal_43d_clear_puresky':'kloofendal_overcast_puresky',sunIntensity:sun.intensity,ambientIntensity:amb.intensity,exposure:rnd.toneMappingExposure,rainVisible:rain.visible,splashVisible:splashes.visible,rainRippleStrength:rainStrength.value,flashIntensity:flashLight.intensity},time,triangles:rnd.info.render.triangles,drawCalls:rnd.info.render.calls,source:'browser WebGL',audio:weatherAudio.info()}},
  actorQA:()=>actors.poseStats?.(),stormQA:{},houseQA:buffers.qa,dressingQA:{...dressing,reviewAsset(id){const v=dressing.reviewAsset(id);aoCutouts.length=0;world.traverse(o=>{if(o.isMesh&&[].concat(o.material).some(m=>m?.alphaTest>0))aoCutouts.push(o)});return v}}
 };
}
