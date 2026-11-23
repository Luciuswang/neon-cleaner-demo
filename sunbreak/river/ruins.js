import {fracturedSlab} from './fracture-geometry.js';
import {rubbleHeight} from './map-layout.js';
import {createMasonryMaterial,MASONRY_PALETTE} from './masonry-materials.js';

// Static collapsed masonry. Piles and every exposed fragment share exact walk
// support; a meter-cell index avoids scanning the whole debris field each frame.
export function buildRuins({T,world,materials,layout,solids}){
 const group=new T.Group();group.name='structurally-grounded-collapse';world.add(group);
 const face=createMasonryMaterial(T,materials.plaster,{color:0xb9b5aa});
 const edge=createMasonryMaterial(T,materials.brick,{role:'core',color:MASONRY_PALETTE.clay});
 const stone=createMasonryMaterial(T,materials.stone,{role:'aggregate',color:0x80796b});
 const buckets=[{p:[],n:[],uv:[],break:[]},{p:[],n:[],uv:[],break:[]}],supportTriangles=[],supportCells=new Map();let slabs=0,chips=0,seed=4107;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),euler=new T.Euler();
 function fragment(w,h,d,x,z,rx,ry,rz,kind=0,walkable=false){
  const g=fracturedSlab(T,w,h,d,++seed);rotation.setFromEuler(euler.set(rx,ry,rz,'YXZ'));matrix.makeRotationFromQuaternion(rotation);g.applyMatrix4(matrix);
  const p=g.attributes.position;let lift=-Infinity,lowLift=Infinity;
  for(let i=0;i<p.count;i++){const y=rubbleHeight(x+p.getX(i),z+p.getZ(i))-p.getY(i);lift=Math.max(lift,y);lowLift=Math.min(lowLift,y)}
  // Small shards are partially embedded in loose earth, not balanced across
  // the high side of a steep pile and visibly levitating above the low side.
  if(!walkable)lift=Math.min(lift,rubbleHeight(x,z)+.01,lowLift+.08);
  else lift=Math.min(lift-.10,lowLift+.23); // heavy slabs sink into granular debris
  g.translate(x,lift+.007,z);
  for(let i=0;i<p.count;i+=3){
   if(g.attributes.normal.getY(i)<=1e-6)continue;
   const a={x:p.getX(i),y:p.getY(i),z:p.getZ(i)},b={x:p.getX(i+1),y:p.getY(i+1),z:p.getZ(i+1)},c={x:p.getX(i+2),y:p.getY(i+2),z:p.getZ(i+2)};
   const denominator=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(denominator)<1e-10)continue;
   supportTriangles.push({a,b,c,denominator,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)});
  }
  for(const part of g.groups){const material=kind===1?1:part.materialIndex,b=buckets[material];for(let i=part.start;i<part.start+part.count;i++){
   b.p.push(p.getX(i),p.getY(i),p.getZ(i));b.n.push(g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i));b.uv.push(g.attributes.uv.getX(i),g.attributes.uv.getY(i));
   // Cap fans already have separate centre/rim vertices. Preserve every one;
   // encode missing coating and a thin broken perimeter as material data only.
   b.break.push(walkable?.12:.68,i%3===0?Math.min(w,h)*.36:0);
  }}
  g.dispose();slabs++;
 }
 for(const m of layout.rubbleMounds){
  const positions=m.vertices,indices=m.indices,uvs=[];
  for(let i=0;i<positions.length;i+=3)uvs.push(positions[i]/2,positions[i+2]/2);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  const pile=new T.Mesh(g,stone);pile.name=m.id;pile.castShadow=pile.receiveShadow=true;group.add(pile);solids.push(pile);
  seed=8317+Math.round((m.z+40)*93)+(m.x>0?87:0);
  // A wall segment collapsed onto its own granular debris, with secondary chips.
  fragment(.70+random()*.23,.58+random()*.20,.10,m.x+.22*Math.sin(m.phase),m.z+.21,Math.PI/2+.28,random()*2,.14,0,true);
  for(let i=0;i<8;i++){
   const a=random()*Math.PI*2,r=.25+random()*.75,size=.24+random()*.16;
   fragment(size,size*(.7+random()*.5),.13+random()*.10,m.x+Math.cos(a)*r,m.z+Math.sin(a)*r,Math.PI/2+(random()-.5)*.24,random()*6.28,.08,1);chips++;
  }
  for(let i=0;i<38;i++){
   const a=random()*Math.PI*2,r=Math.sqrt(random())*1.42,x=m.x+Math.cos(a)*r,z=m.z+Math.sin(a)*r;
   const size=.07+Math.pow(random(),2)*.32;
   fragment(size,size*(.5+random()),.025+size*.17,x,z,Math.PI/2+(random()-.5)*.4,random()*Math.PI*2,random()*.25,i%4===0?0:1);chips++;
  }
 }
 // Fall fans sit beside the surviving wall bases, leaving the central doors open.
 for(const h of layout.houses.filter(h=>h.ruin>0)){
  for(let i=0;i<45;i++){
   const side=i%2?1:-1,x=h.x+side*(1.65+random()*1.8),z=h.z+4.1+random()*.75;
   fragment(.05+random()*.15,.08+random()*.22,.025,x,z,Math.PI/2,random()*6.28,random()*.15,1);chips++;
  }
 }
 let triangles=0;
 for(const t of supportTriangles)for(let gx=Math.floor(t.minX);gx<=Math.floor(t.maxX);gx++)for(let gz=Math.floor(t.minZ);gz<=Math.floor(t.maxZ);gz++){
  const key=gx+','+gz;if(!supportCells.has(key))supportCells.set(key,[]);supportCells.get(key).push(t);
 }
 buckets.forEach((b,i)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));if(!i)g.setAttribute('masonryBreak',new T.Float32BufferAttribute(b.break,2));g.computeBoundingSphere();const mesh=new T.Mesh(g,i?edge:face);mesh.name=i?'broken-brick-edges':'fallen-plaster-faces';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);solids.push(mesh);triangles+=b.p.length/9});
 return {
  floorHeight(x,z){let height=-Infinity;for(const t of supportCells.get(Math.floor(x)+','+Math.floor(z))||[]){
   if(x<t.minX||x>t.maxX||z<t.minZ||z>t.maxZ)continue;
   const {a,b,c,denominator:d}=t,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;
   if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)height=Math.max(height,u*a.y+v*b.y+(1-u-v)*c.y);
  }return height},
  info:()=>({mounds:layout.rubbleMounds.length,slabs,chips,triangles,supportTriangles:supportTriangles.length,drawCalls:layout.rubbleMounds.length+2,mode:'static gravity-staged fracture, not dynamic destruction'})};
}
