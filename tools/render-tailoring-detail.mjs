// Large front/back portraits using the game's own mounting and material code.
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:4196,strictPort:true,watch:{ignored:['**/*.zip','**/*.blend','**/.art-sources/**']}},logLevel:'error'});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:2400,height:1800}});
 page.on('pageerror',error=>console.error(error));
 await page.goto('http://127.0.0.1:4196/render.html');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {Character,loadKits}=await import('/src/character/character.ts');
  const {defaultChar}=await import('/src/data/data.ts');
  const {ARMOR}=await import('/src/data/outfits.ts');
  const {ACCESSORIES}=await import('/src/data/accessories.ts');
  await loadKits();document.body.innerHTML='';document.body.style.cssText='margin:0;font-family:Georgia;color:#554534';
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(2400,1800);document.body.append(renderer.domElement);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e5ddcd');
  scene.add(new THREE.HemisphereLight('#fff0de','#697a88',1.9));
  const sun=new THREE.DirectionalLight('#ffedd2',2.7);sun.position.set(-4,7,12);scene.add(sun);
  const fill=new THREE.DirectionalLight('#c8dfed',.8);fill.position.set(4,1,-5);scene.add(fill);
  const camera=new THREE.OrthographicCamera(-3.2,3.2,2.4,-2.4,.01,100);camera.position.set(0,0,30);
  const label=(value,x,y,size=24,width=470)=>{const p=new THREE.Vector3(x,y,0).project(camera),el=document.createElement('div');el.textContent=value;el.style.cssText=`position:absolute;left:${(p.x+1)*1200-width/2}px;top:${(1-p.y)*900}px;width:${width}px;text-align:center;font-size:${size}px`;document.body.append(el)};
  label('BRUMALUZ · NUEVO PATRONAJE Y MATERIALES',0,2.31,32,2200);
  const classes=['guerrero','mago','picaro','clerigo','explorador'],sets=['alba','eclipse','ambar','marea','roble'];
  for(let row=0;row<2;row++)for(let col=0;col<5;col++){
   const data=defaultChar();data.cls=classes[col];data.hair=2;
   for(const piece of Object.values({...ARMOR,...ACCESSORIES}).filter(p=>p.collection===sets[col]&&(!('cls'in p)||p.cls===data.cls)))data.equipment[piece.slot]={id:piece.id,count:1};
   data.equipment.weapon=null;data.equipment.offhand=null;
   const actor=new Character(data,{outfit:false});actor.root.rotation.y=row?Math.PI+.28:-.28;
   actor.root.position.set((col-2)*1.28,row?-2.13:.20,0);scene.add(actor.root);actor.update(0);
   label(classes[col]+' · '+(row?'espalda':'frente'),actor.root.position.x,actor.root.position.y-.08,24);
  }
  renderer.render(scene,camera);
  // Capture the completed WebGL frame as a static image before the browser's
  // full-page compositor; large skinned contact sheets can otherwise stall it.
  const still=document.createElement('img');still.src=renderer.domElement.toDataURL('image/png');await still.decode();renderer.domElement.replaceWith(still);renderer.dispose();
 });
 await page.screenshot({path:'src/assets/models/wardrobe/classes/equipment_tailoring_closeup.png',timeout:60000});
 console.log('Rendered tailoring closeups.');
}finally{await browser?.close();await server.close()}
