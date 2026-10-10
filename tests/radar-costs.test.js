import test from "node:test";
import assert from "node:assert/strict";
import { costSummary, COST_ITEMS } from "../assets/radar/cost-model.js";

test("el coche se cuenta una vez y nada se suma sin importe", () => {
  const s = costSummary({ price: 18900, costs: { mode: "truck", items: [{ key: "truck", amount: 850, status: "estimated" }, { key: "itv", status: "pending" }] }, reference: { value: 24900 } });
  assert.equal(s.total, 19750); assert.equal(s.difference, 24900 - 19750); assert.equal(s.partial, true);
});
test("recoger personalmente y contratar camión son escenarios excluyentes", () => {
  const items = [{ key: "truck", amount: 900, status: "estimated" }, { key: "flight", amount: 150, status: "estimated" }, { key: "hotel", amount: 80, status: "estimated" }, { key: "other_transport", amount: 20, status: "estimated" }];
  assert.equal(costSummary({ price: 1000, costs: { mode: "truck", items } }).total, 1000 + 900 + 20);
  assert.equal(costSummary({ price: 1000, costs: { mode: "pickup", items } }).total, 1000 + 150 + 80 + 20);
});
test("no aplicable y desactivado no suman; el modelo 576 es el impuesto de matriculación, no otro gasto", () => {
  const s = costSummary({ price: 0, costs: { items: [{ key: "vat", amount: 500, status: "na" }, { key: "itp", amount: 300, applicable: false, status: "estimated" }, { key: "registration_tax", amount: 700, status: "estimated" }] } });
  assert.equal(s.total, 700);
  assert.equal(COST_ITEMS.filter((i) => /576/.test(i.label)).length, 1);
  assert.equal(COST_ITEMS.some((i) => i.key === "form_576"), false);
});
test("con importes en cero y sin referencia no hay diferencia inventada", () => {
  const s = costSummary({ price: 5000, costs: { items: [{ key: "itv", amount: 0, status: "estimated" }] } });
  assert.equal(s.total, 5000); assert.equal(s.difference, null); assert.equal(s.reference, null);
});
test("los conceptos personalizados pertenecen a su grupo y suman", () => {
  const s = costSummary({ price: 100, costs: { items: [{ key: "custom:parking-1", label: "Parking", group: 1, amount: 25, status: "estimated" }] } });
  assert.equal(s.total, 125); assert.equal(s.subtotals[1], 25);
});
