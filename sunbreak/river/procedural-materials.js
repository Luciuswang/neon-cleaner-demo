// Adapted from ../procedural-material-lab/lab.mjs and
// https://github.com/wquguru/fable52-fps-repro/tree/main/demos/02-materials
// Copyright (c) 2026 wquguru. MIT License:
// ../procedural-material-lab/vendor/WQUGURU-LICENSE.txt
// Runtime distribution notice: ./PROCEDURAL-NOTICE.txt
// River adaptation: periodic fbm/Worley fields and correlated, baked PBR only.
// No imports, image sources, DOM, shader hooks or frame-time generators.

export const PROCEDURAL_REVISION = 'river-procedural-surfaces-v1';
export const PROCEDURAL_SEED = 20261119;
export const PROCEDURAL_SIZE = 512;
const MiB = 1024 * 1024;
const clamp = x => Math.max(0, Math.min(1, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const quintic = t => t * t * t * (t * (t * 6 - 15) + 10);
const byte = x => Math.round(clamp(x) * 255);
const wrap = (x, n) => ((x % n) + n) % n;

// One UV repeat covers tileMetres in BOTH axes. Consumers using metre UVs
// should set repeat = 1 / tileMetres on all three maps. Terrain custom samplers
// should divide world coordinates by tileMetres. No repeat is applied twice.
// heightMetres is the physical range represented by albedo alpha [0,1]; it is
// NOT geometry displacement. Features below two texels are spatially averaged.
const scales = {
  mud: { tileMetres: 2.4, heightMetres: .032, detail: 'natural umber soil; 8–30 mm fine aggregates, up to 12 mm baked relief' },
  dirt: { tileMetres: 2.4, heightMetres: .005, detail: 'compact pale brown path; subdued 8–25 mm grit' },
  forest_ground_04: { tileMetres: 2.7, heightMetres: .026, detail: 'humus; 15–55 mm decomposed fragments, 25–100 mm twigs' },
  stone: { tileMetres: .65, heightMetres: .006, detail: 'irregular 2–12 mm mineral grain; no stone boundaries or joints' },
  plaster: { tileMetres: 1.8, heightMetres: .0045, detail: 'medium warm grey plaster; 5–20 mm aggregate/pitting' },
  wood: { tileMetres: 1.6, heightMetres: .0025, grainDirection: '+U (horizontal)', detail: 'muted weathered timber; long fibres along U, 10–25 mm bundles' },
  brick: { tileMetres: .65, heightMetres: .003, detail: 'fine clay/mineral core only; courses belong to the masonry shader' },
  metal: { tileMetres: 1.2, heightMetres: .0018, detail: 'olive/grey dielectric paint, exposed metal, rough nonmetallic rust' },
};
export const PROCEDURAL_SCALES = Object.freeze(Object.fromEntries(
  Object.entries(scales).map(([key, value]) => [key, Object.freeze(value)]),
));
export const PROCEDURAL_FAMILIES = Object.freeze(Object.keys(PROCEDURAL_SCALES));

function validateSize(size) {
  if (size !== 512 && size !== 1024) throw new RangeError('Surface size must be 512 or 1024');
}
function validateSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be a uint32');
}
function familySeed(seed, key) {
  let h = seed >>> 0;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return h;
}
// Each field/splat owns its RNG. No mutable module-level random stream, and
// output does not depend on family order, yields, other bakes or gameplay RNG.
function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function fbm(size, fx, fy, octaves, seed) {
  const out = new Float32Array(size * size), random = rng(seed);
  let amplitude = 1, total = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const gx = fx * 2 ** octave, gy = fy * 2 ** octave;
    if (gx > size / 2 || gy > size / 2) break;
    const grid = Float32Array.from({ length: gx * gy }, random);
    for (let y = 0; y < size; y++) {
      const py = y * gy / size, y0 = Math.floor(py), y1 = (y0 + 1) % gy, wy = quintic(py - y0);
      for (let x = 0; x < size; x++) {
        const px = x * gx / size, x0 = Math.floor(px), x1 = (x0 + 1) % gx, wx = quintic(px - x0);
        out[y * size + x] += amplitude * mix(
          mix(grid[y0 * gx + x0], grid[y0 * gx + x1], wx),
          mix(grid[y1 * gx + x0], grid[y1 * gx + x1], wx), wy,
        );
      }
    }
    total += amplitude;
    amplitude *= .5;
  }
  // Fixed amplitude normalization keeps the seed/size contract independent of
  // observed image extrema. Quintic periodic lattices have matching derivatives.
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Periodic nearest-grain field. Interior seed jitter bounds make a 3x3 search
// sufficient. Only rounded/irregular F1 interiors are used: F2-F1 cell edges
// would incorrectly paint pavement joints onto existing stone geometry.
function worley(cells, seed) {
  const random = rng(seed), points = new Float32Array(cells * cells * 4);
  for (let i = 0; i < points.length; i += 4) {
    points[i] = .2 + random() * .6;
    points[i + 1] = .2 + random() * .6;
    points[i + 2] = random(); points[i + 3] = random();
  }
  return (u, v, result) => {
    const px = wrap(u, 1) * cells, py = wrap(v, 1) * cells;
    const cx = Math.floor(px), cy = Math.floor(py);
    let distance = Infinity, closest = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const x = cx + ox, y = cy + oy, k = (wrap(y, cells) * cells + wrap(x, cells)) * 4;
      const dx = x + points[k] - px, dy = y + points[k + 1] - py, d = dx * dx + dy * dy;
      if (d < distance) { distance = d; closest = k; }
    }
    result.distance = Math.sqrt(distance);
    result.tone = points[closest + 2]; result.kind = points[closest + 3];
  };
}

