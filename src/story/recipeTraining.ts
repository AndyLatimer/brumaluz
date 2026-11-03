import type { CharData } from '../data/data';
import { RPG_CATALOG, professionRank, professionState } from '../data/professions';
import type { DialogNode, DialogChoice } from '../ui/dialog';
import { t } from '../ui/i18n';

export interface RecipeTraining {
  getState: () => CharData;
  buy: (recipeId:string) => Promise<boolean>;
  openInventory?:()=>void;
}

/** Purchases stay inside the master's conversation, with an explicit price confirmation. */
export function addRecipeTraining(nodes:Record<string,DialogNode>,job:string,training:RecipeTraining):DialogChoice {
 const recipes=Object.values(RPG_CATALOG.recipes).filter(recipe=>recipe.job===job).sort((a,b)=>a.tier-b.tier||a.label.localeCompare(b.label,'es'));
 const price=(n:number)=>n.toLocaleString('es-ES'),known=(id:string)=>professionState(training.getState().rpg).learned.includes(id);
 const back:DialogChoice={text:'Volver a mis preguntas',next:'intro'};
 nodes.recipe_ranks={text:'Elige un rango. Recibirás un pergamino que debes usar desde la mochila para aprender la receta.',choices:[]};
 for(let tier=0;tier<6;tier++){
  const group=recipes.filter(recipe=>recipe.tier===tier);if(!group.length)continue;
  const root=`recipes_${tier}`,pages=Math.ceil(group.length/5);
  nodes.recipe_ranks.choices!.push({text:RPG_CATALOG.ranks[tier],next:`${root}_0`});
  for(let page=0;page<pages;page++){
   const pageId=`${root}_${page}`,choices:DialogChoice[]=[];
   for(const recipe of group.slice(page*5,page*5+5)){
    const detail=`purchase_${recipe.id}`,receipt=`purchased_${recipe.id}`,rare=recipe.source==='drop';
    choices.push({get text(){return `${t(recipe.label)} · ${rare?t('Pergamino excepcional'):t('{price} Pelines',{price:price(recipe.price)})}`;},next:detail,when:()=>!known(recipe.id)});
    nodes[detail]={get text(){return `${t(recipe.label)}\n\n${t('Rango necesario: {rank}.',{rank:t(RPG_CATALOG.ranks[tier])})}\n${rare?t('No se vende. Es botín muy raro de criaturas de nivel 26 o superior.'):t('Precio: {price} Pelines.',{price:price(recipe.price)})}\n\n${t('Usa el pergamino desde la mochila para aprender la receta. No incluye materiales.')}`;},choices:[
     {get text(){return t('Comprar por {price} Pelines',{price:price(recipe.price)});},next:receipt,when:()=>!rare&&!known(recipe.id)&&professionRank(professionState(training.getState().rpg),job)>=tier,action:()=>training.buy(recipe.id)},
     {text:'Volver a las recetas',next:pageId},
    ]};
    nodes[receipt]={get text(){return t('Has comprado el pergamino de {recipe}. Úsalo desde la mochila para aprender la receta.',{recipe:t(recipe.label)});},choices:[...(training.openInventory?[{text:'Abrir mochila',action:training.openInventory}]:[]),{text:'Ver más recetas',next:pageId},back]};
   }
   if(page>0)choices.push({text:'Página anterior',next:`${root}_${page-1}`});
   if(page+1<pages)choices.push({text:'Página siguiente',next:`${root}_${page+1}`});
   choices.push({text:'Elegir otro rango',next:'recipe_ranks'});
   nodes[pageId]={get text(){return `${t('Recetas de {rank} · {page} / {pages}.',{rank:t(RPG_CATALOG.ranks[tier]),page:page+1,pages})}\n\n${t(tier===5?'Solo aparecen recetas por aprender. Los pergaminos excepcionales son botín.':'Solo aparecen recetas por aprender. Necesitas el rango y los Pelines indicados.')}`;},choices};
  }
 }
 nodes.recipe_ranks.choices!.push(back);
 return {text:'Comprar recetas',next:'recipe_ranks'};
}
