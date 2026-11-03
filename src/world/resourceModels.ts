import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resourceColor, type ResourceFamily } from '../data/resourceAppearance';

/** Painted low-poly pieces, merged into a single draw per model, with procedural vertex texturing. */
export type TextureKind = 'wood' | 'wood_light' | 'wood_dark' | 'metal' | 'brass' | 'iron' | 'gold' | 'cloth' | 'carpet' | 'linen' | 'terracotta' | 'leaf' | 'paper' | 'book' | 'glass' | 'flame' | 'plain';

class Model {
 private parts:THREE.BufferGeometry[]=[];
 private transformStack:THREE.Matrix4[]=[new THREE.Matrix4()];

 pushGroup(position=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){
  const local=new THREE.Matrix4().compose(
   new THREE.Vector3(...position),
   new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
   new THREE.Vector3(...scale)
  );
  const current=this.transformStack[this.transformStack.length-1];
  this.transformStack.push(current.clone().multiply(local));
 }

 popGroup(){
  if(this.transformStack.length>1)this.transformStack.pop();
 }

 withGroup(position:number[],rotation:number[],fn:()=>void,scale=[1,1,1]){
  this.pushGroup(position,rotation,scale);
  try{
   fn();
  }finally{
   this.popGroup();
  }
 }

 add(geometry:THREE.BufferGeometry,color:string,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0],textureType?:TextureKind) {
  const flat=geometry.index?geometry.toNonIndexed():geometry; if(flat!==geometry)geometry.dispose();
  flat.deleteAttribute('uv');
  const localMatrix=new THREE.Matrix4().compose(
   new THREE.Vector3(...position),
   new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
   new THREE.Vector3(...scale)
  );
  const worldMatrix=this.transformStack[this.transformStack.length-1].clone().multiply(localMatrix);
  flat.applyMatrix4(worldMatrix);
  flat.computeVertexNormals();

  const base=new THREE.Color(color);
  const posAttr=flat.attributes.position;
  const normAttr=flat.attributes.normal;
  const count=posAttr.count;
  const colors=new Float32Array(count*3);

  // Directional key light vector for authentic top-down depth
  const lx=0.38,ly=0.86,lz=0.34;

  for(let i=0;i<count;i++){
   const px=posAttr.getX(i),py=posAttr.getY(i),pz=posAttr.getZ(i);
   const nx=normAttr.getX(i),ny=normAttr.getY(i),nz=normAttr.getZ(i);
   let c=base.clone();

   if(!textureType||textureType==='plain'){
    const shade=.94+Math.sin(i*1.618+this.parts.length*3.4)*.055;
    c.multiplyScalar(shade);
   }else{
    const dot=nx*lx+ny*ly+nz*lz;
    const ao=Math.min(1.0,0.84+Math.max(0,py)*1.8);
    let light=(0.86+Math.max(0,dot)*0.24+Math.max(0,ny)*0.10)*ao;
    if(ny<-0.2)light*=0.78+(ny+1)*0.22;
    const isBevel=(Math.abs(ny)>0.35&&Math.abs(ny)<0.85)||(Math.abs(nx)>0.35&&Math.abs(nx)<0.85);
    if(isBevel)light*=1.08;

    if(textureType.startsWith('wood')){
     const trunkGrad=0.94+Math.sin(py*4.0)*0.06;
     const partShift=0.96+((this.parts.length*17)%9)*0.01;
     const endGrain=Math.abs(ny)>0.92?0.92:1.0;
     c.multiplyScalar(light*trunkGrad*partShift*endGrain);
    }else if(textureType==='cloth'||textureType==='carpet'||textureType==='linen'){
     const rim=(1.0-Math.abs(dot))*0.08;
     const partShift=0.97+((this.parts.length*13)%7)*0.01;
     const heightGrad=0.96+Math.min(0.08,py*0.15);
     c.multiplyScalar(light*partShift*heightGrad).addScalar(rim);
    }else if(textureType==='brass'||textureType==='gold'){
     const spec=Math.pow(Math.max(0,ny*0.75+nx*0.45-nz*0.45),3.0);
     c.multiplyScalar(light*1.04).addScalar(spec*0.32);
    }else if(textureType==='iron'||textureType==='metal'){
     const spec=Math.pow(Math.max(0,ny*0.7+nx*0.5-nz*0.4),2.5);
     c.multiplyScalar(light*0.98).addScalar(spec*0.16);
    }else if(textureType==='terracotta'){
     const clayGrad=0.92+Math.sin(py*3.5)*0.08;
     c.multiplyScalar(light*clayGrad);
    }else if(textureType==='leaf'){
     const sss=0.90+Math.max(0,py-0.3)*0.28;
     c.multiplyScalar(light*sss);
    }else if(textureType==='paper'||textureType==='book'){
     c.multiplyScalar(light*1.02);
    }else if(textureType==='flame'){
     c.multiplyScalar(1.40);
    }else if(textureType==='glass'){
     const rim=Math.pow(1.0-Math.abs(nz),2.0)*0.28;
     c.multiplyScalar(light).addScalar(rim);
    }else{
     c.multiplyScalar(light);
    }
   }
   c.r=Math.min(1,Math.max(0,c.r));
   c.g=Math.min(1,Math.max(0,c.g));
   c.b=Math.min(1,Math.max(0,c.b));
   c.toArray(colors,i*3);
  }

  flat.setAttribute('color',new THREE.BufferAttribute(colors,3));
  this.parts.push(flat);return this;
 }
 box(color:string,p:number[],s:number[],r=[0,0,0],textureType?:TextureKind){return this.add(new THREE.BoxGeometry(1,1,1),color,p,s,r,textureType);}
 rock(color:string,p:number[],s:number[],r=[0,0,0]){return this.add(new THREE.IcosahedronGeometry(1,0),color,p,s,r);}
 ball(color:string,p:number[],s:number[],textureType?:TextureKind){return this.add(new THREE.SphereGeometry(1,10,7),color,p,s,[0,0,0],textureType);}
 rod(color:string,a:number[],b:number[],radius:number,top=radius,segments=8,textureType?:TextureKind){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from);
  const len=direction.length();
  if(len<=0.0001)return this;
  const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()));
  return this.add(new THREE.CylinderGeometry(top,radius,direction.length(),segments),color,from.lerp(to,.5).toArray(),[1,1,1],[rotation.x,rotation.y,rotation.z],textureType);
  return this.add(new THREE.CylinderGeometry(top,radius,len,segments),color,from.lerp(to,.5).toArray(),[1,1,1],[rotation.x,rotation.y,rotation.z],textureType);
 }
 cyl(color:string,p:number[],radius:number,height:number,segments=16,r=[0,0,0],radiusTop=radius,textureType?:TextureKind){
  return this.add(new THREE.CylinderGeometry(radiusTop,radius,height,segments),color,p,[1,1,1],r,textureType);
 }
 torus(color:string,p:number[],radius:number,tube:number,radialSegments=8,tubularSegments=16,r=[0,0,0],textureType?:TextureKind){
  return this.add(new THREE.TorusGeometry(radius,tube,radialSegments,tubularSegments),color,p,[1,1,1],r,textureType);
 }
 lathe(color:string,p:number[],points:[number,number][],segments=16,r=[0,0,0],textureType?:TextureKind){
  const pts=points.map(([x,y])=>new THREE.Vector2(x,y));
  return this.add(new THREE.LatheGeometry(pts,segments),color,p,[1,1,1],r,textureType);
 }
 extrude(color:string,p:number[],shape:THREE.Shape,depth:number,r=[0,0,0],s=[1,1,1],textureType?:TextureKind){
  const geom=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});
  geom.center();
  return this.add(geom,color,p,s,r,textureType);
 }
 leaf3D(color:string,start:number[],tip:number[],width=0.08,textureType:TextureKind='leaf'){
  const a=new THREE.Vector3(...start),b=new THREE.Vector3(...tip);
  const dir=b.clone().sub(a);
  let side=new THREE.Vector3(-dir.y,dir.x,0);
  if(side.length()<0.001)side=new THREE.Vector3(1,0,0);
  side.normalize();
  const outline=[
   a.clone(),
   a.clone().add(dir.clone().multiplyScalar(0.28)).add(side.clone().multiplyScalar(width)),
   a.clone().add(dir.clone().multiplyScalar(0.68)).add(side.clone().multiplyScalar(width*0.72)),
   b.clone(),
   a.clone().add(dir.clone().multiplyScalar(0.68)).sub(side.clone().multiplyScalar(width*0.72)),
   a.clone().add(dir.clone().multiplyScalar(0.28)).sub(side.clone().multiplyScalar(width))
  ];
  const ridge=a.clone().add(dir.clone().multiplyScalar(0.48)).add(new THREE.Vector3(0,width*0.28,0));
  const underside=ridge.clone().sub(new THREE.Vector3(0,0.012,0));
  const verts=[...outline,ridge,underside];
  const positions:number[]=[];
  for(let i=0;i<6;i++){
   const p1=verts[i],p2=verts[(i+1)%6],p3=verts[6];
   positions.push(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z,p3.x,p3.y,p3.z);
  }
  for(let i=0;i<6;i++){
   const p1=verts[(i+1)%6],p2=verts[i],p3=verts[7];
   positions.push(p1.x,p1.y,p1.z,p2.x,p2.y,p2.z,p3.x,p3.y,p3.z);
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.computeVertexNormals();
  return this.add(geom,color,[0,0,0],[1,1,1],[0,0,0],textureType);
 }
 leaf(p:number[],size:number,angle:number,color='#769354'){
  return this.add(new THREE.SphereGeometry(1,6,4),color,p,[size*.42,size*.12,size],[.25,angle,.25],'leaf');
 }
 finish(){const merged=mergeGeometries(this.parts);for(const part of this.parts)part.dispose();merged.computeBoundingBox();merged.computeBoundingSphere();return merged;}
}
const bark='#73533d',earth='#75694c',leaf='#718b50',leafLight='#92a563';
function patch(model:Model,size=.65){
 model.add(new THREE.CylinderGeometry(size,size*.91,.035,9),'#82734f',[0,.005,0]);
 for(let i=0;i<4;i++){const a=i*2.4;model.rock('#9a957b',[Math.sin(a)*size*.8,.04,Math.cos(a)*size*.8],[.09,.055,.075],[i,.3,0]);}
}

