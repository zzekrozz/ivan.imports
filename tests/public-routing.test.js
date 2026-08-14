import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const vercel = JSON.parse(read("vercel.json"));
const redirects = new Map(vercel.redirects.map(({ source, destination }) => [source, destination]));
const rewrites = new Map(vercel.rewrites.map(({ source, destination }) => [source, destination]));

test("las rutas SPA de Academia tienen una forma canónica sin barra final", () => {
  for (const route of ["ruta", "herramientas", "respuestas", "recursos", "actualizaciones"]) {
    const canonical = `/academia/${route}`;
    assert.equal(rewrites.get(canonical), "/academia/");
    assert.equal(redirects.get(`${canonical}/`), canonical);
  }
});

test("los aliases públicos resuelven las variantes con y sin barra", () => {
  assert.equal(redirects.get("/ruta"), "/academia/ruta");
  assert.equal(redirects.get("/ruta/"), "/academia/ruta");
  assert.equal(redirects.get("/herramientas"), "/academia/herramientas");
  assert.equal(redirects.get("/herramientas/"), "/academia/herramientas");
  assert.equal(redirects.get("/consultoria"), "/servicios/consultoria/");
  assert.equal(redirects.get("/consultoria/"), "/servicios/consultoria/");
  assert.equal(redirects.get("/primera-importacion-contigo"), "/servicios/primera-importacion-contigo/");
  assert.equal(redirects.get("/primera-importacion-contigo/"), "/servicios/primera-importacion-contigo/");
  assert.match(read("primera-importacion-contigo/index.html"), /noindex,follow/);
  assert.match(read("primera-importacion-contigo/index.html"), /https:\/\/ivanimports\.es\/servicios\/primera-importacion-contigo\//);
});

test("los slugs históricos de herramientas redirigen a páginas públicas reales", () => {
  const aliases = new Map([
    ["presupuesto", "budget-calculator"], ["filtros", "search-filter-builder"], ["analizador-anuncio", "ad-analyzer"],
    ["preguntas", "question-builder"], ["mercado", "market-comparator"], ["coste-total", "cost-calculator"],
    ["documentos", "document-passport"], ["viaje", "travel-planner"], ["inspeccion", "inspection-checklist"],
    ["pintura", "paint-sheet"], ["compra-salida", "purchase-exit-checklist"], ["vuelta", "return-checklist"],
    ["espana", "spain-folder"], ["metodo-7-dias", "method7-planner"],
  ]);
  for (const [legacy, publicSlug] of aliases) {
    const destination = `/academia/herramientas/${publicSlug}/`;
    assert.equal(redirects.get(`/academia/herramientas/${legacy}`), destination);
    assert.equal(redirects.get(`/academia/herramientas/${legacy}/`), destination);
    assert.match(read(`academia/herramientas/${publicSlug}/index.html`), new RegExp(`https://ivanimports\\.es${destination}`));
  }
});

test("las redirecciones exactas no forman bucles", () => {
  for (const source of redirects.keys()) {
    const visited = new Set();
    let cursor = source;
    while (redirects.has(cursor)) {
      assert.equal(visited.has(cursor), false, `bucle desde ${source}`);
      visited.add(cursor);
      cursor = redirects.get(cursor);
    }
  }
});

test("el sitemap publica solo los hubs canónicos", () => {
  const sitemap = read("sitemap.xml");
  for (const path of ["ruta", "herramientas", "respuestas", "recursos", "actualizaciones"]) {
    assert.match(sitemap, new RegExp(`<loc>https://ivanimports\\.es/academia/${path}</loc>`));
    assert.doesNotMatch(sitemap, new RegExp(`<loc>https://ivanimports\\.es/academia/${path}/</loc>`));
  }
  assert.doesNotMatch(sitemap, /<loc>https:\/\/ivanimports\.es\/(?:ruta|herramientas|consultoria)\/?<\/loc>/);
});

test("el generador normaliza todos los enlaces internos a hubs", () => {
  const generator = read("scripts/build-public-pages.mjs");
  for (const path of ["ruta", "herramientas", "respuestas", "recursos", "actualizaciones"]) {
    assert.match(generator, new RegExp(`replaceAll\\('href=\\"/academia/${path}/\\"', 'href=\\"/academia/${path}\\"'\\)`));
  }
  const academy = read("academia/index.html");
  assert.doesNotMatch(academy, /href="\/academia\/(?:ruta|herramientas|respuestas|recursos|actualizaciones)\/"/);
});
