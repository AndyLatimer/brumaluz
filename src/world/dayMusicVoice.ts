import type { MusicInstrument, ScoreNote } from './dayMusicScore';

export interface MusicVoice {
  stop(when?: number): void;
  onended?: () => void;
}

interface VoiceSample { buffer: AudioBuffer; pitch: number }
interface SampleCache { samples: Map<string, VoiceSample> }
const caches = new WeakMap<BaseAudioContext, SampleCache>();
const preparations = new WeakMap<BaseAudioContext, Promise<void>>();
const preparedContexts = new WeakSet<BaseAudioContext>();
const SAMPLE_RATE = 24000;
const CACHE_LIMIT = 22;
const TABLE_SIZE = 2048;
const TAU = Math.PI * 2;

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296 * 2 - 1;
  };
}

function frequency(pitch: number): number { return 440 * 2 ** ((pitch - 69) / 12); }

/** A fractional-delay string, excited by a pluck rather than an oscillator. */
function pluckedString(
  length: number, rate: number, hz: number, seed: number, harp: boolean,
): Float32Array {
  const random = randomGenerator(seed);
  const delay = rate / hz - 0.5;
  const ringLength = Math.ceil(delay) + 2;
  const ring = new Float32Array(ringLength);
  const pluckPosition = harp ? 0.24 : 0.17;
  for (let i = 0; i < ringLength; i++) {
    const phase = (i % Math.ceil(delay)) / Math.ceil(delay);
    const shape = phase < pluckPosition ? phase / pluckPosition : (1 - phase) / (1 - pluckPosition);
    ring[i] = (shape - 0.5) * 1.3 + random() * (harp ? 0.1 : 0.22);
  }
  const output = new Float32Array(length);
  // Longer decays for the harp; the loop filter naturally removes upper harmonics.
  const feedback = Math.exp(-1 / (hz * (harp ? 2.1 : 1.45)));
  let previous = 0;
  let write = 0;
  for (let i = 0; i < length; i++) {
    let read = write - delay;
    if (read < 0) read += ringLength;
    const left = Math.floor(read);
    const fraction = read - left;
    const value = ring[left] * (1 - fraction) + ring[(left + 1) % ringLength] * fraction;
    ring[write] = (value + previous) * 0.5 * feedback;
    previous = value;
    output[i] = value;
    write = (write + 1) % ringLength;
  }
  return output;
}

function waveTable(hz: number, rate: number, partials: readonly number[]): Float32Array {
  const table = new Float32Array(TABLE_SIZE + 1);
  let weight = 0;
  for (let harmonic = 1; harmonic <= partials.length && harmonic * hz < rate * 0.43; harmonic++) {
    weight += partials[harmonic - 1];
    for (let i = 0; i < TABLE_SIZE; i++) {
      table[i] += Math.sin(TAU * harmonic * i / TABLE_SIZE) * partials[harmonic - 1];
    }
  }
  for (let i = 0; i < TABLE_SIZE; i++) table[i] /= weight || 1;
  table[TABLE_SIZE] = table[0];
  return table;
}

function tableValue(table: Float32Array, phase: number): number {
  const position = phase * TABLE_SIZE;
  const left = Math.floor(position);
  return table[left] + (table[left + 1] - table[left]) * (position - left);
}

function sustainedTone(
  output: Float32Array, rate: number, hz: number, seed: number, flute: boolean,
): void {
  const random = randomGenerator(seed);
  const table = waveTable(hz, rate, flute
    ? [1, 0.12, 0.18, 0.035, 0.025, 0.012]
    : [1, 0.38, 0.21, 0.095, 0.065, 0.035, 0.022, 0.012]);
  const increment = hz / rate;
  const slowIncrement = TAU * (flute ? 4.55 : 3.2) / rate;
  const breathIncrement = TAU * 0.47 / rate;
  // Recursive rotations keep per-sample work small during a game frame.
  const vibratoSin = Math.sin(slowIncrement);
  const vibratoCos = Math.cos(slowIncrement);
  const breathSin = Math.sin(breathIncrement);
  const breathCos = Math.cos(breathIncrement);
  let vibratoX = 1, vibratoY = 0, breathX = 1, breathY = 0;
  let phase = 0, secondPhase = 0.17, noiseLow = 0, bodyLow = 0;
  for (let i = 0; i < output.length; i++) {
    const nextVibratoX = vibratoX * vibratoCos - vibratoY * vibratoSin;
    vibratoY = vibratoY * vibratoCos + vibratoX * vibratoSin;
    vibratoX = nextVibratoX;
    const nextBreathX = breathX * breathCos - breathY * breathSin;
    breathY = breathY * breathCos + breathX * breathSin;
    breathX = nextBreathX;
    const vibrato = vibratoY * (flute ? 0.00155 : 0.0006);
    phase += increment * (1 + vibrato);
    if (phase >= 1) phase -= 1;
    secondPhase += increment * (1.0021 - vibrato * 0.35);
    if (secondPhase >= 1) secondPhase -= 1;
    const noise = random();
    noiseLow += (noise - noiseLow) * (flute ? 0.1 : 0.045);
    const tone = flute
      ? tableValue(table, phase) * (0.96 + breathY * 0.025) + (noise - noiseLow) * 0.017
      : (tableValue(table, phase) * 0.67 + tableValue(table, secondPhase) * 0.33) * (0.96 + breathY * 0.016) + noiseLow * 0.024;
    // A small body resonance rounds the sound without per-voice filter nodes.
    bodyLow += (tone - bodyLow) * (flute ? 0.66 : 0.48);
    output[i] = bodyLow;
  }
}

