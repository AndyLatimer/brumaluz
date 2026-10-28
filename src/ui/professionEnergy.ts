import type { RpgState } from '../data/professions';
import { session } from '../game/state';
import { t } from './i18n';

export function gatheringEnergy(state?:RpgState,now=Date.now()/1000){return state?Math.min(100,Math.max(0,state.energy+Math.max(0,now-state.at)*100/16560)):100;}
export function professionTime(seconds:number){
 if(seconds<=0)return t('Instantáneo');
 if(seconds<60)return `${Math.ceil(seconds)} s`;
 const minutes=Math.ceil(seconds/60),hours=Math.floor(minutes/60);
 return hours?`${hours} h${minutes%60?` ${minutes%60} min`:''}`:`${minutes} min`;
}
export function updateProfessionEnergy(){
 const value=gatheringEnergy(session.state.rpg),text=value.toLocaleString('es-ES',{maximumFractionDigits:1});
 const untilFull=(100-value)*165.6;
 for(const meter of document.querySelectorAll<HTMLElement>('[data-gathering-energy]')){
  meter.style.setProperty('--energy',`${value}%`);meter.classList.toggle('low',value<25);
  meter.setAttribute('aria-valuenow',value.toFixed(1));
  const number=meter.querySelector('[data-energy-number]');if(number&&number.textContent!==text)number.textContent=text;
  const status=meter.querySelector('[data-energy-recovery]');if(status)status.textContent=value>=100?t('Reserva completa'):`${t('Completa en')} ${professionTime(untilFull)}`;
 }
 const hud=document.getElementById('gathering-energy-hud');
 if(hud)hud.title=`${t('Energía')}|${text} / 100 · ${value>=100?t('Reserva completa'):`${t('Completa en')} ${professionTime(untilFull)}`} · ${t('Abrir profesiones')} (P)`;
 for(const timer of document.querySelectorAll<HTMLElement>('[data-profession-end]')){
  const now=Date.now()/1000,remaining=Number(timer.dataset.professionEnd)-now,start=Number(timer.dataset.professionStart);
  timer.textContent=remaining<=0?t('Listo para recoger'):start>now?t('Empieza en {time}',{time:professionTime(start-now)}):t('Termina en {time}',{time:professionTime(remaining)});
  const progress=timer.closest('.profession-order')?.querySelector<HTMLProgressElement>('progress');
  if(progress){const start=Number(timer.dataset.professionStart);progress.value=Math.min(1,Math.max(0,(Date.now()/1000-start)/(Number(timer.dataset.professionEnd)-start)));}
 }
}
