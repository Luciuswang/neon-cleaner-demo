import {buildCoconutGrove} from './coconut-grove.js';
import {buildCoverCreepers} from './cover-creepers.js';
import {buildMobileTerrain} from './mobile-terrain.js';
import {buildMobileEcology} from './mobile-ecology.js';
import {buildWallMeadow} from './wall-meadow.js';
import {buildVillage} from './village.js';
import {buildPerimeter} from './perimeter-art.js';
import {buildRuins} from './ruins.js';
import {buildBufferHouses} from './buffer-house.js';
import {buildWeapon} from './weapon.js';
import {buildActors} from './actors.js';
import {buildCombatFeedback} from './combat-feedback.js';
import {MAP,layout,bounds,bufferPlacements,terrainHeight,roofHeight,wallTopAt} from './map-layout.js';
import {AFTERRAIN_LIGHT} from './afterrain-light.js';
import {buildDistantLandscape} from './distant-landscape.js';

const SKY_URL=new URL('./assets/mobile-look/sky.jpg',import.meta.url).href;
const BUDGET={draws:450,triangles:1400000};
const ROLES=['wood','plaster','stone','metal','brick','roof','mud','dirt','forest_ground_04','bark'];
const LIGHT_KEYS=['key','skyFill','groundFill','sun','ambient','exposure','sky'];

