import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { enrichReport } from "../api/_ivi/engine.js";
import { normalizeOneAutoResponse } from "../api/_ivi/schema.js";

const payload = JSON.parse(await readFile(new URL("fixtures/one-auto/build-sheet-ready.json", import.meta.url), "utf8"));
const vehicle = normalizeOneAutoResponse(payload, { vin: "WVWZZZ1JZXW000001" });
const base = { id: "IVI-2026-AABBCCDD", status: "READY", inputs: { vin: "WVWZZZ1JZXW000001", purchaseCountry: "Alemania", mileageKm: 85000, purchasePrice: 24900, currency: "EUR", modifications: { towbar: "yes", wheels: "yes", suspension: "unknown", exhaust: "unknown", lpg: "unknown", camper: "unknown", lighting: "unknown", bodyKit: "unknown", power: "unknown", other: "unknown" } }, vehicle };

test("genera findings de bola, llantas, homologación y CO₂", () => {
  const report = enrichReport(base);
  const codes = new Set(report.findings.map((item) => item.code));
  for (const code of ["FACTORY_TOWBAR_NOT_CONFIRMED", "WHEEL_MODIFICATION_DECLARED", "HOMOLOGATION_NOT_CONFIRMED", "CO2_NOT_CONFIRMED", "DOCUMENT_REVIEW_RECOMMENDED"]) assert.equal(codes.has(code), true, code);
  assert.equal(report.verdict.label, "Información pendiente");
});

test("las preguntas al vendedor son rule-based y no duplicadas", () => {
  const report = enrichReport(base);
  assert.equal(report.sellerQuestions.some((question) => /bola/i.test(question)), true);
  assert.equal(new Set(report.sellerQuestions).size, report.sellerQuestions.length);
});

test("el motor de costes no inventa IEDMT ni total", () => {
  const report = enrichReport(base);
  assert.equal(report.registration.items.find((item) => item.code === "vehicle").amount, 24900);
  assert.equal(report.registration.items.find((item) => item.code === "iedmt").status, "pending");
  assert.equal(report.registration.total.amount, null);
});

test("detecta una diferencia explícita entre bola de fábrica y estado actual", () => {
  const withFactoryTowbar = structuredClone(vehicle);
  withFactoryTowbar.equipment.relevant.towbar.value = true;
  const report = enrichReport({ ...base, vehicle: withFactoryTowbar, inputs: { ...base.inputs, modifications: { ...base.inputs.modifications, towbar: "no" } } });
  assert.equal(report.findings.some((item) => item.code === "FACTORY_TOWBAR_CURRENTLY_NOT_DECLARED"), true);
});
