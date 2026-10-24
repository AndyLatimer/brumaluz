import { play, session } from './state';

// Full character responses and world vitals travel independently. A newer heartbeat
// must not discard an inventory response, or let its older vitals rewind combat.
let context='',full=0,vitals=0;
export function acceptSnapshot(channel:'full'|'vitals',revision:unknown){
 const key=`${session.accountSyncId}:${session.activeCharacterId}:${play.playGeneration}`;
 if(key!==context){context=key;full=0;vitals=0;}
 if(typeof revision!=='number'||!Number.isSafeInteger(revision)||revision<0)return true;
 const previous=channel==='full'?full:vitals;
 if(revision<previous)return false;
 if(channel==='full')full=revision;else vitals=revision;
 return true;
}
