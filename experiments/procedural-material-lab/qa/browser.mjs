// Native headless browser, own WebGL canvas only. No desktop/window screenshots.
// Start serve.mjs separately. --smoke is explicitly incomplete visual evidence.
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile, writeFile, mkdir, mkdtemp, realpath, rm} from 'node:fs/promises';
import {resolve, dirname, basename} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {ROOT, SCOPE, PROFILE, LIGHTS, WETS, FIXED_TIME, MOTION_TIMES, sha256, canonical,
  hardwareRenderer, matches, sourceAudit, sourceManifest, inspectPNG, summarizeIntervals,
  visualAssertions, recoveryAssertions, performanceAssertions, comparePNGs} from './validate.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node qa/browser.mjs --phase=visual|performance [--smoke] [--browser=PATH]\nServer must already be running at http://127.0.0.1:5191/. --smoke exports one visual frame and cannot pass the full visual gate.');
  process.exit(0);
}
const option = name => args.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
for (const arg of args) if (!/^--(?:phase|browser)=/.test(arg) && arg !== '--smoke') throw Error('Unknown argument: ' + arg);
const phase = option('phase') || 'visual', smoke = args.includes('--smoke');
if (!['visual', 'performance'].includes(phase) || (smoke && phase !== 'visual')) throw Error('Invalid phase/smoke combination');
const URL_ROOT = 'http://127.0.0.1:5191/';
const LIMITS = {runMS: 15 * 60000, commandMS: 45000, readinessMS: 120000, captureCount: 100,
  PNGBytes: 32 * 1024 * 1024, totalPNGBytes: 768 * 1024 * 1024, chunkCharacters: 65536, logBytes: 4 * 1024 * 1024};
const startedAt = new Date().toISOString();
const output = resolve(ROOT, 'qa/evidence', phase + '-' + startedAt.replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
await mkdir(output, {recursive: true});
console.log('Evidence: ' + output);
const report = {schema: 'browser-material-qa-v1', scope: SCOPE, quality_profile: PROFILE, phase, smoke,
  startedAt, status: 'RUNNING', pass: false, limits: LIMITS, checks: [], errors: [], warnings: [], captures: [], canvasProbes: [],
  provenance: {engine: 'browser-webgl', ueEvidence: false, capture_method: 'browser-webgl-canvas-labQA.capture',
    execution: 'native headless; own isolated browser process; no desktop interaction'},
  acceptance: {visualArt: 'UNVERIFIED', continuousReview: 'UNVERIFIED', cinematic: 'NOT_ASSESSED', aiVideo: 'NOT_ASSESSED'},
  network: {coldProfile: false, cacheDisabled: false, serviceWorkerBypassed: false, externalHTTPBlocked: false,
    requests: [], responses: [], failures: [], blocked: [], servedSources: []},
  controls: {method: 'labQA setters plus actual DOM input/change/click handlers; no desktop input', actions: []}};
let browser, socket, session, sequence = 0, profile, tempParent, watchdog, stopping = false, totalPNGBytes = 0;
let measurementActive = false, browserStderr = '', stderrTruncated = false;
const pending = new Map(), asynchronous = new Set();
const now = () => new Date().toISOString();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const errorRecord = (stage, error) => report.errors.push({at: now(), stage, message: error?.stack || String(error)});
function check(name, pass, details) { const c = {name, pass: Boolean(pass), at: now(), ...(details === undefined ? {} : {details})}; report.checks.push(c); return c.pass; }
function need(name, pass, details) { if (!check(name, pass, details)) throw Error('FAIL: ' + name); }
const save = () => writeFile(resolve(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
function track(promise) { asynchronous.add(promise); promise.catch(e => errorRecord('CDP event handling', e)).finally(() => asynchronous.delete(promise)); }
function rejectPending(reason) { for (const p of pending.values()) { clearTimeout(p.timer); p.reject(reason); } pending.clear(); }

function send(method, params = {}, sessionId = session, timeoutMS = LIMITS.commandMS) {
  if (measurementActive) report.performance.interveningCommands.push({method, at: now()});
  if (socket?.readyState !== WebSocket.OPEN) return Promise.reject(Error('CDP socket not open: ' + method));
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)); }, timeoutMS);
    pending.set(id, {resolve, reject, timer});
    try { socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})})); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
