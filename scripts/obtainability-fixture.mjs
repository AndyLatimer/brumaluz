// Shared isolated world: production SQL dependencies, never remote credentials.
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fullWorldFixture} from './full-world-fixture.mjs';
const catalog=JSON.parse(await readFile(new URL('../src/data/generated/rpg-catalog.json',import.meta.url),'utf8'));
export async function fixture(){
 const f=await fullWorldFixture(),{db,uid}=f,session=randomUUID();
 const appearance=Object.fromEntries(['sex','height','build','skin','face','hair','hairColor','beard','eyeShape','eyeColor','brows','nose','mouth','detail','trait','primary','secondary','cape','clothA','clothB','hairAcc','hairAccColor','acc','makeup','makeupColor','accColor'].map(k=>[k,0]));
 const id=await f.rpc('create_character',{p_data:{...appearance,name:'Artesano',race:'humano',cls:'picaro',attributePoints:{}}});
 return{db,id,uid,
  async seed(data){await db.query('update public.characters set data=$2 where id=$1',[id,{race:'humano',cls:'picaro',level:1,experience:0,health:66,wallet:{pelines:5},equipment:{},inventory:Array(25).fill(null),...data}]);},
  async move(site){const pos={x:site.x,z:site.z,yaw:0};await db.query("update public.characters set data=data||jsonb_build_object('location',$2::text,'position',$3::jsonb) where id=$1",[id,site.location,pos]);await db.query('insert into public.world_players(user_id,character_id,session_id,position,seen_at) values($1,$2,$3,$4,public.test_now()) on conflict(user_id) do update set position=excluded.position,seen_at=excluded.seen_at',[uid,id,session,pos]);},
  async data(){return f.character(id);},
  async action(action,args={},request=randomUUID(),revision){const data=await this.data();return f.rpc('rpg_action',{p_character_id:id,p_action:action,p_args:args,p_request:request,p_revision:revision??data.rpg?.revision??0});},
  async purchase(recipeId){const recipe=catalog.recipes[recipeId];let d=await this.data();if(!d.inventory.some(item=>item?.id===`receta_${recipeId}`)&&recipe.source!=='drop')d=await this.action('buy_recipe',{id:recipeId,master:catalog.teachers[recipe.job].id,price:recipe.price});const slot=d.inventory.findIndex(item=>item?.id===`receta_${recipeId}`);if(slot<0)throw Error('Faltan materiales: pergamino de receta');return this.action('use_recipe',{slot,id:d.inventory[slot].id,instanceId:d.inventory[slot].instanceId});},
  async step(seconds){
   // This legacy route fixture represents uninterrupted connected play. Account
   // for the heartbeats between actions instead of pretending a long gap was online.
   await f.step(seconds);
   await db.query("insert into public.craft_activity(character_id,online_seconds) select character_id,greatest(0,extract(epoch from public.test_now()-seen_at)-15) from public.world_players where seen_at>=public.test_now()-($1+15)*interval '1 second' on conflict(character_id) do update set online_seconds=public.craft_activity.online_seconds+excluded.online_seconds",[seconds]);
   await db.query("update public.world_players set seen_at=public.test_now() where seen_at>=public.test_now()-($1+15)*interval '1 second'",[seconds]);
  },
 };
}
