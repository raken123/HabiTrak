// The ad's music bed, synthesised.
//
// There is no audio library and no sample pack on this machine, so the score is
// arithmetic: a slow pad over a four-chord loop, a sub bass, a soft pulse, and
// an arpeggio that comes in once the product is on screen. Written straight out
// as a WAV for ffmpeg to mux.
//
//   node ads/music.mjs out.wav [seconds]

import fs from 'node:fs';

const RATE = 44100;
const DURATION = Number(process.argv[3] || 180);
const OUT = process.argv[2] || 'bed.wav';

// A minor, a common and unfussy progression: i - VI - III - VII.
const SEMITONES = { A2: -12, C3: -9, E3: -5, F3: -4, G3: -2, A3: 0, C4: 3, E4: 7, F4: 8, G4: 10, B3: 2, D4: 5 };
const hz = (semitone) => 220 * 2 ** (semitone / 12);

const CHORDS = [
  { name: 'Am', root: 'A2', notes: ['A3', 'C4', 'E4'] },
  { name: 'F',  root: 'F3', notes: ['F3', 'A3', 'C4'] },
  { name: 'C',  root: 'C3', notes: ['C4', 'E4', 'G4'] },
  { name: 'G',  root: 'G3', notes: ['B3', 'D4', 'G4'] },
];
const CHORD_SECONDS = 7.5;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A one-pole low pass, to take the edge off the saw partials. */
function makeLowpass(cutoff) {
  const a = Math.exp((-2 * Math.PI * cutoff) / RATE);
  let last = 0;
  return (x) => (last = x * (1 - a) + last * a);
}

const n = Math.floor(DURATION * RATE);
const left = new Float32Array(n);
const right = new Float32Array(n);

const padL = makeLowpass(1400);
const padR = makeLowpass(1250);

for (let i = 0; i < n; i += 1) {
  const t = i / RATE;
  const chord = CHORDS[Math.floor(t / CHORD_SECONDS) % CHORDS.length];
  const inChord = (t % CHORD_SECONDS) / CHORD_SECONDS;

  // Pad: each note as three slightly detuned partials, swelling across the bar.
  const swell = 0.35 + 0.65 * Math.sin(Math.PI * clamp(inChord * 1.05, 0, 1)) ** 0.6;
  let pad = 0;
  for (const note of chord.notes) {
    const f = hz(SEMITONES[note]);
    pad += Math.sin(2 * Math.PI * f * t)
         + 0.5 * Math.sin(2 * Math.PI * f * 1.0018 * t + 1.1)
         + 0.28 * Math.sin(2 * Math.PI * f * 2 * t + 0.4);
  }
  pad = (pad / chord.notes.length) * 0.13 * swell;

  // Sub bass, with a gentle octave shimmer.
  const bassF = hz(SEMITONES[chord.root]);
  const bass = (Math.sin(2 * Math.PI * bassF * t) * 0.9
              + Math.sin(2 * Math.PI * bassF * 2 * t) * 0.14) * 0.16;

  // Pulse every 1.25 s — felt more than heard.
  const beat = t % 1.25;
  const pulse = Math.exp(-beat * 26) * Math.sin(2 * Math.PI * 62 * t) * 0.20;

  // Arpeggio joins once the product is on screen and steps out for the cards.
  let arp = 0;
  const arpGain = clamp((t - 15) / 4, 0, 1) * (1 - clamp((t - 163) / 3, 0, 1));
  if (arpGain > 0.001) {
    const step = Math.floor(t / 0.3125);
    const note = chord.notes[step % chord.notes.length];
    const f = hz(SEMITONES[note] + (step % 6 === 5 ? 12 : 0));
    const env = Math.exp(-((t % 0.3125) * 9));
    arp = Math.sin(2 * Math.PI * f * t) * env * 0.055 * arpGain;
  }

  // Air: a whisper of filtered noise so the bed is not sterile.
  const air = (Math.random() - 0.5) * 0.012 * swell;

  const dry = pad + bass + pulse + arp + air;
  const wideL = padL(dry + arp * 0.5);
  const wideR = padR(dry - arp * 0.5);

  // Fade in, and out under the end card.
  const fade = clamp(t / 2.2, 0, 1) * clamp((DURATION - t) / 4.5, 0, 1);

  // Soft clip, so nothing ever slams the ceiling.
  left[i] = Math.tanh(wideL * 1.5 * fade) * 0.62;
  right[i] = Math.tanh(wideR * 1.5 * fade) * 0.62;
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
