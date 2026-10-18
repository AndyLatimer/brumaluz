import { requestTrade, type Trade, type TradeOffer, type TradeState } from '../services/trade';
import { itemDef, itemIcon, itemLabel } from '../data/items';
import { currencyIcon } from '../data/currency';
import { setItemTooltip } from './itemTooltip';
import { t } from './i18n';
import { beginTransition } from './transitionLoading';
import '../styles/trade.css';

const errors: Record<string,string> = {
  TRADE_INVALID_RESPONSE: 'No se pudo leer el estado del intercambio. Inténtalo de nuevo.',
  TRADE_UNAVAILABLE: 'El intercambio terminó: os habéis alejado o alguien se ha desconectado.',
  TRADE_CANCELLED: 'Intercambio cancelado.',
  TRADE_BUSY: 'Uno de los jugadores ya tiene un intercambio pendiente.',
  TRADE_BOUND: 'Los objetos ligados no se pueden intercambiar.',
  TRADE_CHANGED: 'La oferta ha cambiado. Revísala antes de aceptar.',
  TRADE_ITEMS_CHANGED: 'Los objetos han cambiado. Actualiza tu oferta.',
  TRADE_INVALID_OFFER: 'Indica cantidades enteras válidas y solo pelines.',
  TRADE_CLOSED: 'Este intercambio ya ha terminado.',
  TRADE_NOT_FOUND: 'Este intercambio ya no existe.',
  INVENTORY_FULL: 'No hay espacio suficiente en una de las mochilas.',
  NOT_ENOUGH_PELINES: 'No hay suficientes pelines para completar el intercambio.',
};
const message = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error);
  return t(errors[Object.keys(errors).find(key => raw.includes(key)) ?? ''] ?? raw);
};
export function createTradeWindow(hooks: {
  active?(character: string): boolean;
  inventory(state: TradeState): void;
  opened(): void;
  notify(text: string): void;
}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'trade-backdrop'; backdrop.hidden = true;
  const panel = document.createElement('section');
  panel.className = 'trade-window'; panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-label',t('Intercambio'));
  const content = document.createElement('div');
  const status = document.createElement('p'); status.className='trade-status'; status.setAttribute('role','status');
  panel.append(content,status); backdrop.append(panel); document.body.append(backdrop);
  let character: string | null = null, generation = 0, mutation = 0, busy = false, dirty = false;
  let current: TradeState | null = null, dismissed: string | null = null;
  let draft: TradeOffer = {items:[],pelines:0};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const live=(version: number,id: string)=>version===generation && id===character && hooks.active?.(id)!==false;
  function button(label: string, action: () => void) {
    const result=document.createElement('button'); result.type='button'; result.textContent=t(label);
    result.disabled=busy; result.onclick=action; return result;
  }
  function line(text: string, tag='p') {
    const node=document.createElement(tag); node.textContent=t(text); return node;
  }
  function announce(text: string, error=false) {
    status.textContent=text; status.classList.toggle('error',error);
  }
  function setBusy(value: boolean) {
    busy=value; panel.setAttribute('aria-busy',String(value)); panel.classList.toggle('trade-busy',value);
    content.querySelectorAll<HTMLInputElement|HTMLButtonElement>('button,input').forEach(el=>el.disabled=value || el.dataset.locked==='true');
  }
  function quantity(label: string, value: number, max: number, locked: boolean, change: (value: number) => void, editable = false) {
    const control=document.createElement('div'); control.className='trade-quantity';
    const number=editable ? document.createElement('input') : document.createElement('output');
    number.setAttribute('aria-label',label);
    if(number instanceof HTMLInputElement) {
      number.type='number'; number.min='0'; number.max=String(max); number.step='1'; number.value=String(value);
      number.dataset.locked=String(locked);
      number.oninput=()=>{ value=number.value==='' ? NaN : Number(number.value); change(value); refresh(); };
    }
    const minus=button('−',()=>update((Number.isFinite(value) ? value : 0)-1));
    const plus=button('+',()=>update((Number.isFinite(value) ? value : 0)+1));
    const all=button('Todo',()=>update(max));
    minus.setAttribute('aria-label',t('Quitar: {item}',{item:label}));
    plus.setAttribute('aria-label',t('Añadir: {item}',{item:label}));
    all.setAttribute('aria-label',t('Todo: {item}',{item:label}));
    function refresh() {
      if(!(number instanceof HTMLInputElement)) number.textContent=String(value);
      for(const [el,limit] of [[minus,value<=0],[plus,value>=max],[all,value===max]] as const) {
        el.dataset.locked=String(locked || limit);
        el.disabled=busy || locked || limit;
      }
    }
    function update(next: number) {
      value=Math.max(0,Math.min(max,next));
      if(number instanceof HTMLInputElement) number.value=String(value);
      change(value); refresh();
    }
    control.append(minus,number,plus,all); refresh();
    return control;
  }
  const hasOffer=(offer: TradeOffer)=>offer.items.length>0 || offer.pelines>0;
  function offerItems(offer: TradeOffer) {
    const list=document.createElement('div'); list.className='trade-offer-list';
    for(const entry of offer.items) {
      const row=document.createElement('div'); row.className='trade-offer-item';
      const icon=document.createElement('span'); icon.innerHTML=itemIcon(entry.id); setItemTooltip(icon,entry.id); icon.tabIndex=0;
      const label=document.createElement('span'); label.textContent=`${t(itemLabel(entry.id))} ×${entry.count}`;
      row.append(icon,label); list.append(row);
    }
    if(!offer.items.length) { const empty=line('Sin objetos'); empty.className='trade-empty'; list.append(empty); }
    const coins=document.createElement('p'); coins.className='trade-offer-coins';
    coins.innerHTML=currencyIcon('pelines'); coins.append(` ${offer.pelines} ${t('Pelines')}`); list.append(coins);
    return list;
  }
  function render() {
    const tr=current?.trade;
    if(!tr || dismissed===tr.id) { backdrop.hidden=true; return; }
    const wasHidden=backdrop.hidden;
    backdrop.hidden=false;
    if(wasHidden) hooks.opened();
    content.replaceChildren();
    const incoming=tr.status==='invited' && tr.incoming;
    panel.classList.toggle('trade-invitation',tr.status==='invited');
    panel.classList.toggle('trade-ended',tr.status==='completed');
    const heading=incoming ? 'Invitación de intercambio' : 'Intercambio';
    panel.setAttribute('aria-label',t(heading));
    const title=line(heading,'h2'); title.className='trade-title';
    const crest=document.createElement('span');
    crest.innerHTML='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 14h32l-8-8m10 28H9l8 8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M9 20h13v20H9zm17-12h13v20H26z" fill="#c59a50" stroke="#715138"/><circle cx="15.5" cy="30" r="4" fill="#f3dfac"/><circle cx="32.5" cy="18" r="4" fill="#f3dfac"/></svg>';
    title.prepend(crest); content.append(title);
    const name=line(tr.peerName,'h3'); name.className='trade-peer-name'; content.append(name);
    if(tr.status==='completed' || tr.status==='cancelled') {
      content.append(line(tr.status==='completed' ? '¡Intercambio completado!' : errors[tr.reason ?? ''] ?? 'Intercambio cancelado.'));
      content.append(button('Cerrar',()=>{dismissed=tr.id;render();}));
      return;
    }
    if(tr.status==='invited') {
      const invitation=line(tr.incoming ? '¿Quieres intercambiar objetos y pelines con {name}?' : 'Esperando a que acepte la invitación…');
      if(tr.incoming) invitation.textContent=t('¿Quieres intercambiar objetos y pelines con {name}?',{name:tr.peerName});
      invitation.className='trade-invitation-message';
      content.append(invitation);
      const actions=document.createElement('footer');
      if(tr.incoming) actions.append(button('Aceptar',()=>void act('join')));
      actions.append(button(tr.incoming ? 'Rechazar' : 'Cancelar',()=>void act('cancel')));
      content.append(actions);
      setBusy(busy);
      if(wasHidden) actions.querySelector<HTMLButtonElement>('button')?.focus();
      return;
    }
    const peerLabel=tr.peerAccepted ? 'Aceptada' : hasOffer(tr.peer) ? 'Oferta recibida' : 'Esperando oferta';
    const mobileState=document.createElement('div'); mobileState.className='trade-mobile-state';
    mobileState.classList.toggle('accepted',tr.peerAccepted);
    mobileState.append(line(tr.peerName,'strong'),line(peerLabel,'span'));
    content.append(mobileState);
    const columns=document.createElement('div'); columns.className='trade-columns';
    const mine=document.createElement('section'); mine.className='trade-own';
    mine.append(line('Tu mochila','h3'));
    const grid=document.createElement('div'); grid.className='trade-inventory';
    current!.inventory.forEach((stack,slot)=>{
      if(!stack || stack.bound || itemDef(stack.id)?.bound || !itemDef(stack.id)) return;
      const cell=document.createElement('div'); cell.className='trade-item';
      const icon=document.createElement('span'); icon.innerHTML=itemIcon(stack.id); setItemTooltip(icon,stack.id,stack.bound);
      icon.className='trade-item-icon'; icon.tabIndex=0;
      const info=document.createElement('div'); info.className='trade-item-info';
      info.append(line(itemLabel(stack.id),'strong'));
      const owned=document.createElement('small'); owned.textContent=t('{n} disponibles',{n:stack.count}); info.append(owned);
      const selected=draft.items.find(item=>item.slot===slot)?.count ?? 0;
      cell.classList.toggle('selected',selected>0);
      const control=quantity(`${t('Ofrecer')} ${t(itemLabel(stack.id))} (${slot+1})`,selected,stack.count,tr.accepted,count=>{
        draft.items=draft.items.filter(item=>item.slot!==slot);
        if(count>0) draft.items.push({slot,id:stack.id,count});
        cell.classList.toggle('selected',count>0);
        markDirty();
      });
      cell.append(icon,info,control); grid.append(cell);
    });
    if(!grid.children.length) grid.append(line('Sin objetos intercambiables'));
    mine.append(grid);
    const money=document.createElement('div'); money.className='trade-money';
    const purse=document.createElement('div'); purse.innerHTML=currencyIcon('pelines');
    const balance=document.createElement('span'); balance.append(line('Pelines','strong'));
    const available=document.createElement('small'); available.textContent=t('Disponible: {n}',{n:current!.wallet.pelines}); balance.append(available);
    purse.append(balance); money.append(purse);
    money.append(quantity(t('Pelines ofrecidos'),draft.pelines,current!.wallet.pelines,tr.accepted,value=>{draft.pelines=value;markDirty();},true));
    mine.append(money);
    const save=button('Ofertar',()=>void act('offer',draft)); save.dataset.tradeSave=''; save.className='trade-primary'; mine.append(save);
    const own=document.createElement('div'); own.className='trade-own-offer';
    const ownHeading=document.createElement('header'); ownHeading.append(line('Tu oferta','h3'));
    const ownState=document.createElement('span'); ownState.className='trade-offer-state'; ownState.dataset.ownState='';
    ownState.setAttribute('role','status');
    ownHeading.append(ownState); own.append(ownHeading,offerItems(tr.own)); mine.append(own);
    const peer=document.createElement('section'); peer.className='trade-peer-offer';
    peer.classList.toggle('accepted',tr.peerAccepted);
    peer.classList.toggle('offered',hasOffer(tr.peer));
    const peerHeading=document.createElement('header'); peerHeading.append(line('Su oferta','h3'));
    const peerState=line(peerLabel,'span');
    peerState.className=`trade-offer-state${tr.peerAccepted ? ' accepted' : hasOffer(tr.peer) ? ' offered' : ''}`;
    peerState.setAttribute('role','status');
    peerHeading.append(peerState); peer.append(peerHeading,offerItems(tr.peer));
    if(tr.peerAccepted) {
      const seal=document.createElement('div'); seal.className='trade-accept-seal';
      const check=document.createElement('span'); check.textContent='✓'; check.setAttribute('aria-hidden','true');
      seal.append(check,line('Intercambio aceptado','strong')); peer.append(seal);
    }
    columns.append(mine,peer); content.append(columns);
    const footer=document.createElement('footer');
    const accept=button('Aceptar intercambio',()=>void act('accept')); accept.dataset.tradeAccept='';
    accept.className='trade-primary';
    accept.dataset.locked=String(dirty || tr.accepted);
    const withdraw=button('Cancelar oferta',()=>void withdrawOffer()); withdraw.dataset.tradeWithdraw='';
    footer.append(accept,withdraw,button('Cancelar',()=>void act('cancel')));
    content.append(footer); markDirty(); setBusy(busy);
    if(wasHidden) content.querySelector<HTMLButtonElement>('button')?.focus();
  }
  function markDirty() {
    const tr=current?.trade;
    const ordered=(offer: TradeOffer)=>JSON.stringify({pelines:offer.pelines,items:[...offer.items].sort((a,b)=>a.slot-b.slot)});
    dirty=!!tr && ordered(draft)!==ordered(tr.own);
    const accept=content.querySelector<HTMLButtonElement>('[data-trade-accept]');
    if(accept) { accept.dataset.locked=String(dirty || !!current?.trade?.accepted); accept.disabled=busy || accept.dataset.locked==='true'; }
    const save=content.querySelector<HTMLButtonElement>('[data-trade-save]');
    if(save) { save.dataset.locked=String(!dirty || !!tr?.accepted); save.disabled=busy || save.dataset.locked==='true'; }
    const withdraw=content.querySelector<HTMLButtonElement>('[data-trade-withdraw]');
    if(withdraw) {
      withdraw.hidden=!tr || !(hasOffer(tr.own) || tr.accepted || dirty);
      withdraw.dataset.locked=String(withdraw.hidden);
      withdraw.disabled=busy || withdraw.hidden;
    }
    const state=content.querySelector<HTMLElement>('[data-own-state]');
    if(state && tr) {
      state.textContent=t(tr.accepted ? 'Aceptada' : dirty ? 'Sin ofertar' : hasOffer(tr.own) ? 'Oferta enviada' : 'Sin oferta');
      state.classList.toggle('accepted',tr.accepted);
      state.classList.toggle('pending',dirty);
    }
  }
  async function withdrawOffer() {
    if(!current?.trade || busy) return;
    if(hasOffer(current.trade.own) || current.trade.accepted) {
      await act('offer',{items:[],pelines:0});
    } else {
      draft=structuredClone(current.trade.own); dirty=false; announce(''); render();
    }
  }
  function receive(value: TradeState, force=false) {
    const before=current?.trade, next=value.trade;
    if(next?.peerAccepted && !before?.peerAccepted) hooks.notify(t('El otro jugador ha aceptado el intercambio.'));
    const changed=!before || before.id!==next?.id || before.revision!==next?.revision;
    const redraw=force || changed || before?.status!==next?.status || before?.accepted!==next?.accepted || before?.peerAccepted!==next?.peerAccepted;
    current=value;
    if(next?.status==='cancelled') {
      if(dismissed!==next.id) hooks.notify(t(errors[next.reason ?? ''] ?? 'Intercambio cancelado.'));
      dismissed=next.id; backdrop.hidden=true;
      return;
    }
    if(next && (force || before?.id!==next.id || JSON.stringify(before.own)!==JSON.stringify(next.own))) {
      draft=structuredClone(next.own); dirty=false;
    }
    if(value.wallet && next?.status==='completed' && before?.status!=='completed') hooks.inventory(value);
    if(redraw) render();
  }
  async function act(action: string, offer?: TradeOffer, target?: string) {
    if(!character || busy) return;
    if(offer && (!Number.isSafeInteger(offer.pelines) || offer.pelines<0 || offer.items.some(item=>!Number.isSafeInteger(item.count)||item.count<1))) {
      announce(t(errors.TRADE_INVALID_OFFER),true); return;
    }
    const version=generation, id=character, trade=current?.trade ?? undefined;
    mutation++;
    setBusy(true); announce(t('Cargando…'));
    try {
      const value=await requestTrade(id,action,action==='invite' ? undefined : trade,target,offer);
      if(!live(version,id)) return;
      announce(''); receive(value,true);
    } catch(error) {
      if(live(version,id)) { announce(message(error),true); if(backdrop.hidden) hooks.notify(message(error)); }
    } finally { if(version===generation) setBusy(false); }
  }
  async function poll() {
    const version=generation, requestMutation=mutation, id=character;
    if(!id) return;
    if(!busy) {
      try {
        const value=await requestTrade(id,'state');
        if(live(version,id) && requestMutation===mutation && !busy) receive(value);
      } catch(error) {
        if(live(version,id)) {
          if(!backdrop.hidden) announce(message(error),true);
          else console.error('Trade synchronization failed:',error);
        }
      }
    }
    if(version===generation) timer=setTimeout(()=>void poll(),1000);
  }
  document.addEventListener('brumaluz-language-change',()=>{if(!backdrop.hidden) render();});
  return {
    get isOpen(){return !backdrop.hidden;},
    setCharacter(id: string | null) {
      if(id===character) return;
      generation++; clearTimeout(timer); character=id; busy=false; current=null; dismissed=null; dirty=false;
      backdrop.hidden=true;
      if(id) void poll();
    },
    async invite(target: string) {
      const finish = beginTransition('Preparando intercambio…');
      try { await act('invite',undefined,target); } finally { finish(); }
    },
    key(event: KeyboardEvent) {
      if(event.code==='Tab') {
        const controls=Array.from(panel.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button:not(:disabled):not([hidden]),input:not(:disabled)'));
        const first=controls[0], last=controls[controls.length-1];
        if(first && event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
        else if(last && !event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
      }
      if(event.code==='Escape') {
        event.preventDefault();
        const tr=current?.trade;
        if(tr?.status==='completed' || tr?.status==='cancelled') { dismissed=tr.id; render(); }
        else if(tr?.status==='invited') void act('cancel');
        else if(tr && (hasOffer(tr.own) || tr.accepted || dirty)) void withdrawOffer();
        else void act('cancel');
      }
    },
  };
}
