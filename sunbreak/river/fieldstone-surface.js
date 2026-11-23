// Original, periodic mineral bake. No images, private scans or per-frame work.
// One shared set for all six cover walls; never a painted masonry-joint atlas.
import {normalFromHeight} from './procedural-materials.js';
export const FIELDSTONE_SURFACE_REVISION='fieldstone-mineral-correlated-v3';
export const FIELDSTONE_SURFACE_SCALE={size:512,tileMetres:.72,heightMetres:.023};
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function field(size,cells,seed){
 const lattice=new Float32Array(cells*cells);let s=seed;
 for(let i=0;i<lattice.length;i++){s=(Math.imul(s,1664525)+1013904223)>>>0;lattice[i]=s/4294967296}
 const out=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x*cells/size,v=y*cells/size,ix=Math.floor(u),iy=Math.floor(v),fx=u-ix,fy=v-iy;
  const a=fx*fx*fx*(fx*(fx*6-15)+10),b=fy*fy*fy*(fy*(fy*6-15)+10);
  const at=(xx,yy)=>lattice[(yy%cells)*cells+xx%cells];
  out[y*size+x]=(at(ix,iy)*(1-a)+at(ix+1,iy)*a)*(1-b)+(at(ix,iy+1)*(1-a)+at(ix+1,iy+1)*a)*b;
 }
 return out;
}
export function bakeFieldstoneSurface(){
 const {size,tileMetres,heightMetres}=FIELDSTONE_SURFACE_SCALE;
 const broad=field(size,5,31391),fracture=field(size,17,7783),mineral=field(size,43,1379),grit=field(size,123,8543);
 const height=new Float32Array(size*size),albedo=new Uint8Array(size*size*4),orm=new Uint8Array(size*size*4);
 for(let i=0;i<height.length;i++){
  const crack=smooth(.65,.86,fracture[i])*smooth(.40,.72,mineral[i]);
  const plate=fracture[i],pits=smooth(.70,.91,mineral[i]);
  const quartz=smooth(.60,.79,mineral[i])*smooth(.32,.67,grit[i]);
  height[i]=clamp(.19+.32*plate+.15*broad[i]+.22*(mineral[i]-.5)+.13*(grit[i]-.5)-.07*crack-.045*pits);
  // Mineral variation, cracks and crevice AO share fields. No baked light direction.
  const tone=.46+.75*broad[i]+.22*plate+.20*(grit[i]-.5)-.14*crack-.11*pits;
  const warm=smooth(.35,.70,broad[i]),k=i*4;
  albedo[k]=Math.round(Math.min(255,(139+12*warm)*tone+quartz*22));
  albedo[k+1]=Math.round(Math.min(255,(138+6*warm)*tone+quartz*20));
  albedo[k+2]=Math.round(Math.min(255,(133-7*warm)*tone+quartz*14));albedo[k+3]=255;
  orm[k]=Math.round(255*(1-.25*crack-.10*pits));orm[k+1]=Math.round(255*(.78+.14*mineral[i]+.05*crack));orm[k+2]=0;orm[k+3]=255;
 }
 return{height,albedo,orm,normal:normalFromHeight(height,size,{tileMetres,heightMetres})};
}
export function installFieldstoneSurface(T,material){
 const bake=bakeFieldstoneSurface(),{size,tileMetres}=FIELDSTONE_SURFACE_SCALE;
 function texture(bytes,color=false){const t=new T.DataTexture(bytes,size,size,T.RGBAFormat);t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(1/tileMetres,1/tileMetres);t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t}
 // Only this material's private cloned textures are replaced, not shared sources.
 for(const key of ['map','normalMap','roughnessMap','aoMap'])material[key]?.dispose();
 material.map=texture(bake.albedo,true);material.normalMap=texture(bake.normal);material.roughnessMap=texture(bake.orm);material.aoMap=material.roughnessMap;
 material.normalScale.set(.95,.95);material.aoMapIntensity=.65;
 material.userData.fieldstone={revision:FIELDSTONE_SURFACE_REVISION,...FIELDSTONE_SURFACE_SCALE,bytes:size*size*4*3,perFrameBakes:0,source:'original procedural mineral fields, no external images'};
 return material.userData.fieldstone;
}
