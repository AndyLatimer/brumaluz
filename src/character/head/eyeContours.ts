import * as THREE from 'three';

// Independent upper/lower lids: an almond, a drooping eye and a round eye
// must differ in contour, rather than just stretching the same sphere.
export const EYE_CONTOURS = [
  { upper: .55, lower: .55, top: 1, bottom: 1, skew: 0, pupil: .50 },
  { upper: .46, lower: .52, top: 1, bottom: 1, skew: -.08, pupil: .60 },
  { upper: .65, lower: .72, top: .88, bottom: .80, skew: 0, pupil: .42 },
  { upper: .90, lower: 1.10, top: .86, bottom: .72, skew: .22, pupil: .42 },
  { upper: .45, lower: .75, top: 1, bottom: .86, skew: -.30, pupil: .60 },
  { upper: .26, lower: .55, top: .18, bottom: .92, skew: -.08, pupil: .48 },
  { upper: .50, lower: .50, top: 1, bottom: 1, skew: 0, pupil: .42 },
  { upper: .28, lower: .82, top: .52, bottom: .85, skew: .08, pupil: .40 },
  { upper: 1.20, lower: .80, top: .68, bottom: .65, skew: .38, pupil: .35 },
  { upper: .85, lower: .85, top: 1, bottom: .88, skew: .08, pupil: .52 },
  { upper: .42, lower: .68, top: 1, bottom: .93, skew: -.15, pupil: .46 },
  { upper: .38, lower: .90, top: .46, bottom: .78, skew: 0, pupil: .56 },
  { upper: .58, lower: .62, top: 1, bottom: .82, skew: .28, pupil: .56 },
] as const;

export function eyeBounds(id: number, x: number) {
  const p = EYE_CONTOURS[id] ?? EYE_CONTOURS[0];
  const arch = Math.max(0, 1 - x * x);
  return {
    top: arch ** p.upper * p.top * (1 + p.skew * x),
    bottom: -(arch ** p.lower) * p.bottom * (1 - p.skew * x * .4),
  };
}

/** Curved coloured patch, clipped to the eyelids before projection onto skin. */
export function eyePatch(id: number, rx: number, ry: number, side: number,
  ellipse?: { rx: number; ry: number; x: number; y: number }) {
  const positions: number[] = [], indices: number[] = [];
  const columns = 32, rows = 12;
  for (let i = 0; i <= columns; i++) {
    const u = i / columns * 2 - 1;
    const x = ellipse ? THREE.MathUtils.clamp(ellipse.x + u * ellipse.rx, -rx, rx) : u * rx;
    const bounds = eyeBounds(id, x / rx * side);
    const radius = Math.sqrt(Math.max(0, 1 - u * u));
    const low = ellipse ? Math.max(bounds.bottom * ry, ellipse.y - radius * ellipse.ry) : bounds.bottom * ry;
    const high = ellipse ? Math.min(bounds.top * ry, ellipse.y + radius * ellipse.ry) : bounds.top * ry;
    for (let j = 0; j <= rows; j++) {
      const y = low <= high ? THREE.MathUtils.lerp(low, high, j / rows)
        : THREE.MathUtils.clamp(ellipse!.y, bounds.bottom * ry, bounds.top * ry);
      positions.push(x, y, .003 * Math.max(0, 1 - (x / rx) ** 2));
      if (i < columns && j < rows) {
        const a = i * (rows + 1) + j, b = a + rows + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
