// One shared horizontal reflection for the village's actual flat y=0 ground.
// Not the lower river plane, not SSR, not a reflection applied to sloping hills.
import {vegetationPlan} from './vegetation.js';
export function buildPuddleReflection({T,Reflector,world,scene,terrain,water,cam,haze}){
 const layer=30,planeY=0,width=768,height=432;
 const carrier=new Reflector(new T.PlaneGeometry(1,1),{textureWidth:width,textureHeight:height,multisample:0,clipBias:.002});
 carrier.name='offscreen-flat-ground-reflection';carrier.rotation.x=-Math.PI/2;carrier.position.y=planeY;carrier.updateMatrixWorld(true);
 carrier.camera.layers.set(layer);
 const projection={value:new T.Matrix4()},enabled={value:0},texture={value:carrier.getRenderTarget().texture};
 const inverse=carrier.matrixWorld.clone().invert();let frames=0,eligible=0,lastDraws=0,lastTriangles=0;const candidates=[];
 // Reuse the existing four-view atlas of the actual CC0 tree models. A tiny
 // reflection does not justify resubmitting 15 million forest triangles.
 // These cards exist only on the reflection layer; the main-view trees do not change.
 const atlasSource=world.getObjectByName('distant-layered-forest--1');
 if(!atlasSource)throw Error('Existing tree reflection atlas missing');
 const ecology=vegetationPlan(),treeProxies=[];
 for(let species=0;species<2;species++)for(const band of ['near','far'])for(const p of ecology[band][species]){
  treeProxies.push({...p,species,height:(band==='near'?(species===0?11.6:10.4):(species===0?14:12.8))*p.s*p.stretch});
 }
 const treeGeometry=atlasSource.geometry.clone();
 treeGeometry.setAttribute('treeSpecies',new T.InstancedBufferAttribute(new Float32Array(treeProxies.map(p=>p.species)),1));
 treeGeometry.setAttribute('treeYaw',new T.InstancedBufferAttribute(new Float32Array(treeProxies.map(p=>p.r)),1));
 const treeMesh=new T.InstancedMesh(treeGeometry,atlasSource.material,treeProxies.length),dummy=new T.Object3D();treeMesh.name='puddle-canopy-atlas-proxies';treeMesh.layers.set(layer);
 treeProxies.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.height*1.18);dummy.updateMatrix();treeMesh.setMatrixAt(i,dummy.matrix);treeMesh.setColorAt(i,new T.Color().setScalar(.9+p.tone*.1))});
 treeMesh.computeBoundingSphere();treeMesh.boundingSphere.radius+=20;world.add(treeMesh);
 // Retain nearby buildings, props, canopy and animated actors. Sub-pixel low
 // grass/grit and river surfaces are deliberately omitted from this bounded RT.
 scene.traverse(o=>{
  if(o.isLight)o.layers.enable(layer);
  if(!o.isMesh||o===terrain||o===water.mesh||o.isReflector)return;
  let labels=o.name;for(let p=o.parent;p&&p!==scene;p=p.parent)labels+=' '+p.name;
  labels+=' '+[].concat(o.material||[]).map(m=>m.name).join(' ');
  if(/foundation-low|low-meadow|embedded-path|forest-floor|grass|bermuda|wild-leafy|wild-upright|understorey|combat-feedback|rain|splash|riverbank|riverbed|distant-canopy/i.test(labels))return;
  if(/foliage-(canopy|forest)/.test(labels))return;
  const triangles=(o.geometry.index?.count||o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
  candidates.push({name:o.name,triangles});
  // Render only world/enemy meshes, never the separate first-person scene.
  o.layers.enable(layer);eligible++;
 });
 return{uniforms:{uPuddleReflection:texture,uPuddleProjection:projection,uPuddleReflectionEnabled:enabled},
  render(renderer){
   if(cam.position.y<=.04){enabled.value=0;return}
   const old=scene.overrideMaterial,auto=renderer.shadowMap.autoUpdate,needs=renderer.shadowMap.needsUpdate;
   scene.overrideMaterial=null;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
   haze.setReflection(true,planeY);
   try{carrier.onBeforeRender(renderer,scene,cam);lastDraws=renderer.info.render.calls;lastTriangles=renderer.info.render.triangles;projection.value.copy(carrier.material.uniforms.textureMatrix.value).multiply(inverse);enabled.value=1;frames++}
   finally{haze.setReflection(false,planeY);scene.overrideMaterial=old;renderer.shadowMap.autoUpdate=auto;renderer.shadowMap.needsUpdate=needs}
  },
  info(){return{planeY,resolution:[width,height],samples:0,frames,eligibleMeshes:eligible,lastDraws,lastTriangles,maxPassesPerMainFrame:1,enabled:enabled.value===1,
   estimatedColorBytes:width*height*8,canopyProxies:treeProxies.length,proxyTriangles:treeProxies.length*2,largestBatches:[...candidates].sort((a,b)=>b.triangles-a.triangles).slice(0,8),scope:'sky, village geometry, actors; trees use existing four-view rendered atlas; excludes terrain/river/low grass; flat y=0 puddles only',limitation:'single-plane selective reflection with canopy impostors, not full-scene ray tracing'}}};
}
