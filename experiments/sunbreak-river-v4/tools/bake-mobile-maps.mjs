// tools/bake-mobile-maps.mjs — node tools/bake-mobile-maps.mjs [--manifest-only]
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { PROCEDURAL_FAMILIES, createProceduralBaker } from '../procedural-materials.js';

const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require('C:/Users/baomin.wang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'); }

const outDir = new URL('assets/mobile-look/', root);
const HDR = 'assets/afterrain-light/kloofendal_43d_clear_puresky_2k.hdr';
const SKY = 'sky.jpg', MANIFEST = 'mobile-look.json', SIZE = 256;
const sha = (url) => createHash('sha256').update(readFileSync(url)).digest('hex');
const manifestOnly = process.argv.includes('--manifest-only');
mkdirSync(outDir, { recursive: true });

// Copy selected channels straight out of RGBA (alpha ignored, never composited).
const pick = (rgba, n, chans) => {
  const out = Buffer.alloc(n * chans.length);
  for (let i = 0; i < n; i++) for (let c = 0; c < chans.length; c++) out[i * chans.length + c] = rgba[i * 4 + chans[c]];
  return out;
};
const save = (buf, width, height, channels, name) =>
  sharp(buf, { raw: { width, height, channels } }).resize(SIZE, SIZE).jpeg({ quality: 88, mozjpeg: true })
    .toFile(fileURLToPath(new URL(name, outDir)));

const PY = `
import sys, cv2, numpy as np
im = cv2.imread(sys.argv[1], cv2.IMREAD_UNCHANGED)
assert im is not None, 'cannot read HDR'
im = im[..., :3].astype(np.float32)            # BGR linear
h, w = im.shape[:2]
y, x = np.unravel_index(np.argmax(im.sum(2)), (h, w))
im = np.roll(im, int(round(.36 * w - .5)) - int(x), axis=1)   # sun to u=.36
el = (.5 - (y + .5) / h) * np.pi
assert el > 0, 'sun below horizon'
scale = np.tan(el) / np.tan(np.radians(26.0))  # new = atan(tan(elevation)/scale)
eo = (.5 - (np.arange(h) + .5) / h) * np.pi
es = np.arctan(np.tan(eo) * scale)             # inverse map: output row -> source elevation
my = ((.5 - es / np.pi) * h - .5).astype(np.float32)
mx, my = np.meshgrid(np.arange(w, dtype=np.float32), my)
im = cv2.remap(im, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
im *= np.array([.90, 1.0, 1.10], np.float32)   # warm (B,G,R)
im = cv2.resize(im, (1024, 512), interpolation=cv2.INTER_AREA)
im = np.clip(im * (2.51 * im + .03) / (im * (2.43 * im + .59) + .14), 0, 1)  # ACES filmic
im = np.where(im <= .0031308, im * 12.92, 1.055 * np.power(im, 1 / 2.4) - .055)
assert cv2.imwrite(sys.argv[2], np.round(im * 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 90])
`;

if (!manifestOnly) {
  const ids = Array.isArray(PROCEDURAL_FAMILIES)
    ? PROCEDURAL_FAMILIES.map((f) => f?.id ?? f) : Object.keys(PROCEDURAL_FAMILIES);
  const baker = createProceduralBaker();
  for (const id of ids) {
    const { width, height, albedo, normal, orm } = await baker.bake(id); // default 512
    const n = width * height;
    await save(pick(albedo, n, [0, 1, 2]), width, height, 3, `${id}-color.jpg`);
    await save(pick(normal, n, [0, 1, 2]), width, height, 3, `${id}-normal.jpg`);
    await save(pick(orm, n, [1]), width, height, 1, `${id}-roughness.jpg`); // G = roughness
    console.log('baked', id);
  }
  const r = spawnSync('python', ['-c', PY, fileURLToPath(new URL(HDR, root)), fileURLToPath(new URL(SKY, outDir))],
    { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw r.error ?? new Error(`python sky bake failed (${r.status})`);
  console.log('baked', SKY);
}

const trees = readdirSync(outDir).filter((f) => /tree.*\.png$/i.test(f));
if (trees.length < 2) {
  console.log(`tree PNGs present: ${trees.length}/2 — manifest not written; rerun with --manifest-only once ready.`);
  process.exit(manifestOnly ? 1 : 0);
}

const files = [...PROCEDURAL_FAMILIES.flatMap(id=>['color','normal','roughness'].map(role=>`${id}-${role}.jpg`)),SKY,'tree-0.png','tree-1.png'].sort()
  .map((f) => ({ file:'assets/mobile-look/'+f, sha256: sha(new URL(f, outDir)), bytes: statSync(new URL(f, outDir)).size }));
const src = (p) => ({ file: p, sha256: sha(new URL(p, root)) });
const manifest = {
  generated: new Date().toISOString(),
  sources: [src(HDR), src('procedural-materials.js'), src('tools/bake-mobile-maps.mjs'),src('tools/bake-mobile-trees.mjs'),src('assets/foliage-revision/island_tree_01-far.glb'),src('assets/foliage-revision/tree_small_02-far.glb')],
  provenance: [
    `*-color/-normal/-roughness.jpg: createProceduralBaker 512 bake of PROCEDURAL_FAMILIES, RGB taken without alpha compositing, roughness = ORM green, resized to ${SIZE}x${SIZE}.`,
    `${SKY}: ${HDR} via python/cv2 — brightest texel rotated to u=.36, sun lowered to 26deg with atan(tan(elevation)/scale), warmed, 1024x512, ACES filmic + sRGB.`,
    `${trees.join(', ')}: produced by the separate tree tool; only hashed here.`,
  ],
  files,
};
writeFileSync(new URL(MANIFEST, root), JSON.stringify(manifest, null, 2) + '\n');
console.log(`wrote ${MANIFEST} (${files.length} files)`);
