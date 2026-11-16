import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HOUSE,floorHeight,underRoof,doorBounds,bodyOverlaps,swingOccupied,createDoorState} from '../house-logic.js';
const checks=[],check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}};
const eq=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
check('actual room floor .66m',()=>eq(floorHeight(12,-18),.66));
check('veranda uses same floor',()=>eq(floorHeight(11,-14.5),.66));
check('original spawn9,-13 stays at ground',()=>eq(floorHeight(9,-13),0));
check('original player spawn stays at ground',()=>eq(floorHeight(0,12),0));
for(let i=0;i<4;i++)check('stair tread '+(i+1),()=>eq(floorHeight(10.92,-12.6-i*.4),.165*(i+1)));
check('all outdoor floor samples unchanged',()=>{
 for(const [x,z]of [[0,0],[-13,-12],[20,12],[9,-13],[14,-12],[17,-18],[12,-23]])eq(floorHeight(x,z),0);
});
check('roof shelters room',()=>assert.equal(underRoof(12,2.4,-18),true));
check('roof shelters veranda',()=>assert.equal(underRoof(11,2.8,-14.4),true));
check('outdoor and above roof keep rain',()=>{assert.equal(underRoof(12,9,-18),false);assert.equal(underRoof(0,2,0),false)});
const permit={near:true,visible:true,active:true};
for(const [name,flags]of Object.entries({distant:{near:false},wall:{visible:false},paused:{active:false},repeat:{repeat:true},focusedUI:{focusedUI:true},sweep:{occupied:true}})){
 check('door rejects '+name,()=>assert.equal(createDoorState().toggle({...permit,...flags}),false));
}
check('door debounce while moving',()=>{const d=createDoorState();assert.equal(d.toggle(permit),true);assert.equal(d.toggle(permit),false)});
check('pause freezes swing',()=>{const d=createDoorState();d.toggle(permit);d.step(.5,null,false);eq(d.angle,0)});
check('open reaches bounded angle',()=>{const d=createDoorState();d.toggle(permit);for(let i=0;i<180;i++)d.step(1/60,null);eq(d.angle,HOUSE.openAngle);assert.equal(d.info().open,true)});
check('closed leaf blocks central player',()=>assert.equal(bodyOverlaps({x:10.92,y:2.36,z:-15.6},doorBounds(0)),true));
check('open leaf clears original doorway centre',()=>assert.equal(bodyOverlaps({x:10.92,y:2.36,z:-15.6},doorBounds(HOUSE.openAngle)),false));
check('sweep occupancy protects inside player',()=>assert.equal(swingOccupied({x:10.92,y:2.36,z:-16.1}),true));
check('safe outside stance permits use',()=>assert.equal(swingOccupied({x:10.92,y:2.36,z:-14.5}),false));
check('animation cannot close through player',()=>{
 const d=createDoorState();d.toggle(permit);d.step(2,null);d.toggle(permit);
 const p={x:10.92,y:2.36,z:-15.5};for(let i=0;i<120;i++)d.step(1/60,p);
 assert.equal(bodyOverlaps(p,doorBounds(d.angle)),false);assert.ok(d.info().message);
});
check('upper lintel does not block crouchless doorway',()=>assert.equal(bodyOverlaps({x:10.92,y:2.36,z:-15.6},{min:{x:10,y:3.15,z:-15.8},max:{x:12,y:4.7,z:-15.4}}),false));
check('door resets completely',()=>{const d=createDoorState();d.toggle(permit);d.step(1,null);d.reset();eq(d.angle,0);eq(d.target,0);eq(d.info().toggles,0)});
const source=readFileSync(new URL('../house-logic.js',import.meta.url)),report={date:new Date().toISOString(),method:'isolated deterministic architecture logic; not browser playthrough/performance',sourceSha256:createHash('sha256').update(source).digest('hex'),pass:checks.every(c=>c.pass),checks};
writeFileSync(new URL('./house-unit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass)},null,2));if(!report.pass)process.exitCode=1;
