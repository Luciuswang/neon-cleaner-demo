import {MAP,landscapeHeight} from './map-layout.js';
export function buildCoconutGrove(T,world,mobile=false){
let s=20261123;
const R=()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const SG=mobile?6:9,RN=mobile?10:16,NF=mobile?12:18,NS=mobile?9:13;
const tp=[],tn=[],tu=[],tc=[],ti=[],fp=[],fu=[],fc=[];
const add=(p,d,k)=>[p[0]+d[0]*k,p[1]+d[1]*k,p[2]+d[2]*k];
// lathe: rings ascend in y, angle increases => (p,p+ring,p+1) faces outward
const lathe=(n,f)=>{const b=tp.length/3;for(let i=0;i<n;i++){const[x,y,z,r,v,c,ny=0]=f(i/(n-1)),k=Math.sqrt(1-ny*ny);for(let j=0;j<=SG;j++){const a=j/SG*6.2832;tp.push(x+Math.cos(a)*r,y,z+Math.sin(a)*r);tn.push(Math.cos(a)*k,ny,Math.sin(a)*k);tu.push(j/SG*2,v);tc.push(c[0],c[1],c[2]);if(i<n-1&&j<SG){const p=b+i*(SG+1)+j;ti.push(p,p+SG+1,p+1,p+1,p+SG+1,p+SG+2);}}}};
const F3=(...a)=>{for(let i=0;i<a.length;i+=4){fp.push(...a[i]);fu.push(a[i+1],a[i+2]);fc.push(...a[i+3]);}};
const spots=[[12.4+R()*.6,MAP.maxZ+8.6+R(),10.6,3.9],[14.9+R()*.6,MAP.maxZ+11.2+R(),7.9,3],[13.3+R()*.6,MAP.maxZ+14+R(),6.3,2.3],[-12,MAP.minZ-8.8-R(),9.3,3.5],[-12,MAP.minZ-12.6-R(),6.8,2.6]];
for(const[px,pz,H,W]of spots){
const y0=landscapeHeight(px,pz)-.25,la=R()*6.283,L=H*(.12+.14*R()),dx=Math.cos(la),dz=Math.sin(la),R0=.17+H*.011;
lathe(RN,t=>{const k=L*(1-(1-t)*(1-t)),g=.82+.2*t;return[px+dx*k,y0+H*t,pz+dz*k,R0*(1-.5*t)*(1+.45*Math.exp(-t*9)),t*H*.9,[g,g,g]];});
const top=[px+dx*L,y0+H,pz+dz*L],fl=W*.62;
for(let i=0;i<(mobile?2:4);i++){const a=R()*6.283,cx=top[0]+Math.cos(a)*.21,cz=top[2]+Math.sin(a)*.21,cy=top[1]-.3-R()*.12,r=.12+R()*.03;
lathe(4,t=>{const ph=.15+t*2.84;return[cx,cy-Math.cos(ph)*r,cz,Math.sin(ph)*r,t*.3,[.75,.85,.5],-Math.cos(ph)];});}
for(let k=0;k<NF;k++){
const u=k/(NF-1),az0=k*2.39996+R()*.5,el=1.2-1.75*u+R()*.15,Lf=fl*(.8+.3*R()),ds=Lf/NS,dry=u>.8&&R()<.6,v=.8+.3*R(),ct=dry?[1.5*v,.9*v,.55*v]:[v,v,v],cm=ct.map(x=>x*.75),cb=ct.map(x=>x*.5);
let p=top;
for(let j=0;j<NS;j++){
const q=j/NS,q1=q+1/NS,az=az0+.3*q,pt=Math.max(-1.35,el-(1+u)*Math.pow(q,1.3)),F=[Math.cos(pt)*Math.cos(az),Math.sin(pt),Math.cos(pt)*Math.sin(az)],S=[-Math.sin(az),0,Math.cos(az)],n=add(p,F,ds),w=.02+.04*(1-q);
const a=add(p,S,-w),b=add(p,S,w),c=add(n,S,w),d=add(n,S,-w);
F3(a,.47,q,cm,b,.53,q,cm,c,.53,q1,cm,a,.47,q,cm,c,.53,q1,cm,d,.47,q1,cm);
const ll=Lf*.36*Math.sin(3.1416*(.1+.82*(j+1)/NS))*(.85+.3*R()),lw=(.035+ll*.09)*(mobile?1.4:1);
for(const sd of[-1,1]){
const D=[S[0]*sd*.8+F[0]*.45,-.3-.45*u+F[1]*.45,S[2]*sd*.8+F[2]*.45],m=add(n,D,ll*.45),e=add(n,D,ll),A=add(m,F,lw),B=add(m,F,-lw);
e[1]-=ll*.25;A[1]+=lw*.6;B[1]+=lw*.6; // V-fold: keel m low, edges raised
F3(n,.5,0,cb,A,0,.45,ct,m,.5,.45,cm,n,.5,0,cb,m,.5,.45,cm,B,1,.45,ct,A,0,.45,ct,e,.5,1,ct,m,.5,.45,cm,m,.5,.45,cm,e,.5,1,ct,B,1,.45,ct);
}
p=n;
}}}
// procedural textures (power-of-two, sRGB albedo)
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];};
const bark=bump=>{
s=977;const[c,x]=cv(128,256);
x.fillStyle=bump?'#8a8a8a':'#40362e';x.fillRect(0,0,128,256);
for(let i=0;i<520;i++){x.fillStyle=`rgba(${R()<.55?'14,11,9':bump?'235,235,235':'118,104,90'},${.1+R()*.25})`;const xx=R()*128|0,yy=R()*256,w=1+R()*1.5,h=8+R()*50;x.fillRect(xx,yy,w,h);x.fillRect(xx,yy-256,w,h);}
for(let i=0;i<8;i++){const y=i*32+R()*8;for(let xx=0;xx<128;xx+=4){x.fillStyle=`rgba(12,10,8,${.45+R()*.35})`;x.fillRect(xx,y+Math.sin(xx*.0982+i)*2+R()*2,4,2+R()*3);}}
for(let i=0;i<14;i++){x.fillStyle='rgba(10,8,6,.45)';x.beginPath();x.ellipse(8+R()*112,10+R()*236,2+R()*5,3+R()*9,R(),0,6.2832);x.fill();}
return c;};
const frond=()=>{
s=4421;const[c,x]=cv(64,256);
let g=x.createLinearGradient(0,256,0,0);g.addColorStop(0,'#34502a');g.addColorStop(.6,'#587238');g.addColorStop(1,'#6d7a40');
x.fillStyle=g;x.fillRect(0,0,64,256);
for(let i=0;i<90;i++){x.fillStyle=`rgba(${R()<.5?'20,40,16':'130,150,80'},${.08+R()*.14})`;x.fillRect(R()*64|0,R()*256,1,30+R()*120);}
g=x.createLinearGradient(0,0,64,0);g.addColorStop(0,'rgba(18,36,14,.55)');g.addColorStop(.4,'rgba(18,36,14,0)');g.addColorStop(.6,'rgba(18,36,14,0)');g.addColorStop(1,'rgba(18,36,14,.55)');
x.fillStyle=g;x.fillRect(0,0,64,256);
x.fillStyle='#93a05c';x.fillRect(30,0,4,256);
return c;};
const tex=(c,name,srgb,rep)=>{const t=new T.CanvasTexture(c);t.name=name;if(srgb)t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=rep?T.RepeatWrapping:T.ClampToEdgeWrapping;t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.anisotropy=mobile?2:4;return t;};
const barkMap=tex(bark(false),'coconut-bark-atlas',true,true),barkBump=tex(bark(true),'coconut-bark-bump',false,true),frondMap=tex(frond(),'coconut-frond-atlas',true,false);
const mk=(pos,uv,col,nor,idx)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('color',new T.Float32BufferAttribute(col,3));if(idx)g.setIndex(idx);if(nor)g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));else g.computeVertexNormals();return g;};
const group=new T.Group();group.name='palmGrove';
const tm=new T.Mesh(mk(tp,tu,tc,tn,ti),new T.MeshStandardMaterial({map:barkMap,bumpMap:barkBump,bumpScale:.8,vertexColors:true,roughness:.97,metalness:0,envMapIntensity:.15}));
tm.name='coconut-bark';
const fm=new T.Mesh(mk(fp,fu,fc),new T.MeshStandardMaterial({map:frondMap,vertexColors:true,roughness:.95,metalness:0,envMapIntensity:.2,side:T.DoubleSide}));
fm.name='coconut-fronds';
for(const m of[tm,fm]){m.castShadow=false;m.receiveShadow=true;m.raycast=()=>{};group.add(m);}
group.userData={barkMap:barkMap.name,frondMap:frondMap.name,palms:5,groups:2,draws:2,triangles:ti.length/3+fp.length/9,decorative:true,collision:false};
world.add(group);
return group;
}
