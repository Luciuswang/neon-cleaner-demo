// Node builtins only. Importing this module does not run QA or write artifacts.
import {readFile, readdir, lstat} from 'node:fs/promises';
import {resolve, relative, sep, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';

export const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
export const SCOPE = 'browser-material-study';
export const PROFILE = 'offscreen-cinematic-v1';
export const LIGHTS = ['harbor', 'overcast', 'raking'];
export const WETS = [['dry', 0], ['mid', 0.5], ['wet', 1]];
export const MOTION_TIMES = Array.from({length: 12}, (_, i) => i / 4);
export const FIXED_TIME = 1.25;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonical = value => JSON.stringify(value, function (_key, item) {
  return item && !Array.isArray(item) && typeof item === 'object'
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item;
});
const check = (name, pass, details) => ({name, pass: Boolean(pass), ...(details === undefined ? {} : {details})});
export const matches = (actual, expected) => actual && Object.entries(expected).every(([k, v]) => actual[k] === v);
export const controlSettings = snapshot => Object.fromEntries(['mode', 'wetness', 'ripples', 'lighting', 'channel', 'auto', 'paused', 'exposure']
  .map(key => [key, snapshot?.settings?.[key]]));
export const hardwareRenderer = value => typeof value === 'string' && value.length > 8
  && !/swiftshader|llvmpipe|lavapipe|software|softpipe|\bwarp\b|basic render|microsoft remote|mesa offscreen/i.test(value)
  && /nvidia|geforce|quadro|radeon|\bamd\b|intel|apple|adreno|mali/i.test(value)
  && /Direct3D|D3D\d|Metal|Vulkan|OpenGL/i.test(value);

export async function sourceManifest(root = ROOT) {
  const files = [];
  async function walk(directory) {
    for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a, b) => a.name.localeCompare(b.name))) {
      if (/^(?:qa|evidence|proof|proofs|artifacts|node_modules|\.git)$/i.test(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Source symlink cannot be fingerprinted safely: ' + path);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(?:html?|m?js|cjs|css|json|txt)$/i.test(entry.name)) {
        const bytes = await readFile(path);
        files.push({path: relative(root, path).split(sep).join('/'), bytes: bytes.length, sha256: sha256(bytes)});
      }
    }
  }
  await walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {format: 'browser-material-source-v1-raw', files, sha256: sha256(canonical(files))};
}

