/** Reuse recently released resources while keeping every live owner's value valid. */
export class RetainedCache<T extends object & {dispose():void}> {
 private entries=new Map<string,{value:T;users:number}>();
 private owners=new WeakMap<T,{value:T;users:number}>();
 constructor(private unusedLimit=32){}
 get(key:string){const entry=this.entries.get(key);if(entry){this.entries.delete(key);this.entries.set(key,entry);}return entry?.value;}
 set(key:string,value:T){const entry={value,users:0};this.entries.set(key,entry);this.owners.set(value,entry);}
 retain(value:T){const entry=this.owners.get(value);if(!entry)return false;entry.users++;return true;}
 release(value:T){const entry=this.owners.get(value);if(entry)entry.users=Math.max(0,entry.users-1);}
 trim(){
  let unused=[...this.entries.values()].filter(entry=>entry.users===0).length;
  for(const [key,entry]of this.entries){
   if(unused<=this.unusedLimit)break;
   if(entry.users)continue;
   this.entries.delete(key);this.owners.delete(entry.value);entry.value.dispose();unused--;
  }
 }
 stats(){let active=0;for(const entry of this.entries.values())if(entry.users)active++;return {entries:this.entries.size,active,unused:this.entries.size-active,unusedLimit:this.unusedLimit};}
}
