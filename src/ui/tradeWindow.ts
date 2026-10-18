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
  function render() {
    const tr=current?.trade;
    if(!tr || dismissed===tr.id) { backdrop.hidden=true; return; }
    const wasHidden=backdrop.hidden;
    backdrop.hidden=false;
    if(wasHidden) hooks.opened();
    content.replaceChildren();
    const title=line('Intercambio','h2'); title.className='trade-title';
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
      content.append(line(tr.incoming ? 'Te invita a intercambiar objetos y pelines.' : 'Esperando a que acepte la invitación…'));
      if(tr.incoming) content.append(button('Abrir intercambio',()=>void act('join')));
      content.append(button('Cancelar',()=>void act('cancel')));
      return;
    }
    content.append(line('Solo pelines y objetos intercambiables. Cada cambio retira ambas aceptaciones.'));
    const columns=document.createElement('div'); columns.className='trade-columns';
    const mine=document.createElement('section'); mine.append(line('Tu mochila intercambiable','h3'));
    const grid=document.createElement('div'); grid.className='trade-inventory';
    current!.inventory.forEach((stack,slot)=>{
      if(!stack || stack.bound || itemDef(stack.id)?.bound || !itemDef(stack.id)) return;
      const cell=document.createElement('label'); cell.className='trade-item';
      const icon=document.createElement('span'); icon.innerHTML=itemIcon(stack.id); setItemTooltip(icon,stack.id,stack.bound);
      const label=document.createElement('span'); label.textContent=`${t(itemLabel(stack.id))} ×${stack.count}`;
      const input=document.createElement('input'); input.type='number'; input.min='0'; input.max=String(stack.count); input.step='1';
      input.dataset.locked=String(tr.accepted);
      input.value=String(draft.items.find(item=>item.slot===slot)?.count ?? 0);
      input.setAttribute('aria-label',`${t('Ofrecer')} ${t(itemLabel(stack.id))} (${slot+1})`);
      input.oninput=()=>{
        dirty=true; draft.items=draft.items.filter(item=>item.slot!==slot);
        if(input.value!=='' && Number(input.value)!==0) draft.items.push({slot,id:stack.id,count:Number(input.value)});
        markDirty();
      };
      cell.append(icon,label,input); grid.append(cell);
    });
    mine.append(grid);
    const money=document.createElement('label'); money.className='trade-money';
    money.innerHTML=currencyIcon('pelines'); money.append(`${t('Pelines')} (${current!.wallet?.pelines ?? 0}) `);
    const input=document.createElement('input'); input.type='number'; input.min='0'; input.step='1';
    input.dataset.locked=String(tr.accepted);
    input.max=String(current!.wallet?.pelines ?? 0); input.value=String(draft.pelines);
    input.setAttribute('aria-label',t('Pelines ofrecidos'));
    input.oninput=()=>{draft.pelines=input.value==='' ? NaN : Number(input.value);dirty=true;markDirty();};
    money.append(input); mine.append(money);
    const save=button('Actualizar oferta',()=>void act('offer',draft)); save.dataset.tradeSave=''; save.dataset.locked=String(tr.accepted); mine.append(save);
    const peer=document.createElement('section'); peer.className='trade-peer-offer'; peer.append(line('Su oferta','h3'));
    for(const entry of tr.peer.items) {
      const row=document.createElement('div'); row.className='trade-offer-item';
      const icon=document.createElement('span'); icon.innerHTML=itemIcon(entry.id); setItemTooltip(icon,entry.id);
      const label=document.createElement('span'); label.textContent=`${t(itemLabel(entry.id))} ×${entry.count}`;
      row.append(icon,label); peer.append(row);
    }
    if(!tr.peer.items.length) peer.append(line('Sin objetos'));
    const coins=document.createElement('p'); coins.innerHTML=currencyIcon('pelines'); coins.append(` ${tr.peer.pelines} ${t('Pelines')}`); peer.append(coins);
    peer.append(line(tr.peerAccepted ? '✓ El otro jugador ha aceptado.' : 'Esperando su aceptación…'));
    columns.append(mine,peer); content.append(columns);
    const ownSummary=line('Tu oferta','h3'); content.append(ownSummary);
    const summary=document.createElement('p');
    summary.textContent=[...tr.own.items.map(item=>`${t(itemLabel(item.id))} ×${item.count}`),`${tr.own.pelines} ${t('Pelines')}`].join(' · ');
    content.append(summary,line(tr.accepted ? '✓ Has aceptado. Atrás retira tu aceptación.' : 'Revisa ambas ofertas antes de aceptar.'));
    const footer=document.createElement('footer');
    const accept=button('Aceptar intercambio',()=>void act('accept')); accept.dataset.tradeAccept='';
    accept.dataset.locked=String(dirty || tr.accepted);
    footer.append(accept,button('Atrás',()=>void act('back')),button('Cancelar',()=>void act('cancel')));
    content.append(footer); markDirty(); setBusy(busy);
    if(wasHidden) content.querySelector<HTMLButtonElement>('button')?.focus();
  }
  function markDirty() {
    const accept=content.querySelector<HTMLButtonElement>('[data-trade-accept]');
    if(accept) { accept.dataset.locked=String(dirty || !!current?.trade?.accepted); accept.disabled=busy || accept.dataset.locked==='true'; }
    if(dirty) announce(t('Cambios sin enviar. Pulsa Actualizar oferta.'));
  }
  function receive(value: TradeState, force=false) {
    const before=current?.trade, next=value.trade;
    if(next?.peerAccepted && !before?.peerAccepted) hooks.notify(t('El otro jugador ha aceptado el intercambio.'));
    const changed=!before || before.id!==next?.id || before.revision!==next?.revision;
    const redraw=force || changed || before?.status!==next?.status || before?.accepted!==next?.accepted || before?.peerAccepted!==next?.peerAccepted;
    current=value;
    if(next && (changed || force)) { draft=structuredClone(next.own); dirty=false; }
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
        const controls=Array.from(panel.querySelectorAll<HTMLButtonElement|HTMLInputElement>('button:not(:disabled),input:not(:disabled)'));
        const first=controls[0], last=controls[controls.length-1];
        if(first && event.shiftKey && document.activeElement===first) { event.preventDefault(); last.focus(); }
        else if(last && !event.shiftKey && document.activeElement===last) { event.preventDefault(); first.focus(); }
      }
      if(event.code==='Escape') {
        event.preventDefault();
        const tr=current?.trade;
        if(tr?.status==='completed' || tr?.status==='cancelled') { dismissed=tr.id; render(); }
        else void act(tr?.status==='invited' ? 'cancel' : 'back');
      }
    },
  };
}
