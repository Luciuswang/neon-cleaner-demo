import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FLOW_WAVES,sampleRiverSurface,RIVER_DEPTH_GLSL} from '../river-water.js';
import {groundHeight,MAP,crossings} from '../map-layout.js';
import {runtimeHashes} from './source-binding.mjs';
let checked=0;const check=(v,m)=>{assert.ok(v,m);checked++};
const max=FLOW_WAVES.reduce((n,w)=>n+w.amplitude,0);
// Evaluate the scalar body from the actual exported GLSL, not a second hand-
// written depth approximation. GLSL float arithmetic is checked in browser too.
const depthBody=RIVER_DEPTH_GLSL.match(/float riverDepth\(vec2 p\)\{([\s\S]*?)\n \}/)[1].replace(/\bfloat\b/g,'let');
const shaderDepth=new Function('p','abs','cos','sin','min','clamp',depthBody);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const flowBody=RIVER_DEPTH_GLSL.match(/float flowHeight\(vec2 p,float t\)\{([\s\S]*?)\n \}/)[1].replace(/\bfloat\b/g,'let');
const shaderFlow=new Function('p','t','sin','smoothstep','riverDepth',flowBody);
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const depth=p=>shaderDepth(p,Math.abs,Math.cos,Math.sin,Math.min,clamp);
check(max<.02,'centimetric relief not ocean waves');
check(FLOW_WAVES.every(w=>w.kz>0&&w.speed>0),'all wave phase velocities downstream');
const differences=[];
for(let x=-6.5;x<=6.5;x+=.21)for(let z=-34;z<=26;z+=.29){
 const a=sampleRiverSurface(x,z,0),b=sampleRiverSurface(x,z,.75);
 check(a.depth===MAP.waterY-groundHeight(x,z),'shared riverbed depth contract');
 check(Math.abs(shaderDepth({x,y:z},Math.abs,Math.cos,Math.sin,Math.min,clamp)-a.depth)<1e-9,'actual GLSL depth expression matches support function');
 check(Math.abs(shaderFlow({x,y:z},.75,Math.sin,smoothstep,depth)-b.displacement)<1e-9,'actual bent GLSL displacement matches CPU spectrum');
 check(Math.abs(a.displacement)<=max,'height stays inside amplitude bound');
 check(Number.isFinite(b.height),'finite live height');
 if(!a.wet)check(a.displacement===0,'no raised wave on dry bank');
 if(a.depth>.14)differences.push(Math.abs(a.height-b.height));
}
check(differences.reduce((a,b)=>a+b,0)/differences.length>.003,'nonstatic directional surface');
for(const z of crossings.filter(z=>z!==-4))for(let x=-2;x<=2;x+=.1){
 const s=sampleRiverSurface(x,z,8);check(s.wet&&s.depth>.13&&s.depth<.17,'formerly dry ford is shallow connected water');
}
for(let z=-80;z<=80;z+=.1)for(const x of [-1,0,1])check(sampleRiverSurface(x,z,8).depth>.14,'continuous three-metre channel through both fords');
check(sampleRiverSurface(0,-4,3).wet,'flow remains beneath central wooden bridge');
// Verify each physically meaningful phase advects coherently along its velocity.
for(const w of FLOW_WAVES){
 const coord=(x,z)=>z+.16*Math.sin(x*1.7+z*.43)+.08*Math.sin(x*3.3-z*.74);
 const phase=(x,z,t)=>Math.sin(x*w.kx+(coord(x,z)-t*w.speed)*w.kz+w.phase);
 let lo=3,hi=5;for(let n=0;n<60;n++){const mid=(lo+hi)/2;if(coord(2,mid)<coord(2,3)+w.speed*.8)lo=mid;else hi=mid}
 check(Math.abs(phase(2,(lo+hi)/2,.8)-phase(2,3,0))<1e-10,'actual warped wavefront travels downstream coherently');
 check(RIVER_DEPTH_GLSL.includes(w.amplitude.toFixed(5)),'GPU and CPU share spectrum');
}
const hashes=await runtimeHashes();check(!!hashes['river-water.js'],'new renderer module source-bound');
const packaging=await readFile(new URL('../tools/package.mjs',import.meta.url),'utf8');
check(packaging.includes("'river-water.js'"),'new renderer included in publish whitelist');
const waterSource=await readFile(new URL('../river-water.js',import.meta.url),'utf8');
const [,sx,sz]=waterSource.match(/PlaneGeometry\(14,160,(\d+),(\d+)\)/).map(Number);
// Include maximum phase derivatives introduced by the two spatial meanders.
const bendX=.16*1.7+.08*3.3,bendZ=.16*.43+.08*.74;
for(const w of FLOW_WAVES){
 check(14/sx<Math.PI/(Math.abs(w.kx)+w.kz*bendX),'X mesh sampling resolves every displaced phase');
 check(160/sz<Math.PI/(w.kz*(1+bendZ)),'Z mesh sampling resolves every displaced phase');
}
console.log(JSON.stringify({pass:true,checked,maxDisplacement:max,flowDirection:'+Z',scope:'CPU phase/depth/relief and packaging; actual shaders and visible motion require GPU evidence'}));
