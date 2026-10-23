// Purposeful garment cuts. Curved cloth panels carry their own UVs and skinning;
// no boxes on a cylinder and no per-frame vertex pushing on these skirts.
import {THREE,surface,lathe,profileAt,torsoWeights,legWeights,mix,smooth,lerp,roundedPlate} from './garment-studio.mjs';
export function tailoredPattern(S,C){
 const {piece,mesh,source,referenceParts}=S,q=C.tier,k=C.cut,parts=[];
 const put=(g,m='tunic',w=torsoWeights,role='body',uv)=>parts.push(piece(g,m,w,role,uv));
 const long=k===1||k===3||k===5,bottom=k===5?.47:long?.35:k===2?.57:.51;
 const chestWidth=k===0?.344:k===2?.310:.330,waist=k===2?.269:.278;
 const profile=[[.70,.287,.231],[.79,waist,.227],[.86,.287,.244],[.99,chestWidth,.261],[1.09,chestWidth-.005,.251],[1.17,.273,.213],[1.235,.147,.125]];
 function point(a,y,offset=0){const [,rx,rz]=profileAt(profile,Math.max(.70,y)),sn=Math.sin(a),cs=Math.cos(a),power=2/2.35;
  return [Math.sign(sn)*Math.abs(sn)**power*(rx+offset),y,Math.sign(cs)*Math.abs(cs)**power*(rz+offset)];
 }
 function front(x,y,offset=.006){const [,rx,rz]=profileAt(profile,Math.max(.70,y));return [x,y,rz*Math.max(0,1-Math.abs(x/rx)**2.35)**(1/2.35)+offset]}
 // Upper body is one shaped shell. Its lower edge is hidden by the continuous belt.
 put(surface(20,32,(u,v)=>point(u*Math.PI*2+Math.PI,lerp(.70,1.235,v))));
 // Neck lining closes the collar. It is colored with the wearer's actual skin.
 put(lathe([[1.21,.103,.096],[1.335,.103,.096]],20,4),'neckSkin',p=>mix('chest','head',smooth(p[1],1.22,1.335)),'neutral');
 // Turn the collar inward to meet the neck lining; the shell has no open annular gap.
 put(surface(5,32,(u,v)=>{const a=u*Math.PI*2,rx=lerp(.150,.104,v),rz=lerp(.130,.097,v);return [Math.sin(a)*rx,1.235+.010*Math.sin(v*Math.PI),Math.cos(a)*rz]}),k===0||k===3?'linen':'tunic',torsoWeights,'collar');
 // Independently weighted left/right gores open naturally during strides. Central
 // slits end under the belt; no triangle stretches between the two moving thighs.
 for(const side of ['l','r']){
  const sign=side==='l'?1:-1,weight=([,y])=>mix('hips','upperleg.'+side,(1-smooth(y,.43,.73))*.94);
  function skirtAt(u,v,offset=0){
   const slit=.018*(1-smooth(v,.15,.90)),a=sign*(slit+u*(Math.PI-2*slit)),tip=Math.sin(u*Math.PI),hem=bottom+(k===2?.075*(1-tip):k===4?.025*Math.cos(u*Math.PI*2):.018*(1-tip));
   const y=lerp(hem,.735,v),rx=lerp(long?.39:.345,.288,v),rz=lerp(long?.302:.266,.233,v),fold=(1-v)**1.5*Math.sin(u*Math.PI*6)*.009;
   return [Math.sin(a)*(rx+fold+offset),y,Math.cos(a)*(rz+fold+offset)];
  }
  put(surface(15,20,(u,v)=>skirtAt(u,v)),'tunic',weight,'skirt');
  // Sewn hem has a real turned edge, with the same deformation as its cloth.
  put(surface(3,20,(u,v)=>{const p=skirtAt(u,.008+v*.030,.003);return p}),q===0?'tunic':'tunicTrim',weight,'collar');
  if(k===3){
   // A broad stole is sewn into the robe; its contour follows each moving gore.
   put(surface(15,5,(u,v)=>skirtAt(.11+u*.15,v,.004)),q===0?'linen':'tunicTrim',weight,'skirt');
  }
 }
 // Contoured waist belt and a small, rounded rectangular open buckle.
 put(lathe([[.746,.295,.241],[.752,.302,.249],[.805,.302,.249],[.811,.295,.241]],32,7),'leather',torsoWeights,'belt');
 const buckleShape=new THREE.Shape();buckleShape.moveTo(-.042,-.027);buckleShape.quadraticCurveTo(-.048,-.027,-.048,-.020);buckleShape.lineTo(-.048,.020);buckleShape.quadraticCurveTo(-.048,.027,-.040,.027);buckleShape.lineTo(.040,.027);buckleShape.quadraticCurveTo(.048,.027,.048,.020);buckleShape.lineTo(.048,-.020);buckleShape.quadraticCurveTo(.048,-.027,.040,-.027);buckleShape.closePath();
 const hole=new THREE.Path();hole.moveTo(-.030,-.014);hole.lineTo(.030,-.014);hole.lineTo(.030,.014);hole.lineTo(-.030,.014);hole.closePath();buckleShape.holes.push(hole);
 put(new THREE.ExtrudeGeometry(buckleShape,{depth:.010,bevelEnabled:true,bevelSize:.003,bevelThickness:.003,bevelSegments:2,steps:1}).translate(0,.780,.249),q===0?'darkLeather':'brass',torsoWeights,'armor',([x,y])=>[x/.10+.5,(y-.748)/.064]);
 // Cut-specific collars and a single coherent breast piece.
 if(k===0){
  const cuirass=q>=2?'plate':q===1?'leather':'tunic';
  // The breastplate wraps around the ribs and has a raised central keel, curved
  // arm holes and a beveled edge, rather than a flat rectangle pasted on the front.
  for(const back of [false,true]){
   const g=surface(17,20,(u,v)=>{const a=(u-.5)*2.35+(back?Math.PI:0),top=1.16-.065*Math.abs(u-.5)*2-.045*Math.sin(u*Math.PI)**6,low=.855-.045*Math.sin(u*Math.PI)**2,y=lerp(low,top,v),p=point(a,y,.013);p[2]+=(back?-1:1)*.036*Math.sin(u*Math.PI)**4*Math.sin(v*Math.PI);return p});
   put(g,cuirass,torsoWeights,'armor');
   if(q>=2)put(surface(3,20,(u,v)=>{const a=(u-.5)*2.35+(back?Math.PI:0),y=1.16-.065*Math.abs(u-.5)*2-.045*Math.sin(u*Math.PI)**6-v*.014;return point(a,y,.017)}),q>=4?'brass':'plate',torsoWeights,'collar');
  }
  put(lathe([[1.175,.215,.174],[1.205,.173,.143],[1.23,.151,.135]],24,7),'linen',torsoWeights,'collar');
 }else if(k===1){
  // A broad continuous shawl folds around the shoulders and dips at the breast.
  // Its curved outer edge and recessed neck give the robe an actual tailored cut.
  const shawl=(u,v)=>{const a=u*Math.PI*2,f=Math.max(0,Math.cos(a)),y=lerp(1.12-.17*f**4,1.242,v),p=point(a,y,.045+.030*(1-v)+.014*Math.sin(v*Math.PI));return p};
  put(surface(24,32,shawl),q===0?'linen':'tunicTrim',torsoWeights,'collar');
  put(surface(3,32,(u,v)=>shawl(u,.008+v*.040)),'tunic',torsoWeights,'collar');
  for(let i=0;i<(q===0?2:3);i++){
   const y=.94+i*.071,p=front(0,y,.008);
   put(new THREE.SphereGeometry(1,10,8).scale(.012,.012,.006).translate(...p),q<2?'linen':'brass',torsoWeights,'armor');
  }
 }else if(k===2){
  // An asymmetric cloth scarf grows out of the hood; no circular leather bib.
  const scarf=(u,v)=>{const a=u*Math.PI*2,f=Math.max(0,Math.cos(a)),y=lerp(1.15-.115*f**3+.025*Math.sin(a)*f,1.25,v),p=point(a,y,.014+.014*Math.sin(v*Math.PI));return p};
  put(surface(12,32,scarf),'tunic',torsoWeights,'collar');
  if(q>=1)put(surface(3,32,(u,v)=>scarf(u,.01+v*.045)),q>=3?'tunicTrim':'darkLeather',torsoWeights,'collar');
 }else if(k===3){
  // Rounded shoulder mantle underneath the two sewn stoles.
  put(surface(9,32,(u,v)=>{const a=u*Math.PI*2,y=lerp(1.09+.018*Math.cos(a*2),1.24,v);return point(a,y,.014+.021*Math.sin(v*Math.PI))}),'linen',torsoWeights,'collar');
  for(const sign of [-1,1])put(surface(16,6,(u,v)=>{const y=lerp(.81,1.225,v),x=sign*(lerp(.07,.10,v)+u*.063);return front(x,y,.015+.018*smooth(y,1.08,1.16))}),q===0?'linen':'tunicTrim',torsoWeights,'collar');
  put(lathe([[1.19,.19,.16],[1.23,.152,.139],[1.255,.148,.133]],24,7),'linen',torsoWeights,'collar');
 }else if(k===5){
  // The customizable daily tunic retains its linen V neck and laced closure.
  put(surface(14,10,(u,v)=>{const y=lerp(1.035,1.225,v),width=.025+v*.075;return front((u-.5)*width*2,y,.006)}),'linen',torsoWeights,'collar');
  for(let i=0;i<3;i++)for(const sign of [-1,1]){
   const y=1.065+i*.043;
   put(surface(3,2,(u,v)=>{const x=sign*lerp(-.025,.028,v)+(u-.5)*.005;return front(x,y+v*.025,.011)}),'darkLeather',torsoWeights,'strap');
  }
 }else{
  // Fitted vest panels with a curved opening. The shirt is visible through the V.
  for(const sign of [-1,1])put(surface(14,10,(u,v)=>{const y=lerp(.84,1.175+.028*(1-u),v),inner=lerp(.026,.125,v),x=sign*lerp(inner,.255-.035*v,u);return front(x,y,.010+.007*Math.sin(u*Math.PI))}),q===0?'tunic':'leather',torsoWeights,'body');
  for(const sign of [-1,1]){
   // Lapels broaden into the shoulder instead of two straight belt-like strips.
   put(surface(16,7,(u,v)=>{const y=lerp(.94,1.22,v),x=sign*(lerp(.040,.105,v)+u*.100*Math.sin(v*Math.PI*.8));const p=front(x,y,.021);p[2]+=.016*Math.sin(u*Math.PI);return p}),q===0?'linen':'tunicTrim',torsoWeights,'collar');
  }
  // A single sewn breast pocket, with a curved flap supported by the jacket.
  put(surface(10,8,(u,v)=>{const x=.12+u*.090,y=.875+v*.10,p=front(x,y,.024);p[2]+=.005*Math.sin(u*Math.PI)*Math.sin(v*Math.PI);return p}),q===0?'tunic':'leather',torsoWeights,'boots');
  put(surface(5,8,(u,v)=>front(.115+u*.100,.975-v*(.027+.016*Math.sin(u*Math.PI)),.034)),q===0?'tunic':'leather',torsoWeights,'collar');
 }
 let crestPoint;
 if(q>=3){
  // One small collection crest; the detail is embossed in the atlas.
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),support=parts.map(p=>{const m=new THREE.Mesh(p.geometry,material);m.updateMatrixWorld(true);return m}),ray=new THREE.Raycaster();
  crestPoint=(x,y,offset=.002)=>{ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));const hit=ray.intersectObjects(support,false)[0];return [x,y,(hit?.point.z??front(x,y,0)[2])+offset]};
  put(surface(8,8,(u,v)=>crestPoint(-.16+(u-.5)*.070,1.045+(v-.5)*.075)),q>=4?'brass':'tunicTrim',torsoWeights,'crest');
  material.dispose();
 }
 if(q===5){const p=crestPoint(-.16,1.045,.010);put(new THREE.OctahedronGeometry(.017).scale(1,1.28,.5).translate(...p),'gem',torsoWeights,'neutral')}
 mesh('medieval-tunic',parts,{patternVersion:3,contact:'split-gores'});
 // Trousers and boots use the original KayKit foot and limb silhouette and
 // interpolated weights. Both meet at exactly y=.235, even in mixed sets.
 mesh('suit-foundation',[piece(lathe([[.475,.253,.162],[.53,.270,.180],[.65,.277,.192],[.735,.280,.213]],28,12),'trousers',()=>[['hips',1]],'trousers')]);
 for(const side of ['l','r']){
  const sign=side==='l'?1:-1,Side=side==='l'?'Left':'Right',leg=source('Mage_Leg'+Side),arm=source('Mage_Arm'+Side),aw=S.armWeights(side);
  const trousers=referenceParts(leg,()=> 'trousers','trousers',p=>Math.min(p[1]-.235,.49-p[1]));
  trousers.push(piece(lathe([[.49,.118,.133,sign*.168,0],[.55,.129,.146,sign*.168,0],[.65,.134,.151,sign*.168,0]],20,7),'trousers',legWeights(side),'trousers'));
  if(q>=2&&k===0){const g=roundedPlate([[-.061,.04],[-.067,-.017],[0,-.065],[.067,-.017],[.061,.04]],.012,.009).translate(sign*.168,.345,.121),p=g.getAttribute('position');
   for(let i=0;i<p.count;i++){const dx=p.getX(i)-sign*.168;p.setZ(i,.132*Math.sqrt(Math.max(0,1-(dx/.118)**2))+.005+p.getZ(i)-.121)}g.computeVertexNormals();
   trousers.push(piece(g,'plate',legWeights(side),'armor',([x,y])=>[(x-sign*.168)/.16+.5,(y-.27)/.14]))}
  mesh('suit-trousers-'+side,trousers);
  const boot=referenceParts(leg,(_cell,p)=>p[1]<.03?'sole':p[2]>.07?'leather':'darkLeather','boots',p=>.235-p[1]);mesh('medieval-leg-'+side,boot);
  mesh('suit-boot-trim-'+side,[piece(lathe([[.205,.118,.128,sign*.168,0],[.213,.126,.138,sign*.168,0],[.234,.126,.138,sign*.168,0]],20,5),q>=3?'tunicTrim':'leather',legWeights(side),'collar')]);
  const handCells=[0,8,39,47];
  mesh('medieval-sleeve-'+side,referenceParts(arm,(cell,p)=>handCells.includes(cell)&&Math.abs(p[0])>.80?null:[4,12].includes(cell)?'linen':'tunic','sleeve'));
  mesh('anatomy-hand-'+Side.toLowerCase(),referenceParts(arm,(cell,p)=>handCells.includes(cell)&&Math.abs(p[0])>.80?'skin':null,'sleeve'));
  mesh('suit-glove-'+Side.toLowerCase(),referenceParts(arm,(cell,p)=>handCells.includes(cell)&&Math.abs(p[0])>.80?'leather':null,'sleeve'));
  // Ray-fit each cuff to the actual sleeve, including its non-circular cross section.
  const gp=new THREE.BufferGeometry();gp.setAttribute('position',new THREE.Float32BufferAttribute(arm.getAttribute('POSITION').getArray(),3));gp.setIndex(Array.from(arm.getIndices().getArray()));const collider=new THREE.Mesh(gp,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));collider.updateMatrixWorld(true);const ray=new THREE.Raycaster();
  function armAt(x,a,extra){const d=new THREE.Vector3(0,Math.cos(a),Math.sin(a)),o=new THREE.Vector3(sign*x,1.105,0).addScaledVector(d,.6);ray.set(o,d.clone().negate());const hit=ray.intersectObject(collider,false)[0];return(hit?hit.point:new THREE.Vector3(sign*x,1.105,0).addScaledVector(d,.12)).addScaledVector(d,extra).toArray()}
  const bracer=surface(8,24,(u,v)=>armAt(lerp(.64,.765,v),u*Math.PI*2,.007+.004*Math.sin(v*Math.PI)));if(side==='r'){const idx=bracer.index;for(let i=0;i<idx.count;i+=3){const a=idx.getX(i);idx.setX(i,idx.getX(i+1));idx.setX(i+1,a)}bracer.computeVertexNormals()}
  mesh('suit-bracer-'+side,[piece(bracer,k===0&&q>=2?'plate':'leather',aw,'boots')]);
  const shoulder=[];
  if(k===0||k===4&&q>=2){
   // Arched pauldron grows from the sleeve, with rounded front/back cutouts.
   const pad=surface(10,18,(u,v)=>{const a=lerp(-Math.PI*.65,Math.PI*.65,u),x=.30+v*(q<2?.15:.22),p=armAt(x,a,.012+(q<2?.018:.042)*Math.sin(v*Math.PI));p[0]+=sign*.006*Math.sin(v*Math.PI);return p});shoulder.push(piece(pad,k===0&&q>=2?'plate':'leather',aw,'armor'));
   if(q>=4){const rim=surface(3,18,(u,v)=>armAt(.506+v*.014,lerp(-Math.PI*.65,Math.PI*.65,u),.020));shoulder.push(piece(rim,'brass',aw,'collar'))}
  }else{
   const edge=surface(3,24,(u,v)=>armAt(.425+v*.020,u*Math.PI*2,.005));shoulder.push(piece(edge,q===0?'tunic':'tunicTrim',aw,'collar'));
  }
  mesh('suit-upperarm-'+side,shoulder);gp.dispose();collider.material.dispose();
 }
}
