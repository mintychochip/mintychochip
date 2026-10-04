import { drawText } from '../lib/font.mjs';
import { clamp01, hexToRgb, lerp, ramp, rng, smoothstep, threshold } from '../lib/pixel.mjs';

// Dusk flight over a tiling heightmap, ray-cast one screen column at a time
// (Comanche-style voxel terrain). The camera covers exactly one map period
// per loop, so the end flows straight back into the start.
export const palette = [
  '#121833', // 0 sky top
  '#262c5c', // 1
  '#4f4583', // 2
  '#a2628c', // 3
  '#ec9a7a', // 4 horizon
  '#ffd8a1', // 5 glow
  '#0e2738', // 6 deep water
  '#24607f', // 7 water
  '#17331f', // 8 grass, shadow
  '#335f2e', // 9 grass
  '#7d9c4c', // 10 grass, lit
  '#5f5049', // 11 rock
  '#9c8d80', // 12 rock, lit
  '#f3efe6', // 13 snow
  '#07090f', // 14 text shadow
];
export const delay = 6;

const FRAMES = 60;
const MAP = 256;
const RELIEF = 58;
const WATER = 0.3;
const HORIZON = 30;
const FOCAL = 90;
const FOV = 1.15;
const FAR = 1500;
const HAZE = 260;
const SWAY = 12;
const SKY = [0, 1, 2, 3, 4, 5];
const LIGHT = normalize([0.7, -0.3, 0.6]);

export function render(W, H) {
  const random = rng(0x70ad);
  const height = heightmap(random);
  const rgb = palette.map(hexToRgb);
  const colors = colorMap(height, rgb);
  const dither = nearestPair(rgb, [...Array(14).keys()]);
  const fog = rgb[4];

  const path = (t) => ({ x: MAP / 2 + SWAY * Math.sin(2 * Math.PI * t), y: t * MAP });
  const clearance = Array.from({ length: FRAMES }, (_, f) => {
    const p = path(f / FRAMES);
    let top = 0;
    for (let d = 0; d <= 28; d += 2) {
      for (let s = -6; s <= 6; s += 3) top = Math.max(top, sample(height, p.x + s, p.y + d));
    }
    return Math.max(top, WATER) * RELIEF + 11;
  });
  const altitude = clearance.map((c, f) => {
    let sum = 0;
    for (let k = -6; k <= 6; k++) sum += clearance[(f + k + FRAMES) % FRAMES];
    return Math.max(sum / 13, c - 4);
  });

  const overlay = new Int8Array(W * H).fill(-1);
  const put = (c) => (x, y) => {
    if (x >= 0 && y >= 0 && x < W && y < H) overlay[y * W + x] = c;
  };
  drawText('mintychochip', 11, 5, 2, put(14));
  drawText('software engineer', 11, 27, 1, put(14));
  drawText('mintychochip', 10, 4, 2, put(13));
  drawText('software engineer', 10, 26, 1, put(5));

  const c = [0, 0, 0];
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const t = f / FRAMES;
    const cam = path(t);
    const yaw = Math.atan(((SWAY * 2 * Math.PI) / MAP) * Math.cos(2 * Math.PI * t));
    const alt = altitude[f];
    const px = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) {
      const ang = yaw + ((x + 0.5) / W - 0.5) * FOV;
      const dx = Math.sin(ang);
      const dy = Math.cos(ang);
      const corr = Math.cos(ang - yaw);
      let top = H;
      for (let z = 3; z < FAR && top > 0; z += Math.max(0.4, z * 0.012)) {
        const wx = cam.x + dx * z;
        const wy = cam.y + dy * z;
        const h = Math.max(WATER, sample(height, wx, wy)) * RELIEF;
        const sy = Math.floor(HORIZON + ((alt - h) * FOCAL) / (z * corr));
        if (sy >= top) continue;
        sampleColor(colors, wx, wy, c);
        const k = 1 - Math.exp(-z / HAZE);
        const r = lerp(c[0], fog[0], k);
        const g = lerp(c[1], fog[1], k);
        const b = lerp(c[2], fog[2], k);
        for (let y = Math.max(0, sy); y < top; y++) px[y * W + x] = dither(r, g, b, x, y);
        top = Math.max(0, sy);
      }
      for (let y = 0; y < top; y++) {
        const v = 0.8 * Math.min(1, y / HORIZON) ** 1.3;
        const glow = 0.25 * Math.exp(-(((x - W * 0.8) / 60) ** 2)) * Math.min(1, y / HORIZON) ** 2;
        px[y * W + x] = y >= HORIZON ? 4 : ramp(v + glow, SKY, x, y);
      }
    }
    for (let i = 0; i < px.length; i++) if (overlay[i] >= 0) px[i] = overlay[i];
    frames.push(px);
  }
  return frames;
}

