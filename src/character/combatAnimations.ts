import * as THREE from 'three';
import combatDuration from '../data/combatDuration.json';
const refinedCache=new WeakMap<THREE.AnimationClip,{signature:string;clips:THREE.AnimationClip[]}>();
const gestureCache=new WeakMap<THREE.AnimationClip,THREE.AnimationClip>();

/** Additive hands/torso gesture: drinking or using an item keeps the legs moving. */
export function upperBodyGesture(clip:THREE.AnimationClip){
 const cached=gestureCache.get(clip);if(cached)return cached;
 const tracks=clip.tracks.filter(track=>{
  const node=THREE.PropertyBinding.parseTrackName(track.name).nodeName??'';
  return /^(spine|chest|neck|head|(upperarm|lowerarm|hand)[._]?[lr])$/.test(node);
 }).map(track=>track.clone());
 const gesture=new THREE.AnimationClip(`${clip.name}_UpperBody`,clip.duration,tracks);
 THREE.AnimationUtils.makeClipAdditive(gesture,0);
 gestureCache.set(clip,gesture);return gesture;
}

/** Retimed clips preserve the authored KayKit rig, with clear preparation, impact and recovery. */
export function refinedCombatClips(clips:THREE.AnimationClip[]){
 const key=clips[0],signature=clips.map(clip=>clip.uuid).join(':');
 const cached=key?refinedCache.get(key):undefined;if(cached?.signature===signature)return cached.clips;
 const source=(name:string)=>clips.find(c=>c.name===name);
 const result:THREE.AnimationClip[]=[];
 const retime=(name:string,from:string,duration:number,double=false)=>{
  const clip=source(from);if(!clip)return;
  const frames=double?48:32,times=Array.from({length:frames},(_,i)=>i/(frames-1)*duration);
  const tracks=clip.tracks.map(track=>{
   const size=track.getValueSize(),values:number[]=[],interpolant=(track as THREE.KeyframeTrack & {createInterpolant:()=>THREE.Interpolant}).createInterpolant();
   const node=THREE.PropertyBinding.parseTrackName(track.name).nodeName??'',arm=/(upperarm|lowerarm|hand)[._]?[lr]$/.test(node);
   const opposite=arm?clip.tracks.find(t=>t.name===`${node.slice(0,-1)}${node.endsWith('l')?'r':'l'}${track.name.slice(node.length)}`):undefined;
   const mirrored=opposite?(opposite as THREE.KeyframeTrack & {createInterpolant:()=>THREE.Interpolant}).createInterpolant():null;
   for(let i=0;i<frames;i++){
    const t=i/(frames-1),phase=double?(t<.48?t/.48:Math.max(0,(t-.52)/.48)):t;
    const sample=phase<.3?phase/.3*.25:.25+(phase-.3)/.7*.75;
    const mirror=double&&t>=.52&&(arm||node==='chest'||node==='spine');
    const pose=(mirror&&mirrored?mirrored:interpolant).evaluate(Math.min(clip.duration,sample*clip.duration));
    for(let k=0;k<size;k++)values.push(pose[k]*(mirror&&((size===4&&(k===1||k===2))||(size===3&&k===0))?-1:1));
   }
   const out=track.clone();out.times=new Float32Array(times);out.values=new Float32Array(values);return out;
  });result.push(new THREE.AnimationClip(name,duration,tracks));
 };
 retime('Combat_Slash','1H_Melee_Attack_Slice_Diagonal',combatDuration.guerrero.basic);
 retime('Combat_Backhand','Melee_1H_Attack_Slice_Horizontal',combatDuration.guerrero.basic);
 retime('Combat_Thrust','Melee_1H_Attack_Stab',combatDuration.guerrero.basic);
 retime('Combat_Heavy','Melee_1H_Attack_Chop',combatDuration.guerrero.skill);
 retime('Combat_Double','1H_Melee_Attack_Slice_Diagonal',combatDuration.picaro.skill,true);
 retime('Combat_Cast','Spellcasting',combatDuration.mago.basic);
 retime('Combat_Discharge','Spellcast_Raise',combatDuration.mago.skill);
 // The medium ranged rig shares the Adventurers bind pose. Compose its authored
 // aiming, shooting and reloading clips rather than imitating a spell cast.
 for(const [name,duration,aimTime]of [['Combat_Aim',combatDuration.explorador.basic,.2],['Combat_Precise',combatDuration.explorador.skill,.4]] as const){
  const aim=source('Ranged_1H_Aiming'),shoot=source('Ranged_1H_Shoot'),reload=source('Ranged_1H_Reload');
  if(!aim||!shoot||!reload)throw new Error('Faltan las animaciones de ballesta.');
  const names=new Set([...aim.tracks,...shoot.tracks,...reload.tracks].map(track=>track.name));
  const tracks:THREE.KeyframeTrack[]=[];
  for(const trackName of names){
   const inputs=[aim,shoot,reload].map(clip=>clip.tracks.find(track=>track.name===trackName));
   const template=inputs.find(Boolean)!;
   const samplers=inputs.map(track=>(track??template) as THREE.KeyframeTrack&{createInterpolant:()=>THREE.Interpolant}).map(track=>track.createInterpolant());
   const times:number[]=[],values:number[]=[],size=template.getValueSize(),pose=new THREE.Quaternion(),previous=new THREE.Quaternion();
   for(let i=0;i<48;i++){
    const t=i/47*duration,fireEnd=aimTime+.16,blend=.045;
    const phase=t<aimTime?0:t<fireEnd?1:2;
    const sample=phase===0?Math.max(0,aim.duration-.001):phase===1?(t-aimTime)/.16*shoot.duration:(t-fireEnd)/(duration-fireEnd)*reload.duration;
    const value=samplers[phase].evaluate(sample),boundary=phase===1?aimTime:fireEnd;
    const weight=phase===0?1:Math.min(1,(t-boundary)/blend);
    const before=phase>0?samplers[phase-1].evaluate(Math.max(0,[aim,shoot][phase-1].duration-.001)):value;
    times.push(t);
    if(template instanceof THREE.QuaternionKeyframeTrack){pose.fromArray(value);previous.fromArray(before).slerp(pose,weight);values.push(previous.x,previous.y,previous.z,previous.w);}
    else for(let k=0;k<size;k++)values.push(before[k]+(value[k]-before[k])*weight);
   }
   const out=template.clone();out.times=new Float32Array(times);out.values=new Float32Array(values);tracks.push(out);
  }
  result.push(new THREE.AnimationClip(name,duration,tracks));
 }
 if(key)refinedCache.set(key,{signature,clips:result});
 return result;
}
