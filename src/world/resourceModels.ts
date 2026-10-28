import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resourceColor, type ResourceFamily } from '../data/resourceAppearance';

/** Painted low-poly pieces, merged into a single draw per model, without textures. */
class Model {
 private parts:THREE.BufferGeometry[]=[];
 add(geometry:THREE.BufferGeometry,color:string,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]) {
  const flat=geometry.index?geometry.toNonIndexed():geometry; if(flat!==geometry)geometry.dispose();
  flat.deleteAttribute('uv');
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
  flat.applyMatrix4(matrix);
  const base=new THREE.Color(color),colors=new Float32Array(flat.attributes.position.count*3);
  for(let i=0;i<flat.attributes.position.count;i+=3){const shade=.94+Math.sin(i*1.618+this.parts.length*3.4)*.055;for(let j=0;j<3;j++)base.clone().multiplyScalar(shade).toArray(colors,(i+j)*3);}
  flat.setAttribute('color',new THREE.BufferAttribute(colors,3));this.parts.push(flat);return this;
 }
 box(color:string,p:number[],s:number[],r=[0,0,0]){return this.add(new THREE.BoxGeometry(1,1,1),color,p,s,r);}
 rock(color:string,p:number[],s:number[],r=[0,0,0]){return this.add(new THREE.IcosahedronGeometry(1,0),color,p,s,r);}
 ball(color:string,p:number[],s:number[]){return this.add(new THREE.SphereGeometry(1,8,5),color,p,s);}
 rod(color:string,a:number[],b:number[],radius:number,top=radius,segments=7){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),direction=to.clone().sub(from);
  const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()));
  return this.add(new THREE.CylinderGeometry(top,radius,direction.length(),segments),color,from.lerp(to,.5).toArray(),[1,1,1],[rotation.x,rotation.y,rotation.z]);
 }
 leaf(p:number[],size:number,angle:number,color='#769354'){
  return this.add(new THREE.SphereGeometry(1,5,3),color,p,[size*.42,size*.12,size],[.25,angle,.25]);
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
 }else{
  const blade=new THREE.Shape();blade.absarc(.16,.65,.28,-.4,Math.PI*1.3,false);blade.absarc(.16,.65,.19,Math.PI*1.3,-.4,true);blade.closePath();
  m.add(new THREE.ExtrudeGeometry(blade,{depth:.04,bevelEnabled:false,curveSegments:10}),steel,[0,0,-.02]);
 }
 return m.finish();
}

export function furnitureGeometry(kind:string,tier=0,job?:string){
 const m=new Model(),wood=resourceColor('wood',tier),light='#c7a477',iron='#6e7772';
 if(kind==='biblioteca'){
  m.box('#70553d',[0,.9,.32],[1.5,1.8,.08]);
  for(const x of [-.74,.74])m.box(wood,[x,.92,0],[.13,1.84,.72]);
  for(let i=0;i<4;i++)m.box(wood,[0,.13+i*.54,0],[1.55,.09,.77]);
  m.box(light,[0,1.86,0],[1.7,.1,.82]);
  for(let row=0;row<3;row++)for(let i=0;i<7;i++){
   const x=-.59+i*.18,h=.3+(i%3)*.04,col=['#71815d','#8d6b65','#737f91','#b29a69'][i%4];
   m.box(col,[x,.34+row*.54,-.06],[.115,h,.39],[0,0,i===6?-.13:0]);
   for(const y of [-.09,.09])m.box('#c3ad7f',[x,.34+row*.54+y,-.26],[.095,.012,.015]);
  }
 }else{
  const small=kind==='taburete',w=small?.62:1.6,depth=small?.6:.8,h=small?.53:.8;
  if(small)m.add(new THREE.CylinderGeometry(.36,.34,.11,12),wood,[0,h,0]);
  else for(let i=0;i<4;i++)m.box(i%2?wood:light,[0,h,-.3+i*.2],[w,.1,.19]);
  for(const x of [-w*.38,w*.38])for(const z of [-depth*.34,depth*.34]){
   m.box(wood,[x,h*.48,z],[.095,h,.095],[small?z*.25:0,0,small?-x*.25:0]);
   if(!small)m.box(iron,[x,.12,z],[.102,.07,.102]);
  }
  for(const z of [-depth*.34,depth*.34])m.box(wood,[0,h*.4,z],[w*.8,.065,.065]);
  for(const x of [-w*.38,w*.38])m.box(wood,[x,h*.27,0],[.065,.065,depth*.8]);
  if(kind==='estacion'){
   m.box('#65533d',[0,.46,.13],[1.35,.07,.4]);m.box(wood,[0,.63,.02],[.66,.22,.56]);
   m.box(iron,[.38,.86,-.07],[.22,.13,.25]);m.box(iron,[.47,.91,-.07],[.065,.23,.25]);
   m.rod(iron,[.37,.86,-.18],[.37,.86,-.42],.025);m.rod(light,[.37,.76,-.39],[.37,.96,-.39],.023);
   m.box('#b6a887',[-.39,.86,.03],[.42,.035,.33],[0,.15,0]);
   m.rod(bark,[-.54,.9,-.05],[-.25,.9,.17],.025);m.box(iron,[-.24,.92,.17],[.14,.08,.08],[0,.6,0]);
   if(job==='alquimia'||job==='cocina'){m.ball('#8cae95',[-.44,.99,-.19],[.075,.11,.075]);m.rod('#b58f5b',[-.44,1.06,-.19],[-.44,1.13,-.19],.035);}
  }
 }
 return m.finish();
}

export const resourceMaterial=()=>new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:.035});
