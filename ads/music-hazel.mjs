// The Hazel film's music bed, synthesised.
//
// ads/music.mjs is the house bed: A minor, slow, a little solemn. That is the
// right music for a film about what a photograph really contains and the wrong
// music for a squirrel. This one is its cheerful sibling — C major, a marimba
// figure that never stops moving, and a bell on the downbeat — written the same
// way, out of arithmetic, because there is still no sample pack on this machine.
//
//   node ads/music-hazel.mjs out.wav [seconds]

import fs from 'node:fs';

const RATE = 44100;
const DURATION = Number(process.argv[3] || 36);
const OUT = process.argv[2] || 'bed-hazel.wav';

// C major, the friendliest four chords there are: I - V - vi - IV.
const SEMITONES = {
  C2: -21, G2: -14, A2: -12, F2: -16,
  C3: -9, E3: -5, F3: -4, G3: -2, A3: 0, B3: 2,
  C4: 3, D4: 5, E4: 7, F4: 8, G4: 10, A4: 12,
  C5: 15, E5: 19, G5: 22,
};
const hz = (semitone) => 220 * 2 ** (semitone / 12);

const CHORDS = [
  { root: 'C2', notes: ['C4', 'E4', 'G4'], top: 'C5' },
  { root: 'G2', notes: ['B3', 'D4', 'G4'], top: 'G5' },
  { root: 'A2', notes: ['C4', 'E4', 'A4'], top: 'E5' },
  { root: 'F2', notes: ['C4', 'F4', 'A4'], top: 'C5' },
];
const CHORD_SECONDS = 3.4;
const STEP = 0.2125;   // sixteenths at ~141 bpm: the marimba's stride

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A one-pole low pass, to take the edge off the partials. */
function makeLowpass(cutoff) {
  const a = Math.exp((-2 * Math.PI * cutoff) / RATE);
  let last = 0;
  return (x) => (last = x * (1 - a) + last * a);
}

/**
 * A struck wooden bar: a sine with a fast decay, plus the fourth-harmonic
 * partial a real marimba rings at, which is most of what makes it sound
 * wooden rather than like a bare oscillator.
 */
function marimba(f, age) {
  if (age < 0) return 0;
  const body = Math.sin(2 * Math.PI * f * age) * Math.exp(-age * 7.5);
  const ring = Math.sin(2 * Math.PI * f * 4 * age) * Math.exp(-age * 19) * 0.3;
  const knock = Math.exp(-age * 150) * 0.25;
  return body + ring + knock;
}

const n = Math.floor(DURATION * RATE);
const left = new Float32Array(n);
const right = new Float32Array(n);

const padL = makeLowpass(2200);
const padR = makeLowpass(2000);

// The marimba walks up and down the chord rather than cycling it, so the
// figure turns around instead of looping audibly every three notes.
const WALK = [0, 1, 2, 1, 2, 3, 2, 1];

for (let i = 0; i < n; i += 1) {
  const t = i / RATE;
  const bar = Math.floor(t / CHORD_SECONDS);
  const chord = CHORDS[bar % CHORDS.length];
  const inChord = (t % CHORD_SECONDS) / CHORD_SECONDS;

  // Pad: soft, well back, only there so the marimba has a floor to stand on.
  const swell = 0.5 + 0.5 * Math.sin(Math.PI * clamp(inChord * 1.1, 0, 1)) ** 0.7;
  let pad = 0;
  for (const note of chord.notes) {
    const f = hz(SEMITONES[note]);
    pad += Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 1.0015 * t + 0.9);
  }
  pad = (pad / chord.notes.length) * 0.075 * swell;

  // Bass: one round note per chord, plucked rather than held.
  const bassAge = t % CHORD_SECONDS;
  const bassF = hz(SEMITONES[chord.root]);
  const bass = Math.sin(2 * Math.PI * bassF * bassAge)
    * Math.exp(-bassAge * 1.35) * 0.30;

  // Marimba: the tune. Four steps of the chord, up and back.
  const step = Math.floor(t / STEP);
  const age = t - step * STEP;
  const degree = WALK[step % WALK.length];
  const noteName = degree === 3 ? chord.top : chord.notes[degree];
  const lead = marimba(hz(SEMITONES[noteName]), age) * 0.135;

  // And the step before, still ringing — a bar does not stop when the next
  // one is struck, and without this the figure clicks. It may belong to the
  // previous chord, so it is looked up against its own bar and not this one.
  const prevStep = step - 1;
  let tail = 0;
  if (prevStep >= 0) {
    const prevChord = CHORDS[Math.floor((prevStep * STEP) / CHORD_SECONDS) % CHORDS.length];
    const prevDegree = WALK[prevStep % WALK.length];
    const prevName = prevDegree === 3 ? prevChord.top : prevChord.notes[prevDegree];
    tail = marimba(hz(SEMITONES[prevName]), age + STEP) * 0.135;
  }

  // A bell on each chord change, an octave up — the sparkle.
  const bell = Math.sin(2 * Math.PI * hz(SEMITONES[chord.top] + 12) * bassAge)
    * Math.exp(-bassAge * 3.2) * 0.045;

  // Shaker: noise through a decay, on the eighths. Felt, not heard.
  const eighth = t % (STEP * 2);
  const shaker = (Math.random() - 0.5) * Math.exp(-eighth * 42) * 0.05;

  const dry = pad + bass + bell + shaker;
  // The marimba is panned a little wider than everything else, which is what
  // makes it read as an instrument in a room rather than a tone in the middle.
  const wideL = padL(dry + lead * 1.15 + tail * 0.75);
  const wideR = padR(dry + lead * 0.75 + tail * 1.15);

  // Up quickly — she is asleep for the first four seconds, not the first ten —
  // and down under the end card.
  const fade = clamp(t / 1.6, 0, 1) * clamp((DURATION - t) / 3.2, 0, 1);

  left[i] = Math.tanh(wideL * 1.45 * fade) * 0.66;
  right[i] = Math.tanh(wideR * 1.45 * fade) * 0.66;
}

// ── WAV ────────────────────────────────────────────────────────────────────

const data = Buffer.alloc(n * 4);
for (let i = 0; i < n; i += 1) {
  data.writeInt16LE(Math.round(clamp(left[i], -1, 1) * 32767), i * 4);
  data.writeInt16LE(Math.round(clamp(right[i], -1, 1) * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);          // PCM
header.writeUInt16LE(2, 22);          // stereo
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 4, 28);   // byte rate
header.writeUInt16LE(4, 32);          // block align
header.writeUInt16LE(16, 34);         // bits
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

fs.writeFileSync(OUT, Buffer.concat([header, data]));
console.log(`music: ${OUT} — ${DURATION}s, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
