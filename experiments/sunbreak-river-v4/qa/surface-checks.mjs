import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {surfaceZones,trafficDistance,foundationWeedPlan,applySurfaceAttributes,installGroundSurface} from '../ground-surface.js';
import {blocked,landscapeHeight,houses} from '../map-layout.js';
const sha=(b,t='sha256')=>createHash(t).update(b).digest('hex');let checks=0;
function check(name,value){assert.ok(value,name);checks++}
for(let x=-32;x<=32;x+=.5)for(let z=-34;z<=26;z+=.5){const q=surfaceZones(x,z);check('bounded finite zones',Object.values(q).every(v=>Number.isFinite(v)&&v>=0&&v<=1));check('no multiple full-strength layers',q.path+q.litter<=1.000001)}
check('longitudinal lane compacted',surfaceZones(-10,12).path>.95);
check('bank remains mud',surfaceZones(-3,10).path===0&&surfaceZones(-3,10).litter===0);
check('overhead door lintel does not paint ground contact',surfaceZones(-17,-19.5).contact===0);
for(const h of houses){check('foundation retains mud',surfaceZones(h.x,h.z).foundation===1&&surfaceZones(h.x,h.z).path===0);check('door connects to path',trafficDistance(h.x,h.z+4.3)<.001)}
const weeds=foundationWeedPlan();check('deterministic weeds',JSON.stringify(weeds)===JSON.stringify(foundationWeedPlan()));check('bounded weed population',weeds.length>150&&weeds.length<900);
for(const w of weeds){check('low weeds',w.height>=.09&&w.height<=.22);check('no door/path obstruction',trafficDistance(w.x,w.z)>=1.5&&!blocked(w.x,w.z,.3));check('grounded roots',Math.abs(w.y-landscapeHeight(w.x,w.z)+.012)<1e-9)}
const g=new T.PlaneGeometry(20,20,20,20);g.rotateX(-Math.PI/2);const before=sha(Buffer.from(g.attributes.position.array.buffer));applySurfaceAttributes(T,g);
check('surface attributes preserve geometry',before===sha(Buffer.from(g.attributes.position.array.buffer)));check('zones every vertex',g.attributes.surfaceZones.count===g.attributes.position.count);
const mat=new T.MeshStandardMaterial(),other={map:new T.Texture(),normalMap:new T.Texture(),roughnessMap:new T.Texture()};installGroundSurface(T,mat,{dirt:other,forest:other,rain:{value:0}});
const shader={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};mat.onBeforeCompile(shader);
// Execute the emitted shader expression, not a second hand-maintained formula.
const litterExpression=shader.fragmentShader.match(/float litterBlend=([^;]+);/)[1];
const evaluateLitter=new Function('vSurfaceZones','earthNoise','gp','pathBlend','clamp','return '+litterExpression);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
for(const q of [surfaceZones(-3,10),surfaceZones(-17,-24)])for(let n=0;n<=1;n+=.02)check('emitted shader protects bank/foundation',evaluateLitter({z:q.litter},()=>n,1,q.path,clamp)===0);
for(const z of [0,.001,.02,.1,.25,.5,.75,.99,1])for(const p of [0,.2,.8,1])for(const n of [0,.2,.5,.8,1]){
 const v=evaluateLitter({z},()=>n,1,p,clamp);check('interpolated boundary bounded',v>=0&&v<=1-p+1e-9);if(z===0||p===1)check('protected zero masks stay zero',v===0);
}
check('normal layer blending actually inserted',shader.fragmentShader.includes('texture2D(uDirtNormal,dirtUV).xyz')&&shader.fragmentShader.includes('texture2D(uForestNormal,forestUV).xyz'));
const tangent=shader.fragmentShader.split('#elif defined( USE_NORMALMAP_TANGENTSPACE )')[1]?.split('#elif')[0];
check('active tangent normal branch blends new layers',tangent?.includes('texture2D(uDirtNormal,dirtUV).xyz')&&tangent?.includes('texture2D(uForestNormal,forestUV).xyz'));
check('roughness all layers',shader.fragmentShader.includes('texture2D(uDirtRough,dirtUV).g')&&shader.fragmentShader.includes('texture2D(uForestRough,forestUV).g'));
check('contact affects indirect only',shader.fragmentShader.includes('reflectedLight.indirectDiffuse*=1.-vSurfaceZones.w'));
const manifest=JSON.parse(await readFile(new URL('../ground-surface-assets.json',import.meta.url)));
for(const a of manifest.assets){const official=JSON.parse(await readFile(new URL(`../assets/ground-surfaces/${a.id}/official-files.json`,import.meta.url)));check('CC0 provenance',a.license==='CC0-1.0');for(const f of a.files){const b=await readFile(new URL('../'+f.file,import.meta.url));check('SHA/md5 match',b.length===f.bytes&&sha(b)===f.sha256&&sha(b,'md5')===f.officialMD5);check('upstream API binding',JSON.stringify(official).includes(f.officialMD5)&&JSON.stringify(official).includes(f.url))}}
console.log(JSON.stringify({pass:true,checks,weeds:weeds.length,materials:3,newScanAssets:2,limitations:'CPU only, not GPU/art/performance acceptance'}));
