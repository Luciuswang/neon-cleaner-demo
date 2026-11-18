import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {HOUSE,floorHeight,underRoof,doorBounds,bodyOverlaps,swingOccupied,createDoorState,localPoint} from './house-logic.js';

// Cosmetic only: three instanced/batched draws, independent of timber UVs and
// movement bounds. Mineral pitting and wet roughness are authored locally.
export function buildBlackTileRoof(T,parent){
 const group=new T.Group();group.name='cabin-black-slate-tile-roof';parent.add(group);
 let seed=0x246ca81;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const size=64,rough=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),heights=new Float32Array(size*size);
 for(let i=0;i<heights.length;i++)heights[i]=random();
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,k=i*4,h=heights[i],r=Math.round(164+h*65+Math.sin(x*.65+y*.13)*9);
  rough.set([r,r,r,255],k);
  const dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size];
  const dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
  const length=Math.hypot(dx*.32,dy*.32,1);
  normal.set([Math.round(127.5-dx*.32/length*127.5),Math.round(127.5-dy*.32/length*127.5),Math.round(127.5+127.5/length),255],k);
 }
 const texture=data=>{const t=new T.DataTexture(data,size,size);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=t.minFilter=T.LinearFilter;t.needsUpdate=true;return t};
 const tileMat=new T.MeshStandardMaterial({color:0x343c42,metalness:.035,roughness:.62,roughnessMap:texture(rough),normalMap:texture(normal),normalScale:new T.Vector2(.3,.3),envMapIntensity:.42});
 const edgeMat=new T.MeshStandardMaterial({color:0x293238,metalness:.06,roughness:.52,envMapIntensity:.36});
 const rise=HOUSE.ridge-HOUSE.eave,slope=Math.atan2(rise,3.2),tiles=[],caps=[],edgeGeos=[],dummy=new T.Object3D();
 function edge(w,h,d,x,y,z,rx=0){
  const g=new T.BoxGeometry(w,h,d);g.rotateX(rx);g.translate(x,y,z);edgeGeos.push(g);
 }
 // Tile courses run across, not uninterrupted down the slope like metal ribs.
 function panel(width,length,cx,cy,cz,angle){
  const cols=Math.ceil(width/.32),rows=Math.ceil(length/.39),pitch=width/cols,step=length/rows;
  edge(width,.065,length,cx,cy-.018,cz,angle);
  for(let row=0;row<rows;row++){
   const shift=row%2?pitch*.5:0;
   for(let col=-1;col<cols;col++){
    const left=Math.max(-width/2,-width/2+col*pitch+shift),right=Math.min(width/2,-width/2+(col+1)*pitch+shift);
    if(right-left<.01)continue;
    const z=-length/2+(row+.5)*step,layer=.052+(angle>0?rows-row:row+1)*.002;
    tiles.push({x:cx+(left+right)/2,y:cy-z*Math.sin(angle)+layer*Math.cos(angle),z:cz+z*Math.cos(angle)+layer*Math.sin(angle),angle,w:(right-left-.009)/.32,l:(step+.065)/.46});
   }
  }
  const ez=Math.sign(angle)*length/2,ey=.01;
  edge(width+.025,.09,.065,cx,cy-ez*Math.sin(angle)+ey,cz+ez*Math.cos(angle),angle);
  for(const side of [-1,1])edge(.075,.11,length+.04,cx+side*(width/2-.02),cy-.015,cz,angle);
 }
 const run=3.55,length=run/Math.cos(slope);
 for(const side of [-1,1]){
  // Reverse the rear panel's local downhill direction, keeping its old pitch.
  const a=side*slope,cz=-.8+side*run/2,cy=HOUSE.ridge-rise/3.2*run/2;
  panel(8.65,length,0,cy,cz,a);
 }
 panel(5.98,1.95,-1.05,3.94,3.30,.22);
 // Short overlapping saddle caps, with real joints along the ridge.
 const capCount=27;
 for(let i=0;i<capCount;i++)caps.push({x:-4.35+(i+.5)*8.7/capCount,y:HOUSE.ridge+.09,z:-.8});
 edge(5.98,.06,.12,-1.05,4.17,2.35,.22);
 const tileGeo=new T.BoxGeometry(.32,.038,.46,4,1,1),p=tileGeo.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i)/.16,z=(p.getZ(i)+.23)/.46;
  p.setY(i,p.getY(i)+.025*(1-x*x)+.009*z*z);
 }
 tileGeo.computeVertexNormals();
 const tileMesh=new T.InstancedMesh(tileGeo,tileMat,tiles.length);tileMesh.name='staggered-black-tile-courses';
 const tint=new T.Color();
 for(let i=0;i<tiles.length;i++){
  const t=tiles[i];dummy.position.set(t.x,t.y,t.z);dummy.rotation.set(t.angle,t.angle<0?Math.PI:0,0);dummy.scale.set(t.w,1,t.l);dummy.updateMatrix();tileMesh.setMatrixAt(i,dummy.matrix);
  tint.setRGB(1,1,1).multiplyScalar(.82+random()*.23);tileMesh.setColorAt(i,tint);
 }
 tileMesh.castShadow=tileMesh.receiveShadow=true;group.add(tileMesh);
 const capGeo=new T.CylinderGeometry(.125,.125,.37,8,1,true,0,Math.PI);capGeo.rotateZ(Math.PI/2);
 const capMesh=new T.InstancedMesh(capGeo,tileMat,caps.length);capMesh.name='jointed-black-ridge-caps';
 dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
 for(let i=0;i<caps.length;i++){const t=caps[i];dummy.position.set(t.x,t.y,t.z);dummy.updateMatrix();capMesh.setMatrixAt(i,dummy.matrix)}
 capMesh.castShadow=capMesh.receiveShadow=true;group.add(capMesh);
 const edges=new T.Mesh(mergeGeometries(edgeGeos,false),edgeMat);edges.name='black-roof-backing-and-verges';edges.castShadow=edges.receiveShadow=true;group.add(edges);edgeGeos.forEach(g=>g.dispose());
 return Object.freeze({style:'black/dark-slate overlapping tiles',tiles:tiles.length,ridgeCaps:caps.length,panels:3,drawCalls:3,drawCallScope:'per color pass; shadows/reflections additional',triangles:tiles.length*tileGeo.index.count/3+caps.length*capGeo.index.count/3+edges.geometry.index.count/3,metalness:tileMat.metalness,roughnessRange:[.62*155/255,.62*238/255],authoredNormal:true,collisionChanged:false});
}

