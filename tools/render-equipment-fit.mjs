// Art review sheets: rarity progression and actual character proportions/poses.
import {createServer} from 'vite';import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:4195,strictPort:true,watch:{ignored:['**/*.zip','**/*.blend']}},logLevel:'error'});
const poses=process.argv.includes('--poses'),fit=process.argv.includes('--fit');const collection=process.argv.find(v=>v.startsWith('--set='))?.slice(6);let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:2100,height:2100}});await page.goto('http://127.0.0.1:4195/render.html');
 await page.evaluate(async ({fit,poses,collection})=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {Character,loadKits}=await import('/src/character/character.ts');
  const {defaultChar}=await import('/src/data/data.ts');const {ARMOR}=await import('/src/data/outfits.ts');const {ACCESSORIES}=await import('/src/data/accessories.ts');await loadKits();
  document.body.innerHTML='';document.body.style.cssText='margin:0;font-family:Georgia;color:#493e33';
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(2100,2100);document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e5ddcd');scene.add(new THREE.HemisphereLight('#fff0dc','#6e8194',2.5));
  const sun=new THREE.DirectionalLight('#fff0d6',3);sun.position.set(-4,10,15);scene.add(sun);
  const camera=new THREE.OrthographicCamera(-6.5,6.5,6.5,-6.5,.01,100);camera.position.set(0,0,30);
  const label=(value,x,y,size=21,color='#493e33',width=330)=>{const p=new THREE.Vector3(x,y,0).project(camera),node=document.createElement('div');node.textContent=value;node.style.cssText=`position:absolute;left:${(p.x+1)*1050-width/2}px;top:${(1-p.y)*1050}px;width:${width}px;text-align:center;font-size:${size}px;color:${color}`;document.body.append(node)};
  label(poses?'BRUMALUZ · PRENDAS ANIMADAS':fit?'BRUMALUZ · AJUSTE Y MOVIMIENTO':'BRUMALUZ · PROGRESIÓN DE EQUIPO',0,6.20,30,'#493e33',1800);
  const sets=['novicio','artesano','ambar','violeta','aurora','forja'],names=['Gris · común','Verde · poco común','Azul · raro','Morado · épico','Dorado · legendario','Naranja · artefacto'];
  const colors=['#65645d','#487446','#397294','#79548f','#9b782d','#ba692d'];
  const classes=['guerrero','mago','picaro','clerigo','explorador'];
  const races=['humano','elfo','lagto','pelso'];
  const columns=fit||poses?4:6;
  for(let column=0;column<columns;column++)label(poses?['Reposo','Caminar','Correr','Habilidad'][column]:fit?races[column]:names[column],(column-(columns-1)/2)*(fit||poses?2.9:2.1),5.65,22,fit||poses?'#493e33':colors[column]);
  for(let row=0;row<5;row++)for(let column=0;column<columns;column++){
   const data=defaultChar();data.cls=classes[row];data.face=column%4;data.race=fit?races[column]:'humano';data.sex=column%2;data.build=fit?(column%2?1:0):.5;data.height=fit?(column%2?0:1):.5;data.hair=fit?[1,4,7,9][column]:2;
   const chosen=collection??(fit||poses?'forja':sets[column]);
   for(const item of Object.values({...ARMOR,...ACCESSORIES}).filter(p=>p.collection===chosen&&(!('cls'in p)||p.cls===data.cls)))data.equipment[item.slot]={id:item.id,count:1};
   const actor=new Character(data,{outfit:false});actor.root.rotation.y=fit&&row===4?Math.PI-.3:-.3;actor.root.position.set((column-(columns-1)/2)*(fit||poses?2.9:2.1),3.6-row*2.35,0);scene.add(actor.root);
   const pose=poses?column:fit?row:0;
   if(pose>0&&pose<4){actor.update(0);actor.setGait(pose===1?'walk':pose===2?'run':'idle');if(pose===3)actor.attack(true);for(let step=1;step<30;step++)actor.update(step/60)}else actor.update(0);
   label(fit?classes[row]+([' · reposo',' · caminar',' · correr',' · habilidad',' · espalda'][row]):classes[row],actor.root.position.x,actor.root.position.y-.12,18);
  }
  renderer.render(scene,camera);
  // Capture the completed WebGL frame as a static image before the browser's
  // full-page compositor; large skinned contact sheets can otherwise stall it.
  const still=document.createElement('img');still.src=renderer.domElement.toDataURL('image/png');await still.decode();renderer.domElement.replaceWith(still);renderer.dispose();
 },{fit,poses,collection});
 await page.screenshot({path:`src/assets/models/wardrobe/classes/${poses?'equipment_pose_review':fit?'equipment_fit_review':'equipment_rarity_progression'}.png`,fullPage:true,timeout:60000});console.log('Rendered equipment art sheet.');
}finally{await browser?.close();await server.close()}
