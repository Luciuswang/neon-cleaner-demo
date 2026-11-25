export const TH=.8,TOP=1.5,DEEP=-.8;

export function perimeterBounds(map){
 const {minX,maxX,minZ,maxZ}=map,b=(id,x0,z0,x1,z1)=>({id,min:{x:x0,y:DEEP,z:z0},max:{x:x1,y:TOP,z:z1}});
 return[
  b('perimeter-north',minX-TH,minZ-TH,maxX+TH,minZ),
  b('perimeter-south',minX-TH,maxZ,maxX+TH,maxZ+TH),
  b('perimeter-west',minX-TH,minZ,minX,maxZ),
  b('perimeter-east',maxX,minZ,maxX+TH,maxZ)];
}
