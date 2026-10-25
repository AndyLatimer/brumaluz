/** Original Brumaluz themes. All four arrangements share the notes of D Dorian. */
export type DayMusicPhase = 'dawn' | 'day' | 'dusk' | 'night';
export type MusicInstrument = 'lute' | 'harp' | 'flute' | 'strings' | 'frameDrum';

export interface ScoreNote {
  /** Position and length in quarter-note beats, relative to this bar. */
  beat: number;
  pitch: number;
  duration: number;
  velocity: number;
  pan: number;
  instrument: MusicInstrument;
}

export interface MusicProfile {
  title: string;
  bpm: number;
  beatsPerBar: number;
  bars: number;
}

export const MUSIC_PROFILES: Readonly<Record<DayMusicPhase, MusicProfile>> = {
  dawn: { title: 'El valle despierta', bpm: 66, beatsPerBar: 4, bars: 32 },
  day: { title: 'Senderos de Brumaluz', bpm: 78, beatsPerBar: 4, bars: 32 },
  dusk: { title: 'El último dorado', bpm: 62, beatsPerBar: 4, bars: 32 },
  night: { title: 'Luz entre las hojas', bpm: 54, beatsPerBar: 4, bars: 32 },
};

type ChordName = 'dm' | 'f' | 'c' | 'g' | 'am' | 'dsus';
interface Chord { bass: number; body: readonly number[]; pluck: readonly number[] }

// Open voicings leave the centre free for the wooden flute and village sounds.
const CHORDS: Record<ChordName, Chord> = {
  dm: { bass: 38, body: [50, 57, 60, 65], pluck: [50, 57, 62, 65, 69, 72] },
  f: { bass: 41, body: [53, 57, 60, 64], pluck: [53, 60, 65, 69, 72, 76] },
  c: { bass: 36, body: [48, 55, 60, 64], pluck: [48, 55, 60, 64, 67, 72] },
  g: { bass: 43, body: [55, 59, 62, 67], pluck: [55, 62, 67, 71, 74, 79] },
  am: { bass: 45, body: [57, 60, 64, 67], pluck: [57, 64, 69, 72, 76, 79] },
  dsus: { bass: 38, body: [50, 57, 62, 64], pluck: [50, 57, 62, 64, 69, 74] },
};

const HARMONY: Record<DayMusicPhase, readonly ChordName[]> = {
  dawn: [
    'dm', 'dm', 'f', 'f', 'c', 'c', 'g', 'g',
    'dm', 'dm', 'f', 'f', 'c', 'c', 'am', 'dsus',
    'f', 'f', 'c', 'c', 'g', 'g', 'dm', 'dm',
    'f', 'c', 'dm', 'am', 'c', 'g', 'dsus', 'dm',
  ],
  day: [
    'f', 'c', 'g', 'dm', 'f', 'c', 'g', 'g',
    'dm', 'dm', 'f', 'c', 'g', 'g', 'am', 'dm',
    'f', 'f', 'c', 'c', 'g', 'g', 'dm', 'dm',
    'f', 'c', 'g', 'am', 'f', 'c', 'dsus', 'dm',
  ],
  dusk: [
    'f', 'f', 'c', 'c', 'dm', 'dm', 'am', 'am',
    'f', 'f', 'g', 'g', 'c', 'c', 'dsus', 'dm',
    'am', 'am', 'f', 'f', 'c', 'c', 'g', 'g',
    'dm', 'f', 'c', 'am', 'f', 'c', 'dsus', 'dm',
  ],
  night: [
    'dm', 'dm', 'f', 'f', 'c', 'c', 'am', 'am',
    'dm', 'dm', 'c', 'c', 'f', 'f', 'dsus', 'dm',
    'f', 'f', 'c', 'c', 'am', 'am', 'dm', 'dm',
    'f', 'c', 'dm', 'am', 'f', 'c', 'dsus', 'dm',
  ],
};

type MelodyNote = readonly [beat: number, pitch: number, duration: number];
type Melody = readonly (readonly MelodyNote[])[];

