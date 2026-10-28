// Lore: elven homeland, nature and botanical alchemy, with discreet magic.
// Use the existing art direction; reserve a connection, not a miniature city.
export function populateArboleda({map,definition,ground,roadDistance,shoreDistance,protectedPoints,boxes}){
 const [cx,cz]=definition.center,[rx,rz]=definition.radii,[ax,az]=definition.arrival;
 const distance=(x,z)=>Math.hypot((x-cx)/rx,(z-cz)/rz);
 const edge=(x,z)=>1+(Math.sin(x*.027)+Math.cos(z*.031))*.025;
 const treeAsset=asset=>/(?:^|\/)trees?_[^/]+$/i.test(asset);
 const layers=[['paisaje_arboleda_copas','La Arboleda · copas y árboles'],['paisaje_arboleda_suelo','La Arboleda · sotobosque'],['paisaje_arboleda_acceso','La Arboleda · llegada reservada']];
 for(const[id,name]of layers)if(!map.layers.some(l=>l.id===id))map.layers.push({id,name,visible:true,locked:false});
 const fixed=map.objects.filter(o=>o.collision!=='none'&&!o.hidden&&distance(o.position[0],o.position[2])<1.2).map(o=>{
  const b=boxes.get(o.asset),r=treeAsset(o.asset)?1.2:b?Math.hypot((b.max.x-b.min.x)*o.scale[0],(b.max.z-b.min.z)*o.scale[2])*.5:1;
  return{x:o.position[0],z:o.position[2],r};
 });
 const trees=[];let serial=0,seed=672981,heroes=0;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const add=(asset,x,z,scale,layer='paisaje_arboleda_suelo',collision='none',yaw=rnd()*Math.PI*2)=>{
  const o={id:`paisaje_arboleda_${serial++}`,name:`La Arboleda · ${asset.split('/').at(-1)}`,asset,layer,position:[x,ground(x,z),z],rotation:[0,yaw,0],scale:Array.isArray(scale)?scale:[scale,scale,scale],collision};map.objects.push(o);return o;
 };
 const clear=(x,z,r=.4)=>distance(x,z)<edge(x,z)&&ground(x,z)>.12&&shoreDistance(x,z)>5+r&&roadDistance(x,z)>1.8+r
  &&Math.hypot(x-ax,z-az)>definition.arrivalRadius+r+1
  &&!protectedPoints.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r+.5)
  &&!fixed.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r+1);
 // A jittered lattice gives continuous crowns without packing the walkable trunks together.
 const step=9;
 for(let j=0;j<=Math.ceil(rz*2/step);j++)for(let i=0;i<=Math.ceil(rx*2/step);i++){
  const x=cx-rx+i*step+(rnd()-.5)*3.4,z=cz-rz+j*step+(rnd()-.5)*3.4;
  if(!clear(x,z,1.2)||trees.some(t=>Math.hypot(x-t.x,z-t.z)<6.9))continue;
  const choice=rnd();let asset,scale;
  if(choice<.025&&heroes<24){asset='brumaluz-arboleda/objects/tree_ancient_oak';scale=1.9+rnd()*.35;heroes++;}
  else if(choice<.665){asset='forest/objects/Tree_3_B_Color1';scale=2.7+rnd()*.6;}
  else if(choice<.83){asset='forest/objects/Tree_1_C_Color1';scale=1.7+rnd()*.35;}
  else if(choice<.975){asset='forest/objects/Tree_2_E_Color1';scale=1.6+rnd()*.3;}
  else{asset='brumaluz-arboleda/objects/tree_young_rowan';scale=2.3+rnd()*.3;}
  const o=add(asset,x,z,[scale,scale*(.94+rnd()*.12),scale],'paisaje_arboleda_copas','auto');trees.push({x,z,object:o});
 }
 // Cheap leaves and grasses carry most of the floor detail; elaborate plants stay accents.
 for(let i=0;i<trees.length;i++){
  const t=trees[i];if(i%2)continue;
  for(let n=0;n<2;n++){
   const angle=rnd()*Math.PI*2,radius=2.1+rnd()*2.5,x=t.x+Math.cos(angle)*radius,z=t.z+Math.sin(angle)*radius;
   if(!clear(x,z,.25)||trees.some(tree=>Math.hypot(x-tree.x,z-tree.z)<1.5))continue;
   add(n?'forest/objects/Grass_1_C_Color1':'forest/objects/Bush_4_A_Color1',x,z,n?1.2+rnd()*.8:2.5+rnd()*1.6);
   if(i%48===0)add('brumaluz-arboleda/objects/fern_cluster',x+1,z-1,1.1);
   else if(i%82===0)add('brumaluz-arboleda/objects/mushrooms_mooncap',x+1,z-1,.8);
  }
 }
 // A modest arrival under the trees. No buildings, vendors, quests or live portal yet.
 for(const[dx,dz]of [[-5,-17],[8,18]]){
  const x=ax+dx,z=az+dz;
  if(ground(x,z)>.1)add('brumaluz-arboleda/objects/lantern_budpost',x,z,1,'paisaje_arboleda_acceso','auto',Math.PI/2);
 }
 for(let i=0;i<10;i++){
  const angle=i*Math.PI/5,radius=definition.arrivalRadius+3,x=ax+Math.cos(angle)*radius,z=az+Math.sin(angle)*radius;
  if(clear(x,z,.2))add('brumaluz-arboleda/objects/flowers_starmeadow',x,z,.9,'paisaje_arboleda_suelo');
 }
 map.markers=map.markers.filter(m=>m.id!==definition.reservationId);
 map.markers.push({id:definition.reservationId,type:'note',name:'La Arboleda · reserva de llegada',layer:'logica',position:[ax,ground(ax,az),az],rotationY:Math.PI/2,radius:definition.arrivalRadius,text:'Reserva para enlazar el futuro mapa de ciudad de La Arboleda. No es un portal activo.'});
 return{trees:trees.length,ancestralOaks:heroes,understory:map.objects.filter(o=>o.layer==='paisaje_arboleda_suelo').length};
}
