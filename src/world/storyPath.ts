import * as THREE from 'three';
import type { City } from './city';

/** Plan a short NPC walk using the same collision checks as the player. No teleport fallback. */
export function storyPath(city: Pick<City, 'collide' | 'groundY'>, start: THREE.Vector3, goal: THREE.Vector3): THREE.Vector3[] {
  const at = (x: number, z: number) => new THREE.Vector3(x, city.groundY(x, z), z);
  const clear = (from: THREE.Vector3, to: THREE.Vector3) => {
    const distance = Math.hypot(to.x-from.x,to.z-from.z), count = Math.max(1, Math.ceil(distance/.35));
    let previous = from.clone();
    for (let i=1;i<=count;i++) {
      const next=at(THREE.MathUtils.lerp(from.x,to.x,i/count),THREE.MathUtils.lerp(from.z,to.z,i/count));
      const corrected=city.collide(previous,next.clone());
      if (Math.hypot(corrected.x-next.x,corrected.z-next.z)>.045) return false;
      previous=next;
    }
    return true;
  };
  if (clear(start,goal)) return [goal.clone()];
  const step=.8, reach=Math.hypot(goal.x-start.x,goal.z-start.z)+24;
  type Point={x:number;z:number;position:THREE.Vector3;cost:number;score:number;previous:Point|null};
  const key=(x:number,z:number)=>`${x}:${z}`;
  const first:Point={x:0,z:0,position:start.clone(),cost:0,score:start.distanceTo(goal),previous:null};
  const open=[first], best=new Map([[key(0,0),0]]), closed=new Set<string>();
  let found:Point|undefined;
  for(let visits=0;open.length&&visits<6500;visits++){
    let index=0;for(let i=1;i<open.length;i++)if(open[i].score<open[index].score)index=i;
    const point=open.splice(index,1)[0],id=key(point.x,point.z);
    if(closed.has(id))continue;closed.add(id);
    if(Math.hypot(point.position.x-goal.x,point.position.z-goal.z)<step*1.5&&clear(point.position,goal)){found=point;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=point.x+dx,z=point.z+dz,k=key(x,z);
      if(closed.has(k)||Math.hypot(x*step,z*step)>reach)continue;
      const cost=point.cost+Math.hypot(dx,dz)*step;
      if(cost>=(best.get(k)??Infinity))continue;
      const position=at(start.x+x*step,start.z+z*step);
      if(!clear(point.position,position))continue;
      best.set(k,cost);open.push({x,z,position,cost,score:cost+Math.hypot(position.x-goal.x,position.z-goal.z),previous:point});
    }
  }
  if(!found)return [];
  const reverse=[goal.clone()];for(let p:Point|null=found;p;p=p.previous)reverse.push(p.position);
  const route=reverse.reverse(), simplified:THREE.Vector3[]=[];
  for(let i=0;i<route.length-1;){let next=route.length-1;while(next>i+1&&!clear(route[i],route[next]))next--;simplified.push(route[next]);i=next;}
  return simplified;
}
