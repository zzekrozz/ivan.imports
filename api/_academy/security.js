import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { domainToASCII } from "node:url";

export const ACADEMY_PROGRAM_ID = "importa-tu-primer-coche";
export const DEFAULT_RETURN_TO = "/academia/importa-tu-primer-coche/";
const EXACT_RETURN_PATHS = new Set([
  "/academia",
  "/academia/",
  "/academia/importa-tu-primer-coche",
  "/academia/importa-tu-primer-coche/",
  "/ruta",
  "/ruta/",
  "/mi-operacion",
  "/mi-operacion/",
  "/candidatos",
  "/candidatos/",
  "/herramientas",
  "/herramientas/",
  "/respuestas",
  "/respuestas/",
  "/recursos",
  "/recursos/",
  "/soporte",
  "/soporte/",
  "/academia/cuenta",
  "/academia/cuenta/",
]);
const RETURN_PATTERNS = [
  /^\/etapa\/[a-z0-9-]+\/?$/i,
  /^\/paso\/[a-z0-9-]+\/?$/i,
  /^\/herramientas\/[a-z0-9-]+\/?$/i,
  /^\/academia\/importa-tu-primer-coche\/[a-z0-9/_-]+\/?$/i,
];
const ACCESS_PATH = /^\/academia\/acceso(?:\/|$)/;

