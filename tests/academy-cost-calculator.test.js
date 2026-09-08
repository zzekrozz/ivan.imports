import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  COST_CALCULATOR_VERSION,
  COST_EXPENSE_FIELDS,
  COST_EXPENSE_SECTIONS,
  VEHICLE_DATA_FIELDS,
  calculateCostOperation,
  calculateFuel,
  costCalculatorHasData,
  costReportFileName,
  createEmptyCostCalculatorState,
  fuelCostInputValue,
  normalizeCostCalculatorState,
  parseCostNumber,
  sanitizeDecimalInput,
} from "../assets/academy/private/cost-calculator.js";

const root = new URL("../", import.meta.url);

function calculator({ expenses = {}, vehicle = {}, vatEnabled = false, vat21 = {}, marketScenarios = [], resultLabel = "Beneficio estimado", fuel = {} } = {}) {
  const empty = createEmptyCostCalculatorState();
  return normalizeCostCalculatorState({ ...empty, expenses, vehicle: { ...empty.vehicle, ...vehicle }, vatEnabled, vat21, marketScenarios, resultLabel, fuel: { ...empty.fuel, ...fuel } });
}

test("la definición v4 mantiene las cuatro categorías, Copart, honorarios e IEDMT/Modelo 576", () => {
  assert.equal(COST_CALCULATOR_VERSION, 4);
  assert.deepEqual(COST_EXPENSE_SECTIONS.map((section) => section.id), ["vehicle", "travel", "administration", "upkeep"]);
  for (const id of ["copartBidMax", "copartWithFees", "fees", "iedmt", "fuelCost"]) assert.ok(COST_EXPENSE_FIELDS.some((item) => item.id === id));
  assert.match(COST_EXPENSE_FIELDS.find((field) => field.id === "iedmt").label, /IEDMT \/ Modelo 576/);
});

test("la calculadora vacía empieza sin exigir vehículo, costes ni precios en España", () => {
  const result = calculateCostOperation(calculator());
  assert.equal(result.totalCost, 0);
  assert.equal(result.vatAmount, 0);
  assert.equal(result.scenarios.length, 0);
  for (const removed of ["marketProfit", "maximumPurchasePrice", "negotiationAmount", "status"]) assert.equal(Object.hasOwn(result, removed), false);
});

test("la puja máxima Copart es informativa y Copart con comisiones no se duplica", () => {
  const result = calculateCostOperation(calculator({ expenses: { copartBidMax: "14700", copartWithFees: "15725", purchase: "14700", fees: "2000", travelOther: "1000" } }));
  assert.equal(result.copartBidMax, 14700);
  assert.equal(result.acquisitionCost, 15725);
  assert.equal(result.fieldAmounts.copartBidMax, 0);
  assert.equal(result.fieldAmounts.purchase, 0);
  assert.equal(result.totalCost, 18725);
});

test("el precio de adquisición normal vuelve a utilizarse al no existir Copart con comisiones", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 14700, copartWithFees: "" } }));
  assert.equal(result.acquisitionCost, 14700);
  assert.equal(result.categoryTotals.vehicle, 14700);
  assert.equal(result.totalCost, 14700);
});

test("honorarios y base de IVA seleccionable reproducen la operación real", () => {
  const result = calculateCostOperation(calculator({ expenses: { copartWithFees: 15725, fees: 2000, vehicleTransport: 1247, administrationOther: 1593 }, vatEnabled: true, vat21: { fees: true, vehicleTransport: true } }));
  assert.equal(result.costBase, 20565);
  assert.equal(result.vatBase, 3247);
  assert.equal(result.vatAmount, 681.87);
  assert.equal(result.vatTotal, 3928.87);
  assert.equal(result.totalCost, 21246.87);
});

test("activar y desactivar el IVA no acumula impuesto sobre impuesto", () => {
  const state = calculator({ expenses: { fees: 2000 }, vatEnabled: true, vat21: { fees: true } });
  assert.equal(calculateCostOperation(state).totalCost, 2420);
  state.vatEnabled = false;
  assert.equal(calculateCostOperation(state).totalCost, 2000);
  state.vatEnabled = true;
  assert.equal(calculateCostOperation(state).totalCost, 2420);
});

test("beneficio, ahorro y margen son etiquetas de la misma fórmula", () => {
  for (const resultLabel of ["Beneficio estimado", "Ahorro estimado", "Margen estimado"]) {
    const result = calculateCostOperation(calculator({ expenses: { purchase: "21246,87" }, resultLabel, marketScenarios: [{ id: "one", priceSpain: "27000" }] }));
    assert.equal(result.state.resultLabel, resultLabel);
    assert.equal(result.scenarios[0].result, 5753.13);
  }
});

test("un escenario recién añadido y todavía vacío sobrevive a la normalización", () => {
  const state = calculator({ marketScenarios: [{ id: "nuevo", label: "", priceSpain: "" }] });
  assert.deepEqual(state.marketScenarios, [{ id: "nuevo", label: "", priceSpain: "" }]);
  assert.equal(calculateCostOperation(state).scenarios.length, 0);
});

