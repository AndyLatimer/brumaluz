import * as THREE from 'three';
import { loadEXR } from './load';
import type { Stage } from './render';
import dawnExr from '@pmndrs/assets/hdri/dawn.exr';
import sunriseExr from '@pmndrs/assets/hdri/sunrise.exr';
import skyExr from '@pmndrs/assets/hdri/sky.exr';
import nightExr from '@pmndrs/assets/hdri/night.exr';

// ---------------------------------------------------------------------------
// Ciclo de día y noche. El cielo mezcla los HDRI de @pmndrs/assets (Poly Haven, CC0) de cada momento del día;
// el sol (o la luna) recorre el cielo según la hora del mundo y las luces, la niebla, los reflejos y los faroles
// siguen al cielo. La hora la marca el servidor (src/data/worldClock.ts).
// ---------------------------------------------------------------------------

/**
 * Cada HDRI es una foto: de su horizonte para abajo hay suelo, rocas o árboles. Solo se usa el cielo por encima de
 * `cut` (seno de la altura a la que acaba el paisaje), estirado hasta el horizonte; `sunU` es dónde tiene la foto el
 * sol, para girarla y que su resplandor quede donde está el sol del juego, y `gain` iguala su brillo.
 * (El HDRI de atardecer no sirve de cielo: tiene los palacios de Venecia hasta media altura.)
 */
const PHOTOS = {
  night: { url: nightExr, sunU: 0.34, cut: 0.45, gain: 1 },
  dawn: { url: dawnExr, sunU: 0.627, cut: 0.17, gain: 0.5 },
  sunrise: { url: sunriseExr, sunU: 0.598, cut: 0.4, gain: 1.5 },
  day: { url: skyExr, sunU: 0.594, cut: 0.03, gain: 1 },
} as const;
type Photo = keyof typeof PHOTOS;

interface Key {
  hour: number;
  sky: Photo;
  /** Brillo y tono del cielo. */
  gain: number; tint: string;
  /** Color del horizonte y de la niebla. */
  horizon: string;
  sun: string; sunIntensity: number;
  hemiSky: string; hemiGround: string; hemi: number;
  rim: string; rimIntensity: number;
  /** Reflejos del cielo en los materiales y exposición de la cámara. */
  env: number; exposure: number;
  /** 0 de día, 1 de noche: faroles, luciérnagas y luna. */
  night: number;
}

const NIGHT: Omit<Key, 'hour'> = {
  sky: 'night', gain: 0.9, tint: '#a8b8ff', horizon: '#141b33', sun: '#9fb6ff', sunIntensity: 0.5,
  hemiSky: '#4a5c94', hemiGround: '#14141e', hemi: 0.38, rim: '#7088d8', rimIntensity: 0.45, env: 0.1, exposure: 0.95, night: 1,
};
const DAY: Omit<Key, 'hour'> = {
  sky: 'day', gain: 1, tint: '#ffffff', horizon: '#cbd9e3', sun: '#fff3dc', sunIntensity: 2.6,
  hemiSky: '#cfe0ff', hemiGround: '#7c6a50', hemi: 0.42, rim: '#fff0e0', rimIntensity: 0.7, env: 0.42, exposure: 0.86, night: 0,
};
/** Atardecer dorado: el aspecto de los menús. */
export const GOLDEN_HOUR = 18.5;
const KEYS: Key[] = [
  { hour: 0, ...NIGHT },
  { hour: 4.6, ...NIGHT },
  { hour: 5.6, sky: 'dawn', gain: 0.22, tint: '#8c88cc', horizon: '#4c4a72', sun: '#c8a8dc', sunIntensity: 0.35,
    hemiSky: '#7c80c0', hemiGround: '#3a3040', hemi: 0.6, rim: '#c48ab8', rimIntensity: 0.6, env: 0.2, exposure: 1, night: 0.8 },
  { hour: 6.6, sky: 'dawn', gain: 0.55, tint: '#ffffff', horizon: '#d6a9b9', sun: '#ffc2a4', sunIntensity: 1.7,
    hemiSky: '#b8b4ff', hemiGround: '#7a5a58', hemi: 0.45, rim: '#ffb0c0', rimIntensity: 1.2, env: 0.32, exposure: 0.95, night: 0.25 },
  { hour: 7.8, sky: 'sunrise', gain: 1.5, tint: '#fff2e2', horizon: '#d9dde2', sun: '#ffe2b8', sunIntensity: 2.6,
    hemiSky: '#c8d8ff', hemiGround: '#7c6a50', hemi: 0.42, rim: '#ffd0c0', rimIntensity: 1.1, env: 0.4, exposure: 0.92, night: 0 },
  { hour: 10, ...DAY },
  { hour: 16.5, ...DAY },
  { hour: GOLDEN_HOUR, sky: 'dawn', gain: 0.5, tint: '#ffd9b4', horizon: '#e8b090', sun: '#ffd2a0', sunIntensity: 3.2,
    hemiSky: '#b8c4ff', hemiGround: '#8a5a40', hemi: 0.35, rim: '#ffb8c8', rimIntensity: 1.4, env: 0.4, exposure: 0.92, night: 0.1 },
  { hour: 20, sky: 'dawn', gain: 0.17, tint: '#9c78ba', horizon: '#5e4a6c', sun: '#ff9c84', sunIntensity: 0.8,
    hemiSky: '#8f86c8', hemiGround: '#4a3644', hemi: 0.5, rim: '#d08ab0', rimIntensity: 0.8, env: 0.22, exposure: 1, night: 0.65 },
  { hour: 21.3, ...NIGHT },
  { hour: 24, ...NIGHT },
];

