import { ACCESS_MODES, EDITORIAL, LISTING, isActive, isHistorical, visibleTier } from "./access.js";
import { COST_KEYS, COST_STATUS, isCustomKey } from "../../assets/radar/cost-model.js";

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//;
export const FUEL = ["Diésel", "Gasolina", "Híbrido", "Eléctrico", "GLP", "Otro"];
export const TRANSMISSION = ["Manual", "Automático", "Otro"];
export const CURRENCIES = ["EUR", "GBP", "CHF", "PLN", "CZK", "SEK", "DKK"];
export const QUESTION_STATUS = ["pending", "asked", "answered", "verified", "unverified"];
export const RISK_KINDS = ["confirmed", "declared", "estimated", "hypothesis", "pending"];
const ID = /^[a-z0-9-]{8,48}$/;

export const slugify = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const validId = (id) => typeof id === "string" && ID.test(id);
export const makeSlug = (v) => `${slugify(`${v.brand || "coche"} ${v.model || ""} ${v.year || ""}`).slice(0, 60)}-${String(v.id).slice(0, 8)}`.replace(/-+/g, "-");

class Collector { constructor() { this.errors = []; } add(field, message) { this.errors.push({ field, message }); } }

function str(c, input, key, { max = 200, required = false, enumValues } = {}) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") { if (required) c.add(key, "Obligatorio"); return undefined; }
  if (typeof raw !== "string") { c.add(key, "Debe ser texto"); return undefined; }
  const value = raw.trim();
  if (value.length > max) { c.add(key, `Máximo ${max} caracteres`); return undefined; }
  if (enumValues && !enumValues.includes(value)) { c.add(key, "Valor no permitido"); return undefined; }
  return value;
}
function num(c, input, key, { min = 0, max = 1e7, int = false } = {}) {
  const raw = input[key];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const value = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(value) || value < min || value > max || (int && !Number.isInteger(value))) { c.add(key, `Número entre ${min} y ${max}${int ? " (entero)" : ""}`); return undefined; }
  return Math.round(value * 100) / 100;
}
const date = (c, input, key) => {
  const raw = input[key];
  if (!raw) return undefined;
  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) { c.add(key, "Fecha no válida"); return undefined; }
  return new Date(raw).toISOString();
};
function url(c, raw, key) {
  if (!raw) return undefined;
  try { const u = new URL(String(raw)); if (!["http:", "https:"].includes(u.protocol) || String(raw).length > 1000) throw new Error(); return u.toString(); } catch { c.add(key, "Enlace no válido (http/https)"); return undefined; }
}
function list(c, input, key, max, mapper) {
  const raw = input[key];
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > max) { c.add(key, `Lista de máximo ${max} elementos`); return undefined; }
  return raw.map((item, i) => mapper(item && typeof item === "object" ? item : {}, `${key}[${i}]`)).filter(Boolean);
}
const strings = (c, raw, key, max, len) => (Array.isArray(raw) ? raw.slice(0, max).map((s) => String(s).trim().slice(0, len)).filter(Boolean) : undefined);
const rid = (value) => (typeof value === "string" && /^[a-z0-9-]{3,40}$/.test(value) ? value : undefined);

