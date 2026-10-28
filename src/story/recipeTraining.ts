import type { CharData } from '../data/data';
import { RPG_CATALOG, professionRank, professionState } from '../data/professions';
import type { DialogNode, DialogChoice } from '../ui/dialog';

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
 nodes.recipe_ranks={text:'Elige el rango de las recetas que quieres consultar. Comprar entrega un pergamino consumible en tu mochila. Lo aprenderás de forma permanente al usarlo. El precio y los requisitos se muestran antes de pagar.',choices:[]};
 for(let tier=0;tier<6;tier++){
  const group=recipes.filter(recipe=>recipe.tier===tier);if(!group.length)continue;
  const root=`recipes_${tier}`,pages=Math.ceil(group.length/5);
  nodes.recipe_ranks.choices!.push({text:RPG_CATALOG.ranks[tier],next:`${root}_0`});
  for(let page=0;page<pages;page++){
   const pageId=`${root}_${page}`,choices:DialogChoice[]=[];
   for(const recipe of group.slice(page*5,page*5+5)){
    const detail=`purchase_${recipe.id}`,receipt=`purchased_${recipe.id}`,rare=recipe.source==='drop';
    choices.push({text:`${recipe.label} · ${rare?'Pergamino excepcional':`${price(recipe.price)} Pelines`}`,next:detail,when:()=>!known(recipe.id)});
    nodes[detail]={text:`${recipe.label}\n\nOficio: ${RPG_CATALOG.professions[job]}. Rango necesario: ${RPG_CATALOG.ranks[tier]}.\n${rare?'No está en venta. Su pergamino excepcional es botín muy raro de criaturas de rango alto.':`Precio: ${price(recipe.price)} Pelines.`}\n\nEl pergamino ocupa una casilla de la mochila. Úsalo para aprender la receta; se consumirá al hacerlo. No incluye materiales ni la pieza terminada.`,choices:[
     {text:`Comprar por ${price(recipe.price)} Pelines`,next:receipt,when:()=>!rare&&!known(recipe.id)&&professionRank(professionState(training.getState().rpg),job)>=tier,action:()=>training.buy(recipe.id)},
     {text:'Volver a las recetas',next:pageId},
    ]};
    nodes[receipt]={text:`Has comprado el pergamino de ${recipe.label}. Está en tu mochila. Úsalo para aprender la receta de forma permanente.`,choices:[...(training.openInventory?[{text:'Abrir mochila',action:training.openInventory}]:[]),{text:'Ver más recetas',next:pageId},back]};
   }
   if(page>0)choices.push({text:'Página anterior',next:`${root}_${page-1}`});
   if(page+1<pages)choices.push({text:'Página siguiente',next:`${root}_${page+1}`});
   choices.push({text:'Elegir otro rango',next:'recipe_ranks'});
   nodes[pageId]={text:`Recetas de ${RPG_CATALOG.ranks[tier]} · ${page+1} / ${pages}.\n\nSolo aparecen las que todavía no conoces. ${tier===5?'Sus pergaminos excepcionales se consiguen como botín; no están en venta.':'Compras un pergamino consumible, que aprenderás al usarlo desde tu mochila. Necesitas el dominio indicado y los Pelines del precio.'}`,choices};
  }
 }
 nodes.recipe_ranks.choices!.push(back);
 return {text:'Comprar recetas',next:'recipe_ranks'};
}