function sharedFields(size, seed) {
  const macro = fbm(size, 4, 4, 4, familySeed(seed, 'macro'));
  const meso = fbm(size, 16, 16, 4, familySeed(seed, 'meso'));
  const fine = fbm(size, 64, 64, 3, familySeed(seed, 'fine'));
  const grain = new Float32Array(size * size), fleck = new Float32Array(size * size), pit = new Float32Array(size * size), clod = new Float32Array(size * size);
  const sample = worley(96, familySeed(seed, 'mineral')), sampleClod=worley(23,familySeed(seed,'soil-clods')), point = {}, coarse={};
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    // Low amplitude periodic warp and micro erosion break up regular cells.
    sample(x / size + (macro[i] - .5) * .016, y / size + (meso[i] - .5) * .009, point);
    const radius = .21 + point.tone * .14;
    const shape = 1 - smooth(radius * .38, radius, point.distance + (fine[i] - .5) * .10);
    // Aggregate occurs in eroded pockets, not an evenly beaded surface.
    grain[i] = shape * smooth(.31,.64,meso[i]) * (point.kind>.22?1:.15);
    fleck[i] = shape * (point.tone - .5);
    pit[i] = point.kind > .84 ? shape : 0;
    sampleClod(x/size+(macro[i]-.5)*.10,y/size+(meso[i]-.5)*.07,coarse);
    clod[i]=(1-smooth(.13,.64,coarse.distance+(fine[i]-.5)*.36))*smooth(.19,.66,coarse.kind)*smooth(.29,.67,macro[i]);
  }
  return { macro, meso, fine, grain, fleck, pit, clod };
}

function litterFields(size, seed, tileMetres, fine) {
  const leaf = new Float32Array(size * size), twig = new Float32Array(size * size), random = rng(seed);
  for (let n = 0; n < 950; n++) {
    const isTwig = n >= 830, output = isTwig ? twig : leaf;
    const cx = random() * size, cy = random() * size, angle = random() * Math.PI * 2;
    const length = (isTwig ? .025 + random() * .075 : .015 + random() * .040) * size / tileMetres;
    const width = Math.max(1.35, (isTwig ? .003 + random() * .003 : .004 + random() * .016) * size / tileMetres);
    const c = Math.cos(angle), s = Math.sin(angle), extent = Math.ceil((length + width) * .5 + 1);
    for (let y = Math.floor(cy) - extent; y <= Math.ceil(cy) + extent; y++) {
      for (let x = Math.floor(cx) - extent; x <= Math.ceil(cx) + extent; x++) {
        const dx = x - cx, dy = y - cy, along = (dx * c + dy * s) / (length * .5);
        const across = (-dx * s + dy * c) / (width * .5), i = wrap(y, size) * size + wrap(x, size);
        const distance = isTwig ? Math.max(Math.abs(along), Math.abs(across)) : Math.hypot(along, across);
        const erosion = isTwig ? 1 : smooth(.25, .65, fine[i]);
        // Ragged humus fragments, never large leaf silhouettes or painted veins.
        const mask = (1 - smooth(.35, 1, distance)) * erosion;
        output[i] = Math.max(output[i], mask);
      }
    }
  }
  return { leaf, twig };
}

