import * as THREE from 'three';

type ShadowEnemyAction = 'idle' | 'prepare' | 'attack' | 'hit' | 'death';

interface ShadowEnemyRig {
  model: THREE.Group;
  cloak: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  tendrils: THREE.Group[];
  eyes: THREE.Mesh[];
  eyeGlows: THREE.Mesh[];
  eyeMaterials: THREE.MeshStandardMaterial[];
  flashMaterials: THREE.MeshStandardMaterial[];
  ring: THREE.Mesh;
  groundShadow: THREE.Mesh;
  chestSigil: THREE.Mesh;
  waistCharm: THREE.Mesh;
  aura: THREE.Mesh;
  auraMaterial: THREE.ShaderMaterial;
  shadowRibbons: THREE.Mesh[];
  deathPuff: THREE.Mesh[];
  deathPuffRing: THREE.Mesh;
  impactRing: THREE.Mesh;
  attackSlashes: THREE.Mesh[];
  motes: THREE.Mesh[];
  action: ShadowEnemyAction;
  actionStarted: number;
  actionDuration: number;
  hitStarted: number;
}

const purple = new THREE.Color('#a45aff');

function addMesh<T extends THREE.BufferGeometry>(
  parent: THREE.Object3D,
  geometry: T,
  material: THREE.Material,
  position: THREE.Vector3,
  scale?: THREE.Vector3,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  if (scale) mesh.scale.copy(scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeShadowMaterial(color: string, emissive = '#211532', intensity = 0.32) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0.04, emissive, emissiveIntensity: intensity });
}

function addTube(parent: THREE.Object3D, points: THREE.Vector3[], radius: number, material: THREE.Material, segments = 20) {
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 7, false), material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeTendril(material: THREE.Material, length: number, radius: number) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.ConeGeometry(radius, length, 9, 3), material);
  core.position.y = -length * 0.42;
  core.rotation.z = Math.PI;
  core.castShadow = true;
  group.add(core);
  const wisp = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.72, 10, 8), material);
  wisp.position.set(radius * 0.55, -length * 0.7, -radius * 0.15);
  wisp.scale.set(0.72, 1.1, 0.8);
  group.add(wisp);
  return group;
}

