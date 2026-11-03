import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

/** Initial executable source for both hosted builds and legacy standalone HTML. */
export function readBuildSource(directory='dist'){
 const root=resolve(directory),html=readFileSync(resolve(root,'index.html'),'utf8');
 const manifestPath=resolve(root,'.vite/manifest.json');
 if(!existsSync(manifestPath))return html;
 const manifest=JSON.parse(readFileSync(manifestPath,'utf8')),seen=new Set(),chunks=[];
 const visit=key=>{if(seen.has(key))return;seen.add(key);const entry=manifest[key];if(!entry)return;
  if(entry.file.endsWith('.js')&&existsSync(resolve(root,entry.file)))chunks.push(readFileSync(resolve(root,entry.file),'utf8'));
  for(const dependency of entry.imports??[])visit(dependency);
 };
 for(const [key,entry]of Object.entries(manifest))if(entry.isEntry)visit(key);
 return html+'\n'+chunks.join('\n');
}