/** Pure height-to-normal bake, row zero = v=0, green = +tangent Y (OpenGL).
 * The central derivative is in metres, so changing resolution preserves relief.
 * Opposite-edge neighbours are used, including all four corners. */
export function normalFromHeight(height, size, { tileMetres = 1, heightMetres = .01 } = {}) {
  validateSize(size);
  if (!height || height.length !== size * size) throw new RangeError('Height dimensions do not match size');
  if (!(tileMetres > 0 && Number.isFinite(tileMetres) && heightMetres >= 0 && Number.isFinite(heightMetres))) {
    throw new RangeError('Invalid physical normal scale');
  }
  const out = new Uint8Array(size * size * 4), scale = heightMetres * size / (2 * tileMetres), mask = size - 1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (height[y * size + ((x + 1) & mask)] - height[y * size + ((x - 1) & mask)]) * scale;
    const dy = (height[((y + 1) & mask) * size + x] - height[((y - 1) & mask) * size + x]) * scale;
    const inv = 1 / Math.hypot(dx, dy, 1), k = (y * size + x) * 4;
    out[k] = byte(.5 - dx * inv * .5); out[k + 1] = byte(.5 - dy * inv * .5);
    out[k + 2] = byte(.5 + inv * .5); out[k + 3] = 255;
  }
  return out;
}

