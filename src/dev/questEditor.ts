import './questEditor.css';
import { renderForm, steps, phaseLabels, objectiveDescription, options, escape } from './questEditorForm';
import { newQuest, validateQuestCatalog, newRehearsal, objectiveProgress, questPhase, rehearseAction, rehearseEvent,
  type QuestCatalog, type QuestDefinition, type QuestReferences, type QuestObjective, type QuestPhase } from '../data/questCatalog';
import { openConversation, closeDialog, isDialogOpen, advanceDialog, exitDialog, moveDialogChoice } from '../ui/dialog';
import { questConversation } from '../story/questConversation';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const clone = <T>(value: T): T => structuredClone(value);
const storageKey = 'brumaluz-quest-editor-draft-v1';
let catalog: QuestCatalog = { version: 1, quests: [] };
let refs: QuestReferences = { npcs: [], items: [], enemies: [], maps: [] };
let draft = newQuest();
let originalId = '';
let revision = '';
let dirty = false;
let libraryDirty = false;
let saving = false;
let testQuest: QuestDefinition | null = null;
let testState = newRehearsal();
let testContext = { level: 1, completed: [] as string[] };
let currentStep = 0;
let editingPhase: QuestPhase = 'offer';
let showErrors = false;
const phaseNames: Record<QuestPhase, string> = { offer:'Oferta', active:'En curso', ready:'Lista para entregar', completed:'Completada' };

