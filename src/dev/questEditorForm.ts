import type { QuestCatalog, QuestDefinition, QuestObjective, QuestPhase, QuestReferences } from '../data/questCatalog';

export const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
export const steps = [
  { name:'El encargo', title:'¿Quién necesita ayuda?', help:'Ponle un nombre a la misión y elige quién la ofrece. Los detalles de nivel y acceso son opcionales.' },
  { name:'Objetivos', title:'¿Qué tiene que hacer el jugador?', help:'Elige qué debe recoger, a quién debe derrotar o con quién debe hablar. El regreso al contacto ya forma parte de la entrega.' },
  { name:'Conversaciones', title:'Dale voz a los personajes', help:'Escribe qué dice el NPC en cada momento. Las respuestas para aceptar y entregar ya están preparadas.' },
  { name:'Recompensas', title:'¿Qué recibe por ayudar?', help:'Configura las recompensas que se entregan al terminar. Puedes dejar cualquier cantidad en cero.' },
  { name:'Revisar y probar', title:'Comprueba cómo queda', help:'Revisa el recorrido y prueba la conversación antes de guardar. La prueba es local y no gasta objetos ni cambia cuentas.' },
];
export const phaseLabels: Record<QuestPhase, { name: string; help: string; example: string }> = {
  offer:{name:'Al ofrecerla',help:'La primera conversación: explica qué necesita el personaje y por qué pide ayuda.',example:'Ejemplo: «Me falta madera para terminar esto. ¿Me traes tres troncos?»'},
  active:{name:'Mientras está pendiente',help:'Qué responde si el jugador vuelve sin haber cumplido todos los objetivos.',example:'Ejemplo: «¿Has conseguido lo que te pedí? Todavía me hacen falta las tres piezas.»'},
  ready:{name:'Al entregarla',help:'El agradecimiento cuando el jugador vuelve con todos los objetivos cumplidos.',example:'Ejemplo: «¡Justo lo que necesitaba! Toma, esto es por las molestias.»'},
  completed:{name:'Después de terminar',help:'Qué dice el personaje cuando el jugador vuelve después de recibir la recompensa.',example:'Ejemplo: «Gracias por lo de antes. ¡Me has ahorrado un buen paseo!»'},
};
type Option = {id: string; name: string};
let pickerSequence = 0;
export function options(list: Option[], current: string, empty?: string) {
  return (empty !== undefined ? `<option value="" ${!current ? 'selected' : ''}>${escape(empty)}</option>` : '') +
    (!list.some(v => v.id === current) && current ? `<option selected value="${escape(current)}">No disponible: ${escape(current)}</option>` : '') +
    list.map(v => `<option value="${escape(v.id)}" ${v.id === current ? 'selected' : ''}>${escape(v.name)}</option>`).join('');
}
export function field(label: string, path: string, value: string | number, type = 'text', readonly = false, hint = '') {
  const min = /minLevel|\.count$/.test(path) ? 1 : 0;
  return `<label>${escape(label)}<input data-path="${path}" value="${escape(value)}" type="${type}" ${type === 'number' ? `min="${min}" max="1000000" step="1"` : `maxlength="${path.endsWith('.text') ? 300 : 120}"`} ${readonly ? 'readonly' : ''}>${hint ? `<small>${escape(hint)}</small>` : ''}</label>`;
}
export function select(label: string, path: string, list: Option[], value: string, empty?: string, search = false) {
  const key = `select-${path.replaceAll('.','-')}-${++pickerSequence}`;
  return `<div class="select-field">${search && list.length > 12 ? `<label class="picker-search">Buscar ${escape(label.toLowerCase())}<input type="search" data-filter-for="${key}" placeholder="Escribe para filtrar la lista…" aria-controls="${key}"><small data-filter-result="${key}"></small></label>` : ''}<label>${escape(label)}<select id="${key}" data-path="${path}">${options(list,value,empty)}</select></label></div>`;
}
export function area(label: string, path: string, value: string, max = 4000, hint = '') { return `<label>${escape(label)}<textarea data-path="${path}" maxlength="${max}">${escape(value)}</textarea>${hint ? `<small>${escape(hint)}</small>` : ''}</label>`; }
export const button = (action: string, label: string, index = '', extra = '') => `<button type="button" data-action="${action}" data-index="${index}" ${extra}>${label}</button>`;
const guide = (text: string) => `<div class="help-note">${text}</div>`;
export function objectiveDescription(o: QuestObjective, refs: QuestReferences) {
  const name = refs[o.type === 'fetch' ? 'items' : o.type === 'kill' ? 'enemies' : 'npcs'].find(v => v.id === o.target)?.name;
  if (!name) return o.type === 'fetch' ? 'Elige un objeto para concretar el encargo.' : o.type === 'kill' ? 'Elige un enemigo para concretar el encargo.' : 'Elige con quién hay que hablar.';
  return o.type === 'fetch' ? `Reúne ${o.count || 0} × ${name}.` : o.type === 'kill' ? `Derrota ${o.count || 0} × ${name}.` : `Habla con ${name}.`;
}

