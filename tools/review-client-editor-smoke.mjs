// Read-only visual check of the equipment editor after changing asset/cache lifetimes.
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({server:{host:'127.0.0.1',port:4294,strictPort:true,hmr:false,watch:null},logLevel:'error'});
let browser;const errors=[];
try{
 await server.listen();browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:850}});page.on('pageerror',error=>{errors.push(error.message);console.log('Editor error:',error.message);});
 await page.goto('http://127.0.0.1:4294/equipment.html',{waitUntil:'commit',timeout:120000});
 await page.waitForFunction(()=>document.querySelectorAll('#slots select').length===7,null,{timeout:120000});
 await page.locator('#class').selectOption('clerigo');await page.locator('#set').selectOption({index:2});
 const before=await page.locator('#stats').textContent();
 await page.getByRole('button',{name:'Vestir conjunto',exact:true}).click();
 if(await page.locator('#stats').textContent()===before)throw Error('The selected collection was not applied.');
 await page.locator('#skill').click();await page.waitForTimeout(500);
 await mkdir('art/performance-review/client',{recursive:true});
 await page.screenshot({path:'art/performance-review/client/equipment-editor.png',fullPage:true});
 const report={slotControls:await page.locator('#slots select').count(),stats:await page.locator('#stats').textContent(),errors};
 await writeFile('art/performance-review/client/editor.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(errors.length)process.exitCode=1;
}finally{await browser?.close();await server.close();}
