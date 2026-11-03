import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'src', 'assets', 'library');
const pack = 'brumaluz-lagto';
const manifest = JSON.parse(await readFile(join(root, 'art', 'lagto', 'manifest.json'), 'utf8'));
manifest.version=2;
manifest.textures=['textures/lagto-atlas.png','textures/lagto-orm.png','textures/lagto-normal.png','textures/lagto-emissive.png'];
manifest.description="Cantería, cobre trabajado, cedro, cuero y lana de las Cumbres de Cobre del pueblo Lagto'. Cincuenta modelos con superficies PBR, texturas CC0 y geometría revisada. Powered by Poly Haven.";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const assets = [];
const names = new Set();

for (const entry of manifest.assets) {
  const { name, label, category, description } = entry;
  if (!/^[a-z][a-z0-9_]*$/.test(name) || names.has(name)) {
    throw new Error(`Nombre inválido o duplicado: ${name}`);
  }
  names.add(name);
  const id = `${pack}/objects/${name}`;
  const path = `${id}.glb`;
  const document=await io.read(join(directory,path)),gltf=document.getRoot();
  gltf.setExtras({...gltf.getExtras(),pack,materialsVersion:2});
  for(const material of gltf.listMaterials())for(const info of [material.getBaseColorTextureInfo(),material.getMetallicRoughnessTextureInfo(),material.getNormalTextureInfo(),material.getEmissiveTextureInfo()]){
    if(info)info.setMinFilter(9987).setMagFilter(9729).setWrapS(33071).setWrapT(33071);
  }
  let removed=0;
  for(const mesh of gltf.listMeshes())for(const primitive of mesh.listPrimitives()){
    const position=primitive.getAttribute('POSITION'),indices=primitive.getIndices();if(!indices)continue;
    const values=indices.getArray(),coords=position.getArray(),keep=[],seen=new Set();
    for(let i=0;i<values.length;i+=3){
      const points=[0,1,2].map(j=>Array.from(coords.subarray(values[i+j]*3,values[i+j]*3+3)));
      const [a,b,c]=points,u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);
      const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
      const key=points.map(p=>p.map(n=>Math.round(n*1e7)).join(',')).sort().join('|');
      if(area<1e-9||seen.has(key)){removed++;continue;}seen.add(key);keep.push(values[i],values[i+1],values[i+2]);
    }
    if(keep.length!==values.length)indices.setArray(new values.constructor(keep));
  }
  const bytes=Buffer.from(await io.writeBinary(document));
  await writeFile(join(directory,path),bytes);await writeFile(join(root,'art','lagto','objects',`${name}.glb`),bytes);
  const bounds = getBounds(gltf.listScenes()[0]);

  if (![...bounds.min, ...bounds.max].every(Number.isFinite) || Math.abs(bounds.min[1]) > 0.025) {
    throw new Error(`Origen o límites incorrectos: ${name} (min y: ${bounds.min[1]})`);
  }

  const triangles = gltf.listMeshes().flatMap(m => m.listPrimitives()).reduce(
    (n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0) / 3,
    0
  );

  if (gltf.listMeshes().length !== 1 || gltf.listMaterials().length !== 1 || !gltf.listTextures().length) {
    throw new Error(`Exportación sin atlas unificado: ${name}`);
  }

  assets.push({
    id,
    pack,
    kind: 'objects',
    name,
    label,
    category,
    description: description ?? '',
    path,
    source: `art/lagto/brumaluz-lagto.blend#${name}`,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    meshes: 1,
    skins: 0,
    rig: null,
    animations: [],
    bounds,
    triangles,
    materials: 1,
    removedDegenerateOrDuplicateTriangles:removed,
  });
}

await writeFile(
  join(directory, pack, 'catalog.json'),
  JSON.stringify(
    {
      version: 2,
      packs: [
        {
          id: pack,
          label: manifest.title,
          author: manifest.author ?? 'Brumaluz',
          description: manifest.description,
          count: assets.length,
          source: 'art/lagto/brumaluz-lagto.blend',
          license: null,
        },
      ],
      assets,
    },
    null,
    2
  ) + '\n'
);
await writeFile(join(root,'art','lagto','manifest.json'),JSON.stringify(manifest,null,2)+'\n');

console.log(`Cumbres de Cobre (Lagto'): ${assets.length} modelos registrados con éxito (${(assets.reduce((n, a) => n + a.bytes, 0) / 1024 / 1024).toFixed(2)} MB).`);

