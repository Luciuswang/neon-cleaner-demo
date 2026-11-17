// Actual vendored geometry, extracted production helper, pinned pre-fix default.
// No renderer substitution; this numerical check is separate from canvas art QA.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as T from '../vendor/three/build/three.module.js';
const root=new URL('../',import.meta.url),baseline='6f6aa7c38dbce2370910b441759207dab2d0a836';
const read=name=>readFileSync(new URL(name,root),'utf8');
const moduleURL=new URL('vendor/three/build/three.module.js',root).href;
const roundedSource=read('vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js').replace("'three'",JSON.stringify(moduleURL));
const {RoundedBoxGeometry}=await import('data:text/javascript;base64,'+Buffer.from(roundedSource).toString('base64'));
const source=read('timber-house.js');
const old=execFileSync('git',['show',baseline+':experiments/sunbreak-storm-v3/timber-house.js'],{encoding:'utf8'});
const extract=s=>s.slice(s.indexOf(' function box('),s.indexOf(' function beam(')).trim();
const make=s=>new Function('T','RoundedBoxGeometry','staticRoot',`return (${extract(s)});`)(T,RoundedBoxGeometry,new T.Group());
const box=make(source),oldBox=make(old),material=new T.MeshStandardMaterial();
const checks=[],check=(name,fn)=>{try{fn();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}};
const mesh=(axis,dims=[4,.18,.22],bevel=true,fn=box)=>fn(...dims,material,1.3,2.1,-.8,new T.Group(),0,0,0,bevel,axis);
const close=(a,b)=>assert.ok(Math.abs(a-b)<2e-6,`${a} != ${b}`);
for(const [label,axis,dims]of [
 ['front','x',[8,.181,.22]],['rear','x',[3,.181,.22]],
 ['side-left','z',[.22,.181,6.4]],['side-right','z',[.22,.181,3]],
 ['gable','z',[.22,.18,4]],['front-lap','x',[.24,.14,.24]],
 ['side-lap','z',[.28,.16,.34]]
]){
 const g=mesh(axis,dims,!label.includes('lap')).geometry,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
 check(label+': grain U follows timber length on broad/top faces',()=>{
  let broad=0,top=0;
  for(let i=0;i<u.count;i++){
   const along=axis==='x'?'getX':'getZ',normalAlong=Math.abs(n[along](i));
   // Flat faces have an unambiguous physical axis; bevels are checked separately.
   if(normalAlong>.01||Math.max(Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i)))<.99)continue;
   close(u.getX(i),(p[along](i)+(axis==='x'?1.3:-.8))/1.9);
   if(Math.abs(n.getY(i))>.99){top++;close(u.getY(i),(axis==='x'?p.getZ(i)-.8:p.getX(i)+1.3)/1.9)}
   else{broad++;close(u.getY(i),(p.getY(i)+2.1)/1.9)}
  }
  assert.ok(broad>0&&top>0);
 });
 check(label+': both end caps have nonzero UV area',()=>{
  for(const sign of [-1,1]){
   let area=0;
   for(let i=0;i<(g.index?.count??p.count);i+=3){
    const ids=g.index?[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)]:[i,i+1,i+2];
    if(ids[2]===undefined||!ids.every(j=>sign*n[axis==='x'?'getX':'getZ'](j)>.99))continue;
    const [a,b,c]=ids;
    area+=Math.abs((u.getX(b)-u.getX(a))*(u.getY(c)-u.getY(a))-(u.getY(b)-u.getY(a))*(u.getX(c)-u.getX(a)))/2;
   }
   assert.ok(area>1e-5,`collapsed ${sign} end cap`);
  }
 });
 check(label+': bevel and face UV values are finite',()=>{
  assert.ok([...u.array].every(Number.isFinite));
 });
 check(label+': position/normal/index unchanged',()=>{
  const before=mesh(null,dims,!label.includes('lap'),oldBox).geometry;
  for(const key of ['position','normal'])assert.deepEqual(g.attributes[key].array,before.attributes[key].array);
  assert.deepEqual(g.index?.array,before.index?.array);
 });
}
check('door and unrelated default projections are byte-identical',()=>{
 for(const dims of [[1.2,2.49,.13],[.13,3.17,.13],[.215,.09,6.08],[2.15,.11,.74]]){
  for(const bevel of [false,true])assert.deepEqual(mesh(null,dims,bevel).geometry.attributes.uv.array,mesh(null,dims,bevel,oldBox).geometry.attributes.uv.array);
 }
});
check('only approved helper and wall-call opt-ins changed in runtime',()=>{
 const normalize=s=>s.replace(extract(s),'BOX_HELPER')
  .replace(/,staticRoot,0,0,0,false,'[xz]'\)/g,')')
  .replace(/,true,'[xz]'\)/g,',true)');
 assert.equal(normalize(source),normalize(old));
 assert.equal((source.match(/,true,'[xz]'\)/g)||[]).length,3);
 assert.equal((source.match(/,false,'[xz]'\)/g)||[]).length,3);
});
check('all scanned PBR maps retain same default UV channel/transform',()=>{
 // world.js is byte-identical to baseline and loader does not rotate channels.
 const world=read('world.js'),oldWorld=execFileSync('git',['show',baseline+':experiments/sunbreak-storm-v3/world.js'],{encoding:'utf8'});
 assert.equal(world,oldWorld);
 assert.ok(!/\.channel\s*=|\.rotation\s*=|\.repeat\.set/.test(world.slice(world.indexOf('async function loadMap'),world.indexOf('// Clones are refreshed'))));
 assert.ok(!/\.map\.|\.normalMap\.|\.roughnessMap\./.test(source));
});
const report={date:new Date().toISOString(),method:'actual vendored rounded/box geometry numerical UV checks; not visual QA',baseline,sourceSha256:createHash('sha256').update(source).digest('hex'),pass:checks.every(c=>c.pass),checks};
writeFileSync(new URL('./timber-uv-unit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.pass)process.exitCode=1;
