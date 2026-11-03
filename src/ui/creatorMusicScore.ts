import type { MusicProfile, ScoreNote } from '../world/dayMusicScore';

/** An original, lilting welcome in D major: six eighth notes per bar. */
export const CREATOR_MUSIC: Readonly<MusicProfile> = {
  title: 'Una mochila de ilusiones', bpm: 90, beatsPerBar: 3, bars: 32,
};

type ChordName = 'd' | 'g' | 'a' | 'bm' | 'em' | 'asus';
const CHORDS: Record<ChordName, readonly number[]> = {
  d: [50, 57, 62, 66, 69], g: [43, 55, 62, 67, 71],
  a: [45, 57, 61, 64, 69], bm: [47, 54, 59, 62, 66],
  em: [52, 59, 64, 67, 71], asus: [45, 57, 62, 64, 69],
};
const HARMONY: readonly ChordName[] = [
  'd', 'g', 'd', 'a', 'bm', 'g', 'asus', 'd',
  'd', 'g', 'em', 'a', 'bm', 'g', 'a', 'd',
  'g', 'd', 'em', 'a', 'g', 'bm', 'em', 'asus',
  'd', 'g', 'd', 'a', 'bm', 'g', 'asus', 'a',
];
type MelodyNote = readonly [beat: number, pitch: number, duration: number];
// Four eight-bar phrases: invitation, answer, a small discovery, then home.
// Gaps at the ends of phrases give the flute room to breathe.
const MELODY: readonly (readonly MelodyNote[])[] = [
  [[0, 69, .42], [.5, 74, .42], [1, 78, .42], [1.5, 76, .85], [2.5, 74, .38]],
  [[0, 71, .9], [1, 74, .42], [1.5, 79, .85]],
  [[0, 78, .9], [1, 76, .42], [1.5, 74, .85], [2.5, 69, .38]],
  [[0, 73, .85], [1, 71, .4], [1.5, 69, 1]],
  [[.5, 71, .4], [1, 74, .4], [1.5, 78, .9], [2.5, 76, .35]],
  [[0, 74, .9], [1, 71, .4], [1.5, 67, .9]],
  [[0, 69, .9], [1, 74, .4], [1.5, 76, .85]],
  [[0, 78, .4], [.5, 76, .4], [1, 74, 1.15]],
  [[.5, 69, .4], [1, 74, .4], [1.5, 78, .9], [2.5, 81, .35]],
  [[0, 79, .9], [1, 78, .4], [1.5, 74, .85]],
  [[0, 76, .9], [1, 79, .4], [1.5, 78, .4], [2, 76, .75]],
  [[0, 73, .4], [.5, 74, .4], [1, 76, .4], [1.5, 69, 1]],
  [[0, 78, .9], [1, 76, .4], [1.5, 74, .85]],
  [[0, 71, .9], [1, 74, .4], [1.5, 79, .85]],
  [[0, 76, .4], [.5, 74, .4], [1, 73, .4], [1.5, 69, .85]],
  [[0, 74, 1.8]],
  [[.5, 71, .4], [1, 74, .4], [1.5, 79, .9]],
  [[0, 78, .9], [1, 81, .4], [1.5, 78, .85]],
  [[0, 79, .9], [1, 78, .4], [1.5, 76, .9]],
  [[0, 76, .4], [.5, 78, .4], [1, 76, .4], [1.5, 73, 1]],
  [[0, 74, .4], [.5, 79, .4], [1, 78, .4], [1.5, 74, .85]],
  [[0, 78, .9], [1, 76, .4], [1.5, 74, .85]],
  [[.5, 71, .4], [1, 74, .4], [1.5, 76, 1]],
  [[0, 74, .9], [1.5, 73, .9]],
  [[0, 69, .4], [.5, 74, .4], [1, 78, .4], [1.5, 81, .9]],
  [[0, 79, .9], [1, 78, .4], [1.5, 74, .85]],
  [[0, 78, .4], [.5, 76, .4], [1, 74, .4], [1.5, 69, 1]],
  [[0, 73, .9], [1, 76, .4], [1.5, 81, .85]],
  [[0, 78, .9], [1, 76, .4], [1.5, 74, .85]],
  [[0, 71, .4], [.5, 74, .4], [1, 79, .4], [1.5, 78, .4], [2, 74, .7]],
  [[0, 76, .9], [1, 74, .4], [1.5, 73, .85]],
  [[0, 69, 1.3]],
];

export function creatorMusicBar(bar: number): ScoreNote[] {
  const index = ((Math.floor(bar) % CREATOR_MUSIC.bars) + CREATOR_MUSIC.bars) % CREATOR_MUSIC.bars;
  const chord = CHORDS[HARMONY[index]], notes: ScoreNote[] = [];
  const add = (instrument: ScoreNote['instrument'], beat: number, pitch: number,
    duration: number, velocity: number, pan: number) => {
    notes.push({ instrument, beat, pitch, duration, velocity, pan });
  };
  // Two gentle compound beats; the lowest string anchors the little walk.
  [0, 2, 3, 1, 3, 4].forEach((step, eighth) => {
    add('lute', eighth * .5, chord[step], .44, eighth % 3 === 0 ? .54 : .32, -.28);
  });
  add('harp', .03, chord[2] + 12, 1.15, .25, .34);
  if (index % 4 !== 3) add('harp', 1.53, chord[3] + 12, .95, .20, .30);
  for (const [beat, pitch, duration] of MELODY[index]) {
    add('flute', beat + .02, pitch, duration, index >= 16 && index < 24 ? .54 : .60, .08);
  }
  // The middle phrase opens out; the final cadence thins before the loop.
  if (index >= 4 && index !== 31) {
    add('strings', .04, chord[2], 2.65, .19, -.16);
    add('strings', .04, chord[3], 2.65, .16, .17);
    add('frameDrum', 0, 36, .18, .23, -.12);
    if (index % 8 < 6) add('frameDrum', 1.5, 36, .15, .13, .12);
  }
  if (index % 8 === 7) {
    add('harp', 2, chord[3] + 12, .6, .27, .34);
    add('harp', 2.5, chord[4] + 12, .5, .23, .28);
  }
  return notes;
}
