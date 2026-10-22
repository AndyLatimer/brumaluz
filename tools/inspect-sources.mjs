import { readFileSync } from 'node:fs';
const json = JSON.parse(readFileSync('x:/projects/brumaluz/src/assets/library/sources.json', 'utf8'));
console.log('TOP KEYS:', Object.keys(json));
if (Array.isArray(json.files)) {
  console.log('files count:', json.files.length);
  console.log('first file:', JSON.stringify(json.files[0]));
} else {
  console.log(JSON.stringify(json, null, 2).slice(0, 2000));
}
