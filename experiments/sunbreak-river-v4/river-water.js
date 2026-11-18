import {MAP,groundHeight} from './map-layout.js';

// World-space amplitudes in metres. Positive phase speed transports each wave
// downstream (+Z); the shader and CPU checks use this same immutable spectrum.
export const FLOW_WAVES=Object.freeze([
 {kx:1.7,kz:3.8,speed:.72,amplitude:.0085,phase:.2},
 {kx:-3.1,kz:7.2,speed:.58,amplitude:.0048,phase:1.8},
 {kx:6.3,kz:11.7,speed:.64,amplitude:.0026,phase:.9},
 {kx:-12.4,kz:18.9,speed:.47,amplitude:.0012,phase:3.1}
]);
const smooth=(a,b,x)=>{const v=Math.max(0,Math.min(1,(x-a)/(b-a)));return v*v*(3-2*v)};
export function sampleRiverSurface(x,z,time=0){
 const depth=MAP.waterY-groundHeight(x,z),shore=smooth(.006,.14,depth);
 const bend=.16*Math.sin(x*1.7+z*.43)+.08*Math.sin(x*3.3-z*.74);
 const h=FLOW_WAVES.reduce((v,w)=>v+Math.sin(x*w.kx+(z+bend-time*w.speed)*w.kz+w.phase)*w.amplitude,0)*shore;
 return{height:MAP.waterY+h,depth,wet:depth>0,displacement:h};
}
const f=n=>Number(n).toFixed(5);
export const RIVER_DEPTH_GLSL=`
 float riverDepth(vec2 p){
  float ax=abs(p.x),w=3.4+.8*cos(p.y*.17)+.35*sin(p.y*.47);
  float meander=.32*sin(ax*.9)+.14*sin(ax*2.8);
  float ford=min(abs(p.y+23.-meander),abs(p.y-15.-meander));
  float ft=clamp((ford-1.2)/1.8,0.,1.),bt=clamp((ax-w+1.1)/2.9,0.,1.);
  return -.18+.58*(1.-bt*bt*(3.-2.*bt))*ft*ft*(3.-2.*ft);
 }
 float flowHeight(vec2 p,float t){
  float bend=.16*sin(p.x*1.7+p.y*.43)+.08*sin(p.x*3.3-p.y*.74);
  return (${FLOW_WAVES.map(w=>`sin(p.x*${f(w.kx)}+(p.y+bend-t*${f(w.speed)})*${f(w.kz)}+${f(w.phase)})*${f(w.amplitude)}`).join('+')})*smoothstep(.006,.14,riverDepth(p));
 }
`;

