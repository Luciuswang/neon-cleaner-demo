// Authored game AI, not a real-world tactics/ballistics simulation.
// Local deterministic decisions; no renderer dependency or player-rule changes.
import {spawns,terrainHeight,navigationBounds as mapBounds} from './map-layout.js';
export const TACTICAL_SPAWNS=spawns;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const wrap=n=>Math.atan2(Math.sin(n),Math.cos(n));
const point=(x,z,y=0)=>({x,y,z});
export function segmentHitsBounds(a,b,box,padding=0){
 let lo=0,hi=1;
 for(const axis of ['x','z']){
  const delta=b[axis]-a[axis],min=box.min[axis]-padding,max=box.max[axis]+padding;
  if(Math.abs(delta)<1e-8){if(a[axis]<min||a[axis]>max)return false;continue}
  let s=(min-a[axis])/delta,t=(max-a[axis])/delta;
  if(s>t)[s,t]=[t,s];lo=Math.max(lo,s);hi=Math.min(hi,t);
  if(lo>hi)return false;
 }
 return hi>0&&lo<1;
}
export function enemyHitBounds(enemy){
 const t=enemy.tactical||{},height=1.80-.57*(t.stance||0),p=enemy.g.position;
 return{min:{x:p.x-.375,y:p.y,z:p.z-.375},max:{x:p.x+.375,y:p.y+height,z:p.z+.375}};
}
export function createNavigation(isBlocked,{step=.75,minX=-30.75,maxX=30.75,minZ=-33,maxZ=25}={}){
 const width=Math.floor((maxX-minX)/step)+1,height=Math.floor((maxZ-minZ)/step)+1;
 const count=width*height,blocked=new Uint8Array(count);
 const index=(x,z)=>z*width+x,position=i=>point(minX+(i%width)*step,minZ+Math.floor(i/width)*step);
 for(let i=0;i<count;i++)blocked[i]=isBlocked({...position(i),y:1.6})?1:0;
 const clear=(a,b)=>{
  // Exact swept actor footprint; point samples alone miss short corner cuts.
  for(const box of mapBounds)if(box.min.y<1.75&&box.max.y>.1&&segmentHitsBounds(a,b,box,.4))return false;
  const n=Math.max(1,Math.ceil(distance(a,b)/.20));
  for(let i=0;i<=n;i++)if(isBlocked({x:a.x+(b.x-a.x)*i/n,y:1.6,z:a.z+(b.z-a.z)*i/n}))return false;
  return true;
 };
 // Precompute exact swept clearance for the static graph, not just cell centers.
 const neighbors=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],edges=new Uint8Array(count);
 for(let i=0;i<count;i++)if(!blocked[i]){
  const x=i%width,z=Math.floor(i/width);
  neighbors.forEach(([dx,dz],k)=>{const nx=x+dx,nz=z+dz;if(nx<0||nx>=width||nz<0||nz>=height)return;const j=index(nx,nz);if(!blocked[j]&&clear(position(i),position(j)))edges[i]|=1<<k});
 }
 function nearest(p){
  const cx=clamp(Math.round((p.x-minX)/step),0,width-1),cz=clamp(Math.round((p.z-minZ)/step),0,height-1);
  for(let r=0;r<5;r++)for(let z=Math.max(0,cz-r);z<=Math.min(height-1,cz+r);z++)for(let x=Math.max(0,cx-r);x<=Math.min(width-1,cx+r);x++){
   const i=index(x,z);if(!blocked[i]&&clear(p,position(i)))return i;
  }
  return -1;
 }
 function path(start,end){
  if(clear(start,end))return[point(end.x,end.z)];
  const from=nearest(start),to=nearest(end);if(from<0||to<0)return[];
  const scores=new Float32Array(count).fill(Infinity),parents=new Int32Array(count).fill(-1),closed=new Uint8Array(count),heap=[];
  scores[from]=0;const target=position(to);
  function push(i,f){heap.push({i,f});let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p].f<=f)break;heap[k]=heap[p];k=p}heap[k]={i,f}}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let j=k*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[j].f>=last.f)break;heap[k]=heap[j];k=j}heap[k]=last}return first.i}
  push(from,distance(position(from),target));
  let visits=0,found=false;
  while(heap.length&&visits++<count){
   const i=pop();if(closed[i])continue;if(i===to){found=true;break}closed[i]=1;
   const x=i%width,z=Math.floor(i/width);
   for(const [k,[dx,dz]]of neighbors.entries()){
    if(!(edges[i]&(1<<k)))continue;
    const nx=x+dx,nz=z+dz;if(nx<0||nx>=width||nz<0||nz>=height)continue;
    const j=index(nx,nz);if(blocked[j]||closed[j])continue;
    if(dx&&dz&&(blocked[index(x+dx,z)]||blocked[index(x,z+dz)]))continue;
    const cost=scores[i]+step*(dx&&dz?Math.SQRT2:1);
    if(cost>=scores[j])continue;scores[j]=cost;parents[j]=i;push(j,cost+distance(position(j),target));
   }
  }
  if(!found)return[];
  const nodes=[point(end.x,end.z)];for(let i=to;i>=0;i=parents[i]){nodes.push(position(i));if(i===from)break}
  nodes.reverse();
  const result=[];let anchor=start;
  for(let i=0;i<nodes.length;){
   let last=i;while(last+1<nodes.length&&clear(anchor,nodes[last+1]))last++;
   if(!clear(anchor,nodes[last]))return[];
   result.push(nodes[last]);anchor=nodes[last];i=last+1;
  }
  return result;
 }
 return{path,clear,stats:{width,height,blocked:blocked.reduce((a,b)=>a+b,0),cells:count}};
}
export function coverPairs(bounds){
 const pairs=[];
 bounds.forEach((b,bi)=>{
  if(b.max.y<.75||b.min.y>.4)return;
  const cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,hx=(b.max.x-b.min.x)/2,hz=(b.max.z-b.min.z)/2;
  if(hx>7||hz>7||Math.min(hx,hz)<.12||Math.max(hx,hz)<.5)return;
  for(const [nx,nz]of [[1,0],[-1,0],[0,1],[0,-1]])for(const sign of [-1,1]){
   const tx=-nz,tz=nx,hn=nx?hx:hz,ht=nx?hz:hx;
   const hide=point(cx+nx*(hn+.64)+tx*sign*Math.max(0,ht-.43),cz+nz*(hn+.64)+tz*sign*Math.max(0,ht-.43));
   const peek=point(cx+nx*(hn+.70)+tx*sign*(ht+.91),cz+nz*(hn+.70)+tz*sign*(ht+.91));
   pairs.push({id:`${bi}:${nx}:${nz}:${sign}`,box:b,hide,peek,low:b.max.y<1.65});
  }
 });
 return pairs;
}
export function createTacticalAI({enemies,bounds,isBlocked,canSee,onShoot,floorHeight=terrainHeight}){
 let seed=0x71ac57,elapsed=0,totalShots=0,totalMoves=0,decisions=0,lastNoise=null;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const nav=createNavigation(isBlocked),covers=coverPairs(bounds),reserved=new Map();
 const states=enemies.map((enemy,i)=>({
  enemy,i,indoor:false,mode:'hide',timer:.6+i*.31,think:i*.13,
  path:[],cover:null,goal:null,stance:1,wait:0,shots:0,bursts:0,moves:0,
  stuck:0,progress:Infinity,shotDelay:0,burstLeft:0,relocate:0,hit:0,
  preferred:point(TACTICAL_SPAWNS[i][0],TACTICAL_SPAWNS[i][2],TACTICAL_SPAWNS[i][1])
 }));
 const eye=(p,h=1.45)=>({x:p.x,y:(p.y||0)+h,z:p.z});
 const yawTo=(e,p)=>Math.atan2(p.x-e.g.position.x,p.z-e.g.position.z)-Math.asin(clamp((e.wg2.position.x||0)/Math.max(.6,distance(e.g.position,p)),-.8,.8));
 const indoorCover={id:'cabin-door',hide:point(12.25,-17.5,.66),peek:point(10.92,-16.85,.66),low:false};
 const publicState=s=>({id:s.i,role:s.indoor?'cabin defender':s.i%2?'corner rifleman':'cover rifleman',mode:s.mode,cover:s.cover?.id||null,shots:s.shots,bursts:s.bursts,moves:s.moves,stance:s.stance,pathPoints:s.path.length});
 function valid(p){return p.x>-30&&p.x<30&&p.z>-32&&p.z<24&&!isBlocked({...p,y:1.6})}
 function reserve(s,c){if(s.cover)reserved.delete(s.cover.id);s.cover=c;if(c)reserved.set(c.id,s.i)}
 function choose(s,player,force=false){
  decisions++;
  if(s.indoor){reserve(s,indoorCover);return true}
  const p=s.enemy.g.position;
  const candidates=covers.filter(c=>{
   if(reserved.has(c.id)&&reserved.get(c.id)!==s.i)return false;
   if(force&&c.id===s.cover?.id)return false;
   if(!valid(c.hide)||!valid(c.peek)||distance(c.peek,player)<4||distance(c.peek,player)>32)return false;
   if(states.some(o=>o!==s&&o.cover&&distance(o.cover.hide,c.hide)<2.3))return false;
   return segmentHitsBounds(eye(c.hide,1.0),player,c.box,.08);
  }).map(c=>({c,score:distance(p,c.hide)+distance(s.preferred,c.hide)*.18+(force?random()*4:0)+Math.abs(distance(c.peek,player)-15)*.2}))
   .sort((a,b)=>a.score-b.score);
  for(const {c}of candidates.slice(0,10)){
   // Broad-phase screening precedes expensive actual geometry rays.
   if(canSee(eye(c.hide,c.low?1.04:1.38),player))continue;
   if(!canSee(eye(c.peek,1.42),player))continue;
   const path=nav.path(p,c.hide);if(!path.length&&distance(p,c.hide)>.25)continue;
   reserve(s,c);s.path=path;s.goal=c.hide;s.mode='advance';s.timer=6;s.stuck=0;s.progress=Infinity;return true;
  }
  return false;
 }
 function route(s,to,mode){
  if(s.indoor){
   // Two authored indoor stations remain on the actual free floor. No NPC
   // teleports through/opens the door or navigates outside its supported room.
   s.path=[point(to.x,to.z,.66)];
  }else s.path=nav.path(s.enemy.g.position,to);
  s.goal=to;s.mode=mode;s.stuck=0;s.progress=Infinity;s.timer=6;
  return !!s.path.length||distance(s.enemy.g.position,to)<.2;
 }
 function move(s,dt){
  const p=s.enemy.g.position,oldX=p.x,oldZ=p.z;
  if(!s.path.length)return{speed:0,angle:0};
  const goal=s.path[0],dx=goal.x-p.x,dz=goal.z-p.z,d=Math.hypot(dx,dz),speed=s.mode==='advance'?2.25:1.48;
  if(d<.12){s.path.shift();return{speed:0,angle:0}}
  const n=Math.min(d,speed*dt),next={x:p.x+dx/d*n,y:floorHeight(p.x+dx/d*n,p.z+dz/d*n)+1.6,z:p.z+dz/d*n};
  if(!isBlocked(next)&&nav.clear(p,next)){p.x=next.x;p.z=next.z}
  else{
   if(!isBlocked({...next,z:p.z})&&nav.clear(p,{...next,z:p.z}))p.x=next.x;
   if(!isBlocked({...next,x:p.x})&&nav.clear(p,{...next,x:p.x}))p.z=next.z;
  }
  p.y=floorHeight(p.x,p.z);
  const moved=Math.hypot(p.x-oldX,p.z-oldZ);s.moves+=moved;totalMoves+=moved;
  s.stuck=moved<.002?s.stuck+dt:0;
  if(s.stuck>1.1){s.path=[];s.wait=0;s.mode='hide';s.think=0}
  return{speed:moved/Math.max(.001,dt),angle:Math.atan2(p.x-oldX,p.z-oldZ)-s.enemy.g.rotation.y};
 }
 function transition(s,mode,seconds){s.mode=mode;s.timer=seconds}
 function reset(){
  elapsed=totalShots=totalMoves=decisions=0;seed=0x71ac57;lastNoise=null;reserved.clear();
  for(const s of states){
   const e=s.enemy,p=TACTICAL_SPAWNS[s.i];e.g.position.set?.(...p);
   if(!e.g.position.set)Object.assign(e.g.position,{x:p[0],y:p[1],z:p[2]});
   e.g.rotation.y=yawTo(e,{x:0,z:12});
   e.wg2.position.y=.91;
   e.wg2.rotation.x=-Math.atan2(1.7-p[1]-.91,Math.max(.6,Math.hypot(p[0],12-p[2])));
   Object.assign(s,{mode:s.indoor?'guard':'hide',timer:.6+s.i*.31,think:s.i*.13,path:[],cover:null,goal:null,stance:1,shots:0,bursts:0,moves:0,stuck:0,shotDelay:0,burstLeft:0,relocate:0,hit:0});
   e.tactical={mode:s.mode,stance:1,lean:0,speed:0,moveAngle:0,aimPitch:0,recoil:0,alert:0,hurt:0};
  }
 }
 reset();
 return{
  reset,playerShot(p){lastNoise={...p,time:elapsed}},
  hit(enemy){const s=states.find(s=>s.enemy===enemy);if(s){s.hit=.45;s.timer=Math.min(s.timer,.15)}},
  update(dt,{live,player}){
   if(!live||dt<=0)return;
   dt=Math.min(dt,.05);elapsed+=dt;
   for(const s of states){
    const e=s.enemy,t=e.tactical;
    if(!e.alive){if(s.cover)reserve(s,null);t.speed=0;t.recoil=0;t.mode='dead';continue}
    let shotRequested=false;
    s.timer-=dt;s.think-=dt;s.shotDelay-=dt;s.hit=Math.max(0,s.hit-dt);
    t.recoil*=Math.exp(-dt*19);t.hurt=s.hit;
    const dist=distance(e.g.position,player);
    if(!s.cover&&s.think<=0){choose(s,player);s.think=1.2+s.i*.11}
    if(s.cover&&s.think<=0){
     s.think=1.0+s.i*.09;
     const hideSight=canSee(eye(s.cover.hide,s.cover.low?1.04:1.38),player);
     if(!s.indoor&&(hideSight||dist<4.5||s.relocate>2)){
      if(choose(s,player,true))s.relocate=0;
     }
    }
    const moving=move(s,dt);
    if((s.mode==='advance'||s.mode==='retreat')&&!s.path.length){
     transition(s,'hide',1.25+random()*1.5+s.i*.09);
    }else if(s.mode==='peek'&&!s.path.length){
     transition(s,'aim',.30+random()*.28);s.burstLeft=2+Math.floor(random()*2);
    }
    if((s.mode==='hide'||s.mode==='guard')&&s.timer<=0&&s.cover){
     if(dist<33&&canSee(eye(s.cover.peek,1.42),player)){
      route(s,s.cover.peek,'peek');
     }else{
      s.timer=.9+random()*.9;
      if(!s.indoor&&elapsed>5&&s.think<=.3&&!choose(s,player,true))s.think=1.4;
     }
    }
    const facingError=wrap(yawTo(e,player)-e.g.rotation.y);
    if(s.mode==='aim'&&s.timer<=0&&Math.abs(facingError)<.10){transition(s,'burst',1.3);s.bursts++;s.shotDelay=0}
    if(s.mode==='burst'&&s.shotDelay<=0){
     if(s.burstLeft<=0||dist>34||s.hit>.18){
      if(s.cover)route(s,s.cover.hide,'retreat');else transition(s,'hide',1);
      s.relocate++;
     }else{
      // Actual shot approval is performed again from shoulder AND current
      // visible gun muzzle by onShoot; no effect or damage before approval.
      shotRequested=true;
      s.shotDelay=.21+random()*.11;s.burstLeft--;
     }
    }
    // Units without a valid cover choice still defend rather than walk at the
    // player through obstacles. An unobstructed close player can be engaged.
    if(!s.cover&&s.timer<=0&&dist<20){
     if(canSee(eye(e.g.position),player)){transition(s,'aim',.6+s.i*.1);s.burstLeft=2}
     else s.timer=1;
    }
    const targetStance=['hide','guard','retreat'].includes(s.mode)?1:s.mode==='advance'?.3:0;
    s.stance+=(targetStance-s.stance)*(1-Math.exp(-dt*7));
    const yaw=yawTo(e,player);
    e.g.rotation.y+=wrap(yaw-e.g.rotation.y)*(1-Math.exp(-dt*6));
    const muzzleY=1.43-.52*s.stance;
    e.wg2.position.y=muzzleY;e.wg2.rotation.x=-Math.atan2(player.y-((e.g.position.y||0)+muzzleY),Math.sqrt(Math.max(.36,dist*dist-(e.wg2.position.x||0)**2)));
    Object.assign(t,{mode:s.mode,stance:s.stance,lean:s.mode==='aim'||s.mode==='burst'?Math.sin(s.i*2.7)*.13:0,
     speed:moving.speed,moveAngle:wrap(moving.angle),aimPitch:e.wg2.rotation.x,
     alert:dist<33||!!lastNoise,indoor:s.indoor});
    // Sample the current frame's authoritative weapon transform, not the
    // previous stance/yaw. The renderer poses the cosmetic skin afterwards.
    if(shotRequested){
     if(onShoot(e,player)){t.recoil=1;s.shots++;totalShots++}
     else s.burstLeft=0;
    }
   }
  },
  info(){return{method:'authored cover-pair state machine + obstacle grid A*, not human simulation',elapsed,totalShots,totalMovementMeters:totalMoves,decisions,navigation:nav.stats,coverPairs:covers.length,actors:states.map(publicState)}},
  qa:{states,navigation:nav,covers}
 };
}