// The rising A–D–F and falling E–D–C phrases recur in different registers.
// Empty bars are breaths in the composition, rather than a repeating ostinato.
const MELODIES: Record<DayMusicPhase, Melody> = {
  dawn: [
    [], [[2, 74, 1.4]], [[0, 69, 1.4], [2, 72, 1.2]], [[0, 77, 2], [3, 76, 0.75]],
    [[0, 76, 1.4], [2, 74, 1.2]], [[0, 72, 2], [3, 67, 0.65]],
    [[0, 71, 1.4], [2, 69, 1.3]], [[0, 67, 2.6]],
    [[0.5, 69, 0.8], [2, 74, 1.7]], [[0, 77, 2], [3, 76, 0.7]],
    [[0, 72, 1.4], [2, 69, 1.4]], [[0, 67, 0.8], [1.5, 65, 2]],
    [[0.5, 67, 0.9], [2, 72, 1.5]], [[0, 76, 1], [1.5, 74, 1], [3, 72, 0.7]],
    [[0.5, 71, 1], [2, 69, 1.4]], [[0, 74, 2.7]],
    [[0, 69, 1.3], [2, 72, 1.1]], [[0.5, 77, 2.4]],
    [[0, 76, 1.3], [2, 74, 1.2]], [[0.5, 72, 2.3]],
    [[0, 74, 1.4], [2, 71, 1.1]], [[0, 69, 1], [1.5, 67, 1.8]],
    [[0.5, 65, 0.9], [2, 69, 1.4]], [[0, 74, 2.8]],
    [], [[1, 67, 1], [2.5, 72, 1.1]], [[0, 74, 1.2], [2, 77, 1.2]],
    [[0, 76, 1.4], [2, 72, 1.5]], [[0, 72, 1.3], [2, 67, 1.1]],
    [[0.5, 71, 1], [2, 67, 1.2]], [[0, 76, 1], [1.5, 74, 2]], [],
  ],
  day: [
    [[0.5, 69, 0.7], [1.5, 72, 0.9], [3, 77, 0.65]],
    [[0, 76, 1.1], [1.5, 74, 0.7], [2.5, 72, 1]],
    [[0.5, 71, 0.9], [2, 74, 1.2]], [[0, 69, 1.1], [2, 74, 1.6]],
    [[0.5, 77, 0.8], [1.5, 76, 0.7], [3, 72, 0.65]],
    [[0, 67, 0.8], [1.5, 72, 0.8], [3, 76, 0.65]],
    [[0.5, 74, 0.9], [2, 71, 1.1]], [[0, 67, 2.2]],
    [], [[1, 69, 0.8], [2.5, 74, 1]],
    [[0, 77, 1.1], [1.5, 76, 0.7], [2.5, 72, 1.1]],
    [[0.5, 67, 0.8], [2, 72, 1.5]],
    [[0, 74, 0.8], [1.5, 71, 0.8], [3, 69, 0.65]], [[0.5, 67, 2.1]],
    [[0, 72, 1.1], [1.5, 71, 0.8], [3, 69, 0.65]], [[0.5, 74, 2.5]],
    [[0.5, 69, 0.7], [1.5, 72, 0.9], [3, 77, 0.65]],
    [[0, 76, 0.9], [1.5, 72, 0.8], [3, 69, 0.65]],
    [[0.5, 67, 0.8], [2, 72, 1.3]], [[0, 76, 1.1], [1.5, 74, 0.8], [3, 72, 0.6]],
    [[0.5, 71, 0.8], [1.5, 74, 0.9], [3, 79, 0.6]],
    [[0, 76, 1], [1.5, 74, 0.8], [3, 71, 0.65]],
    [[0.5, 69, 1], [2, 65, 1.2]], [[0, 74, 2.7]],
    [], [[0.5, 67, 0.8], [2, 72, 1.2]], [[0, 74, 1], [1.5, 71, 0.8], [3, 67, 0.65]],
    [[0.5, 69, 1.1], [2, 72, 1.3]], [[0, 77, 1.1], [1.5, 76, 0.8], [3, 72, 0.65]],
    [[0.5, 67, 0.8], [2, 72, 1.3]], [[0, 76, 1.1], [1.5, 74, 2]], [],
  ],
  dusk: [
    [], [[1, 72, 2]], [[0, 76, 1.5], [2.5, 74, 1]], [[0.5, 72, 2.5]],
    [[0, 69, 1.4], [2, 74, 1.4]], [[0.5, 77, 1.7], [3, 76, 0.7]],
    [[0, 72, 1.5], [2.5, 71, 1]], [[0.5, 69, 2.5]],
    [[0, 69, 1.3], [2, 72, 1.4]], [[0.5, 77, 2.2]],
    [[0, 74, 1.4], [2.5, 71, 1]], [[0.5, 67, 2.5]],
    [[0, 67, 1.4], [2, 72, 1.4]], [[0.5, 76, 1.4], [2.5, 74, 1]],
    [[0, 76, 1.2], [2, 74, 1.5]], [],
    [[0.5, 72, 1.5], [2.5, 69, 1]], [[0, 76, 2.2]],
    [[0.5, 77, 1.3], [2.5, 76, 1]], [[0, 72, 2.8]],
    [[0.5, 67, 1.4], [2.5, 72, 1]], [[0, 76, 1.3], [2, 74, 1.5]],
    [[0.5, 71, 1.4], [2.5, 69, 1]], [[0, 67, 2.7]],
    [[0.5, 69, 1.1], [2, 74, 1.5]], [[0, 77, 2]],
    [[0.5, 76, 1.3], [2.5, 72, 1]], [[0, 69, 2.5]],
    [[0.5, 65, 1.2], [2, 69, 1.4]], [[0, 67, 1.3], [2, 72, 1.4]],
    [[0, 76, 1.1], [1.5, 74, 2.1]], [],
  ],
  night: [
    [], [], [[1, 69, 2]], [[0.5, 72, 2.5]],
    [], [[1, 76, 1.3], [2.75, 74, 0.9]], [[0.5, 72, 2.4]], [],
    [[1, 69, 1.2], [2.5, 74, 1]], [[0.5, 77, 2.4]],
    [[1, 76, 1.3], [2.75, 74, 0.9]], [[0.5, 72, 2.5]],
    [], [[1, 69, 2.2]], [[0.5, 76, 1.2], [2.5, 74, 1.2]], [],
    [[1, 72, 2.3]], [], [[0.5, 76, 1.4], [2.5, 74, 1]], [[0.5, 72, 2.6]],
    [[1, 71, 1.2], [2.5, 69, 1]], [], [[0.5, 65, 1.3], [2.5, 69, 1.1]],
    [[0.5, 74, 2.7]], [], [[1, 67, 1.2], [2.5, 72, 1]],
    [[0.5, 74, 2.6]], [[1, 72, 1.2], [2.5, 69, 1]], [],
    [[0.5, 67, 1.4], [2.5, 72, 1]], [[0.5, 76, 1.1], [2, 74, 1.6]], [],
  ],
};

