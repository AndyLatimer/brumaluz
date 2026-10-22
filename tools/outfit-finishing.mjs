// Shared construction fixes, plus small details that survive the game's camera distance.
export const finishOutfit = `
// A real pelvic lining bridges both legs: short jackets must never expose empty space.
mesh('suit-foundation',[
 piece(loft([[.49,.25,.165],[.56,.27,.175],[.68,.275,.19]],24,{closeStart:true,closeEnd:true}),'trousers'),
],()=>[['hips',1]]);
for(const side of ['l','r']){
 const sign=side==='l'?1:-1, x=sign*.168;
 const leg=[];
 leg.push(piece(loft([[.22,.116,.125,x,.008],[.30,.122,.136,x,0],[.45,.128,.143,x,0],[.57,.139,.155,x,0],[.63,.14,.155,x,0]],20,{closeStart:true,closeEnd:true}),'trousers'));
 // Gusset seam, fitted knee reinforcement, boot binding and shin fastening.
 leg.push(piece(tube([x+sign*.115,.26,.018],[x+sign*.124,.54,.018],.006),'tunicTrim'));
 leg.push(piece(ell(x,.32,.124,.09,.078,.024),k===0?'plate':'leather'));
 for(const y of [.235,.19])leg.push(piece(seam(x,y,0,.118,.139,.009),'leather'));
 leg.push(piece(box(x+sign*.082,.205,.10,.032,.031,.018),'brass'));
 mesh('suit-leg-detail-'+side,leg,legWeights(side));
 const arm=[];
 // Sleeves are authored in the same T pose as the canonical skin and follow arm joints.
 for(const at of [.48,.73]){
  arm.push(piece(new THREE.CylinderGeometry(.126,.126,.035,16).rotateZ(Math.PI/2).translate(sign*at,1.105,0),'leather'));
  arm.push(piece(new THREE.TorusGeometry(.125,.008,6,20).rotateY(Math.PI/2).translate(sign*(at-.017),1.105,0),'tunicTrim'));
 }
 arm.push(piece(box(sign*.68,1.105,.115,.14,.12,.025),k===0?'plate':'leather'));
 for(let j=0;j<3;j++)arm.push(piece(ell(sign*(.63+j*.04),1.11,.136,.007,.007,.005),'brass'));
 mesh('suit-arm-detail-'+side,arm,transferArmWeights(side));
}
// Back panels, neckline lining and hand-sewn closure; not just decoration on the front.
add(loft([[1.16,.267,.225],[1.24,.155,.145]],24,{closeStart:true,closeEnd:true}),'linen');
for(const sign of [-1,1]){
 for(let i=0;i<10;i++){
  const a=i/10,b=(i+1)/10;
  add(tube(clothPoint(sign*(.12+.10*a),1.17-.29*a,-1),clothPoint(sign*(.12+.10*b),1.17-.29*b,-1),.009),'tunicTrim');
 }
}
add(box(0,.87,-.266,.11,.13,.025),'leather');
add(box(0,.87,-.283,.07,.027,.014),'brass');
if(k===0){
 add(ell(0,1.01,-.19,.235,.155,.105),'plate');
 for(let j=0;j<3;j++)add(box(0,.91+j*.055,-.286,.14,.022,.025),'brass');
}else if(k===4){
 add(box(0,1.005,-.29,.22,.25,.10),'leather');
 add(ell(0,1.13,-.30,.12,.045,.065),'darkLeather');
 add(box(0,.99,-.35,.042,.19,.02),'tunicTrim');
 add(box(0,1.015,-.365,.055,.045,.014),'brass');
}else if(k===2){
 for(let i=0;i<12;i++){
  const a=i/12,b=(i+1)/12;
  add(tube(clothPoint(-.20+.40*a,1.12-.25*a,-1,.014),clothPoint(-.20+.40*b,1.12-.25*b,-1,.014),.018),'leather');
 }
}else{
 for(const sign of [-1,1])for(let i=0;i<14;i++){
  const a=i/14,b=(i+1)/14,ya=.76+(.36-.76)*a,yb=.76+(.36-.76)*b;
  add(tube(clothPoint(sign*.10,ya,-1),clothPoint(sign*.10,yb,-1),.008),'tunicTrim');
 }
 add(new THREE.OctahedronGeometry(.035).scale(1,1.35,.3).translate(0,1.02,-.276),'gem');
}
// Conforming lapel seams and hem stitching on all sides.
for(let i=0;i<28;i++){
 const a=i/28*Math.PI*2;
 const [,rx,rz]=sectionAt(bottom+.027);
 add(ell(Math.cos(a)*(rx+.005),bottom+.027,Math.sin(a)*(rz+.005),.005,.008,.005),'tunicTrim');
}
if(k===2||k===4){
 add(tube([-.17,1.10,.245],[-.22,.87,.213],.007),'tunicTrim');
 add(tube([.17,1.10,.245],[.22,.87,.213],.007),'tunicTrim');
}
if(k===1||k===3){
 for(const sign of [-1,1]){
  add(tube([sign*.11,.70,.283],[sign*.15,.32,.295],.008),'tunicTrim');
  for(let j=0;j<4;j++)add(ell(sign*.15,.36+j*.075,.303,.007,.007,.004),'brass');
 }
}
`;
