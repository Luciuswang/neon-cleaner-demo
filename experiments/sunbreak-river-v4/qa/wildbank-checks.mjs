import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as T from '../../sunbreak-storm-v3/vendor/three/build/three.module.js';
import {groundHeight,landscapeHeight,terrainHeight,riverWidth,MAP,TERRAIN_GRID} from '../map-layout.js';
import {soilMoisture,SOIL_MOISTURE_GLSL} from '../ground-moisture.js';
import {installTerrainRaycast} from '../terrain-ray.js';
let checked=0,maxSupportError=0;
function check(v,m){assert.ok(v,m);checked++}
const body=SOIL_MOISTURE_GLSL.match(/float soilMoisture\(vec2 p,float rain\)\{([\s\S]*?)\n \}/)[1].replace(/\bfloat\b/g,'let');
const shader=new Function('p','rain','sin','cos','abs','clamp',body);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
for(let z=-34;z<26;z+=.3)for(let x=-31;x<32;x+=.3)for(const rain of [0,1]){
 const m=soilMoisture(x,z,rain),gpu=shader({x,y:z},rain,Math.sin,Math.cos,Math.abs,clamp);
 check(Math.abs(m-gpu)<1e-10,'CPU and actual moisture GLSL agree');check(m>=0&&m<=1,'bounded moisture');
 if(Math.abs(x)>riverWidth(z)+5.8&&rain===0)check(m===0,'outer village is dry in after-rain sun');
 if(Math.abs(x)<riverWidth(z)&&rain===0)check(m>.98,'channel wetness');
}
// Reconstruct exact rendered terrain, not a point-only analytic assertion.
const geo=new T.PlaneGeometry(TERRAIN_GRID.size,TERRAIN_GRID.size,TERRAIN_GRID.segments,TERRAIN_GRID.segments);geo.rotateX(-Math.PI/2);
const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,landscapeHeight(p.getX(i),p.getZ(i)));geo.computeVertexNormals();
const mesh=new T.Mesh(geo,new T.MeshBasicMaterial());installTerrainRaycast(T,mesh,TERRAIN_GRID.size,TERRAIN_GRID.segments);
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
for(const z0 of [-23,15])for(let dz=-4;dz<=4;dz+=.05)for(let x=-6;x<=6;x+=.05){
 const z=z0+dz;ray.set(new T.Vector3(x,2,z),down);const hit=ray.intersectObject(mesh)[0];check(!!hit,'ford rendered triangle exists');
 const error=Math.abs(hit.point.y-terrainHeight(x,z));maxSupportError=Math.max(maxSupportError,error);check(error<.03,'rendered shelf/support discrepancy below 3cm');
 if(Math.abs(x)<=2)check(hit.point.y<MAP.waterY-.12,'rendered ford submerged, not just depth shader');
}
for(const [x,z]of [[2.275,12.675],[.3,16.6]]){
 ray.set(new T.Vector3(x,2,z),down);const hit=ray.intersectObject(mesh)[0],error=Math.abs(hit.point.y-terrainHeight(x,z));
 check(error<.03,'review regression: meandering ford shoulders remain within original 3cm support bound');
 maxSupportError=Math.max(maxSupportError,error);
}
for(let z=-34;z<26;z+=.1){check(groundHeight(0,z)<MAP.waterY-.14,'unbroken central channel');}
check(terrainHeight(0,-4)===0&&groundHeight(0,-4)<MAP.waterY,'central bridge remains separate above river');
const world=await readFile(new URL('../world.js',import.meta.url),'utf8');
const bedArgs=world.match(/bedGeo=new T.PlaneGeometry\((\d+),(\d+),(\d+),(\d+)\)/).slice(1).map(Number);
check(bedArgs[0]/bedArgs[2]===TERRAIN_GRID.size/TERRAIN_GRID.segments&&bedArgs[1]/bedArgs[3]===TERRAIN_GRID.size/TERRAIN_GRID.segments,'riverbed overlay shares underlying triangle grid spacing');
const bedGeo=new T.PlaneGeometry(...bedArgs);bedGeo.rotateX(-Math.PI/2);const bp=bedGeo.attributes.position;
for(let i=0;i<bp.count;i++)bp.setY(i,groundHeight(bp.getX(i),bp.getZ(i))+.008);
const bed=new T.Mesh(bedGeo,new T.MeshBasicMaterial());
for(const z0 of [-23,15])for(let dz=-3.5;dz<=3.5;dz+=.23)for(let x=-5;x<=5;x+=.29){
 ray.set(new T.Vector3(x,2,z0+dz),down);const baseHit=ray.intersectObject(mesh)[0],bedHit=ray.intersectObject(bed)[0];
 check(Math.abs(bedHit.point.y-baseHit.point.y-.008)<1e-6,'bed remains 8mm above ground throughout slopes, no intersecting patch seams');
}
check(world.includes('SOIL_MOISTURE_GLSL')&&world.includes('vec3 drySoil=')&&world.includes('roughnessFactor=mix(max(roughnessFactor,.89)'),'real ground shader uses color and roughness moisture zoning');
check(!world.includes('float wetPocket='),'removed blanket scattered wet-film shader');
console.log(JSON.stringify({pass:true,checked,maxSupportError,scope:'actual GLSL wet/dry field and rendered terrain ray support at both dug fords; independent canvas art still required'}));
