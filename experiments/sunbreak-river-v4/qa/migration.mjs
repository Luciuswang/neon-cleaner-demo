// CPU by default; --phase=visual is for the root integrator's serialized GPU slot.
// No desktop/window capture, input, focus, benchmark, server launch or Git mutation.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, createReadStream} from 'node:fs';
import {readFile, writeFile, readdir, mkdir, mkdtemp, stat, rm} from 'node:fs/promises';
import {resolve, relative, dirname, basename, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

export const GAME = fileURLToPath(new URL('../', import.meta.url));
const REPO = resolve(GAME, '../..');
const PREFIX = 'experiments/sunbreak-river-v4/';
export const BASELINE = '84d7e0ac2fc5f3be11bc44980842e3ea2be26c0e';
export const TIME = 3;
export const SUITES = Object.freeze(['map-checks','terrain-rays','ai-movement','village-checks','fracture-checks','buffer-checks','landscape-checks','riverbank-checks','afterrain-assets-checks','vegetation-clumps','water-checks','wildbank-checks','surface-checks','masonry-materials-checks','height-fog-checks','downloaded-dressing-checks','environment-polish-checks','shot-feedback-event-checks','polish-preservation-checks','stone-cover-checks','combat-feedback-checks']);
const EXTRA = ['procedural-materials-checks', 'procedural-ground-checks', 'migration-checks'];
const MODES = {'map-checks':['--polish'], 'masonry-materials-checks':['--polish']};
export const VIEWS = Object.freeze([
  {name:'ground-lane', camera:[-10,2.3,12,.65,-.9], weather:0},
  {name:'grazing-bank', camera:[-4.7,.8,10,-.12,-.10], weather:0},
  {name:'stone-close', camera:[-7.8,1.5,10.5,0,-.20], weather:0},
  {name:'plaster-sun', camera:[-21,1.6,-25,-1.27,-.08], weather:0},
  {name:'timber-close', cabin:'west-buffer', camera:[-2.5,2,7.5,0,0], weather:0},
  {name:'river-hero', camera:[-7,1.7,24,-.24,-.1], weather:0},
  {name:'river-wide', camera:[0,16,33,0,-.60], weather:0},
  {name:'rainy-bank', camera:[-4.7,1.7,10,-.12,-.32], weather:2}
]);
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const same = (a,b) => canonical(a) === canonical(b);
const delay = ms => new Promise(r=>setTimeout(r,ms));
const writeNew = (path, data) => writeFile(path, data, {flag:'wx'});
export function validateTemporaryProfile(profile,base=tmpdir()) {
  const absolute=resolve(profile),parent=resolve(base);
  assert.equal(dirname(absolute),parent,'profile must be a direct child of the declared temporary directory');
  assert.ok(basename(absolute).startsWith('river-migration-profile-')&&basename(absolute).length>'river-migration-profile-'.length,'profile must be this harness\'s unique generated directory');
  return absolute;
}

export function parseOptions(args) {
  const options = {phase:'units', url:process.env.RIVER_QA_URL || 'http://127.0.0.1:5190/river/'};
  for (const arg of args) {
    if (arg === '--help') options.help = true;
    else if (arg.startsWith('--phase=')) options.phase = arg.slice(8);
    else if (arg.startsWith('--url=')) options.url = arg.slice(6);
    else throw Error('Unknown option: '+arg);
  }
  assert.ok(['units','visual'].includes(options.phase), 'phase must be units or visual');
  const url = new URL(options.url);
  assert.ok(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname), 'local QA server only');
  assert.ok(!url.searchParams.has('public') && !url.username && !url.password && !url.hash, 'QA hooks required; no credentials/hash');
  return options;
}

