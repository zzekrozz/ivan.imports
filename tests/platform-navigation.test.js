import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { TOOL_CATALOG, validateToolCatalog } from "../assets/academy/private/tool-catalog.js";
import { PLATFORM_AREAS, navigationItem, platformAreaForRoute } from "../assets/academy/private/platform-navigation.js";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const program = JSON.parse(read("assets/academy/program-v2.json"));
const vercel = JSON.parse(read("vercel.json"));
const redirects = new Map(vercel.redirects.map((entry) => [entry.source, entry]));

test("el catálogo canónico conserva 17 herramientas únicas repartidas entre Herramientas y Mis vehículos", () => {
  assert.equal(validateToolCatalog(program.tools), true);
  assert.equal(TOOL_CATALOG.length, 17);
  assert.equal(new Set(TOOL_CATALOG.map((tool) => tool.id)).size, 17);
  assert.equal(new Set(TOOL_CATALOG.map((tool) => tool.publicPath)).size, 17);
  assert.equal(TOOL_CATALOG.filter((tool) => tool.publicPath.startsWith("/herramientas/")).length, 15);
  assert.deepEqual(TOOL_CATALOG.filter((tool) => tool.publicPath.startsWith("/mis-vehiculos/")).map((tool) => tool.id), ["operation-dashboard", "candidate-board"]);
});

