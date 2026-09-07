import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

test("el Control Center mantiene una navegación global simplificada", () => {
  const home = read("index.html");
  const site = read("assets/site.js");
  assert.match(home, /Encuentra, analiza e importa vehículos desde Europa/);
  assert.match(home, /IvanImports Academy/);
  assert.match(home, /Primera Importación Contigo/);
  for (const label of ["Academia", "Herramientas", "Mis Servicios", "Entrar gratis"]) assert.match(site, new RegExp(label));
  const header = site.match(/function headerMarkup\(\)[\s\S]*?function footerMarkup/)?.[0] || "";
  const mobile = site.match(/function mobileNavMarkup\(\)[\s\S]*?function renderChrome/)?.[0] || "";
  for (const label of ["Oportunidades", "Directos", "Actualizaciones", "Servicios PRO"]) {
    assert.doesNotMatch(header, new RegExp(label));
    assert.doesNotMatch(mobile, new RegExp(label));
  }
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

test("los cuatro servicios definidos son la única oferta activa", () => {
  const active = json("assets/data/services.json").services.filter((service) => service.active);
  assert.deepEqual(active.map(({ id, priceLabel }) => [id, priceLabel]), [
    ["consultoria", "60 € / 90 € IVA incluido"],
    ["busqueda-vehiculo-europa", undefined],
    ["primera-compra-subasta", "397 € IVA incluido"],
    ["primera-importacion-contigo", "997 € IVA incluido"]
  ]);
});

test("Mis Servicios publica búsqueda europea y compra acompañada sin la oferta retirada", () => {
  const services = read("servicios/index.html");
  const search = read("servicios/busqueda-vehiculo-europa/index.html");
  const copart = read("servicios/primera-compra-subasta/index.html");
  assert.match(services, /Búsqueda de vehículo en Europa/);
  assert.match(services, /Compra acompañada en Copart/);
  assert.doesNotMatch(services, /SubastasPRO|Puesta en marcha de subastas|Primera compra en subasta contigo/);
  for (const copy of ["mercado europeo", "Filtrado de anuncios", "Comparación de diferentes unidades", "contactar después con el vendedor"]) assert.match(search, new RegExp(copy, "i"));
  for (const copy of ["en remoto", "pantalla compartida", "60–120 minutos", "plataforma Copart", "Tú realizas la operación desde tu ordenador", "guía/PDF"]) assert.match(copart, new RegExp(copy, "i"));
  assert.match(search, /https:\/\/wa\.me\/34674252436\?text=/);
  for (const page of [search, copart, read("servicios/consultoria/index.html"), read("servicios/primera-importacion-contigo/index.html")]) assert.match(page, /WhatsApp/);
});

test("Primera Importación Contigo explica el servicio remoto completo y abre WhatsApp sin formulario", () => {
  const services = read("servicios/index.html");
  const page = read("servicios/primera-importacion-contigo/index.html");
  const message = "Hola Iván, estoy interesado en Primera Importación Contigo de 997 €. Es mi primera importación y quiero que me acompañes desde la búsqueda del vehículo hasta matricularlo en España. Te cuento lo que estoy buscando.";
  const whatsappUrl = `https://wa.me/34674252436?text=${encodeURIComponent(message)}`;

  for (const copy of [
    "Tu primera importación, acompañada de principio a fin",
    "Tú compras el coche. Yo preparo, reviso y superviso contigo toda la operación en remoto",
    "Desde que decidimos qué vehículo buscar hasta que tienes la matrícula española.",
    "Quiero hacer mi primera importación contigo",
  ]) assert.match(services, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const heading of [
    "Definimos qué tiene sentido comprar",
    "Busco vehículos que encajen contigo",
    "Hablo con el vendedor y negocio la operación",
    "Compruebo la documentación antes de que avances",
    "Te preparo la recogida",
    "Tú estás allí. Yo sigo contigo en remoto.",
    "Te ayudo a preparar la salida de Alemania",
    "Te preparo la ruta de vuelta",
    "Mi trabajo no termina cuando compras el coche",
  ]) assert.match(page, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.equal((page.match(/class="hub-first-import-step"/g) || []).length, 9);
  assert.equal((page.match(/<details>/g) || []).length, 5);
  assert.match(page, /El acompañamiento es 100 % remoto/);
  assert.match(page, /acceso prioritario a mí/);
  assert.match(page, /Vehículo con matrícula española 🇪🇸/);
  assert.match(page, new RegExp(whatsappUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(page, /target="_blank" rel="noopener noreferrer">Hablar con Iván por WhatsApp/);
  assert.doesNotMatch(page, /<form\b|data-whatsapp-form/);
  assert.doesNotMatch(page, /24\s*\/\s*7/i);
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
  for (const event of ["consultation_clicked", "vehicle_search_clicked", "auction_first_purchase_clicked", "first_import_application_started"]) assert.match(read("assets/data/services.json"), new RegExp(event));
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
