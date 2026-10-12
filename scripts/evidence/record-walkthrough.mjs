// Record live browser walkthrough clips for the demo video with Playwright.
//
//   GRAFANA_PASSWORD=... ARGOCD_PASSWORD=... node record-walkthrough.mjs [clip ...]
//   clips: app swagger prometheus grafana argocd   (default: all)
//
// Output: demo/.work/clips/<clip>.webm at 1920x1080. Everything shown is the live
// system; a small caption bar names the URL being shown.

import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const outDir = resolve(repo, "demo", ".work", "clips");
mkdirSync(outDir, { recursive: true });

const INGRESS = process.env.INGRESS_URL ?? "http://pantrix.localtest.me";
const API = process.env.API_URL ?? "http://localhost:8000";
const PROM = process.env.PROM_URL ?? "http://prometheus.localtest.me";
const GRAFANA = process.env.GRAFANA_URL ?? "http://grafana.localtest.me";
const ARGOCD = process.env.ARGOCD_URL ?? "http://argocd.localtest.me";
const W = 1920;
const H = 1080;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Show the current URL in a slim bar at the bottom of every recorded page.
const urlBar = `
  (() => {
    const show = () => {
      if (!document.body) return;
      let bar = document.getElementById("__rec_url");
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "__rec_url";
        bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:6px 16px;" +
          "font:14px Consolas,monospace;background:rgba(43,33,26,.88);color:#fbf6ec;pointer-events:none";
        document.body.appendChild(bar);
      }
      bar.textContent = "LIVE  " + location.href;
    };
    document.addEventListener("DOMContentLoaded", show);
    setInterval(show, 500);
  })();`;

async function record(browser, name, fn) {
  const tmp = resolve(outDir, `${name}-tmp`);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: tmp, size: { width: W, height: H } },
  });
  await ctx.addInitScript(urlBar);
  const page = await ctx.newPage();
  try {
    await fn(page);
  } finally {
    await ctx.close();
  }
  const [file] = readdirSync(tmp);
  renameSync(resolve(tmp, file), resolve(outDir, `${name}.webm`));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`recorded ${name}.webm`);
}

async function slowType(locator, text) {
  await locator.click();
  await locator.pressSequentially(text, { delay: 45 });
}

