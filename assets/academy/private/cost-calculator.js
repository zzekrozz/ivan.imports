export const COST_CALCULATOR_VERSION = 2;

export const COST_EXPENSE_SECTIONS = Object.freeze([
  Object.freeze({
    id: "vehicle",
    title: "Coste del vehículo",
    fields: Object.freeze([
      Object.freeze({ id: "purchase", label: "Precio de compra del vehículo", featured: true }),
    ]),
  }),
  Object.freeze({
    id: "travel",
    title: "Gastos del viaje",
    fields: Object.freeze([
      Object.freeze({ id: "flight", label: "Vuelo" }),
      Object.freeze({ id: "localTransport", label: "Transporte local" }),
      Object.freeze({ id: "exportPlates", label: "Placas de exportación" }),
      Object.freeze({ id: "temporaryInsurance", label: "Seguro temporal / exportación" }),
      Object.freeze({ id: "fuel", label: "Combustible", fuelCalculator: true }),
      Object.freeze({ id: "tolls", label: "Peajes" }),
      Object.freeze({ id: "hotel", label: "Hotel" }),
      Object.freeze({ id: "food", label: "Comida" }),
      Object.freeze({ id: "travelOther", label: "Otros gastos de viaje" }),
    ]),
  }),
  Object.freeze({
    id: "administration",
    title: "Gastos administrativos",
    fields: Object.freeze([
      Object.freeze({ id: "itv", label: "ITV" }),
      Object.freeze({ id: "coc", label: "CoC / ficha reducida" }),
      Object.freeze({ id: "dgt", label: "Tasa DGT / matriculación" }),
      Object.freeze({ id: "ivtm", label: "IVTM" }),
      Object.freeze({ id: "iedmt", label: "Impuesto de matriculación (IEDMT)", help: "Déjalo en 0 € si no corresponde." }),
      Object.freeze({ id: "registrationPlates", label: "Matrículas españolas" }),
      Object.freeze({ id: "agency", label: "Gestoría" }),
      Object.freeze({ id: "administrationOther", label: "Otros gastos administrativos" }),
    ]),
  }),
  Object.freeze({
    id: "upkeep",
    title: "Puesta a punto y otros gastos",
    fields: Object.freeze([
      Object.freeze({ id: "maintenance", label: "Mantenimiento inicial" }),
      Object.freeze({ id: "repairs", label: "Reparaciones" }),
      Object.freeze({ id: "tyres", label: "Neumáticos" }),
      Object.freeze({ id: "detailing", label: "Limpieza / detailing" }),
      Object.freeze({ id: "vehicleTransport", label: "Transporte del vehículo" }),
      Object.freeze({ id: "contingency", label: "Imprevistos" }),
      Object.freeze({ id: "other", label: "Otros" }),
    ]),
  }),
]);

export const COST_EXPENSE_FIELDS = Object.freeze(COST_EXPENSE_SECTIONS.flatMap((section) => section.fields));

export function createEmptyCostCalculatorState() {
  return {
    version: COST_CALCULATOR_VERSION,
    expenses: {},
    fuel: { kilometres: "", consumption: "", pricePerLitre: "" },
    marketValue: "",
    desiredProfit: "",
    askingPrice: "",
  };
}

export function sanitizeDecimalInput(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? String(value) : "";
  const source = String(value).trim();
  if (source.includes("-")) return "";
  return source.replace(/\s|€/g, "").replace(/[^0-9.,]/g, "").slice(0, 20);
}

export function parseCostNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : 0;
  let source = sanitizeDecimalInput(value);
  if (!source) return 0;

  const comma = source.lastIndexOf(",");
  const dot = source.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    const decimalIndex = Math.max(comma, dot);
    const whole = source.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimals = source.slice(decimalIndex + 1).replace(/[.,]/g, "");
    source = `${whole || "0"}.${decimals}`;
  } else {
    const separator = comma >= 0 ? "," : dot >= 0 ? "." : "";
    if (separator) {
      const chunks = source.split(separator);
      const thousandsOnly = chunks.length > 2
        ? chunks.slice(1).every((chunk) => chunk.length === 3)
        : chunks.length === 2 && chunks[0].length <= 3 && chunks[1].length === 3;
      source = thousandsOnly
        ? chunks.join("")
        : `${chunks.slice(0, -1).join("") || "0"}.${chunks.at(-1) || "0"}`;
    }
  }

  const number = Number(source);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeRawValue(value) {
  return sanitizeDecimalInput(value);
}

