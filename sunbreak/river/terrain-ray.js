// Exact grid DDA: intersects the same rendered terrain triangles, not a proxy.
// The terrain is world-aligned, 180m square / 300 segments, no mesh transform.
export function installTerrainRaycast(T,mesh,size=180,segments=300){
 const half=size/2,step=size/segments,positions=mesh.geometry.attributes.position,indices=mesh.geometry.index;
 const xs=Array.from({length:segments+1},(_,i)=>positions.getX(i)),zs=Array.from({length:segments+1},(_,i)=>positions.getZ(i*(segments+1)));
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),hit=new T.Vector3();
 mesh.raycast=function(raycaster,hits){
  const ray=raycaster.ray,o=ray.origin,d=ray.direction;
  let lo=Math.max(0,raycaster.near),hi=Math.min(1000,raycaster.far);
  for(const axis of ['x','z']){
   if(Math.abs(d[axis])<1e-12){if(Math.abs(o[axis])>half)return;continue}
   let t0=(-half-o[axis])/d[axis],t1=(half-o[axis])/d[axis];if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);
  }
  if(hi<lo)return;
  let x=Math.max(0,Math.min(segments-1,Math.floor((o.x+d.x*(lo+1e-7)+half)/step)));
  let z=Math.max(0,Math.min(segments-1,Math.floor((o.z+d.z*(lo+1e-7)+half)/step)));
  // Grid vertices are Float32. Ideal double-precision cell boundaries are not
  // interchangeable near a shared edge, especially for vertical shots.
  const px=o.x+d.x*(lo+1e-7),pz=o.z+d.z*(lo+1e-7);
  while(x>0&&px<xs[x])x--;while(x<segments-1&&px>xs[x+1])x++;
  while(z>0&&pz<zs[z])z--;while(z<segments-1&&pz>zs[z+1])z++;
  const sx=Math.sign(d.x),sz=Math.sign(d.z);
  let tx=sx?(xs[x+(sx>0?1:0)]-o.x)/d.x:Infinity;
  let tz=sz?(zs[z+(sz>0?1:0)]-o.z)/d.z:Infinity;
  for(let n=0;n<segments*2+2&&x>=0&&x<segments&&z>=0&&z<segments;n++){
   const start=(z*segments+x)*6;let nearest=null,normal=null,faceIndex=0;
   for(let k=0;k<6;k+=3){
    a.fromBufferAttribute(positions,indices.getX(start+k));b.fromBufferAttribute(positions,indices.getX(start+k+1));c.fromBufferAttribute(positions,indices.getX(start+k+2));
    const back=mesh.material.side===T.BackSide,cull=mesh.material.side!==T.DoubleSide;
    if(ray.intersectTriangle(back?c:a,b,back?a:c,cull,hit)){
     const distance=hit.distanceTo(o);if(distance>=raycaster.near&&distance<=hi&&(!nearest||distance<nearest.distance)){nearest={distance,point:hit.clone(),object:mesh};normal=new T.Triangle(a,b,c).getNormal(new T.Vector3());faceIndex=(start+k)/3}
    }
   }
   if(nearest){hits.push({...nearest,face:{normal},faceIndex});return}
   if(Math.min(tx,tz)>hi)return;
   if(tx<tz){x+=sx;tx=sx?(xs[x+(sx>0?1:0)]-o.x)/d.x:Infinity}else{z+=sz;tz=sz?(zs[z+(sz>0?1:0)]-o.z)/d.z:Infinity}
  }
 };
}