export function resourceGeometry(family:ResourceFamily,tier:number,depleted=false):THREE.BufferGeometry {
 const m=new Model(),color=resourceColor(family,tier);patch(m,family==='wood'||family==='fruit'?.67:.54);
 if(family==='ore'||family==='gem'){
  for(let i=0;i<4;i++){const a=i*2.4,size=i===0?.46:.26;
   m.rock(i%2?'#7c8178':'#929182',[Math.sin(a)*.33,.14+size*.25,Math.cos(a)*.27],[size,size*.8,size*.85],[i*.6,.4*i,.2]);
  }
  if(!depleted)for(let i=0;i<(family==='gem'?5:8);i++){
   const a=i*2.3999,x=Math.sin(a)*.34,z=Math.cos(a)*.27;
   if(family==='gem'){
    const h=.3+(i%3)*.17;
    m.add(new THREE.CylinderGeometry(0,.105,h*.3,5),color,[x,.28+h*.85,z],[1,1,1],[.14*Math.sin(a),a,.13*Math.cos(a)]);
    m.add(new THREE.CylinderGeometry(.105,.09,h*.7,5),color,[x,.28+h*.35,z],[1,1,1],[.14*Math.sin(a),a,.13*Math.cos(a)]);
   }else m.rock(color,[x,.33+(i%3)*.075,z],[.13,.105,.1],[a,.6*i,.3]);
  }
 }else if(family==='wood'){
  m.rod(color,[0,0,0],[0,.36,0],.29,.25,9);
  m.add(new THREE.CylinderGeometry(.235,.235,.018,10),'#c9ac7a',[0,.369,0]);
  for(const radius of [.09,.175])m.add(new THREE.TorusGeometry(radius,.008,3,14),'#99754f',[0,.382,0],[1,1,1],[Math.PI/2,0,0]);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;m.rod(bark,[Math.sin(a)*.42,.025,Math.cos(a)*.42],[Math.sin(a)*.18,.29,Math.cos(a)*.18],.09,.045);}
  if(!depleted){
   m.rod(color,[.08,.25,.04],[.14,1.12,.08],.16,.095);
   if(tier===2)for(let i=0;i<4;i++)m.box('#6b6256',[.1,.45+i*.16,-.005],[.16,.026,.14],[0,i*.7,0]);
   for(let i=0;i<3;i++){const a=i*2.4,x=Math.sin(a)*.43,z=Math.cos(a)*.38;
    m.rod(color,[.12,.6,.05],[x,1.15,z],.055,.025);
    if(tier!==4)m.rock(tier===3?'#72776a':tier===2?'#a2b677':i%2?leafLight:leaf,[x,1.22,z],[tier===1?.28:.37,tier===1?.39:.31,.35],[0,a,.25]);
   }
   if(tier===4)for(let i=0;i<3;i++)m.add(new THREE.ConeGeometry(.61-i*.14,.58,8),'#8a9a5e',[.13,1+i*.25,.06]);
   if(tier===5){m.rod(color,[-.1,.19,.1],[-.31,.72,.17],.1,.055);m.rock('#94a16a',[-.18,.11,.17],[.18,.06,.13]);}
   m.rod(color,[-.3,.14,-.38],[.34,.14,-.38],.115,.11);
   m.add(new THREE.CylinderGeometry(.101,.101,.012,8),'#cfb184',[.345,.14,-.38],[1,1,1],[0,0,Math.PI/2]);
  }
 }else if(family==='mushroom'){
  if(!depleted)for(let i=0;i<5;i++){
   const a=i*2.4,x=Math.sin(a)*.32,z=Math.cos(a)*.28,h=.24+(i%3)*.15,r=.13+(i%3)*.045;
   m.rod('#d4c5a4',[x,.02,z],[x+.025,h,z],.045,.035);
   m.add(new THREE.SphereGeometry(r,9,4,0,Math.PI*2,0,Math.PI/2),color,[x+.025,h,z],[1,.65,1]);
   m.add(new THREE.CylinderGeometry(r,r,.022,9),'#c5af8e',[x+.025,h-.005,z]);
   for(let j=0;j<3;j++){const b=j*2.4;m.ball('#e7d6b5',[x+.025+Math.sin(b)*r*.55,h+r*.49,z+Math.cos(b)*r*.55],[.025,.012,.024]);}
  }
  m.rod(bark,[-.3,.035,.16],[.25,.035,.28],.028);
 }else if(family==='fruit'){
  for(let i=0;i<4;i++){const a=i*2.4,x=Math.sin(a)*.3,z=Math.cos(a)*.28;
   m.rod(bark,[0,.01,0],[x,.57,z],.038,.02);
   if(!depleted){m.rock(i%2?leafLight:leaf,[x,.51,z],[.34,.29,.31],[0,a,0]);
    for(let j=0;j<4;j++){const b=j*2.4;m.ball(color,[x+Math.sin(b)*.25,.49+(j%2)*.18,z+Math.cos(b)*.22],[.065,.073,.065]);}
   }
  }
 }else if(family==='grain'){
  for(let i=0;i<9;i++){const a=i*2.4,x=Math.sin(a)*.32,z=Math.cos(a)*.3,h=depleted?.12:.72+(i%3)*.14;
   m.rod('#9c995e',[x,.01,z],[x+.07,h,z],.012,.008,4);
   if(!depleted){m.leaf([x,.28,z],.23,a,'#9caa69');for(let j=0;j<4;j++)for(const side of [-1,1])m.rock(color,[x+.07+side*.027,h-.16+j*.05,z],[.033,.055,.026],[0,0,side*.55]);}
  }
 }else{
  for(let i=0;i<(family==='fiber'?5:6);i++){
   const a=i*2.4,x=Math.sin(a)*.31,z=Math.cos(a)*.28,h=depleted?.1:(family==='fiber'?.63:.38)+(i%3)*.1;
   m.rod('#6f8551',[x,.015,z],[x+.025,h,z],.014,.009,5);
   if(!depleted){
    m.leaf([x-.08,h*.48,z],.2,a,leaf);m.leaf([x+.08,h*.68,z],.18,a+Math.PI,leafLight);
    if(family==='fiber')for(let j=0;j<3;j++)m.ball(color,[x+Math.sin(j*2.4)*.06,h,z+Math.cos(j*2.4)*.06],[.085,.075,.075]);
    else{for(let j=0;j<5;j++){const b=j*Math.PI*2/5;m.ball(color,[x+.025+Math.sin(b)*.067,h,z+Math.cos(b)*.067],[.055,.026,.055]);}m.ball('#cca34c',[x+.025,h+.02,z],[.033,.023,.033]);}
   }
  }
 }
 return m.finish();
}

