/* Inline-scope diagnostic: append inside the game's module, after qa-hooks.js.
 * Auto-runs on /test only after the original 19-check smoke-result is appended.
 * Read window.sunbreakRuntimeQA.done (Promise), .result, or #runtime-result.
 * Manual rerun: sunbreakRuntimeQA.run({update, render}); callbacks must be sync.
 * No fetch, file writes, gameplay ticks, input events or baseline-game edits.
 */
(() => {
  'use strict';
  if (window.sunbreakRuntimeQA) throw Error('Runtime diagnostic already installed');
  const api = {version: 'sunbreak-runtime-proxies-v1', result: null, running: false};
  let resolveDone;
  api.done = new Promise(resolve => { resolveDone = resolve; });
  window.sunbreakRuntimeQA = api;
  const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const serialize = value => JSON.stringify(value, (_key, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
  // Stable diagnostic checksum, not a cryptographic provenance hash. Geometry
  // equality below also compares the complete numeric buffers, not just hashes.
  function checksum(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  function geometryData(g) {
    if (!g) return null;
    const attributes = {};
    for (const name of Object.keys(g.attributes).sort()) {
      const a = g.attributes[name];
      attributes[name] = {itemSize: a.itemSize, normalized: a.normalized, type: a.array?.constructor.name,
        data: a.isInterleavedBufferAttribute ? Array.from({length: a.count * a.itemSize}, (_, i) => a.data.array[Math.floor(i / a.itemSize) * a.data.stride + a.offset + i % a.itemSize]) : Array.from(a.array)};
    }
    return {attributes, index: g.index ? Array.from(g.index.array) : null, groups: g.groups.map(g => ({...g})), drawRange: {...g.drawRange}};
  }
  const transform = o => ({position: o.position.toArray(), rotation: o.rotation.toArray(), quaternion: o.quaternion.toArray(), scale: o.scale.toArray(), matrix: o.matrix.toArray(), matrixWorld: o.matrixWorld.toArray(), matrixAutoUpdate: o.matrixAutoUpdate, matrixWorldAutoUpdate: o.matrixWorldAutoUpdate});
  const boxData = b => ({min: b.min.toArray(), max: b.max.toArray()});
  function compare(a, b, tolerance = 0, path = '$', out = []) {
    if (out.length >= 24 || Object.is(a, b)) return out;
    if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance) return out;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
      out.push({path, before: a, after: b}); return out;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in a) || !(k in b)) out.push({path: path + '.' + k, before: a[k] ?? null, after: b[k] ?? null});
      else compare(a[k], b[k], tolerance, path + '.' + k, out);
      if (out.length >= 24) break;
    }
    return out;
  }
  function gameSnapshot() {
    return {state: {...S}, pos: pos.toArray(), vel: vel.toArray(), vy, onGround, bob, recoil, keys: {...keys}, drag, lx, ly, plOK,
      camera: {...transform(cam), fov: cam.fov, aspect: cam.aspect, projection: cam.projectionMatrix.toArray(), inverseProjection: cam.projectionMatrixInverse.toArray(), inverseWorld: cam.matrixWorldInverse.toArray()},
      gunCamera: {...transform(gcam), fov: gcam.fov, aspect: gcam.aspect, projection: gcam.projectionMatrix.toArray()},
      gun: transform(gun), muzzle: {transform: transform(muz), intensity: muz.intensity},
      enemyState: enemies.map(e => ({hp: e.hp, alive: e.alive, cd: e.cd, ph: e.ph, warn: e.warn,
        nodes: Object.fromEntries(['g', 'll', 'rl', 'la', 'ra', 'wg2', 'gunTip'].map(k => [k, transform(e[k])]))})),
      ray: {origin: ray.ray.origin.toArray(), direction: ray.ray.direction.toArray(), near: ray.near, far: ray.far},
      tracers: tracers.map(t => ({id: t.l.uuid, t: t.t, opacity: t.l.material.opacity}))};
  }
  function proxySnapshot() {
    return {colliders: colliders.map(boxData), proxies: solids.map(o => {
      const nodes = [];
      o.traverse(n => nodes.push({id: n.uuid, parent: n.parent?.uuid ?? null, transform: transform(n), visible: n.visible, layers: n.layers.mask,
        geometryId: n.geometry?.uuid ?? null, geometry: geometryData(n.geometry), side: n.material ? (Array.isArray(n.material) ? n.material.map(m => m.side) : n.material.side) : null}));
      return {nodes};
    })};
  }
  function compactProxies(snapshot) {
    return {colliderChecksum: checksum(serialize(snapshot.colliders)), colliders: snapshot.colliders,
      proxies: snapshot.proxies.map((p, i) => ({i, nodes: p.nodes.map(({geometry, ...n}) => ({...n, geometryChecksum: checksum(serialize(geometry)), vertexCount: geometry?.attributes.position?.data.length / 3 || 0}))}))};
  }
  // Independent reconstruction of the ORIGINAL 18 solid registrations only.
  // Literal parameters/formula copied from preserved fable52, never from world.js.
  function originalProxies() {
    const root = new THREE.Group(), material = new THREE.MeshBasicMaterial(), meshes = [], bounds = [];
    function add(geometry, p, rotation = 0, parent = root, pad = 0) {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...p); mesh.rotation.y = rotation; parent.add(mesh);
      mesh.updateWorldMatrix(true, true); meshes.push(mesh); bounds.push(new THREE.Box3().setFromObject(mesh).expandByScalar(pad));
    }
    for (const [x, z, w, d, h, r] of [[-13,-16,9,7,4.2,0],[12,-18,8,8,5.2,0],[-21,4,7,11,4.6,Math.PI/2],[20,6,8,10,4,0],[-4,-27,11,6,3.6,0]]) {
      const parent = new THREE.Group(); parent.position.set(x,0,z); parent.rotation.y = r; root.add(parent);
      add(new THREE.BoxGeometry(w,h,d), [0,h/2,0], 0, parent);
    }
    add(new THREE.BoxGeometry(46,.5,3.4), [0,.25,18.2]);
    for (const [x,z,r] of [[-6,2,.2],[5,-4,-.3],[8,8,.5],[-14,10,.8],[0,-12,0],[14,-6,.4]]) add(new THREE.BoxGeometry(1.5,1.3,1.5), [x,.65,z], r);
    for (const [x,z,h] of [[-9,9,5.2],[10,12,6],[-18,-6,5.6],[18,-3,5],[2,14,5.8],[-24,14,6.2]]) {
      const parent = new THREE.Group(); parent.position.set(x,0,z); root.add(parent);
      const curve = new THREE.CatmullRomCurve3([0,.25,.5,.75,1].map(t => vec(Math.sin(t*1.6)*t*t*.8,t*h,Math.cos(t*2.2)*t*t*.4)));
      const g = new THREE.TubeGeometry(curve,18,.3,10,false), pa = g.attributes.position, uv = g.attributes.uv;
      for (let i=0;i<pa.count;i++) {const t=uv.getX(i),c=curve.getPoint(t),s=1-t*.55;pa.setXYZ(i,c.x+(pa.getX(i)-c.x)*s,pa.getY(i),c.z+(pa.getZ(i)-c.z)*s);}
      pa.needsUpdate=true;g.computeVertexNormals();add(g,[0,0,0],0,parent,.05);
    }
    root.updateMatrixWorld(true);
    return {meshes, bounds, dispose() {for (const o of meshes) o.geometry.dispose(); material.dispose(); root.clear();}};
  }
  function probeDefinitions(expected) {
    const probes=[];
    expected.bounds.forEach((b,i) => {
      const c=b.getCenter(vec());
      for(const [axis,label] of [['x','x'],['y','y'],['z','z']]) for(const sign of [-1,1]) {
        const origin=c.clone();origin[axis]=(sign<0?b.min[axis]:b.max[axis])+sign*3;
        const direction=vec();direction[axis]=-sign;
        probes.push({name:`proxy-${i}-${label}-${sign}`,origin:origin.toArray(),direction:direction.toArray(),far:140,target:i});
      }
      // Eye-height central and grazing rays; expected misses remain useful.
      for(const x of [c.x,b.min.x+.005,b.max.x-.005]) probes.push({name:`proxy-${i}-eye-${x}`,origin:[x,1.7,b.max.z+3],direction:[0,0,-1],far:140,target:i});
    });
    for(const [i,[x,z]] of SPAWN.entries()) {
      const origin=SPAWNPOS.clone(), direction=vec(x,1,z).sub(origin), distance=direction.length();direction.normalize();
      probes.push({name:`spawn-to-enemy-${i}`,origin:origin.toArray(),direction:direction.toArray(),far:distance,target:null});
      probes.push({name:`enemy-to-spawn-${i}`,origin:[x,1,z],direction:direction.negate().toArray(),far:distance,target:null});
    }
    return probes;
  }
  function runProbes(objects, definitions) {
    const r = new THREE.Raycaster(), owner = new Map(); objects.forEach((o,i)=>o.traverse(n=>owner.set(n,i)));
    return definitions.map(p=>{
      r.set(vec(...p.origin),vec(...p.direction));r.near=0;r.far=p.far;
      const hit = hits => hits.length ? {proxy:owner.get(hits[0].object),distance:hits[0].distance,point:hits[0].point.toArray()} : null;
      return {name:p.name,first:hit(r.intersectObjects(objects,true)),target:p.target===null?null:hit(r.intersectObject(objects[p.target],true))};
    });
  }
  function publish(report) {
    api.result=report;document.body.dataset.runtimeQA=report.verdict;
    let node=document.getElementById('runtime-result');
    if(!node){node=document.createElement('script');node.type='application/json';node.id='runtime-result';document.body.appendChild(node);}
    node.textContent=serialize(report);resolveDone(report);return report;
  }
  api.run = function ({update,render}={}) {
    if(api.running) throw Error('Runtime diagnostic already running');
    const smokePanel=document.getElementById('smoke-result');
    let smokeResult;try{smokeResult=JSON.parse(smokePanel?.textContent||'null');}catch{}
    if(!smokeResult || smokeResult.checks?.length!==19 || !smokeResult.checks.every(c=>c.pass===true))
      return publish({version:api.version,verdict:'BLOCKED',reason:'Run after all 19 original smoke fixtures pass; no state changed.'});
    if(S.state==='play' || Object.values(keys).some(Boolean) || drag || S.aimHold)
      return publish({version:api.version,verdict:'BLOCKED',reason:'Requires idle post-smoke state, released input and no active gameplay.'});
    if(!visual || ![0,1,2].includes(visual.info().weatherIndex))
      return publish({version:api.version,verdict:'BLOCKED',reason:'Visual layer/weather diagnostics unavailable.'});
    api.running=true;
    const report={version:api.version,startedAt:new Date().toISOString(),verdict:'RUNNING',scope:'Synchronous post-initialization frozen-render diagnostics; not live gameplay or visual QA',
      callbacks:{update:update?'custom':'visual.update',render:render?'custom':'world composer plus weapon pass'},checks:[],phases:[],cases:[],
      tolerances:{geometry:0,gameplayState:0,matrices:1e-9,rayDistanceAndPoint:1e-7},
      limitations:['No pre-buildWorld interception: independent reconstruction checks original registered geometry/bounds/matrices after initialization.',
        'No asynchronous callbacks, input/AI/combat progression, performance measurement, visible-cover validation or visual quality verdict.',
        'RNG instrumentation covers synchronous callback invocations only, not initialization, asynchronous work, previously cached RNG aliases or crypto randomness.',
        'Geometry/collider checksums are FNV-1a32 diagnostics; exact geometry buffer comparisons are also performed.',
        'Invoked render/update calls advance renderer statistics; collect performance evidence on a fresh reload. No game reset is performed.']};
    const saved={pres,si,weather:visual.info().weatherIndex,autoClear:rnd.autoClear};
    const nativeRandom=Math.random;
    let expected,before,initialGame,baselineProbes,definitions,originalRefs,geometryRefs,colliderRefs;
    const check=(name,pass,detail=null)=>report.checks.push({name,pass:!!pass,detail});
    function measure(label,fn){
      const record={label,randomCalls:0,randomStacks:[],error:null};
      Math.random=function(){record.randomCalls++;if(record.randomStacks.length<3)record.randomStacks.push(new Error('RNG call').stack);return nativeRandom();};
      try{const result=fn();if(result&&typeof result.then==='function')throw Error('Callbacks must be synchronous; async work is outside this diagnostic');}
      catch(e){record.error=String(e?.stack||e);}finally{Math.random=nativeRandom;report.phases.push(record);}
      check(label+' completed',!record.error,record.error);
      check(label+' consumes no global RNG',record.randomCalls===0,{calls:record.randomCalls});
    }
    function invariants(label){
      const snap=proxySnapshot(), game=gameSnapshot();
      check(label+' gameplay state unchanged',compare(initialGame,game).length===0,compare(initialGame,game));
      check(label+' proxy state unchanged',compare(before,snap,1e-9).length===0,compare(before,snap,1e-9));
      check(label+' proxy/geometry/collider identity unchanged',solids.length===originalRefs.length&&colliders.length===colliderRefs.length&&solids.every((o,i)=>o===originalRefs[i]&&o.geometry===geometryRefs[i])&&colliders.every((b,i)=>b===colliderRefs[i]));
    }
    try{
      // All setup/probes allocate outside the instrumented callback window.
      // No await: smoke, animation frames, timers and user input cannot interleave.
      pres=true;
      scene.updateMatrixWorld(true);gscene.updateMatrixWorld(true);cam.updateMatrixWorld(true);gcam.updateMatrixWorld(true);
      expected=originalProxies();definitions=probeDefinitions(expected);
      originalRefs=solids.slice();geometryRefs=solids.map(o=>o.geometry);colliderRefs=colliders.slice();
      check('original count: 18 solids and 18 colliders',solids.length===18&&colliders.length===18);
      if(solids.length!==18||colliders.length!==18)throw Error('Cannot pair original 18 proxies');
      check('collider bounds match original construction',compare(expected.bounds.map(boxData),colliders.map(boxData),1e-9).length===0,compare(expected.bounds.map(boxData),colliders.map(boxData),1e-9));
      for(let i=0;i<18;i++){
        check(`proxy ${i} exact original geometry`,serialize(geometryData(expected.meshes[i].geometry))===serialize(geometryData(solids[i].geometry)));
        check(`proxy ${i} original world matrix`,compare(expected.meshes[i].matrixWorld.toArray(),solids[i].matrixWorld.toArray(),1e-9).length===0);
        check(`proxy ${i} no added raycast descendants`,solids[i].children.length===0);
      }
      const expectedProbes=runProbes(expected.meshes,definitions);baselineProbes=runProbes(solids,definitions);
      check('raycast results match independent original proxies',compare(expectedProbes,baselineProbes,1e-7).length===0,compare(expectedProbes,baselineProbes,1e-7));
      before=proxySnapshot();initialGame=gameSnapshot();
      report.baseline={...compactProxies(before),gameplay:initialGame,probeCount:definitions.length,probeDefinitions:definitions,probeResults:baselineProbes,expectedProbeResults:expectedProbes};
      const doUpdate=update||(()=>visual.update(1/60,{S,pres:true,cam,gun,live:false}));
      const doRender=render||(()=>{rnd.autoClear=true;visual.render();rnd.autoClear=false;rnd.clearDepth();rnd.render(gscene,gcam);rnd.autoClear=true;});
      for(const style of [0,1])for(const weather of [0,1,2]){
        const label=`style-${style}/weather-${weather}`;
        measure(label+'/switch',()=>{si=style;applyStyle();visual.setWeather(weather);});invariants(label+'/switch');
        for(let repeat=0;repeat<2;repeat++){
          measure(label+`/update-${repeat}`,()=>doUpdate({dt:1/60,S,pres:true,cam,gun,live:false}));invariants(label+`/update-${repeat}`);
          measure(label+`/render-${repeat}`,()=>doRender({cam,gcam,scene,gscene,rnd}));invariants(label+`/render-${repeat}`);
        }
        const result=runProbes(solids,definitions), diffs=compare(baselineProbes,result,1e-7);
        check(label+' raycast invariance',diffs.length===0,diffs);
        report.cases.push({style,weather,colliderChecksum:checksum(serialize(colliders.map(boxData))),raycastChecksum:checksum(serialize(result)),raycastDifferences:diffs});
      }
    }catch(e){check('diagnostic completed',false,String(e?.stack||e));}
    finally{
      Math.random=nativeRandom;
      try{measure('restore style/weather',()=>{si=saved.si;applyStyle();visual.setWeather(saved.weather);});}
      finally{pres=saved.pres;rnd.autoClear=saved.autoClear;Math.random=nativeRandom;expected?.dispose();api.running=false;}
      if(initialGame){check('final gameplay state unchanged',compare(initialGame,gameSnapshot()).length===0,compare(initialGame,gameSnapshot()));}
      check('presentation/style/weather restored',pres===saved.pres&&si===saved.si&&visual.info().weatherIndex===saved.weather);
    }
    report.finishedAt=new Date().toISOString();report.verdict=report.checks.every(c=>c.pass)?'PASS':'FAIL';
    report.rngCalls=report.phases.reduce((n,p)=>n+p.randomCalls,0);
    report.failedChecks=report.checks.filter(c=>!c.pass).map(c=>c.name);
    return publish(report);
  };
  // Event-driven completion gate, never a fixed sleep that can race fixtures.
  if(location.pathname==='/test'){
    const launch=()=>{if(!document.getElementById('smoke-result'))return false;queueMicrotask(()=>api.run());return true;};
    if(!launch()){
      const observer=new MutationObserver(()=>{if(launch())observer.disconnect();});
      observer.observe(document.body,{childList:true});
    }
  }
})();
