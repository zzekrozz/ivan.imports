import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  COST_CALCULATOR_VERSION,
  COST_EXPENSE_FIELDS,
  COST_EXPENSE_SECTIONS,
  calculateCostOperation,
  calculateFuel,
  costCalculatorHasData,
  createEmptyCostCalculatorState,
  fuelCostInputValue,
  normalizeCostCalculatorState,
  parseCostNumber,
  sanitizeDecimalInput,
} from "../assets/academy/private/cost-calculator.js";

const root = new URL("../", import.meta.url);

function calculator({ expenses = {}, fuel = {}, marketValue = "", desiredProfit = "", askingPrice = "" } = {}) {
  return normalizeCostCalculatorState({
    ...createEmptyCostCalculatorState(),
    expenses,
    fuel: { ...createEmptyCostCalculatorState().fuel, ...fuel },
    marketValue,
    desiredProfit,
    askingPrice,
  });
}

test("la definición canónica contiene cuatro categorías y 25 partidas únicas", () => {
  assert.deepEqual(COST_EXPENSE_SECTIONS.map((section) => section.id), ["vehicle", "travel", "administration", "upkeep"]);
  assert.equal(COST_EXPENSE_FIELDS.length, 25);
  assert.equal(new Set(COST_EXPENSE_FIELDS.map((field) => field.id)).size, 25);
  assert.match(COST_EXPENSE_FIELDS.find((field) => field.id === "iedmt").label, /IEDMT \/ Modelo 576/);
});

test("una calculadora vacía produce coste total cero sin conclusiones inventadas", () => {
  const result = calculateCostOperation(calculator());
  assert.equal(result.totalCost, 0);
  assert.equal(result.marketProfit, null);
  assert.equal(result.targetSalePrice, null);
  assert.equal(result.maximumPurchasePrice, null);
  assert.equal(result.status, "incomplete");
});

test("suma básica: una partida corresponde a un único importe", () => {
  assert.equal(calculateCostOperation(calculator({ expenses: { purchase: "3000", flight: "200" } })).totalCost, 3200);
});

test("suma todas las categorías sin mezclar sus subtotales", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3000, flight: 200, itv: 100, maintenance: 250 } }));
  assert.deepEqual(result.categoryTotals, { vehicle: 3000, travel: 200, administration: 100, upkeep: 250 });
  assert.equal(result.totalCost, 3550);
});

test("calcula beneficio vendiendo al mercado introducido", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3813 }, marketValue: 5000 }));
  assert.equal(result.marketProfit, 1187);
});

test("calcula el precio necesario para conseguir el beneficio deseado sin exigir mercado", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3813 }, desiredProfit: 2000 }));
  assert.equal(result.targetSalePrice, 5813);
  assert.equal(result.marketDifference, null);
});

test("detecta un objetivo claramente por encima del mercado", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3813 }, marketValue: 5000, desiredProfit: 2000 }));
  assert.equal(result.marketDifference, 813);
  assert.equal(result.status, "attention");
});

test("detecta margen cuando el objetivo queda por debajo del mercado", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3500 }, marketValue: 5000, desiredProfit: 1000 }));
  assert.equal(result.marketDifference, -500);
  assert.equal(result.status, "good");
});

test("considera alineados objetivo y mercado dentro de una tolerancia útil", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3900 }, marketValue: 5000, desiredProfit: 1050 }));
  assert.equal(result.marketDifference, -50);
  assert.equal(result.tolerance, 100);
  assert.equal(result.status, "aligned");
});

test("calcula el precio máximo de compra descontando gastos sin compra", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3000, flight: 200, localTransport: 100, fuel: 300, food: 213 }, marketValue: 5000, desiredProfit: 2000 }));
  assert.equal(result.expensesWithoutPurchase, 813);
  assert.equal(result.maximumPurchasePrice, 2187);
});

test("compara una compra superior con el máximo recomendado", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3000, travelOther: 813 }, marketValue: 5000, desiredProfit: 2000 }));
  assert.equal(result.purchaseDifference, 813);
});

test("compara una compra inferior con el máximo recomendado", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 2900, travelOther: 800 }, marketValue: 5000, desiredProfit: 1000 }));
  assert.equal(result.maximumPurchasePrice, 3200);
  assert.equal(result.purchaseDifference, -300);
});

test("calcula cuánto negociar cuando el anuncio supera el máximo", () => {
  const result = calculateCostOperation(calculator({ expenses: { travelOther: 1050 }, marketValue: 5000, desiredProfit: 1000, askingPrice: 3400 }));
  assert.equal(result.maximumPurchasePrice, 2950);
  assert.equal(result.negotiationAmount, 450);
});

test("reconoce un precio anunciado que ya entra dentro del máximo", () => {
  const result = calculateCostOperation(calculator({ expenses: { travelOther: 1050 }, marketValue: 5000, desiredProfit: 1000, askingPrice: 2900 }));
  assert.equal(result.negotiationAmount, -50);
});

test("calcula combustible: 2.000 km, 7,5 L/100 y 1,60 €/L", () => {
  const result = calculateFuel({ kilometres: "2000", consumption: "7,5", pricePerLitre: "1,60" });
  assert.equal(result.valid, true);
  assert.equal(result.litres, 150);
  assert.equal(result.cost, 240);
});

test("no inventa combustible si falta uno de los tres datos", () => {
  const result = calculateFuel({ kilometres: "2000", consumption: "7,5", pricePerLitre: "" });
  assert.equal(result.valid, false);
  assert.equal(result.cost, 0);
});

test("el botón de usar combustible produce el importe editable esperado", () => {
  assert.equal(fuelCostInputValue({ kilometres: 2000, consumption: 7.5, pricePerLitre: 1.6 }), "240");
});

