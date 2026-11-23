// Visual-only authoritative hit feedback. No weapon cadence, damage, raycasts,
// invented hit endpoints, source mesh mutations, textures or persistent decals.
export const COMBAT_FEEDBACK_LIMITS=Object.freeze({puffs:72,flecks:128,drawCalls:2,triangles:400,maxLifetime:.65,surfaceOffset:.008,decals:0,shadowLights:0});
const kinds=new Set(['stone','wood','metal','earth','water','actor']);
const finiteVector=v=>!!v&&[v.x,v.y,v.z].every(Number.isFinite);
const step=dt=>Number.isFinite(dt)?Math.max(0,dt):0;

export function combatMaterialKind(object,materialIndex=0){
 const tagged=object?.userData?.impactKind;if(kinds.has(tagged))return tagged;
 const material=Array.isArray(object?.material)?object.material[materialIndex]:object?.material;
 const name=((object?.name||'')+' '+(material?.name||'')).toLowerCase();
 if(material?.metalness>=.45||/metal|iron|steel/.test(name))return 'metal';
 if(/wood|timber|plank|bark|door/.test(name))return 'wood';
 if(/water|river-surface|puddle/.test(name))return 'water';
 if(/mud|soil|earth|gravel|terrain|dirt/.test(name))return 'earth';
 return 'stone';
}

/** Optional root adapter for an ACTUAL Three intersection, never the shot's
 * max-range endpoint. Face normal is local; inverse-transpose must include the
 * instance matrix and world parents. Normals face the incoming ray hemisphere.
 * Actor hitboxes: root supplies its actual winning hit and normal separately.
 */
export function combatEventFromIntersection(T,intersection,direction,kind){
 if(!intersection||!finiteVector(intersection.point)||!intersection.object)return {hit:false,direction};
 const object=intersection.object,local=intersection.face?.normal||intersection.normal;
 if(!finiteVector(local))return {hit:false,direction};
 object.updateWorldMatrix(true,false);
 const matrix=object.matrixWorld.clone();
 if(object.isInstancedMesh){
  if(!Number.isInteger(intersection.instanceId)||intersection.instanceId<0||intersection.instanceId>=object.count)return {hit:false,direction};
  const instance=new T.Matrix4();object.getMatrixAt(intersection.instanceId,instance);matrix.multiply(instance);
 }
 const normal=new T.Vector3().copy(local).applyNormalMatrix(new T.Matrix3().getNormalMatrix(matrix));
 if(!finiteVector(normal)||normal.lengthSq()<1e-10)return {hit:false,direction};
 if(finiteVector(direction)&&normal.dot(direction)>0)normal.negate();
 return {hit:true,point:new T.Vector3().copy(intersection.point),normal,object,kind:kinds.has(kind)?kind:combatMaterialKind(object,intersection.face?.materialIndex),direction};
}

export function normalizeCombatHit(T,event){
 if(event?.hit!==true||!finiteVector(event.point)||!finiteVector(event.normal))return null;
 const normal=new T.Vector3().copy(event.normal);if(normal.lengthSq()<1e-10)return null;normal.normalize();
 if(finiteVector(event.direction)&&normal.dot(event.direction)>0)normal.negate();
 return {point:new T.Vector3().copy(event.point),normal,kind:kinds.has(event.kind)?event.kind:combatMaterialKind(event.object),object:event.object};
}

const VERTEX=`
#include <common>
#include <fog_pars_vertex>
attribute vec3 fxCenter;
attribute vec3 fxColor;
attribute vec4 fxShape;
attribute vec3 fxContact;
attribute vec3 fxNormal;
varying vec2 vFxUv;
varying vec3 vFxColor;
varying vec4 vFxShape;
varying vec3 vFxWorld;
varying vec3 vFxContact;
varying vec3 vFxNormal;
void main(){
 vFxUv=position.xy;vFxColor=fxColor;vFxShape=fxShape;
 vFxContact=fxContact;vFxNormal=fxNormal;
 vec2 offset=position.xy*fxShape.xy;
 // Attributes are explicit world coordinates, independent of the owner's root.
 // Inverse camera rotation handles real and Reflector cameras identically.
 vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]);
 vec3 up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
 vFxWorld=fxCenter+right*offset.x+up*offset.y;
 vec4 mvPosition=viewMatrix*vec4(vFxWorld,1.);
 gl_Position=projectionMatrix*mvPosition;
 #include <fog_vertex>
}`;
const FRAGMENT=`
#include <common>
#include <fog_pars_fragment>
varying vec2 vFxUv;
varying vec3 vFxColor;
varying vec4 vFxShape;
varying vec3 vFxWorld;
varying vec3 vFxContact;
varying vec3 vFxNormal;
void main(){
 if(vFxShape.z<.003)discard;
 // Even camera-facing puffs/chips are clipped to the source surface's outward
 // half-space. No billboard patch can extend behind its thin source wall.
 if(dot(vFxNormal,vFxNormal)>.5&&dot(vFxWorld-vFxContact,vFxNormal)<.001)discard;
 float r=length(vFxUv),a=0.;
 if(vFxShape.w<.5){
  float noise=sin(vFxUv.x*13.+sin(vFxUv.y*9.))*sin(vFxUv.y*11.+vFxUv.x*4.);
  a=(1.-smoothstep(.08,.50,r+noise*.025));a*=a;
 }else if(vFxShape.w<1.5){
  // Tiny irregular chip silhouette, not a large opaque square.
  a=step(-.43,vFxUv.y)*step(vFxUv.y,.42)*step(abs(vFxUv.x),(.5-vFxUv.y)*.57);
 }else if(vFxShape.w<2.5){
  a=(1.-smoothstep(.10,.48,abs(vFxUv.x)))*(1.-smoothstep(.18,.5,abs(vFxUv.y)));
 }else{a=1.-smoothstep(.12,.5,r);}
 a*=vFxShape.z;if(a<.003)discard;
 gl_FragColor=vec4(vFxColor,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
}`;

