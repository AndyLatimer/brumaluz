export const tailoredAccessories = `
const q=C.tier,parts=[],put=(g,m='brass')=>parts.push(piece(g,m));
function supportZ(x,y){const rows=[[.52,.327,.269],[.68,.31,.258],[.80,.297,.249],[.98,.31,.255],[1.10,.30,.248],[1.17,.25,.213],[1.245,.145,.135]];let a=rows[0],b=a;for(const row of rows){b=row;if(row[0]>=y)break;a=row}const v=a===b?0:THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1),rx=THREE.MathUtils.lerp(a[1],b[1],v),rz=THREE.MathUtils.lerp(a[2],b[2],v);return rz*Math.sqrt(Math.max(0,1-(x/rx)**2))}
function chain(points,radius,material){for(let i=1;i<points.length;i++)put(tube(points[i-1],points[i],radius),material)}
function medallion(x,y,z,s){
 const metal=q===0?'leather':'brass';
 put(new THREE.CylinderGeometry(s,s,.006,16).rotateX(Math.PI/2).translate(x,y,z),metal);
 if(q>=2)put(new THREE.TorusGeometry(s*.91,.0025,5,20).translate(x,y,z+.003),'brass');
 if(q>=3){
  if(C.collection==='eclipse')put(new THREE.TorusGeometry(s*.50,s*.09,5,14,Math.PI*1.55).translate(x,y,z+.005),'plate');
  else if(C.collection==='marea')for(let i=-1;i<=1;i++)put(tube([x,y-s*.45,z+.005],[x+i*s*.42,y+s*.5,z+.005],s*.045),'plate');
  else if(C.collection==='roble')put(new THREE.SphereGeometry(1,8,6).scale(s*.26,s*.50,.002).rotateZ(-.35).translate(x,y,z+.005),'plate');
  else{put(new THREE.TorusGeometry(s*.48,.0015,5,12).translate(x,y,z+.004),'plate')}
 }
 if(q>=4){put(new THREE.CylinderGeometry(s*.25,s*.25,.004,12).rotateX(Math.PI/2).translate(x,y,z+.007),'brass');put(new THREE.OctahedronGeometry(s*.20).scale(1,1.1,.35).translate(x,y,z+.010),'gem')}
 if(q===5)put(new THREE.TorusGeometry(s*.74,.0014,5,24).translate(x,y,z+.005),'brass');
}
if(C.slot==='pendant'){
 // Continuous cord follows the neckline; no disconnected decorative links.
 const s=.025+q*.002;
 for(const sign of [-1,1]){
  const points=Array.from({length:17},(_,i)=>{const a=i/16,x=sign*.155*(1-a),y=1.19-.19*a;return [x,y,supportZ(x,y)+.004]});
  chain(points,q>=3?.0025:.003,q<2?'leather':'brass');
 }
 const back=Array.from({length:17},(_,i)=>{const a=Math.PI*i/16,x=.155*Math.cos(a);return [x,1.19,-supportZ(x,1.19)-.004]});chain(back,.0025,q<2?'leather':'brass');
 medallion(0,.985,supportZ(0,.985)+.009,s);
}else if(C.slot==='ring'){
 // Fit around the actual canonical hand rather than an arbitrary torus radius.
 const ref=armSource('l'),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ref.getAttribute('POSITION').getArray(),3));if(ref.getIndices())g.setIndex(Array.from(ref.getIndices().getArray()));g.computeVertexNormals();
 const collider=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));collider.updateMatrixWorld(true);const ray=new THREE.Raycaster(),points=[];
 for(let i=0;i<32;i++){
  const angle=i/32*Math.PI*2,dir=new THREE.Vector3(0,Math.cos(angle),Math.sin(angle)),origin=new THREE.Vector3(.928,1.105,0).addScaledVector(dir,.4);ray.set(origin,dir.clone().negate());const hit=ray.intersectObject(collider,false)[0];points.push((hit?hit.point:new THREE.Vector3(.928,1.105,0).addScaledVector(dir,.06)).addScaledVector(dir,.003));
 }
 const curve=new THREE.CatmullRomCurve3(points,true);put(new THREE.TubeGeometry(curve,48,q===0?.003:.004,6,true),q===0?'leather':'brass');
 const top=points[8];medallion(.928,1.105,top.z+.005,.012+q*.0008);
 g.dispose();collider.material.dispose();
}else{
 const x=.205,y=.775,z=supportZ(x,y)+.006;
 put(new THREE.TorusGeometry(.010,.0028,5,12).translate(x,y,z),q===0?'leather':'brass');
 chain([[x,y-.008,z],[x,y-.037,supportZ(x,y-.037)+.006]],.003,'leather');
 medallion(x,y-.064,supportZ(x,y-.064)+.010,.022+q*.002);
}
`;
