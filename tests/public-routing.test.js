import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const vercel = JSON.parse(read("vercel.json"));
const redirects = new Map(vercel.redirects.map(({ source, destination }) => [source, destination]));
const rewrites = new Map(vercel.rewrites.map(({ source, destination }) => [source, destination]));

test("las cuatro áreas canónicas tienen páginas públicas reales y no dependen de rewrites", () => {
  for (const route of ["academia", "herramientas", "mi-operacion", "recursos"]) assert.match(read(`${route}/index.html`), new RegExp(`https://ivanimports\\.es/${route}/`));
  for (const legacy of ["/academia/ruta", "/academia/herramientas", "/academia/respuestas", "/academia/recursos"]) assert.equal(rewrites.has(legacy), false);
});

test("los aliases públicos resuelven las variantes con y sin barra", () => {
  assert.equal(redirects.get("/ruta"), "/academia/");
  assert.equal(redirects.get("/ruta/"), "/academia/");
  assert.equal(redirects.has("/herramientas"), false);
  assert.equal(redirects.has("/mi-operacion"), false);
  assert.equal(redirects.has("/recursos"), false);
  assert.equal(redirects.get("/consultoria"), "/servicios/consultoria/");
  assert.equal(redirects.get("/consultoria/"), "/servicios/consultoria/");
  assert.equal(redirects.get("/primera-importacion-contigo"), "/servicios/primera-importacion-contigo/");
  assert.equal(redirects.get("/primera-importacion-contigo/"), "/servicios/primera-importacion-contigo/");
  assert.match(read("primera-importacion-contigo/index.html"), /noindex,follow/);
  assert.match(read("primera-importacion-contigo/index.html"), /https:\/\/ivanimports\.es\/servicios\/primera-importacion-contigo\//);
});

test("los servicios históricos resuelven también su variante con barra final", () => {
  const aliases = new Map([
    ["consultas", "/servicios/consultoria/"],
    ["revision-anuncio", "/servicios/consultoria/"],
    ["calculo-coste-real", "/servicios/consultoria/"],
    ["vendedor-documentacion", "/servicios/consultoria/"],
    ["compra-preparada", "/servicios/primera-importacion-contigo/"],
    ["compra-preparada-online", "/servicios/primera-importacion-contigo/"],
    ["pack-personalizado", "/servicios/primera-importacion-contigo/"],
    ["busco-filtro-compruebo", "/servicios/primera-importacion-contigo/"],
    ["busco-y-filtro", "/servicios/primera-importacion-contigo/"],
    ["mini-filtro-gratuito", "/academia/"],
    ["acompanamiento-matriculacion", "/servicios/primera-importacion-contigo/"],
  ]);
  for (const [slug, destination] of aliases) {
    assert.equal(redirects.get(`/servicios/${slug}`), destination);
    assert.equal(redirects.get(`/servicios/${slug}/`), destination);
  }
  assert.equal(redirects.get("/copart/"), "/servicios/primera-compra-subasta/");
  assert.equal(redirects.get("/empieza/"), "/go/");
});

test("los slugs históricos de herramientas redirigen a páginas públicas reales", () => {
  const aliases = new Map([
    ["presupuesto", "/herramientas/presupuesto-inicial/"], ["filtros", "/herramientas/filtros-busqueda/"], ["analizador-anuncio", "/herramientas/analizador-anuncios/"],
    ["preguntas", "/herramientas/preparador-preguntas/"], ["mercado", "/herramientas/comparador-espana/"], ["coste-total", "/herramientas/calculadora-coste-importacion/"],
    ["documentos", "/herramientas/pasaporte-documental/"], ["viaje", "/herramientas/planificador-viaje/"], ["inspeccion", "/herramientas/inspeccion-presencial/"],
    ["pintura", "/herramientas/mediciones-pintura/"], ["compra-salida", "/herramientas/compra-salida/"], ["vuelta", "/herramientas/checklist-vuelta/"],
    ["espana", "/herramientas/carpeta-espana/"], ["metodo-7-dias", "/herramientas/metodo-7-dias/"], ["plan-abc", "/herramientas/plan-abc/"],
  ]);
  for (const [legacy, destination] of aliases) {
    assert.equal(redirects.get(`/academia/herramientas/${legacy}`), destination);
    assert.match(read(`${destination.slice(1)}index.html`), new RegExp(`https://ivanimports\\.es${destination}`));
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
  for (const path of ["academia", "herramientas", "mi-operacion", "recursos"]) assert.match(sitemap, new RegExp(`<loc>https://ivanimports\\.es/${path}/</loc>`));
  assert.doesNotMatch(sitemap, /<loc>https:\/\/ivanimports\.es\/academia\/(?:ruta|herramientas|respuestas|recursos|actualizaciones)\/?<\/loc>/);
});

test("el generador normaliza todos los enlaces internos a hubs", () => {
  const generator = read("scripts/build-public-pages.mjs");
  assert.match(generator, /replaceAll\('href="\/academia\/ruta\/"', 'href="\/academia\/"'\)/);
  assert.match(generator, /replaceAll\('href="\/academia\/herramientas\/"', 'href="\/herramientas\/"'\)/);
  assert.match(generator, /replaceAll\('href="\/academia\/respuestas\/"', 'href="\/recursos\/respuestas\/"'\)/);
  assert.match(generator, /replaceAll\('href="\/academia\/recursos\/"', 'href="\/recursos\/"'\)/);
  const academy = read("academia/index.html");
  assert.doesNotMatch(academy, /href="\/academia\/(?:ruta|herramientas|respuestas|recursos|actualizaciones)\/?"/);
});
