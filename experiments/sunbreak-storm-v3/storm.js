import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createStormAudio} from './storm-audio.js';

// Presentation only. No combat RNG, proxy registration, game-state mutation or
// physics. All random streams and visual clocks belong to this layer.
export async function installStorm(c){
 const {T,scene,cam,rnd,gscene,world,materials,groundMat,wetMap,wetCanvas,wetStrength,reflection,skyMaterial,atmosphere,hdrSky,sun,amb,weaponKeys,weaponHemi,practicals,lampGlass,facadeMaterials,windTrees,rainMaterial,composer,grade}=c;
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 const group=new T.Group();group.name='storm-v3-decorative-only';world.add(group);
 let seed=0x71398b;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 let elapsed=0,flash=0,flashes=0,weather=2,style=0,post=true;
 let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const clocks={time:{value:0},rain:{value:1},flash:{value:0}};
 const ambientAudio=createStormAudio();
 const info={engine:'Three.js r160 / WebGL2 rasterization',lumen:false,rayTracing:false,nanite:false,
  ground:'Poly Haven asphalt_02, 2K albedo / OpenGL normal / roughness',
  sky:'Poly Haven approaching_storm, HDR photograph + moving procedural density',
  interiors:'parallax room shading behind glazing, decorative non-enterable buildings',
  lightning:'bounded slow single events; reduced-flash switch disables bolt and light pulse',
  weaponAudio:'preserved CC0 recorded AR-15/M4 clips; not an SMG field recording',
  environmentAudio:'independently synthesized rain/wind/thunder, not field recordings'};

 // One noisy height/depression field shared by wet shading and reflected water.
 // Broad water basins are irregular; aggregate stays readable between them.
 const wc=wetCanvas.getContext('2d'),size=wetCanvas.width,img=wc.createImageData(size,size);
 const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
 function noise(x,y,s){const ix=Math.floor(x/s),iy=Math.floor(y/s),fx=x/s-ix,fy=y/s-iy,a=fx*fx*(3-2*fx),b=fy*fy*(3-2*fy);return T.MathUtils.lerp(T.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),a),T.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),a),b)}
 const basins=[[-3,7,5,2.1],[4,1,3.8,5],[-6,-6,4,2.8],[7,11,4,1.7],[1,-16,4.4,3],[-12,13,3,2],[12,-4,3.3,2.7],[-9,-21,4,2],[0,-2,2.6,2.7],[1,16,9,2]];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const px=x/size*140-70,pz=y/size*140-70;
  let basin=0;for(const [bx,bz,rx,rz]of basins){const d=((px-bx)/rx)**2+((pz-bz)/rz)**2;if(d<3)basin=Math.max(basin,Math.exp(-d*.88))}
  const n=noise(x,y,63)*.4+noise(x,y,19)*.35+noise(x,y,5)*.25;
  const wet=T.MathUtils.clamp(basin*.98+(n-.5)*.48,0,1)*255,i=(y*size+x)*4;
  img.data.set([wet,wet,wet,255],i);
 }
 wc.putImageData(img,0,0);wetMap.needsUpdate=true;
 const rippleGLSL=`
 float rhash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 vec2 rainGradient(vec2 p,float t){
  vec2 cell=floor(p),f=fract(p),sum=vec2(0.);
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
   vec2 offset=vec2(float(i),float(j)),id=cell+offset;
   float h=rhash(id),phase=fract(t*.73+h*9.);
   vec2 d=f-offset-vec2(.16+.68*h,.16+.68*rhash(id+7.));
   float r=length(d),radius=phase*.44;
   float ring=sin((r-radius)*112.)*exp(-abs(r-radius)*43.)*pow(1.-phase,2.);
   sum+=d/(r+.001)*ring;
  }return sum;
 }`;
 groundMat.roughness=.62;groundMat.metalness=0;groundMat.color.set(0xb4bcc0);
 groundMat.normalScale.set(.58,.58);groundMat.envMapIntensity=.38;
 groundMat.onBeforeCompile=shader=>{
  shader.uniforms.uWetMap={value:wetMap};shader.uniforms.uWetStrength=wetStrength;
  shader.uniforms.stormTime=clocks.time;shader.uniforms.stormRain=clocks.rain;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vStormWorld;')
   .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvStormWorld=(modelMatrix*vec4(position,1.)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vStormWorld;uniform sampler2D uWetMap;uniform float uWetStrength,stormTime,stormRain;
   ${rippleGLSL}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    float water=texture2D(uWetMap,(vStormWorld.xz+70.)/140.).r;
    diffuseColor.rgb*=mix(.70,.31,smoothstep(.12,.8,water)*uWetStrength);`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float basin=texture2D(uWetMap,(vStormWorld.xz+70.)/140.).r;
    roughnessFactor=mix(max(.40,roughnessFactor),.075,smoothstep(.34,.82,basin)*uWetStrength);`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    vec2 ripple=rainGradient(vStormWorld.xz*1.6,stormTime)*stormRain;
    float pool=smoothstep(.36,.80,texture2D(uWetMap,(vStormWorld.xz+70.)/140.).r);
    normal=normalize(mix(normal,nonPerturbedNormal,pool*.9)+mat3(viewMatrix)*vec3(ripple.x,0.,ripple.y)*pool*.075);`);
 };
 groundMat.customProgramCacheKey=()=> 'storm-asphalt-v3-1';groundMat.needsUpdate=true;
 const rm=reflection.material;
 rm.uniforms.stormTime=clocks.time;rm.uniforms.stormRain=clocks.rain;
 rm.fragmentShader=rm.fragmentShader
  .replace('void main()',`${rippleGLSL}\nuniform float stormTime,stormRain;\nvoid main()`)
  .replace('smoothstep(.55,.83,basin-edgeNoise)','smoothstep(.36,.79,basin-edgeNoise*.6)')
  .replace('vec4 base=texture2DProj(tDiffuse,uv);',`vec2 ripples=rainGradient(groundPosition.xz*1.6,stormTime)*stormRain;
   uv.xy+=ripples*.00075*uv.w;
   vec4 base=texture2DProj(tDiffuse,uv);`)
  .replace('base.rgb*vec3(.72,.76,.75)','base.rgb*vec3(.67,.75,.79)');
 rm.needsUpdate=true;

 // Lit rooms have view-dependent depth behind glazing rather than flat yellow
 // rectangles. This is parallax shading, not new rooms in the physics world.
 const whiteMap=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);whiteMap.needsUpdate=true;
 materials.glass.map=whiteMap;materials.glass.color.set(0xffffff);
 materials.glass.roughness=.44;materials.glass.metalness=0;
 materials.glass.envMapIntensity=.15;materials.glass.clearcoat=.08;
 materials.glass.specularIntensity=.20;
 materials.glass.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRoomWorld,vRoomNormal;')
   .replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
    vRoomWorld=(modelMatrix*vec4(position,1.)).xyz;vRoomNormal=normalize(mat3(modelMatrix)*normal);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vRoomWorld,vRoomNormal;
   float roomHash(vec2 p){return fract(sin(dot(p,vec2(27.17,91.32)))*43758.5453);}
   vec3 interior(vec2 uv){
    vec3 n=normalize(vRoomNormal),right=normalize(cross(vec3(0.,1.,.001),n)),up=cross(n,right);
    vec3 ray=normalize(vRoomWorld-cameraPosition);
    vec3 rd=vec3(dot(ray,right),dot(ray,up),-dot(ray,n));
    rd.z=max(.08,abs(rd.z));
    vec3 ro=vec3((uv-.5)*vec2(2.4,2.5),0.);
    vec3 farPlane=vec3(rd.x>0.?1.6:-1.6,rd.y>0.?1.4:-1.4,3.4);
    vec3 distances=(farPlane-ro)/rd;float t=min(distances.x,min(distances.y,distances.z));
    vec3 p=ro+rd*t;float lamp=1./(1.+dot(p-vec3(.1,.7,1.6),p-vec3(.1,.7,1.6))*.27);
    vec3 col=vec3(.29,.15,.065);
    if(distances.y<distances.x&&distances.y<distances.z){
     if(rd.y<0.){float boards=step(.05,fract(p.x*2.5));col=vec3(.19,.105,.048)*mix(.52,1.,boards);}
     else col=vec3(.39,.29,.17);
    }else if(distances.z<=distances.x){
     col=vec3(.34,.19,.082);
     float panel=step(abs(p.x-.35),.55)*step(abs(p.y-.15),.48);
     float frame=step(abs(p.x-.35),.60)*step(abs(p.y-.15),.54);
     col=mix(col,vec3(.13,.078,.043),frame);col=mix(col,vec3(.20,.17,.105),panel);
     float cabinet=step(p.y,-.63)*step(abs(p.x+.5),.78);col=mix(col,vec3(.13,.072,.034),cabinet);
    }
    float curtain=smoothstep(.71,.98,abs(uv.x*2.-1.));
    col=mix(col,vec3(.21,.15,.09)*(.75+.25*sin(uv.x*130.)),curtain*.85);
    return col*(.65+lamp*1.5);
   }`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 room=interior(vMapUv);diffuseColor.rgb=vec3(.008);`)
   .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    totalEmissiveRadiance+=interior(vMapUv)*.55;`);
 };
 materials.glass.customProgramCacheKey=()=> 'storm-parallax-room-v3-1';materials.glass.needsUpdate=true;

 // Warm lamps are physically attenuated lights; their pools hit masonry,
 // window reveals, ground and reflected geometry, not screen-space painted glows.
 const roomLights=[];
 for(const [x,z,w,d,h,ry]of [[-13,-16,9,7,4.2,0],[12,-18,8,8,5.2,0],[-21,4,7,11,4.6,Math.PI/2],[20,6,8,10,4,0],[-4,-27,11,6,3.6,0]]){
  const house=new T.Group();house.position.set(x,0,z);house.rotation.y=ry;group.add(house);
  for(const side of [-1,1]){
   const light=new T.PointLight(side<0?0xffbc74:0xffce8d,20,9,2);light.position.set(side*w*.29,h*.6-.30,d/2+.65);house.add(light);roomLights.push(light);
   const frame=new T.Mesh(new T.BoxGeometry(.18,.29,.16),new T.MeshStandardMaterial({color:0x282b29,metalness:.72,roughness:.43}));frame.position.set(side*(w*.5-.50),2.35,d/2+.16);house.add(frame);
   const bulb=new T.Mesh(new T.SphereGeometry(.062,12,8),new T.MeshStandardMaterial({color:0xffd9a6,emissive:0xffb36c,emissiveIntensity:3,roughness:.3}));bulb.position.copy(frame.position);bulb.position.z+=.10;house.add(bulb);
  }
 }
 practicals.forEach(l=>{l.intensity=90;l.distance=14});
 lampGlass.emissiveIntensity=3.5;
 for(const m of facadeMaterials){m.roughness=.78;m.envMapIntensity=.28;m.normalScale.set(.32,.32)}
 materials.roof.roughness=.62;materials.roof.envMapIntensity=.4;
 materials.leaf.roughness=.46;materials.leaf.envMapIntensity=.36;

 // Photographic cloud structure with restrained advecting density. HDR is also
 // the actual environment-lighting source, so surfaces and sky share a climate.
 skyMaterial.uniforms.uStormHDR={value:hdrSky||whiteMap};
 skyMaterial.uniforms.uHasHDR={value:hdrSky?1:0};
 skyMaterial.uniforms.uStormTime=clocks.time;skyMaterial.uniforms.uFlash=clocks.flash;
 skyMaterial.uniforms.uStormDim={value:.52};
 skyMaterial.fragmentShader=`
 varying vec3 vDirection;uniform vec3 uSky,uHorizon;uniform sampler2D uStormHDR;
 uniform float uCloud,uHasHDR,uStormTime,uFlash,uStormDim;
 float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1.,0.)),f.x),mix(hsh(i+vec2(0.,1.)),hsh(i+1.),f.x),f.y);}
 float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*n(p);p=p*2.04+vec2(8.1,5.7);a*=.49;}return f;}
 void main(){
  vec3 d=normalize(vDirection);float h=max(d.y,0.);
  vec2 uv=vec2(atan(d.z,d.x)*.159154943+.5,asin(clamp(d.y,-1.,1.))*.318309886+.5);
  uv.x+=uStormTime*.00035;
  vec2 q=d.xz/(.22+max(.04,d.y))*.75+vec2(uStormTime*.006,-uStormTime*.002);
  float density=fbm(q+fbm(q*.56)*1.7);
  vec3 photo=texture2D(uStormHDR,uv).rgb;
  photo=mix(vec3(dot(photo,vec3(.2126,.7152,.0722))),photo,.12);
  vec3 base=mix(uHorizon,uSky,pow(h,.38));
  base=mix(base,photo*vec3(.30,.35,.42),uHasHDR*.78);
  base*=mix(.30,1.06,smoothstep(.20,.75,density))*uStormDim;
  base=mix(base,uHorizon,(1.-smoothstep(-.01,.18,h))*.3);
  base+=uFlash*vec3(.12,.16,.23)*(.25+.75*density);
  gl_FragColor=vec4(base,1.);
 }`;
 skyMaterial.needsUpdate=true;atmosphere.frustumCulled=false;
 scene.background=new T.Color(0x25333e);
 for(const m of Object.values(materials))m.envMapIntensity=Math.min(m.envMapIntensity??.4,.4);
 gscene.environment=scene.environment;
 sun.shadow.mapSize.set(2048,2048);
 sun.shadow.normalBias=.016;sun.shadow.bias=-.00008;
 rainMaterial.color.set(0x9badb8);rainMaterial.opacity=.27;
 rainMaterial.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float rainDistance;')
   .replace('#include <project_vertex>','#include <project_vertex>\nrainDistance=length(mvPosition.xyz);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float rainDistance;')
   .replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.a*=smoothstep(.55,2.5,rainDistance)*(1.-smoothstep(17.,34.,rainDistance));');
 };
 rainMaterial.needsUpdate=true;

 // Small airborne / ground splashes. Their own clock freezes in presentation.
 const splashPositions=[],splashUV=[],splashPhase=[];
 for(let i=0;i<240;i++){
  const x=rand()*62-31,z=rand()*55-31,s=.035+rand()*.07,ph=rand();
  for(const [dx,dz,u,v]of [[-s,-s,0,0],[s,-s,1,0],[s,s,1,1],[-s,-s,0,0],[s,s,1,1],[-s,s,0,1]]){
   splashPositions.push(x+dx,.032,z+dz);splashUV.push(u,v);splashPhase.push(ph);
  }
 }
 const splashGeo=new T.BufferGeometry();splashGeo.setAttribute('position',new T.Float32BufferAttribute(splashPositions,3));splashGeo.setAttribute('uv',new T.Float32BufferAttribute(splashUV,2));splashGeo.setAttribute('phase',new T.Float32BufferAttribute(splashPhase,1));
 const splashMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{uTime:clocks.time,uRain:clocks.rain},
  vertexShader:'attribute float phase;varying vec2 vUv;varying float vPhase;void main(){vUv=uv;vPhase=phase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform float uTime,uRain;varying vec2 vUv;varying float vPhase;void main(){float t=fract(uTime*1.4+vPhase*13.);float r=length(vUv-.5)*2.;float a=exp(-abs(r-t*.9)*45.)*pow(1.-t,2.)*.23*uRain;gl_FragColor=vec4(.42,.53,.58,a);}'});
 group.add(new T.Mesh(splashGeo,splashMaterial));

 // Plant tufts grow at footings and drainage, not in the original firing lanes.
 const grasses=[],green=new T.Color(0x586d43),brown=new T.Color(0x4f5335);
 const plantPositions=[],plantColors=[],plantUV=[];
 for(let i=0;i<1600;i++){
  const x=(i%2?-17.4:16.4)+(rand()-.5)*.55,z=-30+rand()*44;
  const height=.09+rand()*.35,width=.008+rand()*.017,ang=rand()*Math.PI*2,lean=.03+rand()*.10;
  for(let side=0;side<2;side++){
   const a=ang+side*Math.PI*.5,dx=Math.cos(a)*width,dz=Math.sin(a)*width,col=green.clone().lerp(brown,rand());
   const points=[[x-dx,.018,z-dz,0,0],[x+dx,.018,z+dz,1,0],[x+dx*.5+lean*.4,height*.56,z+dz*.5,1,.56],[x-dx,.018,z-dz,0,0],[x+dx*.5+lean*.4,height*.56,z+dz*.5,1,.56],[x+lean,height,z+.02,.5,1]];
   for(const [px,py,pz,u,v]of points){plantPositions.push(px,py,pz);col.clone().multiplyScalar(.55+v*.5).toArray(plantColors,plantColors.length);plantUV.push(u,v)}
  }
 }
 const grassGeo=new T.BufferGeometry();grassGeo.setAttribute('position',new T.Float32BufferAttribute(plantPositions,3));grassGeo.setAttribute('color',new T.Float32BufferAttribute(plantColors,3));grassGeo.setAttribute('uv',new T.Float32BufferAttribute(plantUV,2));grassGeo.computeVertexNormals();
 const grassMat=new T.MeshStandardMaterial({color:0xb4c2a0,vertexColors:true,side:T.DoubleSide,roughness:.53});
 grassMat.onBeforeCompile=shader=>{shader.uniforms.stormTime=clocks.time;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float stormTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(stormTime*2.1+position.x*4.+position.z*.7)*uv.y*uv.y*.07;')};
 const grass=new T.Mesh(grassGeo,grassMat);grass.castShadow=false;grass.receiveShadow=true;grass.name='peripheral-wind-grasses';group.add(grass);
 // Fern clusters are low and close to existing solid facades.
 const fernGeos=[],fernMat=new T.MeshStandardMaterial({color:0x3c5631,roughness:.47,side:T.DoubleSide});
 for(const [x,z]of [[-16.8,-13],[-9,-19.9],[8.3,-14.2],[16.2,-20.5],[-8.8,-24],[1,-30.2],[16.1,3],[-16,8]]){
  for(let f=0;f<7;f++){
   const angle=f/7*Math.PI*2+rand()*.3,len=.35+rand()*.35;
   for(let k=1;k<10;k++)for(const s of [-1,1]){
    const t=k/10,cx=x+Math.cos(angle)*len*t,cz=z+Math.sin(angle)*len*t,cy=.07+Math.sin(t*Math.PI)*.24+.08*t;
    const w=Math.sin(t*Math.PI)*.17;
    const g=new T.BufferGeometry().setFromPoints([V(cx,cy,cz),V(cx+Math.cos(angle+Math.PI/2)*w*s,cy-.025,cz+Math.sin(angle+Math.PI/2)*w*s),V(cx+Math.cos(angle)*.095,cy+.005,cz+Math.sin(angle)*.095)]);g.computeVertexNormals();fernGeos.push(g);
   }
  }
 }
 const ferns=new T.Mesh(mergeGeometries(fernGeos),fernMat);ferns.receiveShadow=true;group.add(ferns);fernGeos.forEach(g=>g.dispose());

 // A distant bolt, not a screen-wide white flash. Event period >=18 seconds.
 const boltGeo=new T.BufferGeometry(),boltVertices=[];
 let bx=-18,by=58,bz=-88;
 for(let i=0;i<23;i++){const nx=bx+(rand()-.5)*4.1,ny=by-1.8-rand()*.5,nz=bz+(rand()-.5)*1.5;boltVertices.push(bx,by,bz,nx,ny,nz);if(i===8||i===13)boltVertices.push(nx,ny,nz,nx+4+rand()*4,ny-4,nz+1);bx=nx;by=ny;bz=nz}
 boltGeo.setAttribute('position',new T.Float32BufferAttribute(boltVertices,3));
 const boltMat=new T.LineBasicMaterial({color:0xcee2ff,transparent:true,opacity:0,depthWrite:false,toneMapped:false});
 const bolt=new T.LineSegments(boltGeo,boltMat);bolt.frustumCulled=false;group.add(bolt);
 let nextBolt=7.5,boltAge=100;
 const bloom=new UnrealBloomPass(new T.Vector2(innerWidth,innerHeight),.16,.45,1.35);
 composer.insertPass(bloom,2);
 grade.material.fragmentShader=`uniform sampler2D tDiffuse;varying vec2 vUv;
 void main(){
  vec3 c=texture2D(tDiffuse,vUv).rgb;
  float l=dot(c,vec3(.2126,.7152,.0722));
  c=mix(vec3(l),c,.86);
  c*=mix(vec3(.92,.98,1.045),vec3(1.025,1.005,.96),smoothstep(.15,.9,l));
  float vignette=smoothstep(.82,.22,distance(vUv,vec2(.5)));
  c*=mix(.93,1.,vignette);
  gl_FragColor=vec4(c,1.);
 }`;grade.material.needsUpdate=true;
 const controls=document.getElementById('stormControls');
 for(const event of ['pointerdown','mousedown','click','keydown'])controls?.addEventListener(event,e=>e.stopPropagation());
 document.getElementById('bPost')?.addEventListener('click',()=>{post=!post;bloom.enabled=grade.enabled=post;document.getElementById('bPost').textContent=post?'后期：开':'后期：关';document.getElementById('bPost').setAttribute('aria-pressed',String(post))});
 document.getElementById('bFlash')?.addEventListener('click',()=>{reduced=!reduced;if(reduced){boltAge=100;flash=0}refreshFlash()});
 function refreshFlash(){const e=document.getElementById('bFlash');if(e){e.textContent=reduced?'闪电：关闭':'闪电：开启';e.setAttribute('aria-pressed',String(!reduced))}}
 refreshFlash();
 function setWeather(w,s){
  weather=w;style=s;const rainy=w===2,night=s===0,dayDiagnostic=w===0;
  const strength=dayDiagnostic?1:night?.38:.67;
  sun.position.set(-32,42,22);sun.color.set(dayDiagnostic?0xd1d7dc:0xa7c1d8);sun.intensity=dayDiagnostic?1.65:night?.45:.75;
  amb.color.set(dayDiagnostic?0xb9c7d1:0x8aa8bd);amb.groundColor.set(0x3d423c);amb.intensity=dayDiagnostic?.73:night?.65:.86;
  scene.fog=new T.Fog(dayDiagnostic?0x71838d:night?0x303f48:0x536670,35,dayDiagnostic?175:132);
  atmosphere.visible=true;scene.background=new T.Color(0x303f48);
  skyMaterial.uniforms.uSky.value.set(dayDiagnostic?0x687f8d:night?0x273743:0x415865);
  skyMaterial.uniforms.uHorizon.value.set(dayDiagnostic?0x7f939d:night?0x465761:0x677b83);
  skyMaterial.uniforms.uStormDim.value=dayDiagnostic?.86:night?.52:.70;
  wetStrength.value=rainy?1:.88;clocks.rain.value=rainy?1:0;
  reflection.material.uniforms.wetness.value=rainy?.96:.81;
  for(const m of Object.values(materials))m.envMapIntensity=dayDiagnostic?.38:night?.16:.24;
  groundMat.envMapIntensity=dayDiagnostic?.35:night?.16:.23;
  if(weaponKeys[0]){weaponKeys[0].color.set(dayDiagnostic?0xcbd6dd:0x91b0c7);weaponKeys[0].intensity=dayDiagnostic?2:night?.95:1.35}
  if(weaponKeys[1]){weaponKeys[1].color.set(0xffc99b);weaponKeys[1].intensity=night?.25:.18}
  if(weaponHemi){weaponHemi.color.set(0xa3b8c8);weaponHemi.groundColor.set(0x292f2d);weaponHemi.intensity=night?.43:.60}
  roomLights.forEach(l=>l.intensity=dayDiagnostic?8:night?12:10);practicals.forEach(l=>l.intensity=dayDiagnostic?25:night?72:50);
  lampGlass.emissiveIntensity=dayDiagnostic?1.2:3.5;
  rnd.toneMappingExposure=dayDiagnostic?1.05:night?1.14:1.08;
  document.getElementById('weatherName').textContent=['雨歇 · 材质校验','阴天 · 潮湿旧城','暴雨 · 闪电'][w];
  document.getElementById('styleName').textContent=night?'STORM / 冷夜':'STORM / 蓝调黎明';
 }
 return{
  setWeather,
  unlockAudio(){ambientAudio.unlock()},
  update(dt,{live,pres}){
   if(!pres){elapsed+=dt;clocks.time.value=elapsed;
    if(weather===2&&elapsed>nextBolt){nextBolt=elapsed+18+rand()*11;boltAge=0;if(!reduced){flashes++;ambientAudio.thunder(live)}}
    boltAge+=dt;
   }
   flash=weather===2&&!reduced?Math.exp(-Math.max(0,boltAge-.15)*3.6)*Math.min(1,boltAge/.18):0;
   clocks.flash.value=flash;boltMat.opacity=flash*.84;
   // Restore base light every frame so flashes never accumulate energy.
   const day=weather===0,night=style===0;
   sun.intensity=(day?1.65:night?.45:.75)+flash*.85;
   amb.intensity=(day?.73:night?.65:.86)+flash*.32;
   if(weaponKeys[0])weaponKeys[0].intensity=(day?2:night?.95:1.35)+flash*.55;
   for(const t of windTrees)if(!pres)t.crown.rotation.z+=Math.sin(elapsed*1.5+t.phase)*.006;
   const muted=document.getElementById('bMute')?.getAttribute('aria-pressed')==='true';
   const volume=Number(document.getElementById('soundVolume')?.value??65)/100;
   ambientAudio.update(live&&weather===2&&!pres,muted,volume);
  },
  info(){return{...info,elapsed,flashes,flash,reducedFlash:reduced,post,interiorLights:roomLights.length,practicalLights:practicals.length,grassTufts:1600,fernClusters:8,ambientAudio:ambientAudio.info()}}
 };
}
