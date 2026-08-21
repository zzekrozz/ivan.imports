import assert from "node:assert/strict";
import test from "node:test";
import {
  airportRowsToRecords,
  findNearbyAirports,
  haversineDistanceKm,
  isCommercialPassengerAirport,
} from "../api/_flight/airport-search.js";
import { normalizeGeocoderResults, normalizeLocationQuery } from "../api/_flight/geocoder.js";
import { buildFlightSearchUrl } from "../api/_flight/skyscanner.js";
import { createFlightPlannerHandler } from "../api/flight-planner.js";
import { buildFlightRedirectPath, iataFromAirportInput } from "../assets/academy/private/flight-planner.js";

test("Haversine calcula una distancia geográfica conocida", () => {
  const distance = haversineDistanceKm(
    { latitude: 40.4168, longitude: -3.7038 },
    { latitude: 41.3874, longitude: 2.1686 },
  );
  assert.ok(distance > 500 && distance < 510);
});

test("los aeropuertos comerciales se filtran, ordenan y limitan por distancia", () => {
  const airports = [
    { name: "Lejano", iata: "BBB", latitude: 1, longitude: 0, type: "large_airport", scheduledService: "yes" },
    { name: "Cercano", iata: "AAA", latitude: 0.1, longitude: 0, type: "medium_airport", scheduledService: "yes" },
    { name: "Sin IATA", iata: "", latitude: 0.01, longitude: 0, type: "large_airport", scheduledService: "yes" },
    { name: "Privado", iata: "CCC", latitude: 0.02, longitude: 0, type: "small_airport", scheduledService: "no" },
  ];
  const result = findNearbyAirports({ latitude: 0, longitude: 0 }, { airports, limit: 3, maximumDistanceKm: 300 });
  assert.deepEqual(result.map((airport) => airport.iata), ["AAA", "BBB"]);
  assert.ok(result[0].distanceKm < result[1].distanceKm);
  assert.equal(isCommercialPassengerAirport(airports[2]), false);
  assert.equal(isCommercialPassengerAirport(airports[3]), false);
});

test("el dataset local solo materializa aeropuertos con servicio comercial e IATA", () => {
  const airports = airportRowsToRecords();
  assert.ok(airports.length >= 450);
  assert.ok(airports.every(isCommercialPassengerAirport));
  assert.ok(airports.some((airport) => airport.iata === "AGP"));
  assert.ok(airports.some((airport) => airport.iata === "HAJ"));
});

test("Göttingen devuelve tres candidatos europeos sin limitar por frontera", () => {
  const result = findNearbyAirports({ latitude: 51.5328, longitude: 9.9352 });
  assert.equal(result.length, 3);
  assert.ok(result.every((airport, index) => index === 0 || result[index - 1].distanceKm <= airport.distanceKm));
  assert.ok(result.some((airport) => airport.country === "Germany"));
});

test("el builder oficial usa day-view con fecha y mercado español", () => {
  const url = new URL(buildFlightSearchUrl({ originIata: "AGP", destinationIata: "HAJ", departureDate: "2026-09-10", mediaPartnerId: "12345" }));
  assert.equal(url.pathname, "/g/referrals/v1/flights/day-view/");
  assert.equal(url.searchParams.get("origin"), "agp");
  assert.equal(url.searchParams.get("destination"), "haj");
  assert.equal(url.searchParams.get("outboundDate"), "2026-09-10");
  assert.equal(url.searchParams.get("market"), "ES");
  assert.equal(url.searchParams.get("locale"), "es-ES");
  assert.equal(url.searchParams.get("currency"), "EUR");
  assert.equal(url.searchParams.get("mediaPartnerId"), "12345");
});

test("sin fecha usa calendar-month-view y sin partner degrada a la portada estable", () => {
  const configured = new URL(buildFlightSearchUrl({ originIata: "AGP", destinationIata: "FRA", mediaPartnerId: "partner" }));
  assert.equal(configured.pathname, "/g/referrals/v1/flights/calendar-month-view/");
  assert.equal(configured.searchParams.has("outboundDate"), false);
  assert.equal(buildFlightSearchUrl({ originIata: "AGP", destinationIata: "FRA" }), "https://www.skyscanner.es/");
});

test("la abstracción cliente acepta selector o IATA y nunca una URL arbitraria", () => {
  assert.equal(iataFromAirportInput("Málaga (AGP)"), "AGP");
  assert.equal(iataFromAirportInput("mad"), "MAD");
  assert.equal(iataFromAirportInput("Málaga"), "");
  assert.match(buildFlightRedirectPath({ originIata: "AGP", destinationIata: "HAJ", departureDate: "2026-09-10" }), /^\/api\/flight-planner\?/);
  assert.equal(buildFlightRedirectPath({ originIata: "https://example.com", destinationIata: "HAJ" }), "");
});

test("el geocoder conserva caracteres especiales y elimina resultados duplicados", () => {
  assert.equal(normalizeLocationQuery("  München\n Alemania "), "München Alemania");
  const result = normalizeGeocoderResults([
    { place_id: 1, display_name: "Köln, Deutschland", lat: "50.94", lon: "6.95", addresstype: "city", address: { city: "Köln", country: "Deutschland", country_code: "de" } },
    { place_id: 2, display_name: "Colonia duplicada", lat: "50.9401", lon: "6.9501", addresstype: "city" },
    { place_id: 3, display_name: "Liège, Belgique", lat: "50.63", lon: "5.57", addresstype: "city" },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].city, "Köln");
  assert.equal(result[0].countryCode, "DE");
});

test("una localidad vacía no llama al servicio externo", async () => {
  let calls = 0;
  const handler = createFlightPlannerHandler({ geocodeImpl: async () => { calls += 1; return []; } });
  const response = await handler(new Request("https://ivanimports.es/api/flight-planner?action=location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: " " }),
  }));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("la búsqueda usa caché y adjunta aeropuertos a cada localidad", async () => {
  let calls = 0;
  const handler = createFlightPlannerHandler({
    geocodeImpl: async () => {
      calls += 1;
      return [{ id: "goe", displayName: "Göttingen, Alemania", latitude: 51.5328, longitude: 9.9352, city: "Göttingen", country: "Alemania", countryCode: "DE" }];
    },
  });
  const request = () => new Request("https://ivanimports.es/api/flight-planner?action=location", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.10" },
    body: JSON.stringify({ query: "Göttingen, Alemania" }),
  });
  const first = await handler(request());
  const second = await handler(request());
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(calls, 1);
  const payload = await first.json();
  assert.equal(payload.candidates[0].airports.length, 3);
  assert.match(payload.attribution, /OpenStreetMap/);
});

test("un error de geocodificación devuelve degradación segura", async () => {
  const handler = createFlightPlannerHandler({ geocodeImpl: async () => { throw new Error("offline"); } });
  const response = await handler(new Request("https://ivanimports.es/api/flight-planner?action=location", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "Aachen" }),
  }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /coste del vuelo manualmente/);
});

test("el redirect server-side valida IATA y aplica el partner configurado", async () => {
  const handler = createFlightPlannerHandler({ env: { SKYSCANNER_MEDIA_PARTNER_ID: "ivan123" } });
  const response = await handler(new Request("https://ivanimports.es/api/flight-planner?action=redirect&origin=AGP&destination=HAJ&date=2026-09-10"));
  assert.equal(response.status, 302);
  const destination = new URL(response.headers.get("location"));
  assert.equal(destination.searchParams.get("mediaPartnerId"), "ivan123");
  assert.equal(destination.searchParams.get("outboundDate"), "2026-09-10");
});
