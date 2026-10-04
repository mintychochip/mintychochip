import { drawText } from '../lib/font.mjs';
import { clamp01, ramp, rng, smoothstep, threshold } from '../lib/pixel.mjs';

// Synthwave dusk: dithered sky, striped sun behind a ridge, and a
// perspective grid that scrolls exactly one cell per loop.
export const palette = [
  '#0b0618', // 0 night
  '#1b0c3a', // 1 indigo
  '#3d1366', // 2 purple
  '#74207f', // 3 plum
  '#c02d77', // 4 magenta
  '#ff4f80', // 5 pink
  '#ff8f5a', // 6 orange
  '#ffd36e', // 7 yellow
  '#fff1d6', // 8 cream
  '#2ee6d6', // 9 cyan
];
export const delay = 5;

const FRAMES = 40;
const HORIZON = 50;
const SUN = { x: 190, y: 46, r: 25 };
const SKY = [0, 1, 2, 3, 4];
const SUNSET = [7, 6, 5, 4];
const GROUND = [0, 1, 2, 3];
const DEPTH = 34;
const SPREAD = 28;

export function render(W, H) {
  const random = rng(0x5e7);
  const ridge = mountains(W, random);
  const stars = Array.from({ length: 42 }, () => ({
    x: Math.floor(random() * W),
    y: Math.floor(random() * (HORIZON - 16)),
    base: 0.45 + 0.55 * random(),
    speed: 1 + Math.floor(random() * 2),
    phase: random(),
  }));

  const text = new Int8Array(W * H).fill(-1);
  const put = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < W && y < H) text[y * W + x] = c;
  };
  drawText('mintychochip', 15, 11, 2, (x, y) => put(x, y, 2));
  drawText('mintychochip', 14, 10, 2, (x, y, row) =>
    put(x, y, row < 9 ? ramp(row / 8, [8, 7], x, y) : ramp((row - 9) / 8, [6, 5, 4], x, y)),
  );
  drawText('software engineer', 14, 34, 1, (x, y) => put(x, y, 9));

  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const t = f / FRAMES;
    const px = new Uint8Array(W * H);
    for (let y = 0; y < HORIZON; y++) {
      for (let x = 0; x < W; x++) px[y * W + x] = ramp((y / HORIZON) ** 1.6, SKY, x, y);
    }
    for (const s of stars) {
      const b = s.base * (0.6 + 0.4 * Math.sin(2 * Math.PI * (s.speed * t + s.phase)));
      if (b > 0.62) px[s.y * W + s.x] = 8;
      else if (b > 0.4) px[s.y * W + s.x] = 3;
    }
    sun(px, W, t);
    for (let x = 0; x < W; x++) {
      for (let y = ridge[x]; y < HORIZON; y++) {
        px[y * W + x] = y === ridge[x] ? 4 : ramp((y - ridge[x]) / 10, [2, 1], x, y);
      }
    }
    ground(px, W, H, t);
    for (let i = 0; i < text.length; i++) if (text[i] >= 0) px[i] = text[i];
    frames.push(px);
  }
  return frames;
}

function sun(px, W, t) {
  const { x: cx, y: cy, r } = SUN;
  for (let y = cy - r; y < HORIZON; y++) {
    const s = (y - (cy - r * 0.55)) / r;
    if (s > 0 && (((s * 4 - t) % 1) + 1) % 1 < 0.12 + 0.5 * s) continue;
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      px[y * W + x] = ramp((y - (cy - r)) / (r * 1.3), SUNSET, x, y);
    }
  }
}

function ground(px, W, H, t) {
  px.fill(5, HORIZON * W, (HORIZON + 1) * W);
  for (let y = HORIZON + 1; y < H; y++) {
    const dy = y - HORIZON;
    const z = DEPTH / dy;
    const across = Math.floor(DEPTH / (dy - 0.5) + t) !== Math.floor(DEPTH / (dy + 0.5) + t);
    const fade = clamp01(1.4 - z / 9);
    const line = z < 3 ? 5 : 4;
    const glow = (1 - dy / (H - HORIZON)) ** 2.2;
    for (let x = 0; x < W; x++) {
      const u = ((x + 0.5 - SUN.x) * z) / SPREAD;
      const along = Math.abs(u - Math.round(u)) < z / SPREAD / 2;
      px[y * W + x] = (across || along) && fade > threshold(x, y) ? line : ramp(glow, GROUND, x, y);
    }
  }
}

function mountains(W, random) {
  const coarse = Array.from({ length: Math.ceil(W / 18) + 2 }, random);
  const fine = Array.from({ length: Math.ceil(W / 6) + 2 }, random);
  const sample = (pts, u) => {
    const i = Math.floor(u);
    const k = (1 - Math.cos((u - i) * Math.PI)) / 2;
    return pts[i] + (pts[i + 1] - pts[i]) * k;
  };
  return Array.from({ length: W }, (_, x) => {
    const rise = smoothstep(84, 150, x) * (1 - 0.75 * Math.exp(-(((x - SUN.x) / 22) ** 2)));
    const h = 2 + rise * (5 + 13 * sample(coarse, x / 18)) + 2.5 * sample(fine, x / 6);
    return HORIZON - Math.round(h);
  });
}
