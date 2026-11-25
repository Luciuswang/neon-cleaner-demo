// roof-patina.js — rain-fed moss/lichen for Riverfall roof materials (M.tile, M.roof).
// Call on private clones, after cloning and before first compile. No textures, lights or extra draws.
// Assumes ridges run along world Z (true for all Riverfall houses): streaks stretch along world X.
const TAG = 'roofPatina-v1';

const NOISE = /* glsl */`
float rpH(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float rpN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(rpH(i),rpH(i+vec2(1,0)),f.x),mix(rpH(i+vec2(0,1)),rpH(i+vec2(1,1)),f.x),f.y);}
`;

const V_BEGIN = '#include <begin_vertex>', F_COLOR = '#include <color_fragment>', COMMON = '#include <common>';

export function installRoofPatina(material, { eaveY = 2.6, eaveBand = 0.9 } = {}) {
  if (!material || material.onBeforeCompile?.roofPatina) return material; // idempotent, clone-safe
  const prevHook = material.onBeforeCompile, prevKey = material.customProgramCacheKey;
  const e0 = eaveY.toFixed(3), e1 = (eaveY + eaveBand).toFixed(3);

  const hook = function (shader, renderer) {
    prevHook?.call(this, shader, renderer);
    const vs = shader.vertexShader, fs = shader.fragmentShader;
    if (!vs.includes(V_BEGIN) || !fs.includes(F_COLOR) || !vs.includes(COMMON) || !fs.includes(COMMON)) {
      console.warn('[roofPatina] shader anchors missing; patina skipped'); return;
    }
    shader.vertexShader = vs
      .replace(COMMON, COMMON + '\nvarying vec3 vRpPos;varying vec3 vRpNrm;')
      .replace(V_BEGIN, V_BEGIN + /* glsl */`
vec4 rpW=vec4(transformed,1.);vec3 rpNn=objectNormal;
#ifdef USE_INSTANCING
rpW=instanceMatrix*rpW;rpNn=mat3(instanceMatrix)*rpNn;
#endif
vRpPos=(modelMatrix*rpW).xyz;vRpNrm=mat3(modelMatrix)*rpNn;`);

    shader.fragmentShader = fs
      .replace(COMMON, COMMON + '\nvarying vec3 vRpPos;varying vec3 vRpNrm;float rpK=0.;' + NOISE)
      .replace(F_COLOR, F_COLOR + /* glsl */`
{
 vec2 q=vRpPos.xz; // world-projected: patches flow across neighbouring tiles
 float up=normalize(vRpNrm).y*(gl_FrontFacing?1.:-1.); // world up-ness, view independent
 float big=rpN(q*1.3+7.),mid=rpN(q*3.7-3.);          // ~0.35-1 m patches
 float streak=rpN(vec2(q.x*.7,q.y*8.));               // down-slope runs
 float fine=rpN(q*17.)*.6+rpN(q*46.)*.4;              // lichen mottling
 float eave=1.-smoothstep(${e0},${e1},vRpPos.y);      // damp eave clusters
 float join=1.-smoothstep(.25,.75,up);                // valleys between half-round tiles
 float isle=smoothstep(.5,.78,rpN(q*.6+19.));
 float f=big*.6+mid*.25+streak*.15+eave*.12+join*.14+isle*.09+(fine-.5)*.08;
 float k=smoothstep(.64,.74,f);                       // coverage threshold (tune here)
 float halo=smoothstep(.57,.66,f)*smoothstep(.5,.72,fine)*.75; // lichen speckle fringe
 rpK=max(k,halo)*smoothstep(.02,.3,up);               // no undersides / vertical caps
 vec3 c=mix(vec3(.024,.070,.022),vec3(.105,.145,.052),smoothstep(.45,.75,fine)*(1.-k*.6));
 c=mix(c,vec3(.19,.25,.14),join*smoothstep(.3,.7,mid)*.5);
 diffuseColor.rgb=mix(diffuseColor.rgb,c,rpK*.94);    // linear albedo replacement
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.96,rpK);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor*=1.-rpK;');
  };
  hook.roofPatina = true;

  material.onBeforeCompile = hook;
  material.customProgramCacheKey = function () {
    return (prevKey ? prevKey.call(this) : '') + '|' + TAG + '|' + e0 + '|' + e1;
  };
  material.userData.roofPatina = { tag: TAG, eaveY, eaveBand };
  material.needsUpdate = true;
  return material;
}
