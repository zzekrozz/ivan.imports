import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../ivi/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../assets/ivi/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../assets/ivi/app.css", import.meta.url), "utf8");
const siteChrome = await readFile(new URL("../assets/site.js", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");

test("/ivi contiene inputs mínimos, precio correcto y no pide K ni V.7", () => {
  for (const name of ["vin", "purchaseCountry", "mileageKm", "purchasePrice", "currency", "firstRegistration", "notes"]) assert.match(html, new RegExp(`name="${name}"`));
  assert.match(html, /24,99 €/);
  assert.match(html, /Ninguna conocida/);
  assert.match(html, /No lo sé/);
  assert.doesNotMatch(html, /name="(?:k|v7|co2|typeApproval)"/i);
});

test("resultado incluye secciones, PDF, revisión documental y estados comprensibles", () => {
  for (const text of ["Identificación", "Equipamiento de fábrica", "Homologación", "CO₂ y emisiones", "Costes España", "Preguntas para el vendedor", "Descargar PDF", "Solicitar revisión documental"]) assert.match(app, new RegExp(text));
  for (const state of ["DRAFT", "PROCESSING", "READY", "PARTIAL", "NO_DATA", "FAILED"]) assert.match(`${app}${html}`, new RegExp(state));
});

test("experiencia es mobile-first y evita scroll horizontal en resultados", () => {
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /\.ivi-report-grid/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.doesNotMatch(css, /overflow-x:\s*scroll/);
});

test("IVI permanece accesible por ruta directa pero no se anuncia en navegación ni sitemap", () => {
  assert.match(html, /canonical[^>]+\/ivi\//i);
  assert.doesNotMatch(siteChrome, /href=["']\/ivi\//i);
  assert.doesNotMatch(sitemap, /\/ivi\//i);
});
