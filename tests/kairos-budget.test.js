import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addCustomExpense,
  calculateKairosBudget,
  clientPdfModel,
  createEmptyKairosBudget,
  createKairosBudgetStore,
  duplicateKairosBudget,
  expenseById,
  migrateLegacyCostCalculator,
  normalizeKairosBudget,
  safePdfFileName,
} from "../assets/kairos-budget/domain.js";

const operation = ({ purchase = 5000, expenses = 1000, deductible = 0, profit = 2000, buffer = 0, finalPrice = "", vatRate = 21 } = {}) => {
  const budget = createEmptyKairosBudget();
  budget.purchase.totalRebu = purchase;
  budget.pricing.targetProfit = profit;
  budget.pricing.buffer = buffer;
  budget.pricing.finalPrice = finalPrice;
  budget.pricing.vatRate = vatRate;
  const travel = expenseById(budget, "travel-other");
  travel.amount = expenses;
  travel.vatIncluded = deductible > 0;
  travel.deductibleVat = deductible;
  travel.country = "España";
  return budget;
};

test("la reserva es el 10 % de la puja con un mínimo inalterable de 500 €", () => {
  const low = createEmptyKairosBudget(); low.purchase.hammer = 4000;
  const high = createEmptyKairosBudget(); high.purchase.hammer = 15000;
  assert.equal(calculateKairosBudget(low).reservation, 500);
  assert.equal(calculateKairosBudget(high).reservation, 1500);
});

test("el precio necesario reproduce el ejemplo REBU 5.000 + 3.000 × 1,21", () => {
  const model = calculateKairosBudget(operation());
  assert.equal(model.requiredSalePrice, 8630);
  assert.equal(model.marginRebu, 3630);
  assert.equal(model.vatRebu, 630);
  assert.equal(model.netMarginRebu, 3000);
  assert.equal(model.realProfit, 2000);
});

test("el IVA español deducible reduce los gastos y el precio necesario", () => {
  const model = calculateKairosBudget(operation({ deductible: 100 }));
  assert.equal(model.operatingExpensesGross, 1000);
  assert.equal(model.spanishRecoverableVat, 100);
  assert.equal(model.netExpenses, 900);
  assert.equal(model.requiredSalePrice, 8509);
});

test("el IVA extranjero solo se recupera cuando se activa expresamente", () => {
  const budget = operation({ deductible: 100 });
  const expense = expenseById(budget, "travel-other"); expense.country = "Alemania";
  assert.equal(calculateKairosBudget(budget).netExpenses, 1000);
  budget.recovery.includeForeignVat = true;
  assert.equal(calculateKairosBudget(budget).netExpenses, 900);
});

test("el IVA deducible nunca supera el gasto pagado", () => {
  const model = calculateKairosBudget(operation({ expenses: 100, deductible: 500 }));
  assert.equal(model.spanishRecoverableVat, 100);
  assert.equal(model.netExpenses, 0);
});

test("la compra automática Copart suma martillo, comisión y otros sin duplicarlos", () => {
  const budget = createEmptyKairosBudget();
  budget.purchase.hammer = 14000;
  expenseById(budget, "copart-commission").amount = 1025;
  expenseById(budget, "copart-other").amount = 300;
  const model = calculateKairosBudget(budget);
  assert.equal(model.automaticPurchaseTotal, 15325);
  assert.equal(model.purchaseRebu, 15325);
  assert.equal(model.operatingExpensesGross, 0);
});

test("el total REBU manual prevalece sobre el total Copart automático", () => {
  const budget = createEmptyKairosBudget();
  budget.purchase.hammer = 14000;
  expenseById(budget, "copart-commission").amount = 1025;
  budget.purchase.totalRebu = 16000;
  assert.equal(calculateKairosBudget(budget).purchaseRebu, 16000);
});

test("la calculadora inversa descuenta gastos, beneficio, colchón y componentes Copart", () => {
  const budget = operation({ purchase: 0, expenses: 1000, profit: 2000, buffer: 300, finalPrice: 22000 });
  expenseById(budget, "copart-commission").amount = 1000;
  const model = calculateKairosBudget(budget);
  assert.equal(model.maximumPurchase, 18007);
  assert.equal(model.maximumHammer, 17007);
});

test("beneficio real, margen y ROI se calculan desde una sola operación", () => {
  const model = calculateKairosBudget(operation({ finalPrice: 9000 }));
  assert.equal(model.vatRebu, 694.21);
  assert.equal(model.realProfit, 2305.79);
  assert.equal(model.saleMarginPercent, 25.62);
  assert.equal(model.roiPercent, 38.43);
});

