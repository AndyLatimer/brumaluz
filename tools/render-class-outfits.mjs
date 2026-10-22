import { createServer } from 'vite';
import { chromium } from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:4193,strictPort:true},logLevel:'error'});
let browser;
const mix=process.argv.includes('--mix'),detail=process.argv.includes('--detail')||mix;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1800,height:detail?1800:3900}});
 await page.goto('http://127.0.0.1:4193/render.html');
 await page.evaluate(async({detail,mix})=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {Character,loadKits}=await import('/src/character/character.ts');
  const {defaultChar}=await import('/src/data/data.ts');
  const {OUTFITS,ARMOR}=await import('/src/data/outfits.ts');
  const {ACCESSORIES}=await import('/src/data/accessories.ts');
  await loadKits();
  document.body.innerHTML='';document.body.style.cssText='margin:0;background:#e5ddcd;color:#493d34;font-family:Georgia';
  const height=detail?1800:3900;
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1800,height);document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e5ddcd');
  scene.add(new THREE.HemisphereLight('#fff0da','#6b7e91',2.5));
  const sun=new THREE.DirectionalLight('#fff0d6',3);sun.position.set(-4,10,15);scene.add(sun);
  const top=detail?5.2:11.2667;
  const camera=new THREE.OrthographicCamera(-5.2,5.2,top,-top,.01,100);camera.position.set(0,0,30);
  function label(value,x,y,size=18){const p=new THREE.Vector3(x,y,0).project(camera),node=document.createElement('div');node.textContent=value;node.style.cssText=`position:absolute;left:${(p.x+1)*900-165}px;top:${(1-p.y)*height/2}px;width:330px;text-align:center;font-size:${size}px`;document.body.append(node)}
  label(mix?'BRUMALUZ · EQUIPO POR PIEZAS':detail?'BRUMALUZ · ACABADOS Y CONSTRUCCIÓN':('BRUMALUZ · '+Object.keys(OUTFITS).length+' TRAJES DE CLASE'),0,detail?4.95:11.1,27);
  const collections=[...new Set(Object.values(OUTFITS).map(o=>o.collection))];
  const chosen=['traje_guerrero_forja','traje_mago_eclipse','traje_picaro_ambar','traje_clerigo_marea','traje_explorador_roble'].map(id=>OUTFITS[id]);
  (detail?[...chosen,...chosen,...chosen]:Object.values(OUTFITS)).forEach((outfit,i)=>{
   const d=defaultChar();d.cls=outfit.cls;
   for(const piece of Object.values(ARMOR).filter(p=>p.setId===outfit.id))d.equipment[piece.slot]={id:piece.id,count:1};
   if(mix){
    for(const item of Object.values(ACCESSORIES).filter(p=>p.collection===outfit.collection))d.equipment[item.slot]={id:item.id,count:1};
    if(i>=5&&i<10){
     const collectionBySlot={head:'ambar',chest:'eclipse',hands:'forja',legs:'alba',feet:'marea'};
     for(const [slot,collection] of Object.entries(collectionBySlot)){const item=Object.values(ARMOR).find(p=>p.cls===outfit.cls&&p.slot===slot&&p.collection===collection);d.equipment[slot]={id:item.id,count:1}}
    }
    if(i>=10){d.equipment.head=null;d.equipment.chest=null;d.equipment.hands=null}
   }
   const actor=new Character(d,{outfit:false});actor.root.rotation.y=detail&&!mix&&i>=5&&i<10?Math.PI+.3:-.3;
   actor.root.position.set((i%5-2)*2,(detail?2.35:9.15)-Math.floor(i/5)*(detail?2.65:1.92),0);scene.add(actor.root);
   if(detail&&i>=10){actor.setGait('walk');for(let step=0;step<24;step++)actor.update(step/60)}
   if(!detail||i<10)actor.update(0);
   label(mix?(i<5?'Conjunto y accesorios':i<10?'Colecciones combinadas':'Piezas con ropa básica'):outfit.label,actor.root.position.x,actor.root.position.y-.10,14);
  });
  renderer.render(scene,camera);
  // Capture the completed WebGL frame as a static image before the browser's
  // full-page compositor; large skinned contact sheets can otherwise stall it.
  const still=document.createElement('img');still.src=renderer.domElement.toDataURL('image/png');await still.decode();renderer.domElement.replaceWith(still);renderer.dispose();
 },{detail,mix});
 await page.screenshot({path:`src/assets/models/wardrobe/classes/${mix?'modular_equipment':detail?'class_outfit_details':'class_outfits'}.png`,fullPage:true,timeout:60000});
 console.log('Rendered class_outfits.png');
}finally{await browser?.close();await server.close()}
