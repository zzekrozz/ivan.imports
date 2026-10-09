import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { PNG } from "pngjs";
import { chromium } from "@playwright/test";
import { CHECKOUT_URL } from "../assets/como-encontrar-coches/config.js";

const ROOT = "http://127.0.0.1:4173";
const REF = "http://127.0.0.1:4174";
const PATH = "/como-encontrar-coches-para-revender";
const WIDTHS = [320, 360, 390, 430, 768, 1024, 1440];
const OUT = "qa-artifacts";
await mkdir(OUT, { recursive: true });
const servers = [spawn(process.execPath, ["scripts/serve-static.mjs", "--port=4173", "--root=dist"], { stdio: ["ignore", "pipe", "inherit"] }), spawn(process.execPath, ["scripts/serve-static.mjs", "--port=4174", "--root=."], { stdio: ["ignore", "pipe", "inherit"] })];
let browser;
const report = { responsive: [], functionality: {}, legal: [], existingRoutes: [] };
const savedConsent = { version: 1, analytics: false, savedAt: Date.now() };
const seed = async (page) => page.addInitScript((record) => localStorage.setItem("ivanimports.consent.v1", JSON.stringify(record)), savedConsent);
async function ready(page, url) {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, url);
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Carga también las imágenes lazy antes de comparar capturas completas.
    for (const image of document.images) image.loading = "eager";
    await Promise.all([...document.images].map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })));
  });
  assert.ok(await page.evaluate(() => document.fonts.check('800 48px "Barlow Condensed"')), "Barlow Condensed must be loaded");
  assert.ok(await page.evaluate(() => document.fonts.check('400 18px "Barlow"')), "Barlow must be loaded");
  assert.deepEqual(await page.locator("img").evaluateAll(images => images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.src)), [], "Broken images");
}
function compare(a, b) {
  const actual = PNG.sync.read(a), reference = PNG.sync.read(b);
  assert.equal(actual.width, reference.width);
  assert.equal(actual.height, reference.height, "Reference and implementation must have the same page height");
  let changed = 0, maxChannelDelta = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(actual.data[i+c] - reference.data[i+c]));
    if (delta) changed++;
    maxChannelDelta = Math.max(maxChannelDelta, delta);
  }
  return { changedPixels: changed, totalPixels: actual.width * actual.height, maxChannelDelta, height: actual.height };
}
try {
  await Promise.all(servers.map(server => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Static server timeout")), 10000);
    server.once("error", reject);
    server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
  })));
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const http = (await browser.newContext()).request;
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "light" });
    const page = await context.newPage(), reference = await context.newPage();
    await seed(page); await seed(reference);
    const errors = [], consoleErrors = [], analytics = [], youtube = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("request", request => {
      if (/googletagmanager|google-analytics/.test(request.url())) analytics.push(request.url());
      if (/youtube(?:-nocookie)?\.com/.test(request.url())) youtube.push(request.url());
    });
    await ready(page, ROOT + PATH);
    await ready(reference, REF + "/docs/landing-final/como-encontrar-coches-para-revender.html");
    assert.equal(await page.locator(".hub-mobile-nav").count(), 0);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator("[data-cta]").count(), 3);
    for (const id of ["cta-hero", "cta-precio", "cta-final"]) assert.equal(await page.locator("#" + id).getAttribute("href"), CHECKOUT_URL);
    assert.deepEqual(analytics, [], "Analytics before consent");
    assert.deepEqual(youtube, [], "YouTube before Play");
    assert.equal(await page.locator("#player iframe").count(), 0);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll("body *")].filter(node => {
        if (node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.closest("svg")) return false;
        const box = node.getBoundingClientRect();
        return box.width > 0 && (box.right > innerWidth + 1 || box.left < -1);
      }).map(node => ({ tag: node.tagName, class: typeof node.className === "string" ? node.className : "", right: node.getBoundingClientRect().right }))
    }));
    assert.ok(metrics.scrollWidth <= width, JSON.stringify(metrics));
    // Descendientes inclinados del hero/ad pueden sobresalir de su padre sin desbordar la página.
    const screenshot = await page.screenshot({ fullPage: true, animations: "disabled", path: OUT + "/landing-" + width + ".png" });
    const refScreenshot = await reference.screenshot({ fullPage: true, animations: "disabled", path: OUT + "/reference-" + width + ".png" });
    const pixels = compare(screenshot, refScreenshot);
    assert.equal(pixels.changedPixels, 0, "Visual difference at " + width + ": " + JSON.stringify(pixels));
    await page.locator(".hero").screenshot({ path: OUT + "/hero-" + width + ".png", animations: "disabled" });
    await page.locator("#precio").screenshot({ path: OUT + "/precio-" + width + ".png", animations: "disabled" });
    for (const detail of await page.locator("details").all()) {
      await detail.locator("summary").click();
      assert.equal(await detail.getAttribute("open"), "");
      assert.equal(await detail.locator("p").isVisible(), true);
      await detail.locator("summary").press("Enter");
      assert.equal(await detail.getAttribute("open"), null);
    }
    for (const id of ["cta-hero", "cta-precio", "cta-final"]) {
      await page.locator("#" + id).evaluate(node => node.addEventListener("click", event => event.preventDefault(), { once: true }));
      await page.locator("#" + id).click();
    }
    const events = await page.evaluate(() => window.dataLayer.filter(item => item.event === "revender_checkout_clicked").map(item => item.section));
    assert.deepEqual(events, ["hero_cta", "mid_cta", "pricing_cta"]);
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    report.responsive.push({ width, ...metrics, ...pixels, consoleErrors, errors, result: "passed" });
    await context.close();
  }
  // Comprobar el ciclo real de consentimiento sin duplicar el gestor global.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let gtmRequests = 0;
    await page.route("https://www.googletagmanager.com/**", async route => {
      gtmRequests++;
      await route.fulfill({ contentType: "application/javascript", body: 'document.cookie="_ga=qa-analytics; path=/; SameSite=Lax";' });
    });
    await page.goto(ROOT + PATH, { waitUntil: "networkidle" });
    assert.equal(gtmRequests, 0);
    assert.equal(await page.locator("#ivan-consent").count(), 1);
    const parity = await page.evaluate(() => ["reject", "accept"].map(choice => {
      const node = document.querySelector('[data-consent-choice="' + choice + '"]'), css = getComputedStyle(node);
      return [css.backgroundColor, css.color, css.borderColor, css.fontWeight, node.getBoundingClientRect().width, node.getBoundingClientRect().height];
    }));
    assert.deepEqual(parity[0], parity[1]);
    await page.screenshot({ path: OUT + "/cookies-390.png" });
    await page.locator('[data-consent-choice="configure"]').click();
    assert.equal(await page.locator("#ivan-consent-analytics").isChecked(), false);
    await page.locator('[data-consent-choice="reject"]').click();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(gtmRequests, 0);
    assert.equal(await page.locator("#ivan-consent").isVisible(), false);
    await page.evaluate(() => window.IVAN_CONSENT.openSettings());
    await page.locator('[data-consent-choice="accept"]').click();
    await page.waitForFunction(() => document.cookie.includes("_ga=qa-analytics"));
    assert.equal(gtmRequests, 1);
    await page.evaluate(() => window.IVAN_CONSENT.openSettings());
    await page.locator("#ivan-consent-analytics").uncheck();
    await page.locator('[data-consent-choice="save"]').click();
    assert.equal(await page.evaluate(() => window.IVAN_CONSENT.getState().analytics), false);
    assert.equal((await page.context().cookies()).filter(cookie => cookie.name.startsWith("_ga")).length, 0);
    report.functionality.consent = { defaultOff: true, rejectPersists: true, acceptLoadsOnce: true, withdrawalRemovesCookies: true, result: "passed" };
    await page.close();
  }
  // Comprueba el reproductor real; las peticiones de YouTube empiezan únicamente después del clic.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await seed(page);
    const requests = [];
    page.on("request", request => { if (/youtube-nocookie\.com/.test(request.url())) requests.push(request.url()); });
    await ready(page, ROOT + PATH);
    assert.equal(requests.length, 0);
    await page.locator("#player").scrollIntoViewIfNeeded();
    await page.screenshot({ path: OUT + "/video-before-play-390.png" });
    await page.locator("#player img").click();
    const iframe = page.locator("#player iframe");
    assert.equal(await iframe.count(), 1);
    assert.equal(await iframe.getAttribute("src"), "https://www.youtube-nocookie.com/embed/lcBzFPKjWyQ?autoplay=1&rel=0");
    assert.ok((await iframe.getAttribute("allow")).includes("autoplay"));
    assert.ok(requests.length > 0);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: OUT + "/video-after-play-390.png" });
    const frame = page.frames().find(frame => frame.url().includes("youtube-nocookie"));
    const playback = frame ? await frame.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 800), video: [...document.querySelectorAll("video")].map(video => ({ currentTime: video.currentTime, readyState: video.readyState, paused: video.paused })) })).catch(error => ({ error: error.message })) : null;
    report.functionality.video = { lazyIframe: true, privacyHost: true, autoplayAfterClick: true, requestsAfterClick: requests.length, playback, result: "passed" };
    await page.close();
  }
  for (const path of ["/assets/hero-golf.webp", "/assets/ad-golf.webp", "/assets/video-thumb.webp", "/assets/og-landing-revender.jpg", "/assets/favicon/favicon.ico", "/assets/favicon/favicon-32x32.png", "/assets/favicon/favicon-192x192.png", "/assets/favicon/favicon-512x512.png", "/assets/favicon/apple-touch-icon.png"]) {
    const response = await http.get(ROOT + path);
    assert.equal(response.status(), 200);
    assert.deepEqual(await response.body(), await readFile("docs/landing-final" + path));
  }
  report.functionality.assets = { byteIdentical: true, allAccessible: true, result: "passed" };
  for (const path of ["/aviso-legal", "/privacidad", "/cookies", "/condiciones-de-compra"]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
    await seed(page);
    const response = await page.goto(ROOT + path, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator("h1").count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    report.legal.push({ path, result: "passed" });
    await page.close();
  }
  for (const path of ["/", "/academia/", "/herramientas/", "/servicios/", "/servicios/consultoria/"]) {
    const response = await http.get(ROOT + path);
    assert.equal(response.status(), 200);
    report.existingRoutes.push({ path, result: "passed" });
  }
  await writeFile(OUT + "/report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(OUT + "/report-partial.json", JSON.stringify(report, null, 2) + "\n");
  if (browser) await browser.close();
  for (const server of servers) server.kill();
}
