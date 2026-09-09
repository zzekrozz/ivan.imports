export const KAIROS_BUDGET_VERSION = 1;
export const DEFAULT_VAT_RATE = 21;
export const MAX_BUDGETS = 50;
const now = () => new Date().toISOString();
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
const finite = (value) => {
    if (value === "" || value === null || value === undefined)
        return 0;
    const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const text = (value, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const expense = (expenseId, category, name, includedInPurchase = false) => ({
    id: expenseId,
    category,
    name,
    amount: "",
    vatIncluded: false,
    deductibleVat: "",
    country: category === "MATRICULACIÓN" ? "España" : "",
    note: "",
    includedInPurchase,
    custom: false,
});
export const REQUIRED_EXPENSES = Object.freeze([
    expense("copart-commission", "SUBASTA", "Comisión Copart", true),
    expense("copart-other", "SUBASTA", "Otros gastos Copart", true),
    expense("travel-flight", "VIAJE", "Vuelo"),
    expense("travel-hotel", "VIAJE", "Hotel"),
    expense("travel-fuel-de", "VIAJE", "Combustible Alemania"),
    expense("travel-fuel-es", "VIAJE", "Combustible España"),
    expense("travel-tolls", "VIAJE", "Peajes"),
    expense("travel-parking", "VIAJE", "Parking"),
    expense("travel-taxi", "VIAJE", "Taxi / transporte"),
    expense("travel-food", "VIAJE", "Comida"),
    expense("travel-other", "VIAJE", "Otros"),
    expense("vehicle-transport", "VEHÍCULO", "Transporte"),
    expense("vehicle-plates", "VEHÍCULO", "Placas temporales"),
    expense("vehicle-insurance", "VEHÍCULO", "Seguro temporal"),
    expense("vehicle-repairs", "VEHÍCULO", "Reparaciones"),
    expense("vehicle-cleaning", "VEHÍCULO", "Limpieza"),
    expense("vehicle-diagnosis", "VEHÍCULO", "Diagnosis"),
    expense("vehicle-other", "VEHÍCULO", "Otros"),
    expense("registration-itv", "MATRICULACIÓN", "ITV"),
    expense("registration-sheet", "MATRICULACIÓN", "Ficha reducida"),
    expense("registration-coc", "MATRICULACIÓN", "COC"),
    expense("registration-576", "MATRICULACIÓN", "Impuesto matriculación · Modelo 576"),
    expense("registration-ivtm", "MATRICULACIÓN", "Impuesto circulación"),
    expense("registration-dgt", "MATRICULACIÓN", "Tasa DGT 1.1"),
    expense("registration-plates", "MATRICULACIÓN", "Matrículas"),
    expense("registration-agency", "MATRICULACIÓN", "Gestoría"),
    expense("registration-other", "MATRICULACIÓN", "Otros"),
]);
const emptyVehicle = () => ({ make: "", model: "", year: "", mileage: "", fuel: "", transmission: "", color: "", taxRegime: "No consta", copartLocation: "", listingUrl: "", marketSpain: "", notes: "", photoDataUrl: "" });
export function createEmptyKairosBudget() {
    const createdAt = now();
    return {
        id: id("budget"), createdAt, updatedAt: createdAt, status: "BORRADOR", view: "internal",
        vehicle: emptyVehicle(),
        purchase: { hammer: "", totalRebu: "" },
        expenses: REQUIRED_EXPENSES.map((item) => ({ ...item })),
        recovery: { includeForeignVat: false },
        pricing: { vatRate: DEFAULT_VAT_RATE, targetProfit: "", buffer: "", finalPrice: "" },
        client: { mode: "estimated", estimatedMin: "", estimatedMax: "", detail: "simple", validityDays: 7 },
        alerts: { savingsThreshold: 5, expenseRatioThreshold: 15 },
    };
}
function normalizeExpense(value, fallback) {
    const amount = value.amount === "" ? "" : finite(value.amount);
    const deductibleVat = value.deductibleVat === "" ? "" : Math.min(finite(value.deductibleVat), finite(amount));
    const category = (["SUBASTA", "VIAJE", "VEHÍCULO", "MATRICULACIÓN", "PERSONALIZADO"].includes(String(value.category)) ? value.category : fallback?.category || "PERSONALIZADO");
    return {
        id: text(value.id, 80) || fallback?.id || id("expense"),
        category,
        name: text(value.name, 120) || fallback?.name || "Gasto personalizado",
        amount,
        vatIncluded: Boolean(value.vatIncluded),
        deductibleVat,
        country: text(value.country, 80) || fallback?.country || "",
        note: text(value.note, 300),
        includedInPurchase: Boolean(fallback?.includedInPurchase || value.includedInPurchase),
        custom: Boolean(value.custom || (!fallback && category === "PERSONALIZADO")),
    };
}
export function normalizeKairosBudget(value) {
    const base = createEmptyKairosBudget();
    if (!value || typeof value !== "object")
        return base;
    const source = value;
    const sourceExpenses = Array.isArray(source.expenses) ? source.expenses : [];
    const required = REQUIRED_EXPENSES.map((fallback) => normalizeExpense(sourceExpenses.find((item) => item?.id === fallback.id) || {}, fallback));
    const custom = sourceExpenses.filter((item) => item && !REQUIRED_EXPENSES.some((requiredItem) => requiredItem.id === item.id)).map((item) => normalizeExpense(item));
    const statuses = ["BORRADOR", "ENVIADO", "CLIENTE INTERESADO", "RESERVADO", "PUJANDO", "ADJUDICADO", "PERDIDO", "FINALIZADO"];
    const vehicle = source.vehicle || base.vehicle;
    return {
        ...base,
        id: text(source.id, 80) || base.id,
        createdAt: text(source.createdAt, 40) || base.createdAt,
        updatedAt: text(source.updatedAt, 40) || base.updatedAt,
        status: statuses.includes(source.status) ? source.status : "BORRADOR",
        view: source.view === "client" ? "client" : "internal",
        vehicle: {
            make: text(vehicle.make, 80), model: text(vehicle.model, 100), year: text(vehicle.year, 10), mileage: text(vehicle.mileage, 20),
            fuel: text(vehicle.fuel, 50), transmission: text(vehicle.transmission, 50), color: text(vehicle.color, 50), taxRegime: (["No consta", "Sin REBU", "Con REBU"].includes(String(vehicle.taxRegime)) ? vehicle.taxRegime : "No consta"), copartLocation: text(vehicle.copartLocation, 120),
            listingUrl: text(vehicle.listingUrl, 500), marketSpain: vehicle.marketSpain === "" ? "" : finite(vehicle.marketSpain), notes: text(vehicle.notes, 1000),
            photoDataUrl: typeof vehicle.photoDataUrl === "string" && /^data:image\/(?:png|jpeg|webp);base64,/i.test(vehicle.photoDataUrl) ? vehicle.photoDataUrl.slice(0, 2_800_000) : "",
        },
        purchase: { hammer: source.purchase?.hammer === "" ? "" : finite(source.purchase?.hammer), totalRebu: source.purchase?.totalRebu === "" ? "" : finite(source.purchase?.totalRebu) },
        expenses: [...required, ...custom],
        recovery: { includeForeignVat: Boolean(source.recovery?.includeForeignVat) },
        pricing: {
            vatRate: Math.min(100, finite(source.pricing?.vatRate ?? DEFAULT_VAT_RATE)),
            targetProfit: source.pricing?.targetProfit === "" ? "" : finite(source.pricing?.targetProfit),
            buffer: source.pricing?.buffer === "" ? "" : finite(source.pricing?.buffer),
            finalPrice: source.pricing?.finalPrice === "" ? "" : finite(source.pricing?.finalPrice),
        },
        client: {
            mode: source.client?.mode === "closed" ? "closed" : "estimated",
            estimatedMin: source.client?.estimatedMin === "" ? "" : finite(source.client?.estimatedMin),
            estimatedMax: source.client?.estimatedMax === "" ? "" : finite(source.client?.estimatedMax),
            detail: source.client?.detail === "detailed" ? "detailed" : "simple",
            validityDays: Math.max(1, Math.min(90, Math.round(finite(source.client?.validityDays) || 7))),
        },
        alerts: {
            savingsThreshold: Math.min(100, finite(source.alerts?.savingsThreshold ?? 5)),
            expenseRatioThreshold: Math.min(100, finite(source.alerts?.expenseRatioThreshold ?? 15)),
        },
    };
}
export function createKairosBudgetStore(budget = createEmptyKairosBudget()) {
    const normalized = normalizeKairosBudget(budget);
    return { version: KAIROS_BUDGET_VERSION, currentId: normalized.id, budgets: [normalized] };
}
export function normalizeKairosBudgetStore(value) {
    if (!value || typeof value !== "object")
        return createKairosBudgetStore();
    const source = value;
    const budgets = Array.isArray(source.budgets) ? source.budgets.slice(0, MAX_BUDGETS).map(normalizeKairosBudget) : [];
    if (!budgets.length)
        return createKairosBudgetStore();
    const currentId = budgets.some((budget) => budget.id === source.currentId) ? String(source.currentId) : budgets[0].id;
    return { version: KAIROS_BUDGET_VERSION, currentId, budgets };
}
export function currentKairosBudget(store) {
    return store.budgets.find((budget) => budget.id === store.currentId) || store.budgets[0];
}
export function expenseById(budget, expenseId) {
    return budget.expenses.find((item) => item.id === expenseId);
}
export function calculateKairosBudget(value) {
    const budget = normalizeKairosBudget(value);
    const hammer = finite(budget.purchase.hammer);
    const copartCommission = finite(expenseById(budget, "copart-commission")?.amount);
    const copartOther = finite(expenseById(budget, "copart-other")?.amount);
    const automaticPurchaseTotal = roundMoney(hammer + copartCommission + copartOther);
    const purchaseRebu = budget.purchase.totalRebu === "" ? automaticPurchaseTotal : finite(budget.purchase.totalRebu);
    const operating = budget.expenses.filter((item) => !item.includedInPurchase);
    const operatingExpensesGross = roundMoney(operating.reduce((total, item) => total + finite(item.amount), 0));
    const recoverableFor = (item) => item.vatIncluded ? Math.min(finite(item.deductibleVat), finite(item.amount)) : 0;
    const isSpain = (country) => /^(españa|espana|spain|es)$/i.test(country.trim());
    const spanishRecoverableVat = roundMoney(operating.filter((item) => isSpain(item.country)).reduce((total, item) => total + recoverableFor(item), 0));
    const foreignRecoverableVat = roundMoney(operating.filter((item) => !isSpain(item.country)).reduce((total, item) => total + recoverableFor(item), 0));
    const recoverableVat = roundMoney(spanishRecoverableVat + (budget.recovery.includeForeignVat ? foreignRecoverableVat : 0));
    const netExpenses = roundMoney(Math.max(0, operatingExpensesGross - recoverableVat));
    const targetProfit = finite(budget.pricing.targetProfit);
    const buffer = finite(budget.pricing.buffer);
    const vatRate = finite(budget.pricing.vatRate);
    const multiplier = 1 + (vatRate / 100);
    const requiredSalePrice = roundMoney(purchaseRebu + ((netExpenses + targetProfit + buffer) * multiplier));
    const finalPrice = finite(budget.pricing.finalPrice) || requiredSalePrice;
    const marginRebu = roundMoney(finalPrice - purchaseRebu);
    const vatRebu = roundMoney(marginRebu * vatRate / (100 + vatRate || 1));
    const netMarginRebu = roundMoney(marginRebu - vatRebu);
    const realProfit = roundMoney(finalPrice - purchaseRebu - vatRebu - netExpenses - buffer);
    const maximumPurchase = roundMoney(Math.max(0, finalPrice - ((netExpenses + targetProfit + buffer) * multiplier)));
    const maximumHammer = roundMoney(Math.max(0, maximumPurchase - copartCommission - copartOther));
    const reservationBase = hammer || Math.max(0, maximumHammer);
    const reservation = roundMoney(Math.max(reservationBase * 0.10, 500));
    const marketSpain = finite(budget.vehicle.marketSpain);
    const clientSavings = roundMoney(marketSpain - finalPrice);
    const clientSavingsPercent = marketSpain > 0 ? roundMoney((clientSavings / marketSpain) * 100) : 0;
    const saleMarginPercent = finalPrice > 0 ? roundMoney((realProfit / finalPrice) * 100) : 0;
    const invested = purchaseRebu + netExpenses + buffer;
    const roiPercent = invested > 0 ? roundMoney((realProfit / invested) * 100) : 0;
    const profitOnPurchasePercent = purchaseRebu > 0 ? roundMoney((realProfit / purchaseRebu) * 100) : 0;
    const expenseRatioPercent = finalPrice > 0 ? roundMoney((netExpenses / finalPrice) * 100) : 0;
    const categoryTotals = Object.fromEntries(["SUBASTA", "VIAJE", "VEHÍCULO", "MATRICULACIÓN", "PERSONALIZADO"].map((category) => [category, roundMoney(budget.expenses.filter((item) => item.category === category && !item.includedInPurchase).reduce((total, item) => total + finite(item.amount), 0))]));
    const alerts = [];
    if (!purchaseRebu)
        alerts.push({ level: "warning", text: "Falta el precio de compra REBU." });
    if (!finalPrice)
        alerts.push({ level: "warning", text: "Falta el precio final del cliente." });
    if (finalPrice > 0 && marginRebu > 0 && vatRate === 0)
        alerts.push({ level: "warning", text: "El IVA REBU no está calculado porque el tipo configurado es 0 %." });
    if (finalPrice > 0 && marginRebu <= 0)
        alerts.push({ level: "danger", text: "El precio de venta no cubre la compra REBU." });
    if (finalPrice > 0 && realProfit < 0)
        alerts.push({ level: "danger", text: "El precio de venta no cubre la compra, los gastos, el IVA REBU y el colchón previstos." });
    if (targetProfit > 0 && realProfit < targetProfit)
        alerts.push({ level: "warning", text: `Esta operación dejaría ${formatEuro(realProfit)} frente a los ${formatEuro(targetProfit)} de beneficio objetivo.` });
    if (marketSpain > 0 && finalPrice > marketSpain)
        alerts.push({ level: "danger", text: "El precio final supera el valor comparable indicado para España." });
    if (marketSpain > 0 && clientSavingsPercent < budget.alerts.savingsThreshold)
        alerts.push({ level: "warning", text: `El ahorro para el cliente está por debajo del ${formatPercent(budget.alerts.savingsThreshold)} configurado.` });
    if (finalPrice > 0 && expenseRatioPercent > budget.alerts.expenseRatioThreshold)
        alerts.push({ level: "warning", text: `Los gastos netos superan el ${formatPercent(budget.alerts.expenseRatioThreshold)} del precio final.` });
    if (hammer > 0 && finalPrice > 0 && hammer > maximumHammer)
        alerts.push({ level: "danger", text: `No pujar: la puja máxima rentable con estos datos es ${formatEuro(maximumHammer)}.` });
    if (reservation < 500)
        alerts.push({ level: "danger", text: "La reserva calculada no alcanza el mínimo de 500 €." });
    const signal = marketSpain <= 0 || finalPrice <= 0 ? "neutral" : clientSavings < 0 || realProfit < 0 ? "red" : clientSavingsPercent < budget.alerts.savingsThreshold || realProfit < targetProfit ? "yellow" : "green";
    return { budget, hammer, copartCommission, copartOther, automaticPurchaseTotal, purchaseRebu, operatingExpensesGross, spanishRecoverableVat, foreignRecoverableVat, recoverableVat, netExpenses, targetProfit, buffer, vatRate, multiplier, requiredSalePrice, finalPrice, marginRebu, vatRebu, netMarginRebu, realProfit, maximumPurchase, maximumHammer, reservation, marketSpain, clientSavings, clientSavingsPercent, saleMarginPercent, roiPercent, profitOnPurchasePercent, expenseRatioPercent, signal, alerts, categoryTotals };
}
export function addCustomExpense(budget) {
    return normalizeKairosBudget({ ...budget, expenses: [...budget.expenses, { ...expense(id("expense"), "PERSONALIZADO", "Gasto personalizado"), custom: true }] });
}
export function duplicateKairosBudget(store) {
    if (store.budgets.length >= MAX_BUDGETS)
        return store;
    const source = currentKairosBudget(store);
    const createdAt = now();
    const copy = normalizeKairosBudget({ ...source, id: id("budget"), createdAt, updatedAt: createdAt, status: "BORRADOR", vehicle: { ...source.vehicle, notes: source.vehicle.notes } });
    return { ...store, currentId: copy.id, budgets: [...store.budgets, copy] };
}
export function migrateLegacyCostCalculator(value) {
    if (!value || typeof value !== "object")
        return null;
    const legacy = value;
    if (![2, 3, 4].includes(Number(legacy.version || legacy.schemaVersion)))
        return null;
    const budget = createEmptyKairosBudget();
    const vehicle = legacy.vehicle || {};
    budget.vehicle = { ...budget.vehicle, make: text(vehicle.make, 80), model: text(vehicle.model, 100), year: text(vehicle.year, 10), mileage: text(vehicle.mileage, 20), fuel: text(vehicle.fuel, 50), transmission: text(vehicle.transmission, 50), color: text(vehicle.color, 50), taxRegime: (["Sin REBU", "Con REBU"].includes(String(vehicle.taxRegime)) ? vehicle.taxRegime : "No consta"), listingUrl: text(vehicle.listingUrl, 500), notes: text(vehicle.notes, 1000), marketSpain: finite(legacy.marketScenarios?.[0]?.priceSpain) || "" };
    budget.purchase.hammer = finite(legacy.expenses?.copartBidMax) || "";
    budget.purchase.totalRebu = finite(legacy.expenses?.copartWithFees || legacy.expenses?.purchase) || "";
    const mapping = { fees: "vehicle-other", flight: "travel-flight", localTransport: "travel-taxi", exportPlates: "vehicle-plates", temporaryInsurance: "vehicle-insurance", fuelCost: "travel-fuel-de", tolls: "travel-tolls", hotel: "travel-hotel", food: "travel-food", travelOther: "travel-other", itv: "registration-itv", coc: "registration-coc", dgt: "registration-dgt", ivtm: "registration-ivtm", iedmt: "registration-576", registrationPlates: "registration-plates", agency: "registration-agency", administrationOther: "registration-other", maintenance: "vehicle-other", repairs: "vehicle-repairs", detailing: "vehicle-cleaning", vehicleTransport: "vehicle-transport", other: "vehicle-other" };
    Object.entries(mapping).forEach(([legacyId, expenseId]) => { const target = expenseById(budget, expenseId); const amount = finite(legacy.expenses?.[legacyId]); if (target && amount)
        target.amount = roundMoney(finite(target.amount) + amount); });
    return normalizeKairosBudget(budget);
}
export function formatEuro(value) {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}
export function formatPercent(value) {
    return `${new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0)} %`;
}
export function budgetDisplayName(budget) {
    return [budget.vehicle.make, budget.vehicle.model, budget.vehicle.year].filter(Boolean).join(" ") || `Presupuesto ${new Intl.DateTimeFormat("es-ES").format(new Date(budget.createdAt))}`;
}
export function safePdfFileName(budget, kind) {
    const vehicle = [budget.vehicle.make, budget.vehicle.model, budget.vehicle.year].filter(Boolean).join("-").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return `KAIROS-${vehicle ? `${vehicle}-` : ""}Presupuesto-${kind}.pdf`;
}
export function clientPdfModel(value) {
    const model = calculateKairosBudget(value);
    const budget = model.budget;
    return Object.freeze({
        vehicle: { make: budget.vehicle.make, model: budget.vehicle.model, year: budget.vehicle.year, mileage: budget.vehicle.mileage, fuel: budget.vehicle.fuel, transmission: budget.vehicle.transmission, color: budget.vehicle.color, taxRegime: budget.vehicle.taxRegime === "No consta" ? "" : budget.vehicle.taxRegime, location: budget.vehicle.copartLocation, photoDataUrl: budget.vehicle.photoDataUrl },
        marketSpain: model.marketSpain,
        recommendedHammer: model.hammer || Math.max(0, model.maximumHammer),
        mode: budget.client.mode,
        estimatedMin: finite(budget.client.estimatedMin),
        estimatedMax: finite(budget.client.estimatedMax),
        finalPrice: model.finalPrice,
        clientSavings: model.clientSavings,
        clientSavingsPercent: model.clientSavingsPercent,
        reservation: model.reservation,
        detail: budget.client.detail,
        validityDays: budget.client.validityDays,
        createdAt: budget.createdAt,
    });
}