function allowedReturnPath(pathname) {
  if (EXACT_RETURN_PATHS.has(pathname)) return true;
  return RETURN_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function normalizeEmail(value) {
  const input = String(value ?? "").normalize("NFKC").trim();
  if (!input || input.length > 254 || /[\u0000-\u001f\u007f\s]/.test(input)) return "";
  const at = input.lastIndexOf("@");
  if (at < 1 || at !== input.indexOf("@")) return "";
  const local = input.slice(0, at).toLocaleLowerCase("en-US");
  const domain = domainToASCII(input.slice(at + 1).toLocaleLowerCase("en-US"));
  if (!local || local.length > 64 || !domain || domain.length > 253 || !domain.includes(".")) return "";
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return "";
  if (!/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/i.test(local)) return "";
  const labels = domain.split(".");
  if (labels.some((label) => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return "";
  return `${local}@${domain}`;
}

export function maskAcademyEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "tu email de compra";
  const [local, domain] = normalized.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(3, Math.min(7, local.length - visible.length)))}@${domain}`;
}

export function hmacDigest(value, secret, context = "academy") {
  if (!secret || String(secret).length < 32) throw new Error(`${context} secret must contain at least 32 characters`);
  return createHmac("sha256", String(secret)).update(`${context}\0${String(value)}`, "utf8").digest("hex");
}

export function emailHash(email, secret) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "";
  return hmacDigest(normalized, secret, "academy-email-v1");
}

export function randomOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function randomSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function constantTimeEqual(left, right) {
  const first = Buffer.from(String(left ?? ""));
  const second = Buffer.from(String(right ?? ""));
  const firstDigest = createHash("sha256").update(first).digest();
  const secondDigest = createHash("sha256").update(second).digest();
  return timingSafeEqual(firstDigest, secondDigest) && first.length === second.length;
}

export function safeReturnTo(value, baseUrl = "https://ivanimports.es") {
  if (!value) return DEFAULT_RETURN_TO;
  try {
    const base = new URL(baseUrl);
    const raw = String(value);
    if (/^[\\/]{2}|[\u0000-\u001f\u007f\\]/.test(raw)) return DEFAULT_RETURN_TO;
    const parsed = new URL(raw, base);
    if (parsed.origin !== base.origin || !allowedReturnPath(parsed.pathname) || ACCESS_PATH.test(parsed.pathname)) return DEFAULT_RETURN_TO;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_TO;
  }
}

export function safeRoute(value) {
  const route = safeReturnTo(value);
  return route.split("#")[0];
}

export function parseCookies(header) {
  const result = {};
  for (const pair of String(header || "").split(";")) {
    const index = pair.indexOf("=");
    if (index < 1) continue;
    const name = pair.slice(0, index).trim();
    try { result[name] = decodeURIComponent(pair.slice(index + 1).trim()); } catch { result[name] = ""; }
  }
  return result;
}

export function academyCookieName(vercelEnv) {
  return !["development", "test"].includes(String(vercelEnv || "development")) ? "__Host-ivan_academia" : "ivan_academia";
}

export function sessionCookie(token, { vercelEnv = "development", maxAge = 0 } = {}) {
  const name = academyCookieName(vercelEnv);
  const parts = [`${name}=${encodeURIComponent(token || "")}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${Math.max(0, Math.floor(maxAge))}`];
  if (!["development", "test"].includes(String(vercelEnv || "development"))) parts.push("Secure");
  return parts.join("; ");
}

export function requestIp(request) {
  const raw = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown";
  const candidate = raw.split(",")[0].trim().slice(0, 128);
  return candidate || "unknown";
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

const LARGE_LESSON_ID_ARRAY_PATHS = new Set([
  "progress.completedLessonIds",
  "progress.startedLessonIds",
  "migration.legacyState.progress.completedLessonIds",
  "migration.legacyState.progress.startedLessonIds",
]);
const LARGE_STAGE_ID_ARRAY_PATHS = new Set([
  "progress.completedStageIds",
  "migration.legacyState.progress.completedStageIds",
]);

function cloneSafeJson(value, depth = 0, budget = { nodes: 0 }, path = []) {
  budget.nodes += 1;
  if (budget.nodes > 10_000 || depth > 7) throw new Error("state_too_complex");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) throw new Error("invalid_state_number");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 5_000) throw new Error("state_string_too_long");
    return value;
  }
  if (Array.isArray(value)) {
    const joinedPath = path.join(".");
    const maximum = LARGE_LESSON_ID_ARRAY_PATHS.has(joinedPath) ? 500 : LARGE_STAGE_ID_ARRAY_PATHS.has(joinedPath) ? 20 : 100;
    if (value.length > maximum) throw new Error("state_array_too_long");
    if (LARGE_LESSON_ID_ARRAY_PATHS.has(joinedPath) || LARGE_STAGE_ID_ARRAY_PATHS.has(joinedPath)) {
      if (value.some((entry) => typeof entry !== "string")) throw new Error("invalid_progress_id");
      const ids = value;
      if (ids.some((entry) => !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(entry))) throw new Error("invalid_progress_id");
      return [...new Set(ids)];
    }
    return value.map((entry) => cloneSafeJson(entry, depth + 1, budget, [...path, "[]"]));
  }
  if (!isPlainObject(value)) throw new Error("invalid_state_value");
  const entries = Object.entries(value);
  const maximumEntries = path.join(".") === "tools.lessonChecklists" ? 400 : 150;
  if (entries.length > maximumEntries) throw new Error("state_object_too_large");
  const output = Object.create(null);
  for (const [key, entry] of entries) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(key) || ["__proto__", "prototype", "constructor"].includes(key)) throw new Error("invalid_state_key");
    output[key] = cloneSafeJson(entry, depth + 1, budget, [...path, key]);
  }
  return output;
}

export function validateAcademyState(value, maxBytes = 256 * 1024) {
  if (!isPlainObject(value)) throw new Error("invalid_state");
  const allowed = new Set(["version", "schemaVersion", "migration", "progress", "operation", "candidates", "tools", "preferences", "activeLessonId"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error("invalid_state_section");
  if (value.schemaVersion !== undefined && (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > 99)) throw new Error("invalid_schema_version");
  if (value.migration !== undefined && !isPlainObject(value.migration)) throw new Error("invalid_migration");
  if (value.progress !== undefined && !isPlainObject(value.progress)) throw new Error("invalid_progress");
  if (value.operation !== undefined && !isPlainObject(value.operation)) throw new Error("invalid_operation");
  if (value.candidates !== undefined && !Array.isArray(value.candidates)) throw new Error("invalid_candidates");
  if (value.candidates?.length > 20) throw new Error("too_many_candidates");
  if (value.tools !== undefined && !isPlainObject(value.tools)) throw new Error("invalid_tools");
  const cloned = cloneSafeJson(value);
  if (Buffer.byteLength(JSON.stringify(cloned), "utf8") > maxBytes) throw new Error("state_too_large");
  return cloned;
}
