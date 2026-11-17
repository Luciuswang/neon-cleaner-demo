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
import {buildActors} from './actors.js';
import {createStormAudio} from './storm-audio.js';
import {buildVillage} from './village.js';
import {buildVegetation} from './vegetation.js';
import {installTerrainRaycast} from './terrain-ray.js';
import {MAP,TERRAIN_GRID,layout,bounds,terrainHeight,groundHeight,landscapeHeight,roofHeight,riverWidth} from './map-layout.js';

export async function buildWorld(ctx){
 const {scene,cam,rnd,gscene,gun,sun,amb,enemies,solids,colliders}=ctx;
 const keep=new Set([sun,amb,...enemies.map(e=>e.g)]);
 for(const child of scene.children)if(!keep.has(child))child.visible=false;
 // Remove old-map proxies before creating the new authoritative map.
 solids.length=colliders.length=0;
 for(const b of bounds)colliders.push(new T.Box3(new T.Vector3(b.min.x,b.min.y,b.min.z),new T.Vector3(b.max.x,b.max.y,b.max.z)));
 const world=new T.Group();world.name='Riverfall village';scene.add(world);
 const textureErrors=[],loader=new T.TextureLoader(),materials={};
 let seed=519214,time=0,weather=2,style=0,post=true,flashes=true,flash=0,lightningAt=9;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const weatherAudio=createStormAudio(),windTime={value:0};
 async function map(path,color){const t=await loader.loadAsync(path);t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=Math.min(8,rnd.capabilities.getMaxAnisotropy());return t}
 const [shared,local]=await Promise.all(['./assets-manifest.json','./river/asset-sources.json'].map(p=>fetch(p).then(r=>{if(!r.ok)throw Error(p);return r.json()})));
 async function surface(name,files,tint=0xffffff,roughness=.85){
  const m=new T.MeshStandardMaterial({color:tint,roughness,metalness:0});
  await Promise.all(files.map(async f=>{const role=f.role,key={base_color:'map',normal_opengl:'normalMap',roughness:'roughnessMap',color:'map',normal:'normalMap'}[role];if(key)m[key]=await map(f.path,key==='map')}));
  m.normalScale.set(.65,.65);m.envMapIntensity=.7;m.name=name;materials[name]=m;return m;
 }
 const roles={wall_worn_plaster:'plaster',wood_weathered:'wood',roof_terracotta:'roof',tree_bark:'bark'};
 await Promise.all([...shared.assets.filter(a=>roles[a.semantic_role]).map(a=>surface(roles[a.semantic_role],a.files)),
  ...local.assets.filter(a=>a.kind==='surface').map(a=>surface(({brown_mud_02:'mud',rocky_gravel:'stone',brick_moss_001:'brick'})[a.id],a.files))]);
 materials.metal=new T.MeshStandardMaterial({color:0x4e5149,roughness:.65,metalness:.6});
 materials.roof.color.set(0x5f5445);materials.wood.color.set(0x9b9280);materials.plaster.color.set(0xdbceb0);
 const hdr=await new RGBELoader().loadAsync('./assets/kloofendal_overcast_puresky/kloofendal_overcast_puresky_2k.hdr');hdr.mapping=T.EquirectangularReflectionMapping;
 const pmrem=new T.PMREMGenerator(rnd),env=pmrem.fromEquirectangular(hdr);scene.environment=gscene.environment=env.texture;pmrem.dispose();
 scene.background=hdr;scene.backgroundIntensity=.55;scene.backgroundBlurriness=.07;
 sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=sun.shadow.camera.bottom=-44;sun.shadow.camera.right=sun.shadow.camera.top=44;
 sun.shadow.camera.near=1;sun.shadow.camera.far=180;sun.shadow.bias=-.00012;sun.shadow.normalBias=.035;sun.shadow.radius=3;
 const target=new T.Object3D();target.position.set(0,0,-4);scene.add(target);sun.target=target;
 rnd.setPixelRatio(Math.min(devicePixelRatio,1.5));rnd.toneMappingExposure=1.08;

 const mud=materials.mud.clone();mud.roughness=.74;mud.normalScale.set(.42,.42);mud.envMapIntensity=.28;mud.color.set(0xb8a184);
 mud.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGroundWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nvGroundWorld=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGroundWorld;');
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   float mudVariation=.5+.5*sin(vGroundWorld.x*.57+sin(vGroundWorld.z*.41)*2.);
   diffuseColor.rgb*=mix(vec3(.53,.55,.49),vec3(.91,.88,.8),mudVariation);
   float tracks=pow(.5+.5*sin(vGroundWorld.x*2.1+sin(vGroundWorld.z*.12)),12.);
   diffuseColor.rgb*=1.-tracks*.12;`);
 };mud.customProgramCacheKey=()=> 'river-mud-v1';
 const geo=new T.PlaneGeometry(TERRAIN_GRID.size,TERRAIN_GRID.size,TERRAIN_GRID.segments,TERRAIN_GRID.segments);geo.rotateX(-Math.PI/2);
 const p=geo.attributes.position,uv=geo.attributes.uv;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i),ax=Math.abs(x),az=Math.abs(z+4);
  let y=landscapeHeight(x,z);
  p.setY(i,y);uv.setXY(i,x/3,z/3);
 }geo.computeVertexNormals();
 const terrain=new T.Mesh(geo,mud);terrain.receiveShadow=true;installTerrainRaycast(T,terrain,TERRAIN_GRID.size,TERRAIN_GRID.segments);world.add(terrain);solids.push(terrain);
 // A separate measured riverbed follows the same height contract, with gravel.
 const bedGeo=new T.PlaneGeometry(18,160,72,320);bedGeo.rotateX(-Math.PI/2);
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
 const foliage=await buildVegetation(T,world);

 // Varied riverbank stones: small enough to be visual ground dressing only.
 const rockGeo=new T.IcosahedronGeometry(1,2),rp=rockGeo.attributes.position;
 for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),f=.88+.13*Math.sin(x*11+y*7+z*9);rp.setXYZ(i,x*f,y*f,z*f)}rockGeo.computeVertexNormals();
 const rocks=new T.InstancedMesh(rockGeo,materials.stone.clone(),850),dummy=new T.Object3D();
 rocks.material.color.set(0x92978b);rocks.material.roughness=.64;rocks.castShadow=rocks.receiveShadow=true;
 for(let i=0;i<850;i++){
  const z=random()*140-70,side=i%2?1:-1,x=side*(riverWidth(z)-.6+random()*2.8),r=.08+random()*.24;
  dummy.position.set(x,groundHeight(x,z)+r*.17,z);dummy.scale.set(r*(.9+random()),r*.52,r*(.75+random()));dummy.rotation.set(random(),random()*6.28,random());dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
 }rocks.computeBoundingSphere();world.add(rocks);

 const river=new Reflector(new T.PlaneGeometry(14,160),{textureWidth:768,textureHeight:432,color:0x76928a,clipBias:.004});
 river.name='flowing shallow river';river.rotation.x=-Math.PI/2;river.position.y=MAP.waterY;river.material.transparent=true;river.material.depthWrite=false;
 river.material.uniforms.uTime=windTime;
 river.material.vertexShader=river.material.vertexShader.replace('void main()','varying vec3 vRiver;\nvoid main()').replace('gl_Position =','vRiver=(modelMatrix*vec4(position,1.)).xyz;\ngl_Position =');
 river.material.fragmentShader=river.material.fragmentShader.replace('void main()',`uniform float uTime;varying vec3 vRiver;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float rings(vec2 p,float sc){vec2 q=p*sc,id=floor(q),f=fract(q)-.5;float t=fract(uTime*(.7+hash(id)*.8)+hash(id+1.));float d=length(f);return sin((d-t*.65)*70.)*exp(-abs(d-t*.65)*35.)*(1.-t)*smoothstep(.03,.12,t);}
  void main()`)
 .replace('vec4 base = texture2DProj( tDiffuse, vUv );',`float w=3.4+.8*cos(vRiver.z*.17)+.35*sin(vRiver.z*.47);float ax=abs(vRiver.x);
  float meander=.32*sin(ax*.9)+.14*sin(ax*2.8);float ford=min(abs(vRiver.z+23.-meander),abs(vRiver.z-15.-meander));
  float ft=clamp((ford-1.2)/1.8,0.,1.),bt=clamp((ax-w+1.1)/2.9,0.,1.);
  float bedHeight=-.58*(1.-bt*bt*(3.-2.*bt))*ft*ft*(3.-2.*ft);float depth=-.18-bedHeight;
  float edge=smoothstep(0.,.10,depth);if(edge<.01)discard;
  vec4 flowUv=vUv;float ring=rings(vRiver.xz,1.6)+rings(vRiver.xz+19.,3.3)*.5;
  vec2 wave=vec2(sin(vRiver.x*4.+vRiver.z*2.-uTime*2.6),cos(vRiver.z*6.-uTime*3.2+vRiver.x))*0.00045;
  flowUv.xy+=(wave+vec2(ring*.00035))*flowUv.w;
  vec4 base=texture2DProj(tDiffuse,flowUv);`)
 .replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',`float fresnel=.18+.68*pow(1.-max(0.,normalize(cameraPosition-vRiver).y),3.);
  float glint=pow(max(0.,sin(vRiver.z*21.-uTime*4.+sin(vRiver.x*8.))),28.)*.045;
  gl_FragColor=vec4(mix(vec3(.10,.17,.13),base.rgb,.82)+glint+max(0.,ring)*.065,edge*fresnel);`);
 const reflect=river.onBeforeRender;let reflectedFrame=-1,renderFrame=0;
 river.onBeforeRender=function(renderer,sc,camera){if(sc.overrideMaterial||reflectedFrame===renderFrame)return;reflectedFrame=renderFrame;return reflect.call(this,renderer,sc,camera)};world.add(river);

 const puddleMaterial=new T.MeshPhysicalMaterial({color:0x303b2c,roughness:.19,metalness:0,transparent:true,opacity:.32,clearcoat:1,clearcoatRoughness:.1,envMapIntensity:.75,depthWrite:false});
 const puddleGeometry=new T.CircleGeometry(1,36),puddles=[];
 const pp=puddleGeometry.attributes.position;for(let i=1;i<pp.count;i++){const a=Math.atan2(pp.getY(i),pp.getX(i)),r=.85+.1*Math.sin(a*5)+.05*Math.sin(a*9+.7);pp.setXY(i,pp.getX(i)*r,pp.getY(i)*r)}puddleGeometry.computeVertexNormals();
 for(const side of [-1,1])for(const z of [-28,-17,-9,3,11,22]){
  const pond=new T.Mesh(puddleGeometry,puddleMaterial);pond.rotation.x=-Math.PI/2;pond.position.set(side*(10+random()*2),.019,z);pond.scale.set(1.1+random(),.42+random()*.6,1);world.add(pond);puddles.push(pond);
 }
 puddleMaterial.onBeforeCompile=s=>{s.uniforms.uTime=windTime;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 wetPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nwetPos=(modelMatrix*vec4(position,1.)).xyz;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform float uTime;varying vec3 wetPos;').replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
  vec2 q=wetPos.xz*2.3,id=floor(q),f=fract(q)-.5;float t=fract(uTime*1.3+fract(sin(dot(id,vec2(12.1,78.2)))*4375.));
  float wave=sin((length(f)-t*.65)*60.)*exp(-abs(length(f)-t*.65)*26.)*(1.-t);
  normal=normalize(normal+vec3(f.x*wave*.14,f.y*wave*.14,0.));`)};

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
 const [weapon,actors]=await Promise.all([buildWeapon({THREE:T,gun,gscene}),buildActors({THREE:T,enemies})]);
 const composer=new EffectComposer(rnd);composer.addPass(new RenderPass(scene,cam));
 const ao=new SSAOPass(scene,cam,innerWidth,innerHeight);ao.kernelRadius=.7;ao.minDistance=.002;ao.maxDistance=.10;composer.addPass(ao);
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.03);c*=mix(.95,1.,smoothstep(.8,.1,distance(vUv,vec2(.5))));gl_FragColor=vec4(c,1.);}'});composer.addPass(grade);composer.addPass(new OutputPass());composer.addPass(new SMAAPass(innerWidth*rnd.getPixelRatio(),innerHeight*rnd.getPixelRatio()));
 addEventListener('resize',()=>composer.setSize(innerWidth,innerHeight));
 function applyWeather(){
  const wet=weather===2;
  sun.position.set(-30,36,28);sun.color.set(style?0xffd6a0:0xe3eee5);sun.intensity=wet?1.6:weather===1?2.0:3.1;
  amb.color.set(style?0xc5d7d1:0xd8e5e5);amb.groundColor.set(0x566344);amb.intensity=wet?1.25:1.1;
  scene.fog=new T.Fog(wet?0x8c9f9b:0xa8b5a4,55,150);scene.backgroundIntensity=wet?.52:.85;
  rnd.toneMappingExposure=style?1.12:1.05;rain.visible=splashes.visible=wet;mud.roughness=wet?.70:.85;
  document.getElementById('weatherName').textContent=['雨后 · 湿润河谷','阴天 · 山林薄雾','降雨 · 双岸村落'][weather];
  document.getElementById('styleName').textContent=style?'暖调 · 雨后天光':'冷调 · 雨林河谷';
  gscene.children.filter(o=>o.isDirectionalLight).forEach((l,i)=>{l.intensity=i?.8:2.0;l.color.set(i?0xb9d5ce:0xe5e9d6)});
 }
 document.getElementById('bPost').onclick=e=>{post=!post;ao.enabled=grade.enabled=post;e.currentTarget.textContent='后期：'+(post?'开':'关');e.currentTarget.setAttribute('aria-pressed',String(post))};
 document.getElementById('bFlash').onclick=e=>{flashes=!flashes;flash=0;flashLight.intensity=0;e.currentTarget.textContent='闪电：'+(flashes?'开启':'关闭');e.currentTarget.setAttribute('aria-pressed',String(flashes))};
 applyWeather();
 return{
  floorHeight:terrainHeight,ceilingY(p,previousY){const roof=roofHeight(p.x,p.z);return previousY<roof?roof-.15:Infinity},blocksMovement(){return false},resetHouse(){},
  update(dt,{S,pres,live}){
   const active=!pres&&!['pause','dead','win'].includes(S.state);if(active)time+=dt;
   windTime.value=time;foliage.update(time);village.update?.(dt,time);
   for(let i=0;i<rainCount;i++){
    const s=rainSeeds[i],x=s[0]+cam.position.x,z=s[2]+cam.position.z,yy=((s[1]-time*(14+s[3]*7))%21+21)%21;
    const floor=terrainHeight(x,z),roof=roofHeight(x,z),y=yy<roof&&Number.isFinite(roof)?-20:floor+yy,k=i*6;
    rainPositions[k]=x;rainPositions[k+1]=y;rainPositions[k+2]=z;rainPositions[k+3]=x+.08;rainPositions[k+4]=y+.5+s[3]*.35;rainPositions[k+5]=z+.03;
   }rainGeo.attributes.position.needsUpdate=true;
   for(let i=0;i<splashCount;i++){const [x,z,phase,a]=splashSeeds[i],t=(time*1.7+phase)%1,surface=terrainHeight(x,z)<MAP.waterY?MAP.waterY:-20,k=i*3;splashData[k]=x+Math.cos(a)*t*.16;splashData[k+1]=surface+Math.sin(t*Math.PI)*.12;splashData[k+2]=z+Math.sin(a)*t*.16}splashGeo.attributes.position.needsUpdate=true;
   if(active&&weather===2&&flashes&&time>lightningAt){flash=.28;lightningAt=time+14+random()*12;weatherAudio.thunder(live)}
   if(active)flash=Math.max(0,flash-dt);flashLight.intensity=flashes?Math.max(0,flash)*8:0;
   const muted=document.getElementById('bMute').getAttribute('aria-pressed')==='true',volume=Number(document.getElementById('soundVolume').value)/100;
   weatherAudio.update(live&&weather===2,muted,volume);weapon.update(dt,{...S,presentation:pres,live});actors.update(dt,{live,pres});
  },
  render(){renderFrame++;composer.render()},unlockAudio(){weatherAudio.unlock()},
  setStyle(i){style=i;applyWeather()},setWeather(i){weather=(i+3)%3;applyWeather()},cycleWeather(){weather=(weather+1)%3;applyWeather()},
  info(){return{version:'river-v4',textureErrors,weapon:weapon.info(),actors:actors.info(),village:village.info(),foliage:foliage.info(),map:{houses:layout.houses.length,walls:bounds.length,crossings:layout.crossings,water:'freely wadeable; three raised crossings'},weather,time,triangles:rnd.info.render.triangles,drawCalls:rnd.info.render.calls,source:'browser WebGL',audio:weatherAudio.info()}},
  actorQA:()=>actors.poseStats?.(),stormQA:{},houseQA:{}
 };
}
