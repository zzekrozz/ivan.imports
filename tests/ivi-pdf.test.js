import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { enrichReport } from "../api/_ivi/engine.js";
import { generateIVIPdf } from "../api/_ivi/pdf.js";
import { normalizeOneAutoResponse } from "../api/_ivi/schema.js";

const payload = JSON.parse(await readFile(new URL("fixtures/one-auto/build-sheet-ready.json", import.meta.url), "utf8"));

test("genera un IVI Vehicle Report multipágina reproducible", () => {
  const vehicle = normalizeOneAutoResponse(payload, { vin: "WVWZZZ1JZXW000001", retrievedAt: "2026-08-17T12:00:00.000Z" });
  const report = enrichReport({ id: "IVI-2026-AABBCCDD", status: "READY", createdAt: "2026-08-17T12:00:00.000Z", inputs: { vin: "WVWZZZ1JZXW000001", purchaseCountry: "Alemania", mileageKm: 85000, purchasePrice: 24900, currency: "EUR", modifications: { towbar: "yes", wheels: "yes" } }, vehicle });
  const first = generateIVIPdf(report);
  const second = generateIVIPdf(report);
  assert.equal(first.subarray(0, 5).toString(), "%PDF-");
  assert.ok(first.length > 5_000);
  assert.deepEqual(first, second);
  assert.match(first.toString("latin1"), /IVI Vehicle Report/);
  assert.match(first.toString("latin1"), /Preguntas para el vendedor/);
});
