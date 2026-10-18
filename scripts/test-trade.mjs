import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
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
    for(let i=0;i<4;i++) await h.page.getByRole('button',{name:'Add: Offer Stale bread (1)',exact:true}).click();
    assert.equal(await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).textContent(),'4');
    assert.equal(await h.page.locator('.trade-item input').count(),0);
    await h.page.getByLabel('Offered pelines',{exact:true}).fill('30');
    assert.equal(await h.page.getByRole('button',{name:'Accept trade',exact:true}).isDisabled(),true);
    h.setDelay(250);
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.locator('.trade-window[aria-busy="true"]').waitFor();
    await h.page.locator('.trade-window[aria-busy="false"]').waitFor();
    const sent=h.calls.find(c=>c.p_action==='offer');
    assert.deepEqual(sent.p_offer,{items:[{slot:0,id:'pan_duro',count:4}],pelines:30});
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('Accepted',{exact:true}).waitFor();
    assert.equal(await h.page.getByRole('button',{name:'Add: Offer Stale bread (1)',exact:true}).isDisabled(),true);
    assert.equal(await h.page.getByLabel('Offered pelines',{exact:true}).isDisabled(),true);
    await h.page.getByRole('button',{name:'Cancel offer',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('No offer',{exact:true}).waitFor();
    assert.deepEqual(h.state.trade.own,emptyOffer());
    assert.equal(await h.page.getByLabel('Offered pelines',{exact:true}).inputValue(),'0');
    assert.equal(await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).textContent(),'0');
    assert.equal(h.state.trade.status,'open');assert.equal(h.state.trade.accepted,false);
    h.state.trade.peerAccepted=true;
    await h.page.locator('.trade-peer-offer.accepted').getByText('Trade accepted',{exact:true}).waitFor();
    assert.deepEqual(await h.page.evaluate(()=>window.notifications),['The other player has accepted the trade.']);
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.getByText('Trade completed!',{exact:true}).waitFor();
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('compact invitations have plain action containers in both directions',async()=>{
  const h=await harness({status:'invited'});
  try {
    for(const incoming of [false,true]) {
      h.state.trade.incoming=incoming;
      await h.page.evaluate(()=>{window.tradeUI.setCharacter(null);window.tradeUI.setCharacter('self');});
      await h.page.locator('.trade-invitation').waitFor({state:'visible'});
      for(const width of [1280,390,320]) {
        await h.page.setViewportSize({width,height:844});
        const panel=await h.page.locator('.trade-window').boundingBox();
        assert.ok(panel.width<=460);
        assert.equal(await h.page.locator('.trade-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
        assert.deepEqual(await h.page.locator('.trade-window footer').evaluate(el=>{
          const css=getComputedStyle(el);return [css.borderTopWidth,css.backgroundImage,css.boxShadow];
        }),['0px','none','none']);
        if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await h.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`trade-invitation-${incoming?'incoming':'outgoing'}-${width}.png`)});
      }
    }
  }finally{await h.close();}
});
test('cancel offer clears drafts locally, resets both accepts remotely, and keeps errors recoverable',async()=>{
  const h=await harness();
  try {
    assert.equal(await h.page.getByRole('button',{name:'Cancel offer',exact:true}).isVisible(),false);
    await h.page.getByRole('button',{name:'Add: Offer Stale bread (1)',exact:true}).click();
    await h.page.getByRole('button',{name:'Cancel offer',exact:true}).click();
    assert.equal(h.calls.filter(call=>call.p_action==='offer').length,0);
    assert.equal(await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).textContent(),'0');
    await h.page.getByRole('button',{name:'All: Offer Stale bread (1)',exact:true}).click();
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('Offer sent',{exact:true}).waitFor();
    h.state.trade.peerAccepted=true;
    await h.page.locator('.trade-peer-offer.accepted').waitFor();
    h.setFailure('TRADE_CHANGED');
    await h.page.getByRole('button',{name:'Cancel offer',exact:true}).click();
    await h.page.getByText('The offer changed. Review it before accepting.',{exact:true}).waitFor();
    assert.equal(h.state.trade.own.items[0].count,10);
    assert.equal(await h.page.locator('.trade-backdrop').isVisible(),true);
    h.setFailure(null);
    await h.page.getByRole('button',{name:'Cancel offer',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('No offer',{exact:true}).waitFor();
    assert.deepEqual(h.state.trade.own,emptyOffer());
    assert.equal(h.state.trade.peerAccepted,false);
    assert.equal(h.state.trade.status,'open');
    await h.page.getByRole('button',{name:'Cancel',exact:true}).click();
    await h.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    await h.page.waitForTimeout(1200);
    assert.equal(await h.page.locator('.trade-backdrop').isHidden(),true);
    assert.equal(h.state.trade.status,'cancelled');
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('quantity buttons clamp to stack and purse limits, and reverting a draft unlocks acceptance',async()=>{
  const h=await harness();
  try {
    const plus=h.page.getByRole('button',{name:'Add: Offer Stale bread (1)',exact:true});
    const minus=h.page.getByRole('button',{name:'Remove: Offer Stale bread (1)',exact:true});
    const all=h.page.getByRole('button',{name:'All: Offer Stale bread (1)',exact:true});
    const amount=h.page.getByLabel('Offer Stale bread (1)',{exact:true});
    assert.equal(await minus.isDisabled(),true);
    assert.equal(await h.page.getByRole('button',{name:'Send offer',exact:true}).isDisabled(),true);
    await all.click();
    assert.equal(await amount.textContent(),'10');
    assert.equal(await plus.isDisabled(),true);
    assert.equal(await all.isDisabled(),true);
    assert.equal(await h.page.locator('.trade-item.selected').count(),1);
    await minus.click();
    assert.equal(await amount.textContent(),'9');
    for(let i=0;i<9;i++) await minus.click();
    assert.equal(await minus.isDisabled(),true);
    assert.equal(await h.page.locator('.trade-item.selected').count(),0);
    assert.equal(await h.page.getByRole('button',{name:'Accept trade',exact:true}).isEnabled(),true);
    await h.page.getByRole('button',{name:'All: Offered pelines',exact:true}).click();
    assert.equal(await h.page.getByLabel('Offered pelines',{exact:true}).inputValue(),'100');
    assert.equal(await h.page.getByRole('button',{name:'Add: Offered pelines',exact:true}).isDisabled(),true);
    await h.page.getByRole('button',{name:'Remove: Offered pelines',exact:true}).click();
    assert.equal(await h.page.getByLabel('Offered pelines',{exact:true}).inputValue(),'99');
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('Offer sent',{exact:true}).waitFor();
    assert.equal(h.calls.find(call=>call.p_action==='offer').p_offer.pelines,99);
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('peer offer changes keep an unsent selection and show acceptance as a distinct visual state',async()=>{
  const h=await harness();
  try {
    await h.page.getByRole('button',{name:'Add: Offer Stale bread (1)',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('Not sent',{exact:true}).waitFor();
    h.state.trade.peerAccepted=true;
    await h.page.locator('.trade-peer-offer.accepted .trade-accept-seal').waitFor();
    assert.equal(await h.page.locator('.trade-peer-offer .trade-offer-state').textContent(),'Accepted');
    h.state.trade.peerAccepted=false;h.state.trade.revision++;h.state.trade.peer.pelines=15;
    await h.page.locator('.trade-peer-offer .trade-offer-coins').getByText('15 Pelines',{exact:true}).waitFor();
    assert.equal(await h.page.locator('.trade-peer-offer .trade-offer-state').textContent(),'Offer received');
    assert.equal(await h.page.locator('.trade-accept-seal').count(),0);
    assert.equal(await h.page.getByLabel('Offer Stale bread (1)',{exact:true}).textContent(),'1');
    assert.equal(await h.page.getByRole('button',{name:'Accept trade',exact:true}).isDisabled(),true);
    assert.equal(await h.page.getByRole('button',{name:'Send offer',exact:true}).isEnabled(),true);
    await h.page.evaluate(async()=>{const {setLanguage}=await import('/src/ui/i18n.ts');setLanguage('es');});
    assert.equal(await h.page.getByLabel('Ofrecer Pan duro (1)',{exact:true}).textContent(),'1');
    await h.page.locator('[data-own-state]').getByText('Sin ofertar',{exact:true}).waitFor();
    await h.page.evaluate(async()=>{const {setLanguage}=await import('/src/ui/i18n.ts');setLanguage('en');});
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('Offer sent',{exact:true}).waitFor();
    assert.equal(h.calls.find(call=>call.p_action==='offer').p_revision,1);
    assert.doesNotMatch(await h.page.locator('.trade-window').innerText(),/Only pelines|Every change|Review both|Unsent changes/);
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('full backpack cards and accepted offer fit desktop and small screens',async()=>{
  const h=await harness();
  try {
    h.state.inventory=Array.from({length:25},(_,i)=>({id:i%2?'pocion_estamina_minuscula':'pan_duro',count:99}));
    h.state.trade.revision++;h.state.trade.peerAccepted=true;
    await h.page.locator('.trade-item').nth(24).waitFor({state:'attached'});
    for(const width of [1280,768,390,320]) {
      await h.page.setViewportSize({width,height:844});
      assert.equal(await h.page.locator('.trade-window').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`No overflow at ${width}px`);
      assert.equal(await h.page.locator('.trade-inventory').evaluate(el=>el.scrollHeight>el.clientHeight),true);
      await h.page.locator('.trade-title').scrollIntoViewIfNeeded();
      const acceptRect=await h.page.getByRole('button',{name:'Accept trade',exact:true}).boundingBox();
      assert.ok(acceptRect.y>=0 && acceptRect.y+acceptRect.height<=844,'Actions stay within the viewport');
      if(width<=700) {
        const chip=h.page.locator('.trade-mobile-state.accepted');
        await chip.waitFor({state:'visible'});
        assert.match(await chip.textContent(),/ElaraAccepted/);
        await h.page.locator('.trade-peer-offer').scrollIntoViewIfNeeded();
        const chipRect=await chip.boundingBox();
        assert.ok(chipRect.y>=0 && chipRect.y+chipRect.height<=844,'Peer acceptance stays visible while scrolling');
        await h.page.locator('.trade-title').scrollIntoViewIfNeeded();
      }
      if(process.env.PLAYWRIGHT_SCREENSHOT_DIR) await h.page.screenshot({path:join(process.env.PLAYWRIGHT_SCREENSHOT_DIR,`trade-polish-full-${width}.png`)});
    }
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
    await h.page.getByText('Tu mochila',{exact:true}).waitFor();
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
    await h.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    assert.ok((await h.page.evaluate(()=>window.notifications)).includes('Intercambio cancelado.'));
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
    await h.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    assert.equal(h.calls.some(call=>call.p_action==='join'),false);
    assert.equal(h.calls.some(call=>call.p_action==='cancel'),true);
    assert.deepEqual(h.errors,[]);
  }finally{await h.close();}
});
test('explicit errors, invalid quantities, reset acceptance on offer changes and range cancellation',async()=>{
  const h=await harness();
  try {
    await h.page.getByLabel('Offered pelines',{exact:true}).fill('1.5');
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.getByText('Enter valid whole quantities and pelines only.',{exact:true}).waitFor();
    assert.equal(h.calls.filter(c=>c.p_action==='offer').length,0);
    await h.page.getByLabel('Offered pelines',{exact:true}).fill('0');
    for(let i=0;i<2;i++) await h.page.getByRole('button',{name:'Add: Offer Stale bread (1)',exact:true}).click();
    h.setFailure('INVENTORY_FULL');
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.getByText('There is not enough space in one of the backpacks.',{exact:true}).waitFor();
    h.setFailure(null);
    await h.page.getByRole('button',{name:'Send offer',exact:true}).click();
    await h.page.getByRole('button',{name:'Accept trade',exact:true}).click();
    await h.page.locator('[data-own-state]').getByText('Accepted',{exact:true}).waitFor();
    h.state.trade.revision++;h.state.trade.accepted=false;h.state.trade.peerAccepted=false;
    await h.page.locator('[data-own-state]').getByText('Offer sent',{exact:true}).waitFor();
    h.state.trade.status='cancelled';h.state.trade.reason='TRADE_UNAVAILABLE';
    await h.page.locator('.trade-backdrop').waitFor({state:'hidden'});
    assert.ok((await h.page.evaluate(()=>window.notifications)).includes('Trade ended: you moved out of range or someone disconnected.'));
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
    await h.page.locator('.trade-backdrop').waitFor({state:'hidden'});
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
test('local purchases follow the 50 default, explicit overrides and bound stack separation',async()=>{
  const h=await harness();
  try {
    const result=await h.page.evaluate(async()=>{
      const {defaultChar}=await import('/src/data/data.ts');
      const {ITEMS,itemStack}=await import('/src/data/items.ts');
      const {simulateBuy}=await import('/src/services/devActions.ts');
      const d=defaultChar();d.wallet.pelines=100;
      d.inventory=[{id:'pan_duro',count:3,bound:true},{id:'pan_duro',count:49},...Array(23).fill(null)];
      simulateBuy(d,'testiculos','pan_duro');simulateBuy(d,'testiculos','pan_duro');
      const normal=d.inventory.map(s=>s?.count??null);
      ITEMS.pan_duro.stack=2;
      try {
        d.inventory=[{id:'pan_duro',count:2},...Array(24).fill(null)];
        simulateBuy(d,'testiculos','pan_duro');
        return {normal:normal.slice(0,3),override:d.inventory.slice(0,2).map(s=>s.count),fallback:itemStack('not-defined')};
      }finally{delete ITEMS.pan_duro.stack;}
    });
    assert.deepEqual(result,{normal:[3,50,1],override:[2,1],fallback:50});
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
    await h.page.locator('[data-own-state]').getByText('Accepted',{exact:true}).waitFor();
    h.release();
    await h.page.waitForTimeout(100);
    assert.equal(await h.page.locator('[data-own-state]').getByText('Accepted',{exact:true}).count(),1);
    h.setDelay(350);
    await h.page.getByRole('button',{name:'Cancel offer',exact:true}).click();
    await h.page.evaluate(()=>window.tradeUI.setCharacter(null));
    await h.page.waitForTimeout(450);
    assert.equal(await h.page.locator('.trade-backdrop').isHidden(),true);
    assert.deepEqual(h.errors,[]);
  }finally{h.release();await h.close();}
});