export function classifySuite(run, unchanged) {
  let parsed;
  try { parsed = JSON.parse(run.stdout); } catch { /* Historical suites use Node inspection. */ }
  const explicitFailure = parsed?.pass === false || ['FAIL','BLOCKED','PENDING'].includes(parsed?.verdict) ||
    (!parsed && /\bpass\s*:\s*false\b|\bverdict\s*:\s*['"]?(?:FAIL|BLOCKED|PENDING)\b/.test(run.stdout || ''));
  return {pass:run.code === 0 && !run.signal && !run.error && !!run.stdout?.trim() && unchanged && !explicitFailure,
    result:parsed ?? {stdout:run.stdout}, testUnchanged:unchanged};
}

export function assertNative(renderer, gpu) {
  assert.equal(typeof renderer, 'string', 'renderer must be known');
  assert.match(renderer, /(?:Direct3D11|D3D11)/i, 'actual renderer must use D3D11');
  assert.match(renderer, /NVIDIA|GeForce|Quadro|RTX|AMD|Radeon|Intel|Arc\b/i, 'known native hardware renderer required');
  assert.doesNotMatch(renderer, /swiftshader|software|llvmpipe|basic render|WARP|unknown/i);
  assert.ok(gpu?.devices?.some(d=>Number.isInteger(d.vendorId) && d.vendorId > 0), 'GPU device identity required');
  assert.ok(Object.entries(gpu.featureStatus || {}).some(([k,v])=>/^webgl/.test(k) && /^enabled/.test(v)), 'native WebGL feature status required');
  const actual = gpu.auxAttributes?.glRenderer;
  if (actual) {
    assert.match(actual, /Direct3D11|D3D11/i);
    assert.doesNotMatch(actual, /swiftshader|software|llvmpipe|basic render|WARP|unknown/i);
  }
}

export function assertCapture(capture, view, mode, sources) {
  const {snapshot:s, info:m, canvas, before} = capture;
  assert.deepEqual([canvas?.width,canvas?.height], [1920,1080], 'actual canvas, full 1080p');
  assert.deepEqual(s?.viewport, [1920,1080]);
  assert.ok(s.presentation, 'game simulation paused through view()');
  assert.deepEqual(s.errors, [], 'runtime texture errors');
  assert.deepEqual(m.textureErrors, [], 'map texture errors');
  assert.ok(s.weapon?.loaded, 'weapon loading complete');
  assert.ok(same(s.buildHashes, sources), 'loaded runtime hashes match disk before capture');
  assert.ok(same(before.camera,s.camera), 'camera stable in capture callback');
  assert.ok(same(before.buildHashes,s.buildHashes), 'source identity stable in capture callback');
  assert.equal(m.migration?.mode, mode);
  assert.equal(m.migration?.enabled, mode === 'procedural');
  assert.equal(m.migration?.frozen, true);
  assert.equal(m.migration?.time, TIME);
  assert.equal(m.time, TIME, 'world clock frozen');
  assert.equal(m.water?.time, TIME, 'water clock frozen');
  assert.equal(m.weather, view.weather);
  assert.equal(s.weather, view.weather);
  assert.equal(m.lighting?.rainVisible, view.weather === 2);
  assert.equal(m.lighting?.flashIntensity, 0, 'no boot-dependent lightning');
  assert.ok(Array.isArray(s.camera?.position) && s.camera.position.length === 3 && s.camera.position.every(Number.isFinite));
  assert.ok(Array.isArray(s.camera?.quaternion) && s.camera.quaternion.length === 4 && s.camera.quaternion.every(Number.isFinite));
  assert.ok(Number.isFinite(s.camera.fov));
  if (!view.cabin) assert.deepEqual(s.camera.position, view.camera.slice(0,3), 'requested camera position');
  assert.ok(capture.decoded?.width === 1920 && capture.decoded?.height === 1080, 'PNG decoded at actual canvas size');
  assert.ok(capture.decoded?.nonBlackPixels > 1920*1080*.01 && capture.decoded?.range > 8, 'canvas must contain rendered scene pixels');
  assert.match(capture.decoded?.pixelSHA256 || '', /^[a-f0-9]{64}$/, 'decoded pixel binding required');
}

export function assertMaterials(migration) {
  assert.equal(migration.extraReflectionPasses,0);assert.equal(migration.extraGeometry,0);
  assert.ok(Array.isArray(migration.legacyTextureURLs) && migration.legacyTextureURLs.length>0, 'primary URL whitelist required');
  assert.ok(Array.isArray(migration.materials), 'actual material inventory required');
  if(migration.mode==='legacy') {assert.deepEqual(migration.materials,[]);assert.equal(migration.bake,null);return}
  const {bake,ground,materials}=migration;
  assert.ok(bake && ground && materials.length>0, 'bake, ground and attached materials required');
  assert.ok(Number.isFinite(bake.bakeMilliseconds) && bake.bakeMilliseconds>=0,'record boot bake duration');
  assert.ok(Number.isInteger(bake.estimatedGPUBytes) && bake.estimatedGPUBytes>0 && bake.estimatedGPUBytes<=40*1024*1024,'existing generator 40MiB budget');
  assert.ok(Number.isInteger(bake.retainedCPUBytes) && bake.retainedCPUBytes>0,'record retained CPU bytes');
  assert.ok(Array.isArray(bake.maps) && bake.maps.length===bake.textureCount && bake.textureCount>0,'baked map inventory');
  assert.equal(ground.perFrameBakes,0);
  const bakedNames=new Set(bake.maps.map(m=>m.name)),families=new Set();
  for(const family of ['mud','dirt','forest_ground_04','stone','plaster','wood','brick','metal'])
    assert.ok(bake.maps.some(m=>m.family===family),'bake family provenance missing '+family);
  for (const m of materials) {
    assert.equal(m.procedural,true);assert.ok(m.definition?.family,'material definition required');
    assert.ok(m.maps && typeof m.maps==='object','attached map inventory required');
    // Mapless analytic masonry is recorded separately, never as a baked surface.
    families.add(m.definition.family);
    for (const slot of ['map','normalMap','roughnessMap']) assert.ok(m.maps?.[slot],'required attached map '+slot);
    for (const [slot,t] of Object.entries(m.maps)) {
      assert.equal(t.source,'generated','external primary map '+m.name+'/'+slot);
      assert.ok(bakedNames.has(t.name),'attached map absent from bake inventory '+t.name);
      assert.ok(Array.isArray(t.size) && t.size.length===2 && t.size.every(v=>Number.isInteger(v)&&v>=512&&(v&(v-1))===0));
      assert.equal(t.colorSpace,slot==='map'?'srgb':'','sRGB albedo versus linear data');
      assert.equal(t.mipmaps,true);assert.ok(t.repeat?.length===2&&t.repeat.every(v=>Number.isFinite(v)&&v>0));
    }
  }
  for(const family of ['mud','stone','plaster','wood'])assert.ok(families.has(family),'attached primary family missing '+family);
  assert.deepEqual(Object.keys(ground.samplers).sort(),['uDirtColor','uDirtNormal','uDirtRough','uForestColor','uForestNormal','uForestRough'].sort(),'all custom terrain samplers required');
  for(const [slot,t]of Object.entries(ground.samplers)){
    assert.equal(t.source,'generated');assert.ok(bakedNames.has(t.name));
    assert.deepEqual(t.size,[512,512]);assert.equal(t.colorSpace,slot.endsWith('Color')?'srgb':'');assert.equal(t.mipmaps,true);
    assert.equal(t.coordinates,'world.xz / tileMetres');assert.equal(t.tileMetres,slot.startsWith('uDirt')?2.4:2.7);
  }
  assert.ok(Array.isArray(migration.analyticMaterials));
  for(const m of migration.analyticMaterials){assert.equal(m.bakedMaps,false);assert.equal(m.source,'original analytic mineral/clay shader')}
}

export function assertPair(a,b) {
  for (const key of ['camera','viewport','weather','buildHashes']) assert.ok(same(a.snapshot[key],b.snapshot[key]), 'A/B '+key+' mismatch');
  for (const key of ['time','lighting','map']) assert.ok(same(a.info[key],b.info[key]), 'A/B '+key+' mismatch');
  assert.equal(a.info.migration.time, b.info.migration.time);
}

export function pngDimensions(bytes) {
  assert.ok(bytes.length >= 33 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'PNG signature');
  assert.equal(bytes.toString('ascii',12,16), 'IHDR');
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}

export function cleanURL(value, base) {
  const u = new URL(value,base); u.search = ''; u.hash = ''; return u.href;
}
export function networkAudit(requests, forbidden, base) {
  const denied = new Set(forbidden.map(u=>cleanURL(u,base)));
  return {scope:'Only primary migrated ground/wood/plaster/stone maps. Riverbed, sky/HDR, foliage, models and other unchanged resources remain external and are listed.',
    forbidden:[...denied].sort(), violations:requests.filter(r=>denied.has(cleanURL(r.url,base))), requests};
}
async function primaryURLs(base) {
  const read = async p=>JSON.parse(await readFile(resolve(GAME,p),'utf8'));
  const [local,ground,shared] = await Promise.all([read('asset-sources.json'),read('ground-surface-assets.json'),read('../sunbreak-storm-v3/assets-manifest.json')]);
  // Resolve against the document's existing <base href="../">.
  const documentBase = new URL('../',base);
  return [...local.assets.filter(a=>a.kind==='surface' && ['brown_mud_02','rocky_gravel','brick_moss_001'].includes(a.id)).flatMap(a=>a.files.map(f=>new URL(f.path,documentBase).href)),
    ...ground.assets.flatMap(a=>a.files.map(f=>new URL('river/'+f.file,documentBase).href)),
    ...shared.assets.filter(a=>['wall_worn_plaster','wood_weathered'].includes(a.semantic_role)).flatMap(a=>a.files.map(f=>new URL(f.path,documentBase).href))];
}

async function sourceSnapshot() {
  const {runtimeHashes} = await import('./source-binding.mjs');
  return {runtime:await runtimeHashes(), harness:Object.fromEntries(await Promise.all(['migration.mjs','migration-checks.mjs','run-polish-units.mjs'].map(async n=>[n,sha(await readFile(new URL(n,import.meta.url)))])))};
}
async function historicalReports() {
  const out = {};
  async function visit(dir) {
    for (const d of await readdir(dir,{withFileTypes:true})) {
      if (d.name.startsWith('migration-') && dirname(dir) === resolve(GAME,'qa')) continue;
      const p=resolve(dir,d.name);
      if (d.isDirectory()) await visit(p);
      else if (d.isFile() && d.name.endsWith('.json')) out[relative(GAME,p).split(sep).join('/')]=sha(await readFile(p));
    }
  }
  await visit(resolve(GAME,'qa')); return out;
}

const PROTECTED = ['index.html','map-layout.js','tactical-ai.js','reload-pose.js','actors.js','weapon.js','audio.js','combat-controls.js','storm-audio.js','terrain-ray.js','buffer-house.js','buffer-house-logic.js','house-logic.js','timber-house.js','village.js','ruins.js','fracture-geometry.js','shot-feedback-event.js','combat-feedback.js','stone-cover.js'];
const DEMOS = ['sunbreak-fable52','sunbreak-realistic-v2','sunbreak-storm-v3','sunbreak-arena-v4','procedural-material-lab'].map(p=>'experiments/'+p);
export function parseTree(bytes) {
  return bytes.toString('utf8').split('\0').filter(Boolean).map(line=>{
    const m=line.match(/^(\d+) (\w+) ([\da-f]+)\s+(\d+|-)\t(.+)$/s);
    assert.ok(m,'git ls-tree record');return {mode:m[1],type:m[2],oid:m[3],size:Number(m[4]),path:m[5]};
  });
}
async function fileDigests(path) {
  const size=(await stat(path)).size, blob=createHash('sha1').update(`blob ${size}\0`), raw=createHash('sha256');
  for await (const part of createReadStream(path)) { blob.update(part); raw.update(part); }
  return {bytes:size,blob:blob.digest('hex'),sha256:raw.digest('hex')};
}
async function preservation() {
  // Read-only Git object inspection only, never index/checkout/fetch/commit.
  // Historical suites already require git show/diff. The worker does not run
  // this phase while the root owns the in-flight integration.
  const git=(...args)=>execFileSync('git',args,{cwd:REPO,windowsHide:true,maxBuffer:32e6});
  const paths=[...PROTECTED.map(p=>PREFIX+p),...SUITES.map(p=>PREFIX+'qa/'+p+'.mjs'),PREFIX+'qa/run-polish-units.mjs',...DEMOS];
  const entries=parseTree(git('ls-tree','-r','-l','-z',BASELINE,'--',...paths));
  const results=[];
  for (const p of paths) assert.ok(entries.some(e=>e.path===p || e.path.startsWith(p+'/')), 'baseline target absent: '+p);
  for (const e of entries) {
    assert.equal(e.type,'blob','unsupported baseline entry '+e.path);
    try {
      const current=await fileDigests(resolve(REPO,e.path));
      let pass=current.blob===e.oid, format='raw-git-blob', expected=e.oid;
      if (!pass && e.size<1024) {
        const pointer=git('cat-file','blob',e.oid).toString('utf8').match(/^version https:\/\/git-lfs.github.com\/spec\/v1\noid sha256:([\da-f]{64})\nsize (\d+)\n?$/);
        if (pointer) { format='LFS-materialized-bytes';expected=pointer[1];pass=current.sha256===expected && current.bytes===Number(pointer[2]); }
      }
      let lineEndingOnly=false;
      if(!pass && e.size<200000 && current.bytes<200000 && /\.(log|json|md|txt|js|mjs|html)$/.test(e.path)){
        const normalize=b=>b.toString('utf8').replaceAll('\r\n','\n');
        lineEndingOnly=normalize(await readFile(resolve(REPO,e.path)))===normalize(git('cat-file','blob',e.oid));
      }
      // Diagnostic only: never converts a byte-integrity failure into PASS.
      results.push({path:e.path,pass,format,expected,...current,...!pass?{lineEndingOnly}:{}});
    } catch(error) { results.push({path:e.path,pass:false,error:String(error)}); }
  }
  const additions=git('ls-files','--others','--exclude-standard','-z','--',...DEMOS).toString('utf8').split('\0').filter(Boolean);
  // New tracked files in a previous demo are also changes, even if all old bytes survived.
  const tracked=git('ls-files','-z','--',...DEMOS).toString('utf8').split('\0').filter(Boolean);
  const known=new Set(entries.map(e=>e.path));
  additions.push(...tracked.filter(p=>!known.has(p)));
  return {pass:results.every(r=>r.pass)&&!additions.length,baseline:BASELINE,bytePolicy:'raw bytes; no newline normalization; materialized LFS SHA256 checked',results,additions};
}

async function runNode(file,args,output) {
  return new Promise(resolveRun=>{
    const child=spawn(process.execPath,[file,...args],{cwd:REPO,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,TMP:output,TEMP:output,TMPDIR:output}});
    let stdout='',stderr='',error=null,total=0;
    const timer=setTimeout(()=>{error='suite timeout after 180s';child.kill()},180000);
    for (const [stream,key] of [[child.stdout,'stdout'],[child.stderr,'stderr']]) stream.on('data',chunk=>{
      total+=chunk.length;if(total>32e6){error='suite output exceeded 32MB';child.kill();return}
      if(key==='stdout')stdout+=chunk;else stderr+=chunk;
    });
    child.on('error',e=>{error=e.stack});
    child.on('close',(code,signal)=>{clearTimeout(timer);resolveRun({code,signal,error,stdout,stderr})});
  });
}
async function units(report,output) {
  const historicalBefore=await historicalReports();report.historicalBefore=historicalBefore;
  report.units={};report.required=SUITES;report.additionalRequired=EXTRA;
  try {
    assert.equal(SUITES.length,21);assert.equal(new Set(SUITES).size,21);
    const declared=await readFile(new URL('run-polish-units.mjs',import.meta.url),'utf8');
    const names=declared.match(/const names=\[([^\]]+)\]/)?.[1].match(/'([^']+)'/g)?.map(s=>s.slice(1,-1));
    assert.deepEqual(names,SUITES,'retain every historical suite in original order');
    for (const name of [...SUITES,...EXTRA]) {
      const file=resolve(GAME,'qa',name+'.mjs'),args=['--stdout-only',...(MODES[name]||[])];
      const integrationSources=name==='procedural-materials-checks'?['procedural-materials.js']:name==='procedural-ground-checks'?['procedural-materials.js','procedural-ground.js']:[];
      if (EXTRA.includes(name) && (!existsSync(file) || integrationSources.some(n=>!existsSync(resolve(GAME,n))))) {
        report.units[name]={pass:false,verdict:'PENDING',reason:'integration suite not present yet',args};continue;
      }
      try {
        const before=sha(await readFile(file)),run=await runNode(file,args,output);
        report.units[name]={...run,...classifySuite(run,before===sha(await readFile(file))),args,testSHA256:before};
      } catch(error) { report.units[name]={pass:false,error:error.stack,args}; }
      console.log(name+': '+(report.units[name].pass?'PASS':'FAIL'));
    }
    try { report.preservation=await preservation(); } catch(error) {report.preservation={pass:false,error:error.stack,baseline:BASELINE};}
  } finally {
    report.historicalAfter=await historicalReports();
    report.historicalUnchanged=same(historicalBefore,report.historicalAfter);
  }
  report.integrationPending=EXTRA.filter(n=>report.units[n]?.verdict==='PENDING');
  report.pass=report.historicalUnchanged && report.preservation?.pass===true && [...SUITES,...EXTRA].every(n=>report.units[n]?.pass===true);
  report.verdict=report.pass?'PASS':report.integrationPending.length && SUITES.every(n=>report.units[n]?.pass)&&report.preservation?.pass&&report.historicalUnchanged?'PENDING':'FAIL';
}

