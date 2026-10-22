// Render both categories on the actual character rig, checking all attachment bones.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium } from 'playwright';
const base = 'http://127.0.0.1:4185';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4185', '--strictPort']);
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite timeout')), 15000);
    server.once('error', reject);
    server.stdout.on('data', data => { if (data.toString().includes('4185')) { clearTimeout(timeout); resolve(); } });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/render.html`);
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { Character, loadKits, characterKit } = await import('/src/character/character.ts');
    const { defaultChar } = await import('/src/data/data.ts');
    const { WEAPONS } = await import('/src/data/weapons.ts');
    const { emptyEquipment } = await import('/src/data/inventory.ts');
    const { STARTER_MODELS } = await import('/src/data/starterItems.ts');
    await loadKits();
    const canvas = document.createElement('canvas'); document.body.replaceChildren(canvas);
    document.body.style.cssText = 'margin:0;background:#d5d3cb;overflow:hidden';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(1600, 950); renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#d5d3cb');
    scene.add(new THREE.HemisphereLight('#fff4dc', '#6d7681', 2.4));
    const light = new THREE.DirectionalLight('#fff2d9', 3.2); light.position.set(-4, 8, 6); scene.add(light);
    const camera = new THREE.OrthographicCamera(-7.5, 7.5, 4.45, -4.45, .01, 100);
    camera.position.set(0, 7, 13); camera.lookAt(0, .7, 0);
    const classes = ['guerrero','mago','picaro','clerigo','explorador'];
    const attachments = [];
    for (const tier of [0, 1]) for (const [col, cls] of classes.entries()) {
      const equipment = emptyEquipment();
      for (const [id,w] of Object.entries(WEAPONS)) if (w.tier === tier && w.cls === cls) equipment[w.slot] = { id, count: 1 };
      const actor = new Character({ ...defaultChar(), cls, equipment }, { outfit: false });
      actor.root.position.set((col-2)*2.65, 0, tier === 1 ? 2.2 : -2.2);
      actor.root.rotation.y = -.18;
      scene.add(actor.root); actor.update(0); actor.update(.1); scene.updateMatrixWorld(true);
      if (tier === 1) for (const slot of ['weapon','offhand']) {
        const item = equipment[slot]; if (!item) continue;
        const object = actor.root.getObjectByName(item.id);
        const anchor=STARTER_MODELS[item.id];
        const expectedBone=characterKit(anchor.kit).scene.getObjectByName(anchor.node).parent.name;
        if (!object || object.parent.name !== expectedBone) throw new Error(`Bad attachment: ${item.id} (${object?.parent?.name})`);
        const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3());
        if (!Number.isFinite(size.length()) || size.length() <= .1 || size.length() > 2.5) throw new Error(`Bad weapon bounds: ${item.id}`);
        attachments.push({ id: item.id, bone: object.parent.name, size: size.toArray() });
      }
    }
    renderer.render(scene, camera);
    const caption = document.createElement('div');
    caption.style.cssText = 'position:absolute;top:28px;left:50px;right:50px;font:22px system-ui;color:#273c39;text-align:center';
    caption.innerHTML = '<b>BRUMALUZ · EQUIPO DE PRINCIPIANTE Y ARTESANO</b><div style="font-size:16px;margin-top:10px">Fila superior: categoría 0 · Fila inferior: categoría 1</div><div style="display:flex;justify-content:space-around;margin-top:28px"><span>Guerrero</span><span>Mago</span><span>Pícaro</span><span>Clérigo</span><span>Explorador</span></div>';
    document.body.append(caption);
    return attachments;
  });
  await page.screenshot({ path: 'src/assets/models/items/tier1/tier1_characters.png' });
  await page.setViewportSize({width:2100,height:1050});
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { loadGLB } = await import('/src/world/load.ts');
    const items = [
      ['Espada','sword_1handed','espada_cobre_t1'],['Escudo','shield_badge','escudo_roble_t1'],
      ['Bastón','staff','baston_ambar_t1'],['Daga','dagger','daga_cazador_t1'],
      ['Varita','wand','varita_ambar_t1'],['Grimorio','spellbook_closed','grimorio_verde_t1'],
      ['Ballesta','crossbow_1handed','ballesta_roble_t1'],
    ];
    const canvas = document.createElement('canvas'); document.body.replaceChildren(canvas);
    const renderer = new THREE.WebGLRenderer({canvas,antialias:true});renderer.setSize(2100,1050);
    const scene = new THREE.Scene();scene.background = new THREE.Color('#e4e3dc');
    scene.add(new THREE.HemisphereLight('#fff5e7','#718087',2.0));
    const key = new THREE.DirectionalLight('#fff6e9',2.3);key.position.set(-4,7,9);scene.add(key);
    const camera = new THREE.OrthographicCamera(-8,8,4,-4,.01,100);camera.position.set(0,0,15);camera.lookAt(0,0,0);
    for(const [column,[label,source,id]] of items.entries())for(const tier of [0,1]){
      const src = tier === 0 ? `/src/assets/library/adventurers/objects/${source}.glb` : `/src/assets/models/items/tier1/${id}.glb`;
      const {scene:object} = await loadGLB(src);
      object.rotation.y=.25;
      if(source==='spellbook_closed')object.rotation.y=-Math.PI/2+.25;
      if(source==='crossbow_1handed')object.rotation.x=-Math.PI/3;
      object.updateMatrixWorld(true);
      let bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
      object.scale.setScalar(2.10/Math.max(size.x,size.y,size.z));object.updateMatrixWorld(true);
      bounds=new THREE.Box3().setFromObject(object);
      const center=bounds.getCenter(new THREE.Vector3());
      object.position.copy(center.negate()).add(new THREE.Vector3((column-3)*2.15,tier===0?1.2:-1.65,0));
      scene.add(object);
    }
    renderer.render(scene,camera);
    const caption = document.createElement('div');
    caption.style.cssText='position:absolute;inset:0;color:#35453e;font:20px system-ui;pointer-events:none';
    caption.innerHTML='<div style="position:absolute;top:28px;width:100%;text-align:center;font-size:27px;font-weight:650">ADVENTURERS → BRUMALUZ · PRIMERA MEJORA</div><div style="display:flex;justify-content:space-around;position:absolute;top:105px;left:65px;right:65px">'+items.map(([label])=>`<span style="width:240px;text-align:center">${label}</span>`).join('')+'</div><div style="position:absolute;top:175px;left:26px;font-size:16px">CAT. 0</div><div style="position:absolute;top:575px;left:26px;font-size:16px">CAT. 1</div><div style="position:absolute;bottom:20px;width:100%;text-align:center;font-size:16px">Mismas siluetas y proporciones · Refuerzos, costuras y acabados sencillos · KayKit Adventurers, Kay Lousberg (CC0)</div>';
    document.body.append(caption);
  });
  await page.screenshot({path:'src/assets/models/items/tier1/tier1_reference_comparison.png'});
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
}
