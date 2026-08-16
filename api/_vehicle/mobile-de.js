import { normalizeVehicle } from "../../assets/academy/private/vehicle-model.js";

export const MOBILE_DE_HOSTS = new Set(["mobile.de", "www.mobile.de", "suchen.mobile.de", "m.mobile.de"]);
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

const cleanText = (value, max = 12_000) => String(value ?? "")
  .replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
  .replace(/\s+/g, " ").trim().slice(0, max) || null;

export function parseMobileDeUrl(value) {
  let url;
  try { url = new URL(String(value || "").trim()); } catch { return null; }
  if (url.protocol !== "https:" || !MOBILE_DE_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) return null;
  const sourceListingId = url.searchParams.get("id") || url.pathname.match(/(?:\/id\/|\/)(\d{6,})(?:[/?]|$)/)?.[1] || null;
  const canonical = new URL(url.origin + url.pathname);
  if (sourceListingId) canonical.searchParams.set("id", sourceListingId);
  return { source: "mobile.de", sourceListingId, sourceUrl: canonical.toString() };
}

function parseJsonScripts(html) {
  const values = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { values.push(JSON.parse(match[1])); } catch { /* malformed third-party data */ }
  }
  return values.flatMap((item) => Array.isArray(item) ? item : item?.["@graph"] || [item]);
}

function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  return cleanText(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean), 2_000);
}

function pickObject(value, predicate, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  if (predicate(value)) return value;
  for (const child of Object.values(value)) {
    const found = Array.isArray(child)
      ? child.map((item) => pickObject(item, predicate, seen)).find(Boolean)
      : pickObject(child, predicate, seen);
    if (found) return found;
  }
  return null;
}

function first(value) { return Array.isArray(value) ? value[0] : value; }
function stringValue(value) { return typeof value === "object" && value ? value.name || value.value || value.valueReference?.name : value; }
function textMatch(text, pattern) { return cleanText(text.match(pattern)?.[1], 500); }
function boolMatch(text, positive, negative) {
  if (negative.test(text)) return false;
  if (positive.test(text)) return true;
  return null;
}

