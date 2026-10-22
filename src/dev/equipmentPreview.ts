import * as THREE from 'three';
import {Character,loadKits} from '../character/character';
import {defaultChar,CLASSES,RACES,type ClassId,type Race} from '../data/data';
import {ARMOR,OUTFITS,ARMOR_SLOTS} from '../data/outfits';
import {ACCESSORIES} from '../data/accessories';
import {itemLabel,itemIcon} from '../data/items';
import {emptyEquipment,type EquipmentSlot} from '../data/inventory';
import {vitalsOf} from '../data/stats';
import {armorGuard} from '../data/outfits';
if(!import.meta.env.DEV)throw new Error('Visor solo disponible en desarrollo.');
document.head.insertAdjacentHTML('beforeend',`<style>body{margin:0;background:#e6ddca;color:#483c30;font:16px Georgia}main{max-width:1200px;margin:auto;padding:25px}h1{margin-top:0}select,button{background:#f6ecd7;color:#483c30;border:1px solid #a58a59;border-radius:6px;padding:8px;font:inherit}section{display:flex;gap:24px;margin-top:20px}aside{width:48%;display:grid;gap:6px}aside label{display:flex;align-items:center;gap:8px}aside svg{width:48px;height:48px;flex:none}aside span{width:80px}aside select{min-width:0;flex:1}canvas{width:48%;height:720px;touch-action:none;border:1px solid #baa779;border-radius:12px}@media(max-width:750px){section{flex-direction:column}aside,canvas{width:100%}}</style>`);
const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const classes=el<HTMLSelectElement>('class'),sets=el<HTMLSelectElement>('set');
const races=el<HTMLSelectElement>('race'),motion=el<HTMLSelectElement>('motion');
for(const [id,cls] of Object.entries(CLASSES))classes.add(new Option(cls.label,id));
for(const [id,race] of Object.entries(RACES))races.add(new Option(race.label,id));
for(const id of [...new Set(Object.values(OUTFITS).map(x=>x.collection))])sets.add(new Option(id,id));
const names:Partial<Record<EquipmentSlot,string>>={head:'Cabeza',chest:'Pecho',hands:'Manos',legs:'Piernas',feet:'Pies',pendant:'Colgante',ring:'Anillo',trinket:'Abalorio'};
const slots=[...ARMOR_SLOTS,'pendant','ring','trinket'] as const;
const data=defaultChar();let actor:Character,yaw=-.3;
await loadKits();
const canvas=el<HTMLCanvasElement>('preview'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color('#e0d4bc');scene.add(new THREE.HemisphereLight('#fff1d8','#72839a',2.5));
const light=new THREE.DirectionalLight('#fff0d6',3);light.position.set(-3,5,8);scene.add(light);
const camera=new THREE.PerspectiveCamera(32,1,.01,100);camera.position.set(0,1.1,3.7);camera.lookAt(0,.85,0);
function draw(){renderer.setSize(canvas.clientWidth,canvas.clientHeight,false);camera.aspect=canvas.clientWidth/canvas.clientHeight;camera.updateProjectionMatrix();actor.root.rotation.y=yaw;renderer.render(scene,camera)}
function rebuild(){
 actor?.dispose();actor=new Character(data,{outfit:false});scene.add(actor.root);actor.setGait(motion.value as 'idle'|'walk'|'run');actor.update(performance.now()/1000);
 el('slots').replaceChildren();
 for(const slot of slots){
  const row=document.createElement('label'),art=document.createElement('i'),name=document.createElement('span'),select=document.createElement('select');name.textContent=names[slot]??slot;
  const id=data.equipment[slot]?.id;if(id)art.innerHTML=itemIcon(id);else art.style.cssText='width:48px;display:block';
  select.add(new Option('Ropa básica / vacío',''));
  for(const item of Object.values({...ARMOR,...ACCESSORIES}).filter(i=>i.slot===slot&&(!('cls'in i)||i.cls===data.cls)))select.add(new Option(itemLabel(item.id),item.id));
  select.value=id??'';select.onchange=()=>{data.equipment[slot]=select.value?{id:select.value,count:1}:null;rebuild()};
  row.append(art,name,select);el('slots').append(row);
 }
 const vitals=vitalsOf(data);el('stats').textContent=`Guardia: ${armorGuard(data.cls,data.equipment)} · Vida máxima: ${vitals.maxHealth} · ${vitals.resourceKind}: ${vitals.maxResource}`;draw();
}
function preset(){data.cls=classes.value as ClassId;data.equipment=emptyEquipment();for(const item of Object.values({...ARMOR,...ACCESSORIES}).filter(i=>i.collection===sets.value&&(!('cls'in i)||i.cls===data.cls)))data.equipment[item.slot]={id:item.id,count:1};rebuild()}
classes.onchange=preset;el('preset').onclick=preset;el('clear').onclick=()=>{data.equipment=emptyEquipment();rebuild()};
races.onchange=()=>{data.race=races.value as Race;rebuild()};motion.onchange=()=>actor.setGait(motion.value as 'idle'|'walk'|'run');el('skill').onclick=()=>actor.attack(true);
let dragging=false,last=0;canvas.onpointerdown=e=>{dragging=true;last=e.clientX;canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(dragging){yaw+=(e.clientX-last)*.012;last=e.clientX;draw()}};canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false};window.onresize=draw;preset();
renderer.setAnimationLoop(time=>{actor.update(time/1000);actor.root.rotation.y=yaw;renderer.render(scene,camera)});
