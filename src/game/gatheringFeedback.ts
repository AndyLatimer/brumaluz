import * as THREE from 'three';
import { scene,lowEnd } from './stage';
import { play } from './state';
import { itemIcon,itemLabel } from '../data/items';
import { resourceFamily,RESOURCE_FAMILIES,resourceColor } from '../data/resourceAppearance';
import { RPG_CATALOG, type ProfessionSite } from '../data/professions';
import { t } from '../ui/i18n';
import { combatAudio } from './audio';
let previousDispose:(()=>void)|null=null;

/** A single short-lived scene effect and accessible progress card per extraction. */
export function gatheringFeedback(node:ProfessionSite,energy:number,onCancel:()=>void){
 previousDispose?.();
 document.body.classList.add('gathering-resource');
 const family=resourceFamily(node.item!)??'herb',identity=RESOURCE_FAMILIES[family],color=resourceColor(family,node.tier),generation=play.playGeneration;
 const card=document.createElement('section');card.className='gather-progress';card.style.setProperty('--gather-color',color);card.setAttribute('role','status');card.setAttribute('aria-label',t('Recolección'));
 const portrait=document.createElement('span');portrait.className='gather-portrait';portrait.innerHTML=itemIcon(node.item!);
 const copy=document.createElement('div');copy.className='gather-copy';
 const eyebrow=document.createElement('small');eyebrow.textContent=t(RPG_CATALOG.professions[node.job]);
 const title=document.createElement('strong');title.textContent=t(node.label);
 const details=document.createElement('span');details.textContent=t('{energy} energía · {seconds} s',{energy,seconds:node.seconds!});
 copy.append(eyebrow,title,details);
 const timer=document.createElement('span');timer.className='gather-time';timer.setAttribute('aria-hidden','true');
 const progress=document.createElement('progress');progress.max=node.seconds!;progress.value=0;progress.setAttribute('aria-label',t(identity.verb)+' '+t(node.label));
 const hint=document.createElement('small');hint.className='gather-hint';hint.textContent=t('Moverte interrumpe la recolección.');
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent=t('Cancelar');cancel.onclick=onCancel;
 card.append(portrait,copy,timer,progress,hint,cancel);document.body.append(card);
 const root=new THREE.Group();root.name='gathering-feedback';root.position.set(node.x,play.city.groundY(node.x,node.z)+.03,node.z);scene.add(root);
 const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.55,depthWrite:false});
 const ringGeometry=new THREE.RingGeometry(.69,.73,40),ring=new THREE.Mesh(ringGeometry,material);ring.rotation.x=-Math.PI/2;ring.raycast=()=>{};root.add(ring);
 const geometry=new THREE.IcosahedronGeometry(.028,0),chips:{mesh:THREE.Mesh;velocity:THREE.Vector3;age:number}[]=[];
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let previous=0,lastStroke=-1,disposed=false;
 const key=(event:KeyboardEvent)=>{if(event.code==='Escape'){event.preventDefault();onCancel();}};
 document.addEventListener('keydown',key);
 function dispose(){
  if(disposed)return;disposed=true;card.remove();document.body.classList.remove('gathering-resource');document.removeEventListener('keydown',key);root.removeFromParent();ringGeometry.dispose();geometry.dispose();material.dispose();
  if(previousDispose===dispose)previousDispose=null;
 }
 previousDispose=dispose;
 return {
  update(elapsed:number){
   const dt=Math.min(.1,elapsed-previous);previous=elapsed;
   progress.value=Math.min(node.seconds!,elapsed);timer.textContent=`${Math.max(0,node.seconds!-elapsed).toFixed(1)} s`;
   const stroke=Math.floor(elapsed/(node.job==='recolector'?1:1.25));
   if(stroke!==lastStroke){lastStroke=stroke;
    combatAudio.play(node.job==='minero'?'mining':node.job==='lenador'?'chopping':'harvesting',node.job,{gain:.45});
    if(!reduced)for(let i=0;i<(lowEnd?3:6);i++){const mesh=new THREE.Mesh(geometry,material),a=i*2.4;mesh.position.set(Math.sin(a)*.15,node.job==='lenador'?.65:.35,Math.cos(a)*.15);mesh.raycast=()=>{};root.add(mesh);chips.push({mesh,velocity:new THREE.Vector3(Math.sin(a)*.5,.6+(i%3)*.15,Math.cos(a)*.5),age:0});}
   }
   for(let i=chips.length-1;i>=0;i--){const chip=chips[i];chip.age+=dt;if(chip.age>.65){chip.mesh.removeFromParent();chips.splice(i,1);}else{chip.mesh.position.addScaledVector(chip.velocity,dt);chip.velocity.y-=dt*1.9;chip.mesh.scale.setScalar(1-chip.age/.65);}}
  },
  waiting(){timer.textContent='';hint.textContent=t('Terminando…');cancel.disabled=true;card.classList.add('finishing');document.removeEventListener('keydown',key);},
  complete(xp:number){
   document.body.classList.remove('gathering-resource');
   root.visible=false;card.classList.add('complete');title.textContent=`+1 ${t(itemLabel(node.item!))}`;eyebrow.textContent=t('Recurso obtenido');timer.textContent=xp?`+${xp} EXP`:'';hint.textContent=t('Guardado en tu mochila.');cancel.remove();progress.value=progress.max;
   document.removeEventListener('keydown',key);combatAudio.play('crafted',node.job,{gain:.4});
   const until=performance.now()+2200;
   const finish=()=>{if(performance.now()>=until||play.mode!=='play'||play.playGeneration!==generation)dispose();else requestAnimationFrame(finish);};requestAnimationFrame(finish);
  },dispose,
 };
}
