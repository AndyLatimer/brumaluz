// Shared by the full RPG build and the landscape-only publication pass.
export function mapBlockers(map, boxes) {
 const layers=new Set(map.layers.filter(l=>l.visible).map(l=>l.id)),rows=[];
 const terrain=map.terrain,heights=Buffer.from(terrain.heights,'base64');
 const ground=(x,z)=>{
  const fx=Math.max(0,Math.min(terrain.columns-1,(x-terrain.origin[0])/terrain.cell)),fz=Math.max(0,Math.min(terrain.rows-1,(z-terrain.origin[1])/terrain.cell));
  const i=Math.min(terrain.columns-2,Math.floor(fx)),j=Math.min(terrain.rows-2,Math.floor(fz)),a=fx-i,b=fz-j;
  return [[i,j,(1-a)*(1-b)],[i+1,j,a*(1-b)],[i,j+1,(1-a)*b],[i+1,j+1,a*b]].reduce((h,[i,j,w])=>h+heights.readInt16LE((j*terrain.columns+i)*2)/100*w,0);
 };
 for(const object of map.objects){
  if(object.collision!=='auto'||!layers.has(object.layer)||object.hidden)continue;
  if(map.id==='pompelin'&&object.asset.startsWith('city/hex_'))continue;
  const box=boxes.get(object.asset);if(!box||box.isEmpty())continue;
  const [sx,sy,sz]=object.scale;
  const row={map:map.id,x:object.position[0],z:object.position[2],yaw:object.rotation[1]};
  if(object.asset==='medieval-builder/objects/bridge'&&object.walkable===true){
   // The walkway is clear; only the two visible curbs obstruct horizontally.
   for(const side of[-1,1])rows.push({...row,minX:-sx,maxX:sx,minZ:(side<0?-.3:.17322)*sz,maxZ:(side<0?-.17322:.3)*sz});
   continue;
  }
  // A tree on a hill still blocks at character height. Absolute world Y discarded
  // almost every obstacle on the former raised landscape.
  const y=map.id==='pompelin'?object.position[1]-(object.conform?0:ground(row.x,row.z)):object.position[1];
  if(y+box.max.y*sy<.65||y+box.min.y*sy>1.5)continue;
  rows.push({...row,minX:box.min.x*sx,maxX:box.max.x*sx,minZ:box.min.z*sz,maxZ:box.max.z*sz});
 }
 for(const c of map.colliders??[])if(layers.has(c.layer))rows.push({map:map.id,x:c.position[0],z:c.position[2],yaw:c.rotationY??0,minX:-c.size[0]/2,maxX:c.size[0]/2,minZ:-c.size[2]/2,maxZ:c.size[2]/2});
 return rows;
}