function status(text: string, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function persist() {
  try {
    if (dirty || libraryDirty) localStorage.setItem(storageKey, JSON.stringify({ catalog, draft, originalId, revision, libraryDirty, currentStep, editingPhase }));
    else localStorage.removeItem(storageKey);
  } catch { status('El navegador no pudo conservar el borrador. Exporta el JSON para conservarlo.', true); }
}
function markDirty() {
  dirty = true; $('dirty').textContent = 'Cambios sin guardar'; $('draft-title').textContent = draft.title || 'Sin título'; persist();
  if (testQuest) $('test-notice').textContent = 'La ficha ha cambiado. Inicia otro ensayo para probar esta versión.';
  renderOverview();
}
function discard() { return !dirty || confirm(libraryDirty
  ? '¿Descartar los cambios de esta ficha y continuar dentro de la biblioteca importada? Para descartar también la importación, usa Recargar.'
  : 'Hay cambios sin guardar en esta ficha. ¿Descartarlos para continuar?'); }
function workingCatalog(): QuestCatalog {
  const quests = catalog.quests.filter(q => q.id !== originalId);
  if (quests.some(q => q.id === draft.id)) throw new Error('Ya existe otra misión con ese ID.');
  return { version: 1, quests: [...quests, clone(draft)] };
}
function validated() { return validateQuestCatalog(workingCatalog(), refs); }
function renderLibrary() {
  const query = $<HTMLInputElement>('search').value.toLowerCase();
  $('quest-list').innerHTML = catalog.quests.filter(q => `${q.title} ${q.id}`.toLowerCase().includes(query)).map(q =>
    `<button type="button" data-quest="${escape(q.id)}" class="${q.id === originalId ? 'active' : ''}">${escape(q.title)}<small>${q.objectives.length} ${q.objectives.length === 1 ? 'objetivo' : 'objetivos'}</small></button>`).join('') || '<p class="empty-library">Tu primera misión empieza aquí. Elige un tipo de encargo y pulsa Crear misión.</p>';
}
function render() {
  $('draft-title').textContent = draft.title || 'Nueva misión';
  $('dirty').textContent = dirty || libraryDirty ? 'Borrador sin guardar' : 'Guardada';
  $<HTMLButtonElement>('delete').disabled = !originalId;
  $('fields').innerHTML = renderForm(draft,refs,catalog,originalId,editingPhase);
  const shortNames = ['Inicio','Tareas','Diálogo','Premios','Probar'];
  $('steps').innerHTML = steps.map((s,index) => `<button type="button" data-step="${index}" aria-controls="step-panel-${index}" aria-label="${index+1}. ${s.name}"><span class="step-number">${index+1}</span><span class="step-label">${s.name}</span><span class="step-short">${shortNames[index]}</span></button>`).join('');
  applyStep(); renderOverview(); renderLibrary();
}

type Issue = { step: number; path: string; text: string };
function issues(): Issue[] {
  const list: Issue[] = [];
  const add = (step: number, path: string, text: string) => list.push({step,path,text});
  if (!draft.title.trim()) add(0,'title','Ponle un nombre a la misión.');
  if (!draft.summary.trim()) add(0,'summary','Escribe una breve descripción para el diario.');
  for (const path of ['giver','receiver'] as const) if (!refs.npcs.some(n => n.id === draft[path])) add(0,path,path === 'giver' ? 'Elige quién ofrece el encargo.' : 'Elige a quién se entrega.');
  if (!Number.isInteger(draft.minLevel) || draft.minLevel < 1 || draft.minLevel > 10000) add(0,'minLevel','El nivel mínimo debe ser un número entero entre 1 y 10000.');
  if (!draft.objectives.length) add(1,'','Añade al menos un objetivo.');
  draft.objectives.forEach((o,i) => {
    const available = refs[o.type === 'fetch' ? 'items' : o.type === 'kill' ? 'enemies' : 'npcs'];
    if (!available.some(v => v.id === o.target)) add(1,`objectives.${i}.target`,`Objetivo ${i+1}: elige ${o.type === 'fetch' ? 'qué objeto recoger' : o.type === 'kill' ? 'qué enemigo derrotar' : 'con quién hablar'}.`);
    if (!Number.isInteger(o.count) || o.count < 1 || o.count > 9999) add(1,`objectives.${i}.count`,`Objetivo ${i+1}: indica una cantidad entera entre 1 y 9999.`);
    if (!o.description.trim()) add(1,`objectives.${i}.description`,`Objetivo ${i+1}: escribe el texto que verá el jugador.`);
  });
  draft.dialogue.nodes.forEach((n,i) => {
    if (!n.text.trim()) add(2,`dialogue.nodes.${i}.text`,'Hay una conversación sin texto. Escribe qué dice el personaje.');
    n.choices.forEach((c,j) => { if (!c.text.trim()) add(2,`dialogue.nodes.${i}.choices.${j}.text`,'Hay una respuesta del jugador sin escribir.'); });
  });
  for (const key of ['experience','pelines'] as const) if (!Number.isInteger(draft.rewards[key]) || draft.rewards[key] < 0 || draft.rewards[key] > 1000000) add(3,`rewards.${key}`,'Las recompensas deben ser números enteros entre 0 y 1000000.');
  draft.rewards.items.forEach((r,i) => {
    if (!refs.items.some(v => v.id === r.item)) add(3,`rewards.items.${i}.item`,`Regalo ${i+1}: elige un objeto.`);
    if (!Number.isInteger(r.count) || r.count < 1 || r.count > 9999) add(3,`rewards.items.${i}.count`,`Regalo ${i+1}: indica una cantidad entera entre 1 y 9999.`);
  });
  if (!list.length) try { validated(); } catch (error) {
    const text = (error as Error).message;
    add(/diálogo|nodo|oferta|entrega|aceptar|completar/i.test(text) ? 2 : /objetivo/i.test(text) ? 1 : /recompensa/i.test(text) ? 3 : 0,'',text);
  }
  return list;
}
function applyStep(focus = false) {
  document.querySelectorAll<HTMLElement>('[data-panel]').forEach(panel => { panel.hidden = Number(panel.dataset.panel) !== currentStep; });
  document.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b => {
    const active = Number(b.dataset.step) === currentStep;
    b.setAttribute('aria-current',active ? 'step' : 'false'); b.classList.toggle('active',active); b.disabled = saving;
  });
  $<HTMLButtonElement>('previous').disabled = currentStep === 0;
  $('next').hidden = currentStep === steps.length-1;
  $('next').textContent = `Siguiente: ${steps[Math.min(currentStep+1,steps.length-1)].name} →`;
  $('save').classList.toggle('primary',currentStep === steps.length-1);
  $('rehearsal').hidden = currentStep !== steps.length-1;
  if (focus) $(`step-heading-${currentStep}`).focus({preventScroll:true});
}
function goToStep(step: number, path = '') {
  currentStep = Math.max(0,Math.min(step,steps.length-1));
  if (currentStep !== 4) closeDialog();
  if (path.startsWith('dialogue.nodes.')) {
    const node = draft.dialogue.nodes[Number(path.split('.')[2])];
    const phase = (Object.keys(phaseLabels) as QuestPhase[]).find(p => draft.dialogue.entries[p] === node?.id || draft.dialogue.nodes.find(n => n.id === draft.dialogue.entries[p])?.choices.some(c => c.next === node?.id));
    if (phase) editingPhase = phase;
    render();
  }
  applyStep(true); renderOverview(); persist();
  if (path) {
    const input = [...document.querySelectorAll<HTMLElement>('[data-path]')].find(el => el.dataset.path === path);
    if (input) {
      let parent = input.parentElement;
      while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
      input.focus(); input.scrollIntoView({block:'center',behavior:'smooth'});
    }
  }
}
function renderOverview() {
  const name = (kind: keyof QuestReferences, id: string) => refs[kind].find(v => v.id === id)?.name ?? 'Por elegir';
  const errors = issues();
  const ready = [0,1,2,3].filter(step => !errors.some(e => e.step === step)).length;
  $('overview').innerHTML = `<span class="eyebrow">Tu misión de un vistazo</span><h2>${escape(draft.title || 'Tu próximo encargo')}</h2><ol class="journey"><li><span>Empieza con</span><strong>${escape(name('npcs',draft.giver))}</strong></li><li><span>El jugador debe</span>${draft.objectives.map(o => `<p>${escape(o.target ? o.description : objectiveDescription(o,refs))}</p>`).join('') || '<p>Añadir un objetivo.</p>'}</li><li><span>Vuelve con</span><strong>${escape(name('npcs',draft.receiver))}</strong></li></ol><div class="overview-rewards">${draft.rewards.experience || 0} XP · ${draft.rewards.pelines || 0} Pelines${draft.rewards.items.length ? `<br>${draft.rewards.items.length} ${draft.rewards.items.length === 1 ? 'objeto de regalo' : 'objetos de regalo'}` : ''}</div><p class="readiness">${ready} de 4 apartados preparados</p>`;
  $('review-content').innerHTML = `<div class="review-banner ${errors.length ? 'pending' : 'ready'}"><h3>${errors.length ? 'Quedan unos detalles por completar' : 'Todo preparado para probar y guardar'}</h3><p>${errors.length ? 'Pulsa sobre un detalle para ir directamente al campo que falta.' : 'Comprueba que el encargo se entiende y que las cantidades y recompensas encajan con lo que buscas.'}</p>${errors.length ? `<ul>${errors.map(e => `<li><button type="button" data-go-step="${e.step}" data-focus-path="${escape(e.path)}">${escape(e.text)}</button></li>`).join('')}</ul>` : ''}</div>
    <dl class="review-list"><div><dt>En el diario</dt><dd>${escape(draft.summary || 'Sin descripción')}</dd></div><div><dt>Quién puede aceptarla</dt><dd>Nivel ${draft.minLevel || 1}${draft.prerequisites.length ? `; después de ${draft.prerequisites.map(id => escape(catalog.quests.find(q => q.id === id)?.title ?? id)).join(', ')}` : '; sin misiones anteriores obligatorias'}.</dd></div><div><dt>Objetivos</dt><dd>${draft.objectives.map(o => `<p>${escape(o.description)}${o.map ? ` En ${escape(name('maps',o.map))}.` : ''}${o.type === 'fetch' ? o.consume ? ' Se entregan los objetos.' : ' El jugador conserva los objetos.' : ''}</p>`).join('')}</dd></div><div><dt>Recompensa</dt><dd>${draft.rewards.experience || 0} XP y ${draft.rewards.pelines || 0} Pelines${draft.rewards.items.map(r => `<p>${r.count || 0} × ${escape(name('items',r.item))}</p>`).join('')}</dd></div></dl>`;
  $('validation').hidden = !showErrors || !errors.length;
  if (showErrors) $('validation').innerHTML = `<strong>Revisa esto antes de guardar</strong><p>${escape(errors[0]?.text ?? '')}</p>`;
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll<HTMLElement>('[data-path]').forEach((input,index) => {
    const error = showErrors ? errors.find(e => e.path === input.dataset.path) : undefined;
    input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
    if (!error) return;
    input.setAttribute('aria-invalid','true'); const id = `field-error-${index}`; input.setAttribute('aria-describedby',id);
    const message = document.createElement('small'); message.id = id; message.className = 'field-error'; message.textContent = error.text; input.parentElement?.append(message);
  });
}

