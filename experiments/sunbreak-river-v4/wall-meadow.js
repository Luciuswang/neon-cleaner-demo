import {meadowRoots} from './meadow-roots.js';
import {outerSwardRoots} from './slope-sward.js';

export function buildWallMeadow(T, world, mobile = false) {
  const rng = s => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9 | 0) >>> 0) / 4294967296;
  const P = mobile ? 256 : 512, S = P * 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cc = mk(), ac = mk(), c = cc.getContext('2d'), a = ac.getContext('2d');
  // colour canvas is opaque green everywhere (no dark halo); alpha lives in a separate map
  c.fillStyle = '#555c44'; c.fillRect(0, 0, S, S);
  a.fillStyle = '#000'; a.fillRect(0, 0, S, S);
  const blade = (x0, y0, tx, ty, w, fill, glint) => {
    const cx = x0 + (tx - x0) * .22, cy = y0 + (ty - y0) * .62;
    for (const g of [c, a]) {
      g.beginPath(); g.moveTo(x0 - w, y0);
      g.quadraticCurveTo(cx - w * .7, cy, tx, ty);
      g.quadraticCurveTo(cx + w * .7, cy, x0 + w, y0);
      g.closePath(); g.fillStyle = g === c ? fill : '#fff'; g.fill();
    }
    if (glint) {
      c.beginPath(); c.moveTo(x0 - w, y0); c.quadraticCurveTo(cx - w * .7, cy, tx, ty);
      c.strokeStyle = glint; c.lineWidth = Math.max(1, P / 420); c.stroke();
    }
  };
  for (let v = 0; v < 4; v++) {
    const R = rng(911 + v * 77), px = (v & 1) * P, py = v < 2 ? 0 : P, y0 = py + P, n = 44 + v * 8;
    for (let i = 0; i < n; i++) {
      const low = i < n * .35, dry = R() < .12, hue = dry ? 36 + R() * 12 : 92 + R() * 44;
      const len = Math.min(.96, (.34 + .62 * R()) * (low ? .6 : 1)) * P;
      const x0 = px + P * (.5 + (R() - .5) * .64);
      const tx = Math.min(px + P * .97, Math.max(px + P * .03, x0 + (R() - .5) * P * (low ? .7 : .42)));
      const L = low ? 20 + R() * 6 : 26 + R() * 10, sat = dry ? 20 + R() * 10 : 22 + R() * 12;
      const g = c.createLinearGradient(0, y0, 0, y0 - len);
      g.addColorStop(0, 'hsl(168,16%,10%)');
      g.addColorStop(.38, `hsl(${hue},${sat}%,${L * .8}%)`);
      g.addColorStop(1, `hsl(${hue},${sat}%,${L}%)`);
      blade(x0, y0, tx, y0 - len, P * (.007 + R() * .007), g, low ? 0 : `hsl(${hue},${sat * .5}%,${L + 4}%)`);
    }
    if (v === 3) for (let k = 0; k < 2; k++) { // subtle off-white seed heads
      const x0 = px + P * (.35 + R() * .3), tx = x0 + (R() - .5) * P * .2, ty = py + P * (.05 + R() * .1);
      blade(x0, y0, tx, ty, P * .005, '#67684c', 0);
      for (const g of [c, a]) {
        g.beginPath(); g.ellipse(tx, ty + P * .02, P * .009, P * .034, (tx - x0) / P, 0, 7);
        g.fillStyle = g === c ? '#a59d84' : '#fff'; g.fill();
      }
    }
  }
  const map = new T.CanvasTexture(cc), alphaMap = new T.CanvasTexture(ac);
  map.colorSpace = T.SRGBColorSpace; map.anisotropy = alphaMap.anisotropy = 4;
  const uT = {value: 0};
  const mat = new T.MeshStandardMaterial({map, alphaMap, alphaTest: .4, transparent: false, depthWrite: true,
    side: T.DoubleSide, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: .05});
  mat.onBeforeCompile = s => {
    s.uniforms.uT = uT;
    s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
#ifdef USE_INSTANCING
float wp=instanceMatrix[3].x*.7+instanceMatrix[3].z*.5;
transformed.x+=sin(uT*1.3+wp)*.05*position.y*position.y;
transformed.z+=cos(uT*.9+wp*1.3)*.03*position.y*position.y;
#endif`);
    s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
if (!gl_FrontFacing) normal=-normal;
#endif`);
  };
  const N = mobile ? 2 : 3, RW = 1, tris = N * RW * 4;
  const geo = v => {
    const p = [], nr = [], uv = [], ix = [];
    for (let k = 0; k < N; k++) {
      const an = k * Math.PI / N + v * .4 + Math.sin(k*2.4+v*1.7)*.4, dx = Math.cos(an), dz = Math.sin(an), b = p.length / 3;
      const off = (k - (N - 1) / 2) * .13, sg = k & 1 ? 1 : -1;
      for (let j = 0; j <= RW; j++) for (let i = 0; i < 3; i++) {
        const s = i - 1, y = j / RW, o = off + sg * y * y * .2 + (1 - s * s) * .08;
        p.push(dx * s - dz * o, y, dz * s + dx * o);
        const nx = dx * s * .25 - dz * sg * .15, nz = dz * s * .25 + dx * sg * .15, l = Math.hypot(nx, 1, nz);
        nr.push(nx / l, 1 / l, nz / l); // upward normals: no dark back faces
        uv.push((v & 1) * .5 + .004 + i * .246, (v < 2 ? .5 : 0) + .004 + y * .492);
      }
      for (let j = 0; j < RW; j++) for (let i = 0; i < 2; i++) {
        const q = b + j * 3 + i; ix.push(q, q + 1, q + 3, q + 1, q + 4, q + 3);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nr, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(ix); return g;
  };
  const all = (typeof meadowRoots === 'function' ? meadowRoots() : meadowRoots || [])
    .concat(outerSwardRoots().map(r => ({...r, wall: false, outer: true})));
  const max = Math.floor((mobile ? 240000 : 500000) / tris), walls = all.filter(r => r.wall).length;
  const frac = Math.min(mobile ? .9 : 1, Math.max(0, (max - walls) / Math.max(1, all.length - walls)));
  const hash = i => (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296; // stable subset
  const lists = [[], [], [], []];
  let kept = 0, outer = 0;
  all.forEach((r, i) => { if ((r.wall || hash(i) < frac) && kept++ < max) { lists[r.variant & 3].push(r); if (r.outer) outer++; } });
  const group = new T.Group(); group.name = 'village-wall-meadow';
  const m4 = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0),
    pos = new T.Vector3(), sc = new T.Vector3(), col = new T.Color(), eu = new T.Euler();
  let count = 0, draws = 0;
  lists.forEach((ls, v) => {
    if (!ls.length) return;
    const mesh = new T.InstancedMesh(geo(v), mat, ls.length);
    mesh.name = 'meadow-tufts-' + v;
    ls.forEach((r, i) => {
      const w = r.r * 1.3;
      const h1=hash(i*3+v*131),h2=hash(i*7+v*53+9),h3=hash(i*13+v*17+5);
      pos.set(r.x,r.y,r.z); q.setFromEuler(eu.set((h2-.5)*.5,(r.yaw||0)+v*1.57+h1*6.283,(h3-.5)*.5,'YXZ'));sc.set(w,r.h*1.15*(.7+h1*.6),w);
      mesh.setMatrixAt(i, m4.compose(pos, q, sc));
      const t = (r.tone || 1) * .8, k = hash(i + v * 977) * .08,
        n = Math.sin(r.x * .23 + r.z * .17) * Math.sin(r.z * .19 - r.x * .11) * .06;
      mesh.setColorAt(i, col.setRGB((.78 + k + n * 1.6) * t, (1 - n * .4) * t, (.84 - k * .5 - n * 1.4) * t));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.frustumCulled = false; mesh.raycast = () => {};
    group.add(mesh); count += ls.length; draws++;
  });
  group.userData = {roots: count, sourceRoots: all.length, drawCalls: draws, triangles: count * tris,
    planesPerTuft: N, outerRoots: outer, atlas: S, mobile};
  (world.scene || world).add(group);
  return {info: () => ({...group.userData}), update(t) { uT.value = t; }};
}
