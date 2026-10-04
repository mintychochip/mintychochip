// Fetches the last year of GitHub contributions and writes a high-resolution,
// pixel-crafted contribution heatmap SVG card matching the frog header and mintychochip.dev.
import { writeFileSync } from 'node:fs';
import dns from 'node:dns';

dns.setDefaultResultOrder?.('ipv4first');

const USER = process.env.GITHUB_USER ?? 'mintychochip';
const OUT = new URL('../assets/readme-contrib.svg', import.meta.url);

const PALETTE = ['#121921', '#1a3b2b', '#2d6344', '#52b868', '#8bbf73'];

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
const bestDateStr = new Date(`${best.date}T12:00:00Z`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const cols = [];
for (let i = 0; i < days.length; i += 7) {
  const col = [];
  for (let r = 0; r < 7; r++) col.push(days[i + r]);
  cols.push(col);
}

const W = 768;
const H = 224;
const gridX = 44;
const gridY = 82;
const cell = 10;
const gap = 3;

let rects = '';
for (let i = 0; i < cols.length; i++) {
  for (let r = 0; r < 7; r++) {
    const d = cols[i][r];
    const lvl = d ? d.level : 0;
    const x = gridX + i * (cell + gap);
    const y = gridY + r * (cell + gap);
    const fill = PALETTE[lvl] ?? PALETTE[0];
    rects += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" ry="2" fill="${fill}">`;
    if (d) rects += `<title>${d.count} contributions on ${d.date}</title>`;
    rects += `</rect>`;
  }
}

// Month labels
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let monthLabels = '';
let lastMonth = -1;
for (let i = 0; i < cols.length; i++) {
  const d = cols[i][0];
  if (!d) continue;
  const m = parseInt(d.date.slice(5, 7), 10) - 1;
  if (m !== lastMonth && i < cols.length - 2) {
    const x = gridX + i * (cell + gap);
    monthLabels += `<text x="${x}" y="${gridY - 6}" fill="#687184" font-family="ui-monospace, monospace" font-size="10">${MONTHS[m]}</text>`;
    lastMonth = m;
  }
}

// Day labels
const dayLabels =
  `<text x="${gridX - 8}" y="${gridY + 1 * (cell + gap) + 8}" text-anchor="end" fill="#687184" font-family="ui-monospace, monospace" font-size="9">Mon</text>` +
  `<text x="${gridX - 8}" y="${gridY + 3 * (cell + gap) + 8}" text-anchor="end" fill="#687184" font-family="ui-monospace, monospace" font-size="9">Wed</text>` +
  `<text x="${gridX - 8}" y="${gridY + 5 * (cell + gap) + 8}" text-anchor="end" fill="#687184" font-family="ui-monospace, monospace" font-size="9">Fri</text>`;

// Mini frog pixel icon (16x14)
const frogSvg =
  '<g transform="translate(24, 22)">' +
  '<ellipse cx="12" cy="20" rx="16" ry="5" fill="#1c382b" stroke="#26523e" stroke-width="1"/>' +
  '<rect x="4" y="6" width="16" height="12" rx="4" fill="#62c47a"/>' +
  '<rect x="7" y="11" width="10" height="7" rx="3" fill="#d2ebd4"/>' +
  '<circle cx="7" cy="5" r="4" fill="#62c47a"/>' +
  '<circle cx="17" cy="5" r="4" fill="#62c47a"/>' +
  '<circle cx="7" cy="5" r="2.5" fill="#ffffff"/>' +
  '<circle cx="17" cy="5" r="2.5" fill="#ffffff"/>' +
  '<circle cx="8" cy="5" r="1.2" fill="#0d1117"/>' +
  '<circle cx="18" cy="5" r="1.2" fill="#0d1117"/>' +
  '<ellipse cx="5" cy="11" rx="1.5" ry="1" fill="#f08aa8"/>' +
  '<ellipse cx="19" cy="11" rx="1.5" ry="1" fill="#f08aa8"/>' +
  '</g>';

// Swatches
const swatchX = 612;
const swatchY = 196;
let swatches = '';
for (let i = 0; i < PALETTE.length; i++) {
  swatches += `<rect x="${swatchX + 32 + i * 13}" y="${swatchY}" width="10" height="10" rx="2" ry="2" fill="${PALETTE[i]}" stroke="#1f3329" stroke-width="0.8"/>`;
}

const streakText = `streak ${current} ${current === 1 ? 'day' : 'days'} (longest ${longest}) · busiest ${best.count} on ${bestDateStr}`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub Contributions: ${total.toLocaleString('en-US')} contributions in the last year">
  <defs>
    <linearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0e1520"/>
      <stop offset="100%" stop-color="#0a0e17"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="12" ry="12" fill="url(#cardBg)" stroke="#1d3126" stroke-width="1.5"/>
  ${frogSvg}
  <text x="64" y="34" fill="#ece6cc" font-family="ui-monospace, monospace" font-size="15" font-weight="bold">GitHub Activity</text>
  <text x="216" y="34" fill="#8bbf73" font-family="ui-monospace, monospace" font-size="13">${total.toLocaleString('en-US')} contributions in the last year</text>
  <text x="64" y="50" fill="#8f98a8" font-family="ui-monospace, monospace" font-size="11">${streakText}</text>
  <!-- Link Pill -->
  <rect x="596" y="22" width="148" height="26" rx="6" fill="#14241d" stroke="#254534" stroke-width="1"/>
  <text x="670" y="39" text-anchor="middle" fill="#8bbf73" font-family="ui-monospace, monospace" font-size="11" font-weight="600">mintychochip.dev ↗</text>
  ${monthLabels}
  ${dayLabels}
  ${rects}
  <!-- Legend & Live Pond Note -->
  <text x="44" y="204" fill="#8f98a8" font-family="ui-monospace, monospace" font-size="11">🐸 Explore the live pond version at <tspan fill="#8bbf73" text-decoration="underline">mintychochip.dev/#github</tspan></text>
  <text x="${swatchX + 24}" y="204" text-anchor="end" fill="#687184" font-family="ui-monospace, monospace" font-size="10">Less</text>
  ${swatches}
  <text x="${swatchX + 32 + PALETTE.length * 13 + 6}" y="204" fill="#687184" font-family="ui-monospace, monospace" font-size="10">More</text>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`readme-contrib.svg: ${cols.length} weeks, ${total} contributions, ${(svg.length / 1024).toFixed(1)} KB`);
