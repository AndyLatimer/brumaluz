import { readFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';

const file = process.argv[2];
if (!file) {
  console.error('usage: node dump-gltf.mjs <path.glb>');
  process.exit(1);
}
const document = await new NodeIO().read(file);
console.log('=== FILE:', file, '===');
console.log(JSON.stringify(document, null, 2));

