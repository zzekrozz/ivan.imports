import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { meaningfulVehicleData, normalizeOneAutoIdentityResponse, normalizeOneAutoResponse } from "../api/_ivi/schema.js";

const ready = JSON.parse(await readFile(new URL("fixtures/one-auto/build-sheet-ready.json", import.meta.url), "utf8"));
const partial = JSON.parse(await readFile(new URL("fixtures/one-auto/build-sheet-partial.json", import.meta.url), "utf8"));
const identity = JSON.parse(await readFile(new URL("fixtures/one-auto/vin-decoder-ready.json", import.meta.url), "utf8"));

test("normaliza One Auto hacia el modelo IVI con procedencia", () => {
  const vehicle = normalizeOneAutoResponse(ready, { vin: "WVWZZZ1JZXW000001", retrievedAt: "2026-08-17T12:00:00.000Z" });
  assert.equal(vehicle.identity.manufacturer.value, "Audi");
  assert.equal(vehicle.identity.manufacturer.source, "ONE_AUTO");
  assert.equal(vehicle.technical.powerKw.value, 150);
  assert.equal(vehicle.equipment.highlights.some((item) => /360/i.test(item)), true);
  assert.equal(vehicle.sources[0].product, "OE_BUILD_SHEET_EUROPE");
});

test("una ausencia de equipamiento sigue siendo unknown, no false", () => {
  const vehicle = normalizeOneAutoResponse(partial, { vin: "WVWZZZ1JZXW000001" });
  assert.equal(vehicle.equipment.relevant.towbar.value, null);
  assert.equal(vehicle.equipment.relevant.towbar.status, "unknown");
  assert.equal(vehicle.equipment.relevant.lighting.value, null);
});

test("una negación explícita del build sheet sí produce false", () => {
  const vehicle = normalizeOneAutoResponse(ready, { vin: "WVWZZZ1JZXW000001" });
  assert.equal(vehicle.equipment.relevant.towbar.value, false);
  assert.equal(vehicle.equipment.relevant.towbar.status, "confirmed");
});

test("detecta respuesta parcial con datos útiles", () => {
  assert.ok(meaningfulVehicleData(normalizeOneAutoResponse(partial, { vin: "WVWZZZ1JZXW000001" })) > 0);
});

test("normaliza VIN Decoder y lo usa como respaldo de identidad del Build Sheet", () => {
  const decoded = normalizeOneAutoIdentityResponse(identity, { retrievedAt: "2026-08-17T12:00:00.000Z" });
  assert.equal(decoded.identity.manufacturer.value, "Volkswagen");
  assert.equal(decoded.identity.model.value, "Golf VIII");
  assert.equal(decoded.identity.modelYear.value, 2021);
  const vehicle = normalizeOneAutoResponse({ success: true, result: { options: [] } }, { vin: "WVWZZZ1JZXW000001", identityPayload: identity });
  assert.equal(vehicle.identity.manufacturer.value, "Volkswagen");
  assert.equal(vehicle.technical.transmission.value, "Automatic");
  assert.equal(vehicle.sources.some((source) => source.product === "VIN_DECODER"), true);
});
