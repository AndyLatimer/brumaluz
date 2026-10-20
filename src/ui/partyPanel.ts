import { CLASSES, locationName } from '../data/data';
import { observeParty, getParty, isPartyLeader, partySelf, inviteToParty, answerPartyInvite, exitParty, type PartyMember } from '../services/party';
import { classIcon } from './classIcons';
import { t } from './i18n';

const PARTY_ICONS = {
  crest: '<path d="m12 2 8 3v7c0 5-5 8-8 10-3-2-8-5-8-10V5Z"/><path d="m8 7 8 10M16 7 8 17M7 10l3-3m4 0 3 3"/><path d="M12 2v3m-3 14 3 3 3-3"/>',
  location: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/><path d="m20 2 1 3 3 1M2 18l1 3 3 1"/>',
  heart: '<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1A5 5 0 0 1 22 8c0 7-10 13-10 13Z"/><path d="M5 12h4l2-4 3 8 2-4h3"/>',
  invite: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 12-5m4-2v10m-5-5h10"/>',
};
function partyIcon(kind: keyof typeof PARTY_ICONS) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('party-icon');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=PARTY_ICONS[kind];
  return svg;
}

export function partyMemberCard(member: PartyMember, leader: boolean, compact = false) {
  const row=document.createElement('article');
  row.className=compact ? 'party-member party-member-compact' : 'party-member';
  row.dataset.userId=member.userId;
  row.classList.toggle('is-leader',leader);
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
  if(!compact) {
    const identity=document.createElement('div');identity.className='party-member-identity';
    const account=document.createElement('small');account.textContent=`~${member.username ?? ''}`;
    const location=document.createElement('small');location.append(partyIcon('location'),document.createTextNode(t(locationName(member.location))));
    identity.append(account,location);details.append(identity);
    const role=document.createElement('span');role.className='party-member-role';
    role.textContent=t(leader?'Líder del grupo':CLASSES[member.data.cls].label);details.insertBefore(role,identity);
  }
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
    const banner=document.createElement('header');banner.className='party-banner';
    const crest=document.createElement('span');crest.className='party-banner-crest';crest.append(partyIcon('crest'));
    const bannerText=document.createElement('div');bannerText.className='party-banner-text';
    const caption=document.createElement('span');caption.className='party-eyebrow';caption.textContent=t('Unidos por la aventura');
    bannerText.append(caption,summary);
    const seats=document.createElement('span');seats.className='party-seats';seats.setAttribute('aria-label',t('Integrantes: {n} de 4',{n:state.members.length}));
    for(let i=0;i<4;i++){const seat=document.createElement('i');seat.classList.toggle('filled',i<state.members.length);seats.append(seat);}
    banner.append(crest,bannerText,seats);list.append(banner);
    const bonus=document.createElement('div');bonus.className='party-bonus';
    const peers=Math.max(0,state.members.length-1);
    bonus.classList.toggle('is-active',peers>0);
    bonus.setAttribute('aria-label',peers?t('Bonificación: +2% experiencia · +{n}% vida y recurso máximos',{n:Number((peers*1.5).toFixed(1))}):t('Con un compañero: +2% experiencia y +1,5% vida y recurso máximos.'));
    for(const [kind,value,label] of [['spark',peers?'+2%':'—','Experiencia'],['heart',peers?`+${Number((peers*1.5).toFixed(1))}%`:'—','Vida y recurso máximos']] as const) {
      const seal=document.createElement('div');seal.className='party-bonus-seal';
      const amount=document.createElement('strong');amount.textContent=value;
      const text=document.createElement('span');text.textContent=t(label);
      seal.append(partyIcon(kind),amount,text);bonus.append(seal);
    }
    list.append(bonus);
    const roster=document.createElement('div');roster.className='party-roster';
    for(const [index,member] of state.members.entries())roster.append(partyMemberCard(member,index===0));
    if(state.members.length<4) {
      const vacant=document.createElement('div');vacant.className='party-vacant';
      const text=document.createElement('span');text.textContent=t(state.members.length?'La próxima aventura espera compañía.':'Todo gran viaje empieza con un compañero.');
      vacant.append(partyIcon('invite'),text);roster.append(vacant);
    }
    list.append(roster);
    for(const invite of state.incoming) {
      const row=document.createElement('div');row.className='party-invitation';
      const text=document.createElement('p');text.textContent=t('~{name} te invita a su grupo.',{name:invite.username});
      const seal=document.createElement('span');seal.className='party-invitation-seal';seal.append(partyIcon('crest'));
      row.append(seal,text,button('Aceptar',()=>answerPartyInvite(invite.id,true)),button('Rechazar',()=>answerPartyInvite(invite.id,false)));list.append(row);
    }
    if((!state.id || isPartyLeader()) && state.members.length<4) {
      const form=document.createElement('form');form.className='party-invite-form';
      const input=document.createElement('input');input.className='party-invite-input';input.placeholder=t('Nombre de cuenta');input.setAttribute('aria-label',t('Invitar a grupo'));input.required=true;input.maxLength=21;input.value=draft;
      const invite=button('Invitar a grupo',()=>inviteToParty(input.value));invite.type='submit';invite.onclick=null;
      const field=document.createElement('label');field.className='party-invite-field';
      const prefix=document.createElement('span');prefix.textContent='~';prefix.setAttribute('aria-hidden','true');
      field.append(prefix,input);invite.prepend(partyIcon('invite'));
      form.append(field,invite);form.onsubmit=e=>{e.preventDefault();void run(()=>inviteToParty(input.value));};list.append(form);
      if(restore)input.focus();
    } else {
      const note=document.createElement('p');note.textContent=t(state.members.length===4?'El grupo está lleno (4 jugadores).':'Solo el líder puede invitar al grupo.');list.append(note);
    }
    for(const invite of state.outgoing){const p=document.createElement('p');p.className='party-pending';p.textContent=t('Invitación pendiente para ~{name}',{name:invite.username});list.append(p);}
    if(state.id){const leave=button('Salir del grupo',exitParty);leave.classList.add('party-leave');list.append(leave);}
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
