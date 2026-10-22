import { readFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const re = /data:model\/gltf-binary;base64,([A-Za-z0-9+/=]+)/g;
let match, index = 0;
while ((match = re.exec(html))) {
  const bytes = Buffer.from(match[1], 'base64');
  const text = bytes.toString('latin1');
  const names = [...text.matchAll(/"name":"([^"]{2,60})"/g)].map(m => m[1]).slice(0, 4);
  console.log(index, (bytes.length / 1e6).toFixed(2) + 'MB', names.join(' | '));
  index += 1;
}
console.log('total html', Buffer.byteLength(html));