function put(
  notes: ScoreNote[], instrument: MusicInstrument, beat: number, pitch: number,
  duration: number, velocity: number, pan: number,
): void {
  notes.push({ beat, pitch, duration, velocity, pan, instrument });
}

/** A complete, deterministic bar; barIndex may grow without resetting the score. */
export function musicBar(phase: DayMusicPhase, barIndex: number): ScoreNote[] {
  const absoluteBar = Math.max(0, Math.floor(Number.isFinite(barIndex) ? barIndex : 0));
  const bar = absoluteBar % 32;
  const cycle = Math.floor(absoluteBar / 32);
  const chord = CHORDS[HARMONY[phase][bar]];
  const notes: ScoreNote[] = [];
  const phrase = Math.floor(bar / 8);
  const cadence = bar % 8 === 7;
  const finalCadence = bar === 31;
  // Subtle changes between complete performances; no random notes or timing.
  const touch = 1 + ((bar * 7 + cycle * 3) % 5 - 2) * 0.025;
  const lowerString = phase === 'night' ? 0.27 : phase === 'day' ? 0.3 : 0.34;

  if (phase !== 'night' || bar % 2 === 0 || finalCadence) {
    put(notes, 'strings', 0, chord.bass, finalCadence ? 3.85 : 3.65, lowerString, -0.04);
  }
  const bodyIndices = phase === 'day' ? [1, 3] : phase === 'night' ? [1, 2] : [1, 2, 3];
  for (let i = 0; i < bodyIndices.length; i++) {
    const bodyPitch = chord.body[bodyIndices[i]];
    const quiet = phase === 'night' ? 0.19 : phase === 'day' ? 0.19 : 0.24;
    // A softly spread bow attack, with two voices rather than a dense pad at night.
    put(notes, 'strings', 0.04 + i * 0.055, bodyPitch, 3.65 - i * 0.055,
      quiet * touch, i % 2 ? 0.28 : -0.29);
  }

  if (phase === 'dawn') {
    const pattern = bar % 4 === 3 ? [0.1, 2.2] : bar % 2 ? [0.12, 1.65, 3.05] : [0.1, 1.1, 2.65];
    const degrees = bar % 2 ? [1, 3, 4] : [0, 2, 4];
    pattern.forEach((beat, i) => {
      if (finalCadence && i > 0) return;
      put(notes, 'harp', beat, chord.pluck[degrees[i]], 1.65,
        (i === 0 ? 0.54 : 0.42) * touch, -0.27 + i * 0.16);
    });
    if (phrase === 2 && bar % 2 === 0) {
      put(notes, 'lute', 3.45, chord.pluck[3], 0.45, 0.24, 0.24);
    }
  } else if (phase === 'day') {
    const pattern = cadence ? [0.06, 1.55, 2.65] : bar % 2 ? [0.05, 0.85, 1.55, 2.55, 3.25] : [0.05, 1.05, 1.8, 2.6, 3.5];
    const degrees = bar % 2 ? [0, 2, 3, 1, 4] : [0, 2, 4, 3, 2];
    pattern.forEach((beat, i) => {
      if (finalCadence && i > 1) return;
      put(notes, 'lute', beat, chord.pluck[degrees[i]], i === 0 ? 1.15 : 0.72,
        (i === 0 ? 0.49 : 0.34) * touch, -0.3);
    });
    if (!cadence && bar % 4 === 2) put(notes, 'harp', 2.1, chord.pluck[5], 1.4, 0.24, 0.34);
    // A distant frame drum appears in the middle phrases, leaving the intro open.
    if (bar >= 8 && bar < 28 && !cadence) {
      put(notes, 'frameDrum', 0, 36, 0.45, 0.32, 0.13);
      if (bar % 2 === 0) put(notes, 'frameDrum', 2.5, 43, 0.3, 0.17, 0.15);
    }
  } else if (phase === 'dusk') {
    const pattern = cadence ? [0.12, 2.3] : [0.12, 1.65, 3.05];
    const degrees = bar % 2 ? [1, 3, 2] : [0, 2, 3];
    pattern.forEach((beat, i) => {
      if (finalCadence && i > 0) return;
      put(notes, 'lute', beat, chord.pluck[degrees[i]], 1.65,
        (i === 0 ? 0.47 : 0.35) * touch, -0.25);
    });
    if (bar % 4 === 1 && bar < 29) put(notes, 'harp', 2.55, chord.pluck[4], 1.7, 0.27, 0.32);
  } else {
    const pattern = bar % 4 === 3 ? [0.2] : bar % 2 ? [1.65, 3.05] : [0.15, 2.55];
    const degrees = bar % 2 ? [3, 4] : [2, 4];
    pattern.forEach((beat, i) => {
      if (finalCadence && i > 0) return;
      put(notes, 'harp', beat, chord.pluck[degrees[i]], 2.2,
        (i === 0 ? 0.36 : 0.28) * touch, i % 2 ? 0.32 : -0.24);
    });
  }

  const melody = MELODIES[phase][bar];
  // One phrase rests on every third performance, so the landscape can breathe.
  const restingPhrase = cycle % 3 === 2 && phrase === 1;
  if (!restingPhrase) {
    melody.forEach(([beat, pitch, duration], index) => {
      const level = phase === 'night' ? 0.35 : phase === 'dusk' ? 0.42 : phase === 'day' ? 0.43 : 0.41;
      put(notes, 'flute', beat + 0.035, pitch, duration,
        level * touch * (index === 0 ? 1 : 0.94), phase === 'night' ? 0.11 : 0.17);
    });
  }

  return notes.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
}
