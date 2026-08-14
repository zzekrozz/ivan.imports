import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNumberFieldValue } from "../assets/academy/private/form-values.js";

test("conserva vacío, cero, decimales y números grandes", () => {
  assert.equal(normalizeNumberFieldValue(""), "");
  assert.equal(normalizeNumberFieldValue("0", { min: "0" }), 0);
  assert.equal(normalizeNumberFieldValue("30000.50", { min: "0" }), 30000.5);
  assert.equal(normalizeNumberFieldValue("999999999", { min: "0" }), 999999999);
});

test("descarta valores no numéricos y respeta los límites HTML", () => {
  assert.equal(normalizeNumberFieldValue("no-es-un-numero"), "");
  assert.equal(normalizeNumberFieldValue("-100", { min: "0" }), 0);
  assert.equal(normalizeNumberFieldValue("250", { min: "0", max: "200" }), 200);
  assert.equal(normalizeNumberFieldValue("1890", { min: "1900" }), 1900);
});
