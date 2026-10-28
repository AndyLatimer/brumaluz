/** Visual identity shared by field models, inventory, the atlas and the minimap. */
export type ResourceFamily = 'ore' | 'gem' | 'wood' | 'herb' | 'fiber' | 'fruit' | 'mushroom' | 'grain';
export const RESOURCE_FAMILIES: Record<ResourceFamily,{label:string;job:string;verb:string;color:string}> = {
 ore:{label:'Minerales',job:'minero',verb:'Extraer',color:'#b78459'},
 gem:{label:'Gemas',job:'minero',verb:'Extraer',color:'#81b7c5'},
 wood:{label:'Maderas',job:'lenador',verb:'Cortar',color:'#b18b58'},
 herb:{label:'Hierbas y flores',job:'recolector',verb:'Recoger',color:'#89a76b'},
 fiber:{label:'Fibras',job:'recolector',verb:'Cosechar',color:'#d8c9a2'},
 fruit:{label:'Frutas y bayas',job:'recolector',verb:'Recoger',color:'#c67a69'},
 mushroom:{label:'Hongos',job:'recolector',verb:'Recoger',color:'#bd8c69'},
 grain:{label:'Cereales',job:'recolector',verb:'Cosechar',color:'#d5b66b'},
};
export function resourceFamily(id:string):ResourceFamily|null {
 if(id.startsWith('material_minero_'))return 'ore';
 if(id.startsWith('material_lenador_'))return 'wood';
 if(id.startsWith('material_recolector_'))return 'herb';
 return ({gema:'gem',fibra:'fiber',fruta:'fruit',hongo:'mushroom',grano:'grain'} as Record<string,ResourceFamily>)[id.split('_')[0]]??null;
}
export const RESOURCE_PALETTES = {
 ore:['#b57b51','#929b9e','#a5becd','#a99bbb','#d4ae57','#cb8265'],
 gem:['#9bc5c6','#8cb38c','#79acd1','#b193ca','#e0bd6d','#e5a477'],
 wood:['#806044','#9a7850','#c8bfa2','#66565d','#ab8051','#8b6953'],
 herb:['#e0c490','#cdddb5','#88b8de','#b293c9','#e7c56c','#efb8a1'],
 fiber:['#e6dab9','#e4d8bd','#dce1d5','#d3c3d8','#ecddaf','#e8d1b2'],
 fruit:['#c86653','#bc7861','#6f89b1','#987094','#d9a75b','#dc9871'],
 mushroom:['#b57b58','#bf9b71','#89a3b3','#a489af','#d2b369','#cb8b72'],
 grain:['#ceb16a','#cfb882','#c4ceb8','#a8a0b7','#dec078','#dec49a'],
} satisfies Record<ResourceFamily,string[]>;
export const resourceColor=(family:ResourceFamily,tier=0)=>RESOURCE_PALETTES[family][Math.max(0,Math.min(5,tier))];