test("el shell usa topbar global de cinco áreas y sidebar contextual", () => {
  const source = read("assets/academy/app.js");
  const shell = source.slice(source.indexOf("function renderShell"), source.indexOf("function pageTitle"));
  assert.deepEqual(PLATFORM_AREAS.map((area) => area.label), ["Inicio", "Academia", "Herramientas", "Mis vehículos", "Recursos"]);
  assert.match(shell, /academy-global-nav/);
  assert.match(shell, /renderContextSidebar/);
  assert.match(source, /area\.search \? renderSearchDialog\(\) : ""/);
  assert.match(source, /modulesOpen: false/);
  assert.match(source, /data-action="modules-toggle" aria-expanded="\$\{app\.modulesOpen\}"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.doesNotMatch(shell, />Más</);
  assert.doesNotMatch(shell, /"calculator", "Calculadora"/);
  assert.doesNotMatch(shell, /Servicios PRO/);
  assert.equal(platformAreaForRoute("vehicle").id, "vehicles");
  assert.deepEqual(navigationItem({ label: "Mercado" }).locked, false);
});

test("la portada de Academia contiene aprendizaje y no duplica mapa, herramientas ni operación", () => {
  const source = read("assets/academy/app.js");
  const dashboard = source.slice(source.indexOf("function renderDashboard()"), source.indexOf("function renderAcademyEntryChoices"));
  assert.match(dashboard, /model\.stages\.map\(renderDashboardModule\)/);
  assert.match(dashboard, /Buscar en la Academia/);
  assert.doesNotMatch(dashboard, /academy-control-europe|academy-control-tools|selectDashboardTools/);
  assert.doesNotMatch(dashboard, /href="\/(?:herramientas|mi-operacion|recursos)/);
  const search = source.slice(source.indexOf("function buildSearchItems"), source.indexOf("function renderSearchDialog"));
  assert.doesNotMatch(search, /availableTools\(\)|add\("Herramientas"|add\("Recursos"/);
  assert.match(search, /if \(entry\.kind === "tool"\) return/);
});

test("cada área y herramienta tiene una única página canónica", () => {
  for (const area of ["academia", "herramientas", "mis-vehiculos", "recursos"]) {
    const html = read(`${area}/index.html`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://ivanimports\\.es/${area}/">`));
  }
  for (const tool of TOOL_CATALOG.filter((item) => item.publicPath.startsWith("/herramientas/"))) {
    const relative = `${tool.publicPath.slice(1)}index.html`;
    assert.equal(existsSync(resolve(root, relative)), true, relative);
    assert.match(read(relative), new RegExp(`<link rel="canonical" href="https://ivanimports\\.es${tool.publicPath}">`));
  }
  assert.equal(existsSync(resolve(root, "academia/herramientas")), false);
});

test("las rutas antiguas redirigen en un único salto permanente", () => {
  for (const tool of TOOL_CATALOG) {
    for (const suffix of ["", "/"]) {
      const entry = redirects.get(`/academia/herramientas/${tool.id}${suffix}`);
      assert.equal(entry?.destination, tool.publicPath, `${tool.id}${suffix}`);
      assert.equal(entry?.permanent, true, `${tool.id}${suffix}`);
      assert.equal(redirects.has(entry.destination), false, `cadena accidental: ${tool.id}${suffix}`);
    }
    for (const alias of new Set([tool.id, tool.slug])) {
      if (tool.publicPath === `/herramientas/${alias}/`) continue;
      for (const suffix of ["", "/"]) {
        const entry = redirects.get(`/herramientas/${alias}${suffix}`);
        assert.equal(entry?.destination, tool.publicPath, `alias público ${alias}${suffix}`);
        assert.equal(entry?.permanent, true, `alias público ${alias}${suffix}`);
        assert.equal(redirects.has(entry.destination), false, `cadena pública accidental: ${alias}${suffix}`);
      }
    }
  }
  const areas = new Map([
    ["/academia/ruta", "/academia/"],
    ["/academia/herramientas", "/herramientas/"],
    ["/academia/mi-operacion", "/mis-vehiculos/"],
    ["/academia/candidatos", "/mis-vehiculos/candidatos/"],
    ["/academia/recursos", "/recursos/"],
    ["/academia/respuestas", "/recursos/respuestas/"],
  ]);
  for (const [source, destination] of areas) {
    assert.equal(redirects.get(source)?.destination, destination);
    assert.equal(redirects.get(source)?.permanent, true);
  }
  assert.equal(redirects.get("/mi-operacion")?.destination, "/mis-vehiculos/");
  assert.equal(redirects.get("/mi-operacion/candidatos")?.destination, "/mis-vehiculos/candidatos/");
});

test("SEO, sitemap y persistencia conservan sus contratos", () => {
  const calculator = read("herramientas/calculadora-coste-importacion/index.html");
  const analyzer = read("herramientas/analizador-anuncios/index.html");
  assert.match(calculator, /<title>Calculadora de coste para importar un coche a España \| IvanImports<\/title>/);
  assert.match(calculator, /<h1>Calculadora de coste de importación de coches<\/h1>/);
  assert.match(analyzer, /<title>Analizador de anuncios de coches de Alemania \| IvanImports<\/title>/);
  assert.match(analyzer, /<h1>Analiza un anuncio de coche antes de comprarlo<\/h1>/);
  const sitemap = read("sitemap.xml");
  for (const tool of TOOL_CATALOG.filter((item) => item.publicPath.startsWith("/herramientas/"))) assert.match(sitemap, new RegExp(`<loc>https://ivanimports\\.es${tool.publicPath}</loc>`));
  assert.doesNotMatch(sitemap, /\/academia\/(?:ruta|herramientas|mi-operacion|candidatos|recursos|respuestas)/);
  assert.doesNotMatch(sitemap, /\/mis-vehiculos\//);
  assert.match(read("mis-vehiculos/index.html"), /noindex,nofollow,noarchive/);
  const app = read("assets/academy/app.js");
  assert.match(app, /if \(app\.route\.name === "tool"\) return toolDefinition\(app\.route\.slug\)\?\.seoTitle/);
  assert.match(app, /document\.title = documentTitle\(\)/);
  assert.match(app, /ivanimports\.academy\.public-state\.v2/);
  assert.match(app, /localStorage\.setItem\(STATE_STORAGE_KEY/);
  assert.match(app, /\/api\/vehicle\/import/);
});
