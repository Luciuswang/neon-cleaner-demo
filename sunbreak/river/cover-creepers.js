// cover-creepers.js — cosmetic creeping vines on bank screens + stone covers.
// Integration: call ONCE after buildStoneCover() and addBankScreens() have added
// their meshes to `world`: world.add(buildCoverCreepers(T,world,layout)).
// `layout.walls` supplies the cover walls. Vines are projected onto the real stone
// with a lazy coarse contact cache; unsupported spots are skipped, so building
// before the stone exists yields an empty group.
import {bankScreens} from './map-layout.js';
import {isStoneCover} from './stone-cover.js';

const rngFor=id=>{let s=2166136261;for(const c of String(id))s=Math.imul(s^c.charCodeAt(0),16777619);
 return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};

export function buildCoverCreepers(T,world,layout){
 const group=new T.Group();group.name='cover-creepers';
 const walls=[...bankScreens,...(layout?.walls??[]).filter(isStoneCover)]
  .filter((w,i,a)=>a.findIndex(o=>o.id===w.id)===i);
 const P=[],C=[],V=(x,y,z)=>new T.Vector3(x,y,z);
 const LAUREL=[0x1c3a1d,0x24462a,0x15301b,0x2c4b22].map(h=>new T.Color(h));
 const YOUNG=[0x7d9a5a,0x93a85e,0x6f9060,0x97a865].map(h=>new T.Color(h));
 const OLD=[0x5a5622,0x4b3a1c].map(h=>new T.Color(h)),WOOD=new T.Color(0x7a6d45);
 const tri=(a,b,c,k)=>{P.push(a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z);for(let i=0;i<3;i++)C.push(k.r,k.g,k.b)};
 // broad phase: stone meshes whose world bounds touch a wall; no ground or huge meshes
 world.updateMatrixWorld(true);
 const cands=[];
 world.traverseVisible(m=>{
  if(!m.isMesh||!['stone-cover-stone','stone-cover-mortar','bank-screen-stones','bank-screen-core'].includes(m.name)||!m.geometry?.attributes?.position)return;
  if(m.geometry.attributes.position.count>600000)return;
  if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
  cands.push({m,box:new T.Box3().copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld)});
 });
 const ray=new T.Raycaster(),G=.1;
 let clusters=0,leaves=0,covered=0;

 for(const b of walls){
  const r=rngFor(b.id+'|creeper'),zl=b.d>b.w,yb=b.y-b.h/2,yt=b.y+b.h/2;
  const wb=new T.Box3(V(b.x-b.w/2-.06,yb,b.z-b.d/2-.06),V(b.x+b.w/2+.06,yt+.06,b.z+b.d/2+.06));
  const targets=cands.filter(c=>c.box.intersectsBox(wb)&&c.box.max.y>=b.y&&c.box.max.y-c.box.min.y<8).map(c=>c.m);
  if(!targets.length)continue;
  let used=false;
  for(const sd of[-1,1]){
   const n=zl?V(sd,0,0):V(0,0,sd),a=(zl?b.z-b.d/2:b.x-b.w/2),e=a+(zl?b.d:b.w);
   const at=(u,y,o)=>zl?V(b.x+sd*(b.w/2+o),y,u):V(u,y,b.z+sd*(b.d/2+o));
   const memo=new Map(),back=n.clone().negate();
   const cell=(i,j)=>{const k=i+','+j;if(memo.has(k))return memo.get(k);
    ray.set(at(i*G,j*G,.3),back);ray.far=.45;
    const h=ray.intersectObjects(targets,false)[0],d=h ? .3-h.distance : null;memo.set(k,d);return d};
   const dep=(u,y)=>{const fi=u/G,fj=y/G,i=Math.floor(fi),j=Math.floor(fj),tu=fi-i,tv=fj-j;
    const q=[cell(i,j),cell(i+1,j),cell(i,j+1),cell(i+1,j+1)];if(q.some(v=>v==null))return null;
    return(q[0]*(1-tu)+q[1]*tu)*(1-tv)+(q[2]*(1-tu)+q[3]*tu)*tv};
   const pt=(u,y,l)=>{const o=dep(u,y);return o==null?null:at(u,y,o+l)};
   const stem=(p,q,w)=>{const d=q.clone().sub(p);
    for(const s of[d.clone().cross(n).setLength(w),n.clone().multiplyScalar(w)]){
     const A=p.clone().add(s),B=p.clone().sub(s),D=q.clone().add(s),E=q.clone().sub(s);tri(A,B,D,WOOD);tri(B,E,D,WOOD)}};
   const leaf=(p,u,y,ang)=>{
    const L=(.065+r()*r()*.075+r()*.02)*1.35,tip=pt(u+Math.cos(ang)*L,y+Math.sin(ang)*L-L*.15,.012+r()*.014);
    if(!tip)return;
    const d=tip.clone().sub(p),t=.35+r()*.25,s=d.clone().cross(n).setLength(L*(.2+r()*.12));
    const f=n.clone().multiplyScalar(L*(.12+r()*.14)); // central fold: margins lift off the stone
    const M=p.clone().lerp(tip,t).addScaledVector(n,.004),Lp=M.clone().add(s).add(f),Rp=M.clone().sub(s).add(f);
    const kr=r(),k=(kr<.08?OLD[r()*2|0]:kr<.56?YOUNG[r()*4|0]:LAUREL[r()*4|0]).clone().multiplyScalar(.75+r()*.5),k2=k.clone().multiplyScalar(.82);
    const kh=k.clone().multiplyScalar(1.12).lerp(YOUNG[3],.18),kL=s.y<0?kh:k2,kR=s.y<0?k2:kh;
    tri(p,M,Lp,kL);tri(M,tip,Lp,kL);tri(p,Rp,M,kR);tri(M,Rp,tip,kR);leaves++};
   const grow=(u,y,ang,len,lvl,w,prev)=>{
    const home=ang,ph=r()*6;let side=r()<.5?1:-1;
    prev=prev||pt(u,y,.006);if(!prev)return;
    for(let s=0;s<len;){
     const st=.05+r()*.04;s+=st;ang+=(r()-.5)*.8+(home-ang)*.08;
     u+=Math.cos(ang)*st;y+=Math.sin(ang)*st;
     if(u<a+.04||u>e-.04||y<yb+.02||y>yt-.02)break;
     const p=pt(u,y,.014);if(!p)break; // unsupported: stop rather than float
     stem(prev,p,w);prev=p;used=true;
     const patch=.5+.5*Math.sin(u*3.1+ph)*Math.cos(y*4.3+ph);
     if(r()<.25+.7*patch){leaf(p,u,y,ang+side*(.7+r()*.6));side=-side} // alternate leaves, patchy
     if(lvl<2&&r()<.13)grow(u,y,ang+(r()<.5?1:-1)*(.5+r()*.6),len*(.35+r()*.3),lvl+1,w*.7,p);
    }};
   const len=e-a,N=Math.max(1,Math.round(len/1.3));
   for(let k=0;k<N;k++){
    const u0=a+(k+.15+r()*.7)*len/N,spill=r()<.3,trails=2+(r()*3|0),gap=r()<.28;
    if(gap)continue; // bare stone
    let root=null;
    if(spill){ // rooted on the top, spilling over the rim
     root=pt(u0,yt-.04,.008);if(!root)continue;
     const rim=at(u0,yt+.03,.012),top=at(u0+(r()-.5)*.12,yt+.03,-.1-r()*.15);
     stem(top,rim,.006);stem(rim,root,.006);
    }
    clusters++;
    for(let t=0;t<trails;t++)
     grow(u0,spill?yt-.04:yb+.03,(spill?-1:1)*Math.PI/2+(r()-.5)*1.7,.5+r()*1.2,0,.010+r()*.007,root);
   }
  }
  if(used)covered++;
 }



 const triangles=P.length/9;
 if(triangles){
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(P,3));
  g.setAttribute('color',new T.Float32BufferAttribute(C,3));
  g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const mat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.82,metalness:0});
  mat.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader
   .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+(viewMatrix*vec4(0.,1.,0.,0.)).xyz*.35*smoothstep(0.,.02,vColor.g-vColor.r));')
   .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse*=1.+.7*smoothstep(0.,.02,vColor.g-vColor.r);')};
  const mesh=new T.Mesh(g,mat);mesh.name='cover-creepers-foliage';
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.raycast=()=>{};
  mesh.userData.cosmeticOnly=true;group.add(mesh);
 }
 group.userData={walls:covered,clusters,leaves,draws:group.children.length,triangles};
 return group;
}