export function parseMobileDeListing(html, urlInfo, now = new Date().toISOString()) {
  const documents = parseJsonScripts(html);
  const product = documents.find((item) => /Vehicle|Car|Product/i.test(String(item?.["@type"] || "")))
    || pickObject(documents, (item) => /Vehicle|Car|Product/i.test(String(item?.["@type"] || ""))) || {};
  const offer = first(product.offers) || {};
  const seller = first(product.seller) || offer.seller || {};
  const address = seller.address || product.location?.address || {};
  const title = cleanText(product.name || meta(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1], 500);
  const description = cleanText(product.description || meta(html, "og:description"), 12_000);
  const pageText = cleanText(html, 200_000) || "";
  const additional = Array.isArray(product.additionalProperty) ? Object.fromEntries(product.additionalProperty.map((item) => [String(item.name || item.propertyID || "").toLowerCase(), stringValue(item.value)])) : {};
  const getAdditional = (...keys) => Object.entries(additional).find(([name]) => keys.some((key) => name.includes(key)))?.[1];
  const powerText = cleanText(getAdditional("leistung", "power") || textMatch(pageText, /(\d+[.,]?\d*\s*kW\s*\(?\s*\d+\s*(?:PS|CV)\s*\)?)/i));
  const powerKw = textMatch(powerText || "", /(\d+[.,]?\d*)\s*kW/i);
  const powerCv = textMatch(powerText || "", /(\d+)\s*(?:PS|CV)/i);
  const registration = cleanText(product.vehicleModelDate || product.dateVehicleFirstRegistered || getAdditional("erstzulassung", "first registration") || textMatch(pageText, /(?:Erstzulassung|EZ)\s*[:]?\s*(\d{1,2}[/.]\d{4}|\d{4})/i));
  const mileage = stringValue(product.mileageFromOdometer) || getAdditional("kilometer", "mileage") || textMatch(pageText, /(\d[\d.,\s]*\s*km)\b/i);
  const fuel = product.fuelType || getAdditional("kraftstoff", "fuel") || textMatch(pageText, /(?:Kraftstoffart|Kraftstoff)\s*[:]?\s*([A-Za-zÄÖÜäöüß -]{3,40})/i) || textMatch(pageText, /\b(Elektro|Diesel|Benzin|Hybrid|Autogas|Erdgas)\b/i);
  const transmission = product.vehicleTransmission || getAdditional("getriebe", "transmission") || textMatch(pageText, /(?:Getriebe)\s*[:]?\s*([A-Za-zÄÖÜäöüß -]{3,40})/i);
  const price = offer.price || meta(html, "product:price:amount") || textMatch(pageText, /(\d[\d.\s]*(?:,\d{2})?\s*€)/);
  const imageValues = [product.image, meta(html, "og:image")].flat().map((item) => item && typeof item === "object" ? item.url || item.contentUrl : item).filter(Boolean);
  const vatDeductible = boolMatch(pageText, /MwSt\.?\s*ausweisbar|VAT\s*deductible|IVA\s*deducible/i, /MwSt\.?\s*nicht\s*ausweisbar/i);
  const accidentFree = boolMatch(pageText, /\bunfallfrei\b|accident[- ]free/i, /Unfallfahrzeug|Unfallschaden|accident vehicle/i);
  const damagedVehicle = boolMatch(pageText, /Beschädigtes Fahrzeug|Unfallfahrzeug|nicht fahrbereit|Motorschaden|Getriebeschaden/i, /Unbeschädigt|keine bekannten Schäden/i);
  const roadworthy = boolMatch(pageText, /\bfahrbereit\b|roadworthy/i, /nicht fahrbereit/i);
  const fullServiceHistory = boolMatch(pageText, /scheckheftgepflegt|lückenlos.*service/i, /nicht scheckheftgepflegt/i);
  const cocMentioned = boolMatch(pageText, /\bCoC\b|Certificate of Conformity|EG-Übereinstimmungsbescheinigung/i, /kein(?:e|en)?\s+CoC/i);
  const equipment = Array.isArray(product.additionalProperty)
    ? product.additionalProperty.filter((item) => /ausstattung|equipment|feature/i.test(String(item.name || ""))).flatMap((item) => String(item.value || "").split(/[,;|]/)).map((item) => cleanText(item, 150)).filter(Boolean)
    : [];
  const raw = {
    title,
    structuredType: cleanText(product["@type"], 100),
    parsedFrom: documents.length ? "json-ld+metadata" : "metadata+text",
    structuredDocuments: documents.length,
  };
  const directFields = Object.entries({ title, mileage, fuel, transmission, price, powerKw, powerCv, firstRegistration: registration, description, vatDeductible, accidentFree, damagedVehicle, roadworthy, fullServiceHistory, cocMentioned }).filter(([, value]) => value !== null && value !== undefined && value !== "").map(([key]) => key);
  return normalizeVehicle({
    source: "mobile.de", sourceListingId: urlInfo.sourceListingId, sourceUrl: urlInfo.sourceUrl,
    importedAt: now, lastCheckedAt: now, title,
    make: cleanText(product.brand?.name || product.brand, 100),
    model: cleanText(product.model || product.vehicleModel, 150),
    variant: cleanText(product.vehicleConfiguration || getAdditional("modell", "variant"), 200),
    bodyType: cleanText(product.bodyType || getAdditional("fahrzeugtyp", "body"), 100),
    firstRegistration: registration, mileageKm: mileage, fuelType: fuel, transmission,
    powerKw, powerCv, engineCc: product.vehicleEngine?.engineDisplacement?.value || getAdditional("hubraum"),
    price, currency: offer.priceCurrency || "EUR", priceGross: offer.priceSpecification?.price || null,
    priceNet: textMatch(pageText, /(?:Netto|net)\s*[:]?\s*(\d[\d.\s]*(?:,\d{2})?\s*€)/i), vatDeductible,
    co2: getAdditional("co₂", "co2"), euroNorm: getAdditional("schadstoffklasse", "euro"), consumption: getAdditional("verbrauch", "consumption"),
    color: product.color || getAdditional("farbe", "color"), previousOwners: getAdditional("fahrzeughalter", "owners"),
    accidentFree, damagedVehicle, roadworthy, fullServiceHistory, serviceHistory: fullServiceHistory,
    huUntil: getAdditional("hu", "tüv"), warranty: getAdditional("garantie", "warranty"), cocMentioned,
    sellerType: /dealer|händler|autohaus/i.test(`${seller["@type"] || ""} ${seller.name || ""}`) ? "dealer" : /person|privat/i.test(`${seller["@type"] || ""} ${seller.name || ""}`) ? "private" : seller.name ? "unknown" : null,
    sellerName: cleanText(seller.name, 200), company: cleanText(seller.legalName || seller.name, 200),
    city: cleanText(address.addressLocality, 150), postalCode: cleanText(address.postalCode, 30), country: cleanText(address.addressCountry || "Alemania", 80),
    phone: cleanText(seller.telephone, 80), dealerRating: seller.aggregateRating?.ratingValue,
    description, equipment, images: imageValues, rawSourceData: raw,
  }, { source: "mobile.de", sourceListingId: urlInfo.sourceListingId, sourceUrl: urlInfo.sourceUrl, importedAt: now, lastCheckedAt: now, directFields });
}

