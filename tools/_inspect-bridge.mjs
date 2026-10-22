import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const file of [
  'src/assets/library/medieval-builder/objects/bridge.glb',
  'src/assets/library/medieval-builder/objects/bridge_roofed.glb',
]) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  console.log('===', file, '===');
  console.log('EXT', JSON.stringify(root.listExtensionsUsed()), JSON.stringify(root.listExtensionsRequired()));
  console.log('NODES', root.listNodes().map(n => `${n.getName()}:${n.getMesh()?.getName() ?? '-'}`).join(', '));
  for (const mat of root.listMaterials()) {
    console.log('MAT', mat.getName(), 'base', mat.getBaseColorFactor(), 'tex', mat.getBaseColorTexture()?.getName(),
      'metal', mat.getMetallicFactor(), 'rough', mat.getRoughnessFactor());
  }
  for (const mesh of root.listMeshes()) {
    console.log('MESH', mesh.getName());
    for (const p of mesh.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const nrm = p.getAttribute('NORMAL');
      const uv = p.getAttribute('TEXCOORD_0');
      const arr = uv ? uv.getArray() : [];
      const us = [], vs = [];
      for (let i = 0; i < arr.length; i += 2) { us.push(arr[i]); vs.push(arr[i + 1]); }
      const uniq = new Set(us.map(v => v.toFixed(3))).size;
      const uniqV = new Set(vs.map(v => v.toFixed(3))).size;
      const pa = pos.getArray();
      let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      const na = nrm ? nrm.getArray() : null;
      const axis = [0, 0, 0];
      for (let i = 0; i < pa.length; i += 3) {
        for (let c = 0; c < 3; c++) { if (pa[i + c] < mn[c]) mn[c] = pa[i + c]; if (pa[i + c] > mx[c]) mx[c] = pa[i + c]; }
      }
      if (na) for (let i = 0; i < na.length; i += 3) {
        const ax = Math.abs(na[i]), ay = Math.abs(na[i + 1]), az = Math.abs(na[i + 2]);
        const d = ax > ay ? (ax > az ? 0 : 2) : (ay > az ? 1 : 2);
        axis[d]++;
      }
      console.log('  PRIM mat=', p.getMaterial()?.getName(), 'count=', pos?.getCount(), 'nrm=', !!nrm,
        'u=', Math.min(...us).toFixed(2), Math.max(...us).toFixed(2), 'uniqU=', uniq,
        'v=', Math.min(...vs).toFixed(2), Math.max(...vs).toFixed(2), 'uniqV=', uniqV,
        'bbox=', mn.map(v => v.toFixed(2)).join(','), '->', mx.map(v => v.toFixed(2)).join(','),
        'normalAxis=', axis.join('/'));
    }
  }
}
