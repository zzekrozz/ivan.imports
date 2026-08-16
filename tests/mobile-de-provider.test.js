import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchMobileDeListing, parseMobileDeListing, parseMobileDeUrl } from "../api/_vehicle/mobile-de.js";

const root = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFile(join(root, "fixtures/mobile-de", name), "utf8");
const info = parseMobileDeUrl("https://suchen.mobile.de/fahrzeuge/details.html?id=459800097&utm_source=test");

test("acepta solo HTTPS y hosts mobile.de, limpia tracking y conserva ID", () => {
  assert.equal(info.sourceListingId, "459800097");
  assert.equal(info.sourceUrl, "https://suchen.mobile.de/fahrzeuge/details.html?id=459800097");
  assert.equal(parseMobileDeUrl("http://mobile.de/?id=1"), null);
  assert.equal(parseMobileDeUrl("https://mobile.de.evil.test/?id=1"), null);
  assert.equal(parseMobileDeUrl("https://127.0.0.1/?id=1"), null);
});

test("parser extrae anuncio diésel automático profesional con IVA", async () => {
  const vehicle = parseMobileDeListing(await fixture("standard-diesel-auto.html"), info, "2026-08-16T10:00:00.000Z");
  assert.equal(vehicle.make, "BMW");
  assert.equal(vehicle.model, "320d");
  assert.equal(vehicle.price, 12900);
  assert.equal(vehicle.mileageKm, 148000);
  assert.equal(vehicle.firstRegistration, "2018-06");
  assert.equal(vehicle.fuelType, "diesel");
  assert.equal(vehicle.transmission, "automatic");
  assert.equal(vehicle.powerKw, 140);
  assert.equal(vehicle.powerCv, 190);
  assert.equal(vehicle.sellerType, "dealer");
  assert.equal(vehicle.city, "München");
  assert.equal(vehicle.country, "Alemania");
  assert.equal(vehicle.vatDeductible, true);
  assert.equal(vehicle.accidentFree, true);
  assert.equal(vehicle.cocMentioned, true);
  assert.deepEqual(vehicle.equipment, ["Navigation", "Sitzheizung", "Tempomat"]);
});

test("parser destaca gasolina manual dañada y no apta para circular", async () => {
  const vehicle = parseMobileDeListing(await fixture("damaged-petrol-manual.html"), info);
  assert.equal(vehicle.fuelType, "petrol");
  assert.equal(vehicle.transmission, "manual");
  assert.equal(vehicle.mileageKm, 145000);
  assert.equal(vehicle.accidentFree, false);
  assert.equal(vehicle.damagedVehicle, true);
  assert.equal(vehicle.roadworthy, false);
  assert.equal(vehicle.sellerType, "private");
});

test("campos faltantes siguen null con fallback de metadata", async () => {
  const vehicle = parseMobileDeListing(await fixture("missing-electric.html"), info);
  assert.equal(vehicle.title, "Renault Zoe Elektro");
  assert.equal(vehicle.price, 7900);
  assert.equal(vehicle.fuelType, "electric");
  assert.equal(vehicle.vatDeductible, null);
  assert.equal(vehicle.cocMentioned, null);
});

test("fetch bloquea redirect fuera de whitelist", async () => {
  const fetchImpl = async () => new Response(null, { status: 302, headers: { location: "https://example.com/private" } });
  await assert.rejects(() => fetchMobileDeListing(info.sourceUrl, { fetchImpl }), (error) => error.code === "unsafe_redirect");
});

test("fetch limita tipo y tamaño de respuesta", async () => {
  const wrongType = async () => new Response("{}", { headers: { "content-type": "application/json" } });
  await assert.rejects(() => fetchMobileDeListing(info.sourceUrl, { fetchImpl: wrongType }), (error) => error.code === "invalid_content_type");
  const oversized = async () => new Response("x", { headers: { "content-type": "text/html", "content-length": "3000000" } });
  await assert.rejects(() => fetchMobileDeListing(info.sourceUrl, { fetchImpl: oversized }), (error) => error.code === "response_too_large");
});
