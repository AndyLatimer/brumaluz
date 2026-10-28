import * as THREE from 'three';
export interface ForestActor {root:THREE.Group;update(t:number):void;setGait(g:'idle'|'walk'|'run'):void;setActivity(activity:string):void;setLocomotionSpeed(speed:number):void;attack(strong?:boolean):void;hit():void;die():void;revive():void;dispose():void}

/** Small articulated forest creatures, with a shared palette and readable silhouettes. */
export function forestEnemy(family:'beast'|'magic'):ForestActor{
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const materials:THREE.MeshStandardMaterial[]=[],parts:THREE.Mesh[]=[];
 const material=(color:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true});materials.push(m);return m;};
 const fur=material('#786047'),dark=material('#453b32'),light=material('#b69b78'),ivory=material('#e4d8b3'),eye=material('#262822'),leaf=material('#78966c'),cap=material('#73a4a0'),spot=material('#d5debc');
 const mesh=(geometry:THREE.BufferGeometry,m:THREE.MeshStandardMaterial,x:number,y:number,z:number,parent:THREE.Object3D=body)=>{const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);parts.push(o);return o;};
 const oval=(m:THREE.MeshStandardMaterial,x:number,y:number,z:number,sx:number,sy:number,sz:number,parent:THREE.Object3D=body)=>{const o=mesh(new THREE.SphereGeometry(1,12,8),m,x,y,z,parent);o.scale.set(sx,sy,sz);return o;};
 const openEyes:THREE.Object3D[]=[],closedEyes:THREE.Object3D[]=[];
 const faceEye=(x:number,y:number,z:number,sx:number,sy:number,parent:THREE.Object3D,highlight:THREE.MeshStandardMaterial)=>{
  const group=new THREE.Group();group.name='open-eye';parent.add(group);
  oval(eye,x,y,z,sx,sy,.027,group);
  oval(highlight,x+Math.sign(x)*.01,y+.02,z+.02,.011,.013,.009,group);
  openEyes.push(group);
  const lid=oval(dark,x,y,z+.006,sx*1.1,.008,.028,parent);lid.name='closed-eyelid';lid.visible=false;closedEyes.push(lid);
 };
 const closeEyes=(closed:boolean)=>{openEyes.forEach(o=>o.visible=!closed);closedEyes.forEach(o=>o.visible=closed);};
 const legs:THREE.Group[]=[],head=new THREE.Group();body.add(head);
 if(family==='beast'){
  oval(fur,0,.66,0,.43,.45,.70);oval(dark,0,.93,-.17,.19,.15,.52);
  for(const x of [-.29,.29])for(const z of [-.44,.42]){const joint=new THREE.Group();joint.position.set(x,.50,z);body.add(joint);legs.push(joint);oval(fur,0,-.13,0,.14,.27,.16,joint);oval(dark,0,-.40,.02,.14,.10,.17,joint);}
  head.position.set(0,.7,.56);oval(fur,0,0,0,.33,.32,.35,head);oval(light,0,-.07,.33,.24,.18,.25,head);oval(dark,0,-.06,.49,.23,.14,.07,head);
  for(const x of [-1,1]){
   oval(dark,x*.095,-.04,.55,.04,.03,.015,head);
   faceEye(x*.31,.08,.27,.04,.045,head,ivory);
   const ear=mesh(new THREE.ConeGeometry(.14,.28,5),fur,x*.25,.32,-.05,head);ear.rotation.z=-x*.4;
   const tusk=mesh(new THREE.ConeGeometry(.055,.23,7),ivory,x*.24,-.15,.39,head);tusk.rotation.z=-x*.35;
  }
  const tail=mesh(new THREE.TorusGeometry(.1,.035,5,10,Math.PI*1.5),fur,0,.76,-.74);tail.rotation.y=Math.PI/2;
  for(let i=0;i<5;i++){const bristle=mesh(new THREE.ConeGeometry(.075,.17,4),dark,0,1.08,-.38+i*.17);bristle.rotation.x=-.3;}
 }else{
  oval(light,0,.48,0,.27,.45,.26);oval(leaf,-.3,.22,.06,.24,.10,.38);oval(leaf,.3,.22,.06,.24,.10,.38);
  const profile=[new THREE.Vector2(0,0),new THREE.Vector2(.63,.02),new THREE.Vector2(.70,.11),new THREE.Vector2(.66,.24),new THREE.Vector2(.5,.47),new THREE.Vector2(.27,.62),new THREE.Vector2(0,.68)];
  mesh(new THREE.LatheGeometry(profile,16),cap,0,.78,0,head);
  for(let i=0;i<7;i++){const angle=i*2.3999,r=.25+(i%2)*.19,x=Math.cos(angle)*r,z=Math.sin(angle)*r;const dot=oval(spot,x,1.36-r*.55,z,.09,.025,.085,head);dot.rotation.z=-x*.6;dot.rotation.x=z*.6;}
  faceEye(-.1,.65,.24,.035,.055,body,spot);faceEye(.1,.65,.24,.035,.055,body,spot);
  const mouth=mesh(new THREE.TorusGeometry(.055,.012,4,9,Math.PI),dark,0,.53,.26);mouth.rotation.z=Math.PI;
  for(const x of [-1,1]){const arm=new THREE.Group();arm.position.set(x*.24,.5,0);body.add(arm);legs.push(arm);oval(leaf,x*.10,0,0,.17,.09,.11,arm);}
  const gem=material('#8fbfd0');gem.emissive.set('#66a5ba');gem.emissiveIntensity=.5;
  for(let i=0;i<3;i++){const crystal=mesh(new THREE.OctahedronGeometry(.07),gem,Math.cos(i*2.1)*.48,.4+i*.15,Math.sin(i*2.1)*.48);crystal.name='mote';}
 }
 let gait='idle',dead=false,action=-100,hitAt=-100,now=0,activity='',speed=1,strength=1,gaitPhase=0;
 return {root,setGait(g){gait=g;},setActivity(a){activity=a;},setLocomotionSpeed(s){speed=THREE.MathUtils.clamp(s,.15,5);},attack(strong=false){if(!dead){action=now;strength=strong?1.35:1;}},hit(){if(!dead)hitAt=now;},die(){if(dead)return;dead=true;closeEyes(true);},revive(){if(!dead)return;dead=false;closeEyes(false);gait='idle';action=hitAt=-100;body.rotation.set(0,0,0);body.position.set(0,0,0);head.rotation.set(0,0,0);},update(t){const dt=THREE.MathUtils.clamp(t-now,0,.1);now=t;
  if(dead){body.rotation.z=THREE.MathUtils.lerp(body.rotation.z,Math.PI/2,.15);body.position.y=THREE.MathUtils.lerp(body.position.y,-.17,.15);return;}
  const walking=gait!=='idle';if(walking)gaitPhase+=dt*(4+speed*2);
  const phase=walking?gaitPhase:t*2,attack=Math.max(0,1-(t-action)/.5)*strength,hurt=Math.max(0,1-(t-hitAt)/.25);
  body.position.y=Math.sin(phase)*(walking?.025:.012)+(family==='magic'?Math.sin(t*2.5)*.045:0);body.position.z=attack*.18-hurt*.08;
  const sniff=!walking&&activity==='sniff'?(Math.sin(t*1.7)*.5+.5):0,forage=!walking&&activity==='forage'?Math.sin(t*.9)*.08:0;
  head.rotation.x=-attack*.3+sniff*.32;head.rotation.y=!walking?Math.sin(t*.65)*.13:0;head.rotation.z=Math.sin(t*1.4)*.025+forage;
  if(family==='beast')body.rotation.x=sniff*.07;
  legs.forEach((joint,i)=>joint.rotation.x=walking?Math.sin(phase+(i%3===0?0:Math.PI))*.35:Math.sin(t*2+i)*.03);
  parts.filter(part=>part.name==='mote').forEach((part,i)=>{part.position.y=.4+i*.15+Math.sin(t*2+i)*.04;part.rotation.y=t;});
 },dispose(){root.removeFromParent();for(const p of parts)p.geometry.dispose();for(const m of materials)m.dispose();}};
}
