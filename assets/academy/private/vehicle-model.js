export const VEHICLE_SCHEMA_VERSION = 1;

export const VEHICLE_FUEL_LABELS = Object.freeze({
  petrol: "Gasolina",
  diesel: "Diésel",
  hybrid: "Híbrido",
  plug_in_hybrid: "Híbrido enchufable",
  electric: "Eléctrico",
  lpg: "GLP",
  cng: "GNC",
  other: "Otro",
});

export const VEHICLE_TRANSMISSION_LABELS = Object.freeze({
  manual: "Manual",
  automatic: "Automático",
  semi_automatic: "Semiautomático",
  other: "Otro",
});

export const VEHICLE_STATUS_LABELS = Object.freeze({
  candidate: "Candidato",
  analyzing: "Analizando",
  negotiating: "Negociando",
  purchased: "Comprado",
  transport: "En transporte",
  in_spain: "En España",
  registered: "Matriculado",
  for_sale: "En venta",
  sold: "Vendido",
  discarded: "Descartado",
});

const FUEL_TERMS = Object.freeze([
  ["plug_in_hybrid", /plug[ -]?in|phev|híbrido enchufable|hybrid.*extern/i],
  ["electric", /electric|elektro|eléctrico|bev/i],
  ["hybrid", /hybrid|híbrido/i],
  ["diesel", /diesel|diésel/i],
  ["petrol", /petrol|gasoline|benzin|gasolina/i],
  ["lpg", /\blpg\b|autogas|glp/i],
  ["cng", /\bcng\b|erdgas|gnc/i],
]);

const TRANSMISSION_TERMS = Object.freeze([
  ["semi_automatic", /semi[ -]?automatic|semiautom|halbautom/i],
  ["automatic", /automatic|automatik|automático/i],
  ["manual", /manual|schaltgetriebe|cambio manual/i],
]);

const stringOrNull = (value) => {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
};

export function normalizeVehicleNumber(value, { integer = false } = {}) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? (integer ? Math.round(value) : value) : null;
  const source = String(value).replace(/[^0-9,.-]/g, "").trim();
  if (!source || source.includes("-")) return null;
  const comma = source.lastIndexOf(",");
  const dot = source.lastIndexOf(".");
  let normalized = source;
  if (comma >= 0 && dot >= 0) {
    const decimal = Math.max(comma, dot);
    normalized = `${source.slice(0, decimal).replace(/[.,]/g, "")}.${source.slice(decimal + 1).replace(/[.,]/g, "")}`;
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? "," : ".";
    const chunks = source.split(separator);
    const thousands = chunks.length > 2 || (chunks.length === 2 && chunks[1].length === 3);
    normalized = thousands ? chunks.join("") : `${chunks.slice(0, -1).join("") || "0"}.${chunks.at(-1) || "0"}`;
  }
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? (integer ? Math.round(number) : number) : null;
}

export function normalizeMileage(value) {
  return normalizeVehicleNumber(value, { integer: true });
}

export function normalizeFirstRegistration(value) {
  const source = stringOrNull(value);
  if (!source) return null;
  let match = source.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
  match = source.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) return `${match[2]}-${String(Number(match[1])).padStart(2, "0")}`;
  match = source.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? match[1] : null;
}

export function normalizeFuelType(value) {
  const source = stringOrNull(value);
  if (!source) return null;
  if (Object.hasOwn(VEHICLE_FUEL_LABELS, source)) return source;
  return FUEL_TERMS.find(([, pattern]) => pattern.test(source))?.[0] || "other";
}

export function normalizeTransmission(value) {
  const source = stringOrNull(value);
  if (!source) return null;
  if (Object.hasOwn(VEHICLE_TRANSMISSION_LABELS, source)) return source;
  return TRANSMISSION_TERMS.find(([, pattern]) => pattern.test(source))?.[0] || "other";
}

export function kwToCv(value) {
  const kw = normalizeVehicleNumber(value);
  return kw === null ? null : Math.round(kw * 1.35962);
}

export function cvToKw(value) {
  const cv = normalizeVehicleNumber(value);
  return cv === null ? null : Math.round((cv / 1.35962) * 10) / 10;
}

function nullableBoolean(value) {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === "") return null;
  const source = String(value).trim().toLowerCase();
  if (["true", "yes", "ja", "sí", "si", "1"].includes(source)) return true;
  if (["false", "no", "nein", "0"].includes(source)) return false;
  return null;
}

function cleanList(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/\r?\n|\s*[;,]\s*/);
  return [...new Set(list.map(stringOrNull).filter(Boolean))].slice(0, 250);
}

