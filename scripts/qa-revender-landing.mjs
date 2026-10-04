// QA de navegador: npm install --no-save --package-lock=false @playwright/test@1.56.1
// Después: npx playwright install chromium && node scripts/qa-revender-landing.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { CHECKOUT_URL, CURRENT_PRICE, FUTURE_PRICE } from "../assets/como-encontrar-coches/config.js";

await mkdir("qa-artifacts", { recursive: true });
const server = spawn(process.execPath, ["scripts/serve-static.mjs", "--port=4173", "--root=dist"], { stdio: ["ignore", "pipe", "inherit"] });
let browser;
const report = [];
// Capturas de sección sin chrome fijo; las verificaciones funcionales lo conservan.
const sectionCaptureStyle = ".rev-header,.rev-sticky,.skip-link{visibility:hidden!important;}";
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Static server timeout")), 10000);
    server.once("error", reject);
    server.stdout.once("data", () => { clearTimeout(timer); resolve(); });
  });
  browser = await chromium.launch();
  for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const analyticsRequests = [];
    page.on("request", (request) => { if (/googletagmanager|google-analytics/.test(request.url())) analyticsRequests.push(request.url()); });
    await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
    const response = await page.goto("http://127.0.0.1:4173/como-encontrar-coches-para-revender", { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('800 48px "Barlow Condensed"')), true, "Barlow must be loaded before visual QA");
    await page.locator("#ivan-consent").waitFor({ state: "visible" });
    assert.deepEqual(analyticsRequests, [], "Analytics requested before consent");
    assert.equal(await page.evaluate(() => window.IVAN_CONSENT.getState().analytics), false);
    assert.equal((await page.context().cookies()).filter((cookie) => /^_ga|^_gid|^_gat/.test(cookie.name)).length, 0);
    const buttons = page.locator("[data-consent-choice]");
    assert.equal(await buttons.nth(0).textContent(), "RECHAZAR");
    assert.equal(await buttons.nth(1).textContent(), "CONFIGURAR");
    assert.equal(await buttons.nth(2).textContent(), "ACEPTAR");
    const rejectBox = await buttons.nth(0).boundingBox();
    const acceptBox = await buttons.nth(2).boundingBox();
    const styles = await page.evaluate(() => ["reject", "accept"].map((choice) => {
      const style = getComputedStyle(document.querySelector('[data-consent-choice="' + choice + '"]'));
      return [style.backgroundColor, style.color, style.fontWeight, style.borderColor];
    }));
    assert.deepEqual(styles[0], styles[1]);
    assert.equal(rejectBox.height, acceptBox.height);
    assert.equal(rejectBox.width, acceptBox.width);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: "qa-artifacts/cookies-" + width + ".png" });
    await buttons.nth(0).click();
    assert.equal(await page.locator("#ivan-consent").isVisible(), false);
    assert.deepEqual(analyticsRequests, []);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("ivanimports.consent.v1")).analytics), false);
    assert.doesNotMatch(await page.locator("body").innerText(), /Captura real del curso pendiente|Espacio reservado para|Fuentes y portales que poca gente conoce/);
    assert.match(await page.locator(".rev-offer").innerText(), new RegExp(CURRENT_PRICE + " €"));
    assert.match(await page.locator(".rev-update-price").innerText(), new RegExp(FUTURE_PRICE + " €"));
    assert.equal(await page.locator("#hero_cta").innerText(), "Acceder por " + CURRENT_PRICE + " €");
    for (const legalRoute of ["/aviso-legal", "/privacidad", "/cookies", "/condiciones-de-compra"]) assert.equal(await page.locator(".ivan-legal-footer a[href='" + legalRoute + "']").count(), 1);
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
    for (let i = 0; i < 4; i++) assert.equal(await ctas.nth(i).getAttribute("href"), CHECKOUT_URL);
    assert.equal(await page.locator(".nav-toggle").count(), 0);
    assert.equal(await page.locator(".nav-panel").count(), 0);
    assert.equal(await page.locator(".rev-student-link").count(), 0);
    const headerBounds = await page.locator(".rev-header").boundingBox();
    assert.ok(headerBounds.height >= 44 && headerBounds.height <= 100);
    assert.equal(await page.locator(".rev-sticky").isVisible(), false);
    await page.screenshot({ path: "qa-artifacts/landing-" + width + ".png", fullPage: true });
    await page.locator(".rev-hero").screenshot({ path: "qa-artifacts/hero-" + width + ".png", style: sectionCaptureStyle });
    if (width === 390 || width === 1440) {
      const preview = await page.screenshot({ fullPage: false });
      console.log("QA_SCREENSHOT_" + width + "=" + preview.toString("base64"));
    }
    // Part of the hero is still visible: the sticky must remain hidden.
    await page.evaluate(() => {
      const hero = document.querySelector(".rev-hero");
      window.scrollTo({ top: hero.offsetTop + hero.offsetHeight - 40, behavior: "instant" });
    });
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".rev-sticky").isVisible(), false);
    await page.evaluate(() => {
      const hero = document.querySelector(".rev-hero");
      window.scrollTo({ top: hero.offsetTop + hero.offsetHeight + 2, behavior: "instant" });
    });
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".rev-sticky").isVisible(), width <= 760);
    await page.screenshot({ path: "qa-artifacts/after-hero-" + width + ".png" });
    const questions = page.locator("details");
    assert.equal(await questions.count(), 6);
    for (let i = 0; i < 6; i++) {
      const question = questions.nth(i);
      await question.locator("summary").click();
      assert.equal(await question.getAttribute("open"), "");
      assert.equal(await question.locator("p").isVisible(), true);
      await question.locator("summary").press("Enter");
      assert.equal(await question.getAttribute("open"), null);
    }
    for (const [name, selector] of [["proceso", ".rev-flow"], ["mercado", "#precio-de-mercado"], ["casos", "#casos-reales"]]) {
      await page.locator(selector).screenshot({ path: "qa-artifacts/" + name + "-" + width + ".png", style: sectionCaptureStyle });
      if (width === 1440 && name === "mercado") {
        await page.locator(selector).scrollIntoViewIfNeeded();
        console.log("QA_MARKET_1440=" + (await page.screenshot({ style: sectionCaptureStyle })).toString("base64"));
      }
    }
    if (width === 390) console.log("QA_CASES_390=" + (await page.locator("#casos-reales").screenshot({ style: sectionCaptureStyle })).toString("base64"));
    if (width === 1440) console.log("QA_PROCESS_1440=" + (await page.locator(".rev-flow").screenshot({ style: sectionCaptureStyle })).toString("base64"));
    await page.locator("#preguntas-frecuentes").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "qa-artifacts/faq-" + width + ".png" });
    await page.locator("#pricing_cta").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    assert.equal(await page.locator(".rev-sticky").isVisible(), false);
    await page.screenshot({ path: "qa-artifacts/pricing-" + width + ".png" });
    await page.locator("#acceder").screenshot({ path: "qa-artifacts/pricing-section-" + width + ".png", style: sectionCaptureStyle });
    if (width === 390) {
      const preview = await page.screenshot();
      console.log("QA_PRICING_390=" + preview.toString("base64"));
    }
    if (CHECKOUT_URL === "#") await page.locator("#pricing_cta").click();
    else await page.locator("#pricing_cta").dispatchEvent("click", { cancelable: true });
    const tracked = await page.evaluate(() => window.dataLayer.filter((item) => item.event === "revender_checkout_clicked"));
    assert.ok(tracked.some((item) => item.section === "pricing_cta"));
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(300);
    if (width <= 760) {
      const footerClear = await page.evaluate(() => {
        const last = document.querySelector("footer").getBoundingClientRect();
        const sticky = document.querySelector(".rev-sticky").getBoundingClientRect();
        return last.bottom <= sticky.top;
      });
      assert.ok(footerClear, "Mobile CTA overlaps footer");
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".rev-sticky").isVisible(), false);
    assert.deepEqual(errors, []);
    report.push({ route: "landing", ...metrics, errors, analyticsBeforeConsent: analyticsRequests.length, configuredCheckout: CHECKOUT_URL, realCourseAssets: await page.locator("[data-course-preview] img").count(), result: "passed" });
    await page.close();
  }
  // Verifica consentimiento, persistencia y retirada con GTM simulado.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let requests = 0;
    await page.route("https://www.googletagmanager.com/**", async (route) => {
      requests++;
      await route.fulfill({ contentType: "application/javascript", body: 'document.cookie="_ga=qa-analytics; path=/; SameSite=Lax";' });
    });
    await page.goto("http://127.0.0.1:4173/como-encontrar-coches-para-revender", { waitUntil: "networkidle" });
    assert.equal(requests, 0);
    await page.locator('[data-consent-choice="configure"]').click();
    assert.equal(await page.locator("#ivan-consent-analytics").isChecked(), false);
    await page.screenshot({ path: "qa-artifacts/cookies-configure-390.png" });
    await page.locator('[data-consent-choice="save"]').click();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator("#ivan-consent").isVisible(), false);
    assert.equal(requests, 0);
    await page.locator(".ivan-legal-footer [data-consent-open]").click();
    await page.locator('[data-consent-choice="accept"]').click();
    await page.waitForFunction(() => document.cookie.includes("_ga=qa-analytics"));
    assert.equal(requests, 1);
    assert.equal(await page.evaluate(() => window.IVAN_CONSENT.getState().analytics), true);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(requests, 2);
    assert.equal(await page.locator("#ivan-consent").isVisible(), false);
    await page.locator(".ivan-legal-footer [data-consent-open]").click();
    assert.equal(await page.locator("#ivan-consent-analytics").isChecked(), true);
    await page.locator("#ivan-consent-analytics").uncheck();
    await page.locator('[data-consent-choice="save"]').click();
    assert.equal(await page.evaluate(() => window.IVAN_CONSENT.getState().analytics), false);
    assert.equal((await page.context().cookies()).filter((cookie) => cookie.name.startsWith("_ga")).length, 0);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(requests, 2);
    const updates = await page.evaluate(() => window.dataLayer.filter((item) => item[0] === "consent").map((item) => item[2].analytics_storage));
    assert.deepEqual(updates, ["denied", "denied"]);
    report.push({ route: "consent-lifecycle", defaultOff: true, rejectPersists: true, acceptLoads: true, withdrawalRemovesCookies: true, result: "passed" });
    await page.close();
  }
  for (const route of ["/aviso-legal", "/privacidad", "/cookies", "/condiciones-de-compra"]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
    const response = await page.goto("http://127.0.0.1:4173" + route, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    await page.locator('[data-consent-choice="reject"]').click();
    assert.equal(await page.locator("h1").count(), 1);
    const text = await page.locator("main").innerText();
    for (const identity of ["Ivan Pogrebnyak Pristupa", "09880800T", "Calle Cristóbal Colón 3", "29649 Mijas", "radarivanimports@gmail.com", "Autónomo"]) assert.ok(text.includes(identity));
    if (route === "/condiciones-de-compra") assert.ok(text.includes("incluidos los impuestos aplicables cuando corresponda"));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: "qa-artifacts/legal-" + route.slice(1) + "-320.png", fullPage: true });
    report.push({ route, result: "passed" });
    await page.close();
  }
  for (const route of ["/", "/academia/", "/herramientas/", "/servicios/", "/servicios/consultoria/"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route("https://www.googletagmanager.com/**", (request) => request.abort());
    const response = await page.goto("http://127.0.0.1:4173" + route, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.equal(await page.locator(".rev-sticky").count(), 0);
    if (["/", "/servicios/", "/servicios/consultoria/"].includes(route)) assert.equal(await page.locator(".hub-mobile-nav").count(), 1);
    report.push({ route, result: "passed" });
    await page.close();
  }
  await writeFile("qa-artifacts/report.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser) await browser.close();
  server.kill();
}
