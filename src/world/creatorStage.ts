import * as THREE from 'three';

/** A studio above the world keeps every published map out of the creator camera. */
export const CREATOR_STAGE_Y = 200;
export const CREATOR_LIGHTS = [
  { label: 'Luz de taller', sky: '#fff3de', ground: '#78958c', key: '#fff1d8', rim: '#b9d4d0' },
  { label: 'Luz de día', sky: '#ffffff', ground: '#a3b5c0', key: '#f4f8ff', rim: '#e0efff' },
  { label: 'Luz de farol', sky: '#f4d4ab', ground: '#676c89', key: '#ffc78a', rim: '#a6bde9' },
] as const;
export function setCreatorLighting(group: THREE.Group, index: number) {
  const light = CREATOR_LIGHTS[index] ?? CREATOR_LIGHTS[0];
  const fill = group.getObjectByName('studio-fill') as THREE.HemisphereLight;
  fill.color.set(light.sky); fill.groundColor.set(light.ground);
  (group.getObjectByName('studio-key') as THREE.PointLight).color.set(light.key);
  (group.getObjectByName('studio-rim') as THREE.PointLight).color.set(light.rim);
}
export function createCreatorStage(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'character-creator-stage'; group.position.y = CREATOR_STAGE_Y;
  const background = new THREE.Mesh(new THREE.SphereGeometry(32, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: true,
    vertexShader: 'varying vec3 direction; void main(){ direction=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 direction; void main(){
      float light=smoothstep(-.5,.6,direction.y);
      vec3 color=mix(vec3(.055,.10,.105),vec3(.16,.24,.22),light);
      float halo=pow(max(0.,1.-abs(direction.y-.06)),18.);
      color+=vec3(.025,.035,.025)*halo;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));
  group.add(background);
  const stone = new THREE.MeshStandardMaterial({ color: '#718077', roughness: .9 });
  // Fade the ground into the backdrop, avoiding a hard horizon behind a close-up.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 80), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 ground; void main(){ ground=position.xy/8.; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 ground; void main(){
      float fade=1.-smoothstep(.18,1.,length(ground));
      gl_FragColor=vec4(vec3(.065,.11,.095),fade*.8);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.22; group.add(floor);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, .2, 64), stone);
  pedestal.position.y = -.1; pedestal.receiveShadow = true; group.add(pedestal);
  const brass = new THREE.MeshStandardMaterial({ color: '#c5aa6c', metalness: .5, roughness: .45 });
  for (const radius of [1.21, 1.29]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .009, 6, 80), brass);
    ring.rotation.x = Math.PI / 2; ring.position.y = .002; group.add(ring);
  }
  // Small inlays, rather than a texture download, mark the edge of the plinth.
  const inlayGeometry = new THREE.OctahedronGeometry(.028, 0);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, inlay = new THREE.Mesh(inlayGeometry, brass);
    inlay.position.set(Math.sin(angle) * 1.25, .008, Math.cos(angle) * 1.25); inlay.scale.y = .2; group.add(inlay);
  }
  const fill = new THREE.HemisphereLight('#fff3de', '#78958c', 1.5); fill.name = 'studio-fill'; group.add(fill);
  const key = new THREE.PointLight('#fff1d8', 1.4, 12, 0); key.name = 'studio-key'; key.position.set(-3, 4, 4); group.add(key);
  const rim = new THREE.PointLight('#b9d4d0', .8, 12, 0); rim.name = 'studio-rim'; rim.position.set(3, 3, -2); group.add(rim);
  scene.add(group);
  return group;
}
