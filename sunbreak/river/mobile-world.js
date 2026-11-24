import {MAP,walls,houses,bufferPlacements,bounds,wallTopAt,groundHeight,landscapeHeight,terrainHeight,roofHeight,blocked} from './map-layout.js';
export async function buildWorld(ctx){
  const {THREE:T,scene,rnd,cam,gscene,sun,amb,solids,colliders,enemies}=ctx;
  const keep=new Set([sun,amb,cam,sun&&sun.target,enemies]);
  for(const e of enemies)keep.add(e.g);
  for(const c of scene.children)if(!keep.has(c))c.visible=false;
  const world=new T.Group();world.name='riverfall-world';scene.add(world);
  let seed=20261124;
  const R=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
  const num=(fn,fallback=0)=>{try{const v=fn();return Number.isFinite(v)?v:fallback;}catch(e){return fallback;}};
  const land=(x,z)=>num(()=>landscapeHeight(x,z),0),floor=(x,z)=>num(()=>terrainHeight(x,z),land(x,z)),roofAt=(x,z)=>num(()=>roofHeight(x,z),-Infinity);
  const isBlocked=(x,z,r)=>blocked(x,z,r),SIZE=152,cx=0,cz=-4;
  colliders.length=0;solids.length=0;
  for(const b of bounds){const box=new T.Box3(new T.Vector3(b.min.x,b.min.y,b.min.z),new T.Vector3(b.max.x,b.max.y,b.max.z));if(b.profileWall)box.topAt=(x,z,r)=>wallTopAt(b.profileWall,x,z,r);colliders.push(box)}
  const tex=(c1,c2,w,h,n,rx=1,ry=1)=>{
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');
    g.fillStyle=c1;g.fillRect(0,0,w,h);g.fillStyle=c2;
    for(let i=0;i<n;i++){g.globalAlpha=.15+R()*.45;g.fillRect((R()*w)|0,(R()*h)|0,1+((R()*3)|0),1+((R()*2)|0));}
    const t=new T.CanvasTexture(cv);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);
    if('colorSpace' in t)t.colorSpace=T.SRGBColorSpace;return t;
  };
  const mk=(map,o)=>new T.MeshLambertMaterial(Object.assign({map},o));
  const M={
    roof:mk(tex('#7a3b2c','#3f1d16',32,32,160,3,3),{side:T.DoubleSide}),
    wood:mk(tex('#6b4a2e','#3a2616',32,32,140,2,2)),
    stone:mk(tex('#85857d','#4c4e4a',32,32,180,2,2)),
    leaf:mk(tex('#3f6b34','#1f3d1c',32,32,160,2,2)),
    grass:mk(tex('#5d8442','#3b5a2b',32,32,180,8,8)),
    brick:mk(tex('#8d4f3c','#4e2a20',32,32,200,3,3)),
    plaster:mk(tex('#cfc4ab','#8f8570',32,32,150,2,2))
  };
