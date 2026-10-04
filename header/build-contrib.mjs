// Fetches the last year of GitHub contributions and writes a pixel heatmap SVG
// for the profile README (same greens as the frog header / mintychochip.dev).
import { writeFileSync } from 'node:fs';
import dns from 'node:dns';

dns.setDefaultResultOrder?.('ipv4first');

const USER = process.env.GITHUB_USER ?? 'mintychochip';
const OUT = new URL('../assets/readme-contrib.svg', import.meta.url);

const PALETTE = ['#0d1117', '#1a3228', '#356b4f', '#62c47a', '#8bbf73'];
const LEVEL_MAP = [0, 1, 2, 3, 4];

const url = `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(USER)}?y=last`;

function streaks(days) {
  const active = days.filter((d) => d.count > 0).map((d) => d.date).sort();
  if (!active.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < active.length; i++) {
    const prev = Date.parse(`${active[i - 1]}T12:00:00Z`);
    const cur = Date.parse(`${active[i]}T12:00:00Z`);
    if (cur - prev === 86_400_000) run++;
    else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run);
  let current = 1;
  for (let i = active.length - 1; i > 0; i--) {
    const prev = Date.parse(`${active[i - 1]}T12:00:00Z`);
    const cur = Date.parse(`${active[i]}T12:00:00Z`);
    if (cur - prev === 86_400_000) current++;
    else break;
  }
  return { current, longest };
}

function columns(days) {
  const cols = [];
  for (let i = 0; i < days.length; i += 7) {
    const col = [];
    for (let r = 0; r < 7; r++) col.push(days[i + r]?.level ?? 0);
    cols.push(col);
  }
  return cols;
}

const res = await fetch(url, { headers: { Accept: 'application/json' } });
if (!res.ok) throw new Error(`contributions API ${res.status}`);
const raw = await res.json();
if (!Array.isArray(raw.contributions) || !raw.contributions.length) throw new Error('no contributions');
const days = raw.contributions
  .map((d) => ({
    date: d.date,
    count: d.count ?? 0,
    level: Math.max(0, Math.min(4, d.level ?? (d.count > 0 ? 1 : 0))),
  }))
  .sort((a, b) => a.date.localeCompare(b.date));
const total = raw.total?.lastYear ?? days.reduce((a, d) => a + d.count, 0);
const { current, longest } = streaks(days);
const best = days.reduce((b, d) => (d.count > b.count ? d : b), days[0]);

const cols = columns(days);
const cell = 3;
const gap = 1;
const pad = 8;
const gridW = cols.length * (cell + gap) - gap;
const gridH = 7 * (cell + gap) - gap;
const W = gridW + pad * 2;
const H = gridH + pad * 2 + 28;

let rects = '';
for (let i = 0; i < cols.length; i++) {
  for (let r = 0; r < 7; r++) {
    const level = LEVEL_MAP[cols[i][r] ?? 0] ?? 0;
    const x = pad + i * (cell + gap);
    const y = pad + 28 + r * (cell + gap);
    rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${PALETTE[level]}"/>`;
  }
}

const line1 = `${total.toLocaleString('en-US')} contributions in the last year`;
const line2 =
  current > 0
    ? `streak ${current} days (longest ${longest}) · busiest ${best.count} on ${best.date}`
    : `longest streak ${longest} days · busiest ${best.count} on ${best.date}`;

const legend = PALETTE.slice(1)
  .map((c, i) => `<rect x="${pad + i * 10}" y="${H - 10}" width="8" height="8" fill="${c}"/>`)
  .join('');
const legendX = pad + 52;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="${line1}. ${line2}">
  <rect width="100%" height="100%" fill="${PALETTE[0]}"/>
  <text x="${pad}" y="16" fill="#ece6cc" font-family="ui-monospace, monospace" font-size="11">${line1}</text>
  <text x="${pad}" y="30" fill="#8f98a8" font-family="ui-monospace, monospace" font-size="9">${line2}</text>
  ${rects}
  <text x="${pad}" y="${H - 2}" fill="#687184" font-family="ui-monospace, monospace" font-size="8">less</text>
  ${legend}
  <text x="${legendX}" y="${H - 2}" fill="#687184" font-family="ui-monospace, monospace" font-size="8">more</text>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`readme-contrib.svg: ${cols.length} weeks, ${total} contributions, ${(svg.length / 1024).toFixed(1)} KB`);
