import raw from './generated/wilderness.json';
import type { ClassId } from './data';
export interface WildBehavior {temperament:'aggressive'|'territorial'|'defensive';behavior:'skirmisher'|'bruiser'|'ranged'|'rusher'|'drifter';idle:'watch'|'rest'|'sniff'|'forage';roam:number;walkSpeed:number;leash:number;assist:number;preferredRange:number;territory?:number;retreatRange?:number;pursuitBurst?:number;powerEvery?:number;powerMultiplier?:number;powerWindup?:number;powerRecovery?:number;description:string;title:string}
export interface WildEnemy {label:string;family?:'beast'|'magic';pattern:'cone'|'line'|'circle';windup:number;aggro:number;radius:number;reach:number;cls:ClassId;level:number;health:number;damage:number;guard:number;range:number;interval:number;speed:number;xp:number;coins:number;loot:Record<string,number>;clothA:number;clothB:number;ai?:WildBehavior}
export interface WildSpawn {id:string;enemy:string;location:string;respawn:number;x:number;z:number;habitat?:string;group?:string;leader?:string;variant?:number;patrol?:{x:number;z:number}[]}
export interface WildHabitat {origin:[number,number];cell:number;width:number;cells:Record<string,number[]>}
export const WILDERNESS=raw as unknown as {version:number;enemies:Record<string,WildEnemy>;spawns:WildSpawn[];habitats?:Record<string,WildHabitat>};