test("los resultados positivos, negativos y cero se conservan", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 25000 }, marketScenarios: [{ id: "positive", priceSpain: 27000 }, { id: "negative", priceSpain: 23000 }, { id: "zero", priceSpain: 25000 }] }));
  assert.deepEqual(result.scenarios.map((item) => item.result), [2000, -2000, 0]);
});

test("la migración v3 conserva vehículo, gastos, IVA, combustible y escenarios y descarta el mercado antiguo", () => {
  const migrated = normalizeCostCalculatorState({
    version: 3,
    vehicle: { make: "BMW", model: "318i", trim: "M Sport" },
    expenses: { copartBidMax: "14700", copartWithFees: "15725", fees: "2000", fuel: "240" },
    vatEnabled: true,
    vat21: { fees: true },
    fuel: { kilometres: "2000", consumption: "7,5", pricePerLitre: "1,6" },
    marketScenarios: [{ id: "x", label: "Media", priceSpain: "27000" }],
    marketValue: "29000",
    desiredProfit: "5000",
    askingPrice: "15000",
  });
  assert.equal(migrated.version, 4);
  assert.equal(migrated.vehicle.trim, "M Sport");
  assert.equal(migrated.expenses.copartWithFees, "15725");
  assert.equal(migrated.expenses.fuelCost, "240");
  assert.equal(migrated.vatEnabled, true);
  assert.equal(migrated.vat21.fees, true);
  assert.equal(migrated.fuel.consumption, "7,5");
  assert.deepEqual(migrated.marketScenarios, [{ id: "x", label: "Media", priceSpain: "27000" }]);
  for (const removed of ["marketValue", "desiredProfit", "askingPrice"]) assert.equal(Object.hasOwn(migrated, removed), false);
});

test("versión/acabado y el ejemplo coherente de motor forman parte de los datos opcionales", () => {
  assert.equal(VEHICLE_DATA_FIELDS.find(({ id }) => id === "trim").label, "Versión / acabado");
  assert.equal(VEHICLE_DATA_FIELDS.find(({ id }) => id === "engine").example, "2.0 gasolina · 1.998 cc");
});

test("combustible conserva el cálculo auxiliar y no acepta importes negativos", () => {
  assert.equal(calculateFuel({ kilometres: "2000", consumption: "7,5", pricePerLitre: "1,60" }).cost, 240);
  assert.equal(fuelCostInputValue({ kilometres: 2000, consumption: 7.5, pricePerLitre: 1.6 }), "240");
  assert.equal(calculateCostOperation(calculator({ expenses: { fuelCost: "240" } })).totalCost, 240);
  assert.equal(parseCostNumber("3.000,50 €"), 3000.5);
  assert.equal(parseCostNumber("-100"), 0);
  assert.equal(sanitizeDecimalInput("-100"), "");
});

test("el estado con datos descriptivos se considera guardable", () => {
  assert.equal(costCalculatorHasData(createEmptyCostCalculatorState()), false);
  assert.equal(costCalculatorHasData(calculator({ vehicle: { make: "BMW" } })), true);
});

test("los nombres PDF son limpios, incluyen el acabado y nunca duplican Analisis", () => {
  assert.equal(costReportFileName(), "IvanImports-Analisis-Operacion.pdf");
  assert.equal(costReportFileName({ make: "BMW", model: "318i", trim: "M Sport", year: "2025" }), "IvanImports-BMW-318i-M-Sport-2025-Analisis.pdf");
  assert.equal(costReportFileName({ make: "Citroën", model: "C5/Aircross" }), "IvanImports-Citroen-C5-Aircross-Analisis.pdf");
});

test("la interfaz KAIROS sustituye la vista v4 y conserva PDF real sin popups ni impresión", async () => {
  const source = await readFile(new URL("assets/academy/app.js", root), "utf8");
  const calculatorSource = await readFile(new URL("assets/kairos-budget/ui.js", root), "utf8");
  assert.match(source, /renderKairosBudgetApp/);
  assert.match(calculatorSource, /function buildClientPdf/);
  assert.match(calculatorSource, /function buildInternalPdf/);
  assert.match(calculatorSource, /\.save\(safePdfFileName/);
  assert.match(calculatorSource, /jspdf\.umd\.min\.js/);
  assert.match(calculatorSource, /Generando PDF…/);
  assert.doesNotMatch(calculatorSource, /window\.open\s*\(/);
  assert.doesNotMatch(calculatorSource, /window\.print\s*\(/);
  assert.doesNotMatch(calculatorSource, /report\.print\s*\(/);
  assert.doesNotMatch(calculatorSource, /html2canvas/);
});

test("la librería PDF cliente está versionada y no depende de node_modules en producción", async () => {
  const file = new URL("assets/vendor/jspdf.umd.min.js", root);
  assert.ok((await stat(file)).size > 300_000);
  assert.match(await readFile(file, "utf8"), /jsPDF/);
});

test("la página SEO mantiene su URL y presenta el presupuesto Copart interno y cliente", async () => {
  const html = await readFile(new URL("herramientas/calculadora-coste-importacion/index.html", root), "utf8");
  assert.match(html, /<h1>Calculadora profesional de operaciones Copart<\/h1>/);
  assert.match(html, /Presupuesta compra, REBU, gastos y rentabilidad en una vista interna separada del presupuesto comercial para el cliente\./);
  assert.match(html, /herramientas\/calculadora-coste-importacion/);
});
