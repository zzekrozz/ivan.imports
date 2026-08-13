import { createHash } from "node:crypto";

export function parseArgs(argv = process.argv.slice(2)) {
  const values = {};
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const separator = arg.indexOf("=");
    if (separator > 2) {
      values[arg.slice(2, separator)] = arg.slice(separator + 1);
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      values[arg.slice(2)] = argv[index + 1];
      index += 1;
    } else {
      flags.add(arg.slice(2));
    }
  }
  return { values, flags };
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function validEmail(value) {
  return /^[^\s@]{1,128}@[^\s@]{1,190}\.[^\s@]{2,63}$/.test(normalizeEmail(value));
}

export function maskEmail(value) {
  const [local = "", domain = ""] = normalizeEmail(value).split("@");
  if (!local || !domain) return "correo-inválido";
  const [host = "", ...suffix] = domain.split(".");
  return `${local.slice(0, Math.min(2, local.length))}${"*".repeat(Math.max(3, Math.min(6, local.length - 1)))}@${host.slice(0, 1)}***${suffix.length ? `.${suffix.at(-1)}` : ""}`;
}

export function emailReference(value) {
  return createHash("sha256").update(normalizeEmail(value)).digest("hex").slice(0, 12);
}

export function adminConfig() {
  return {
    endpoint: String(process.env.ACADEMY_ADMIN_API_URL || "").trim(),
    token: String(process.env.ACADEMY_ADMIN_API_TOKEN || "").trim(),
  };
}

export function requireApplyConfig(args, { backfill = false } = {}) {
  const config = adminConfig();
  if (!config.endpoint) throw new Error("Falta ACADEMY_ADMIN_API_URL");
  if (config.token.length < 32) throw new Error("Falta ACADEMY_ADMIN_API_TOKEN con al menos 32 caracteres");
  let url;
  try {
    url = new URL(config.endpoint);
  } catch {
    throw new Error("ACADEMY_ADMIN_API_URL no es una URL válida");
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("El endpoint admin debe usar HTTPS fuera de localhost");
  }
  if (url.username || url.password || url.search || url.hash) throw new Error("ACADEMY_ADMIN_API_URL no debe contener credenciales, query ni fragmento");
  const isProduction = /(^|\.)ivanimports\.es$/i.test(url.hostname) || String(process.env.VERCEL_ENV || "").toLowerCase() === "production";
  if (isProduction && !args.flags.has("confirm-production")) throw new Error("Producción requiere --confirm-production");
  if (backfill && isProduction && (process.env.ACADEMY_ALLOW_PRODUCTION_BACKFILL !== "YES" || !args.flags.has("confirm-backfill"))) {
    throw new Error("Backfill de producción bloqueado: requiere ACADEMY_ALLOW_PRODUCTION_BACKFILL=YES y --confirm-backfill");
  }
  return config;
}

export async function adminRequest(config, action, payload, idempotencyKey) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ action, programId: "importa-tu-primer-coche", ...payload }),
    redirect: "error",
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) throw new Error(`Admin API respondió ${response.status}${body?.error ? `: ${String(body.error).slice(0, 120)}` : ""}`);
  return body || { ok: true };
}