export function buildRiverWater({T,Reflector,world,time,rain,sunDirection}){
 // ~11cm tessellation: silhouette is genuinely moving, not a flat normal map.
 const geometry=new T.PlaneGeometry(14,160,128,1400);
 const mesh=new Reflector(geometry,{textureWidth:1024,textureHeight:576,color:0xffffff,clipBias:.004});
 mesh.name='shallow directional river';mesh.rotation.x=-Math.PI/2;mesh.position.y=MAP.waterY;
 const material=mesh.material;material.transparent=true;material.depthWrite=false;
 material.uniforms.uTime=time;material.uniforms.uRain=rain;
 material.uniforms.uSun={value:sunDirection};material.uniforms.uDay={value:1};
 material.vertexShader=`
  uniform mat4 textureMatrix;uniform float uTime;
  varying vec4 vUv;varying vec3 vRiver;varying vec2 vReflectX;varying vec2 vReflectZ;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  ${RIVER_DEPTH_GLSL}
  void main(){
   vec3 displaced=position;
   vec3 base=(modelMatrix*vec4(position,1.)).xyz;
   displaced.z+=flowHeight(base.xz,uTime);
   vRiver=(modelMatrix*vec4(displaced,1.)).xyz;
   vUv=textureMatrix*vec4(displaced,1.);
   vec4 projectedX=textureMatrix*vec4(displaced+vec3(1,0,0),1.);
   vec4 projectedZ=textureMatrix*vec4(displaced+vec3(0,-1,0),1.);
   vReflectX=projectedX.xy/projectedX.w-vUv.xy/vUv.w;
   vReflectZ=projectedZ.xy/projectedZ.w-vUv.xy/vUv.w;
   gl_Position=projectionMatrix*modelViewMatrix*vec4(displaced,1.);
   #include <logdepthbuf_vertex>
  }
 `;
 material.fragmentShader=`
  uniform sampler2D tDiffuse;uniform float uTime;uniform float uRain;
  uniform vec3 uSun;uniform float uDay;
  varying vec4 vUv;varying vec3 vRiver;varying vec2 vReflectX;varying vec2 vReflectZ;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  ${RIVER_DEPTH_GLSL}
  float flowHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float flowNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(flowHash(i),flowHash(i+vec2(1,0)),f.x),mix(flowHash(i+vec2(0,1)),flowHash(i+1.),f.x),f.y);}
  float ringHeight(vec2 p,float scale){
   vec2 q=p*scale,id=floor(q),f=fract(q)-.5;
   float t=fract(uTime*(.7+flowHash(id)*.8)+flowHash(id+1.)),d=length(f);
   return sin((d-t*.65)*70.)*exp(-abs(d-t*.65)*35.)*(1.-t)*smoothstep(.03,.12,t)*.001;
  }
  float surfaceHeight(vec2 p){return flowHeight(p,uTime)+(ringHeight(p,1.6)+ringHeight(p+19.,3.3)*.5)*uRain;}
  void main(){
   #include <logdepthbuf_fragment>
   vec2 p=vRiver.xz;float depth=riverDepth(p);
   float edge=smoothstep(.001,.038,depth);if(edge<.005)discard;
   // Derivatives of the SAME displacement function, including shore damping.
   vec2 slope=vec2(surfaceHeight(p+vec2(.018,0))-surfaceHeight(p-vec2(.018,0)),surfaceHeight(p+vec2(0,.018))-surfaceHeight(p-vec2(0,.018)))/.036;
   vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
   vec3 viewDir=normalize(cameraPosition-vRiver);
   float facing=max(.001,dot(normal,viewDir));
   float fresnel=.025+.72*pow(1.-facing,5.);
   vec2 reflectX=vReflectX/max(length(vReflectX),.00001),reflectZ=vReflectZ/max(length(vReflectZ),.00001);
   vec2 reflectedUV=clamp(vUv.xy/vUv.w+(reflectX*slope.x+reflectZ*slope.y)*.045*smoothstep(.015,.15,depth),vec2(.002),vec2(.998));
   float blur=.0017+length(slope)*.008;
   // Bounded multi-tap rough reflection; no sharp, intact mountain duplicate.
   vec3 reflected=texture2D(tDiffuse,reflectedUV).rgb*.36;
   reflected+=texture2D(tDiffuse,reflectedUV+vec2(blur,0)).rgb*.16;
   reflected+=texture2D(tDiffuse,reflectedUV-vec2(blur,0)).rgb*.16;
   reflected+=texture2D(tDiffuse,reflectedUV+vec2(0,blur)).rgb*.16;
   reflected+=texture2D(tDiffuse,reflectedUV-vec2(0,blur)).rgb*.16;
   float absorption=1.-exp(-max(0.,depth)*1.45);
   float opacity=fresnel+absorption*(1.-fresnel);
   vec3 scatter=mix(vec3(.025,.055,.06),vec3(.035,.075,.087),uDay);
   vec3 water=(reflected*fresnel+scatter*absorption*(1.-fresnel))/max(.001,opacity);
   // Sparse advected aeration at the shallow ford approaches, never a solid
   // white bank contour. Both the long ripples and foam move downstream.
   vec2 advected=vec2(p.x,p.y-uTime*.66);
   float lace=flowNoise(advected*vec2(4.8,1.1)+vec2(flowNoise(advected*.8)*1.6,0.));
   float riffle=(1.-smoothstep(.06,.22,depth))*smoothstep(.025,.06,depth);
   float foam=smoothstep(.79,.93,lace)*riffle*.30;
   float glint=pow(max(0.,dot(normal,normalize(viewDir+uSun))),480.)*uDay*.65;
   water=mix(water,vec3(.66,.72,.71),foam)+glint;
   gl_FragColor=vec4(water,edge*clamp(opacity+foam,0.,.86));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }
 `;
 let frame=0,reflectedFrame=-1;
 const reflect=mesh.onBeforeRender;
 mesh.onBeforeRender=function(renderer,scene,camera){
  if(scene.overrideMaterial||reflectedFrame===frame)return;
  reflectedFrame=frame;return reflect.call(this,renderer,scene,camera);
 };
 world.add(mesh);
 return{mesh,beginFrame(){frame++},setDay(day){material.uniforms.uDay.value=day?1:0},info(){return{
  revision:'reference-shallow-flow-v1',flowDirection:[0,1],waveCount:FLOW_WAVES.length,
  maxDisplacement:FLOW_WAVES.reduce((n,w)=>n+w.amplitude,0),triangles:geometry.index.count/3,
  depthSource:'same analytic groundHeight and ford masks; geometry unchanged',
  reflectionSize:[1024,576],reflectionSamples:5,time:time.value,day:material.uniforms.uDay.value,
  limitations:'Analytic shallow-water surface; no fluid simulation or Unreal rendering.'
 }}};
}
