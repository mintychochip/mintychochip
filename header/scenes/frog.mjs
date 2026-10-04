import { drawText, textWidth } from '../lib/font.mjs';
import { lerp, threshold } from '../lib/pixel.mjs';

// The avatar frog in the knot's 1-bit style: pillow-shaded from its own
// silhouette, Bayer-dithered and rim-lit. Its eyes follow a fly around the
// banner until its tongue snaps the fly out of the air.
export const palette = ['#0d1117', '#e8e2d0'];
export const delay = 5;

const FRAMES = 100;

// Traced from the GitHub avatar at banner scale, mirrored to face the text:
// ' ' outside, '#' line, 'o' eye white, '.' skin, '+' dark spot.
const FROG = [
  '         ######                           ####',
  '      ###oooo#################           #######',
  '    ###oooooooooo##....#############    #oooooo##',
  '   ##ooooooooooooo#................######oooooooo#',
  '  ##oooooooooooooo##...................###oooooooo#',
  '  #oooooooooooooooo#.....................##ooooooo##',
  '  #oooooooooooooooo#.......................##ooooooo#',
  ' ##oooooooooooooooo#........................##oooooo#',
  ' #ooooooooooooooooo#.........................##ooooo#',
  ' #oooooooooooooooo##..........................#ooooo#',
  ' ##ooooooooooooooo#...........................##oooo#',
  '  #oooooooooooooo##............................##ooo#',
  '   ##oooo########...............................#ooo#',
  '    ############................................#oo#',
  '   #...#......................................#####',
  '   #......##...............................###..#####',
  '   #.......#..............................##....##..#',
  '  ##........###..........................#......##.##',
  '  #..........###############...........##.......####',
  '  #.......................######......##........####',
  '  #............................#####.##........###.##',
  ' ##...........###..................###.........#+#..######',
  ' ##..........##.####........###...............#####......####',
  ' #...........##.#############..#.............####...........##',
  ' #...##......######++++++++##..##...........##..####..........#',
  ' #...###.......#####+++++###.###............##.###+##.........##',
  '##.....#.........#.##++###..####.............####++##..........#',
  '##.....##........#...###...#+++###..............#+##...........#',
  '##......##.......#........##+++####............####............##',
  '##.......#.......#........#+++##.##...........##.#####.........##',
  '##..#....##.....##........#####.###...........########.........#',
  '##..#.....#....###.........##.####.............###++##....#...##',
  '##..##.....#..##.............##+#................####....######',
  '##.###.....####..............#++#...............###.....####',
  '##...##.....##..............##++#...............#########..#',
  '##...##....##...............######..............####.......#',
  '##....#........................#.#...............#.........##',
  '##....#............############..##........................##   #####',
  ' #....##........####..###.....####.........................##   #...#',
  ' #.....##########..............##..........................##   #...#',
  ' #.........................................................##   ##..## #####',
  ' #.............................#...........................#    ##.#####...##',
  ' #.....................##....######........................#    ##.##+##...##',
  ' #....................#####..#....#...###..................#   ###.##++#..##',
  ' #....................#...#..#....#..######...............##   ###.##++######',
  ' #...................##...#..##..##.##....#...............#   #++#..#+####++####',
  ' #...............#....###.#...#.##..##...##..............######+##..#+#.##+++#####',
  ' ##............###......#.##..#.#...##.###..............##..##++#...###.##++###..#',
  ' ##.............##......##.#..#.#...#.##...............##...#+++#.......#####....#',
  ' ##..............####....#.#..#.#..##.#...............##...##+++#.......###..#####',
  '  #.................####.#.#.##.#..#.##..............##...##++++#...........#',
  '  #...................########..####.##............##....##++++##...........#',
  '  #......................##..........#...........###....####+++##..........#',
  '  #.......................#..........#.........###.....##..#####...........#',
  '  #..................................#.....#####.......####.###............#',
  '  #..................................##....#.#####.......###...............#',
  '  ##..................................##################...##..............#',
  '   #...................................######..##    #########............##',
  '   ##..........................................##           ###############',
  '    ####................#.................######                ##',
  '       ##################...............##',
  '           ################.......#######',
  '                          ##########',
];
const ORIGIN = [172, 14];
const MOUTH = [176, 29];
// Screen space: x right, y down, z toward the viewer.
const LIGHT = normalize([-0.45, -0.6, 0.66]);
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const BUMP = 9;
// Largest eye first.
const PUPILS = [
  { size: [6, 2], reach: [3, 2.5] },
  { size: [3, 2], reach: [1.5, 2.5] },
];

