// Add a retained-water mask and green understory to the accepted terrain bake.
// Previous look never calls this hook; original source shader remains available.
export function installLegacyForestTint(material){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=s=>{
  before(s);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float forestCover;varying float vForestCover;').replace('#include <begin_vertex>','#include <begin_vertex>\nvForestCover=forestCover;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vForestCover;').replace('diffuseColor*=vec4(surface,1.);',`surface=mix(surface,mix(vec3(.033,.068,.013),vec3(.105,.157,.035),macro),vForestCover*(1.-vSurfaceZones.y));diffuseColor*=vec4(surface,1.);`);
 };
 material.customProgramCacheKey=()=>key()+'-afterrain-sward-v2';
}
// Shared macro basin noise. Integer lattice hash: bit-identical in JS (Math.imul)
// and GLSL ES 3.00 (uint), unlike a sin-based hash. Same two octaves, weights and
// thresholds as the previous basin, so puddle scale and coverage are retained;
// individual puddle positions move with the new hash. Requires WebGL2.
function basinHash(x,y){let h=(Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1))>>>0;h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;h=(h^(h>>>15))>>>0;return(h>>>8)/16777216;}
function basinNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=basinHash(ix,iy),b=basinHash(ix+1,iy),c=basinHash(ix,iy+1),d=basinHash(ix+1,iy+1),lo=a+(b-a)*fx,hi=c+(d-c)*fx;return lo+(hi-lo)*fy;}
export function afterRainBasin(x,z){return basinNoise(x*.34+8.3,z*.34+2.7)*.68+basinNoise(x*.97,z*.97)*.32;}
// The shader adds a texture micro-height term of at most +-.0225 and reaches a
// full puddle below .39. This CPU threshold is therefore conservative: it only
// reports the interior, never the soft shoreline.
export const AFTERRAIN_PUDDLE_INTERIOR=.3575;
export function afterRainPuddleInterior(x,z){return afterRainBasin(x,z)<AFTERRAIN_PUDDLE_INTERIOR;}
export function enhanceAfterRainGround(T,material,s,reflection){
 Object.assign(s.uniforms,reflection.uniforms);
 s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
 attribute float forestCover;varying float vForestCover;`)
 .replace('#include <begin_vertex>','#include <begin_vertex>\nvForestCover=forestCover;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
 varying float vForestCover;
 uniform sampler2D uPuddleReflection;uniform mat4 uPuddleProjection;uniform float uPuddleReflectionEnabled;
 // Analytic boot-print trail cell. t.x = metres along the trail, t.y = metres
 // across it. One print per 0.74 m stride cell, alternating left/right, with a
 // mirrored asymmetric sole (toe, waist, heel). Deterministic hashes vary
 // stride, toe-out angle, depth and partial toe-only / heel-only strikes.
 // Returns x = pressed bowl 0..1, y = raised rim 0..1, z = bowl of the
 // minority of full deep prints that may hold water. No samplers, no geometry.
 // Macro basin noise shared with the CPU classifier (see afterRainBasin in JS).
 float basinHash(vec2 c){ivec2 q=ivec2(c);uint h=(uint(q.x)*0x27d4eb2du)^(uint(q.y)*0x165667b1u);h=(h^(h>>15u))*0x2c1b3c6du;h=(h^(h>>12u))*0x297a2d39u;h^=h>>15u;return float(h>>8u)/16777216.;}
 float basinNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(basinHash(i),basinHash(i+vec2(1.,0.)),f.x),mix(basinHash(i+vec2(0.,1.)),basinHash(i+vec2(1.,1.)),f.x),f.y);}
 float bootFootprint;
 float bootHash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
 vec3 bootTrail(vec2 t,float seed){
  const float STRIDE=.74;
  float i=floor(t.x/STRIDE);
  float h1=bootHash(i+seed*17.),h2=bootHash(i*1.7+seed*5.3+9.),h3=bootHash(i*2.3+seed+41.),h4=bootHash(i*.61+seed*3.+77.);
  if(h4<.14)return vec3(0.);
  float side=mod(i,2.)*2.-1.;
  vec2 q=vec2(t.y-side*(.105+.03*(h2-.5)),t.x-(i+.5)*STRIDE-(h1-.5)*.2);
  float a=side*.13+(h3-.5)*.22;float c=cos(a),sn=sin(a);
  q=vec2(c*q.x-sn*q.y,sn*q.x+c*q.y);
  q.x*=side;
  q.x+=.016*smoothstep(-.06,.06,q.y)-.006;
  float toe=length((q-vec2(0.,.062))/vec2(.052,.088));
  float heel=length((q-vec2(.004,-.092))/vec2(.039,.05));
  float waist=length((q-vec2(.008,-.02))/vec2(.031,.07))+.1;
  float d=min(min(toe,heel),waist);
  float partial=1.;
  if(h3>.72)partial=smoothstep(-.05,.03,q.y);else if(h3<.2)partial=1.-smoothstep(-.04,.04,q.y);
  float grade=mix(.3,1.,h2)*partial;
  float press=mix(.8,1.,1.-smoothstep(-.1,.02,q.y));
  float pool=(1.-smoothstep(.55,1.,d))*grade*press;
  // Compressed toe and heel strikes sit deeper than the waist. Broken tread
  // bars fade out with the pixel footprint (computed in main, outside branches).
  float strike=max(1.-smoothstep(.15,.85,toe),1.-smoothstep(.15,.85,heel));
  float bowl=pool*mix(.74,1.,strike);
  float lug=1.-smoothstep(.45,.9,min(toe,heel));
  float bar=smoothstep(.15,.6,sin(q.y*190.+sin(q.x*48.)*1.4));
  float gap=smoothstep(-.3,.2,sin(q.x*86.+q.y*37.+h1*6.283));
  bowl*=1.-.16*bar*gap*lug*(1.-smoothstep(.004,.011,bootFootprint));
  float rim=smoothstep(.8,1.,d)*(1.-smoothstep(1.,1.4,d))*grade;
  return vec3(bowl,rim,pool*step(.8,h2)*step(.2,h3)*step(h3,.72));
 }`);
 // Terrain geometry is flat y=0 across village pads. Only those surfaces can
 // share a planar reflection. Height and slope filters exclude bank/hills.
 s.fragmentShader=s.fragmentShader.replace('float basin=macro+(microHeight-.5)*.19;',`
   float greenCover=clamp(vForestCover+(macro-.5)*.16*vForestCover*(1.-vForestCover)*4.,0.,1.)*(1.-vSurfaceZones.y);
   float plantCommunity=smoothstep(.25,.75,valleyNoise(gp*.16+vec2(31.7,8.2)));
   greenCover*=mix(.43,1.,smoothstep(.23,.63,valleyNoise(gp*.21+vec2(18.2,43.7))));
   vec3 greens=mix(vec3(.022,.056,.012),vec3(.095,.145,.029),plantCommunity);
   float leafGrain=clamp(dot(litterSample.rgb,vec3(.2126,.7152,.0722))/.045,.48,1.6)*mix(.72,1.16,smoothstep(.38,.66,litterSample.a));
   surface=mix(surface,greens*leafGrain,greenCover);
   float outerD=max(abs(gp.x)-32.,abs(gp.y+4.)-30.);
   float outerGrass=smoothstep(0.,7.,outerD)*smoothstep(.45,2.6,abs(gp.x)-(3.4+.8*cos(gp.y*.17)+.35*sin(gp.y*.47)));
   vec3 outerCol=mix(vec3(.02,.05,.022),vec3(.062,.105,.05),smoothstep(.2,.8,valleyNoise(gp*.09+vec2(5.1,27.3))))*mix(.68,1.14,valleyNoise(gp*.31+vec2(61.,13.)));
   outerCol=mix(outerCol,vec3(.03,.06,.036),smoothstep(50.,98.,outerD)*.5);
   surface=mix(surface,outerCol*leafGrain,outerGrass);
   greenCover=max(greenCover,outerGrass);
   litterBlend=max(litterBlend,greenCover);
   float basin=basinNoise(gp*.34+vec2(8.3,2.7))*.68+basinNoise(gp*.97)*.32+(microHeight-.5)*.045;
   float flatPlane=1.-smoothstep(.006,.025,abs(vGroundWorld.y));`);
 s.fragmentShader=s.fragmentShader.replace(/float puddle=\(1\.-smoothstep\(\.34,\.40,basin\)\)[^;]+;/,`
   float puddle=(1.-smoothstep(.39,.45,basin))*basinFlatness*flatPlane*(1.-vSurfaceZones.y)*(1.-vForestCover);
   float wetRim=(1.-smoothstep(.43,.58,basin))*basinFlatness*flatPlane*(1.-vSurfaceZones.y)*(1.-vForestCover);
   // Boot tracks: sinuous bank paths near x = +-6 and +-10 on both sides plus
   // three crossing approaches. Faded by the pixel footprint so distant prints
   // dissolve instead of stippling. Excluded from the river channel,
   // foundations, green cover, steep slopes and existing broad puddles.
   // Crossings follow the three real crossings at z=-23, -4 and 15.
   vec3 bootPrint=vec3(0.);
   bootFootprint=max(fwidth(gp.x),fwidth(gp.y));
   float bootFade=1.-smoothstep(.03,.09,bootFootprint);
   float bootWidth=3.4+.8*cos(gp.y*.17)+.35*sin(gp.y*.47);
   float bootAx=abs(gp.x);
   float bootMud=bootFade*mix(.65,1.,smoothstep(.2,.55,soilWet))*(1.-vSurfaceZones.y)*(1.-greenCover)*(1.-puddle)*smoothstep(bootWidth+.25,bootWidth+.7,bootAx)*(1.-smoothstep(.22,.45,vGroundSlope));
   if(bootMud>.003){
    float bootSx=gp.x<0.?-1.:1.;
    float l6=bootAx-(6.+.45*sin(gp.y*.21+bootSx*1.3)+.2*sin(gp.y*.67));
    float l10=bootAx-(10.+.55*sin(gp.y*.16-bootSx*.8)+.25*sin(gp.y*.53+2.));
    if(abs(l6)<.36)bootPrint=max(bootPrint,bootTrail(vec2(gp.y*bootSx,l6),2.+bootSx));
    if(abs(l10)<.36)bootPrint=max(bootPrint,bootTrail(vec2(.3-gp.y*bootSx,l10),7.+bootSx));
    float cA=gp.y-(-23.+.5*sin(gp.x*.45));
    float cB=gp.y-(15.+.4*sin(gp.x*.38+1.7));
    float cC=gp.y-(-4.+.45*sin(gp.x*.41+.6));
    if(abs(cA)<.36&&bootAx<11.5)bootPrint=max(bootPrint,bootTrail(vec2(gp.x,cA),13.));
    if(abs(cB)<.36&&bootAx<11.5)bootPrint=max(bootPrint,bootTrail(vec2(-gp.x,cB),19.));
    if(abs(cC)<.36&&bootAx<11.5)bootPrint=max(bootPrint,bootTrail(vec2(gp.x+.37,cC),29.));
    bootPrint*=bootMud;
   }
   float bkM=mix(.55,1.,smoothstep(.2,.55,soilWet))*(1.-vSurfaceZones.y)*(1.-greenCover)*(1.-puddle)*smoothstep(bootWidth+.25,bootWidth+.7,bootAx)*(1.-smoothstep(.22,.45,vGroundSlope));
   if(bkM>.003){
    vec3 bk=vec3(0.);
    float bkB=gp.x<0.?1.:smoothstep(-.2,.2,sin(gp.x*.9+gp.y*.3));
    float d1=gp.y-(21.+.3*sin(gp.x*.5));
    float d2=bootAx-(21.5+.35*sin(gp.y*.4));
    float d3=gp.y-(-4.6+.3*sin(gp.x*.6));
    if(abs(d1)<.36&&bootAx>12.&&bootAx<30.)bk=max(bk,bootTrail(vec2(gp.x,d1),41.)*bkB);
    if(abs(d2)<.36&&gp.y>14.&&gp.y<29.)bk=max(bk,bootTrail(vec2(gp.y,d2),47.)*bkB);
    if(abs(d3)<.36&&bootAx>11.5&&bootAx<18.)bk=max(bk,bootTrail(vec2(-gp.x,d3),53.)*smoothstep(-.3,.1,sin(gp.x*1.1)));
    bootPrint=max(bootPrint,bk*vec3(1.,1.35,1.)*bkM);
   }
   // Height in metres, used later for the derivative normal.
   float rutS=gp.x<0.?-1.:1.;
   float rutWin=smoothstep(8.,13.,gp.y)*(1.-smoothstep(31.,36.,gp.y));
   float rutD=min(abs(abs(bootAx-(10.+.55*sin(gp.y*.16-rutS*.8)+.25*sin(gp.y*.53+2.)))-.75),abs(abs(gp.x+26.-.7*sin((gp.y-22.)*.19))-.75)+(1.-rutWin)*9.);
   float rutN=.5+.5*sin(gp.y*5.3+sin(gp.y*1.7+gp.x*2.1)*2.5);
   float rutMask=bootFade*mix(.65,1.,smoothstep(.2,.55,soilWet))*(1.-vSurfaceZones.y)*(1.-.5*greenCover)*(1.-puddle)*(1.-smoothstep(.22,.45,vGroundSlope));
   float rutG=1.-smoothstep(.08,.24+.06*rutN,rutD);
   float rutR=smoothstep(.16,.3,rutD)*(1.-smoothstep(.34,.52,rutD))*(.45+.55*rutN);
   bootPrint=max(bootPrint,vec3(rutG*.9,rutR,rutG*smoothstep(.35,.7,sin(gp.y*.83+rutS*2.)*sin(gp.y*.29+1.)))*rutMask);
   float bootHeight=(bootPrint.y*.35-bootPrint.x)*.05;
   // Water only in the lowest bowls on flat y=0 wet ground, where the planar
   // reflection is valid. Sloped-bank prints darken only and never reflect.
   float bootWater=smoothstep(.45,.75,bootPrint.z)*basinFlatness*flatPlane*(1.-vForestCover)*smoothstep(.3,.6,soilWet+soilRain*.3);
   puddle=max(puddle,bootWater*.85);
   wetRim=max(wetRim,bootWater);`);
 s.fragmentShader=s.fragmentShader.replace('damp*=1.-vSurfaceZones.y*.55;',`
   damp=max(damp,wetRim*.90);damp*=1.-vSurfaceZones.y*.55;
   damp*=1.-greenCover*.65;`);
 s.fragmentShader=s.fragmentShader.replace('surface=mix(surface,surface*.52,puddle);','surface=mix(surface,surface*.38,puddle);surface*=(1.-.4*bootPrint.x)*(1.+.08*bootPrint.y);');
 // Displace the shading normal from view-space derivatives of the print
 // height, before the existing still-water flattening so water stays level.
 s.fragmentShader=s.fragmentShader.replace('normal=normalize(mix(normal,nonPerturbedNormal,puddle*.985));',`
   {
    vec3 bootSx3=dFdx(-vViewPosition),bootSy3=dFdy(-vViewPosition);
    vec3 bootR1=cross(bootSy3,normal),bootR2=cross(normal,bootSx3);
    float bootDet=dot(bootSx3,bootR1);
    vec3 bootGrad=sign(bootDet)*(dFdx(bootHeight)*bootR1+dFdy(bootHeight)*bootR2);
    normal=normalize(abs(bootDet)*normal-bootGrad);
   }
   normal=normalize(mix(normal,nonPerturbedNormal,puddle*.985));`);
 s.fragmentShader=s.fragmentShader.replace('surface*=mix(1.,.55,damp);','surface*=mix(1.,.48,damp);');
 s.fragmentShader=s.fragmentShader.replace('roughnessFactor=mix(roughnessFactor,.075+soilRain*.045,puddle);',`
   roughnessFactor=mix(roughnessFactor,.36+macro*.16,wetRim);
   roughnessFactor=mix(roughnessFactor,.82,greenCover);
   // Pressed mud is slightly smoother than the surrounding crumb.
   roughnessFactor=mix(roughnessFactor,.34,bootPrint.x*.45);
   roughnessFactor=mix(roughnessFactor,.062+soilRain*.045,puddle);`);
  s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   // A half-covered pixel must not inherit a bright intermediate-roughness
   // lobe around the entire shoreline. Approximate soil/water coverage rather
   // than treating that boundary as a continuous polished material.
   float pondTransition=4.*puddle*(1.-puddle);
   reflectedLight.directSpecular*=mix(1.,.05,wetRim)*(1.-.98*pondTransition);
   vec4 pondProject=uPuddleProjection*vec4(vGroundWorld,1.);
   vec2 pondUV=pondProject.xy/max(pondProject.w,.00001);
   float pondValid=step(.001,pondProject.w)*step(.004,pondUV.x)*step(.004,pondUV.y)*step(pondUV.x,.996)*step(pondUV.y,.996)*uPuddleReflectionEnabled;
   // Mild breeze warps reflected silhouettes without turning puddles into glass.
   vec2 ripple=vec2(sin(gp.x*2.7+gp.y*3.1-valleyTime),cos(gp.y*3.7-gp.x*2.1-valleyTime*.7))*.0008;
   vec2 reflectedUV=clamp(pondUV+ripple,vec2(.003),vec2(.997));
   vec3 pondLight=min(texture2D(uPuddleReflection,reflectedUV).rgb,vec3(16.))*.5;
   pondLight+=min(texture2D(uPuddleReflection,reflectedUV+vec2(.0013,0.)).rgb,vec3(16.))*.25;
   pondLight+=min(texture2D(uPuddleReflection,reflectedUV-vec2(.0013,0.)).rgb,vec3(16.))*.25;
   float pondFresnel=.025+.975*pow(1.-max(0.,dot(normal,geometryViewDir)),5.);
   // The HDR solar disk is also represented by the shadowed directional light.
   // Bound only its broad soil IBL lobe: an interpolated roughness must not
   // draw an unshadowed silver contour at the pond edge. Water keeps the
   // separately sampled scene reflection and its grazing Fresnel response.
   reflectedLight.indirectSpecular=mix(reflectedLight.indirectSpecular,min(reflectedLight.indirectSpecular,vec3(.09)),wetRim);
   reflectedLight.indirectSpecular=mix(reflectedLight.indirectSpecular,pondLight*pondFresnel,puddle*pondValid);
  `);
 material.userData.proceduralGround.afterrain={reflection:'dedicated flat y=0 selective scene reflection',forest:'spatial understory attribute',wetness:'retained independent from active rainfall; wet rims',basin:'integer-hash macro noise shared with the CPU puddle classifier; needs WebGL2; unverified in browser',bootPrints:'analytic trail cells in the ground shader; no new draw call or sampler; reflective water only on flat y=0 deep prints, sloped prints darken only; crossings at z=-23,-4,15; toe/heel compression and footprint-filtered tread; unverified in browser, still needs a screenshot at a non-pond sample'};
}
