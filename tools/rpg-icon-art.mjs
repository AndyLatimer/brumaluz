// Native 24 px illustrations shared by inventory, recipes and the field guide.
export function professionItemIcon(item){
 const tier=item.tier,metal=['#a8adb1','#a5b4a0','#b3cad4','#b7a7c8','#d6bc72','#e2a471'][tier],shine='#eee5ca';
 const shadow='<ellipse cx="12" cy="21" rx="8" ry="1.2" fill="#503a27" opacity=".18"/>';
 const stroke='stroke="#604d3c" stroke-width=".8" stroke-linejoin="round"';
 let art='';
 if(item.id.startsWith('material_minero_')){
  const ore=['#b47d56','#8a939b','#9dbacb','#ad9bc5','#d2ae56','#cd876b'][tier];
  art=`<path d="m3 14 3-7 6-3 6 4 3 7-5 6H7Z" fill="${ore}" ${stroke}/><path d="m6 7 6 5 6-4-2 13m-4-9-5 9m5-9L12 4" fill="none" stroke="#f1e0c2" stroke-opacity=".6"/><path d="m4 15 8-3 8 4-4 5H7Z" fill="#563d32" opacity=".17"/><path d="m8 9 2 2m6 4 2-1" stroke="${shine}" stroke-width="1.2"/>`;
 }else if(item.id.startsWith('material_lenador_')){
  const wood=['#9f7547','#b18b60','#c2ac88','#6e6268','#bb9254','#a77f65'][tier];
  art=`<path d="m4 11 11-7 6 4-11 8Z" fill="${wood}" ${stroke}/><path d="M4 11v5l6 5 11-8V8l-11 8Z" fill="${wood}" ${stroke}/><path d="M10 16v5M6 12l11-7m-4 12 7-5" stroke="#5f4838" fill="none"/><path d="m5 14 3 2v2l-3-2Z" fill="#dbc29a"/><path d="m5.8 14.7 1.5 1.5" stroke="#9e7851" stroke-width=".6"/><path d="m7 9 2 1 7-4" stroke="#e0c29b" fill="none"/>`;
 }else if(item.id.startsWith('material_recolector_')){
  const flower=['#c6b88f','#ccdfb2','#8db6da','#b291c5','#e4c675','#ecc0a3'][tier];
  art=`<path d="m8 21 7-15m-4 14-5-9m4 7 9-5" stroke="#6c8150" stroke-width="1.2"/><path d="M10 15Q2 17 3 9q7-1 7 6Zm3-4q-3-7 5-8 2 7-5 8Zm1 6q3-7 8-5-1 7-8 5Z" fill="#8fa36d" stroke="#5e7850" stroke-width=".7"/><path d="m6 11 4 4m6-10-3 6m6 2-5 4" stroke="#d7dfaf" stroke-width=".6"/><path d="m16 5 1-3 2 2 3 1-2 2-1 3-2-2-3-1Z" fill="${flower}" stroke="#8a7b5e" stroke-width=".5"/><circle cx="18" cy="6" r="1.1" fill="#e7cc79"/><path d="m7 18 6 2" stroke="#b6945d" stroke-width="1.5"/>`;
 }else if(item.id.startsWith('fibra_')){
  art=`<path d="M8 4h8v16H8Z" fill="#b6925f" ${stroke}/><ellipse cx="12" cy="4" rx="6" ry="2" fill="#d6ba87" ${stroke}/><ellipse cx="12" cy="20" rx="6" ry="2" fill="#b79a70" ${stroke}/><path d="M7 6q5 2 10 0v11q-5 3-10 0Z" fill="${metal}" stroke="#898a7b" stroke-width=".7"/><path d="m8 8 8 2m-8 1 8 2m-8 1 8 2m-7 1 3 1" stroke="${shine}" stroke-width=".8"/><path d="M17 15q5 0 4 4t-4 1" stroke="#9a9d86" fill="none"/>`;
 }else if(item.id.startsWith('hongo_')){
  const cap=['#b68062','#c29b6b','#87a0bd','#a68ab8','#c6af63','#cb987b'][tier];
  art=`<path d="m10 11-1 9q3 2 6 0l-1-9Z" fill="#e3d5b4" ${stroke}/><path d="M3 12q1-10 9-10t9 10q-9 4-18 0Z" fill="${cap}" ${stroke}/><path d="M4 12q8 3 16 0" stroke="#e9cfaa" fill="none"/><path d="m7 7 2-1m6 0 1 1m-5 4h2" stroke="#f1e0bc" stroke-width="1.7" stroke-linecap="round"/><path d="M14 19q1-7 5-6t4 6q-4 2-9 0Z" fill="${cap}" ${stroke}/><path d="M18 19v3" stroke="#c9b897" stroke-width="2"/>`;
 }else if(item.id.startsWith('grano_')){
  art=`<path d="m8 22 6-19m-3 18 8-14M9 21 4 9" stroke="#8f794b" stroke-width="1"/><path d="M13 7q-7-5-2-5 5 0 2 5Zm-1 4q-7-5-3-6 5-1 3 6Zm-1 4q-7-4-3-6 5-1 3 6Zm3-7q0-7 4-5 3 3-4 5Zm-1 4q1-7 5-5 2 3-5 5Zm-1 4q1-7 5-5 2 3-5 5Zm4-1q0-6 4-4 2 3-4 4ZM7 15q-6-1-4-5 4-1 4 5Z" fill="#d1b16e" stroke="#9d814b" stroke-width=".5"/><path d="m7 18 6 2" stroke="#b18b5a" stroke-width="1.6"/>`;
 }else if(item.id.startsWith('gema_')){
  const gem=['#a3bbbd','#85b38f','#80adc9','#af92c6','#d9bc70','#dfaa7e'][tier];
  art=`<path d="m7 3 10 1 5 7-10 11L2 10Z" fill="${gem}" stroke="#657078" stroke-width=".9"/><path d="m7 3 1 7 8 1 1-7m-9 6 4 12 4-11 6 0M2 10h6" fill="none" stroke="#eee7d4" stroke-width=".8"/><path d="m8 10 4 12L2 10Zm8 1 6 0-10 11Z" fill="#354660" opacity=".18"/><path d="m8 5 5 1" stroke="#fff4da" stroke-width="1.4"/>`;
 }else if(item.tool){
  const handle='<path d="m6 21 9-17" stroke="#5e4230" stroke-width="3.4"/><path d="m6 20 8-15" stroke="#ac8754" stroke-width="1.3"/>';
  art=item.tool==='minero'?`${handle}<path d="M4 8q7-10 17-1l-1 5q-7-8-15 0Z" fill="${metal}" stroke="#62616a" stroke-width=".9"/><path d="M6 8q6-5 12-1" stroke="${shine}" fill="none"/><path d="m13 6 3 1-1 4-3-1Z" fill="#998368"/>`
   :item.tool==='lenador'?`${handle}<path d="m13 4 7-2q5 7-1 12l-8-4Z" fill="${metal}" stroke="#62616a" stroke-width=".9"/><path d="M19 3q4 5-1 10" stroke="${shine}" stroke-width="1.5" fill="none"/><path d="m12 5 3 1-2 5-3-1Z" fill="#998368"/>`
   :`<path d="m6 21 6-9" stroke="#654631" stroke-width="3.4"/><path d="m6 20 5-8" stroke="#b18d57" stroke-width="1.2"/><path d="M9 13C2 7 9 1 16 3q7 2 6 8C19 2 8 5 13 11Z" fill="${metal}" stroke="#62616a" stroke-width=".9"/><path d="M6 8q0-6 9-4" stroke="${shine}" fill="none"/>`;
 }else if(item.furniture){
  const wood='#a38155',edge='#e0c398';
  art=item.furniture==='biblioteca'?`<path d="M4 3h16v19H4Z" fill="${wood}" ${stroke}/><path d="M6 5h12v6H6Zm0 8h12v7H6Z" fill="#65533e"/><path d="m7 6 1 4m2-4v4m2-4 1 4m3-4-1 4M7 14v5m2-4v4m3-5v5m3-5 2 5" stroke="${metal}" stroke-width="1.5"/><path d="M5 4h14M5 12h14M5 21h14" stroke="${edge}" stroke-width=".7"/>`
   :item.furniture==='taburete'?`<path d="m7 11-2 10m12-10 2 10M6 17h12" stroke="#70523a" stroke-width="2.2"/><ellipse cx="12" cy="10" rx="9" ry="4" fill="${wood}" ${stroke}/><path d="M4 9q8-5 16 0" stroke="${edge}" fill="none"/><path d="M8 8h8" stroke="#80633d"/>`
   :`<path d="M5 11v10m14-10v10M5 17h14" stroke="#6b4e36" stroke-width="2.3"/><path d="m2 7 14-3 6 5-14 4-6-3Z" fill="${wood}" ${stroke}/><path d="m2 7 6 4 14-2M8 11v2" stroke="${edge}" stroke-width=".8" fill="none"/>${item.furniture==='estacion'?`<path d="m7 4 2-1 6 4-2 2Z" fill="${metal}" ${stroke}/><path d="m15 3 4 4" stroke="#68543d" stroke-width="1.6"/>`:'<path d="m6 7 9-2m-6 3 9-2" stroke="#c8ab7b" stroke-width=".6"/>'}`;
 }
 return art?`${shadow}<g stroke-linecap="round">${art}</g>`:null;
}