/** El sol sale a las 6:00 por el este (+X), pasa por el sur (+Z) y se pone a las 20:00 por el oeste. */
const SUNRISE = 6, SUNSET = 20, SUN_TOP = THREE.MathUtils.degToRad(62), MOON_TOP = THREE.MathUtils.degToRad(48);
/** Altura mínima de la luz que proyecta sombras: más rasante, las sombras cruzarían media ciudad. */
const MIN_LIGHT = Math.sin(THREE.MathUtils.degToRad(14));

/**
 * Lo que el resto del mundo necesita saber del ciclo: `night` (0 de día, 1 de noche) para faroles y luciérnagas, y
 * el cielo que reflejan y la luz que reciben el agua y sus salpicaduras (sus materiales no se iluminan solos).
 */
export const daylight = {
  night: 0.1, uNight: { value: 0.1 },
  water: {
    skyColor: { value: new THREE.Color('#5272c7') }, horizonColor: { value: new THREE.Color('#e8b090') },
    sunColor: { value: new THREE.Color('#ffd2a0') }, sunDir: { value: new THREE.Vector3(-0.62, 0.7, 0.42).normalize() },
    light: { value: 1 },
  },
};

/** Ángulo del sol en su vuelta diaria: 0 al salir, π al ponerse, 2π a la salida siguiente (de noche va por debajo). */
function sunAngle(hour: number) {
  if (hour >= SUNRISE && hour <= SUNSET) return Math.PI * (hour - SUNRISE) / (SUNSET - SUNRISE);
  const night = (hour - SUNSET + 24) % 24;
  return Math.PI + Math.PI * night / (24 - SUNSET + SUNRISE);
}
function arc(angle: number, top: number, target: THREE.Vector3) {
  const elevation = Math.sin(angle) * top;
  return target.set(Math.cos(angle) * Math.cos(elevation), Math.sin(elevation), Math.sin(angle) * Math.cos(elevation));
}

