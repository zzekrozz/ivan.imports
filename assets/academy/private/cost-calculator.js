export const COST_CALCULATOR_VERSION = 4;

const field = (id, label, options = {}) => Object.freeze({ id, label, vatEligible: true, ...options });

export const VEHICLE_DATA_FIELDS = Object.freeze([
  field("make", "Marca", { type: "text", example: "BMW", vatEligible: false }),
  field("model", "Modelo", { type: "text", example: "318i", vatEligible: false }),
  field("trim", "Versión / acabado", { type: "text", example: "M Sport", vatEligible: false }),
  field("year", "Año", { type: "text", example: "2025", vatEligible: false }),
  field("mileage", "Kilómetros", { type: "text", example: "48.127", vatEligible: false }),
  field("color", "Color", { type: "text", example: "Gris", vatEligible: false }),
  field("transmission", "Cambio", { type: "select", options: ["", "Automático", "Manual"], vatEligible: false }),
  field("fuel", "Combustible", { type: "select", options: ["", "Gasolina", "Diésel", "Híbrido", "Híbrido enchufable", "Eléctrico", "Otro"], vatEligible: false }),
  field("taxRegime", "Régimen fiscal", { type: "select", options: ["No consta", "Sin REBU", "Con REBU"], vatEligible: false }),
  field("horsepower", "Potencia / caballos", { type: "text", example: "156 CV", vatEligible: false }),
  field("engine", "Motor", { type: "text", example: "2.0 gasolina · 1.998 cc", vatEligible: false }),
  field("country", "País de origen", { type: "text", example: "Alemania", vatEligible: false }),
  field("source", "Procedencia / plataforma", { type: "select", options: ["", "Copart", "Mobile.de", "AutoScout24", "Concesionario", "Particular", "Otro"], vatEligible: false }),
  field("plate", "Matrícula", { type: "text", example: "Opcional", vatEligible: false }),
  field("vin", "VIN / bastidor", { type: "text", example: "Opcional", vatEligible: false }),
  field("listingUrl", "Enlace del anuncio", { type: "url", example: "Opcional", vatEligible: false }),
  field("notes", "Notas del vehículo", { type: "textarea", example: "Opcional", vatEligible: false }),
]);

export const COST_EXPENSE_SECTIONS = Object.freeze([
  Object.freeze({ id: "vehicle", title: "Coste del vehículo", fields: Object.freeze([
    field("copartBidMax", "Copart · Puja máxima", { informative: true, featured: true, help: "Puja máxima prevista o realizada antes de las comisiones de Copart. Solo es una referencia: no se suma." }),
    field("copartWithFees", "Copart · Puja con comisión", { featured: true, help: "Coste de Copart incluyendo las comisiones correspondientes. Es el importe utilizado en el cálculo." }),
    field("purchase", "Precio de compra / adquisición", { help: "Úsalo si la compra no procede de Copart. Si introduces ambos importes, prevalece Copart con comisión." }),
    field("fees", "Honorarios", { help: "Honorarios de intermediación, compra, gestión o servicio." }),
  ]) }),
  Object.freeze({ id: "travel", title: "Gastos del viaje", fields: Object.freeze([
    field("flight", "Vuelo"), field("localTransport", "Transporte local"), field("exportPlates", "Placas de exportación"), field("temporaryInsurance", "Seguro temporal / exportación"), field("fuelCost", "Combustible", { fuelCalculator: true }), field("tolls", "Peajes"), field("hotel", "Hotel"), field("food", "Comida"), field("travelOther", "Otros gastos de viaje"),
  ]) }),
  Object.freeze({ id: "administration", title: "Gastos administrativos", fields: Object.freeze([
    field("itv", "ITV"), field("coc", "CoC / ficha reducida"), field("dgt", "Tasa DGT / matriculación"), field("ivtm", "IVTM"), field("iedmt", "Impuesto de matriculación (IEDMT / Modelo 576)", { help: "Déjalo en 0 € si no corresponde." }), field("registrationPlates", "Matrículas españolas"), field("agency", "Gestoría"), field("administrationOther", "Otros gastos administrativos"),
  ]) }),
  Object.freeze({ id: "upkeep", title: "Puesta a punto y otros gastos", fields: Object.freeze([
    field("maintenance", "Mantenimiento inicial"), field("repairs", "Reparaciones"), field("tyres", "Neumáticos"), field("detailing", "Limpieza / detailing"), field("vehicleTransport", "Transporte del vehículo"), field("contingency", "Imprevistos"), field("other", "Otros"),
  ]) }),
]);

