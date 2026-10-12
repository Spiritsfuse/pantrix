// Render the title cards and code screens used by scripts/video/build_video.py.
//   node render-video-cards.mjs
// Cards come from scripts/video/segments.json; code screens show real files from
// the repository (line ranges below), so the video never shows invented code.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const cardsDir = resolve(repo, "demo", ".work", "cards");
const codeDir = resolve(repo, "demo", ".work", "code");
mkdirSync(cardsDir, { recursive: true });
mkdirSync(codeDir, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fonts = `
  @font-face{font-family:Fraunces;src:url("${resolve(repo, "frontend/node_modules/@fontsource/fraunces/files/fraunces-latin-700-normal.woff2").replace(/\\/g, "/")}")}
  @font-face{font-family:"DM Sans";src:url("${resolve(repo, "frontend/node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2").replace(/\\/g, "/")}")}`;

function cardHtml([title, subtitle = "", note = ""]) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
  body{margin:0;width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;
       padding:0 160px;box-sizing:border-box;background:#2b211a;color:#fbf6ec;font-family:"DM Sans",Segoe UI,sans-serif}
  .bar{width:120px;height:8px;background:#b8532d;border-radius:4px;margin-bottom:40px}
  h1{font-family:Fraunces,Georgia,serif;font-size:96px;margin:0 0 24px;line-height:1.05}
  p{font-size:40px;color:#e3b341;margin:0 0 40px;max-width:1500px}
  small{font-size:28px;color:#cbbfae;max-width:1500px;line-height:1.4}
  </style></head><body><div class="bar"></div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p><small>${esc(note)}</small></body></html>`;
}

function codeHtml(path, from, to, highlight = []) {
  const lines = readFileSync(resolve(repo, path), "utf8").replace(/\r/g, "").split("\n").slice(from - 1, to);
  const rows = lines
    .map((l, i) => {
      const n = from + i;
      const hl = highlight.some(([a, b]) => n >= a && n <= b);
      return `<div class="ln${hl ? " hl" : ""}"><span class="no">${n}</span><span>${esc(l) || " "}</span></div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1920px;height:1080px;background:#efe6d6;display:flex;align-items:center;justify-content:center}
  .win{width:1800px;max-height:1000px;overflow:hidden;border-radius:12px;background:#1f1915;box-shadow:0 18px 40px -18px rgba(43,33,26,.55)}
  .bar{padding:12px 18px;background:#2d2520;color:#e3b341;font:20px Consolas,monospace}
  pre{margin:0;padding:14px 0;font:17px/1.32 Consolas,"Cascadia Mono",monospace;color:#e8dfd1}
  .ln{display:flex;padding:0 18px;white-space:pre}
  .ln.hl{background:rgba(184,83,45,.28)}
  .no{width:56px;flex:none;color:#7f7466;text-align:right;margin-right:22px}
  </style></head><body><div class="win"><div class="bar">${esc(path)}  ·  lines ${from}-${to}</div><pre>${rows}</pre></div></body></html>`;
}

function treeHtml() {
  const files = execSync("git ls-files", { cwd: repo, encoding: "utf8" }).trim().split("\n");
  const top = new Map();
  for (const f of files) {
    const [a, b] = f.split("/");
    if (!b) continue;
    if (!top.has(a)) top.set(a, new Set());
    top.get(a).add(f.split("/").length > 2 ? `${b}/` : b);
  }
  const rootFiles = files.filter((f) => !f.includes("/"));
  const cols = [...top.entries()]
    .map(([dir, kids]) => {
      const list = [...kids].sort().slice(0, 9);
      const more = kids.size > 9 ? `<li class="more">+${kids.size - 9} more</li>` : "";
      return `<div class="dir"><h3>${esc(dir)}/</h3><ul>${list.map((k) => `<li>${esc(k)}</li>`).join("")}${more}</ul></div>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
  body{margin:0;width:1920px;height:1080px;background:#fbf6ec;font-family:"DM Sans",Segoe UI,sans-serif;color:#2b211a;padding:44px 60px;box-sizing:border-box}
  h1{font-family:Fraunces,Georgia,serif;margin:0 0 6px;font-size:46px}
  .sub{color:#6b5d50;font-size:22px;margin-bottom:22px}
  .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
  .dir{background:#fffdf8;border:1px solid #e6dac5;border-radius:12px;padding:12px 14px}
  h3{margin:0 0 6px;font:700 20px Consolas,monospace;color:#8f3c1d}
  ul{margin:0;padding:0;list-style:none;font:15px/1.45 Consolas,monospace}
  .more{color:#8a8178}
  </style></head><body><h1>Repository layout</h1>
  <div class="sub">git ls-files · ${files.length} tracked files · root: ${rootFiles.map(esc).join(", ")}</div>
  <div class="grid">${cols}</div></body></html>`;
}

const code = [
  ["distributions", "backend/app/routers/distributions.py", 29, 64, [[41, 52]]],
  ["main", "backend/app/main.py", 52, 93, [[52, 55], [77, 95]]],
  ["helm-backend", "helm/pantrix/templates/backend.yaml", 49, 90, [[55, 72], [79, 90]]],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const segments = JSON.parse(readFileSync(resolve(repo, "scripts", "video", "segments.json"), "utf8")).segments;
let n = 0;
for (const seg of segments) {
  if (!seg.card) continue;
  n += 1;
  await page.setContent(cardHtml(seg.card));
  await page.screenshot({ path: resolve(cardsDir, `card-${String(n).padStart(2, "0")}.png`) });
}
console.log(`rendered ${n} cards`);
await page.setContent(treeHtml());
await page.screenshot({ path: resolve(codeDir, "tree.png") });
for (const [name, path, from, to, hl] of code) {
  await page.setContent(codeHtml(path, from, to, hl));
  await page.screenshot({ path: resolve(codeDir, `${name}.png`) });
}
console.log("rendered code screens");
await browser.close();