/** Normaliza y valida el contenido editable. Ignora cualquier campo que no esté en la lista blanca. */
export function normalizeVehicleInput(input, { currentYear = new Date().getFullYear() } = {}) {
  const c = new Collector();
  const i = input && typeof input === "object" ? input : {};
  const v = {};
  const set = (key, value) => { if (value !== undefined) v[key] = value; };
  for (const key of ["brand", "model"]) set(key, str(c, i, key, { max: 60 }));
  set("versionName", str(c, i, "versionName", { max: 100 }));
  set("engine", str(c, i, "engine", { max: 80 }));
  set("fuel", str(c, i, "fuel", { max: 20, enumValues: FUEL }));
  set("transmission", str(c, i, "transmission", { max: 20, enumValues: TRANSMISSION }));
  set("country", str(c, i, "country", { max: 40 }));
  set("platform", str(c, i, "platform", { max: 60 }));
  set("description", str(c, i, "description", { max: 4000 }));
  set("firstImpression", str(c, i, "firstImpression", { max: 1200 }));
  set("internalNotes", str(c, i, "internalNotes", { max: 3000 }));
  set("firstRegistration", str(c, i, "firstRegistration", { max: 10 }));
  set("currency", str(c, i, "currency", { max: 3, enumValues: CURRENCIES }));
  set("year", num(c, i, "year", { min: 1950, max: currentYear + 1, int: true }));
  set("km", num(c, i, "km", { min: 0, max: 2e6, int: true }));
  set("hp", num(c, i, "hp", { min: 0, max: 2000, int: true }));
  set("price", num(c, i, "price", { min: 0, max: 1e7 }));
  set("originalUrl", url(c, i.originalUrl, "originalUrl"));
  set("features", strings(c, i.features, "features", 30, 80));
  set("editorialStatus", str(c, i, "editorialStatus", { enumValues: EDITORIAL }));
  set("listingStatus", str(c, i, "listingStatus", { enumValues: LISTING }));
  set("accessMode", str(c, i, "accessMode", { enumValues: ACCESS_MODES }));
  set("freeReleaseAt", date(c, i, "freeReleaseAt"));
  set("openUntil", date(c, i, "openUntil"));
  set("images", list(c, i, "images", 30, (img, f) => { const u = typeof img.url === "string" && BLOB_URL.test(img.url) ? img.url : (c.add(f, "Imagen no alojada en el almacenamiento de Radar"), null); return u ? { url: u, alt: String(img.alt || "").trim().slice(0, 200) } : null; }));
  if (i.spainReference !== undefined) {
    const r = i.spainReference && typeof i.spainReference === "object" ? i.spainReference : {};
    const ref = { value: num(c, r, "value"), min: num(c, r, "min"), max: num(c, r, "max"), note: str(c, r, "note", { max: 500 }) };
    if (ref.min !== undefined && ref.max !== undefined && ref.min > ref.max) c.add("spainReference", "El mínimo no puede superar al máximo");
    v.spainReference = Object.fromEntries(Object.entries(ref).filter(([, x]) => x !== undefined));
  }
  if (i.analysis !== undefined) {
    const a = i.analysis && typeof i.analysis === "object" ? i.analysis : {};
    const fair = a.fair && typeof a.fair === "object" ? { min: num(c, a.fair, "min"), max: num(c, a.fair, "max") } : undefined;
    if (fair && fair.min !== undefined && fair.max !== undefined && fair.min > fair.max) c.add("analysis.fair", "El mínimo no puede superar al máximo");
    v.analysis = Object.fromEntries(Object.entries({ head: str(c, a, "head", { max: 400 }), why: str(c, a, "why", { max: 1500 }), like: strings(c, a.like, "like", 12, 200), doubt: strings(c, a.doubt, "doubt", 12, 200), chk: str(c, a, "chk", { max: 1500 }), body: str(c, a, "body", { max: 12000 }), fair }).filter(([, x]) => x !== undefined));
  }
  if (i.costs !== undefined) {
    const k = i.costs && typeof i.costs === "object" ? i.costs : {};
    const items = list(c, k, "items", 60, (it, f) => {
      const key = String(it.key || "");
      if (!COST_KEYS.has(key) && !isCustomKey(key)) { c.add(f, "Concepto desconocido"); return null; }
      const status = str(c, it, "status", { enumValues: Object.keys(COST_STATUS) }) || "pending";
      const amount = num(c, it, "amount", { min: 0, max: 1e6 });
      const out = { key, status, applicable: it.applicable !== false, note: str(c, it, "note", { max: 300 }), source: str(c, it, "source", { max: 300 }) };
      if (amount !== undefined) out.amount = amount;
      if (isCustomKey(key)) { out.label = str(c, it, "label", { max: 80, required: true }); out.group = [1, 2, 3, 4].includes(Number(it.group)) ? Number(it.group) : 4; }
      return Object.fromEntries(Object.entries(out).filter(([, x]) => x !== undefined));
    });
    const keys = (items || []).map((x) => x.key);
    if (new Set(keys).size !== keys.length) c.add("costs", "Concepto duplicado");
    v.costs = { mode: k.mode === "pickup" ? "pickup" : "truck", items: items || [], templateId: rid(k.templateId) };
  }
  set("comparables", list(c, i, "comparables", 12, (x, f) => {
    const price = num(c, x, "price", { min: 1 });
    if (price === undefined) { c.add(f, "El precio anunciado es obligatorio"); return null; }
    return Object.fromEntries(Object.entries({ id: rid(x.id), title: str(c, x, "title", { max: 120, required: true }), year: num(c, x, "year", { min: 1950, max: 2100, int: true }), km: num(c, x, "km", { max: 2e6, int: true }), price, platform: str(c, x, "platform", { max: 60 }), url: url(c, x.url, `${f}.url`), observedAt: date(c, x, "observedAt"), note: str(c, x, "note", { max: 300 }) }).filter(([, y]) => y !== undefined));
  }));
  set("questions", list(c, i, "questions", 40, (x) => {
    const q = str(c, x, "q", { max: 200, required: true });
    return q ? Object.fromEntries(Object.entries({ id: rid(x.id), q, status: str(c, x, "status", { enumValues: QUESTION_STATUS }) || "pending", answer: str(c, x, "answer", { max: 600 }), note: str(c, x, "note", { max: 500 }), evidence: str(c, x, "evidence", { max: 300 }), internalNote: str(c, x, "internalNote", { max: 500 }), updatedAt: date(c, x, "updatedAt"), public: x.public !== false }).filter(([, y]) => y !== undefined)) : null;
  }));
  set("risks", list(c, i, "risks", 30, (x) => {
    const text = str(c, x, "text", { max: 400, required: true });
    return text ? { id: rid(x.id), kind: str(c, x, "kind", { enumValues: RISK_KINDS }) || "pending", text } : null;
  }));
  return { value: v, errors: c.errors };
}