export const COST_EXPENSE_FIELDS = Object.freeze(COST_EXPENSE_SECTIONS.flatMap((section) => section.fields));
export const COST_VAT_FIELDS = Object.freeze(COST_EXPENSE_FIELDS.filter((item) => item.vatEligible && !item.informative));
const emptyVehicle = () => ({ ...Object.fromEntries(VEHICLE_DATA_FIELDS.map(({ id }) => [id, ""])), taxRegime: "No consta" });
const normalizeText = (value, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function createEmptyCostCalculatorState() {
  return { version: COST_CALCULATOR_VERSION, vehicle: emptyVehicle(), expenses: {}, vatEnabled: false, vat21: {}, fuel: { kilometres: "", consumption: "", pricePerLitre: "" }, marketScenarios: [], resultLabel: "Beneficio estimado" };
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
  const comma = source.lastIndexOf(","); const dot = source.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) { const decimalIndex = Math.max(comma, dot); source = `${source.slice(0, decimalIndex).replace(/[.,]/g, "") || "0"}.${source.slice(decimalIndex + 1).replace(/[.,]/g, "")}`; }
  else { const separator = comma >= 0 ? "," : dot >= 0 ? "." : ""; if (separator) { const chunks = source.split(separator); const thousandsOnly = chunks.length > 2 ? chunks.slice(1).every((chunk) => chunk.length === 3) : chunks.length === 2 && chunks[0].length <= 3 && chunks[1].length === 3; source = thousandsOnly ? chunks.join("") : `${chunks.slice(0, -1).join("") || "0"}.${chunks.at(-1) || "0"}`; } }
  const number = Number(source); return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function normalizeCostCalculatorState(value) {
  const empty = createEmptyCostCalculatorState();
  if (!value || typeof value !== "object" || ![2, 3, 4].includes(Number(value.version || value.schemaVersion || 0))) return empty;
  const sourceExpenses = value.expenses && typeof value.expenses === "object" ? value.expenses : {}; const expenses = {};
  COST_EXPENSE_FIELDS.forEach(({ id }) => { const rawValue = id === "fuelCost" ? sourceExpenses.fuelCost ?? sourceExpenses.fuel : sourceExpenses[id]; const normalized = sanitizeDecimalInput(rawValue); if (normalized !== "") expenses[id] = normalized; });
  const vehicle = Object.fromEntries(VEHICLE_DATA_FIELDS.map(({ id }) => [id, normalizeText(value.vehicle?.[id], id === "notes" ? 700 : 240)]));
  vehicle.taxRegime = ["No consta", "Sin REBU", "Con REBU"].includes(value.vehicle?.taxRegime) ? value.vehicle.taxRegime : "No consta";
  const vat21 = Object.fromEntries(COST_VAT_FIELDS.map(({ id }) => [id, Boolean(value.vat21?.[id])]));
  const marketScenarios = Array.isArray(value.marketScenarios) ? value.marketScenarios.slice(0, 30).map((item, index) => ({ id: normalizeText(item?.id, 60) || `scenario-${index + 1}`, label: normalizeText(item?.label, 100), priceSpain: sanitizeDecimalInput(item?.priceSpain) })) : [];
  return { version: COST_CALCULATOR_VERSION, vehicle, expenses, vatEnabled: Boolean(value.vatEnabled), vat21, fuel: { kilometres: sanitizeDecimalInput(value.fuel?.kilometres), consumption: sanitizeDecimalInput(value.fuel?.consumption), pricePerLitre: sanitizeDecimalInput(value.fuel?.pricePerLitre) }, marketScenarios, resultLabel: ["Beneficio estimado", "Ahorro estimado", "Margen estimado"].includes(value.resultLabel) ? value.resultLabel : "Beneficio estimado" };
}

export function calculateFuel(value = {}) { const kilometres = parseCostNumber(value.kilometres); const consumption = parseCostNumber(value.consumption); const pricePerLitre = parseCostNumber(value.pricePerLitre); const valid = kilometres > 0 && consumption > 0 && pricePerLitre > 0; const litres = valid ? (kilometres * consumption) / 100 : 0; return { kilometres, consumption, pricePerLitre, litres, cost: valid ? litres * pricePerLitre : 0, valid }; }

export function calculateCostOperation(value) {
  const state = normalizeCostCalculatorState(value); const copartWithFees = parseCostNumber(state.expenses.copartWithFees); const genericPurchase = parseCostNumber(state.expenses.purchase); const acquisitionCost = copartWithFees || genericPurchase;
  const fieldAmounts = Object.fromEntries(COST_EXPENSE_FIELDS.map(({ id }) => [id, parseCostNumber(state.expenses[id])])); fieldAmounts.copartBidMax = 0; fieldAmounts.purchase = copartWithFees ? 0 : genericPurchase;
  const categoryTotals = Object.fromEntries(COST_EXPENSE_SECTIONS.map((section) => [section.id, roundMoney(section.fields.reduce((total, item) => total + fieldAmounts[item.id], 0))]));
  const costBase = roundMoney(Object.values(categoryTotals).reduce((total, amount) => total + amount, 0)); const vatBase = state.vatEnabled ? roundMoney(COST_VAT_FIELDS.reduce((total, item) => total + (state.vat21[item.id] ? fieldAmounts[item.id] : 0), 0)) : 0; const vatAmount = roundMoney(vatBase * 0.21); const vatTotal = roundMoney(vatBase + vatAmount); const totalCost = roundMoney(costBase + vatAmount);
  const scenarios = state.marketScenarios.filter((scenario) => scenario.priceSpain !== "").map((scenario) => ({ ...scenario, price: parseCostNumber(scenario.priceSpain), result: roundMoney(parseCostNumber(scenario.priceSpain) - totalCost) }));
  return { state, fieldAmounts, categoryTotals, acquisitionCost, copartBidMax: parseCostNumber(state.expenses.copartBidMax), copartWithFees, genericPurchase, fees: fieldAmounts.fees, costBase, vatBase, vatAmount, vatTotal, totalCost, scenarios };
}

export function costCalculatorHasData(value) { const state = normalizeCostCalculatorState(value); return COST_EXPENSE_FIELDS.some(({ id }) => sanitizeDecimalInput(state.expenses[id]) !== "") || Object.values(state.fuel).some((item) => sanitizeDecimalInput(item) !== "") || Object.entries(state.vehicle).some(([id, item]) => id !== "taxRegime" && Boolean(item)) || state.marketScenarios.some((item) => item.label || item.priceSpain); }
export function fuelCostInputValue(fuel) { const result = calculateFuel(fuel); return result.valid ? String(roundMoney(result.cost)) : ""; }

export function costReportFileName(vehicle = {}) {
  const vehicleParts = [vehicle.make, vehicle.model, vehicle.trim, vehicle.year]
    .map((part) => normalizeText(part, 80))
    .filter(Boolean)
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return vehicleParts ? `IvanImports-${vehicleParts}-Analisis.pdf` : "IvanImports-Analisis-Operacion.pdf";
}
