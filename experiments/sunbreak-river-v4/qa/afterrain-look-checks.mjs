// Synthetic CPU contract tests only: no browser, GPU, Git, filesystem writes,
// production implementation string matching, or historical report updates.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha, TIME, canonical} from './migration.mjs';
import {TASK, BASELINE, VIEWS, VARIANTS, parseOptions, variantURL, coverage, expectedCamera,
  assertLookCapture, assertLookPair, assertPreviousInvariants, diagnostics, sourceKey,
  assertNetworkSources, validateProfile, baselineSource} from './afterrain-look.mjs';

export async function runChecks(){
  const results=[],clone=v=>structuredClone(v);
  const test=(name,fn)=>{fn();results.push({name,pass:true})};
  const base='http://127.0.0.1:5190/river/';
  const sources={'world.js':'a'.repeat(64),'forest-floor.js':'b'.repeat(64),'../sunbreak-storm-v3/vendor/three/three.module.js':'c'.repeat(64)};
  const renderer='ANGLE (NVIDIA, NVIDIA GeForce RTX Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const gpu={devices:[{vendorId:4318}],featureStatus:{webgl:'enabled',webgl2:'enabled'},auxAttributes:{glRenderer:renderer}};
  // IHDR test envelope, not a rendered scene. Browser-only PNG decode is never
  // claimed by these fixtures; the collector independently decodes saved bytes.
  const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
  png.write('IHDR',12);png.writeUInt32BE(1920,16);png.writeUInt32BE(1080,20);
  const fixture=(variant='previous',view=VIEWS[0])=>{
    const config=VARIANTS[variant];
    const cabinTransform=view.cabin?{point:{x:20,y:3,z:-10},origin:{x:1,y:0,z:2},forward:{x:0,y:0,z:2}}:null;
    const {position,quaternion}=expectedCamera(view,cabinTransform);
    const snapshot={camera:{position,quaternion,fov:72},viewport:[1920,1080],weather:view.weather,buildHashes:clone(sources),
      renderer,presentation:true,errors:[],weapon:{loaded:true}};
    const info={textureErrors:[],time:TIME,weather:view.weather,water:{time:TIME},map:{crossings:[-23,-4,15],houses:12},
      lighting:{rainVisible:view.weather===2,splashVisible:view.weather===2,flashIntensity:0,rainRippleStrength:view.weather===2?1:0,sunIntensity:config.enabled?6:4,ambientIntensity:config.enabled?.5:.8,exposure:config.enabled?1.05:1.08},
      afterrain:config.enabled?{enabled:true,look:'afterrain',light:{sun:6},forest:{triangles:170000,drawCalls:8,shadowCalls:0,shadowTriangles:0},
        puddles:config.materials==='procedural'?{planeY:0,resolution:[768,432],samples:0,maxPassesPerMainFrame:1,frames:4,enabled:true,estimatedColorBytes:768*432*8}:null}
        :{enabled:false,look:'previous',forest:null,puddles:null,light:null},
      migration:{mode:config.materials,enabled:config.materials==='procedural',frozen:true,time:TIME,extraReflectionPasses:config.enabled?1:0,extraGeometry:config.enabled?100:0,
        bake:config.materials==='procedural'?{maps:['fixture']} :null,ground:config.materials==='procedural'?{perFrameBakes:0}:null,materials:config.materials==='procedural'?[{fixture:true}]:[]}};
    return {before:clone(snapshot),snapshot,info,beforeInfo:clone(info),canvas:{width:1920,height:1080},baseURL:base,url:variantURL(base,variant),cabinTransform,
      decoded:{width:1920,height:1080,nonBlackPixels:1000000,range:240,pixelSHA256:'1'.repeat(64),pngSHA256:sha(png)}};
  };
  const check=(c,view=VIEWS[0],variant='previous')=>assertLookCapture(c,view,variant,sources,gpu,png);

  test('default CPU-only; full visual covers all seven views and two procedural routes',()=>{
    const o=parseOptions([]);assert.equal(o.phase,'units');assert.equal(o.explicitSelection,false);
    assert.deepEqual(o.views,VIEWS.map(v=>v.name));assert.deepEqual(o.variants,['previous','current']);
    assert.equal(VIEWS.length,7);assert.equal(new Set(o.views).size,7);assert.equal(TIME,3);
    assert.equal(parseOptions(['--phase=visual']).phase,'visual');assert.match(BASELINE,/^[a-f0-9]{40}$/);assert.equal(TASK,'river-afterrain-light-understory-2026-11-20');
  });
  test('sunny/storm lane cameras identical; cabin uses west-buffer transform',()=>{
    const a=VIEWS.find(v=>v.name==='ground-lane'),b=VIEWS.find(v=>v.name==='storm-ground-lane');
    assert.deepEqual(a.camera,b.camera);assert.equal(a.weather,0);assert.equal(b.weather,2);
    assert.equal(VIEWS.find(v=>v.name==='cabin-edge').cabin,'west-buffer');
  });
  test('selection parser records explicit partial scope and preserves requested order',()=>{
    const o=parseOptions(['--views=forest-hillside,ground-lane','--variants=current,previous']);
    assert.deepEqual(o.views,['forest-hillside','ground-lane']);assert.deepEqual(o.variants,['current','previous']);assert.equal(o.explicitSelection,true);
  });
  test('optional legacy variants and +legacy aliases',()=>{
    assert.deepEqual(parseOptions(['--variants=previous+legacy,current+legacy']).variants,['previous-legacy','current-legacy']);
    for(const variant of Object.keys(VARIANTS)){
      const u=new URL(variantURL(base,variant));assert.equal(u.searchParams.get('materials'),VARIANTS[variant].materials);
      assert.equal(u.searchParams.get('look'),VARIANTS[variant].look);
    }
    assert.ok(!new URL(variantURL(base,'current')).searchParams.has('look'),'current tests actual default route');
  });
  for(const args of [['--bad'],['--phase=benchmark'],['--views='],['--views=ground-lane,'],['--views=nope'],['--views=ground-lane,ground-lane'],
    ['--variants=legacy'],['--variants=previous-legacy,previous+legacy'],['--phase=units','--phase=visual'],['--url=https://localhost/river/'],
    ['--url=http://example.com/river/'],['--url=http://name:secret@localhost/river/'],['--url=http://localhost/river/#fragment'],
    ['--url=http://localhost/river/?public'],['--url=http://localhost/river/?look=previous'],['--url=http://localhost/'],['--url=http://localhost/river/?materials=legacy']])
    test('reject invalid/ambiguous options '+args.join(' '),()=>assert.throws(()=>parseOptions(args)));
  test('IPv6 and localhost loopback supported',()=>{parseOptions(['--url=http://[::1]:5190/river/']);parseOptions(['--url=http://localhost:5190/river/'])});

  const captures=VIEWS.flatMap(view=>['previous','current'].map(variant=>({view,variant,pass:true})));
  const pairs=VIEWS.map(view=>({view:view.name,a:'previous',b:'current',pass:true}));
  test('only complete default capture/pair coverage can claim full technical pass',()=>assert.equal(coverage(parseOptions([]),captures,pairs).full,true));
  test('explicit selection cannot become full even if every view was listed',()=>assert.equal(coverage(parseOptions(['--views='+VIEWS.map(v=>v.name).join(',')]),captures,pairs).full,false));
  test('single-variant and single-view iteration cannot pass full gate',()=>{
    assert.equal(coverage(parseOptions(['--variants=current']),captures.filter(c=>c.variant==='current'),[]).full,false);
    assert.equal(coverage(parseOptions(['--views=ground-lane']),captures.filter(c=>c.view.name==='ground-lane'),pairs.slice(0,1)).full,false);
  });
  test('duplicate/missing/failed captures and absent pairs cannot satisfy coverage',()=>{
    assert.equal(coverage(parseOptions([]),captures.slice(1).concat(captures[1]),pairs).full,false);
    assert.equal(coverage(parseOptions([]),captures,pairs.slice(1)).full,false);
    const c=clone(captures);c[0].pass=false;assert.equal(coverage(parseOptions([]),c,pairs).full,false);
    const p=clone(pairs);p[0].pass=false;assert.equal(coverage(parseOptions([]),captures,p).full,false);
  });
  for(const variant of Object.keys(VARIANTS))for(const view of VIEWS)
    test('valid '+variant+' / '+view.name,()=>check(fixture(variant,view),view,variant));
  test('camera convention preserves intended yaw/pitch while allowing existing roll',()=>{
    const c=fixture(),q=c.snapshot.camera.quaternion,[x,y,z,w]=q,s=Math.sin(.01),co=Math.cos(.01);
    c.snapshot.camera.quaternion=[x*co+y*s,y*co-x*s,z*co+w*s,w*co-z*s];c.before=clone(c.snapshot);check(c);
  });
  test('expected forward for identity and yaw quarter-turn',()=>{
    assert.deepEqual(expectedCamera({camera:[1,2,3,0,0]}).position,[1,2,3]);
    assert.ok(Math.abs(expectedCamera({camera:[0,0,0,Math.PI/2,0]}).forward[0]+1)<1e-12);
  });
  for(const [name,mutate] of [
    ['canvas resolution',c=>c.canvas.width=1280],['decoded resolution',c=>c.decoded.height=720],['blank pixels',c=>c.decoded.nonBlackPixels=0],
    ['pixel hash absent',c=>delete c.decoded.pixelSHA256],['decoded PNG binding',c=>c.decoded.pngSHA256='2'.repeat(64)],
    ['impossible pixel count',c=>c.decoded.nonBlackPixels=1920*1080+1],['source drift',c=>c.snapshot.buildHashes['world.js']='changed'],
    ['source drift inside callback',c=>c.before.buildHashes['world.js']='changed'],['camera position',c=>c.snapshot.camera.position[0]+=1],
    ['wrong yaw',c=>{c.snapshot.camera.quaternion=[0,0,0,1];c.before=clone(c.snapshot)}],['non-unit quaternion',c=>c.snapshot.camera.quaternion=c.snapshot.camera.quaternion.map(x=>x*2)],
    ['invalid fov',c=>c.snapshot.camera.fov=0],['weather mismatch',c=>c.info.weather=2],['clock drift',c=>c.info.time=3.01],
    ['water clock drift',c=>c.info.water.time=2],['unfrozen clock',c=>c.info.migration.frozen=false],['time in callback',c=>c.beforeInfo.time=2],
    ['light in callback',c=>c.beforeInfo.lighting.exposure=4],['missing pre-capture state',c=>delete c.beforeInfo],
    ['boot lightning',c=>c.info.lighting.flashIntensity=1],['live game',c=>c.snapshot.presentation=false],['unloaded weapon',c=>c.snapshot.weapon.loaded=false],
    ['texture failure',c=>c.info.textureErrors.push('texture failed')],['runtime texture failure',c=>c.snapshot.errors.push('error')],
    ['material mode',c=>c.info.migration.mode='legacy'],['missing bake',c=>c.info.migration.bake=null],['per-frame bake',c=>c.info.migration.ground.perFrameBakes=1],
    ['missing route marker',c=>delete c.info.afterrain],['wrong route',c=>c.info.afterrain.enabled=true],['wrong document route',c=>c.url=variantURL(base,'current')],
    ['software renderer',c=>c.snapshot.renderer='ANGLE SwiftShader D3D11']
  ])test('capture rejects '+name,()=>{const c=fixture();mutate(c);assert.throws(()=>check(c))});
  test('cabin transform must independently bind actual camera',()=>{
    const view=VIEWS.find(v=>v.cabin),c=fixture('previous',view);c.cabinTransform.point.x+=1;assert.throws(()=>check(c,view));
    delete c.cabinTransform;assert.throws(()=>check(c,view));
  });
  test('PNG header and native GPU inventory validated',()=>{
    assert.throws(()=>assertLookCapture(fixture(),VIEWS[0],'previous',sources,gpu,Buffer.from('bad')));
    assert.throws(()=>assertLookCapture(fixture(),VIEWS[0],'previous',sources,{},png));
  });
  for(const [name,mutate] of [
    ['look label',i=>i.afterrain.look='afterrain'],['afterrain enabled',i=>i.afterrain.enabled=true],['forest created',i=>i.afterrain.forest={}],
    ['reflection created',i=>i.afterrain.puddles={}],['light created',i=>i.afterrain.light={}],['unknown null state',i=>delete i.afterrain.forest],
    ['reflection pass',i=>i.migration.extraReflectionPasses=1],['extra geometry',i=>i.migration.extraGeometry=1],
    ['declared extra reflection',i=>i.afterrain.extraReflectionPasses=1],['declared extra geometry',i=>i.afterrain.extraGeometry=1]
  ])test('previous invariants reject '+name,()=>{const i=fixture().info;mutate(i);assert.throws(()=>assertPreviousInvariants(i))});
  test('previous legacy simultaneously disables new look and procedural bake',()=>{
    const c=fixture('previous-legacy');check(c,VIEWS[0],'previous-legacy');c.info.migration.bake={};assert.throws(()=>check(c,VIEWS[0],'previous-legacy'));
  });
  for(const [name,mutate] of [
    ['missing light',i=>i.afterrain.light=null],['missing forest',i=>i.afterrain.forest=null],['too many triangles',i=>i.afterrain.forest.triangles=180001],
    ['too many forest draws',i=>i.afterrain.forest.drawCalls=9],['forest shadow draw',i=>i.afterrain.forest.shadowCalls=1],
    ['missing puddle reflection',i=>i.afterrain.puddles=null],['wrong reflection plane',i=>i.afterrain.puddles.planeY=-1],
    ['wrong target size',i=>i.afterrain.puddles.resolution=[1920,1080]],['extra reflection pass',i=>i.afterrain.puddles.maxPassesPerMainFrame=2],
    ['MSAA target',i=>i.afterrain.puddles.samples=4],['unrendered reflection',i=>i.afterrain.puddles.frames=0],['target byte budget',i=>i.afterrain.puddles.estimatedColorBytes=1]
  ])test('current metadata rejects '+name,()=>{
    const c=fixture('current');mutate(c.info);c.beforeInfo=clone(c.info);assert.throws(()=>check(c,VIEWS[0],'current'));
  });
  test('intentional lighting/material/render-cost differences allowed in pair',()=>{
    assertLookPair(fixture('previous'),fixture('current'));
    assertLookPair(fixture('previous-legacy'),fixture('current'));
    assertLookPair(fixture('previous'),fixture('previous-legacy'));
  });
  for(const [name,mutate] of [
    ['camera',c=>c.snapshot.camera.fov=71],['viewport',c=>c.snapshot.viewport[0]=1280],['weather',c=>c.snapshot.weather=2],
    ['source',c=>c.snapshot.buildHashes['world.js']='x'],['map',c=>c.info.map.crossings.push(0)],['time',c=>c.info.time=4],
    ['water',c=>c.info.water.time=4],['migration clock',c=>c.info.migration.time=4],['migration freeze',c=>c.info.migration.frozen=false],
    ['rain visibility',c=>c.info.lighting.rainVisible=true],['flash',c=>c.info.lighting.flashIntensity=1],['renderer',c=>c.snapshot.renderer='other'],
    ['presentation',c=>c.snapshot.presentation=false],['missing camera',c=>delete c.snapshot.camera],['splash effect',c=>c.info.lighting.splashVisible=true]
  ])test('pair rejects '+name+' drift',()=>{const c=fixture('current');mutate(c);assert.throws(()=>assertLookPair(fixture(),c))});
  test('pair cannot accept two equally wrong clocks',()=>{const a=fixture(),b=fixture('current');a.info.time=b.info.time=2;assert.throws(()=>assertLookPair(a,b))});

  const request=(url,key)=>({url,type:'Script',finished:true,status:200,fromDiskCache:false,fromServiceWorker:false,bodySHA256:sources[key]});
  const requests=[request(base+'world.js?bound=1','world.js'),request(base+'forest-floor.js','forest-floor.js'),request(new URL('../vendor/three/three.module.js',base).href,'../sunbreak-storm-v3/vendor/three/three.module.js')];
  test('network binding covers all served local/shared scripts',()=>{assert.equal(assertNetworkSources(requests,sources,base).length,3);assert.equal(sourceKey(requests[2].url,base),'../sunbreak-storm-v3/vendor/three/three.module.js')});
  for(const [name,mutate] of [
    ['stale bytes',r=>r[0].bodySHA256='d'.repeat(64)],['missing body',r=>delete r[0].bodySHA256],['unfinished script',r=>r[0].finished=false],
    ['HTTP error',r=>r[0].status=404],['service worker',r=>r[0].fromServiceWorker=true],['disk cache',r=>r[0].fromDiskCache=true],
    ['unbound script',r=>r.push(request(base+'unexpected.js','world.js'))],['external script',r=>r[0].url='http://example.com/world.js'],
    ['world absent',r=>r.shift()],['encoded traversal',r=>r[0].url=base+'a%2f..%2fworld.js']
  ])test('network rejects '+name,()=>{const r=clone(requests);mutate(r);assert.throws(()=>assertNetworkSources(r,sources,base))});
  test('script type forces audit even without JS suffix',()=>assert.throws(()=>assertNetworkSources([...requests,request(base+'opaque','world.js')],sources,base)));
  test('texture/console/HTTP/runtime/crash errors retained, warning excluded',()=>{
    const events=[{method:'Runtime.exceptionThrown',params:{}},{method:'Inspector.targetCrashed',params:{}},
      {method:'Runtime.consoleAPICalled',params:{type:'error'}},{method:'Log.entryAdded',params:{entry:{level:'error'}}},
      {method:'Network.loadingFailed',params:{}},{method:'Network.responseReceived',params:{response:{status:404}}},
      {method:'Runtime.consoleAPICalled',params:{type:'warning'}}];
    assert.equal(diagnostics(events).length,6);
  });
  test('temporary profile cleanup cannot target user profile, parent, or nested path',()=>{
    const dir=resolve('afterrain-fixture-temp');assert.equal(validateProfile(resolve(dir,'river-afterrain-profile-ABC123'),dir),resolve(dir,'river-afterrain-profile-ABC123'));
    for(const p of [dir,resolve(dir,'Default'),resolve(dir,'river-afterrain-profile-'),resolve(dir,'nested/river-afterrain-profile-ABC123'),resolve(dir,'../river-afterrain-profile-ABC123')])assert.throws(()=>validateProfile(p,dir));
  });
  test('baseline source policy includes gameplay/modules/manifests; historical evidence audited separately',()=>{
    for(const path of ['experiments/old/index.html','experiments/old/module.js','experiments/old/qa/checks.mjs','experiments/old/asset-sources.json'])assert.equal(baselineSource(path),true);
    for(const path of ['experiments/old/qa/evidence/run/state.json','experiments/old/qa/report.json','experiments/old/qa/evidence/run.png'])assert.equal(baselineSource(path),false);
  });
  test('canonical identity ignores property ordering but preserves bytes',()=>{
    assert.equal(canonical({a:1,b:2}),canonical({b:2,a:1}));assert.notEqual(sha('a\r\n'),sha('a\n'));
  });
  const inputs={};for(const name of ['afterrain-look.mjs','afterrain-look-checks.mjs','migration.mjs','source-binding.mjs'])inputs['qa/'+name]=sha(await readFile(new URL(name,import.meta.url)));
  return {schema:'river-afterrain-look-harness-cpu-v1',task:TASK,pass:true,checks:results.length,results,inputs,
    limitations:'Synthetic CPU contracts only. No browser/GPU/Git, file writes, current-build captures, historical preservation execution, art, gameplay or performance acceptance.'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await runChecks()));