async function evaluate(expression, timeoutMS = LIMITS.commandMS) {
  const r = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, session, timeoutMS);
  if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function waitFor(expression, timeoutMS = LIMITS.readinessMS) {
  const until = Date.now() + timeoutMS;
  while (Date.now() < until) { const result = await evaluate(expression); if (result) return result; await delay(100); }
  throw Error('Readiness timed out: ' + expression);
}
const snapshot = () => evaluate('labQA.snapshot()');
async function compareFrames(first, second) {
  report.pixelComparisons ||= [];
  const result = {first, second, ...comparePNGs(await readFile(resolve(output, first + '.png')),
    await readFile(resolve(output, second + '.png')))};
  report.pixelComparisons.push(result); console.log(JSON.stringify({pixelComparison: result}));
  return result;
}
async function set(settings) {
  await evaluate('labQA.set(' + JSON.stringify(settings) + ')');
  const state = await snapshot();
  check('setter-observed-' + report.checks.length, matches(state?.settings, settings), {expected: settings, actual: state?.settings});
  return state;
}
async function view(index) { await evaluate(`labQA.view(${index},true)`); }

const PROBE = `(() => ({at: new Date().toISOString(), url: location.href,
  viewport: {width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio},
  canvases: [...document.querySelectorAll('canvas')].flatMap(c => {
    const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return [];
    const dbg = gl.getExtension('WEBGL_debug_renderer_info'), rect = c.getBoundingClientRect();
    return [{width: c.width, height: c.height, cssWidth: rect.width, cssHeight: rect.height,
      drawingBufferWidth: gl.drawingBufferWidth, drawingBufferHeight: gl.drawingBufferHeight,
      renderer: gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      vendor: gl.getParameter(dbg ? dbg.UNMASKED_VENDOR_WEBGL : gl.VENDOR),
      version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      contextLost: gl.isContextLost(), attributes: gl.getContextAttributes()}];
  })}))()`;
async function probe(label) {
  const value = await evaluate(PROBE); value.label = label; report.canvasProbes.push(value);
  need('native-1080p-canvas-' + label, value.viewport.width === 1920 && value.viewport.height === 1080
    && value.viewport.deviceScaleFactor === 1 && value.canvases.length === 1 && value.canvases.every(c =>
      c.width === 1920 && c.height === 1080 && c.drawingBufferWidth === 1920 && c.drawingBufferHeight === 1080
      && !c.contextLost && hardwareRenderer(c.renderer)), value);
  return value;
}