function heightmap(random) {
  const h = new Float32Array(MAP * MAP);
  let amp = 1;
  for (const cells of [4, 8, 16, 32, 64]) {
    const lattice = Float32Array.from({ length: cells * cells }, random);
    const at = (i, j) => lattice[(j % cells) * cells + (i % cells)];
    const size = MAP / cells;
    for (let y = 0; y < MAP; y++) {
      const y0 = Math.floor(y / size);
      const fy = smoothstep(0, 1, y / size - y0);
      for (let x = 0; x < MAP; x++) {
        const x0 = Math.floor(x / size);
        const fx = smoothstep(0, 1, x / size - x0);
        const top = lerp(at(x0, y0), at(x0 + 1, y0), fx);
        const bottom = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx);
        h[y * MAP + x] += amp * lerp(top, bottom, fy);
      }
    }
    amp *= 0.5;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of h) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return h.map((v) => ((v - lo) / (hi - lo)) ** 1.35);
}

function colorMap(height, rgb) {
  const out = new Float32Array(MAP * MAP * 3);
  const mix = (a, b, t, i) => lerp(rgb[a][i], rgb[b][i], clamp01(t));
  for (let y = 0; y < MAP; y++) {
    for (let x = 0; x < MAP; x++) {
      const i = y * MAP + x;
      const h = height[i];
      const sx = ((height[y * MAP + ((x + 1) & 255)] - height[y * MAP + ((x - 1) & 255)]) * RELIEF) / 2;
      const sy = ((height[((y + 1) & 255) * MAP + x] - height[((y - 1) & 255) * MAP + x]) * RELIEF) / 2;
      const n = normalize([-sx, -sy, 1]);
      const l = clamp01(0.15 + 0.85 * (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));
      for (let ch = 0; ch < 3; ch++) {
        let v;
        if (h < WATER) v = mix(6, 7, (h - WATER + 0.12) / 0.12, ch);
        else {
          const grass = l < 0.5 ? mix(8, 9, l * 2, ch) : mix(9, 10, (l - 0.5) * 2, ch);
          const rock = mix(11, 12, l, ch);
          const snow = mix(12, 13, l * 1.4, ch);
          v = lerp(grass, rock, smoothstep(0.52, 0.64, h));
          v = lerp(v, snow, smoothstep(0.76, 0.84, h));
        }
        out[i * 3 + ch] = v;
      }
    }
  }
  return out;
}

function sample(map, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (i, j) => map[((j & 255) << 8) | (i & 255)];
  return lerp(lerp(at(x0, y0), at(x0 + 1, y0), fx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx), fy);
}

function sampleColor(map, x, y, out) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (i, j, ch) => map[(((j & 255) << 8) | (i & 255)) * 3 + ch];
  for (let ch = 0; ch < 3; ch++) {
    out[ch] = lerp(lerp(at(x0, y0, ch), at(x0 + 1, y0, ch), fx), lerp(at(x0, y0 + 1, ch), at(x0 + 1, y0 + 1, ch), fx), fy);
  }
}

// Ordered dither between the two palette colors nearest to an RGB value.
function nearestPair(rgb, allowed) {
  return (r, g, b, x, y) => {
    let i1 = allowed[0];
    let d1 = Infinity;
    let i2 = allowed[0];
    let d2 = Infinity;
    for (const i of allowed) {
      const c = rgb[i];
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < d1) {
        i2 = i1;
        d2 = d1;
        i1 = i;
        d1 = d;
      } else if (d < d2) {
        i2 = i;
        d2 = d;
      }
    }
    const a = rgb[i1];
    const e = rgb[i2].map((v, k) => v - a[k]);
    const s = ((r - a[0]) * e[0] + (g - a[1]) * e[1] + (b - a[2]) * e[2]) / (e[0] ** 2 + e[1] ** 2 + e[2] ** 2);
    return s > threshold(x, y) ? i2 : i1;
  };
}

function normalize([x, y, z]) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