export async function buildWorld(ctx){
 const T=ctx.THREE, latitude=26*Math.PI/180, phi=(.36-.5)*Math.PI*2;
 const sunDirection=new T.Vector3(Math.cos(latitude)*Math.cos(phi),Math.sin(latitude),Math.cos(latitude)*Math.sin(phi));
 if(!T)throw new Error('mobile-world: ctx.THREE is required');
 const {scene,cam,rnd,gscene,gun,sun,amb,enemies,solids,colliders}=ctx;
 for(const k of LIGHT_KEYS)if(AFTERRAIN_LIGHT?.[k]===undefined)throw new Error('mobile-world: AFTERRAIN_LIGHT.'+k+' is missing; cannot match the PC daylight');
 if(!sunDirection?.isVector3)throw new Error('mobile-world: PC sunDirection (Vector3) is required');

 const iOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const lowMemory=iOS||(navigator.deviceMemory!==undefined&&navigator.deviceMemory<=4);
 const pause=()=>new Promise(resolve=>setTimeout(resolve,16));
 const stages=[];
 // Heavy builders run strictly one after another, with a frame of slack between
 // them so iOS can release decode/upload transients before the next peak.
 const stage=async(label,fn)=>{
  window.riverBootStage='移动河谷 / '+label;await pause();
  const started=performance.now();
  try{const result=await fn();stages.push({label,ms:Math.round(performance.now()-started)});return result}
  catch(error){window.riverBootStage='移动河谷 / '+label+' 失败';throw new Error('mobile-world: '+label+' failed: '+(error?.message??error),{cause:error})}
 };

 // Same scene takeover as PC.
 const keep=new Set([sun,amb,...enemies.map(e=>e.g)]);
 for(const child of scene.children)if(!keep.has(child))child.visible=false;
 // Remove old-map proxies before creating the new authoritative map.
 solids.length=colliders.length=0;
 for(const b of bounds){const box=new T.Box3(new T.Vector3(b.min.x,b.min.y,b.min.z),new T.Vector3(b.max.x,b.max.y,b.max.z));if(b.profileWall)box.topAt=(x,z,r)=>wallTopAt(b.profileWall,x,z,r);colliders.push(box)}
 const world=new T.Group();world.name='Riverfall village';scene.add(world);

 // Sky: offline LDR backdrop, plus a PMREM environment from a 256px downsample.
 const look=await stage('天空',async()=>{
  let sky;
  try{sky=await new T.TextureLoader().loadAsync(SKY_URL)}
  catch(error){throw new Error('sky backdrop did not load: '+SKY_URL,{cause:error})}
  sky.name='mobile-look/sky.jpg';sky.colorSpace=T.SRGBColorSpace;sky.mapping=T.EquirectangularReflectionMapping;
  sky.generateMipmaps=false;sky.minFilter=sky.magFilter=T.LinearFilter;sky.needsUpdate=true;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const g=canvas.getContext('2d');if(!g)throw new Error('2D canvas unavailable for the environment downsample');
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(sky.image,0,0,256,128);
  const small=new T.CanvasTexture(canvas);small.colorSpace=T.SRGBColorSpace;small.mapping=T.EquirectangularReflectionMapping;
  small.generateMipmaps=false;small.minFilter=small.magFilter=T.LinearFilter;
  const pmrem=new T.PMREMGenerator(rnd);
  const env=pmrem.fromEquirectangular(small);
  pmrem.dispose();small.dispose();canvas.width=canvas.height=0;
  env.texture.name='mobile-look/sky-pmrem-256';
  return{sky,env,size:[sky.image.width,sky.image.height]};
 });
 scene.background=look.sky;scene.environment=gscene.environment=look.env.texture;
 // Rotation is baked into sky.jpg; keep runtime rotation at identity so the
 // backdrop, the reflections and the PC sun direction stay aligned.
 scene.backgroundRotation?.set(0,0,0);scene.environmentRotation?.set(0,0,0);gscene.environmentRotation?.set(0,0,0);

 // Builders, sequenced.
 const terrain=await stage('地形',()=>buildMobileTerrain({T,rnd,world,solids}));
 const materials=terrain?.materials;
 if(!materials||typeof terrain.update!=='function')throw new Error('mobile-world: buildMobileTerrain must return {materials,update}');
 const missing=ROLES.filter(role=>!materials[role]?.isMaterial);
 if(missing.length)throw new Error('mobile-world: mobile terrain is missing material roles: '+missing.join(', '));
 buildDistantLandscape({T,world,materials,forested:true});
 const village=await stage('村落',()=>buildVillage({T,world,materials,layout,solids}));
 buildPerimeter(T,world,materials.stone,solids);
 const ruins=await stage('废墟',()=>buildRuins({T,world,materials,layout,solids}));
 const buffers=await stage('缓冲房屋',()=>buildBufferHouses({T,world,materials,solids,cam,getInteractionState:ctx.getInteractionState,placements:bufferPlacements}));
 const ecology=await stage('生态',()=>buildMobileEcology({T,world}));
 const wallMeadow=buildWallMeadow(T,world,true);
 buildCoconutGrove(T,world,true);world.add(buildCoverCreepers(T,world,layout));
 if(typeof ecology?.info!=='function')throw new Error('mobile-world: buildMobileEcology must return {info}');
 const weapon=await stage('武器',()=>buildWeapon({THREE:T,gun,gscene,cam,scene,sun,amb,solids}));
 const actors=await stage('角色',()=>buildActors({THREE:T,enemies}));
 const feedback=await stage('战斗反馈',()=>buildCombatFeedback({T,world}));

 // Map logic, identical to PC.
 const floorHeight=(x,z)=>buffers.floorHeight(x,z)??Math.max(terrainHeight(x,z),ruins.floorHeight(x,z));
 const ceilingY=(p,previousY)=>{const roof=roofHeight(p.x,p.z);return Math.min(previousY<roof?roof-.15:Infinity,buffers.ceilingY(p,previousY))};

 // Daylight: PC AFTERRAIN_LIGHT values, PC fog, PC exposure.
 const area=new T.Box3();for(const box of colliders)area.union(box);
 if(area.isEmpty())area.set(new T.Vector3(-60,-4,-60),new T.Vector3(60,30,60));
 const center=area.getCenter(new T.Vector3());center.y=0;
 const MAX_HALF=120;
 area.min.set(Math.max(area.min.x,center.x-MAX_HALF),Math.max(area.min.y,-10),Math.max(area.min.z,center.z-MAX_HALF));
 area.max.set(Math.min(area.max.x,center.x+MAX_HALF),Math.min(area.max.y,40),Math.min(area.max.z,center.z+MAX_HALF));
 const target=sun.target;target.position.copy(center);world.add(target);
 function applyDaylight(){
  sun.position.copy(sunDirection).multiplyScalar(75).add(target.position);
  sun.color.set(AFTERRAIN_LIGHT.key);sun.intensity=AFTERRAIN_LIGHT.sun;
  amb.color.set(AFTERRAIN_LIGHT.skyFill);amb.groundColor.set(AFTERRAIN_LIGHT.groundFill);amb.intensity=AFTERRAIN_LIGHT.ambient;
  scene.background=look.sky;scene.environment=gscene.environment=look.env.texture;
  scene.fog=new T.Fog(0x9db7ce,95,920);
  rnd.toneMappingExposure=AFTERRAIN_LIGHT.exposure;scene.backgroundIntensity=AFTERRAIN_LIGHT.sky;
  const weatherName=document.getElementById('weatherName');if(weatherName)weatherName.textContent='雨后 · 湿润河谷';
 }
 applyDaylight();

 // Same per-material daylight scaling PC applies in afterRain day.
 let pointLights=0;
 const visited=new Set();
 world.traverse(o=>{
  if(o.isPointLight){pointLights++;o.userData.weatherBase??=o.intensity;o.intensity=o.userData.weatherBase*.20}
  if(o.isMesh)for(const m of [].concat(o.material)){
   if(!m||visited.has(m))continue;visited.add(m);
   if(m.name==='WindowTrim')m.color.set(0x999d92);
   if(m.envMapIntensity!==undefined&&!m.name.startsWith('landscape-')){m.userData.baseEnvironment??=m.envMapIntensity;m.envMapIntensity=m.userData.baseEnvironment*.72}
   if(m.emissiveIntensity>0){m.userData.weatherBase??=m.emissiveIntensity;m.emissiveIntensity=m.userData.weatherBase*.15}
  }
 });

 // One bounded daylight shadow, rendered once and cached for the static world.
 // Actors must not cast into it: they would be frozen into the cached map.
 const shadowSize=lowMemory?768:1024;
 for(const e of enemies)e.g.traverse(o=>{if(o.isMesh)o.castShadow=false});
 rnd.shadowMap.enabled=true;rnd.shadowMap.autoUpdate=false;
 sun.castShadow=true;sun.shadow.mapSize.set(shadowSize,shadowSize);sun.shadow.autoUpdate=false;
 sun.shadow.bias=-.0004;sun.shadow.normalBias=.25;
 {
  const sc=sun.shadow.camera;
  sc.position.copy(sun.position);sc.lookAt(target.position);sc.updateMatrixWorld(true);
  const inverse=new T.Matrix4().copy(sc.matrixWorld).invert(),fit=new T.Box3(),v=new T.Vector3();
  for(let i=0;i<8;i++){v.set(i&1?area.max.x:area.min.x,i&2?area.max.y:area.min.y,i&4?area.max.z:area.min.z).applyMatrix4(inverse);fit.expandByPoint(v)}
  sc.left=fit.min.x;sc.right=fit.max.x;sc.bottom=fit.min.y;sc.top=fit.max.y;
  sc.near=Math.max(.1,-fit.max.z-5);sc.far=-fit.min.z+5;sc.updateProjectionMatrix();
 }
 const refreshShadow=()=>{sun.shadow.needsUpdate=true;rnd.shadowMap.needsUpdate=true};
 refreshShadow();

 // Optional actor contact shadows: one instanced draw for every enemy.
 const blobCanvas=document.createElement('canvas');blobCanvas.width=blobCanvas.height=64;
 const bg=blobCanvas.getContext('2d'),grad=bg.createRadialGradient(32,32,2,32,32,32);
 grad.addColorStop(0,'rgba(0,0,0,.55)');grad.addColorStop(1,'rgba(0,0,0,0)');bg.fillStyle=grad;bg.fillRect(0,0,64,64);
 const blobGeo=new T.PlaneGeometry(1.5,1.5);blobGeo.rotateX(-Math.PI/2);
 const blobCount=Math.max(1,enemies.length);
 const blobs=new T.InstancedMesh(blobGeo,new T.MeshBasicMaterial({map:new T.CanvasTexture(blobCanvas),transparent:true,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),blobCount);
 blobs.name='actor-contact-shadows';blobs.frustumCulled=false;blobs.renderOrder=2;world.add(blobs);
 const blobMatrix=new T.Matrix4(),hidden=new T.Matrix4().makeScale(0,0,0);
 function updateBlobs(){
  for(let i=0;i<blobCount;i++){
   const g=enemies[i]?.g;
   if(g?.visible){blobMatrix.makeTranslation(g.position.x,floorHeight(g.position.x,g.position.z)+.03,g.position.z);blobs.setMatrixAt(i,blobMatrix)}
   else blobs.setMatrixAt(i,hidden);
  }
  blobs.instanceMatrix.needsUpdate=true;
 }

 // Stats and reporting.
 let time=0,style=0,frozen=false,draws=0,triangles=0,warned=false;
 const namesIn=roots=>{const names=new Set();for(const root of roots)root?.traverse(o=>{if(o.name&&(o.isMesh||o===root||o.parent===root))names.add(o.name)});return[...names].slice(0,64)};
 function info(){
  return{
   mode:'mobile-lod',draws,triangles,budget:BUDGET,overBudget:{draws:draws>=BUDGET.draws,triangles:triangles>=BUDGET.triangles},
   memory:{geometries:rnd.info.memory.geometries,textures:rnd.info.memory.textures},
   actors:{info:actors.info?.()??null,names:namesIn(enemies.map(e=>e.g))},
   weapon:{info:weapon.info?.()??null,names:namesIn([gun])},
   ecology:ecology.info(),meadow:wallMeadow.info(),
   shadow:{size:shadowSize,cachedStatic:true,dynamicActorShadows:false,contactShadows:true},
   sky:{url:SKY_URL,size:look.size,envSource:256,runtimeRotation:0},
   light:{sun:sun.intensity,ambient:amb.intensity,exposure:rnd.toneMappingExposure,toneMapping:rnd.toneMapping,backgroundIntensity:scene.backgroundIntensity},
   pointLights,lowMemory,pixelRatio:rnd.getPixelRatio(),stages,time
  };
 }

 const api={
  mobile:true,info,refreshShadow,
  migrationQA:{freeze(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid migration time');frozen=true;time=seconds;terrain.update(seconds);return info()}},
  waterTime(){return time},
  shot(event){const projected=event.hit&&event.object?.userData.wall?village.projectStoneCoverHit?.({point:event.point,normal:event.normal,wallId:event.object.userData.wall}):null;
   if(projected)event={...event,point:projected.point,normal:projected.normal};weapon.shot(event);feedback.shot(event)},
  resetFeedback(){weapon.reset();feedback.reset()},
  polishInfo(){return{environment:ecology.info(),cover:village.info?.().stoneCover,combat:feedback.info(),weapon:weapon.info()}},
  floorHeight,ceilingY,blocksMovement:(p,actor)=>buffers.blocksMovement(p,actor),
  resetHouse(){buffers.reset();refreshShadow()},
  // Mobile ships the PC default daylight only; the cached shadow is baked for it.
  setStyle(i){style=i?1:0;applyDaylight();const styleName=document.getElementById('styleName');if(styleName)styleName.textContent='自然 · 山谷日照'},
  cycleWeather(){applyDaylight();return 0},
  update(dt,{S,pres,live,player}){
   const active=!pres&&!['pause','dead','win'].includes(S.state);if(active&&!frozen)time+=dt;
   terrain.update(time);wallMeadow.update(time);village.update?.(dt,time);buffers.update(dt,{S,pres,live,player});
   weapon.update(dt,{...S,presentation:pres,live});actors.update(dt,{live,pres});
   if(active)feedback.update(dt);else feedback.reset();
   updateBlobs();
  },
  // World pass only: no composer, no screen passes. The HTML draws the gun pass.
  render(){
   rnd.render(scene,cam);
   draws=rnd.info.render.calls;triangles=rnd.info.render.triangles;
   if(!warned&&(draws>=BUDGET.draws||triangles>=BUDGET.triangles)){warned=true;console.warn('mobile-world over budget',{draws,triangles,budget:BUDGET})}
  },
  unlockAudio(){}
 };
 window.riverMobileWorld=api;
 return api;
}
// Squads use the exact same implementation.
export {buildWorld as buildSquadsWorld,buildWorld as buildMobileWorld};
export default buildWorld;
