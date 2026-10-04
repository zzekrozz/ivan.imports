import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderRevenderLanding } from "../scripts/render-revender-landing.mjs";
import * as config from "../assets/como-encontrar-coches/config.js";

test("Changing commerce config updates every CTA and price without date-based switching", () => {
  const html = renderRevenderLanding({ ...config, CURRENT_PRICE: 61, FUTURE_PRICE: 103, PRICE_CHANGE_DATE: "2027-12-02", CHECKOUT_URL: "https://example.systeme.io/checkout?a=1&b=2" });
  const anchors = [...html.matchAll(/<a\b[^>]+data-cta="([^"]+)"[^>]*>/g)];
  assert.equal(anchors.length, 4);
  for (const [tag] of anchors) assert.ok(tag.includes('href="https://example.systeme.io/checkout?a=1&amp;b=2"'));
  assert.ok(html.includes("61 €"));
  assert.ok(html.includes("103 €"));
  assert.ok(html.includes("2 de diciembre"));
  assert.ok(!html.includes("59 €"));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});

test("The versioned landing matches the generator and uses existing shell and tracking", async () => {
  const html = await readFile(new URL("../como-encontrar-coches-para-revender/index.html", import.meta.url), "utf8");
  assert.equal(html, renderRevenderLanding());
  for (const id of ["hero_cta", "mid_cta", "pricing_cta", "sticky_mobile_cta"]) assert.ok(html.includes('data-cta="' + id + '"'));
  assert.ok(html.includes('class="nav site-nav rev-header"'));
  assert.ok(html.includes("ivan-legal-footer"));
  assert.ok(html.includes("data-consent-default"));
  assert.equal((html.match(/<details>/g) || []).length, 6);
  assert.doesNotMatch(html, /Captura real del curso pendiente|rev-placeholder/);
  assert.doesNotMatch(html, /fonts.googleapis.com/);
  assert.ok(html.includes("Esquema ilustrativo del análisis"));
});

test("Dedicated header has no exit menu and shows student access only when configured", () => {
  const header = (html) => html.match(/<header[\s\S]*?<\/header>/)[0];
  assert.doesNotMatch(header(renderRevenderLanding()), /Academia|Herramientas|Mis Servicios|Entrar gratis|nav-toggle|Ya soy alumno/);
  assert.match(header(renderRevenderLanding({ ...config, STUDENT_ACCESS_URL: "https://example.systeme.io/alumno" })), /Ya soy alumno · Entrar/);
  assert.doesNotMatch(header(renderRevenderLanding({ ...config, STUDENT_ACCESS_URL: "#" })), /Ya soy alumno/);
});
