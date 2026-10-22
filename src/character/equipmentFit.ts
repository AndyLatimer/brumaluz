import * as THREE from 'three';
import type {HeadResult} from './head';
type Own=(resource:{dispose():void})=>void;
const center=new THREE.Vector3(0,1.66,-.01);

/** Seat the authored contour on the actual selected skull/hair, in bind coordinates. */
export function seatHeadwear(object:THREE.Object3D,head:HeadResult,own:Own){
  const data=object.userData;
  if(data.fitVersion===3){fitSculptedHeadwear(object,head,own);return}
  if(data.fitVersion!==2)return;
  const seat=data.seatY as number,rx=data.seatX as number,rz=data.seatZ as number,cz=data.centerZ as number;
  const inverse=head.toBone.clone().invert(),surfaces:THREE.Mesh[]=[],ray=new THREE.Raycaster();
  const temporary=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  head.group.traverse(node=>{if(node instanceof THREE.Mesh&&node.name==='character-skull'){const geometry=node.geometry.clone().applyMatrix4(inverse),surface=new THREE.Mesh(geometry,temporary);surface.updateMatrixWorld(true);surfaces.push(surface)}});
  const skull=surfaces[0],bounds=skull?new THREE.Box3().setFromObject(skull):new THREE.Box3(new THREE.Vector3(-.4,1.2,-.4),new THREE.Vector3(.4,2,.4));
  const actualCenter=bounds.getCenter(new THREE.Vector3()),height=bounds.max.y-bounds.min.y,actualSeat=bounds.max.y-height*.18;
  const radii=bounds.getSize(new THREE.Vector3()).multiplyScalar(.5);
  // Hair under a hat is tucked against the skull; a ponytail never stretches the hat.
  head.group.traverse(node=>{
    if(!(node instanceof THREE.Mesh)||node.name!=='character-hair')return;
    const positions=node.geometry.getAttribute('position'),point=new THREE.Vector3();
    for(let i=0;i<positions.count;i++){
      point.fromBufferAttribute(positions,i).applyMatrix4(inverse);if(point.y<actualSeat-.012)continue;
      const direction=point.clone().sub(actualCenter).normalize();
      const limit=.99/Math.sqrt((direction.x/radii.x)**2+(direction.y/radii.y)**2+(direction.z/radii.z)**2);
      if(point.distanceTo(actualCenter)>limit){point.copy(actualCenter).addScaledVector(direction,limit).applyMatrix4(head.toBone);positions.setXYZ(i,point.x,point.y,point.z)}
    }
    positions.needsUpdate=true;node.geometry.computeVertexNormals();
  });
  const sample=(angle:number)=>{
    const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));ray.set(new THREE.Vector3(actualCenter.x,actualSeat,actualCenter.z).addScaledVector(direction,2),direction.clone().negate());
    const hit=ray.intersectObjects(surfaces,false)[0];return hit?hit.point.clone().addScaledVector(direction,.007):head.anchors.surf(new THREE.Vector3(rx*Math.cos(angle),seat-center.y,rz*Math.sin(angle)).normalize(),-.008).p;
  };
  object.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    node.geometry=node.geometry.clone();own(node.geometry);
    const p=node.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){
      const x=p.getX(i)/rx,z=(p.getZ(i)-cz)/rz,r=Math.hypot(x,z),angle=Math.atan2(z,x),target=sample(angle);
      const point=new THREE.Vector3(actualCenter.x+(target.x-actualCenter.x)*r,p.getY(i)-seat+actualSeat,actualCenter.z+(target.z-actualCenter.z)*r);
      if(p.getY(i)>seat+.025){
        const direction=point.clone().sub(actualCenter).normalize();ray.set(actualCenter.clone().addScaledVector(direction,2),direction.clone().negate());
        const surface=ray.intersectObjects(surfaces,false)[0];
        if(surface&&point.distanceTo(actualCenter)<surface.point.distanceTo(actualCenter)+.007)point.copy(surface.point).addScaledVector(direction,.007);
      }
      p.setXYZ(i,point.x,point.y,point.z);
    }
    p.needsUpdate=true;node.geometry.computeVertexNormals();node.geometry.computeBoundingBox();node.geometry.computeBoundingSphere();
  });
  for(const surface of surfaces)surface.geometry.dispose();temporary.dispose();
}

/** Preserve the sculpted silhouette, transferring only the skull's shape difference.
 * Brims and bent crowns retain their authored clearance, rather than shrinking
 * every cross section to the small contact ring at the top of the head. */