test("acepta decimales españoles, internacionales y cifras con miles", () => {
  assert.equal(parseCostNumber("3000,50"), 3000.5);
  assert.equal(parseCostNumber("3000.50"), 3000.5);
  assert.equal(parseCostNumber("3.000,50 €"), 3000.5);
  assert.equal(parseCostNumber("3.813"), 3813);
});

test("descarta NaN, texto y cantidades negativas", () => {
  assert.equal(parseCostNumber("texto"), 0);
  assert.equal(parseCostNumber(Number.NaN), 0);
  assert.equal(parseCostNumber("-100"), 0);
  assert.equal(sanitizeDecimalInput("-100"), "");
});

test("con mercado pero sin beneficio solo muestra el beneficio a mercado", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3000 }, marketValue: 5000 }));
  assert.equal(result.marketProfit, 2000);
  assert.equal(result.targetSalePrice, null);
  assert.equal(result.maximumPurchasePrice, null);
});

test("con beneficio pero sin mercado muestra precio objetivo y omite compra máxima", () => {
  const result = calculateCostOperation(calculator({ expenses: { purchase: 3000 }, desiredProfit: 2000 }));
  assert.equal(result.targetSalePrice, 5000);
  assert.equal(result.marketProfit, null);
  assert.equal(result.maximumPurchasePrice, null);
});

test("el caso de aceptación 3.813 / 5.000 / 2.000 pasa exactamente", () => {
  const result = calculateCostOperation(calculator({
    expenses: { purchase: 3000, flight: 200, localTransport: 100, fuel: 300, food: 213 },
    marketValue: 5000,
    desiredProfit: 2000,
  }));
  assert.equal(result.totalCost, 3813);
  assert.equal(result.marketProfit, 1187);
  assert.equal(result.targetSalePrice, 5813);
  assert.equal(result.marketDifference, 813);
  assert.equal(result.expensesWithoutPurchase, 813);
  assert.equal(result.maximumPurchasePrice, 2187);
  assert.equal(result.purchaseDifference, 813);
});

test("la persistencia v2 conserva gastos, combustible, mercado, beneficio y anuncio", () => {
  const state = calculator({ expenses: { purchase: "3000,50" }, fuel: { kilometres: 2000, consumption: "7,5", pricePerLitre: "1,60" }, marketValue: 5000, desiredProfit: 2000, askingPrice: 3400 });
  const restored = normalizeCostCalculatorState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.version, COST_CALCULATOR_VERSION);
  assert.deepEqual(restored, state);
});

test("el modelo antiguo Estimado/Confirmado/Real empieza limpio en v2", () => {
  const restored = normalizeCostCalculatorState({ rows: { purchase: { estimated: 3000, confirmed: 3100, actual: 3200 } }, marketValue: 5000 });
  assert.deepEqual(restored, createEmptyCostCalculatorState());
});

test("Vaciar calculadora puede distinguir estado vacío de estado con datos", () => {
  assert.equal(costCalculatorHasData(createEmptyCostCalculatorState()), false);
  assert.equal(costCalculatorHasData(calculator({ expenses: { purchase: 0 } })), true);
  assert.equal(costCalculatorHasData(calculator({ fuel: { kilometres: 2000 } })), true);
});

test("la integración elimina la tabla antigua y actualiza sin reconstruir el formulario", async () => {
  const source = await readFile(new URL("assets/academy/app.js", root), "utf8");
  const calculatorSource = source.slice(source.indexOf("function ensureCosts"), source.indexOf("function renderDocumentsTool"));
  assert.doesNotMatch(calculatorSource, /Estimado|Confirmado|Desviación|data-cost-diff|<table/);
  assert.match(calculatorSource, /data-calculator-version="2"/);
  assert.match(calculatorSource, /updateCostCalculatorResults/);
  assert.match(calculatorSource, /costCurrency/);
  assert.match(source, /useGrouping: "always"/);
  assert.match(source, /data-action="fuel-use"/);
  assert.doesNotMatch(source, /\[data-market-field\], \[data-cost-field\]/);
});

test("el CSS contiene layout responsive y evita tablas horizontales", async () => {
  const css = await readFile(new URL("assets/academy/app.css", root), "utf8");
  assert.match(css, /\.academy-cost-layout\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /\.academy-cost-line[\s\S]*\.academy-cost-input/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.academy-cost-line/);
  assert.doesNotMatch(css, /academy-cost-blocks|academy-cost-decision/);
});

test("el cat\u00e1logo p\u00fablico describe el modelo sencillo sin estados paralelos", async () => {
  const program = JSON.parse(await readFile(new URL("assets/academy/program-v2.json", root), "utf8"));
  const tool = program.tools.find((entry) => entry.id === "cost-calculator");
  const searchEntry = program.searchIndex.find((entry) => entry.kind === "tool" && entry.id === "cost-calculator");
  assert.equal(tool.description, "Suma todos los gastos y descubre el precio, beneficio y compra m\u00e1xima que hacen cuadrar la operaci\u00f3n.");
  assert.doesNotMatch(`${tool.description} ${searchEntry.text}`, /estimado|confirmado|real|desviaci\u00f3n/i);
});

test("la p\u00e1gina SEO de la calculadora conserva ruta y descripci\u00f3n actuales", async () => {
  const html = await readFile(new URL("academia/herramientas/cost-calculator/index.html", root), "utf8");
  assert.match(html, /<h1>Calculadora de coste total<\/h1>/);
  assert.match(html, /Suma todos los gastos y descubre el precio, beneficio y compra m\u00e1xima/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ivanimports\.es\/academia\/herramientas\/cost-calculator\/">/);
  assert.doesNotMatch(html, /Distingue estimado, confirmado, real/i);
});