function makeSample(context: BaseAudioContext, instrument: MusicInstrument, pitch: number): VoiceSample {
  const rate = Math.min(SAMPLE_RATE, context.sampleRate);
  const seconds = instrument === 'frameDrum' ? 1 : instrument === 'lute' ? 5 : instrument === 'harp' ? 7 : 6.5;
  const buffer = context.createBuffer(1, Math.ceil(seconds * rate), rate);
  const data = buffer.getChannelData(0);
  const instrumentSeed = { lute: 3571, harp: 5419, flute: 8101, strings: 12791, frameDrum: 17659 }[instrument];
  const seed = (instrumentSeed * 997 + pitch * 7919) >>> 0;
  const hz = frequency(pitch);

  if (instrument === 'lute' || instrument === 'harp') {
    const harp = instrument === 'harp';
    const first = pluckedString(data.length, rate, hz * (harp ? 1 : 0.9991), seed, harp);
    const second = pluckedString(data.length, rate, hz * (harp ? 1.0012 : 1.0015), seed + 17, harp);
    for (let i = 0; i < data.length; i++) data[i] = first[i] * 0.74 + second[i] * 0.26;
  } else if (instrument === 'frameDrum') {
    const random = randomGenerator(seed);
    let phase = 0, skinPhase = 0, noiseLow = 0;
    for (let i = 0; i < data.length; i++) {
      const time = i / rate;
      phase += TAU * (53 + 43 * Math.exp(-time * 27)) / rate;
      skinPhase += TAU * 113 / rate;
      noiseLow += (random() - noiseLow) * 0.24;
      data[i] = Math.sin(phase) * Math.exp(-time * 10)
        + Math.sin(skinPhase) * Math.exp(-time * 17) * 0.2
        + noiseLow * Math.exp(-time * 35) * 0.4;
    }
  } else {
    sustainedTone(data, rate, hz, seed, instrument === 'flute');
  }

  let peak = 0, previousInput = 0, previousOutput = 0;
  const dcBlock = Math.exp(-TAU * 12 / rate);
  for (let i = 0; i < data.length; i++) {
    const input = data[i];
    const value = dcBlock * (previousOutput + input - previousInput);
    previousInput = input;
    previousOutput = value;
    data[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }
  const level = peak > 0 ? 0.82 / peak : 1;
  const endFade = Math.min(Math.floor(rate * 0.08), data.length);
  for (let i = 0; i < data.length; i++) {
    const tail = i >= data.length - endFade ? (data.length - i) / endFade : 1;
    data[i] *= level * tail;
  }
  return { buffer, pitch };
}

function sampleFor(context: BaseAudioContext, instrument: MusicInstrument, pitch: number): VoiceSample {
  let cache = caches.get(context);
  if (!cache) {
    cache = { samples: new Map() };
    caches.set(context, cache);
  }
  // Octave samples keep plucks tuned and natural without a buffer for every note.
  const reference = instrument === 'frameDrum' ? 36 : Math.max(36, Math.min(84, Math.round(pitch / 12) * 12));
  const key = `${instrument}:${reference}`;
  const existing = cache.samples.get(key);
  if (existing) {
    cache.samples.delete(key);
    cache.samples.set(key, existing);
    return existing;
  }
  const sample = makeSample(context, instrument, reference);
  cache.samples.set(key, sample);
  if (cache.samples.size > CACHE_LIMIT) cache.samples.delete(cache.samples.keys().next().value!);
  return sample;
}

/** Warm the complete palette between frames before starting the first bar. */
export function primeMusicVoices(
  context: BaseAudioContext, shouldContinue: () => boolean = () => true,
): Promise<void> {
  if (preparedContexts.has(context) || context.state === 'closed' || !shouldContinue()) return Promise.resolve();
  const existing = preparations.get(context);
  // A new session may arrive while the previous session is cancelling its warmup.
  if (existing) return existing.then(() => primeMusicVoices(context, shouldContinue));
  const preparation = (async () => {
    const palette: readonly (readonly [MusicInstrument, readonly number[]])[] = [
      ['strings', [36, 48, 60, 72]], ['harp', [48, 60, 72, 84]],
      ['lute', [48, 60, 72]], ['flute', [60, 72, 84]], ['frameDrum', [36]],
    ];
    for (const [instrument, pitches] of palette) {
      for (const pitch of pitches) {
        await new Promise<void>(resolve => setTimeout(resolve, 4));
        if (context.state === 'closed' || !shouldContinue()) return;
        sampleFor(context, instrument, pitch);
      }
    }
    preparedContexts.add(context);
  })().finally(() => preparations.delete(context));
  preparations.set(context, preparation);
  return preparation;
}

const TONE_LEVEL: Record<MusicInstrument, number> = {
  lute: 0.17, harp: 0.15, flute: 0.12, strings: 0.085, frameDrum: 0.09,
};
const ATTACK: Record<MusicInstrument, number> = {
  lute: 0.006, harp: 0.009, flute: 0.13, strings: 0.72, frameDrum: 0.003,
};
const RELEASE: Record<MusicInstrument, number> = {
  lute: 0.42, harp: 0.75, flute: 0.36, strings: 1.15, frameDrum: 0.12,
};

/** Shared by the realtime score and offline previews. The caller owns the mix/reverb. */
export function renderNote(
  context: BaseAudioContext, output: AudioNode, note: ScoreNote,
  startTime: number, durationSeconds: number,
): MusicVoice {
  const instrument = note.instrument;
  const pitch = Math.max(28, Math.min(88, Number.isFinite(note.pitch) ? note.pitch : 60));
  const sample = sampleFor(context, instrument, pitch);
  const source = context.createBufferSource();
  const gain = context.createGain();
  const panner = context.createStereoPanner();
  const start = Math.max(context.currentTime, Number.isFinite(startTime) ? startTime : context.currentTime);
  const duration = Math.max(0.08, Math.min(8, Number.isFinite(durationSeconds) ? durationSeconds : 1));
  const attack = Math.min(ATTACK[instrument], duration * 0.3);
  const release = RELEASE[instrument];
  const level = Math.max(0, Math.min(1, Number.isFinite(note.velocity) ? note.velocity : 0.4)) * TONE_LEVEL[instrument];
  const playbackRate = 2 ** ((pitch - sample.pitch) / 12);
  // Source duration may be shorter when a sample is pitched up; always finish quietly.
  const end = Math.min(start + duration + release, start + sample.buffer.duration / playbackRate - 0.012);
  const sustainEnd = Math.max(start + attack, Math.min(start + duration, end - release));
  let ended = false;
  const handle: MusicVoice = {
    stop(when?: number) {
      if (ended) return;
      const time = Math.max(context.currentTime, when ?? context.currentTime);
      try { source.stop(time); } catch { /* Already stopped by its envelope. */ }
      if (when === undefined || time <= context.currentTime || context.state === 'suspended' || context.state === 'closed') cleanup();
    },
  };
  const cleanup = () => {
    if (ended) return;
    ended = true;
    source.onended = null;
    source.disconnect();
    gain.disconnect();
    panner.disconnect();
    handle.onended?.();
  };
  source.buffer = sample.buffer;
  source.playbackRate.value = playbackRate;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + attack);
  gain.gain.setValueAtTime(level, sustainEnd);
  gain.gain.linearRampToValueAtTime(0, end);
  panner.pan.value = Math.max(-0.75, Math.min(0.75, Number.isFinite(note.pan) ? note.pan : 0));
  source.connect(gain);
  gain.connect(panner);
  panner.connect(output);
  source.onended = cleanup;
  source.start(start);
  source.stop(end + 0.01);
  return handle;
}
