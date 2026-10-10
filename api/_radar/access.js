/**
 * Política de acceso Gratis/PRO aplicada SIEMPRE en servidor.
 * Estado editorial (draft|express|analyzing|reviewed|discarded) y estado del anuncio
 * (available|pending|withdrawn|sold|archived) son campos independientes.
 */
export const ACCESS_MODES = ["pro", "delayed", "free", "pro_open"];
export const EDITORIAL = ["draft", "express", "analyzing", "reviewed", "discarded"];
export const LISTING = ["available", "pending", "withdrawn", "sold", "archived"];
export const ACTIVE_LISTING = ["available", "pending"];

export const BASIC_FIELDS = ["id", "slug", "brand", "model", "versionName", "engine", "hp", "fuel", "transmission", "year", "firstRegistration", "km", "country", "platform", "price", "currency", "originalUrl", "description", "features", "images", "editorialStatus", "listingStatus", "publishedAt", "updatedAt", "firstImpression"];
export const FULL_FIELDS = [...BASIC_FIELDS, "analysis", "costs", "comparables", "risks", "video", "communitySnapshot", "costSummary"];
const QUESTION_PUBLIC = ["id", "q", "status", "answer", "note", "evidence", "updatedAt"];

const at = (value) => (value ? Date.parse(value) : NaN);

/** Una oportunidad es "activa" si está publicada, su anuncio sigue vigente y el candidato no se ha descartado. */
export const isActive = (vehicle) => vehicle?.published === true && ACTIVE_LISTING.includes(vehicle.listingStatus ?? "available") && vehicle.editorialStatus !== "discarded" && vehicle.editorialStatus !== "draft";
export const isHistorical = (vehicle) => vehicle?.published === true && !isActive(vehicle) && vehicle.editorialStatus !== "draft";

/** 'hidden' | 'pro' | 'basic' | 'open' | 'archive' */
export function visibleTier(vehicle, nowMs = Date.now()) {
  if (!vehicle || vehicle.published !== true || vehicle.editorialStatus === "draft") return "hidden";
  if (isHistorical(vehicle)) return "archive";
  const { accessMode } = vehicle;
  if (accessMode === "free") return "basic";
  if (accessMode === "delayed") return nowMs >= at(vehicle.freeReleaseAt) ? "basic" : "pro";
  if (accessMode === "pro_open") {
    const until = at(vehicle.openUntil);
    return Number.isNaN(until) || nowMs < until ? "open" : "pro";
  }
  return "pro"; // por defecto, todo vehículo nuevo es PRO
}

const pick = (source, fields) => Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
const spain = (vehicle, full) => (vehicle.spainReference ? { spainReference: full ? vehicle.spainReference : { min: vehicle.spainReference.min, max: vehicle.spainReference.max } } : {});
const questions = (vehicle) => (Array.isArray(vehicle.questions) ? { questions: vehicle.questions.filter((q) => q.public !== false).map((q) => pick(q, QUESTION_PUBLIC)) } : {});

/** viewer: 'free' | 'pro'. Devuelve null si el vehículo no es visible para ese visitante. */
export function projectForViewer(vehicle, viewer = "free", nowMs = Date.now()) {
  const tier = visibleTier(vehicle, nowMs);
  if (tier === "hidden") return null;
  const full = () => ({ ...pick(vehicle, FULL_FIELDS), ...questions(vehicle), ...spain(vehicle, true) });
  if (tier === "archive") return viewer === "pro" ? { ...full(), tier: "archive" } : { ...pick(vehicle, BASIC_FIELDS), ...spain(vehicle, false), tier: "archive" };
  if (viewer === "pro") return { ...full(), tier: tier === "open" ? "open" : "pro" };
  if (tier === "open") return { ...full(), tier: "open" };
  if (tier === "basic") return { ...pick(vehicle, BASIC_FIELDS), ...spain(vehicle, false), tier: "basic" };
  return null;
}

/** Cuenta solo oportunidades ACTIVAS realmente reservadas para PRO. */
export function lockedCount(vehicles, viewer = "free", nowMs = Date.now()) {
  if (viewer === "pro") return 0;
  return vehicles.filter((vehicle) => isActive(vehicle) && visibleTier(vehicle, nowMs) === "pro").length;
}
