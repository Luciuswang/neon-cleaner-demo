import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {vegetationAllowed,terrainHeight,landscapeHeight} from './map-layout.js';
export async function buildVegetation(T,world){
 const loader=new GLTFLoader(),time={value:0};let seed=925221;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const [tree,far,fern,grass]=await Promise.all([
  './river/assets/island_tree_02/tree-lod.glb','./river/assets/island_tree_02/tree-far.glb',
  './river/assets/fern_02/fern_02.gltf','./river/assets/grass_bermuda_01/grass_bermuda_01.gltf'
 ].map(p=>loader.loadAsync(p)));
 const alphaLoader=new T.TextureLoader();
 const [treeAlpha,fernAlpha,grassAlpha]=await Promise.all(['island_tree_02','fern_02','grass_bermuda_01'].map(id=>alphaLoader.loadAsync('./river/assets/'+id+'/alpha.png')));
 for(const t of [treeAlpha,fernAlpha,grassAlpha]){t.flipY=false;t.anisotropy=4}
 const meshes=[],counts={},dummy=new T.Object3D(),color=new T.Color();
 function instances(source,placements,height,label,shadow){
  source.updateMatrixWorld(true);const b=new T.Box3().setFromObject(source),size=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3()),scale=height/size.y;
  source.traverse(node=>{
   if(!node.isMesh)return;
   const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
   geometry.translate(-c.x,-b.min.y,-c.z);geometry.scale(scale,scale,scale);
   const material=node.material.clone();material.envMapIntensity=.5;material.roughness=Math.max(.65,material.roughness);material.side=T.DoubleSide;
   if(label==='grass'||label==='fern'||/leaves/i.test(material.name)){
    material.alphaMap=label==='grass'?grassAlpha:label==='fern'?fernAlpha:treeAlpha;material.alphaTest=.45;material.transparent=false;material.depthWrite=true;
   }
   material.color.multiplyScalar(.84);
   if(material.map)material.map.anisotropy=4;
   const wind=label==='grass'?.035:label==='fern'?.025:.07;
   material.onBeforeCompile=s=>{
    s.uniforms.uWindTime=time;
    s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nuniform float uWindTime;');
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
     float windPhase=instanceMatrix[3].x*.31+instanceMatrix[3].z*.23;
     transformed.x+=sin(uWindTime*1.4+windPhase+position.y*.8)*${wind}*pow(clamp(position.y/${height.toFixed(3)},0.,1.),2.);
     transformed.z+=cos(uWindTime*.9+windPhase)*${wind*.6}*clamp(position.y/${height.toFixed(3)},0.,1.);`);
   };
   material.customProgramCacheKey=()=>`river-wind-${label}-${height}`;
   const inst=new T.InstancedMesh(geometry,material,placements.length);inst.name=label;
   placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.r,0);dummy.scale.set(p.s,p.s*(p.stretch||1),p.s);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);color.setHSL(.23+random()*.035,.18+random()*.15,.72+random()*.13);inst.setColorAt(i,color)});
   inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();world.add(inst);meshes.push(inst);
  });counts[label]=(counts[label]||0)+placements.length;
 }
 const near=[],distant=[];
 // Outside the playable rectangle: solid trunks cannot create asymmetric cover.
 for(let i=0;i<48;i++){
  const angle=i/48*Math.PI*2,r=43+random()*9;
  const x=Math.cos(angle)*r,z=Math.sin(angle)*r-4;
  near.push({x,y:landscapeHeight(x,z)-.18,z,r:random()*6.28,s:.75+random()*.5,stretch:.9+random()*.3});
 }
 for(let i=0;i<100;i++){
  const angle=i/100*Math.PI*2,r=64+random()*54;
  const x=Math.cos(angle)*r,z=Math.sin(angle)*r-4;
  distant.push({x,y:landscapeHeight(x,z)-.25,z,r:random()*6.28,s:.7+random()*.85,stretch:1+random()*.6});
 }
 instances(tree.scene,near,14,'trees-near',true);instances(far.scene,distant,15,'trees-far',false);
 const ferns=[],grasses=[];
 for(let i=0;i<40000;i++){
  const x=random()*72-36,z=random()*68-38;
  if(!vegetationAllowed(x,z))continue;
  const path=Math.min(...[-23,-4,15].map(c=>Math.abs(z-c)));
  if(Math.abs(x)<29&&path<2.6&&random()<.9)continue;
  const p={x,y:terrainHeight(x,z)-.02,z,r:random()*6.28,s:.65+random()*.85};
  if(i%50===0)ferns.push(p);else grasses.push(p);
 }
 const fernParts=fern.scene.children;
 fernParts.forEach((node,i)=>instances(node,ferns.filter((_,j)=>j%fernParts.length===i),.8,'fern',true));
 const grassParts=grass.scene.children.filter(n=>/medium_[abc]/.test(n.name));
 grassParts.forEach((node,i)=>instances(node,grasses.filter((_,j)=>j%grassParts.length===i),.38,'grass',false));
 return{update(t){time.value=t},info(){return{counts,drawCalls:meshes.length,source:'CC0 Poly Haven scanned foliage, explicit near/far geometry'}}};
}