export class CDP {
  constructor(socket) {
    this.socket=socket;this.sequence=0;this.pending=new Map();this.events=[];this.listeners=[];this.transport=[];this.commands=[];
    const rejectPending=reason=>{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error(reason+'; pending '+p.method))}this.pending.clear()};
    socket.addEventListener('message',event=>{
      try {
        const m=JSON.parse(event.data),p=this.pending.get(m.id);
        if(p){clearTimeout(p.timer);this.pending.delete(m.id);Object.assign(p.command,{finished:new Date().toISOString(),responseBytes:Buffer.byteLength(event.data),error:m.error});m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}
        else {this.events.push(m);for(const listener of this.listeners)listener(m)}
      }catch(error){this.transport.push({kind:'message-error',error:error.stack});rejectPending('CDP message processing failed: '+error.message)}
    });
    socket.addEventListener('error',event=>{this.transport.push({kind:'socket-error',at:new Date().toISOString(),message:event.message,error:event.error?.stack});rejectPending('CDP socket error: '+(event.message||event.error?.message||'unknown'))});
    socket.addEventListener('close',event=>{
      this.transport.push({kind:'close',at:new Date().toISOString(),code:event.code,reason:event.reason,wasClean:event.wasClean,pending:[...this.pending.values()].map(p=>p.command)});
      rejectPending(`CDP disconnected code=${event.code} clean=${event.wasClean} reason=${event.reason||'(none)'}`);
    });
  }
  send(method,params={},sessionId=this.session) {
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{
      if(this.socket.readyState!==WebSocket.OPEN){reject(Error('CDP socket not open for '+method));return}
      const payload=JSON.stringify({id,method,params,...sessionId?{sessionId}:{}});
      const command={id,method,sessionId,started:new Date().toISOString(),requestBytes:Buffer.byteLength(payload),...params.expression?{expressionSHA256:sha(params.expression),expressionPrefix:params.expression.slice(0,160)}:{}};
      this.commands.push(command);
      const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout '+method))},45000);
      this.pending.set(id,{resolve,reject,timer,method,command});
      try{this.socket.send(payload)}catch(error){clearTimeout(timer);this.pending.delete(id);command.error=String(error);reject(error)}
    });
  }
  async evaluate(expression) {
    const r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  }
  async wait(expression) {
    const start=Date.now();while(Date.now()-start<120000){if(await this.evaluate(expression))return;await delay(100)}
    throw Error('Timed out: '+expression);
  }
  async readString(expression,length) {
    assert.ok(Number.isSafeInteger(length)&&length>0&&length<64e6,'bounded string transfer');
    let out='';for(let offset=0;offset<length;offset+=32768)out+=await this.evaluate(`(${expression}).slice(${offset},${offset+32768})`);
    assert.equal(out.length,length,'complete CDP string transfer');return out;
  }
}