function objectives(q: QuestDefinition, refs: QuestReferences) {
  return guide('Para una misión de «mata 3 y vuelve» solo necesitas un objetivo de combate. No añadas otro para volver: el jugador entrega el encargo al contacto elegido en el primer paso.') +
    q.objectives.map((o,i) => `<section class="entry objective-card"><div class="card-heading"><h3><span class="number">${i+1}</span> ${o.type === 'fetch' ? 'Recoger objetos' : o.type === 'kill' ? 'Derrotar enemigos' : 'Hablar con alguien'}</h3>${button('objective-delete','Quitar',String(i),q.objectives.length === 1 ? 'disabled title="La misión necesita al menos un objetivo"' : '')}</div>
      ${select('¿Qué debe hacer?',`objectives.${i}.type`,[{id:'fetch',name:'Recoger objetos'},{id:'kill',name:'Derrotar enemigos'},{id:'talk',name:'Hablar con alguien'}],o.type)}
      ${select(o.type === 'fetch' ? 'Objeto que debe conseguir' : o.type === 'kill' ? 'Enemigo que debe derrotar' : 'Persona con la que debe hablar',`objectives.${i}.target`,refs[o.type === 'fetch' ? 'items' : o.type === 'kill' ? 'enemies' : 'npcs'],o.target,'Elige una opción…',true)}
      ${o.type !== 'talk' ? field(o.type === 'fetch' ? '¿Cuántos objetos?' : '¿Cuántos enemigos?',`objectives.${i}.count`,o.count,'number') : ''}
      <div class="objective-preview"><small>Así lo verá el jugador</small><p data-objective-preview="${i}">${escape(o.description)}</p></div>
      ${o.type === 'fetch' ? `<label class="check"><input type="checkbox" data-path="objectives.${i}.consume" ${o.consume ? 'checked' : ''}>El jugador entrega estos objetos y los pierde de la mochila.</label><p class="muted">Si lo desmarcas, solo se comprueba que los tenga. Puede conseguirlos antes de aceptar la misión.</p>` : `<p class="muted">${o.type === 'kill' ? 'Las derrotas' : 'Las conversaciones'} cuentan después de aceptar el encargo.</p>`}
      <details><summary>Ajustar texto${o.type !== 'fetch' ? ' o lugar' : ''}</summary>${area('Texto del objetivo en el diario',`objectives.${i}.description`,o.description,500,'Se propone automáticamente al elegir el objetivo. Aquí puedes escribir tu propia versión.')}${o.type !== 'fetch' ? select('¿Solo cuenta en un lugar concreto?',`objectives.${i}.map`,refs.maps,o.map,'En cualquier mapa',true) : ''}
      ${q.objectives.length > 1 ? `<div class="actions">${button('objective-up','Subir',String(i),i === 0 ? 'disabled' : '')}${button('objective-down','Bajar',String(i),i === q.objectives.length-1 ? 'disabled' : '')}</div>` : ''}</details></section>`).join('') +
    `<div class="add-objective"><h3>¿También tiene que hacer algo más?</h3><p class="muted">Añade solo lo que necesite este encargo. Si hay varios objetivos, tendrá que cumplirlos todos, en cualquier orden.</p><div class="actions">${button('objective-add','+ Recoger objetos','','data-type="fetch"')}${button('objective-add','+ Derrotar enemigos','','data-type="kill"')}${button('objective-add','+ Hablar con alguien','','data-type="talk"')}</div></div>`;
}