function normalizeCountry(value) {
  const country = stringOrNull(value);
  if (!country) return null;
  return ({ DE: "Alemania", DEU: "Alemania", Germany: "Alemania", Deutschland: "Alemania", NL: "Países Bajos", NLD: "Países Bajos", BE: "Bélgica", BEL: "Bélgica", FR: "Francia", FRA: "Francia" })[country] || country;
}

function safeImages(value) {
  return cleanList(value).filter((item) => {
    try { return new URL(item).protocol === "https:"; } catch { return false; }
  }).slice(0, 30);
}

function makeId() {
  return `vehicle_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export function normalizeVehicleStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return Object.hasOwn(VEHICLE_STATUS_LABELS, status) ? status : "candidate";
}

export function createEmptyVehicle(input = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: VEHICLE_SCHEMA_VERSION,
    id: input.id || makeId(),
    status: normalizeVehicleStatus(input.status),
    source: input.source || "manual",
    sourceListingId: null,
    sourceUrl: null,
    importedAt: input.importedAt || null,
    lastCheckedAt: input.lastCheckedAt || null,
    make: null, model: null, variant: null, title: null, bodyType: null,
    firstRegistration: null, year: null, mileageKm: null, fuelType: null,
    transmission: null, powerKw: null, powerCv: null, engineCc: null, drivetrain: null,
    price: null, currency: "EUR", priceGross: null, priceNet: null,
    vatDeductible: null, vatRate: null, negotiable: null,
    co2: null, emissionClass: null, euroNorm: null, consumption: null,
    doors: null, seats: null, color: null, interior: null, weight: null, towingCapacity: null,
    previousOwners: null, accidentFree: null, damagedVehicle: null, serviceHistory: null,
    fullServiceHistory: null, nonSmoker: null, roadworthy: null, huUntil: null, warranty: null,
    vin: null, cocMentioned: null, registrationDocumentsMentioned: null, inspectionInfo: null,
    sellerType: null, sellerName: null, company: null, city: null, postalCode: null,
    country: null, phone: null, dealerRating: null,
    description: null, equipment: [], highlights: [], sellerNotes: null, images: [],
    rawSourceData: null,
    fieldSources: {},
    manualOverrides: {},
    priceHistory: [],
    analysis: { spanishMarketPrice: null, expectedSalePrice: null, desiredProfit: null, totalImportCost: null, marketProfit: null, maxPurchasePrice: null },
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function normalizeVehicle(input = {}, metadata = {}) {
  const base = createEmptyVehicle({ ...input, source: metadata.source || input.source || "manual" });
  const registration = normalizeFirstRegistration(input.firstRegistration || input.registrationDate || input.firstRegistrationDate);
  const year = normalizeVehicleNumber(input.year || registration?.slice(0, 4), { integer: true });
  const powerKw = normalizeVehicleNumber(input.powerKw ?? input.kw);
  const suppliedCv = normalizeVehicleNumber(input.powerCv ?? input.cv);
  const powerCv = suppliedCv ?? kwToCv(powerKw);
  const price = normalizeVehicleNumber(input.price ?? input.priceGross ?? input.offerPrice);
  const importedAt = input.importedAt || metadata.importedAt || (base.source === "manual" ? null : new Date().toISOString());
  const lastCheckedAt = input.lastCheckedAt || metadata.lastCheckedAt || importedAt;
  const title = stringOrNull(input.title) || stringOrNull([input.make, input.model, input.variant].filter(Boolean).join(" "));
  const directFields = metadata.directFields instanceof Set ? metadata.directFields : new Set(metadata.directFields || []);
  const derivedFields = new Set(metadata.derivedFields || []);
  if (!suppliedCv && powerKw !== null) derivedFields.add("powerCv");
  if (!input.year && registration) derivedFields.add("year");
  const vehicle = {
    ...base,
    ...input,
    schemaVersion: VEHICLE_SCHEMA_VERSION,
    id: input.id || base.id,
    status: normalizeVehicleStatus(input.status),
    source: metadata.source || input.source || base.source,
    sourceListingId: stringOrNull(metadata.sourceListingId || input.sourceListingId),
    sourceUrl: stringOrNull(metadata.sourceUrl || input.sourceUrl),
    importedAt,
    lastCheckedAt,
    make: stringOrNull(input.make), model: stringOrNull(input.model), variant: stringOrNull(input.variant), title,
    bodyType: stringOrNull(input.bodyType), firstRegistration: registration, year,
    mileageKm: normalizeMileage(input.mileageKm ?? input.mileage),
    fuelType: normalizeFuelType(input.fuelType ?? input.fuel),
    transmission: normalizeTransmission(input.transmission), powerKw, powerCv,
    engineCc: normalizeVehicleNumber(input.engineCc, { integer: true }), drivetrain: stringOrNull(input.drivetrain),
    price, currency: stringOrNull(input.currency)?.toUpperCase() || "EUR",
    priceGross: normalizeVehicleNumber(input.priceGross), priceNet: normalizeVehicleNumber(input.priceNet),
    vatDeductible: nullableBoolean(input.vatDeductible), vatRate: normalizeVehicleNumber(input.vatRate), negotiable: nullableBoolean(input.negotiable),
    co2: normalizeVehicleNumber(input.co2), emissionClass: stringOrNull(input.emissionClass), euroNorm: stringOrNull(input.euroNorm),
    consumption: normalizeVehicleNumber(input.consumption), doors: normalizeVehicleNumber(input.doors, { integer: true }),
    seats: normalizeVehicleNumber(input.seats, { integer: true }), color: stringOrNull(input.color), interior: stringOrNull(input.interior),
    weight: normalizeVehicleNumber(input.weight), towingCapacity: normalizeVehicleNumber(input.towingCapacity),
    previousOwners: normalizeVehicleNumber(input.previousOwners, { integer: true }), accidentFree: nullableBoolean(input.accidentFree),
    damagedVehicle: nullableBoolean(input.damagedVehicle), serviceHistory: nullableBoolean(input.serviceHistory),
    fullServiceHistory: nullableBoolean(input.fullServiceHistory), nonSmoker: nullableBoolean(input.nonSmoker),
    roadworthy: nullableBoolean(input.roadworthy), huUntil: normalizeFirstRegistration(input.huUntil), warranty: stringOrNull(input.warranty),
    vin: stringOrNull(input.vin), cocMentioned: nullableBoolean(input.cocMentioned),
    registrationDocumentsMentioned: nullableBoolean(input.registrationDocumentsMentioned), inspectionInfo: stringOrNull(input.inspectionInfo),
    sellerType: stringOrNull(input.sellerType), sellerName: stringOrNull(input.sellerName), company: stringOrNull(input.company),
    city: stringOrNull(input.city), postalCode: stringOrNull(input.postalCode), country: normalizeCountry(input.country),
    phone: stringOrNull(input.phone), dealerRating: normalizeVehicleNumber(input.dealerRating),
    description: stringOrNull(input.description), equipment: cleanList(input.equipment), highlights: cleanList(input.highlights),
    sellerNotes: stringOrNull(input.sellerNotes), images: safeImages(input.images),
    rawSourceData: input.rawSourceData && typeof input.rawSourceData === "object" ? input.rawSourceData : null,
    manualOverrides: input.manualOverrides && typeof input.manualOverrides === "object" ? { ...input.manualOverrides } : {},
    priceHistory: Array.isArray(input.priceHistory) ? input.priceHistory.filter((entry) => normalizeVehicleNumber(entry?.price) !== null).map((entry) => ({ price: normalizeVehicleNumber(entry.price), checkedAt: entry.checkedAt || lastCheckedAt || new Date().toISOString() })).slice(-50) : [],
    analysis: { ...base.analysis, ...(input.analysis || {}) },
    createdAt: input.createdAt || base.createdAt,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
  if (price !== null && !vehicle.priceHistory.some((entry) => entry.price === price)) vehicle.priceHistory.push({ price, checkedAt: lastCheckedAt || new Date().toISOString() });
  const trackedFields = ["make", "model", "variant", "title", "bodyType", "firstRegistration", "year", "mileageKm", "fuelType", "transmission", "powerKw", "powerCv", "engineCc", "drivetrain", "price", "priceGross", "priceNet", "vatDeductible", "co2", "euroNorm", "accidentFree", "damagedVehicle", "roadworthy", "huUntil", "cocMentioned", "sellerType", "city", "country", "description", "equipment", "images"];
  vehicle.fieldSources = Object.fromEntries(trackedFields.map((field) => [field, vehicle[field] === null || (Array.isArray(vehicle[field]) && !vehicle[field].length) ? "missing" : derivedFields.has(field) ? "derived" : directFields.size && !directFields.has(field) ? "derived" : "direct"]));
  return vehicle;
}

export function vehicleIdentity(vehicle) {
  if (vehicle?.source && vehicle?.sourceListingId) return `${vehicle.source}:${vehicle.sourceListingId}`.toLowerCase();
  return vehicle?.id ? `id:${vehicle.id}` : "";
}

export function findDuplicateVehicle(vehicles, candidate) {
  const identity = vehicleIdentity(candidate);
  return identity && !identity.startsWith("id:") ? (vehicles || []).find((vehicle) => vehicleIdentity(vehicle) === identity) || null : null;
}

export function applyVehicleEdits(vehicle, edits = {}) {
  const merged = normalizeVehicle({ ...vehicle, ...edits, id: vehicle.id, source: vehicle.source, manualOverrides: { ...vehicle.manualOverrides } });
  Object.keys(edits).forEach((field) => { if (!new Set(["id", "source", "sourceListingId", "sourceUrl", "createdAt", "importedAt"]).has(field)) merged.manualOverrides[field] = true; });
  merged.updatedAt = new Date().toISOString();
  return merged;
}

export function mergeVehicleImport(existing, incoming) {
  const normalizedIncoming = normalizeVehicle(incoming);
  const merged = { ...existing, ...normalizedIncoming, id: existing.id, status: normalizeVehicleStatus(existing.status), createdAt: existing.createdAt, manualOverrides: { ...(existing.manualOverrides || {}) } };
  Object.keys(merged.manualOverrides).forEach((field) => { if (merged.manualOverrides[field]) merged[field] = existing[field]; });
  const history = [...(existing.priceHistory || []), ...(normalizedIncoming.priceHistory || [])];
  merged.priceHistory = history.filter((entry, index) => history.findIndex((other) => other.price === entry.price && other.checkedAt === entry.checkedAt) === index).slice(-50);
  merged.updatedAt = new Date().toISOString();
  return normalizeVehicle(merged);
}

export function upsertVehicle(vehicles, vehicle) {
  const list = Array.isArray(vehicles) ? [...vehicles] : [];
  const index = list.findIndex((entry) => entry.id === vehicle.id);
  if (index >= 0) list[index] = normalizeVehicle(vehicle);
  else list.unshift(normalizeVehicle(vehicle));
  return list.slice(0, 50);
}

export function removeVehicle(vehicles, id) {
  return (vehicles || []).filter((vehicle) => vehicle.id !== id);
}

export function duplicateVehicle(vehicle) {
  return normalizeVehicle({ ...vehicle, id: makeId(), source: "manual", sourceListingId: null, sourceUrl: vehicle.sourceUrl, importedAt: null, createdAt: new Date().toISOString(), title: `${vehicle.title || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehículo"} (copia)` });
}

function stableLegacyId(candidate, index) {
  if (candidate?.id) return String(candidate.id).slice(0, 100);
  const source = JSON.stringify([candidate?.title, candidate?.brand, candidate?.model, candidate?.year, candidate?.price, index]);
  let hash = 2166136261;
  for (let cursor = 0; cursor < source.length; cursor += 1) hash = Math.imul(hash ^ source.charCodeAt(cursor), 16777619);
  return `vehicle_legacy_${(hash >>> 0).toString(36)}`;
}

export function migrateLegacyCandidatesToVehicles(vehicles = [], candidates = []) {
  let migrated = (Array.isArray(vehicles) ? vehicles : []).map((vehicle) => normalizeVehicle(vehicle));
  (Array.isArray(candidates) ? candidates : []).forEach((candidate, index) => {
    const id = stableLegacyId(candidate, index);
    if (migrated.some((vehicle) => vehicle.id === id)) return;
    migrated = upsertVehicle(migrated, normalizeVehicle({
      id,
      status: candidate.discarded ? "discarded" : "candidate",
      source: "manual",
      title: candidate.title,
      make: candidate.brand || candidate.make,
      model: candidate.model,
      variant: candidate.version || candidate.variant,
      year: candidate.year,
      mileageKm: candidate.mileageKm ?? candidate.mileage,
      price: candidate.price,
      country: candidate.country,
      city: candidate.location || candidate.city,
      sourceUrl: candidate.adUrl || candidate.sourceUrl,
      sellerName: candidate.contact || candidate.sellerName,
      description: candidate.notes || candidate.documents || null,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      legacyCandidate: {
        priority: candidate.priority || null,
        availability: candidate.availability || null,
        distance: candidate.distance || null,
      },
    }));
  });
  return migrated;
}

export function formatVehicleRegistration(value) {
  const source = normalizeFirstRegistration(value);
  if (!source) return "No indicado";
  const [year, month] = source.split("-");
  return month ? `${month}/${year}` : year;
}