function bakeFamily(key, size, seed, fields) {
  const scale = PROCEDURAL_SCALES[key], height = new Float32Array(size * size);
  const albedo = new Uint8Array(size * size * 4), orm = new Uint8Array(size * size * 4);
  const localSeed = familySeed(seed, key), random = rng(localSeed), mask = size - 1;
  const offsetX = Math.floor(random() * size), offsetY = Math.floor(random() * size);
  // Family-local allocations die after this bake; only the six shared fields
  // survive between families. No cached height fields survive material creation.
  const fibres = key === 'wood' ? fbm(size, 3, 80, 3, localSeed) : null;
  const growth = key === 'wood' ? fbm(size, 2, 8, 3, localSeed ^ 0x417a) : null;
  const litter = key === 'forest_ground_04' ? litterFields(size, localSeed, scale.tileMetres, fields.fine) : null;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, j = ((y + offsetY) & mask) * size + ((x + offsetX) & mask), k = i * 4;
    const lo = fields.macro[j] - .5, md = fields.meso[j] - .5, fi = fields.fine[j] - .5;
    const grain = fields.grain[j], fleck = fields.fleck[j], pit = fields.pit[j];
    let h, r, g, b, ao, roughness, metalness = 0;
    if (key === 'mud' || key === 'dirt' || key === 'forest_ground_04') {
      const compact = key === 'dirt', forest = key === 'forest_ground_04';
      const leaf = litter ? litter.leaf[i] : 0, twig = litter ? litter.twig[i] : 0;
      const clod=fields.clod[j];
      h = .5 + lo * (compact ? .08 : .26) + md * (compact ? .07 : .24)
        + fi * (compact ? .055 : .14) + grain * (compact ? .025 : .04) + clod*(compact?.025:.13)
        - pit * (compact ? .065 : .14) + leaf * .12 + twig * .16;
      const variation = lo * .18 + md * .15 + fi * .09 + grain * .025 + clod*.045 - pit * .06;
      r = (compact ? .435 : forest ? .265 : .30) + variation + leaf * .085 + twig * .065;
      g = (compact ? .365 : forest ? .215 : .235) + variation * .86 + leaf * .06 + twig * .045;
      b = (compact ? .280 : forest ? .16 : .17) + variation * .70 + leaf * .025 + twig * .02;
      ao = .95 + (h - .5) * .2 - pit * .20;
      roughness = (compact ? .80 : forest ? .91 : .86) + fi * .08 + pit * .10 - grain * .025 + leaf * .025;
    } else if (key === 'wood') {
      const fibre = fibres[i] - .5;
      const phase = y / size * 26 + (growth[i] - .5) * 1.3;
      const ring = (.5 + .5 * Math.sin(phase * Math.PI * 2)) ** 3;
      const fissure = smooth(.73, .88, fibres[i]) * smooth(.48, .7, fields.macro[j]);
      const tone = lo * .045 + md * .018 + fibre * .075 - ring * .026 - fissure * .055;
      r = .425 + tone; g = .375 + tone * .95; b = .31 + tone * .85;
      h = .5 + fibre * .14 + ring * .045 + fi * .018 - fissure * .13;
      ao = .97 - fissure * .24;
      roughness = .79 + fibre * .06 + ring * .035 + fissure * .08;
    } else if (key === 'metal') {
      const weather = .5 + lo * .50 + md * .35 + fi * .15;
      const wear = smooth(.49, .58, weather), oxide = smooth(.58, .69, weather);
      const paint = 1 - wear, rust = wear * oxide, bare = wear * (1 - oxide);
      const variation = fi * .035 + md * .025;
      r = paint * .345 + bare * .49 + rust * .38 + variation;
      g = paint * .365 + bare * .50 + rust * .205 + variation * .85;
      b = paint * .31 + bare * .485 + rust * .095 + variation * .65;
      h = .5 + paint * .065 - bare * .045 + rust * (.12 + fi * .08) - pit * .045;
      ao = .98 - pit * .15 - rust * .045;
      roughness = paint * .68 + bare * .39 + rust * .94 + fi * .04;
      metalness = bare * .94; // Both intact paint and fully oxidised rust are dielectric.
    } else {
      const plaster = key === 'plaster', brick = key === 'brick';
      const variation = lo * .075 + md * .06 + fi * .06 + fleck * .13 + grain * .015 - pit * .055;
      r = (plaster ? .525 : brick ? .42 : .445) + variation;
      g = (plaster ? .507 : brick ? .35 : .44) + variation * .94;
      b = (plaster ? .478 : brick ? .29 : .415) + variation * .87;
      h = .5 + lo * .10 + md * .10 + fi * .11 + grain * .055 + fleck * .08 - pit * (plaster ? .20 : .15);
      ao = .97 + (h - .5) * .12 - pit * .22;
      roughness = (plaster ? .88 : brick ? .89 : .82) + fi * .09 + pit * .08 - grain * .02;
    }
    height[i] = clamp(h);
    albedo[k] = byte(r); albedo[k + 1] = byte(g); albedo[k + 2] = byte(b); albedo[k + 3] = byte(height[i]);
    orm[k] = byte(ao); orm[k + 1] = byte(roughness); orm[k + 2] = byte(metalness); orm[k + 3] = 255;
  }
  const normal = normalFromHeight(height, size, scale);
  return {
    key, width: size, height: size, albedo, normal, orm, heightField: height,
    info: { revision: PROCEDURAL_REVISION, seed, familySeed: localSeed, resolution: size, ...scale },
  };
}

/** Pure CPU bake session. Fields are shared within this session only; bake order
 * cannot affect bytes. Call dispose() after the last family to release fields.
 * Returned arrays belong to the caller; metadata contains no typed arrays. */
export function createProceduralBaker({ size = PROCEDURAL_SIZE, seed = PROCEDURAL_SEED } = {}) {
  validateSize(size); validateSeed(seed);
  let fields = sharedFields(size, seed);
  return {
    bake(key) {
      if (!Object.hasOwn(PROCEDURAL_SCALES, key)) throw new RangeError(`Unknown procedural family: ${key}`);
      if (!fields) throw new Error('Procedural baker has been disposed');
      return bakeFamily(key, size, seed, fields);
    },
    dispose() { fields = null; },
  };
}

/** Convenience pure single-family bake, requiring neither Three nor a DOM. */
export function bakeProceduralSurface(key, options) {
  const baker = createProceduralBaker(options);
  try { return baker.bake(key); } finally { baker.dispose(); }
}

function mipBytes(size) {
  let bytes = 0;
  for (let side = size; side >= 1; side /= 2) bytes += side * side * 4;
  return bytes;
}
// Diagnostic byte fingerprint, not a cryptographic provenance claim.
function fingerprint(data) {
  let value = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) value = Math.imul(value ^ data[i], 0x01000193) >>> 0;
  return value.toString(16).padStart(8, '0');
}
function texture(T, data, size, name, srgb, anisotropy) {
  const map = new T.DataTexture(data, size, size, T.RGBAFormat, T.UnsignedByteType);
  map.name = name; map.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.flipY = false; map.anisotropy = anisotropy;
  map.needsUpdate = true;
  return map;
}