// [frame, x, y] waypoints for the fly; the tongue meets it at the last one.
const FLIGHT = [
  [0, -6, 10], [7, 20, 4], [14, 44, 13], [20, 66, 5], [26, 92, 12], [32, 116, 4], [38, 142, 9],
  [43, 166, 3], [48, 194, 6], [53, 222, 3], [57, 214, 10], [61, 188, 5], [65, 162, 10], [69, 144, 15],
];
const CATCH = 69;
const SHOOT = CATCH - 2;
const BACK = CATCH + 6;
const GULP = [BACK, BACK + 11];
const BLINK = 20;

export function render(W, H) {
  const frog = frogLayer();
  const base = new Uint8Array(W * H);
  const plot = (x, y) => {
    if (x >= 0 && y >= 0 && x < W && y < H) base[y * W + x] = 1;
  };
  drawText('mintychochip', 16, 21, 2, plot);
  drawText('software engineer', 16, 44, 1, plot);
  const cursorX = 16 + textWidth('software engineer') + 2;
  glow(base, W, H);
  stampFrog(base, W, H, frog);

  const gaze = track(frog);
  const frames = [];
  for (let f = 0; f < FRAMES; f++) {
    const px = base.slice();
    drawEyes(px, W, frog, gaze[f], lidAt(f), f >= GULP[0] && f < GULP[1]);
    const tip = tongueTip(f);
    if (tip) drawTongue(px, W, H, tip, f >= CATCH);
    if (f < CATCH) {
      drawTrail(px, W, H, f);
      drawFly(px, W, H, flight(f), f);
    }
    if (f % 25 < 13) {
      for (let y = 46; y <= 50; y++) px.fill(1, y * W + cursorX, y * W + cursorX + 4);
    }
    frames.push(px);
  }
  return frames;
}

function frogLayer() {
  const h = FROG.length;
  const w = Math.max(...FROG.map((row) => row.length));
  const kind = (x, y) => (y >= 0 && y < h ? (FROG[y][x] ?? ' ') : ' ');
  const pad = 12;
  const gw = w + 2 * pad;
  const gh = h + 2 * pad;
  const mask = new Float32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (kind(x, y) !== ' ') mask[(y + pad) * gw + x + pad] = 1;
  }
  const fine = blur(mask, gw, gh, 2);
  const broad = blur(mask, gw, gh, 5);
  const height = fine.map((v, i) => BUMP * (0.6 * v + 0.4 * broad[i]));

  const tone = new Float32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = kind(x, y);
      if (k === ' ') continue;
      const g = (y + pad) * gw + x + pad;
      const n = normalize([(height[g - 1] - height[g + 1]) / 2, (height[g - gw] - height[g + gw]) / 2, 1]);
      const key = Math.max(0, dot(n, LIGHT));
      const spec = Math.max(0, dot(n, HALF)) ** 24;
      // Skin is nearly solid where it faces the light so the ink lines read;
      // the dither only shows up as the surface turns away.
      const skin = 0.3 + key + 0.5 * spec;
      const i = y * w + x;
      if (k === '.') tone[i] = skin;
      else if (k === '+') tone[i] = 0.5 * skin;
      else if (k === 'o') tone[i] = 1;
      else tone[i] = [kind(x - 1, y), kind(x + 1, y), kind(x, y - 1), kind(x, y + 1)].includes(' ') ? 1 : 0;
    }
  }
  return { w, h, kind, tone, eyes: eyesOf(kind, w, h) };
}

function eyesOf(kind, w, h) {
  const seen = new Uint8Array(w * h);
  const eyes = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || kind(x, y) !== 'o') continue;
      const pixels = [];
      const stack = [[x, y]];
      seen[y * w + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        pixels.push([cx, cy]);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || kind(nx, ny) !== 'o') continue;
          seen[ny * w + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      const xs = pixels.map((p) => p[0]);
      const ys = pixels.map((p) => p[1]);
      eyes.push({
        pixels,
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        y0: Math.min(...ys),
        y1: Math.max(...ys),
        cx: xs.reduce((a, b) => a + b) / xs.length,
        cy: ys.reduce((a, b) => a + b) / ys.length,
      });
    }
  }
  return eyes.sort((a, b) => b.pixels.length - a.pixels.length);
}