// User-reference-led authored architecture; existing CC0 scanned wood/plaster.
// Only former MERCADO12 changes traversal/cover. Other17 proxies are untouched.
export function buildTimberHouse({T,world,materials,solids,colliders,cam,getInteractionState,authoring=false}){
 const root=new T.Group();root.name='MERCADO12-reference-timber-cabin';root.position.set(HOUSE.x,0,HOUSE.z);world.add(root);
 const staticRoot=new T.Group();staticRoot.name='StaticParts';root.add(staticRoot);
 const originalBody=solids?.[1],originalBounds=colliders?.[1];
 // The river wrapper reuses this exact semantic assembly without the old map.
 // Baseline collider identity is meaningful only to the original runtime path.
 if(!authoring&&(!originalBounds||Math.abs(originalBounds.min.x-8)>1e-5||Math.abs(originalBounds.max.z+14)>1e-5))throw Error('Timber target baseline identity mismatch');
 const wood=materials.wood.clone();wood.color.set(0xb99b79);wood.roughness=.78;wood.normalScale.set(.5,.5);wood.side=T.DoubleSide;
 const woodLight=wood.clone();woodLight.color.set(0xd0b293);
 const woodDark=wood.clone();woodDark.color.set(0x896b4e);
 const cream=materials.plaster.clone();cream.onBeforeCompile=()=>{};cream.color.set(0xd6d4c1);cream.roughness=.86;cream.side=T.DoubleSide;
 const trim=new T.MeshStandardMaterial({color:0xd6d5c1,roughness:.76,side:T.DoubleSide});
 const iron=new T.MeshStandardMaterial({color:0x28302d,metalness:.8,roughness:.43,side:T.DoubleSide});
 const glass=new T.MeshPhysicalMaterial({color:0x9eafac,roughness:.19,metalness:0,transparent:true,opacity:.20,depthWrite:false,side:T.DoubleSide,envMapIntensity:.3});
 const lampMat=new T.MeshStandardMaterial({color:0xffe1ac,emissive:0xffbd71,emissiveIntensity:2,roughness:.38,side:T.DoubleSide});
 for(const [name,m]of Object.entries({Timber:wood,TimberLight:woodLight,TimberDark:woodDark,FoundationPlaster:cream,WindowTrim:trim,IronHardware:iron,WindowGlass:glass,WarmLamp:lampMat}))m.name=name;
 let section='Foundation',partIndex=0;
 const assetState={mode:'procedural',validated:false};
 function label(o){o.name=section+'_part_'+String(++partIndex).padStart(4,'0');o.userData.houseSection=section;return o}
 const movement=[],windows=[];let logs=0,lapEnds=0;
 const V=(x,y,z)=>new T.Vector3(x,y,z);
 function box(w,h,d,m,x,y,z,parent=staticRoot,rx=0,ry=0,rz=0,bevel=false,grainAxis=null){
  const g=bevel?new RoundedBoxGeometry(w,h,d,1,Math.min(.016,h*.1,d*.1)):new T.BoxGeometry(w,h,d);
  const p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
  for(let i=0;i<u.count;i++){
   const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
   const px=p.getX(i)+x,py=p.getY(i)+y,pz=p.getZ(i)+z;
   // Scan grain runs along U. Opt in per horizontal timber, not per material:
   // the moving door and existing vertical fittings keep their original UVs.
   // End caps use both cross-section axes rather than collapsing their UVs.
   if(grainAxis==='x')u.setXY(i,(ax>.7?pz:px)/1.9,(ax>.7?py:ay>.7?pz:py)/1.9);
   else if(grainAxis==='z')u.setXY(i,(az>.7?px:pz)/1.9,(az>.7?py:ay>.7?px:py)/1.9);
   else if(ay>.7)u.setXY(i,(p.getX(i)+x)/1.9,(p.getZ(i)+z)/1.9);
   else u.setXY(i,(p.getY(i)+y)/1.9,(ax>.7?p.getZ(i)+z:p.getX(i)+x)/1.9);
  }
  const o=label(new T.Mesh(g,m));o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
 }
 function beam(a,b,r,m,parent=staticRoot){
  const delta=b.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),8);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),delta.clone().normalize()));
  const o=label(new T.Mesh(g,m));o.position.copy(a).add(b).multiplyScalar(.5);o.castShadow=o.receiveShadow=true;parent.add(o);return o;
 }
 function blocker(w,h,d,x,y,z){
  movement.push({min:{x:HOUSE.x+x-w/2,y:y-h/2,z:HOUSE.z+z-d/2},max:{x:HOUSE.x+x+w/2,y:y+h/2,z:HOUSE.z+z+d/2}});
 }
 const fy=HOUSE.floor,top=HOUSE.eave;
 // Raised pale masonry plinth, separate open timber veranda and four treads.
 box(8,.64,6.4,cream,0,.32,-.8);blocker(8,.64,6.4,0,.32,-.8);
 // Keep plinth cap below the .66m board tops; coplanar caps flicker in SSAO.
 box(8.12,.10,6.52,trim,0,.55,-.8);
 for(let i=0;i<36;i++)box(.215,.09,6.08,i%5===0?woodDark:wood,-3.77+i*.215,fy-.045,-.8);
 box(5.62,.14,1.62,woodDark,-1.04,fy-.07,3.21);blocker(5.62,.14,1.62,-1.04,fy-.07,3.21);
 for(let i=0;i<26;i++)box(.207,.045,1.6,i%4?wood:woodLight,-3.74+i*.214,fy+.01,3.21);
 for(const x of [-3.72,-.9,1.65]){
  box(.15,.65,.15,woodDark,x,.325,3.88);
  beam(V(x-.45,.08,3.15),V(x+.38,.58,3.86),.045,wood);
  beam(V(x+.38,.08,3.15),V(x-.45,.58,3.86),.045,wood);
 }
 for(let i=1;i<=4;i++)box(1.54,.165*i,.40,wood,-1.08,.165*i/2,5.8-i*.4);
 for(const x of [-1.91,-.25]){
  beam(V(x,1.00,5.6),V(x,1.60,4.0),.036,woodLight);
  for(const z of [4.05,4.8,5.5]){const y=floorHeight(x+HOUSE.x,Math.min(5.59,z)+HOUSE.z);box(.07,.95,.07,woodDark,x,y+.46,z)}
  // Bound the sloped rail in short sections, leaving the centre stair clear.
  for(let i=0;i<8;i++){const z=4.1+i*.2,y=1.60-(z-4)*.375;blocker(.07,.98,.20,x,y-.45,z)}
 }
 function rail(x1,z1,x2,z2){
  const a=V(x1,fy+1.0,z1),b=V(x2,fy+1.0,z2),length=a.distanceTo(b);
  beam(a,b,.043,woodLight);beam(V(x1,fy+.14,z1),V(x2,fy+.14,z2),.027,wood);
  const steps=Math.ceil(length/.25);
  for(let i=0;i<=steps;i++){const t=i/steps,x=x1+(x2-x1)*t,z=z1+(z2-z1)*t;box(.045,.83,.045,wood,x,fy+.56,z)}
  blocker(Math.abs(x2-x1)+.07,1.04,Math.abs(z2-z1)+.07,(x1+x2)/2,fy+.52,(z1+z2)/2);
 }
 rail(-3.8,3.96,-1.9,3.96);rail(-.25,3.96,1.72,3.96);
 rail(-3.8,2.4,-3.8,3.96);rail(1.72,2.4,1.72,3.96);
 for(const x of [-3.8,1.72]){
  box(.13,3.17,.13,woodDark,x,fy+1.55,3.96);
  beam(V(x,3.0,3.96),V(x,3.7,3.23),.055,wood);
 }
 section='Walls';
 // Actual holes in individual square-hewn courses, not texture rectangles.
 const frontHoles=[
  {x:-2.94,w:1.12,y:2.85,h:1.64},{x:.64,w:1.16,y:2.85,h:1.64},{x:2.55,w:1.16,y:2.85,h:1.64},
  {x:HOUSE.doorX,w:HOUSE.doorWidth,y:fy+HOUSE.doorHeight/2,h:HOUSE.doorHeight}
 ];
 function courses(width,plane,side,holes,start=-width/2,end=width/2,maxY=top){
  const rows=Math.ceil((maxY-fy)/.19);
  for(let row=0;row<rows;row++){
   const lo=fy+row*.19,hi=Math.min(maxY,lo+.19),y=(lo+hi)/2;
   let spans=[[start,end]];
   for(const h of holes)if(hi>h.y-h.h/2&&lo<h.y+h.h/2){
    const next=[];for(const [a,b]of spans){const l=h.x-h.w/2,r=h.x+h.w/2;if(r<=a||l>=b)next.push([a,b]);else{if(l>a)next.push([a,l]);if(r<b)next.push([r,b])}}spans=next;
   }
   for(const [a,b]of spans)if(b-a>.005){const m=row%7===0?woodLight:row%5===0?woodDark:wood;
    if(side)box(.22,hi-lo-.009,b-a,m,plane,y,(a+b)/2,staticRoot,0,0,0,true,'z');
    else box(b-a,hi-lo-.009,.22,m,(a+b)/2,y,plane,staticRoot,0,0,0,true,'x');
    // Recessed timber backing closes the daylight slit without filling any
    // authored window/door opening or flattening the visible hewn courses.
    if(side)box(.09,hi-lo+.003,b-a,woodDark,plane,y,(a+b)/2,staticRoot,0,0,0,false,'z');
    else box(b-a,hi-lo+.003,.09,woodDark,(a+b)/2,y,plane,staticRoot,0,0,0,false,'x');
    logs++;
   }
   // Alternating exposed half-lap ends make the assembly legible at corners.
   if(!side&&!holes.some(h=>y>h.y-h.h/2&&y<h.y+h.h/2&&Math.abs(h.x)>width/2-.3)){
    for(const s of [-1,1]){
     if(side)box(.24,.14,.24,woodLight,plane,y,s*width/2+(plane>0?.02:-.02),staticRoot,0,0,0,false,'z');
     else box(.24,.14,.24,woodLight,s*width/2,y,plane,staticRoot,0,0,0,false,'x');
     lapEnds++;
    }
   }
  }
 }
 courses(8,2.4,false,frontHoles);courses(8,-4,false,[{x:0,w:1.35,y:2.85,h:1.64}]);
 for(const side of [-1,1]){
  const holes=[{x:-2.5,w:1.28,y:2.85,h:1.64},{x:.75,w:1.28,y:2.85,h:1.64}];
  // Side wall span is shifted -.8 along Z.
  courses(6.4,side*4,true,holes,-4,2.4);
  for(let y=top+.095;y<HOUSE.ridge-.05;y+=.19){
   const half=(HOUSE.ridge-y)/(HOUSE.ridge-top)*3.2;
   box(.22,.18,half*2,wood,side*4,y,-.8,staticRoot,0,0,0,true,'z');logs++;
   box(.09,.194,half*2,woodDark,side*4,y,-.8,staticRoot,0,0,0,false,'z');
  }
  // Structural corner laps are at actual front/back, not at a symmetric origin.
  for(let y=fy+.095;y<top;y+=.38)for(const z of [-4,2.4])box(.28,.16,.34,woodDark,side*4,y,z,staticRoot,0,0,0,false,'z');
 }
 // Continuous wall movement bounds include closed glazing. Door is separate.
 blocker(8,top-fy,.22,0,(top+fy)/2,-4);
 for(const x of [-4,4])blocker(.22,top-fy,6.4,x,(top+fy)/2,-.8);
 const left=HOUSE.doorX-HOUSE.doorWidth/2,right=HOUSE.doorX+HOUSE.doorWidth/2;
 blocker(left+4,top-fy,.22,(-4+left)/2,(top+fy)/2,2.4);
 blocker(4-right,top-fy,.22,(4+right)/2,(top+fy)/2,2.4);
 blocker(HOUSE.doorWidth,top-fy-HOUSE.doorHeight,.22,HOUSE.doorX,(top+fy+HOUSE.doorHeight)/2,2.4);
 section='Windows';
 // Windows: separate transparent panes, real interior visible from outdoors.
 function windowUnit(x,z,width,rot=0,y=2.85,height=1.64){
  const g=label(new T.Group());g.position.set(x,y,z);g.rotation.y=rot;staticRoot.add(g);windows.push(g);
  box(width-.07,height-.07,.025,glass,0,0,0,g);
  for(const s of [-1,1]){
   box(.085,height+.16,.18,trim,s*(width/2+.025),0,.01,g);
   box(width+.19,.085,.18,trim,0,s*(height/2+.055),.01,g);
  }
  box(.055,height,.10,trim,0,0,.015,g);
  box(width,.05,.10,trim,0,-.20,.015,g);
  box(width+.28,.11,.27,woodLight,0,-height/2-.10,.045,g);
  box(width+.28,.095,.23,woodDark,0,height/2+.13,.025,g);
 }
 for(const h of frontHoles.filter(h=>h.h<2))windowUnit(h.x,2.425,h.w);
 windowUnit(0,-4.025,1.35,Math.PI);
 for(const side of [-1,1])for(const z of [-2.5,.75])windowUnit(side*4.025,z,1.28,side*Math.PI/2);
 section='GableDetails';
 // Tall gable vent and diagonal timber rafters follow the reference end wall.
 for(const side of [-1,1]){
  box(.035,.86,.38,iron,side*4.13,5.27,-.8);
  for(let i=0;i<9;i++)box(.08,.035,.40,woodLight,side*4.16,4.9+i*.085,-.8);
  beam(V(side*4.16,4.72,-4.08),V(side*4.16,6.92,-.8),.055,woodLight);
  beam(V(side*4.16,6.92,-.8),V(side*4.16,4.72,2.48),.055,woodLight);
 }
 const roofDetail=buildBlackTileRoof(T,root);
 // Retain the original porch rafters and every movement/door bound.
 for(const x of [-3.8,-1.1,1.72])beam(V(x,3.98,2.35),V(x,3.61,4.12),.055,woodDark);
 section='Door';
 // Wooden hinged leaf, lockset, panel framing and three metal strap hinges.
 const pivot=new T.Group();pivot.name='DoorPivot';pivot.position.set(HOUSE.hingeX,fy,HOUSE.front);root.add(pivot);
 box(HOUSE.leafWidth,HOUSE.doorHeight,.13,woodLight,HOUSE.leafWidth/2,HOUSE.doorHeight/2,0,pivot,0,0,0,true);
 for(let i=1;i<8;i++)box(.009,HOUSE.doorHeight-.12,.006,woodDark,i*HOUSE.leafWidth/8,HOUSE.doorHeight/2,.071,pivot);
 for(const y of [.16,1.12,2.20])box(HOUSE.leafWidth-.11,.085,.025,woodDark,HOUSE.leafWidth/2,y,.086,pivot);
 for(const y of [.27,1.18,2.08]){
  box(.34,.055,.035,iron,.16,y,.095,pivot);
  box(.048,.12,.06,iron,.015,y,0,pivot);
 }
 const handlePlate=box(.035,.18,.035,iron,HOUSE.leafWidth-.15,1.13,.11,pivot);handlePlate.name='DoorHandlePlate';handlePlate.userData.cosmeticEditable=true;
 const handleGrip=box(.17,.035,.04,iron,HOUSE.leafWidth-.21,1.16,.14,pivot);handleGrip.name='DoorHandleGrip';handleGrip.userData.cosmeticEditable=true;
 for(const s of [-1,1])box(.095,HOUSE.doorHeight+.12,.27,trim,HOUSE.doorX+s*(HOUSE.doorWidth/2+.035),fy+HOUSE.doorHeight/2,2.4);
 box(HOUSE.doorWidth+.25,.11,.28,trim,HOUSE.doorX,fy+HOUSE.doorHeight+.09,2.4);
 box(HOUSE.doorWidth+.12,.055,.31,woodDark,HOUSE.doorX,fy+.015,2.4);
 section='Ceiling';
 // Real ceiling and warm practicals; interior is an authored unseen extension.
 box(7.8,.14,6.18,woodDark,0,4.57,-.8);
 blocker(7.8,.14,6.18,0,4.57,-.8);
 // Conservative underside of the porch roof/rafters, clear above normal head.
 blocker(5.98,.10,1.89,-1.05,3.63,3.30);
 for(const x of [-3.2,-1.6,0,1.6,3.2])box(.14,.23,6.1,wood,x,4.42,-.8);
 section='LightFixtures';
 for(const z of [-2.75,.5]){
  beam(V(0,4.50,z),V(0,3.82,z),.012,iron);
  const shade=label(new T.Mesh(new T.ConeGeometry(.25,.18,20,1,true),iron));shade.position.set(0,3.77,z);root.add(shade);
  const bulb=label(new T.Mesh(new T.SphereGeometry(.075,14,10),lampMat));bulb.position.set(0,3.69,z);root.add(bulb);
  const light=new T.PointLight(0xffce91,27,9,2);light.position.set(0,3.54,z);root.add(light);
 }
 for(const x of [-3.72,1.60]){
  box(.16,.26,.20,iron,x,2.98,2.60);
  box(.11,.18,.09,lampMat,x,2.97,2.74);
  const light=new T.PointLight(0xffc183,10,5,2);light.position.set(x,2.85,2.9);root.add(light);
 }
 section='Furniture';
 // Modest working cabin: desk, shelves, bed, stools; no new weapon pickups.
 box(2.15,.11,.74,woodLight,2.4,1.40,-2.9);blocker(2.15,.85,.74,2.4,1.05,-2.9);
 for(const x of [1.45,3.35])for(const z of [-3.14,-2.66])box(.08,.69,.08,woodDark,x,1.00,z);
 for(let k=0;k<4;k++)box(1.40,.09,.36,wood,-2.9,1.1+k*.6,-3.62);
 for(const x of [-3.55,-2.25])box(.08,2.05,.38,woodDark,x,1.78,-3.62);
 blocker(1.45,2.1,.42,-2.9,1.72,-3.62);
 const mattress=new T.MeshStandardMaterial({color:0x746f5d,roughness:1,side:T.DoubleSide});mattress.name='MattressFabric';
 box(1.15,.14,2.05,woodDark,2.95,.98,-.30);box(1.10,.16,2,mattress,2.95,1.12,-.30);
 box(1.05,.12,.39,trim,2.95,1.25,-1.02);blocker(1.15,.65,2.05,2.95,1.0,-.30);
 for(const [x,z]of [[.8,-2.1],[-2.9,.3]]){
  box(.48,.08,.48,woodLight,x,1.12,z);for(const s of [-1,1])for(const t of [-1,1])box(.055,.44,.055,woodDark,x+s*.17,.87,z+t*.17);
  blocker(.48,.53,.48,x,.92,z);
 }
 // Authoring returns the semantic assembly BEFORE the runtime material batches.
 // It never creates UI/listeners or mutates the world's collision list.
 if(authoring)return{root,pivot,movement,dimensions:HOUSE,logs,lapEnds,windows:windows.length,roof:roofDetail};
 // Batch static opaque surfaces; never flatten the moving door or real lights.
 root.updateWorldMatrix(true,true);const batches=new Map(),remove=[];
 staticRoot.traverse(o=>{if(!o.isMesh||o.material.transparent)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld).translate(-HOUSE.x,0,-HOUSE.z);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);remove.push(o)});
 for(const o of remove){o.removeFromParent();o.geometry.dispose()}
 for(const [m,gs]of batches){const parts=gs.map(g=>g.index?g.toNonIndexed():g),g=mergeGeometries(parts,false),o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;root.add(o);parts.forEach(g=>g.dispose());gs.forEach(g=>g.dispose())}
 root.updateWorldMatrix(true,true);
 // Bullet/LOS use this exact visible assembly, including the moving leaf.
 solids[1]=root;colliders.splice(1,1);
 const door=createDoorState(),ray=new T.Raycaster(),last={live:false,pres:false,player:null,near:false,visible:false};
 const prompt=document.createElement('div');prompt.id='housePrompt';prompt.hidden=true;
 prompt.style.cssText='position:fixed;bottom:125px;left:50%;transform:translateX(-50%);z-index:40;background:#172229e8;border:1px solid #bca58066;color:#eee0c5;padding:10px 17px;font:13px Microsoft YaHei,sans-serif;text-align:center';
 const button=document.createElement('button');button.id='bHouseDoor';button.className='btn';button.textContent='E · 开门';prompt.append(button);document.body.append(prompt);
 function canSeeDoor(){
  const anchor=V(HOUSE.x+HOUSE.doorX,fy+1.18,HOUSE.z+HOUSE.front),d=anchor.sub(cam.position),distance=d.length();
  if(distance>2.65||distance<.01)return false;
  d.normalize();const forward=cam.getWorldDirection(V(0,0,-1));if(forward.dot(d)<.43)return false;
  ray.set(cam.position,d);ray.far=distance-.17;
  // Door frame/wall must not enable a through-wall use from an adjacent face.
  const hit=ray.intersectObjects(solids,true)[0];
  return !hit||hit.distance>=distance-.22;
 }
 function request({repeat=false,focusedUI=false}={}){
  // Read live game state at the input event, never authorize from a cached frame.
  const current=getInteractionState(),anchor=V(HOUSE.x+HOUSE.doorX,fy+1.18,HOUSE.z+HOUSE.front);
  const near=cam.position.distanceTo(anchor)<2.65,visible=near&&canSeeDoor();
  const ok=door.toggle({near,visible,active:current.active,occupied:current.player&&swingOccupied(current.player),repeat,focusedUI});
  button.textContent=door.message|| (door.target?'E · 关门':'E · 开门');return ok;
 }
 for(const event of ['pointerdown','mousedown','click','keydown'])prompt.addEventListener(event,e=>e.stopPropagation());
 button.addEventListener('click',()=>request());
 addEventListener('keydown',e=>{
  if(e.code!=='KeyE')return;
  const el=e.target,focusedUI=!!el?.closest?.('input,textarea,select,button,[contenteditable="true"]');
  if(!focusedUI)e.preventDefault();request({repeat:e.repeat,focusedUI});
 });
 return{
  floorHeight,underRoof,
  ceilingY(p,previousY){
   let limit=Infinity;
   for(const b of movement)if(p.x>b.min.x-.4&&p.x<b.max.x+.4&&p.z>b.min.z-.4&&p.z<b.max.z+.4&&previousY+.15<=b.min.y+1e-6&&p.y+.15>=b.min.y)limit=Math.min(limit,b.min.y-.15-.001);
   return limit;
  },
  blocksMovement(p,actor='player'){
   const q=localPoint(p);
   if(actor==='enemy'&&q.x>HOUSE.stairLeft-.4&&q.x<HOUSE.stairRight+.4&&q.z>4&&q.z<6)return true;
   return movement.some(b=>bodyOverlaps(p,b))||bodyOverlaps(p,doorBounds(door.angle));
  },
  update(dt,{S,pres,live,player}){
   last.live=live;last.pres=pres;last.player=player;
   door.step(dt,player,live&&!pres);pivot.rotation.y=door.angle;root.updateWorldMatrix(true,true);
   const center=V(HOUSE.x+HOUSE.doorX,fy+1.18,HOUSE.z+HOUSE.front);
   last.near=cam.position.distanceTo(center)<2.65;last.visible=last.near&&canSeeDoor();
   prompt.hidden=!live||pres||!last.visible;
   button.textContent=door.message|| (door.info().moving?'门扇转动中…':door.angle>.7?'E · 关门':'E · 开门');
  },
  reset(){door.reset();pivot.rotation.y=0;root.updateWorldMatrix(true,true);prompt.hidden=true},
  info(){return{target:'former MERCADO12',reference:'user supplied timber cabin; structure only, no photo/watermark copied',footprint:[8,8],root:[12,0,-18],floor:fy,logs,lapEnds,windows:windows.length,realInterior:true,interiorLights:2,exteriorLights:2,remainingOriginalMovementProxies:colliders.length,raycastUsesVisibleAssembly:solids[1]===root,roof:{...roofDetail,roughnessRange:[...roofDetail.roughnessRange]},door:door.info(),near:last.near,visible:last.visible,asset:{...assetState}}},
  qa:{root,pivot,movement,originalBody,originalBounds,door,request,refresh(){root.updateWorldMatrix(true,true)},last,asset:assetState}
 };
}
