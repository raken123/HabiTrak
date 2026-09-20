// Imagine, part one: deciding what the picture is.
//
// This file turns a sentence into a scene, and nothing in it touches a canvas.
// That split is the whole architecture: the planner is pure, so it can be
// tested in Node with no browser and no pixels, and the painter is dumb, so a
// picture can never contain something the plan did not ask for.
//
// It also gives the two models something honest to share. Hazelnut 2.5 and
// Hazelnut 5 Pro plan a picture identically and draw it completely
// differently, which is what makes a side-by-side comparison fair: same seed,
// same prompt, same scene, and every visible difference is the renderer.
//
// The vocabulary is finite and written down. A synthesiser can only draw what
// somebody taught it to draw, and pretending otherwise would be the same lie
// as a confidence score with nothing behind it — so `parse` reports what it
// recognised and what it ignored, and the UI shows both.

import { modelThinks, modelMaxEdge } from './models.js';

/* ── the vocabulary ──────────────────────────────────────────────────────── */

/** Things that can stand in a scene. */
const OBJECTS = {
  tree: ['tree', 'trees', 'oak', 'pine', 'palm'],
  house: ['house', 'houses', 'cottage', 'cabin', 'home', 'hut'],
  car: ['car', 'cars', 'van', 'truck'],
  boat: ['boat', 'boats', 'ship', 'sailboat', 'yacht'],
  cat: ['cat', 'cats', 'kitten'],
  dog: ['dog', 'dogs', 'puppy'],
  bird: ['bird', 'birds', 'gull', 'gulls', 'crow'],
  flower: ['flower', 'flowers', 'tulip', 'rose', 'daisy'],
  cup: ['cup', 'mug', 'coffee', 'tea'],
  balloon: ['balloon', 'balloons'],
  lighthouse: ['lighthouse'],
  windmill: ['windmill', 'turbine', 'turbines'],
};

/** What the ground does. One per picture. */
const TERRAIN = {
  mountains: ['mountain', 'mountains', 'peak', 'peaks', 'alps', 'range'],
  hills: ['hill', 'hills', 'meadow', 'countryside', 'valley'],
  sea: ['sea', 'ocean', 'beach', 'coast', 'shore', 'waves'],
  field: ['field', 'fields', 'grass', 'lawn', 'prairie'],
  forest: ['forest', 'woods', 'woodland', 'jungle'],
  city: ['city', 'skyline', 'town', 'street', 'buildings', 'urban'],
  desert: ['desert', 'dunes', 'sand'],
  lake: ['lake', 'pond', 'river'],
};

const TIMES = {
  golden: ['sunset', 'dusk', 'golden', 'evening', 'sundown'],
  dawn: ['sunrise', 'dawn', 'daybreak'],
  night: ['night', 'midnight', 'moon', 'moonlit', 'stars', 'starry'],
  overcast: ['overcast', 'cloudy', 'grey', 'gray', 'dull'],
  day: ['day', 'daytime', 'noon', 'sunny', 'bright'],
};

const WEATHER = {
  rain: ['rain', 'rainy', 'drizzle', 'wet'],
  snow: ['snow', 'snowy', 'blizzard', 'winter'],
  fog: ['fog', 'foggy', 'mist', 'misty', 'haze'],
  storm: ['storm', 'stormy', 'thunder', 'lightning'],
};

const STYLES = {
  painting: ['painting', 'painted', 'oil', 'watercolour', 'watercolor', 'impressionist'],
  cartoon: ['cartoon', 'comic', 'illustration', 'illustrated', 'drawing'],
  photo: ['photo', 'photograph', 'photographic', 'realistic', 'photoreal'],
};

/** Subjects made of words. These are where the thinking pass earns its keep. */
const DOCUMENTS = {
  worksheet: ['worksheet', 'worksheets', 'homework', 'sheet', 'sheets', 'quiz', 'test', 'exam', 'problems', 'questions', 'maths', 'math'],
  poster: ['poster', 'flyer', 'advert', 'advertisement'],
  sign: ['sign', 'signpost', 'banner', 'nameplate'],
  menu: ['menu'],
  certificate: ['certificate', 'award', 'diploma'],
};

const PEOPLE = ['person', 'people', 'man', 'woman', 'child', 'kid', 'portrait', 'face', 'figure', 'someone'];
const HANDS = ['hand', 'hands', 'fingers', 'holding', 'waving', 'palm'];

