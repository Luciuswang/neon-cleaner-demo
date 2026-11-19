import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const baseline='d5b2114d07e1496824b6b788757364412e18908e',prefix='experiments/sunbreak-river-v4/',sha=x=>createHash('sha256').update(x).digest('hex'),git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:8e6});
let checks=0;
const preserved=['map-layout.js','tactical-ai.js','reload-pose.js','actors.js','audio.js','combat-controls.js','storm-audio.js','terrain-ray.js','buffer-house.js','buffer-house-logic.js','house-logic.js','ruins.js','fracture-geometry.js'];
for(const file of preserved){assert.equal((await readFile(new URL('../'+file,import.meta.url),'utf8')).replaceAll('\r\n','\n'),git('show',baseline+':'+prefix+file).replaceAll('\r\n','\n'),file);checks++}
let index=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replaceAll('\r\n','\n');
for(const line of ["import {createShotFeedbackAdapter} from './river/shot-feedback-event.js';",'const shotFeedback=createShotFeedbackAdapter(THREE,solids,()=>visual?.waterTime()||0);',' visual?.shot(shotFeedback.event({cam,gun,wall,best,end,direction:dir}));',' visual?.resetFeedback();']){assert.equal(index.split(line).length,2,'exact one visual hook');index=index.replace(line+'\n','');checks++}
assert.equal(index,git('show',baseline+':'+prefix+'index.html').replaceAll('\r\n','\n'),'entire original gameplay HTML exact after four presentation-only insertions');checks++;
assert.equal(git('diff',baseline,'--','experiments/sunbreak-fable52','experiments/sunbreak-realistic-v2','experiments/sunbreak-storm-v3','experiments/sunbreak-arena-v4').trim(),'','four earlier demos untouched');checks++;
console.log(JSON.stringify({pass:true,checks,baseline,preserved,indexWithoutVisualHooks:sha(index),scope:'exact prior gameplay/control/damage/ammo/reload/AI contract, all prior demos; weapon display intentionally changed'}));
