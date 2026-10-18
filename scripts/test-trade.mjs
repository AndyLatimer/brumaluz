import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';

const url='http://127.0.0.1:4177';
let server,browser;
before(async()=>{
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4177','--strictPort']);
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Vite timeout')),15000);
    server.once('error',reject);
    server.stdout.on('data',data=>{if(data.toString().includes('4177')){clearTimeout(timeout);resolve();}});
    server.stderr.on('data',data=>process.stderr.write(data));
  });
  assert.equal((await fetch(url)).status,200);
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || (process.platform==='win32'?'msedge':undefined),headless:true});
});
after(async()=>{
  await browser?.close();
  if(server && server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
});
const emptyOffer=()=>({items:[],pelines:0});
const trade=()=>({id:'trade-one',status:'open',reason:null,revision:0,incoming:false,peerId:'peer',peerName:'Elara',
  own:emptyOffer(),peer:{items:[{slot:0,id:'pocion_mana_minuscula',count:2}],pelines:7},accepted:false,peerAccepted:false});
async function harness({status='open',lang='en',mobile=false}={}) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
  const state={trade:trade(),inventory:[{id:'pan_duro',count:10},{id:'pocion_vida_minuscula',count:3,bound:true}],wallet:{pelines:100,premium:999}};
  state.trade.status=status;
  const calls=[],errors=[];let delay=0,failure=null,heldState=null,hold=false;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(`${url}/trade-harness`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><canvas id="scene"></canvas></body></html>'}));
  await page.route('**/rest/v1/rpc/trade_action',async route=>{
    const args=route.request().postDataJSON();calls.push(structuredClone(args));
    if(args.p_action==='state' && hold) {
      const snapshot=structuredClone(state);
      await new Promise(resolve=>{heldState=resolve;});heldState=null;
      return route.fulfill({contentType:'application/json',body:JSON.stringify(snapshot)});
    }
    if(delay) await new Promise(resolve=>setTimeout(resolve,delay));
    if(failure) return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:failure})});
    if(args.p_action==='offer') {
      state.trade.own=args.p_offer;state.trade.revision++;state.trade.accepted=false;state.trade.peerAccepted=false;
    }
    if(args.p_action==='accept') {state.trade.accepted=true;if(state.trade.peerAccepted)state.trade.status='completed';}
    if(args.p_action==='back') state.trade.accepted=false;
    if(args.p_action==='cancel') {state.trade.status='cancelled';state.trade.reason='TRADE_CANCELLED';}
    if(args.p_action==='join')state.trade.status='open';
    return route.fulfill({contentType:'application/json',body:JSON.stringify(state)});
  });
  await page.goto(`${url}/trade-harness`);
  await page.evaluate(async lang=>{
    const i18n=await import('/src/ui/i18n.ts');
    i18n.setLanguage(lang);
    const {createTradeWindow}=await import('/src/ui/tradeWindow.ts');
    window.notifications=[];window.received=[];
    window.tradeUI=createTradeWindow({inventory:s=>window.received.push(s),opened:()=>{},notify:s=>window.notifications.push(s)});
    window.addEventListener('keydown',event=>{if(window.tradeUI.isOpen)window.tradeUI.key(event);});
    window.tradeUI.setCharacter('self');
  },lang);
  await page.locator('.trade-backdrop').waitFor({state:'visible'});
  return {page,state,calls,errors,setDelay:value=>{delay=value;},setFailure:value=>{failure=value;},
    hold:()=>{hold=true;},release:()=>{hold=false;heldState?.();},held:()=>!!heldState,
    async close(){await page.evaluate(()=>window.tradeUI.setCharacter(null));await page.close();}};
}
test('trade UI shows only own tradable inventory, illustrated peer offer, quantities and both acceptance states',async()=>{
  const h=await harness();
  try {
    assert.equal(await h.page.locator('.trade-item').count(),1);
    assert.equal(await h.page.locator('.trade-offer-item').count(),1);
    assert.equal(await h.page.locator('.trade-item .item-art').count(),1);
    assert.match(await h.page.locator('.trade-peer-offer').innerText(),/Minuscule mana potion ×2/);
    await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).fill('4');
    await h.page.getByLabel('Offered pelines',{exact:true}).fill('30');
    assert.equal(await h.page.getByRole('button',{name:'Accept trade',exact:true}).isDisabled(),true);
    h.setDelay(250);
    await h.page.getByRole('button',{name:'Update offer',exact:true}).click();
    await h.page.locator('.trade-window[aria-busy="true"]').waitFor();
    await h.page.locator('.trade-window[aria-busy="false"]').waitFor();
    const sent=h.calls.find(c=>c.p_action==='offer');
    assert.deepEqual(sent.p_offer,{items:[{slot:0,id:'pan_duro',count:4}],pelines:30});
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.getByText('✓ You accepted. Back withdraws your acceptance.',{exact:true}).waitFor();
    await h.page.getByRole('button',{name:'Back',exact:true}).click();
    await h.page.getByText('Review both offers before accepting.',{exact:true}).waitFor();
    assert.equal(h.state.trade.status,'open');assert.equal(h.state.trade.accepted,false);
    h.state.trade.peerAccepted=true;
    await h.page.getByText('✓ The other player has accepted.',{exact:true}).waitFor();
    assert.deepEqual(await h.page.evaluate(()=>window.notifications),['The other player has accepted the trade.']);
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.getByText('Trade completed!',{exact:true}).waitFor();
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('Spanish invitation, cancellation, mobile layout and bound tooltip labels',async()=>{
  const h=await harness({status:'invited',lang:'es',mobile:true});
  try {
    h.state.trade.incoming=true;
    await h.page.evaluate(()=>{window.tradeUI.setCharacter(null);window.tradeUI.setCharacter('self');});
    await h.page.getByRole('dialog',{name:'Invitación de intercambio',exact:true}).waitFor();
    await h.page.getByRole('button',{name:'Aceptar',exact:true}).click();
    await h.page.getByText('Tu mochila intercambiable',{exact:true}).waitFor();
    assert.equal(await h.page.evaluate(()=>document.querySelector('.trade-window').getBoundingClientRect().right<=innerWidth),true);
    const binding=await h.page.evaluate(async()=>{
      const {sanitizeInventory}=await import('/src/data/inventory.ts');
      const {renderItemTooltip}=await import('/src/ui/itemTooltip.ts');
      const node=document.createElement('div');
      renderItemTooltip(node,'pan_duro',true);
      return {stack:sanitizeInventory([{id:'pan_duro',count:3,bound:true}])[0],tip:node.textContent};
    });
    assert.equal(binding.stack.bound,true);assert.match(binding.tip,/Ligado · No intercambiable/);
    await h.page.getByRole('button',{name:'Cancelar',exact:true}).click();
    await h.page.getByText('Intercambio cancelado.',{exact:true}).waitFor();
    assert.equal(h.state.trade.status,'cancelled');assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('an incoming invitation appears automatically and can be rejected without opening the trade',async()=>{
  const h=await harness({lang:'es',mobile:true});
  try {
    h.state.trade=null;
    await h.page.evaluate(()=>{window.tradeUI.setCharacter(null);window.tradeUI.setCharacter('self');});
    await h.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    h.state.trade={...trade(),status:'invited',incoming:true};
    const invitation=h.page.getByRole('dialog',{name:'Invitación de intercambio',exact:true});
    await invitation.waitFor({state:'visible'});
    await h.page.getByText('¿Quieres intercambiar objetos y pelines con Elara?',{exact:true}).waitFor();
    assert.equal(await h.page.getByRole('button',{name:'Aceptar',exact:true}).evaluate(el=>el===document.activeElement),true);
    for(const width of [390,320]) {
      await h.page.setViewportSize({width,height:844});
      assert.equal(await invitation.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    }
    await h.page.getByRole('button',{name:'Rechazar',exact:true}).click();
    await h.page.getByText('Intercambio cancelado.',{exact:true}).waitFor();
    assert.equal(h.calls.some(call=>call.p_action==='join'),false);
    assert.equal(h.calls.some(call=>call.p_action==='cancel'),true);
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('explicit errors, invalid quantities, reset acceptance on offer changes and range cancellation',async()=>{
  const h=await harness();
  try {
    await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).fill('1.5');
    await h.page.getByRole('button',{name:'Update offer',exact:true}).click();
    await h.page.getByText('Enter valid whole quantities and pelines only.',{exact:true}).waitFor();
    assert.equal(h.calls.filter(c=>c.p_action==='offer').length,0);
    await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).fill('2');
    h.setFailure('INVENTORY_FULL');
    await h.page.getByRole('button',{name:'Update offer',exact:true}).click();
    await h.page.getByText('There is not enough space in one of the backpacks.',{exact:true}).waitFor();
    h.setFailure(null);
    await h.page.getByRole('button',{name:'Update offer',exact:true}).click();
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.getByText('✓ You accepted. Back withdraws your acceptance.',{exact:true}).waitFor();
    h.state.trade.revision++;h.state.trade.accepted=false;h.state.trade.peerAccepted=false;
    await h.page.getByText('Review both offers before accepting.',{exact:true}).waitFor();
    h.state.trade.status='cancelled';h.state.trade.reason='TRADE_UNAVAILABLE';
    await h.page.getByText('Trade ended: you moved out of range or someone disconnected.',{exact:true}).waitFor();
  }finally{await h.close();}
});
test('trade keyboard stays in dialog, Escape closes invitations and slow requests show loading',async()=>{
  const h=await harness({status:'invited'});
  try {
    h.setDelay(600);
    await h.page.evaluate(()=>{void window.tradeUI.invite('peer');});
    await h.page.locator('#transition-loading').waitFor({state:'visible'});
    assert.equal(await h.page.locator('#transition-loading p').textContent(),'Preparing trade…');
    await h.page.locator('#transition-loading').waitFor({state:'hidden'});
    const cancel=h.page.getByRole('button',{name:'Cancel',exact:true});
    await cancel.focus();
    await h.page.keyboard.press('Tab');
    assert.equal(await cancel.evaluate(el=>el===document.activeElement),true);
    await h.page.keyboard.press('Escape');
    await h.page.getByText('Trade cancelled.',{exact:true}).waitFor();
    await h.page.keyboard.press('Escape');
    assert.equal(await h.page.locator('.trade-backdrop').isHidden(),true);
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('binding follows the usable stack on the quick bar and separates vendor sale groups',async()=>{
  const h=await harness();
  try {
    const result=await h.page.evaluate(async()=>{
      const {defaultChar}=await import('/src/data/data.ts');
      const {renderVendor}=await import('/src/ui/vendorWindow.ts');
      const {initActionBar,autoAssignToActionBar,renderActionBar}=await import('/src/ui/actionBar.ts');
      const d=defaultChar();
      d.inventory=[{id:'pan_duro',count:2,bound:true},{id:'pan_duro',count:3}];
      const vendor=document.createElement('div'),bar=document.createElement('div');bar.id='action-bar';
      document.body.append(vendor,bar);
      const sold=[];
      renderVendor(vendor,d,'none',{onBuy:()=>{},onSell:slot=>sold.push(slot)});
      const rows=[...vendor.querySelectorAll('.vendor-row')];
      rows.forEach(row=>row.querySelector('button').click());
      initActionBar({storageKey:()=> 'binding-test',count:()=>5,bound:()=>d.inventory.find(s=>s?.id==='pan_duro')?.bound===true,use:()=>{}});
      autoAssignToActionBar('pan_duro');
      const before=bar.querySelector('[data-item-id]').dataset.itemBound;
      d.inventory.reverse();renderActionBar();
      return {groups:rows.map(row=>row.dataset.itemBound),sold,before,after:bar.querySelector('[data-item-id]').dataset.itemBound};
    });
    assert.deepEqual(result,{groups:['true','false'],sold:[0,1],before:'true',after:'false'});
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('malformed trade snapshots surface an error without replacing the current offer',async()=>{
  const h=await harness();
  try {
    h.state.trade.peer.pelines='invalid';
    await h.page.getByText('The trade state could not be read. Please try again.',{exact:true}).waitFor();
    assert.match(await h.page.locator('.trade-peer-offer').innerText(),/7 Pelines/);
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('late poll cannot overwrite mutation; stopped character ignores stale callbacks',async()=>{
  const h=await harness();
  try {
    h.hold();
    await h.page.waitForTimeout(1200);
    assert.equal(h.held(),true);
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.getByText('✓ You accepted. Back withdraws your acceptance.',{exact:true}).waitFor();
    h.release();
    await h.page.waitForTimeout(100);
    assert.equal(await h.page.getByText('✓ You accepted. Back withdraws your acceptance.',{exact:true}).count(),1);
    h.setDelay(350);
    await h.page.getByRole('button',{name:'Back',exact:true}).click();
    await h.page.evaluate(()=>window.tradeUI.setCharacter(null));
    await h.page.waitForTimeout(450);
    assert.equal(await h.page.locator('.trade-backdrop').isHidden(),true);
    assert.deepEqual(h.errors,[]);
  }finally{h.release();await h.close();}
});
