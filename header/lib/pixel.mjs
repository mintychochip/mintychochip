const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

export const threshold = (x, y) => BAYER[(y & 7) * 8 + (x & 7)];

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Ordered-dither a 0..1 value onto a ramp of palette indices.
export function ramp(v, colors, x, y) {
  const i = Math.floor(clamp01(v) * (colors.length - 1) + threshold(x, y));
  return colors[Math.min(colors.length - 1, i)];
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Nearest-neighbour upscale so dither pixels stay crisp; GitHub strips the
// CSS that would otherwise let the browser do this.
export function upscale(src, w, h, scale) {
  const W = w * scale;
  const out = new Uint8Array(W * h * scale);
  for (let y = 0; y < h; y++) {
    const start = y * scale * W;
    for (let x = 0; x < w; x++) out.fill(src[y * w + x], start + x * scale, start + x * scale + scale);
    for (let k = 1; k < scale; k++) out.copyWithin(start + k * W, start, start + W);
  }
  return out;
}
