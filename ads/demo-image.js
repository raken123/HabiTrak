// The photograph used throughout the ad.
//
// There is no stock library on this machine and no network to fetch one, so
// the demo image is drawn. It is a picture the editor is working ON — never a
// claim about what any model produced. The litter bin near the path exists so
// Realtouch has something worth removing.

export function demoPhoto(width = 1600, height = 1000) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  const H = height * 0.62;              // horizon

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.00, '#1d3557');
  sky.addColorStop(0.45, '#5b7fa6');
  sky.addColorStop(0.78, '#c98f6b');
  sky.addColorStop(1.00, '#f0c9a0');
  g.fillStyle = sky; g.fillRect(0, 0, width, H);

  // Sun and its glow.
  const sunX = width * 0.72, sunY = H * 0.72;
  const glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, height * 0.42);
  glow.addColorStop(0, 'rgba(255,226,180,.95)');
  glow.addColorStop(0.25, 'rgba(255,200,140,.35)');
  glow.addColorStop(1, 'rgba(255,190,130,0)');
  g.fillStyle = glow; g.fillRect(0, 0, width, H);
  g.fillStyle = '#fff0d0';
  g.beginPath(); g.arc(sunX, sunY, height * 0.045, 0, Math.PI * 2); g.fill();

  // Cloud bands, thin and horizontal so they read as evening haze.
  for (let i = 0; i < 26; i += 1) {
    const y = H * (0.1 + Math.random() * 0.55);
    const w = width * (0.08 + Math.random() * 0.3);
    const x = Math.random() * width;
    g.fillStyle = `rgba(255,${190 + Math.random() * 50 | 0},${170 + Math.random() * 60 | 0},${0.05 + Math.random() * 0.12})`;
    g.beginPath();
    g.ellipse(x, y, w, height * (0.004 + Math.random() * 0.012), 0, 0, Math.PI * 2);
    g.fill();
  }

  // Three ridges, each hazier and lighter than the one in front of it.
  const ridge = (base, amp, colour, seed) => {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= width; x += 8) {
      const n = Math.sin((x + seed) / 260) * amp
              + Math.sin((x + seed) / 91) * amp * 0.42
              + Math.cos((x + seed) / 37) * amp * 0.16;
      g.lineTo(x, base + n);
    }
    g.lineTo(width, H); g.closePath(); g.fill();
  };
  ridge(H * 0.80, height * 0.055, '#6b7f9e', 400);
  ridge(H * 0.90, height * 0.050, '#4d5f7d', 1200);
  ridge(H * 1.00, height * 0.045, '#37455e', 90);

  // Ground.
  const ground = g.createLinearGradient(0, H, 0, height);
  ground.addColorStop(0, '#3f5c3c');
  ground.addColorStop(1, '#22331f');
  g.fillStyle = ground; g.fillRect(0, H - 2, width, height - H + 2);

  // A path running back to the horizon.
  g.fillStyle = '#8a7a5e';
  g.beginPath();
  g.moveTo(width * 0.36, height); g.lineTo(width * 0.62, height);
  g.lineTo(width * 0.535, H); g.lineTo(width * 0.505, H);
  g.closePath(); g.fill();

  // Grass, denser and larger toward the camera.
  for (let i = 0; i < 14000; i += 1) {
    const t = Math.random() ** 0.5;
    const y = H + t * (height - H);
    const x = Math.random() * width;
    const len = 3 + t * 13;
    g.strokeStyle = `rgba(${40 + Math.random() * 70 | 0},${80 + Math.random() * 80 | 0},${45 + Math.random() * 45 | 0},${0.25 + t * 0.5})`;
    g.lineWidth = 0.6 + t * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 6, y - len);
    g.stroke();
  }

  // A tree, silhouetted against the sun.
  const tree = (tx, ty, scale, dark) => {
    g.fillStyle = dark ? '#1b2a1c' : '#263a26';
    g.fillRect(tx - 7 * scale, ty - 120 * scale, 14 * scale, 120 * scale);
    for (let i = 0; i < 40; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() ** 0.6 * 78 * scale;
      g.beginPath();
      g.arc(tx + Math.cos(a) * r, ty - 150 * scale + Math.sin(a) * r * 0.75, 26 * scale, 0, Math.PI * 2);
      g.fill();
    }
  };
  tree(width * 0.19, height * 0.80, 1.35, true);
  tree(width * 0.86, height * 0.74, 0.85, false);

  // The litter bin — the thing Realtouch is asked to take out.
  const bx = width * 0.655, by = height * 0.845, bw = 52, bh = 84;
  g.fillStyle = 'rgba(0,0,0,.30)';
  g.beginPath(); g.ellipse(bx + bw / 2, by + bh + 5, bw * 0.85, 11, 0, 0, Math.PI * 2); g.fill();
  const metal = g.createLinearGradient(bx, 0, bx + bw, 0);
  metal.addColorStop(0, '#39434b'); metal.addColorStop(0.4, '#5d6a74'); metal.addColorStop(1, '#2d353b');
  g.fillStyle = metal; g.fillRect(bx, by, bw, bh);
  g.fillStyle = '#657079'; g.fillRect(bx - 4, by - 7, bw + 8, 10);
  g.fillStyle = 'rgba(0,0,0,.22)';
  for (let i = 1; i < 5; i += 1) g.fillRect(bx + 3, by + 14 * i, bw - 6, 3);

  return c.toDataURL('image/jpeg', 0.92);
}
