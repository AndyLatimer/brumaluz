import { createServer } from 'vite';
import { chromium } from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:4193,strictPort:true},logLevel:'error'});
let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1800,height:3500}});
 await page.goto('http://127.0.0.1:4193/render.html');
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {Character,loadKits}=await import('/src/character/character.ts');
  const {defaultChar}=await import('/src/data/data.ts');
  const {OUTFITS}=await import('/src/data/outfits.ts');
  await loadKits();
  document.body.innerHTML='';document.body.style.cssText='margin:0;background:#e5ddcd;color:#493d34;font-family:Georgia';
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1800,3500);document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e5ddcd');
  scene.add(new THREE.HemisphereLight('#fff0da','#6b7e91',2.5));
  const sun=new THREE.DirectionalLight('#fff0d6',3);sun.position.set(-4,10,15);scene.add(sun);
  const camera=new THREE.OrthographicCamera(-5.2,5.2,10.1,-10.1,.01,100);camera.position.set(0,0,30);
  function label(value,x,y,size=18){const p=new THREE.Vector3(x,y,0).project(camera),node=document.createElement('div');node.textContent=value;node.style.cssText=`position:absolute;left:${(p.x+1)*900-165}px;top:${(1-p.y)*1750}px;width:330px;text-align:center;font-size:${size}px`;document.body.append(node)}
  label('BRUMALUZ · 50 TRAJES DE CLASE',0,9.95,27);
  const collections=[...new Set(Object.values(OUTFITS).map(o=>o.collection))];
  Object.values(OUTFITS).forEach((outfit,i)=>{
   const d=defaultChar();d.cls=outfit.cls;d.equipment.chest={id:outfit.id,count:1};
   const actor=new Character(d,{outfit:false});actor.root.rotation.y=-.3;
   actor.root.position.set((i%5-2)*2,7.75-Math.floor(i/5)*1.92,0);scene.add(actor.root);
   actor.update(0);label(outfit.label,actor.root.position.x,actor.root.position.y-.10,14);
   if(i%5===0)label(collections[Math.floor(i/5)].toUpperCase(),0,actor.root.position.y+1.78,20);
  });
  renderer.render(scene,camera);
 });
 await page.screenshot({path:'src/assets/models/wardrobe/classes/class_outfits.png',fullPage:true});
 console.log('Rendered class_outfits.png');
}finally{await browser?.close();await server.close()}
