import {MAP,landscapeHeight,groundHeight,riverWidth,blocked,inBuffer,houses,crossings,spawns,teamSpawns} from './map-layout.js';
import {trafficDistance} from './ground-surface.js';

export const ENVIRONMENT_POLISH_REVISION='clustered-meadow-mineral-and-distant-canopy-v1';
export function polishEnvironmentPlan(){
 let seed=819731;const R=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const grass=[],grit=[],forest=[],patches=[];
 const clear=(x,z,r)=>Math.abs(x)>riverWidth(z)+2.1+r&&!blocked(x,z,r+.22)&&!inBuffer(x,z,.8+r)&&
  trafficDistance(x,z)>1.65+r&&houses.every(h=>Math.abs(x-h.x)>3.85+r||Math.abs(z-h.z)>3.85+r)&&
  [...spawns,...teamSpawns].every(p=>Math.hypot(x-p[0],z-p[2])>2.2+r);
 for(let k=0;k<550;k++){
  const x=-31+R()*62,z=-33+R()*58,rx=.65+R()*1.9,rz=.50+R()*1.3;
  if(!clear(x,z,.3)||patches.some(p=>Math.hypot(x-p.x,z-p.z)<1.1))continue;
  const patch={x,z,rx,rz,angle:R()*Math.PI*2,phase:R()*Math.PI*2};patches.push(patch);
  for(let i=0;i<70;i++){
   const a=R()*Math.PI*2,r=Math.sqrt(R()),u=Math.cos(a)*rx*r*(1+.22*Math.sin(a*3+patch.phase)),v=Math.sin(a)*rz*r;
   const px=x+u*Math.cos(patch.angle)-v*Math.sin(patch.angle),pz=z+u*Math.sin(patch.angle)+v*Math.cos(patch.angle);
   const height=.17+R()*.16,radius=height*1.33+.02;
   if(!clear(px,pz,radius)||grass.some(p=>Math.hypot(p.x-px,p.z-pz)<.17)||grass.length>=3600)continue;
   grass.push({x:px,y:landscapeHeight(px,pz)-.008,z:pz,height,radius,yaw:R()*Math.PI*2,tone:.77+R()*.19,patch:patches.length-1});
  }
 }
 // Shallow embedded gravel/clods: all actual vertices stay <=2.8cm above the
 // unchanged support surface. No large walk-through rocks or invented steps.
 for(let k=0;k<6000&&grit.length<1350;k++){
  const x=-30+R()*60,z=-32+R()*56,road=trafficDistance(x,z);
  if(Math.abs(x)<riverWidth(z)+2.1||blocked(x,z,.18)||inBuffer(x,z,.65)||road<.82||houses.some(h=>Math.abs(x-h.x)<3.8&&Math.abs(z-h.z)<3.8))continue;
  if(Math.sin(x*.73+Math.cos(z*.65)*2)+Math.cos(z*.86-x*.37)<.25)continue;
  const radius=.022+Math.pow(R(),2)*.06;
  grit.push({x,y:groundHeight(x,z)-.011,z,rx:radius,rz:radius*(.5+R()*.7),height:.020+R()*.018,yaw:R()*Math.PI*2,tone:.56+R()*.40});
 }
 // Whole-tree render impostors are distant scenery only, behind the 3D belt.
 // Centers >=60m from the rectangle; even the widest 18m canopy card is
 // >45m from the nearest reachable player, not just the spawn/camera.
 for(let k=0;k<1800&&forest.length<190;k++){
  const angle=R()*Math.PI*2,r=70+R()*66,x=Math.cos(angle)*r,z=Math.sin(angle)*r-4;
  const d=Math.hypot(Math.max(0,Math.abs(x)-32),Math.max(0,Math.abs(z+4)-30));
  if(d<60||Math.abs(x)>123||Math.abs(z)>123||Math.abs(x)<12||forest.some(p=>Math.hypot(x-p.x,z-p.z)<4.0))continue;
  const field=.5+.5*Math.sin(x*.093+z*.045)*Math.cos(z*.081-x*.03);
  if(field<.25)continue;
  forest.push({x,y:landscapeHeight(x,z)-.18,z,height:10+R()*8,species:forest.length%2,yaw:R()*Math.PI*2,tone:.80+R()*.16});
 }
 return{grass,grit,forest,patches};
}