const vertexShader = `varying vec3 vDir;
  void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const fragmentShader = `
  #include <common>
  uniform sampler2D photoA; uniform sampler2D photoB;
  uniform vec3 photoAInfo; uniform vec3 photoBInfo; // giro (u), corte, brillo
  uniform float blend; uniform vec3 tint; uniform vec3 horizon;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunVisible;
  uniform vec3 moonDir; uniform float moonVisible;
  varying vec3 vDir;
  vec3 photo(sampler2D map, vec3 info, vec3 d) {
    // Por debajo del corte se repite la franja de cielo justo encima del paisaje, cada vez más difuminada
    // de lado a lado (si no, una copa de árbol o una farola de la foto se estiraría en una raya vertical).
    float y = max(d.y, info.y);
    vec2 uv = vec2(atan(d.z, d.x) * RECIPROCAL_PI2 + 0.5 + info.x, asin(y) * RECIPROCAL_PI + 0.5);
    float spread = clamp((info.y - d.y) * 0.25, 0.0, 0.06);
    vec3 c = texture2D(map, uv).rgb;
    if (spread > 0.0) {
      c = (min(c, vec3(3.0)) + min(texture2D(map, uv - vec2(spread, 0.0)).rgb, vec3(3.0)) + min(texture2D(map, uv + vec2(spread, 0.0)).rgb, vec3(3.0))
        + min(texture2D(map, uv - vec2(spread * 2.0, 0.0)).rgb, vec3(3.0)) + min(texture2D(map, uv + vec2(spread * 2.0, 0.0)).rgb, vec3(3.0))) / 5.0;
    }
    // El sol de la foto se recorta: el del juego se dibuja aparte, donde está de verdad.
    return min(c, vec3(3.0)) * info.z;
  }
  void main(){
    vec3 d = normalize(vDir);
    vec3 col = mix(photo(photoA, photoAInfo, d), photo(photoB, photoBInfo, d), blend) * tint;
    // Hacia el horizonte el cielo se funde con la niebla, que tapa lo lejano del mapa.
    col = mix(horizon, col, smoothstep(-0.02, 0.22, d.y));
    float s = max(dot(d, sunDir), 0.0);
    col += sunColor * sunVisible * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6 + smoothstep(0.9993, 0.9996, s) * 12.0);
    float m = max(dot(d, moonDir), 0.0);
    col += vec3(0.75, 0.82, 1.0) * moonVisible * (pow(m, 24.0) * 0.12 + smoothstep(0.99955, 0.9998, m) * 2.2);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export interface DayNight {
  /** Sigue la hora del mundo; en interiores deja el vacío negro y reduce la luz exterior. */
  update(hour: number, indoor: boolean): void;
  /** Aberturas del mapa actual: comparten el cielo exterior sin dibujarlo fuera de la habitación. */
  setWindows(windows: readonly THREE.Mesh[]): void;
  /** Centra la cúpula del cielo en la cámara. */
  follow(center: THREE.Vector3): void;
}