function pool(T,root,name,capacity,additive){
 const geometry=new T.InstancedBufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));geometry.setIndex([0,1,2,0,2,3]);
 const attributes={};for(const [key,size]of Object.entries({fxCenter:3,fxColor:3,fxShape:4,fxContact:3,fxNormal:3})){
  const a=new T.InstancedBufferAttribute(new Float32Array(capacity*size),size);a.setUsage(T.DynamicDrawUsage);geometry.setAttribute(key,a);attributes[key]=a;
 }
 const material=new T.ShaderMaterial({name,vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:T.UniformsUtils.clone(T.UniformsLib.fog),fog:true,transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:additive?T.AdditiveBlending:T.NormalBlending});
 material.forceSinglePass=true;
 const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.visible=false;root.add(mesh);geometry.instanceCount=0;
 const records=Array.from({length:capacity},()=>({p:new T.Vector3(),v:new T.Vector3(),n:new T.Vector3(),contact:new T.Vector3(),color:new T.Color(),age:0,life:0,size:0,aspect:1,alpha:0,mode:0,gravity:0,drag:0,growth:0}));
 let cursor=0,overwritten=0;
 return {records,mesh,capacity,
  take(){const p=records[cursor];cursor=(cursor+1)%capacity;if(p.life>p.age)overwritten++;return p},
  sync(){let count=0;for(const p of records){if(p.age>=p.life)continue;const t=p.age/p.life,size=p.size*(1+p.growth*t),fade=Math.pow(1-t,1.4);
    attributes.fxCenter.setXYZ(count,p.p.x,p.p.y,p.p.z);attributes.fxColor.setXYZ(count,p.color.r,p.color.g,p.color.b);
    attributes.fxShape.setXYZW(count,size*p.aspect,size,p.alpha*fade,p.mode);
    attributes.fxContact.setXYZ(count,p.contact.x,p.contact.y,p.contact.z);attributes.fxNormal.setXYZ(count,p.n.x,p.n.y,p.n.z);count++;
   }geometry.instanceCount=count;mesh.visible=count>0;for(const a of Object.values(attributes))a.needsUpdate=true;return count;
  },
  reset(){for(const p of records)p.age=p.life=0;cursor=0;this.sync()},
  info(){return {capacity,active:geometry.instanceCount,overwritten,drawCalls:mesh.visible?1:0,triangles:geometry.instanceCount*2}},
  dispose(){mesh.removeFromParent();geometry.dispose();material.dispose()}
 };
}

/** root forwards each accepted shot exactly once. A miss may supply muzzle for
 * smoke, but only hit:true with a finite point + world normal creates an impact.
 * muzzle:null suppresses smoke (root's corner-obstruction guard); gun flash is
 * separate weapon.shot(event). No decals, trails, ricochet hits or new lights.
 */
