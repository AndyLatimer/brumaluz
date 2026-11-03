import {readdirSync,statSync} from 'node:fs';
import {readBuildSource} from '../scripts/build-output.mjs';

const html = readBuildSource();
const re = /data:model\/gltf-binary;base64,([A-Za-z0-9+/=]+)/g;
let match, index = 0;
while ((match = re.exec(html))) {
  const bytes = Buffer.from(match[1], 'base64');
  const text = bytes.toString('latin1');
  const names = [...text.matchAll(/"name":"([^"]{2,60})"/g)].map(m => m[1]).slice(0, 4);
  console.log(index, (bytes.length / 1e6).toFixed(2) + 'MB', names.join(' | '));
  index += 1;
}
const external=readdirSync('dist/assets',{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.glb')).map(entry=>({name:entry.name,bytes:statSync(`dist/assets/${entry.name}`).size}));
console.log('Initial HTML + executable JS bytes', Buffer.byteLength(html));
console.log('External GLBs (downloaded only when requested)',external.length);
