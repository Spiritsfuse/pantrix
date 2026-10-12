// Render a captured terminal transcript (real command output with ANSI colours)
// into a terminal-window PNG for docs/evidence.
//
//   node render-terminal.mjs <transcript.txt> <out.png> [--title "..."] [--max 60]
//        [--from "text"] [--until "text"]
//   node render-terminal.mjs --batch shots.json
//
// The renderer never edits content. Long transcripts are cut to --max lines and
// a visible "... N lines omitted - full transcript: <file>" marker is added, so
// the PNG always points back to the complete text file.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AnsiToHtml from "ansi-to-html";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");

const palette = {
  0: "#2b211a", 1: "#e06c75", 2: "#98c379", 3: "#e5c07b", 4: "#61afef", 5: "#c678dd", 6: "#56b6c2", 7: "#d7d0c4",
  8: "#7f7466", 9: "#f08a8f", 10: "#b5dd8c", 11: "#f3d38b", 12: "#82c2f5", 13: "#d79be8", 14: "#7ccbd4", 15: "#fbf6ec",
};

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function select(text, { from, until, max }) {
  let lines = text.replace(/\r/g, "").split("\n");
  if (from) {
    const i = lines.findIndex((l) => l.includes(from));
    if (i > 0) lines = lines.slice(i);
  }
  if (until) {
    const j = lines.findIndex((l) => l.includes(until));
    if (j >= 0) lines = lines.slice(0, j + 1);
  }
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines.at(-1).trim() === "") lines.pop();
  let omitted = 0;
  if (max && lines.length > max) {
    const head = Math.ceil(max * 0.6);
    const tail = max - head;
    omitted = lines.length - head - tail;
    lines = [...lines.slice(0, head), `\u0000OMIT${omitted}`, ...lines.slice(lines.length - tail)];
  }
  return { lines, omitted };
}

function page({ title, body, footer }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;padding:28px;background:#efe6d6;font-family:"Cascadia Mono","Consolas",monospace}
  .win{border-radius:12px;overflow:hidden;box-shadow:0 18px 40px -18px rgba(43,33,26,.55);background:#1f1915;width:max-content;min-width:980px;max-width:1500px}
  .bar{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#2d2520;color:#cbbfae;font:13px "Segoe UI",sans-serif}
  .dot{width:12px;height:12px;border-radius:50%}
  .title{margin-left:10px}
  pre{margin:0;padding:16px 20px 18px;color:#e8dfd1;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-all}
  .omit{display:block;color:#c48a0c;font-style:italic;margin:6px 0}
  .foot{padding:8px 16px;background:#2d2520;color:#9c8f7f;font:12px "Segoe UI",sans-serif}
  </style></head><body><div class="win">
  <div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span><span class="title">${escapeHtml(title)}</span></div>
  <pre>${body}</pre><div class="foot">${escapeHtml(footer)}</div></div></body></html>`;
}

async function renderOne(browser, shot) {
  const src = resolve(repo, shot.in);
  const raw = readFileSync(src, "utf8");
  const { lines } = select(raw, shot);
  const convert = new AnsiToHtml({ fg: "#e8dfd1", bg: "#1f1915", colors: palette, escapeXML: true });
  const body = lines
    .map((l) =>
      l.startsWith("\u0000OMIT")
        ? `<span class="omit">... ${l.slice(5)} lines omitted - full output in ${escapeHtml(shot.in)} ...</span>`
        : convert.toHtml(l),
    )
    .join("\n");
  const footer = shot.footer ?? `Real command output captured by scripts/evidence/capture-transcripts.sh - ${shot.in}`;
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5 });
  const pg = await ctx.newPage();
  await pg.setContent(page({ title: shot.title ?? "dhruv-sharma@pantrix: ~/pantrix", body, footer }));
  await pg.locator(".win").screenshot({ path: resolve(repo, shot.out) });
  await ctx.close();
  console.log(`rendered ${shot.out} (${lines.length} lines from ${basename(src)})`);
}

async function main() {
  const args = process.argv.slice(2);
  let shots;
  if (args[0] === "--batch") {
    shots = JSON.parse(readFileSync(resolve(process.cwd(), args[1]), "utf8"));
  } else {
    const opt = (name) => {
      const i = args.indexOf(`--${name}`);
      return i >= 0 ? args[i + 1] : undefined;
    };
    shots = [{ in: args[0], out: args[1], title: opt("title"), max: Number(opt("max") ?? 0), from: opt("from"), until: opt("until") }];
  }
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const browser = await chromium.launch();
  for (const shot of shots) {
    if (only && !only.some((o) => shot.out.includes(o))) continue;
    await renderOne(browser, shot);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
