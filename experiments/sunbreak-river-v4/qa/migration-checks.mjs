// Read-only CPU contract tests for the collector. No browser, GPU, Git or writes.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {CDP,BASELINE,TIME,SUITES,VIEWS,sha,same,parseOptions,classifySuite,assertNative,assertCapture,assertMaterials,assertPair,pngDimensions,networkAudit,parseTree,validateTemporaryProfile} from './migration.mjs';

export async function runChecks() {
  const checks=[];
  const test=(name,fn)=>{fn();checks.push({name,pass:true})};
  const clone=value=>structuredClone(value);
  const source={'world.js':'a'.repeat(64),'qa/hooks.js':'b'.repeat(64)};
  const gpu={devices:[{vendorId:4318,deviceString:'NVIDIA RTX'}],featureStatus:{webgl:'enabled',webgl2:'enabled'},auxAttributes:{glRenderer:'ANGLE NVIDIA Direct3D11'}};
  const renderer='ANGLE (NVIDIA, NVIDIA GeForce RTX Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const camera={position:[...VIEWS[0].camera.slice(0,3)],quaternion:[0,0,0,1],fov:72};
  const s={camera,viewport:[1920,1080],buildHashes:source,presentation:true,errors:[],weapon:{loaded:true},weather:0,renderer};
  const capture={before:clone(s),snapshot:clone(s),canvas:{width:1920,height:1080},decoded:{width:1920,height:1080,nonBlackPixels:1000000,range:240,pixelSHA256:'1'.repeat(64)},
    info:{textureErrors:[],migration:{mode:'legacy',enabled:false,frozen:true,time:TIME},time:TIME,water:{time:TIME},weather:0,lighting:{rainVisible:false,flashIntensity:0},map:{crossings:[-23,-4,15]}}};
  const families=['mud','stone','plaster','wood'];
  const materials=families.map(family=>({name:family,procedural:true,definition:{family},maps:Object.fromEntries(['map','normalMap','roughnessMap'].map(slot=>[slot,{name:family+'-'+slot,source:'generated',size:[512,512],colorSpace:slot==='map'?'srgb':'',repeat:[1,1],mipmaps:true}]))}));
  const materialInfo={mode:'procedural',enabled:true,extraReflectionPasses:0,extraGeometry:0,legacyTextureURLs:['http://localhost/river/old.jpg'],materials,
    bake:{bakeMilliseconds:15,estimatedGPUBytes:16*1024*1024,retainedCPUBytes:12*1024*1024,textureCount:24,maps:clone([...families,'dirt','forest_ground_04','brick','metal'].flatMap(family=>['map','normalMap','roughnessMap'].map(slot=>({name:family+'-'+slot,family}))))},ground:{perFrameBakes:0,samplers:Object.fromEntries(['uDirtColor','uDirtNormal','uDirtRough','uForestColor','uForestNormal','uForestRough'].map(slot=>[slot,{name:(slot.startsWith('uDirt')?'dirt':'forest_ground_04')+'-'+(slot.endsWith('Color')?'map':slot.endsWith('Normal')?'normalMap':'roughnessMap'),source:'generated',size:[512,512],colorSpace:slot.endsWith('Color')?'srgb':'',mipmaps:true,coordinates:'world.xz / tileMetres',tileMetres:slot.startsWith('uDirt')?2.4:2.7}]))},analyticMaterials:[]};
  const accepts=()=>classifySuite({code:0,signal:null,error:null,stdout:'{"pass":true,"checks":12}',stderr:''},true);
  test('21 distinct historical suites, plus fixed eight-view acceptance set',()=>{
    assert.equal(SUITES.length,21);assert.equal(new Set(SUITES).size,21);
    assert.deepEqual(VIEWS.map(v=>v.name),['ground-lane','grazing-bank','stone-close','plaster-sun','timber-close','river-hero','river-wide','rainy-bank']);
    assert.equal(TIME,3);assert.equal(BASELINE,'84d7e0ac2fc5f3be11bc44980842e3ea2be26c0e');
  });
  test('default CPU phase and explicit visual phase',()=>{assert.equal(parseOptions([]).phase,'units');assert.equal(parseOptions(['--phase=visual']).phase,'visual')});
  test('temporary profile cleanup confines deletion to unique direct child',()=>{
    const parent=resolve('migration-test-tmp');
    assert.equal(validateTemporaryProfile(resolve(parent,'river-migration-profile-AbCd12'),parent),resolve(parent,'river-migration-profile-AbCd12'));
    for(const candidate of [parent,resolve(parent,'Default'),resolve(parent,'river-migration-profile-'),resolve(parent,'nested/river-migration-profile-AbCd12'),resolve(parent,'../river-migration-profile-AbCd12')])
      assert.throws(()=>validateTemporaryProfile(candidate,parent));
  });
  for(const args of [['--phase=benchmark'],['--unknown'],['--url=https://example.com/river/'],['--url=http://localhost/river/?public'],['--url=http://a:b@localhost/river/']])
    test('reject unsafe/unknown options '+args.join(' '),()=>assert.throws(()=>parseOptions(args)));
  test('canonical source identity ignores object insertion order, not bytes',()=>{assert.ok(same({b:2,a:1},{a:1,b:2}));assert.ok(!same(source,{...source,'world.js':'c'.repeat(64)}))});
  test('suite accepts JSON and historical assertion-backed Node output',()=>{assert.ok(accepts().pass);assert.ok(classifySuite({code:0,stdout:'{ pass: true, rays: 140 }'},true).pass)});
  for(const run of [{code:1,stdout:'{"pass":true}'},{code:0,stdout:''},{code:0,stdout:'{"pass":false}'},{code:0,stdout:'{ pass: false }'},{code:0,stdout:'{"verdict":"PENDING"}'},{code:null,signal:'SIGTERM',stdout:'ok'},{code:0,error:'spawn failed',stdout:'ok'}])
    test('suite fails closed '+JSON.stringify(run),()=>assert.equal(classifySuite(run,true).pass,false));
  test('test-source mutation cannot pass',()=>assert.equal(classifySuite({code:0,stdout:'{"pass":true}'},false).pass,false));
  test('successful JSON report may describe rejected negative-test fixtures',()=>assert.equal(classifySuite({code:0,stdout:JSON.stringify({pass:true,results:[{name:'reject { pass: false } and verdict: FAIL',pass:true}]})},true).pass,true));
  test('known native D3D11 accepted',()=>assertNative(renderer,gpu));
  for(const bad of [undefined,'unknown','ANGLE SwiftShader D3D11','ANGLE NVIDIA OpenGL','ANGLE Microsoft Basic Render Driver Direct3D11','ANGLE NVIDIA WARP Direct3D11'])
    test('reject native-unknown/software/non-D3D11 '+bad,()=>assert.throws(()=>assertNative(bad,gpu)));
  test('missing actual GPU inventory/features fails',()=>{assert.throws(()=>assertNative(renderer,{}));assert.throws(()=>assertNative(renderer,{...gpu,featureStatus:{webgl:'disabled_software'}}))});
  test('complete matched frame accepted',()=>assertCapture(capture,VIEWS[0],'legacy',source));
  for(const [name,mutate] of [
    ['canvas resolution',c=>c.canvas.width=1280],['decoded resolution',c=>c.decoded.width=1280],['blank canvas',c=>c.decoded.range=0],['UI-only/unbound pixels',c=>delete c.decoded.pixelSHA256],
    ['live simulation',c=>c.snapshot.presentation=false],['source drift',c=>c.snapshot.buildHashes['world.js']='changed'],['unknown clock',c=>delete c.info.migration.time],
    ['not frozen',c=>c.info.migration.frozen=false],['water clock drift',c=>c.info.water.time+=.1],['boot lightning',c=>c.info.lighting.flashIntensity=.5],
    ['wrong camera',c=>c.snapshot.camera.position[0]+=1],['console texture error',c=>c.snapshot.errors.push('missing texture')],['wrong mode',c=>c.info.migration.mode='procedural'],
    ['wrong weather',c=>c.info.weather=2],['weapon not loaded',c=>c.snapshot.weapon.loaded=false]
  ])test('capture rejects '+name,()=>{const c=clone(capture);mutate(c);assert.throws(()=>assertCapture(c,VIEWS[0],'legacy',source))});
  test('A/B exact source/camera/time/weather/lighting',()=>assertPair(capture,clone(capture)));
  for(const [name,mutate] of [['camera',c=>c.snapshot.camera.fov=71],['time',c=>c.info.time+=.01],['light',c=>c.info.lighting.rainVisible=true],['map',c=>c.info.map.crossings.push(0)]])
    test('pair rejects '+name+' drift',()=>{const c=clone(capture);mutate(c);assert.throws(()=>assertPair(capture,c))});
  test('actual attached generated PBR metadata accepted',()=>assertMaterials(materialInfo));
  test('mapless masonry cannot be falsely inventoried as baked',()=>{const m=clone(materialInfo);m.materials.push({name:'masonry-core',procedural:true,definition:{family:'brick'},maps:{}});assert.throws(()=>assertMaterials(m))});
  test('mapless analytic masonry separately inventoried',()=>{const m=clone(materialInfo);m.analyticMaterials.push({name:'masonry-core',bakedMaps:false,source:'original analytic mineral/clay shader'});assertMaterials(m)});
  test('missing custom terrain sampler rejected',()=>{const m=clone(materialInfo);delete m.ground.samplers.uForestNormal;assert.throws(()=>assertMaterials(m))});
  test('custom terrain sampler cannot use external pixels',()=>{const m=clone(materialInfo);m.ground.samplers.uDirtColor.source='external';assert.throws(()=>assertMaterials(m))});
  test('legacy empty generated whitelist accepted',()=>assertMaterials({...materialInfo,mode:'legacy',materials:[],bake:null}));
  for(const [name,mutate] of [['external map',m=>m.materials[0].maps.map.source='external'],['missing normal',m=>delete m.materials[0].maps.normalMap],['wrong color space',m=>m.materials[0].maps.normalMap.colorSpace='srgb'],['missing mipmaps',m=>m.materials[0].maps.map.mipmaps=false],['missing family',m=>m.materials.pop()],['missing bake binding',m=>m.materials[0].maps.map.name='other'],['added reflection',m=>m.extraReflectionPasses=1],['added geometry',m=>m.extraGeometry=1],['per-frame bake',m=>m.ground.perFrameBakes=1],['missing byte budget',m=>delete m.bake.estimatedGPUBytes]])
    test('material rejects '+name,()=>{const m=clone(materialInfo);mutate(m);assert.throws(()=>assertMaterials(m))});
  test('network audit ignores query/hash but retains external sky/riverbed',()=>{
    const requests=[{url:'http://localhost/river/soil.jpg?v=4'},{url:'http://localhost/river/assets/afterrain-detail/bed.jpg'},{url:'http://localhost/sky.hdr'}];
    const audit=networkAudit(requests,['http://localhost/river/soil.jpg'],'http://localhost/river/');
    assert.equal(audit.violations.length,1);assert.equal(audit.requests.length,3);
    assert.equal(networkAudit(requests.slice(1),audit.forbidden,'http://localhost/river/').violations.length,0);
  });
  test('PNG signature/actual IHDR; no filename-based resolution claim',()=>{
    const b=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(1920,16);b.writeUInt32BE(1080,20);
    assert.deepEqual(pngDimensions(b),[1920,1080]);assert.throws(()=>pngDimensions(Buffer.from('not a PNG')));
  });
  test('baseline tree preserves paths and raw object IDs',()=>{
    const parsed=parseTree(Buffer.from('100644 blob '+'f'.repeat(40)+'      15\texperiments/a file.js\0'));
    assert.equal(parsed[0].path,'experiments/a file.js');assert.equal(parsed[0].size,15);assert.throws(()=>parseTree(Buffer.from('bad\0')));
  });
  class FakeSocket extends EventTarget {
    readyState=WebSocket.OPEN;sent=[];
    send(payload){this.sent.push(JSON.parse(payload))}
    emit(type,values){const event=new Event(type);Object.assign(event,values);this.dispatchEvent(event)}
  }
  const socket=new FakeSocket(),cdp=new CDP(socket);
  const pending=cdp.send('Runtime.evaluate',{expression:'1+1'});
  socket.emit('message',{data:JSON.stringify({id:socket.sent[0].id,result:{result:{value:2}}})});
  assert.equal((await pending).result.value,2);assert.equal(cdp.pending.size,0);assert.ok(cdp.commands[0].responseBytes>0);
  checks.push({name:'CDP successful replies clear pending timers and record transport sizes',pass:true});
  const interrupted=cdp.send('Runtime.evaluate',{expression:'waitForever()'});
  const rejection=assert.rejects(interrupted,/code=1006.*pending Runtime.evaluate/);
  socket.emit('close',{code:1006,reason:'test disconnect',wasClean:false});await rejection;
  assert.equal(cdp.pending.size,0);assert.equal(cdp.transport[0].pending[0].method,'Runtime.evaluate');
  checks.push({name:'CDP disconnect retains close code/reason and interrupted method',pass:true});
  socket.readyState=WebSocket.CLOSED;
  await assert.rejects(cdp.send('Runtime.evaluate'),/not open/);assert.equal(cdp.pending.size,0);
  checks.push({name:'closed CDP cannot enqueue a hung command',pass:true});
  const throwing=new FakeSocket();throwing.send=()=>{throw Error('write failed')};const bad=new CDP(throwing);
  await assert.rejects(bad.send('Runtime.evaluate'),/write failed/);assert.equal(bad.pending.size,0);
  checks.push({name:'synchronous socket-write failure clears pending timers',pass:true});
  const files=['migration.mjs','migration-checks.mjs'],inputs={};
  for(const name of files)inputs['qa/'+name]=sha(await readFile(new URL(name,import.meta.url)));
  return {schema:'river-migration-harness-cpu-v1',pass:true,checks:checks.length,results:checks,inputs,limitations:'Synthetic CPU contract tests only; no browser, GPU, Git, game acceptance, benchmark or visual review.'};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await runChecks()));
