// Visual-only authoritative hit feedback. No weapon cadence, damage, raycasts,
// invented hit endpoints, source mesh mutations, textures or persistent decals.
export const COMBAT_FEEDBACK_LIMITS=Object.freeze({puffs:120,flecks:80,marks:48,drawCalls:2,triangles:400,maxLifetime:1,markLifetime:1,surfaceOffset:.008,markOffset:.026,decals:0,shadowLights:0});
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
attribute vec3 fxTangent;
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
 // Modes >=4 are surface-plane marks: quad lies in the stored tangent frame.
 if(fxShape.w>3.5){right=fxTangent;up=cross(fxNormal,fxTangent);}
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
 vec3 col=vFxColor;float s=fract(vFxShape.w)*2.;
 if(vFxShape.w<.5){
  float noise=sin(vFxUv.x*13.+sin(vFxUv.y*9.))*sin(vFxUv.y*11.+vFxUv.x*4.);
  a=(1.-smoothstep(.08,.50,r+noise*.025));a*=a;
 }else if(vFxShape.w<1.5){
  // Tiny irregular chip silhouette, not a large opaque square.
  a=step(-.43,vFxUv.y)*step(vFxUv.y,.42)*step(abs(vFxUv.x),(.5-vFxUv.y)*.57);
 }else if(vFxShape.w<2.5){
  a=(1.-smoothstep(.10,.48,abs(vFxUv.x)))*(1.-smoothstep(.18,.5,abs(vFxUv.y)));
 }else if(vFxShape.w<3.5){
  // water transients, sub-shape from the per-particle fraction (all <3.5): <.1 droplet, .12-.24 jet, .3-.46 crown sheet
  float f=fract(vFxShape.w);
  if(f<.1){
   float dl=clamp(.5+(vFxUv.y-vFxUv.x)*1.4,0.,1.);
   a=1.-smoothstep(.12,.5,length(vFxUv*vec2(1.,.8+.4*step(0.,vFxUv.y))));
   col=mix(col*.8,vec3(.88,.93,.95),dl*.55);
  }else if(f<.27){
   // skinny tapered jet that breaks into beads toward its tip
   float j=(f-.12)/.12,y=vFxUv.y+.5,x=vFxUv.x+.1*y*sin(y*6.+j*20.),wv=.42*(1.-.72*y);
   a=(1.-smoothstep(wv*.35,wv,abs(x)))*smoothstep(0.,.12,y)*(1.-smoothstep(.82,1.,y));
   a*=mix(1.,smoothstep(-.5,.2,sin(y*15.+j*40.)),smoothstep(.25,.9,y));
   col=mix(col*.82,vec3(.9,.94,.96),(1.-smoothstep(0.,wv*.6,abs(x+wv*.25)))*.6);
  }else{
   // asymmetric flared crown: upper half of quad only, leaning, ragged torn top, translucent body with lit rim
   float c=clamp((f-.3)/.16,0.,1.),h=vFxUv.y*2.,x=vFxUv.x*2.-(c-.5)*.5*h;
   float hw=.16+.62*h*(1.-.35*h);
   float top=clamp(.66+.18*sin(x*9.+c*31.)+.12*sin(x*23.-c*17.)+(c-.5)*.7*x,.2,1.);
   float body=smoothstep(0.,.06,h)*(1.-smoothstep(top-.14,top,h))*(1.-smoothstep(hw-.1,hw,abs(x)));
   body*=mix(1.,smoothstep(-.3,.4,sin(x*33.+c*50.)),smoothstep(.45,.95,h/top));
   float rim=clamp(smoothstep(hw-.3,hw-.04,abs(x))+smoothstep(top-.34,top-.06,h),0.,1.);
   a=body*mix(.42,1.,rim);col=mix(col*.8,vec3(.88,.93,.96),rim*(.35+.3*clamp(.5-x,0.,1.)));
  }
 }
 else{
  float ang=atan(vFxUv.y,vFxUv.x+1e-5);
  if(vFxShape.w<4.5){
   // water: thin expanding ring plus faint inner ripple
   float rpW=fwidth(r)*1.5;float rpR=r*(1.+.035*sin(ang*3.+s*17.)+.02*sin(ang*7.-s*29.));a=smoothstep(.335-rpW,.350+rpW,rpR)*(1.-smoothstep(.365-rpW,.385+rpW,rpR))+.35*smoothstep(.155-rpW,.165+rpW,rpR)*(1.-smoothstep(.175-rpW,.190+rpW,rpR));
   a*=smoothstep(-.35,.25,sin(ang*3.+s*40.)+.5*sin(ang*5.-s*23.));float rpL=.5+.5*cos(ang-.9);a*=.32*mix(.3,1.,rpL*rpL);
  }else if(vFxShape.w<5.5){
   // soil: uneven dark crater with broken raised rim
   float rr=r*(1.+.22*sin(ang*3.+s*40.)+.12*sin(ang*7.+s*90.));
   float core=1.-smoothstep(.13,.23,rr);
   float rim=smoothstep(.2,.27,rr)*(1.-smoothstep(.31,.46,rr))*(.6+.4*sin(ang*5.+s*70.));
   col=mix(vFxColor*1.7,vFxColor*.45,core);a=max(core*.95,rim*.7);
  }else if(vFxShape.w<6.5){
   // wood: small dark hole with pale fibrous splinters along the tangent
   vec2 q=vFxUv-vec2(fract(sin(s*91.7)*43758.5)-.5,fract(sin(s*37.3+1.7)*24634.6)-.5)*vec2(.06,.1);
   float aw=fwidth(vFxUv.y)*1.5;
   // wood v2: off-centre split, interrupted dull heartwood edge, 1-2 unequal tapered fibres. Per-impact seeded, non-emissive.
   {
    float e=aw+1e-4,ha=fract(sin(s*57.)*43758.5),hb=fract(sin(s*113.)*24634.6),hc=fract(sin(s*71.)*35311.7);
    vec2 p=vec2(q.x*3.2*(ha<.5?-1.:1.),q.y*(hb<.5?-1.:1.));
    float pit=1.-smoothstep(.07,.095+e,length(p+vec2(.06,0.))*(1.+.3*sin(atan(p.y,p.x+.06001)*3.+s*40.)));
    float t=(p.x+.16)/.38,dy=p.y-.022*sin(p.x*17.+s*30.),w=.045*min(t*4.,1.)*(1.-.8*t);
    float split=smoothstep(0.,.08,t)*(1.-smoothstep(.9,1.,t))*(1.-smoothstep(w-e,w+e,abs(dy)));
    float hh=.12*smoothstep(.1,.3,t)*(1.-smoothstep(.55,.92,t))*(.78+.22*sin(p.x*41.+s*60.));
    float heart=smoothstep(.015,.05,hh)*smoothstep(.03,.07,abs(t-.42-.2*hc))*smoothstep(-e,e,dy-w*.5)*(1.-smoothstep(hh-e,hh+e,dy-w));
    float u=(p.x-.02)/(.2+.06*hc),v=(-.04-p.x)/.13;
    float f1=smoothstep(0.,.08,u)*(1.-smoothstep(.8,1.,u))*(1.-smoothstep(-e,e,abs(p.y+.03+u*u*.13)-.034*(1.-u)));
    float f2=step(.35,hc)*smoothstep(0.,.1,v)*(1.-smoothstep(.75,1.,v))*(1.-smoothstep(-e,e,abs(p.y+.02+v*.07)-.024*(1.-v)));
    float dark=max(max(pit,split),max(f1,f2)*.85);
    col=mix(min(vFxColor*.95,vec3(.4)),vec3(.035,.026,.018),dark);a=max(dark*.92,heart*.72);
   }
  }else{
   // stone: angular pale chip, dark pit, soft powder halo
   vec2 q=vFxUv-vec2(fract(sin(s*91.7)*43758.5)-.5,fract(sin(s*37.3+1.7)*24634.6)-.5)*.08;
   float a2=atan(q.y,q.x+1e-5);
   float rr=length(q)*(1.+.45*abs(sin(a2*1.5+s*30.))+.3*abs(sin(a2*2.5-s*47.))+.25*sin(a2+s*19.));
   float aw=fwidth(rr)*1.5;
   vec2 pq=q-vec2(cos(s*23.),sin(s*23.))*.035;
   float chip=1.-smoothstep(.2-aw,.2+aw,rr),pit=1.-smoothstep(.05,.11,length(pq)*(1.+.4*abs(sin(atan(pq.y,pq.x+1e-5)*2.5+s*61.))));
   float facet=smoothstep(.15,.19,rr)*chip*smoothstep(.2,.7,.5*sin(a2*4.+s*33.)+.5*cos(a2-s*9.));
   col=mix(mix(vec3(.05,.048,.045),vFxColor,facet*.55),vec3(.015),pit);a=max(chip*mix(.55,.45,facet),pit*.85);
  }
 }
 a*=vFxShape.z;if(a<.003)discard;
 gl_FragColor=vec4(col,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
}`;

function pool(T,root,name,capacity,additive,reserved=0){
 const geometry=new T.InstancedBufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));geometry.setIndex([0,1,2,0,2,3]);
 const attributes={};for(const [key,size]of Object.entries({fxCenter:3,fxColor:3,fxShape:4,fxContact:3,fxNormal:3,fxTangent:3})){
  const a=new T.InstancedBufferAttribute(new Float32Array(capacity*size),size);a.setUsage(T.DynamicDrawUsage);geometry.setAttribute(key,a);attributes[key]=a;
 }
 const material=new T.ShaderMaterial({name,vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:T.UniformsUtils.clone(T.UniformsLib.fog),fog:true,transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:additive?T.AdditiveBlending:T.NormalBlending});
 material.forceSinglePass=true;
 const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=false;mesh.visible=false;root.add(mesh);geometry.instanceCount=0;
 const records=Array.from({length:capacity},()=>({p:new T.Vector3(),v:new T.Vector3(),n:new T.Vector3(),t:new T.Vector3(1,0,0),contact:new T.Vector3(),color:new T.Color(),age:0,life:0,size:0,aspect:1,alpha:0,mode:0,gravity:0,drag:0,growth:0}));
 // records[0..reserved) are 1s surface marks with their own ring, so short
 // dust/chips can never recycle a mark early; both share this one draw.
 let cursor=reserved,markCursor=0,overwritten=0;
 return {records,mesh,capacity,
  take(){const p=records[cursor];cursor=cursor+1<capacity?cursor+1:reserved;if(p.life>p.age)overwritten++;return p},
  takeMark(){if(reserved<1)return this.take();const p=records[markCursor];markCursor=(markCursor+1)%reserved;if(p.life>p.age)overwritten++;return p},
  sync(){let count=0;for(const p of records){if(p.age>=p.life)continue;const t=p.age/p.life,size=p.size*(1+p.growth*t),u=Math.min(1,Math.max(0,(t-.72)/.28)),fade=p.mode>=3.5?1-u*u*(3-2*u):Math.pow(1-t,1.4);
    attributes.fxCenter.setXYZ(count,p.p.x,p.p.y,p.p.z);attributes.fxColor.setXYZ(count,p.color.r,p.color.g,p.color.b);
    attributes.fxShape.setXYZW(count,size*p.aspect,size,p.alpha*fade,p.mode);
    attributes.fxContact.setXYZ(count,p.contact.x,p.contact.y,p.contact.z);attributes.fxTangent.setXYZ(count,p.t.x,p.t.y,p.t.z);attributes.fxNormal.setXYZ(count,p.n.x,p.n.y,p.n.z);count++;
   }geometry.instanceCount=count;mesh.visible=count>0;for(const a of Object.values(attributes))a.needsUpdate=true;return count;
  },
  reset(){for(const p of records)p.age=p.life=0;cursor=reserved;markCursor=0;this.sync()},
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
 const puffs=pool(T,root,'combat-dust-smoke',COMBAT_FEEDBACK_LIMITS.puffs,false,COMBAT_FEEDBACK_LIMITS.marks),flecks=pool(T,root,'combat-chips-sparks',COMBAT_FEEDBACK_LIMITS.flecks,true);
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
  // Surface-plane marks (modes>=4): real hits only, fixed 1s life, late fade.
  if(!actor&&!metal&&tangent.lengthSq()>.5&&bitangent.lengthSq()>.5){
   const L=COMBAT_FEEDBACK_LIMITS;
   const mark=(size,color,mode,alpha,growth,aspect,spin)=>{const p=initialize(puffs.takeMark(),hit.point,hit.normal,{life:L.markLifetime,size,alpha,mode:mode+random()*.49,color,growth,aspect});
    p.p.copy(hit.point).addScaledVector(hit.normal,L.markOffset);const a=spin?random()*6.2832:0;p.t.copy(tangent).multiplyScalar(Math.cos(a)).addScaledVector(bitangent,Math.sin(a));return p};
   const bit=(o,speed)=>{const p=initialize(puffs.take(),hit.point,hit.normal,o);p.v.copy(hit.normal).multiplyScalar(speed).addScaledVector(tangent,(random()-.5)*.7).addScaledVector(bitangent,(random()-.5)*.7);return p};
   if(watery){mark(.28,0x8497a6,4,.8,2.2,1,true);mark(.16,0x8497a6,4,.6,1.6,1,true);
    // crown sheets stay anchored on the true hit; jets and droplets use the existing velocity model
    bit({life:.34,size:.9,alpha:.5,mode:3.3+random()*.16,color:0x8fa6b4,growth:.6,aspect:1},0).v.set(0,0,0);
    bit({life:.27,size:.62,alpha:.42,mode:3.3+random()*.16,color:0x9db2be,growth:.8,aspect:1.25},0).v.set(0,0,0);
    for(let i=0;i<4;i++)bit({life:.3+random()*.16,size:.2+random()*.14,alpha:.62,mode:3.12+random()*.12,color:0xa9bdc8,gravity:7+random()*3,drag:.8,aspect:.13+random()*.06},2.1+random()*1.3).v.addScaledVector(tangent,(i-1.5)*.35);
    for(let i=0;i<5;i++)bit({life:.36+random()*.26,size:.035+random()*.03,alpha:.7,mode:3,color:0xc4d4da,gravity:5+random()*5,drag:.5+random()*1.2,aspect:.8},1.2+random()*2.2).v.addScaledVector(tangent,(random()-.5)*2.2).addScaledVector(bitangent,(random()-.5)*2.2);}
   else if(hit.kind==='earth'){mark(.34,0x3a3122,5,.9,0,1,true);for(let i=0;i<4;i++)bit({life:.4+random()*.2,size:.03+random()*.025,alpha:.85,mode:1,color:0x2e281d,gravity:6,drag:1.2,aspect:.9},.9+random()*.8);}
   else if(hit.kind==='wood'){mark(.11,0x66533a,6,.8,0,3.2,false);for(let i=0;i<3;i++)bit({life:.4+random()*.2,size:.035+random()*.02,alpha:.7,mode:1,color:0x80694a,gravity:5,drag:1.5,aspect:.3},.7+random()*.7);}
   else{mark(.26,0x6f6b64,7,.8,0,1,true);bit({life:.6,size:.12,alpha:.15,mode:0,color:0x8c877d,gravity:.15,drag:3,growth:2},.25);}
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
