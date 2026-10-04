import { drawText, textWidth, GLYPH_ROWS, drawTiny } from '../lib/font.mjs';
import { lerp, smoothstep, threshold } from '../lib/pixel.mjs';

// The avatar frog, pillow-shaded from its own silhouette in three greens.
// Its eyes follow a fly around the banner until its tongue snaps the fly out
// of the air. The title and tagline sit on the left; the artist's credit hangs
// right under the frog.
export const delay = 5;

export const palette = [
  '#0d1117', // 0 background / ink
  '#1a3228', // 1 frog deep shadow
  '#356b4f', // 2 frog mid
  '#62c47a', // 3 frog lit
  '#8a7d68', // 4 fly trail
  '#e8e2d0', // 5 title, tagline, credit, eyes, fly
  '#b85a72', // 6 tongue shadow (base / underside)
  '#f08aa8', // 7 tongue mid
  '#ffc8d8', // 8 tongue highlight (upper edge + tip)
];

const C = {
  bg: 0,
  frogDeep: 1,
  frogMid: 2,
  frogLit: 3,
  trail: 4,
  textBright: 5,
  tongueDeep: 6,
  tongue: 7,
  tongueLit: 8,
};

const TITLE = 'welcome';
const TAGLINE = 'to my github';
const CREDIT = 'image: ttv/gigglegeist';

const FRAMES = 100;

// Traced from the GitHub avatar at banner scale, facing left as in the avatar:
// ' ' outside, '#' line, 'o' eye white, '.' skin, '+' dark spot.
const FROG = [
  '                                    ####                           ######',
  '                                  #######           #################oooo###',
  '                                 ##oooooo#    #############....##oooooooooo###',
  '                                #oooooooo######................#ooooooooooooo##',
  '                               #oooooooo###...................##oooooooooooooo##',
  '                              ##ooooooo##.....................#oooooooooooooooo#',
  '                             #ooooooo##.......................#oooooooooooooooo#',
  '                             #oooooo##........................#oooooooooooooooo##',
  '                             #ooooo##.........................#ooooooooooooooooo#',
  '                             #ooooo#..........................##oooooooooooooooo#',
  '                             #oooo##...........................#ooooooooooooooo##',
  '                             #ooo##............................##oooooooooooooo#',
  '                             #ooo#...............................########oooo##',
  '                              #oo#................................############',
  '                               #####......................................#...#',
  '                             #####..###...............................##......#',
  '                             #..##....##..............................#.......#',
  '                             ##.##......#..........................###........##',
  '                              ####.......##...........###############..........#',
  '                              ####........##......######.......................#',
  '                             ##.###........##.#####............................#',
  '                        ######..#+#.........###..................###...........##',
  '                     ####......#####...............###........####.##..........##',
  '                    ##...........####.............#..#############.##...........#',
  '                   #..........####..##...........##..##++++++++######......##...#',
  '                  ##.........##+###.##............###.###+++++#####.......###...#',
  '                  #..........##++####.............####..###++##.#.........#.....##',
  '                  #...........##+#..............###+++#...###...#........##.....##',
  '                 ##............####............####+++##........#.......##......##',
  '                 ##.........#####.##...........##.##+++#........#.......#.......##',
  '                  #.........########...........###.#####........##.....##....#..##',
  '                  ##...#....##++###.............####.##.........###....#.....#..##',
  '                   ######....####................#+##.............##..#.....##..##',
  '                      ####.....###...............#++#..............####.....###.##',
  '                      #..#########...............#++##..............##.....##...##',
  '                      #.......####..............######...............##....##...##',
  '                     ##.........#...............#.#........................#....##',
  '             #####   ##........................##..############............#....##',
  '             #...#   ##.........................####.....###..####........##....#',
  '             #...#   ##..........................##..............##########.....#',
  '      ##### ##..##   ##.........................................................#',
  '     ##...#####.##    #...........................#.............................#',
  '     ##...##+##.##    #........................######....##.....................#',
  '      ##..#++##.###   #..................###...#....#..#####....................#',
  '     ######++##.###   ##...............######..#....#..#...#....................#',
  '  ####++####+#..#++#   #...............#....##.##..##..#...##...................#',
  '#####+++##.#+#..##+######..............##...##..##.#...#.###....#...............#',
  '#..###++##.###...#++##..##..............###.##...#.#..##.#......###............##',
  '#....#####.......#+++#...##...............##.#...#.#..#.##......##.............##',
  '#####..###.......#+++##...##...............#.##..#.#..#.#....####..............##',
  '     #...........#++++##...##..............##.#..#.##.#.#.####.................#',
  '     #...........##++++##....##............##.####..########...................#',
  '      #..........##+++####....###...........#..........##......................#',
  '      #...........#####..##.....###.........#..........#.......................#',
  '      #............###.####.......#####.....#..................................#',
  '      #...............###.......#####.#....##..................................#',
  '      #..............##...##################..................................##',
  '      ##............#########    ##..######...................................#',
  '       ###############           ##..........................................##',
  '                ##                ######.................#................####',
  '                                        ##...............##################',
  '                                         #######.......################',
  '                                              ##########',
];

