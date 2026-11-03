import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv.includes('--baseline')?'baseline':'optimized';
const server=await createServer({configFile:false,logLevel:'error',server:{middlewareMode:true,hmr:false,watch:null}});
try{
 await server.ssrLoadModule('/src/data/data.ts');
 const {professionInteractions}=await server.ssrLoadModule('/src/world/professionWorld.ts');
 const {RPG_CATALOG,professionState}=await server.ssrLoadModule('/src/data/professions.ts');
 const first=Object.values(RPG_CATALOG.nodes).find(node=>node.location==='pompelin');
 let heightCalls=0;const city={locationId:'pompelin',groundY:()=>{heightCalls++;return 0;}};
 const state=professionState(undefined),near={x:first.x,z:first.z};
 let candidates=0;const began=performance.now();
 for(let i=0;i<1000;i++)candidates+=professionInteractions(city,state,near).length;
 const report={label,queries:1000,ms:performance.now()-began,heightCalls,candidates,totalResources:Object.values(RPG_CATALOG.nodes).filter(n=>n.location==='pompelin').length};
 await mkdir('art/performance-review/interactions',{recursive:true});
 await writeFile(`art/performance-review/interactions/${label}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
