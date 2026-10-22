// Readable heraldry shared by jewellery and headwear, with a different silhouette per set.
export const motifs = `
function emblem(x,y,z,s){
 const parts=[],put=(g,m='brass')=>parts.push(piece(g,m));
 const gem=(a,b,c,rx,ry,rz)=>new THREE.OctahedronGeometry(1).scale(rx,ry,rz).translate(a,b,c);
 if(t===6){put(new THREE.TorusGeometry(s,.16*s,6,18,Math.PI*1.6).translate(x,y,z));put(gem(x+s*.35,y,z+s*.1,s*.25,s*.4,s*.18),'gem')}
 else if(t===7){put(new THREE.SphereGeometry(1,8,6).scale(s*.65,s*1.2,s*.22).rotateZ(-.35).translate(x,y,z),'gem');put(tube([x-s*.3,y-s*.8,z+s*.22],[x+s*.3,y+s*.8,z+s*.22],s*.07))}
 else if(t===8){for(let j=-3;j<=3;j++)put(tube([x,y-s*.8,z],[x+j*s*.3,y+s*(1-Math.abs(j)*.08),z],s*.08));put(gem(x,y-s*.6,z+s*.1,s*.45,s*.45,s*.25),'gem')}
 else if(t===9){put(new THREE.TorusGeometry(s,.16*s,6,12).translate(x,y,z));for(let j=0;j<8;j++){const a=j*Math.PI/4;put(box(x+Math.cos(a)*s,y+Math.sin(a)*s,z,s*.30,s*.30,s*.28))}put(gem(x,y,z+s*.2,s*.55,s*.7,s*.3),'gem')}
 else if(t===3||t===5){for(let j=0;j<8;j++){const a=j*Math.PI/4;put(tube([x+Math.cos(a)*s*.45,y+Math.sin(a)*s*.45,z],[x+Math.cos(a)*s,y+Math.sin(a)*s,z],s*.07))}put(gem(x,y,z+s*.1,s*.5,s*.65,s*.3),'gem')}
 else if(t===4){for(let j=-1;j<=1;j++)put(new THREE.ConeGeometry(s*.35,s*(1.3-Math.abs(j)*.3),4).translate(x+j*s*.42,y+s*.15,z),'gem');put(new THREE.TorusGeometry(s*.75,s*.1,6,12,Math.PI).rotateZ(Math.PI).translate(x,y-s*.5,z))}
 else{put(new THREE.TorusGeometry(s*.8,s*.12,6,12).translate(x,y,z));put(gem(x,y,z+s*.12,s*.55,s*(t===1?1.2:.75),s*.3),'gem');if(t===2)for(const sign of [-1,1])put(box(x+sign*s*.9,y,z,s*.16,s*.9,s*.2))}
 return parts;
}
`;
export const headwear = `
const headParts=[],headAdd=(g,m)=>headParts.push(piece(g,m));
const headRing=(radius,y,tubeRadius=.025)=>new THREE.TorusGeometry(radius,tubeRadius,6,32).rotateX(Math.PI/2).scale(1,1,.94).translate(0,y,.015);
if(k===0){
 headAdd(new THREE.SphereGeometry(.54,20,10,0,Math.PI*2,0,Math.PI/2).scale(1,.70,.94).translate(0,1.98,.015),'plate');
 headAdd(headRing(.54,1.99),'brass');
 for(const sign of [-1,1])headAdd(box(sign*.51,1.91,-.02,.06,.20,.18),'plate');
}else if(k===1){
 headAdd(new THREE.ConeGeometry(.48,.64,20).rotateZ(-.12).translate(.035,2.34,.015),'tunic');
 headAdd(headRing(.50,2.055,.045),'tunicTrim');
 headAdd(new THREE.CylinderGeometry(.58,.58,.028,24).scale(1,1,.94).translate(0,2.04,.015),'tunic');
}else if(k===2){
 headAdd(new THREE.SphereGeometry(.53,20,10,0,Math.PI*2,0,Math.PI/2).scale(1,.46,.94).translate(0,2.00,.015),'leather');
 headAdd(headRing(.53,2.01,.018),'tunicTrim');
}else if(k===3){
 headAdd(headRing(.535,2.005,.022),'brass');
 for(const sign of [-1,1])headAdd(new THREE.ConeGeometry(.045,.12,4).translate(sign*.16,2.07,.48),'brass');
}else{
 headAdd(new THREE.SphereGeometry(.52,20,10,0,Math.PI*2,0,Math.PI/2).scale(1,.48,.94).translate(0,2.0,.015),'tunic');
 headAdd(new THREE.CylinderGeometry(.57,.57,.025,24).scale(1,1,.97).translate(0,2.01,.035),'leather');
 headAdd(headRing(.51,2.04,.022),'tunicTrim');
}
headParts.push(...emblem(0,2.04,.535,.06));
for(const p of headParts)p.geometry.translate(0,k===0?-.10:k===1?-.045:-.025,0);
mesh('suit-head',headParts,()=>[['head',1]]);
`;