async function capture(id, time = FIXED_TIME, extra = {}, standalone = false) {
  if (!/^[a-z0-9-]+$/.test(id) || report.captures.some(c => c.id === id)) throw Error('Unsafe/duplicate capture ID');
  if (report.captures.length >= LIMITS.captureCount) throw Error('Capture count bound reached');
  console.log('Capture ' + id);
  const info = await evaluate(standalone ? `new Promise(resolve => requestAnimationFrame(() => {
    const canvas=document.querySelector('canvas');
    window.__materialQAExport=canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
    resolve({length:window.__materialQAExport.length,capturedAt:new Date().toISOString(),snapshot:{
      gpu:window.__gpu,canvas:{width:canvas.width,height:canvas.height},cameraGoal:window.__cam,
      instrumentation:{fixedRAFCallbackMS:1250,standaloneSourceUnchanged:true},
      note:'Original page exposes camera goal only; exact camera/pixel equivalence to lab is NOT_ASSERTED.'}});
  }))` : `(async () => {
    const image = await labQA.capture(${time});
    if (typeof image !== 'string' || !image.startsWith('data:image/png;base64,')) throw Error('capture() must return PNG data URL');
    window.__materialQAExport = image.slice('data:image/png;base64,'.length);
    return {length: window.__materialQAExport.length, snapshot: labQA.snapshot(), capturedAt: new Date().toISOString()};
  })()`);
  try {
    if (!Number.isSafeInteger(info.length) || info.length <= 0 || info.length > Math.ceil(LIMITS.PNGBytes / 3) * 4)
      throw Error('PNG export exceeds declared bound');
    const chunks = [];
    for (let offset = 0; offset < info.length; offset += LIMITS.chunkCharacters) {
      const chunk = await evaluate(`window.__materialQAExport.slice(${offset},${offset + LIMITS.chunkCharacters})`);
      if (typeof chunk !== 'string' || chunk.length !== Math.min(LIMITS.chunkCharacters, info.length - offset)
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(chunk)) throw Error('Truncated/invalid base64 transfer');
      chunks.push(chunk);
    }
    const bytes = Buffer.from(chunks.join(''), 'base64'); totalPNGBytes += bytes.length;
    if (totalPNGBytes > LIMITS.totalPNGBytes) throw Error('Total PNG export bound reached');
    const path = id + '.png', snapshotPath = id + '.json';
    // Write even a malformed frame before validation so failed evidence survives.
    await writeFile(resolve(output, path), bytes);
    const stateBytes = JSON.stringify(info.snapshot, null, 2) + '\n';
    await writeFile(resolve(output, snapshotPath), stateBytes);
    const png = inspectPNG(bytes);
    const artifact = {id, path, snapshotPath, snapshotSHA256: sha256(stateBytes), snapshot: info.snapshot,
      time, capturedAt: info.capturedAt, capture_method: standalone ? 'browser-webgl-canvas-reference-fixed-RAF' : report.provenance.capture_method, png, ...extra};
    report.captures.push(artifact);
    check('capture-dimensions-' + id, png.width === 1920 && png.height === 1080 && png.opaqueFraction > .99, png);
    if (!standalone) check('actual-rendered-time-' + id, info.snapshot?.settings?.lastRenderedTime === time,
      {requestedTime: time, actualTime: info.snapshot?.settings?.lastRenderedTime});
    if (info.snapshot?.settings?.channel === 0) check('beauty-nonuniform-' + id, png.dynamicRange > 8, {dynamicRange: png.dynamicRange});
    if (report.captures.length % 7 === 0 || report.captures.length === 1) await save();
    return artifact;
  } finally { await evaluate('delete window.__materialQAExport').catch(e => errorRecord('export cleanup', e)); }
}

async function handleEvent(message) {
  const {method, params: p, sessionId} = message;
  if (method === 'Fetch.requestPaused') {
    let allowed = false;
    try { const u = new URL(p.request.url); allowed = ['data:', 'blob:', 'about:'].includes(u.protocol)
      || (['http:', 'https:'].includes(u.protocol) && u.hostname === '127.0.0.1'); } catch {}
    if (!allowed) {
      report.network.blocked.push({at: now(), url: p.request.url, requestId: p.requestId});
      await send('Fetch.failRequest', {requestId: p.requestId, errorReason: 'BlockedByClient'}, sessionId);
    } else await send('Fetch.continueRequest', {requestId: p.requestId}, sessionId);
  } else if (method === 'Network.requestWillBeSent') {
    report.network.requests.push({at: now(), sessionId, requestId: p.requestId, url: p.request.url,
      method: p.request.method, type: p.type, initiator: p.initiator, timestamp: p.timestamp,
      redirectFrom: p.redirectResponse?.url});
  } else if (method === 'Network.responseReceived') {
    const r = p.response;
    report.network.responses.push({at: now(), sessionId, requestId: p.requestId, url: r.url, status: r.status,
      type: p.type, mimeType: r.mimeType, fromDiskCache: Boolean(r.fromDiskCache), fromServiceWorker: Boolean(r.fromServiceWorker)});
  } else if (method === 'Network.loadingFailed') {
    report.network.failures.push({at: now(), sessionId, ...p});
  } else if (method === 'Runtime.exceptionThrown') {
    report.errors.push({at: now(), stage: 'runtime exception', details: p.exceptionDetails});
  } else if (method === 'Runtime.consoleAPICalled') {
    const text = p.args.map(a => a.value ?? a.description ?? a.type).join(' ');
    if (p.type === 'error') report.errors.push({at: now(), stage: 'console error', text, stack: p.stackTrace});
    else if (p.type === 'warning' || p.type === 'warn') report.warnings.push({at: now(), stage: 'console warning', text});
  } else if (method === 'Log.entryAdded') {
    (p.entry.level === 'error' ? report.errors : report.warnings).push({at: now(), stage: 'browser log', ...p.entry});
  } else if (method === 'Inspector.targetCrashed') errorRecord('renderer crash', 'Native browser target crashed');
}

