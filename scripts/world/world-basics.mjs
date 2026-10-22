// Pruebas del mundo en el navegador: Colisiones del mundo y equipo inicial.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { fixture, backend, leave } from './harness.mjs';
import { openPlayer } from './mockBackend.mjs';

test('low world props block at ground level and allow landing height above their top', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Saltador','humano',4.4);
  account.character.data.position={x:4.4,z:3.2,yaw:0};
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    const collision=await player.page.evaluate(()=>{
      const city=window.brumaluz.city(),character=window.brumaluz.char();
      const x=5.5,z=3.2,top=city.platformY(x,z),ground=city.groundY(x,z),targetX=5.2;
      const from=character.root.position.clone().set(4.4,ground,z);
      const low=city.collide(from,from.clone().set(targetX,ground,z));
      const high=city.collide(from.clone().setY((top??ground)+0.12),from.clone().set(targetX,(top??ground)+0.12,z));
      return {top,ground,blockedX:low.x,passedX:high.x};
    });
    assert.ok(collision.top!==null&&collision.top>collision.ground+0.3,`The plaza barrel exposes a raised top surface: ${JSON.stringify(collision)}`);
    assert.ok(collision.blockedX<5,`The barrel still blocks horizontal movement from below: ${JSON.stringify(collision)}`);
    assert.ok(Math.abs(collision.passedX-5.2)<0.01,`The character can move across the barrel top when reaching its height: ${JSON.stringify(collision)}`);
    await player.page.waitForTimeout(2500);
    await player.page.evaluate(()=>window.brumaluz.view(0,0.55,12));
    await player.page.keyboard.down('Space');
    await player.page.keyboard.down('KeyD');
    await player.page.waitForTimeout(260);
    const airborne=await player.page.evaluate(()=>window.brumaluz.char().root.parent.position.y);
    await player.page.keyboard.up('KeyD');
    await player.page.keyboard.up('Space');
    await player.page.waitForTimeout(850);
    const landed=await player.page.evaluate(()=>{
      const root=window.brumaluz.char().root;
      const holder=root.parent,city=window.brumaluz.city();
      return {x:holder.position.x,y:holder.position.y,z:holder.position.z,ground:city.groundY(holder.position.x,holder.position.z)};
    });
    assert.ok(airborne>collision.ground+0.5,`The character rises during the jump: y=${airborne}`);
    assert.ok(landed.x>5.05&&landed.x<5.95,`The jump moves the character onto the barrel: ${JSON.stringify(landed)}`);
    assert.ok(landed.y>landed.ground+0.55,`The character lands above ground on the barrel: ${JSON.stringify(landed)}`);
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('world collision shapes cover props and every placed tree or terrain variant', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Explorador','humano',4.4);
  const player=await openPlayer(world,account);
  try{
    await player.enter();
    const audit=await player.page.evaluate(()=>{
      const city=window.brumaluz.city(),Vector3=city.spawn.constructor;
      const wheelbarrow=new Vector3(3.5,city.groundY(3.5,-6.2),-6.2);
      const wheelbarrowResult=city.collide(wheelbarrow,wheelbarrow.clone());
      const names=['tree_single_A','tree_single_B','trees_A_large','trees_B_large','trees_A_medium','trees_B_medium','trees_A_small','hills_A_trees','hills_B_trees','hills_C_trees','hill_single_A','hill_single_B','mountain_A_grass_trees','mountain_B_grass_trees','mountain_C_grass','watermill'];
      const features=[];
      for(const name of names){
        const mesh=city.root.children.find(child=>child.name===name&&child.isInstancedMesh);
        if(!mesh||!mesh.count)continue;
        const matrix=mesh.matrix.clone();mesh.getMatrixAt(0,matrix);
        const x=matrix.elements[12],z=matrix.elements[14],length=Math.hypot(x,z)||1;
        const inwardX=-x/length,inwardZ=-z/length;
        const from=new Vector3(x+inwardX*4,city.groundY(x+inwardX*4,z+inwardZ*4),z+inwardZ*4);
        const to=new Vector3(x+inwardX*.2,city.groundY(x+inwardX*.2,z+inwardZ*.2),z+inwardZ*.2);
        const result=city.collide(from,to);
        features.push({name,count:mesh.count,distance:Math.hypot(result.x-x,result.z-z)});
      }
      return {wheelbarrowDistance:Math.hypot(wheelbarrowResult.x-wheelbarrow.x,wheelbarrowResult.z-wheelbarrow.z),features};
    });
    assert.ok(audit.wheelbarrowDistance>0.8&&audit.wheelbarrowDistance<2,`The wheelbarrow has a fitted solid collision body: ${JSON.stringify(audit)}`);
    assert.ok(audit.features.length>=8,`The current map exposes several placed tree and terrain model variants: ${JSON.stringify(audit)}`);
    for(const feature of audit.features){
      assert.ok(Number.isFinite(feature.distance),`${feature.name} has a finite collision footprint`);
      const isTree=feature.name.startsWith('tree_')||feature.name.startsWith('trees_');
      assert.ok(feature.distance>(isTree?0.7:1.7)&&feature.distance<4.5,`${feature.name} collision matches the visible trunk or terrain footprint: ${JSON.stringify(feature)}`);
    }
    assert.deepEqual(player.errors,[]);
  }finally{await player.context.close();}
});

