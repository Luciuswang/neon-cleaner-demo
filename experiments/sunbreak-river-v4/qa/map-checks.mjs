import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {MAP,layout,terrainHeight,groundHeight,blocked,roofHeight,riverWidth,teamSpawns,bufferPlacements,navigationBounds} from '../map-layout.js';
import {createNavigation,coverPairs} from '../tactical-ai.js';
const polish=process.argv.includes('--polish');
const sleeveBaseline='dac1b1a62fe230e31f08e540db2c876e9c8d2ffcbfb4878a45fe6e37a1aee698';
function sleeveSource(text){
 const normalized=text.replace(/\r\n/g,'\n'),marker='function repairLeftSleeve(T,root){';
 assert.equal(normalized.split(marker).length,2,'exactly one pinned sleeve implementation');
 // The pinned function ends the module. Hashing the complete suffix also fails
 // closed if code is appended or moved into the protected implementation.
 return normalized.slice(normalized.indexOf(marker)).trim();
}
const checks=[];
function check(name,fn){fn();checks.push({name,pass:true})}
check('original six building walls and river cover retain mirrored geometry',()=>{
 for(const b of layout.walls.filter(w=>!w.id.startsWith('outer-cover-')))assert.ok(layout.walls.some(c=>c.x===-b.x&&c.y===b.y&&c.z===b.z&&c.w===b.w&&c.h===b.h&&c.d===b.d));
});
check('spawns clear of all enemy obstacles, grounded on both banks',()=>{for(const [x,y,z]of [...layout.spawns,...teamSpawns]){assert.ok(!blocked(x,z,.4,1.6,'enemy'));assert.equal(y,terrainHeight(x,z))}});
check('two cabin transforms are diagonally symmetric about river center',()=>{const [a,b]=bufferPlacements;assert.equal(a.x,-b.x);assert.equal(a.z+b.z,-8);assert.equal(b.yaw-a.yaw,Math.PI);for(const p of bufferPlacements)assert.ok(navigationBounds.some(b=>b.id===p.id&&p.x>b.min.x&&p.x<b.max.x&&p.z>b.min.z&&p.z<b.max.z))});
check('riverbed symmetrical, submerged fords, dry bridge and slope bounded',()=>{
 for(let z=-33;z<25;z+=.2)for(let x=0;x<10;x+=.2){assert.equal(terrainHeight(x,z),terrainHeight(-x,z));assert.ok(Math.abs(groundHeight(x+.1,z)-groundHeight(x,z))<.05);assert.ok(Math.abs(groundHeight(x,z+.1)-groundHeight(x,z))<.05)}
 for(const z of layout.crossings)for(let x=-30;x<30;x+=.25){
  if(z===-4){
   if(Math.abs(x)<=6)assert.equal(terrainHeight(x,z),0);
   else assert.ok(terrainHeight(x,z)>-.08,'bridge approach must stay above water');
  }else{
   assert.equal(terrainHeight(x,z),groundHeight(x,z),'ford uses actual lowered support');
   if(Math.abs(x)<riverWidth(z)-1.1){assert.ok(terrainHeight(x,z)<MAP.waterY-.14);assert.ok(terrainHeight(x,z)>=-.341,'shallow gravel shelf, not deep trench');}
   if(Math.abs(x)>riverWidth(z)+1.8)assert.equal(terrainHeight(x,z),0);
  }
 }
 assert.equal(terrainHeight(0,0),-.58);assert.ok(riverWidth(0)>3);
});
check('continuous wall-free wade and crossing corridors both ways',()=>{
 for(const z of [...layout.crossings,0])for(const dir of [-1,1])for(const dt of [.016,.05]){
  let x=dir*10;for(let n=0;n<Math.ceil(20/(7.4*dt));n++){x-=dir*7.4*dt;assert.ok(!blocked(x,z));assert.ok(Number.isFinite(terrainHeight(x,z)))}
 }
});
check('doors windows and roof clearance match architecture contract',()=>{
 for(const h of layout.houses){for(const dz of [-4,-3.5,0,3.5,4])assert.ok(!blocked(h.x,h.z+dz));assert.ok(blocked(h.x+3.5,h.z, .4,1.6));assert.ok(roofHeight(h.x,h.z)===Infinity||roofHeight(h.x,h.z)>3.2)}
});
const navigation=createNavigation(p=>blocked(p.x,p.z,.4,p.y,'enemy'));
check('start connector retained before smoothing on both banks',()=>{for(const sign of [-1,1])assert.ok(navigation.path({x:sign*13.6863833,z:21.1993733},{x:sign*8.5262700,z:-18.3780100}).length)});
check('house doorway graph edges retain valid route',()=>{for(const sign of [-1,1]){let p={x:sign*15,z:-3};const route=navigation.path(p,{x:0,z:0});assert.ok(route.length);for(const q of route){assert.ok(navigation.clear(p,q));p=q}}});
check('swept clearance rejects short corner clipping',()=>assert.equal(navigation.clear({x:5.55,z:7.345},{x:5.67,z:7.225}),false));
check('all thin river cover walls offer AI cover pairs',()=>{const pairs=coverPairs(layout.bounds);for(const box of layout.bounds.filter(b=>b.id.startsWith('cover-')))assert.ok(pairs.some(c=>c.box===box))});
const lengths=[];
check('both-bank spawn-to-crossing routes remain reachable with cabin obstacles',()=>{
 for(const z of layout.crossings){
  const distances=[];
  for(const side of [-1,1]){
   let p={x:side*27,z:22};const path=navigation.path(p,{x:side*5,z});assert.ok(path.length,'missing route');let length=0;
   for(const q of path){assert.ok(navigation.clear(p,q));length+=Math.hypot(q.x-p.x,q.z-p.z);p=q}distances.push(length);
  }
  lengths.push({crossing:z,distances,difference:Math.abs(distances[0]-distances[1])});
 }
});
check('AI routes connect both banks and all spawn exits',()=>{
 for(const [x,,z]of layout.spawns){const path=navigation.path({x,z},{x:-x,z});assert.ok(path.length,'unreachable '+x+','+z)}
});
const reused={};
for(const name of ['weapon.js','reload-pose.js','actors.js','audio.js','combat-controls.js','storm-audio.js']){
 const body=await readFile(new URL('../'+name,import.meta.url),'utf8');const prior=await readFile(new URL('../../sunbreak-arena-v4/'+name,import.meta.url),'utf8');
 if(polish&&name==='weapon.js'){
  check('polish weapon presentation exception retains exact repairLeftSleeve baseline',()=>{
   const sleeve=sleeveSource(body);
   assert.equal(sleeve,sleeveSource(prior),'sleeve repair exactly matches original arena');
   assert.equal(createHash('sha256').update(sleeve).digest('hex'),sleeveBaseline,'pinned sleeve baseline, not a moving comparison');
   assert.equal(body.split('const sleeve=repairLeftSleeve(T,root);').length,2,'retained repair called exactly once');
  });
 }else check('unchanged reused code '+name,()=>assert.equal(body.replace(/\r\n/g,'\n'),prior.replace(/\r\n/g,'\n')));
 reused[name]=createHash('sha256').update(body).digest('hex');
}
check('all four previous demos have no worktree changes',()=>assert.equal(execFileSync('git',['diff','bb30122','--','experiments/sunbreak-fable52','experiments/sunbreak-realistic-v2','experiments/sunbreak-storm-v3','experiments/sunbreak-arena-v4'],{encoding:'utf8'}),''));
const sources={};for(const name of ['map-layout.js','tactical-ai.js','qa/map-checks.mjs'])sources[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),pass:true,mode:polish?'polish':'historical',replacedContract:polish?{only:'weapon.js whole-file identity',replacement:'exact original repairLeftSleeve source and call; all other original assertions retained',sleeveSHA256:sleeveBaseline,requiredCompanionSuites:['polish-preservation-checks','combat-feedback-checks']}:null,checks,lengths,reused,sources,limits:'Diagonal cabin pair is rotationally matched. Existing building/crossing centers preserved. Full map no longer exact X-mirror; route differences measured, NOT certified multiplayer balance or actual-browser traversal proof.'};
if(!process.argv.includes('--stdout-only'))await writeFile(new URL('./map-checks.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
