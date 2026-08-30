import test from "node:test";
import assert from "node:assert/strict";
import { validateAnalysisInput, validateVin } from "../api/_ivi/validation.js";

test("valida VIN estándar y normaliza espacios y minúsculas", () => {
  assert.deepEqual(validateVin(" wvwzzz1jzxw000001 "), { valid: true, vin: "WVWZZZ1JZXW000001", reason: null, warning: null });
});

test("acepta identificadores europeos raros con advertencia sin aceptar símbolos peligrosos", () => {
  assert.equal(validateVin("VF7ABC123456").valid, true);
  assert.equal(validateVin("VF7ABC123456").warning, "non_standard_length");
  assert.equal(validateVin("WVWZZZ<script>").valid, false);
  assert.equal(validateVin("SHORT").valid, false);
});

test("valida los cuatro inputs obligatorios y limita observaciones", () => {
  const result = validateAnalysisInput({ vin: "WVWZZZ1JZXW000001", purchaseCountry: "Alemania", mileageKm: "85 000", purchasePrice: "24900,50", currency: "EUR", notes: "x".repeat(2_000), modifications: { towbar: "yes" } });
  assert.equal(result.valid, true);
  assert.equal(result.value.mileageKm, 85000);
  assert.equal(result.value.purchasePrice, 24900.5);
  assert.equal(result.value.notes.length, 1000);
  assert.equal(result.value.modifications.towbar, "yes");
  assert.equal(result.value.modifications.wheels, "unknown");
});

test("rechaza moneda e importes inválidos", () => {
  const result = validateAnalysisInput({ vin: "WVWZZZ1JZXW000001", purchaseCountry: "", mileageKm: -1, purchasePrice: "no", currency: "USD" });
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), ["currency", "mileageKm", "purchaseCountry", "purchasePrice"]);
});
