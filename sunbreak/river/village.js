export function buildVillage({ T, world, materials, layout, solids }) {
  const G = new T.Group(); G.name = 'village'; world.add(G);
  let seed = 1337;
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tint = (k, c) => { const m = (materials[k] || materials.plaster).clone(); m.color.set(c); return m; };
  const M = {
    ochre: tint('plaster', 0xb98a35), ivory: tint('plaster', 0xe4d9bb), plaster: materials.plaster,
    brick: materials.brick, stone: materials.stone, metal: materials.metal,
    wood: tint('wood', 0x5b3e27), woodA: tint('wood', 0x8d8473), woodB: tint('wood', 0x6f6352),
    shutter: tint('wood', 0x3f5f52), roof: tint('roof', 0x4b3b36), tile: tint('roof', 0x3a2c29)
  };
  for (const k in M) {
    const m = M[k]; if (!m) continue;
    for (const t of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
      if (m[t]) { m[t].wrapS = m[t].wrapT = T.RepeatWrapping; m[t].needsUpdate = true; }
    }
  }
  // Preserve photographed microdetail but remove oversized high-contrast stains.
  for(const key of ['ochre','ivory','plaster','stone']){
    const mat=M[key];mat.normalScale.set(.23,.23);mat.roughness=.9;
    mat.onBeforeCompile=s=>{
      s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 facadePos;').replace('#include <begin_vertex>','#include <begin_vertex>\nfacadePos=(modelMatrix*vec4(position,1.)).xyz;');
      s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 facadePos;').replace('#include <map_fragment>',`#include <map_fragment>
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuse*vec3(.69,.68,.62),${key==='stone'?'.52':'.64'});
        diffuseColor.rgb*=mix(vec3(.70,.74,.64),vec3(1.),smoothstep(0.,1.1,facadePos.y));`);
    };mat.customProgramCacheKey=()=> 'village-soft-surface-'+key;
  }
  M.stone.color.set(0x8a9280);
  const B = {};
  let boxes = 0, solidCount = 0;
  // batched visual box, UVs in meters
  const add = (k, w, h, d, x, y, z, rz = 0, ry = 0) => {
    if (!M[k]) k = 'plaster';
    const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv;
    for (let i = 0; i < 24; i++) {
      const f = i >> 2, su = f < 2 ? d : w, sv = (f === 2 || f === 3) ? d : h;
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    const b = B[k] || (B[k] = { p: [], n: [], u: [], i: [], c: 0 });
    const P = g.attributes.position.array, N = g.attributes.normal.array, U = uv.array, I = g.index.array;
    for (let i = 0; i < P.length; i++) { b.p.push(P[i]); b.n.push(N[i]); }
    for (let i = 0; i < U.length; i++) b.u.push(U[i]);
    for (let i = 0; i < I.length; i++) b.i.push(I[i] + b.c);
    b.c += 24; boxes++; g.dispose();
  };
  // invisible per-box collider (no draw call) for shot occlusion
  const inv = new T.MeshBasicMaterial({ visible: false });
  const solid = (w, h, d, x, y, z, rz = 0, ud = {}) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), inv);
    m.position.set(x, y, z); m.rotation.z = rz; m.userData = ud;
    G.add(m); m.updateMatrixWorld(true); solids.push(m); solidCount++;
  };
  const both = (k, w, h, d, x, y, z, rz = 0, ud) => { add(k, w, h, d, x, y, z, rz); solid(w, h, d, x, y, z, rz, ud); };

  const houses = layout.houses || [], walls = layout.walls || [];
  const hById = {};
  houses.forEach(h => { hById[h.id] = h; });
  const wallTint = h => (h && Math.round((h.z + 23) / 20) % 2 ? 'ivory' : 'ochre');

  // collision walls: exact boxes
  for (const w of walls) {
    const k = w.material === 'plaster' || !M[w.material] ? wallTint(hById[w.houseId]) : w.material;
    both(k, w.w, w.h, w.d, w.x, w.y, w.z, 0, { wall: w.id, houseId: w.houseId });
  }

  const A = Math.atan2(1.7, 3.8), SL = Math.hypot(3.8, 1.7), nx = Math.sin(A), ny = Math.cos(A), tiles=[];
  for (const h of houses) {
    seed=7331+Math.round((h.z+30)*71); // paired structural/dressing decisions
    const X = h.x, Z = h.z, ruin = h.ruin | 0, ud = { houseId: h.id, roof: true };
    // door height from lintel wall
    let dh = 2.3;
    for (const w of walls) {
      if (w.houseId === h.id && Math.abs(w.x - X) < .5 && Math.abs(Math.abs(w.z - Z) - 3.5) < .4 && w.y - w.h / 2 > 1) dh = w.y - w.h / 2;
    }
    // roof slabs, tile courses, ridge cap
    const len = ruin === 0 ? 7.6 : 3.8, cz = ruin === 0 ? Z : Z - 1.9;
    if (ruin < 2) {
      for (const s of [-1, 1]) {
        both('roof', SL, .12, len, X + s * 1.9, 4.15, cz, -s * A, ud);
        for (let i = 0; i < 13; i++) for(let j=0;j<Math.ceil(len/.24);j++){
          const t = (i + .5) / 13;
          tiles.push({x:X+s*3.8*(1-t)+s*nx*.08,y:3.3+1.7*t+ny*.08,z:cz-len/2+(j+.5)*len/Math.ceil(len/.24),rz:-s*A});
        }
      }
      add('tile', .42, .14, len, X, 5.14, cz);
    }
    if(ruin===2){
      for(const sx of [-1,1])for(const dz of [-3.4,0])both('wood',.18,3.3,.18,X+sx*3.35,1.65,Z+dz,0,ud);
      for(const sx of [-1,1])for(const end of [-1,1])for(let i=0;i<5;i++){
        const height=.10+.16*((i*7+3)%5)/5;both('brick',.46,height,.27,X+sx*(1.2+i*.5),1.05+height/2,Z+end*3.5);
      }
      for(const sx of [-1,1])for(let i=0;i<5;i++){
        add('brick',.44,.16,.30,X+sx*(1.6+i*.27),.08,Z+1.9+(i%2)*.3,0,(i%3)*.41);
        if(i<2)both('wood',1.6,.16,.18,X+sx*2.3,.15,Z-1.4+i*.8,sx*.08);
      }
    }
    // trusses, ridge beam, purlins
    for (const tz of [-3.5, 0, 3.5]) {
      both('wood', 7.2, .16, .16, X, 3.38, Z + tz, 0, ud);
      if (ruin === 2 && tz > 0) continue;
      both('wood', .14, 1.5, .14, X, 4.13, Z + tz, 0, ud);
      for (const s of [-1, 1]) {
        if (ruin === 2 && tz === 0 && s === h.side) continue;
        both('wood', SL, .14, .12, X + s * 1.9, 4.09, Z + tz, -s * A, ud);
      }
    }
    const rl = ruin === 2 ? 4.4 : 7.6;
    both('wood', .16, .18, rl, X, 4.86, Z - 3.8 + rl / 2, 0, ud);
    for (const s of [-1, 1]) for (const t of [.2, .5, .8]) {
      const pl = ruin === 2 ? 3+((s*h.side+1)*.35+t)*1.5 : 7.6;
      both('wood', .1, .1, pl, X + s * 3.8 * (1 - t), 3.24 + 1.7 * t, Z - 3.8 + pl / 2, 0, ud);
    }
    // window frames + slatted shutters (opening z[-.9,.9], y 1..2.46 stays clear)
    for (const sx of [-1, 1]) {
      const wx = X + sx * 3.5;
      add('wood', .46, .08, 2.04, wx, .96, Z);
      add('wood', .46, .08, 2.04, wx, 2.5, Z);
      for (const sz of [-1, 1]) {
        add('wood', .46, 1.46, .07, wx, 1.73, Z + sz * .94);
        if (ruin && R() < .3 * ruin) continue;
        const px = X + sx * 3.74, pz = Z + sz * 1.42;
        add('shutter', .05, 1.46, .07, px, 1.73, pz - .4);
        add('shutter', .05, 1.46, .07, px, 1.73, pz + .4);
        for (let i = 0; i < 8; i++) add('shutter', .03, .13, .76, px, 1.1 + i * .18, pz, sx * .5);
      }
    }
    // door frames, kept outside |x|<1.1
    for (const sz of [-1, 1]) {
      const dz = Z + sz * 3.5;
      for (const s of [-1, 1]) add('wood', .1, dh, .5, X + s * 1.16, dh / 2, dz);
      add('wood', 2.6, .14, .52, X, dh + .07, dz);
    }
    // rubble clusters, away from passage
    const nc = 2 + ruin * 3;
    for (let c = 0; c < nc; c++) {
      const lx = (R() < .5 ? -1 : 1) * (1.8 + R() * 1.5);
      const inside = ruin && c % 2;
      const lz = inside ? (R() - .5) * 5 : (R() < .5 ? -1 : 1) * (4.1 + R() * .8);
      for (let i = 0; i < 8; i++) {
        const k = R() < .5 ? 'brick' : 'tile';
        add(k, .22, k === 'brick' ? .07 : .03, .11 + R() * .08,
          X + lx + (R() - .5) * .9, .035, Z + lz + (R() - .5) * .9, (R() - .5) * .5, R() * 3.14);
      }
    }
  }

  // footbridge: deck top y=0, joists below, low side curbs only
  const wk = ['wood', 'woodA', 'woodB'];
  for (let i = 0; i < 40; i++) {
    const k = wk[(R() * 3) | 0], l = 2.4 - R() * .12;
    add(k, .27, .12, l, -5.85 + i * .3, -.06, -4 + (R() - .5) * .06);
  }
  for (const jz of [-5, -4, -3]) add('wood', 12, .18, .14, 0, -.21, jz);
  for (const px of [-5.8, -2, 2, 5.8]) for (const pz of [-5, -3]) add('woodB', .2, 1.3, .2, px, -.95, pz);
  for (const cz2 of [-5.14, -2.86]) add('woodB', 12, .08, .1, 0, .04, cz2);
  solid(12,.12,2.4,0,-.06,-4,0,{bridge:true});
  // Out-of-play village water tank: readable orientation landmark, no cover.
  const tankMat=materials.metal.clone();tankMat.color.set(0x7b8174);tankMat.roughness=.8;
  const tank=new T.Mesh(new T.CylinderGeometry(1.55,1.55,2.5,24),tankMat);tank.position.set(-5,9.1,-39);tank.castShadow=tank.receiveShadow=true;G.add(tank);
  for(const dx of [-1.1,1.1])for(const dz of [-1.1,1.1])add('woodA',.22,7.9,.22,-5+dx,3.95,-39+dz);
  for(const y of [2,4,6])for(const dz of [-1.1,1.1])add('woodB',3.0,.12,.12,-5,y,-39+dz,.65);
  add('woodA',3.5,.2,3.5,-5,7.9,-39);
  for(let i=0;i<18;i++)add('metal',.5,.045,.06,-3.8,.3+i*.42,-37.75);

  const tileGeometry=new T.CylinderGeometry(.115,.115,.34,8,1,true,0,Math.PI);tileGeometry.rotateZ(Math.PI/2);
  const tileMesh=new T.InstancedMesh(tileGeometry,M.tile,tiles.length),dummy=new T.Object3D(),color=new T.Color();
  tiles.forEach((t,i)=>{dummy.position.set(t.x,t.y,t.z);dummy.rotation.set(0,0,t.rz);dummy.updateMatrix();tileMesh.setMatrixAt(i,dummy.matrix);color.setScalar(.8+(i%7)*.035);tileMesh.setColorAt(i,color)});
  tileMesh.castShadow=tileMesh.receiveShadow=true;tileMesh.computeBoundingSphere();G.add(tileMesh);

  // flush batches: one mesh per material
  let draws = 0, tris = 0;
  for (const k in B) {
    const b = B[k], g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(b.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(b.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(b.u, 2));
    g.setIndex(b.i);
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new T.Mesh(g, M[k]);
    m.name = 'village_' + k; m.castShadow = m.receiveShadow = true;
    G.add(m); draws++; tris += b.i.length / 3;
  }
  const counts = { houses: houses.length, walls: walls.length, boxes, solids: solidCount, tiles:tiles.length, drawCalls: draws+2, triangles: tris+tiles.length*16+96, contribution:'Fable 5.2 structure, reviewed and refined by Codex' };
  return { update() {}, info() { return counts; } };
}
