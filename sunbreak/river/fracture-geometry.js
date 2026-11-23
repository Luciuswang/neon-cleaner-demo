// Fractured slab fragment: static art geometry for a browser FPS (units: metres).
// API: fracturedSlab(T, width, height, thickness, seed = 1) -> THREE.BufferGeometry
//   T         : the THREE namespace (needs BufferGeometry, Float32BufferAttribute)
//   width     : exact X extent, height: exact Y extent, thickness: exact Z extent
//   seed      : integer; the shape is fully deterministic per seed
// Output: non-indexed, flat-shaded, closed manifold, centred on the origin.
//   group 0 (materialIndex 0): flat front/back intact surfaces
//   group 1 (materialIndex 1): angular fractured edge facets
//   attributes: position, normal (outward, per face), uv (metre coordinates)
export function fracturedSlab(T, width, height, thickness, seed = 1) {
  const w = Math.max(+width || 1, 1e-3);
  const h = Math.max(+height || 1, 1e-3);
  const t = Math.max(+thickness || 0.1, 1e-4);

  // Seeded PRNG (mulberry32); no dependence on Math.random.
  let s = ((Math.floor(+seed || 0) | 0) ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let k = s;
    k = Math.imul(k ^ (k >>> 15), k | 1);
    k ^= k + Math.imul(k ^ (k >>> 7), k | 61);
    return ((k ^ (k >>> 14)) >>> 0) / 4294967296;
  };

  // Outline: 6-9 vertices on a chipped rectangle, angles strictly increasing (CCW),
  // so the polygon is star-shaped about the generation origin.
  const n = 6 + Math.floor(rnd() * 4);
  const phase = rnd() * Math.PI * 2;
  const mid = [], fIn = [], bIn = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const th = phase + ((i + (rnd() - 0.5) * 0.5) / n) * Math.PI * 2;
    const c = Math.cos(th), sn = Math.sin(th);
    const r = (0.72 + 0.28 * rnd()) / Math.max(Math.abs(c), Math.abs(sn));
    const x = c * r, y = sn * r;
    mid.push([x, y, (rnd() - 0.5) * 0.6 * t]); // fracture ridge, inside the thickness
    fIn.push(0.96 - 0.13 * rnd()); // front rim inset factor
    bIn.push(0.96 - 0.13 * rnd()); // back rim inset factor
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Affine fit: the ridge ring spans exactly width x height, centred on the origin.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const sx = w / (maxX - minX), sy = h / (maxY - minY);
  const hz = t / 2;
  const M = [], F = [], B = [];
  for (let i = 0; i < n; i++) {
    const m = mid[i];
    M.push([(m[0] - cx) * sx, (m[1] - cy) * sy, m[2]]);
    F.push([(m[0] * fIn[i] - cx) * sx, (m[1] * fIn[i] - cy) * sy, hz]);
    B.push([(m[0] * bIn[i] - cx) * sx, (m[1] * bIn[i] - cy) * sy, -hz]);
  }
  // Fan centres: the image of the generation origin (kernel of the star polygon).
  const CF = [-cx * sx, -cy * sy, hz];
  const CB = [-cx * sx, -cy * sy, -hz];

  const triCount = 6 * n; // 2n cap triangles + 4n edge triangles
  const pos = new Float32Array(triCount * 9);
  const nor = new Float32Array(triCount * 9);
  const uv = new Float32Array(triCount * 6);
  let pi = 0, ui = 0;

  // Emit one flat-shaded triangle (a,b,c CCW seen from outside) with a UV mapper.
  const tri = (a, b, c, map) => {
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const v = [a, b, c];
    for (let k = 0; k < 3; k++) {
      const p = v[k];
      pos[pi] = p[0]; pos[pi + 1] = p[1]; pos[pi + 2] = p[2];
      nor[pi] = nx; nor[pi + 1] = ny; nor[pi + 2] = nz;
      pi += 3;
      map(p, uv, ui);
      ui += 2;
    }
  };

  // Planar UVs in metres for the intact faces (back face mirrored in U).
  const uvFront = (p, o, i) => { o[i] = p[0] + w / 2; o[i + 1] = p[1] + h / 2; };
  const uvBack = (p, o, i) => { o[i] = w / 2 - p[0]; o[i + 1] = p[1] + h / 2; };

  // Group 0: front (+Z) and back (-Z) flat surfaces.
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(CF, F[i], F[j], uvFront);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(CB, B[j], B[i], uvBack);
  }

  // Group 1: fractured edge band. Each outline edge gets an upper and lower
  // bevel quad meeting at the ridge; random diagonals vary facet orientation.
  let run = 0; // running perimeter distance for U (metres)
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = M[i], b = M[j];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const u0 = run;
    const uvEdge = (p, o, k) => {
      o[k] = u0 + (p[0] - a[0]) * dx + (p[1] - a[1]) * dy;
      o[k + 1] = p[2] + hz;
    };
    if (rnd() < 0.5) {
      tri(F[i], M[i], M[j], uvEdge);
      tri(F[i], M[j], F[j], uvEdge);
    } else {
      tri(F[i], M[i], F[j], uvEdge);
      tri(F[j], M[i], M[j], uvEdge);
    }
    if (rnd() < 0.5) {
      tri(M[i], B[i], B[j], uvEdge);
      tri(M[i], B[j], M[j], uvEdge);
    } else {
      tri(M[i], B[i], M[j], uvEdge);
      tri(M[j], B[i], B[j], uvEdge);
    }
    run += len;
  }

  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.addGroup(0, 6 * n, 0); // intact surfaces
  g.addGroup(6 * n, 12 * n, 1); // fractured edges
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
