import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".vercel", "node_modules", "coverage"]);
const codeExtensions = new Set([".js", ".mjs"]);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".ps1", ".txt", ".xml"]);
const failures = [];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const files = walk(root);
for (const file of files.filter((candidate) => codeExtensions.has(extname(candidate)))) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) failures.push(`${relative(root, file)}: ${result.stderr.trim()}`);
}

const publicPdfAllowlist = new Set(["assets/academia/otorgamiento_ES.pdf"]);
const unexpectedPdfs = files
  .filter((file) => extname(file).toLowerCase() === ".pdf")
  .filter((file) => !publicPdfAllowlist.has(relative(root, file).replaceAll("\\", "/")));
if (unexpectedPdfs.length) {
  failures.push(`PDF no permitidos dentro del proyecto: ${unexpectedPdfs.map((file) => relative(root, file)).join(", ")}`);
}

const forbiddenSecrets = [
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["Stripe webhook secret", /\bwhsec_[A-Za-z0-9]{16,}\b/],
  ["Resend API key", /\bre_[A-Za-z0-9]{20,}\b/],
  ["GitHub token", /\bgh[oprsu]_[A-Za-z0-9]{20,}\b/],
];

for (const file of files.filter((candidate) => textExtensions.has(extname(candidate)))) {
  const source = readFileSync(file, "utf8");
  for (const [label, pattern] of forbiddenSecrets) {
    if (pattern.test(source)) failures.push(`${label} potencial en ${relative(root, file)}`);
  }
}

const productFiles = [
  join(root, "api", "importa-7-dias.js"),
  join(root, "assets", "importa-7-dias", "config.js"),
  join(root, "assets", "importa-7-dias", "landing.js"),
  join(root, "assets", "importa-7-dias", "thanks.js"),
  join(root, "importa-en-7-dias", "index.html"),
  join(root, "importa-en-7-dias", "gracias", "index.html"),
];
const productSource = productFiles.filter((file) => statSync(file).isFile()).map((file) => readFileSync(file, "utf8")).join("\n");
if (/KAIROS\s+KRONOS/i.test(productSource)) failures.push("La marca prohibida aparece en el flujo del producto");
if (/34674252436/.test(productSource)) failures.push("El teléfono privado aparece en el flujo público del producto");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Lint correcto: ${files.length} archivos revisados; ${files.filter((file) => codeExtensions.has(extname(file))).length} scripts válidos.`);