export function buildDayNight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, stage: Stage, reflections: boolean): DayNight {
  const photos = {} as Record<Photo, THREE.DataTexture>;
  for (const name of Object.keys(PHOTOS) as Photo[]) {
    try { photos[name] = loadEXR(PHOTOS[name].url); }
    catch (error) { console.warn('Sin HDRI:', name, error); photos[name] = new THREE.DataTexture(new Uint8Array([90, 120, 170, 255]), 1, 1); }
    photos[name].wrapS = THREE.RepeatWrapping;
    photos[name].needsUpdate = true;
  }
  const uniforms = {
    photoA: { value: photos.night as THREE.Texture }, photoB: { value: photos.night as THREE.Texture },
    photoAInfo: { value: new THREE.Vector3() }, photoBInfo: { value: new THREE.Vector3() },
    blend: { value: 0 }, tint: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color() }, sunVisible: { value: 0 },
    moonDir: { value: new THREE.Vector3() }, moonVisible: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), material);
  sky.name = 'sky';
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  sky.raycast = () => {};
  scene.add(sky);
  const background = scene.background;
  const darkness = new THREE.Color('#000000');
  const windowMaterial = new THREE.ShaderMaterial({
    uniforms, fragmentShader, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec3 vDir;
      void main(){
        vec4 world = modelMatrix * vec4(position, 1.0);
        vDir = world.xyz - cameraPosition;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
  });
  windowMaterial.name = 'world-time-window-sky';

  // Reflejos: el propio cielo, prefiltrado de vez en cuando (cambia despacio).
  const pmrem = reflections ? new THREE.PMREMGenerator(renderer) : null;
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), material));
  let envTarget: THREE.WebGLRenderTarget | null = null;
  let envKey = '';

  const fog = scene.fog instanceof THREE.Fog ? scene.fog : null;
  const other = new THREE.Color();
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
  const lerp = THREE.MathUtils.lerp;
  const mixColor = (target: THREE.Color, a: string, b: string, t: number) => target.set(a).lerp(other.set(b), t);

  return {
    setWindows(windows) {
      for (const window of windows) {
        if (window.material === windowMaterial) continue;
        // Los mapas se conservan en caché: solo se sustituye el material provisional una vez.
        if (window.material instanceof THREE.Material && window.material.name === 'window-sky-placeholder') window.material.dispose();
        window.material = windowMaterial;
      }
    },
    update(hour, indoor) {
      hour = ((hour % 24) + 24) % 24;
      sky.visible = !indoor;
      scene.background = indoor ? darkness : background;
      let i = 0;
      while (i < KEYS.length - 2 && KEYS[i + 1].hour <= hour) i++;
      const a = KEYS[i], b = KEYS[i + 1];
      const raw = (hour - a.hour) / (b.hour - a.hour);
      const t = raw * raw * (3 - 2 * raw);

      // Sol y luna recorren su arco; la luz con sombras es la que esté sobre el horizonte.
      const angle = sunAngle(hour);
      arc(angle, SUN_TOP, sunDir);
      arc(angle + Math.PI, MOON_TOP, moonDir);
      const day = sunDir.y > 0;
      const light = stage.sunDirection.copy(day ? sunDir : moonDir);
      // Cerca del horizonte la luz se apaga un momento y cambia de astro sin que las sombras salten.
      const lift = Math.min(1, Math.abs(sunDir.y) / 0.08);
      if (light.y < MIN_LIGHT) { light.y = MIN_LIGHT; light.normalize(); }

      // Cielo: las dos fotos de los momentos entre los que estamos, giradas con el sol.
      const turn = Math.atan2(sunDir.z, sunDir.x) / (Math.PI * 2) + 0.5;
      for (const [key, photoUniform, info] of [[a, uniforms.photoA, uniforms.photoAInfo], [b, uniforms.photoB, uniforms.photoBInfo]] as const) {
        const photo = PHOTOS[key.sky];
        photoUniform.value = photos[key.sky];
        info.value.set(photo.sunU - turn, photo.cut, photo.gain * key.gain);
      }
      uniforms.blend.value = t;
      mixColor(uniforms.tint.value, a.tint, b.tint, t);
      mixColor(uniforms.horizon.value, a.horizon, b.horizon, t);
      uniforms.sunDir.value.copy(sunDir);
      mixColor(uniforms.sunColor.value, a.sun, b.sun, t);
      uniforms.sunVisible.value = THREE.MathUtils.smoothstep(sunDir.y, -0.04, 0.02);
      uniforms.moonDir.value.copy(moonDir);
      uniforms.moonVisible.value = THREE.MathUtils.smoothstep(moonDir.y, -0.02, 0.06) * lerp(a.night, b.night, t);

      // Luces, niebla y exposición.
      mixColor(stage.sun.color, a.sun, b.sun, t);
      stage.sun.intensity = lerp(a.sunIntensity, b.sunIntensity, t) * lift * (indoor ? 0.18 : 1);
      mixColor(stage.hemi.color, a.hemiSky, b.hemiSky, t);
      mixColor(stage.hemi.groundColor, a.hemiGround, b.hemiGround, t);
      stage.hemi.intensity = lerp(a.hemi, b.hemi, t);
      mixColor(stage.rim.color, a.rim, b.rim, t);
      stage.rim.intensity = lerp(a.rimIntensity, b.rimIntensity, t);
      const night = lerp(a.night, b.night, t);
      stage.fill.intensity = 0.55 * (1 - 0.55 * night);
      if (indoor) {
        // Rebote tenue para leer la habitación; la iluminación principal la aportan sus lámparas.
        stage.hemi.intensity = 0.22 + 0.1 * (1 - night);
        stage.hemi.groundColor.set('#30251c');
        stage.rim.intensity *= 0.12;
        stage.fill.intensity = 0.3;
      }
      if (fog) fog.color.copy(indoor ? darkness : uniforms.horizon.value);
      renderer.toneMappingExposure = lerp(a.exposure, b.exposure, t);
      scene.environmentIntensity = lerp(a.env, b.env, t) * (indoor ? 0.15 : 1);
      daylight.night = daylight.uNight.value = night;
      const water = daylight.water;
      mixColor(water.skyColor.value, a.hemiSky, b.hemiSky, t).multiply(uniforms.tint.value).multiplyScalar(0.75);
      water.horizonColor.value.copy(uniforms.horizon.value);
      water.sunColor.value.copy(stage.sun.color).multiplyScalar(stage.sun.intensity / 3);
      water.sunDir.value.copy(light);
      water.light.value = 1 - 0.86 * night;

      // Reflejos: se rehacen cada pocos minutos del mundo (y al entrar o salir de un interior).
      if (pmrem) {
        const key = `${indoor}:${Math.round(hour * 12)}`;
        if (key !== envKey) {
          envKey = key;
          const target = pmrem.fromScene(envScene, 0, 0.1, 100);
          scene.environment = target.texture;
          envTarget?.dispose();
          envTarget = target;
        }
      }
    },
    follow(center) {
      sky.position.set(center.x, 0, center.z);
    },
  };
}
