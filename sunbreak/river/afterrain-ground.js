// Add a retained-water mask and green understory to the accepted terrain bake.
// Previous look never calls this hook; original source shader remains available.
export function installLegacyForestTint(material){
 const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=s=>{
  before(s);
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float forestCover;varying float vForestCover;').replace('#include <begin_vertex>','#include <begin_vertex>\nvForestCover=forestCover;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying float vForestCover;').replace('diffuseColor*=vec4(surface,1.);',`surface=mix(surface,mix(vec3(.033,.068,.013),vec3(.105,.157,.035),macro),vForestCover*(1.-vSurfaceZones.y));diffuseColor*=vec4(surface,1.);`);
 };
 material.customProgramCacheKey=()=>key()+'-afterrain-forest';
}
export function enhanceAfterRainGround(T,material,s,reflection){
 Object.assign(s.uniforms,reflection.uniforms);
 s.vertexShader=s.vertexShader.replace('#include <common>',`#include <common>
 attribute float forestCover;varying float vForestCover;`)
 .replace('#include <begin_vertex>','#include <begin_vertex>\nvForestCover=forestCover;');
 s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
 varying float vForestCover;
 uniform sampler2D uPuddleReflection;uniform mat4 uPuddleProjection;uniform float uPuddleReflectionEnabled;`);
 // Terrain geometry is flat y=0 across village pads. Only those surfaces can
 // share a planar reflection. Height and slope filters exclude bank/hills.
 s.fragmentShader=s.fragmentShader.replace('float basin=macro+(microHeight-.5)*.19;',`
   float greenCover=clamp(vForestCover+(macro-.5)*.16*vForestCover*(1.-vForestCover)*4.,0.,1.)*(1.-vSurfaceZones.y);
   float plantCommunity=smoothstep(.25,.75,valleyNoise(gp*.16+vec2(31.7,8.2)));
   greenCover*=mix(.43,1.,smoothstep(.23,.63,valleyNoise(gp*.21+vec2(18.2,43.7))));
   vec3 greens=mix(vec3(.022,.056,.012),vec3(.095,.145,.029),plantCommunity);
   float leafGrain=clamp(dot(litterSample.rgb,vec3(.2126,.7152,.0722))/.045,.48,1.6)*mix(.72,1.16,smoothstep(.38,.66,litterSample.a));
   surface=mix(surface,greens*leafGrain,greenCover);
   litterBlend=max(litterBlend,greenCover);
   float basin=valleyNoise(gp*.34+vec2(8.3,2.7))*.68+valleyNoise(gp*.97)*.32+(microHeight-.5)*.045;
   float flatPlane=1.-smoothstep(.006,.025,abs(vGroundWorld.y));`);
 s.fragmentShader=s.fragmentShader.replace(/float puddle=\(1\.-smoothstep\(\.34,\.40,basin\)\)[^;]+;/,`
   float puddle=(1.-smoothstep(.39,.45,basin))*basinFlatness*flatPlane*(1.-vSurfaceZones.y)*(1.-vForestCover);
   float wetRim=(1.-smoothstep(.43,.58,basin))*basinFlatness*flatPlane*(1.-vSurfaceZones.y)*(1.-vForestCover);`);
 s.fragmentShader=s.fragmentShader.replace('damp*=1.-vSurfaceZones.y*.55;',`
   damp=max(damp,wetRim*.90);damp*=1.-vSurfaceZones.y*.55;
   damp*=1.-greenCover*.65;`);
 s.fragmentShader=s.fragmentShader.replace('surface=mix(surface,surface*.52,puddle);','surface=mix(surface,surface*.38,puddle);');
 s.fragmentShader=s.fragmentShader.replace('surface*=mix(1.,.55,damp);','surface*=mix(1.,.48,damp);');
 s.fragmentShader=s.fragmentShader.replace('roughnessFactor=mix(roughnessFactor,.075+soilRain*.045,puddle);',`
   roughnessFactor=mix(roughnessFactor,.36+macro*.16,wetRim);
   roughnessFactor=mix(roughnessFactor,.82,greenCover);
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
 material.userData.proceduralGround.afterrain={reflection:'dedicated flat y=0 selective scene reflection',forest:'spatial understory attribute',wetness:'retained independent from active rainfall; wet rims'};
}