/** Requisitos para publicar según el estado editorial. Express exige poco; Revisado, coherencia económica. */
export function publishErrors(v) {
  const e = [];
  const need = (field, ok, message) => { if (!ok) e.push({ field, message }); };
  const status = v.editorialStatus || "draft";
  need("editorialStatus", status !== "draft", "Elige Express, En análisis, Revisado o Descartado antes de publicar");
  if (status === "draft") return e;
  for (const f of ["brand", "model", "country", "originalUrl"]) need(f, Boolean(v[f]), "Obligatorio para publicar");
  need("year", Number.isInteger(v.year), "Obligatorio para publicar");
  need("price", Number.isFinite(v.price) && v.price > 0, "Obligatorio para publicar");
  need("images", Array.isArray(v.images) && v.images.length > 0, "Añade al menos una fotografía de portada");
  if (["express", "analyzing"].includes(status)) need("firstImpression", (v.firstImpression || "").length >= 10, "Escribe tu primera impresión (mínimo 10 caracteres)");
  if (status === "reviewed") {
    need("currency", (v.currency || "EUR") === "EUR", "Los análisis económicos requieren el precio en EUR");
    need("analysis.head", Boolean(v.analysis?.head), "Falta el resumen del análisis de Iván");
    need("spainReference", Number(v.spainReference?.value) > 0, "Falta la referencia en España");
    need("comparables", (v.comparables || []).length >= 1, "Añade al menos un comparable español");
    need("costs", (v.costs?.items || []).some((x) => x.applicable !== false && x.status !== "na" && Number.isFinite(x.amount)), "Introduce al menos un gasto con importe");
  }
  if (status === "discarded") need("analysis.head", Boolean(v.analysis?.head), "Explica brevemente por qué se descarta");
  if (v.accessMode === "delayed") need("freeReleaseAt", Boolean(v.freeReleaseAt), "Indica cuándo se libera gratis");
  return e;
}

/** Contadores del panel: salen de los registros guardados, nunca de valores fijos. */
export function summarize(vehicles, nowMs = Date.now()) {
  const out = { published: 0, draft: 0, reviewed: 0, express: 0, archived: 0, access_free: 0, access_pro: 0, access_open: 0 };
  for (const v of vehicles) {
    if (!v.published || v.editorialStatus === "draft") { out.draft += 1; continue; }
    if (isHistorical(v)) { out.archived += 1; continue; }
    if (!isActive(v)) continue;
    out.published += 1;
    if (v.editorialStatus === "reviewed") out.reviewed += 1; else out.express += 1;
    const tier = visibleTier(v, nowMs);
    if (tier === "basic") out.access_free += 1; else if (tier === "open") out.access_open += 1; else out.access_pro += 1;
  }
  return out;
}

export function normalizeTemplate(input) {
  const c = new Collector();
  const t = input && typeof input === "object" ? input : {};
  const name = str(c, t, "name", { max: 80, required: true });
  const mode = t.mode === "pickup" ? "pickup" : "truck";
  const { value, errors } = normalizeVehicleInput({ costs: { mode, items: t.items } });
  return { name, mode, items: value.costs?.items || [], errors: [...c.errors, ...errors] };
}
