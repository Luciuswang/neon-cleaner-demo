// Fable 5.2 production candidate with Codex geometry/material integration corrections.
// All dimensions are in baseline gun-local space; the caller owns animation and lighting.
export function buildWeapon({ THREE, gun, gscene }) {
  const T = THREE;

  // ---- strip old visuals, preserve lights -------------------------------
  gun.children.slice().forEach(c => {
    if (c.isLight) return;
    if (c.isMesh || c.isGroup) {
      const ls = [];
      c.traverse(o => { if (o.isLight) ls.push(o); });
      ls.forEach(l => gun.attach(l));
      if (!c.isLight) gun.remove(c);
    }
  });

  // ---- deterministic noise ----------------------------------------------
  const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const smooth = (w, seed, oct) => {
    const base = new Float32Array(w * w), r = rng(seed);
    for (let i = 0; i < w * w; i++) base[i] = r();
    const out = new Float32Array(w * w);
    let amp = 1, tot = 0;
    for (let o = 0; o < oct; o++) {
      const step = 1 << (o + 1);
      for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        const sx = (x / step | 0) * step % w, sy = (y / step | 0) * step % w;
        out[y * w + x] += base[sy * w + sx] * amp;
      }
      tot += amp; amp *= 0.55;
    }
    for (let i = 0; i < w * w; i++) out[i] /= tot;
    return out;
  };

  const owned = { tex: [], geo: [], mat: [] };
  const mkTex = (w, fn, srgb) => {
    const d = new Uint8Array(w * w * 4);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, c = fn(x, y);
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    const t = new T.DataTexture(d, w, w, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.needsUpdate = true;
    if (srgb) t.colorSpace = T.SRGBColorSpace;
    else if (T.NoColorSpace !== undefined) t.colorSpace = T.NoColorSpace;
    t.anisotropy = 4;
    t.magFilter = T.LinearFilter;
    t.minFilter = T.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    owned.tex.push(t);
    return t;
  };

  const colorTex = (seed, r, g, b, varia, grain) => {
    const random = rng(seed);
    return mkTex(64, (x, y) => {
      const weave = seed === 111 || seed === 91 ? ((x % 2) - (y % 2)) * 0.007 : 0;
      const k = 1 + (random() - 0.5) * 0.018 + weave;
      return [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)];
    }, true);
  };
  const roughTex = (seed, base, amp) => {
    const random = rng(seed);
    if ([12,22,32,42,82].includes(seed)) base = {12:0.56,22:0.49,32:0.58,42:0.48,82:0.56}[seed];
    return mkTex(64, (x, y) => {
      const v = Math.max(0, Math.min(255, (base + (random() - 0.5) * 0.026) * 255));
      return [v, v, v];
    }, false);
  };
  const normTex = (seed, strength) => {
    const w = 64, h = new Float32Array(w*w), random=rng(seed);
    for(let i=0;i<h.length;i++) h[i]=random();
    const fabric = seed === 113 || seed === 93;
    return mkTex(w, (x, y) => {
      const hx = h[y * w + (x + 1) % w] - h[y * w + (x + w - 1) % w];
      const hy = h[((y + 1) % w) * w + x] - h[((y + w - 1) % w) * w + x];
      let nx = -hx * 0.025, ny = -hy * 0.009, nz = 1;
      if(fabric) { nx=((x%2)-0.5)*0.025; ny=((y%2)-0.5)*0.025; }
      const l = Math.hypot(nx, ny, nz);
      return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255];
    }, false);
  };

  const mkMat = (o) => { const m = new T.MeshStandardMaterial(o); owned.mat.push(m); return m; };

  const M = {
    recv: mkMat({ map: colorTex(11, 50, 50, 48, 0.06, 0.03), roughnessMap: roughTex(12, 0.60, 0.02), normalMap: normTex(13, 0.02), normalScale: new T.Vector2(0.12, 0.12), metalness: 0.62, roughness: 0.6 }),
    steel: mkMat({ map: colorTex(21, 134, 132, 126, 0.08, 0.04), roughnessMap: roughTex(22, 0.38, 0.16), normalMap: normTex(23, 0.8), normalScale: new T.Vector2(0.16, 0.16), metalness: 0.9, roughness: 0.4 }),
    barrel: mkMat({ map: colorTex(31, 43, 43, 40, 0.08, 0.04), roughnessMap: roughTex(32, 0.50, 0.16), normalMap: normTex(33, 0.9), normalScale: new T.Vector2(0.18, 0.18), metalness: 0.78, roughness: 0.5 }),
    hard: mkMat({ map: colorTex(41, 170, 166, 154, 0.06, 0.03), roughnessMap: roughTex(42, 0.34, 0.14), metalness: 0.86, roughness: 0.36 }),
    poly: mkMat({ map: colorTex(51, 36, 35, 32, 0.08, 0.04), roughnessMap: roughTex(52, 0.82, 0.16), normalMap: normTex(53, 1.3), normalScale: new T.Vector2(0.38, 0.38), metalness: 0.0, roughness: 0.84 }),
    grip: mkMat({ map: colorTex(61, 38, 36, 34, 0.3, 0.26), roughnessMap: roughTex(62, 0.82, 0.3), normalMap: normTex(63, 4.5), normalScale: new T.Vector2(1.0, 1.0), metalness: 0.0, roughness: 0.85 }),
    mag: mkMat({ map: colorTex(71, 50, 48, 44, 0.2, 0.12), roughnessMap: roughTex(72, 0.72, 0.22), normalMap: normTex(73, 2.2), normalScale: new T.Vector2(0.52, 0.52), metalness: 0.0, roughness: 0.76 }),
    sight: mkMat({ map: colorTex(81, 54, 56, 60, 0.16, 0.08), roughnessMap: roughTex(82, 0.46, 0.2), metalness: 0.78, roughness: 0.46 }),
    glove: mkMat({ map: colorTex(91, 58, 56, 52, 0.22, 0.2), roughnessMap: roughTex(92, 0.86, 0.22), normalMap: normTex(93, 4.0), normalScale: new T.Vector2(0.9, 0.9), metalness: 0.0, roughness: 0.88 }),
    skin: mkMat({ map: colorTex(101, 176, 136, 112, 0.14, 0.1), roughnessMap: roughTex(102, 0.7, 0.18), normalMap: normTex(103, 2.0), normalScale: new T.Vector2(0.4, 0.4), metalness: 0.0, roughness: 0.72 }),
    sleeve: mkMat({ map: colorTex(111, 57, 61, 53, 0.02, 0.01), roughnessMap: roughTex(112, 0.88, 0.02), normalMap: normTex(113, 0.02), normalScale: new T.Vector2(0.18, 0.18), metalness: 0.0, roughness: 0.88 }),
    lens: mkMat({ color: 0x7bafb9, metalness: 0.15, roughness: 0.13, transparent: true, opacity: 0.22, depthWrite: false, side: T.DoubleSide }),
    cavity: mkMat({ color: 0x08090a, metalness: 0.12, roughness: 0.78 }),
    dot: mkMat({ color: 0xff2414, emissive: 0xff1605, emissiveIntensity: 3, roughness: 0.8 })
  };
  for (const [key, material] of Object.entries(M)) {
    material.name = 'sunbreak-' + key;
    // Three multiplies the scalar by the map; maps already hold physical roughness.
    if (material.roughnessMap) material.roughness = 1;
  }

  // ---- geometry accumulation --------------------------------------------
  const buckets = {};
  const tmp = new T.Object3D();
  const add = (key, geo, px, py, pz, rx, ry, rz, sx, sy, sz) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    tmp.position.set(px || 0, py || 0, pz || 0);
    tmp.rotation.set(rx || 0, ry || 0, rz || 0);
    tmp.scale.set(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz);
    tmp.updateMatrix();
    g.applyMatrix4(tmp.matrix);
    if (!g.attributes.uv) {
      const c = g.attributes.position.count;
      g.setAttribute('uv', new T.BufferAttribute(new Float32Array(c * 2), 2));
    }
    (buckets[key] || (buckets[key] = [])).push(g);
  };
  const box = (w, h, d, s) => new T.BoxGeometry(w, h, d, s || 1, s || 1, s || 1);
  const cyl = (r1, r2, h, rs) => new T.CylinderGeometry(r1, r2, h, rs || 14, 1, false);
  const cap = (r, l, rs) => new T.CapsuleGeometry(r, l, 3, rs || 10);
  const sph = r => new T.SphereGeometry(r, 12, 9);
  const PI2 = Math.PI / 2;
  const bevel = (w, h, d, r = 0.008) => {
    const s = new T.Shape(), x = w / 2 - r, y = h / 2 - r;
    s.moveTo(-x,-y); s.lineTo(x,-y); s.lineTo(x,y); s.lineTo(-x,y); s.closePath();
    const g = new T.ExtrudeGeometry(s, {depth: d-2*r, bevelEnabled:true, bevelThickness:r, bevelSize:r, bevelSegments:2, steps:1});
    g.translate(0,0,-d/2+r); return g;
  };
  const ring = (outer, inner, depth) => {
    const s = new T.Shape(); s.absarc(0,0,outer,0,Math.PI*2,false);
    const h = new T.Path(); h.absarc(0,0,inner,0,Math.PI*2,true); s.holes.push(h);
    const g = new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,steps:1,curveSegments:16});
    g.translate(0,0,-depth/2); return g;
  };
  const sideProfile = (points,width,r=0.006) => {
    const s = new T.Shape(); points.forEach(([z,y],i)=>i?s.lineTo(-z,y):s.moveTo(-z,y)); s.closePath();
    const g=new T.ExtrudeGeometry(s,{depth:width-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:2,steps:1});
    g.translate(0,0,-width/2+r);g.rotateY(PI2);return g;
  };

  // Receiver: stepped AR-like upper/lower with slimmer bevels and visible controls.
  add('recv',sideProfile([[-0.52,-0.010],[-0.52,0.050],[-0.475,0.074],[-0.090,0.074],[0.026,0.049],[0.034,0.010],[-0.026,-0.017]],0.142));
  add('recv',sideProfile([[-0.438,-0.023],[-0.438,-0.070],[-0.304,-0.083],[-0.222,-0.064],[-0.108,-0.060],[0.018,-0.084],[0.025,-0.026]],0.122));
  add('recv', bevel(0.092, 0.060, 0.16, 0.007), 0, -0.095, -0.355);
  // upper receiver rib + charging shroud
  add('recv', bevel(0.080, 0.024, 0.48, 0.006), 0, 0.091, -0.26);
  add('steel', bevel(0.060, 0.010, 0.20,0.003), 0, 0.106, -0.14);
  // machining seams and localized worn edges
  for (let i = 0; i < 5; i++) add('steel', box(0.145, 0.006, 0.009), 0, 0.024 - i * 0.018, -0.51 + i * 0.002);
  add('steel', box(0.145, 0.008, 0.010), 0, 0.046, -0.03);
  add('steel', box(0.145, 0.008, 0.010), 0, -0.054, -0.46);
  add('hard', bevel(0.010, 0.006, 0.40, 0.002), 0.072, 0.064, -0.275);
  add('hard', bevel(0.010, 0.005, 0.34, 0.002), -0.072, 0.058, -0.285);
  add('hard', bevel(0.012, 0.005, 0.19, 0.002), 0.066, -0.070, -0.350);
  add('cavity', bevel(0.006, 0.006, 0.19, 0.001), 0.073, -0.030, -0.350);
  add('cavity', bevel(0.006, 0.006, 0.14, 0.001), -0.073, -0.028, -0.130);
  for (let i = 0; i < 4; i++) {
    add('hard', bevel(0.006, 0.003, 0.050, 0.001), 0.074, 0.062 - i * 0.028, -0.430 + i * 0.078);
    add('hard', bevel(0.004, 0.004, 0.030, 0.001), -0.073, 0.048 - i * 0.026, -0.450 + i * 0.090);
  }
  // ejection port recess + bolt carrier face
  add('cavity', bevel(0.005, 0.048, 0.160, 0.002), 0.074, 0.030, -0.17);
  add('steel', bevel(0.006, 0.025, 0.128, 0.002), 0.078, 0.034, -0.16);
  for(let i=0;i<5;i++) add('cavity',box(0.002,0.022,0.003),0.082,0.034,-0.12-i*0.008);
  add('recv', bevel(0.010,0.008,0.16,0.002),0.078,0.000,-0.17);
  add('steel', cyl(0.004,0.004,0.16,10),0.082,-0.006,-0.17,PI2);
  add('steel', bevel(0.006,0.020,0.044,0.0015),0.081,0.018,-0.280,0,0,0.1);
  add('hard', cyl(0.009, 0.006, 0.020, 12), 0.083, 0.012, -0.030, 0, 0, PI2);
  add('hard', cyl(0.007, 0.006, 0.018, 12), 0.083, -0.020, -0.230, 0, 0, PI2);
  add('cavity', box(0.003,0.016,0.038),0.085,0.004,-0.060,0.2,0,0);
  // selector switch + mag release + takedown screws
  add('hard', cyl(0.014, 0.014, 0.024), -0.076, -0.033, 0.0, 0, 0, PI2);
  add('hard', box(0.010, 0.010, 0.044), -0.086, -0.033, -0.012);
  add('hard', cyl(0.013, 0.013, 0.024), 0.076, -0.038, -0.3, 0, 0, PI2);
  [[-0.46], [0.0]].forEach(p => {
    add('hard', cyl(0.011, 0.011, 0.15, 10), 0, -0.052, p[0], 0, 0, PI2);
    for(const side of [-1,1]) add('cavity',box(0.002,0.004,0.014),side*0.078,-0.052,p[0]);
  });
  // trigger guard + trigger
  add('recv', box(0.022, 0.010, 0.115), 0, -0.142, -0.02);
  add('recv', box(0.022, 0.058, 0.012), 0, -0.118, -0.078);
  add('recv', box(0.022, 0.058, 0.012), 0, -0.118, 0.036);
  add('hard', box(0.012, 0.043, 0.014), 0, -0.118, -0.02, 0.2, 0, 0);

  // Top rail teeth (receiver + handguard)
  for (let i = 0; i < 30; i++) {
    const z = -0.5 - i * 0.026;
    if (z < -1.28) break;
    add('steel', box(0.052, 0.011, 0.013), 0, 0.125, z);
  }
  add('steel', box(0.055, 0.009, 0.78), 0, 0.118, -0.89);

  // Handguard: slim free-float rails with dark recesses and vent strips.
  for(const side of [-1,1]) for(const y of [-0.064,0.065])
    add('recv',bevel(0.018,0.026,0.66,0.005),side*0.052,y*0.88,-0.985);
  add('recv',bevel(0.090,0.021,0.66,0.005),0,0.067,-0.985);
  add('poly',bevel(0.090,0.020,0.63,0.005),0,-0.071,-1.0);
  add('barrel',cyl(0.020,0.020,0.79,20),0,0.005,-0.98,PI2);
  add('steel',cyl(0.007,0.007,0.66,10),0,0.042,-0.99,PI2);
  for (let i = 0; i < 7; i++) {
    const z = -0.76 - i * 0.075;
    for(const side of [-1,1]) {
      add('cavity',bevel(0.006,0.075,0.020,0.002),side*0.061,-0.003,z);
      add('recv',bevel(0.015,0.095,0.015,0.003),side*0.052,-0.003,z);
    }
  }
  for (let i = 0; i < 6; i++) add('poly', box(0.108, 0.008, 0.011), 0, -0.068, -0.74 - i * 0.09);
  // handguard end cap / gas block
  add('steel', bevel(0.066, 0.078, 0.058, 0.005), 0, 0.026, -1.33);
  add('hard', cyl(0.010, 0.010, 0.044), 0, 0.073, -1.33);

  // Barrel: bore center (0,0.005), z -1.35 .. -1.8, muzzle to -1.85
  add('barrel', cyl(0.022, 0.020, 0.45), 0, 0.005, -1.575, PI2);
  add('barrel', cyl(0.026, 0.026, 0.05), 0, 0.005, -1.37, PI2);
  for (let i = 0; i < 6; i++) add('barrel', cyl(0.024, 0.024, 0.009), 0, 0.005, -1.45 - i * 0.05, PI2);
  // hollow slotted muzzle device, ends exactly z=-1.85
  for(const z of [-1.756,-1.794,-1.842]) add('steel',ring(0.033,0.016,0.014),0,0.005,z);
  for(let i=0;i<4;i++) { const a=i*Math.PI/2+Math.PI/4;
    add('steel',bevel(0.010,0.010,0.076,0.002),Math.cos(a)*0.025,0.005+Math.sin(a)*0.025,-1.799,0,0,a);
  }
  add('cavity',ring(0.017,0.014,0.045),0,0.005,-1.8225);

  // Red dot sight: open frame + lens
  add('sight', box(0.068, 0.018, 0.105), 0, 0.143, -0.62);
  add('sight', box(0.009, 0.064, 0.100), 0.032, 0.176, -0.62);
  add('sight', box(0.009, 0.064, 0.100), -0.032, 0.176, -0.62);
  add('sight', box(0.074, 0.011, 0.100), 0, 0.211, -0.62);
  add('sight', ring(0.028,0.024,0.006), 0, 0.176, -0.667);
  add('sight', ring(0.028,0.024,0.006), 0, 0.176, -0.573);
  add('hard', cyl(0.009, 0.009, 0.018), 0.035, 0.154, -0.62, 0, 0, PI2);

  // First-person frame: stock is shouldered and out of view; keep only receiver extension.
  add('recv', bevel(0.044, 0.048, 0.070, 0.005), 0, 0.002, 0.010);
  add('steel',cyl(0.010,0.010,0.090,14),0,0.030,0.060,PI2);
  add('hard',cyl(0.013,0.013,0.012,12),0,0.030,0.018,PI2);

  // Pistol grip (angled)
  add('grip', bevel(0.058, 0.190, 0.078,0.012), 0, -0.198, 0.056, -0.32);
  add('grip', bevel(0.052, 0.056, 0.086,0.010), 0, -0.292, 0.092, -0.32);
  for (let i = 0; i < 6; i++) add('grip', box(0.060, 0.009, 0.010), 0, -0.130 - i * 0.025, 0.026 + i * 0.008, -0.32);

  // Magazine: curved forward, ribs, down to y=-0.42 near z=-0.36
  add('mag', bevel(0.058, 0.082, 0.108,0.006), 0, -0.122, -0.355);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, y = -0.174 - t * 0.190, z = -0.355 - t * t * 0.058;
    add('mag', bevel(0.056 - t * 0.003, 0.044, 0.104,0.007), 0, y, z, -t * 0.38);
    if (i % 2 === 0) add('mag', bevel(0.060, 0.009, 0.108,0.003), 0, y, z + 0.004, -t * 0.38);
  }
  add('mag', bevel(0.064, 0.022, 0.112,0.004), 0, -0.372, -0.410, -0.36);

  // ---- hands --------------------------------------------------------------
  const limb = (key, a, b, ra, rb) => {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());
    const e = new T.Euler().setFromQuaternion(q), mid = start.add(end).multiplyScalar(0.5);
    add(key,cyl(rb,ra,delta.length(),14),mid.x,mid.y,mid.z,e.x,e.y,e.z);
  };
  const finger = (key, x, y, z, ry, len, r, curl, seg) => {
    let px = x, py = y, pz = z, a = 0;
    for (let i = 0; i < (seg || 3); i++) {
      a += curl;
      const l = len * (1 - i * 0.18), rr = r * (1 - i * 0.14);
      const dz = Math.cos(a) * l, dy = -Math.sin(a) * l;
      const end = [px+dz*Math.sin(ry),py+dy,pz+dz*Math.cos(ry)];
      limb(key,[px,py,pz],end,rr,rr*0.88);
      add(key,sph(rr),px,py,pz);
      px += dz * Math.sin(ry); py += dy; pz += dz * Math.cos(ry);
      add(key, sph(rr * 0.92), px, py, pz);
    }
  };

  // Right hand at pistol grip (~z=0.04, y=-0.20)
  add('glove', cap(0.049, 0.078, 10), 0.050, -0.190, 0.034, 0.25, 0.1, 0.45);
  add('glove', sph(0.051), 0.053, -0.160, 0.012);
  for (let i = 0; i < 4; i++)
    finger('glove', 0.028, -0.132 - i * 0.031, -0.018, -1.25, 0.039 - i * 0.0025, 0.0152 - i * 0.001, 0.72);
  finger('glove', 0.052, -0.142, 0.072, -1.25, 0.037, 0.0175, 0.5, 2);
  add('glove', cap(0.050, 0.086, 10), 0.066, -0.216, 0.108, 0.45, 0.12, 0);
  limb('skin',[0.066,-0.228,0.116],[0.082,-0.280,0.194],0.041,0.047);
  limb('sleeve',[0.082,-0.280,0.194],[0.120,-0.480,0.460],0.052,0.070);
  limb('poly',[0.078,-0.268,0.180],[0.086,-0.296,0.228],0.054,0.056);

  // Left support hand below handguard (z=-0.9)
  add('glove', cap(0.054, 0.094, 10), -0.060, -0.112, -0.9, 0.1, -0.25, -0.5);
  add('glove', sph(0.056), -0.051, -0.088, -0.93);
  for (let i = 0; i < 4; i++)
    finger('glove', -0.030, -0.055 + i * 0.004, -0.982 + i * 0.040, 0.45, 0.042 - i * 0.0025, 0.0155 - i * 0.001, 0.78);
  finger('glove', -0.058, -0.042, -0.848, 1.3, 0.040, 0.0175, 0.45, 2);
  add('glove', cap(0.054, 0.098, 10), -0.088, -0.166, -0.810, -0.5, -0.2, 0);
  limb('skin',[-0.088,-0.166,-0.810],[-0.112,-0.218,-0.726],0.041,0.047);
  limb('sleeve',[-0.112,-0.218,-0.726],[-0.250,-0.540,-0.270],0.054,0.078);
  limb('sleeve',[-0.250,-0.540,-0.270],[-0.340,-0.980,0.180],0.078,0.110);
  limb('poly',[-0.108,-0.211,-0.738],[-0.122,-0.240,-0.696],0.056,0.058);

  // ---- merge --------------------------------------------------------------
  const mergeList = list => {
    let n = 0;
    list.forEach(g => n += g.attributes.position.count);
    const p = new Float32Array(n * 3), nm = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    let o = 0;
    list.forEach(g => {
      const a = g.attributes, c = a.position.count;
      p.set(a.position.array.subarray(0, c * 3), o * 3);
      if (a.normal) nm.set(a.normal.array.subarray(0, c * 3), o * 3);
      if (a.uv) uv.set(a.uv.array.subarray(0, c * 2), o * 2);
      o += c;
      g.dispose();
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(p, 3));
    out.setAttribute('normal', new T.BufferAttribute(nm, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    out.computeBoundingSphere();
    owned.geo.push(out);
    return out;
  };

  const root = new T.Group();
  root.name = 'ar_carbine_viewmodel';
  // Visual fit only: preserve the baseline parent and exact bore center/muzzle endpoint.
  root.scale.set(0.62,0.78,1);
  root.position.y = 0.005 * (1 - 0.78);
  for (const k in buckets) {
    const mesh = new T.Mesh(mergeList(buckets[k]), M[k]);
    mesh.frustumCulled = false;
    mesh.name = 'sunbreak-weapon-' + k;
    mesh.castShadow = mesh.receiveShadow = false;
    root.add(mesh);
  }
  // lens (transparent, own drawcall)
  const lensGeo = new T.CircleGeometry(0.025, 20);
  owned.geo.push(lensGeo);
  const lens = new T.Mesh(lensGeo, M.lens);
  lens.position.set(0, 0.176, -0.6);
  lens.frustumCulled = false;
  root.add(lens);
  const dotGeo = new T.CircleGeometry(0.0014,12); owned.geo.push(dotGeo);
  const dot = new T.Mesh(dotGeo,M.dot); dot.position.set(0,0.176,-0.558); root.add(dot);

  gun.add(root);

  let disposed = false;
  return {
    update(dt, state) {},
    dispose() {
      if (disposed) return;
      disposed = true;
      if (root.parent) root.parent.remove(root);
      owned.geo.forEach(g => g.dispose());
      owned.mat.forEach(m => m.dispose());
      owned.tex.forEach(t => t.dispose());
      owned.geo.length = owned.mat.length = owned.tex.length = 0;
    }
  };
}
