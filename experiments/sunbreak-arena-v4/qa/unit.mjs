import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {createTrigger,controlTarget,RELOAD_SECONDS,SHOT_INTERVAL_MS,reloadProgress,RELOAD_CUES} from '../combat-controls.js';
import {solveArm,sampleTrack} from '../reload-pose.js';
const repo=fileURLToPath(new URL('../../../',import.meta.url)),root=new URL('../',import.meta.url),results=[];
function test(name,fn){fn();results.push({name,pass:true})}
test('separate mouse and keyboard trigger sources',()=>{
 const t=createTrigger();assert.equal(t.held,false);t.setMouse(true);assert.equal(t.held,true);
 t.setKeyboard(true);t.setMouse(false);assert.equal(t.held,true);t.setKeyboard(false);assert.equal(t.held,false);
 t.setMouse(true);t.setKeyboard(true);t.clear();assert.deepEqual(t.snapshot(),{mouse:false,keyboard:false,held:false});
});
test('all UI and editable elements excluded from initiating controls',()=>{
 let selector;assert.equal(controlTarget({closest:s=>{selector=s;return {}}}),true);
 for(const tag of ['button','input','textarea','select','a','contenteditable','role="button"'])assert.ok(selector.includes(tag));
 assert.equal(controlTarget(null),false);assert.equal(controlTarget({closest:()=>null}),false);
});
test('one reload clock and mechanical cue order',()=>{
 assert.equal(SHOT_INTERVAL_MS,105);assert.equal(RELOAD_SECONDS,2.25);
 assert.equal(reloadProgress(RELOAD_SECONDS),0);assert.equal(reloadProgress(RELOAD_SECONDS/2),.5);assert.equal(reloadProgress(0),0);
 assert.ok(RELOAD_CUES.out<RELOAD_CUES.insert&&RELOAD_CUES.insert<1);
 const audio=readFileSync(new URL('audio.js',root),'utf8');
 assert.ok(!/delay:\s*\.70|setTimeout/.test(audio));assert.ok(audio.includes("type==='magout'")&&audio.includes("type==='magin'"));
});
test('smooth tracks hit all control points without range overshoot',()=>{
 const keys=[[0,0,0],[.3,1,-2],[.7,-.2,3],[1,0,0]];
 for(const k of keys)sampleTrack(keys,k[0]).forEach((v,i)=>assert.ok(Math.abs(v-k[i+1])<Number.EPSILON*4));
 for(let i=0;i<=1000;i++){const [a,b]=sampleTrack(keys,i/1000);assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&a<=1&&a>=-.2&&b>=-2&&b<=3)}
});
test('two bone IK preserves both limb lengths over complete workspace',()=>{
 const shoulder=new T.Vector3(-.409,-.311,.183),elbow=new T.Vector3(-.239,-.218,-.019),wrist=new T.Vector3(-.121,.027,-.334);
 for(let i=0;i<500;i++){
  const target=new T.Vector3(Math.sin(i*.17)*.8,Math.cos(i*.13)*.7,-.2+Math.sin(i*.07)*.8);
  const r=solveArm(T,shoulder,elbow,wrist,target);
  assert.ok(Math.abs(shoulder.distanceTo(r.elbow)-r.upper)<1e-10);assert.ok(Math.abs(r.elbow.distanceTo(r.wrist)-r.lower)<1e-10);
  assert.ok(r.elbow.toArray().every(Number.isFinite)&&r.wrist.toArray().every(Number.isFinite));
 }
});
const git=args=>execFileSync('git',args,{cwd:repo,encoding:'utf8',maxBuffer:8e6}).trim();
test('all three prior experiments unchanged from uploaded baseline',()=>{
 assert.equal(git(['diff','9008376cafd48e16160bc70ce374629f612e491f','--','experiments/sunbreak-fable52','experiments/sunbreak-realistic-v2','experiments/sunbreak-storm-v3']),'');
});
test('all untouched world, cover, character and house modules retain exact bytes',()=>{
 for(const name of ['world.js','actors.js','storm.js','storm-audio.js','timber-house.js','house-asset.js','house-logic.js','tactical-ai.js']){
  assert.equal(createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex'),
   createHash('sha256').update(readFileSync(new URL('../sunbreak-storm-v3/'+name,root))).digest('hex'),name);
 }
});
test('public entry uses shared parent assets and explicit v4 game modules',()=>{
 const html=readFileSync(new URL('index.html',root),'utf8');
 assert.ok(html.includes('<base href="../"/>'));
 for(const module of ['combat-controls','tactical-ai','audio','world','boot-ui'])assert.ok(html.includes('./v4/'+module+'.js'));
 assert.ok(!/arenaQA|loadedBuildHashes/.test(html));
 assert.ok(html.includes('4v4尚未开放'));
});
const sources=Object.fromEntries(['index.html','world.js','weapon.js','reload-pose.js','combat-controls.js','audio.js'].map(name=>[name,createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')]));
const report={schema:'sunbreak-auto-unit-v1',date:new Date().toISOString(),pass:true,results,sources};
writeFileSync(new URL('unit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(`PASS ${results.length} assertion groups including 500 IK targets, 1001 track samples, earlier-version and shared-module preservation`);