export function buildCombatFeedback({T,world}){
 if(!T?.InstancedBufferGeometry||!world?.add)throw new TypeError('buildCombatFeedback needs THREE and world');
 const root=new T.Group();root.name='authoritative-combat-feedback';root.userData.heightFog=false;world.add(root);
 const puffs=pool(T,root,'combat-dust-smoke',COMBAT_FEEDBACK_LIMITS.puffs,false),flecks=pool(T,root,'combat-chips-sparks',COMBAT_FEEDBACK_LIMITS.flecks,true);
 const counts={shots:0,impacts:0,misses:0,invalidHits:0,smoke:0,kinds:{stone:0,wood:0,metal:0,earth:0,water:0,actor:0}};
 const tangent=new T.Vector3(),bitangent=new T.Vector3(),direction=new T.Vector3(),up=new T.Vector3(0,1,0);
 const palettes={stone:0x8b8578,wood:0x897254,metal:0xffb44e,earth:0x71684d,water:0xb3c9ce,actor:0x8b877a};
 let seed=0x51ce238,disposed=false,lastImpact=null;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 function initialize(p,point,normal,{life,size,alpha,mode=0,color,gravity=0,drag=0,growth=0,aspect=1}){
  p.p.copy(point);p.contact.copy(point);p.n.copy(normal);p.p.addScaledVector(normal,COMBAT_FEEDBACK_LIMITS.surfaceOffset);
  p.age=0;p.life=life;p.size=size;p.alpha=alpha;p.mode=mode;p.color.set(color);p.gravity=gravity;p.drag=drag;p.growth=growth;p.aspect=aspect;p.v.set(0,0,0);return p;
 }
 function shot(event={}){
  if(disposed)return {accepted:false,reason:'disposed'};counts.shots++;
  if(finiteVector(event.muzzle)){
   direction.set(0,.12,0);if(finiteVector(event.direction)&&Math.hypot(event.direction.x,event.direction.y,event.direction.z)>1e-8)direction.copy(event.direction).normalize().multiplyScalar(.24);
   for(let i=0;i<2;i++){
    const p=initialize(puffs.take(),event.muzzle,new T.Vector3(),{life:.25+random()*.2,size:.045+random()*.025,alpha:.13,color:0x8d918b,growth:2.4,drag:2,gravity:-.22});
    p.v.copy(direction);p.v.y+=.08+random()*.06;counts.smoke++;
   }
  }
  const hit=normalizeCombatHit(T,event);
  if(!hit){if(event.hit===true)counts.invalidHits++;else counts.misses++;puffs.sync();return {accepted:true,impact:false}}
  counts.impacts++;counts.kinds[hit.kind]++;lastImpact={point:hit.point.toArray(),normal:hit.normal.toArray(),kind:hit.kind,offset:COMBAT_FEEDBACK_LIMITS.surfaceOffset};
  tangent.copy(Math.abs(hit.normal.y)<.9?up:new T.Vector3(1,0,0)).cross(hit.normal).normalize();bitangent.crossVectors(hit.normal,tangent).normalize();
  const watery=hit.kind==='water',metal=hit.kind==='metal',actor=hit.kind==='actor';
  const dustCount=watery?2:metal?1:actor?2:4;
  for(let i=0;i<dustCount;i++){
   const p=initialize(puffs.take(),hit.point,hit.normal,{life:actor?.18:.25+random()*.28,size:actor?.045:.065+random()*.055,alpha:metal?.16:watery?.18:.28,color:palettes[hit.kind],gravity:watery?.8:.2,drag:3,growth:1.7});
   p.v.copy(hit.normal).multiplyScalar(.20+random()*.28).addScaledVector(tangent,(random()-.5)*.38).addScaledVector(bitangent,(random()-.5)*.38);
  }
  if(!actor)for(let i=0;i<(metal?8:watery?7:5);i++){
   const p=initialize((metal?flecks:puffs).take(),hit.point,hit.normal,{life:metal?.12+random()*.12:.16+random()*.18,size:metal?.04+random()*.045:watery?.014+random()*.018:.008+random()*.018,alpha:metal?.78:.5,mode:metal?2:watery?3:1,color:palettes[hit.kind],gravity:metal?4:5,drag:1.8,aspect:metal?.2:watery?.55:.7});
   p.v.copy(hit.normal).multiplyScalar(.42+random()*(metal?1.5:.85)).addScaledVector(tangent,(random()-.5)*1.25).addScaledVector(bitangent,(random()-.5)*1.25);
   if(metal)p.color.multiplyScalar(2.5);
  }
  puffs.sync();flecks.sync();return {accepted:true,impact:true,kind:hit.kind};
 }
 function update(dt){
  if(disposed)return;dt=step(dt);
  for(const pool of [puffs,flecks]){
   for(const p of pool.records){
    if(p.age>=p.life)continue;p.age+=dt;if(p.age>=p.life)continue;
    p.v.y-=p.gravity*dt;p.v.multiplyScalar(Math.exp(-p.drag*dt));p.p.addScaledVector(p.v,dt);
    if(p.n.lengthSq()>.5&&direction.copy(p.p).sub(p.contact).dot(p.n)<.003)p.age=p.life;
   }pool.sync();
  }
 }
 return {shot,update,reset(){puffs.reset();flecks.reset();lastImpact=null},info(){return {revision:'actual-hit-pooled-v1',...counts,kinds:{...counts.kinds},limits:COMBAT_FEEDBACK_LIMITS,puffs:puffs.info(),flecks:flecks.info(),lastImpact,drawCalls:puffs.info().drawCalls+flecks.info().drawCalls,decals:0,shadowCastingObjects:0,limitations:'Short analytic particles, no secondary collisions/volumetric smoke. Source-plane clipping prevents source-wall leak, not collision against adjacent geometry. Actor response is neutral fabric dust, not gore. GPU/art/performance acceptance pending.'}},
  dispose(){if(disposed)return;disposed=true;puffs.dispose();flecks.dispose();root.removeFromParent()}
 };
}