const clips = {
  async app(page) {
    await page.goto(`${INGRESS}/#/shelf`);
    await page.getByTestId("item-card").first().waitFor();
    await pause(3500);
    await page.mouse.wheel(0, 500);
    await pause(2000);
    await page.mouse.wheel(0, -500);
    await page.getByRole("button", { name: "Use soon", exact: true }).click();
    await pause(2200);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await pause(1200);
    // Create
    await page.getByRole("button", { name: /log donation/i }).click();
    const d = page.getByRole("dialog");
    await slowType(d.getByLabel("Item name", { exact: true }), "Moong dal 1kg packs");
    await d.getByLabel("Category", { exact: true }).selectOption("grains");
    await d.getByLabel("Donor", { exact: true }).selectOption({ label: "Greenrow Organic Farm" });
    await d.getByLabel("Quantity", { exact: true }).fill("40");
    await d.getByLabel("Unit", { exact: true }).selectOption("packs");
    await d.getByLabel("Expiry date", { exact: true }).fill(new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10));
    await slowType(d.getByLabel("Shelf code", { exact: true }), "A2-06");
    await pause(1200);
    await d.getByRole("button", { name: /add to shelf/i }).click();
    await page.getByText("Logged “Moong dal 1kg packs”").waitFor();
    await page.getByRole("button", { name: "Fresh", exact: true }).click();
    await pause(2500);
    // Update
    const card = page.getByRole("article").filter({ hasText: "Moong dal 1kg packs" });
    await card.scrollIntoViewIfNeeded();
    await card.getByRole("button", { name: "Edit Moong dal 1kg packs" }).click();
    await page.getByRole("dialog").getByLabel("Quantity", { exact: true }).fill("36");
    await pause(1200);
    await page.getByRole("dialog").getByRole("button", { name: /save changes/i }).click();
    await pause(2000);
    // Hand out
    await card.getByRole("button", { name: /hand out/i }).click();
    const h = page.getByRole("dialog");
    await slowType(h.getByLabel("Recipient organisation", { exact: true }), "Shelter Home Ward 4");
    await h.getByLabel(/Quantity/).fill("10");
    await pause(1000);
    await h.getByRole("button", { name: /^hand out$/i }).click();
    await pause(2500);
    await page.getByRole("button", { name: "Hand-outs" }).click();
    await pause(3000);
    await page.getByRole("button", { name: "Donors" }).click();
    await pause(3000);
    await page.getByRole("button", { name: "Shelf" }).click();
    await page.getByRole("button", { name: "Fresh", exact: true }).click();
    await pause(1500);
    // Delete
    const again = page.getByRole("article").filter({ hasText: "Moong dal 1kg packs" });
    await again.scrollIntoViewIfNeeded();
    await again.getByRole("button", { name: "Delete Moong dal 1kg packs" }).click();
    await pause(1500);
    await again.getByRole("button", { name: "Remove" }).click();
    await pause(3000);
    // Mobile-sized layout
    await page.setViewportSize({ width: 430, height: 900 });
    await pause(2500);
    await page.setViewportSize({ width: W, height: H });
    await pause(1000);
  },

  async swagger(page) {
    await page.goto(`${API}/docs`);
    await page.locator(".opblock").first().waitFor();
    await pause(2500);
    await page.mouse.wheel(0, 700);
    await pause(2000);
    const get = page.locator(".opblock-get").filter({ hasText: "/api/items/stats" }).first();
    await get.click();
    await pause(800);
    await get.getByRole("button", { name: "Try it out" }).click();
    await get.getByRole("button", { name: "Execute" }).click();
    await pause(3500);
    await page.goto(`${API}/metrics`);
    await pause(3500);
  },

  async prometheus(page) {
    await page.goto(`${PROM}/targets?search=pantrix-backend`);
    await page.getByText("pantrix-backend").first().waitFor({ timeout: 30000 });
    await pause(4500);
    const q = encodeURIComponent('sum by (handler) (rate(http_requests_total{job="pantrix-backend"}[1m]))');
    await page.goto(`${PROM}/query?g0.expr=${q}&g0.tab=graph&g0.range_input=30m`);
    await pause(6000);
    await page.goto(`${PROM}/alerts`);
    await pause(3500);
  },

  async grafana(page) {
    await page.goto(`${GRAFANA}/login`);
    await page.locator('input[name="user"]').fill("admin");
    await page.locator('input[name="password"]').fill(process.env.GRAFANA_PASSWORD ?? "");
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    await page.goto(`${GRAFANA}/d/pantrix-overview/pantrix-api-overview?orgId=1&from=now-30m&to=now&refresh=5s`);
    await pause(9000);
    await page.mouse.move(900, 600);
    await page.mouse.wheel(0, 500);
    await pause(4000);
    await page.mouse.wheel(0, 600);
    await pause(4000);
    await page.mouse.wheel(0, -1100);
    await pause(3000);
  },

  async argocd(page) {
    await page.goto(`${ARGOCD}/login`);
    await page.locator("input").first().fill("admin");
    await page.locator('input[type="password"]').fill(process.env.ARGOCD_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/applications"), { timeout: 30000 });
    await pause(3500);
    await page.goto(`${ARGOCD}/applications/argocd/pantrix-dev?view=tree`);
    await pause(6000);
    await page.goto(`${ARGOCD}/applications/argocd/pantrix-dev?view=tree&resource=&node=argoproj.io%2FApplication%2Fargocd%2Fpantrix-dev%2F0&tab=manifest`);
    await pause(4500);
  },
};

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(clips);
  const browser = await chromium.launch();
  for (const name of names) {
    try {
      await record(browser, name, clips[name]);
    } catch (e) {
      console.error(`!! ${name}: ${e.message.split("\n")[0]}`);
      process.exitCode = 1;
    }
  }
  await browser.close();
}

main();
