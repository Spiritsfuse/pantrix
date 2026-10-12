// Capture real browser evidence of the running Pantrix stack with Playwright.
//
//   GRAFANA_PASSWORD=... ARGOCD_PASSWORD=... node capture-browser.mjs [group ...]
//   groups: app crud api ingress prometheus grafana argocd   (default: all)
//
// Every page is the live system (Compose on :3000/:8000, kind Ingress hosts).
// Each PNG is saved twice: <name>.png (the page itself) and, for the README and
// slides, <name>-framed.png wrapped in a minimal browser frame whose address bar
// shows page.url() of the captured page. Passwords are read from the environment
// and never written to disk.

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..", "..");
const outDir = resolve(repo, "docs", "evidence");
mkdirSync(outDir, { recursive: true });

const APP = process.env.APP_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const INGRESS = process.env.INGRESS_URL ?? "http://pantrix.localtest.me";
const PROM = process.env.PROM_URL ?? "http://prometheus.localtest.me";
const GRAFANA = process.env.GRAFANA_URL ?? "http://grafana.localtest.me";
const ARGOCD = process.env.ARGOCD_URL ?? "http://argocd.localtest.me";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function frame(browser, pngPath, url, width) {
  const b64 = readFileSync(pngPath).toString("base64");
  const ctx = await browser.newContext({ viewport: { width: width + 40, height: 400 }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  const safeUrl = url.replace(/[<>&]/g, "");
  await pg.setContent(`<!doctype html><html><body style="margin:0;padding:20px;background:#efe6d6">
    <div id="w" style="width:${width}px;border-radius:10px;overflow:hidden;box-shadow:0 18px 40px -18px rgba(43,33,26,.5);background:#fff">
      <div style="display:flex;align-items:center;gap:7px;padding:9px 12px;background:#e9e2d6;font:13px Segoe UI,sans-serif">
        <span style="width:11px;height:11px;border-radius:50%;background:#ff5f57"></span>
        <span style="width:11px;height:11px;border-radius:50%;background:#febc2e"></span>
        <span style="width:11px;height:11px;border-radius:50%;background:#28c840"></span>
        <span style="margin-left:12px;flex:1;background:#fff;border-radius:6px;padding:4px 10px;color:#3b3029">${safeUrl}</span>
      </div>
      <img style="display:block;width:${width}px" src="data:image/png;base64,${b64}">
    </div></body></html>`);
  await pg.locator("#w").screenshot({ path: pngPath.replace(/\.png$/, "-framed.png") });
  await ctx.close();
}

async function shot(browser, page, name, { fullPage = false, width } = {}) {
  const path = resolve(outDir, `${name}.png`);
  await page.screenshot({ path, fullPage });
  await frame(browser, path, page.url(), width ?? page.viewportSize().width);
  console.log(`captured ${name}.png  <- ${page.url()}`);
}

async function newPage(browser, width = 1440, height = 900, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...extra });
  return ctx.newPage();
}

