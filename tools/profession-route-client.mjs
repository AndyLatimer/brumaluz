// Loaded only by the local review browser. Uses the game's collision and movement.
import * as THREE from 'three';
import {play,session} from '/src/game/state.ts';
import {holder,renderer,scene,camera,playerVel} from '/src/game/stage.ts';
import {switchGameMap} from '/src/game/cities.ts';
import {updatePlay} from '/src/game/movement.ts';
import {updateCamera} from '/src/game/camera.ts';
import {rebuildNow} from '/src/game/avatar.ts';
import {updateHud} from '/src/game/hud.ts';
let equipmentKey;

export async function place(data,position){
 renderer.setAnimationLoop(null);
 if(play.city.locationId!==data.location)await switchGameMap(data.location);
 Object.assign(session.state,data);holder.position.set(position.x,play.city.groundY(position.x,position.z),position.z);
 play.groundHeight=holder.position.y;play.running=true;play.dead=false;play.moveTarget=null;playerVel.set(0,0,0);
 const key=JSON.stringify(data.equipment);
 if(key!==equipmentKey){rebuildNow();equipmentKey=key;}
 updateHud();updateCamera(1);renderer.render(scene,camera);
}
export function route(target,radius=1.2){
 const city=play.city,start={x:holder.position.x,z:holder.position.z},size=1;
 const point=(x,z)=>new THREE.Vector3(x,city.groundY(x,z),z);
 const clear=(a,b)=>{
  let from=point(a.x,a.z);const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.25));
  for(let i=1;i<=n;i++){
   const to=point(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n);
   if(city.waterAt?.(to.x,to.z)?.deep)return false;
   const got=city.collide(from,to);if(Math.hypot(got.x-to.x,got.z-to.z)>.04)return false;
   from=to;
  }return true;
 };
 let path;
 if(clear(start,target))path=[target];
 else{
  const key=(x,z)=>`${x},${z}`,nodes=new Map(),open=[];
  const first={x:0,z:0,g:0,f:Math.hypot(target.x-start.x,target.z-start.z),prev:null};nodes.set(key(0,0),first);open.push(first);
  let last,steps=0;
  while(open.length&&steps++<60000){
   open.sort((a,b)=>b.f-a.f);const node=open.pop();if(node.closed)continue;node.closed=true;
   const p={x:start.x+node.x*size,z:start.z+node.z*size};
   if(Math.hypot(p.x-target.x,p.z-target.z)<=radius||Math.hypot(p.x-target.x,p.z-target.z)<8&&clear(p,target)){last=node;break;}
   for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const x=node.x+dx,z=node.z+dz,q={x:start.x+x*size,z:start.z+z*size},g=node.g+Math.hypot(dx,dz)*size,k=key(x,z),old=nodes.get(k);
    if(old&&(old.closed||old.g<=g)||!clear(p,q))continue;
    const next={x,z,g,f:g+Math.hypot(q.x-target.x,q.z-target.z),prev:node};nodes.set(k,next);open.push(next);
   }
  }
  if(!last)throw Error(`No collision-safe route to ${JSON.stringify(target)} from ${JSON.stringify(start)}`);
  path=[];for(let n=last;n?.prev;n=n.prev)path.unshift({x:start.x+n.x*size,z:start.z+n.z*size});
  if(clear(path.at(-1)??start,target))path.push(target);
  // Keep only straight segments already checked against the actual collision.
  const smooth=[];let from=start,i=0;while(i<path.length){let j=i;while(j+1<path.length&&clear(from,path[j+1]))j++;smooth.push(path[j]);from=path[j];i=j+1;}path=smooth;
 }
 const frames=[];let cursor=0,time=0,distance=0,previous=holder.position.clone();
 while(cursor<path.length&&time<1200){
  const goal=path[cursor];if(Math.hypot(holder.position.x-goal.x,holder.position.z-goal.z)<.3){cursor++;continue;}
  play.moveTarget=new THREE.Vector3(goal.x,0,goal.z);
  for(let i=0;i<10;i++){updatePlay(.05);time+=.05;distance+=holder.position.distanceTo(previous);previous.copy(holder.position);}
  frames.push({x:holder.position.x,z:holder.position.z,seconds:.5});
  if(!play.moveTarget&&Math.hypot(holder.position.x-goal.x,holder.position.z-goal.z)>.5)throw Error('Movement stopped at a collision');
 }
 play.moveTarget=null;playerVel.set(0,0,0);updateCamera(1);renderer.render(scene,camera);
 if(time>=1200)throw Error('Route simulation timed out');
 return{frames,distance,seconds:frames.length*.5,waypoints:path.length};
}
