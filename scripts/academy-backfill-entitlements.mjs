import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { adminRequest, emailReference, maskEmail, normalizeEmail, parseArgs, requireApplyConfig, validEmail } from "./_academy-entitlement-cli.mjs";

const args = parseArgs();
if (!args.values.file) throw new Error("Usa --file ruta/a/compradores.json (o .csv)");
const inputPath = resolve(args.values.file);
const raw = await readFile(inputPath, "utf8");

function parseInput() {
  if (extname(inputPath).toLowerCase() === ".json") {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("El JSON debe ser un array");
    return parsed;
  }
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const start = /^email(?:,|;|$)/i.test(lines[0] || "") ? 1 : 0;
  return lines.slice(start).map((line) => {
    const separator = line.includes(";") ? ";" : ",";
    return { email: line.split(separator)[0].replace(/^"|"$/g, "").trim() };
  });
}

const rows = parseInput();
const unique = new Map();
let invalid = 0;
let missingEmail = 0;
let duplicates = 0;
for (const row of rows) {
  const email = normalizeEmail(typeof row === "string" ? row : row?.email);
  if (!email) {
    missingEmail += 1;
    continue;
  }
  if (!validEmail(email)) {
    invalid += 1;
    continue;
  }
  if (unique.has(email)) {
    duplicates += 1;
    continue;
  }
  unique.set(email, { email, paidAt: typeof row === "object" ? row.paidAt || null : null });
}

const records = [...unique.values()];
console.log(JSON.stringify({
  mode: args.flags.has("apply") ? "apply-requested" : "dry-run",
  inputRows: rows.length,
  validUnique: records.length,
  duplicates,
  invalid,
  missingEmail,
  sample: records.slice(0, 3).map((record) => ({ email: maskEmail(record.email), emailRef: emailReference(record.email) })),
}, null, 2));

if (!args.flags.has("apply")) {
  console.log("Dry-run: no se ha abierto ninguna conexión ni migrado compradores.");
  process.exit(0);
}
if (!args.flags.has("confirm-backfill")) throw new Error("Para aplicar añade --apply --confirm-backfill");

const config = requireApplyConfig(args, { backfill: true });
const results = { granted: 0, skipped: 0, errors: 0 };
for (const record of records) {
  const ref = emailReference(record.email);
  try {
    const response = await adminRequest(
      config,
      "grant-entitlement",
      { email: record.email, paidAt: record.paidAt, source: "previous-buyers-backfill" },
      `academy-backfill:${ref}`,
    );
    if (response?.duplicate || response?.unchanged) results.skipped += 1;
    else results.granted += 1;
  } catch (error) {
    results.errors += 1;
    console.error(JSON.stringify({ email: maskEmail(record.email), emailRef: ref, error: String(error.message || error).slice(0, 160) }));
  }
}
console.log(JSON.stringify({ ...results, duplicates, invalid, missingEmail }, null, 2));
if (results.errors) process.exitCode = 1;