const groups = {
  async app(browser) {
    const page = await newPage(browser);
    await page.goto(`${APP}/#/shelf`);
    await page.getByTestId("item-card").first().waitFor();
    await pause(600);
    await shot(browser, page, "application-desktop");
    await shot(browser, page, "application-desktop-full", { fullPage: true });
    await page.getByRole("button", { name: "Expired", exact: true }).click();
    await pause(700);
    await shot(browser, page, "application-filter-expired");
    await page.goto(`${APP}/#/donors`);
    await page.getByRole("table").waitFor();
    await pause(400);
    await shot(browser, page, "application-donors");
    await page.goto(`${APP}/#/handouts`);
    await page.locator(".timeline").waitFor();
    await pause(400);
    await shot(browser, page, "application-handouts");

    const mobile = await newPage(browser, 390, 844, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await mobile.goto(`${APP}/#/shelf`);
    await mobile.getByTestId("item-card").first().waitFor();
    await pause(600);
    await shot(browser, mobile, "application-mobile", { width: 390 });

    // Error state: the browser is told the API is unreachable (Playwright aborts
    // /api requests); the UI shown is the real error handling of the app.
    const offline = await newPage(browser);
    await offline.route("**/api/**", (route) => route.abort("connectionrefused"));
    await offline.goto(`${APP}/#/shelf`);
    await offline.getByRole("alert").first().waitFor();
    await pause(300);
    await shot(browser, offline, "application-error-state");
  },

  async crud(browser) {
    const page = await newPage(browser);
    await page.goto(`${APP}/#/shelf`);
    await page.getByTestId("item-card").first().waitFor();
    // Create
    await page.getByRole("button", { name: /log donation/i }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel("Item name", { exact: true }).fill("Sunflower oil 1L");
    await drawer.getByLabel("Category", { exact: true }).selectOption("canned");
    await drawer.getByLabel("Donor", { exact: true }).selectOption({ label: "Northgate Wholesale Foods" });
    await drawer.getByLabel("Quantity", { exact: true }).fill("24");
    await drawer.getByLabel("Unit", { exact: true }).selectOption("litres");
    const expiry = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    await drawer.getByLabel("Expiry date", { exact: true }).fill(expiry);
    await drawer.getByLabel("Shelf code", { exact: true }).fill("C1-07");
    await drawer.getByLabel("Notes", { exact: true }).fill("Logged during the Pantrix demo by Dhruv Sharma");
    await pause(300);
    await shot(browser, page, "crud-1-create-form");
    await drawer.getByRole("button", { name: /add to shelf/i }).click();
    await page.getByText("Logged “Sunflower oil 1L”").waitFor();
    await page.getByText("Sunflower oil 1L", { exact: true }).scrollIntoViewIfNeeded();
    await pause(300);
    await shot(browser, page, "crud-2-created");
    // Update
    await page.getByRole("button", { name: "Edit Sunflower oil 1L" }).click();
    await page.getByRole("dialog").getByLabel("Quantity", { exact: true }).fill("20");
    await pause(200);
    await shot(browser, page, "crud-3-edit-form");
    await page.getByRole("dialog").getByRole("button", { name: /save changes/i }).click();
    await page.getByText("Updated “Sunflower oil 1L”").waitFor();
    // Hand out
    await page.getByRole("article").filter({ hasText: "Sunflower oil 1L" }).getByRole("button", { name: /hand out/i }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Recipient organisation", { exact: true }).fill("Girls' Hostel Outreach");
    await dialog.getByLabel(/Quantity/).fill("6");
    await pause(200);
    await shot(browser, page, "crud-4-handout-form");
    await dialog.getByRole("button", { name: /^hand out$/i }).click();
    await page.getByText(/Handed out 6 × Sunflower oil 1L/).waitFor();
    await pause(300);
    await shot(browser, page, "crud-5-handout-done");
    // Validation error from the API (quantity larger than stock)
    await page.getByRole("article").filter({ hasText: "Sunflower oil 1L" }).getByRole("button", { name: /hand out/i }).click();
    await page.getByRole("dialog").getByLabel("Recipient organisation", { exact: true }).fill("Over-ask test");
    await page.getByRole("dialog").getByLabel(/Quantity/).fill("500");
    await page.getByRole("dialog").getByRole("button", { name: /^hand out$/i }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor();
    await pause(200);
    await shot(browser, page, "crud-6-api-conflict-error");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    // Delete
    const card = page.getByRole("article").filter({ hasText: "Sunflower oil 1L" });
    await card.getByRole("button", { name: "Delete Sunflower oil 1L" }).click();
    await pause(200);
    await shot(browser, page, "crud-7-delete-confirm");
    await card.getByRole("button", { name: "Remove" }).click();
    await page.getByText("Removed “Sunflower oil 1L” from the shelf").waitFor();
    await pause(300);
    await shot(browser, page, "crud-8-deleted");
  },

  async api(browser) {
    const page = await newPage(browser);
    await page.goto(`${API}/docs`);
    await page.locator(".opblock").first().waitFor();
    await pause(800);
    await shot(browser, page, "api-swagger-docs", { fullPage: true });
  },

  async ingress(browser) {
    const page = await newPage(browser);
    await page.goto(`${INGRESS}/#/shelf`);
    await page.getByTestId("item-card").first().waitFor();
    await pause(600);
    await shot(browser, page, "ingress-application");
    await page.goto(`${INGRESS}/api/items/stats`);
    await pause(300);
    await shot(browser, page, "ingress-api-route", { width: 1440 });
  },

  async prometheus(browser) {
    const page = await newPage(browser, 1440, 1000);
    await page.goto(`${PROM}/targets?search=pantrix-backend`);
    await page.getByText("pantrix-backend").first().waitFor({ timeout: 30000 });
    await pause(1500);
    await shot(browser, page, "prometheus-targets", { fullPage: true });
    const q = encodeURIComponent('sum by (handler) (rate(http_requests_total{job="pantrix-backend"}[1m]))');
    await page.goto(`${PROM}/query?g0.expr=${q}&g0.tab=graph&g0.range_input=30m`);
    await pause(4000);
    await shot(browser, page, "prometheus-query");
  },

  async grafana(browser) {
    const page = await newPage(browser, 1600, 1100);
    await page.goto(`${GRAFANA}/login`);
    await page.locator('input[name="user"]').fill("admin");
    await page.locator('input[name="password"]').fill(process.env.GRAFANA_PASSWORD ?? "");
    await page.getByRole("button", { name: /log in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
    await page.goto(`${GRAFANA}/d/pantrix-overview/pantrix-api-overview?orgId=1&from=now-30m&to=now&refresh=10s`);
    await pause(9000);
    await shot(browser, page, "grafana-dashboard");
  },

  async argocd(browser) {
    const page = await newPage(browser, 1600, 1000);
    await page.goto(`${ARGOCD}/login`);
    await page.locator("input").first().fill("admin");
    await page.locator('input[type="password"]').fill(process.env.ARGOCD_PASSWORD ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => u.pathname.startsWith("/applications"), { timeout: 30000 });
    await pause(2500);
    await shot(browser, page, "argocd-applications");
    await page.goto(`${ARGOCD}/applications/argocd/pantrix-dev?view=tree`);
    await pause(5000);
    await shot(browser, page, "argocd-application");
  },
};

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(groups);
  const browser = await chromium.launch();
  for (const name of names) {
    try {
      await groups[name](browser);
    } catch (e) {
      console.error(`!! ${name} failed: ${e.message.split("\n")[0]}`);
      process.exitCode = 1;
    }
  }
  await browser.close();
}

main();
