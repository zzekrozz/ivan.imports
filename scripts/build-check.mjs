import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const requiredRoutes = [
  "index.html",
  "copart/index.html",
  "empieza/index.html",
  "consultoria/index.html",
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

const pdfs = walk(root).filter((file) => extname(file).toLowerCase() === ".pdf");
if (pdfs.length) failures.push("No puede haber PDF completos dentro del proyecto");

for (const htmlRelative of ["importa-en-7-dias/index.html", "importa-en-7-dias/gracias/index.html"]) {
  const html = readFileSync(join(root, htmlRelative), "utf8");
  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    if (!clean || clean.endsWith("/")) continue;
    const target = clean.startsWith("/") ? join(root, clean.slice(1)) : resolve(dirname(join(root, htmlRelative)), clean);
    if (!existsSync(target)) failures.push(`${htmlRelative}: referencia inexistente ${reference}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Build estático validado: rutas, assets, rewrites, checkout LIVE y ausencia de PDF.");
