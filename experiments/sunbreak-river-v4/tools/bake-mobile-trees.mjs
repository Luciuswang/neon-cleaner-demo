// tools/bake-mobile-trees.mjs — bakes PC far-LOD trees into transparent 640px sprites for mobile.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require('C:/Users/baomin.wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const ORIGIN = 'http://127.0.0.1:5190';
const SIZE = 640;
const TREES = ['island_tree_01-far.glb', 'tree_small_02-far.glb'].map((f) => `/river/assets/foliage-revision/${f}`);
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/mobile-look');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify({
  imports: { three: '/vendor/presentation/build/three.module.js', 'three/addons/': '/vendor/presentation/examples/jsm/' },
})}</script></head><body></body></html>`;

const browser = await playwright.chromium.launch({
  headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11'],
});
try {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  const blocked = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN + '/') || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  await page.route('**/river/tree-bake-local.html', (route) => route.fulfill({ contentType: 'text/html', body: HTML }));
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`${ORIGIN}/river/tree-bake-local.html`, { waitUntil: 'load' });

  const results = await page.evaluate(async ({ urls, size }) => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const out = [];
    for (const url of urls) {
      const model = (await loader.loadAsync(url)).scene; // native scale, materials + alphaTest untouched
      const scene = new THREE.Scene();
      scene.add(model);
      let box = new THREE.Box3().setFromObject(model);
      const c = box.getCenter(new THREE.Vector3());
      model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y; // root at y=0, centred
      model.updateMatrixWorld(true);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      box = new THREE.Box3().setFromObject(model);
      const s = box.getSize(new THREE.Vector3());
      const r = s.length() / 2 || 1;
      const half = (Math.max(s.x, s.y) / 2) * 1.04;
      scene.add(new THREE.HemisphereLight(0xdcebff, 0x4d5a36, 1.5));
      const sun = new THREE.DirectionalLight(0xffdfae, 3.2);
      sun.position.set(r * 1.4, s.y / 2 + r * 2.2, r * 1.8);
      sun.target.position.set(0, s.y / 2, 0);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.bias = -0.0004; sun.shadow.normalBias = r * 0.004;
      Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.01, far: r * 6 });
      scene.add(sun, sun.target);
      const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, r * 6);
      cam.position.set(0, half - half * 0.03, r * 3); // frame bottom sits just under the root
      cam.lookAt(0, half - half * 0.03, 0);
      renderer.render(scene, cam);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const c2 = Object.assign(document.createElement('canvas'), { width: size, height: size });
      const ctx = c2.getContext('2d');
      ctx.drawImage(renderer.domElement, 0, 0);
      const px = ctx.getImageData(0, 0, size, size).data;
      let opaque = 0, luma = 0, bottom = -1;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 16) continue;
        opaque++; luma += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11; bottom = (i / 4 / size) | 0;
      }
      out.push({ url, dataUrl, size: s.toArray(), coverage: opaque / (size * size), luma: luma / (opaque || 1),
        bottom: bottom / size, cornerAlpha: px[3] + px[(size - 1) * 4 + 3] });
    }
    renderer.dispose();
    return out;
  }, { urls: TREES, size: SIZE });

  if (blocked.length) throw new Error(`Remote requests attempted: ${blocked.join(', ')}`);
  await mkdir(OUT_DIR, { recursive: true });
  for (const [i, r] of results.entries()) {
    const bad = (why) => { throw new Error(`Bake failed for ${r.url}: ${why} ${JSON.stringify({ ...r, dataUrl: undefined })}`); };
    if (!r.size.every((v) => Number.isFinite(v) && v > 0)) bad('bogus bounds');
    if (r.coverage < 0.03) bad('blank image');
    if (r.coverage > 0.95 || r.cornerAlpha !== 0) bad('background not transparent');
    if (r.luma < 6 || r.luma > 250) bad('unlit or blown-out render');
    if (r.bottom < 0.85) bad('root not near bottom');
    const buf = Buffer.from(r.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    if (buf.length < 2048 || buf.readUInt32BE(0) !== 0x89504e47) bad('invalid PNG data');
    if (buf.readUInt32BE(16) !== SIZE || buf.readUInt32BE(20) !== SIZE) bad('wrong PNG dimensions');
    const file = resolve(OUT_DIR, `tree-${i}.png`);
    await writeFile(file, buf);
    console.log(`baked ${file} (${buf.length} bytes, coverage ${(r.coverage * 100).toFixed(1)}%)`);
  }
} finally {
  await browser.close();
}
