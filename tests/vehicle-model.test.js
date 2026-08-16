import test from "node:test";
import assert from "node:assert/strict";
import { applyVehicleEdits, duplicateVehicle, findDuplicateVehicle, mergeVehicleImport, normalizeFirstRegistration, normalizeFuelType, normalizeMileage, normalizeTransmission, normalizeVehicle, removeVehicle, upsertVehicle } from "../assets/academy/private/vehicle-model.js";

test("normaliza números, fechas y enums sin inventar ausencias", () => {
  assert.equal(normalizeMileage("145.000 km"), 145000);
  assert.equal(normalizeMileage("145,000 km"), 145000);
  assert.equal(normalizeFirstRegistration("05/2017"), "2017-05");
  assert.equal(normalizeFirstRegistration("13/2017"), "2017");
  assert.equal(normalizeFuelType("Benzin"), "petrol");
  assert.equal(normalizeFuelType("Plug-in-Hybrid"), "plug_in_hybrid");
  assert.equal(normalizeTransmission("Automatik"), "automatic");
  const vehicle = normalizeVehicle({ powerKw: 110 });
  assert.equal(vehicle.powerCv, 150);
  assert.equal(vehicle.cocMentioned, null);
  assert.equal(vehicle.accidentFree, null);
  assert.equal(normalizeVehicle({ country: "DE" }).country, "Alemania");
});

test("detecta duplicados por fuente e id aunque cambie el tracking", () => {
  const existing = normalizeVehicle({ source: "mobile.de", sourceListingId: "459800097", sourceUrl: "https://www.mobile.de/a?id=459800097" });
  const candidate = normalizeVehicle({ source: "mobile.de", sourceListingId: "459800097", sourceUrl: "https://www.mobile.de/a?id=459800097&utm_source=x" });
  assert.equal(findDuplicateVehicle([existing], candidate)?.id, existing.id);
});

test("almacenamiento puro crea, actualiza, elimina y duplica", () => {
  const source = normalizeVehicle({ make: "BMW", model: "320d", price: 12900 });
  let list = upsertVehicle([], source);
  assert.equal(list.length, 1);
  list = upsertVehicle(list, { ...source, price: 11900 });
  assert.equal(list[0].price, 11900);
  const copy = duplicateVehicle(source);
  list = upsertVehicle(list, copy);
  assert.equal(list.length, 2);
  assert.equal(copy.source, "manual");
  list = removeVehicle(list, source.id);
  assert.deepEqual(list.map((vehicle) => vehicle.id), [copy.id]);
});

test("actualización remota conserva overrides manuales y añade historial de precio", () => {
  const imported = normalizeVehicle({ source: "mobile.de", sourceListingId: "1", make: "BMW", price: 12900 });
  const edited = applyVehicleEdits(imported, { make: "BMW corregido" });
  const updated = mergeVehicleImport(edited, normalizeVehicle({ source: "mobile.de", sourceListingId: "1", make: "BMW AG", price: 11900 }));
  assert.equal(updated.make, "BMW corregido");
  assert.equal(updated.price, 11900);
  assert.deepEqual(updated.priceHistory.map((entry) => entry.price), [12900, 11900]);
});