export function buildShadowEnemy(x: number, z: number, groundY: number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'combat-enemy';

  const bodyMaterial = makeShadowMaterial('#171522', '#372052', 0.5);
  const hoodMaterial = makeShadowMaterial('#242033', '#38204e', 0.44);
  const limbMaterial = makeShadowMaterial('#191724', '#30203f', 0.38);
  const accentMaterial = makeShadowMaterial('#38234d', '#6f3e9c', 0.9);
  const trimMaterial = new THREE.MeshStandardMaterial({ color: '#75668f', roughness: 0.42, metalness: 0.58, emissive: '#42265e', emissiveIntensity: 0.4 });
  const violetMetal = new THREE.MeshStandardMaterial({ color: '#54356f', roughness: 0.35, metalness: 0.66, emissive: '#512678', emissiveIntensity: 0.85 });
  const maskMaterial = new THREE.MeshStandardMaterial({ color: '#090910', roughness: 0.72, metalness: 0.08 });
  const flashMaterials = [bodyMaterial, hoodMaterial, limbMaterial, accentMaterial, trimMaterial, violetMetal];
  for (const material of flashMaterials) {
    material.userData.baseEmissive = material.emissive.clone();
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  }

  const groundShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.67, 36),
    new THREE.MeshBasicMaterial({ color: '#160e22', transparent: true, opacity: 0.45, depthWrite: false }),
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = 0.035;
  root.add(groundShadow);

  const deathPuff: THREE.Mesh[] = [];
  const puffGeometry = new THREE.SphereGeometry(1, 16, 12);
  const puffColors = ['#8e45d2', '#ba7aff', '#642b98'];
  for (let index = 0; index < 8; index++) {
    const puff = new THREE.Mesh(puffGeometry, new THREE.MeshBasicMaterial({
      color: puffColors[index % puffColors.length], transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    puff.castShadow = false;
    puff.visible = false;
    root.add(puff);
    deathPuff.push(puff);
  }
  const deathPuffRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 36), new THREE.MeshBasicMaterial({
    color: '#bd82ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  deathPuffRing.rotation.x = -Math.PI / 2;
  deathPuffRing.position.y = 0.11;
  deathPuffRing.visible = false;
  deathPuffRing.castShadow = false;
  root.add(deathPuffRing);

  const model = new THREE.Group();
  model.name = 'shadow-enemy-model';
  model.position.y = 0.12;
  root.add(model);

  const cloak = new THREE.Group();
  model.add(cloak);
  const cloakShape = new THREE.LatheGeometry([
    new THREE.Vector2(0.035, 0.025), new THREE.Vector2(0.12, 0.065), new THREE.Vector2(0.22, 0.14),
    new THREE.Vector2(0.31, 0.29), new THREE.Vector2(0.37, 0.48), new THREE.Vector2(0.39, 0.65),
    new THREE.Vector2(0.36, 0.82), new THREE.Vector2(0.31, 0.96), new THREE.Vector2(0.24, 1.08),
    new THREE.Vector2(0.15, 1.15), new THREE.Vector2(0.055, 1.19), new THREE.Vector2(0.008, 1.2),
  ], 40);
  const cloakMesh = addMesh(cloak, cloakShape, bodyMaterial, new THREE.Vector3(0, 0, 0));
  cloakMesh.scale.set(1, 1, 0.87);

  const head = new THREE.Group();
  head.position.y = 1.28;
  cloak.add(head);
  // La capucha da una silueta clara incluso desde lejos; el rostro queda casi oculto en sombra.
  addMesh(head, new THREE.SphereGeometry(0.52, 32, 24), hoodMaterial,
    new THREE.Vector3(0, 0, 0.015), new THREE.Vector3(1, 0.93, 0.88));
  addMesh(head, new THREE.SphereGeometry(0.335, 24, 18), maskMaterial,
    new THREE.Vector3(0, -0.03, 0.43), new THREE.Vector3(1, 0.7, 0.25));

  // Borde metálico de la capucha y cuello en capas, para que el rostro tenga profundidad.
  const hoodRim = addMesh(head, new THREE.TorusGeometry(0.39, 0.022, 8, 48), trimMaterial,
    new THREE.Vector3(0, 0.01, 0.37), new THREE.Vector3(1, 1.06, 0.56));
  hoodRim.rotation.z = Math.PI / 2;
  const cowl = addMesh(cloak, new THREE.TorusGeometry(0.32, 0.052, 9, 36), violetMetal,
    new THREE.Vector3(0, 1.01, 0.02));
  cowl.rotation.x = Math.PI / 2;
  cowl.scale.set(1.08, 0.76, 1);
  for (const side of [-1, 1]) {
    const pauldron = addMesh(cloak, new THREE.SphereGeometry(0.2, 16, 12), hoodMaterial,
      new THREE.Vector3(side * 0.36, 0.92, 0.015), new THREE.Vector3(1.12, 0.64, 0.92));
    pauldron.rotation.z = side * 0.18;
    const pauldronRim = addMesh(cloak, new THREE.TorusGeometry(0.17, 0.012, 6, 28), trimMaterial,
      new THREE.Vector3(side * 0.37, 0.91, 0.2), new THREE.Vector3(1.1, 0.62, 0.55));
    pauldronRim.rotation.z = Math.PI / 2;
  }

  // Dos puntas curvadas de humo coronan la capucha.
  for (const side of [-1, 1]) {
    const crest = addMesh(head, new THREE.ConeGeometry(0.13, 0.48, 10, 2), hoodMaterial,
      new THREE.Vector3(side * 0.34, 0.4, -0.01), new THREE.Vector3(0.82, 1, 0.78));
    crest.rotation.z = side * -0.42;
    crest.rotation.x = -0.18;
    const crestBand = addMesh(head, new THREE.TorusGeometry(0.088, 0.012, 6, 20), trimMaterial,
      new THREE.Vector3(side * 0.34, 0.25, 0.035));
    crestBand.rotation.x = Math.PI / 2;
  }
  const browMark = addMesh(head, new THREE.OctahedronGeometry(0.065, 1), violetMetal,
    new THREE.Vector3(0, 0.23, 0.49), new THREE.Vector3(0.82, 1.1, 0.45));
  browMark.rotation.z = Math.PI / 4;

  const eyes: THREE.Mesh[] = [];
  const eyeGlows: THREE.Mesh[] = [];
  const eyeMaterials: THREE.MeshStandardMaterial[] = [];
  for (const side of [-1, 1]) {
    const socket = addMesh(head, new THREE.SphereGeometry(0.115, 20, 16), maskMaterial,
      new THREE.Vector3(side * 0.158, 0.01, 0.593), new THREE.Vector3(1.12, 1.2, 0.5));
    socket.rotation.z = side * -0.15;
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: '#dcbcff', emissive: '#9c3fff', emissiveIntensity: 2.25,
      roughness: 0.2, metalness: 0.02,
    });
    const eyeGlow = addMesh(head, new THREE.SphereGeometry(0.14, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#9c3fff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
      new THREE.Vector3(side * 0.158, 0.01, 0.585), new THREE.Vector3(0.92, 1.12, 0.22));
    eyeGlow.castShadow = false;
    eyeGlows.push(eyeGlow);
    const eye = addMesh(head, new THREE.SphereGeometry(0.085, 20, 16), eyeMaterial,
      new THREE.Vector3(side * 0.158, 0.01, 0.63), new THREE.Vector3(0.83, 1.18, 0.43));
    eye.rotation.z = side * -0.16;
    eyes.push(eye);
    eyeMaterials.push(eyeMaterial);
    const pupil = addMesh(head, new THREE.SphereGeometry(0.033, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#2e1051' }),
      new THREE.Vector3(side * 0.158, 0.008, 0.667), new THREE.Vector3(0.55, 1.25, 0.4));
    pupil.castShadow = false;
    const glint = addMesh(head, new THREE.SphereGeometry(0.023, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#fff0ff' }),
      new THREE.Vector3(side * 0.158 - 0.018, 0.047, 0.684), new THREE.Vector3(1, 1.2, 0.55));
    glint.castShadow = false;
    const lowerLid = addTube(head, [
      new THREE.Vector3(side * 0.245, -0.06, 0.61),
      new THREE.Vector3(side * 0.16, -0.11, 0.625),
      new THREE.Vector3(side * 0.075, -0.06, 0.61),
    ], 0.012, violetMetal, 10);
    lowerLid.castShadow = false;
  }
  const waistBand = addMesh(cloak, new THREE.TorusGeometry(0.255, 0.027, 7, 40), violetMetal,
    new THREE.Vector3(0, 0.46, -0.005), new THREE.Vector3(1.25, 1.25, 1));
  waistBand.rotation.x = Math.PI / 2;
  addTube(cloak, [
    new THREE.Vector3(-0.2, 0.67, 0.31), new THREE.Vector3(-0.06, 0.57, 0.36),
    new THREE.Vector3(0.1, 0.47, 0.33), new THREE.Vector3(0.2, 0.36, 0.27),
  ], 0.025, trimMaterial, 16);
  const waistCharm = addMesh(cloak, new THREE.OctahedronGeometry(0.075, 1), accentMaterial,
    new THREE.Vector3(0.23, 0.46, 0.34), new THREE.Vector3(0.78, 1.25, 0.5));
  waistCharm.rotation.z = Math.PI / 4;

  const brow = addTube(head, [
    new THREE.Vector3(-0.29, 0.15, 0.56), new THREE.Vector3(-0.16, 0.19, 0.59),
    new THREE.Vector3(0, 0.15, 0.6), new THREE.Vector3(0.16, 0.19, 0.59), new THREE.Vector3(0.29, 0.15, 0.56),
  ], 0.026, hoodMaterial, 24);
  brow.castShadow = true;

  // Un sello tallado en el pecho y sus costuras finas capturan el resplandor violeta.
  const chestSigil = addMesh(cloak, new THREE.IcosahedronGeometry(0.13, 1), violetMetal,
    new THREE.Vector3(0, 0.77, 0.371), new THREE.Vector3(0.72, 1.12, 0.56));
  chestSigil.rotation.z = Math.PI / 4;
  const impactRing = addMesh(cloak, new THREE.TorusGeometry(0.17, 0.016, 7, 28),
    new THREE.MeshBasicMaterial({ color: '#d4a8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.Vector3(0, 0.77, 0.48));
  impactRing.castShadow = false;
  const attackSlashes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const slash = addTube(cloak, [
      new THREE.Vector3(side * 0.58, 1.04, 0.43),
      new THREE.Vector3(side * 0.34, 1.22, 0.61),
      new THREE.Vector3(side * -0.05, 1.31, 0.69),
      new THREE.Vector3(-side * 0.48, 1.17, 0.55),
    ], 0.025, new THREE.MeshBasicMaterial({ color: side > 0 ? '#dbb7ff' : '#8b46ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 24);
    slash.visible = false;
    slash.castShadow = false;
    attackSlashes.push(slash);
  }
  for (const side of [-1, 1]) {
    addTube(cloak, [
      new THREE.Vector3(0, 0.9, 0.365),
      new THREE.Vector3(side * 0.11, 0.73, 0.365),
      new THREE.Vector3(side * 0.2, 0.48, 0.31),
      new THREE.Vector3(side * 0.17, 0.25, 0.245),
    ], 0.009, trimMaterial, 18);
  }

  // Una envoltura de humo oscuro palpita alrededor del cuerpo y se rasga con el movimiento.
  const auraMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAttack: { value: 0 }, uHit: { value: 0 }, uDeath: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      void main() {
        vLocal = position;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uAttack;
      uniform float uHit;
      uniform float uDeath;
      varying vec3 vLocal;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;
      float hash31(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise3(vec3 p) {
        vec3 cell = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash31(cell), hash31(cell + vec3(1.0,0.0,0.0)), f.x),
                       mix(hash31(cell + vec3(0.0,1.0,0.0)), hash31(cell + vec3(1.0,1.0,0.0)), f.x), f.y),
                   mix(mix(hash31(cell + vec3(0.0,0.0,1.0)), hash31(cell + vec3(1.0,0.0,1.0)), f.x),
                       mix(hash31(cell + vec3(0.0,1.0,1.0)), hash31(cell + vec3(1.0,1.0,1.0)), f.x), f.y), f.z);
      }
      float smoke(vec3 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 2; octave++) {
          value += noise3(p) * amplitude;
          p *= 2.03;
          amplitude *= 0.5;
        }
        return value;
      }
      void main() {
        vec3 drift = vec3(uTime * 0.12, -uTime * 0.27, uTime * 0.08);
        float cloud = smoke(vLocal * 3.2 + drift);
        float tornEdge = smoothstep(0.28, 0.78, cloud + sin(vLocal.y * 7.0 - uTime * 1.4) * 0.09);
        float rim = pow(1.0 - abs(dot(normalize(vNormalView), normalize(vViewDirection))), 1.65);
        float attackPulse = uAttack * (0.16 + rim * 0.25);
        float hitPulse = uHit * (0.22 + rim * 0.48);
        vec3 shadowColor = mix(vec3(0.009, 0.006, 0.018), vec3(0.09, 0.025, 0.15), tornEdge);
        shadowColor += vec3(0.12, 0.025, 0.24) * attackPulse;
        shadowColor += vec3(0.31, 0.10, 0.55) * hitPulse;
        float alpha = (0.045 + rim * 0.24 + tornEdge * 0.13 + attackPulse + hitPulse) * (1.0 - uDeath * 0.88);
        gl_FragColor = vec4(shadowColor, clamp(alpha, 0.0, 0.58));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
  });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), auraMaterial);
  aura.name = 'shadow-aura';
  aura.position.y = 0.99;
  aura.scale.set(0.88, 1.2, 0.82);
  aura.renderOrder = 2;
  aura.castShadow = false;
  aura.frustumCulled = true;
  model.add(aura);
  const shadowRibbons: THREE.Mesh[] = [];
  for (let index = 0; index < 3; index++) {
    const angle = index * Math.PI * 2 / 3;
    const points = [
      new THREE.Vector3(Math.cos(angle) * 0.35, -0.18, Math.sin(angle) * 0.28),
      new THREE.Vector3(Math.cos(angle + 0.65) * 0.57, 0.22, Math.sin(angle + 0.65) * 0.4),
      new THREE.Vector3(Math.cos(angle + 1.35) * 0.53, 0.72, Math.sin(angle + 1.35) * 0.38),
      new THREE.Vector3(Math.cos(angle + 2.05) * 0.42, 1.2, Math.sin(angle + 2.05) * 0.32),
      new THREE.Vector3(Math.cos(angle + 2.7) * 0.24, 1.62, Math.sin(angle + 2.7) * 0.2),
    ];
    const ribbon = addTube(model, points, 0.034, new THREE.MeshBasicMaterial({
      color: index === 1 ? '#3a1855' : '#160e21', transparent: true, opacity: 0.42,
      depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
    }), 32);
    ribbon.name = `shadow-smoke-ribbon-${index}`;
    ribbon.castShadow = false;
    ribbon.renderOrder = 3;
    shadowRibbons.push(ribbon);
  }

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  cloak.add(leftArm, rightArm);
  for (const [side, arm] of [[-1, leftArm], [1, rightArm]] as const) {
    arm.position.set(side * 0.34, 0.91, 0.02);
    const upper = addMesh(arm, new THREE.CapsuleGeometry(0.115, 0.27, 4, 8), limbMaterial,
      new THREE.Vector3(side * 0.04, -0.18, 0), new THREE.Vector3(0.83, 1, 0.88));
    upper.rotation.z = side * -0.58;
    const forearm = addMesh(arm, new THREE.CapsuleGeometry(0.085, 0.25, 4, 8), limbMaterial,
      new THREE.Vector3(side * 0.17, -0.39, 0.055), new THREE.Vector3(0.76, 1, 0.82));
    forearm.rotation.z = side * -0.94;
    const claw = addMesh(arm, new THREE.ConeGeometry(0.074, 0.23, 8), accentMaterial,
      new THREE.Vector3(side * 0.3, -0.57, 0.08), new THREE.Vector3(0.75, 1, 0.72));
    claw.rotation.z = Math.PI + side * 0.1;
    for (let finger = 0; finger < 2; finger++) {
      const talon = addMesh(arm, new THREE.ConeGeometry(0.027, 0.14, 6), hoodMaterial,
        new THREE.Vector3(side * (0.25 + finger * 0.09), -0.65, 0.13));
      talon.rotation.z = Math.PI + side * 0.1;
    }
  }

  const tendrils: THREE.Group[] = [];
  for (const [index, xPos] of [-0.31, -0.16, 0, 0.16, 0.31].entries()) {
    const center = index === 2;
    const tendril = makeTendril(center ? hoodMaterial : bodyMaterial, center ? 0.62 : index % 2 ? 0.46 : 0.52, center ? 0.12 : 0.095);
    tendril.position.set(xPos, 0.29 + (center ? 0.03 : 0), -0.06 - Math.abs(xPos) * 0.12);
    tendril.rotation.z = xPos * 0.8;
    cloak.add(tendril);
    tendrils.push(tendril);
  }

  // Remolinos de humo al dorso y fragmentos violetas alrededor de la criatura.
  for (const side of [-1, 1]) {
    const curl = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.22, 0.52, -0.27),
        new THREE.Vector3(side * 0.48, 0.48, -0.4),
        new THREE.Vector3(side * 0.63, 0.67, -0.45),
      ]), 12, 0.045, 7, false),
      limbMaterial,
    );
    curl.castShadow = true;
    cloak.add(curl);
  }

  const motes: THREE.Mesh[] = [];
  for (let index = 0; index < 6; index++) {
    const mote = new THREE.Mesh(
      new THREE.OctahedronGeometry(index === 0 || index === 3 ? 0.075 : 0.052, 0),
      new THREE.MeshStandardMaterial({ color: '#bc8aff', emissive: '#8840dc', emissiveIntensity: 1.25, roughness: 0.3 }),
    );
    mote.castShadow = false;
    model.add(mote);
    motes.push(mote);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.68, 0.018, 7, 56),
    new THREE.MeshBasicMaterial({ color: '#bd8cff', transparent: true, opacity: 0.38, depthWrite: false }),
  );
  ring.name = 'combat-lock-ring';
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.065;
  root.add(ring);

  root.position.set(x, groundY, z);
  root.userData.shadowEnemyRig = {
    model, cloak, head, leftArm, rightArm, tendrils, eyes, eyeGlows, eyeMaterials, flashMaterials, ring, groundShadow,
    chestSigil, waistCharm, aura, auraMaterial, shadowRibbons, deathPuff, deathPuffRing,
    impactRing, attackSlashes, motes,
    action: 'idle', actionStarted: 0, actionDuration: 0, hitStarted:-Infinity,
  } satisfies ShadowEnemyRig;
  return root;
}

