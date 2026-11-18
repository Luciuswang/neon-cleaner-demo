import {riverWidth} from './map-layout.js';

// Shared, world-space geographic moisture. Sinuous feathering follows the bank,
// not random wet pockets across the whole village. Units are metres.
export function soilMoisture(x,z,rain=0){
 const irregular=.55*Math.sin(z*.91+x*.21)+.26*Math.sin(z*2.8-x*.7)+.15*Math.sin(x*3+z*4);
 const distance=Math.abs(x)-riverWidth(z)+irregular;
 const t=Math.max(0,Math.min(1,(distance-.75)/4.05));
 const bank=1-t*t*(3-2*t);
 return bank+(1-bank)*Math.max(0,Math.min(1,rain))*.72;
}

export const SOIL_MOISTURE_GLSL=`
 float soilMoisture(vec2 p,float rain){
  float width=3.4+.8*cos(p.y*.17)+.35*sin(p.y*.47);
  float irregular=.55*sin(p.y*.91+p.x*.21)+.26*sin(p.y*2.8-p.x*.7)+.15*sin(p.x*3.+p.y*4.);
  float distance=abs(p.x)-width+irregular;
  float t=clamp((distance-.75)/4.05,0.,1.);
  float bank=1.-t*t*(3.-2.*t);
  return bank+(1.-bank)*clamp(rain,0.,1.)*.72;
 }
`;
