import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const read = (path) => readFileSync(join(root, path), "utf8");
const json = (path) => JSON.parse(read(path));

const requiredRoutes = [
  "index.html", "academia/index.html", "go/index.html", "placasverdes/index.html", "oportunidades/index.html", "directos/index.html", "servicios/index.html", "subastaspro/index.html", "recomendaciones/index.html", "actualizaciones/index.html", "academia/ayuda/index.html", "academia/edicion-pdf/index.html", "importa-en-7-dias/gracias/index.html"
];
for (const route of requiredRoutes) if (!existsSync(join(root, route))) failures.push(`Falta la ruta pública: ${route}`);

const program = json("assets/academy/program-v2.json");
const features = json("assets/data/features.json");
const services = json("assets/data/services.json");
const directos = json("assets/data/directos.json");
const opportunities = json("assets/data/opportunities.json");
const academyHtml = read("academia/index.html");
const academyApp = read("assets/academy/app.js");
const academyCss = read("assets/academy/app.css");
const mapSource = read("assets/academy/private/europe-map.js");
const visualAssets = ["before-search-desk.webp", "directos-studio.webp", "tools-operations.webp", "first-import-with-you.webp", "route-map-mobile.webp", "opportunity-subaru.webp", "control-center-flatlay.webp", "consultation-review.webp", "services-pro-generic.webp", "route-map-desktop.webp"];
for (const asset of visualAssets) if (!existsSync(join(root, "assets/visuals/final", asset))) failures.push(`Falta el activo visual final optimizado: ${asset}`);

