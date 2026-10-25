import { vitals } from './state';
import { serverNow } from '../data/worldClock';

export interface SkillCooldownSample { deadline?: number; remaining?: number; serverTime?: number; revision?: number }
let serial=0, pending=0, lastRevision=-1, lastDeadline:number|undefined;

/** Show the recast immediately on release; unrelated heartbeats cannot undo an in-flight skill. */
export function predictSkillCooldown(seconds:number){
  const token={id:++serial,previous:vitals.skillReadyAt};pending=token.id;
  vitals.skillReadyAt=performance.now()+Math.max(0,seconds)*1000;
  return token;
}

export function syncSkillCooldown(sample:SkillCooldownSample,requestStarted?:number){
  if(pending)return;
  const {deadline,remaining,revision,serverTime}=sample;
  if(revision!==undefined&&revision<lastRevision)return;
  if(revision!==undefined&&revision===lastRevision&&deadline!==undefined&&lastDeadline!==undefined&&deadline<lastDeadline)return;
  let seconds:number;
  if(deadline!==undefined&&serverTime!==undefined)seconds=deadline-serverTime;
  else if(remaining!==undefined)seconds=remaining;
  else if(deadline!==undefined)seconds=deadline-serverNow();
  else return;
  if(!Number.isFinite(seconds))return;
  // Server-relative samples do not depend on the player's wall clock. Allow half
  // the measured round trip for the response travelling back to the client.
  if(requestStarted!==undefined&&(serverTime!==undefined||remaining!==undefined))seconds-=Math.max(0,performance.now()-requestStarted)/2000;
  let readyAt=performance.now()+Math.max(0,seconds)*1000;
  if(deadline!==undefined&&deadline===lastDeadline)readyAt=Math.min(vitals.skillReadyAt,readyAt);
  vitals.skillReadyAt=readyAt;
  if(revision!==undefined)lastRevision=revision;
  lastDeadline=deadline;
}

export function finishSkillCooldown(token:ReturnType<typeof predictSkillCooldown>,sample:SkillCooldownSample,requestStarted?:number){
  if(pending!==token.id)return;
  pending=0;syncSkillCooldown(sample,requestStarted);
}
export function cancelSkillCooldown(token:ReturnType<typeof predictSkillCooldown>){
  if(pending!==token.id)return;
  pending=0;vitals.skillReadyAt=token.previous;
}
export function resetSkillCooldown(){serial++;pending=0;lastRevision=-1;lastDeadline=undefined;vitals.skillReadyAt=0;}

export function cooldownSample(result:Record<string,unknown>):SkillCooldownSample{
  const data=result.data as {combatNextSkill?:number;serverRevision?:number}|undefined;
  const wild=result.wilderness as {skillReadyAt?:number;serverTime?:number}|undefined;
  const v=result.vitals as {serverRevision?:number}|undefined;
  return {deadline:wild?.skillReadyAt??data?.combatNextSkill,remaining:typeof result.skillCooldown==='number'?result.skillCooldown:undefined,
    serverTime:wild?.serverTime,revision:v?.serverRevision??data?.serverRevision};
}