$('steps').onclick = event => { const step = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-step]')?.dataset.step; if (step !== undefined && !saving) goToStep(Number(step)); };
$('previous').onclick = () => goToStep(currentStep-1);
$('next').onclick = () => goToStep(currentStep+1);
document.addEventListener('click',event => {
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-go-step]'); if (b && !saving) goToStep(Number(b.dataset.goStep),b.dataset.focusPath);
});

function stopTest() { closeDialog(); testQuest = null; $('test-state').replaceChildren(); $('test-events').replaceChildren(); $<HTMLButtonElement>('test-talk').disabled = true; $('test-notice').textContent = ''; }
function chooseDraft(q: QuestDefinition, saved: boolean) { stopTest(); draft = clone(q); originalId = saved ? q.id : ''; dirty = !saved; currentStep = 0; editingPhase = 'offer'; showErrors = false; render(); persist(); }
function unusedId(prefix: string, ids: string[]) { let n = 1; while (ids.includes(`${prefix}_${n}`)) n++; return `${prefix}_${n}`; }

async function readResponse(response: Response) {
  const data = await response.json().catch(() => { throw new Error('Abre este taller con npm run dev; el servidor no devolvió JSON.'); });
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}
async function load() {
  const [response, referencesResponse] = await Promise.all([fetch('/__dev/quests'), fetch('/__dev/quests/references')]);
  const [data, referenceData] = await Promise.all([readResponse(response), readResponse(referencesResponse)]);
  catalog = validateQuestCatalog(data); refs = referenceData;
  revision = response.headers.get('ETag') || ''; libraryDirty = false;
  chooseDraft(catalog.quests[0] ?? createFromTemplate('nueva_mision'),!!catalog.quests.length);
  status(catalog.quests.length ? 'Biblioteca cargada del proyecto.' : 'Biblioteca vacía. Prepara tu primer encargo y guárdalo.');
}

