import { drawText, textWidth } from '../lib/font.mjs';
import { threshold } from '../lib/pixel.mjs';

// 1-bit trefoil knot: a z-buffered tube lit with Blinn-Phong, Bayer-dithered
// to two colors, outlined, with a gap wherever one strand passes behind
// another.
export const palette = ['#0d1117', '#e8e2d0'];
export const delay = 5;

const FRAMES = 72;
const TUBE = 0.46;
const TILT = 0.95;
const CAMERA = 14;
const FOCAL = 158;
const GAP = 0.6;
const LIGHT = normalize([-0.55, 0.7, -0.5]);
const FILL = normalize([0.8, -0.35, -0.5]);
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] - 1]);

export function render(W, H) {
  const cx = W - 62;
  const cy = H / 2;
  const surface = tube(1500, 64);

  const base = new Uint8Array(W * H);
  const plot = (x, y) => {
    if (x >= 0 && y >= 0 && x < W && y < H) base[y * W + x] = 1;
  };
  drawText('mintychochip', 16, 21, 2, plot);
  drawText('software engineer', 16, 44, 1, plot);
  const cursorX = 16 + textWidth('software engineer') + 2;

  const depth = new Float32Array(W * H);
  const light = new Float32Array(W * H);
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const a = (f / FRAMES) * 2 * Math.PI;
    // The trefoil is 3-fold symmetric about z, so a third of a turn of spin
    // per full turn of orbit still loops seamlessly.
    const m = multiply(rotateY(a), multiply(rotateX(TILT), rotateZ(a / 3)));
    depth.fill(Infinity);
    for (let k = 0; k < surface.length; k += 6) {
      const x = surface[k];
      const y = surface[k + 1];
      const z = surface[k + 2];
      const pz = m[6] * x + m[7] * y + m[8] * z + CAMERA;
      const sx = Math.round(cx + (FOCAL * (m[0] * x + m[1] * y + m[2] * z)) / pz);
      const sy = Math.round(cy - (FOCAL * (m[3] * x + m[4] * y + m[5] * z)) / pz);
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const i = sy * W + sx;
      if (pz >= depth[i]) continue;
      const nx = surface[k + 3];
      const ny = surface[k + 4];
      const nz = surface[k + 5];
      depth[i] = pz;
      light[i] = shade(
        m[0] * nx + m[1] * ny + m[2] * nz,
        m[3] * nx + m[4] * ny + m[5] * nz,
        m[6] * nx + m[7] * ny + m[8] * nz,
      );
    }

    const px = base.slice();
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const d = depth[i];
        if (d === Infinity) continue;
        const l = depth[i - 1];
        const r = depth[i + 1];
        const u = depth[i - W];
        const b = depth[i + W];
        if (l < d - GAP || r < d - GAP || u < d - GAP || b < d - GAP) px[i] = 0;
        else if (l === Infinity || r === Infinity || u === Infinity || b === Infinity) px[i] = 1;
        else px[i] = light[i] > threshold(x, y) ? 1 : 0;
      }
    }
    if (f % 24 < 12) {
      for (let y = 46; y <= 50; y++) px.fill(1, y * W + cursorX, y * W + cursorX + 4);
    }
    frames.push(px);
  }
  return frames;
}

function shade(nx, ny, nz) {
  const key = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
  const fill = Math.max(0, nx * FILL[0] + ny * FILL[1] + nz * FILL[2]);
  const spec = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]) ** 30;
  const rim = (1 - Math.abs(nz)) ** 3;
  return 0.08 + 0.75 * key + 0.22 * fill + 0.8 * spec + 0.3 * rim;
}

function tube(steps, around) {
  const out = new Float32Array(steps * around * 6);
  let k = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const c = [Math.sin(t) + 2 * Math.sin(2 * t), Math.cos(t) - 2 * Math.cos(2 * t), -Math.sin(3 * t)];
    const T = normalize([Math.cos(t) + 4 * Math.cos(2 * t), -Math.sin(t) + 4 * Math.sin(2 * t), -3 * Math.cos(3 * t)]);
    const N = normalize(cross(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const B = cross(T, N);
    for (let j = 0; j < around; j++) {
      const a = (j / around) * 2 * Math.PI;
      for (let d = 0; d < 3; d++) {
        const n = N[d] * Math.cos(a) + B[d] * Math.sin(a);
        out[k + d] = c[d] + TUBE * n;
        out[k + 3 + d] = n;
      }
      k += 6;
    }
  }
  return out;
}

function normalize([x, y, z]) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function multiply(a, b) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return out;
}

const rotateX = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotateY = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotateZ = (a) => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
