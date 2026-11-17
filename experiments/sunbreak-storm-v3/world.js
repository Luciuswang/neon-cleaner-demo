import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {installStorm} from './storm.js';
import {buildTimberHouse} from './timber-house.js';
import * as PresentationThree from 'three';

// Other17 original proxies are unchanged. The user-approved MERCADO12 timber
// replacement alone changes local traversal/cover; see house-logic.js.
export async function buildWorld(ctx){
 const {scene,cam,rnd,gun,gscene,sun,amb,sky,ground,sea,solids,colliders,enemies}=ctx;
 const T=PresentationThree;
 const started=performance.now();let seed=57291;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const original=scene.children.slice();const eRoots=new Set(enemies.map(e=>e.g));
 for(const o of original)if(o!==sun&&o!==amb&&!eRoots.has(o))o.visible=false;
 for(const e of enemies)e.g.traverse(o=>{if(o.isMesh)o.visible=false});
 const world=new T.Group();world.name='Realistic render layer';scene.add(world);
 const materials={},textureErrors=[],textures=new T.TextureLoader();
 const standard=(color,roughness=.8,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const batch=new Map();const V=(x,y,z)=>new T.Vector3(x,y,z);
 function put(geo,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,parent=null){
  const matrix=new T.Matrix4().compose(V(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),V(1,1,1));
  if(parent){const mesh=new T.Mesh(geo,m);mesh.applyMatrix4(matrix);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  geo.applyMatrix4(matrix);if(!batch.has(m))batch.set(m,[]);batch.get(m).push(geo);return null;
 }
 function box(w,h,d,m,x,y,z,ry=0,parent=null){
  const edge=Math.min(w,h,d),geo=edge>.09&&!m.userData.continuousFacade?new RoundedBoxGeometry(w,h,d,1,Math.min(.028,edge*.12)):new T.BoxGeometry(w,h,d);
  const uv=geo.attributes.uv,p=geo.attributes.position,n=geo.attributes.normal;
  // Project in metres, including bevels, instead of stretching a whole texture
  // onto every strip or assuming the bevelled mesh has six four-vertex faces.
  for(let i=0;i<uv.count&&!m.userData.windowPane;i++){
   const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
   uv.setXY(i,(ax>ay&&ax>az?p.getZ(i)+z:p.getX(i)+x)/2,(ay>ax&&ay>az?p.getZ(i)+z:p.getY(i)+y)/2);
  }
  return put(geo,m,x,y,z,0,ry,0,parent);
 }
 function cylinder(r1,r2,h,m,x,y,z,rx=0,ry=0,rz=0,n=12,parent=null){return put(new T.CylinderGeometry(r1,r2,h,n),m,x,y,z,rx,ry,rz,parent)}
 function beam(a,b,r,m,parent=null){const d=b.clone().sub(a),geo=new T.CylinderGeometry(r,r,d.length(),8);geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),d.clone().normalize()));const p=a.clone().add(b).multiplyScalar(.5);return put(geo,m,p.x,p.y,p.z,0,0,0,parent)}
 function flush(){for(const [m,arr] of batch){if(!arr.length)continue;const parts=arr.map(g=>g.index?g.toNonIndexed():g),geo=mergeGeometries(parts,false);if(!geo)throw Error('Incompatible static geometry: '+m.name);const mesh=new T.Mesh(geo,m);mesh.castShadow=mesh.receiveShadow=true;world.add(mesh);parts.forEach(g=>g.dispose());arr.forEach(g=>g.dispose())}batch.clear()}
 function procedural(kind,size=512){
  const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d'),im=x.createImageData(size,size),heights=new Float32Array(size*size);
  function hash(ix,iy){let n=Math.imul(ix,374761393)+Math.imul(iy,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295}
  function noise(px,py,s){const ix=Math.floor(px/s),iy=Math.floor(py/s),fx=px/s-ix,fy=py/s-iy;const a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),a),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),a),b)}
  const colors={plaster:[153,147,126],concrete:[116,116,107],wood:[90,72,51],roof:[113,66,45],bark:[90,83,62],stone:[130,132,122],metal:[92,99,99]};const base=colors[kind]||colors.concrete;
  for(let y=0;y<size;y++)for(let xx=0;xx<size;xx++){
   const i=y*size+xx,n=noise(xx,y,64)*.35+noise(xx,y,16)*.25+hash(xx,y)*.4;
   let h=n;let joint=0;
   if(kind==='concrete'||kind==='stone')joint=(xx%128<2||y%128<2)?1:0;
   if(kind==='wood'||kind==='bark')h=.4*noise(xx*5,y*.14,20)+.4*noise(xx*3,y,4)+.2*n;
   h=joint?.1:h;heights[i]=h;
   for(let k=0;k<3;k++)im.data[i*4+k]=base[k]*(.7+h*.55);im.data[i*4+3]=255;
  }
  x.putImageData(im,0,0);const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  const nc=document.createElement('canvas');nc.width=nc.height=size;const nx=nc.getContext('2d'),ni=nx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let xx=0;xx<size;xx++){const i=y*size+xx,dx=heights[y*size+(xx+1)%size]-heights[y*size+(xx+size-1)%size],dy=heights[((y+1)%size)*size+xx]-heights[((y+size-1)%size)*size+xx];const n=V(-dx*1.6,-dy*1.6,1).normalize();ni.data.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i*4)}
  nx.putImageData(ni,0,0);const normalMap=new T.CanvasTexture(nc);for(const t of [map,normalMap]){t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,rnd.capabilities.getMaxAnisotropy())}
  return {map,normalMap};
 }
 for(const name of ['plaster','concrete','wood','roof','bark','stone','metal'])materials[name]=new T.MeshStandardMaterial({color:0xffffff,roughness:name==='metal'?.42:.88,metalness:name==='metal'?.72:0,...procedural(name),normalScale:new T.Vector2(.55,.55)});
 materials.cream=materials.plaster.clone();materials.cream.color.set(0xd6d0b9);
 materials.ochre=materials.plaster.clone();materials.ochre.color.set(0xc9b399);
 materials.white=standard(0xb9b9a7,.83);materials.dark=standard(0x222a2c,.6,.4);
 materials.rust=standard(0x4b3425,.9,.25);materials.paint=standard(0x435c59,.66,.15);
 materials.glass=new T.MeshPhysicalMaterial({color:0x233638,roughness:.15,metalness:.35,clearcoat:1,clearcoatRoughness:.1});
 materials.glass.userData.windowPane=true;
 materials.recess=standard(0x11191a,.98);materials.brick=standard(0x79594a,.9);
 materials.fabric=standard(0x887e63,.95);materials.dirt=standard(0x5b5947,1);
 materials.yellow=standard(0xc3a15a,.82);materials.leaf=standard(0x384a29,.83);materials.leaf.side=T.DoubleSide;
 const leafBack=standard(0x4f5a35,.9);leafBack.side=T.DoubleSide;

 // Upgrade to real, licensed PBR maps when present; no silent network lookups.
 let assetManifest=null;
 try{const r=await fetch('./assets-manifest.json',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);assetManifest=await r.json()}catch(e){textureErrors.push('asset manifest unavailable: '+e.message)}
 async function loadMap(url,color=false){try{const t=await textures.loadAsync(url);t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,rnd.capabilities.getMaxAnisotropy());if(color)t.colorSpace=T.SRGBColorSpace;return t}catch(e){textureErrors.push(url);return null}}
 // File conventions are resolved from the sanitized manifest during integration.
 async function applyPBR(name,files){if(!files)return;const m=materials[name];for(const [key,path] of Object.entries(files)){if(!['map','normalMap','roughnessMap','aoMap'].includes(key))continue;const t=await loadMap(path,key==='map');if(t)m[key]=t}m.color.set(0xffffff);m.needsUpdate=true;}
 const roleNames={ground_worn_concrete:'concrete',wall_worn_plaster:'plaster',roof_terracotta:'roof',wood_weathered:'wood',tree_bark:'bark'};
 const pbr={};let hdrPath=null;
 for(const asset of assetManifest?.assets||[]){
  if(asset.type==='hdri')hdrPath=asset.files.find(f=>f.role==='environment')?.path;
  const name=roleNames[asset.semantic_role];if(!name)continue;pbr[name]={};
  for(const f of asset.files){const key={base_color:'map',normal_opengl:'normalMap',roughness:'roughnessMap'}[f.role];if(key)pbr[name][key]=f.path}
 }
 await Promise.all(Object.entries(pbr).filter(([name])=>materials[name]).map(([name,files])=>applyPBR(name,files)));
 // Clones are refreshed after asynchronous source maps resolve.
 const wallPalette=[0xd9dbcc,0xa7bcb8,0xb4c3cd,0xd2c2ac,0xc7cbc0];
 const facadeMaterials=wallPalette.map((tint,i)=>{
  const m=materials.plaster.clone();m.color.set(tint);m.roughness=.96;m.normalScale.set(.38,.38);m.userData.continuousFacade=true;
  m.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFacadeWorld;')
    .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvFacadeWorld=(modelMatrix*vec4(position,1.)).xyz;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFacadeWorld;')
    .replace('#include <map_fragment>',`#include <map_fragment>
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(${new T.Color(tint).toArray().map(v=>v.toFixed(4)).join(',')}),.58);
     float foot=1.-smoothstep(.12,.86,vFacadeWorld.y);
     float streak=.5+.5*sin(vFacadeWorld.x*7.1+vFacadeWorld.z*11.3);
     diffuseColor.rgb*=1.-foot*(.17+streak*.10);`);
  };
  m.customProgramCacheKey=()=>`facade-${i}`;return m;
 });
 materials.cream=facadeMaterials[0];materials.ochre=facadeMaterials[3];
 const tileMat=new T.MeshStandardMaterial({color:0x9f6346,roughness:.91,normalMap:materials.roof.normalMap,normalScale:new T.Vector2(.18,.18),roughnessMap:materials.roof.roughnessMap});
 const environment=new T.Scene();environment.background=new T.Color(0xa9b8bf);
 const eg=new T.Mesh(new T.SphereGeometry(100,32,16),new T.ShaderMaterial({side:T.BackSide,uniforms:{},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;void main(){float h=normalize(p).y;vec3 c=mix(vec3(.30,.32,.30),vec3(.65,.77,.87),smoothstep(-.2,.5,h));float s=pow(max(0.,dot(normalize(p),normalize(vec3(-.5,.4,.3)))),180.);gl_FragColor=vec4(c+vec3(8.,6.6,4.5)*s,1.);}'}));environment.add(eg);
 const pmrem=new T.PMREMGenerator(rnd);let envMap=pmrem.fromScene(environment,.025).texture;
 let loadedHDR=false,hdrSky=null;
 if(hdrPath){try{const hdr=await new RGBELoader().loadAsync(hdrPath);hdr.mapping=T.EquirectangularReflectionMapping;envMap=pmrem.fromEquirectangular(hdr).texture;hdrSky=hdr;loadedHDR=true}catch(e){textureErrors.push('HDR environment load failed')}}
 scene.environment=envMap;gscene.environment=envMap;for(const m of Object.values(materials))m.envMapIntensity=.38;
 const weaponKeys=gscene.children.filter(o=>o.isDirectionalLight);
 const weaponHemi=gscene.children.find(o=>o.isHemisphereLight);
 if(weaponKeys[1]){weaponKeys[1].color.set(0xc6d4dc);weaponKeys[1].intensity=.65}
 if(weaponHemi){weaponHemi.color.set(0xd8e0e1);weaponHemi.groundColor.set(0x454b43);weaponHemi.intensity=.55}

 const groundMat=materials.concrete.clone();groundMat.color.set(0xb8b7ad);groundMat.roughness=.84;groundMat.normalScale.set(.9,.9);
 const floorGeo=new T.PlaneGeometry(140,140,1,1);floorGeo.attributes.uv.array.forEach((v,i,a)=>{a[i]=v*46.67});
 const floor=new T.Mesh(floorGeo,groundMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;world.add(floor);
 // Finite irregular basins: one shared field drives water reflection, damp
 // darkening and roughness. Outside these basins the pavement remains dry.
 const wetCanvas=document.createElement('canvas');wetCanvas.width=wetCanvas.height=1024;
 const wetCtx=wetCanvas.getContext('2d');wetCtx.fillStyle='#000';wetCtx.fillRect(0,0,1024,1024);
 const puddles=[[-3,7,2.4,1.2],[4,1,1.7,2.4],[-6,-6,2,1],[7,11,1.8,.65],[1,-16,2.3,1.3],[-12,13,1.4,1.1],[12,-4,2,1],[-9,-21,1.6,.8],[0,-2,.7,1.2]];
 for(const [x,z,rx,rz] of puddles){wetCtx.save();wetCtx.translate((x+70)/140*1024,(70-z)/140*1024);wetCtx.scale(rx/140*1024,rz/140*1024);const g=wetCtx.createRadialGradient(0,0,0,0,0,1.3);g.addColorStop(0,'#fff');g.addColorStop(.65,'#eee');g.addColorStop(.9,'#888');g.addColorStop(1,'#000');wetCtx.fillStyle=g;wetCtx.beginPath();for(let i=0;i<=36;i++){const a=i/36*Math.PI*2,r=1.02+random()*.27;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?wetCtx.lineTo(px,py):wetCtx.moveTo(px,py)}wetCtx.fill();wetCtx.restore()}
 const wetMap=new T.CanvasTexture(wetCanvas);wetMap.wrapS=wetMap.wrapT=T.ClampToEdgeWrapping;
 const wetStrength={value:1};
 groundMat.onBeforeCompile=shader=>{shader.uniforms.uWetMap={value:wetMap};shader.uniforms.uWetStrength=wetStrength;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vWetWorld;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWetWorld=(modelMatrix*vec4(position,1.)).xz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vWetWorld;uniform sampler2D uWetMap;uniform float uWetStrength;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nfloat wetField=texture2D(uWetMap,(vWetWorld+70.)/140.).r*uWetStrength;roughnessFactor=mix(roughnessFactor,.13,smoothstep(.2,.85,wetField));').replace('#include <color_fragment>','#include <color_fragment>\nfloat damp=texture2D(uWetMap,(vWetWorld+70.)/140.).r;diffuseColor.rgb*=mix(1.,.54,damp*uWetStrength);');
 };
 // Thin surface dressing does not create new cover or collision in combat lanes.
 const patchMat=groundMat.clone();patchMat.onBeforeCompile=()=>{};patchMat.color.set(0xa7a79c);patchMat.roughness=.98;patchMat.polygonOffset=true;patchMat.polygonOffsetFactor=-1;
 for(const [x,z,sx,sz] of [[-4,11,1.1,.5],[2,5,.7,1.1],[6,-8,.9,.6],[-11,-8,1.3,.8],[-2,-19,1.2,.7],[11,7,.55,.8]]){
  const shape=new T.Shape();for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=.76+random()*.24;const xx=Math.cos(a)*sx*r,zz=Math.sin(a)*sz*r;i?shape.lineTo(xx,zz):shape.moveTo(xx,zz)}shape.closePath();
  const geo=new T.ShapeGeometry(shape);const uv=geo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/4,uv.getY(i)/4);
  const repair=new T.Mesh(geo,patchMat);repair.rotation.x=-Math.PI/2;repair.position.set(x,.007,z);repair.receiveShadow=true;world.add(repair);
 }
 const iron=standard(0x3d4442,.72,.65);
 for(const [x,z] of [[-2,7],[9,-2],[-9,-5]]){
  cylinder(.44,.44,.015,iron,x,.014,z,0,0,0,40);
  for(let i=-3;i<=3;i++){const span=Math.sqrt(.36*.36-(i*.095)**2)*2;box(span,.009,.013,materials.dark,x,.027,z+i*.095)}
  for(const s of [-1,1])box(.07,.01,.13,materials.dark,x+s*.26,.028,z);
 }
 const stainCanvas=document.createElement('canvas');stainCanvas.width=stainCanvas.height=512;
 const stainCtx=stainCanvas.getContext('2d');stainCtx.clearRect(0,0,512,512);
 for(let i=0;i<75;i++){const x=random()*512,y=random()*512,r=4+random()*40,g=stainCtx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(27,31,27,.17)');g.addColorStop(1,'rgba(27,31,27,0)');stainCtx.fillStyle=g;stainCtx.fillRect(x-r,y-r,r*2,r*2)}
 const stainMap=new T.CanvasTexture(stainCanvas);stainMap.colorSpace=T.SRGBColorSpace;
 const stainMat=new T.MeshBasicMaterial({map:stainMap,transparent:true,opacity:.55,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
 for(const [x,z,a] of [[0,9,.2],[-9,3,-.4],[11,-10,.7],[-3,-18,.1]]){const stain=new T.Mesh(new T.PlaneGeometry(9,7),stainMat);stain.rotation.set(-Math.PI/2,0,a);stain.position.set(x,.008,z);world.add(stain)}
 for(const x of [-17,16])for(let z=-30;z<15;z+=2){box(.21,.09,1.92,materials.stone,x,.04,z);box(.34,.012,1.8,materials.dark,x+.3,.012,z);for(let k=0;k<14;k++)box(.26,.02,.035,materials.metal,x+.3,.027,z-.84+k*.12)}
 // Closed architecture stays aligned to the five original solid house bounds.
 function building(x,z,w,d,h,ry,id){
  const local=new T.Group();local.position.set(x,0,z);local.rotation.y=ry;world.add(local);
  const wall=facadeMaterials[id%facadeMaterials.length];
  // Recessed opaque core plus masonry strips creates actual 20 cm window depth.
  box(w-.42,h-.15,d-.42,materials.recess,0,h/2,0,0,local);
  box(w+.06,.56,d+.06,materials.stone,0,.28,0,0,local);
  box(w+.16,.18,d+.16,materials.white,0,h-.08,0,0,local);
  box(w+.25,.12,d+.25,materials.wood,0,h+.05,0,0,local);
  box(w+.52,.10,d+.52,materials.dark,0,h+.13,0,0,local);
  for(const side of [-1,1]){
   const gable=new T.BufferGeometry().setFromPoints([V(side*w/2,h-.01,-d/2),V(side*w/2,h+d*.13,0),V(side*w/2,h-.01,d/2)]);
   gable.setIndex(side===1?[0,1,2]:[0,2,1]);gable.setAttribute('uv',new T.Float32BufferAttribute([0,0,d/4,d*.13/2,d/2,0],2));gable.computeVertexNormals();put(gable,wall,0,0,0,0,0,0,local);
  }
  // Each facade has recesses, stone sills, shutters and fine glazing bars.
  function facade(width,depth,rot){const face=new T.Group();face.rotation.y=rot;local.add(face);
   const zf=depth/2,yy=h*.6,low=yy-.84,high=yy+.84;
   box(width,low,.18,wall,0,low/2,zf-.09,0,face);
   box(width,h-high,.18,wall,0,(h+high)/2,zf-.09,0,face);
   const opens=[-width*.29,width*.29],cuts=[-width/2,opens[0]-.74,opens[0]+.74,opens[1]-.74,opens[1]+.74,width/2];
   for(let k=0;k<6;k+=2)box(cuts[k+1]-cuts[k],1.68,.18,wall,(cuts[k]+cuts[k+1])/2,yy,zf-.09,0,face);
   for(const side of [-1,1]){const xx=side*width*.29,yy=h*.6;
    box(1.44,1.64,.04,materials.recess,xx,yy,zf-.18,0,face);
    box(1.12,1.32,.04,materials.glass,xx,yy,zf-.14,0,face);
    for(const s of [-1,1]){box(.075,1.62,.19,materials.white,xx+s*.66,yy,zf+.13,0,face);box(1.4,.085,.21,materials.white,xx,yy+s*.78,zf+.13,0,face)}
    box(.045,1.4,.08,materials.paint,xx,yy,zf+.14,0,face);box(1.17,.045,.08,materials.paint,xx,yy-.05,zf+.14,0,face);
    box(1.59,.13,.36,materials.stone,xx,yy-.87,zf+.14,0,face);
    for(const s of [-1,1]){const sh=new T.Group();sh.position.set(xx+s*.97,yy,zf+.12);sh.rotation.y=s*.10;face.add(sh);box(.43,1.52,.07,materials.paint,0,0,0,0,sh);for(let k=0;k<10;k++)box(.36,.04,.08,materials.wood,0,-.62+k*.135,.05,0,sh)}
    // A thin top ledge and dark inner border give honest shadow depth.
    box(1.7,.14,.39,materials.white,xx,yy+.92,zf+.10,0,face);
   }
   if(rot===0){box(1.4,2.45,.08,materials.recess,0,1.225,zf+.03,0,face);box(1.17,2.27,.08,materials.wood,0,1.135,zf+.08,0,face);
    for(let k=0;k<5;k++)box(.018,2.19,.012,materials.dark,-.45+k*.225,1.13,zf+.13,0,face);
    box(.07,.24,.08,materials.metal,.43,1.1,zf+.19,0,face);box(1.65,.16,.33,materials.stone,0,.08,zf+.11,0,face);
    box(1.68,.11,.82,materials.fabric,0,2.63,zf+.34,0,face);
    for(const s of [-1,1])beam(V(s*.72,2.28,zf+.12),V(s*.72,2.6,zf+.70),.025,materials.dark,face);
   }
  }
  facade(w,d,0);facade(w,d,Math.PI);facade(d,w,Math.PI/2);facade(d,w,-Math.PI/2);
  // Pitched roof, individual curved terracotta tile courses with ridge caps.
  const slope=.26,rise=d*.5*slope;
  for(const side of [-1,1]){const panel=new T.Mesh(new T.BoxGeometry(w+.64,.12,(d/2+.4)*Math.sqrt(1+slope*slope)),materials.roof);panel.position.set(0,h+rise/2+.15,side*d/4);panel.rotation.x=side*Math.atan(slope);panel.castShadow=panel.receiveShadow=true;local.add(panel);
   const count=Math.ceil((w+.4)/.32),rows=Math.ceil((d/2+.25)/.42);
   // Instanced tiles retain curved silhouettes at a bounded draw-call count.
   const tileGeo=new T.CylinderGeometry(.16,.16,.48,9,1,true,0,Math.PI);tileGeo.rotateX(Math.PI/2);
   const tiles=new T.InstancedMesh(tileGeo,tileMat,count*rows);let n=0;const dummy=new T.Object3D();
   for(let i=0;i<count;i++)for(let j=0;j<rows;j++){const zz=side*(j*.42+.05);dummy.position.set(-w/2+i*.32,h+rise-Math.abs(zz)*slope+.23,zz);dummy.rotation.set(side*Math.atan(slope),0,0);dummy.updateMatrix();tiles.setMatrixAt(n,dummy.matrix);tiles.setColorAt(n++,new T.Color().setHSL(.055+random()*.025,.17+random()*.16,.67+random()*.24))}
   tiles.castShadow=tiles.receiveShadow=true;local.add(tiles);
  }
  cylinder(.19,.19,w+.65,tileMat,0,h+rise+.24,0,0,0,Math.PI/2,12,local);
  for(const s of [-1,1]){cylinder(.065,.065,h+.15,materials.metal,s*(w/2-.16),h/2,d/2+.18,0,0,0,10,local);cylinder(.07,.07,w+.55,materials.metal,0,h+.1,s*(d/2+.18),0,0,Math.PI/2,10,local)}
  // Exterior plumbing, breaker housing, aerials, clothesline and patina details.
  box(.62,.86,.20,materials.metal,w*.40,1.35,d/2+.16,0,local);
  for(let i=0;i<7;i++)box(.42,.015,.025,materials.dark,w*.40,1.15+i*.06,d/2+.27,0,local);
  cylinder(.026,.026,2.2,materials.dark,w*.40,2.7,d/2+.12,0,0,0,8,local);
  const acX=-w*.38;
  box(.86,.58,.40,materials.white,acX,h*.55,d/2+.19,0,local);
  for(let i=0;i<10;i++)box(.71,.018,.02,materials.dark,acX,h*.55-.20+i*.044,d/2+.40,0,local);
  for(const s of [-1,1])beam(V(acX+s*.30,h*.55-.25,d/2+.10),V(acX+s*.30,h*.55-.34,d/2+.39),.024,materials.metal,local);
  beam(V(acX+.38,h*.55,d/2+.18),V(acX+.48,.3,d/2+.18),.018,materials.white,local);
  // Window-height signs and restrained flaking paint distinguish facades.
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128;
  const signCtx=signCanvas.getContext('2d');signCtx.fillStyle=['#314a4b','#4e5551','#3d4e5a','#615443','#4c5855'][id];signCtx.fillRect(0,0,512,128);
  signCtx.strokeStyle='#b7b4a0';signCtx.lineWidth=4;signCtx.strokeRect(9,9,494,110);signCtx.fillStyle='#d4d1bc';signCtx.textAlign='center';signCtx.font='600 37px sans-serif';signCtx.fillText(['PORT AUTHORITY','MERCADO  12','MARINA DEPOT','OFICINA  04','ALMACEN'][id],256,76);
  const signMap=new T.CanvasTexture(signCanvas);signMap.colorSpace=T.SRGBColorSpace;signMap.anisotropy=4;
  const signMat=new T.MeshStandardMaterial({map:signMap,roughness:.88});
  put(new T.BoxGeometry(2.15,.54,.065),signMat,0,h-.48,d/2+.08,0,0,0,local);
  box(.65,.85,.7,materials.brick,-w*.28,h+rise+.25,-d*.16,0,local);
  box(.78,.14,.82,materials.stone,-w*.28,h+rise+.72,-d*.16,0,local);
  cylinder(.018,.018,1.65,materials.metal,w*.23,h+rise+.8,-d*.14,0,0,0,6,local);
  for(let k=0;k<4;k++)beam(V(w*.23-.38,h+rise+1.4+k*.08,-d*.14+k*.13),V(w*.23+.38,h+rise+1.4+k*.08,-d*.14+k*.13),.01,materials.metal,local);
  // Small plaster-loss patches have irregular silhouettes, not uniform noise.
  for(let q=0;q<8;q++){const px=(random()-.5)*(w-.5),py=.3+random()*.45;for(let k=0;k<3;k++)box(.22+random()*.18,.08,.014,materials.brick,px+(k%2)*.1,py+k*.09,d/2+.047,0,local)}
  return local;
 }
 building(-13,-16,9,7,4.2,0,0);building(-21,4,7,11,4.6,Math.PI/2,2);building(20,6,8,10,4,0,3);building(-4,-27,11,6,3.6,0,4);
 // Rich distant silhouettes do not add obstacles inside the playable footprint.
 const distantSites=[[-29,-48,9,8,2,0],[-18,-52,10,9,3,0],[-5,-49,10,8,2,0],[8,-51,9,10,2,0],[21,-48,10,8,3,0],[33,-48,9,10,2,-.12],[-43,-28,8,10,2,Math.PI/2],[-44,-12,9,10,2,Math.PI/2],[43,-27,9,10,3,-Math.PI/2],[44,-11,9,9,2,-Math.PI/2]];
 distantSites.forEach(([x,z,w,d,floors,rotation],id)=>{
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;world.add(g);
  const h=floors*2.8,wall=facadeMaterials[id%5];
  box(w,h,d,wall,0,h/2,0,0,g);box(w+.15,.5,d+.15,materials.stone,0,.25,0,0,g);
  for(let row=0;row<floors;row++){
   const y=1.6+row*2.8;box(w+.16,.13,d+.16,materials.white,0,row*2.8+.6,0,0,g);
   for(const side of [-1,1])for(let col=0;col<3;col++){
    const wx=-w*.32+col*w*.32,zf=side*(d/2+.035);
    box(1.26,1.55,.11,materials.recess,wx,y,zf,0,g);
    box(1.05,1.35,.13,materials.glass,wx,y,zf+side*.04,0,g);
    for(const s of [-1,1]){box(.075,1.58,.19,materials.white,wx+s*.61,y,zf+side*.04,0,g);box(1.30,.08,.19,materials.white,wx,y+s*.76,zf+side*.04,0,g)}
    box(.045,1.4,.16,materials.paint,wx,y,zf+side*.12,0,g);box(1.46,.13,.36,materials.stone,wx,y-.83,zf+side*.08,0,g);
    if(row===1&&col===1){
     box(2.18,.12,.78,materials.stone,wx,y-.93,zf+side*.26,0,g);
     for(let k=0;k<8;k++)cylinder(.018,.018,.68,materials.dark,wx-.92+k*.265,y-.52,zf+side*.59,0,0,0,5,g);
     box(2.10,.045,.045,materials.dark,wx,y-.17,zf+side*.59,0,g);
    }
   }
   for(const side of [-1,1])for(let k=0;k<2;k++){
    const zz=-d*.25+k*d*.5;box(.10,1.55,1.18,materials.white,side*(w/2+.025),y,zz,0,g);box(.12,1.32,.96,materials.glass,side*(w/2+.09),y,zz,0,g);
   }
  }
  box(w+.30,.22,d+.30,materials.white,0,h,0,0,g);
  for(const side of [-1,1]){box(w+.25,.58,.16,wall,0,h+.32,side*d/2,0,g);box(.16,.58,d,wall,side*w/2,h+.32,0,0,g)}
  box(w*.34,.6,d*.4,wall,-w*.19,h+.32,-d*.18,0,g);
  cylinder(.42,.42,1.1,materials.dark,w*.28,h+.62,-d*.15,0,0,0,14,g);
  for(let k=0;k<2;k++){box(.8,.55,.33,materials.white,-w*.28+k*w*.55,2.8,d/2+.12,0,g);for(let l=0;l<6;l++)box(.62,.02,.02,materials.dark,-w*.28+k*w*.55,2.62+l*.065,d/2+.3,0,g)}
 });
 // Hazy coastal foothills establish a connected landscape beyond the town.
 for(let layer=0;layer<3;layer++){
  const hillGeo=new T.PlaneGeometry(450,100,150,40);hillGeo.rotateX(-Math.PI/2);
  const hp=hillGeo.attributes.position,colors=new Float32Array(hp.count*3);
  const nearColor=new T.Color([0x526b63,0x627a77,0x7b8e8d][layer]);
  for(let i=0;i<hp.count;i++){
   const x=hp.getX(i),z=hp.getZ(i),offset=layer*29;
   const ridge=10+7*Math.sin(x*.025+offset)+5*Math.sin(x*.053+1.2+offset)+2*Math.sin(x*.17+offset)+Math.sin(x*.41+z*.13)*.8;
   const envelope=Math.pow(Math.max(0,Math.sin((z+50)/100*Math.PI)),1.1);
   const yy=Math.max(-.4,ridge*envelope);hp.setY(i,yy);
   const shade=.72+.15*Math.sin(x*.15+z*.14)+.13*yy/25;
   nearColor.clone().multiplyScalar(shade).toArray(colors,i*3);
  }
  hillGeo.setAttribute('color',new T.BufferAttribute(colors,3));hillGeo.computeVertexNormals();
  const hillMat=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:1});
  const hills=new T.Mesh(hillGeo,hillMat);hills.position.set(layer*19,-2,-127-layer*52);hills.receiveShadow=true;world.add(hills);
 }
 // Promenade follows the original wall, with posts/rails at their original line.
 box(46,.5,3.4,materials.stone,0,.25,18.2);
 for(let i=-10;i<=10;i++)cylinder(.065,.075,1.05,materials.metal,i*2.2,.52,16);
 for(const y of [.6,1.02])cylinder(.055,.055,44,materials.metal,0,y,16,0,0,Math.PI/2);
 const seawater=new T.Mesh(new T.PlaneGeometry(900,900),new T.MeshPhysicalMaterial({color:0x43595b,roughness:.2,metalness:.05,normalMap:materials.concrete.normalMap,normalScale:new T.Vector2(.13,.13),clearcoat:1}));seawater.rotation.x=-Math.PI/2;seawater.position.y=-1.1;world.add(seawater);
 // Detailed cover crates occupy exactly the same boxes used by original gameplay.
 for(const [x,z,n,ry] of [[-6,2,2,.2],[5,-4,1,-.3],[8,8,2,.5],[-14,10,1,.8],[0,-12,2,0],[14,-6,1,.4]])for(let i=0;i<n;i++){
  const c=new T.Group();c.position.set(x,.65+i*1.32,z);c.rotation.y=ry+i*.2;world.add(c);
  box(1.5,1.3,1.5,materials.wood,0,0,0,0,c);
  for(const side of [-1,1]){for(let k=0;k<6;k++){box(1.48,.018,.018,materials.dark,0,-.55+k*.22,side*.752,0,c);box(.018,.018,1.48,materials.dark,side*.752,-.55+k*.22,0,0,c)}
   for(const a of [-.52,.52]){box(.1,1.3,1.53,materials.metal,a,0,0,0,c);box(1.53,.10,.08,materials.wood,0,side*.55,side*.77,0,c)}
   for(const xx of [-.52,.52])for(const yy of [-.52,.52])cylinder(.026,.026,.025,materials.dark,xx,yy,side*.78,Math.PI/2,0,0,8,c);
  }
 }

 // Botanical palms: tapered trunk rings, narrow paired leaflets, curved midribs.
 const windTrees=[];
 function palm(x,z,h){const group=new T.Group();group.position.set(x,0,z);world.add(group);
  const curve=new T.CatmullRomCurve3([0,.25,.5,.75,1].map(t=>V(Math.sin(t*1.6)*t*t*.8,t*h,Math.cos(t*2.2)*t*t*.4)));
  const trunk=new T.Mesh(new T.TubeGeometry(curve,18,.3,10,false),materials.bark);const pa=trunk.geometry.attributes.position,uv=trunk.geometry.attributes.uv;
  for(let i=0;i<pa.count;i++){const t=uv.getX(i),p=curve.getPoint(t),s=1-t*.55;pa.setXYZ(i,p.x+(pa.getX(i)-p.x)*s,pa.getY(i),p.z+(pa.getZ(i)-p.z)*s);uv.setXY(i,uv.getY(i)*.6,t*h/1.5)}trunk.geometry.computeVertexNormals();trunk.castShadow=trunk.receiveShadow=true;group.add(trunk);
  const crown=new T.Group();crown.position.copy(curve.getPoint(1));group.add(crown);windTrees.push({crown,phase:random()*6});
  const geos=[];
  for(let j=0;j<19;j++){
   const a=j/19*Math.PI*2+random()*.37,len=2.4+random()*1.7,arc=.35+random()*1.3,droop=.65+random()*1.4;
   const points=[];for(let k=0;k<9;k++){const t=k/8;points.push(V(Math.cos(a)*len*t,Math.sin(t*Math.PI)*arc-t*t*droop,Math.sin(a)*len*t))}
   const c=new T.CatmullRomCurve3(points);const rib=new T.TubeGeometry(c,14,.016,4);geos.push(rib);
   for(let k=1;k<28;k++)for(const s of [-1,1]){
    const t=(k+random()*.35)/29,p=c.getPoint(t),width=Math.sin(t*Math.PI)*.7*(.8+random()*.35),tang=c.getTangent(t),side=V(-Math.sin(a)*s,0,Math.cos(a)*s);
    const tip=p.clone().addScaledVector(side,width).addScaledVector(tang,.25);tip.y-=.18+width*.2;
    const mid=p.clone().lerp(tip,.5);mid.y+=.06;
    const vv=[p.clone().addScaledVector(tang,-.055),mid.clone().addScaledVector(tang,-.09),tip,mid.clone().addScaledVector(tang,.04),p.clone().addScaledVector(tang,.035)];
    const g=new T.BufferGeometry().setFromPoints(vv);g.setIndex([0,1,4,1,3,4,1,2,3]);g.setAttribute('uv',new T.Float32BufferAttribute([0,0,0,.5,.5,1,1,.5,1,0],2));g.computeVertexNormals();geos.push(g);
   }
  }
  const palmgeo=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g),false);const leaves=new T.Mesh(palmgeo,materials.leaf);leaves.castShadow=leaves.receiveShadow=true;crown.add(leaves);
  // Fallen dry fronds are attached to the crown, not arbitrary spikes.
  for(let k=0;k<5;k++){const a=k*1.26;beam(V(0,0,0),V(Math.cos(a)*.4,-1.2,Math.sin(a)*.4),.035,materials.wood,crown)}
 }
 for(const p of [[-9,9,5.2],[10,12,6],[-18,-6,5.6],[18,-3,5],[2,14,5.8],[-24,14,6.2]])palm(...p);
 for(const p of [[-34,-20,7],[-36,5,8],[34,-5,7],[35,-38,8],[-36,-36,6],[36,18,7]])palm(...p);
 // Ground vegetation and debris hug building bases, not combat lanes.
 const grassGeo=[];
 for(let i=0;i<850;i++){const edge=i%2?-17.35:16.5,z=-30+random()*44,x=edge+(random()-.5)*.32,h=.08+random()*.27,w=.018+random()*.025;
  const geo=new T.BufferGeometry().setFromPoints([V(x-w,.02,z),V(x+w,.02,z),V(x+.07,h,z+.03)]);geo.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,.5,1],2));geo.computeVertexNormals();grassGeo.push(geo)}
 const grass=new T.Mesh(mergeGeometries(grassGeo),leafBack);grass.castShadow=true;world.add(grass);
 // Overhead cables and lamps provide a plausible scale and detail hierarchy.
 const lampGlass=new T.MeshStandardMaterial({color:0xf1d2a2,emissive:0xffc479,emissiveIntensity:.7,roughness:.4});
 const practicals=[];
 for(const [x,z] of [[-17.3,-12.7],[15.8,-14.2],[-15.7,7.3],[16.2,10.8]]){
  cylinder(.07,.12,4.6,materials.dark,x,2.3,z);beam(V(x,4.5,z),V(x+.8,4.5,z),.06,materials.dark);box(.55,.08,.3,materials.dark,x+.8,4.46,z);box(.44,.035,.24,lampGlass,x+.8,4.4,z);
  const l=new T.PointLight(0xffc58a,7,9,2);l.position.set(x+.8,4.3,z);world.add(l);practicals.push(l);
 }
 for(const z of [-8,7]){const curve=new T.CatmullRomCurve3([V(-18,4.5,z),V(0,3.7,z),V(18,4.7,z)]);put(new T.TubeGeometry(curve,36,.016,5),materials.dark)}
 flush();

 // Flatten static render meshes by material. Leave wind crowns and instancing
 // independent; this keeps the detailed facades from costing thousands of calls.
 world.updateMatrixWorld(true);
 const dynamicCrowns=new Set(windTrees.map(t=>t.crown)),staticMeshes=[];
 world.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||o.material.transparent||o===floor||o===seawater)return;let p=o;while(p){if(dynamicCrowns.has(p))return;p=p.parent}staticMeshes.push(o)});
 for(const mesh of staticMeshes){const geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);if(!batch.has(mesh.material))batch.set(mesh.material,[]);batch.get(mesh.material).push(geo);mesh.removeFromParent()}
 flush();

 // Licensed tactical figures retain original animation pivots;
 // muzzle anchors and AI state; only old visible blocks are replaced.
 const cloth=standard(0x697269,.94),vest=standard(0x353d37,.88),pants=standard(0x3b4240,.95),boots=standard(0x202521,.87),skin=standard(0x9e8069,.82),helmet=standard(0x343e36,.67);
 function capsule(rx,ry,rz,m,x,y,z,parent){const mesh=new T.Mesh(new T.SphereGeometry(1,18,14),m);mesh.scale.set(rx,ry,rz);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
 function garment(rx,h,rz,m,x,y,z,parent){
  const points=[[-.5,.68],[-.46,.86],[-.28,1],[.15,.94],[.40,.83],[.5,.65]].map(([yy,r])=>new T.Vector2(r*rx,yy*h));
  const geo=new T.LatheGeometry(points,14);geo.scale(1,1,rz/rx);
  const mesh=new T.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 for(const e of enemies){
  garment(.29,.64,.18,cloth,0,1.23,0,e.g);garment(.245,.25,.165,pants,0,.85,0,e.g);
  box(.45,.47,.08,vest,0,1.25,.17,0,e.g);box(.42,.43,.07,vest,0,1.26,-.17,0,e.g);
  for(const s of [-1,1]){box(.085,.12,.35,vest,s*.18,1.52,0,0,e.g);box(.10,.08,.05,materials.yellow,s*.19,1.40,.218,0,e.g)}
  for(const x of [-.14,0,.14])box(.11,.16,.08,vest,x,1.17,.25,0,e.g);
  capsule(.075,.10,.075,skin,0,1.60,0,e.g);capsule(.125,.175,.125,skin,0,1.77,0,e.g);
  const shell=new T.Mesh(new T.SphereGeometry(.151,20,12,0,Math.PI*2,0,Math.PI*.63),helmet);shell.position.set(0,1.86,-.012);shell.castShadow=true;e.g.add(shell);
  box(.225,.045,.21,helmet,0,1.84,.052,0,e.g);
  box(.24,.065,.04,materials.dark,0,1.80,.128,0,e.g);
  for(const limb of [e.ll,e.rl]){garment(.115,.40,.125,pants,0,-.20,0,limb);garment(.10,.40,.11,pants,0,-.59,0,limb);capsule(.11,.085,.175,boots,0,-.79,.065,limb);box(.14,.16,.06,vest,0,-.40,.09,0,limb)}
  // Existing arm nodes are hidden meshes: new visual groups follow their rotations.
  for(const [node,s] of [[e.la,-1],[e.ra,1]]){const arm=new T.Group();e.g.add(arm);arm.position.set(s*.30,1.45,0);
   const upper=garment(.105,.31,.11,cloth,0,-.13,.06,arm);upper.rotation.x=-.28;
   const fore=garment(.082,.29,.09,cloth,-s*.055,-.29,.23,arm);fore.rotation.x=-.78;
   capsule(.065,.075,.085,boots,-s*.10,-.38,.35,arm);node.userData.renderArm=arm;
  }
  box(.09,.10,.65,materials.dark,0,0,.43,0,e.wg2);cylinder(.026,.026,.32,materials.metal,0,.01,.78,Math.PI/2,0,0,12,e.wg2);box(.08,.18,.13,materials.dark,0,-.12,.30,0,e.wg2);
 }
 let weapon=null;
 try{const {buildWeapon}=await import('./weapon.js');weapon=await buildWeapon({THREE:T,gun,gscene})}catch(e){textureErrors.push('Weapon upgrade unavailable: '+e.message)}
 let actors=null;
 try{const {buildActors}=await import('./actors.js');actors=await buildActors({THREE:T,enemies})}catch(e){textureErrors.push('Character upgrade unavailable: '+e.message)}

 // Atmospheric sky: independent procedural clouds and physically plausible sun.
 const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uSun:{value:V(-.5,.6,.25).normalize()},uCloud:{value:.35},uTime:{value:0},uSky:{value:new T.Color(0x7295a7)},uHorizon:{value:new T.Color(0xc9c6b3)}},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 varying vec3 vDirection;uniform vec3 uSun,uSky,uHorizon;uniform float uCloud,uTime;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+7.1;a*=.49;}return v;}
 void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 col=mix(uHorizon,uSky,pow(h,.42));vec2 uv=d.xz/(max(.12,d.y)+.14)*1.6+vec2(uTime*.003,0.);float f=fbm(uv);float c=smoothstep(.58-uCloud*.22,.80-uCloud*.18,f)*smoothstep(0.,.12,h);col=mix(col,mix(vec3(.43,.48,.50),vec3(.95,.94,.89),f),c*uCloud);float s=max(dot(d,uSun),0.);col+=vec3(1.,.72,.4)*pow(s,120.)*.34*(1.-uCloud*.7);col+=vec3(5.,4.3,3.1)*smoothstep(.99965,.99985,s)*(1.-uCloud);gl_FragColor=vec4(col,1.);}`});
 const atmosphere=new T.Mesh(new T.SphereGeometry(380,40,24),skyMaterial);world.add(atmosphere);
 sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-34;sun.shadow.camera.right=sun.shadow.camera.top=34;sun.shadow.camera.near=1;sun.shadow.camera.far=160;sun.shadow.normalBias=.025;sun.shadow.bias=-.00012;sun.shadow.radius=3;
 const target=new T.Object3D();target.position.set(0,0,-5);scene.add(target);sun.target=target;
 rnd.toneMappingExposure=.96;rnd.setPixelRatio(Math.min(devicePixelRatio,1.5));

 // Real planar reflected scene, not a painted reflection or screen screenshot.
 const reflection=new Reflector(new T.PlaneGeometry(140,140),{textureWidth:1024,textureHeight:576,color:0x9ca7a8,clipBias:.003});reflection.rotation.x=-Math.PI/2;reflection.position.y=.012;reflection.material.transparent=true;reflection.material.depthWrite=false;
 reflection.material.uniforms.wetness={value:.52};reflection.material.uniforms.rainTime={value:0};reflection.material.uniforms.uWetMap={value:wetMap};
 reflection.material.vertexShader=reflection.material.vertexShader.replace('void main()', 'varying vec3 groundPosition;\nvoid main()').replace('gl_Position =', 'groundPosition=(modelMatrix*vec4(position,1.)).xyz;\ngl_Position =');
 reflection.material.fragmentShader=reflection.material.fragmentShader.replace('void main()',`uniform float wetness;uniform float rainTime;uniform sampler2D uWetMap;varying vec3 groundPosition;
 float hash2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash2(i),hash2(i+vec2(1,0)),f.x),mix(hash2(i+vec2(0,1)),hash2(i+1.),f.x),f.y);}
 void main()`).replace('vec4 base = texture2DProj( tDiffuse, vUv );',`float basin=texture2D(uWetMap,(groundPosition.xz+70.)/140.).r;float edgeNoise=noise2(groundPosition.xz*4.3)*.18+noise2(groundPosition.xz*17.)*.08;float mask=smoothstep(.55,.83,basin-edgeNoise);if(mask<.01||wetness<.01)discard;vec4 uv=vUv;uv.xy+=vec2(sin(groundPosition.x*21.+rainTime*5.),cos(groundPosition.z*18.+rainTime*4.))*wetness*.00018*uv.w;vec4 base=texture2DProj(tDiffuse,uv);`).replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );','float fresnel=.10+.72*pow(1.-max(0.,normalize(cameraPosition-groundPosition).y),3.);gl_FragColor = vec4( mix(base.rgb*vec3(.72,.76,.75),color*.65,.08), mask*wetness*fresnel );');
 world.add(reflection);
 const reflectRender=reflection.onBeforeRender;reflection.onBeforeRender=function(renderer,sc,camera){if(sc.overrideMaterial)return;return reflectRender.call(this,renderer,sc,camera)};
 // Rain in a local field follows the camera; its own RNG never touches combat.
 const count=2800,rainData=new Float32Array(count*6),rainSeed=[];
 for(let i=0;i<count;i++)rainSeed.push([random()*54-27,random()*22,random()*54-27,.6+random()]);
 const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(rainData,3));
 const rainMaterial=new T.LineBasicMaterial({color:0xbac7cc,transparent:true,opacity:.20,depthWrite:false});const rain=new T.LineSegments(rainGeo,rainMaterial);rain.frustumCulled=false;world.add(rain);
 const weatherNames=['雨后放晴','阴天 · 漫射天光','降雨 · 湿表面'];
 let weather=2,style=0,time=0,frame=0,lightning=0,storm=null;const samples=[];let last=performance.now();
 function applyWeather(){
  const rainy=weather===2,overcast=weather===1||rainy;
  const pos=style?[-34,34,-18]:[-36,30,26];sun.position.set(...pos);sun.color.set(overcast?0xd2dce3:0xffe8c9);sun.intensity=rainy?.8:overcast?1.35:3.25;
  amb.color.set(overcast?0xb9c7ce:0xbacbda);amb.groundColor.set(0x62665a);amb.intensity=overcast?1.15:.55;
  scene.fog=new T.Fog(overcast?0x88999f:0xb3bdbb,overcast?45:65,overcast?145:230);
  skyMaterial.uniforms.uCloud.value=rainy?.95:overcast?.8:.32;
  atmosphere.visible=overcast||!hdrSky;scene.background=!overcast&&hdrSky?hdrSky:new T.Color(overcast?0x84969f:0x93abba);
  skyMaterial.uniforms.uSky.value.set(overcast?0x768b98:0x648697);skyMaterial.uniforms.uHorizon.value.set(overcast?0xa9b4b4:0xd3cbb4);skyMaterial.uniforms.uSun.value.copy(sun.position).normalize();
  reflection.material.uniforms.wetness.value=rainy?1:overcast?.85:.8;wetStrength.value=rainy?1:.9;rain.visible=rainy;groundMat.roughness=rainy?.65:.84;
  practicals.forEach(l=>l.intensity=overcast?15:4);lampGlass.emissiveIntensity=overcast?1.5:.65;
  if(weaponKeys[0]){weaponKeys[0].color.copy(sun.color);weaponKeys[0].intensity=overcast?1.35:3.1}
  rnd.toneMappingExposure=style?.92:.95;document.getElementById('weatherName').textContent=weatherNames[weather];
  storm?.setWeather(weather,style);
 }
 const composer=new EffectComposer(rnd);composer.addPass(new RenderPass(scene,cam));
 const ao=new SSAOPass(scene,cam,innerWidth,innerHeight);ao.kernelRadius=1.15;ao.minDistance=.001;ao.maxDistance=.12;ao.output=SSAOPass.OUTPUT.Default;composer.addPass(ao);
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float uTime;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,.90);float v=smoothstep(.85,.15,distance(vUv,vec2(.5)));c*=mix(.89,1.,v);gl_FragColor=vec4(c,1.);}'});composer.addPass(grade);composer.addPass(new OutputPass());
 const smaa=new SMAAPass(innerWidth*rnd.getPixelRatio(),innerHeight*rnd.getPixelRatio());composer.addPass(smaa);
 addEventListener('resize',()=>{composer.setSize(innerWidth,innerHeight);ao.setSize(innerWidth,innerHeight)});
 storm=await installStorm({T,scene,cam,rnd,gscene,world,materials,groundMat,floor,wetMap,wetCanvas,wetStrength,reflection,skyMaterial,atmosphere,hdrSky,sun,amb,weaponKeys,weaponHemi,practicals,lampGlass,facadeMaterials,windTrees,rain,rainMaterial,composer,grade,ao,textureErrors});
 const house=buildTimberHouse({T,world,materials,solids,colliders,cam,getInteractionState:ctx.getInteractionState});
 applyWeather();
 function update(dt,{S,pres,live,player}){
  const now=performance.now();if(frame++>120){samples.push(now-last);if(samples.length>3600)samples.shift()}last=now;
  if(!pres&&!['pause','dead','win'].includes(S.state)){time+=dt;for(const t of windTrees){t.crown.rotation.z=Math.sin(time*.8+t.phase)*(weather===2?.035:.012);t.crown.rotation.x=Math.cos(time*.6+t.phase)*.009}skyMaterial.uniforms.uTime.value=time;reflection.material.uniforms.rainTime.value=weather===2?time:0;}
  if(weather===2){for(let i=0;i<count;i++){const s=rainSeed[i],x=s[0]+cam.position.x+Math.sin(time*.2)*.2,z=s[2]+cam.position.z,y=(s[1]-time*(10+s[3]*5))%22;const yy=(y+22)%22,ry=house.underRoof(x,yy+.85,z)?-15:yy;rainData.set([x,ry,z,x+.09,ry+.5+s[3]*.3,z+.035],i*6)}rainGeo.attributes.position.needsUpdate=true}
  for(const e of enemies){if(e.la.userData.renderArm)e.la.userData.renderArm.rotation.x=e.la.rotation.x*.45;if(e.ra.userData.renderArm)e.ra.userData.renderArm.rotation.x=e.ra.rotation.x*.45}
  if(weapon?.update)weapon.update(dt,{...S,presentation:pres,live});
  actors?.update(dt,{live,pres});
  const worldSun=cam.quaternion.clone().invert();weaponKeys[0]?.position.copy(sun.position).sub(target.position).applyQuaternion(worldSun);
  storm.update(dt,{live,pres,paused:S.state==='pause'||S.state==='dead'||S.state==='win',weather,style});
  house.update(dt,{S,pres,live,player});
 }
 function info(){const a=samples.slice().sort((a,b)=>a-b),pct=p=>a[Math.min(a.length-1,Math.floor(a.length*p))]||0;return{version:'storm-v3-timber',weather:weatherNames[weather],weatherIndex:weather,style,source:'browser WebGL realtime — not Unreal Engine',renderFrames:frame,p50_ms:pct(.5),p95_ms:pct(.95),p99_ms:pct(.99),max_ms:a.at(-1)||0,samples:a.length,triangles:rnd.info.render.triangles,textureErrors,materialBindings:Object.keys(pbr),loadedHDR,weapon:weapon?.info?.()||{loaded:false},actors:actors?.info?.()||{loaded:false},storm:storm.info(),house:house.info(),elapsed:performance.now()-started,features:['2K scanned PBR asphalt','storm HDR image based lighting','realtime shadow maps','SSAO','masked planar water reflection and rain rings','photographic storm sky and moving cloud layer','reference-led enterable timber house and hinged door','warm real and parallax interiors','lightning with reduced-flash control','wind vegetation','optional bloom and film grade']}}
 return {update,render(){composer.render()},floorHeight:house.floorHeight,ceilingY:house.ceilingY,blocksMovement:house.blocksMovement,resetHouse:house.reset,houseQA:house.qa,actorQA:()=>actors?.poseStats?.(),stormQA:storm.qa,unlockAudio(){storm.unlockAudio()},setStyle(i){style=i;applyWeather()},setWeather(i){weather=((i%3)+3)%3;applyWeather()},cycleWeather(){weather=(weather+1)%3;applyWeather()},info};
}
