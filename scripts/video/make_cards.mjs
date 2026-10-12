// Render title cards (same look as scripts/evidence/render-video-cards.mjs) for video segments
// that were re-recorded after the first build.
//   node scripts/video/make_cards.mjs   (run from scripts/evidence so playwright resolves)
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const { chromium } = await import(pathToFileURL(resolve(repo, "scripts/evidence/node_modules/playwright/index.mjs")).href);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (p) => resolve(repo, p).replaceAll(String.fromCharCode(92), "/");
const fonts = `@font-face{font-family:Fraunces;src:url("file:///${f("frontend/node_modules/@fontsource/fraunces/files/fraunces-latin-700-normal.woff2")}")}
@font-face{font-family:"DM Sans";src:url("file:///${f("frontend/node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2")}")}`;
const html = ([t, s = "", n = ""]) => `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
body{margin:0;width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;padding:0 160px;box-sizing:border-box;background:#2b211a;color:#fbf6ec;font-family:"DM Sans",Segoe UI,sans-serif}
.bar{width:120px;height:8px;background:#b8532d;border-radius:4px;margin-bottom:40px}
h1{font-family:Fraunces,Georgia,serif;font-size:96px;margin:0 0 24px;line-height:1.05}
p{font-size:40px;color:#e3b341;margin:0 0 40px;max-width:1500px}
small{font-size:28px;color:#cbbfae;max-width:1500px;line-height:1.4}
</style></head><body><div class="bar"></div><h1>${esc(t)}</h1><p>${esc(s)}</p><small>${esc(n)}</small></body></html>`;
const cards = JSON.parse(readFileSync(resolve(here, "cards.json"), "utf8"));
mkdirSync(resolve(repo, "demo/video-assets"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const c of cards) {
  await page.setContent(html(c.text), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve(repo, "demo/video-assets", c.out) });
  console.log("wrote", c.out);
}
await browser.close();