export function groundGritGeometry(T){
 const geometry=new T.IcosahedronGeometry(1,0),p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=.85+.12*Math.sin(x*8+z*5);p.setXYZ(i,x*k,y,z*(.91+.09*Math.cos(x*7)))}geometry.computeVertexNormals();return geometry;
}
export function forestAtlasTile(species,view){return{viewport:[view*512+16,species*512+16,480,480],scissor:[view*512,species*512,512,512]}}
export function forestBakeCamera(T,view,halfWidth=.72){
 const c=new T.OrthographicCamera(-halfWidth,halfWidth,.59,-.59,.01,20),a=view*Math.PI/2;
 c.position.set(Math.sin(a)*4,.53,Math.cos(a)*4);c.lookAt(0,.53,0);c.updateMatrixWorld(true);return c;
}
export function renderForestAtlas(T,renderer,atlas,bakeScene,clones,halfWidth){
 const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new T.Color()),oldAlpha=renderer.getClearAlpha(),oldViewport=renderer.getViewport(new T.Vector4()),oldScissor=renderer.getScissor(new T.Vector4()),oldScissorTest=renderer.getScissorTest(),oldTone=renderer.toneMapping,oldAuto=renderer.autoClear;
 try{
  atlas.scissorTest=false;renderer.setRenderTarget(atlas);renderer.setClearColor(0,0);renderer.clear();renderer.autoClear=false;renderer.toneMapping=T.NoToneMapping;
  for(let species=0;species<2;species++){clones[species].visible=true;
   for(let view=0;view<4;view++){const tile=forestAtlasTile(species,view),bakeCam=forestBakeCamera(T,view,halfWidth);
    // Render-target viewport/scissor use physical texels, independent of DPR.
    atlas.viewport.fromArray(tile.viewport);atlas.scissor.fromArray(tile.scissor);atlas.scissorTest=true;renderer.setRenderTarget(atlas);renderer.clear();renderer.render(bakeScene,bakeCam)}clones[species].visible=false;
  }
 }finally{
  clones.forEach(h=>h.visible=false);
  // Restore canvas state first, then rebind the previous render target so its
  // own physical viewport/scissor win over the logical canvas setters.
  renderer.setViewport(oldViewport);renderer.setScissor(oldScissor);renderer.setScissorTest(oldScissorTest);renderer.setClearColor(oldColor,oldAlpha);renderer.toneMapping=oldTone;renderer.autoClear=oldAuto;renderer.setRenderTarget(oldTarget);
 }
}