async function readLimited(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw Object.assign(new Error("response_too_large"), { code: "response_too_large" });
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_BYTES) { await reader.cancel(); throw Object.assign(new Error("response_too_large"), { code: "response_too_large" }); }
    chunks.push(value);
  }
  const merged = new Uint8Array(bytes); let offset = 0;
  chunks.forEach((chunk) => { merged.set(chunk, offset); offset += chunk.byteLength; });
  return new TextDecoder().decode(merged);
}

export async function fetchMobileDeListing(value, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const initial = parseMobileDeUrl(value);
  if (!initial) throw Object.assign(new Error("invalid_mobile_de_url"), { code: "invalid_url" });
  let current = initial.sourceUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, { method: "GET", redirect: "manual", signal: controller.signal, headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "de-DE,de;q=0.9,en;q=0.7", "User-Agent": "IvanImports/1.0 (+https://ivanimports.es; public-listing-import)" } });
    } catch (error) {
      const code = error?.name === "AbortError" ? "provider_timeout" : "provider_unavailable";
      throw Object.assign(new Error(code), { code });
    } finally { clearTimeout(timer); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = new URL(response.headers.get("location") || "", current);
      if (!parseMobileDeUrl(next.toString())) throw Object.assign(new Error("unsafe_redirect"), { code: "unsafe_redirect" });
      current = next.toString();
      continue;
    }
    if (response.status === 403 || response.status === 429) throw Object.assign(new Error("provider_blocked"), { code: "provider_blocked", status: response.status });
    if (response.status === 404 || response.status === 410) throw Object.assign(new Error("listing_unavailable"), { code: "listing_unavailable", status: response.status });
    if (!response.ok) throw Object.assign(new Error("provider_unavailable"), { code: "provider_unavailable", status: response.status });
    if (!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") || "")) throw Object.assign(new Error("invalid_content_type"), { code: "invalid_content_type" });
    const html = await readLimited(response);
    const finalInfo = parseMobileDeUrl(current);
    const vehicle = parseMobileDeListing(html, { ...finalInfo, sourceListingId: finalInfo.sourceListingId || initial.sourceListingId });
    if (!vehicle.title && vehicle.price === null && !vehicle.make && !vehicle.model) throw Object.assign(new Error("parse_failed"), { code: "parse_failed" });
    return vehicle;
  }
  throw Object.assign(new Error("too_many_redirects"), { code: "too_many_redirects" });
}

export const mobileDeProvider = Object.freeze({
  id: "mobile.de",
  canHandle: (url) => Boolean(parseMobileDeUrl(url)),
  extractListingId: (url) => parseMobileDeUrl(url)?.sourceListingId || null,
  fetchListing: fetchMobileDeListing,
  parseListing: parseMobileDeListing,
  normalize: normalizeVehicle,
});