export function normalizeCostCalculatorState(value) {
  const empty = createEmptyCostCalculatorState();
  if (!value || typeof value !== "object") return empty;
  const version = Number(value.version || value.schemaVersion || 0);
  if (version !== COST_CALCULATOR_VERSION || !value.expenses || typeof value.expenses !== "object") return empty;

  const expenses = {};
  COST_EXPENSE_FIELDS.forEach(({ id }) => {
    const normalized = normalizeRawValue(value.expenses[id]);
    if (normalized !== "") expenses[id] = normalized;
  });
  return {
    version: COST_CALCULATOR_VERSION,
    expenses,
    fuel: {
      kilometres: normalizeRawValue(value.fuel?.kilometres),
      consumption: normalizeRawValue(value.fuel?.consumption),
      pricePerLitre: normalizeRawValue(value.fuel?.pricePerLitre),
    },
    marketValue: normalizeRawValue(value.marketValue),
    desiredProfit: normalizeRawValue(value.desiredProfit),
    askingPrice: normalizeRawValue(value.askingPrice),
  };
}

function hasInput(value) {
  return sanitizeDecimalInput(value) !== "";
}

export function calculateFuel(value = {}) {
  const kilometres = parseCostNumber(value.kilometres);
  const consumption = parseCostNumber(value.consumption);
  const pricePerLitre = parseCostNumber(value.pricePerLitre);
  const valid = kilometres > 0 && consumption > 0 && pricePerLitre > 0;
  const litres = valid ? (kilometres * consumption) / 100 : 0;
  const cost = valid ? litres * pricePerLitre : 0;
  return { kilometres, consumption, pricePerLitre, litres, cost, valid };
}

export function calculateCostOperation(value) {
  const state = normalizeCostCalculatorState(value);
  const categoryTotals = Object.fromEntries(COST_EXPENSE_SECTIONS.map((section) => [
    section.id,
    section.fields.reduce((total, field) => total + parseCostNumber(state.expenses[field.id]), 0),
  ]));
  const totalCost = Object.values(categoryTotals).reduce((total, amount) => total + amount, 0);
  const purchasePrice = parseCostNumber(state.expenses.purchase);
  const expensesWithoutPurchase = Math.max(0, totalCost - purchasePrice);
  const marketValue = parseCostNumber(state.marketValue);
  const desiredProfit = parseCostNumber(state.desiredProfit);
  const askingPrice = parseCostNumber(state.askingPrice);
  const hasMarket = hasInput(state.marketValue) && marketValue > 0;
  const hasDesiredProfit = hasInput(state.desiredProfit);
  const hasAskingPrice = hasInput(state.askingPrice) && askingPrice > 0;
  const targetSalePrice = hasDesiredProfit ? totalCost + desiredProfit : null;
  const marketProfit = hasMarket ? marketValue - totalCost : null;
  const marketDifference = hasMarket && hasDesiredProfit ? targetSalePrice - marketValue : null;
  const tolerance = hasMarket ? Math.max(100, marketValue * 0.02) : 100;
  const status = marketDifference === null
    ? "incomplete"
    : Math.abs(marketDifference) <= tolerance
      ? "aligned"
      : marketDifference < 0
        ? "good"
        : "attention";
  const maximumPurchasePrice = hasMarket && hasDesiredProfit
    ? marketValue - desiredProfit - expensesWithoutPurchase
    : null;
  const purchaseDifference = maximumPurchasePrice === null || !hasInput(state.expenses.purchase)
    ? null
    : purchasePrice - maximumPurchasePrice;
  const negotiationAmount = maximumPurchasePrice === null || !hasAskingPrice
    ? null
    : askingPrice - maximumPurchasePrice;
  const marginPercent = marketProfit !== null && marketValue > 0 ? (marketProfit / marketValue) * 100 : null;
  const returnOnCost = marketProfit !== null && totalCost > 0 ? (marketProfit / totalCost) * 100 : null;

  return {
    state,
    categoryTotals,
    totalCost,
    purchasePrice,
    expensesWithoutPurchase,
    marketValue,
    desiredProfit,
    askingPrice,
    hasMarket,
    hasDesiredProfit,
    hasAskingPrice,
    targetSalePrice,
    marketProfit,
    marketDifference,
    tolerance,
    status,
    maximumPurchasePrice,
    purchaseDifference,
    negotiationAmount,
    marginPercent,
    returnOnCost,
  };
}

export function costCalculatorHasData(value) {
  const state = normalizeCostCalculatorState(value);
  return COST_EXPENSE_FIELDS.some(({ id }) => hasInput(state.expenses[id]))
    || Object.values(state.fuel).some(hasInput)
    || hasInput(state.marketValue)
    || hasInput(state.desiredProfit)
    || hasInput(state.askingPrice);
}

export function fuelCostInputValue(fuel) {
  const result = calculateFuel(fuel);
  return result.valid ? String(Math.round(result.cost * 100) / 100) : "";
}
