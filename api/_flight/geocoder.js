const PLACE_TYPES = new Set(["city", "town", "village", "municipality", "hamlet", "locality"]);

export function normalizeLocationQuery(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function normalizeGeocoderResults(payload, { maximum = 5 } = {}) {
  const source = Array.isArray(payload) ? payload : [];
  const preferred = source.filter((item) => PLACE_TYPES.has(String(item?.addresstype || item?.type || "").toLowerCase()));
  const candidates = preferred.length ? preferred : source;
  const seen = new Set();
  return candidates.flatMap((item) => {
    const latitude = Number(item?.lat);
    const longitude = Number(item?.lon);
    const displayName = String(item?.display_name || "").trim().slice(0, 300);
    if (!displayName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const key = `${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: String(item?.place_id || key).slice(0, 80),
      displayName,
      latitude,
      longitude,
      city: String(item?.address?.city || item?.address?.town || item?.address?.village || item?.name || "").slice(0, 120),
      country: String(item?.address?.country || "").slice(0, 120),
      countryCode: String(item?.address?.country_code || "").toUpperCase().slice(0, 2),
    }];
  }).slice(0, Math.max(1, Math.min(5, Number(maximum) || 5)));
}

export async function geocodeLocation(query, {
  fetchImpl = fetch,
  baseUrl = "https://nominatim.openstreetmap.org",
  contactEmail = "",
} = {}) {
  const normalized = normalizeLocationQuery(query);
  if (normalized.length < 2) return [];
  const endpoint = new URL("/search", baseUrl);
  endpoint.searchParams.set("q", normalized);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("limit", "8");
  endpoint.searchParams.set("accept-language", "es");
  if (contactEmail) endpoint.searchParams.set("email", contactEmail);
  const response = await fetchImpl(endpoint, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
      "User-Agent": `IvanImports-FlightPlanner/1.0 (${contactEmail || "https://ivanimports.es"})`,
    },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw Object.assign(new Error("geocoder_unavailable"), { status: response.status });
  return normalizeGeocoderResults(await response.json());
}