/** Broad shapes work at minimap size; details remain visible in recipe portraits. */
export function resourceDrawing(family:ResourceFamily,tier=0):string {
 const c=resourceColor(family,tier),dark='#584735',light='#f3e6c7',green='#81995b';
 const drawings:Record<ResourceFamily,string>={
  ore:`<path fill="#7e8174" d="m2 18 3-9 6-4 8 3 3 10-5 3H7Z"/><path fill="${c}" d="m5 12 4-5 5 2 1 6-7 4Zm10-3 4 2 2 6-5 2-1-5Z"/><path d="m9 8 1 5-3 3m4-3 3 2m3-3 2 4" stroke="${light}" fill="none"/>`,
  gem:`<path fill="#777b70" d="m2 20 3-6 7-2 8 3 2 5-10 2Z"/><path fill="${c}" d="m7 5 4-3 5 4-1 10-5 4-4-5Zm10 6 3-2 2 3-2 7-4 1Z"/><path d="m11 3-1 10 1 6m5-13-6 7-4 2m14-5-1 6-3 4" stroke="${light}" fill="none"/>`,
  wood:`<path fill="${c}" d="m3 11 11-7 7 4v6l-11 7-7-4Z"/><path fill="#d5b582" d="m3 11 7 4v6l-7-4Z"/><path fill="none" d="m5 13 3 2v3l-3-2Zm5 2 11-7m-9 9 8-5M8 9l7-4m-1 7 5-3" stroke="${dark}"/><path d="m5 10 6 3 7-4" stroke="${light}" fill="none"/>`,
  herb:`<path d="m9 22 6-18m-4 14-6-7m7 3 7-5" stroke="${green}" stroke-width="1.6"/><path fill="${green}" d="M10 17Q1 19 3 10q8 0 7 7Zm3-5q-3-9 5-9 3 6-5 9Zm0 6q2-8 9-7 0 8-9 7Z"/><path fill="${c}" d="m16 6-2-3 3-1 2 2 3-1 1 3-3 2-1 3-3-2-3-1Z"/><circle fill="#d2a94e" cx="18" cy="6" r="1.4"/><path d="m7 19 6 2" stroke="#b68b57" stroke-width="1.6"/>`,
  fiber:`<path d="m7 22 5-17 5 17m-7-11-6-4m9 7 6-5" stroke="${green}" stroke-width="1.2"/><path fill="${green}" d="M8 16q-7-1-6-7 6-1 6 7Zm7 1q0-8 7-8 1 7-7 8Z"/><path fill="${c}" d="M5 10C0 8 2 4 5 5 5 0 11 1 11 5c4-2 6 4 2 5Zm8 6c-3-4 0-7 3-6 0-4 6-3 5 1 4 2 1 7-2 6Z"/><path d="m5 8 3-1m9 7 2-1" stroke="${light}"/>`,
  fruit:`<path fill="${green}" d="M12 8Q9 0 20 3q0 6-8 5ZM7 12Q0 6 5 4q6 1 5 7Z"/><path d="M12 10V5" stroke="${dark}" stroke-width="1.6"/><path fill="${c}" d="M12 10C3 4 0 17 7 21l5-1 4 1c8-4 6-17-4-11Z"/><path fill="#af6b76" d="M18 15a3 3 0 1 1-1 6 3 3 0 0 1 1-6Z"/><path d="M7 12q-3 1-2 5m10-14-3 4" stroke="${light}" fill="none"/>`,
  mushroom:`<path fill="#e2cfaa" d="m9 12-1 9q4 2 7 0l-1-9Z"/><path fill="${c}" d="M2 12Q3 2 11 2q9 0 10 10-9 5-19 0Z"/><path fill="#e0ceae" d="M16 18h4v4h-4Z"/><path fill="${c}" d="M13 18q1-7 6-6 4 0 4 6-5 3-10 0Z"/><path d="m6 8 2-1m6-1 2 1m-6 4h2m5 5h2" stroke="${light}" stroke-width="1.7"/>`,
  grain:`<path d="m7 22 7-20m-3 20 9-16M9 20 4 10" stroke="#9b7a44" stroke-width="1.2"/><path fill="${c}" d="M13 7Q5 4 10 2q5 0 3 5Zm-1 5Q4 8 8 6q5-1 4 6Zm-1 5Q3 13 7 11q5 0 4 6Zm3-9q0-8 4-5 2 4-4 5Zm-1 5q1-8 5-5 2 4-5 5Zm-1 5q1-8 5-5 2 4-5 5Zm5-1q0-7 4-5 2 4-4 5Z"/><path d="m6 19 7 2" stroke="#ad8051" stroke-width="1.8"/>`,
 };
 return `<g fill="none" stroke="${dark}" stroke-width=".65" stroke-linecap="round" stroke-linejoin="round">${drawings[family]}</g>`;
}