// Layout. Everything hangs off one margin: the empty pixels between the
// artwork and each edge of the banner (top, right and bottom of the frog and
// credit, left of the text).
const BANNER = [256, 80]; // build.mjs renders every scene at this size
const MARGIN = 6;

const cell = (x, y) => (y >= 0 && y < FROG.length ? (FROG[y][x] ?? ' ') : ' ');
// The outline and the cells on the silhouette's edge are painted in the
// background colour, so the frog you see is everything else.
const shows = (x, y) =>
  cell(x, y) !== ' ' &&
  cell(x, y) !== '#' &&
  ![cell(x - 1, y), cell(x + 1, y), cell(x, y - 1), cell(x, y + 1)].includes(' ');
const SEEN = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
FROG.forEach((row, y) => {
  for (let x = 0; x < row.length; x++) {
    if (!shows(x, y)) continue;
    SEEN.x0 = Math.min(SEEN.x0, x);
    SEEN.y0 = Math.min(SEEN.y0, y);
    SEEN.x1 = Math.max(SEEN.x1, x);
    SEEN.y1 = Math.max(SEEN.y1, y);
  }
});

const ORIGIN = [BANNER[0] - 1 - MARGIN - SEEN.x1, MARGIN - SEEN.y0];
const MOUTH = [ORIGIN[0] + 30, ORIGIN[1] + 16];

// Title and tagline are one block, centred on their lit pixels (not their
// glyph cells) so there is equal space above and below it whatever the words.
const TEXT_X = MARGIN;
const TAGLINE_DY = 23;
const TITLE_BOX = litBox((plot) => drawText(TITLE, 0, 0, 2, plot));
const TAGLINE_BOX = litBox((plot) => drawText(TAGLINE, 0, 0, 1, plot));
const TEXT_H = TAGLINE_DY + TAGLINE_BOX.y1 - TITLE_BOX.y0 + 1;
const TITLE_Y = Math.floor((BANNER[1] - TEXT_H) / 2) - TITLE_BOX.y0;
const TAGLINE_Y = TITLE_Y + TAGLINE_DY;

// The credit sits flush with the frog's right edge, with its lowest lit pixel
// (the tail of a g) MARGIN above the bottom; whatever is left between it and
// the frog's feet is the gap.
const CREDIT_BOX = litBox((plot) => drawTiny(CREDIT, 0, 0, plot));
const CREDIT_X = ORIGIN[0] + SEEN.x1 - CREDIT_BOX.x1;
const CREDIT_Y = BANNER[1] - 1 - MARGIN - CREDIT_BOX.y1;
if (CREDIT_Y + CREDIT_BOX.y0 <= ORIGIN[1] + SEEN.y1 + 1) {
  throw new Error('frog scene: no room for the credit under the frog');
}

// Bounds of the pixels a draw function plots.
function litBox(draw) {
  const box = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
  draw((x, y) => {
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
  });
  return box;
}

// Screen space: x right, y down, z toward the viewer.
const LIGHT = normalize([-0.45, -0.6, 0.66]);
// Key light projected into the banner plane (y down), for tongue shading.
const TONGUE_LIGHT = normalize([-LIGHT[0], -LIGHT[1], 0]);
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const BUMP = 9;
// Sprite rows from here down are feet / toes — shaded with coarser dither.
const FEET_Y = 36;
// Largest eye first.
const PUPILS = [
  { size: [6, 2], reach: [3, 2.5] },
  { size: [3, 2], reach: [1.5, 2.5] },
];

