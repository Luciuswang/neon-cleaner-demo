// Local-only actual GLTFLoader and running-world tests. Never shipped as UI.
(async()=>{
 const {validateHouseAsset,applyHouseAsset}=await import('./house-asset.js'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),T=await import('three');
 const checks=[],check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
 const contract=await(await fetch('./assets/house/house-contract.json')).json(),loader=new GLTFLoader();
 const original=await loader.loadAsync('./authoring/timber-house/timber-house-source.glb'),edited=await loader.loadAsync('./assets/house/timber-house-edited.glb');
 const sourceProof=await validateHouseAsset(T,original.scene,contract),editedProof=await validateHouseAsset(T,edited.scene,contract);
 check('actual source GLB loads and passes fixed-layout validator',sourceProof.validated,sourceProof);
 check('actual Blender-edited GLB loads and passes same validator',editedProof.validated,editedProof);
 const sourceHandle=original.scene.getObjectByName('DoorHandleGrip'),editedHandle=edited.scene.getObjectByName('DoorHandleGrip');
 check('real mesh edit changed handle vertex count',editedHandle.geometry.attributes.position.count>sourceHandle.geometry.attributes.position.count,{source:sourceHandle.geometry.attributes.position.count,edited:editedHandle.geometry.attributes.position.count});
 check('real edit changed hardware PBR material',editedHandle.material.name.startsWith('AgedBrass')&&editedHandle.material.metalness>.7&&Math.abs(editedHandle.material.roughness-.38)<1e-6,{name:editedHandle.material.name,metalness:editedHandle.material.metalness,roughness:editedHandle.material.roughness});
 for(const name of ['Foundation','Walls','Windows','Furniture','Ceiling'])check('source retains semantic '+name,!!original.scene.getObjectByName(name));
 check('all roof tiles are normal editable source meshes',contract.records.filter(r=>r.name.startsWith('RoofTile_')).length===723);
 const info=visual.info().house,root=visual.houseQA.root,pivot=visual.houseQA.pivot;
 check('running world uses imported GLB, not just a file on disk',info.asset.mode==='imported-glb'&&info.asset.validated,info.asset);
 check('original static assembly removed instead of doubled',root.children.every(c=>c.name!=='StaticParts')&&root.children.filter(c=>c.name==='CabinAsset').length===1);
 check('runtime batches imported static parts within budget',info.asset.staticBatches<20,info.asset.staticBatches);
 check('running door uses actually edited bevel mesh',pivot.getObjectByName('DoorHandleGrip')?.geometry.attributes.position.count===editedHandle.geometry.attributes.position.count);
 let lights=0;root.traverse(o=>{if(o.isLight)lights++});check('four actual practical lights retained exactly once',lights===4,lights);
 check('unchanged movement logic remains installed',visual.floorHeight(12,-18)===.66&&visual.floorHeight(0,12)===0&&visual.blocksMovement({x:14.5,y:2.36,z:-15.6}));
 const reject=async(name,mutate,restore)=>{
  let error;try{mutate();await validateHouseAsset(T,edited.scene,contract)}catch(e){error=e.message}finally{restore();edited.scene.updateWorldMatrix(true,true)}
  check('reject '+name,!!error,error);
 };
 const cabin=edited.scene.getObjectByName('CabinAsset'),door=cabin.getObjectByName('DoorPivot'),wall=edited.scene.getObjectByName(contract.records.find(r=>r.name.startsWith('Walls_part_')).name);
 const home=wall.position.clone();
 await reject('wall movement without collision update',()=>{wall.position.x+=.03},()=>wall.position.copy(home));
 await reject('global scale change',()=>{cabin.scale.setScalar(1.1)},()=>cabin.scale.setScalar(1));
 await reject('door hinge relocation',()=>{door.position.x+=.05},()=>{door.position.x=contract.doorPivot[0]});
 const parent=door.parent;await reject('wrong door hierarchy',()=>edited.scene.attach(door),()=>parent.attach(door));
 const extra=new T.PointLight();await reject('duplicate imported lights',()=>cabin.add(extra),()=>extra.removeFromParent());
 const uv=wall.geometry.attributes.uv;await reject('missing UVs',()=>wall.geometry.deleteAttribute('uv'),()=>wall.geometry.setAttribute('uv',uv));
 const handleHome=editedHandle.position.clone();
 await reject('cosmetic geometry moved beyond allowed bounds',()=>{editedHandle.position.z+=.1},()=>editedHandle.position.copy(handleHome));
 const originalGeometry=wall.geometry,candidate=originalGeometry.clone();
 const originalIndex=candidate.index?Array.from(candidate.index.array):Array.from({length:candidate.attributes.position.count},(_,i)=>i);
 wall.geometry=candidate;
 await reject('all triangle indices collapsed with unchanged vertex cloud',()=>candidate.setIndex(originalIndex.map(()=>0)),()=>candidate.setIndex(originalIndex));
 await reject('deleted wall triangle with unchanged vertex cloud',()=>candidate.setIndex(originalIndex.slice(3)),()=>candidate.setIndex(originalIndex));
 await reject('reversed wall face winding',()=>{const a=originalIndex.slice();[a[0],a[1]]=[a[1],a[0]];candidate.setIndex(a)},()=>candidate.setIndex(originalIndex));
 wall.geometry=originalGeometry;candidate.dispose();
 const snapshot={rootChildren:root.children.slice(),doorChildren:pivot.children.slice(),asset:JSON.stringify(visual.info().house.asset),lights:[]};
 root.traverse(o=>{if(o.isLight)snapshot.lights.push(o)});
 let batchingError;
 try{await applyHouseAsset({T,house:{qa:visual.houseQA},scene:edited.scene,contract,merge:()=>{throw Error('injected batching failure')}})}catch(e){batchingError=e.message}
 const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]),currentLights=[];root.traverse(o=>{if(o.isLight)currentLights.push(o)});
 check('injected batching failure is exercised',batchingError==='injected batching failure',batchingError);
 check('failed replacement retains original live root/door children and lights',same(snapshot.rootChildren,root.children)&&same(snapshot.doorChildren,pivot.children)&&same(snapshot.lights,currentLights)&&snapshot.asset===JSON.stringify(visual.info().house.asset));
 const report={schema:'sunbreak-house-roundtrip-browser-v1',date:new Date().toISOString(),method:'actual Three GLTFLoader source and Blender derivative, running world integration and negative contract probes; not human manual editing or continuous playthrough',pass:checks.every(c=>c.pass),checks,sourceProof,editedProof};
 const el=document.createElement('pre');el.id='roundtrip-result';el.textContent=JSON.stringify(report,null,2);document.body.append(el);
 const response=await fetch('/qa/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'roundtrip-browser',report,loadedBuildHashes:qaBuildHashes})});
 document.body.dataset.roundtripReport=response.ok?'saved':'failed';
})().catch(error=>{document.body.dataset.roundtripError=error.stack||String(error)});