test('starter equipment renders every class weapon without replacing novice clothes or granting legacy kits', {timeout:60000}, async()=>{
  const world=backend(),account=fixture('Equipado','humano',-6.4);
  const player=await openPlayer(world,account);
  const kits=[
    ['guerrero','espada_inicial','escudo_inicial',['1H_Sword','Badge_Shield']],
    ['mago','baston_inicial',null,['2H_Staff']],
    ['picaro','daga_inicial','daga_secundaria_inicial',['Knife','Knife_Offhand']],
    ['clerigo','varita_inicial','libro_inicial',['1H_Wand','Spellbook']],
    ['explorador','ballesta_inicial',null,['1H_Crossbow']],
  ];
  try{
    await player.enter();
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('1H_Sword')),false,'Legacy characters remain unarmed');
    for(const [cls,weapon,offhand,models] of kits){
      Object.assign(account.character.data,{cls,equipment:{weapon:{id:weapon,count:1,bound:true},offhand:offhand?{id:offhand,count:1,bound:true}:null},inventory:[]});
      await player.page.evaluate(({cls,weapon,offhand})=>window.brumaluz.set({
        cls,equipment:{
          weapon:{id:weapon,count:1,bound:true},
          offhand:offhand?{id:offhand,count:1,bound:true}:null,
        },
      }),{cls,weapon,offhand});
      const rendered=await player.page.evaluate(models=>{
        const root=window.brumaluz.char().root;
        return {weapons:models.every(name=>!!root.getObjectByName(name)),novice:!!root.getObjectByName('Rogue_Body')};
      },models);
      assert.equal(rendered.weapons,true,`${cls} equipped meshes`);
      assert.equal(rendered.novice,true,`${cls} keeps novice clothes`);
      await player.page.keyboard.press('KeyI');
      assert.ok(await player.page.locator(`#window-body [data-item-id="${weapon}"]`).count()>0,`${cls} equipment tooltip in inventory`);
      assert.equal(await player.page.locator('.inv-hint').filter({hasText:'Pulsa una pieza'}).count(),0);
      if(cls==='guerrero'){
        await player.page.locator('.equip[data-slot="weapon"]').hover();
        await player.page.locator('#game-tooltip.item-tooltip').waitFor({state:'visible'});
        assert.equal(await player.page.locator('.item-tip-binding').textContent(),'Ligado');
        assert.equal(await player.page.locator('.item-tip-binding').getAttribute('aria-label'),'Ligado · No intercambiable');
        assert.ok(await player.page.locator('#game-tooltip').evaluate(el=>{
          const badge=el.querySelector('.item-tip-binding').getBoundingClientRect(),header=el.querySelector('.item-tip-header').getBoundingClientRect();
          return badge.right<=el.getBoundingClientRect().right&&badge.bottom<=header.top+1;
        }),'Binding is a small corner badge above the item identity');
        assert.ok(await player.page.locator('.equip[data-slot="weapon"] svg path').count()>15);
        assert.ok(await player.page.locator('.equip[data-slot="offhand"] svg path').count()>15);
        if(process.env.PLAYWRIGHT_SCREENSHOT_DIR)await player.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,'novice-equipment-art.png')});
      }
      await player.page.locator('.equip[data-slot="weapon"]').click();
      await player.page.locator(`.inv-grid [data-item-id="${weapon}"]`).waitFor();
      assert.equal(await player.page.evaluate(name=>!!window.brumaluz.char().root.getObjectByName(name),models[0]),false,`${cls} unequipped model disappears`);
      assert.deepEqual(account.character.data.inventory[0],{id:weapon,count:1,bound:true});
      await player.page.locator(`.inv-grid [data-item-id="${weapon}"]`).hover();
      await player.page.locator('#game-tooltip').filter({hasText:'equipar'}).waitFor();
      await player.page.locator(`.inv-grid [data-item-id="${weapon}"]`).click();
      await player.page.waitForFunction(name=>!!window.brumaluz.char().root.getObjectByName(name),models[0]);
      assert.equal(account.character.data.inventory[0],null);
      await player.page.keyboard.press('Escape');
    }
    world.fail.add('equipment');
    await player.page.keyboard.press('KeyI');
    await player.page.locator('.equip[data-slot="weapon"]').click();
    await player.page.locator('#toast').filter({hasText:'Temporary equipment failure'}).waitFor();
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('1H_Crossbow')),true,'Failed transfers keep the equipped mesh');
    world.fail.delete('equipment');
    await player.page.keyboard.press('Escape');
    await leave(player.page);await player.page.reload();await player.page.waitForFunction(()=>!!window.brumaluz);await player.enter();
    assert.equal(await player.page.evaluate(()=>!!window.brumaluz.char().root.getObjectByName('1H_Crossbow')),true,'Equipment persists after reconnect');
  }finally{await player.context.close();}
});
