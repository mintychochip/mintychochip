import { drawText, textWidth } from '../lib/font.mjs';
import { ramp, rng } from '../lib/pixel.mjs';

// Doom-style fire rising off the name, plus embers. The simulation is
// cross-faded into its own start so the loop has no visible seam.
export const palette = [
  '#0d1117', // 0 background
  '#2b0b05', // 1
  '#5e1406', // 2
  '#9b240a', // 3
  '#d4420f', // 4
  '#f47a1f', // 5
  '#fbb03b', // 6
  '#fde27a', // 7
  '#fff7d9', // 8 white-hot
];
export const delay = 5;

const FRAMES = 48;
const BLEND = 12;
const WARMUP = 90;
const HEAT = 36;
const FIRE = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function render(W, H) {
  const random = rng(0xf12e);
  const name = 'mintychochip';
  const nameW = textWidth(name, 2);
  const nx = Math.round((W - nameW) / 2);
  const ny = 36;

  const overlay = new Int8Array(W * H).fill(-1);
  const letters = [];
  const tops = new Map();
  drawText(name, nx, ny, 2, (x, y, row) => {
    overlay[y * W + x] = row < 10 ? 8 : 7;
    letters.push(y * W + x);
    if (!(tops.get(x) <= y)) tops.set(x, y);
  });
  // Only the top of each column burns, so flames never fill the letters'
  // counters or the gaps between them.
  const sources = [...tops].map(([x, y]) => y * W + x);
  for (const i of letters) {
    for (const j of [i - 1, i + 1, i - W, i + W, i - W - 1, i - W + 1, i + W - 1, i + W + 1]) {
      if (overlay[j] < 0) overlay[j] = 0;
    }
  }
  const sub = 'software engineer';
  drawText(sub, Math.round((W - textWidth(sub)) / 2), 62, 1, (x, y) => (overlay[y * W + x] = 4));

  const heat = new Float32Array(W * H);
  const history = [];
  for (let step = 0; step < WARMUP + FRAMES + BLEND; step++) {
    for (const i of sources) heat[i] = HEAT;
    for (let y = 1; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tx = x + Math.floor(random() * 3) - 1;
        if (tx < 0 || tx >= W) continue;
        const r = random();
        const cool = r < 0.45 ? 2 : r < 0.72 ? 1 : 0;
        heat[(y - 1) * W + tx] = Math.max(0, heat[y * W + x] - cool);
      }
    }
    if (step >= WARMUP) history.push(heat.slice());
  }

  const embers = Array.from({ length: 16 }, () => ({
    x: nx + random() * nameW,
    phase: random(),
    rise: 26 + random() * 14,
    sway: random() * 2 * Math.PI,
  }));

  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const a = history[f];
    const b = f < BLEND ? history[FRAMES + f] : null;
    const w = f / BLEND;
    const px = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const h = b ? a[i] * w + b[i] * (1 - w) : a[i];
        px[i] = ramp((h / HEAT) ** 1.1, FIRE, x, y);
      }
    }
    const t = f / FRAMES;
    for (const e of embers) {
      const k = (t + e.phase) % 1;
      if (k > 0.9) continue;
      const x = Math.round(e.x + 2.5 * Math.sin(4 * Math.PI * k + e.sway));
      const y = Math.round(ny + 2 - k * e.rise);
      if (x >= 0 && y >= 0 && x < W) px[y * W + x] = k < 0.35 ? 8 : k < 0.6 ? 7 : k < 0.8 ? 6 : 4;
    }
    for (let i = 0; i < px.length; i++) if (overlay[i] >= 0) px[i] = overlay[i];
    frames.push(px);
  }
  return frames;
}