export function playShadowEnemyAction(root: THREE.Group | null, action: Exclude<ShadowEnemyAction, 'idle'>, time: number, duration?: number) {
  const actor=root?.userData.wildernessActor;if(actor){if(action==='hit')actor.hit();else if(action==='death')actor.die();else actor.attack();return;}
  const rig = root?.userData.shadowEnemyRig as ShadowEnemyRig | undefined;
  if (!rig || rig.action === 'death') return;
  if(action==='hit'){rig.hitStarted=time;if(rig.action==='prepare'||rig.action==='attack')return;}
  rig.action = action;
  rig.actionStarted = time;
  rig.actionDuration = duration ?? (action === 'death' ? 1.9 : action === 'attack' ? 0.88 : 0.56);
}

export function resetShadowEnemy(root: THREE.Group, time: number) {
  const rig = root.userData.shadowEnemyRig as ShadowEnemyRig | undefined;
  if (!rig) return;
  rig.action = 'idle';
  rig.actionStarted = time;
  rig.actionDuration = 0;
  rig.hitStarted=-Infinity;
  root.rotation.set(0, 0, 0);
  root.scale.setScalar(1);
  rig.model.position.set(0, 0.12, 0);
  rig.model.rotation.set(0, 0, 0);
  rig.model.scale.setScalar(0.72);
  rig.head.rotation.set(0, 0, 0);
  rig.cloak.rotation.set(0, 0, 0);
  rig.leftArm.rotation.set(0, 0, 0);
  rig.rightArm.rotation.set(0, 0, 0);
  rig.ring.visible = false;
  rig.deathPuffRing.visible = false;
  rig.deathPuff.forEach((cloud) => { cloud.visible = false; });
  rig.attackSlashes.forEach((slash) => { slash.visible = false; });
  rig.impactRing.scale.setScalar(0.65);
  (rig.impactRing.material as THREE.MeshBasicMaterial).opacity = 0;
  rig.auraMaterial.uniforms.uAttack.value = 0;
  rig.auraMaterial.uniforms.uHit.value = 0;
  rig.auraMaterial.uniforms.uDeath.value = 0;
}