export async function sourceAudit(root = ROOT) {
  const checks = [], manifest = await sourceManifest(root);
  const upstream = await readFile(resolve(root, 'vendor/materials-upstream.html'));
  const baseline = await readFile(resolve(root, 'reference.html'));
  const remoteImport = 'https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js';
  const needle = Buffer.from(remoteImport), offset = upstream.indexOf(needle);
  const expected = offset < 0 ? Buffer.alloc(0) : Buffer.concat([
    upstream.subarray(0, offset), Buffer.from('./vendor/three.module.js'), upstream.subarray(offset + needle.length)
  ]);
  // Only one optional final newline. No whitespace or CRLF normalization of source.
  const stripFinalNewline = b => b.at(-1) === 10 ? b.subarray(0, b.length - (b.at(-2) === 13 ? 2 : 1)) : b;
  checks.push(check('baseline-only-local-import-rewrite', offset >= 0 && upstream.indexOf(needle, offset + 1) < 0
    && stripFinalNewline(expected).equals(stripFinalNewline(baseline)), {
    upstreamSHA256: sha256(upstream), baselineSHA256: sha256(baseline), remoteImport,
    allowedChange: 'one CDN import URL to ./vendor/three.module.js; optional final newline only'
  }));
  const mitClauses = ['Permission is hereby granted, free of charge', 'to deal in the Software without restriction',
    'The above copyright notice and this permission notice shall be included',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND',
    'IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE'];
  for (const [file, copyright] of [['vendor/WQUGURU-LICENSE.txt', /Copyright.*2026 wquguru/],
    ['vendor/THREE-LICENSE.txt', /Copyright.*three\.js authors/]]) {
    const text = (await readFile(resolve(root, file), 'utf8')).replace(/\s+/g, ' ');
    checks.push(check('MIT-notice-' + file, /MIT License/.test(text) && copyright.test(text)
      && mitClauses.every(clause => text.includes(clause)), {file}));
  }
  const notice = await readFile(resolve(root, 'NOTICE.txt'), 'utf8');
  checks.push(check('source-attribution-and-local-three', /wquguru\/fable52-fps-repro/.test(notice)
    && /[a-f0-9]{40}/.test(notice) && /WQUGURU-LICENSE/.test(notice) && /THREE-LICENSE/.test(notice)
    && ['vendor/three.module.js', 'vendor/three.core.js', 'index.html', 'lab.mjs'].every(path => manifest.files.some(f => f.path === path))));
  const pins = JSON.parse(await readFile(resolve(root, 'vendor/pins.json'), 'utf8'));
  checks.push(check('upstream-revision-pin', pins.upstream?.revision === 'a7e1df3ce32eb2bb05e23ae457fe5fe2bffab961'
    && pins.upstream?.sha256 === 'b4e99f82d7816b7786ba1e91ac2e7b9df3a98ec65e870db4163648a8a0753a20'
    && notice.includes(pins.upstream.revision)));
  for (const [path, expectedHash] of [['vendor/materials-upstream.html', pins.upstream?.sha256],
    ['vendor/WQUGURU-LICENSE.txt', pins.upstream?.licenseSHA256], ['vendor/THREE-LICENSE.txt', pins.three?.licenseSHA256],
    ['vendor/three.module.js', pins.three?.files?.['three.module.js']], ['vendor/three.core.js', pins.three?.files?.['three.core.js']]])
    checks.push(check('pinned-bytes-' + path, /^[a-f0-9]{64}$/.test(expectedHash || '')
      && manifest.files.find(f => f.path === path)?.sha256 === expectedHash));
  const findings = [];
  // Libraries contain loader definitions. Inspect their *use* in first-party runtime,
  // including the immutable upstream HTML, not the Three.js class declarations.
  const patterns = [
    /\bnew\s+(?:[\w$]+\.)?(?:TextureLoader|ImageLoader|ImageBitmapLoader|CubeTextureLoader|RGBELoader|HDRLoader|EXRLoader|GLTFLoader|OBJLoader|FBXLoader|DRACOLoader|KTX2Loader|FontLoader|AudioLoader|FileLoader|ObjectLoader|Image|Audio)\s*\(/g,
    /\b(?:fetch|createImageBitmap|importScripts)\s*\(/g,
    /<(?:img|picture|video|audio|iframe|object)\b/gi,
    /(?:src\s*=\s*["']|url\(\s*["']?)[^"'\s)<>]*\.(?:png|jpe?g|webp|avif|gif|svg|hdr|exr|glb|gltf|obj|fbx|woff2?|ttf)(?:[?"'\s)]|$)/gi
  ];
  for (const f of manifest.files.filter(f => /\.(?:html?|m?js)$/i.test(f.path)
    && (!f.path.startsWith('vendor/') || f.path === 'vendor/materials-upstream.html') && f.path !== 'serve.mjs')) {
    const text = await readFile(resolve(root, f.path), 'utf8');
    for (const pattern of patterns) for (const match of text.matchAll(pattern)) findings.push({path: f.path,
      line: text.slice(0, match.index).split('\n').length, match: match[0]});
  }
  checks.push(check('no-source-image-HDR-model-loaders', findings.length === 0, {
    findings, method: 'conservative static scan plus separately recorded browser network audit; not a general JS proof'
  }));
  return {manifest, checks};
}

export function summarizeIntervals(intervals) {
  if (!Array.isArray(intervals) || !intervals.length || intervals.some(n => !Number.isFinite(n) || n <= 0))
    throw Error('Raw rAF intervals must be a nonempty list of finite, positive milliseconds');
  const sorted = [...intervals].sort((a, b) => a - b);
  const p = fraction => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return {count: intervals.length, sumMS: intervals.reduce((a, b) => a + b, 0),
    p50: p(.5), p95: p(.95), p99: p(.99), max: sorted.at(-1),
    over50: intervals.filter(n => n > 50).length, percentileMethod: 'nearest-rank; every raw interval retained'};
}

const crcTable = Array.from({length: 256}, (_, value) => {
  for (let k = 0; k < 8; k++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Validate and decode real browser PNGs; hashes of decoded pixels catch images
// differing only in PNG metadata. No image packages or screenshot APIs involved.
export function inspectPNG(bytes, includePixels = false) {
  if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) throw Error('Invalid PNG signature');
  let offset = 8, width, height, channels, ended = false, sawIDAT = false;
  const compressed = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw Error('Truncated PNG chunk');
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    if (end > bytes.length) throw Error('PNG chunk exceeds file');
    const type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, end - 4);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw Error('PNG CRC mismatch: ' + type);
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) throw Error('Invalid IHDR');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0;
      if (!width || !height || width * height > 16777216 || data[8] !== 8 || !channels || data[10] || data[11] || data[12])
        throw Error('Expected bounded noninterlaced 8-bit RGB/RGBA browser PNG');
    } else if (type === 'IDAT') { compressed.push(data); sawIDAT = true; }
    else if (type === 'IEND') { if (length || end !== bytes.length) throw Error('Invalid IEND'); ended = true; }
    offset = end;
  }
  if (!ended || !sawIDAT || !channels) throw Error('Incomplete PNG');
  const stride = width * channels, raw = inflateSync(Buffer.concat(compressed), {maxOutputLength: (stride + 1) * height});
  if (raw.length !== (stride + 1) * height) throw Error('Invalid decoded PNG length');
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let low = 255, high = 0, opaquePixels = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, a = x >= channels ? pixels[at - channels] : 0,
        b = y ? pixels[at - stride] : 0, c = y && x >= channels ? pixels[at - stride - channels] : 0;
      pixels[at] = (raw[y * (stride + 1) + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255;
      if (x % channels < 3) { low = Math.min(low, pixels[at]); high = Math.max(high, pixels[at]); }
      if (x % channels === channels - 1 && (channels === 3 || pixels[at] === 255)) opaquePixels++;
    }
  }
  return {width, height, channels, bytes: bytes.length, sha256: sha256(bytes), pixelSHA256: sha256(pixels),
    dynamicRange: high - low, opaqueFraction: opaquePixels / (width * height), ...(includePixels ? {pixels} : {})};
}

export function comparePNGs(firstBytes, secondBytes) {
  const a = inspectPNG(firstBytes, true), b = inspectPNG(secondBytes, true);
  if (a.width !== b.width || a.height !== b.height) throw Error('Cannot compare different image dimensions');
  let absoluteError = 0, max = 0, changedPixels = 0, changedComponents = 0, overOnePixels = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    let changed = false, overOne = false;
    for (let c = 0; c < 3; c++) {
      const difference = Math.abs(a.pixels[i * a.channels + c] - b.pixels[i * b.channels + c]);
      absoluteError += difference; max = Math.max(max, difference);
      if (difference) { changed = true; changedComponents++; }
      if (difference > 1) overOne = true;
    }
    if (changed) changedPixels++; if (overOne) overOnePixels++;
  }
  return {width: a.width, height: a.height, units: '8-bit RGB channel values; alpha excluded',
    MAE: absoluteError / (a.width * a.height * 3), max, changedPixels, changedComponents,
    changedPixelFraction: changedPixels / (a.width * a.height), pixelsWithDifferenceOverOne: overOnePixels,
    firstPixelSHA256: a.pixelSHA256, secondPixelSHA256: b.pixelSHA256, exactPixels: a.pixelSHA256 === b.pixelSHA256};
}

function exposure(snapshot) {
  return snapshot?.exposure ?? snapshot?.settings?.exposure ?? snapshot?.environment?.exposure
    ?? snapshot?.camera?.exposure ?? snapshot?.post?.exposure;
}
const sameCamera = (a, b) => Boolean(a?.snapshot?.camera && b?.snapshot?.camera)
  && canonical(a.snapshot.camera) === canonical(b.snapshot.camera);
const distinct = captures => captures.every(Boolean) && new Set(captures.map(c => c.png.pixelSHA256)).size === captures.length;
export function visualAssertions(report) {
  const checks = [], captures = report.captures || [], find = id => captures.find(c => c.id === id);
  for (const lighting of LIGHTS) for (const [label, wetness] of WETS) {
    const group = [];
    for (let view = 0; view < 7; view++) {
      const c = find(`lab-${lighting}-${label}-v${view}`); group.push(c);
      checks.push(check(`matrix-${lighting}-${label}-v${view}`, c && c.view === view && c.time === FIXED_TIME
        && matches(c.snapshot?.settings, {mode: 'lab', wetness, ripples: 1, lighting, channel: 0, auto: false, paused: true})));
    }
    checks.push(check(`seven-distinct-views-${lighting}-${label}`, distinct(group)
      && new Set(group.map(c => canonical(c?.snapshot?.camera))).size === 7));
  }
  for (const lighting of LIGHTS) checks.push(check('wetness-distinct-' + lighting,
    distinct(WETS.map(([label]) => find(`lab-${lighting}-${label}-v1`)))));
  for (const [label] of WETS) checks.push(check('lighting-distinct-' + label,
    distinct(LIGHTS.map(l => find(`lab-${l}-${label}-v0`)))));
  for (let view = 0; view < 7; view++) {
    const a = find('reference-harbor-v' + view), b = find('lab-harbor-wet-v' + view);
    checks.push(check('same-camera-time-exposure-AB-v' + view, sameCamera(a, b) && a.time === b.time
      && Number.isFinite(exposure(a.snapshot)) && exposure(a.snapshot) === exposure(b.snapshot)
      && matches(a.snapshot.settings, {mode: 'reference', lighting: 'harbor', channel: 0, auto: false, paused: true})));
  }
  checks.push(check('reference-lab-ground-actually-differs', distinct([find('reference-harbor-v1'), find('lab-harbor-wet-v1')])));
  const beauty = find('lab-harbor-wet-v0'), channels = [beauty];
  for (let channel = 1; channel <= 4; channel++) {
    const c = find('channel-' + channel); channels.push(c);
    checks.push(check('channel-state-' + channel, c && c.snapshot?.settings?.channel === channel && sameCamera(c, beauty)));
  }
  checks.push(check('five-distinct-material-channels', distinct(channels)));
  const wet = find('lab-harbor-wet-v1'), repeat = find('fixed-time-repeat'), noRipple = find('ripples-off');
  const immediate = find('fixed-time-immediate-repeat');
  checks.push(check('fixed-time-immediate-repeat-identical', sameCamera(wet, immediate) && wet.time === immediate.time
    && wet.snapshot.environment.revision === immediate.snapshot.environment.revision
    && wet.png.pixelSHA256 === immediate.png.pixelSHA256));
  checks.push(check('fixed-time-repeat-identical', sameCamera(wet, repeat) && wet.time === repeat.time
    && wet.png.pixelSHA256 === repeat.png.pixelSHA256));
  checks.push(check('ripple-control-distinct-fixed-frame', sameCamera(wet, noRipple) && noRipple.time === wet.time
    && noRipple.snapshot.settings.ripples === 0 && distinct([wet, noRipple])));
  const motion = report.motion;
  checks.push(check('motion-explicitly-not-continuous-review', motion?.fullContinuousReview === false
    && motion?.continuousReview === 'UNVERIFIED' && motion?.benchmark === false));
  const frames = MOTION_TIMES.map((time, index) => find('motion-' + String(index).padStart(2, '0')));
  checks.push(check('bounded-fixed-time-motion-sequence', frames.every((c, i) => c && c.time === MOTION_TIMES[i]
    && c.motionIndex === i && sameCamera(c, frames[0]) && matches(c.snapshot.settings,
      {mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: false, paused: true}))
    && new Set(frames.map(c => c?.png.pixelSHA256)).size > 1));
  const ui = report.controls;
  const requiredActions = ['baseline', 'derived', 'wetness', 'ripples', 'lighting', 'channel', 'orbit', 'freeze'];
  checks.push(check('UI-controls-observed-state', requiredActions.every(name => {
    const action = ui?.actions?.find(a => a.name === name);
    return action && matches(action.after?.settings, action.expected);
  })));
  checks.push(check('actual-auto-orbit-camera-motion', ui?.orbit?.before?.settings?.auto === true
    && ui.orbit.after?.settings?.auto === true && canonical(ui.orbit.before.camera) !== canonical(ui.orbit.after.camera)));
  const a = find('reset-a'), b = find('reset-b'), altered = find('ui-altered');
  checks.push(check('reset-restores-camera-settings-and-pixels', sameCamera(a, b)
    && canonical(controlSettings(a?.snapshot)) === canonical(controlSettings(b?.snapshot))
    && a?.png.pixelSHA256 === b?.png.pixelSHA256 && distinct([a, altered])));
  checks.push(...recoveryAssertions(report));
  checks.push(check('independent-reference-canvas-captured', report.referenceLoad?.ready === true
    && report.referenceLoad?.pixelEquivalence === 'NOT_ASSERTED' && Boolean(find('standalone-reference'))));
  return checks;
}

export function recoveryAssertions(report) {
  const c = report.controls, find = id => report.captures.find(c => c.id === id), checks = [];
  checks.push(check('invalid-input-rejected-atomically-and-recovers', c?.invalidRecovery?.length >= 6
    && c.invalidRecovery.every(test => test.rejected
      && canonical(controlSettings(test.before)) === canonical(controlSettings(test.afterInvalid))
      && matches(test.afterRecovery?.settings, test.validSettings))));
  const a = find('reference-cycle-a'), b = find('reference-cycle-b');
  checks.push(check('reference-deterministic-after-dry-wet-lighting-cycles', sameCamera(a, b) && a.time === b.time
    && a.png.pixelSHA256 === b.png.pixelSHA256 && canonical(controlSettings(a.snapshot)) === canonical(controlSettings(b.snapshot))));
  const cycles = c?.presetCycles;
  checks.push(check('preset-cycles-retain-bounded-texture-count', cycles?.length === 2 && cycles.every(cycle => cycle.length === 6)
    && cycles[0].every((s, i) => Number.isInteger(s.stats?.memory?.textures) && s.stats.memory.textures > 0
      && cycles[1][i].stats?.memory?.textures === s.stats.memory.textures
      && s.environment?.ownedTargets === 1 && cycles[1][i].environment?.ownedTargets === 1)));
  return checks;
}

export function performanceAssertions(report) {
  const p = report.performance, checks = [];
  if (!p) return [check('performance-evidence-present', false)];
  for (const [name, duration] of [['warmup', 10000], ['sample', 30000]]) {
    try {
      const data = p[name], stats = summarizeIntervals(data.intervals);
      checks.push(check(name + '-raw-contiguous-duration', data.elapsedMS >= duration
        && Math.abs(stats.sumMS - data.elapsedMS) <= stats.max + 5
        && Math.abs(data.elapsedMS - data.observedElapsedMS) < 100, {elapsedMS: data.elapsedMS, stats}));
      checks.push(check(name + '-statistics-derived-from-all-intervals', canonical(stats) === canonical(data.statistics)));
      if (name === 'sample') checks.push(check('realtime-frame-budget', stats.p95 <= 33.3 && stats.p99 <= 33.3 && stats.max <= 50 && stats.over50 === 0, stats));
    } catch (error) { checks.push(check(name + '-raw-intervals', false, error.message)); }
  }
  checks.push(check('measurement-isolated-from-captures-and-CDP-polling', p.interveningCommands?.length === 0
    && report.captures?.length === 0 && p.captureCountBefore === 0 && p.captureCountAfter === 0
    && p.sequence === 'single browser evaluation: 10000ms warmup immediately followed by 30000ms sample'
    && p.sampleStartMS >= p.warmupEndMS && p.sampleStartMS - p.warmupEndMS < 50));
  checks.push(check('performance-auto-orbit-actually-active', [p.before, p.warmupEnd, p.after].every(s =>
    matches(s?.settings, {mode: 'lab', wetness: 1, ripples: 1, lighting: 'harbor', channel: 0, auto: true, paused: false}))
    && canonical(p.before?.camera) !== canonical(p.after?.camera)));
  return checks;
}

async function artifactPath(directory, path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.startsWith('/') || path.split('/').includes('..')) throw Error('Unsafe artifact path');
  const full = resolve(directory, path), rel = relative(directory, full);
  if (rel.startsWith('..') || rel.includes(':')) throw Error('Artifact escaped evidence directory');
  let cursor = full;
  while (cursor !== directory) { if ((await lstat(cursor)).isSymbolicLink()) throw Error('Artifact symlink rejected'); cursor = dirname(cursor); }
  return full;
}