// [frame, x, y] waypoints for the fly; the tongue meets it at the last one.
// It never dips below y 12 left of x 150, well above the title.
const aroundMouth = (frame, dx, dy) => [frame, MOUTH[0] + dx, MOUTH[1] + dy];
const FLIGHT = [
  // A lazy wave across the top of the banner.
  [0, -6, 9], [4, 16, 5], [8, 38, 12], [12, 60, 5], [16, 82, 12], [20, 104, 5], [24, 126, 11], [27, 148, 7],
  // One clockwise loop in the gap between the title and the frog.
  [30, 170, 6], [32.25, 177.8, 9.2], [34.5, 181, 17], [36.75, 177.8, 24.8], [39, 170, 28],
  [41.25, 162.2, 24.8], [43.5, 159, 17], [45.75, 162.2, 9.2], [48, 170, 6],
  // Darts and hovers in front of the frog's face (placed relative to its
  // mouth), then drifts off to where the tongue catches it.
  aroundMouth(50, -14, -16), aroundMouth(53, -12, -13), aroundMouth(55, -24, -1), aroundMouth(58, -22, 1),
  aroundMouth(60, -13, -9), aroundMouth(62, -12, -8), aroundMouth(65, -23, -9), aroundMouth(67, -30, -9),
  aroundMouth(69, -36, -10),
];
const CATCH = 69;
const SHOOT = CATCH - 2;
const BACK = CATCH + 6;
const GULP = [BACK, BACK + 11];
const BLINK = 20;

export function render(W, H) {
  if (W !== BANNER[0] || H !== BANNER[1]) throw new Error(`frog scene is laid out for ${BANNER.join('x')}`);
  const frog = frogLayer();
  const base = new Uint8Array(W * H);
  const cursorX = TEXT_X + textWidth(TAGLINE) + 2;
  stampFrog(base, W, H, frog);
  stampText(base, W, H, TITLE, TEXT_X, TITLE_Y, 2);
  stampText(base, W, H, TAGLINE, TEXT_X, TAGLINE_Y, 1);
  drawTiny(CREDIT, CREDIT_X, CREDIT_Y, (x, y) => {
    base[y * W + x] = C.textBright;
  });

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
      for (let y = TAGLINE_Y + 2; y <= TAGLINE_Y + 6; y++) px.fill(C.textBright, y * W + cursorX, y * W + cursorX + 4);
    }
    frames.push(px);
  }
  return frames;
}

