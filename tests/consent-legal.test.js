import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeHtmlConsent } from "../scripts/consent-markup.mjs";
import { LEGAL_ROUTES, renderLegalPage } from "../scripts/render-legal-pages.mjs";
import * as legal from "../assets/legal-config.js";
test("Historical pages lose eager tracking while structured data and application scripts survive", () => {
  const input = '<html><head><script>(function(){document.createElement("script").src="https://www.googletagmanager.com/gtm.js?id=GTM-OLD";})();</script><script type="application/ld+json">{"name":"IvanImports"}</script><script src="/assets/site.js" defer></script></head><body><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-OLD"></iframe></noscript></body></html>';
  const html = normalizeHtmlConsent(input);
  assert.doesNotMatch(html, /googletagmanager/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /\/assets\/site.js/);
  assert.match(html, /analytics_storage:"denied"/);
  assert.equal(normalizeHtmlConsent(html), html);
});
test("Legal pages use definitive identity, final consumer prices and preserve withdrawal rights", async () => {
  for (const route of LEGAL_ROUTES) {
    const html = renderLegalPage(route);
    assert.equal(await readFile(new URL("../" + route + "/index.html", import.meta.url), "utf8"), html);
    for (const key of Object.keys(legal)) assert.ok(html.includes(legal[key]), key);
    assert.equal((html.match(/<h1>/g) || []).length, 1);
    assert.ok(html.includes("Configurar cookies"));
  }
  const terms = renderLegalPage("condiciones-de-compra");
  assert.match(terms, /59 € · Precio final/);
  assert.match(terms, /99 € · Precio final/);
  assert.match(terms, /incluidos los impuestos aplicables cuando corresponda/);
  assert.match(terms, /consentimiento expreso previo/);
});