if (program.access !== "public-free" || program.stages?.length !== 13 || program.lessons?.length !== 72 || program.concepts?.length !== 317 || program.tools?.length !== 17) failures.push("La Academia debe conservar acceso público y el contrato 13/72/317/17");
if (/\/api\/academy\/(?:session|program|state|resource)|academia\/acceso/i.test(academyHtml + academyApp)) failures.push("La experiencia pública depende de infraestructura privada");
if (!/localStorage\.setItem\(STATE_STORAGE_KEY/.test(academyApp) || !/ivanimports\.academy\.public-state\.v2/.test(academyApp)) failures.push("El progreso público no conserva su clave local");
if (/requestAnimationFrame\(openOnboarding\)/.test(academyApp) || !/data-action="onboarding-open"/.test(academyApp)) failures.push("El onboarding debe ser opcional y no abrirse automáticamente");
if (!/Aprende a importar tu primer coche/.test(academyHtml + academyApp) || !/Gratis, sin registro/.test(academyHtml + academyApp)) failures.push("Falta la promesa pública de la Academia");
if (!existsSync(join(root, "assets/academy/app.js")) || !existsSync(join(root, "assets/academy/app.css")) || existsSync(join(root, "assets/academy-private.js")) || existsSync(join(root, "assets/academy-private.css"))) failures.push("El naming público de la app no está consolidado");

const stagePages = readdirSync(join(root, "academia/etapa"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
const lessonPages = readdirSync(join(root, "academia/paso"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
const conceptPages = readdirSync(join(root, "academia/conceptos"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
const toolPages = readdirSync(join(root, "academia/herramientas"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
if (stagePages.length !== 13) failures.push(`Deben existir 13 páginas de etapa; hay ${stagePages.length}`);
if (lessonPages.length !== 72) failures.push(`Deben existir 72 páginas de lección; hay ${lessonPages.length}`);
if (conceptPages.length < 10 || conceptPages.length >= 317) failures.push("Los conceptos SEO deben ser una selección útil, no cero ni 317 páginas finas");
if (toolPages.length !== 17) failures.push(`Deben existir 17 páginas de herramienta; hay ${toolPages.length}`);

const seoPages = [...stagePages.map((entry) => join(root, "academia/etapa", entry.name, "index.html")), ...lessonPages.map((entry) => join(root, "academia/paso", entry.name, "index.html"))];
const titles = new Set();
const canonicals = new Set();
for (const file of seoPages) {
  const source = readFileSync(file, "utf8");
  const title = source.match(/<title>([^<]+)<\/title>/i)?.[1];
  const canonical = source.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  if (!title || !canonical || !/<meta name="description" content="[^"]+"/i.test(source) || (source.match(/<h1\b/gi) || []).length !== 1 || !/hub-breadcrumbs/.test(source) || !/IvanImports|Iván/.test(source) || !/Revisado/.test(source) || !/application\/ld\+json/.test(source)) failures.push(`SEO incompleto: ${relative(root, file)}`);
  if (title && titles.has(title)) failures.push(`Title duplicado: ${title}`);
  if (canonical && canonicals.has(canonical)) failures.push(`Canonical duplicada: ${canonical}`);
  titles.add(title); canonicals.add(canonical);
}

const activeServices = services.services.filter((service) => service.active);
if (activeServices.length !== 5) failures.push("Deben publicarse exactamente cinco servicios activos");
const expectedServices = new Map([["consultoria", "60 € / 90 € IVA incluido"], ["subastaspro", "99 € + IVA"], ["puesta-en-marcha-subastas", "149 € + IVA"], ["primera-compra-subasta", "397 € IVA incluido"], ["primera-importacion-contigo", "997 € IVA incluido"]]);
for (const [id, price] of expectedServices) if (activeServices.find((service) => service.id === id)?.priceLabel !== price) failures.push(`Precio o servicio incorrecto: ${id}`);
if (features.supervisedSearch || features.radarCopart || features.affiliateLinks || features.newsletter || features.academyPdf) failures.push("Una feature no configurada está activa");
if (!existsSync(join(root, "docs/products/BUSQUEDA_SUPERVISADA_PILOT.md")) || !existsSync(join(root, "docs/PRODUCTION_LEGAL_BLOCKERS.md")) || !existsSync(join(root, "docs/sales/CHAT_ROUTING.md"))) failures.push("Falta documentación de pilotos, legal o clasificación de dudas");

for (const event of directos.events.filter((item) => item.published)) {
  if (!event.date || !event.startTime || !event.timezone || !event.status) failures.push(`Directo publicado sin datos reales: ${event.id}`);
  if (Number(event.price) > 0 && !event.paymentLink && !event.registrationUrl) failures.push(`Directo de pago sin enlace válido: ${event.id}`);
  if (Number.isFinite(event.capacity) && !Number.isFinite(event.bookedSeats)) failures.push(`Directo con plazas sin ocupación mantenida: ${event.id}`);
}
for (const item of opportunities.opportunities.filter((entry) => entry.published)) {
  if (!item.slug || !item.title || !item.verdict || !item.editorialStatus || !Array.isArray(item.images) || !/educativo|inspeccionado/i.test(`${item.listingStatus} ${item.affiliateDisclosure} ${read(`oportunidades/${item.slug}/index.html`)}`)) failures.push(`Oportunidad publicada sin contrato editorial: ${item.id}`);
}

for (const country of ["Portugal", "España", "Francia", "Bélgica", "Países Bajos", "Luxemburgo", "Alemania", "Suiza", "Austria", "Italia"]) if (!mapSource.includes(`data-country=\"${country}\"`)) failures.push(`El mapa no contiene ${country}`);
for (const zone of ["España · preparación", "Alemania / Benelux · compra", "Francia · regreso", "España · cierre"]) if (!mapSource.includes(zone)) failures.push(`El mapa no contiene la macrozona ${zone}`);
if (/europe-diorama|academy-map-art--/i.test(mapSource) || !/route-map-desktop\.webp/.test(mapSource) || !/route-map-mobile\.webp/.test(mapSource) || !/academy-vehicle-paint/.test(mapSource) || !/academy-sr-only/.test(mapSource) || !/prefers-reduced-motion/.test(academyCss)) failures.push("El mapa conserva arte antiguo o pierde raster, vehículo, alternativa o movimiento reducido");

const premiumPdfNames = ["importa-tu-coche-en-7-dias-guia-2026.pdf", "importa-tu-coche-en-7-dias-cuaderno-2026.pdf"];
for (const name of premiumPdfNames) {
  if (existsSync(join(root, "assets/academy", name))) failures.push(`PDF premium todavía público: ${name}`);
  const privateFile = join(root, "private-products/academy/pdf", name);
  if (!existsSync(privateFile) || !readFileSync(privateFile).subarray(0, 5).equals(Buffer.from("%PDF-"))) failures.push(`Falta fuente PDF privada válida: ${name}`);
  if (JSON.stringify(program).includes(`/assets/academy/${name}`)) failures.push(`El catálogo expone el PDF: ${name}`);
}
const pdfPage = read("academia/edicion-pdf/index.html");
if (!/19,99 € IVA incluido/.test(pdfPage) || !/Próximamente/.test(pdfPage) || /buy\.stripe\.com|ACADEMY_PDF_(?:PAYMENT|PRICE)|data-payment|comprar ahora/i.test(pdfPage)) failures.push("La edición PDF debe ser transparente y permanecer sin checkout");

const home = read("index.html");
const go = read("go/index.html");
if (!/Encuentra, analiza e importa vehículos desde Europa/.test(home) || !/Entrar en la Academia gratis/.test(home) || !/Ver oportunidades/.test(home)) failures.push("La home no funciona como Control Center");
if (/AGOSTO50|3\/10|50\s*%|14 días WhatsApp|179\s*€/i.test(home + go + read("assets/site-config.js"))) failures.push("La experiencia conserva promoción o formación caducada");
for (const label of ["Academia", "Oportunidades", "Directos", "Herramientas", "Servicios PRO", "Actualizaciones"]) if (!read("assets/site.js").includes(label)) failures.push(`Falta navegación global: ${label}`);

const vercel = json("vercel.json");
if (vercel.outputDirectory !== "dist") failures.push("El output público debe limitarse a dist/");
const rewriteSources = new Set((vercel.rewrites || []).map((entry) => entry.source));
for (const endpoint of ["/api/stripe-importa-7-dias", "/api/importa-7-dias/order-status", "/api/importa-7-dias/download", "/api/importa-7-dias/reissue"]) if (!rewriteSources.has(endpoint)) failures.push(`Falta infraestructura histórica: ${endpoint}`);
for (const staticPattern of ["/academia/etapa/:slug", "/academia/paso/:slug", "/academia/herramientas/:tool"]) if (rewriteSources.has(staticPattern)) failures.push(`Una ruta SEO estática sigue reescrita a la SPA: ${staticPattern}`);
const importRedirect = (vercel.redirects || []).find((entry) => entry.source === "/importa-en-7-dias");
if (!importRedirect?.permanent || importRedirect.destination !== "/academia/") failures.push("Falta el 301 de /importa-en-7-dias a /academia/");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

if (failures.length) { console.error(failures.join("\n")); process.exit(1); }

const dist = join(root, "dist");
if (relative(root, dist) !== "dist") throw new Error("Ruta de salida no segura");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const publicDirectories = ["academia", "actualizaciones", "assets", "directos", "go", "importa-en-7-dias", "oportunidades", "placasverdes", "recomendaciones", "servicios", "subastaspro"];
const publicFiles = ["index.html", "CNAME", "favicon.svg", "robots.txt", "sitemap.xml"];
for (const directory of publicDirectories) if (existsSync(join(root, directory))) cpSync(join(root, directory), join(dist, directory), { recursive: true });
for (const file of publicFiles) if (existsSync(join(root, file))) cpSync(join(root, file), join(dist, file));

for (const obsolete of ["assets/academy/map", "assets/academy-private.js", "assets/academy-private.css", "servicios/consultas", "servicios/revision-anuncio", "servicios/calculo-coste-real", "servicios/vendedor-documentacion", "servicios/compra-preparada", "servicios/compra-preparada-online", "servicios/pack-personalizado", "servicios/busco-filtro-compruebo", "servicios/busco-y-filtro", "servicios/mini-filtro-gratuito"]) rmSync(join(dist, obsolete), { recursive: true, force: true });

for (const forbidden of ["api", "docs", "scripts", "tests", "private-products", ".env", "package.json"]) if (existsSync(join(dist, forbidden))) failures.push(`El build público contiene una ruta interna: ${forbidden}`);
for (const name of premiumPdfNames) if (walk(dist).some((file) => file.endsWith(name))) failures.push(`El build contiene el PDF premium: ${name}`);

const distTextFiles = walk(dist).filter((file) => [".html", ".js", ".json", ".css", ".xml", ".txt"].includes(extname(file).toLowerCase()));
const distSource = distTextFiles.map((file) => readFileSync(file, "utf8")).join("\n");
if (/\b(?:sk_(?:live|test)|whsec_|re_[A-Za-z0-9]{16,}|vercel_blob_rw_)[A-Za-z0-9_-]{12,}\b/.test(distSource)) failures.push("El build contiene una credencial con formato sensible");
if (/ACADEMY_(?:AUTH|DATA|SESSION|ADMIN)_SECRET|STRIPE_SECRET_KEY|UPSTASH_REDIS_REST_TOKEN|RESEND_API_KEY/.test(distSource)) failures.push("El build contiene el nombre de una variable privada");
if (/AGOSTO50|3\/10|14 días WhatsApp|KAIROS\s+KRONOS/i.test(distSource)) failures.push("El build conserva una promoción o identidad prohibida");
if (/europe-diorama|\/assets\/academy\/map\//i.test(distSource)) failures.push("El build conserva una referencia al antiguo mapa raster");

const configuredPublicSources = new Set([...(vercel.redirects || []), ...(vercel.rewrites || [])]
  .filter((entry) => !entry.source.includes(":"))
  .map((entry) => entry.source.replace(/\/$/, "") || "/"));
const brokenLinks = [];
for (const file of walk(dist).filter((entry) => extname(entry).toLowerCase() === ".html")) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/<a\b[^>]*\shref="([^"]+)"/gi)) {
    const href = match[1];
    if (!href || href.startsWith("#") || /^(?:mailto:|tel:|javascript:)/i.test(href)) continue;
    let target;
    try { target = new URL(href, "https://ivanimports.es"); } catch { brokenLinks.push(`${relative(dist, file)} → ${href}`); continue; }
    if (target.hostname !== "ivanimports.es") continue;
    const pathname = decodeURIComponent(target.pathname);
    if (pathname.startsWith("/api/")) continue;
    const cleanPath = pathname.replace(/\/$/, "") || "/";
    const relativePath = cleanPath === "/" ? "" : cleanPath.slice(1);
    const candidates = [join(dist, relativePath), join(dist, relativePath, "index.html"), join(dist, `${relativePath}.html`)];
    if (!candidates.some(existsSync) && !configuredPublicSources.has(cleanPath)) brokenLinks.push(`${relative(dist, file)} → ${pathname}`);
  }
}
if (brokenLinks.length) failures.push(`Enlaces internos sin destino (${brokenLinks.length}):\n${brokenLinks.slice(0, 20).join("\n")}`);
if (failures.length) { rmSync(dist, { recursive: true, force: true }); console.error(failures.join("\n")); process.exit(1); }

console.log(`Build validado: ${stagePages.length} etapas, ${lessonPages.length} lecciones, ${conceptPages.length} conceptos SEO, ${toolPages.length} herramientas y ${activeServices.length} servicios; cero PDFs premium públicos.`);
