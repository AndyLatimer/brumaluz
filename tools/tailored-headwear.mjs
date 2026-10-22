import {THREE,surface,lathe,lerp,smooth} from './garment-studio.mjs';
// Authored around the complete skull, not a small ring balanced on its crown.
export function tailoredHeadwear(S,C){
 const q=C.tier,k=C.cut,parts=[],head=()=>[['head',1]],put=(g,m='tunic',role='crown',uv)=>parts.push(S.piece(g,m,head,role,uv));
 const seat=1.96;
 function band(y,h,rx,rz,m){put(lathe([[y,rx,rz],[y+h,rx*.99,rz*.99]],32,4),m,'collar')}
 if(k===1){
  // Broad, softly undulating brim and a bent, rounded crown: the KayKit proportions.
  const rx=q===0?.63:.68,rz=q===0?.57:.62;
  put(surface(7,36,(u,v)=>{const a=u*Math.PI*2,r=lerp(1,.68,v);return [Math.sin(a)*rx*r,seat-.030+v*.035+Math.sin(a*3+.5)*.012*(1-v),Math.cos(a)*rz*r]}),'tunic','brim');
  put(surface(3,36,(u,v)=>{const a=u*Math.PI*2;return [Math.sin(a)*rx,seat-.030-v*.015+Math.sin(a*3+.5)*.012,Math.cos(a)*rz]}),'tunic','collar');
  put(lathe([[seat,.445,.425,0,0],[2.10,.40,.38,0,0],[2.28,.31,.29,.012,0],[2.47,.20,.18,.055,-.015],[2.62,.11,.095,.125,-.03],[2.68,.048,.045,.20,-.035],[2.70,.009,.01,.25,-.035]],32,25));
  band(seat+.01,.065,.448,.428,q===0?'tunic':'leather');
 }else if(k===0){
  // Open-faced helmet, with a real back and cheek contour. No invisible face cut.
  const helmetBottom=a=>1.50+.39*smooth(Math.cos(a),.20,.65);
  put(surface(18,32,(u,v)=>{const a=u*Math.PI*2,phi=lerp(Math.acos((helmetBottom(a)-1.66)/.50),.005,v),r=Math.sin(phi);return [Math.sin(a)*.493*r,1.66+Math.cos(phi)*.505,Math.cos(a)*.474*r-.01]}),q>=2?'plate':q===0?'tunic':'leather');
  put(surface(4,32,(u,v)=>{const a=u*Math.PI*2,phi=Math.acos((helmetBottom(a)-1.66)/.50)-v*.045;return [Math.sin(a)*.501*Math.sin(phi),1.66+Math.cos(phi)*.505,Math.cos(a)*.482*Math.sin(phi)-.01]}),q>=4?'brass':q>=2?'plate':'leather','collar');
  const rimPoints=Array.from({length:64},(_,i)=>{const a=i/64*Math.PI*2,phi=Math.acos((helmetBottom(a)-1.66)/.50);return new THREE.Vector3(Math.sin(a)*.505*Math.sin(phi),1.66+Math.cos(phi)*.507,Math.cos(a)*.486*Math.sin(phi)-.01)});
  put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints,true),96,.009,6,true),q>=4?'brass':q>=2?'plate':'leather','collar');
  if(q>=2)put(surface(24,5,(u,v)=>{const a=lerp(-1.16,1.50,v);return [(u-.5)*.034,1.66+Math.cos(a)*.519,Math.sin(a)*.487-.01]}),q>=4?'brass':'plate','collar');
 }else if(k===2){
  // Hood with a generous facial opening and sewn rear seam; one cloth volume.
  put(surface(19,32,(u,v)=>{const a=u*Math.PI*2,f=Math.max(0,Math.cos(a)),low=1.39+.62*f**3,phi=lerp(Math.acos((low-1.66)/.52),.025,v),r=Math.sin(phi),fold=.012*Math.sin(a*4)*Math.sin(phi);return [Math.sin(a)*(.50+fold)*r,1.66+Math.cos(phi)*.535,Math.cos(a)*(.48+fold)*r-.022]}),'tunic');
  put(surface(4,32,(u,v)=>{const a=u*Math.PI*2,low=1.39+.62*Math.max(0,Math.cos(a))**3,phi=Math.acos((low-1.66)/.52)-v*.075,r=Math.sin(phi);return [Math.sin(a)*.511*r,1.66+Math.cos(phi)*.535,Math.cos(a)*.491*r-.022]}),q===0?'tunic':q>=3?'tunicTrim':'darkLeather','collar');
 }else if(k===3){
  if(q<2){
   // Soft linen coif with a rolled brow rather than an empty circlet.
   put(lathe([[1.94,.445,.423],[2.05,.416,.398],[2.15,.30,.28],[2.20,.003,.003]],32,14),'linen');band(1.94,.045,.453,.431,q===0?'tunic':'tunicTrim');
  }else{
   put(surface(20,32,(u,v)=>{const a=u*Math.PI*2,rad=1-v,rx=.445*rad**.7+.001,rz=.425*(.12+rad*.88),peak=.17*Math.abs(Math.cos(a))*(1-v*.45),y=seat+v*(.29+q*.009)+peak*v;return [Math.sin(a)*rx,y,Math.cos(a)*rz]}),'tunic');
   band(seat,.065,.452,.432,'tunicTrim');
  }
 }else{
  // Ranger cap: compressed crown leans to one side above a turned-up brim.
  put(lathe([[1.95,.448,.422,0,0],[2.03,.45,.423,.035,-.015],[2.14,.33,.30,.095,-.04],[2.20,.12,.12,.15,-.055],[2.18,.012,.015,.19,-.06]],32,17));
  put(surface(5,32,(u,v)=>{const a=u*Math.PI*2,extra=.025+v*.026;return [Math.sin(a)*(.448+extra),seat-.02+v*.07+Math.sin(a)*.015,Math.cos(a)*(.422+extra)]}),q===0?'tunic':'leather','brim');
 }
 if(q>=3){
  const y=k===0?2.045:k===2?2.085:2.035,z=k===0?.31:k===2?.32:.437;
  const badge=new THREE.SphereGeometry(1,16,10).scale(.032,.040,.009).translate(0,y,z);
  put(badge,q>=4?'brass':'tunicTrim','crest',([x,yy])=>[x/.07+.5,(yy-y)/.09+.5]);
  if(q===5)put(new THREE.OctahedronGeometry(.015).scale(1,1.3,.45).translate(0,y,z+.012),'gem','neutral');
 }
 S.mesh('suit-head',parts,{fitVersion:3,fitCenter:[0,1.66,-.01],fitRadii:[.48,.48,.46],fitOffset:k===0?.025:k===2?.018:.003,hood:k===2});
}