export async function validateReport(path, currentAudit) {
  const directory = dirname(resolve(path)), report = JSON.parse(await readFile(path, 'utf8'));
  const checks = [check('explicit-browser-scope', report.scope === SCOPE && report.quality_profile === PROFILE
    && report.schema === 'browser-material-qa-v1' && report.provenance?.engine === 'browser-webgl'
    && report.provenance?.ueEvidence === false), check('finished-report', Boolean(report.finishedAt) && report.status !== 'RUNNING'),
    check('report-automated-checks-passed', report.pass === true && report.checks?.length > 0 && report.checks.every(c => c.pass)
      && Array.isArray(report.errors) && report.errors.length === 0)];
  const current = currentAudit || await sourceAudit();
  checks.push(...current.checks);
  checks.push(check('current-source-matches-start-and-finish', canonical(report.sources?.start) === canonical(current.manifest)
    && canonical(report.sources?.end) === canonical(current.manifest)));
  checks.push(check('native-browser-and-canvas', report.browser?.version?.product && report.browser?.systemInfo?.gpu
    && report.canvasProbes?.length >= 2 && report.canvasProbes.every(probe => probe.viewport?.width === 1920
      && probe.viewport?.height === 1080 && probe.viewport?.deviceScaleFactor === 1 && probe.canvases?.length === 1
      && probe.canvases.every(c => c.width === 1920 && c.height === 1080 && c.drawingBufferWidth === 1920
        && c.drawingBufferHeight === 1080 && !c.contextLost && hardwareRenderer(c.renderer)))));
  const network = report.network;
  checks.push(check('cold-profile-offline-network-audit', network?.coldProfile === true && network.cacheDisabled === true
    && network.serviceWorkerBypassed === true && network.externalHTTPBlocked === true && network.blocked?.length === 0
    && network.failures?.length === 0 && network.requests?.length > 0 && network.responses?.length > 0
    && network.requests.every(r => { try { const u = new URL(r.url); return u.protocol === 'data:' || u.protocol === 'blob:' || u.hostname === '127.0.0.1'; } catch { return false; } })
    && network.responses.every(r => r.status < 400 && !r.fromDiskCache && !r.fromServiceWorker)
    && !network.requests.some(r => /^(?:Image|Media|Font)$/.test(r.type) && /^https?:/.test(r.url))));
  checks.push(check('served-runtime-byte-identity', ['index.html', 'lab.mjs', 'vendor/three.module.js', 'vendor/three.core.js']
    .every(path => network?.servedSources?.some(s => s.path === path && s.sha256 === current.manifest.files.find(f => f.path === path)?.sha256))
    && network?.servedSources?.every(s => s.sha256 === current.manifest.files.find(f => f.path === s.path)?.sha256)));
  const ids = new Set();
  for (const c of report.captures || []) {
    try {
      if (ids.has(c.id)) throw Error('Duplicate capture ID'); ids.add(c.id);
      const decoded = inspectPNG(await readFile(await artifactPath(directory, c.path)));
      const stateBytes = await readFile(await artifactPath(directory, c.snapshotPath));
      checks.push(check('artifact-' + c.id, decoded.width === 1920 && decoded.height === 1080
        && canonical(decoded) === canonical(c.png) && sha256(stateBytes) === c.snapshotSHA256
        && canonical(JSON.parse(stateBytes)) === canonical(c.snapshot)
        && ((c.capture_method === 'browser-webgl-canvas-labQA.capture' && c.snapshot?.settings?.lastRenderedTime === c.time)
          || (c.id === 'standalone-reference' && c.capture_method === 'browser-webgl-canvas-reference-fixed-RAF'))
        && Boolean(c.capturedAt)));
    } catch (error) { checks.push(check('artifact-' + c.id, false, error.message)); }
  }
  if (report.phase === 'visual') checks.push(...visualAssertions(report));
  else if (report.phase === 'performance') {
    checks.push(...performanceAssertions(report));
    try {
      const bytes = await readFile(await artifactPath(directory, report.performance.rawPath));
      const expected = ['phase,index,intervalMS', ...['warmup', 'sample'].flatMap(phase =>
        report.performance[phase].intervals.map((n, i) => `${phase},${i},${n}`))].join('\n') + '\n';
      checks.push(check('raw-CSV-integrity', sha256(bytes) === report.performance.rawSHA256 && bytes.toString('utf8') === expected));
    } catch (error) { checks.push(check('raw-CSV-integrity', false, error.message)); }
  } else checks.push(check('known-phase', false));
  return {path: resolve(path), phase: report.phase, scope: SCOPE, quality_profile: PROFILE,
    pass: checks.every(c => c.pass), checks, visualArt: 'UNVERIFIED', continuousReview: 'UNVERIFIED', ueEvidence: false};
}

