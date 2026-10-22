import { NodeIO } from '@gltf-transform/core';

const io = new NodeIO();
const doc = await io.read('src/assets/library/medieval-builder/objects/bridge_roofed.glb');
const root = doc.getRoot();

for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial().getName();
    if (name !== 'Brown' && name !== 'BrownDark') continue;
    const pos = prim.getAttribute('POSITION').getArray();
    const idx = prim.getIndices().getArray();
    const triCount = idx.length / 3;
    const parent = new Array(triCount);
    const find = t => { while (parent[t] !== t) { parent[t] = parent[parent[t]]; t = parent[t]; } return t; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    const edges = new Map();
    for (let t = 0; t < triCount; t++) {
      const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
      for (let a = 0; a < 3; a++) {
        const key = v[a] < v[(a + 1) % 3] ? `${v[a]}_${v[(a + 1) % 3]}` : `${v[(a + 1) % 3]}_${v[a]}`;
        if (edges.has(key)) union(t, edges.get(key)); else edges.set(key, t);
      }
    }
    const rows = [];
    for (let t = 0; t < triCount; t++) {
      const i = idx[t * 3], j = idx[t * 3 + 1], k = idx[t * 3 + 2];
      const ax = pos[j * 3] - pos[i * 3], ay = pos[j * 3 + 1] - pos[i * 3 + 1], az = pos[j * 3 + 2] - pos[i * 3 + 2];
      const bx = pos[k * 3] - pos[i * 3], by = pos[k * 3 + 1] - pos[i * 3 + 1], bz = pos[k * 3 + 2] - pos[i * 3 + 2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz) || 1;
      const cy = (pos[i * 3 + 1] + pos[j * 3 + 1] + pos[k * 3 + 1]) / 3;
      const cx = (pos[i * 3] + pos[j * 3] + pos[k * 3]) / 3;
      rows.push({ ny: Math.abs(ny / len), area: len / 2, cy, cx, nx: nx / len, nz: nz / len });
    }
    for (const th of [0.5]) {
      const groups = { roof: [], wood: [] };
      for (const r of rows) groups[r.ny >= th ? 'roof' : 'wood'].push(r);
      for (const [key, list] of Object.entries(groups)) {
        let ax = 0, az = 0, up = 0, side = 0;
        for (const r of list) {
          const nx = r.nx, nz = r.nz;
          if (Math.abs(nx) > Math.abs(nz)) ax++; else az++;
          if (r.ny > 0) up++; else side++;
        }
        console.log(`--- ${key} (th=${th}) tris=${list.length}`);
        console.log(`   eje dominante |nx|>|nz|: ${ax}   |nz|>=|nx|: ${az}`);
        console.log(`   ny>0: ${up}   ny<=0: ${side}`);
        const ys = list.map(r => r.cy).sort((a, b) => a - b);
        console.log(`   y deciles: ${ys.filter((_, i) => i % Math.ceil(ys.length / 8) === 0).map(v => v.toFixed(2)).join(' ')}`);
      }
    }
  }
}