function conversations(q: QuestDefinition, refs: QuestReferences, phase: QuestPhase) {
  const info = phaseLabels[phase];
  const index = q.dialogue.nodes.findIndex(n => n.id === q.dialogue.entries[phase]);
  const n = q.dialogue.nodes[index];
  const tabs = `<div class="phase-tabs" role="tablist" aria-label="Momento de la conversación">${Object.entries(phaseLabels).map(([p,v]) => `<button type="button" role="tab" data-phase="${p}" aria-selected="${phase === p}">${v.name}</button>`).join('')}</div>`;
  if (!n) return tabs + guide('Falta la conversación de este momento. Puedes elegirla en las conexiones avanzadas.') + advancedDialogue(q,refs);
  const textPath = `dialogue.nodes.${index}`;
  const contact = refs.npcs.find(v => v.id === (phase === 'offer' ? q.giver : q.receiver))?.name ?? 'el contacto';
  return tabs + `<section class="conversation-sheet"><span class="eyebrow">Habla ${escape(n.speaker ? refs.npcs.find(v => v.id === n.speaker)?.name ?? n.speaker : contact)}</span><h3>${info.name}</h3><p class="muted">${info.help}</p>
    ${area('¿Qué dice el personaje?',`${textPath}.text`,n.text,4000,info.example)}
    ${n.choices.map((c,j) => {
      const path = `${textPath}.choices.${j}`;
      if (c.action !== 'none') return `<div class="reply-card"><span class="reply-kind">${c.action === 'accept' ? '✓ Aceptar el encargo' : '✓ Entregar y recibir la recompensa'}</span>${field('¿Qué responde el jugador?',`${path}.text`,c.text)}<p class="muted">${c.action === 'accept' ? 'Esta respuesta acepta la misión. Salir del diálogo no la acepta.' : 'Esta respuesta completa la misión cuando se han cumplido todos los objetivos.'}</p></div>`;
      if (!c.next) return `<details><summary>Respuesta para despedirse</summary>${field('¿Qué responde el jugador?',`${path}.text`,c.text)}</details>`;
      const answerIndex = q.dialogue.nodes.findIndex(v => v.id === c.next); const answer = q.dialogue.nodes[answerIndex];
      if (!answer) return guide('Hay una pregunta sin respuesta conectada. Revísala en las conexiones avanzadas.');
      return `<section class="question-card"><div class="card-heading"><h3>Pregunta opcional</h3>${button('question-delete','Quitar',`${index}.${j}`)}</div>
        ${field('El jugador pregunta…',`${path}.text`,c.text)}${area('El personaje responde…',`dialogue.nodes.${answerIndex}.text`,answer.text)}
        <details><summary>¿Responde otra persona?</summary>${select('Quién responde',`dialogue.nodes.${answerIndex}.speaker`,refs.npcs,answer.speaker,'Contacto de la misión')}</details>
        <p class="muted">${answer.choices.length === 1 && answer.choices[0].next === n.id && answer.choices[0].action === 'none' ? 'Después de la respuesta se vuelve a esta conversación, sin aceptar ni entregar el encargo.' : 'Esta respuesta tiene una continuación personalizada. Puedes editarla en las conexiones avanzadas.'}</p></section>`;
    }).join('')}
    <div class="add-question">${button('question-add','+ Añadir una pregunta opcional',String(index))}<p class="muted">Por ejemplo: «¿Para qué lo necesitas?». Escribes la pregunta y la respuesta; el regreso se conecta solo.</p></div>
    <details><summary>¿Habla otra persona en esta conversación?</summary>${select('Personaje que habla',`${textPath}.speaker`,refs.npcs,n.speaker,'Usar el contacto de la misión')}</details></section>` + advancedDialogue(q,refs);
}
function advancedDialogue(q: QuestDefinition, refs: QuestReferences) {
  const nodes = q.dialogue.nodes.map(n => ({id:n.id,name:`${q.dialogue.entries.offer === n.id ? 'Oferta' : q.dialogue.entries.active === n.id ? 'Pendiente' : q.dialogue.entries.ready === n.id ? 'Entrega' : q.dialogue.entries.completed === n.id ? 'Despedida' : 'Respuesta'}: ${n.text.slice(0,45)} (${n.id})`}));
  return `<details class="advanced-dialogue"><summary>Conexiones avanzadas de la conversación</summary><p class="muted">Para conversaciones con varias ramas. No necesitas modificar esto para un encargo sencillo. Las conversaciones existentes se conservan.</p><div class="fields">${Object.entries(phaseLabels).map(([phase,info]) => select(info.name,`dialogue.entries.${phase}`,nodes,q.dialogue.entries[phase as QuestPhase])).join('')}</div>
    ${q.dialogue.nodes.map((n,i) => `<section class="entry"><h3>${escape(n.id)}</h3>${select('Quién habla',`dialogue.nodes.${i}.speaker`,refs.npcs,n.speaker,'Contacto de la misión')}${area('Texto',`dialogue.nodes.${i}.text`,n.text)}
    ${n.choices.map((c,j) => `<div class="choice">${field('Respuesta del jugador',`dialogue.nodes.${i}.choices.${j}.text`,c.text)}<div class="fields">${select('Qué ocurre al elegirla',`dialogue.nodes.${i}.choices.${j}.action`,[{id:'none',name:'Solo conversar'},{id:'accept',name:'Aceptar misión'},{id:'complete',name:'Completar y cobrar'}],c.action)}${select('Continuar en…',`dialogue.nodes.${i}.choices.${j}.next`,nodes,c.next,'Cerrar conversación')}</div>${button('choice-delete','Quitar respuesta',`${i}.${j}`)}</div>`).join('')}<div class="actions">${button('choice-add','+ Respuesta',String(i))}${button('node-delete','Quitar conversación',String(i))}</div></section>`).join('')}${button('node-add','+ Conversación')}</details>`;
}