async function saveCatalog(next: QuestCatalog) {
  if (saving) return;
  setBusy(true);
  try {
    const response = await fetch('/__dev/quests', { method:'PUT', headers:{'Content-Type':'application/json','If-Match':revision}, body:JSON.stringify(next) });
    const data = await readResponse(response);
    catalog = validateQuestCatalog(data); revision = response.headers.get('ETag') || ''; libraryDirty = false; dirty = false; originalId = draft.id;
    render(); persist(); status('Misión guardada. Puedes seguir editándola o crear otra.');
  } finally {
    setBusy(false);
  }
}
function setBusy(value: boolean) {
  saving = value; $<HTMLFieldSetElement>('editor-fields').disabled = value;
  for (const id of ['new','duplicate','reload','import']) $<HTMLButtonElement>(id).disabled = value;
  $<HTMLButtonElement>('delete').disabled = value || !originalId;
  applyStep();
}

const pickerOptions = new WeakMap<HTMLSelectElement, { id: string; name: string }[]>();
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
$('editor').addEventListener('input', event => {
  const input = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (input.dataset.filterFor) {
    const list = $<HTMLSelectElement>(input.dataset.filterFor);
    if (!pickerOptions.has(list)) pickerOptions.set(list,[...list.options].filter(o => o.value).map(o => ({id:o.value,name:o.textContent ?? ''})));
    const all = pickerOptions.get(list)!; const matches = all.filter(o => normalize(o.name).includes(normalize(input.value)));
    const selected = list.value; const visible = [...matches];
    const selectedOption = all.find(o => o.id === selected);
    if (selectedOption && !visible.some(o => o.id === selected)) visible.unshift(selectedOption);
    list.innerHTML = options(visible,selected,'Elige una opción…');
    const result = [...document.querySelectorAll<HTMLElement>('[data-filter-result]')].find(el => el.dataset.filterResult === input.dataset.filterFor);
    if (result) result.textContent = `${matches.length} ${matches.length === 1 ? 'coincidencia' : 'coincidencias'}${selectedOption && !matches.some(o => o.id === selected) ? ' · se conserva tu selección actual' : ''}`;
    return;
  }
  if (input.id === 'same-contact') {
    if ((input as HTMLInputElement).checked) draft.receiver = draft.giver;
    else draft.receiver = refs.npcs.find(n => n.id !== draft.giver)?.id ?? draft.giver;
    render(); markDirty(); return;
  }
  if (input.dataset.prerequisite) {
    draft.prerequisites = [...document.querySelectorAll<HTMLInputElement>('[data-prerequisite]:checked')].map(el => el.dataset.prerequisite!);
    markDirty(); return;
  }
  const path = input.dataset.path; if (!path) return;
  const sameContact = $<HTMLInputElement>('same-contact').checked;
  const objectiveIndex = /^objectives\.(\d+)\./.exec(path)?.[1];
  const objective = objectiveIndex !== undefined ? draft.objectives[Number(objectiveIndex)] : undefined;
  const wasAutomatic = objective && objective.description === objectiveDescription(objective,refs);
  const parts = path.split('.'); let target: any = draft;
  for (const part of parts.slice(0,-1)) target = target[part];
  target[parts.at(-1)!] = input instanceof HTMLSelectElement && input.multiple ? [...input.selectedOptions].map(o => o.value)
    : input instanceof HTMLInputElement && input.type === 'number' ? input.valueAsNumber
    : input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value;
  if (/^objectives\.\d+\.type$/.test(path)) {
    const o = target as QuestObjective;
    o.target = o.type === 'talk' ? draft.giver : '';
    o.consume = o.type === 'fetch'; o.map = ''; if (o.type === 'talk') o.count = 1;
    o.description = objectiveDescription(o,refs);
    render();
  }
  if (objective && !path.endsWith('.description') && wasAutomatic) {
    objective.description = objectiveDescription(objective,refs);
    const text = document.querySelector<HTMLElement>(`[data-objective-preview="${objectiveIndex}"]`); if (text) text.textContent = objective.description;
  }
  if (path === 'giver' && sameContact) draft.receiver = draft.giver;
  if (path === 'giver' || path === 'receiver') render();
  // Guided and advanced views edit the same data; keep both controls in sync.
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-path]').forEach(other => {
    const otherPath = other.dataset.path!;
    if (other !== input && otherPath === path) { if (other instanceof HTMLInputElement && other.type === 'checkbox') other.checked = (input as HTMLInputElement).checked; else other.value = input.value; }
    if (objective && wasAutomatic && otherPath === `objectives.${objectiveIndex}.description`) other.value = objective.description;
  });
  if (objective && path.endsWith('.description')) {
    const text = document.querySelector<HTMLElement>(`[data-objective-preview="${objectiveIndex}"]`); if (text) text.textContent = objective.description;
  }
  markDirty();
});
$('fields').addEventListener('click', event => {
  const phase = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-phase]')?.dataset.phase;
  if (phase) { editingPhase = phase as QuestPhase; render(); persist(); return; }
  const b = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]'); if (!b) return;
  const i = Number(b.dataset.index); const action = b.dataset.action;
  switch (action) {
    case 'objective-add': if (draft.objectives.length >= 20) { status('Máximo: 20 objetivos.',true); return; }
      { const type = (b.dataset.type ?? 'talk') as QuestObjective['type']; const o: QuestObjective = {id:unusedId('objetivo',draft.objectives.map(o => o.id)),type,target:type === 'talk' ? draft.giver : '',count:type === 'talk' ? 1 : 3,description:'',map:'',consume:type === 'fetch'}; o.description = objectiveDescription(o,refs); draft.objectives.push(o); } break;
    case 'objective-delete': if (draft.objectives.length > 1) draft.objectives.splice(i,1); break;
    case 'objective-up': [draft.objectives[i-1],draft.objectives[i]] = [draft.objectives[i],draft.objectives[i-1]]; break;
    case 'objective-down': [draft.objectives[i+1],draft.objectives[i]] = [draft.objectives[i],draft.objectives[i+1]]; break;
    case 'reward-add': draft.rewards.items.push({item:'',count:1}); break;
    case 'reward-delete': draft.rewards.items.splice(i,1); break;
    case 'node-add': draft.dialogue.nodes.push({id:unusedId('nodo',draft.dialogue.nodes.map(n => n.id)),speaker:'',text:'Escribe lo que quiere decir el personaje.',choices:[]}); break;
    case 'node-delete': {
      const node = draft.dialogue.nodes[i];
      if (Object.values(draft.dialogue.entries).includes(node.id) || draft.dialogue.nodes.some(n => n.choices.some(c => c.next === node.id))) { status('Este nodo se usa como inicio de fase o destino. Cambia esas conexiones antes de quitarlo.',true); return; }
      draft.dialogue.nodes.splice(i,1); break;
    }
    case 'choice-add': draft.dialogue.nodes[i].choices.push({text:'Nueva respuesta',next:'',action:'none'}); break;
    case 'choice-delete': { const [n,c] = b.dataset.index!.split('.').map(Number); draft.dialogue.nodes[n].choices.splice(c,1); break; }
    case 'question-add': {
      const entry = draft.dialogue.nodes[i];
      if (entry.choices.length >= 8 || draft.dialogue.nodes.length >= 100) { status('Esta conversación ha alcanzado el máximo de respuestas o conversaciones.',true); return; }
      const id = unusedId('pregunta',draft.dialogue.nodes.map(n => n.id));
      entry.choices.push({text:'¿Para qué lo necesitas?',next:id,action:'none'});
      draft.dialogue.nodes.push({id,speaker:'',text:'Escribe aquí la explicación del personaje.',choices:[{text:'Entendido, volvamos al encargo.',next:entry.id,action:'none'}]}); break;
    }
    case 'question-delete': {
      const [n,c] = b.dataset.index!.split('.').map(Number); const entry = draft.dialogue.nodes[n]; const targetId = entry.choices[c].next;
      entry.choices.splice(c,1);
      const answer = draft.dialogue.nodes.find(node => node.id === targetId);
      const automaticReturn = answer?.choices.length === 1 && answer.choices[0].next === entry.id && answer.choices[0].action === 'none';
      if (automaticReturn && !Object.values(draft.dialogue.entries).includes(targetId) && !draft.dialogue.nodes.some(node => node.choices.some(choice => choice.next === targetId))) draft.dialogue.nodes = draft.dialogue.nodes.filter(node => node.id !== targetId);
      break;
    }
  }
  markDirty(); render();
});
$('editor').addEventListener('submit', event => {
  event.preventDefault(); showErrors = true; const errors = issues();
  if (errors.length) { goToStep(errors[0].step,errors[0].path); status('Falta un detalle. Lo tienes señalado en el formulario.',true); return; }
  void (async () => { try { await saveCatalog(validated()); } catch (error) { status((error as Error).message,true); } })();
});
$('search').addEventListener('input',renderLibrary);
$('quest-list').addEventListener('click', event => {
  if (saving) return; const id = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-quest]')?.dataset.quest;
  if (!id || id === originalId || !discard()) return;
  // Reloading is the way to discard a staged library import.
  chooseDraft(catalog.quests.find(q => q.id === id)!,true);
});
function createFromTemplate(id: string) {
  const q = newQuest(id,refs.npcs.some(n => n.id === 'gnomi') ? 'gnomi' : refs.npcs[0]?.id);
  const type = $<HTMLSelectElement>('template').value as QuestObjective['type'];
  const o = q.objectives[0]; o.type = type; o.consume = type === 'fetch';
  o.target = type === 'talk' ? q.giver : '';
  o.count = type === 'talk' ? 1 : 3;
  o.description = objectiveDescription(o,refs);
  q.title = ''; q.summary = '';
  return q;
}
$('new').onclick = () => { if (discard()) chooseDraft(createFromTemplate(unusedId('mision',catalog.quests.map(q => q.id))),false); };
$('duplicate').onclick = () => { const copy = clone(draft); copy.id = unusedId('mision',catalog.quests.map(q => q.id)); copy.title += ' (copia)'; if (discard()) chooseDraft(copy,false); };
$('reload').onclick = () => { if (!(dirty || libraryDirty) || confirm('¿Descartar todos los cambios sin guardar y recargar la biblioteca del proyecto?')) { localStorage.removeItem(storageKey); void load().catch(error => status(error.message,true)); } };
$('delete').onclick = () => {
  if (!originalId || saving) return;
  if (libraryDirty) {
    const removed = originalId;
    if (catalog.quests.some(q => q.prerequisites.includes(removed))) { status('Otra misión requiere esta ficha. Quita ese requisito antes de eliminarla.',true); return; }
    if (!confirm(`¿Quitar «${draft.title}» de la biblioteca importada? La eliminación se aplicará al guardar.`)) return;
    catalog.quests = catalog.quests.filter(q => q.id !== removed);
    chooseDraft(catalog.quests[0] ?? createFromTemplate('nueva_mision'),!!catalog.quests.length);
    return;
  }
  if (!confirm(`¿Eliminar la ficha «${draft.title}» del proyecto?`)) return;
  void (async () => {
    try {
      const next = validateQuestCatalog({version:1,quests:catalog.quests.filter(q => q.id !== originalId)},refs);
      setBusy(true);
      const response = await fetch('/__dev/quests',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':revision},body:JSON.stringify(next)});
      const data = await readResponse(response); catalog = validateQuestCatalog(data); revision = response.headers.get('ETag') || ''; libraryDirty = false;
      chooseDraft(catalog.quests[0] ?? newQuest(),!!catalog.quests.length); status('Ficha eliminada del proyecto.');
    } catch(error) { status((error as Error).message,true); } finally { setBusy(false); }
  })();
};
$('export').onclick = () => {
  // Export raw drafts too, so a validation error never prevents recovering work.
  let value: QuestCatalog; try { value = workingCatalog(); } catch { value = {version:1,quests:[draft]}; }
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = 'brumaluz-misiones.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
};
$('import').onchange = async () => {
  const input = $<HTMLInputElement>('import'); const file = input.files?.[0]; if (!file) return;
  try {
    if (file.size > 4_000_000) throw new Error('El archivo supera los 4 MB.');
    const data = JSON.parse(await file.text());
    const next = validateQuestCatalog(data,refs);
    if (!next.quests.length) throw new Error('La biblioteca importada está vacía.');
    if ((dirty || libraryDirty) && !confirm('¿Sustituir todos los cambios sin guardar por esta biblioteca importada?')) return;
    catalog = next; libraryDirty = true; chooseDraft(next.quests[0],true); dirty = true; render(); persist();
    status('Biblioteca importada como borrador. Revisa las fichas y pulsa Guardar para sustituir la biblioteca del proyecto.');
  } catch(error) { status((error as Error).message,true); } finally { input.value = ''; }
};

function renderTest() {
  if (!testQuest) return;
  const q = testQuest; const phase = questPhase(q,testState);
  $('test-state').innerHTML = `<span class="pill">${phaseNames[phase]}</span><p>${escape(q.title)}</p><small>${testState.experience} XP · ${testState.pelines} pelines recibidos</small>`;
  $('test-events').innerHTML = q.objectives.map((o,i) => `<div class="test-objective"><strong>${escape(o.description)}</strong><small>${objectiveProgress(o,testState)} / ${o.count}${o.map ? ` · ${escape(refs.maps.find(m => m.id === o.map)?.name ?? o.map)}` : ''}</small><button data-event="${i}" ${!testState.accepted || testState.completed || objectiveProgress(o,testState) >= o.count ? 'disabled' : ''}>${o.type === 'fetch' ? 'Recoger 1 objeto' : o.type === 'kill' ? 'Derrotar 1 enemigo' : 'Hablar con este personaje'}</button>${o.type === 'fetch' ? `<button data-remove="${escape(o.target)}" ${!(testState.inventory[o.target] > 0) || testState.completed ? 'disabled' : ''}>Quitar 1 de la mochila</button>` : ''}</div>`).join('');
  $<HTMLButtonElement>('test-talk').disabled = false;
  $('test-talk').textContent = `Hablar con ${refs.npcs.find(n => n.id === (phase === 'offer' ? q.giver : q.receiver))?.name ?? q.receiver}`;
}
function talk() {
  if (!testQuest) return;
  const q = testQuest; const phase = questPhase(q,testState);
  const conversation = questConversation(q,phase,id => refs.npcs.find(n => n.id === id)?.name ?? id, action => {
    const ok = rehearseAction(q,testState,action,testContext);
    $('test-notice').textContent = ok ? action === 'complete' ? 'Entrega confirmada. Los objetos se retiran y las recompensas se reciben una sola vez.' : '' : 'Acción rechazada: comprueba los requisitos, la fase y los objetivos.';
    renderTest(); return ok;
  },id => refs.items.find(item => item.id === id)?.name ?? id);
  openConversation(conversation);
}
$('test-start').onclick = () => {
  try {
    validated(); const level = $<HTMLInputElement>('test-level').valueAsNumber;
    if (!Number.isInteger(level) || level < 1 || level > 10000) throw new Error('Introduce un nivel de prueba entre 1 y 10000.');
    stopTest(); testQuest = clone(draft); testState = newRehearsal();
    testContext = { level, completed:$<HTMLInputElement>('test-prerequisites').checked ? [...draft.prerequisites] : [] };
    $('test-notice').textContent = 'Primero, acepta el encargo desde el diálogo.'; renderTest(); talk();
  } catch(error) {
    showErrors = true; const first = issues()[0];
    if (first) goToStep(first.step,first.path);
    status(first?.text ?? (error as Error).message,true);
  }
};
$('test-reset').onclick = () => { stopTest(); $('test-notice').textContent = 'Ensayo reiniciado. Pulsa Iniciar ensayo para volver a probar.'; };
$('test-talk').onclick = talk;
$('test-events').onclick = event => {
  if (!testQuest) return; const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button) return;
  closeDialog();
  if (button.dataset.event !== undefined) { const o = testQuest.objectives[Number(button.dataset.event)]; rehearseEvent(testQuest,testState,o.type,o.target,o.map); }
  if (button.dataset.remove) testState.inventory[button.dataset.remove] = Math.max(0,(testState.inventory[button.dataset.remove] ?? 0)-1);
  renderTest();
};
window.addEventListener('beforeunload',event => { if (dirty || libraryDirty) { event.preventDefault(); event.returnValue = ''; } });
document.addEventListener('keydown',event => {
  if ((event.target as HTMLElement).closest('input,textarea,select')) return;
  if (!isDialogOpen()) return;
  if (event.key === 'Escape') exitDialog();
  else if (event.key === 'ArrowDown') { event.preventDefault(); moveDialogChoice(1); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); moveDialogChoice(-1); }
  else if (event.key.toLowerCase() === 'e') { event.preventDefault(); advanceDialog(); }
});
// Capture recovery before initial rendering has a chance to replace it.
const recovery = localStorage.getItem(storageKey);
void load().then(() => {
  if (recovery) {
    const projectCatalog = clone(catalog);
    try {
      const saved = JSON.parse(recovery); validateQuestCatalog(saved.catalog);
      if (!saved.draft || typeof saved.revision !== 'string' || typeof saved.originalId !== 'string') throw new Error('Borrador no válido');
      const stale = revision !== saved.revision;
      catalog = saved.catalog; draft = saved.draft; originalId = saved.originalId; revision = saved.revision; libraryDirty = !!saved.libraryDirty; dirty = true;
      currentStep = Number.isInteger(saved.currentStep) && saved.currentStep >= 0 && saved.currentStep < steps.length ? saved.currentStep : 0;
      editingPhase = Object.hasOwn(phaseLabels,saved.editingPhase) ? saved.editingPhase : 'offer';
      render(); persist(); status(stale ? 'Borrador recuperado. El archivo cambió: exporta tu trabajo y recarga antes de guardar.' : 'Borrador recuperado del navegador.',stale);
    } catch {
      catalog = projectCatalog; libraryDirty = false;
      chooseDraft(catalog.quests[0] ?? createFromTemplate('nueva_mision'),!!catalog.quests.length);
      status('El borrador del navegador no es compatible. Se ha cargado la biblioteca del proyecto.',true);
    }
  }
  $<HTMLFieldSetElement>('editor-fields').disabled = false;
  for (const id of ['new','duplicate','reload','export','import','test-start','test-reset']) $<HTMLButtonElement>(id).disabled = false;
}).catch(error => status(`${error.message} Abre /quests.html con npm run dev.`,true));
