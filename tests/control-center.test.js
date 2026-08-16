import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

test("el Control Center publica las dos rutas y la navegación global", () => {
  const home = read("index.html");
  const site = read("assets/site.js");
  assert.match(home, /Encuentra, analiza e importa vehículos desde Europa/);
  assert.match(home, /IvanImports Academy/);
  assert.match(home, /Primera Importación Contigo/);
  for (const label of ["Academia", "Oportunidades", "Directos", "Herramientas", "Servicios PRO", "Actualizaciones"]) assert.match(site, new RegExp(label));
  assert.match(site, /hub_path_selected/);
});

test("la portada de la Academia mantiene un único H1 en la experiencia renderizada", () => {
  const app = read("assets/academy/app.js");
  assert.match(app, /const heading = "h2"/);
  assert.match(app, /<h1 id="academy-entry-title">Aprende a importar tu primer coche\.<\/h1>/);
});

test("Candidatos usa H2 cuando se integra dentro de una herramienta", () => {
  const app = read("assets/academy/app.js");
  assert.match(app, /function renderPageHead\(eyebrow, title, copy = "", actions = "", headingLevel = 1\)/);
  assert.match(app, /const headingTag = headingLevel === 2 \? "h2" : "h1"/);
  assert.match(app, /function renderCandidates\(embedded = false\)/);
  assert.match(app, /renderCandidates\(true\)/);
});

test("la Academia gratuita conserva exactamente 13, 72, 317 y 17", () => {
  const program = json("assets/academy/program-v2.json");
  assert.equal(program.access, "public-free");
  assert.equal(program.stages.length, 13);
  assert.equal(program.lessons.length, 72);
  assert.equal(program.concepts.length, 317);
  assert.equal(program.tools.length, 17);
  assert.equal(readdirSync(resolve(root, "academia/etapa"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length, 13);
  assert.equal(readdirSync(resolve(root, "academia/paso"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length, 72);
});

test("los cinco servicios y sus precios son la única oferta activa", () => {
  const active = json("assets/data/services.json").services.filter((service) => service.active);
  assert.deepEqual(active.map(({ id, priceLabel }) => [id, priceLabel]), [
    ["consultoria", "60 € / 90 € IVA incluido"],
    ["subastaspro", "99 € + IVA"],
    ["puesta-en-marcha-subastas", "149 € + IVA"],
    ["primera-compra-subasta", "397 € IVA incluido"],
    ["primera-importacion-contigo", "997 € IVA incluido"]
  ]);
});

test("las funciones no configuradas permanecen apagadas y los directos no inventan agenda", () => {
  const features = json("assets/data/features.json");
  for (const key of ["newsletter", "academyPdf", "supervisedSearch", "radarCopart", "affiliateLinks", "accounts"]) assert.equal(features[key], false);
  assert.deepEqual(json("assets/data/directos.json").events, []);
  assert.match(read("directos/index.html"), /El próximo directo se está preparando/);
});

test("el caso Subaru es educativo y no se presenta como vehículo a la venta", () => {
  const opportunities = json("assets/data/opportunities.json").opportunities.filter((item) => item.published);
  assert.equal(opportunities.length, 1);
  assert.match(`${opportunities[0].listingStatus} ${opportunities[0].affiliateDisclosure}`, /educativo/i);
  const page = read(`oportunidades/${opportunities[0].slug}/index.html`);
  assert.match(page, /IvanImports no vende este vehículo/);
});

test("los PDF premium no son públicos y el producto descargable sigue desactivado", () => {
  const privatePdfRoot = resolve(root, "private-products/academy/pdf");
  for (const name of ["importa-tu-coche-en-7-dias-guia-2026.pdf", "importa-tu-coche-en-7-dias-cuaderno-2026.pdf"]) {
    assert.equal(existsSync(resolve(root, "assets/academy", name)), false);
    if (existsSync(privatePdfRoot)) assert.equal(existsSync(resolve(privatePdfRoot, name)), true);
  }
  const page = read("academia/edicion-pdf/index.html");
  assert.match(page, /19,99 € IVA incluido/);
  assert.match(page, /Próximamente/);
  assert.doesNotMatch(page, /buy\.stripe\.com|comprar ahora/i);
});

test("la analítica requerida no incorpora datos personales", () => {
  const site = read("assets/site.js");
  const app = read("assets/academy/app.js");
  assert.match(site, /!\/name\|email\|phone\|message\|url\|vin\|document\|budget\/i/);
  for (const event of ["academy_lesson_opened", "academy_tool_opened", "academy_search_used"]) assert.match(app, new RegExp(event));
  for (const event of ["consultation_clicked", "auction_setup_clicked", "auction_first_purchase_clicked", "first_import_application_started"]) assert.match(read("assets/data/services.json"), new RegExp(event));
});

test("las rutas antiguas conservan equivalencia mediante redirecciones permanentes", () => {
  const redirects = json("vercel.json").redirects;
  const expected = new Map([
    ["/importa-en-7-dias", "/academia/"],
    ["/consultoria", "/servicios/consultoria/"],
    ["/copart", "/servicios/primera-compra-subasta/"],
    ["/empieza", "/go/"]
  ]);
  for (const [source, destination] of expected) {
    const redirect = redirects.find((item) => item.source === source);
    assert.equal(redirect?.destination, destination);
    assert.equal(redirect?.permanent, true);
  }
});

test("los enlaces de ayuda y contacto conservan un destino navegable sin JavaScript", () => {
  const home = read("index.html");
  const help = read("academia/ayuda/index.html");
  const greenPlates = read("placasverdes/index.html");
  assert.match(home, /id="contacto"/);
  assert.doesNotMatch(help, /class="btn btn-secondary js-whatsapp-link" href="#"/);
  assert.match(help, /class="btn btn-secondary js-whatsapp-link" href="\/servicios\/"/);
  assert.doesNotMatch(greenPlates, /data-config-link="importCourse"/);
  assert.match(greenPlates, /href="\/academia\/"[^>]*>Ver la formación<\/a>/);
});

test("la navegación común mantiene objetivos táctiles mínimos", () => {
  const hub = read("assets/hub.css");
  const site = read("assets/site.css");
  const academy = read("assets/academy/app.css");
  assert.match(hub, /\.hub-nav \.nav-links a \{ min-height:44px/);
  assert.match(hub, /\.hub-action-pro \{ min-height:44px/);
  assert.match(site, /\.btn-nav \{\s*min-height: 44px/);
  assert.match(academy, /\.academy-sidebar \.academy-nav-link \{[\s\S]*?min-height: 44px/);
  assert.match(academy, /\.academy-sidebar-module \{\s*min-height: 44px/);
  assert.match(read("assets/academia.css"), /\.breadcrumbs li \{\s*display: inline-flex;\s*align-items: center;/);
});
