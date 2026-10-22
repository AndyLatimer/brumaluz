import { COMBAT_KITS, REGENERATION, regenerateCombat, resolveCombat, basicAttackDamage, skillPower, type CombatState, type CombatCommand } from '../data/combat';
import { WEAPONS, guardedDamage } from '../data/weapons';
import { ORIGINAL_WEAPONS } from '../data/uniqueWeapons';
import { OUTFITS } from '../data/outfits';
import { emptyEquipment } from '../data/inventory';
import { defaultChar, type ClassId } from '../data/data';
import { vitalsOf } from '../data/stats';
import { itemLabel } from '../data/items';
import './combatPreview.css';
import { createCombatScene } from './combatScene';

if (!import.meta.env.DEV) throw new Error('El banco de combate solo está disponible en desarrollo.');
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const classes = element<HTMLSelectElement>('class');
const tiers = element<HTMLSelectElement>('weapon-tier');
const collections = element<HTMLSelectElement>('weapon-collection');
let equipment = emptyEquipment();
const status = element<HTMLParagraphElement>('status');
const attack = element<HTMLButtonElement>('attack');
const skill = element<HTMLButtonElement>('skill');
const target = element<HTMLButtonElement>('target');
const respawn = element<HTMLButtonElement>('respawn');
const log = element<HTMLOListElement>('log');
let cls: ClassId = 'guerrero';
let state: CombatState;
let selected = false, automatic = false, approaching = false, distance = 10;
let nextEnemy = 0, previous = performance.now()/1000;
let engaged = false;
let lastCombat = -Infinity;
const now = () => performance.now()/1000;
status.textContent='Cargando escena 3D…';
const scene = await createCombatScene(element<HTMLCanvasElement>('combat-scene'),()=>{
  approaching=false;automatic=false;
},()=>{
  selected=!selected;
  if(!selected){automatic=false;approaching=false;}
  render();
}).catch((error:unknown)=>{
  status.textContent=`No se pudo cargar el combate 3D: ${error instanceof Error?error.message:String(error)}`;
  throw error;
});
function message(text: string) {
  status.textContent = text;
  const line = document.createElement('li');
  line.textContent = text;
  log.prepend(line);
  while (log.children.length>30) log.lastElementChild!.remove();
}
function reset() {
  const value = classes.value;
  if (!(value in COMBAT_KITS)) throw new Error('Clase no válida.');
  cls = value as ClassId;
  equipment = emptyEquipment();
  const collection = collections.value;
  const originals = new Set(ORIGINAL_WEAPONS.map(item => item.id));
  const collectionIds = new Set(ORIGINAL_WEAPONS.filter(item => item.collection === collection).map(item => item.id));
  for (const [id, weapon] of Object.entries(WEAPONS)) {
    if (weapon.cls === cls && weapon.tier === Number(tiers.value) && (collection === 'progression' ? !originals.has(id) : collectionIds.has(id))) equipment[weapon.slot] = { id, count: 1, bound: weapon.tier === 0 };
  }
  const vitals = vitalsOf({ ...defaultChar(), cls });
  const outfitCollection = collection === 'progression' ? ['','artesano','ambar','violeta','aurora','fuego'][Number(tiers.value)] : collection;
  const outfit = Object.values(OUTFITS).find(item => item.cls === cls && item.collection === outfitCollection);
  if (element<HTMLInputElement>('class-outfit').checked && outfit) equipment.chest = { id: outfit.id, count: 1 };
  state = { health:vitals.maxHealth, maxHealth:vitals.maxHealth, resource:vitals.maxResource, enemyHealth:100, nextAttack:0, nextSkill:0 };
  selected=false;automatic=false;approaching=false;distance=10;nextEnemy=now()+2;
  engaged=false;
  lastCombat=-Infinity;
  scene.reset(cls, equipment);
  log.replaceChildren();
  element('equipment').textContent = Object.values(equipment).flatMap(item=>item?[itemLabel(item.id)]:[]).join(' · ');
  element('weapon-stats').textContent = `Daño base: ${basicAttackDamage(cls,1,equipment)} · ${COMBAT_KITS[cls].skill.label}: ${skillPower(cls,1,equipment)}${cls==='picaro'?' × 2':''} · Guardia: ${8-guardedDamage(cls,equipment,8)}`;
  message('Selecciona al rival para empezar.');
  render();
}
function command(action: CombatCommand) {
  if (action === 'attack') {
    if (!selected) { message('Selecciona un objetivo.'); return; }
    if (!state.health || !state.enemyHealth) { message('No puedes iniciar este ataque.'); return; }
    automatic=true;approaching=distance>COMBAT_KITS[cls].range;
    engaged=true;
    message(approaching?'Acercándote al objetivo.':'Ataque automático activado.');
    return;
  }
  if (!COMBAT_KITS[cls].skill.healing && !selected) { message('Selecciona un objetivo.'); return; }
  try {
    const result=resolveCombat(cls,state,action,now(),distance,1,1,equipment);
    state=result.state;
    lastCombat=now();
    scene.attack(cls,true,result.healing>0,now());
    if(result.damage.length)engaged=true;
    message(result.healing?`Recuperas ${result.healing} de vida.`:`${COMBAT_KITS[cls].skill.label}: ${result.damage.join(' + ')} de daño.`);
  } catch(error) { message(error instanceof Error?error.message:String(error)); }
  render();
}
function render() {
  const vitals = vitalsOf({...defaultChar(),cls});
  for(const [id,value,max] of [
    ['health',state.health,state.maxHealth],['resource',state.resource,vitals.maxResource],['enemy',state.enemyHealth,100],
  ] as const) {
    const meter=element<HTMLMeterElement>(id);meter.max=max;meter.value=value;
    element(`${id}-value`).textContent=`${Math.floor(value)} / ${max}`;
  }
  target.setAttribute('aria-pressed',String(selected));
  scene.select(selected);
  const remaining=Math.max(0,state.nextSkill-now());
  skill.textContent=`2 · ${COMBAT_KITS[cls].skill.label} · ${COMBAT_KITS[cls].skill.cost} ${vitals.resourceKind==='mana'?'maná':'estamina'}${remaining>0?` · ${remaining.toFixed(1)} s`:''}`;
  skill.disabled=state.health===0||remaining>0;
  attack.disabled=state.health===0||state.enemyHealth===0;
  respawn.hidden=state.health!==0;
  element('distance').textContent=`Distancia: ${distance.toFixed(1)} m · Alcance: ${COMBAT_KITS[cls].range} m${approaching?' · Acercándote':''}`;
}
target.onclick=()=>{selected=!selected;if(!selected){automatic=false;approaching=false;}render();};
element<HTMLInputElement>('class-outfit').onchange=reset;
attack.onclick=()=>command('attack');
skill.onclick=()=>command('skill');
element('stop').onclick=()=>{automatic=false;approaching=false;message('Ataque detenido.');};
element('move').onclick=()=>{
  approaching=false;automatic=false;scene.moveAway();
  message('Movimiento manual: aproximación interrumpida.');render();
};
element('reset').onclick=reset;
respawn.onclick=()=>{
  state={...state,health:state.maxHealth};automatic=false;approaching=false;distance=10;
  scene.revive();engaged=false;
  message('Reaparición simulada: vida completa, sin recompensa.');render();
};
classes.onchange=reset;
tiers.onchange=reset;
collections.onchange=()=>{
  tiers.disabled=collections.value!=='progression';
  if(tiers.disabled)tiers.value=String(ORIGINAL_WEAPONS.find(item=>item.collection===collections.value)?.weapon.tier??2);
  reset();
};
window.addEventListener('keydown',event=>{
  if(event.repeat||event.target instanceof HTMLSelectElement||event.target instanceof HTMLInputElement)return;
  if(event.code==='Digit1'||event.code==='Digit2'){event.preventDefault();command(event.code==='Digit1'?'attack':'skill');}
});
reset();
const timer=window.setInterval(()=>{
  const time=now(),dt=Math.min(.2,time-previous);previous=time;
  if(document.hidden) {automatic=false;approaching=false;return;}
  scene.update(time,dt,COMBAT_KITS[cls].range,automatic,state.health>0,state.enemyHealth>0,engaged);
  distance=scene.distance();
  approaching=automatic&&distance>COMBAT_KITS[cls].range;
  if(automatic&&state.health>0&&state.enemyHealth>0&&distance<=COMBAT_KITS[cls].range&&time>=state.nextAttack){
    approaching=false;
    const result=resolveCombat(cls,state,'attack',time,distance,1,1,equipment);
    state=result.state;lastCombat=time;scene.attack(cls,false,false,time);message(`Ataque: ${result.damage.join(' + ')} de daño.`);
  }
  if(state.health>0&&state.enemyHealth>0&&distance<=2&&time>=nextEnemy){
    const incoming=guardedDamage(cls,equipment,12);
    nextEnemy=time+2;state.health=Math.max(0,state.health-incoming);lastCombat=time;scene.hit(time);message(`El rival causa ${incoming} de daño.`);
    if(state.health===0)scene.die();
  }
  if(state.health===0&&automatic){automatic=false;approaching=false;message('Has caído. Puedes reaparecer.');}
  if(state.enemyHealth===0&&automatic){automatic=false;approaching=false;message('Rival derrotado. Sin recompensas en este banco de pruebas.');}
  const vitals=vitalsOf({...defaultChar(),cls});
  state=regenerateCombat(state,vitals.maxResource,vitals.resourceKind,dt,time-lastCombat<REGENERATION.combatGrace);
  render();
},16);
window.addEventListener('pagehide',()=>{clearInterval(timer);scene.dispose();});
