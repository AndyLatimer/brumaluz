// One catalog feeds the client and server when maps are published.
export const defaultCollectibles = [
  {id:'plaza_pozo',kind:'coin-bag',mapId:'brumaluz',x:3.6,z:-3.2,yaw:.6,min:10,max:30},
  {id:'testiculos_debugger',kind:'coin-bag',mapId:'brumaluz',x:-9.2,z:5.028203230275508,yaw:1.2,min:20,max:40},
  {id:'plaza_fuente',kind:'fairy-dust',mapId:'brumaluz',x:-2.4,z:1.8,yaw:0,min:1,max:5},
  {id:'arco_entrada',kind:'fairy-dust',mapId:'brumaluz',x:7.2,z:-6.5,yaw:2.1,min:1,max:5},
].map(spot=>({...spot,realm:'Brumaluz',area:'Brumaluz'}));

export function collectibleCatalog(maps) {
  const result=[];
  for(const map of maps){
    if(map.procedural){result.push(...defaultCollectibles);continue;}
    const visible=map.layers?new Set(map.layers.filter(l=>l.visible).map(l=>l.id)):null;
    for(const marker of map.markers){
      if(marker.type!=='interaction'||visible&&!visible.has(marker.layer))continue;
      const kind=marker.text?.trim();
      if(kind!=='coin-bag'&&kind!=='fairy-dust')continue;
      const prefix=kind==='coin-bag'?'coins_':'dust_';
      const rawId=marker.id.startsWith(prefix)?marker.id.slice(prefix.length):marker.id;
      // Older copies of the capital contain reference markers, not extra rewards.
      if(map.id!=='brumaluz'&&defaultCollectibles.some(s=>s.id===rawId&&s.kind===kind))continue;
      const id=map.id==='brumaluz'?rawId:`${map.id}:${rawId}`;
      const original=defaultCollectibles.find(s=>s.kind===kind&&s.id===id);
      result.push({id,kind,mapId:map.id,realm:'Brumaluz',area:map.id==='pompelin'?'Alrededores de Brumaluz':'Brumaluz',
        x:marker.position[0],z:marker.position[2],yaw:marker.rotationY,
        min:original?.min??(kind==='coin-bag'?10:1),max:original?.max??(kind==='coin-bag'?30:5)});
    }
  }
  const ids=new Set();
  for(const spot of result){
    const key=`${spot.kind}:${spot.id}`;
    if(ids.has(key))throw Object.assign(new Error(`Identificador de coleccionable repetido: ${spot.id}`),{status:422});
    ids.add(key);
  }
  return result.sort((a,b)=>a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
}

const quote=s=>`'${String(s).replaceAll("'","''")}'`;
export function collectiblesSql(catalog){
  return ['coin-bag','fairy-dust'].map(kind=>{
    const name=kind==='coin-bag'?'game_coin_bag':'game_fairy_dust';
    const entries=catalog.filter(s=>s.kind===kind);
    const body=entries.length?`select value from (values\n${entries.map(s=>`  (${quote(s.id)}, ${quote(JSON.stringify({x:s.x,z:s.z,min:s.min,max:s.max,location:s.mapId}))}::jsonb)`).join(',\n')}\n) as spots(id,value) where id=p_id`:'select null::jsonb';
    return `create or replace function public.${name}(p_id text)\nreturns jsonb language sql immutable set search_path='' as $$\n${body}\n$$;\nrevoke all on function public.${name}(text) from public,anon,authenticated;`;
  }).join('\n\n');
}
