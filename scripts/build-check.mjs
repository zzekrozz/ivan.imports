import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const requiredRoutes = [
  "index.html",
  "copart/index.html",
  "empieza/index.html",
  "consultoria/index.html",
  "academia/index.html",
  "go/index.html",
  "placasverdes/index.html",
  "importa-en-7-dias/index.html",
  "importa-en-7-dias/gracias/index.html",
];

for (const route of requiredRoutes) {
  if (!existsSync(join(root, route))) failures.push(`Falta la ruta estática: ${route}`);
}

const configSource = readFileSync(join(root, "assets/importa-7-dias/config.js"), "utf8");
if (!/checkoutEnabled:\s*true/.test(configSource)) failures.push("checkoutEnabled debe estar en true para ventas LIVE");
const paymentLink = "https://buy.stripe.com/dRmcN6a3K0jdd2ra3m8N207";
const publicProductFiles = [
  "assets/importa-7-dias/config.js",
  "assets/importa-7-dias/landing.js",
  "assets/importa-7-dias/thanks.js",
  "importa-en-7-dias/index.html",
  "importa-en-7-dias/gracias/index.html",
];
const publicSource = publicProductFiles.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
const occurrences = publicSource.split(paymentLink).length - 1;
if (occurrences !== 1) failures.push(`El Payment Link debe aparecer una vez en el frontend; aparece ${occurrences}`);
if (/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|UPSTASH_REDIS_REST_TOKEN/.test(publicSource)) failures.push("Una variable privada aparece en el frontend");

const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8"));
const rewriteSources = new Set((vercel.rewrites || []).map((rewrite) => rewrite.source));
for (const endpoint of ["/api/stripe-importa-7-dias", "/api/importa-7-dias/order-status", "/api/importa-7-dias/download", "/api/importa-7-dias/reissue"]) {
  if (!rewriteSources.has(endpoint)) failures.push(`Falta rewrite: ${endpoint}`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if ([".git", ".vercel", "node_modules", "coverage"].includes(entry.name)) return [];
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const allFiles = walk(root);
const publicPdfRelative = "assets/academia/otorgamiento_ES.pdf";
const publicPdf = join(root, publicPdfRelative);
const unexpectedPdfs = allFiles
  .filter((file) => extname(file).toLowerCase() === ".pdf")
  .filter((file) => relative(root, file).replaceAll("\\", "/") !== publicPdfRelative);
if (unexpectedPdfs.length) failures.push("Solo se permite el formulario público oficial de representación dentro del proyecto");
if (!existsSync(publicPdf)) {
  failures.push(`Falta el documento público: ${publicPdfRelative}`);
} else if (!readFileSync(publicPdf).subarray(0, 5).equals(Buffer.from("%PDF-"))) {
  failures.push(`El documento no es un PDF válido: ${publicPdfRelative}`);
}

const intentionallyUnavailableReferences = new Set(["/docs/guia-compra-guiada-copart.pdf"]);
const htmlFiles = allFiles
  .filter((file) => extname(file).toLowerCase() === ".html")
  .map((file) => relative(root, file));

for (const htmlRelative of htmlFiles) {
  const html = readFileSync(join(root, htmlRelative), "utf8");
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    if (!clean || intentionallyUnavailableReferences.has(clean)) continue;
    let target = clean.startsWith("/") ? join(root, clean.slice(1)) : resolve(dirname(join(root, htmlRelative)), clean);
    if (clean.endsWith("/")) target = join(target, "index.html");
    if (!existsSync(target)) failures.push(`${htmlRelative}: referencia inexistente ${reference}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Build estático validado: rutas, assets, enlaces, PDF público, rewrites y checkout LIVE.");
