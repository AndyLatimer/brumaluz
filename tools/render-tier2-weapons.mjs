// Produce an art sheet of the recovered amber set on the shared character rig and default tunic.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';

const url='http://127.0.0.1:4186';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4186','--strictPort']);
let browser;
try {
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Vite timeout')),20000);
    server.once('error',reject);
    server.once('exit',code=>reject(new Error(`Vite exited: ${code}`)));
    server.stdout.on('data',data=>{if(data.toString().includes(url)){clearTimeout(timer);resolve();}});
    server.stderr.on('data',data=>process.stderr.write(data));
  });
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1800,height:1100}});
  await page.goto(`${url}/render.html`);
  await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {Character,loadKits}=await import('/src/character/character.ts');
    const {defaultChar}=await import('/src/data/data.ts');
    const {WEAPONS}=await import('/src/data/weapons.ts');
    const {emptyEquipment}=await import('/src/data/inventory.ts');
    await loadKits();
    const canvas=document.createElement('canvas');document.body.replaceChildren(canvas);
    document.body.style.cssText='margin:0;overflow:hidden;background:#dedbd2';
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(1800,1100);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#dedbd2');
    scene.add(new THREE.HemisphereLight('#fff1db','#71808b',2.5));
    const key=new THREE.DirectionalLight('#fff0d7',3.1);key.position.set(-4,8,7);scene.add(key);
    const camera=new THREE.OrthographicCamera(-7.8,7.8,4.75,-4.75,.01,100);
    camera.position.set(0,7,14);camera.lookAt(0,.7,0);
    const classes=['guerrero','mago','picaro','clerigo','explorador'];
    for(const tier of [1,2])for(const [column,cls]of classes.entries()){
      const equipment=emptyEquipment();
      for(const [id,w]of Object.entries(WEAPONS))if(w.tier===tier&&w.cls===cls)equipment[w.slot]={id,count:1};
      const actor=new Character({...defaultChar(),cls,equipment,clothA:column+1,clothB:8},{outfit:false});
      actor.root.position.set((column-2)*2.7,0,tier===2?2.1:-2.1);actor.root.rotation.y=-.2;
      scene.add(actor.root);actor.update(0);actor.update(.1);
    }
    renderer.render(scene,camera);
    const caption=document.createElement('div');
    caption.style.cssText='position:absolute;top:24px;left:40px;right:40px;font:23px system-ui;color:#273b37;text-align:center';
    caption.innerHTML='<b>BRUMALUZ · ARMAS DE ÁMBAR RECUPERADAS</b><div style="font-size:18px;margin:10px">Arriba: categoría 1 · Abajo: categoría 2 · Atuendo base: túnica medieval</div><div style="display:flex;justify-content:space-around;margin-top:20px"><span>Guerrero</span><span>Mago</span><span>Pícaro</span><span>Clérigo</span><span>Explorador</span></div>';
    document.body.append(caption);
  });
  await page.screenshot({path:'src/assets/models/items/tier2/tier2_characters.png'});
  console.log('Rendered tier2_characters.png');
} finally {
  await browser?.close();
  if(server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
}