export function updateShadowEnemy(root: THREE.Group, time: number, dt: number, target: THREE.Vector3, active: boolean) {
  if(root.userData.wildernessActor)return;
  const rig = root.userData.shadowEnemyRig as ShadowEnemyRig | undefined;
  if (!rig) return;

  const dx = target.x - root.position.x;
  const dz = target.z - root.position.z;
  if (active && dx * dx + dz * dz > 0.01) {
    const desired = Math.atan2(dx, dz);
    const difference = Math.atan2(Math.sin(desired - root.rotation.y), Math.cos(desired - root.rotation.y));
    root.rotation.y += difference * (1 - Math.exp(-dt * 4.5));
  }

  if(rig.action === 'prepare' && time >= rig.actionStarted + rig.actionDuration){
    rig.actionStarted += rig.actionDuration - .88 * .48;
    rig.actionDuration = .88; rig.action = 'attack';
  }
  const phase = time - rig.actionStarted;
  const progress = rig.actionDuration > 0 ? THREE.MathUtils.clamp(phase / rig.actionDuration, 0, 1) : 0;
  if (rig.action !== 'idle' && progress >= 1 && rig.action !== 'death') rig.action = 'idle';
  const attacking = rig.action === 'attack';
  const windUp = rig.action === 'prepare' ? THREE.MathUtils.smoothstep(progress, 0, .45) : attacking
    ? THREE.MathUtils.smoothstep(progress, 0.02, 0.28) * (1 - THREE.MathUtils.smoothstep(progress, 0.28, 0.48)) : 0;
  const strikeProgress = THREE.MathUtils.clamp((progress - 0.32) / 0.34, 0, 1);
  const strike = attacking && progress >= 0.32 && progress <= 0.66 ? Math.sin(strikeProgress * Math.PI) : 0;
  const attack = Math.max(windUp * 0.78, strike);
  const flashAge=(time-rig.hitStarted)/.24;
  const hit = Math.max(rig.action === 'hit' ? Math.sin(Math.sqrt(progress) * Math.PI) * (1 - progress * 0.28) : 0,flashAge>=0&&flashAge<1?Math.sin(flashAge*Math.PI):0);
  const death = rig.action === 'death' ? THREE.MathUtils.smoothstep(progress, 0, 1) : 0;
  const fall = rig.action === 'death' ? THREE.MathUtils.smoothstep(progress, 0, 0.64) : 0;
  const puffProgress = rig.action === 'death' ? THREE.MathUtils.clamp((progress - 0.64) / 0.36, 0, 1) : 0;
  const puff = rig.action === 'death' ? Math.sin(puffProgress * Math.PI) : 0;
  const living = 1 - death;
  const idle = Math.max(0, living - attack - hit);
  const hover = Math.sin(time * 2.4) * 0.082 * living;
  const idleBreath = Math.sin(time * 1.7) * 0.025 * idle;
  const lunge = strike * 0.52;

  rig.model.position.y = 0.12 + hover + idleBreath + windUp * 0.09 - strike * 0.04 - hit * 0.15 - fall * 0.23;
  rig.model.position.z = -windUp * 0.12 + lunge - hit * 0.32;
  rig.model.rotation.x = 0.025 + windUp * 0.28 - strike * 0.58 + hit * 0.32 + fall * 0.2;
  rig.model.rotation.z = Math.sin(time * 1.7) * 0.045 * idle + hit * (0.16 + Math.sin(time * 26) * 0.22) + fall * 0.62;
  rig.model.scale.set(0.72 * (1 + idleBreath + strike * 0.06 - hit * 0.045), 0.72 * (1 - fall * 0.56 + windUp * 0.025 - hit * 0.075), 0.72 * (1 - idleBreath + strike * 0.13 - hit * 0.04));
  rig.cloak.rotation.y = Math.sin(time * 1.25) * 0.08 * idle + strike * 0.08;
  rig.head.rotation.x = Math.sin(time * 1.3) * 0.035 * idle - windUp * 0.16 + strike * 0.12 - hit * 0.32 + death * 0.25;
  rig.head.rotation.y = Math.sin(time * 0.65) * 0.055 * idle + strike * 0.12;
  rig.head.rotation.z = Math.sin(time * 1.9) * 0.025 * idle + hit * 0.34;
  rig.leftArm.rotation.x = -0.12 - windUp * 0.28 + strike * 0.65 + hit * 0.72 + Math.sin(time * 2.1) * 0.08 * idle;
  rig.leftArm.rotation.z = 0.15 + windUp * 0.25 + strike * 0.18 - hit * 0.42;
  rig.rightArm.rotation.x = 0.12 + windUp * 0.52 - strike * 1.18 + hit * 0.86;
  rig.rightArm.rotation.z = -0.15 - windUp * 0.22 - strike * 0.38 + hit * 0.42;
  rig.tendrils.forEach((tendril, index) => {
    const wave = time * 2.4 - index * 0.62;
    tendril.rotation.z = Math.sin(wave) * 0.2 * idle + (index - 2) * 0.085 - strike * (index - 2) * 0.13;
    tendril.rotation.x = Math.cos(wave * 0.82) * 0.14 * idle + death * (index - 2) * 0.12;
    tendril.scale.setScalar(1 + Math.sin(wave + 0.7) * 0.045 * idle + death * 0.1);
  });
  const blinkPhase = time % 5.2;
  const blink = Math.max(0, 1 - Math.abs(blinkPhase - 4.88) / 0.11);
  rig.eyes.forEach((eye, index) => {
    const pulse = 1 + Math.sin(time * 3.2 + index * 0.7) * 0.055;
    eye.scale.set(0.83 * pulse, 1.18 * pulse * (1 - blink * 0.92), 0.43);
    rig.eyeMaterials[index].emissiveIntensity = (2.15 + Math.sin(time * 4 + index) * 0.3 + strike * 1.1 + hit * 1.8) * living;
    (rig.eyeGlows[index].material as THREE.MeshBasicMaterial).opacity = (0.16 + Math.sin(time * 3 + index) * 0.035 + hit * 0.16) * living;
  });
  for (const material of rig.flashMaterials) {
    const baseEmissive = material.userData.baseEmissive as THREE.Color;
    material.emissive.copy(baseEmissive).lerp(purple, hit * 0.82 + death * 0.08);
    material.emissiveIntensity = Number(material.userData.baseEmissiveIntensity) + hit * 1.4;
  }
  rig.chestSigil.rotation.y = time * 0.65 + strike * 0.55;
  rig.chestSigil.rotation.z = Math.PI / 4 + Math.sin(time * 1.5) * 0.08;
  rig.waistCharm.rotation.y = time * 0.9;
  rig.waistCharm.rotation.z = Math.PI / 4 + Math.sin(time * 2) * 0.08;
  rig.auraMaterial.uniforms.uTime.value = time;
  rig.auraMaterial.uniforms.uAttack.value = strike;
  rig.auraMaterial.uniforms.uHit.value = hit;
  rig.auraMaterial.uniforms.uDeath.value = death;
  const auraPulse = Math.sin(time * 1.9) * 0.035 * idle;
  rig.aura.scale.set(0.88 + auraPulse + strike * 0.32 + hit * 0.24, 1.2 + auraPulse + strike * 0.24 + hit * 0.32, 0.82 + auraPulse + strike * 0.3 + hit * 0.24);
  rig.aura.rotation.y = -time * 0.18;
  rig.shadowRibbons.forEach((ribbon, index) => {
    ribbon.rotation.y = time * (0.24 + index * 0.05) + index * Math.PI * 2 / 3;
    ribbon.rotation.z = Math.sin(time * 1.8 + index * 2) * 0.08 * idle;
    ribbon.scale.setScalar(1 + Math.sin(time * 2.1 + index) * 0.08 * idle + strike * 0.12 + death * 0.3);
    (ribbon.material as THREE.MeshBasicMaterial).opacity = (0.34 + Math.sin(time * 2.7 + index) * 0.08 + strike * 0.18 + hit * 0.24) * living;
  });
  rig.deathPuff.forEach((cloud, index) => {
    const angle = index * Math.PI * 2 / rig.deathPuff.length + puffProgress * 0.7;
    const radius = 0.08 + puffProgress * (0.32 + (index % 3) * 0.045);
    cloud.position.set(Math.cos(angle) * radius, 0.38 + puffProgress * (0.18 + (index % 3) * 0.06), Math.sin(angle) * radius * 0.72);
    const size = 0.12 + puff * (0.2 + (index % 2) * 0.07);
    cloud.scale.set(size * 1.18, size, size * 0.88);
    (cloud.material as THREE.MeshBasicMaterial).opacity = puff * (index % 2 ? 0.62 : 0.78);
    cloud.visible = puff > 0.015;
  });
  rig.deathPuffRing.visible = puff > 0.015;
  rig.deathPuffRing.scale.setScalar(0.15 + puffProgress * 2.6);
  (rig.deathPuffRing.material as THREE.MeshBasicMaterial).opacity = puff * 0.88;
  rig.impactRing.scale.setScalar(0.65 + hit * 4.2);
  (rig.impactRing.material as THREE.MeshBasicMaterial).opacity = hit * 0.82;
  for (const slash of rig.attackSlashes) {
    const material = slash.material as THREE.MeshBasicMaterial;
    material.opacity = strike * 0.82;
    slash.visible = strike > 0.025;
    slash.scale.set(0.82 + strike * 0.35, 0.82 + strike * 0.35, 1);
  }
  rig.groundShadow.scale.setScalar(0.9 + hover * 0.8 + fall * 0.25);
  (rig.groundShadow.material as THREE.MeshBasicMaterial).opacity = 0.44 - hover * 0.6 + fall * 0.16;
  rig.ring.rotation.y += dt * (0.3 + strike * 2.1);
  (rig.ring.material as THREE.MeshBasicMaterial).opacity = (0.34 + Math.sin(time * 2) * 0.07 + strike * 0.38) * living;
  rig.motes.forEach((mote, index) => {
    const angle = time * (0.8 + index * 0.09) + index * Math.PI / 3;
    const radius = 0.65 + Math.sin(time * 2 + index) * 0.055 + death * (0.7 + index * 0.08);
    mote.position.set(Math.cos(angle) * radius, 0.74 + Math.sin(time * 1.6 + index) * 0.3 + death * (0.22 + index * 0.12), Math.sin(angle) * radius * 0.72);
    mote.rotation.set(time * 1.4 + index, time * 1.8, time * 0.6 - index);
    mote.visible = death < 0.9;
    mote.scale.setScalar((1 + Math.sin(time * 2.8 + index) * 0.16) * (1 - death * 0.65));
  });
}