test("el ahorro admite valores positivos, cero y negativos", () => {
  for (const [market, expected] of [[10000, 1000], [9000, 0], [8000, -1000]]) {
    const budget = operation({ finalPrice: 9000 }); budget.vehicle.marketSpain = market;
    assert.equal(calculateKairosBudget(budget).clientSavings, expected);
  }
});

test("las alertas detectan puja excesiva, mercado superado y beneficio insuficiente", () => {
  const budget = operation({ purchase: 5000, expenses: 1000, profit: 2000, finalPrice: 7000 });
  budget.purchase.hammer = 6000;
  budget.vehicle.marketSpain = 6500;
  const texts = calculateKairosBudget(budget).alerts.map((item) => item.text).join(" ");
  assert.match(texts, /beneficio objetivo/);
  assert.match(texts, /supera el valor comparable/);
  assert.match(texts, /No pujar/);
});

test("el modelo del PDF cliente no contiene campos internos ni estructuras de costes", () => {
  const safe = clientPdfModel(operation({ finalPrice: 9000, profit: 2000, buffer: 300 }));
  const serialized = JSON.stringify(safe);
  for (const forbidden of ["targetProfit", "buffer", "purchaseRebu", "vatRebu", "realProfit", "roi", "deductibleVat", "expenses"]) assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  assert.equal(safe.finalPrice, 9000);
  assert.equal(safe.reservation, 500.7);
});

test("los gastos personalizados son editables y no tienen un límite artificial", () => {
  let updated = createEmptyKairosBudget();
  for (let index = 0; index < 120; index += 1) updated = addCustomExpense(updated);
  const custom = updated.expenses.at(-1);
  assert.equal(custom.custom, true);
  assert.equal(custom.category, "PERSONALIZADO");
  assert.equal(updated.expenses.filter((item) => item.custom).length, 120);
});

test("las alertas avisan cuando falta REBU o el precio no cubre toda la operación", () => {
  const budget = operation({ purchase: 5000, expenses: 1000, profit: 2000, buffer: 300, finalPrice: 5500, vatRate: 0 });
  const texts = calculateKairosBudget(budget).alerts.map((item) => item.text).join(" ");
  assert.match(texts, /IVA REBU no está calculado/);
  assert.match(texts, /no cubre la compra, los gastos/);
});

test("guardar varios presupuestos permite duplicar sin reutilizar identidad ni estado", () => {
  const budget = operation(); budget.status = "ENVIADO"; budget.vehicle.make = "BMW";
  const store = duplicateKairosBudget(createKairosBudgetStore(budget));
  assert.equal(store.budgets.length, 2);
  assert.notEqual(store.budgets[0].id, store.budgets[1].id);
  assert.equal(store.budgets[1].status, "BORRADOR");
  assert.equal(store.budgets[1].vehicle.make, "BMW");
});

test("la migración conserva los datos útiles de la calculadora v4", () => {
  const migrated = migrateLegacyCostCalculator({ version: 4, vehicle: { make: "BMW", model: "318i", year: "2025" }, expenses: { copartBidMax: 14700, copartWithFees: 15725, fees: 2000, flight: 150, iedmt: 500 }, marketScenarios: [{ priceSpain: 27000 }] });
  assert.ok(migrated);
  const model = calculateKairosBudget(migrated);
  assert.equal(migrated.vehicle.make, "BMW");
  assert.equal(migrated.vehicle.marketSpain, 27000);
  assert.equal(model.hammer, 14700);
  assert.equal(model.purchaseRebu, 15725);
  assert.equal(model.operatingExpensesGross, 2650);
});

test("los nombres PDF son seguros y separan cliente de informe interno", () => {
  const budget = createEmptyKairosBudget(); budget.vehicle.make = "Škoda"; budget.vehicle.model = "Kodiaq / RS"; budget.vehicle.year = "2025";
  assert.equal(safePdfFileName(budget, "Cliente"), "KAIROS-Skoda-Kodiaq-RS-2025-Presupuesto-Cliente.pdf");
  assert.equal(safePdfFileName(budget, "Interno"), "KAIROS-Skoda-Kodiaq-RS-2025-Presupuesto-Interno.pdf");
});

test("la UI usa módulos TypeScript compilados, vistas separadas y dos PDFs reales", () => {
  const source = readFileSync(new URL("../assets/kairos-budget/ui.js", import.meta.url), "utf8");
  const academy = readFileSync(new URL("../assets/academy/app.js", import.meta.url), "utf8");
  assert.match(source, /Vista interna/);
  assert.match(source, /Vista cliente/);
  assert.match(source, /buildClientPdf/);
  assert.match(source, /buildInternalPdf/);
  assert.match(source, /\.save\(safePdfFileName/);
  assert.doesNotMatch(source, /window\.open|window\.print|report\.print/);
  assert.match(academy, /renderKairosBudgetApp/);
});
