// Original in-memory sky relighting. Source CC0 HDR remains byte-identical.
// Warp elevation about the horizon, not a sphere rotation that tilts the horizon.
export function lowerSkySun(image,sunPixel,degrees=26){
 const {width,height,data}=image,oldElevation=(.5-(Math.floor(sunPixel/width)+.5)/height)*Math.PI;
 const scale=Math.tan(degrees*Math.PI/180)/Math.tan(oldElevation);
 if(!(scale>0&&Number.isFinite(scale)))throw Error('Sky sun must be above the horizon');
 const output=new Float32Array(data.length);
 let peak=-1,newSun=0;
 for(let y=0;y<height;y++){
  const elevation=(.5-(y+.5)/height)*Math.PI;
  const sourceElevation=Math.atan(Math.tan(elevation)/scale);
  const sy=Math.max(0,Math.min(height-1,(.5-sourceElevation/Math.PI)*height-.5)),a=Math.floor(sy),b=Math.min(height-1,a+1),t=sy-a;
  for(let x=0;x<width;x++){
   const dst=(y*width+x)*4,aa=(a*width+x)*4,bb=(b*width+x)*4;
   for(let c=0;c<3;c++)output[dst+c]=(data[aa+c]*(1-t)+data[bb+c]*t)*[1.06,1,.91][c];
   output[dst+3]=1;
   const l=output[dst]*.2126+output[dst+1]*.7152+output[dst+2]*.0722;
   if(l>peak){peak=l;newSun=y*width+x}
  }
 }
 return{data:output,sunPixel:newSun,scale};
}

export const AFTERRAIN_LIGHT=Object.freeze({sun:6.2,ambient:.90,exposure:1.05,sky:.82,key:0xffdfb1,skyFill:0xb9cfe9,groundFill:0x737650});