async function launch() {
  const executable = option('browser') || process.env.LAB_QA_BROWSER || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
  ].find(existsSync);
  if (!executable || !existsSync(executable)) throw Error('Native Chromium not found; set LAB_QA_BROWSER or --browser=PATH');
  if (typeof WebSocket !== 'function') throw Error('Node with builtin WebSocket required (Node 22+ recommended)');
  tempParent = await realpath(tmpdir());
  profile = await mkdtemp(resolve(tempParent, 'material-lab-qa-'));
  const flags = ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--metrics-recording-only', '--disable-default-apps',
    '--use-angle=d3d11', '--disable-software-rasterizer', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-device-scale-factor=1',
    '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=0', '--window-size=1920,1080',
    '--user-data-dir=' + profile, 'about:blank'];
  report.browser = {executable, flags, nodeVersion: process.version, platform: process.platform, profile,
    windowsHide: true, nativeOnly: true, softwareFallbackAllowed: false};
  report.network.coldProfile = true;
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Native browser launch timeout')), 30000);
    browser = spawn(executable, flags, {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
    report.browser.pid = browser.pid;
    browser.once('error', e => { clearTimeout(timer); reject(e); });
    browser.once('exit', (code, signal) => { clearTimeout(timer); reject(Error('Browser exited before endpoint: ' + code + '/' + signal));
      if (!stopping) { errorRecord('browser exit', `code=${code} signal=${signal}`); rejectPending(Error('Browser exited')); } });
    browser.stderr.on('data', data => {
      if (browserStderr.length < LIMITS.logBytes) browserStderr += data.toString().slice(0, LIMITS.logBytes - browserStderr.length);
      else stderrTruncated = true;
      const match = browserStderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('CDP connection timeout')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, {once: true});
    socket.addEventListener('error', () => { clearTimeout(timer); reject(Error('CDP connection error')); }, {once: true});
  });
  socket.addEventListener('close', () => rejectPending(Error('CDP connection closed')));
  socket.addEventListener('message', event => {
    try {
      const message = JSON.parse(event.data), command = pending.get(message.id);
      if (command) { clearTimeout(command.timer); pending.delete(message.id); message.error
        ? command.reject(Error(JSON.stringify(message.error))) : command.resolve(message.result); }
      else if (message.method) track(handleEvent(message));
    } catch (error) { errorRecord('CDP message', error); }
  });
  report.browser.version = await send('Browser.getVersion', {}, null);
  report.browser.systemInfo = await send('SystemInfo.getInfo', {}, null);
  const {targetId} = await send('Target.createTarget', {url: 'about:blank'}, null);
  ({sessionId: session} = await send('Target.attachToTarget', {targetId, flatten: true}, null));
  for (const domain of ['Runtime', 'Page', 'Network', 'Log', 'Inspector']) await send(domain + '.enable');
  await send('Network.setCacheDisabled', {cacheDisabled: true}); report.network.cacheDisabled = true;
  await send('Network.setBypassServiceWorker', {bypass: true}); report.network.serviceWorkerBypassed = true;
  await send('Network.setBlockedURLs', {urls: ['ws://*', 'wss://*']});
  await send('Fetch.enable', {patterns: [{urlPattern: '*', requestStage: 'Request'}]}); report.network.externalHTTPBlocked = true;
  await send('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false});
}

async function bindServedSources() {
  // Read response bodies only outside measurement; this detects a stale/wrong server.
  const records = report.network.responses.filter(r => r.url.startsWith(URL_ROOT) && /(?:javascript|text\/html|application\/json)/.test(r.mimeType));
  for (const r of records) {
    if (report.network.servedSources.some(s => s.requestId === r.requestId)) continue;
    try {
      const body = await send('Network.getResponseBody', {requestId: r.requestId});
      const bytes = Buffer.from(body.body, body.base64Encoded ? 'base64' : 'utf8');
      let path = decodeURIComponent(new URL(r.url).pathname).slice(1); if (!path) path = 'index.html';
      const source = report.sources.start.files.find(f => f.path === path);
      const actualSHA256 = sha256(bytes);
      report.network.servedSources.push({requestId: r.requestId, path, url: r.url, sha256: actualSHA256, bytes: bytes.length});
      check('served-source-' + path, source?.sha256 === actualSHA256, {actualSHA256, expectedSHA256: source?.sha256});
    } catch (error) { errorRecord('served source response body', error); }
  }
}

async function uiAction(name, expression, expected) {
  const before = await snapshot(), dispatchResult = await evaluate(expression);
  // Sliders debounce before queueing their setter. Wait for the requested state,
  // then require it to remain stable after the debounce window and queued bake.
  try { await waitFor(`(() => {const s=labQA.snapshot().settings;return Object.entries(${JSON.stringify(expected)}).every(([k,v])=>s[k]===v)})()`, 5000); }
  catch (error) { check('UI-requested-state-timeout-' + name, false, error.message); }
  await evaluate('new Promise(resolve=>setTimeout(resolve,250))');
  await evaluate('labQA.set({})');
  const after = await snapshot();
  report.controls.actions.push({name, expected, before, after, dispatchResult});
  check('UI-' + name, matches(after.settings, expected), {expected, actual: after.settings});
}
async function controls() {
  await uiAction('baseline', "document.getElementById('baseline').click()", {mode: 'reference'});
  await uiAction('derived', "document.getElementById('derived').click()", {mode: 'lab'});
  for (const [name, value, event] of [['wetness', .37, 'input'], ['ripples', .73, 'input'], ['lighting', 'overcast', 'change'], ['channel', 2, 'input']]) {
    await uiAction(name, `(() => {const el=document.getElementById(${JSON.stringify(name)}); if(!el || el.disabled)throw Error('Missing/disabled UI control');el.value=${JSON.stringify(String(value))};el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));})()`, {[name]: value});
  }
  await set({auto: false, paused: true});
  await uiAction('orbit', "document.getElementById('orbit').click()", {auto: true});
  const before = await snapshot();
  await evaluate('new Promise(resolve=>{const start=performance.now();function tick(t){if(t-start>=1100)resolve();else requestAnimationFrame(tick)}requestAnimationFrame(tick)})');
  const after = await snapshot(); report.controls.orbit = {before, after};
  await uiAction('freeze', "document.getElementById('freeze').click()", {paused: false});
  const reset = async () => {
    await evaluate("document.getElementById('reset').click()"); await evaluate('labQA.set({})');
    await waitFor('labQA.snapshot().camera.view===0', 5000);
    await set({paused: true, auto: false});
  };
  await reset(); await capture('reset-a', FIXED_TIME, {view: 0});
  await set({wetness: .1, ripples: .9, lighting: 'raking', channel: 3}); await view(4);
  await capture('ui-altered', FIXED_TIME, {view: 4});
  await reset(); await capture('reset-b', FIXED_TIME, {view: 0});
}

async function recoveryControls() {
  await set({mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  report.controls.invalidRecovery = await evaluate(`(async () => {
    const results=[],validSettings={mode:'lab',wetness:1,ripples:1,lighting:'harbor',channel:0,auto:false,paused:true};
    for(const [name,input] of [['mode',{mode:'invalid'}],['lighting',{lighting:'invalid'}],['wetness',{wetness:NaN}],
      ['channel',{channel:NaN}],['paused',{paused:'invalid'}],['atomic-mixed',{wetness:.11,lighting:'invalid'}]]){
      const before=labQA.snapshot();let rejected=false,message;
      try{await labQA.set(input)}catch(error){rejected=true;message=error.message}
      const afterInvalid=labQA.snapshot();await labQA.set(validSettings);
      results.push({name,rejected,message,before,afterInvalid,afterRecovery:labQA.snapshot(),validSettings});
    }return results;
  })()`);
  await set({mode: 'reference', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  await view(0); await capture('reference-cycle-a', FIXED_TIME, {view: 0});
  report.controls.presetCycles = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    const states = [];
    for (const lighting of LIGHTS) for (const wetness of [0, 1]) {
      await set({mode: 'lab', wetness, ripples: wetness, lighting});
      await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      states.push(await snapshot());
    }
    report.controls.presetCycles.push(states);
  }
  await set({mode: 'reference', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  await view(0); await capture('reference-cycle-b', FIXED_TIME, {view: 0});
  await compareFrames('reference-cycle-a', 'reference-cycle-b');
}

async function standaloneReference() {
  // This script is installed only for the subsequent baseline document, never
  // in a performance run. The actual upstream HTML remains byte-identical.
  const {identifier} = await send('Page.addScriptToEvaluateOnNewDocument', {source:
    'const nativeRAF=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>nativeRAF(()=>callback(1250));'});
  try {
    const url = URL_ROOT + 'reference.html?view=0&still=1';
    await send('Page.navigate', {url}); await waitFor('window.__ready===true');
    await probe('independent-reference');
    await capture('standalone-reference', FIXED_TIME, {view: 0}, true); await bindServedSources();
    report.referenceLoad = {url, ready: true, at: now(), coldHTTPCache: true, fixedRAFCallbackMS: 1250,
      pixelEquivalence: 'NOT_ASSERTED', note: 'Actual standalone baseline image retained for independent composition review.'};
  } finally { await send('Page.removeScriptToEvaluateOnNewDocument', {identifier}); }
}

async function replayVisualOrderWithoutExports() {
  // Localize driver/program/environment history without another large PNG pack.
  const states = [], settle = () => evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))');
  for (const lighting of LIGHTS) for (const [label, wetness] of WETS) {
    await set({mode: 'lab', wetness, ripples: 1, lighting, channel: 0, auto: false, paused: true});
    for (let index = 0; index < 7; index++) {
      if (lighting === 'harbor' && label === 'wet' && index === 1) continue;
      await view(index); await settle();
    }
    states.push(await snapshot());
  }
  await set({mode: 'reference', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  for (let index = 0; index < 7; index++) { await view(index); await settle(); }
  await set({mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  await view(0);
  for (let channel = 1; channel <= 4; channel++) { await set({channel}); await settle(); }
  await set({channel: 0}); await view(1);
  await capture('ordered-cycle-repeat', FIXED_TIME, {view: 1});
  const comparison = await compareFrames('smoke-ground', 'ordered-cycle-repeat');
  report.controls.visualOrderReplay = {states, note: 'Original matrix setter/view/channel order replayed without matrix exports.'};
  check('ordered-cycle-repeat-exact-pixels', comparison.exactPixels);
}

async function visual() {
  await set({mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  await view(1); await capture(smoke ? 'smoke-ground' : 'lab-harbor-wet-v1', FIXED_TIME, {view: 1});
  await capture('fixed-time-immediate-repeat', FIXED_TIME, {view: 1});
  const immediate = await compareFrames(smoke ? 'smoke-ground' : 'lab-harbor-wet-v1', 'fixed-time-immediate-repeat');
  check('immediate-repeat-exact-pixels', immediate.exactPixels);
  await probe('first-render');
  await save();
  console.log(JSON.stringify({firstRender: true, errors: report.errors, canvas: report.canvasProbes.at(-1), evidence: output}));
  if (report.errors.length) throw Error('First native render has runtime/shader errors; root owns runtime fixes');
  if (smoke) {
    await replayVisualOrderWithoutExports();
    await controls(); await recoveryControls();
    await set({mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
    await view(1); await capture('fixed-time-repeat', FIXED_TIME, {view: 1});
    const repeat = await compareFrames('smoke-ground', 'fixed-time-repeat');
    check('state-cycle-repeat-exact-pixels', repeat.exactPixels);
    check('complete-visual-matrix', false, 'Focused smoke only; full visual matrix not collected'); return;
  }
  for (const lighting of LIGHTS) for (const [label, wetness] of WETS) {
    await set({mode: 'lab', wetness, ripples: 1, lighting, channel: 0, auto: false, paused: true});
    for (let index = 0; index < 7; index++) {
      const id = `lab-${lighting}-${label}-v${index}`;
      if (report.captures.some(c => c.id === id)) continue;
      await view(index); await capture(id, FIXED_TIME, {view: index});
    }
    if (report.errors.length) throw Error('Runtime/shader errors during visual matrix; evidence retained');
  }
  await set({mode: 'reference', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  for (let index = 0; index < 7; index++) { await view(index); await capture('reference-harbor-v' + index, FIXED_TIME, {view: index}); }
  await set({mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true});
  await view(0);
  for (let channel = 1; channel <= 4; channel++) { await set({channel}); await capture('channel-' + channel, FIXED_TIME, {view: 0}); }
  await set({channel: 0}); await view(1); await capture('fixed-time-repeat', FIXED_TIME, {view: 1});
  await compareFrames('lab-harbor-wet-v1', 'fixed-time-repeat');
  await set({ripples: 0}); await capture('ripples-off', FIXED_TIME, {view: 1});
  await set({ripples: 1});
  report.motion = {method: 'bounded fixed-time canvas frame samples; NOT realtime timing',
    fixedTimes: MOTION_TIMES, sampleSpacingSeconds: .25, benchmark: false, fullContinuousReview: false,
    continuousReview: 'UNVERIFIED', note: 'Twelve sampled stills cannot establish continuous motion quality or frame rate.'};
  for (let index = 0; index < MOTION_TIMES.length; index++)
    await capture('motion-' + String(index).padStart(2, '0'), MOTION_TIMES[index], {view: 1, motionIndex: index});
  await controls();
  await recoveryControls();
}

async function performancePhase() {
  await view(0);
  await set({mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: true, paused: false});
  await probe('before-benchmark'); await bindServedSources();
  report.performance = {sequence: 'single browser evaluation: 10000ms warmup immediately followed by 30000ms sample',
    captureCountBefore: report.captures.length, interveningCommands: []};
  // Exactly one CDP request spans both intervals. No timer polling, image export,
  // tracing, snapshot requests or filesystem work occurs during the measurement.
  const promise = evaluate(`(async () => {
    const before=labQA.snapshot(), warmupStartMS=performance.now();
    const warmup=await labQA.sample(10000), warmupEndMS=performance.now(), warmupEnd=labQA.snapshot();
    const sampleStartMS=performance.now(), sample=await labQA.sample(30000), sampleEndMS=performance.now();
    return {before,warmupEnd,after:labQA.snapshot(),warmup,sample,warmupStartMS,warmupEndMS,sampleStartMS,sampleEndMS};
  })()`, 55000);
  measurementActive = true;
  let raw;
  try { raw = await promise; } finally { measurementActive = false; }
  Object.assign(report.performance, raw, {captureCountAfter: report.captures.length});
  for (const phase of ['warmup', 'sample']) {
    const data = report.performance[phase]; data.intervals = data.raw ?? data.intervals ?? data.intervalsMS;
    data.observedElapsedMS = phase === 'warmup' ? raw.warmupEndMS - raw.warmupStartMS : raw.sampleEndMS - raw.sampleStartMS;
    // Preserve malformed original results even if statistics computation fails.
    await save(); data.statistics = summarizeIntervals(data.intervals);
  }
  const csv = ['phase,index,intervalMS', ...['warmup', 'sample'].flatMap(phase =>
    report.performance[phase].intervals.map((value, index) => `${phase},${index},${value}`))].join('\n') + '\n';
  await writeFile(resolve(output, 'raf-intervals.csv'), csv);
  report.performance.rawPath = 'raf-intervals.csv'; report.performance.rawSHA256 = sha256(csv);
  report.checks.push(...performanceAssertions(report));
}

async function cleanup() {
  stopping = true; clearTimeout(watchdog);
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close', {}, null, 3000); } catch { /* Closing the browser can close CDP before its reply. */ }
    socket.close();
  }
  if (browser && browser.exitCode === null && browser.signalCode === null) {
    await Promise.race([new Promise(r => browser.once('exit', r)), delay(3000)]);
    if (browser.exitCode === null && browser.signalCode === null) {
      browser.kill(); await Promise.race([new Promise(r => browser.once('exit', r)), delay(3000)]);
    }
  }
  rejectPending(Error('QA browser cleanup'));
  if (profile) {
    const exited = !browser || browser.exitCode !== null || browser.signalCode !== null;
    if (!exited) throw Error('Own browser has not exited; profile retained: ' + profile);
    const actual = await realpath(profile);
    if (actual !== profile || dirname(actual) !== tempParent || !basename(actual).startsWith('material-lab-qa-'))
      throw Error('Refusing cleanup outside own verified temporary profile');
    await rm(actual, {recursive: true, force: true, maxRetries: 3, retryDelay: 250});
    report.browser.profileRemoved = true;
  }
}

try {
  await save();
  const audit = await sourceAudit(); report.sources = {start: audit.manifest}; report.checks.push(...audit.checks);
  watchdog = setTimeout(() => { errorRecord('deadline', 'Bounded QA runtime exceeded'); rejectPending(Error('QA deadline exceeded')); browser?.kill(); }, LIMITS.runMS);
  await launch();
  await send('Page.navigate', {url: URL_ROOT});
  await waitFor("window.__ready===true && ['set','view','snapshot','capture','sample'].every(k=>typeof window.labQA?.[k]==='function')");
  report.initialSnapshot = await snapshot(); await probe('ready');
  await bindServedSources();
  if (phase === 'visual') await visual(); else await performancePhase();
  report.finalSnapshot = await snapshot(); await probe('complete'); await bindServedSources();
  if (phase === 'visual') {
    await standaloneReference();
    report.checks.push(...(smoke ? recoveryAssertions(report) : visualAssertions(report)));
  }
} catch (error) {
  errorRecord('harness', error);
  if (socket?.readyState === WebSocket.OPEN) {
    try { report.failureDiagnostics = await evaluate("({url:location.href,ready:window.__ready,loading:document.getElementById('ltxt')?.textContent,snapshot:window.labQA?.snapshot()})", 5000); }
    catch (diagnosticError) { errorRecord('failure diagnostics', diagnosticError); }
  }
} finally {
  measurementActive = false;
  try { await Promise.allSettled([...asynchronous]); } catch (error) { errorRecord('event drain', error); }
  try { report.sources ||= {}; report.sources.end = await sourceManifest();
    check('source-stable-through-run', canonical(report.sources.start) === canonical(report.sources.end));
  } catch (error) { errorRecord('final source fingerprint', error); }
  try { await cleanup(); } catch (error) { errorRecord('cleanup', error); }
  await writeFile(resolve(output, 'browser-stderr.log'), browserStderr);
  report.browserLog = {path: 'browser-stderr.log', sha256: sha256(browserStderr), truncated: stderrTruncated};
  check('no-runtime-errors', report.errors.length === 0, {count: report.errors.length});
  check('no-blocked-external-requests', report.network.blocked.length === 0, report.network.blocked);
  check('no-failed-requests', report.network.failures.length === 0, report.network.failures);
  check('no-HTTP-errors-or-cached-responses', report.network.responses.every(r => r.status < 400 && !r.fromDiskCache && !r.fromServiceWorker));
  check('no-runtime-external-art-loads', !report.network.requests.some(r => /^(?:Image|Media|Font)$/.test(r.type) && /^https?:/.test(r.url)));
  if (phase === 'visual' && !smoke) check('independent-reference-loaded', report.referenceLoad?.ready === true);
  report.finishedAt = now(); report.pass = report.errors.length === 0 && report.checks.length > 0 && report.checks.every(c => c.pass);
  report.status = report.pass ? 'AUTOMATED_PASS_REVIEW_UNVERIFIED' : 'BLOCKED';
  await save();
  console.log(JSON.stringify({scope: SCOPE, phase, pass: report.pass, captures: report.captures.length,
    failedChecks: report.checks.filter(c => !c.pass).map(c => c.name), errors: report.errors,
    continuousReview: 'UNVERIFIED', evidence: output, result: resolve(output, 'result.json')}, null, 2));
  if (!report.pass) process.exitCode = 1;
}
