import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const a = JSON.parse(execFileSync('git', ['show', 'HEAD:src/assets/library/catalog.json'], { encoding: 'utf8', maxBuffer: 1e8 }));
const b = JSON.parse(readFileSync('src/assets/library/catalog.json', 'utf8'));
const ka = new Map(a.assets.map(x => [x.id, x]));
const kb = new Map(b.assets.map(x => [x.id, x]));
console.log('count', a.assets.length, '->', b.assets.length);
for (const [id, x] of kb) {
  const y = ka.get(id);
  if (!y) { console.log('ADDED', id); continue; }
  if (JSON.stringify(y) !== JSON.stringify(x)) console.log('CHANGED', id, 'bytes', y.bytes, '->', x.bytes, 'sha', y.sha256?.slice(0, 8), '->', x.sha256?.slice(0, 8));
}
for (const [id] of ka) if (!kb.has(id)) console.log('REMOVED', id);
