import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const repo=new URL('../../../',import.meta.url),game=new URL('../',import.meta.url),base='8046a45d1267feaf800100f99b44e8a63909dd9c',checks=[];
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}),lf=s=>s.replaceAll('\r\n','\n');
const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(name,test)=>{try{test();checks.push({name,pass:true})}catch(e){checks.push({name,pass:false,error:e.message})}};
const source=name=>readFileSync(new URL(name,game),'utf8'),previous=name=>git(['show',base+':experiments/sunbreak-storm-v3/'+name]);
const moduleOf=s=>[...lf(s).matchAll(/<script type="module">([\s\S]*?)<\/script>/g)][0][1];
check('entire player/combat/NPC/input inline module byte-exact to last public source',()=>assert.equal(moduleOf(source('index.html')),moduleOf(previous('index.html'))));
for(const file of ['house-logic.js','audio.js','storm.js','storm-audio.js','actors.js','tactical-ai.js'])check(file+' byte-exact',()=>assert.equal(lf(source(file)),lf(previous(file))));
check('all v1/v2 tracked files preserved',()=>git(['diff','--exit-code',base,'--','experiments/sunbreak-fable52','experiments/sunbreak-realistic-v2']));
const current=source('timber-house.js'),old=previous('timber-house.js');
function slice(s,start,end){return s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)))}
check('wood grain UV logic unchanged',()=>assert.equal(lf(slice(current,'  for(let i=0;i<u.count;i++){','  const o=')),lf(slice(old,'  for(let i=0;i<u.count;i++){','  const o='))));
check('actual movement bound function unchanged',()=>assert.equal(lf(slice(current,'  blocksMovement(p,actor=','  update(dt,')),lf(slice(old,'  blocksMovement(p,actor=','  update(dt,'))));
check('all 723 editable tiles and 27 ridge caps exist in contract',()=>{
 const c=JSON.parse(source('assets/house/house-contract.json'));
 assert.equal(c.records.filter(r=>r.name.startsWith('RoofTile_')).length,723);
 assert.equal(c.records.filter(r=>r.name.startsWith('RoofRidge_')).length,27);
 assert.equal(c.records.filter(r=>r.cosmeticEditable).length,2);
});
const provenance=JSON.parse(source('weapon-provenance.json'));
for(const file of provenance.files)check(file.path+' original licensed source preserved',()=>assert.equal(hash(readFileSync(new URL(file.path,game))),file.sha256));
const packet=JSON.parse(source('authoring/timber-house/package-manifest.json'));
for(const file of packet.files)check('handoff checksum '+file.path,()=>assert.equal(hash(readFileSync(new URL('authoring/timber-house/'+file.path,game))),file.sha256));
check('ZIP exact allowlist and decompressed content checksums',()=>{
 const script="import zipfile,json,hashlib; z=zipfile.ZipFile('assets/house/timber-house-art-kit.zip'); m=json.loads(z.read('timber-house/package-manifest.json')); expected=['timber-house/'+f['path'] for f in m['files']]+['timber-house/package-manifest.json']; assert sorted(z.namelist())==sorted(expected); assert len(z.namelist())==len(set(z.namelist())); assert all(hashlib.sha256(z.read('timber-house/'+f['path'])).hexdigest()==f['sha256'] for f in m['files']); assert z.read('timber-house/package-manifest.json')==open('authoring/timber-house/package-manifest.json','rb').read(); print('20-file exact allowlist and all member SHA256 verified')";
 execFileSync('python',['-c',script],{cwd:game,encoding:'utf8'});
});
check('actual Blender mesh edit, not material-only/no-op',()=>{
 const r=JSON.parse(source('authoring/timber-house/blender-roundtrip.json'));assert.equal(r.blender,'5.3.0');assert.ok(r.edits.every(e=>e.verticesAfter>e.verticesBefore));
});
const report={schema:'sunbreak-roundtrip-preservation-v1',date:new Date().toISOString(),base,pass:checks.every(c=>c.pass),checks,method:'Exact source/data hashes and real generated asset checks; not runtime/art acceptance'};
writeFileSync(new URL('qa/roundtrip-contract.json',game),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,checks:checks.length,failed:checks.filter(c=>!c.pass)},null,2));if(!report.pass)process.exitCode=1;