function stampText(px, W, H, text, x, y, scale) {
  drawText(text, x, y, scale, (pxX, pxY) => {
    if (pxX >= 0 && pxY >= 0 && pxX < W && pxY < H) px[pxY * W + pxX] = C.textBright;
  });
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
      const fill = Math.max(0, dot(n, [-LIGHT[0], -LIGHT[1], -LIGHT[2]])) * 0.08;
      const belly = Math.min(1, Math.max(0, (y - 16) / 40));
      // Pillow shading: bright facing planes stay solid; shadow + feet get dither at stamp.
      const skin = 0.3 + key + 0.5 * spec + fill - 0.14 * belly;
      const i = y * w + x;
      if (k === '.') tone[i] = skin;
      else if (k === '+') tone[i] = 0.5 * skin;
      else if (k === 'o') tone[i] = 1;
      else if (k === '#') tone[i] = 0; // ink lines — always stamped dark
      else tone[i] = 0;
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
  for (let y = 0; y < frog.h; y++) {
    for (let x = 0; x < frog.w; x++) {
      const t = frog.tone[y * frog.w + x];
      if (t < 0) continue;
      if (!shows(x, y)) {
        set(x, y, C.bg);
        continue;
      }
      const feet = y >= FEET_Y;
      set(x, y, frogInk(t, ORIGIN[0] + x, ORIGIN[1] + y, x, y, feet));
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
      px[(ORIGIN[1] + y) * W + ORIGIN[0] + x] = lit ? C.textBright : C.bg;
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
        if (frog.kind(x, yy) === 'o') px[(ORIGIN[1] + yy) * W + ORIGIN[0] + x] = C.bg;
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

// Catmull-Rom spline through the waypoints, plus a wobble per flight style:
// a lazy bob while gliding, almost none in the loop so its shape reads, and
// a fast buzz while hovering between darts.
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
  const glide = 1 - smoothstep(26, 30, f);
  const buzz = smoothstep(46, 50, f);
  const loop = 1 - glide - buzz;
  return [
    spline(p0[1], p1[1], p2[1], p3[1]) +
      glide * 0.8 * Math.sin(1.7 * f) + loop * 0.4 * Math.sin(2.9 * f) + buzz * 1.2 * Math.sin(5.3 * f + 1),
    spline(p0[2], p1[2], p2[2], p3[2]) +
      glide * Math.sin(2.1 * f + 0.5) + loop * 0.4 * Math.cos(2.9 * f) + buzz * 1.2 * Math.sin(6.1 * f),
  ];
}

function tongueTip(f) {
  if (f < SHOOT || f >= BACK) return null;
  const reach = f <= CATCH ? (f - SHOOT + 1) / (CATCH - SHOOT + 1) : Math.min(1, (BACK - f) / (BACK - CATCH - 1));
  const [x, y] = flight(CATCH);
  return [lerp(MOUTH[0], x, reach), lerp(MOUTH[1], y, reach)];
}

function tongueShade(u, lx, ly) {
  // u: 0 at the mouth, 1 at the tip. (lx, ly) is offset from the spine in the 2×2 body.
  const l = Math.hypot(lx, ly) || 1;
  const ux = lx / l;
  const uy = ly / l;
  const key = ux * TONGUE_LIGHT[0] + uy * TONGUE_LIGHT[1];
  const along = (u - 0.5) * 0.35 + (u > 0.82 ? 0.2 : 0);
  const tone = 0.45 * key + along;
  if (tone >= 0.22) return C.tongueLit;
  if (tone >= -0.12) return C.tongue;
  return C.tongueDeep;
}

function drawTongue(px, W, H, tip, carrying) {
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = v;
  };
  const disc = (cx, cy, r, plot) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) plot(x, y, d / r);
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
    for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) set(x + i, y + j, C.bg);
  }
  disc(tx + 0.5, ty + 0.5, 3.5, (x, y) => set(x, y, C.bg));
  const n = path.length;
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1 || 1);
    const [px, py] = path[k];
    // Spine through the 2×2 so the lit edge stays on the upper-left-facing side.
    const [txd, tyd] =
      k < n - 1
        ? [path[k + 1][0] - px, path[k + 1][1] - py]
        : [px - path[k - 1][0], py - path[k - 1][1]];
    const tl = Math.hypot(txd, tyd) || 1;
    const spineX = px - Math.round((tyd / tl) * 0.5);
    const spineY = py + Math.round((txd / tl) * 0.5);
    for (let j = 0; j <= 1; j++) {
      for (let i = 0; i <= 1; i++) {
        set(spineX + i, spineY + j, tongueShade(u, i - 0.5, j - 0.5));
      }
    }
  }
  disc(tx + 0.5, ty + 0.5, 2.5, (x, y, r) => {
    const u = 0.92 + 0.08 * (1 - r);
    set(x, y, tongueShade(u, (x - tx) * 0.35, (y - ty) * 0.35));
  });
  if (carrying) {
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) set(tx + i, ty + j, C.bg);
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
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) set(x + i + a, y + j + b, C.bg);
  }
  for (const [i, j] of body) set(x + i, y + j, C.textBright);
}

// Dots at fixed half-frame points along the past path, so they stay put and
// thin out with age instead of crawling along behind the fly.
function drawTrail(px, W, H, f) {
  for (let k = 1; k <= 10 && f - k / 2 >= 0; k++) {
    const [tx, ty] = flight(f - k / 2);
    const x = Math.round(tx + 0.5);
    const y = Math.round(ty + 0.5);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    if (1 - k / 11 > threshold(x, y)) px[y * W + x] = C.trail;
  }
}

function quantizeTone(v, x, y) {
  const steps = 5;
  const block = ((x >> 1) + (y >> 1) * 3) & 1 ? 0.04 : -0.02;
  const q = Math.round(Math.min(1, Math.max(0, v + block)) * (steps - 1)) / (steps - 1);
  return q;
}

function frogInk(tone, _sx, _sy, x, y, feet) {
  const t = feet ? quantizeTone(tone, x, y) : tone;
  if (t >= 0.62) return C.frogLit;
  if (t >= 0.34) return C.frogMid;
  return C.frogDeep;
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
