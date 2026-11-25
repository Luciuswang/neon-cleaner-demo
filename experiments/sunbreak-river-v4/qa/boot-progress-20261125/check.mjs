// Offline lifecycle test: no WebGL, network, real timers, or synthetic progress.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
const read=n=>readFileSync(new URL(n,root),'utf8');
const html=read('index.html'), code=read('boot-ui.js');
assert.match(html,/<progress [^>]*id="bootBar"/);
assert.match(html,/id="bStart" disabled/);
assert.equal(html.indexOf('id="bootStatus"')<html.indexOf('id="bStart"'),true);
assert.equal([...html.matchAll(/id="bootStatus"/g)].length,1);
const desktopPoints=[...read('world.js').matchAll(/riverBootStep\?\.\((\d+),'([^']+)'\)/g)];
assert.ok(desktopPoints.length>=4);
function fixture(){
  const nodes={}, handlers=new Map(),body={dataset:{}};
  function element(tag='div',id=''){return {tagName:tag.toUpperCase(),id,style:{},children:[],textContent:'',setAttribute(k,v){this[k]=v},appendChild(e){this.children.push(e);e.parentNode=this;return e},contains(e){return this.children.includes(e)},remove(){this.removed=true}}}
  for(const id of ['menu','bootStatus','bootBar','bootLabel','bootTime','bStart','err'])nodes[id]=element('div',id);
  nodes.menu.appendChild(nodes.bootStatus);nodes.menu.appendChild(nodes.bStart);
  let clock=0,timer,notify,reloads=0;
  const w={document:{body,getElementById:id=>nodes[id],createElement:tag=>element(tag)},Date:{now:()=>clock},
    location:{protocol:'https:',reload(){reloads++}},setInterval:fn=>(timer=fn,1),clearInterval(){timer=null},
    MutationObserver:class{constructor(fn){notify=fn}observe(){}disconnect(){notify=null}},
    addEventListener:(k,f)=>handlers.set(k,f),removeEventListener:k=>handlers.delete(k)};
  w.window=w;vm.runInNewContext(code,w);
  return {w,nodes,advance(ms){clock+=ms;timer?.()},ready(){body.dataset.qa='{"state":"menu"}';notify?.()},fail(){handlers.get('error')?.({target:{tagName:'SCRIPT'},message:'network failure'})},reloads:()=>reloads};
}
const a=fixture();assert.ok(a.nodes.bStart.disabled);
a.w.riverBootStage='建立 WebGL 渲染器';a.w.riverBootStage='建立河谷场景 / river/world.js';
let prev=a.nodes.bootBar.value;for(const [,step,label] of desktopPoints){a.w.riverBootStep(+step,label);assert.ok(a.nodes.bootBar.value>=prev);prev=a.nodes.bootBar.value}
a.advance(22000);assert.equal(a.nodes.bootBar.value,prev);assert.match(a.nodes.bootTime.textContent,/22/);assert.match(a.nodes.bootTime.textContent,/等待/);
const retry=a.nodes.bootStatus.children.find(n=>n.tagName==='BUTTON');assert.ok(retry);retry.onclick();assert.equal(a.reloads(),1);
a.w.riverBootStage='首帧渲染';assert.ok(a.nodes.bStart.disabled);a.ready();assert.equal(a.nodes.bStart.disabled,false);assert.match(a.nodes.bootLabel.textContent,/就绪/);
const m=fixture();m.w.riverBootStage='移动河谷 / 天空';assert.match(m.nodes.bootLabel.textContent,/天空/);m.w.riverBootStage='移动河谷 / 生态';assert.match(m.nodes.bootLabel.textContent,/生态/);assert.equal(m.w.riverBootStage,'移动河谷 / 生态');
const f=fixture();f.fail();assert.match(f.nodes.err.textContent,/加载失败/);f.ready();assert.ok(f.nodes.bStart.disabled);const er=f.nodes.err.children.find(n=>n.tagName==='INPUT'&&n.type==='button'||n.tagName==='BUTTON');assert.ok(er);er.onclick();assert.equal(f.reloads(),1);
console.log('PASS: static start gate, desktop and mobile milestones, stall without invented progress, actionable failure, and ready gate');
