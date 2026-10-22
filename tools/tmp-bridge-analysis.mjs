import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
const dir = 'src/assets/library/medieval-builder/objects/';

function analyse(file) {
  const doc = io.read(dir + file);
  return doc;
}

for (const f of ['bridge.glb', 'bridge_roofed.glb']) {
  const doc = await io.read(dir + f);
  const root = doc.getRoot();
  console.log('===', f);
  for (const me of root.listMeshes()) {
    for (const p of me.listPrimitives()) {
      const pos = p.getAttribute('POSITION').getArray();
      const nrm = p.getAttribute('NORMAL').getArray();
      const idx = p.getIndices().getArray();
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], pos[i + k]); mx[k] = Math.max(mx[k], pos[i + k]);
      }
      //顶点 shared por triángulos con eje dominante distinto
      const vertAxis = [];
      for (let i = 0; i < nrm.length; i += 3) {
        const ax = Math.abs(nrm[i]), ay = Math.abs(nrm[i + 1]), az = Math.abs(nrm[i + 2]);
        vertAxis.push(ax > ay && ax > az ? 'X' : ay > az ? 'Y' : 'Z');
      }
      const triAxis = [];
      for (let t = 0; t < idx.length / 3; t++) {
        const i = idx[t * 3], j = idx[t * 3 + 1], k = idx[t * 3 + 2];
        const ax = pos[j * 3] - pos[i * 3], ay = pos[j * 3 + 1] - pos[i * 3 + 1], az = pos[j * 3 + 2] - pos[i * 3 + 2];
        const bx = pos[k * 3] - pos[i * 3], by = pos[k * 3 + 1] - pos[i * 3 + 1], bz = pos[k * 3 + 2] - pos[i * 3 + 2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const a = Math.abs(nx), b = Math.abs(ny), c = Math.abs(nz);
        triAxis.push(a > b && a > c ? 'X' : b > c ? 'Y' : 'Z');
      }
      // vertices whose own normal axis differs from some incident triangle axis
      const incident = new Map();
      for (let t = 0; t < idx.length / 3; t++) {
        for (const v of [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]) {
          if (!incident.has(v)) incident.set(v, new Set());
          incident.get(v).add(triAxis[t]);
        }
      }
      let mismatched = 0, mixedIncident = 0;
      for (const [v, axes] of incident) {
        if (axes.size > 1) mixedIncident++;
        for (const ax of axes) if (ax !== vertAxis[v]) { mismatched++; break; }
      }
      // distribution of vertex normal axis
      const dist = { X: 0, Y: 0, Z: 0 };
      for (const a of vertAxis) dist[a]++;
      console.log(`  ${p.getMaterial().getName()} bounds min(${mn.map(v => v.toFixed(3))}) max(${mx.map(v => v.toFixed(3))}) verts=${pos.length / 3} tris=${idx.length / 3}`);
      console.log(`    vertAxis=${JSON.stringify(dist)} mixedIncidentVerts=${mixedIncident} axisMismatchVerts=${mismatched}`);
    }
  }
}
