// Pruebas del servidor con base de datos (dentro de la transacción de scripts/test-world-db.mjs): Portales, mapas y equipo inicial.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function mapsKits(t, { client, a, b, ca, cb, sa, sb, replacement, location, user, rpc, rejected, motion }) {
    await t.test('portals validate authority, persist the destination and isolate players by map', async () => {
      await client.query('savepoint map_travel');
      try {
        const destination = `zone_${randomUUID()}`;
        await client.query('insert into public.world_maps(id,name,spawn,bounds) values($1,$2,$3,$4)', [
          destination, 'Destino', {x:450,z:0,yaw:1}, {minX:-500,maxX:500,minZ:-300,maxZ:300},
        ]);
        await client.query('insert into public.world_portals(map,id,x,z,radius,target_map,target) values($1,$2,0,0,3,$3,$4),($3,$5,450,0,3,$1,$6)', [
          location, 'out', destination, {x:450,z:0,yaw:1}, 'back', {x:0,z:0,yaw:0},
        ]);
        await user(b); await rpc('world_join', [cb, sb]);
        await user(a);
        await rpc('character_enter', [ca]);
        assert.ok((await rpc('world_join', [ca, sa])).players.some(player => player.id === cb));
        await rejected(() => rpc('world_travel', [cb, sa, 'out']), /CHARACTER_NOT_FOUND/);
        await rejected(() => rpc('world_travel', [ca, replacement, 'out']), /WORLD_SESSION_REPLACED/);
        await rejected(() => rpc('world_travel', [ca, sa, 'invented']), /PORTAL_NOT_FOUND/);
        const travelled = await rpc('world_travel', [ca, sa, 'out']);
        assert.equal(travelled.location, destination);
        assert.equal(travelled.position.x, 450);
        assert.ok(!travelled.players.some(player => player.id === cb));
        assert.equal((await rpc('character_enter', [ca])).location, destination);
        assert.equal((await rpc('world_join', [ca, sa])).position.x, 450, 'reconexión conserva destino y posición');
        assert.equal((await rpc('world_sync', [ca, sa, motion(450)])).position.x, 450, 'usa los límites del mapa, no los 400 m de la capital');
        await rejected(() => rpc('world_sync', [ca, sa, motion(501)]), /INVALID_WORLD_STATE/);
        assert.ok((await rpc('world_travel', [ca, sa, 'back'])).players.some(player => player.id === cb));
        await client.query('reset role');
        await client.query("update public.world_players set position='{\"x\":30,\"z\":0,\"yaw\":0}' where character_id=$1", [ca]);
        await user(a);
        await rejected(() => rpc('world_travel', [ca, sa, 'out']), /PORTAL_TOO_FAR/);
        await client.query('reset role');
        await client.query("update public.world_players set position='{\"x\":0,\"z\":0,\"yaw\":0}',seen_at=now()-interval '16 seconds' where character_id=$1", [ca]);
        await user(a);
        await rejected(() => rpc('world_travel', [ca, sa, 'out']), /WORLD_SESSION_REPLACED/);
        await client.query('reset role');
        await client.query("update public.world_players set dead=true,seen_at=now() where character_id=$1", [ca]);
        await client.query("update public.characters set data=data||$1::jsonb where id=$2", [{location:destination,health:0},ca]);
        await user(a);
        await rejected(() => rpc('world_travel', [ca, sa, 'back']), /CHARACTER_DEAD/);
        const revived = await rpc('character_enter', [ca]);
        assert.equal(revived.location, 'brumaluz', 'entrar caído vuelve a la capital');
        await client.query('reset role');
        await client.query("update public.characters set data=data||$1::jsonb where id=$2", [{location:'removed_map',position:{x:1,z:0,yaw:0}},ca]);
        await user(a);
        assert.equal((await rpc('character_enter', [ca])).location, 'brumaluz');
      } finally {
        await client.query('rollback to savepoint map_travel');
        await client.query('release savepoint map_travel');
      }
    });
    await t.test('new characters receive only their class kit; legacy characters keep equipment and starter gear cannot be sold', async () => {
      await client.query('savepoint starter_kits');
      try {
        const appearance=Object.fromEntries(['sex','height','build','skin','face','hair','hairColor','beard','eyeShape','eyeColor',
          'brows','nose','mouth','detail','trait','primary','secondary','cape','clothA','clothB','hairAcc','hairAccColor','acc','makeup','makeupColor','accColor'].map(key=>[key,0]));
        appearance.acc=7;
        const kits = [
          ['guerrero','Espadero','espada_inicial','escudo_inicial'],
          ['mago','Hechicero','baston_inicial',null],
          ['picaro','Sigiloso','daga_inicial','daga_secundaria_inicial'],
          ['clerigo','Sanador','varita_inicial','libro_inicial'],
          ['explorador','Ballestero','ballesta_inicial',null],
        ];
        await user(a);
        assert.equal((await rpc('character_enter',[ca])).equipment,undefined,'No retroactive equipment on entry');
        for(const [cls,name,weapon,offhand] of kits) {
          const id=await rpc('create_character',[{
            ...appearance,name,race:'humano',cls,hair:cls==='explorador'?15:14,attributePoints:{},
            equipment:{weapon:{id:'forged_weapon',count:99,bound:false}},
            skillRanks:{heavy_strike:5},skillPoints:999,
          }]);
          const data=await rpc('character_enter',[id]);
          assert.equal(data.hair,cls==='explorador'?15:14);
          assert.equal(data.acc,7);
          assert.deepEqual(data.equipment.weapon,{id:weapon,count:1,bound:true});
          if(offhand)assert.deepEqual(data.equipment.offhand,{id:offhand,count:1,bound:true});
          else assert.equal(data.equipment.offhand,undefined);
          assert.ok(!JSON.stringify(data).includes('forged_weapon'));
          assert.deepEqual(data.skillRanks,{},'Character creation cannot forge ranks');
          assert.equal(data.skillPoints,undefined);
          await client.query('reset role');
          const publicData=(await client.query('select public.game_public_character($1) result',[{
            ...data,inventory:['private'],wallet:{pelines:9999},welcome:{origin:0,stage:'found'},
          }])).rows[0].result;
          assert.deepEqual(publicData.equipment,data.equipment);
          assert.equal(publicData.hair,data.hair);assert.equal(publicData.acc,7);
          assert.equal(publicData.inventory,undefined);assert.equal(publicData.wallet,undefined);assert.equal(publicData.welcome,undefined);
          await client.query('update public.characters set data=data||$1::jsonb where id=$2',[
            {inventory:[{id:weapon,count:1,bound:false}]},id,
          ]);
          await user(a);
          await rejected(()=>rpc('vendor_sell',[id,'testiculos',0]),/ITEM_NOT_SELLABLE/);
          assert.deepEqual((await rpc('character_enter',[id])).equipment,data.equipment,'Entry preserves the kit');
          await client.query('reset role');
          await client.query('delete from public.characters where id=$1',[id]);
          await user(a);
        }
      } finally {
        await client.query('rollback to savepoint starter_kits');
        await client.query('release savepoint starter_kits');
      }
    });
}
