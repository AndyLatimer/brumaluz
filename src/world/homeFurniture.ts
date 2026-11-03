import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resourceColor } from '../data/resourceAppearance';

// Stable, opaque surfaces. Each model is a single indexed mesh and a single PBR draw.
// One padded 4 × 4 atlas: substantial details in geometry, fine craftwork in filtered textures.
type Surface = 'wood' | 'linen' | 'metal' | 'clay' | 'plain' | 'rug' | 'leaf' | 'amber' | 'embroidered' | 'wicker' | 'carved' | 'ceramic' | 'leather' | 'book' | 'endgrain' | 'paper';
const slots: Record<Surface, number> = {wood:0,linen:1,metal:2,clay:3,plain:4,rug:5,leaf:6,amber:7,embroidered:8,wicker:9,carved:10,ceramic:11,leather:12,book:13,endgrain:14,paper:15};
type Point = [number, number, number];
class Furniture {
  private parts: THREE.BufferGeometry[] = [];
  private stack = [new THREE.Matrix4()];
  private details: {name:string;surface:Surface}[] = [];
  group(p:Point, yaw:number, build:()=>void) {
    this.stack.push(this.stack.at(-1)!.clone().multiply(new THREE.Matrix4().makeRotationY(yaw).setPosition(...p)));
    try { build(); } finally { this.stack.pop(); }
  }
  add(name:string, surface:Surface, color:string, geometry:THREE.BufferGeometry, p:Point=[0,0,0], r:Point=[0,0,0]) {
    const g=geometry.index?geometry.toNonIndexed():geometry;
    if(g!==geometry)geometry.dispose();
    g.computeBoundingBox();
    const bounds=g.boundingBox!,size=bounds.getSize(new THREE.Vector3()),pos=g.getAttribute('position'),normal=g.getAttribute('normal');
    const uv=new Float32Array(pos.count*2),colors=new Float32Array(pos.count*3),base=new THREE.Color(color),slot=slots[surface];
    // Face projection happens before rotation: wood grain follows the joinery.
    // A constant projection per triangle prevents atlas seams across bevels.
    for(let i=0;i<pos.count;i+=3) {
      const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
      const n=b.sub(a).cross(c.sub(a));
      const axis=Math.abs(n.y)>=Math.abs(n.x)&&Math.abs(n.y)>=Math.abs(n.z)?1:Math.abs(n.x)>=Math.abs(n.z)?0:2;
      const axes=axis===1?[0,2]:axis===0?[2,1]:[0,1];
      if((surface==='wood'||surface==='carved')&&size.getComponent(axes[0])>size.getComponent(axes[1])) axes.reverse();
      for(let j=i;j<i+3;j++) {
        const point=new THREE.Vector3().fromBufferAttribute(pos,j);
        const u=(point.getComponent(axes[0])-bounds.min.getComponent(axes[0]))/Math.max(.0001,size.getComponent(axes[0]));
        const v=(point.getComponent(axes[1])-bounds.min.getComponent(axes[1]))/Math.max(.0001,size.getComponent(axes[1]));
        uv[j*2]=(slot%4+(16+u*480)/512)/4;
        // glTF convention: V=0 is the top of the image (textures use flipY=false).
        uv[j*2+1]=(Math.floor(slot/4)+(16+(1-v)*480)/512)/4;
        // No baked directional lighting or per-triangle noise; real lights shade smooth normals.
        // Soft contact shading at the underside, broad enough to remain stable at distance.
        const height=(point.y-bounds.min.y)/Math.max(.001,size.y);
        const shade=.90+.10*Math.min(1,height*3);
        colors.set(base.clone().multiplyScalar(shade).toArray(),j*3);
      }
    }
    g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    g.clearGroups();
    g.applyMatrix4(this.stack.at(-1)!.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),new THREE.Vector3(1,1,1))));
    // Keep the analytical smooth normals of turned legs, pots and rounded edges.
    if(!normal)g.computeVertexNormals();
    this.parts.push(g);this.details.push({name,surface});
  }
  box(name:string,s:Surface,c:string,p:Point,size:Point,bevel=.006,r:Point=[0,0,0]) {
    this.add(name,s,c,bevel>0?new RoundedBoxGeometry(...size,1,Math.min(bevel,...size.map(v=>v*.2))):new THREE.BoxGeometry(...size),p,r);
  }
  lathe(name:string,s:Surface,c:string,p:Point,profile:[number,number][],segments=24) {
    this.add(name,s,c,new THREE.LatheGeometry(profile.map(q=>new THREE.Vector2(...q)),segments),p);
  }
  rod(name:string,s:Surface,c:string,a:Point,b:Point,radius:number,top=radius,segments=12) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
    if(d.length()<.0001)return;
    const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize()));
    this.add(name,s,c,new THREE.CylinderGeometry(top,radius,d.length(),segments),start.add(end).multiplyScalar(.5).toArray(),[rotation.x,rotation.y,rotation.z]);
  }
  ball(name:string,s:Surface,c:string,p:Point,size:Point) {
    const g=new THREE.SphereGeometry(1,12,8);g.scale(...size);this.add(name,s,c,g,p);
  }
  ring(name:string,s:Surface,c:string,p:Point,radius:number,tube:number,r:Point=[Math.PI/2,0,0]) {
    this.add(name,s,c,new THREE.TorusGeometry(radius,tube,6,24),p,r);
  }
  curve(name:string,s:Surface,c:string,points:Point[],radius=.004,closed=false) {
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed,'centripetal');
    this.add(name,s,c,new THREE.TubeGeometry(path,Math.max(12,points.length*3),radius,6,closed));
    if(!closed)for(const p of [points[0],points.at(-1)!])this.ball(`${name} cap`,s,c,p,[radius,radius,radius]);
  }
  drape(name:string,c:string,p:Point,width:number,profile:[number,number][]) {
    const shape=new THREE.Shape();shape.moveTo(-profile[0][1],profile[0][0]);
    for(const [y,z] of profile.slice(1))shape.lineTo(-z,y);
    for(const [y,z] of [...profile].reverse())shape.lineTo(-z,y-.006);
    shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});
    g.translate(0,0,-width/2);g.rotateY(Math.PI/2);this.add(name,'embroidered',c,g,p);
  }
  finish(kind:string) {
    const combined=mergeGeometries(this.parts)!;
    for(const g of this.parts)g.dispose();
    // Exact duplicate and zero-area triangles create depth shimmer even in opaque geometry.
    const p=combined.getAttribute('position'),keep:number[]=[],seen=new Set<string>();
    for(let i=0;i<p.count;i+=3) {
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,i+j));
      if(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq()<1e-18)continue;
      const key=points.map(v=>v.toArray().map(x=>Math.round(x*1e7)).join(',')).sort().join('|');
      if(seen.has(key))continue;seen.add(key);keep.push(i,i+1,i+2);
    }
    combined.setIndex(keep);
    const expanded=combined.toNonIndexed();combined.dispose();
    const indexed=mergeVertices(expanded,1e-6);expanded.dispose();
    indexed.computeBoundingBox();indexed.computeBoundingSphere();
    indexed.userData={kind,parts:this.details,version:3};return indexed;
  }
}

