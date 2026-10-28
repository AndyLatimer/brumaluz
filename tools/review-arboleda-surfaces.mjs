/** Inspect the actual GLBs in WebGL from multiple angles, using game depth ranges. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'art/arboleda/review');
await mkdir(output,{recursive:true});
let server,browser;
const issues=[];
try {
  server=await createServer({root,configFile:false,logLevel:'error',assetsInclude:['**/*.glb'],
    cacheDir:'node_modules/.vite-arboleda-surfaces',server:{host:'127.0.0.1',port:0}});
  await server.listen();
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),
    headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();
  page.on('pageerror',e=>issues.push(e.message));
  await page.route('**/__surface_review.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Arboleda surfaces</title><body></body>'}));
  await page.goto(`${base}/__surface_review.html`);
  const result=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {catalog,loadLibraryAsset}=await import('/src/art/library.ts');
    const entries=catalog.assets.filter(a=>a.pack==='brumaluz-arboleda');
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(480,480); renderer.setPixelRatio(1);
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
    const scene=new THREE.Scene(); scene.background=new THREE.Color('#233d34');
    scene.add(new THREE.HemisphereLight('#fff2d0','#53776c',2.2));
    const sun=new THREE.DirectionalLight('#fff2cc',3.0); sun.position.set(-4,8,5);
    sun.castShadow=true; sun.shadow.normalBias=.025; sun.shadow.bias=-.0004;
    sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-10; sun.shadow.camera.right=10;
    sun.shadow.camera.top=10; sun.shadow.camera.bottom=-10; sun.shadow.camera.far=50;
    scene.add(sun);
    const holder=new THREE.Group(); scene.add(holder);
    const camera=new THREE.PerspectiveCamera(35,1,.05,900);
    const views=[{yaw:.55,elev:.63,distance:1.85,label:'Frente · juego'},
      {yaw:2.10,elev:.50,distance:1.85,label:'Perfil · editor'},
      {yaw:3.70,elev:.65,distance:1.85,label:'Reverso · juego'},
      {yaw:5.20,elev:.52,distance:3.0,label:'Lejos · editor'}];
    const groups=[['roofs',entries.filter(a=>/^house_|^laboratory_|^pavilion_|^tower_/.test(a.name))],
      ['joinery',entries.filter(a=>/^bridge_|^fence_|^bench_|^bed_/.test(a.name))]];
    const sheets=[]; const frames=[];
    for(const [group,assets] of groups) {
      const sheet=document.createElement('canvas'); sheet.width=1920; sheet.height=assets.length*518;
      const ctx=sheet.getContext('2d'); ctx.fillStyle='#233d34'; ctx.fillRect(0,0,sheet.width,sheet.height);
      for(let row=0;row<assets.length;row++) {
        const asset=assets[row]; const {gltf}=await loadLibraryAsset(asset.id);
        holder.clear(); holder.add(gltf.scene);
        holder.traverse(o=>{if(o.isMesh) o.castShadow=o.receiveShadow=true;});
        const bounds=new THREE.Box3().setFromObject(holder);
        const center=bounds.getCenter(new THREE.Vector3()); const size=bounds.getSize(new THREE.Vector3());
        const dimension=Math.max(size.x,size.y,size.z);
        for(let col=0;col<views.length;col++) {
          const view=views[col]; const distance=dimension*view.distance;
          camera.near=col%2===0?.05:.1; camera.far=col%2===0?900:4000;
          camera.position.copy(center).add(new THREE.Vector3(Math.sin(view.yaw)*Math.cos(view.elev),Math.sin(view.elev),Math.cos(view.yaw)*Math.cos(view.elev)).multiplyScalar(distance));
          camera.lookAt(center); camera.updateProjectionMatrix();
          renderer.render(scene,camera);
          ctx.drawImage(renderer.domElement,col*480,row*518);
          ctx.fillStyle='#f3e6bd'; ctx.font='16px sans-serif';
          ctx.fillText(`${asset.label} / ${view.label}`,col*480+12,row*518+504);
          const gl=renderer.getContext(); const error=gl.getError();
          if(error!==gl.NO_ERROR) throw new Error(`${asset.id}: WebGL ${error}`);
          frames.push({asset:asset.id,view:view.label,near:camera.near,far:camera.far});
        }
      }
      sheets.push({name:`${group}-orbit.png`,data:sheet.toDataURL('image/png').split(',')[1]});
    }
    renderer.dispose();
    return {sheets,frames};
  });
  for(const sheet of result.sheets) await writeFile(join(output,sheet.name),Buffer.from(sheet.data,'base64'));
  await writeFile(join(output,'surface-browser-review.json'),JSON.stringify({frames:result.frames,issues},null,2)+'\n');
  assert.equal(result.frames.length,32);
  assert.deepEqual(issues,[]);
  console.log(`Revisadas ${result.frames.length} vistas WebGL de tejados y uniones; sin errores del navegador.`);
} finally {
  await browser?.close(); await server?.close();
}
