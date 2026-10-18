import { CLASSES } from '../data/data';
import { observeParty, getParty, isPartyLeader, partySelf, inviteToParty, answerPartyInvite, exitParty, type PartyMember } from '../services/party';
import { classIcon } from './classIcons';
import { t } from './i18n';

export function partyMemberCard(member: PartyMember, leader: boolean, compact = false) {
  const row=document.createElement('article');
  row.className=compact ? 'party-member party-member-compact' : 'party-member';
  row.dataset.userId=member.userId;
  const emblem=document.createElement('span');
  emblem.className='party-class';
  emblem.innerHTML=classIcon(member.data.cls,`party-${compact?'hud':'social'}-${member.characterId}`);
  emblem.setAttribute('role','img');emblem.setAttribute('aria-label',t(CLASSES[member.data.cls].label));
  const details=document.createElement('div');
  details.className='party-member-details';
  const heading=document.createElement('div');
  heading.className='party-member-name';
  const name=document.createElement('strong');name.textContent=member.data.name;
  const level=document.createElement('span');level.textContent=t('Nivel {n}',{n:member.data.level});
  heading.append(name,level);
  if(leader) {
    const crown=document.createElement('span');crown.className='party-leader';crown.setAttribute('aria-label',t('Líder'));
    crown.title=t('Líder');
    crown.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5 5 4-8 4 8 5-5-2 14H5Z"/><path d="M5 16h14"/></svg>';
    heading.prepend(crown);
  }
  details.append(heading);
  if(!compact) {const account=document.createElement('small');account.textContent=`~${member.username ?? ''} · ${t(member.location==='brumaluz'?'Brumaluz':member.location)}`;details.append(account);}
  for(const [kind,value,max] of [['health',member.vitals.health,member.vitals.maxHealth],[member.vitals.resourceKind,member.vitals.resource,member.vitals.maxResource]] as const) {
    const bar=document.createElement('div');bar.className=`party-bar ${kind}`;
    bar.setAttribute('role','meter');bar.setAttribute('aria-label',t(kind==='health'?'Vida':kind==='mana'?'Maná':'Estamina'));
    bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax',String(max));bar.setAttribute('aria-valuenow',String(value));
    const fill=document.createElement('i');fill.style.width=`${value/max*100}%`;
    const label=document.createElement('span');label.textContent=`${value} / ${max}`;
    bar.append(fill,label);details.append(bar);
  }
  row.append(emblem,details);
  return row;
}

export function renderPartyPanel(container: HTMLElement) {
  const list=document.createElement('div');list.className='party-panel-content';
  const message=document.createElement('p');message.className='account-message';message.setAttribute('role','status');
  container.replaceChildren(list,message);
  let closed=false,busy=false,signature='';
  async function run(action:()=>Promise<void>) {
    if(busy || closed)return;
    busy=true;for(const button of container.querySelectorAll('button'))button.disabled=true;
    try{await action();if(!closed){message.classList.remove('error');message.textContent='';signature='';render();}}
    catch(error){if(!closed){message.classList.add('error');message.textContent=t(error instanceof Error?error.message:String(error));}}
    finally{busy=false;if(!closed)for(const button of container.querySelectorAll('button'))button.disabled=false;}
  }
  function button(label:string, action:()=>Promise<void>) {
    const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=t(label);b.disabled=busy;b.onclick=()=>void run(action);return b;
  }
  function render() {
    const state=getParty(), key=JSON.stringify([state.id,state.members.map(m=>[m.characterId,m.data.name,m.data.level,m.data.cls,m.username,m.location,m.vitals]),state.incoming,state.outgoing]);
    if(signature===key)return;
    signature=key;
    const focused=document.activeElement;
    const draft=container.querySelector<HTMLInputElement>('.party-invite-input')?.value ?? '';
    const restore=focused?.classList.contains('party-invite-input');
    list.replaceChildren();
    const summary=document.createElement('h3');
    summary.textContent=state.id?t('Tu grupo · {n}/4',{n:state.members.length}):t('Comienza una aventura en grupo');
    list.append(summary);
    const bonus=document.createElement('p');bonus.className='party-bonus';
    const peers=Math.max(0,state.members.length-1);
    bonus.textContent=peers?t('Bonificación: +2% experiencia · +{n}% vida y recurso máximos',{n:Number((peers*1.5).toFixed(1))}):t('Con un compañero: +2% experiencia y +1,5% vida y recurso máximos.');
    list.append(bonus);
    for(const [index,member] of state.members.entries())list.append(partyMemberCard(member,index===0));
    for(const invite of state.incoming) {
      const row=document.createElement('div');row.className='party-invitation';
      const text=document.createElement('p');text.textContent=t('~{name} te invita a su grupo.',{name:invite.username});
      row.append(text,button('Aceptar',()=>answerPartyInvite(invite.id,true)),button('Rechazar',()=>answerPartyInvite(invite.id,false)));list.append(row);
    }
    if((!state.id || isPartyLeader()) && state.members.length<4) {
      const form=document.createElement('form');form.className='party-invite-form';
      const input=document.createElement('input');input.className='party-invite-input';input.placeholder=t('Nombre de cuenta');input.setAttribute('aria-label',t('Invitar a grupo'));input.required=true;input.maxLength=21;input.value=draft;
      const invite=button('Invitar a grupo',()=>inviteToParty(input.value));invite.type='submit';invite.onclick=null;
      form.append(input,invite);form.onsubmit=e=>{e.preventDefault();void run(()=>inviteToParty(input.value));};list.append(form);
      if(restore)input.focus();
    } else {
      const note=document.createElement('p');note.textContent=t(state.members.length===4?'El grupo está lleno (4 jugadores).':'Solo el líder puede invitar al grupo.');list.append(note);
    }
    for(const invite of state.outgoing){const p=document.createElement('p');p.className='party-pending';p.textContent=t('Invitación pendiente para ~{name}',{name:invite.username});list.append(p);}
    if(state.id)list.append(button('Salir del grupo',exitParty));
  }
  const off=observeParty(render);
  return ()=>{closed=true;off();};
}

export function initPartyHud() {
  const root=document.createElement('aside');root.id='party-hud';root.setAttribute('aria-label',t('Grupo'));document.body.append(root);
  let signature='';
  return observeParty(state=>{
    const members=state.members.filter(member=>member.userId!==partySelf());
    const key=JSON.stringify(members.map(member=>[member.characterId,member.data.name,member.data.level,member.data.cls,member.vitals,member.userId===state.members[0]?.userId]));
    if(signature===key)return;signature=key;
    root.replaceChildren(...members.map(member=>partyMemberCard(member,member.userId===state.members[0]?.userId,true)));
  });
}
