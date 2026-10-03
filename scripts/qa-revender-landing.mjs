// QA de navegador: npm install --no-save --package-lock=false @playwright/test@1.56.1
// Después: npx playwright install chromium && node scripts/qa-revender-landing.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

await mkdir("qa-artifacts", { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-static.mjs", "--port=4173"], { stdio: ["ignore", "pipe", "inherit"] });
let browser;
const report = [];
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Static server timeout")), 10000);
    server.once("error", reject);
    server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
  });
  browser = await chromium.launch();
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
    const response = await page.goto("http://127.0.0.1:4173/como-encontrar-coches-para-revender", { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator(".site-nav").count(), 1);
    assert.equal(await page.locator(".site-footer").count(), 1);
    assert.equal(await page.locator(".hub-mobile-nav").count(), 0);
    const metrics = await page.evaluate(() => {
      const overflowing = [...document.querySelectorAll("main *")].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
      }).map((node) => node.tagName + "." + node.className);
      return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflowing };
    });
    assert.ok(metrics.scrollWidth <= width + 1, JSON.stringify(metrics));
    assert.deepEqual(metrics.overflowing, [], JSON.stringify(metrics));
    const ctas = page.locator("[data-cta]");
    assert.equal(await ctas.count(), 4);
    for (let i = 0; i < 4; i++) assert.equal(await ctas.nth(i).getAttribute("href"), "#");
    if (width <= 760) {
      assert.equal(await page.locator(".rev-sticky").isVisible(), true);
      await page.locator(".nav-toggle").click();
      assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "true");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
    } else {
      assert.equal(await page.locator(".rev-sticky").isVisible(), false);
    }
    await page.screenshot({ path: "qa-artifacts/landing-" + width + ".png", fullPage: true });
    if (width === 390 || width === 1440) {
      const preview = await page.screenshot({ fullPage: false });
      console.log("QA_SCREENSHOT_" + width + "=" + preview.toString("base64"));
    }
    const question = page.locator(".rev-faq details").first();
    await question.locator("summary").click();
    assert.equal(await question.getAttribute("open"), "");
    assert.equal(await question.locator("p").isVisible(), true);
    await question.locator("summary").click();
    assert.equal(await question.getAttribute("open"), null);
    await page.locator("#pricing_cta").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".rev-sticky").isVisible(), false);
    await page.locator("#pricing_cta").click();
    const tracked = await page.evaluate(() => window.dataLayer.filter((item) => item.event === "revender_checkout_clicked"));
    assert.ok(tracked.some((item) => item.section === "pricing_cta"));
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(300);
    if (width <= 760) {
      const footerClear = await page.evaluate(() => {
        const last = document.querySelector(".footer-bottom").getBoundingClientRect();
        const sticky = document.querySelector(".rev-sticky").getBoundingClientRect();
        return last.bottom <= sticky.top;
      });
      assert.ok(footerClear, "Mobile CTA overlaps footer");
    }
    assert.deepEqual(errors, []);
    report.push({ route: "landing", ...metrics, errors, result: "passed" });
    await page.close();
  }
  for (const route of ["/", "/academia/", "/herramientas/", "/servicios/", "/servicios/consultoria/"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("https://www.googletagmanager.com/**", (request) => request.abort());
    const response = await page.goto("http://127.0.0.1:4173" + route, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator(".rev-sticky").count(), 0);
    if (route !== "/academia/") assert.equal(await page.locator(".hub-mobile-nav").count(), 1);
    report.push({ route, result: "passed" });
    await page.close();
  }
  await writeFile("qa-artifacts/report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}