export function renderForm(q: QuestDefinition, refs: QuestReferences, catalog: QuestCatalog, originalId: string, phase: QuestPhase) {
  const start = `${field('Nombre de la misión','title',q.title,'text',false,'Ejemplo: «Madera para el taller». Es el nombre que verá el jugador.')}${area('¿De qué trata el encargo?','summary',q.summary,4000,'Una o dos frases para el diario. Ejemplo: «El taller necesita madera. Reúne tres troncos y vuelve con el artesano.»')}
    ${select('¿Quién pide ayuda?','giver',refs.npcs,q.giver,undefined,true)}<label class="check"><input type="checkbox" id="same-contact" ${q.giver === q.receiver ? 'checked' : ''}>Se vuelve a esta misma persona para terminar.</label>
    <div id="receiver-field" ${q.giver === q.receiver ? 'hidden' : ''}>${select('¿A quién se entrega la misión?','receiver',refs.npcs,q.receiver,undefined,true)}</div>
    <details><summary>¿Hace falta nivel o haber completado otra misión?</summary>${field('Nivel mínimo','minLevel',q.minLevel,'number',false,'Déjalo en 1 para permitir que cualquier personaje la acepte.')}<h3>Misiones que debe haber terminado</h3><p class="muted">Marca solo las necesarias. Sin marcar ninguna, la misión es independiente.</p>${catalog.quests.filter(p => p.id !== q.id).map(p => `<label class="check"><input type="checkbox" data-prerequisite="${escape(p.id)}" ${q.prerequisites.includes(p.id) ? 'checked' : ''}>${escape(p.title)}</label>`).join('') || '<p class="muted">Todavía no hay otras misiones guardadas para elegir.</p>'}</details>
    <details><summary>Notas internas y referencia técnica</summary>${area('Notas para ti (no las ve el jugador)','notes',q.notes,8000)}${field('Referencia interna automática','id',q.id,'text',!!originalId,'No necesitas cambiarla. Se conserva para enlazar esta misión con otras.')}</details>`;
  const rewards = `${guide('La recompensa se recibe una sola vez, al entregar la misión. Recoger los objetos o derrotar al último enemigo todavía no paga el encargo.')}<div class="fields">${field('Experiencia (XP)','rewards.experience',q.rewards.experience,'number',false,'0 significa que no da experiencia.')}${field('Monedas (Pelines)','rewards.pelines',q.rewards.pelines,'number',false,'Es la cantidad total al entregar.')}</div>
    <h3>Objetos de regalo <span class="optional">Opcional</span></h3><p class="muted">Puedes dar una recompensa solo en monedas o experiencia. No es obligatorio añadir objetos.</p>${q.rewards.items.map((r,i) => `<section class="entry">${select('Objeto de recompensa',`rewards.items.${i}.item`,refs.items,r.item,'Elige un objeto…',true)}${field('Cantidad',`rewards.items.${i}.count`,r.count,'number')}${button('reward-delete','Quitar objeto',String(i))}</section>`).join('')}${button('reward-add','+ Añadir un objeto de regalo')}`;
  return [start,objectives(q,refs),conversations(q,refs,phase),rewards,
    `<div id="review-content"></div><div class="help-note"><strong>¿Cómo se prueba?</strong><p>En «Juega tu conversación», pulsa Empezar prueba. Acepta la misión, usa los botones de objetivo para simular lo que hace el jugador y vuelve al contacto para entregarla.</p></div>`]
    .map((body,index) => `<section data-panel="${index}" id="step-panel-${index}" aria-labelledby="step-heading-${index}"><div class="step-intro"><span class="eyebrow">Paso ${index+1} de ${steps.length}</span><h3 id="step-heading-${index}" tabindex="-1">${steps[index].title}</h3><p>${steps[index].help}</p></div>${body}</section>`).join('');
}
