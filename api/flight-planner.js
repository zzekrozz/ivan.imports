import { findNearbyAirports } from "./_flight/airport-search.js";
import { geocodeLocation, normalizeLocationQuery } from "./_flight/geocoder.js";
import { buildFlightSearchUrl, normalizeDepartureDate, normalizeIata } from "./_flight/skyscanner.js";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAXIMUM = 8;

function responseHeaders(extra = {}) {
  return {
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, { status, headers: responseHeaders(extraHeaders) });
}

function configuration(env) {
  let nominatimBaseUrl = String(env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");
  try {
    const parsed = new URL(nominatimBaseUrl);
    if (parsed.protocol !== "https:") nominatimBaseUrl = "https://nominatim.openstreetmap.org";
  } catch {
    nominatimBaseUrl = "https://nominatim.openstreetmap.org";
  }
  return {
    nominatimBaseUrl,
    nominatimContactEmail: String(env.NOMINATIM_CONTACT_EMAIL || "").trim().slice(0, 200),
    skyscannerMediaPartnerId: String(env.SKYSCANNER_MEDIA_PARTNER_ID || "").trim().slice(0, 100),
  };
}

function requestIp(request) {
  return String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown")
    .split(",")[0].trim().slice(0, 80);
}

export function createFlightPlannerHandler({
  env = process.env,
  fetchImpl = fetch,
  geocodeImpl = geocodeLocation,
  now = () => Date.now(),
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const cache = new Map();
  const rates = new Map();
  let geocoderQueue = Promise.resolve();
  let lastGeocodeAt = 0;

  function rateAllowed(ip) {
    const timestamp = now();
    const recent = (rates.get(ip) || []).filter((item) => timestamp - item < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAXIMUM) {
      rates.set(ip, recent);
      return false;
    }
    recent.push(timestamp);
    rates.set(ip, recent);
    return true;
  }

  async function geocodeThrottled(query, config) {
    let result;
    let failure;
    geocoderQueue = geocoderQueue.then(async () => {
      const wait = Math.max(0, 1_050 - (now() - lastGeocodeAt));
      if (wait) await sleep(wait);
      lastGeocodeAt = now();
      try {
        result = await geocodeImpl(query, {
          fetchImpl,
          baseUrl: config.nominatimBaseUrl,
          contactEmail: config.nominatimContactEmail,
        });
      } catch (error) {
        failure = error;
      }
    });
    await geocoderQueue;
    if (failure) throw failure;
    return result;
  }

  async function locationSearch(request, config) {
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return json({ success: false, error: "invalid_json", message: "La solicitud no contiene JSON válido." }, 415);
    }
    let body;
    try { body = await request.json(); } catch {
      return json({ success: false, error: "invalid_json", message: "La solicitud no contiene JSON válido." }, 400);
    }
    const query = normalizeLocationQuery(body?.query);
    if (query.length < 2) return json({ success: false, error: "empty_location", message: "Escribe una localidad para buscar aeropuertos." }, 400);
    if (!rateAllowed(requestIp(request))) {
      return json({ success: false, error: "rate_limited", message: "Has realizado varias búsquedas seguidas. Espera un minuto y vuelve a intentarlo." }, 429, { "Retry-After": "60" });
    }

    const cacheKey = query.toLocaleLowerCase("es");
    const cached = cache.get(cacheKey);
    let locations;
    if (cached && now() - cached.savedAt < CACHE_TTL_MS) {
      locations = cached.locations;
    } else {
      locations = await geocodeThrottled(query, config);
      cache.set(cacheKey, { savedAt: now(), locations });
      if (cache.size > 200) cache.delete(cache.keys().next().value);
    }
    const candidates = locations.map((location) => ({
      ...location,
      airports: findNearbyAirports(location),
    }));
    return json({
      success: true,
      query,
      candidates,
      attribution: "Geocodificación © OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    });
  }

  return async function handler(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || (request.method === "POST" ? "location" : "redirect");
    const config = configuration(env);

    if (action === "redirect") {
      if (request.method !== "GET") return json({ success: false, error: "method_not_allowed" }, 405, { Allow: "GET" });
      const originIata = normalizeIata(url.searchParams.get("origin"));
      const destinationIata = normalizeIata(url.searchParams.get("destination"));
      const departureDate = normalizeDepartureDate(url.searchParams.get("date"));
      if (!originIata || !destinationIata) return json({ success: false, error: "invalid_airport", message: "El aeropuerto indicado no es válido." }, 400);
      const destination = buildFlightSearchUrl({
        originIata,
        destinationIata,
        departureDate,
        mediaPartnerId: config.skyscannerMediaPartnerId,
      });
      return new Response(null, { status: 302, headers: responseHeaders({ Location: destination }) });
    }

    if (action !== "location") return json({ success: false, error: "not_found" }, 404);
    if (request.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
    try {
      return await locationSearch(request, config);
    } catch (error) {
      console.warn(JSON.stringify({ event: "flight_planner_geocoder_error", status: Number(error?.status) || null }));
      return json({ success: false, error: "geocoder_unavailable", message: "No hemos podido localizar esa localidad ahora mismo. Puedes seguir introduciendo el coste del vuelo manualmente." }, 503);
    }
  };
}

const handler = createFlightPlannerHandler();

export default {
  fetch(request) {
    return handler(request);
  },
};
