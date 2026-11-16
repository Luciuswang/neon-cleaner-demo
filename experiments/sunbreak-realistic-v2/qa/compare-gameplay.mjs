// Read-only source audit. No browser execution, network, dependencies or file writes.
// Run from any directory: node <path>/compare-gameplay.mjs [--self-test]
// JSON goes to stdout; exit 1 means a static check failed, not a visual verdict.
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const baselineURL = new URL('../../sunbreak-fable52/index.html', import.meta.url);
const candidateURL = new URL('../index.html', import.meta.url);
const worldURL = new URL('../world.js', import.meta.url);
const weaponURL = new URL('../weapon.js', import.meta.url);
const auditURL = new URL('./gameplay-audit.json', import.meta.url);
const hash = s => createHash('sha256').update(s).digest('hex');
const lf = s => s.replace(/\r\n/g, '\n');
const moduleOf = html => {
  const matches = [...lf(html).matchAll(/<script\s+type="module">([\s\S]*?)<\/script>/g)];
  assert.equal(matches.length, 1, 'Exactly one inline module required');
  return matches[0][1];
};
// Each exception is a complete exact string, required exactly once. No broad
// regex deletion, whitespace/comment stripping, or gameplay region exemptions.
const bootstrap = "const {buildWorld}=await import('./world.js');\nvisual=await buildWorld({THREE,scene,cam,rnd,gun,gscene,gcam,sun,amb,sky,ground,sea,mat,solids,colliders,enemies});\nvisual.setStyle(si);\ndocument.getElementById('bWeather').onclick=()=>visual.cycleWeather();\naddEventListener('keydown',e=>{if(e.code==='KeyT'&&!e.repeat)visual.cycleWeather()});\n";
const audioAdapter = String.raw`// audio
let createGameAudio;
try{({createGameAudio}=await Promise.race([import('./audio.js'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Audio module timeout')),4000))]))}
catch{createGameAudio=({onStatus})=>{
 const info={failed:true,ready:false,unlocked:false,loaded:0,muted:false,volume:.65};
 queueMicrotask(()=>onStatus({...info}));
 return{unlock(){onStatus({...info})},notify(){},setScene(){},silence(){},setMuted(v){info.muted=!!v;onStatus({...info})},setVolume(v){if(Number.isFinite(v))info.volume=Math.max(0,Math.min(1,v));onStatus({...info})},snapshot(){return{...info}}};
}}
const sound=createGameAudio({onStatus:info=>{
 document.getElementById('audioStatus').textContent=info.failed?'音效不可用':!info.unlocked?'点击开始启用音效':!info.ready?'音效加载中':info.muted?'已静音':info.context!=='running'?'点击继续恢复音效':'实录音效已启用';
 document.getElementById('bMute').textContent=info.muted?'开启声音':'静音';
 document.getElementById('bMute').setAttribute('aria-pressed',String(info.muted));
}});
function snd(type,origin){try{sound.notify(type,origin)}catch{}}
function initAudio(){sound.unlock()}
const soundControls=document.getElementById('soundControls');
for(const type of ['pointerdown','mousedown','click','keydown'])soundControls.addEventListener(type,e=>e.stopPropagation());
document.getElementById('bMute').onclick=()=>{initAudio();sound.setMuted(!sound.snapshot().muted)};
document.getElementById('soundVolume').oninput=e=>{initAudio();sound.setVolume(Number(e.target.value)/100)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)sound.silence()});
addEventListener('blur',()=>sound.silence());
document.addEventListener('pointerdown',()=>{if(sound.snapshot().unlocked)initAudio()},{passive:true});
document.addEventListener('keydown',()=>{if(sound.snapshot().unlocked)initAudio()},{passive:true});
`;
const originalAudio=section(moduleOf(readFileSync(baselineURL,'utf8')),'// audio','\n// combat');
const exceptions = [
  ['visual handle', 'let THREE;\nlet visual=null;', 'let THREE;'],
  ['capture buffer option', "powerPreference:'high-performance',preserveDrawingBuffer:true", "powerPreference:'high-performance'"],
  ['style notification', ' if(visual)visual.setStyle(si);\n', ''],
  ['render/update hook', ' if(visual)visual.update(dt,{S,pres,cam,gun,live});\n rnd.autoClear=true;\n if(visual)visual.render();else rnd.render(scene,cam);', ' rnd.autoClear=true;rnd.render(scene,cam);'],
  ['world initialization/weather input', bootstrap, ''],
  ['sample audio adapter',audioAdapter,originalAudio],
  ['enemy sound event only',"scene.add(el);tracers.push({l:el,t:.1});snd('enemy',[o.x,o.y,o.z]);","scene.add(el);tracers.push({l:el,t:.1});snd('shot');"],
  ['copied listener and active flag',' sound.setScene(live,[pos.x,pos.y,pos.z],S.yaw);\n',''],
  ['restart gesture audio unlock',"document.getElementById('bAgain').onclick=()=>{initAudio();resetGame();","document.getElementById('bAgain').onclick=()=>{resetGame();"],
];
function restoreCandidate(source) {
  let restored = source;
  const hooks = exceptions.map(([name, added, original]) => {
    const occurrences = restored.split(added).length - 1;
    if (occurrences === 1) restored = restored.replace(added, original);
    return {name, occurrences, pass: occurrences === 1, candidate: added, baseline: original};
  });
  return {restored, hooks};
}
function firstDifference(a, b) {
  if (a === b) return null;
  let at = 0; while (at < Math.min(a.length, b.length) && a[at] === b[at]) at++;
  return {line: a.slice(0, at).split('\n').length, baseline: a.slice(Math.max(0, at - 100), at + 200), candidate: b.slice(Math.max(0, at - 100), at + 200)};
}
// Small delimiter scanner for the baseline's named function declarations.
// Whole-module exact comparison is authoritative; this inventory is diagnostic,
// not a general JavaScript parser or a proof about imported code.
function functions(source) {
  const result = {};
  for (const match of source.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)) {
    const open = source.indexOf('{', match.index);
    let depth = 0, quote = '', comment = '', end = -1;
    for (let i = open; i < source.length; i++) {
      const c = source[i], next = source[i + 1];
      if (comment === '//') {if (c === '\n') comment = ''; continue;}
      if (comment === '/*') {if (c === '*' && next === '/') {comment = ''; i++;} continue;}
      if (quote) {if (c === '\\') i++; else if (c === quote) quote = ''; continue;}
      if (c === '/' && (next === '/' || next === '*')) {comment = c + next; i++; continue;}
      if (c === '"' || c === "'" || c === '`') {quote = c; continue;}
      if (c === '{') depth++;
      if (c === '}' && --depth === 0) {end = i + 1; break;}
    }
    assert.ok(end > open, `Unclosed function ${match[1]}`);
    result[match[1]] = source.slice(match.index, end);
  }
  return result;
}
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing region: ${start}`);
  return source.slice(a, b);
}
function matches(source, expression) {
  return [...source.matchAll(expression)].map(m => ({line: source.slice(0, m.index).split('\n').length, text: m[0]}));
}
function scanVisual(source) {
  // Conservative textual tripwires. Aliases, imported code and dynamic access
  // require independent review; a clean scan does not establish isolation.
  const patterns = [
    ['direct global RNG references', /Math\s*(?:\.\s*random|\[\s*['"]random['"]\s*\])/g],
    ['direct game state writes', /\bS\s*\.\s*\w+\s*(?:=(?!=)|\+=|-=|\*=|\/=|\+\+|--)/g],
    ['proxy container operations', /\b(?:solids|colliders)\s*(?:\[|\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\(|=(?!=))/g],
    ['enemy combat field writes', /\be\s*\.\s*(?:hp|alive|cd|ph|warn)\s*(?:=(?!=)|\+=|-=|\+\+|--)/g],
    ['gameplay invocation', /\b(?:solid|collide|fire|reload|finishReload|resetGame|look|clearKeys)\s*\(/g],
    ['original enemy anchor transform writes', /\be\.(?:g|wg2|gunTip|la|ra|ll|rl)\.(?:position|rotation|scale|quaternion)\s*(?:\.\s*(?:set|copy|add|sub|multiply|multiplyScalar|setScalar)\s*\(|\.[xyz]\s*(?:=(?!=)|\+=|-=))/g],
  ];
  return patterns.map(([name, pattern]) => {const hits = matches(source, pattern); return {name, pass: hits.length === 0, hits};});
}
function colliderContract(source) {
  const extendHits = matches(source, /\bb\s*\.\s*(?:min|max)\s*\.\s*[xyz]\s*(?:[+\-]?=)(?!=)/g);
  const expandHits = matches(source, /\.\s*expandByScalar\s*\(\s*(?!pad\s*\))[^)]+\)/g);
  const staticCrates = matches(source, /crate\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+)/g).map(m => ({line: m.line, x: Number(m.text.match(/crate\s*\(\s*(-?\d+(?:\.\d+)?)/)?.[1]), z: Number(m.text.match(/,\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+)/)?.[1]), count: Number(m.text.match(/,\s*(-?\d+(?:\.\d+)?)\s*,\s*(\d+)/)?.[2]), call: m.text.trim()}));
  return {
    solidCallSites: matches(source, /(?:^|[;{}]\s*)solid\s*\(/gm).length + matches(source, /if\s*\(i===0\)\s*solid\s*\(c\)/g).length,
    houseCalls: matches(source, /(?:^|[;{}]\s*)house\s*\(/gm).length,
    originalPalmCalls: matches(source, /(?:^|[;{}]\s*)palm\s*\(/gm).length,
    staticCrates,
    registrationsAfterCrateDefinition: matches(source, /for\s*\(let i=0;i<n;i\+\+\)[\s\S]{0,400}?if\s*\(i===0\)\s*solid\s*\(c\)/g).length,
    colliderExtentWrites: {pass: extendHits.length === 0, hits: extendHits},
    nonProxyPadding: {pass: expandHits.length === 0, hits: expandHits},
  };
}
function colliderContractPass(c) {
  const visibleCrates = c.staticCrates.reduce((n, crate) => n + crate.count, 0);
  return c.solidCallSites === 4 && c.houseCalls === 5 && c.originalPalmCalls === 6
    && c.staticCrates.length === 6 && visibleCrates === 9
    && c.staticCrates.filter(crate => crate.count > 1).length === 3
    && c.staticCrates.reduce((n, crate) => n + Math.max(0, crate.count - 1), 0) === 3
    && c.registrationsAfterCrateDefinition === 1
    && 5 + 1 + c.staticCrates.length + c.originalPalmCalls === 18
    && c.colliderExtentWrites.pass && c.nonProxyPadding.pass;
}

const baselineBytes = readFileSync(baselineURL);
const candidateBytes = readFileSync(candidateURL);
const worldBytes = readFileSync(worldURL);
const base = moduleOf(baselineBytes.toString()), candidate = moduleOf(candidateBytes.toString());
const {restored, hooks} = restoreCandidate(candidate);
const baseFunctions = functions(base), currentFunctions = functions(candidate), restoredFunctions = functions(restored);
const functionChecks = Object.entries(baseFunctions).map(([name, text]) => ({
  name, rawEqual: text === currentFunctions[name], equalAfterExactRenderExceptions: text === restoredFunctions[name],
  baselineSha256: hash(text), candidateSha256: currentFunctions[name] ? hash(currentFunctions[name]) : null,
  difference: firstDifference(text, currentFunctions[name] || ''),
}));
const regions = [
  ['proxies and all environment construction calls', 'const colliders=[],solids=[];', '// ===== gun view model ====='],
  ['original weapon root and muzzle setup', '// ===== gun view model =====', '// ===== enemies ====='],
  ['enemy factory and spawn data', '// ===== enemies =====', '// ===== style switching ====='],
  ['player defaults and all original input listeners', '// ===== player =====', '// audio'],
  ['combat', '// combat', '// UI'],
  ['UI lifecycle and reset', '// UI', '// movement + loop'],
  ['movement, AI, camera, gun animation', '// movement + loop', '\ntick();'],
];
const regionChecks = regions.map(([name, start, end]) => {
  const a = section(base, start, end), b = section(restored, start, end);
  return {name, pass: a === b, baselineSha256: hash(a), candidateRestoredSha256: hash(b), difference: firstDifference(a, b)};
});
const visualChecks = scanVisual(lf(worldBytes.toString()));
const audioChecks=scanVisual(lf(readFileSync(new URL('../audio.js',import.meta.url),'utf8')));
const colliderChecks = colliderContract(base);
const proxyContractPass = colliderContractPass(colliderChecks);
const visibleStackLayout = {sites: colliderChecks.staticCrates.length, visibleCrates: colliderChecks.staticCrates.reduce((n, c) => n + c.count, 0), originalSolids: 5 + 1 + colliderChecks.staticCrates.length + colliderChecks.originalPalmCalls, stackedSites: colliderChecks.staticCrates.filter(c => c.count > 1).length, upperCratesWithoutOriginalProxy: colliderChecks.staticCrates.reduce((n, c) => n + Math.max(0, c.count - 1), 0)};
const baselinePinned = hash(baselineBytes) === '4b0de43249fd1c787554ea1735c84669b1df687fc9e03aba263571c48a101a85';
const sourcePass = baselinePinned && hooks.every(h => h.pass) && restored === base && proxyContractPass;
let priorAudit = null;
if (existsSync(auditURL)) {
  try {priorAudit = JSON.parse(readFileSync(auditURL, 'utf8'));}
  catch {priorAudit = 'invalid JSON';}
}
const staleEvidence = priorAudit && typeof priorAudit === 'object'
  ? ['candidate', 'world', 'weapon'].filter(k => priorAudit.files?.[k]?.sha256 !== (k === 'candidate' ? hash(candidateBytes) : k === 'world' ? hash(worldBytes) : existsSync(weaponURL) ? hash(readFileSync(weaponURL)) : null))
  : ['not available'];
let selfTest = 'not requested';
if (process.argv.includes('--self-test')) {
  for (const [from, to] of [['S.mag--;', 'S.mag-=2;'], ['[-8,-10]', '[-8,-11]'], ['b.expandByScalar(pad)', 'b.expandByScalar(pad+.1)'], ['vy-=15*dt', 'vy-=12*dt']]) {
    assert.ok(candidate.includes(from), `Mutation target missing: ${from}`);
    const changed = restoreCandidate(candidate.replace(from, to));
    assert.notEqual(changed.restored, base, `Missed mutation: ${from}`);
  }
  assert.notEqual(restoreCandidate(candidate + '\nS.hp=0;').restored, base);
  assert.ok(!restoreCandidate(candidate.replace('visual.setStyle(si)', 'visual.setStyle(si+1)')).hooks.every(h => h.pass));
  for(const [from,to] of [["sound.notify(type,origin)","sound.notify(type,origin);S.hp=0"],["S.reload=1.2;snd('rel')","S.reload=1.3;snd('rel')"],["tracers.push({l:el,t:.1});snd('enemy'","S.hp=0;tracers.push({l:el,t:.1});snd('enemy'"]]){
   assert.ok(candidate.includes(from));assert.notEqual(restoreCandidate(candidate.replace(from,to)).restored,base,'Missed audio-adjacent mutation');
  }
  for(const mutation of ['Math.random()','S.mag--','e.cd=0'])assert.ok(scanVisual(mutation).some(c=>!c.pass));
  for (const mutation of ['Math.random();', 'S.hp=0;', 'solids.push(mesh);', 'e.cd=0;', 'fire();', 'e.g.position.set(0,0,0);']) {
    assert.ok(scanVisual(mutation).some(c => !c.pass), `Missed visual mutation: ${mutation}`);
  }
  const colliderMutations = [
    ['crate(-6,2,2,.2)', 'crate(-6,2,3,.2)'],
    ['if(i===0)solid(c)', 'if(i===0)solid(c);solid(c)'],
    ['b.expandByScalar(pad)', 'b.expandByScalar(pad+.1)'],
    ['new THREE.Box3().setFromObject(o)', 'new THREE.Box3().setFromObject(o);b.max.y+=1'],
  ];
  for (const [from, to] of colliderMutations) {
    assert.ok(base.includes(from), `Collider mutation target missing: ${from}`);
    const changed = colliderContract(base.replace(from, to));
    assert.ok(!colliderContractPass(changed), `Missed collider mutation: ${from}`);
  }
  selfTest = 'PASS: four gameplay mutations, appended state write, altered hook, six visual tripwires and four proxy-contract mutations rejected';
}
const result = {
  schema: 'sunbreak-static-gameplay-audit-v2',
  command: 'node experiments/sunbreak-realistic-v2/qa/compare-gameplay.mjs --self-test',
  scope: 'Static local source comparison only; no runtime, network, git or file writes',
  files: {
    baseline: {path: 'experiments/sunbreak-fable52/index.html', sha256: hash(baselineBytes), pinnedMatch: baselinePinned},
    candidate: {path: 'experiments/sunbreak-realistic-v2/index.html', sha256: hash(candidateBytes)},
    world: {path: 'experiments/sunbreak-realistic-v2/world.js', sha256: hash(worldBytes)},
    weapon: {present: existsSync(weaponURL), sha256: existsSync(weaponURL) ? hash(readFileSync(weaponURL)) : null, reviewed: false},
  },
  verdicts: {baselineSourcePreservation: sourcePass ? 'PASS' : 'REWORK', proxyContract: proxyContractPass ? 'PASS' : 'REWORK', directVisualTripwires: visualChecks.every(c => c.pass) ? 'CLEAR_WITH_LIMITATIONS' : 'REVIEW_REQUIRED', gameplayRuntime: 'NOT_RUN', visualQuality: 'NOT_REVIEWED'},
  wholeModuleEqualAfterExactRenderExceptions: restored === base,
  unexpectedDifference: firstDifference(base, restored),
  acceptedRenderHooks: hooks,
  functionChecks, regionChecks, visualChecks, audioChecks, colliderChecks, visibleStackLayout, selfTest,
  recordedAudit: {path: 'experiments/sunbreak-realistic-v2/qa/gameplay-audit.json', staleForCurrentHashes: staleEvidence.length > 0, staleFiles: staleEvidence},
  limits: [
    'Exact inline-module comparison covers original functions, data, constants, callbacks and order; HTML/CSS appearance is outside preservation verdict.',
    'Allowlisted render hooks are not certified safe by source equality; they pass mutable game and scene references into imported code.',
    'Visual scans are textual tripwires, not alias analysis; imported Three.js/addon RNG and scene mutation require runtime verification.',
    'Weapon presence/hash is recorded but weapon behavior is not reviewed by this audit.',
    'Hidden-proxy world matrices, bounds, raycasts and visible-cover alignment require dynamic checks.',
    'The original crate() registers only bottom crates. Upper crates in two-crate stacks are visible but never collision or shot blockers; preserving baseline requires keeping that inherited mismatch.',
    'No new smoke results, full playthrough, performance results, reference comparison or visual PASS is implied.',
  ],
};
console.log(JSON.stringify(result, null, 2));
if (!sourcePass || visualChecks.some(c => !c.pass)||audioChecks.some(c=>!c.pass)) process.exitCode = 1;