const COLOURS = {
  red: '#c8402f', orange: '#d97a2b', yellow: '#d9b53a', green: '#3f7d4e',
  blue: '#3a6ea8', purple: '#6b4a87', pink: '#c4708f', brown: '#6d5137',
  black: '#25262b', white: '#e9e6df', grey: '#8b8d93', gray: '#8b8d93',
  teal: '#2f7d78', gold: '#b98f36',
};

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/* ── parsing ─────────────────────────────────────────────────────────────── */

/**
 * Read the prompt. Returns what was understood *and* what was not, because a
 * generator that silently drops half a sentence is lying about what it drew.
 */
export function parse(prompt = '') {
  const raw = String(prompt || '');
  const words = raw.toLowerCase().match(/[a-z0-9'’]+/g) || [];
  const used = new Set();
  const claim = (i) => used.add(i);

  const found = {
    objects: [],       // { what, count }
    terrain: null,
    time: null,
    weather: null,
    style: null,
    document: null,
    people: 0,
    hands: false,
    colours: [],
    title: null,
  };

  const lookup = (table) => {
    const index = new Map();
    for (const [key, list] of Object.entries(table)) for (const w of list) index.set(w, key);
    return index;
  };
  const objectIndex = lookup(OBJECTS);
  const terrainIndex = lookup(TERRAIN);
  const timeIndex = lookup(TIMES);
  const weatherIndex = lookup(WEATHER);
  const styleIndex = lookup(STYLES);
  const docIndex = lookup(DOCUMENTS);

  words.forEach((word, i) => {
    // "three balloons" and "three red balloons" mean the same number, so the
    // count is looked for a little way back rather than immediately before.
    const countBefore = () => {
      for (let j = i - 1; j >= Math.max(0, i - 3); j -= 1) {
        const prev = words[j];
        if (NUMBER_WORDS[prev] != null) { claim(j); return NUMBER_WORDS[prev]; }
        if (/^\d+$/.test(prev)) { claim(j); return Math.min(12, Number(prev)); }
      }
      return 1;
    };

    if (docIndex.has(word)) { found.document = docIndex.get(word); claim(i); return; }
    if (objectIndex.has(word)) {
      const what = objectIndex.get(word);
      const counted = countBefore();
      const count = counted > 1 ? counted
        : (/s$/.test(word) && !/ss$/.test(word) ? 3 : 1);
      const existing = found.objects.find((o) => o.what === what);
      if (existing) existing.count = Math.max(existing.count, count);
      else found.objects.push({ what, count });
      claim(i); return;
    }
    if (terrainIndex.has(word)) { found.terrain = found.terrain || terrainIndex.get(word); claim(i); return; }
    if (timeIndex.has(word)) { found.time = found.time || timeIndex.get(word); claim(i); return; }
    if (weatherIndex.has(word)) { found.weather = found.weather || weatherIndex.get(word); claim(i); return; }
    if (styleIndex.has(word)) { found.style = found.style || styleIndex.get(word); claim(i); return; }
    if (PEOPLE.includes(word)) { found.people = Math.max(found.people, countBefore()); claim(i); return; }
    if (HANDS.includes(word)) { found.hands = true; if (!found.people) found.people = 1; claim(i); return; }
    if (COLOURS[word]) { found.colours.push(COLOURS[word]); claim(i); return; }
  });

  // Anything in quotes is wanted verbatim — a sign that says "OPEN", a poster
  // titled "SUMMER FETE". This is the one place the prompt is taken literally.
  const quoted = raw.match(/["“']([^"”']{1,48})["”']/);
  if (quoted) found.title = quoted[1].trim();

  const ignored = words.filter((w, i) => !used.has(i) && !STOPWORDS.has(w) && w.length > 2);

  return { ...found, words, ignored: [...new Set(ignored)] };
}

const STOPWORDS = new Set([
  'the', 'and', 'with', 'of', 'in', 'on', 'at', 'for', 'a', 'an', 'is', 'are',
  'to', 'by', 'from', 'that', 'this', 'it', 'its', 'as', 'into', 'over',
  'under', 'near', 'some', 'very', 'quite', 'make', 'draw', 'generate',
  'picture', 'image', 'create', 'show', 'me', 'please', 'nice', 'good',
]);

/* ── the seeded random source ────────────────────────────────────────────── */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed for a prompt, so the same words give the same picture. */
export function seedFor(prompt = '', salt = 0) {
  let h = 2166136261 >>> 0;
  const s = `${prompt}|${salt}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ── composing the scene ─────────────────────────────────────────────────── */

const PALETTES = {
  day:      { sky: ['#8fb9dd', '#cfe2f0'], sun: '#fdf6e0', ground: '#5d7f4c', haze: '#dbe8f2' },
  golden:   { sky: ['#e08a4a', '#f6cf92'], sun: '#fff0c2', ground: '#6a5a38', haze: '#f2cfa2' },
  dawn:     { sky: ['#8d7aa8', '#f0b9a8'], sun: '#ffe8d6', ground: '#4f5d52', haze: '#e6c9c4' },
  night:    { sky: ['#101a30', '#28365a'], sun: '#dfe6ff', ground: '#1d2430', haze: '#2a3550' },
  overcast: { sky: ['#9aa3ac', '#c6ccd2'], sun: '#d9dde1', ground: '#5a6551', haze: '#c2c8cd' },
};

/**
 * Build the full plan. This is what both renderers are handed.
 *
 * @param {{prompt:string, model:string, edition:string, width?:number,
 *          height?:number, seed?:number}} opts
 */
export function planImage({
  prompt = '',
  model = 'hazelnut-2.5',
  edition = 'trial',
  width = 1024,
  height = 1024,
  seed = null,
} = {}) {
  const parsed = parse(prompt);
  const thinks = modelThinks(model, edition);
  const cap = modelMaxEdge(model, edition);
  const scale = Math.min(1, cap / Math.max(width, height));
  const w = Math.max(64, Math.round(width * scale));
  const h = Math.max(64, Math.round(height * scale));

  const usedSeed = seed == null ? seedFor(prompt) : seed >>> 0;
  const rand = mulberry32(usedSeed);

  const time = parsed.time || (parsed.weather === 'storm' ? 'overcast' : 'day');
  const palette = { ...PALETTES[time] };
  if (parsed.colours.length) palette.accent = parsed.colours[0];

  const notes = [];
  const warnings = [];

  // A document is a different kind of picture: a flat sheet, not a scene. When
  // the prompt asks for one, everything else in it becomes decoration.
  const doc = parsed.document
    ? buildDocument({ kind: parsed.document, parsed, rand, thinks, notes, warnings })
    : null;

  const layers = [];
  if (!doc) {
    const terrain = parsed.terrain || (parsed.objects.length || parsed.people ? 'field' : 'hills');
    layers.push({ kind: 'sky', time, weather: parsed.weather, palette });
    layers.push({ kind: 'terrain', form: terrain, palette, seed: Math.floor(rand() * 1e9) });

    for (const { what, count } of parsed.objects) {
      const n = Math.min(count, 9);
      for (let i = 0; i < n; i += 1) {
        layers.push({
          kind: 'object', what,
          x: n === 1 ? 0.3 + rand() * 0.4 : (i + 0.5) / n + (rand() - 0.5) * 0.12,
          y: 0.62 + rand() * 0.18,
          scale: 0.7 + rand() * 0.5,
          tint: parsed.colours[i % Math.max(1, parsed.colours.length)] || null,
          seed: Math.floor(rand() * 1e9),
        });
      }
    }

    for (let i = 0; i < Math.min(parsed.people, 4); i += 1) {
      layers.push({
        kind: 'person',
        x: parsed.people === 1 ? 0.5 : (i + 0.5) / parsed.people,
        y: 0.74,
        scale: 0.9 + rand() * 0.25,
        hands: parsed.hands,
        seed: Math.floor(rand() * 1e9),
      });
    }
    if (parsed.weather) layers.push({ kind: 'weather', what: parsed.weather, seed: Math.floor(rand() * 1e9) });
  } else {
    layers.push({ kind: 'document', doc });
  }

  if (parsed.title && !doc) {
    layers.push({ kind: 'caption', text: parsed.title });
  }

  // Does this particular picture make a claim that nobody checked?
  //
  // Not the same question as "can this model produce unchecked claims" — that
  // one is `warnsUnthought` in models.js, and it is about the model. This is
  // about the picture in hand. A drawing of a mountain asserts nothing, so it
  // gets no warning however it was made; a worksheet with answers on it does,
  // and gets one printed into the image.
  const unverified = Boolean(doc && doc.questions.length && !thinks);

  return {
    prompt,
    model,
    edition,
    width: w,
    height: h,
    unverified,
    requested: { width, height },
    clamped: scale < 1,
    seed: usedSeed,
    thought: thinks,
    style: parsed.style || 'photo',
    time,
    weather: parsed.weather,
    palette,
    parsed,
    layers,
    notes,
    warnings,
  };
}

/* ── documents, and the thinking that makes them true ────────────────────── */

/**
 * The difference between the two editions of Hazelnut 5 Pro lives here.
 *
 * With the thinking pass on, the questions are generated *and solved*: the
 * arithmetic is computed, the answers are the answers, and anything that would
 * not come out whole is rejected and drawn again.
 *
 * With it off, the sheet is built to look right and nothing is checked. That is
 * not a stub standing in for real behaviour — it is the behaviour. An
 * unthinking generator produces exactly this: correct typography wrapped around
 * content nobody verified, including divisions that do not divide and a
 * square root of a negative number sitting in a primary-school worksheet.
 *
 * Both paths record what they did in `notes`, so the UI can show the working.
 */
function buildDocument({ kind, parsed, rand, thinks, notes, warnings }) {
  const title = parsed.title || DEFAULT_TITLES[kind] || 'Untitled';

  if (kind !== 'worksheet') {
    const lines = (BODY_LINES[kind] || BODY_LINES.poster).slice();
    notes.push(`Laid out a ${kind} titled “${title}”.`);
    return { kind, title, lines, questions: [], answers: false };
  }

  const questions = [];
  const count = 6;

  if (thinks) {
    notes.push('Planning pass: generating arithmetic, then solving it.');
    let guard = 0;
    while (questions.length < count && guard < 200) {
      guard += 1;
      const q = arithmetic(rand);
      // The check that the trial does not get: reject anything that does not
      // come out whole, and keep the computed answer rather than a plausible one.
      if (q.answer == null || !Number.isInteger(q.answer) || q.answer < 0) continue;
      if (questions.some((other) => other.text === q.text)) continue;
      questions.push({ text: q.text, answer: String(q.answer), solvable: true, checked: true });
    }
    notes.push(`Solved ${questions.length} of ${questions.length} questions. Every answer is computed, not guessed.`);
  } else {
    notes.push('No planning pass on this edition: questions written, nothing solved.');
    let guard = 0;
    while (questions.length < count && guard < 200) {
      guard += 1;
      const q = arithmetic(rand, { allowBroken: true });
      const solvable = q.answer != null && Number.isInteger(q.answer) && q.answer >= 0;
      // An answer that was never computed. It is the right shape and the wrong
      // number, which is the entire failure mode being demonstrated.
      const plausible = String(Math.max(0, Math.round((q.answer ?? 12) + (rand() * 8 - 4) || 7)));
      questions.push({ text: q.text, answer: plausible, solvable, checked: false });
    }
    const broken = questions.filter((q) => !q.solvable).length;
    warnings.push(
      broken
        ? `${broken} of the ${count} questions on this sheet cannot be solved, and none of the answers were checked.`
        : 'None of the answers on this sheet were checked.',
    );
  }

  return { kind, title, lines: [], questions, answers: true };
}

const DEFAULT_TITLES = {
  worksheet: 'Practice Sheet',
  poster: 'NOW OPEN',
  sign: 'OPEN',
  menu: 'Today',
  certificate: 'Certificate',
};

const BODY_LINES = {
  poster: ['Every Saturday', 'from ten until four', 'on the green'],
  sign: ['Mon – Sat', '9 til 5'],
  menu: ['Soup of the day', 'Bread and butter', 'Coffee', 'Cake'],
  certificate: ['awarded to', 'for outstanding effort'],
};

/** One arithmetic question. With `allowBroken`, the nonsense is allowed through. */
function arithmetic(rand, { allowBroken = false } = {}) {
  const pick = rand();
  const a = 2 + Math.floor(rand() * 30);
  const b = 2 + Math.floor(rand() * 12);

  if (pick < 0.3) return { text: `${a} + ${b} =`, answer: a + b };
  if (pick < 0.55) return { text: `${a} − ${b} =`, answer: a - b };
  if (pick < 0.8) return { text: `${a} × ${b} =`, answer: a * b };

  if (allowBroken) {
    // The two failures an unchecked generator reliably produces.
    if (rand() < 0.4) return { text: `${a} ÷ 0 =`, answer: null };
    if (rand() < 0.4) return { text: `√−${b * b} =`, answer: null };
    return { text: `${a} ÷ ${b} =`, answer: a % b === 0 ? a / b : null };
  }
  const product = a * b;
  return { text: `${product} ÷ ${b} =`, answer: a };
}