// Riverfall buffer cabins: local room x[-4,4] z[-4,2.4], porch z 2.4..4, steps z 4..5.6 at door x=-1.08. Assumes flat pad at y=0.
const cabinGeo = new T.BoxGeometry(1, 1, 1), CAB_FY = .66, CAB_EAVE = 4.74, CAB_DX = -1.08;
for (const p of bufferPlacements) {
  const g = new T.Group(), walls = []; g.position.set(p.x, 0, p.z); g.rotation.y = p.yaw; world.add(g);
  const B = (m, x, y, z, sx, sy, sz, hit, rx = 0) => { const b = new T.Mesh(cabinGeo, m); b.position.set(x, y, z);
    b.scale.set(sx, sy, sz); b.rotation.x = rx; g.add(b); solids.push(b); hit && walls.push(b); return b; };
  // Wall with one punched opening [a,b]x[y0,y1]; alongX: runs on x at z=c, else on z at x=c. Overhead parts (lintels) get no collider.
  const W = (alongX, c, lo, hi, a, b, y0, y1) => [[lo, a, CAB_FY, CAB_EAVE], [b, hi, CAB_FY, CAB_EAVE], [a, b, y1, CAB_EAVE], [a, b, CAB_FY, y0]]
    .forEach(([u0, u1, v0, v1]) => { if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3) return; const u = (u0 + u1) / 2, v = (v0 + v1) / 2, hit = v0 < 2;
      alongX ? B(M.wood, u, v, c, u1 - u0, v1 - v0, .24, hit) : B(M.wood, c, v, u, .24, v1 - v0, u1 - u0, hit); });
  B(M.wood, 0, CAB_FY / 2, 0, 8, CAB_FY, 8);                                   // board floor + porch deck, top y=.66
  for (let i = 0; i < 4; i++) { const h = CAB_FY * (4 - i) / 5; B(M.wood, CAB_DX, h / 2, 4.2 + i * .4, 1.55, h, .4); } // four steps
  W(1, 2.28, -4, .2, CAB_DX - .76, CAB_DX + .76, CAB_FY, 2.96);                // front-left: open doorway 1.52 wide, no door leaf
  W(1, 2.28, .2, 4, 1.2, 2.8, 1.9, 3.2);                                       // front-right: window
  W(1, -3.88, -4, 4, -1, 1, 1.9, 3.2);                                         // back: window
  for (const s of [-1, 1]) {
    W(0, s * 3.88, -3.76, 2.16, -1.7, -.1, 1.9, 3.2);                          // side wall + window
    B(M.plaster, s * 3.88, 5.09, 0, .24, .7, 5.2); B(M.plaster, s * 3.88, 5.79, 0, .24, .7, 2.6); // stepped gable infill
    B(M.wood, s * 3.85, (CAB_FY + CAB_EAVE) / 2, 3.85, .18, CAB_EAVE - CAB_FY, .18);  // porch post
    B(M.roof, 0, 5.72, s * 2.16, 8.8, .16, 4.95, 0, s * Math.atan2(2.14, 4));  // terracotta pitch: ridge 6.88, eaves 4.74
  }
  B(M.wood, .9, (CAB_FY + CAB_EAVE) / 2, 3.85, .18, CAB_EAVE - CAB_FY, .18);   // mid porch post (clear of steps)
  B(M.wood, 0, CAB_EAVE - .09, 3.85, 7.9, .18, .18);                           // porch beam
  B(M.wood, 0, 6.86, 0, 8.8, .14, .3);                                         // ridge cap
  g.updateWorldMatrix(true, true);                                             // so raycasts + AABBs use the real transform
  for (const b of walls) colliders.push(new T.Box3().setFromObject(b));        // wall parts only; yaw 0/PI keeps AABBs exact
}
function cabinFloor(x, z) {
  for (const p of bufferPlacements) {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    if (Math.abs(lx) <= 4 && lz >= -4 && lz <= 4) return CAB_FY;
    if (Math.abs(lx - CAB_DX) <= .775 && lz > 4 && lz <= 5.6) return CAB_FY * (4 - Math.min(3, Math.floor((lz - 4) / .4))) / 5;
  }
  return 0;
}
  const matFor=m=>M[m]||M.stone;
  const tg=new T.PlaneGeometry(SIZE,SIZE,80,80).rotateX(-Math.PI/2).translate(cx,0,cz);
  const tp=tg.attributes.position,col=new Float32Array(tp.count*3),k=new T.Color();
  const wood=new T.Color('#4d6a35'),lush=new T.Color('#6f9a48'),dry=new T.Color('#a39a62'),wet=new T.Color('#4a5a44');
  const pathZ=[...houses.flatMap(h=>[h.z-4,h.z+4]),...bufferPlacements.map(b=>b.z)];
 for(let i=0;i<tp.count;i++){const x=tp.getX(i),z=tp.getZ(i),y=land(x,z);tp.setY(i,y);
  const out=x<MAP.minX||x>MAP.maxX||z<MAP.minZ||z>MAP.maxZ,n=Math.sin(x*.9+z*.6)*.5+.5;
  k.copy(out?wood:lush).lerp(dry,out?n*.2:n*.45);
  if(!out&&pathZ.some(p=>Math.abs(z-p+Math.sin(x*.4)*.6)<1.3))k.lerp(wet,.75);
  if(y<MAP.waterY+.35)k.lerp(wet,.9);
  col[i*3]=k.r;col[i*3+1]=k.g;col[i*3+2]=k.b}
 tg.setAttribute('color',new T.BufferAttribute(col,3));tg.computeVertexNormals();
 const terrain=new T.Mesh(tg,new T.MeshStandardMaterial({vertexColors:true,roughness:.55,metalness:.05,flatShading:true}));terrain.name='terrain';world.add(terrain);
 // River: one plane at waterY, visible wherever the valley dips below it; texture scrolls downstream.
 const flow=tex('#3f7f8c','#0e2f3a',3,22,180,14,14);
 const river=new T.Mesh(new T.PlaneGeometry(SIZE,SIZE).rotateX(-Math.PI/2),new T.MeshStandardMaterial({map:flow,color:0xbfe6ee,roughness:.12,metalness:.35,transparent:true,opacity:.8}));
 river.position.set(cx,MAP.waterY,cz);river.name='river';world.add(river);
 // Walls from the shared map; each visible mesh is also a raycast solid.
 for(const w of walls){const b=bounds.find(b=>b.profileWall===w||(w.id&&b.id===w.id));
  const sx=b?b.max.x-b.min.x:w.w,sy=b?b.max.y-b.min.y:w.h,sz=b?b.max.z-b.min.z:w.d;
  const px=b?(b.min.x+b.max.x)/2:w.x,py=b?(b.min.y+b.max.y)/2:w.y,pz=b?(b.min.z+b.max.z)/2:w.z;
  const prof=!!w.profile,g=new T.BoxGeometry(sx,sy,sz,prof?Math.max(1,Math.ceil(sx*2)):1,1,prof?Math.max(1,Math.ceil(sz*2)):1);
  if(prof){const p=g.attributes.position;for(let i=0;i<p.count;i++)if(p.getY(i)>0){const top=num(()=>wallTopAt(w,px+p.getX(i),pz+p.getZ(i),0),py+sy/2);p.setY(i,Math.max(-sy/2+.05,Math.min(sy/2,top-py)))}g.computeVertexNormals()}
  const m=new T.Mesh(g,matFor(w.material));m.position.set(px,py,pz);m.name=w.id||'wall';m.userData.wall=w;world.add(m);solids.push(m)}
 // Roofs sampled from the map's own roofHeight, so shapes (and ruins without roofs) are preserved.
 const prints=[...houses.map(h=>({id:h.id,x:h.x,z:h.z,yaw:0,x0:-h.w/2-.4,x1:h.w/2+.4,z0:-h.d/2-.4,z1:h.d/2+.4})),...bufferPlacements.map(p=>({id:p.id,x:p.x,z:p.z,yaw:p.yaw,x0:-4.8,x1:4.8,z0:-4.8,z1:6.45}))];
 const roofs=new Map();
 for(const f of prints){const g=new T.PlaneGeometry(1,1,10,10),p=g.attributes.position,c=Math.cos(f.yaw),s=Math.sin(f.yaw),ys=[];
  for(let i=0;i<p.count;i++){const qx=f.x0+(p.getX(i)+.5)*(f.x1-f.x0),qz=f.z0+(p.getY(i)+.5)*(f.z1-f.z0),x=f.x+qx*c+qz*s,z=f.z-qx*s+qz*c,y=roofAt(x,z);p.setXYZ(i,x,0,z);ys.push(y>floor(x,z)+1?y:NaN)}
  const ok=ys.filter(Number.isFinite);if(ok.length<p.count*.3){g.dispose();continue}
  const eave=Math.min(...ok);ys.forEach((y,i)=>p.setY(i,Number.isFinite(y)?y:eave));g.computeVertexNormals();
  const m=new T.Mesh(g,M.roof);m.name=f.id+'-roof';world.add(m);roofs.set(f.id,m)}
 // Instanced props.
 const dummy=new T.Object3D();
 const inst=(geo,mat,list,name)=>{if(!list.length)return;const m=new T.InstancedMesh(geo,mat,list.length);list.forEach((a,i)=>{dummy.position.set(a[0],a[1],a[2]);dummy.scale.set(a[3],a[4]??a[3],a[5]??a[3]);dummy.rotation.set(0,a[6]??0,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix)});m.name=name;world.add(m)};
 const trees=[],rocks=[],tufts=[],planks=[];
 for(let i=0;i<2600&&trees.length<230;i++){const x=cx+(R()-.5)*SIZE,z=cz+(R()-.5)*SIZE,y=land(x,z);
  if((x<MAP.minX-1.5||x>MAP.maxX+1.5||z<MAP.minZ-1.5||z>MAP.maxZ+1.5)&&y>MAP.waterY+.4)trees.push([x,y,z,.8+R()*.9,1+R()*.8,.8+R()*.9,R()*6.3])}
 for(let i=0;i<4000&&(rocks.length<90||tufts.length<420);i++){const x=MAP.minX+R()*(MAP.maxX-MAP.minX),z=MAP.minZ+R()*(MAP.maxZ-MAP.minZ),y=land(x,z),d=y-MAP.waterY;
  if(Math.abs(d)<.3&&rocks.length<90)rocks.push([x,y,z,.25+R()*.55,.2+R()*.3,.25+R()*.5,R()*6.3]);
  else if(d>.35&&tufts.length<420&&!isBlocked(x,z,.2))tufts.push([x,floor(x,z),z,.6+R()*.8,.5+R(),.6+R()*.8,R()*6.3])}
 inst(new T.CylinderGeometry(.14,.22,2.4,5).translate(0,1.2,0),M.wood,trees,'trunks');
 inst(new T.ConeGeometry(1.5,3.6,6).translate(0,3.8,0),M.leaf,trees,'canopy');
 inst(new T.DodecahedronGeometry(1,0),M.stone,rocks,'rocks');
 inst(new T.ConeGeometry(.12,.5,4).translate(0,.25,0),M.grass,tufts,'grass');
 // Bridges: plank rows wherever the map's walkable floor is raised over the river bed.
 for(let z=MAP.minZ;z<=MAP.maxZ;z+=.5){let a=Infinity,b=-Infinity;
  for(let x=MAP.minX;x<=MAP.maxX;x+=.5)if(groundHeight(x,z)<MAP.waterY){a=Math.min(a,x);b=Math.max(b,x)}
  if(a>b)continue;const mid=(a+b)/2,y=floor(mid,z);
  if(y>MAP.waterY+.15){planks.push([mid,y-.07,z,b-a+1.6,.12,.44,0]);for(const e of [a-.7,b+.7])planks.push([e,y+.4,z,.12,1,.12,0])}}
 inst(new T.BoxGeometry(1,1,1),M.wood,planks,'bridge');
 // Lighting and weather.
 const hemi=new T.HemisphereLight(0xcfe3ee,0x3b4a34,.7);scene.add(hemi);
 const styles={afterRain:[0xa9c4cf,.012,1.5,.55],overcast:[0x8f9aa0,.02,.9,.7],dusk:[0xd49a72,.015,1.1,.4]},names=Object.keys(styles);
 let style='afterRain',t=0,sparkLife=0;
 const setStyle=n=>{if(!styles[n])n='afterRain';style=n;const s=styles[n];scene.background=new T.Color(s[0]);scene.fog=new T.FogExp2(s[0],s[1]);
  if(sun){sun.intensity=s[2];sun.position.set(cx-30,45,cz+24);sun.color.set(n==='dusk'?0xffc38f:0xfff2dc)}if(amb)amb.intensity=s[3];hemi.intensity=s[3]+.2;return style};
 setStyle(style);
 const spark=new T.Mesh(new T.OctahedronGeometry(.12,0),new T.MeshBasicMaterial({color:0xffd27a,transparent:true}));spark.visible=false;world.add(spark);
 const resetFeedback=()=>{sparkLife=0;spark.visible=false};
 const gcam=ctx.gcam||cam;
 return{
  world,
  render(){rnd.render(scene,cam);},
  update(dt=0){t+=dt;flow.offset.y=(t*.07)%1;flow.offset.x=Math.sin(t*.3)*.02;if(sparkLife>0){sparkLife-=dt;spark.material.opacity=Math.max(0,sparkLife/.18);spark.scale.setScalar(1+(.18-sparkLife)*8);if(sparkLife<=0)spark.visible=false}},
  setStyle,
  cycleWeather(){return setStyle(names[(names.indexOf(style)+1)%names.length])},
  shot(hit){const p=hit&&(hit.point||hit);if(p&&Number.isFinite(p.x)){spark.position.set(p.x,p.y,p.z);spark.visible=true;sparkLife=.18}},
  waterTime(){return t},
  resetHouse(id){for(const [k,m] of roofs)if(id==null||k===id)m.visible=true;resetFeedback()},
  resetFeedback,
  floorHeight:(x,z)=>cabinFloor(x,z)||floor(x,z),
  ceilingY(p,prevY){const y=roofAt(p.x,p.z);return y>(prevY??p.y)?y-.2:Infinity},
  blocksMovement(p,actor){return p.x<MAP.minX+.4||p.x>MAP.maxX-.4||p.z<MAP.minZ+.4||p.z>MAP.maxZ-.4||isBlocked(p.x,p.z,actor==='player'?.4:.5)}
 };
}
