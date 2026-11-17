// Exact module comparison against the last uploaded timber-UV checkpoint.
// Only the individually enumerated user-authorized NPC/diagnostic hooks reverse.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='2f116226e4bd6cb3414f683c5c77fa663306eaac';
const root=new URL('../../../',import.meta.url);
const path='experiments/sunbreak-storm-v3/index.html';
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'});
const previous=git(['show',base+':'+path]);
const current=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const lf=s=>s.replace(/\r\n/g,'\n');
const moduleOf=s=>{const m=[...lf(s).matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];assert.equal(m.length,1);return m[0][1]};
const before=moduleOf(previous),after=moduleOf(current);
const between=(s,a,b)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start);return s.slice(start,end)};
const rewrites=[
 ["explicit NPC module import","import {TACTICAL_SPAWNS,createTacticalAI,enemyHitBounds} from './tactical-ai.js';\n",''],
 ['authorized spawn map','const SPAWN=TACTICAL_SPAWNS.map(p=>[p[0],p[2]]);','const SPAWN=[[-8,-10],[9,-9],[-13,3],[14,3],[-3,-20],[9,-13]];'],
 ['AI handle','let tactical=null;\n',''],
 ['noise notification',' tactical?.playerShot(pos);\n',''],
 ['stance-relative NPC hitbox',
  '  const bounds=enemyHitBounds(e),b=new THREE.Box3(new THREE.Vector3(bounds.min.x,bounds.min.y,bounds.min.z),new THREE.Vector3(bounds.max.x,bounds.max.y,bounds.max.z));',
  '  const b=new THREE.Box3().setFromCenterAndSize(e.g.position.clone().setY(1.0),new THREE.Vector3(.75,2.0,.75));'],
 ['hurt notification',"snd('hit');tactical?.hit(best);","snd('hit');"],
 ['new actual-geometry NPC shot helpers',between(after,'// Approval uses both shoulder-to-muzzle','function tracer(end)'), ''],
 ['NPC reset',' tactical?.reset();\n',''],
 ['NPC update loop only',
  "  // v3-authorized NPC behavior: cover selection, peeking/bursts and navigation.\n  tactical?.update(dt,{live:S.state==='play'&&!pres,player:pos});\n",
  between(before,'  // enemies\n','  // sea shimmer\n')],
 ['NPC initialization',
  "tactical=createTacticalAI({enemies,bounds:[...colliders,{min:{x:8,y:0,z:-22},max:{x:16,y:4.74,z:-15.6}}],\n isBlocked:p=>collide(new THREE.Vector3(p.x,p.y,p.z),'enemy'),canSee:clearSight,onShoot:enemyShoot});\n",''],
 ['read-only telemetry',between(after,' enemies:enemies.map','\n setStyle'),between(before,' enemies:enemies.map','\n setStyle')]
];
function restore(source){
 let s=source;
 for(const[name,added,replacement]of rewrites){assert.equal(s.split(added).length-1,1,'Hook must occur once: '+name);s=s.replace(added,replacement)}
 return s;
}
const checks=[],check=(name,pass)=>checks.push({name,pass});
check('whole combat/player/input module exact after enumerated NPC hooks',restore(after)===before);
for(const[name,from,to]of [['cadence','+105','+106'],['ammo','S.mag--','S.mag-=2'],['reload','S.reload=1.2','S.reload=1.3'],['walk speed','7.4:4.2','7.4:4.3']]){
 assert.ok(after.includes(from));check('negative mutation rejected: '+name,restore(after.replace(from,to))!==before);
}
git(['diff','--exit-code',base,'--','experiments/sunbreak-fable52','experiments/sunbreak-realistic-v2']);
check('all preserved v1/v2 tracked bytes untouched',true);
for(const name of ['weapon.js','audio.js','house-logic.js']){
 check(name+' source unchanged',lf(git(['show',base+':experiments/sunbreak-storm-v3/'+name]))===lf(readFileSync(new URL('../'+name,import.meta.url),'utf8')));
}
const report={base,date:new Date().toISOString(),method:'exact normalized inline module restoration with 11 bounded hooks; negative mutations; preserved version diff; not runtime or art acceptance',
 pass:checks.every(c=>c.pass),checks,hooks:rewrites.map(r=>r[0]),candidateSHA256:createHash('sha256').update(current).digest('hex')};
writeFileSync(new URL('./tactical-player-contract.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
