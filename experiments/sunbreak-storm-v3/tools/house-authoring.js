import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {buildTimberHouse} from '../timber-house.js';
import {makeHouseContract} from '../house-asset.js';
import {HOUSE} from '../house-logic.js';

try{
 const manifest=await(await fetch('/assets-manifest.json')).json(),materials={},loader=new T.TextureLoader();
 for(const [name,role]of [['wood','wood_weathered'],['plaster','wall_worn_plaster']]){
  const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.88,normalScale:new T.Vector2(.55,.55)});
  const source=manifest.assets.find(a=>a.semantic_role===role);
  for(const file of source.files){
   const key={base_color:'map',normal_opengl:'normalMap',roughness:'roughnessMap'}[file.role];if(!key)continue;
   const texture=await loader.loadAsync('/'+file.path);texture.wrapS=texture.wrapT=T.RepeatWrapping;
   if(key==='map')texture.colorSpace=T.SRGBColorSpace;material[key]=texture;
  }
  materials[name]=material;
 }
 const world=new T.Group(),house=buildTimberHouse({T,world,materials,authoring:true,solids:[null,new T.Group()],colliders:[null,new T.Box3(new T.Vector3(8,0,-22),new T.Vector3(16,5.2,-14))]});
 const root=house.root;root.position.set(0,0,0);root.name='CabinAsset';
 root.userData={units:'metres',upAxis:'+Y',layoutContract:'sunbreak-house-fixed-layout-v1',note:'Keep DoorPivot and protected geometry; editable source, not runtime batches.'};
 const groups=new Map(),staticRoot=root.getObjectByName('StaticParts');
 for(const child of staticRoot.children.slice()){
  const name=child.userData.houseSection||'Details';if(!groups.has(name)){const group=new T.Group();group.name=name;staticRoot.add(group);groups.set(name,group)}
  groups.get(name).add(child);
 }
 // Expand GPU instances to normal editable meshes. Vertex color keeps every
 // original roof tint without hundreds of materials or renderer extensions.
 const instances=[];root.traverse(o=>{if(o.isInstancedMesh)instances.push(o)});
 const matrix=new T.Matrix4(),color=new T.Color();
 for(const inst of instances){
  const group=new T.Group();group.name=inst.name;group.position.copy(inst.position);group.quaternion.copy(inst.quaternion);group.scale.copy(inst.scale);
  const mat=inst.material.clone();mat.name=inst.instanceColor?'RoofSlate':'RoofRidgeSlate';mat.vertexColors=!!inst.instanceColor;
  for(let i=0;i<inst.count;i++){
   const geo=inst.geometry.clone();if(inst.instanceColor){
    inst.getColorAt(i,color);const a=new Float32Array(geo.attributes.position.count*3);
    for(let j=0;j<a.length;j+=3)a.set(color.toArray(),j);
    geo.setAttribute('color',new T.BufferAttribute(a,3));
   }
   const mesh=new T.Mesh(geo,mat);mesh.name=(inst.instanceColor?'RoofTile_':'RoofRidge_')+String(i).padStart(4,'0');
   inst.getMatrixAt(i,matrix);mesh.applyMatrix4(matrix);group.add(mesh);
  }
  inst.parent.add(group);inst.removeFromParent();
 }
 let anonymous=0;
 root.traverse(o=>{if(o.isMesh&&!o.name)o.name='RoofEdge_'+String(++anonymous).padStart(3,'0')});
 // r160's metallic/roughness packer expects drawable images, not DataTexture
 // buffers. Bake the authored 64px roof maps to lossless canvas images only in
 // this export copy; the live renderer's maps remain unchanged.
 const converted=new Map();
 root.traverse(o=>{
  if(!o.isMesh)return;
  for(const material of Array.isArray(o.material)?o.material:[o.material])for(const [key,value]of Object.entries(material)){
   if(!value?.isDataTexture)continue;
   if(!converted.has(value)){
    const canvas=document.createElement('canvas');canvas.width=value.image.width;canvas.height=value.image.height;
    const context=canvas.getContext('2d');context.putImageData(new ImageData(new Uint8ClampedArray(value.image.data),canvas.width,canvas.height),0,0);
    const texture=new T.CanvasTexture(canvas);texture.wrapS=value.wrapS;texture.wrapT=value.wrapT;texture.flipY=value.flipY;texture.colorSpace=value.colorSpace;
    converted.set(value,texture);
   }
   material[key]=converted.get(value);
  }
 });
 const lights=[];root.traverse(o=>{if(o.isLight)lights.push(o)});
 for(const [i,light]of lights.entries()){
  const anchor=new T.Object3D();anchor.name='LightAnchor_'+i;anchor.position.copy(light.position);anchor.userData={color:light.color.getHex(),intensity:light.intensity,gameOwned:true};light.parent.add(anchor);light.removeFromParent();
 }
 root.updateWorldMatrix(true,true);
 const contract=await makeHouseContract(T,root,HOUSE);
 const bytes=await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true,trs:true,maxTextureSize:1024});
 const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(new Blob([bytes]))});
 const response=await fetch('/house-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({glb:base64,contract})});
 if(!response.ok)throw Error(await response.text());
 document.getElementById('status').textContent='木屋已导出';document.body.dataset.export='saved';
}catch(error){document.body.dataset.export='failed';document.getElementById('status').textContent=error.stack||String(error)}