async function main() {
  const args = process.argv.slice(2), value = name => args.find(a => a.startsWith('--' + name + '='))?.split('=').slice(1).join('=');
  if (args.includes('--help')) { console.log('node qa/validate.mjs [--scope=browser-material-study] [--phase=visual|performance] [--report=PATH]\nWithout --report: inspect latest report of each requested phase, including failures. No artifacts are written.'); return; }
  for (const arg of args) if (!/^--(?:scope|phase|report)=/.test(arg)) throw Error('Unknown argument: ' + arg);
  if (value('scope') && value('scope') !== SCOPE) throw Error('This validator accepts only scope ' + SCOPE + '; it is not a UE validator');
  const phase = value('phase');
  if (phase && !['visual', 'performance'].includes(phase)) throw Error('Unknown phase: ' + phase);
  let paths = [];
  if (value('report')) paths = [resolve(value('report'))];
  else {
    const directory = resolve(ROOT, 'qa/evidence');
    const entries = await readdir(directory, {withFileTypes: true});
    for (const wanted of phase ? [phase] : ['visual', 'performance']) {
      const names = entries.filter(e => e.isDirectory() && !e.isSymbolicLink() && e.name.startsWith(wanted + '-')).map(e => e.name).sort().reverse();
      // Never fall back to an older passing run when the newest run is incomplete.
      if (!names.length) throw Error('No ' + wanted + ' report');
      paths.push(resolve(directory, names[0], 'result.json'));
    }
  }
  const audit = await sourceAudit(), results = [];
  for (const path of paths) {
    try { const result = await validateReport(path, audit); if (phase && result.phase !== phase) throw Error('Requested phase does not match report'); results.push(result); }
    catch (error) { results.push({path, pass: false, error: error.stack}); }
  }
  console.log(JSON.stringify({scope: SCOPE, quality_profile: PROFILE, pass: results.every(r => r.pass),
    acceptance: 'Automated browser evidence only; independent visual and continuous review remain UNVERIFIED; no UE provenance.', results}, null, 2));
  if (!results.every(r => r.pass)) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({scope: SCOPE, pass: false, error: error.stack})); process.exitCode = 1; });
}
