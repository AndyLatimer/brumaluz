import type {CharData} from '../data/data';
import {mealQuota} from '../data/sharedMeals';
import {itemLabel} from '../data/items';
import {cozyMenu,cozyProjects,cozyCanChoose,refreshCozyView} from '../game/homes';
import {performProfession} from '../game/professions';
import {setWindow} from './menus';
import {t} from './i18n';

const node=(tag:string,text='',cls='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=t(text);return n;};
function action(label:string,command:string,args:Record<string,unknown>,disabled:boolean){const b=document.createElement('button');b.type='button';b.className='profession-button';b.textContent=t(label);b.disabled=disabled;b.onclick=async()=>{b.disabled=true;try{if(await performProfession(command,args)){await refreshCozyView();setWindow('homes',false);}}finally{if(b.isConnected)b.disabled=disabled;}};return b;}
export function renderSharedMeals(page:HTMLElement,d:CharData,near:boolean,master:string){
 const claimed=mealQuota(d),leader=cozyCanChoose();
 const projects=cozyProjects(),pending=projects.filter(p=>p.active&&!p.complete).length;
 page.append(node('h3','Meriendas del día'),node('p',`${claimed} / 2 recompensas recogidas hoy · ${pending} / 3 preparaciones pendientes`),node('p','El menú cambia cada día. Cada persona que aporte un ingrediente puede cobrar una ración, Pelines y XP de Cocina. Puedes repetir una receta.'));
 if(!leader)page.append(node('p','El líder del grupo elige una receta de su propio menú. Puedes ayudar aunque tengas menos rango de Cocina.','home-note'));
 for(const recipe of cozyMenu()){
  const card=node('article','','home-project');card.dataset.mealRecipe=recipe.id;
  card.append(node('h4',recipe.label),node('p',`${recipe.difficulty*10} Pelines · ${recipe.difficulty*5} XP de Cocina · una ración`));
  for(const[id,n]of Object.entries(recipe.ingredients))card.append(node('p',`${itemLabel(id)} × ${n}`,'home-detail'));
  card.append(action('Empezar preparación','meal_start',{id:recipe.id,master},!near||!leader||pending>=3));page.append(card);
 }
 page.append(node('p','Las preparaciones se cancelan tras 30 minutos sin aportaciones; el plazo se pausa si todos se desconectan. Cada aportación lo reinicia. Al cancelarse o disolverse el grupo, los ingredientes se devuelven en Entregas.','home-note'));
 if(claimed>=2)page.append(node('p','Ya has cobrado las dos recompensas de hoy. Puedes seguir aportando como ayuda sin recompensa de comida, Pelines ni XP.','home-note'));
 for(const project of projects){
  const recipe=project.recipe;if(!recipe||project.claimed)continue;
  const card=node('article','','home-project');card.dataset.mealProject=project.id;
  card.append(node('h4',recipe.label));
  if(project.complete){
   card.append(node('p',`Preparación terminada · ${Math.max(0,Math.ceil(((project.expiresAt??0)-Date.now()/1000)/86400))} días para recoger`));
   if(project.contributed&&project.rewardable)card.append(action(`Recoger ración + ${recipe.pelines} Pelines + ${recipe.xp} XP`,'meal_claim',{id:project.id,master},!near||claimed>=2));
   else card.append(node('p',project.contributed?'Gracias por ayudar sin recompensa.':'Solo reciben recompensa quienes aportaron ingredientes.','home-note'));
  }else{
   card.append(node('p',`${Math.ceil((project.remaining??1800)/60)} minutos restantes de actividad sin aportar`,'home-note'));
   for(const[id,required]of Object.entries(recipe.ingredients)){
    const n=project.ingredients[id]??0,have=d.inventory.reduce((sum,i)=>sum+(i?.id===id&&!i.bound?i.count:0),0),row=node('div','','home-project-row');
    row.append(node('span',`${itemLabel(id)} · ${n} / ${required}`),action(claimed>=2?'Aportar sin recompensa':'Aportar uno','meal_contribute',{id,project:project.id,master,help:claimed>=2},!near||!have||n>=required));card.append(row);
   }
  }page.append(card);
 }
 if(!near)page.append(node('p','Habla con el maestro de Cocina para empezar, aportar o recoger.','home-note'));
}
