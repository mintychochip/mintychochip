// Renders the animated README header(s): `node header/build.mjs [scene...]`
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodeGif } from './lib/gif.mjs';
import { hexToRgb, upscale } from './lib/pixel.mjs';
import * as fire from './scenes/fire.mjs';
import * as frog from './scenes/frog.mjs';
import * as knot from './scenes/knot.mjs';
import * as outrun from './scenes/outrun.mjs';
import * as voxel from './scenes/voxel.mjs';

const W = 256;
const H = 80;
const SCALE = 3;
const scenes = { frog, knot, outrun, fire, voxel };

const assets = new URL('../assets/', import.meta.url);
mkdirSync(assets, { recursive: true });

const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(scenes);
for (const name of names) {
  const scene = scenes[name];
  if (!scene) throw new Error(`unknown scene "${name}" (have: ${Object.keys(scenes).join(', ')})`);
  const started = performance.now();
  const frames = scene.render(W, H);
  for (const frame of frames) {
    if (frame.some((i) => i >= scene.palette.length)) throw new Error(`${name}: pixel outside its palette`);
  }
  const gif = encodeGif({
    width: W * SCALE,
    height: H * SCALE,
    palette: scene.palette.map(hexToRgb),
    frames: frames.map((f) => upscale(f, W, H, SCALE)),
    delay: scene.delay,
  });
  writeFileSync(new URL(`header-${name}.gif`, assets), gif);
  const seconds = ((frames.length * scene.delay) / 100).toFixed(1);
  const ms = (performance.now() - started).toFixed(0);
  console.log(`${name}: ${frames.length} frames (${seconds}s loop), ${(gif.length / 1024).toFixed(0)} KB, ${ms} ms`);
}
