// CPU only. Run from any cwd: node qa/procedural-materials-checks.mjs
// No reports/files, renderer, browser, image requests, Git or GPU processes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as T from '../../sunbreak-storm-v3/vendor/presentation/build/three.module.js';
import {
  buildProceduralMaterials, bakeProceduralSurface, createProceduralBaker, normalFromHeight,
  PROCEDURAL_FAMILIES, PROCEDURAL_SCALES, PROCEDURAL_SIZE, PROCEDURAL_SEED,
} from '../procedural-materials.js';

const moduleURL = new URL('../procedural-materials.js', import.meta.url);
const sha = data => createHash('sha256').update(ArrayBuffer.isView(data)
  ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : data).digest('hex');
const digest = baked => Object.fromEntries(['albedo', 'normal', 'orm', 'heightField'].map(k => [k, sha(baked[k])]));
const wrap = (n, size) => ((n % size) + size) % size;
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks++; }
function equal(a, b, label) { assert.deepEqual(a, b, label); checks++; }
const near = (a, b, tolerance, label) => ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`);
function range(a, stride = 1, channel = 0) {
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = channel; i < a.length; i += stride) { min = Math.min(min, a[i]); max = Math.max(max, a[i]); sum += a[i]; }
  return { min, max, mean: sum / (a.length / stride) };
}
function correlation(count, getA, getB) {
  let a = 0, b = 0, ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < count; i++) {
    const x = getA(i), y = getB(i); a += x; b += y; ab += x * y; aa += x * x; bb += y * y;
  }
  return (count * ab - a * b) / Math.sqrt((count * aa - a * a) * (count * bb - b * b));
}
const luminance = (baked, i) => baked.albedo[i * 4] * .2126 + baked.albedo[i * 4 + 1] * .7152 + baked.albedo[i * 4 + 2] * .0722;

function seamMetrics(data, size, stride, channels) {
  let edgeX = 0, edgeY = 0, internalX = 0, internalY = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (const c of channels) {
    const a = data[(y * size + x) * stride + c];
    const dx = Math.abs(a - data[(y * size + (x + 1) % size) * stride + c]);
    const dy = Math.abs(a - data[(((y + 1) % size) * size + x) * stride + c]);
    if (x === size - 1) edgeX += dx; else internalX += dx;
    if (y === size - 1) edgeY += dy; else internalY += dy;
  }
  return {
    x: edgeX * (size - 1) / Math.max(internalX, 1e-9),
    y: edgeY * (size - 1) / Math.max(internalY, 1e-9),
    directionalRatio: internalY / Math.max(internalX, 1e-9),
  };
}

function normalChecks(baked) {
  const size = baked.width, h = baked.heightField, normal = baked.normal, scale = baked.info;
  let maxLengthError = 0, maxDerivativeError = 0, finite = true;
  // Independent physical central derivative, including boundary and corner pixels.
  const derivativeScale = scale.heightMetres / (2 * scale.tileMetres / size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, k = i * 4;
    finite &&= Number.isFinite(h[i]) && h[i] >= 0 && h[i] <= 1;
    const nx = normal[k] / 255 * 2 - 1, ny = normal[k + 1] / 255 * 2 - 1, nz = normal[k + 2] / 255 * 2 - 1;
    maxLengthError = Math.max(maxLengthError, Math.abs(Math.hypot(nx, ny, nz) - 1));
    const dx = (h[y * size + wrap(x + 1, size)] - h[y * size + wrap(x - 1, size)]) * derivativeScale;
    const dy = (h[wrap(y + 1, size) * size + x] - h[wrap(y - 1, size) * size + x]) * derivativeScale;
    const length = Math.hypot(dx, dy, 1);
    maxDerivativeError = Math.max(maxDerivativeError, Math.abs(nx + dx / length), Math.abs(ny + dy / length), Math.abs(nz - 1 / length));
    assert.equal(normal[k + 3], 255, `${baked.key}: normal alpha`);
    assert.equal(baked.orm[k + 3], 255, `${baked.key}: ORM alpha`);
    assert.equal(baked.albedo[k + 3], Math.round(h[i] * 255), `${baked.key}: float height in diffuse alpha`);
  }
  ok(finite, `${baked.key}: finite normalized float height`);
  ok(maxLengthError <= .007, `${baked.key}: unit normals within RGBA8 quantization (${maxLengthError})`);
  ok(maxDerivativeError <= 1 / 255 + 1e-7, `${baked.key}: signed OpenGL normal from height, including periodic boundary`);
  return { maxLengthError, maxDerivativeError };
}

const originalRandom = Math.random;
let randomCalls = 0;
Math.random = () => { randomCalls++; throw new Error('Bake touched ambient RNG'); };
const fingerprints = {}, surfaces = {}, metrics = {};
try {
  const baker = createProceduralBaker();
  for (const key of PROCEDURAL_FAMILIES) {
    const baked = baker.bake(key);
    fingerprints[key] = digest(baked);
    if (!process.argv.includes('--fingerprints')) surfaces[key] = baked;
  }
  baker.dispose();
} finally { Math.random = originalRandom; }

if (process.argv.includes('--fingerprints')) {
  console.log(JSON.stringify(fingerprints));
} else {
  const started = performance.now();
  equal(T.REVISION, '160', 'Existing River vendor remains Three r160');
  equal(PROCEDURAL_FAMILIES, ['mud', 'dirt', 'forest_ground_04', 'stone', 'plaster', 'wood', 'brick', 'metal'], 'Exact surface whitelist');
  equal(randomCalls, 0, 'Pure bakes consume zero ambient random numbers');
  equal(typeof globalThis.document, 'undefined', 'Pure bakes run with no DOM');

  const second = createProceduralBaker();
  for (const key of [...PROCEDURAL_FAMILIES].reverse()) {
    const rebaked = second.bake(key);
    equal(digest(rebaked), fingerprints[key], `${key}: exact bytes after reversed bake order`);
    equal(rebaked.info, surfaces[key].info, `${key}: exact deterministic metadata`);
  }
  second.dispose(); second.dispose();
  assert.throws(() => second.bake('mud'), /disposed/); checks++;
  equal(digest(bakeProceduralSurface('wood')), fingerprints.wood, 'Pure convenience API matches shared session');
  const changedSeed = createProceduralBaker({ seed: PROCEDURAL_SEED + 1 });
  for (const key of PROCEDURAL_FAMILIES) ok(sha(changedSeed.bake(key).albedo) !== fingerprints[key].albedo, `${key}: seed changes actual bytes`);
  changedSeed.dispose();
  const processFingerprints = JSON.parse(execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--fingerprints'], {
    encoding: 'utf8', windowsHide: true, timeout: 30000,
  }));
  equal(processFingerprints, fingerprints, 'Exact SHA256 determinism across a fresh CPU process');

  const mapHashes = new Set();
  for (const [key, baked] of Object.entries(surfaces)) {
    equal([baked.width, baked.height], [512, 512], `${key}: bounded square 512 bake`);
    const count = baked.width * baked.height;
    for (const slot of ['albedo', 'normal', 'orm']) {
      ok(baked[slot] instanceof Uint8Array && baked[slot].length === count * 4, `${key} ${slot}: RGBA8 dimensions`);
      const limits = range(baked[slot]);
      ok(limits.min >= 0 && limits.max <= 255, `${key} ${slot}: channel range`);
      mapHashes.add(sha(baked[slot]));
    }
    equal(baked.heightField.length, count, `${key}: height dimensions`);
    const height = range(baked.heightField), rough = range(baked.orm, 4, 1), ao = range(baked.orm, 4, 0);
    ok(height.max - height.min > .03 && height.max - height.min < .65, `${key}: relief is present and bounded`);
    ok(rough.min >= 70 && rough.max <= 255 && rough.max > rough.min, `${key}: sensible varying dry roughness`);
    ok(ao.min > 130 && ao.max <= 255, `${key}: shallow AO, no painted black cracks`);
    if (key !== 'metal') equal(range(baked.orm, 4, 2), { min: 0, max: 0, mean: 0 }, `${key}: dielectric ORM B`);
    const normal = normalChecks(baked), seams = {};
    for (const [slot, stride, channels] of [['heightField', 1, [0]], ['albedo', 4, [0, 1, 2]], ['normal', 4, [0, 1, 2]], ['orm', 4, [0, 1]]]) {
      seams[slot] = seamMetrics(baked[slot], baked.width, stride, channels);
      // Adjacent texels on opposite sides are not equal (duplicating an edge
      // makes a flat strip). Their gradient must remain ordinary for the field.
      ok(seams[slot].x < 2.75 && seams[slot].y < 2.75, `${key} ${slot}: no boundary derivative spike (${JSON.stringify(seams[slot])})`);
    }
    const heightColor = correlation(count, i => baked.heightField[i], i => luminance(baked, i));
    const heightAO = correlation(count, i => baked.heightField[i], i => baked.orm[i * 4]);
    if (['mud', 'dirt', 'forest_ground_04', 'stone', 'plaster', 'brick'].includes(key)) {
      ok(heightColor > .45, `${key}: albedo follows shared relief (${heightColor})`);
      ok(heightAO > .3, `${key}: cavities correlate with AO (${heightAO})`);
    }
    metrics[key] = { height, rough, ao, heightColor, heightAO, normal, seams };
  }
  equal(mapHashes.size, 24, 'Every family and map has distinct actual pixel content');

  // Feature intent checks are quantitative material checks, not an art verdict.
  ok(range(surfaces.dirt.albedo, 4, 0).mean > range(surfaces.mud.albedo, 4, 0).mean + 25, 'Compact path is visibly paler than umber soil');
  for (const key of ['mud', 'dirt', 'forest_ground_04']) {
    ok(range(surfaces[key].albedo, 4, 0).mean > range(surfaces[key].albedo, 4, 1).mean
      && range(surfaces[key].albedo, 4, 1).mean > range(surfaces[key].albedo, 4, 2).mean, `${key}: natural brown palette`);
  }
  const plaster = surfaces.plaster;
  ok(range(plaster.albedo, 4, 0).mean > 120 && range(plaster.albedo, 4, 0).mean < 150, 'Plaster is medium grey');
  ok(range(plaster.albedo, 4, 0).mean - range(plaster.albedo, 4, 2).mean < 16, 'Plaster warmth is restrained');
  const wood = surfaces.wood, woodRed = range(wood.albedo, 4, 0);
  ok(metrics.wood.seams.heightField.directionalRatio > 2, 'Wood relief runs along horizontal U');
  ok(metrics.wood.seams.albedo.directionalRatio > 1.5, 'Wood color grain runs along horizontal U');
  ok(woodRed.max - woodRed.min < 45, 'Muted timber contrast, no black/white zebra grain');
  const metal = surfaces.metal;
  let rustPixels = 0, rustMetal = 0, rustRough = 0, barePixels = 0, bareRough = 0, paintPixels = 0;
  for (let i = 0; i < metal.width * metal.height; i++) {
    const k = i * 4;
    if (metal.albedo[k] - metal.albedo[k + 1] > 32) { rustPixels++; rustMetal += metal.orm[k + 2]; rustRough += metal.orm[k + 1]; }
    if (metal.orm[k + 2] > 210) { barePixels++; bareRough += metal.orm[k + 1]; }
    if (metal.orm[k + 2] === 0 && metal.albedo[k + 1] > metal.albedo[k]) paintPixels++;
  }
  ok(rustPixels > 1000 && barePixels > 1000 && paintPixels > 1000, 'Metal has distinct paint, exposed metal and rust populations');
  ok(rustMetal / rustPixels < 40, 'Rust is predominantly nonmetallic');
  ok(rustRough / rustPixels > bareRough / barePixels + 60, 'Rust is rougher than exposed metal');
  metrics.metal.populations = { rustPixels, barePixels, paintPixels, rustMetalMean: rustMetal / rustPixels, rustRoughMean: rustRough / rustPixels, bareRoughMean: bareRough / barePixels };

  // Analytic periodic slopes independently catch green inversion, resolution
  // scaling and the common clamp-at-edge derivative bug at both resolutions.
  for (const size of [512, 1024]) {
    const h = new Float32Array(size * size), tileMetres = 2, heightMetres = .02;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = .5 + .15 * Math.sin(2 * Math.PI * x / size) + .20 * Math.sin(2 * Math.PI * y / size);
    const n = normalFromHeight(h, size, { tileMetres, heightMetres });
    for (const [x, y] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1], [size / 2, size / 2]]) {
      const dx = .15 * 2 * Math.PI * Math.cos(2 * Math.PI * x / size) * heightMetres / tileMetres;
      const dy = .20 * 2 * Math.PI * Math.cos(2 * Math.PI * y / size) * heightMetres / tileMetres;
      const length = Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
      near(n[k] / 255 * 2 - 1, -dx / length, .0041, `${size}: periodic analytic red`);
      near(n[k + 1] / 255 * 2 - 1, -dy / length, .0041, `${size}: periodic analytic OpenGL green`);
    }
    ok(n[0] < 128 && n[1] < 128, `${size}: rising +U/+V height tilts normal toward -U/-V`);
    const half = (size / 2 * size + size / 2) * 4;
    ok(n[half] > 128 && n[half + 1] > 128, `${size}: descending height reverses normal`);
  }
  const high = bakeProceduralSurface('stone', { size: 1024 });
  equal(high.albedo.length, 1024 * 1024 * 4, 'Optional 1024 pure bake dimensions');
  normalChecks(high);
  for (const size of [0, 256, 513, 2048, NaN]) { assert.throws(() => createProceduralBaker({ size }), /512 or 1024/); checks++; }
  for (const seed of [-1, .5, NaN, 2 ** 32]) { assert.throws(() => createProceduralBaker({ seed }), /uint32/); checks++; }
  assert.throws(() => bakeProceduralSurface('roof'), /Unknown procedural family/); checks++;
  assert.throws(() => normalFromHeight(new Float32Array(2), 512), /dimensions/); checks++;
  assert.throws(() => normalFromHeight(new Float32Array(512 * 512), 512, { tileMetres: 0 }), /physical/); checks++;

  // Real existing Three classes, no WebGLRenderer. Network/image APIs fail fast.
  const savedGlobals = new Map(['fetch', 'Image', 'XMLHttpRequest', 'OffscreenCanvas', 'requestAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let externalCalls = 0;
  for (const key of savedGlobals.keys()) Object.defineProperty(globalThis, key, {
    configurable: true, writable: true, value: function () { externalCalls++; throw new Error(`Unexpected runtime dependency: ${key}`); },
  });
  let built;
  try { built = await buildProceduralMaterials(T, { capabilities: { getMaxAnisotropy: () => 16 } }); }
  finally {
    for (const [key, descriptor] of savedGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
  equal(externalCalls, 0, 'Builder makes no image, network, canvas or frame requests');
  equal(Object.keys(built.materials), PROCEDURAL_FAMILIES, 'Builder API has exact material keys');
  equal(JSON.parse(JSON.stringify(built.info)), built.info, 'Runtime info is a plain JSON object');
  equal(built.info.estimatedGPUBytes, 33554400, 'Actual 24 RGBA8 full mip chains use 32 MiB');
  ok(built.info.estimatedGPUMiB <= 40, 'Uploaded texture estimate stays below 40 MiB');
  equal(built.info.retainedCPUBytes, 25165824, 'Only 24 final RGBA buffers remain on CPU');
  equal(built.info.cpuTemporaryFieldsReleased, true, 'Temporary field lifetime is reported');
  const names = new Set(), maps = new Set();
  for (const [key, material] of Object.entries(built.materials)) {
    equal(material.roughness, 1, `${key}: full roughness-map multiplier`);
    equal(material.metalness, key === 'metal' ? 1 : 0, `${key}: metal multiplier only for metal family`);
    equal(material.envMapIntensity, .7, `${key}: environment intensity`);
    equal(material.normalScale.toArray(), [1, 1], `${key}: baked physical normal scale`);
    equal(material.transparent, false, `${key}: height alpha is not transparency`);
    equal(material.aoMap, material.roughnessMap, `${key}: shared ORM texture, no duplicated uploads`);
    equal(material.metalnessMap, key === 'metal' ? material.roughnessMap : null, `${key}: ORM metalness binding`);
    const clone = material.clone();
    equal(clone.userData.procedural, material.userData.procedural, `${key}: metadata survives village material cloning`);
    equal(clone.map.name, material.map.name, `${key}: map names survive cloning`);
    clone.dispose();
    ok(!Object.hasOwn(material, 'onBeforeCompile') && !Object.hasOwn(material, 'onBeforeRender'), `${key}: no installed shader or frame hooks`);
    for (const [slot, bakedSlot] of [['map', 'albedo'], ['normalMap', 'normal'], ['roughnessMap', 'orm']]) {
      const map = material[slot]; names.add(map.name); maps.add(map);
      equal(sha(map.image.data), fingerprints[key][bakedSlot], `${key} ${slot}: builder uses exact CPU bake bytes`);
      equal([map.image.width, map.image.height], [512, 512], `${key} ${slot}: uploaded dimensions`);
      equal([map.wrapS, map.wrapT], [T.RepeatWrapping, T.RepeatWrapping], `${key} ${slot}: repeat`);
      equal([map.minFilter, map.magFilter, map.generateMipmaps], [T.LinearMipmapLinearFilter, T.LinearFilter, true], `${key} ${slot}: filtered mip chain`);
      equal(map.colorSpace, slot === 'map' ? T.SRGBColorSpace : T.NoColorSpace, `${key} ${slot}: color/data space`);
      equal(map.flipY, false, `${key} ${slot}: positive V byte rows`);
      equal(map.anisotropy, 8, `${key} ${slot}: bounded anisotropy`);
      equal(map.repeat.toArray(), [1, 1], `${key} ${slot}: integrator owns physical UV repeat`);
      const record = built.info.maps.find(item => item.name === map.name);
      equal([record.cpuBytes, record.estimatedGPUBytes], [map.image.data.byteLength, 1398100], `${key} ${slot}: actual per-map memory metadata`);
      let hash = 0x811c9dc5;
      for (const value of map.image.data) hash = Math.imul(hash ^ value, 16777619) >>> 0;
      equal(record.fingerprint, hash.toString(16).padStart(8, '0'), `${key} ${slot}: fingerprint matches upload buffer`);
    }
  }
  equal([names.size, maps.size, built.info.maps.length], [24, 24, 24], '24 uniquely named textures and records');
  equal(built.info.maps.reduce((sum, map) => sum + map.estimatedGPUBytes, 0), built.info.estimatedGPUBytes, 'Per-map bytes sum to total budget');
  // Disposal and context restoration remain caller-owned. Upload buffers must
  // be retained; clearing map.image.data on upload would break future clones.
  for (const map of maps) map.dispose();
  for (const material of Object.values(built.materials)) material.dispose();
  const source = await readFile(moduleURL, 'utf8');
  ok(!/Math\.random\s*\(|\bfetch\s*\(|new\s+(?:Image|XMLHttpRequest)|TextureLoader|createElement\s*\(/.test(source), 'Source contains no ambient RNG or image loading');
  ok(!/\b(?:requestAnimationFrame|setInterval)\s*\(|\.onBefore(?:Compile|Render)\s*=/.test(source), 'Source installs no runtime recompute or shader hooks');
  ok(source.includes('Copyright (c) 2026 wquguru') && source.includes('../procedural-material-lab/vendor/WQUGURU-LICENSE.txt'), 'Upstream MIT attribution/license link retained');
  ok(Number.isFinite(built.info.bakeMilliseconds) && built.info.bakeMilliseconds >= 0, 'CPU startup time measured');
  console.log(JSON.stringify({
    verdict: 'PASS', scope: 'CPU only; visual/GPU/temporal acceptance remains independent', checks,
    sourceSHA256: sha(source), resolution: PROCEDURAL_SIZE,
    estimatedGPUBytes: built.info.estimatedGPUBytes, bakeMilliseconds: built.info.bakeMilliseconds,
    testMilliseconds: performance.now() - started, fingerprints, metrics,
  }, null, 2));
}