/** Build once at startup using the caller's existing Three r160 namespace.
 * Upload is deferred to Three's ordinary first use; this function does not
 * create a renderer or issue a render. All maps retain their final RGBA bytes
 * for clones/context restoration, but shared noise and float height temps die.
 * Material instances are independent across calls; callers own their disposal.
 */
export async function buildProceduralMaterials(T, renderer) {
  if (!T?.DataTexture || !T?.MeshStandardMaterial) throw new TypeError('Pass the existing Three namespace');
  const size = PROCEDURAL_SIZE, textureCount = PROCEDURAL_FAMILIES.length * 3;
  const estimatedGPUBytes = mipBytes(size) * textureCount;
  if (estimatedGPUBytes > 40 * MiB) throw new RangeError('Procedural texture budget exceeds 40 MiB');
  const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
  const anisotropy = Number.isFinite(maxAnisotropy) ? Math.max(1, Math.min(8, maxAnisotropy)) : 1;
  const started = globalThis.performance?.now() ?? Date.now();
  const baker = createProceduralBaker(), materials = {}, allocatedTextures = [], mapInfo = [];
  try {
    for (const key of PROCEDURAL_FAMILIES) {
      // A macrotask yield allows startup status/paint between families. Nothing
      // schedules a continuing bake or frame callback after this promise resolves.
      await new Promise(resolve => setTimeout(resolve, 0));
      const baked = baker.bake(key), prefix = `procedural-${key}`;
      const make = (data, suffix, srgb) => {
        const map = texture(T, data, size, `${prefix}-${suffix}`, srgb, anisotropy);
        mapInfo.push({
          family: key, name: map.name, width: size, height: size, format: 'RGBA8',
          colorSpace: srgb ? 'sRGB' : 'NoColorSpace', cpuBytes: data.byteLength,
          estimatedGPUBytes: mipBytes(size), fingerprintAlgorithm: 'fnv1a32', fingerprint: fingerprint(data),
        });
        allocatedTextures.push(map); return map;
      };
      const map = make(baked.albedo, 'albedo-height', true);
      const normalMap = make(baked.normal, 'normal-opengl', false);
      const orm = make(baked.orm, 'orm', false);
      const material = new T.MeshStandardMaterial({
        map, normalMap, roughnessMap: orm, aoMap: orm,
        metalnessMap: key === 'metal' ? orm : null,
        color: 0xffffff, roughness: 1, metalness: key === 'metal' ? 1 : 0,
        envMapIntensity: .7, aoMapIntensity: .65,
      });
      material.name = prefix;
      material.userData.procedural = {
        ...baked.info, family: key, channels: 'albedo RGB=sRGB A=height; ORM R=AO G=roughness B=metalness',
        normalConvention: 'OpenGL +Y; row zero is v=0; flipY=false',
        estimatedGPUBytes: mipBytes(size) * 3, source: '../procedural-material-lab/lab.mjs',
        maps: mapInfo.slice(-3), license: './PROCEDURAL-NOTICE.txt',
      };
      materials[key] = material;
      baked.heightField = null; // The only retained CPU pixels are final upload buffers.
    }
  } catch (error) {
    for (const material of Object.values(materials)) material.dispose();
    for (const map of allocatedTextures) map.dispose();
    throw error;
  } finally { baker.dispose(); }
  return {
    materials,
    info: {
      revision: PROCEDURAL_REVISION, seed: PROCEDURAL_SEED, resolution: size,
      materialCount: PROCEDURAL_FAMILIES.length, textureCount, anisotropy,
      estimatedGPUBytes, estimatedGPUMiB: estimatedGPUBytes / MiB,
      retainedCPUBytes: size * size * 4 * textureCount, cpuTemporaryFieldsReleased: true,
      bakeMilliseconds: (globalThis.performance?.now() ?? Date.now()) - started,
      scales: PROCEDURAL_SCALES, maps: mapInfo, upload: 'deferred to first renderer use; RGBA8 full mip chain budget',
      uvConvention: 'one UV repeat = tileMetres square; wood fibres along +U',
      license: './PROCEDURAL-NOTICE.txt',
    },
  };
}
