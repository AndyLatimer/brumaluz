import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const collections = [
  ['artesano','del Caminante',1,'#53664a','#b89564','#777f82','#acbdc1'],
  ['ambar','del Ámbar',2,'#48644b','#d4ac51','#745b3c','#edc16c'],
  ['violeta','del Sello Violeta',3,'#504462','#b9a1c8','#555567','#d6a9eb'],
  ['aurora','de la Aurora',4,'#596b79','#ddc38a','#bac6cc','#ffdf97'],
  ['fuego','del Fuego Primigenio',5,'#543b36','#c38d55','#4e4d53','#ffa65e'],
  ['alba','de la Guardia del Alba',2,'#497a9d','#dfc18b','#afc4cf','#b5e4ee'],
  ['eclipse','del Eclipse',3,'#51405f','#aaa1c3','#646075','#c9a2ee'],
  ['roble','del Roble Errante',1,'#476441','#b99b66','#6b7258','#b6cb83'],
  ['marea','de la Marea Real',4,'#367f8b','#dec28a','#94b7c6','#bce5de'],
  ['forja','de la Forja Estelar',5,'#3e3b4c','#d2ad78','#717489','#ffc17a'],
];
const classes=[['guerrero','Armadura'],['mago','Túnica arcana'],['picaro','Cuero de acechador'],['clerigo','Vestidura sagrada'],['explorador','Atuendo de guardabosques']];
const items=collections.flatMap(([collection,suffix,tier,cloth,trim,metal,gem],theme)=>classes.map(([cls,name],cut)=>({
  id:`traje_${cls}_${collection}`,label:`${name} ${suffix}`,collection,tier,cls,slot:'chest',guard:tier+(cls==='guerrero'?2:cls==='mago'?0:1),
  value:[0,180,360,720,2160,6480][tier],cloth,trim,metal,gem,theme,cut,
})));
await fs.writeFile('src/data/outfits.json',JSON.stringify(items,null,2)+'\n');
const source=await fs.readFile('scripts/build-medieval-wardrobe.mjs','utf8');
const prefix=source.slice(0,source.indexOf('const SEGMENTS = 20;'));
const suffix=source.slice(source.indexOf('const atlasCell ='),source.indexOf('// Clean up and write GLB'));
const design = `
const C=CONFIG, k=C.cut, t=C.theme;
for(const [name,color] of Object.entries({tunic:C.cloth,tunicTrim:C.trim,brass:C.trim,plate:C.metal,gem:C.gem,leather:'#604533',darkLeather:'#342d2b',trousers:'#494742'})){
 let m=materials.get(name); if(!m){m=document.createMaterial(name);materials.set(name,m)}
 m.setBaseColorFactor([...new THREE.Color(color).toArray(),1]).setRoughnessFactor(name==='plate'?.42:.8).setMetallicFactor(['plate','brass'].includes(name)?.5:0);
}
const part=[]; const add=(g,m)=>part.push(piece(g,m));
const box=(x,y,z,w,h,d)=>new THREE.BoxGeometry(w,h,d).translate(x,y,z);
const ell=(x,y,z,rx,ry,rz)=>new THREE.SphereGeometry(1,12,8).scale(rx,ry,rz).translate(x,y,z);
const tube=(a,b,r)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);return new THREE.CylinderGeometry(r,r,v.length(),8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize())).translate(...A.add(B).multiplyScalar(.5).toArray())};
const long=k===1||k===3, bottom=long?.26:k===2?.57:.47;
const profile=[[bottom,long?.39:.345,long?.29:.275],[.63,.32,.267],[.79,.301,.253],[.96,.317,.26],[1.09,.308,.255],[1.17,.26,.22],[1.24,.15,.14]];
add(loft(profile,24),'tunic');
for(const y of [bottom+.015,.78,1.235])add(seam(0,y,0,y>1.2?.15:y<.7?.39:.31,y>1.2?.14:.275,.012),'tunicTrim');
add(loft([[.78,.314,.268],[.845,.314,.268]],24),'leather');
add(box(0,.81,.285,.10,.07,.025),'brass');add(box(0,.81,.303,.055,.035,.014),'gem');
// Sculpted class cuts: plate cuirass, wrap robe, diagonal harness, stole and ranger vest.
if(k===0){
 add(ell(0,1,.15,.285,.18,.17),'plate');
 for(const sign of [-1,1]){add(ell(sign*.29,1.08,0,.14,.105,.27),'plate');for(let j=0;j<3;j++)add(box(sign*.19,.69-j*.06,.245,.18,.052,.035),'plate')}
 for(let j=0;j<4;j++)add(box(0,.91+j*.045,.318,.10-j*.014,.028,.016),'brass');
}else if(k===1){
 for(const sign of [-1,1]){add(tube([sign*.12,1.2,.18],[sign*.04,.84,.29],.025),'tunicTrim');add(box(sign*.15,.54,.28,.08,.52,.02),'tunicTrim')}
 add(ell(0,1.10,.29,.052,.055,.024),'gem');
}else if(k===2){
 add(tube([-.24,1.13,.19],[.23,.83,.20],.034),'leather');
 for(let j=0;j<5;j++)add(box(-.15+j*.065,1.07-j*.04,.279,.033,.035,.035),'brass');
 add(ell(-.30,.72,.10,.09,.12,.07),'leather');
}else if(k===3){
 for(const sign of [-1,1]){add(box(sign*.13,.91,.276,.085,.5,.024),'tunicTrim');add(box(sign*.13,.41,.287,.085,.42,.022),'tunicTrim')}
 add(box(0,1.02,.30,.04,.17,.025),'brass');add(box(0,1.035,.30,.13,.035,.025),'brass');
}else{
 add(loft([[.86,.318,.271],[1.08,.327,.27],[1.17,.27,.23]],20),'leather');
 add(box(.20,.71,.24,.13,.18,.07),'leather');add(box(-.20,.75,.24,.13,.12,.07),'leather');
 for(let j=0;j<3;j++)add(tube([-.22+j*.045,.86,.28],[-.22+j*.045,1.06,.28],.015),'brass');
}
// Collection geometry: varied hems, shoulder treatments and actual heraldic motifs.
const motifY=k===0?1.02:1.09, z=.335;
if(t===7){
 for(const sign of [-1,1])for(let j=0;j<3;j++)add(ell(sign*(.20+j*.045),1.13-j*.035,.08,.045,.075,.018).rotateZ(sign*.2),'tunicTrim');
 add(ell(0,motifY,z,.043,.078,.015),'gem');
}else if(t===8){
 for(let j=-3;j<=3;j++)add(tube([0,motifY-.07,z],[j*.026,motifY+.065-Math.abs(j)*.008,z],.008),'brass');
 for(const sign of [-1,1])for(let j=0;j<4;j++)add(ell(sign*(.24+j*.02),1.1-j*.025,.04,.10,.04,.20),'plate');
}else if(t===9){
 add(new THREE.TorusGeometry(.063,.012,6,12).translate(0,motifY,z),'brass');
 add(new THREE.OctahedronGeometry(.045).scale(1,1,.4).translate(0,motifY,z+.016),'gem');
 for(const sign of [-1,1])for(let j=0;j<3;j++)add(box(sign*.31,1.13-j*.045,0,.14,.035,.32-j*.04),'plate');
}else if(t===6){
 add(new THREE.TorusGeometry(.055,.014,6,18,Math.PI*1.6).translate(0,motifY,z),'brass');
 for(const sign of [-1,1])add(box(sign*.28,1.08,-.09,.13,.19,.17),'plate');
}else if(t===5){
 add(box(0,motifY,z,.025,.16,.018),'brass');add(box(0,motifY+.02,z,.12,.025,.018),'brass');
 for(const sign of [-1,1])add(ell(sign*.30,1.12,0,.11,.065,.24),'plate');
}else{
 for(let j=0;j<=t;j++){
  const a=(j-t/2)*.28;
  add(new THREE.OctahedronGeometry(.024+t*.003).scale(1,1.5,.5).translate(a,motifY,z),'gem');
 }
 for(const sign of [-1,1])for(let j=0;j<1+t;j++)add(box(sign*.28,1.12-j*.025,0,.12,.03,.20+t*.025),'plate');
}
// Collection-specific scalloped tabard: physical folds and stitched edging.
for(let j=0;j<3+t%3;j++){
 const x=(j-(2+t%3)/2)*.09, y=bottom+.08+(j%2)*.025;
 add(box(x,y,.29,.07,.13+t%3*.025,.022),'tunic');
 add(box(x,y-.06,.305,.065,.012,.01),'brass');
}
for(const sign of [-1,1]){
 for(let j=0;j<5;j++)add(ell(sign*.235,.88+j*.045,.20,.009,.009,.009),'brass');
 add(box(sign*.26,.72,.12,.11,.13,.09),'leather');add(box(sign*.26,.77,.17,.12,.025,.02),'brass');
}
function outfitWeights([x,y,z]){
 if(y>.65)return torsoWeights([x,y,z]);
 const side=x>=0?'l':'r';const amount=Math.min(.72,(.65-y)*1.5)*THREE.MathUtils.smoothstep(Math.abs(x),.02,.18);
 return [['hips',1-amount],[\`upperleg.\${side}\`,amount]];
}
mesh('medieval-tunic',part,outfitWeights);
`;
const temp=path.resolve('scripts/.generated-class-outfit.mjs');
await fs.mkdir('src/assets/models/wardrobe/classes',{recursive:true});
try{
for(const item of items){
 const output=path.resolve('src/assets/models/wardrobe/classes',item.id+'.glb');
 const end=`await document.transform(prune());await io.write(${JSON.stringify(output)},document);console.log('Built ${item.id}');`;
 await fs.writeFile(temp,prefix+'\nconst CONFIG='+JSON.stringify(item)+';\n'+design+suffix+'\n'+end);
 await import(pathToFileURL(temp).href+'?id='+item.id);
}
}finally{await fs.unlink(temp).catch(()=>{});}