export function furnitureGeometry(kind:string,tier=0,job?:string):THREE.BufferGeometry {
  const m=new Furniture(),wood=new THREE.Color(resourceColor('wood',tier)).lerp(new THREE.Color('#d6a66c'),.28).getStyle(),light=new THREE.Color(wood).lerp(new THREE.Color('#e5bf80'),.25).getStyle(),dark=new THREE.Color(wood).multiplyScalar(.70).getStyle();
  const iron='#414744',brass='#c5a15b',cream='#e3cfaa',sage='#76836a',red='#a2634d';
  const board=(name:string,p:Point,s:Point,c=wood,r:Point=[0,0,0])=>m.box(name,'wood',c,p,s,.006,r);
  const pin=(p:Point)=>m.ball('oak dowel','wood',light,p,[.008,.003,.008]);
  const turned=(x:number,z:number,height:number,radius=.034)=>m.lathe('turned leg','wood',wood,[x,0,z],[[0,0],[radius*.8,0],[radius,.025],[radius,.055],[radius*.65,height*.36],[radius*.85,height*.55],[radius*.7,height*.76],[radius,height],[0,height]],16);
  const pull=(x:number,y:number,z:number)=>{
    m.box('handle escutcheon','metal',brass,[x,y,z],[.05,.032,.012],.005);
    m.ring('brass drop pull','metal',brass,[x,y-.018,z-.014],.025,.005,[0,0,0]);
  };
  const ceramic=(p:Point,radius:number,height:number,c=cream)=>m.lathe('painted earthenware','ceramic',c,p,[[0,0],[radius*.52,0],[radius*.56,height*.08],[radius*.89,height*.25],[radius,height*.76],[radius*.85,height],[radius*.69,height],[radius*.76,height*.76],[radius*.63,height*.24],[0,height*.17]],24);
  const cushion=(p:Point,size:Point,c:string,rotation:Point=[0,0,0])=>{
    m.box('embroidered cushion','embroidered',c,p,size,Math.min(...size)*.32,rotation);
  };
  const basket=(p:Point,radius:number,height:number)=>{
    m.lathe('woven wicker basket','wicker','#c9a16c',p,[[0,0],[radius*.76,0],[radius*.84,.025],[radius,height-.025],[radius,height],[radius-.018,height],[radius-.02,height-.03],[radius*.76,.035],[0,.035]],24);
    m.ring('bound wicker rim','wicker',light,[p[0],p[1]+height-.008,p[2]],radius-.005,.013);
  };
  const book=(p:Point,width:number,height:number,color:string,yaw=0)=>m.group(p,yaw,()=>{
    m.box('book pages','paper','#e0d2ac',[0,height/2,0],[width-.009,height-.018,.16],.002);
    for(const x of [-width/2,width/2])m.box('book cover','leather',color,[x,height/2,0],[.009,height,.18],.002);
    m.box('book spine','book',color,[0,height/2,-.086],[width+.007,height,.012],.003);
    for(const y of [height*.19,height*.81])m.box('spine embossing','plain',brass,[0,y,-.094],[width*.7,.009,.002],0);
  });

  if(kind==='taburete') {
    m.lathe('dished solid seat','wood',wood,[0,0,0],[[0,.536],[.25,.536],[.278,.548],[.285,.565],[.28,.582],[.25,.59],[.10,.584],[0,.583]],32);
    for(const x of [-.15,.15])for(const z of [-.15,.15]) {
      const foot:Point=[x*1.25,.018,z*1.25],top:Point=[x,.542,z];
      m.rod('splayed leg','wood',wood,foot,top,.024,.035,16);
      m.ball('rounded foot','wood',dark,[foot[0],.016,foot[2]],[.024,.016,.024]);
      m.ball('leg collar','wood',light,[x*1.12,.28,z*1.12],[.032,.045,.032]);
    }
    for(const z of [-.173,.173])m.rod('stretcher','wood',dark,[-.173,.20,z],[.173,.20,z],.014);
    for(const x of [-.173,.173])m.rod('stretcher','wood',dark,[x,.20,-.173],[x,.20,.173],.014);
    for(const x of [-.112,.112])for(const z of [-.112,.112])m.ball('seat joinery plug','endgrain',dark,[x,.585,z],[.008,.003,.008]);
  } else if(kind==='mesa'||kind==='estacion') {
    const work=kind==='estacion',top=work?.84:.80,width=1.48,depth=work?.68:.76;
    // Individually joined planks, no hidden coplanar slab under the tabletop.
    for(let i=0;i<4;i++)board('tabletop plank',[0,top-.028,(i-1.5)*(depth/4)],[width-.14,.056,depth/4-.002],i%2?light:wood);
    for(const x of [-.705,.705])board('breadboard end',[x,top-.028,0],[.07,.056,depth],dark);
    for(const x of [-.742,.742])for(const z of [-depth*.26,depth*.26])board('tenon key',[x,top-.028,z],[.009,.025,.055],light);
    for(const x of [-.58,.58])for(const z of [-depth*.34,depth*.34]) {
      turned(x,z,top-.063,.042);pin([x,top+.001,z]);
    }
    for(const z of [-depth*.34,depth*.34])board('apron',[0,top-.112,z],[1.12,.096,.036]);
    for(const x of [-.58,.58])board('end apron',[x,top-.112,0],[.036,.096,depth*.68]);
    if(!work) {
      board('long stretcher',[0,.20,0],[1.2,.05,.055],dark);
      for(const x of [-.58,.58])board('cross stretcher',[x,.20,0],[.055,.05,depth*.70],dark);
      m.drape('embroidered table runner',red,[-.24,top+.008,0],.30,[[.002,.30],[.008,.15],[.004,0],[.008,-.14],[.002,-.30],[-.025,-.37],[-.09,-.375],[-.15,-.37]]);
      ceramic([.32,top+.002,.05],.089,.027);
      m.ball('bread on plate','plain','#c69a64',[.32,top+.036,.05],[.046,.010,.029]);
      m.box('carved apron panel','carved',light,[0,top-.112,-depth*.34-.024],[.45,.072,.012],.004);
    } else {
      for(let i=0;i<3;i++)board('lower shelf plank',[0,.23,(i-1)*.16],[1.16,.035,.156],light);
      for(const x of [-.58,.58])board('shelf support',[x,.193,0],[.045,.04,.49],dark);
      board('rear tool rail',[0,1.00,.305],[1.27,.07,.04],dark);
      for(const x of [-.59,.59])board('rail upright',[x,.93,.305],[.04,.28,.04]);
      for(let i=0;i<3;i++){const x=-.22+i*.19;m.rod('chisel handle','wood',light,[x,.94,.27],[x,1.15,.27],.014);m.rod('chisel blade','metal',iron,[x,.89,.27],[x,.97,.27],.009);}
      board('vise fixed jaw',[-.43,.82,-.35],[.27,.12,.035],dark);
      board('vise moving jaw',[-.43,.82,-.382],[.27,.12,.025],light);
      m.rod('vise screw','metal',iron,[-.43,.80,-.39],[-.43,.80,-.40],.017);
      // Handle remains inside the published 0.8 m placement depth.
      m.rod('vise handle','wood',dark,[-.52,.80,-.392],[-.34,.80,-.392],.007);
      board('plane stock',[.25,.87,0],[.24,.06,.085],dark,[0,.18,0]);
      m.box('plane iron','metal',iron,[.24,.913,0],[.055,.04,.05],.002,[.2,0,0]);
      m.box('folded plan','linen',cream,[.05,.845,.15],[.27,.008,.18],.002);
      book([-.25,.248,.04],.10,.16,red,Math.PI/2);
      m.drape('workshop cloth',sage,[.51,top+.008,0],.20,[[.002,.18],[.006,.03],[0,-.14],[-.025,-.30],[-.11,-.33],[-.19,-.33]]);
      m.curve('plane shaving','wood',light,[[.26,.847,.18],[.32,.85,.15],[.35,.87,.18],[.32,.885,.20],[.29,.87,.18]],.004);
    }
  } else if(kind==='biblioteca') {
    board('plinth',[0,.05,0],[1.50,.10,.46],dark);
    board('base moulding',[0,.115,0],[1.46,.03,.43],light);
    for(const x of [-.685,.685])board('side panel',[x,.945,0],[.08,1.63,.40]);
    for(let i=0;i<6;i++)board('back panel',[(i-2.5)*.215,.945,.185],[.214,1.63,.028],dark);
    for(const y of [.15,.55,.96,1.37,1.76])board('shelf',[0,y,-.015],[1.29,.04,.39],light);
    board('cornice lower',[0,1.804,0],[1.49,.048,.44]);
    m.box('carved cornice frieze','carved',light,[0,1.804,-.226],[1.30,.04,.016],.003);
    board('cornice crown',[0,1.848,0],[1.54,.04,.48],dark);
    for(const x of [-.68,.68])board('face stile',[x,.954,-.213],[.055,1.65,.035],light);
    const colors=[sage,red,'#ad8a4e','#687d83','#9b815f'];
    for(let row=0;row<4;row++)for(let i=0;i<(row===0?4:7);i++) {
      const x=-.52+i*.163,h=.23+(i+row)%3*.025;
      book([x,.174+row*.406,-.025],.092,h,colors[(i+row)%5],(i===6?.11:0));
    }
    for(let i=0;i<3;i++)m.box('folded cloth','linen',i%2?cream:sage,[.37,.205+i*.043,-.014],[.36,.039,.25],.008);
  } else if(kind==='silla') {
    for(const x of [-.205,.205]) {
      turned(x,-.205,.436,.025);
      m.rod('rear post','wood',wood,[x,.012,.20],[x,1.01,.22],.023,.025,16);
      m.ball('finial','wood',light,[x,1.02,.22],[.032,.03,.032]);
    }
    for(const z of [-.204,.204])board('seat rail',[0,.429,z],[.43,.055,.045],dark);
    for(const x of [-.204,.204])board('seat rail',[x,.429,0],[.045,.055,.365],dark);
    m.box('woven seat','wicker',cream,[0,.467,0],[.37,.026,.36],.009);
    m.box('carved back crest','carved',light,[0,.962,.219],[.39,.075,.045],.006);
    board('back lower rail',[0,.57,.209],[.39,.045,.042],dark);
    m.box('woven back insert','embroidered',sage,[0,.764,.215],[.348,.339,.026],.008);
    for(const x of [-.205,.205])m.rod('side stretcher','wood',dark,[x,.20,-.205],[x,.20,.20],.013);
    m.rod('front stretcher','wood',dark,[-.205,.16,-.205],[.205,.16,-.205],.014);
  } else if(kind==='banco') {
    for(const x of [-.49,.49])for(const z of [-.15,.15])turned(x,z,.43,.032);
    board('seat foundation',[0,.441,0],[1.22,.055,.43],dark);
    for(const x of [-.49,.49])board('end stretcher',[x,.18,0],[.045,.045,.32]);
    board('long stretcher',[0,.18,0],[1.01,.045,.045],light);
    // One continuous cushion, without overlapping tuft spheres.
    m.box('linen cushion','embroidered',sage,[0,.507,0],[1.17,.086,.40],.025);
    m.drape('folded window blanket',red,[-.32,0,0],.26,[[.557,.10],[.56,-.01],[.555,-.14],[.53,-.205],[.46,-.22],[.35,-.22],[.28,-.205]]);
    for(const x of [-.39,0,.39])m.ball('cloth button','linen',dark,[x,.548,0],[.011,.004,.011]);
    for(const x of [-.598,.598]) {
      for(const z of [-.15,.15])m.rod('arm support','wood',dark,[x,.445,z],[x,.555,z],.012);
      m.rod('rounded arm','wood',light,[x,.563,-.18],[x,.563,.18],.015);
    }
  } else if(kind==='mesita') {
    m.lathe('bevelled round top','endgrain',wood,[0,0,0],[[0,.615],[.26,.615],[.286,.625],[.29,.645],[.275,.664],[0,.664]],32);
    m.lathe('turned pedestal','wood',wood,[0,0,0],[[0,.08],[.07,.08],[.085,.13],[.06,.23],[.048,.32],[.075,.41],[.05,.49],[.065,.60],[0,.60]],24);
    for(let i=0;i<3;i++)m.group([0,0,0],i*Math.PI*2/3,()=>{
      m.rod('tripod leg','wood',dark,[.04,.16,0],[.225,.035,0],.045,.028);
      m.ball('tripod foot','wood',wood,[.225,.023,0],[.05,.023,.035]);
    });
  } else if(kind==='arcon') {
    board('plinth',[0,.045,0],[.95,.09,.55],dark);
    board('closed chest body',[0,.218,0],[.90,.256,.50]);
    // Raised framing is separated from the exposed panels; no competing face layers.
    for(const x of [-.418,.418])board('corner stile',[x,.218,-.263],[.047,.256,.026],dark);
    for(const x of [-.145,.145])m.box('carved chest panel','carved',light,[x,.218,-.256],[.22,.17,.016],.008);
    board('lid rail',[0,.362,0],[.94,.026,.53],dark);
    const vault=new THREE.Shape();vault.moveTo(-.25,0);vault.absarc(0,0,.25,Math.PI,0,true);vault.closePath();
    const lid=new THREE.ExtrudeGeometry(vault,{depth:.92,curveSegments:24,bevelEnabled:false});lid.translate(0,0,-.46);lid.rotateY(Math.PI/2);
    m.add('continuous vaulted lid','wood',wood,lid,[0,.38,0]);
    for(const x of [-.285,.285]) {
      // Bands are shell sectors outside the wood, with their own closed edges.
      const band=new THREE.Shape();band.absarc(0,0,.260,0,Math.PI,false);band.absarc(0,0,.252,Math.PI,0,true);band.closePath();
      const g=new THREE.ExtrudeGeometry(band,{depth:.039,curveSegments:24,bevelEnabled:false});g.translate(0,0,-.0195);g.rotateY(Math.PI/2);
      m.add('arched iron band','metal',iron,g,[x,.38,0]);
      for(const z of [-.257,.257])m.box('iron band','metal',iron,[x,.218,z],[.039,.256,.012],.002);
      for(let i=0;i<7;i++){const a=(i+.5)*Math.PI/7;m.ball('band rivet','metal',brass,[x,.38+Math.sin(a)*.263,Math.cos(a)*.263],[.007,.007,.007]);}
    }
    m.box('lock plate','metal',brass,[0,.308,-.266],[.075,.095,.014],.007);
    m.box('key slot','plain','#252a28',[0,.311,-.275],[.009,.023,.003],.001);
    for(const x of [-.46,.46]) {
      m.box('handle plate','metal',iron,[x,.25,0],[.018,.06,.075],.004);
      m.ring('drop handle','metal',iron,[x+Math.sign(x)*.018,.215,0],.039,.007,[0,Math.PI/2,0]);
    }
  } else if(kind==='alfombra') {
    // The ornament and weave share one surface: no stacked coplanar medallions.
    m.box('woven carpet','rug','#ffffff',[0,.014,0],[1.33,.018,.96],.008);
    for(const side of [-1,1])for(let i=0;i<16;i++)m.rod('fringe','linen',cream,[side*.663,.015,(i-7.5)*.058],[side*.718,.009,(i-7.5)*.058],.004,.003,6);
  } else if(kind==='farol') {
    m.lathe('lantern foot','metal',iron,[0,0,0],[[0,0],[.13,0],[.14,.025],[.12,.055],[.095,.07],[0,.07]],16);
    // Opaque honey-coloured glazing uses emissive PBR, so it cannot sort/pop.
    m.box('amber chamber','amber','#fff3d4',[0,.255,0],[.164,.35,.164],.012);
    for(const x of [-.095,.095])for(const z of [-.095,.095])m.rod('iron corner','metal',iron,[x,.065,z],[x,.454,z],.012);
    for(const y of [.086,.435])for(const z of [-.095,.095])m.box('window rail','metal',iron,[0,y,z],[.19,.017,.018],.003);
    for(const y of [.086,.435])for(const x of [-.095,.095])m.box('window rail','metal',iron,[x,y,0],[.018,.017,.19],.003);
    for(const z of [-.094,.094])m.rod('window mullion','metal',iron,[0,.10,z],[0,.42,z],.005);
    m.lathe('vented roof','metal',iron,[0,0,0],[[0,.452],[.15,.452],[.15,.47],[.055,.56],[.055,.579],[0,.579]],4);
    m.lathe('chimney','metal',brass,[0,0,0],[[0,.58],[.035,.58],[.035,.605],[.023,.625],[0,.625]],12);
    m.ring('carry ring','metal',iron,[0,.681,0],.049,.008,[0,0,0]);
    m.ring('door latch','metal',brass,[-.044,.25,-.105],.016,.004,[0,0,0]);
    for(const y of [.15,.35])m.rod('door hinge','metal',brass,[.096,y-.012,-.096],[.096,y+.012,-.096],.008);
  } else if(kind==='macetero') {
    m.lathe('painted terracotta pot','ceramic','#d8b591',[0,0,0],[[0,0],[.11,0],[.12,.025],[.12,.06],[.16,.11],[.20,.25],[.195,.32],[.21,.345],[.21,.37],[.175,.37],[.17,.34],[.158,.15],[0,.12]],32);
    m.ring('clay collar','clay','#d19a71',[0,.345,0],.199,.011);
    m.lathe('soil','plain','#514735',[0,0,0],[[0,.324],[.17,.324],[.17,.337],[0,.337]],24);
    for(let i=0;i<9;i++) {
      const a=i*2.399,h=.53+(i%3)*.09,r=.10+(i%2)*.025;
      const tip:Point=[Math.cos(a)*r,h,Math.sin(a)*r];
      m.rod('plant stem','leaf','#63834e',[Math.cos(a)*.04,.33,Math.sin(a)*.04],tip,.006,.003,8);
      m.group(tip,-a,()=>{
        const g=new THREE.SphereGeometry(1,12,8);g.scale(.10,.018,.047);g.rotateZ(.25+(i%3)*.3);
        m.add('rounded leaf','leaf',i%2?'#7e9d5c':'#577b4d',g,[.038,.025,0]);
      });
    }
  } else if(kind==='biombo') {
    const w=.414,yaws=[-.30,.30,-.30];let x=-.60,z=-.07;
    for(let i=0;i<3;i++) {
      const yaw=yaws[i],endX=x+Math.cos(yaw)*w,endZ=z-Math.sin(yaw)*w;
      m.group([(x+endX)/2,0,(z+endZ)/2],yaw,()=>{
        for(const sx of [-.185,.185])board('screen stile',[sx,.80,0],[.035,1.60,.042]);
        board('top rail',[0,1.55,0],[.335,.065,.042],light);
        board('bottom rail',[0,.13,0],[.335,.065,.042],dark);
        board('transom',[0,.51,0],[.335,.044,.042],dark);
        m.box('carved lower panel','carved',dark,[0,.325,0],[.335,.325,.019],.005);
        m.box('embroidered stretched linen','embroidered',cream,[0,1.02,0],[.335,.975,.018],.003);
        // Embroidery is in the cloth atlas; only substantial structural rails are geometry.
        for(const sx of [-.185,.185])m.box('brass foot','metal',brass,[sx,.022,0],[.037,.044,.045],.003);
      });
      if(i<2)for(const y of [.27,.80,1.33])m.rod('hinge barrel','metal',brass,[endX,y-.025,endZ],[endX,y+.025,endZ],.015,.015,12);
      x=endX;z=endZ;
    }
  } else if(kind==='butaca') {
    for(const x of [-.32,.32])for(const z of [-.30,.30])turned(x,z,.35,.041);
    board('armchair seat frame',[0,.372,0],[.83,.07,.78],dark);
    m.box('carved front apron','carved',light,[0,.372,-.392],[.61,.058,.023],.006);
    board('back frame',[0,.77,.345],[.80,.66,.075],dark);
    cushion([0,.45,-.025],[.68,.08,.65],red);
    cushion([0,.80,.277],[.68,.53,.115],red,[.06,0,0]);
    for(const x of [-.4,.4]) {
      for(const z of [-.29,.29])turned(x,z,.61,.026);
      m.box('rolled linen arm','linen',red,[x,.64,-.01],[.13,.14,.76],.04);
      m.curve('arm seam','linen',cream,[[x,.699,-.32],[x,.707,-.15],[x,.707,.12],[x,.697,.31]],.003);
    }
    cushion([.17,.76,.205],[.28,.25,.105],sage,[.13,0,-.18]);
    m.drape('armchair reading blanket',cream,[-.23,0,0],.20,[[.496,.20],[.50,.05],[.497,-.10],[.49,-.30],[.44,-.365],[.32,-.38],[.20,-.365]]);
    for(const x of [-.18,.18])m.ball('upholstery button','linen',cream,[x,.88,.212],[.012,.012,.006]);
  } else if(kind==='aparador') {
    for(const x of [-.48,.48])for(const z of [-.18,.18])turned(x,z,.13,.037);
    board('sideboard plinth',[0,.15,0],[1.22,.07,.49],dark);
    for(const x of [-.56,.56])board('sideboard side',[x,.52,0],[.065,.68,.46]);
    board('sideboard back',[0,.52,.218],[1.08,.68,.025],dark);
    board('cabinet floor',[0,.20,0],[1.08,.035,.44]);
    board('central stile',[0,.49,-.222],[.045,.55,.045],dark);
    for(const x of [-.285,.285]) {
      m.box('recessed carved door','carved',light,[x,.46,-.225],[.43,.43,.018],.007);
      for(const dx of [-.24,.24])board('door stile',[x+dx,.46,-.232],[.035,.50,.035]);
      for(const y of [.222,.698])board('door rail',[x,y,-.232],[.448,.028,.035]);
      board('drawer',[x,.788,-.215],[.526,.12,.032],light);
      pull(x,.788,-.235);pull(x-Math.sign(x)*.16,.47,-.247);
    }
    board('counter top',[0,.893,0],[1.27,.07,.53],light);
    board('plate rack back rail',[0,1.018,.218],[1.17,.15,.033],dark);
    for(const x of [-.39,0,.39]) {
      m.add('painted display plate','ceramic',cream,new THREE.CylinderGeometry(.115,.115,.018,32),[x,1.10,.153],[Math.PI/2,0,0]);
      m.ring('glazed plate rim','ceramic',cream,[x,1.10,.140],.109,.006,[0,0,0]);
      board('plate stop',[x,.96,.10],[.17,.02,.023],dark);
    }
    ceramic([.43,.93,-.10],.066,.18,sage);
    ceramic([-.32,.93,-.07],.095,.055);
    m.drape('sideboard folded towel',cream,[-.04,0,0],.20,[[.934,.06],[.94,-.08],[.934,-.20],[.90,-.265],[.78,-.265],[.72,-.25]]);
  } else if(kind==='escritorio') {
    for(const x of [-.56,.56])for(const z of [-.25,.25])turned(x,z,.74,.035);
    board('writing top',[0,.76,0],[1.32,.06,.69],light);
    for(const z of [-.26,.26])board('desk apron',[0,.68,z],[1.14,.10,.036],dark);
    board('desk drawer',[-.28,.685,-.30],[.48,.10,.038]);pull(-.28,.68,-.326);
    board('pigeonhole back',[.28,.92,.295],[.65,.25,.024],dark);
    for(const x of [-.055,.155,.365,.615])board('pigeonhole partition',[x,.91,.23],[.024,.23,.14]);
    board('pigeonhole crown',[.28,1.048,.23],[.70,.035,.18],light);
    for(const x of [.05,.26,.48]) {
      m.box('bundled letters','paper',cream,[x,.833,.22],[.14,.07,.09],.003,[0,0,.05]);
      m.box('letter ribbon','linen',sage,[x,.835,.166],[.014,.074,.006],.001);
    }
    m.box('open letter','paper',cream,[-.22,.795,-.065],[.46,.008,.27],.002,[0,-.12,0]);
    m.ball('wax seal','plain',red,[-.32,.802,-.11],[.021,.003,.021]);
    ceramic([.41,.792,-.17],.044,.08,'#577d79');
    m.curve('quill stem','wood',light,[[.41,.85,-.17],[.43,.94,-.15],[.47,1.035,-.12]],.003);
    m.ball('quill feather','linen',cream,[.463,1.007,-.126],[.014,.051,.006]);
    m.drape('writing desk runner',sage,[-.51,0,0],.16,[[.796,.18],[.8,-.06],[.795,-.25],[.75,-.347],[.65,-.35],[.58,-.34]]);
  } else if(kind==='perchero') {
    m.lathe('coat stand post','wood',wood,[0,0,0],[[0,.08],[.058,.08],[.075,.14],[.042,.24],[.030,1.44],[.052,1.49],[.034,1.66],[0,1.69]],20);
    for(let i=0;i<3;i++)m.group([0,0,0],i*Math.PI*2/3,()=>{
      m.rod('coat stand foot','wood',dark,[0,.16,0],[.26,.033,0],.035,.027);
      m.ball('coat stand foot pad','wood',wood,[.26,.025,0],[.043,.025,.035]);
    });
    for(let i=0;i<4;i++) {
      const a=i*Math.PI/2+.3;
      m.curve('rounded wooden hook','wood',wood,[[Math.cos(a)*.025,1.47,Math.sin(a)*.025],[Math.cos(a)*.18,1.49,Math.sin(a)*.18],[Math.cos(a)*.22,1.57,Math.sin(a)*.22]],.016);
      m.ball('hook finial','wood',light,[Math.cos(a)*.22,1.57,Math.sin(a)*.22],[.025,.025,.025]);
    }
    const outline: [number,number][]=[[-.18,0],[-.23,.035],[-.16,.45],[-.28,.37],[-.31,.43],[-.20,.68],[-.08,.73],[-.05,.79],[.05,.79],[.08,.73],[.20,.68],[.31,.43],[.28,.37],[.16,.45],[.23,.035],[.18,0]];
    const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.closePath();
    const cloak=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelThickness:.006,bevelSize:.008,bevelSegments:2,steps:1});cloak.translate(0,0,-.0275);
    m.add('hanging travelling coat','embroidered',sage,cloak,[-.025,.62,0]);
    m.box('folded coat hood','linen',sage,[-.025,1.395,.03],[.14,.16,.12],.035);
    m.curve('coat hanging loop','linen',cream,[[-.025,1.42,.01],[-.03,1.47,.01],[-.06,1.49,-.01]],.005);
    for(const dx of [-.115,.115])m.curve('soft coat fold','linen',sage,[[dx,1.26,-.042],[dx*.75,1.06,-.045],[dx*.90,.86,-.044],[dx*1.25,.67,-.041]],.004);
    for(const y of [.82,.98,1.14])m.ball('coat button','wood',dark,[-.025,y,-.037],[.009,.009,.006]);
    m.lathe('traveller hat','linen',red,[.12,1.48,.10],[[0,0],[.115,0],[.12,.012],[.09,.025],[.074,.11],[.05,.14],[0,.145]],24);
  } else if(kind==='costurero') {
    for(const x of [-.19,.19])for(const z of [-.15,.15])turned(x,z,.32,.022);
    board('sewing basket support',[0,.31,0],[.51,.035,.43],dark);
    basket([0,.33,0],.23,.22);
    for(const [x,z,c] of [[-.10,-.03,red],[.065,-.075,sage],[.05,.10,cream]] as [number,number,string][]) {
      m.ball('ball of wool','linen',c,[x,.584,z],[.074,.074,.074]);
      for(const dy of [-.034,0,.034])m.ring('wound wool strand','linen',c,[x,.584+dy,z],Math.sqrt(.074**2-dy**2),.003);
    }
    for(const x of [-.12,-.08])m.rod('knitting needle','wood',light,[x,.43,.05],[x+.14,.688,.02],.004);
    for(const x of [-.12,-.08])m.ball('needle end','wood',dark,[x+.14,.688,.02],[.007,.007,.007]);
    m.drape('sewing basket cloth',cream,[-.10,0,0],.16,[[.553,.09],[.557,-.06],[.55,-.19],[.51,-.228],[.42,-.24],[.36,-.23]]);
    for(const x of [.10,.15])m.ring('scissors handle','metal',brass,[x,.573,-.12],.018,.004,[0,0,0]);
    m.rod('scissors blade','metal',iron,[.10,.555,-.12],[.155,.46,-.12],.005,.002);
    m.rod('scissors blade','metal',iron,[.15,.555,-.12],[.105,.46,-.12],.005,.002);
  } else if(kind==='jardinera') {
    for(const x of [-.39,.39])for(const z of [-.14,.14])turned(x,z,.31,.028);
    board('planter floor',[0,.316,0],[.96,.045,.40],dark);
    for(const z of [-.19,.19])m.box('carved planter rail','carved',wood,[0,.43,z],[.96,.20,.035],.008);
    for(const x of [-.463,.463])board('planter end',[x,.43,0],[.035,.20,.35],light);
    for(const x of [-.30,0,.30]) {
      m.lathe('herb pot','clay','#bf8f68',[x,.34,0],[[0,0],[.08,0],[.105,.16],[.116,.17],[.116,.19],[.09,.19],[.078,.025],[0,.025]],20);
      m.lathe('herb soil','plain','#574a32',[x,.34,0],[[0,.175],[.09,.175],[.09,.185],[0,.185]],16);
      for(let i=0;i<5;i++) {
        const a=i*2.4,h=.68+(i%3)*.055,r=.07;
        const tip:Point=[x+Math.cos(a)*r,h,Math.sin(a)*r];
        m.curve('herb stem','leaf','#648451',[[x,.51,0],[x+Math.cos(a)*.04,.60,Math.sin(a)*.04],tip],.004);
        for(const side of [-1,1])m.ball('aromatic leaf','leaf',i%2?'#829a65':'#5a7c54',[tip[0]+side*.035,tip[1]-.03,tip[2]],[.048,.012,.026]);
        if(i%2===0)m.ball('herb blossom','plain',cream,[tip[0],tip[1]+.014,tip[2]],[.018,.018,.018]);
      }
      board('plant marker',[x+.055,.585,-.09],[.035,.14,.012],light,[0,0,-.12]);
    }
  } else throw new Error(`Mueble desconocido: ${kind}${job?` (${job})`:''}`);
  return m.finish(kind);
}
