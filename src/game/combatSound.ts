import { combatAudio } from './audio';
import { camera, holder } from './stage';
import { play } from './state';
import type { CombatCue } from '../world/combatAudio';

/** Stereo placement follows the camera; enemies beyond 24 m are inaudible. */
export function combatSoundAt(cue:CombatCue,voice:string,point:{x:number;z:number},strong=false){
 if(play.mode!=='play'||play.mapTravelling)return;
 const dx=point.x-holder.position.x,dz=point.z-holder.position.z,distance=Math.hypot(dx,dz);
 if(distance>=24)return;
 const gain=distance<=4?1:Math.pow((24-distance)/20,2);
 const right=camera.matrixWorld.elements;
 const pan=(dx*right[0]+dz*right[2])/Math.max(4,distance)*.7;
 combatAudio.play(cue,voice,{strong,gain,pan});
}
