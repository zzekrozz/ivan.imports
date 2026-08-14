import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderEuropeRouteMap, renderMobileRoute } from "../assets/academy/private/europe-map.js";

const root = resolve(import.meta.dirname, "..");
const css = readFileSync(resolve(root, "assets/academy/app.css"), "utf8");
const mapSource = readFileSync(resolve(root, "assets/academy/private/europe-map.js"), "utf8");
const stages = Array.from({ length: 13 }, (_, index) => ({
  id: `stage-${String(index).padStart(2, "0")}`,
  kind: index === 0 ? "prologue" : "core",
  countsTowardProgress: index !== 0,
  title: index === 5 ? "Leer el anuncio" : `Etapa ${index}`,
  shortTitle: index === 5 ? "Leer el anuncio" : `Parada ${index}`,
  description: `Descripción real de la etapa ${index}`,
  href: `/academia/etapa/${index}/`,
  status: index < 5 ? "complete" : index === 5 ? "current" : "pending",
  accessibleLabel: index === 0 ? "Prólogo" : `Etapa ${index} de 12`,
  lessonCount: 6,
  estimatedMinutes: 48
}));

test("el mapa muestra 12 etapas y mantiene el prólogo separado", () => {
  const html = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  assert.equal((html.match(/data-visual-interaction="route-node"/g) || []).length, 12);
  assert.ok(!html.includes("Prólogo:"));
  assert.match(html, /Mapa europeo interactivo de las 12 etapas/);
});

test("la geografía conecta España con Francia y muestra diez países", () => {
  const html = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  for (const country of ["Portugal", "España", "Francia", "Bélgica", "Países Bajos", "Luxemburgo", "Alemania", "Suiza", "Austria", "Italia"]) assert.match(html, new RegExp(`data-country="${country}"`));
  assert.doesNotMatch(`${html}${mapSource}`, /europe-diorama|https?:\/\//i);
});

test("las cuatro macrozonas organizan la narrativa sin asignar países arbitrarios", () => {
  const html = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  for (const zone of ["España · preparación", "Alemania / Benelux · compra", "Francia · regreso", "España · cierre"]) assert.match(html, new RegExp(zone.replace("/", "\\/")));
});

test("etapa actual, siguiente etapa y aria-label proceden de los datos", () => {
  const html = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  assert.match(html, /data-status="current"/);
  assert.match(html, /Etapa 5 de 12: Leer el anuncio\. Etapa actual/);
  assert.match(html, /Siguiente etapa/);
  assert.match(html, /Parada 6/);
});

test("el coche vectorial es original, contenido y sin marca", () => {
  const html = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  assert.match(html, /academy-vehicle-paint/);
  assert.doesNotMatch(html, /BMW|Mercedes|Audi|Volkswagen|Subaru/i);
  assert.match(css, /academy-map-car-marker[\s\S]*width:82px/);
});

test("las variantes desktop y móvil no repiten identificadores SVG", () => {
  const desktop = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  const mobile = renderMobileRoute({ stages, percentage: 38, currentStageId: "stage-05" });
  const ids = [...`${desktop}${mobile}`.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(desktop, /academy-vehicle-paint-desktop/);
  assert.match(mobile, /academy-vehicle-paint-mobile/);
});

test("el mapa conserva teclado, alternativa textual y movimiento reducido", () => {
  const html = renderEuropeRouteMap({ stages, percentage: 38, currentStageId: "stage-05" });
  assert.equal((html.match(/<button type="button"/g) || []).length, 12);
  assert.match(html, /academy-sr-only/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("la variante móvil sustituye al desktop sin scroll horizontal", () => {
  const mobile = renderMobileRoute({ stages, percentage: 38, currentStageId: "stage-05" });
  assert.match(mobile, /academy-europe-map--mobile/);
  assert.match(mobile, /viewBox="0 0 430 720"/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.academy-route-desktop \{ display: none !important; \}/);
  assert.match(css, /overflow-x: hidden/);
});
