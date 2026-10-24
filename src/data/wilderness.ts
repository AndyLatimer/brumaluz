import raw from './generated/wilderness.json';
import type { ClassId } from './data';
export interface WildEnemy {label:string;family?:'beast'|'magic';pattern:'cone'|'line'|'circle';windup:number;aggro:number;radius:number;reach:number;cls:ClassId;level:number;health:number;damage:number;guard:number;range:number;interval:number;speed:number;xp:number;coins:number;loot:Record<string,number>;clothA:number;clothB:number}
export interface WildSpawn {id:string;enemy:string;location:string;respawn:number;x:number;z:number}
export const WILDERNESS=raw as {version:number;enemies:Record<string,WildEnemy>;spawns:WildSpawn[]};