function stampFrog(px, W, H, frog) {
  const set = (x, y, v) => {
    const X = ORIGIN[0] + x;
    const Y = ORIGIN[1] + y;
    if (X >= 0 && Y >= 0 && X < W && Y < H) px[Y * W + X] = v;
  };
  for (let y = -1; y <= frog.h; y++) {
    for (let x = -1; x <= frog.w; x++) {
      if (frog.kind(x, y) !== ' ') continue;
      const touches = [frog.kind(x - 1, y), frog.kind(x + 1, y), frog.kind(x, y - 1), frog.kind(x, y + 1)];
      if (touches.some((k) => k !== ' ')) set(x, y, 0);
    }
  }
  for (let y = 0; y < frog.h; y++) {
    for (let x = 0; x < frog.w; x++) {
      const t = frog.tone[y * frog.w + x];
      if (t >= 0) set(x, y, t > threshold(ORIGIN[0] + x, ORIGIN[1] + y) ? 1 : 0);
    }
  }
}

function drawEyes(px, W, frog, gaze, lid, happy) {
  frog.eyes.forEach((eye, k) => {
    const [pw, ph] = PUPILS[k].size;
    const pupilX = Math.round(eye.cx + gaze[k][0] - pw / 2);
    const pupilY = Math.round(eye.cy + gaze[k][1] - ph / 2);
    const lidY = Math.floor(eye.y0 + lid * (eye.y1 - eye.y0 + 1));
    for (const [x, y] of eye.pixels) {
      const pupil = x >= pupilX && x < pupilX + pw && y >= pupilY && y < pupilY + ph;
      const lit = lid >= 1 || y < lidY || !(pupil || (lid > 0 && y === lidY));
      px[(ORIGIN[1] + y) * W + ORIGIN[0] + x] = lit ? 1 : 0;
    }
    if (lid < 1) return;
    // Closed: a lid line across the eye, bowed up into a ^ when content.
    const rx = Math.max(1, (eye.x1 - eye.x0) / 2);
    const lift = happy ? 0.25 * (eye.y1 - eye.y0 + 1) : 0;
    let prev = null;
    for (let x = eye.x0; x <= eye.x1; x++) {
      const u = (x - eye.cx) / rx;
      const y = Math.round(eye.cy + 1 - lift * Math.max(0, 1 - u * u));
      for (let yy = Math.min(y, prev ?? y); yy <= Math.max(y, prev ?? y); yy++) {
        if (frog.kind(x, yy) === 'o') px[(ORIGIN[1] + yy) * W + ORIGIN[0] + x] = 0;
      }
      prev = y;
    }
  });
}

function lidAt(f) {
  if (f >= BLINK && f < BLINK + 4) return [0.5, 1, 1, 0.5][f - BLINK];
  if (f >= SHOOT - 5 && f < SHOOT) return 0.3;
  if (f >= GULP[0] && f < GULP[1]) return f === GULP[0] || f === GULP[1] - 1 ? 0.5 : 1;
  return 0;
}

// Eyes ease toward the fly (or, once it is eaten, toward where the next one
// appears); two passes so the last frame hands off smoothly to the first.
function track(frog) {
  const rest = FLIGHT[0].slice(1);
  let look = frog.eyes.map(() => [0, 0]);
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    for (let f = 0; f < FRAMES; f++) {
      const target = f < CATCH ? flight(f) : (tongueTip(f) ?? rest);
      look = frog.eyes.map((eye, k) => {
        const dx = target[0] - (ORIGIN[0] + eye.cx);
        const dy = target[1] - (ORIGIN[1] + eye.cy);
        const len = Math.hypot(dx, dy) || 1;
        const [rx, ry] = PUPILS[k].reach;
        return [lerp(look[k][0], (dx / len) * rx, 0.5), lerp(look[k][1], (dy / len) * ry, 0.5)];
      });
      out[f] = look;
    }
  }
  return out;
}

