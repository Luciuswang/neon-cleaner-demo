import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildTimberHouse} from './timber-house.js';
import {BUFFER_PLACEMENTS,createBufferHouseLogic} from './buffer-house-logic.js';

// Keep the semantic assembly's UVs, tiles, interior and articulated door. Only
// static opaque geometry is batched, in the normalized house-root coordinates.
function batchStatic(T,root,pivot){
 root.updateWorldMatrix(true,true);
 const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),matrix=new T.Matrix4(),batches=new Map(),remove=[];
 let originalStaticMeshes=0;
 root.traverse(o=>{
  if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.transparent)return;
  for(let parent=o;parent;parent=parent.parent)if(parent===pivot)return;
  matrix.multiplyMatrices(inverse,o.matrixWorld);
  const clone=o.geometry.clone().applyMatrix4(matrix),g=clone.index?clone.toNonIndexed():clone;
  if(g!==clone)clone.dispose();
  if(!batches.has(o.material))batches.set(o.material,[]);
  batches.get(o.material).push(g);remove.push(o);originalStaticMeshes++;
 });
 for(const [material,parts]of batches){
  const geometry=mergeGeometries(parts,false);
  if(!geometry)throw Error('Incompatible static cabin geometry: '+material.name);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,material);mesh.name='StaticBatch_'+(material.name||material.uuid);
  mesh.castShadow=mesh.receiveShadow=true;mesh.userData.houseSection='StaticBatch';root.add(mesh);
  for(const g of parts)g.dispose();
 }
 for(const mesh of remove){mesh.removeFromParent();mesh.geometry.dispose()}
 root.updateWorldMatrix(true,true);
 return{originalStaticMeshes,staticBatches:batches.size};
}

function createFiniteRayProxy(T,root,pivot){
 root.updateWorldMatrix(true,true);
 const inverse=new T.Matrix4().copy(root.matrixWorld).invert();
 // Derive this from visible geometry, not AI bounds (which omit the small
 // below-zero foundation parts). A transformed AABB is conservative at any yaw.
 const localBounds=new T.Box3().setFromObject(root).applyMatrix4(inverse);
 const leafBounds=new T.Box3().setFromObject(pivot).applyMatrix4(new T.Matrix4().copy(pivot.matrixWorld).invert());
 const radius=Math.hypot(Math.max(Math.abs(leafBounds.min.x),Math.abs(leafBounds.max.x)),Math.max(Math.abs(leafBounds.min.z),Math.abs(leafBounds.max.z)));
 // Full hinge-circle envelope: no per-frame bounds rebuild and no clipping of
 // a partly open door/handle. The door's only animated transform is local yaw.
 localBounds.expandByPoint(new T.Vector3(pivot.position.x-radius,pivot.position.y+leafBounds.min.y,pivot.position.z-radius));
 localBounds.expandByPoint(new T.Vector3(pivot.position.x+radius,pivot.position.y+leafBounds.max.y,pivot.position.z+radius));
 localBounds.expandByScalar(.002);
 const worldBounds=new T.Box3(),cachedMatrix=new T.Matrix4();cachedMatrix.elements.fill(NaN);
 const stats={tests:0,rejected:0,exactCalls:0},axes=['x','y','z'];
 function sync(){
  if(!cachedMatrix.equals(root.matrixWorld)){worldBounds.copy(localBounds).applyMatrix4(root.matrixWorld);cachedMatrix.copy(root.matrixWorld)}
 }
 function intersectsSegment(raycaster){
  // Raycaster directions are unit length. Unlike Ray.intersectsBox/Sphere,
  // this slab interval rejects boxes beyond far and before near, including
  // origin-inside and parallel/grazing cases without allocating hit vectors.
  let lo=Math.max(0,raycaster.near),hi=raycaster.far;
  if(hi<lo)return false;
  const {origin,direction}=raycaster.ray;
  for(const axis of axes){
   const d=direction[axis],o=origin[axis],min=worldBounds.min[axis],max=worldBounds.max[axis];
   if(d===0){if(o<min||o>max)return false;continue}
   let a=(min-o)/d,b=(max-o)/d;if(a>b){const swap=a;a=b;b=swap}
   lo=Math.max(lo,a);hi=Math.min(hi,b);if(hi<lo)return false;
  }
  return true;
 }
 // The bundled Three Raycaster always recurses, even when raycast returns
 // false. This proxy MUST stay childless; root remains separately in world.
 const proxy=new T.Object3D();proxy.name=root.name+'_finite-ray-proxy';proxy.layers.enableAll();
 proxy.userData.bufferHouse=root.userData.bufferHouse;proxy.userData.sourceRootUuid=root.uuid;
 proxy.raycast=(raycaster,hits)=>{
  stats.tests++;sync();
  if(!intersectsSegment(raycaster)){stats.rejected++;return}
  stats.exactCalls++;
  // Preserve original mesh/object, instanceId, face, point and world distance.
  // The box only rejects work: it never manufactures a cover/bullet hit.
  raycaster.intersectObject(root,true,hits);
 };
 sync();return{proxy,root,localBounds,worldBounds,sync,stats};
}