function fitSculptedHeadwear(object:THREE.Object3D,head:HeadResult,own:Own){
 const reference=new THREE.Vector3(...object.userData.fitCenter as [number,number,number]);
 const radii=object.userData.fitRadii as [number,number,number],inverse=head.toBone.clone().invert();
 const point=new THREE.Vector3(),direction=new THREE.Vector3(),samples=new Map<string,number>();
 const radial=(d:THREE.Vector3)=>{
  const key=`${Math.round(d.x*96)},${Math.round(d.y*96)},${Math.round(d.z*96)}`;
  let value=samples.get(key);if(value==null){value=head.skullSurface(d).distanceTo(center);samples.set(key,value)}return value;
 };
 object.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return;
  node.geometry=node.geometry.clone();own(node.geometry);const p=node.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i);direction.copy(point).sub(reference);const authored=direction.length();direction.normalize();
   const shell=Math.pow(Math.abs(direction.x/radii[0])**2.15+Math.abs(direction.y/radii[1])**2.15+Math.abs(direction.z/radii[2])**2.15,-1/2.15);
   // Keep the hem outside the crown: collapsing both onto one minimum radius
   // caused their surfaces to flicker against each other on helmet sides/backs.
   const clearance=Math.max(.003,authored-shell+(object.userData.fitOffset??0));
   point.copy(center).addScaledVector(direction,radial(direction)+clearance);p.setXYZ(i,point.x,point.y,point.z);
  }
  p.needsUpdate=true;node.geometry.computeVertexNormals();node.geometry.computeBoundingSphere();
 });
 // Tuck only hair beneath the occupied part of the hat. Free hair and ponytails
 // below its rim keep their silhouette. Each wearer owns these geometries.
 const hatMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),surfaces:THREE.Mesh[]=[];
 object.traverse(node=>{if(node instanceof THREE.Mesh){const m=new THREE.Mesh(node.geometry,hatMaterial);m.updateMatrixWorld(true);surfaces.push(m)}});
 const ray=new THREE.Raycaster(),coverage=new Map<string,number>();
 head.group.traverse(node=>{
  if(!(node instanceof THREE.Mesh)||node.name!=='character-hair')return;
  const p=node.geometry.getAttribute('position');let changed=false;
  for(let i=0;i<p.count;i++){
   point.fromBufferAttribute(p,i).applyMatrix4(inverse);direction.copy(point).sub(center);const distance=direction.length();direction.normalize();
   // Hair meshes repeat vertices at triangle and UV seams. Reuse the exact ray
   // result for duplicates; do not quantize the contact contour.
   const key=`${direction.x},${direction.y},${direction.z}`;
   let covered=coverage.get(key);if(covered==null){ray.set(center,direction);covered=ray.intersectObjects(surfaces,false)[0]?.distance??Infinity;coverage.set(key,covered)}
   if(Number.isFinite(covered)&&distance>covered-.012){point.copy(center).addScaledVector(direction,Math.max(radial(direction)-.004,covered-.014)).applyMatrix4(head.toBone);p.setXYZ(i,point.x,point.y,point.z);changed=true}
  }
  if(changed){p.needsUpdate=true;node.geometry.computeVertexNormals()}
 });
 hatMaterial.dispose();
}

/** Rest-pose garment envelope shared with the accessory authoring pattern. */
export function torsoSurface(x:number,y:number){
 const rows=[[.52,.327,.269],[.68,.31,.258],[.80,.297,.249],[.98,.31,.255],[1.10,.30,.248],[1.17,.25,.213],[1.245,.145,.135]];
 let a=rows[0],b=a;for(const row of rows){b=row;if(row[0]>=y)break;a=row}
 const t=a===b?0:THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1),rx=THREE.MathUtils.lerp(a[1],b[1],t),rz=THREE.MathUtils.lerp(a[2],b[2],t);
 return rz*Math.sqrt(Math.max(0,1-(x/rx)**2));
}