function flight(f) {
  let i = 0;
  while (i < FLIGHT.length - 2 && FLIGHT[i + 1][0] <= f) i++;
  const p0 = FLIGHT[Math.max(0, i - 1)];
  const p1 = FLIGHT[i];
  const p2 = FLIGHT[i + 1];
  const p3 = FLIGHT[Math.min(FLIGHT.length - 1, i + 2)];
  const u = (f - p1[0]) / (p2[0] - p1[0]);
  const spline = (a, b, c, d) =>
    0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  return [
    spline(p0[1], p1[1], p2[1], p3[1]) + 1.3 * Math.sin(1.9 * f) + 0.6 * Math.sin(3.7 * f + 1),
    spline(p0[2], p1[2], p2[2], p3[2]) + 1.5 * Math.sin(2.3 * f + 0.5) + 0.7 * Math.sin(4.1 * f + 2),
  ];
}

function tongueTip(f) {
  if (f < SHOOT || f >= BACK) return null;
  const reach = f <= CATCH ? (f - SHOOT + 1) / (CATCH - SHOOT + 1) : Math.min(1, (BACK - f) / (BACK - CATCH - 1));
  const [x, y] = flight(CATCH);
  return [lerp(MOUTH[0], x, reach), lerp(MOUTH[1], y, reach)];
}

function drawTongue(px, W, H, tip, carrying) {
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = v;
  };
  const disc = (cx, cy, r, v) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, v);
      }
    }
  };
  const [mx, my] = MOUTH;
  const tx = Math.round(tip[0]);
  const ty = Math.round(tip[1]);
  const len = Math.hypot(tx - mx, ty - my) || 1;
  let nx = -(ty - my) / len;
  let ny = (tx - mx) / len;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (mx + tx) / 2 + nx * 0.12 * len;
  const cy = (my + ty) / 2 + ny * 0.12 * len;
  const path = [];
  const steps = Math.ceil(len * 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    path.push([
      Math.round((1 - t) * (1 - t) * mx + 2 * (1 - t) * t * cx + t * t * tx),
      Math.round((1 - t) * (1 - t) * my + 2 * (1 - t) * t * cy + t * t * ty),
    ]);
  }
  for (const [x, y] of path) {
    for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) set(x + i, y + j, 0);
  }
  disc(tx + 0.5, ty + 0.5, 3.5, 0);
  for (const [x, y] of path) {
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) set(x + i, y + j, 1);
  }
  disc(tx + 0.5, ty + 0.5, 2.5, 1);
  if (carrying) {
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) set(tx + i, ty + j, 0);
  }
}

function drawFly(px, W, H, [fx, fy], f) {
  const x = Math.round(fx);
  const y = Math.round(fy);
  const wings = f % 2 ? [[-1, -1], [2, -1]] : [[-1, 0], [2, 0]];
  const body = [[0, 0], [1, 0], [0, 1], [1, 1], ...wings];
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = v;
  };
  for (const [i, j] of body) {
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) set(x + i + a, y + j + b, 0);
  }
  for (const [i, j] of body) set(x + i, y + j, 1);
}

// Dots at fixed half-frame points along the past path, so they stay put and
// thin out with age instead of crawling along behind the fly.
function drawTrail(px, W, H, f) {
  for (let k = 1; k <= 10 && f - k / 2 >= 0; k++) {
    const [tx, ty] = flight(f - k / 2);
    const x = Math.round(tx + 0.5);
    const y = Math.round(ty + 0.5);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (1 - k / 11 > threshold(x, y)) px[y * W + x] = 1;
  }
}

// Sparse dots under the frog, like the glow behind the knot.
function glow(px, W, H) {
  const cx = ORIGIN[0] + 38;
  const cy = 77;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = ((x - cx) / 58) ** 2 + ((y - cy) / 8) ** 2;
      if (d < 1 && 0.2 * (1 - d) > threshold(x, y)) px[y * W + x] = 1;
    }
  }
}

function blur(src, w, h, r) {
  let a = Float32Array.from(src);
  const b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += a[y * w + Math.min(w - 1, Math.max(0, x + k))];
        b[y * w + x] = s / (2 * r + 1);
      }
    }
    const c = new Float32Array(a.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += b[Math.min(h - 1, Math.max(0, y + k)) * w + x];
        c[y * w + x] = s / (2 * r + 1);
      }
    }
    a = c;
  }
  return a;
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize([x, y, z]) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}
