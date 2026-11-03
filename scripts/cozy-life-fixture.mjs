import {fullWorldFixture} from './full-world-fixture.mjs';
import {build} from 'esbuild';
import {randomUUID} from 'node:crypto';
import {writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const pack=await build({stdin:{contents:"export {defaultChar} from './src/data/data';export {professionAction,professionState} from './src/data/professions';export * from './src/data/homes';export * from './src/data/dailyOrders';export * from './src/data/sharedMeals';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const clientPath=join(tmpdir(),`brumaluz-cozy-client-${randomUUID()}.mjs`);
let client;try{await writeFile(clientPath,pack.outputFiles[0].contents);client=await import(pathToFileURL(clientPath).href);}finally{await unlink(clientPath);}
export const cozyClient=client;
export async function cozyFixture(){
 const f=await fullWorldFixture();let count=0;
 await f.db.exec(`create table public.test_actor(id uuid);insert into public.test_actor values('${f.uid}');create or replace function auth.uid() returns uuid language sql stable as $$select id from public.test_actor$$;`);
 async function use(actor){await f.db.query('update public.test_actor set id=$1',[actor.uid]);}
 return {...f,use,
  async actor(name){
   const uid=count++===0?f.uid:randomUUID();
   if(uid!==f.uid)await f.db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[uid,`${uid}@example.invalid`,{username:`Vecino${count}`}]);
   const actor={uid,session:randomUUID(),id:''};await use(actor);
   actor.id=await f.rpc('create_character',{p_data:{...cozyClient.defaultChar(),name}});
   await this.move(actor,{location:'brumaluz',x:-3.5,z:0});return actor;
  },
  async data(actor){return f.character(actor.id);},
  async patch(actor,changes){const before=await f.character(actor.id),d={...before,...changes,...(changes.rpg?{rpg:{...before.rpg,...changes.rpg}}:{})};await f.db.query('update public.characters set data=$2 where id=$1',[actor.id,d]);return d;},
  async move(actor,site){
   const pos={x:site.x,z:site.z,yaw:site.yaw??0};
   await f.db.query("update public.characters set data=data||jsonb_build_object('location',$2::text,'position',$3::jsonb) where id=$1",[actor.id,site.location,pos]);
   await f.db.query('insert into public.world_players(user_id,character_id,session_id,position,seen_at) values($1,$2,$3,$4,public.test_now()) on conflict(user_id) do update set character_id=excluded.character_id,session_id=excluded.session_id,position=excluded.position,seen_at=excluded.seen_at',[actor.uid,actor.id,actor.session,pos]);
  },
  async action(actor,action,args={},request=randomUUID(),revision){await use(actor);const d=await f.character(actor.id);return f.rpc('rpg_action',{p_character_id:actor.id,p_action:action,p_args:args,p_request:request,p_revision:revision??d.rpg?.revision??0});},
  async view(actor){await use(actor);return f.rpc('cozy_view',{p_character_id:actor.id});},
  async item(id,count=1){return(await f.db.query('select public.game_rpg_new_item($1,$2) item',[id,count])).rows[0].item;},
 };
}