type ProjectedFace={indices:[number,number,number];a:THREE.Vector3;b:THREE.Vector3;c:THREE.Vector3;denominator:number};
const projectionCells=new WeakMap<THREE.BufferGeometry,Map<string,ProjectedFace[]>>();
const projectionStep=.035;
function garmentProjection(geometry:THREE.BufferGeometry){
 let cells=projectionCells.get(geometry);if(cells)return cells;
 cells=new Map();const positions=geometry.getAttribute('position'),index=geometry.index;
 for(let i=0;i<(index?.count??positions.count);i+=3){
  const indices=[0,1,2].map(k=>index?index.getX(i+k):i+k) as [number,number,number];
  const [a,b,c]=indices.map(n=>new THREE.Vector3().fromBufferAttribute(positions,n));
  const denominator=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(denominator)<1e-10)continue;
  const face={indices,a,b,c,denominator};
  const x0=Math.floor(Math.min(a.x,b.x,c.x)/projectionStep),x1=Math.floor(Math.max(a.x,b.x,c.x)/projectionStep);
  const y0=Math.floor(Math.min(a.y,b.y,c.y)/projectionStep),y1=Math.floor(Math.max(a.y,b.y,c.y)/projectionStep);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const key=`${x}:${y}`,bucket=cells.get(key);if(bucket)bucket.push(face);else cells.set(key,[face])}
 }
 projectionCells.set(geometry,cells);return cells;
}

/** Jewellery rests on the equipped cloth and uses that cloth's weights, including its spine blend. */
export function settleAccessory(object:THREE.Object3D,garment:THREE.Object3D,own:Own){
 const surfaces:{mesh:THREE.SkinnedMesh;cells:Map<string,ProjectedFace[]>}[]=[];
 // A garment with several GLB materials is a Group, not a single SkinnedMesh.
 // Fit against its outer plate, collar and belt as well as the cloth beneath.
 garment.traverse(source=>{if(source instanceof THREE.SkinnedMesh)surfaces.push({mesh:source,cells:garmentProjection(source.geometry)})});
 if(!surfaces.length)return;
 const bary=new THREE.Vector3();
 object.traverse(node=>{
  if(!(node instanceof THREE.SkinnedMesh))return;
  node.geometry=node.geometry.clone();own(node.geometry);
  const p=node.geometry.getAttribute('position'),w=node.geometry.getAttribute('skinWeight'),j=node.geometry.getAttribute('skinIndex');
  const byName=new Map(node.skeleton.bones.map((bone,index)=>[bone.name,index]));
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),side=z<0?-1:1;
   // Only examine faces in this XY cell. A necklace has thousands of vertices;
   // a full mesh raycast per vertex stalled character creation with detailed cloth.
   const key=`${Math.floor(x/projectionStep)}:${Math.floor(y/projectionStep)}`;
   let surface:THREE.SkinnedMesh|undefined,face:ProjectedFace|undefined,hitZ=side>0?-Infinity:Infinity;
   for(const candidate of surfaces)for(const f of candidate.cells.get(key)??[]){
    const a=((f.b.y-f.c.y)*(x-f.c.x)+(f.c.x-f.b.x)*(y-f.c.y))/f.denominator;
    const b=((f.c.y-f.a.y)*(x-f.c.x)+(f.a.x-f.c.x)*(y-f.c.y))/f.denominator,c=1-a-b;
    if(a<-.000001||b<-.000001||c<-.000001)continue;
    const depth=a*f.a.z+b*f.b.z+c*f.c.z;
    if(side>0?depth>hitZ:depth<hitZ){hitZ=depth;surface=candidate.mesh;face=f;bary.set(Math.max(0,a),Math.max(0,b),Math.max(0,c));bary.multiplyScalar(1/(bary.x+bary.y+bary.z))}
   }
   if(!surface||!face)continue;
   const weights=surface.geometry.getAttribute('skinWeight'),joints=surface.geometry.getAttribute('skinIndex');
   const depth=THREE.MathUtils.clamp(Math.abs(z)-torsoSurface(x,y),.003,.028);
   p.setZ(i,hitZ+side*depth);
   const influence=new Map<number,number>();
   const skeleton=surface.skeleton;
   face.indices.forEach((index,vertex)=>{for(let k=0;k<4;k++){const target=byName.get(skeleton.bones[joints.getComponent(index,k)]?.name);if(target==null)continue;influence.set(target,(influence.get(target)??0)+weights.getComponent(index,k)*bary.getComponent(vertex))}});
   const best=[...influence].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=best.reduce((v,pair)=>v+pair[1],0);
   if(sum>0){for(let k=0;k<4;k++){j.setComponent(i,k,best[k]?.[0]??0);w.setComponent(i,k,(best[k]?.[1]??0)/sum)}}
  }
  p.needsUpdate=true;w.needsUpdate=true;j.needsUpdate=true;node.geometry.computeVertexNormals();node.geometry.computeBoundingBox();node.geometry.computeBoundingSphere();
 });
}
