import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderRevenderLanding } from "../scripts/render-revender-landing.mjs";
import * as config from "../assets/como-encontrar-coches/config.js";

const reference = await readFile(new URL("../docs/landing-final/como-encontrar-coches-para-revender.html", import.meta.url), "utf8");
test("Commerce config updates the three reference CTAs and prices without automatic date switching", () => {
  const html = renderRevenderLanding({ ...config, CURRENT_PRICE: 61, FUTURE_PRICE: 103, PRICE_CHANGE_DATE: "2027-12-02", CHECKOUT_URL: "https://example.systeme.io/checkout?a=1&b=2" });
  const anchors = [...html.matchAll(/<a\b[^>]+data-cta="([^"]+)"[^>]*>/g)];
  assert.equal(anchors.length, 3);
  for (const [tag] of anchors) assert.ok(tag.includes('href="https://example.systeme.io/checkout?a=1&amp;b=2"'));
  assert.ok(html.includes("61 €"));
  assert.ok(html.includes("103 €"));
  assert.ok(html.includes("2 de diciembre"));
  assert.ok(!html.includes("59 €"));
});
test("Final reference CSS, commercial markup and SEO are preserved", async () => {
  const html = await readFile(new URL("../como-encontrar-coches-para-revender/index.html", import.meta.url), "utf8");
  assert.equal(html, renderRevenderLanding());
  assert.equal(html.match(/<style>[\s\S]*?<\/style>/)[0], reference.match(/<style>[\s\S]*?<\/style>/)[0]);
  for (const metadata of reference.matchAll(/<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link rel="(?:canonical|icon|apple-touch-icon)"[^>]*>/g)) assert.ok(html.includes(metadata[0]));
  const normalizeBody = (source) => source.match(/<body[^>]*>([\s\S]*?)<script>/)[1].replaceAll('src="/assets/', 'src="assets/').replace(/ data-event="[^"]*" data-section="[^"]*" data-item="[^"]*"/g, "");
  assert.equal(normalizeBody(html), normalizeBody(reference));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/<details>/g) || []).length, 6);
  assert.equal((html.match(/data-consent-default/g) || []).length, 1);
  assert.equal((html.match(/src="\/assets\/consent.js"/g) || []).length, 1);
  assert.equal((html.match(/src="\/assets\/site.js"/g) || []).length, 1);
  assert.doesNotMatch(html, /f8f89213|school\/course\/encuentra|rev-placeholder|Captura real del curso pendiente/);
  for (const id of ["cta-hero", "cta-precio", "cta-final"]) assert.ok(html.includes('id="' + id + '"'));
});
test("Production checkout, video and assets use the approved final values", async () => {
  assert.equal(config.CHECKOUT_URL, "https://pogrebnyakivan123.systeme.io/curso-encontrar");
  const html = renderRevenderLanding();
  assert.ok(html.includes('data-youtube="lcBzFPKjWyQ"'));
  assert.ok(html.includes("https://www.youtube-nocookie.com/embed/"));
  assert.ok(!/<iframe\b/.test(html.replace(/<script>[\s\S]*?<\/script>/g, "")));
  for (const name of ["hero-golf.webp", "ad-golf.webp", "video-thumb.webp", "og-landing-revender.jpg", "favicon/favicon.ico", "favicon/favicon-32x32.png", "favicon/favicon-192x192.png", "favicon/favicon-512x512.png", "favicon/apple-touch-icon.png"]) {
    const original = await readFile(new URL("../docs/landing-final/assets/" + name, import.meta.url));
    const published = await readFile(new URL("../assets/" + name, import.meta.url));
    assert.deepEqual(published, original, name + " must be byte-identical to the approved asset");
  }
});
