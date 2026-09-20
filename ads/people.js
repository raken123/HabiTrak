// The people in the recap.
//
// Every chapter of the film is somebody's problem before it is a feature, so
// each one opens on a face. They are drawn here rather than photographed:
// these are illustrations of invented people, and a film about a photo editor
// has no business putting a stranger's face on screen to sell something.
//
// Flat shapes, one light, no attempt at realism — a picture of a person, and
// obviously that.

const SKIN = {
  umber: ['#7d4f35', '#6a4229'],
  amber: ['#c08552', '#a76d3f'],
  sand: ['#dfb183', '#c4966a'],
  fair: ['#eec4a2', '#d6a684'],
  olive: ['#c39267', '#a87950'],
};

/**
 * A head and shoulders on a soft disc.
 *
 * @param {{skin:string, hair:string, hairStyle:string, top:string,
 *          glasses?:boolean, disc?:string, size?:number}} look
 */
export function portrait(look) {
  const size = look.size || 420;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const S = size / 420;
  const cx = size / 2;

  // The disc behind them, and the light falling from the upper left.
  const disc = g.createLinearGradient(0, 0, size, size);
  disc.addColorStop(0, look.disc || '#33271f');
  disc.addColorStop(1, '#1a1512');
  g.fillStyle = disc;
  g.beginPath(); g.arc(cx, cx, size * 0.47, 0, Math.PI * 2); g.fill();

  g.save();
  g.beginPath(); g.arc(cx, cx, size * 0.47, 0, Math.PI * 2); g.clip();

  const [skin, shade] = SKIN[look.skin] || SKIN.sand;
  const shoulderY = 306 * S;
  const headY = 186 * S;
  const headR = 74 * S;

  // Shoulders and collar.
  g.fillStyle = look.top;
  g.beginPath();
  g.moveTo(cx - 168 * S, size);
  g.quadraticCurveTo(cx - 150 * S, shoulderY, cx - 58 * S, shoulderY - 6 * S);
  g.lineTo(cx + 58 * S, shoulderY - 6 * S);
  g.quadraticCurveTo(cx + 150 * S, shoulderY, cx + 168 * S, size);
  g.closePath(); g.fill();
  g.fillStyle = 'rgba(0,0,0,.16)';
  g.beginPath();
  g.moveTo(cx - 40 * S, shoulderY - 6 * S);
  g.quadraticCurveTo(cx, shoulderY + 34 * S, cx + 40 * S, shoulderY - 6 * S);
  g.lineTo(cx + 40 * S, shoulderY + 4 * S);
  g.quadraticCurveTo(cx, shoulderY + 46 * S, cx - 40 * S, shoulderY + 4 * S);
  g.closePath(); g.fill();

  // Neck.
  g.fillStyle = shade;
  g.fillRect(cx - 30 * S, headY + 40 * S, 60 * S, 66 * S);
  g.fillStyle = skin;
  g.fillRect(cx - 30 * S, headY + 40 * S, 60 * S, 46 * S);

  // Ears, then the face over them.
  g.fillStyle = shade;
  g.beginPath(); g.ellipse(cx - headR + 4 * S, headY + 8 * S, 11 * S, 16 * S, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + headR - 4 * S, headY + 8 * S, 11 * S, 16 * S, 0, 0, Math.PI * 2); g.fill();

  g.fillStyle = skin;
  g.beginPath(); g.ellipse(cx, headY, headR, 88 * S, 0, 0, Math.PI * 2); g.fill();
  // The shadow side.
  g.save();
  g.beginPath(); g.ellipse(cx, headY, headR, 88 * S, 0, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(0,0,0,.10)';
  g.fillRect(cx + 26 * S, headY - 100 * S, 120 * S, 220 * S);
  g.restore();

  hair(g, S, cx, headY, headR, look);

  // Brows, eyes, nose, mouth — the least that reads as a face.
  g.strokeStyle = 'rgba(28,20,14,.75)';
  g.lineCap = 'round';
  g.lineWidth = 5 * S;
  for (const dx of [-27 * S, 27 * S]) {
    g.beginPath();
    g.moveTo(cx + dx - 13 * S, headY - 22 * S);
    g.quadraticCurveTo(cx + dx, headY - 27 * S, cx + dx + 13 * S, headY - 21 * S);
    g.stroke();
  }
  g.fillStyle = '#231a14';
  for (const dx of [-27 * S, 27 * S]) {
    g.beginPath(); g.ellipse(cx + dx, headY - 2 * S, 6.5 * S, 7.5 * S, 0, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = shade;
  g.lineWidth = 4 * S;
  g.beginPath();
  g.moveTo(cx - 2 * S, headY + 6 * S);
  g.lineTo(cx - 6 * S, headY + 24 * S);
  g.lineTo(cx + 5 * S, headY + 26 * S);
  g.stroke();

  g.strokeStyle = 'rgba(122,60,48,.85)';
  g.lineWidth = 5.5 * S;
  g.beginPath();
  g.moveTo(cx - 19 * S, headY + 48 * S);
  g.quadraticCurveTo(cx, headY + 60 * S, cx + 19 * S, headY + 47 * S);
  g.stroke();

  if (look.glasses) {
    g.strokeStyle = 'rgba(232,222,210,.85)';
    g.lineWidth = 4 * S;
    for (const dx of [-27 * S, 27 * S]) {
      g.beginPath();
      g.roundRect(cx + dx - 24 * S, headY - 22 * S, 48 * S, 40 * S, 12 * S);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(cx - 3 * S, headY - 4 * S); g.lineTo(cx + 3 * S, headY - 4 * S);
    g.stroke();
  }

  g.restore();
  return c;
}

function hair(g, S, cx, headY, headR, look) {
  const style = look.hairStyle || 'short';
  g.fillStyle = look.hair;

  if (style === 'wrap') {
    // A headscarf, wound and tucked.
    g.beginPath();
    g.ellipse(cx, headY - 14 * S, headR + 10 * S, 74 * S, 0, Math.PI, 0);
    g.fill();
    g.fillRect(cx - headR - 10 * S, headY - 22 * S, (headR + 10 * S) * 2, 26 * S);
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.beginPath();
    g.ellipse(cx - 26 * S, headY - 44 * S, 40 * S, 20 * S, -0.4, 0, Math.PI * 2);
    g.fill();
    return;
  }

  // The cap of hair every style starts from.
  g.beginPath();
  g.ellipse(cx, headY - 10 * S, headR + 4 * S, 72 * S, 0, Math.PI, 0);
  g.fill();

  // Sideburns, rounded rather than squared: a rectangle at the temple reads
  // as a tab stuck to the head at this size.
  const temple = (dx, w, h, y) => {
    g.beginPath();
    g.ellipse(cx + dx, headY + y, w, h, 0, 0, Math.PI * 2);
    g.fill();
  };
  if (style === 'short') {
    temple(-headR + 5 * S, 11 * S, 24 * S, -8 * S);
    temple(headR - 5 * S, 11 * S, 24 * S, -8 * S);
  }
  if (style === 'crop') {
    temple(-headR + 4 * S, 9 * S, 17 * S, -14 * S);
    temple(headR - 4 * S, 9 * S, 17 * S, -14 * S);
  }
  if (style === 'long') {
    g.beginPath();
    g.moveTo(cx - headR - 6 * S, headY - 30 * S);
    g.quadraticCurveTo(cx - headR - 26 * S, headY + 90 * S, cx - headR + 4 * S, headY + 120 * S);
    g.lineTo(cx - headR + 30 * S, headY + 110 * S);
    g.quadraticCurveTo(cx - headR + 2 * S, headY + 40 * S, cx - headR + 16 * S, headY - 20 * S);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(cx + headR + 6 * S, headY - 30 * S);
    g.quadraticCurveTo(cx + headR + 26 * S, headY + 90 * S, cx + headR - 4 * S, headY + 120 * S);
    g.lineTo(cx + headR - 30 * S, headY + 110 * S);
    g.quadraticCurveTo(cx + headR - 2 * S, headY + 40 * S, cx + headR - 16 * S, headY - 20 * S);
    g.closePath(); g.fill();
  }
  if (style === 'bun') {
    g.beginPath(); g.arc(cx + 2 * S, headY - 92 * S, 30 * S, 0, Math.PI * 2); g.fill();
  }
  if (style === 'curls') {
    for (let i = 0; i < 16; i += 1) {
      const a = Math.PI + (i / 15) * Math.PI;
      g.beginPath();
      g.arc(cx + Math.cos(a) * (headR + 2 * S), headY - 12 * S + Math.sin(a) * 66 * S, 22 * S, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** The five people the recap follows, in the order they appear. */
export const CAST = {
  ben: {
    name: 'Ben',
    line: 'Selling a sofa. One photograph, taken on the pavement, in a hurry.',
    look: { skin: 'sand', hair: '#33261d', hairStyle: 'short', top: '#3c5a49', disc: '#2c2a22' },
  },
  priya: {
    name: 'Priya',
    line: 'Has her grandmother’s print. It has a crease through the car and damp in one corner.',
    look: { skin: 'umber', hair: '#1f1713', hairStyle: 'bun', top: '#6d3550', disc: '#2b2027' },
  },
  maya: {
    name: 'Maya',
    line: 'On a library computer. Cannot install anything, and has no key.',
    look: { skin: 'amber', hair: '#241a14', hairStyle: 'curls', top: '#36506e', disc: '#1f2733' },
  },
  tom: {
    name: 'Tom',
    line: 'On the bus with his phone, and no patience for typing a sentence.',
    look: { skin: 'fair', hair: '#7d5a33', hairStyle: 'crop', top: '#7a4a2c', glasses: true, disc: '#2f2620' },
  },
  ana: {
    name: 'Ana',
    line: 'Runs the café on the corner. It changed its name last month.',
    look: { skin: 'olive', hair: '#2a1d16', hairStyle: 'long', top: '#2f5d47', disc: '#222d26' },
  },
};
