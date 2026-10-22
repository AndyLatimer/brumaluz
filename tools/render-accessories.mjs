import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:4194,strictPort:true,watch:{ignored:['**/*.zip','**/*.blend']}},logLevel:'error'});let browser;
try{
 await server.listen();browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1500,height:2400}});await page.goto('http://127.0.0.1:4194/render.html');
 await page.evaluate(async()=>{
  const {ACCESSORIES}=await import('/src/data/accessories.ts');const {itemIcon}=await import('/src/data/items.ts');
  document.body.innerHTML='<h1>BRUMALUZ · JOYAS Y ABALORIOS</h1><p>Colgantes · Anillos · Abalorios — Diez colecciones</p><main></main>';
  const style=document.createElement('style');style.textContent='body{margin:0;padding:25px;background:#e6ddca;color:#493d31;font:18px Georgia}h1,p{text-align:center}h1{margin:0 0 10px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.item{text-align:center;height:205px}.item svg{width:160px;height:160px;display:block;margin:auto}.item span{display:block;margin-top:6px}';document.head.append(style);
  for(const item of Object.values(ACCESSORIES)){const node=document.createElement('div');node.className='item';node.innerHTML=itemIcon(item.id)+'<span></span>';node.querySelector('span').textContent=item.label;document.querySelector('main').append(node)}
  await Promise.all([...document.querySelectorAll('image')].map(node=>new Promise(resolve=>{const img=new Image();img.onload=img.onerror=resolve;img.src=node.getAttribute('href')})));
 });
 await page.screenshot({path:'src/assets/models/items/accessories/accessories.png',fullPage:true});
 console.log('Rendered accessories.png');
}finally{await browser?.close();await server.close()}