export function buildEnvironmentPolish({T,world,renderer,grassSource,treeSources,stoneMaterial,sunDirection,environment}){
 const plan=polishEnvironmentPlan(),group=new T.Group();group.name='river-material-density-polish';world.add(group);
 const dummy=new T.Object3D(),color=new T.Color(),meshes=[],clock={value:0};let triangles=0;
 const add=(g,m,ps,name,fill)=>{
  const mesh=new T.InstancedMesh(g,m,ps.length);mesh.name=name;
  ps.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw||0,0);dummy.scale.set(1,1,1);fill(p,dummy);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.setScalar(p.tone);mesh.setColorAt(i,color)});
  mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);meshes.push(mesh);triangles+=(g.index?.count||g.attributes.position.count)/3*ps.length;return mesh;
 };
 grassSource.updateWorldMatrix(true,true);const box=new T.Box3().setFromObject(grassSource),center=box.getCenter(new T.Vector3()),height=box.max.y-box.min.y;
 grassSource.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);geo.translate(-center.x,-box.min.y,-center.z);geo.scale(1/height,1/height,1/height);
  const mat=o.material.clone();mat.name='dense-low-meadow';mat.roughness=.93;mat.metalness=0;mat.envMapIntensity=.44;mat.alphaTest=.35;mat.transparent=false;mat.side=T.DoubleSide;mat.forceSinglePass=true;
  mat.normalScale?.multiplyScalar(.5);mat.aoMapIntensity=.2;
  mat.onBeforeCompile=s=>{s.uniforms.meadowTime=clock;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float meadowTime;varying float meadowHeight;').replace('#include <begin_vertex>',`#include <begin_vertex>
   meadowHeight=position.y;transformed.x+=sin(meadowTime*1.3+instanceMatrix[3].x*.7+instanceMatrix[3].z*.4)*.055*position.y*position.y;`);
   s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float meadowHeight;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.60,1.,smoothstep(.04,.8,meadowHeight));');};
  mat.customProgramCacheKey=()=>ENVIRONMENT_POLISH_REVISION+'-meadow';
  for(const side of [-1,1])add(geo,mat,plan.grass.filter(p=>Math.sign(p.x)===side),'low-meadow-'+side,(p,d)=>d.scale.setScalar(p.height));
 });
 const gravelGeo=groundGritGeometry(T);
 const gravel=stoneMaterial.clone();gravel.color.set(0xc1bfb5);gravel.roughness=.80;gravel.metalness=0;gravel.normalScale.set(.95,.95);gravel.envMapIntensity=.55;
 gravel.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
  float mineralLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(mineralLuma*1.20),diffuseColor.rgb,.38);`)};
 gravel.customProgramCacheKey=()=>ENVIRONMENT_POLISH_REVISION+'-neutral-mineral';
 add(gravelGeo,gravel,plan.grit,'embedded-pathside-mineral',(p,d)=>d.scale.set(p.rx,p.height,p.rz));

 // Generated entirely from the already licensed source meshes. Runtime-only
 // linear RGBA render target, not downloaded raster art or a new public asset.
 const atlas=new T.WebGLRenderTarget(2048,1024,{minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter,generateMipmaps:true,depthBuffer:true});
 atlas.texture.name='actual-CC0-tree-four-view-atlas';atlas.texture.colorSpace=T.LinearSRGBColorSpace;
 const bakeScene=new T.Scene();bakeScene.environment=environment;
 const key=new T.DirectionalLight(0xfff1df,3.1);key.position.copy(sunDirection).multiplyScalar(20);bakeScene.add(key);
 const fill=new T.HemisphereLight(0xc6dbf1,0x928b75,1.35);bakeScene.add(fill);
 const clones=[];let halfWidth=.72;
 for(const source of treeSources){const clone=source.clone(true);clone.updateWorldMatrix(true,true);const b=new T.Box3().setFromObject(clone),h=b.max.y-b.min.y,c=b.getCenter(new T.Vector3()),holder=new T.Group();
  halfWidth=Math.max(halfWidth,Math.hypot(b.max.x-b.min.x,b.max.z-b.min.z)/h*.53);
  clone.position.sub(new T.Vector3(c.x,b.min.y,c.z));holder.scale.setScalar(1/h);holder.add(clone);bakeScene.add(holder);holder.visible=false;
  clone.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.envMapIntensity=.55;o.material.roughness=Math.max(.84,o.material.roughness);o.material.metalness=0;o.material.side=T.DoubleSide;o.material.alphaTest=/leaves/.test(o.material.name)?.35:o.material.alphaTest;o.material.transparent=false;o.castShadow=false;o.receiveShadow=false});clones.push(holder);
 }
 try{renderForestAtlas(T,renderer,atlas,bakeScene,clones,halfWidth)}finally{clones.forEach(h=>h.traverse(o=>{if(o.isMesh)o.material.dispose()}))}
 const forestMat=new T.MeshBasicMaterial({map:atlas.texture,alphaTest:.28,side:T.DoubleSide,color:0xffffff});forestMat.name='distant-full-tree-impostor';forestMat.forceSinglePass=true;
 forestMat.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float treeSpecies;attribute float treeYaw;varying vec2 treeAtlasOffset;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;vec2 towards=normalize(cameraPosition.xz-root.xz);
   vec3 right=vec3(towards.y,0.,-towards.x);transformed=right*position.x*(${(halfWidth*2).toFixed(6)}/1.18)+vec3(0.,position.y,0.);
   float a=atan(towards.x,towards.y)-treeYaw;float slot=mod(floor(a/1.57079632679+.5)+4.,4.);treeAtlasOffset=vec2(slot*.25,treeSpecies*.5);`);
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 treeAtlasOffset;');
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`vec2 localUV=clamp(vMapUv,vec2(.002),vec2(.998));vec4 sampledDiffuseColor=texture2D(map,localUV*vec2(480./2048.,480./1024.)+vec2(16./2048.,16./1024.)+treeAtlasOffset);diffuseColor*=sampledDiffuseColor;`);
 };forestMat.customProgramCacheKey=()=>ENVIRONMENT_POLISH_REVISION+'-impostor';
 for(const side of [-1,1]){
  const ps=plan.forest.filter(p=>Math.sign(p.x)===side).map(p=>({...p,height:Math.min(p.height,(Math.hypot(Math.max(0,Math.abs(p.x)-32),Math.max(0,Math.abs(p.z+4)-30))-45.1)/halfWidth)})),g=new T.PlaneGeometry(1,1);g.translate(0,.5-.06/1.18,0);
  g.setAttribute('treeSpecies',new T.InstancedBufferAttribute(new Float32Array(ps.map(p=>p.species)),1));g.setAttribute('treeYaw',new T.InstancedBufferAttribute(new Float32Array(ps.map(p=>p.yaw)),1));
  const mesh=add(g,forestMat,ps,'distant-layered-forest-'+side,(p,d)=>{d.rotation.set(0,0,0);d.scale.setScalar(p.height*1.18)});mesh.castShadow=false;mesh.receiveShadow=false;mesh.boundingSphere.radius+=20;
 }
 const info=()=>({revision:ENVIRONMENT_POLISH_REVISION,grass:plan.grass.length,patches:plan.patches.length,grit:plan.grit.length,distantTrees:plan.forest.length,triangles,drawCalls:meshes.length,shadowDraws:0,atlas:[2048,1024],atlasBytesWithMips:2048*1024*4*4/3,maxSupportDetail:.028,source:'existing CC0 grass, stone and four actual rendered source-tree views; original close 3D forest unchanged',limitation:'Distant canopy uses orientation-selected whole-tree cards, baked sun with weather tint, no close-up parallax/self-shadow'});
 return{update(t){clock.value=t},setWeather(w){forestMat.color.setRGB(w===0?1:.55,w===0?1:.66,w===0?1:.74)},info};
}