export function buildBufferHouses({T,world,materials,solids,cam,getInteractionState,placements=BUFFER_PLACEMENTS,rayBroadphase=true}){
 if(new Set(placements.map(p=>p.id)).size!==placements.length)throw Error('Duplicate buffer-house id');
 const houses=placements.map(placement=>{
  // Isolated empty arrays make the authoring contract explicit. Never index,
  // splice or replace any of the existing map's movement/shot proxies.
  const assembly=buildTimberHouse({T,world,materials,solids:[],colliders:[],authoring:true});
  const {root,pivot,movement}=assembly,logic=createBufferHouseLogic({placement,movement});
  root.name='RiverfallBufferHouse_'+placement.id;
  root.userData.bufferHouse=placement.id;
  root.position.set(placement.x,placement.y??0,placement.z);root.rotation.y=placement.yaw??0;
  const batching=batchStatic(T,root,pivot);
  // Optional finite-ray broadphase delegates accepted rays to exact surfaces.
  // Keep only ONE entry per house to avoid duplicate recursive intersections.
  const broadphase=rayBroadphase?createFiniteRayProxy(T,root,pivot):null,shotProxy=broadphase?.proxy??root;
  solids.push(shotProxy);
  return{id:placement.id,...assembly,logic,batching,broadphase,shotProxy,last:{near:false,visible:false,distance:Infinity}};
 });
 const navigationBounds=houses.map(h=>h.logic.navigationBounds);
 const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3(),forward=new T.Vector3(),anchor=new T.Vector3();
 const doc=globalThis.document,eventTarget=globalThis.window;
 const prompt=doc?.createElement('div')??null;
 if(prompt){
  prompt.id='bufferHousePrompt';prompt.hidden=true;prompt.setAttribute('role','status');
  prompt.style.cssText='position:fixed;bottom:125px;left:50%;transform:translateX(-50%);z-index:40;background:#172229e8;border:1px solid #bca58066;color:#eee0c5;padding:10px 17px;font:13px Microsoft YaHei,sans-serif;text-align:center;pointer-events:none';
  doc.body.append(prompt);
 }
 let selected=null,keyHeld=false;
 const currentState=()=>{
  const state=getInteractionState?.()??{};
  return{...state,active:state.active===true&&!doc?.hidden};
 };
 function candidates(){
  cam.updateWorldMatrix(true,false);cam.getWorldPosition(origin);cam.getWorldDirection(forward);
  let nearest=null;
  for(const house of houses){
   const a=house.logic.doorAnchor;anchor.set(a.x,a.y,a.z);direction.copy(anchor).sub(origin);
   const distance=direction.length(),near=distance>.01&&distance<2.65;let visible=false;
   if(near){
    direction.multiplyScalar(1/distance);
    if(forward.dot(direction)>.43){
     ray.set(origin,direction);ray.near=0;ray.far=Math.max(0,distance-.17);
     const hit=ray.intersectObjects(solids,true)[0];visible=!hit||hit.distance>=distance-.22;
    }
   }
   Object.assign(house.last,{near,visible,distance});
   if(visible&&(!nearest||distance<nearest.last.distance))nearest=house;
  }
  return nearest;
 }
 function setPrompt(house,active){
  selected=active?house:null;if(!prompt)return;
  prompt.hidden=!selected;
  if(selected){
   const d=selected.logic.door,info=d.info();prompt.dataset.house=selected.id;
   prompt.textContent=d.message||(info.moving?'门扇转动中…':d.target?'E · 关门':'E · 开门');
  }else delete prompt.dataset.house;
 }
 function focusedUI(element){
  return !!(element?.isContentEditable||element?.closest?.('input,textarea,select,button,[role="textbox"],[contenteditable]:not([contenteditable="false"])'));
 }
 function request({repeat=false,focusedUI:focus=false}={}){
  // Re-evaluate live state, distance, direction and real geometry at the event;
  // a cached prompt is never authorization to act through a wall or from pause.
  const state=currentState();
  if(!state.active||repeat||focus||focusedUI(doc?.activeElement))return false;
  const house=candidates();
  if(!house){setPrompt(null,false);return false}
  const changed=house.logic.toggle({near:true,visible:true,active:true,player:state.player});
  setPrompt(house,true);return changed;
 }
 function keydown(event){
  if(event.code!=='KeyE')return;
  const repeat=event.repeat||keyHeld;keyHeld=true;
  if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
  if(request({repeat,focusedUI:focusedUI(event.target)}))event.preventDefault();
 }
 function keyup(event){if(event.code==='KeyE')keyHeld=false}
 function blur(){keyHeld=false;setPrompt(null,false)}
 eventTarget?.addEventListener('keydown',keydown);eventTarget?.addEventListener('keyup',keyup);eventTarget?.addEventListener('blur',blur);
 function refresh(){for(const h of houses){h.pivot.rotation.y=h.logic.door.angle;h.root.updateWorldMatrix(true,true)}}
 function info(){
  return{source:'storm-v3 original authoring assembly, transformed per instance',count:houses.length,independentDoors:true,
   playerCollision:'source-space exact movement boxes and moving door',enemyInteriors:false,navigationBounds,
   selected:selected?.id??null,houses:houses.map(h=>({...h.logic.info(),root:h.root.position.toArray(),yaw:h.root.rotation.y,
    logs:h.logs,lapEnds:h.lapEnds,windows:h.windows,interiorLights:2,exteriorLights:2,roof:h.roof,...h.batching,
    near:h.last.near,visible:h.last.visible,raycastUsesVisibleAssembly:solids.includes(h.shotProxy)&&(!h.broadphase||h.broadphase.root===h.root),
    rayBroadphase:h.broadphase?{method:'finite transformed AABB -> exact visible meshes',...h.broadphase.stats}:null}))};
 }
 return{
  navigationBounds,
  floorHeight(x,z){let height=null;for(const h of houses){const y=h.logic.floorHeight(x,z);if(y!==null)height=height===null?y:Math.max(height,y)}return height},
  ceilingY(p,previousY){let height=Infinity;for(const h of houses)height=Math.min(height,h.logic.ceilingY(p,previousY));return height},
  blocksMovement(p,actor='player'){return houses.some(h=>h.logic.blocksMovement(p,actor))},
  underRoof(x,y,z){for(const h of houses)if(h.logic.underRoof(x,y,z))return true;return false},
  update(dt,{S,pres=false,live=false,player}={}){
   const state=currentState(),active=live&&!pres&&(!S||S.state==='play')&&state.active;
   for(const h of houses)h.logic.step(dt,player??state.player,active);
   refresh();setPrompt(active?candidates():null,active);
  },
  reset(){for(const h of houses)h.logic.reset();keyHeld=false;refresh();setPrompt(null,false)},
  info,
  dispose(){eventTarget?.removeEventListener('keydown',keydown);eventTarget?.removeEventListener('keyup',keyup);eventTarget?.removeEventListener('blur',blur);prompt?.remove()},
  qa:{houses,navigationBounds,request,refresh,candidates,prompt,keydown,keyup,focusedUI,
   get selected(){return selected?.id??null},
   house(id){return houses.find(h=>h.id===id)??null}}
 };
}
