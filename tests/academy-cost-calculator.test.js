import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { COST_CALCULATOR_VERSION, COST_EXPENSE_FIELDS, COST_EXPENSE_SECTIONS, calculateCostOperation, calculateFuel, costCalculatorHasData, createEmptyCostCalculatorState, fuelCostInputValue, normalizeCostCalculatorState, parseCostNumber, sanitizeDecimalInput } from "../assets/academy/private/cost-calculator.js";

const root = new URL("../", import.meta.url);
function calculator({ expenses = {}, vehicle = {}, vatEnabled = false, vat21 = {}, marketScenarios = [], resultLabel = "Beneficio estimado", fuel = {}, marketValue = "", desiredProfit = "", askingPrice = "" } = {}) { return normalizeCostCalculatorState({ ...createEmptyCostCalculatorState(), expenses, vehicle: { ...createEmptyCostCalculatorState().vehicle, ...vehicle }, vatEnabled, vat21, marketScenarios, resultLabel, fuel: { ...createEmptyCostCalculatorState().fuel, ...fuel }, marketValue, desiredProfit, askingPrice }); }

test("la definición v3 conserva categorías, IEDMT/Modelo 576 y añade campos Copart y honorarios", () => {
  assert.equal(COST_CALCULATOR_VERSION, 3);
  assert.deepEqual(COST_EXPENSE_SECTIONS.map((section) => section.id), ["vehicle", "travel", "administration", "upkeep"]);
  for (const id of ["copartBidMax", "copartWithFees", "fees", "iedmt", "fuelCost"]) assert.ok(COST_EXPENSE_FIELDS.some((item) => item.id === id));
  assert.match(COST_EXPENSE_FIELDS.find((field) => field.id === "iedmt").label, /IEDMT \/ Modelo 576/);
});

test("la calculadora vacía permite empezar sin vehículo y sin costes", () => {
  const result = calculateCostOperation(calculator());
  assert.equal(result.totalCost, 0); assert.equal(result.vatAmount, 0); assert.equal(result.scenarios.length, 0); assert.equal(result.marketProfit, null);
});

test("la puja máxima Copart es solo informativa y jamás se suma", () => {
  const result = calculateCostOperation(calculator({ expenses: { copartBidMax: "14700", copartWithFees: "15725", fees: "2000", travelOther: "1000" } }));
  assert.equal(result.copartBidMax, 14700); assert.equal(result.acquisitionCost, 15725); assert.equal(result.totalCost, 18725); assert.equal(result.fieldAmounts.copartBidMax, 0);
});

test("Copart con comisión prevalece sobre una adquisición genérica duplicada", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 14700, copartWithFees: 15725 } }));
  assert.equal(result.totalCost, 15725); assert.equal(result.categoryTotals.vehicle, 15725);
});

test("honorarios y base de IVA seleccionable reproducen la operación real", () => {
  const result = calculateCostOperation(calculator({ expenses: { copartWithFees: 15725, fees: 2000, vehicleTransport: 1247, administrationOther: 1593 }, vatEnabled: true, vat21: { fees: true, vehicleTransport: true } }));
  assert.equal(result.costBase, 20565); assert.equal(result.vatBase, 3247); assert.equal(result.vatAmount, 681.87); assert.equal(result.totalCost, 21246.87);
});

test("activar y desactivar el IVA no acumula impuesto sobre impuesto", () => {
  const state = calculator({ expenses: { fees: 2000 }, vatEnabled: true, vat21: { fees: true } });
  assert.equal(calculateCostOperation(state).totalCost, 2420);
  state.vatEnabled = false; assert.equal(calculateCostOperation(state).totalCost, 2000);
  state.vatEnabled = true; assert.equal(calculateCostOperation(state).totalCost, 2420);
});

test("escenarios calculan beneficio, ahorro o margen sin cambiar la fórmula", () => {
  const result = calculateCostOperation(calculator({ expenses: { copartWithFees: 15725, fees: 2000, vehicleTransport: 1247, administrationOther: 1593 }, vatEnabled: true, vat21: { fees: true, vehicleTransport: true }, resultLabel: "Margen estimado", marketScenarios: [{ id: "one", label: "Venta rápida", priceSpain: "27000" }, { id: "two", label: "Precio medio", priceSpain: "28000" }, { id: "three", label: "", priceSpain: "29000" }] }));
  assert.deepEqual(result.scenarios.map(({ price, result: margin }) => [price, margin]), [[27000, 5753.13], [28000, 6753.13], [29000, 7753.13]]);
});

test("los resultados negativos y cero se conservan", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 25000 }, marketScenarios: [{ id: "negative", priceSpain: "23000" }, { id: "zero", priceSpain: "25000" }] }));
  assert.deepEqual(result.scenarios.map((item) => item.result), [-2000, 0]);
});

test("vehículo, IVA y escenarios se persisten y v2 se migra sin perder gastos", () => {
  const state = calculator({ vehicle: { make: "BMW", model: "318i", mileage: "48127" }, expenses: { copartBidMax: 14700, copartWithFees: 15725, fees: 2000 }, vatEnabled: true, vat21: { fees: true }, marketScenarios: [{ id: "x", label: "Media", priceSpain: 27000 }] });
  assert.deepEqual(normalizeCostCalculatorState(JSON.parse(JSON.stringify(state))), state);
  const migrated = normalizeCostCalculatorState({ version: 2, expenses: { purchase: "3000", fuel: "240" }, fuel: { kilometres: "2000" } });
  assert.equal(migrated.expenses.purchase, "3000"); assert.equal(migrated.expenses.fuelCost, "240");
});

test("combustible conserva cálculo auxiliar y no acepta importes negativos", () => {
  assert.equal(calculateFuel({ kilometres: "2000", consumption: "7,5", pricePerLitre: "1,60" }).cost, 240);
  assert.equal(fuelCostInputValue({ kilometres: 2000, consumption: 7.5, pricePerLitre: 1.6 }), "240");
  assert.equal(parseCostNumber("3.000,50 €"), 3000.5); assert.equal(parseCostNumber("-100"), 0); assert.equal(sanitizeDecimalInput("-100"), "");
});

test("el estado con datos descriptivos también se considera guardable", () => {
  assert.equal(costCalculatorHasData(createEmptyCostCalculatorState()), false);
  assert.equal(costCalculatorHasData(calculator({ vehicle: { make: "BMW" } })), true);
});

test("la interfaz usa una única fuente de cálculo, informe A4 y controles de escenarios", async () => {
  const source = await readFile(new URL("assets/academy/app.js", root), "utf8"); const calculation = await readFile(new URL("assets/academy/private/cost-calculator.js", root), "utf8");
  assert.match(source, /data-calculator-version="3"/); assert.match(source, /renderCostReport\(data, model\)/); assert.match(source, /data-cost-vat-field/); assert.match(source, /data-cost-scenario-field/); assert.match(source, /Generar informe PDF/); assert.match(calculation, /Copart · Puja máxima/);
  assert.doesNotMatch(source, /html2canvas/);
});

test("la página SEO mantiene la ruta de la herramienta", async () => {
  const html = await readFile(new URL("herramientas/calculadora-coste-importacion/index.html", root), "utf8");
  assert.match(html, /<h1>Calculadora de coste de importación de coches<\/h1>/); assert.match(html, /herramientas\/calculadora-coste-importacion/);
});