export function gatheringToolGeometry(job:string,tier=0){
 const m=new Model(),steel=['#a8adb1','#a5b4a0','#b3cad4','#b7a7c8','#d6bc72','#e2a471'][Math.max(0,Math.min(5,tier))];
 m.rod('#956b42',[0,-.28,0],[0,.62,0],.035,.028,8);
 for(let i=0;i<4;i++)m.rod('#5d4935',[0,-.2+i*.055,0],[0,-.18+i*.055,0],.041,.041,8);
 if(job==='minero'){
  m.rod(steel,[-.36,.49,0],[0,.65,0],.025,.065,5);m.rod(steel,[0,.65,0],[.34,.48,0],.065,.008,5);
  m.box('#c4aa72',[0,.61,0],[.1,.12,.1]);
 }else if(job==='lenador'){
  m.box(steel,[.15,.57,0],[.35,.26,.065],[0,0,.16]);m.box('#d8ddd2',[.32,.55,0],[.04,.26,.055],[0,0,.16]);m.box('#80705b',[-.055,.57,0],[.12,.14,.09]);
 }else if(job==='pescador'||job==='pesca'){
  m.rod('#9c6f2a',[0,.62,0],[.06,1.82,.14],.024,.008,8);
  m.rod(steel,[0,-.04,-.04],[0,-.04,.04],.042,.042,8);
  m.box('#d8a85c',[0,-.04,0],[.045,.07,.055]);
  m.box(steel,[.03,1.15,.08],[.018,.026,.018]);
  m.box(steel,[.055,1.78,.13],[.014,.02,.014]);
 }else{
  const blade=new THREE.Shape();blade.absarc(.16,.65,.28,-.4,Math.PI*1.3,false);blade.absarc(.16,.65,.19,Math.PI*1.3,-.4,true);blade.closePath();
  m.add(new THREE.ExtrudeGeometry(blade,{depth:.04,bevelEnabled:false,curveSegments:10}),steel,[0,0,-.02]);
 }
 return m.finish();
}

export { furnitureGeometry } from './homeFurniture';

export const resourceMaterial=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.74,metalness:.06});