function diagnostics(events) {
  return events.filter(e=>e.method==='Runtime.exceptionThrown'||e.method==='Inspector.targetCrashed'||
    e.method==='Runtime.consoleAPICalled'&&e.params.type==='error'||e.method==='Log.entryAdded'&&e.params.entry.level==='error'||
    e.method==='Network.loadingFailed'||e.method==='Network.responseReceived'&&e.params.response.status>=400);
}

async function visual(report,output,url) {
  const chrome=[process.env.RIVER_QA_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
  assert.ok(chrome,'native Chrome/Edge required');
  // Match the proven browser.mjs system-temp profile location. This removes a
  // path-length difference; it is not a diagnosis of the exploratory disconnect.
  const profile=validateTemporaryProfile(await mkdtemp(resolve(tmpdir(),'river-migration-profile-')));let browser,cdp,stderr='';
  report.browser={executable:chrome};report.captures=[];report.pairs=[];report.network={};report.loadedSources={};report.errors=[];
  const flags=['--headless=new','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--use-angle=d3d11','--disable-software-rasterizer','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=0','--window-size=1920,1080',`--user-data-dir=${profile}`,'about:blank'];
  report.browser.flags=flags;
  try {
    const endpoint=await new Promise((resolveLaunch,reject)=>{
      const timer=setTimeout(()=>reject(Error('native-headless launch timeout')),30000);
      browser=spawn(chrome,flags,{windowsHide:true,stdio:['ignore','ignore','pipe']});
      report.browser.pid=browser.pid;report.browser.started=new Date().toISOString();
      browser.once('error',e=>{report.browser.spawnError=e.stack;clearTimeout(timer);reject(e)});
      browser.once('exit',(code,signal)=>{report.browser.exit={code,signal,at:new Date().toISOString()};clearTimeout(timer);reject(Error(`browser exited ${code}/${signal}`))});
      browser.stderr.on('data',b=>{stderr+=b;const m=stderr.match(/DevTools listening on (ws:\/\/\S+)/);if(m){clearTimeout(timer);resolveLaunch(m[1])}});
    });
    const socket=new WebSocket(endpoint);
    await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
    cdp=new CDP(socket);
    report.browser.version=await cdp.send('Browser.getVersion',{},null);
    report.gpu=(await cdp.send('SystemInfo.getInfo',{},null)).gpu;
    const forbidden=await primaryURLs(url),states={};
    for (const variant of ['legacy','procedural','default']) {
      const expected=variant==='legacy'?'legacy':'procedural',pageURL=new URL(url);
      pageURL.searchParams.delete('materials');if(variant!=='default')pageURL.searchParams.set('materials',variant);
      const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'},null);
      ({sessionId:cdp.session}=await cdp.send('Target.attachToTarget',{targetId,flatten:true},null));
      const sessionId=cdp.session,start=cdp.events.length,requests=[],requestByID=new Map(),bodies=[],bodyErrors=[];
      const listener=event=>{
        if(event.sessionId!==sessionId)return;
        const p=event.params;
        if(event.method==='Network.requestWillBeSent') {
          const r={id:p.requestId,url:p.request.url,type:p.type,method:p.request.method,initiator:p.initiator};requests.push(r);requestByID.set(p.requestId,r);
        }
        if(event.method==='Network.responseReceived')Object.assign(requestByID.get(p.requestId)||{}, {status:p.response.status,mimeType:p.response.mimeType,fromDiskCache:p.response.fromDiskCache,fromServiceWorker:p.response.fromServiceWorker});
        if(event.method==='Network.loadingFinished') {
          const r=requestByID.get(p.requestId);if(!r)return;r.finished=true;r.encodedDataLength=p.encodedDataLength;
          if (/\.(?:js|mjs|json)(?:\?|$)/.test(r.url)) bodies.push(cdp.send('Network.getResponseBody',{requestId:p.requestId},sessionId).then(v=>{r.bodySHA256=sha(Buffer.from(v.body,v.base64Encoded?'base64':'utf8'))}).catch(e=>bodyErrors.push({url:r.url,error:String(e)})));
        }
      };
      cdp.listeners.push(listener);
      await cdp.send('Runtime.enable');await cdp.send('Page.enable');await cdp.send('Log.enable');await cdp.send('Network.enable',{maxTotalBufferSize:64e6,maxResourceBufferSize:8e6});
      await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.setBypassServiceWorker',{bypass:true});
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
      await cdp.send('Page.navigate',{url:pageURL.href});
      await cdp.wait("!!window.arenaQA && !!document.body?.dataset.qa && !document.getElementById('bStart')?.disabled");
      assert.ok(await cdp.evaluate("typeof arenaQA.migrationFreeze === 'function' && !!arenaQA.mapInfo().migration"),'migration hooks not integrated');
      report.loadedSources[variant]=await cdp.evaluate('arenaQA.snapshot().buildHashes');
      assert.ok(same(report.loadedSources[variant],report.sourcesBefore.runtime),'loaded source binding');
      states[variant]={};
      // Default also receives every view, proving the default route on the same
      // frozen scene rather than just trusting a query-string label.
      for (const view of VIEWS) {
        const call=view.cabin?`arenaQA.cabinView(${JSON.stringify(view.cabin)},${view.camera.join(',')})`:`arenaQA.view(${view.camera.join(',')})`;
        await cdp.evaluate(`arenaQA.weather(${view.weather});${call};arenaQA.migrationFreeze(${TIME});true`);
        // Capture all state synchronously in the SAME rAF as the pixels. Return
        // only lengths, then transfer state/PNG in bounded chunks like browser.mjs.
        // The original combined return duplicated runtime hashes and had no
        // response bound or transport-close diagnostics.
        const lengths=await cdp.evaluate(`new Promise((resolve,reject)=>requestAnimationFrame(()=>requestAnimationFrame(raf=>{try{
          const canvas=document.querySelector('#app canvas'),before=arenaQA.snapshot();
          const png=canvas.toDataURL('image/png'),snapshot=arenaQA.snapshot(),info=arenaQA.mapInfo();
          window.__migrationCapture=png.split(',')[1];
          window.__migrationCaptureState=JSON.stringify({before,snapshot,info,canvas:{width:canvas.width,height:canvas.height},raf});
          resolve({image:window.__migrationCapture.length,state:window.__migrationCaptureState.length});
        }catch(error){reject(error)}})))`);
        const state=JSON.parse(await cdp.readString('window.__migrationCaptureState',lengths.state));
        state.decoded=await cdp.evaluate(`(async()=>{
          const binary=atob(window.__migrationCapture),encoded=Uint8Array.from(binary,c=>c.charCodeAt(0));
          const bitmap=await createImageBitmap(new Blob([encoded],{type:'image/png'}));
          const check=new OffscreenCanvas(bitmap.width,bitmap.height),context=check.getContext('2d');context.drawImage(bitmap,0,0);
          const pixels=context.getImageData(0,0,bitmap.width,bitmap.height).data;let nonBlackPixels=0,low=255,high=0;
          for(let i=0;i<pixels.length;i+=4){const n=Math.max(pixels[i],pixels[i+1],pixels[i+2]);if(n>8)nonBlackPixels++;low=Math.min(low,n);high=Math.max(high,n)}
          const pixelSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels)),b=>b.toString(16).padStart(2,'0')).join('');
          const decoded={width:bitmap.width,height:bitmap.height,nonBlackPixels,range:high-low,pixelSHA256};bitmap.close();
          return decoded;
        })()`);
        states[variant][view.name]=state;
        const data=await cdp.readString('window.__migrationCapture',lengths.image);
        await cdp.evaluate('delete window.__migrationCapture;delete window.__migrationCaptureState');
        const bytes=Buffer.from(data,'base64'),stem=variant+'-'+view.name;
        await writeNew(resolve(output,stem+'.png'),bytes);
        await writeNew(resolve(output,stem+'.json'),json(state));
        report.captures.push({variant,view,method:'native-headless WebGL canvas toDataURL within second requestAnimationFrame; no UI pixels',time:TIME,png:stem+'.png',sha256:sha(bytes),state:stem+'.json',stateSHA256:sha(json(state)),dimensions:pngDimensions(bytes)});
        assert.deepEqual(pngDimensions(bytes),[1920,1080]);
        assertCapture(state,view,expected,report.sourcesBefore.runtime);assertNative(state.snapshot.renderer,report.gpu);assertMaterials(state.info.migration);
        if(variant!=='legacy') {assertPair(states.legacy[view.name],state);report.pairs.push({a:'legacy',b:variant,view:view.name,pass:true});}
        console.log(stem+': captured 1920x1080 at t='+TIME);
      }
      await Promise.all(bodies);
      const events=cdp.events.slice(start).filter(e=>e.sessionId===sessionId),errors=diagnostics(events);
      report.errors.push(...errors,...bodyErrors);
      const advertised=states[variant]['ground-lane'].info.migration.legacyTextureURLs;
      assert.ok(same([...new Set(advertised.map(u=>cleanURL(u,url)))].sort(),[...new Set(forbidden.map(u=>cleanURL(u,url)))].sort()),'runtime and independent primary URL manifests differ');
      const audit=networkAudit(requests,forbidden,url);report.network[variant]=audit;
      await writeNew(resolve(output,variant+'-network.json'),json(audit));
      await writeNew(resolve(output,variant+'-events.json'),json(events));
      assert.equal(errors.length,0,'console/runtime/network errors');assert.equal(bodyErrors.length,0,'network source body capture failed');
      for (const r of requests.filter(r=>r.bodySHA256)) {
        const path=decodeURIComponent(new URL(r.url).pathname),key=path.startsWith('/river/')?path.slice(7):'../sunbreak-storm-v3/'+path.slice(1);
        if (report.sourcesBefore.runtime[key]) assert.equal(r.bodySHA256,report.sourcesBefore.runtime[key],'served bytes differ from frozen source: '+key);
      }
      assert.ok(requests.some(r=>/\/world\.js(?:\?|$)/.test(r.url)&&r.bodySHA256),'world response must be bound');
      if(variant!=='legacy') {
        assert.equal(audit.violations.length,0,'primary legacy maps requested in procedural route');
        const migration=states[variant]['ground-lane'].info.migration;
        assert.ok(migration.bake && migration.ground,'procedural metadata required');
      } else assert.ok(audit.violations.length>0,'legacy must actually load original primary textures');
      cdp.listeners=cdp.listeners.filter(fn=>fn!==listener);
      await cdp.send('Target.closeTarget',{targetId},null);cdp.session=null;
    }
    report.pass=report.captures.length===VIEWS.length*3 && report.pairs.length===VIEWS.length*2 && !report.errors.length;
    report.verdict=report.pass?'PASS':'FAIL';
  } finally {
    if(cdp) {
      report.errors.push(...diagnostics(cdp.events).filter(e=>!report.errors.includes(e)));
      await writeNew(resolve(output,'cdp-events.json'),json(cdp.events));
      await writeNew(resolve(output,'cdp-transport.json'),json({transport:cdp.transport,commands:cdp.commands,pending:[...cdp.pending.values()].map(p=>p.command)}));
      if(cdp.socket.readyState===WebSocket.OPEN){try{await cdp.send('Browser.close',{},null)}catch{}cdp.socket.close()}
    }
    if(browser && browser.exitCode===null)await new Promise(r=>{const timer=setTimeout(()=>{browser.kill();r()},5000);browser.once('exit',()=>{clearTimeout(timer);r()})});
    await writeNew(resolve(output,'browser-stderr.log'),stderr);
    // Only this run's validated generated profile, never a user's browser data.
    await rm(validateTemporaryProfile(profile),{recursive:true,force:true,maxRetries:3,retryDelay:250}).catch(e=>{report.profileCleanupError=String(e)});
    if(report.errors.length){report.pass=false;report.verdict='FAIL'}
  }
}

export async function main(args=process.argv.slice(2)) {
  const options=parseOptions(args);
  if(options.help){console.log('node qa/migration-checks.mjs\nnode qa/migration.mjs --phase=units\nnode qa/migration.mjs --phase=visual [--url=http://127.0.0.1:5190/river/]\nVisual requires the root-scheduled exclusive GPU slot and an already running serve.mjs. Units executes 21 historical suites plus generator, shader and harness tests, using read-only Git baseline inspection. All outputs are new qa/evidence/migration-*; historical reports are never rewritten. Missing integration suites => PENDING (exit 2), never PASS. No performance or art verdict.');return}
  const base=resolve(GAME,'qa/evidence');await mkdir(base,{recursive:true});
  const output=await mkdtemp(resolve(base,'migration-'+options.phase+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'));
  const report={schema:'river-procedural-migration-v1',task:'river-procedural-migration-2026-11-19',date:new Date().toISOString(),phase:options.phase,baseline:BASELINE,pass:false,verdict:'FAIL',limitations:{art:'UNREVIEWED: captures require independent full-resolution review',temporal:'UNREVIEWED: sampled stills do not establish continuous temporal quality',performance:'NOT RUN: root runs existing sunny/storm benchmarks separately',assetScope:'Primary migrated surfaces only; sky, foliage, models and riverbed remain external'}};
  try {
    report.sourcesBefore=await sourceSnapshot();
    if(options.phase==='units')await units(report,output);else await visual(report,output,options.url);
  }catch(error){report.error=error.stack;report.pass=false;report.verdict='FAIL'}
  finally {
    try {report.sourcesAfter=await sourceSnapshot();report.sourceUnchanged=same(report.sourcesBefore,report.sourcesAfter)} catch(error){report.sourceError=error.stack;report.sourceUnchanged=false}
    if(!report.sourceUnchanged){report.pass=false;report.verdict='FAIL'}
    await writeNew(resolve(output,'source-manifest.json'),json({before:report.sourcesBefore,after:report.sourcesAfter,unchanged:report.sourceUnchanged}));
    report.sourceManifestSHA256=sha(await readFile(resolve(output,'source-manifest.json')));
    await writeNew(resolve(output,'report.json'),json(report));
    console.log(JSON.stringify({phase:report.phase,pass:report.pass,verdict:report.verdict,report:resolve(output,'report.json'),sha256:sha(json(report))}));
    process.exitCode=report.pass?0:report.verdict==='PENDING'?2:1;
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
