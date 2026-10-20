import * as THREE from 'three';
import { Character, loadKits } from '../character/character';
import { defaultChar, type ClassId } from '../data/data';
import { starterEquipment } from '../data/combat';
import { buildShadowEnemy, playShadowEnemyAction, resetShadowEnemy, updateShadowEnemy } from '../world/shadowEnemy';

export async function createCombatScene(canvas: HTMLCanvasElement, manual: () => void, select: () => void) {
  await loadKits();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfcdd0');
  scene.fog = new THREE.Fog('#bfcdd0',30,65);
  const camera = new THREE.PerspectiveCamera(40,1,.1,80);
  camera.position.set(3,8,12);camera.lookAt(0,.4,0);
  scene.add(new THREE.HemisphereLight('#fff4df','#7b8c78',2.5));
  const sun = new THREE.DirectionalLight('#ffe5bc',3);
  sun.position.set(-6,14,8);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-14;sun.shadow.camera.right=14;
  sun.shadow.camera.top=14;sun.shadow.camera.bottom=-14;
  scene.add(sun);
  const owned: {dispose():void}[] = [];
  function mesh(geometry: THREE.BufferGeometry, color: string, parent: THREE.Object3D=scene) {
    const material=new THREE.MeshStandardMaterial({color,roughness:.85});
    const object=new THREE.Mesh(geometry,material);
    object.castShadow=true;object.receiveShadow=true;parent.add(object);
    owned.push(geometry,material);return object;
  }
  const ground=mesh(new THREE.CylinderGeometry(14,14,.2,80),'#829a74');
  ground.position.y=-.1;
  const grid=new THREE.GridHelper(24,24,'#899f7c','#899f7c');
  grid.position.y=.008;scene.add(grid);
  owned.push(grid.geometry,...(Array.isArray(grid.material)?grid.material:[grid.material]));
  const enemy=buildShadowEnemy(5,0,0);scene.add(enemy);
  const ring=enemy.getObjectByName('combat-lock-ring') as THREE.Mesh;
  ring.visible=false;
  const player=new THREE.Group();scene.add(player);
  let actor: Character;
  let movement: THREE.Vector3 | null = null;
  let attackCount=0,deathTime=-1;
  const keys=new Set<string>();
  const projectiles: {mesh:THREE.Mesh;from:THREE.Vector3;to:THREE.Vector3;start:number;duration:number}[]=[];
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  function releaseEffect(effect: THREE.Mesh) {
    effect.removeFromParent();
    for(const resource of [effect.geometry,...(Array.isArray(effect.material)?effect.material:[effect.material])]){
      const index=owned.indexOf(resource);
      if(index>=0)owned.splice(index,1);
      resource.dispose();
    }
  }
  function resize(){
    renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);
    camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();
  }
  function reset(cls: ClassId) {
    actor?.dispose();
    actor=new Character({...defaultChar(),cls,equipment:starterEquipment(cls)},{outfit:false});
    actor.root.traverse(object=>{if(object instanceof THREE.Mesh)object.castShadow=true;});
    player.add(actor.root);player.position.set(-5,0,0);player.rotation.y=Math.PI/2;
    enemy.position.set(5,0,0);resetShadowEnemy(enemy,performance.now()/1000);
    deathTime=-1;movement=null;keys.clear();attackCount=0;
    for(const projectile of projectiles)releaseEffect(projectile.mesh);
    projectiles.length=0;
  }
  const keyDown=(event:KeyboardEvent)=>{
    if(event.target instanceof HTMLInputElement||event.target instanceof HTMLSelectElement)return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)){
      event.preventDefault();keys.add(event.code);movement=null;manual();
    }
  };
  const keyUp=(event:KeyboardEvent)=>keys.delete(event.code);
  const blur=()=>{keys.clear();movement=null;manual();};
  window.addEventListener('keydown',keyDown);
  window.addEventListener('keyup',keyUp);
  window.addEventListener('blur',blur);
  window.addEventListener('resize',resize);
  const click=(event:PointerEvent)=>{
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(pointer,camera);
    if(ray.intersectObject(enemy,true).length){select();return;}
    const point=ray.ray.intersectPlane(floorPlane,new THREE.Vector3());
    if(point&&point.length()<12){manual();movement=point;}
  };
  canvas.addEventListener('pointerdown',click);
  function approach(target: THREE.Vector3, dt: number, speed: number, stop: number) {
    const delta=target.clone().sub(player.position);delta.y=0;
    const distance=delta.length();
    if(distance<=stop)return false;
    player.rotation.y=Math.atan2(delta.x,delta.z);
    player.position.addScaledVector(delta.normalize(),Math.min(distance-stop,speed*dt));
    return true;
  }
  resize();
  return {
    reset,
    distance:()=>player.position.distanceTo(enemy.position),
    select(selected:boolean){ring.visible=selected;},
    moveAway(){
      movement=player.position.clone().add(player.position.clone().sub(enemy.position).normalize().multiplyScalar(3));
      movement.clampLength(0,12);
    },
    attack(cls:ClassId,skill:boolean,healing:boolean,time:number){
      attackCount++;actor.attack(skill);
      player.rotation.y=Math.atan2(enemy.position.x-player.position.x,enemy.position.z-player.position.z);
      if(!healing)playShadowEnemyAction(enemy,'hit',time);
      if(healing){
        const heal=mesh(new THREE.TorusGeometry(.7,.04,8,40),'#bce797',player);
        heal.rotation.x=Math.PI/2;heal.position.y=.8;
        projectiles.push({mesh:heal,from:player.position.clone(),to:player.position.clone(),start:time,duration:.5});
      }else if(cls==='mago'||cls==='clerigo'||cls==='explorador'){
        const projectile=mesh(cls==='explorador'?new THREE.CylinderGeometry(.025,.025,.45,8):new THREE.SphereGeometry(skill ? .16 : .10,16,12),
          cls==='explorador'?'#d5b98b':cls==='clerigo'?'#ffdc80':'#af9aef');
        const from=player.position.clone().add(new THREE.Vector3(0,1,0));
        const to=enemy.position.clone().add(new THREE.Vector3(0,.8,0));
        projectile.position.copy(from);
        projectile.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.clone().sub(from).normalize());
        projectiles.push({mesh:projectile,from,to,start:time,duration:.35});
      }
    },
    hit(time:number){actor.hit();playShadowEnemyAction(enemy,'attack',time);},
    die(){actor.die();movement=null;keys.clear();},
    revive(){actor.revive();player.position.set(-5,0,0);},
    update(time:number,dt:number,range:number,auto:boolean,alive:boolean,enemyAlive:boolean,engaged:boolean){
      let moving=false;
      if(alive){
        const axis=new THREE.Vector3(
          Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),0,
          Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')));
        if(axis.lengthSq()){
          axis.normalize();const next=player.position.clone().addScaledVector(axis,dt*4).clampLength(0,12);
          moving=approach(next,dt,4,0);
        }else if(movement){
          moving=approach(movement,dt,4,.03);if(!moving)movement=null;
        }else if(auto&&enemyAlive)moving=approach(enemy.position,dt,4,Math.max(.8,range-.05));
      }
      actor.setGait(moving?'run':'idle');actor.update(time);
      if(enemyAlive){
        deathTime=-1;
        if(engaged&&alive){
          const delta=player.position.clone().sub(enemy.position);delta.y=0;
          const distance=delta.length();
          if(distance>1.4){
            enemy.position.addScaledVector(delta.normalize(),Math.min(dt*1.2,distance-1.4));
            enemy.rotation.y=Math.atan2(delta.x,delta.z);
          }
        }
      }else{
        if(deathTime<0){deathTime=time;playShadowEnemyAction(enemy,'death',time);}
      }
      updateShadowEnemy(enemy,time,dt,player.position,enemyAlive);
      for(let i=projectiles.length-1;i>=0;i--){
        const p=projectiles[i],progress=(time-p.start)/p.duration;
        if(p.mesh.parent===scene)p.mesh.position.lerpVectors(p.from,p.to,Math.min(1,progress));
        if(progress>=1){releaseEffect(p.mesh);projectiles.splice(i,1);}
      }
      canvas.dataset.playerX=player.position.x.toFixed(3);canvas.dataset.playerZ=player.position.z.toFixed(3);
      canvas.dataset.enemyX=enemy.position.x.toFixed(3);canvas.dataset.attacks=String(attackCount);
      renderer.render(scene,camera);
    },
    dispose(){
      window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);
      window.removeEventListener('blur',blur);window.removeEventListener('resize',resize);
      canvas.removeEventListener('pointerdown',click);
      actor?.dispose();owned.forEach(resource=>resource.dispose());
      const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
      enemy.traverse(object=>{
        if(object instanceof THREE.Mesh){
          geometries.add(object.geometry);
          for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);
        }
      });
      geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());
      renderer.dispose();
    },
  };
}
