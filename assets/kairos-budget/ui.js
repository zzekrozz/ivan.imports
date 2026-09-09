import { MAX_BUDGETS, addCustomExpense, budgetDisplayName, calculateKairosBudget, clientPdfModel, createEmptyKairosBudget, createKairosBudgetStore, currentKairosBudget, duplicateKairosBudget, expenseById, formatEuro, formatPercent, migrateLegacyCostCalculator, normalizeKairosBudgetStore, safePdfFileName, } from "./domain.js";
const STORAGE_KEY = "ivanimports.kairos.copart-budgets.v1";
const STYLE_ID = "kairos-budget-style";
const STATUS_OPTIONS = ["BORRADOR", "ENVIADO", "CLIENTE INTERESADO", "RESERVADO", "PUJANDO", "ADJUDICADO", "PERDIDO", "FINALIZADO"];
const INTERNAL_FIELDS = new Set(["targetProfit", "buffer", "totalRebu", "vatRate", "deductibleVat", "includeForeignVat"]);
const NUMERIC_PATHS = new Set(["vehicle.marketSpain", "purchase.hammer", "purchase.totalRebu", "pricing.vatRate", "pricing.targetProfit", "pricing.buffer", "pricing.finalPrice", "client.estimatedMin", "client.estimatedMax", "client.validityDays", "alerts.savingsThreshold", "alerts.expenseRatioThreshold"]);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] || character);
const attr = escapeHtml;
const numeric = (value) => value === "" ? "" : String(value);
const signedEuro = (value) => value > 0 ? `+${formatEuro(value)}` : formatEuro(value);
const expenseCategories = ["VIAJE", "VEHÍCULO", "MATRICULACIÓN", "PERSONALIZADO"];
function loadStore(legacyState) {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw)
            return normalizeKairosBudgetStore(JSON.parse(raw));
    }
    catch (error) {
        console.warn("No se pudo leer el presupuesto KAIROS guardado.", error);
    }
    const migrated = migrateLegacyCostCalculator(legacyState);
    const store = createKairosBudgetStore(migrated || createEmptyKairosBudget());
    saveStore(store);
    return store;
}
function saveStore(store) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeKairosBudgetStore(store)));
    }
    catch (error) {
        console.warn("No se pudo guardar el presupuesto KAIROS.", error);
    }
}
function ensureStyle() {
    if (document.getElementById(STYLE_ID))
        return;
    const link = document.createElement("link");
    link.id = STYLE_ID;
    link.rel = "stylesheet";
    link.href = "/assets/kairos-budget/style.css?v=1";
    document.head.append(link);
}
function field(label, path, value, options = {}) {
    const inputId = `kb-${path.replace(/[^a-z0-9]+/gi, "-")}`;
    const type = options.type || "text";
    return `<div class="kb-field${options.wide ? " kb-field--wide" : ""}"><label for="${inputId}">${escapeHtml(label)}</label><input id="${inputId}" type="${type}"${type === "number" ? ` inputmode="decimal" min="${options.min ?? 0}"${options.max !== undefined ? ` max="${options.max}"` : ""} step="${options.step || "0.01"}"` : ""} value="${attr(value)}" placeholder="${attr(options.placeholder || "")}" data-kb-field="${attr(path)}">${options.help ? `<small>${escapeHtml(options.help)}</small>` : ""}</div>`;
}
function selectField(label, path, value, options, labels = {}) {
    const inputId = `kb-${path.replace(/[^a-z0-9]+/gi, "-")}`;
    return `<div class="kb-field"><label for="${inputId}">${escapeHtml(label)}</label><select id="${inputId}" data-kb-field="${attr(path)}">${options.map((option) => `<option value="${attr(option)}"${option === value ? " selected" : ""}>${escapeHtml(labels[option] || option)}</option>`).join("")}</select></div>`;
}
function vehicleFields(budget) {
    const vehicle = budget.vehicle;
    return `<div class="kb-form-grid">
    ${field("Marca", "vehicle.make", vehicle.make, { placeholder: "Volkswagen" })}
    ${field("Modelo", "vehicle.model", vehicle.model, { placeholder: "Passat" })}
    ${field("Año", "vehicle.year", vehicle.year, { placeholder: "2025" })}
    ${field("Kilómetros", "vehicle.mileage", vehicle.mileage, { placeholder: "40.570" })}
    ${field("Combustible", "vehicle.fuel", vehicle.fuel, { placeholder: "Diésel" })}
    ${field("Cambio", "vehicle.transmission", vehicle.transmission, { placeholder: "Automático" })}
    ${field("Color", "vehicle.color", vehicle.color, { placeholder: "Gris" })}
    ${selectField("Régimen fiscal", "vehicle.taxRegime", vehicle.taxRegime, ["No consta", "Sin REBU", "Con REBU"])}
    ${field("Ubicación Copart", "vehicle.copartLocation", vehicle.copartLocation, { placeholder: "München" })}
    ${field("URL del anuncio Copart", "vehicle.listingUrl", vehicle.listingUrl, { type: "url", placeholder: "https://www.copart.de/...", wide: true })}
    ${field("Valor vehículo comparable en España", "vehicle.marketSpain", numeric(vehicle.marketSpain), { type: "number", placeholder: "29000" })}
    <div class="kb-field kb-field--wide"><label for="kb-vehicle-notes">Observaciones</label><textarea id="kb-vehicle-notes" maxlength="1000" data-kb-field="vehicle.notes" placeholder="Estado, equipamiento o condiciones relevantes">${escapeHtml(vehicle.notes)}</textarea></div>
    <div class="kb-field kb-field--wide"><label for="kb-photo">Foto del vehículo <span>opcional</span></label><input id="kb-photo" type="file" accept="image/png,image/jpeg,image/webp" data-kb-photo><small>JPG, PNG o WebP, máximo 2 MB. Se guarda solo en este dispositivo.</small>${vehicle.photoDataUrl ? `<div class="kb-photo-preview"><img src="${attr(vehicle.photoDataUrl)}" alt="Foto guardada del vehículo"><button type="button" class="kb-link" data-kb-action="remove-photo">Quitar foto</button></div>` : ""}</div>
  </div>`;
}
function purchaseSection(budget, model) {
    const commission = expenseById(budget, "copart-commission");
    const other = expenseById(budget, "copart-other");
    const purchaseExpense = (item, label) => `<div class="kb-field"><label for="kb-${item.id}">${label}</label><div class="kb-money"><input id="kb-${item.id}" type="number" inputmode="decimal" min="0" step="0.01" value="${attr(numeric(item.amount))}" data-kb-expense-id="${item.id}" data-kb-expense-field="amount"><span>€</span></div></div>`;
    return `<section class="kb-card" aria-labelledby="kb-purchase-title"><div class="kb-section-head"><div><span>02</span><h2 id="kb-purchase-title">Compra en Copart</h2></div><p>El total automático suma martillo, comisión y otros gastos Copart. Si introduces un total REBU manual, será el utilizado.</p></div>
    <div class="kb-form-grid kb-form-grid--purchase">
      ${field("Puja máxima Copart / precio martillo", "purchase.hammer", numeric(budget.purchase.hammer), { type: "number", placeholder: "14000" })}
      ${purchaseExpense(commission, "Comisión Copart")}
      ${purchaseExpense(other, "Otros gastos Copart")}
      ${field("Precio total compra REBU", "purchase.totalRebu", numeric(budget.purchase.totalRebu), { type: "number", placeholder: String(model.automaticPurchaseTotal), help: budget.purchase.totalRebu === "" ? `Automático: ${formatEuro(model.automaticPurchaseTotal)}` : "Valor manual activo. Vacíalo para volver al automático." })}
    </div>
    <div class="kb-number-strip"><div><span>Puja máxima</span><strong data-kb-output="hammer">${formatEuro(model.hammer)}</strong></div><div><span>Comisión Copart</span><strong data-kb-output="copartCommission">${formatEuro(model.copartCommission)}</strong></div><div class="is-primary"><span>Total compra Copart</span><strong data-kb-output="purchaseRebu">${formatEuro(model.purchaseRebu)}</strong></div></div>
    <details class="kb-inline-details"><summary>IVA, país y notas de los gastos Copart</summary><div class="kb-expense-grid">${expenseEditor(commission)}${expenseEditor(other)}</div><p class="kb-note">Estos importes ya forman parte del total de compra REBU y no se suman otra vez como gastos operativos.</p></details>
  </section>`;
}
function expenseEditor(item) {
    return `<article class="kb-expense" data-kb-expense-card="${attr(item.id)}"><div class="kb-expense-title"><input aria-label="Nombre del gasto" value="${attr(item.name)}" data-kb-expense-id="${attr(item.id)}" data-kb-expense-field="name"${item.custom ? "" : " readonly"}>${item.custom ? `<button type="button" class="kb-icon-button" data-kb-action="remove-expense" data-kb-id="${attr(item.id)}" aria-label="Eliminar ${attr(item.name)}">×</button>` : ""}</div><div class="kb-expense-fields"><label>Importe pagado<div class="kb-money"><input type="number" min="0" step="0.01" value="${attr(numeric(item.amount))}" data-kb-expense-id="${attr(item.id)}" data-kb-expense-field="amount"><span>€</span></div></label><label class="kb-check"><input type="checkbox" data-kb-expense-id="${attr(item.id)}" data-kb-expense-field="vatIncluded"${item.vatIncluded ? " checked" : ""}><span>IVA incluido</span></label><label>IVA deducible<div class="kb-money"><input type="number" min="0" step="0.01" value="${attr(numeric(item.deductibleVat))}" data-kb-expense-id="${attr(item.id)}" data-kb-expense-field="deductibleVat"><span>€</span></div></label><label>País<input maxlength="80" value="${attr(item.country)}" placeholder="España / Alemania" data-kb-expense-id="${attr(item.id)}" data-kb-expense-field="country"></label><label class="kb-expense-note">Nota<input maxlength="300" value="${attr(item.note)}" placeholder="Opcional" data-kb-expense-id="${attr(item.id)}" data-kb-expense-field="note"></label></div></article>`;
}
function expensesSection(budget, model) {
    return `<section class="kb-card" aria-labelledby="kb-expenses-title"><div class="kb-section-head"><div><span>03</span><h2 id="kb-expenses-title">Gastos de la operación</h2></div><button type="button" class="kb-button kb-button--secondary" data-kb-action="add-expense">+ Añadir gasto personalizado</button></div>
    <div class="kb-expense-groups">${expenseCategories.map((category) => { const items = budget.expenses.filter((item) => item.category === category && !item.includedInPurchase); if (!items.length && category === "PERSONALIZADO")
        return ""; return `<details class="kb-expense-group"${category === "VIAJE" ? " open" : ""}><summary><span>${category}</span><strong data-kb-category="${category}">${formatEuro(model.categoryTotals[category])}</strong></summary><div class="kb-expense-grid">${items.map(expenseEditor).join("")}</div></details>`; }).join("")}</div>
    <div class="kb-vat-summary"><div><span>Total gastos pagados</span><strong data-kb-output="operatingExpensesGross">${formatEuro(model.operatingExpensesGross)}</strong></div><div><span>IVA español deducible</span><strong data-kb-output="spanishRecoverableVat">${formatEuro(model.spanishRecoverableVat)}</strong></div><div><span>IVA extranjero potencial</span><strong data-kb-output="foreignRecoverableVat">${formatEuro(model.foreignRecoverableVat)}</strong></div><div class="is-primary"><span>Coste neto real de gastos</span><strong data-kb-output="netExpenses">${formatEuro(model.netExpenses)}</strong></div></div>
    <label class="kb-switch"><input type="checkbox" data-kb-field="recovery.includeForeignVat"${budget.recovery.includeForeignVat ? " checked" : ""}><span><strong>Incluir IVA extranjero recuperable en el beneficio</strong><small>Desactivado por defecto. Confirma siempre si realmente puedes recuperarlo.</small></span></label>
  </section>`;
}
function pricingSection(budget, model) {
    return `<section class="kb-card" aria-labelledby="kb-pricing-title"><div class="kb-section-head"><div><span>04</span><h2 id="kb-pricing-title">Precio, REBU y beneficio</h2></div><p>Cálculo interno. El cliente no verá beneficio, margen, IVA REBU, colchón ni costes netos.</p></div>
    <div class="kb-form-grid">
      ${field("Beneficio objetivo KAIROS", "pricing.targetProfit", numeric(budget.pricing.targetProfit), { type: "number", placeholder: "2000" })}
      ${field("Colchón / imprevistos", "pricing.buffer", numeric(budget.pricing.buffer), { type: "number", placeholder: "300" })}
      ${field("IVA REBU", "pricing.vatRate", budget.pricing.vatRate, { type: "number", min: 0, max: 100, placeholder: "21", help: "Valor configurable; empieza en 21 %." })}
      ${field("Precio final cliente", "pricing.finalPrice", numeric(budget.pricing.finalPrice), { type: "number", placeholder: String(model.requiredSalePrice), help: budget.pricing.finalPrice === "" ? "Se utiliza automáticamente el precio necesario calculado." : "Precio manual activo." })}
    </div>
    <div class="kb-callout kb-callout--price"><div><span>Precio de venta necesario</span><strong data-kb-output="requiredSalePrice">${formatEuro(model.requiredSalePrice)}</strong><small>Compra REBU + (gastos netos + beneficio objetivo + colchón) × factor REBU.</small></div><button class="kb-button kb-button--secondary" type="button" data-kb-action="use-required-price">Usar como precio final</button></div>
    <div class="kb-internal-ledger"><div><span>Precio venta</span><strong data-kb-output="finalPrice">${formatEuro(model.finalPrice)}</strong></div><div><span>Compra REBU</span><strong data-kb-output="purchaseRebu">${formatEuro(model.purchaseRebu)}</strong></div><div><span>Margen REBU</span><strong data-kb-output="marginRebu">${formatEuro(model.marginRebu)}</strong></div><div><span>IVA REBU</span><strong data-kb-output="vatRebu">${formatEuro(model.vatRebu)}</strong></div><div><span>Margen después de IVA</span><strong data-kb-output="netMarginRebu">${formatEuro(model.netMarginRebu)}</strong></div><div><span>Gastos brutos</span><strong data-kb-output="operatingExpensesGross">${formatEuro(model.operatingExpensesGross)}</strong></div><div><span>IVA recuperable aplicado</span><strong data-kb-output="recoverableVat">${formatEuro(model.recoverableVat)}</strong></div><div><span>Gastos netos</span><strong data-kb-output="netExpenses">${formatEuro(model.netExpenses)}</strong></div><div><span>Colchón</span><strong data-kb-output="buffer">${formatEuro(model.buffer)}</strong></div><div class="is-profit"><span>Beneficio real antes de Sociedades</span><strong data-kb-output="realProfit">${formatEuro(model.realProfit)}</strong></div></div>
  </section>`;
}
function inverseSection(model) {
    return `<section class="kb-card kb-inverse" aria-labelledby="kb-inverse-title"><div class="kb-section-head"><div><span>05</span><h2 id="kb-inverse-title">Calculadora inversa</h2></div><p>Parte del precio final y descuenta objetivo, gastos, colchón y componentes de Copart.</p></div><div class="kb-inverse-grid"><div><span>Precio máximo compra Copart</span><strong data-kb-output="maximumPurchase">${formatEuro(model.maximumPurchase)}</strong><small>Total facturado máximo.</small></div><div class="is-primary"><span>Puja máxima de martillo</span><strong data-kb-output="maximumHammer">${formatEuro(model.maximumHammer)}</strong><small>Después de comisión y otros gastos Copart.</small></div><div><span>Reserva necesaria</span><strong data-kb-output="reservation">${formatEuro(model.reservation)}</strong><small>10 % de la puja, mínimo 500 €.</small></div></div></section>`;
}
function alertMarkup(model) {
    return model.alerts.length ? model.alerts.map((alert) => `<div class="kb-alert kb-alert--${alert.level}" role="status"><span aria-hidden="true">${alert.level === "danger" ? "×" : "!"}</span><p>${escapeHtml(alert.text)}</p></div>`).join("") : `<div class="kb-alert kb-alert--success" role="status"><span aria-hidden="true">✓</span><p>No hay alertas con los umbrales configurados.</p></div>`;
}
function internalView(budget, model) {
    return `<div class="kb-workspace" data-kb-view-panel="internal">
    <div class="kb-main">${`<section class="kb-card" aria-labelledby="kb-vehicle-title"><div class="kb-section-head"><div><span>01</span><h2 id="kb-vehicle-title">Datos del vehículo</h2></div><p>Información identificativa y referencia de mercado.</p></div>${vehicleFields(budget)}</section>`}${purchaseSection(budget, model)}${expensesSection(budget, model)}${pricingSection(budget, model)}${inverseSection(model)}</div>
    <aside class="kb-side"><section class="kb-card kb-sticky"><span class="kb-eyebrow">Control interno</span><h2>Rentabilidad</h2><div class="kb-hero-profit" data-kb-signal="${model.signal}"><span>Beneficio real KAIROS</span><strong data-kb-output="realProfit">${formatEuro(model.realProfit)}</strong><small>Antes de Impuesto sobre Sociedades</small></div><dl class="kb-metrics"><div><dt>Margen sobre venta</dt><dd data-kb-output="saleMarginPercent">${formatPercent(model.saleMarginPercent)}</dd></div><div><dt>ROI sobre dinero invertido</dt><dd data-kb-output="roiPercent">${formatPercent(model.roiPercent)}</dd></div><div><dt>Beneficio sobre compra</dt><dd data-kb-output="profitOnPurchasePercent">${formatPercent(model.profitOnPurchasePercent)}</dd></div><div><dt>Ahorro cliente</dt><dd data-kb-output="clientSavings">${signedEuro(model.clientSavings)}</dd></div></dl><div data-kb-alerts>${alertMarkup(model)}</div><button class="kb-button kb-button--primary kb-button--wide" type="button" data-kb-action="pdf-internal">Exportar informe interno</button></section>
      <section class="kb-card"><h2>Configuración de alertas</h2>${field("Ahorro mínimo cliente (%)", "alerts.savingsThreshold", budget.alerts.savingsThreshold, { type: "number", min: 0, max: 100 })}${field("Gastos altos desde (%)", "alerts.expenseRatioThreshold", budget.alerts.expenseRatioThreshold, { type: "number", min: 0, max: 100 })}</section>
      <section class="kb-card kb-commercial-copy"><h2>Texto comercial sugerido</h2><p>«No trabajamos con una comisión separada. Nosotros compramos el vehículo, gestionamos toda la operación y te damos un precio final puesto en España y matriculado. Nuestra gestión y margen comercial ya están incluidos dentro de ese precio.»</p><p>«El precio incluye los costes de subasta, importación, desplazamiento o transporte, ITV, impuestos, tasas, matriculación y gestión completa de la operación.»</p></section>
    </aside>
  </div>`;
}
function includedItems(detail) {
    const simple = ["Vehículo / adquisición", "Importación y matriculación", "Precio final"];
    const detailed = ["Adquisición del vehículo", "Costes de subasta", "Gestión de compra", "Importación / logística", "Desplazamiento o transporte", "ITV", "Impuestos aplicables", "Tasas", "Matriculación", "Gestión documental", "Acompañamiento completo"];
    return (detail === "detailed" ? detailed : simple).map((item) => `<li><span aria-hidden="true">✓</span>${escapeHtml(item)}</li>`).join("");
}
function clientView(budget, model) {
    const title = [budget.vehicle.make, budget.vehicle.model, budget.vehicle.year].filter(Boolean).join(" ") || "Vehículo por definir";
    const vehicleMeta = [budget.vehicle.mileage && `${budget.vehicle.mileage} km`, budget.vehicle.copartLocation, budget.vehicle.fuel, budget.vehicle.transmission, budget.vehicle.taxRegime !== "No consta" && budget.vehicle.taxRegime.toUpperCase()].filter(Boolean).map(escapeHtml).join(" · ");
    const recommendedHammer = model.hammer || Math.max(0, model.maximumHammer);
    const estimatedMin = Number(budget.client.estimatedMin) || model.finalPrice;
    const estimatedMax = Number(budget.client.estimatedMax) || model.finalPrice;
    const priceMarkup = budget.client.mode === "closed" ? `<span>Precio máximo llave en mano</span><strong data-kb-output="finalPrice">${formatEuro(model.finalPrice)}</strong><small>El precio incluye la operación completa hasta entregar el vehículo matriculado en España, salvo circunstancias extraordinarias previamente comunicadas.</small>` : `<span>Precio estimado matriculado</span><strong>${formatEuro(Math.min(estimatedMin, estimatedMax))} – ${formatEuro(Math.max(estimatedMin, estimatedMax))}</strong><small>Estimación inicial sujeta a adjudicación, documentación y comprobaciones de la operación.</small>`;
    return `<div class="kb-client-shell" data-kb-view-panel="client"><section class="kb-client-document" data-kb-signal="${model.signal}"><header><div><span class="kb-brand">KAIROS</span><p>Presupuesto de importación de vehículo</p></div><span class="kb-status">${escapeHtml(budget.status)}</span></header><div class="kb-client-vehicle">${budget.vehicle.photoDataUrl ? `<img src="${attr(budget.vehicle.photoDataUrl)}" alt="${attr(title)}">` : `<div class="kb-photo-empty" aria-hidden="true">K</div>`}<div><h2>${escapeHtml(title)}</h2><p>${vehicleMeta || "Datos pendientes de completar"}</p></div></div><div class="kb-client-numbers"><div><span>Valor aproximado en España</span><strong data-kb-output="marketSpain">${formatEuro(model.marketSpain)}</strong></div><div><span>Puja máxima recomendada</span><strong data-kb-output="recommendedHammer">${formatEuro(recommendedHammer)}</strong></div><div class="is-primary">${priceMarkup}</div><div><span>Ahorro estimado frente al mercado</span><strong data-kb-output="clientSavings">${signedEuro(model.clientSavings)}</strong><small data-kb-output="clientSavingsPercent">${formatPercent(model.clientSavingsPercent)}</small></div></div><section class="kb-client-included"><h3>Incluido</h3><ul>${includedItems(budget.client.detail)}</ul></section><section class="kb-reservation"><div><span>Reserva para activar la operación</span><strong data-kb-output="reservation">${formatEuro(model.reservation)}</strong></div><p>Para activar la operación se solicita una reserva del 10% de la puja máxima, con un mínimo de 500 €. Esta cantidad forma parte del precio final de la operación y no supone un coste adicional.</p></section><footer>Estimación preparada con los datos disponibles. Se confirmará antes de activar la compra.</footer></section>
    <aside class="kb-client-controls"><section class="kb-card"><h2>Presentación al cliente</h2>${selectField("Modo de presupuesto", "client.mode", budget.client.mode, ["estimated", "closed"], { estimated: "Precio estimado", closed: "Precio máximo cerrado" })}${budget.client.mode === "estimated" ? `${field("Desde", "client.estimatedMin", numeric(budget.client.estimatedMin), { type: "number", placeholder: String(model.finalPrice) })}${field("Hasta", "client.estimatedMax", numeric(budget.client.estimatedMax), { type: "number", placeholder: String(model.finalPrice) })}` : ""}${selectField("Nivel de detalle", "client.detail", budget.client.detail, ["simple", "detailed"], { simple: "Simple", detailed: "Detallado" })}${field("Validez del presupuesto (días)", "client.validityDays", budget.client.validityDays, { type: "number", min: 1, max: 90, step: "1" })}<button class="kb-button kb-button--primary kb-button--wide" type="button" data-kb-action="pdf-client">Generar PDF cliente</button><p class="kb-privacy-note"><strong>Vista comercial:</strong> el documento cliente se genera únicamente con la propuesta y los datos visibles en esta pantalla.</p></section></aside></div>`;
}
function topCards(budget, model) {
    if (budget.view === "client")
        return `<div class="kb-top-cards kb-top-cards--client"><div><span>Mercado España</span><strong data-kb-output="marketSpain">${formatEuro(model.marketSpain)}</strong></div><div><span>Precio final</span><strong data-kb-output="finalPrice">${formatEuro(model.finalPrice)}</strong></div><div data-kb-signal="${model.signal}"><span>Ahorro cliente</span><strong data-kb-output="clientSavings">${signedEuro(model.clientSavings)}</strong></div><div><span>Reserva</span><strong data-kb-output="reservation">${formatEuro(model.reservation)}</strong></div></div>`;
    return `<div class="kb-top-cards"><div><span>Mercado España</span><strong data-kb-output="marketSpain">${formatEuro(model.marketSpain)}</strong></div><div><span>Precio final cliente</span><strong data-kb-output="finalPrice">${formatEuro(model.finalPrice)}</strong></div><div data-kb-signal="${model.signal}"><span>Ahorro cliente</span><strong data-kb-output="clientSavings">${signedEuro(model.clientSavings)}</strong></div><div><span>Puja máxima rentable</span><strong data-kb-output="maximumHammer">${formatEuro(model.maximumHammer)}</strong></div><div class="is-private"><span>Beneficio real KAIROS</span><strong data-kb-output="realProfit">${formatEuro(model.realProfit)}</strong></div></div>`;
}
function renderWorkspace(store) {
    const budget = currentKairosBudget(store);
    const model = calculateKairosBudget(budget);
    return `<section class="kairos-budget" data-kairos-budget data-view="${budget.view}"><div class="kb-toolbar"><div class="kb-budget-picker"><label for="kb-budget-select">Presupuesto activo</label><select id="kb-budget-select" data-kb-select>${store.budgets.map((item) => `<option value="${attr(item.id)}"${item.id === budget.id ? " selected" : ""}>${escapeHtml(budgetDisplayName(item))} · ${escapeHtml(item.status)}</option>`).join("")}</select></div><div class="kb-toolbar-actions"><button class="kb-button kb-button--secondary" type="button" data-kb-action="new"${store.budgets.length >= MAX_BUDGETS ? " disabled" : ""}>Nuevo</button><button class="kb-button kb-button--secondary" type="button" data-kb-action="duplicate"${store.budgets.length >= MAX_BUDGETS ? " disabled" : ""}>Duplicar</button><button class="kb-button kb-button--secondary" type="button" data-kb-action="save">Guardar</button><button class="kb-button kb-button--danger" type="button" data-kb-action="delete">Eliminar</button></div><div class="kb-status-field"><label for="kb-status">Estado</label><select id="kb-status" data-kb-field="status">${STATUS_OPTIONS.map((status) => `<option${status === budget.status ? " selected" : ""}>${status}</option>`).join("")}</select></div></div><div class="kb-view-tabs" role="tablist" aria-label="Vista del presupuesto"><button type="button" role="tab" aria-selected="${budget.view === "internal"}" data-kb-action="view-internal">Vista interna</button><button type="button" role="tab" aria-selected="${budget.view === "client"}" data-kb-action="view-client">Vista cliente</button><p>${budget.view === "internal" ? "Todos los cálculos reales. No compartas capturas de esta vista." : "Solo información comercial preparada para compartir."}</p></div>${topCards(budget, model)}${budget.view === "internal" ? internalView(budget, model) : clientView(budget, model)}<div class="kb-toast" data-kb-toast role="status" aria-live="polite"></div></section>`;
}
export function renderKairosBudgetApp(legacyState) {
    return renderWorkspace(loadStore(legacyState));
}
function setPath(target, path, rawValue) {
    const parts = path.split(".");
    const key = parts.pop();
    let object = target;
    parts.forEach((part) => { object = object[part] ||= {}; });
    const current = object[key];
    if (typeof current === "boolean")
        object[key] = Boolean(rawValue);
    else if (NUMERIC_PATHS.has(path) || typeof current === "number") {
        if (rawValue === "")
            object[key] = "";
        else {
            const value = Number(rawValue);
            object[key] = Number.isFinite(value) && value >= 0 ? value : "";
        }
    }
    else
        object[key] = String(rawValue ?? "").slice(0, key === "notes" ? 1000 : 500);
}
function updateOutputs(root, budget) {
    const model = calculateKairosBudget(budget);
    const currencyOutputs = { hammer: model.hammer, copartCommission: model.copartCommission, purchaseRebu: model.purchaseRebu, operatingExpensesGross: model.operatingExpensesGross, spanishRecoverableVat: model.spanishRecoverableVat, foreignRecoverableVat: model.foreignRecoverableVat, recoverableVat: model.recoverableVat, netExpenses: model.netExpenses, buffer: model.buffer, requiredSalePrice: model.requiredSalePrice, finalPrice: model.finalPrice, marginRebu: model.marginRebu, vatRebu: model.vatRebu, netMarginRebu: model.netMarginRebu, realProfit: model.realProfit, maximumPurchase: model.maximumPurchase, maximumHammer: model.maximumHammer, reservation: model.reservation, marketSpain: model.marketSpain, recommendedHammer: model.hammer || Math.max(0, model.maximumHammer) };
    Object.entries(currencyOutputs).forEach(([name, value]) => root.querySelectorAll(`[data-kb-output="${name}"]`).forEach((element) => { element.textContent = formatEuro(value); }));
    root.querySelectorAll('[data-kb-output="clientSavings"]').forEach((element) => { element.textContent = signedEuro(model.clientSavings); });
    const percentageOutputs = { clientSavingsPercent: model.clientSavingsPercent, saleMarginPercent: model.saleMarginPercent, roiPercent: model.roiPercent, profitOnPurchasePercent: model.profitOnPurchasePercent };
    Object.entries(percentageOutputs).forEach(([name, value]) => root.querySelectorAll(`[data-kb-output="${name}"]`).forEach((element) => { element.textContent = formatPercent(value); }));
    Object.entries(model.categoryTotals).forEach(([category, value]) => { const output = root.querySelector(`[data-kb-category="${category}"]`); if (output)
        output.textContent = formatEuro(value); });
    const alerts = root.querySelector("[data-kb-alerts]");
    if (alerts)
        alerts.innerHTML = alertMarkup(model);
    root.querySelectorAll("[data-kb-signal]").forEach((element) => { element.dataset.kbSignal = model.signal; });
    return model;
}
let pdfPromise;
function loadPdfLibrary() {
    if (window.jspdf?.jsPDF)
        return Promise.resolve(window.jspdf.jsPDF);
    if (pdfPromise)
        return pdfPromise;
    pdfPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/assets/vendor/jspdf.umd.min.js";
        script.async = true;
        script.dataset.kairosPdf = "true";
        script.addEventListener("load", () => window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error("PDF unavailable")), { once: true });
        script.addEventListener("error", () => reject(new Error("PDF unavailable")), { once: true });
        document.head.append(script);
    }).catch((error) => { pdfPromise = undefined; document.querySelector("script[data-kairos-pdf]")?.remove(); throw error; });
    return pdfPromise;
}
function pdfFrame(JsPDF, title, subtitle) {
    const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const margin = 16;
    let y = 17;
    const navy = [13, 37, 62];
    const blue = [22, 101, 202];
    const muted = [89, 107, 125];
    const pale = [241, 246, 251];
    const ensure = (space) => { if (y + space > height - 16) {
        doc.addPage();
        y = 17;
    } };
    const textLine = (label, value, emphasis = false) => { ensure(8); if (Math.round(y) % 2 === 0) {
        doc.setFillColor(...pale);
        doc.rect(margin, y - 4.8, width - margin * 2, 7, "F");
    } doc.setTextColor(...navy); doc.setFont("helvetica", emphasis ? "bold" : "normal"); doc.setFontSize(8.5); doc.text(label, margin + 2, y); doc.text(value, width - margin - 2, y, { align: "right" }); y += 7; };
    const section = (label) => { ensure(13); y += 4; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...blue); doc.text(label, margin, y); y += 6; };
    const paragraph = (value, size = 8.5) => { const lines = doc.splitTextToSize(value, width - margin * 2); ensure(lines.length * 4.2 + 3); doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...muted); doc.text(lines, margin, y); y += lines.length * 4.2 + 2; };
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...blue);
    doc.text("KAIROS", margin, y);
    y += 9;
    doc.setFontSize(22);
    doc.setTextColor(...navy);
    doc.text(doc.splitTextToSize(title, width - margin * 2), margin, y);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...muted);
    doc.text(subtitle, margin, y);
    y += 7;
    doc.setDrawColor(...blue);
    doc.line(margin, y, width - margin, y);
    y += 5;
    const finish = () => { const pages = doc.getNumberOfPages(); for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFontSize(7);
        doc.setTextColor(...muted);
        doc.text(`KAIROS · ${page}/${pages}`, width - margin, height - 8, { align: "right" });
    } return doc; };
    return { doc, width, margin, get y() { return y; }, set y(value) { y = value; }, ensure, textLine, section, paragraph, finish, colors: { navy, blue, muted, pale } };
}
function buildClientPdf(JsPDF, budget) {
    const safe = clientPdfModel(budget);
    const title = [safe.vehicle.make, safe.vehicle.model, safe.vehicle.year].filter(Boolean).join(" ") || "Presupuesto de importación";
    const pdf = pdfFrame(JsPDF, title, "Presupuesto de importación de vehículo");
    const { doc } = pdf;
    if (safe.vehicle.photoDataUrl) {
        try {
            const imageFormat = safe.vehicle.photoDataUrl.startsWith("data:image/png") ? "PNG" : safe.vehicle.photoDataUrl.startsWith("data:image/webp") ? "WEBP" : "JPEG";
            pdf.ensure(48);
            doc.addImage(safe.vehicle.photoDataUrl, imageFormat, pdf.margin, pdf.y, 72, 42, undefined, "FAST");
            pdf.y += 47;
        }
        catch { /* La imagen es opcional. */ }
    }
    pdf.section("Vehículo");
    if (safe.vehicle.taxRegime)
        pdf.textLine("Régimen fiscal", safe.vehicle.taxRegime.toUpperCase(), true);
    [["Kilómetros", safe.vehicle.mileage], ["Combustible", safe.vehicle.fuel], ["Cambio", safe.vehicle.transmission], ["Color", safe.vehicle.color], ["Ubicación", safe.vehicle.location]].filter(([, value]) => value).forEach(([label, value]) => pdf.textLine(String(label), String(value)));
    pdf.section("Propuesta");
    pdf.textLine("Valor aproximado en España", formatEuro(safe.marketSpain));
    pdf.textLine("Puja máxima recomendada", formatEuro(safe.recommendedHammer));
    if (safe.mode === "estimated") {
        const min = safe.estimatedMin || safe.finalPrice;
        const max = safe.estimatedMax || safe.finalPrice;
        pdf.textLine("Precio estimado matriculado", `${formatEuro(Math.min(min, max))} - ${formatEuro(Math.max(min, max))}`, true);
    }
    else
        pdf.textLine("Precio máximo llave en mano", formatEuro(safe.finalPrice), true);
    pdf.textLine("Ahorro estimado", `${signedEuro(safe.clientSavings)} · ${formatPercent(safe.clientSavingsPercent)}`, true);
    pdf.section("Incluido");
    (safe.detail === "detailed" ? ["Adquisición del vehículo", "Costes de subasta", "Gestión de compra", "Importación y logística", "ITV e impuestos aplicables", "Tasas y matriculación", "Gestión documental y acompañamiento"] : ["Vehículo / adquisición", "Importación y matriculación", "Precio final"]).forEach((item) => pdf.paragraph(`• ${item}`));
    pdf.section("Reserva para activar la operación");
    pdf.textLine("Reserva necesaria", formatEuro(safe.reservation), true);
    pdf.paragraph("Para activar la operación se solicita una reserva del 10% de la puja máxima, con un mínimo de 500 €. Esta cantidad forma parte del precio final de la operación y no supone un coste adicional.");
    const created = new Date();
    const validUntil = new Date(created);
    validUntil.setDate(validUntil.getDate() + safe.validityDays);
    pdf.section("Condiciones");
    pdf.textLine("Fecha", new Intl.DateTimeFormat("es-ES").format(created));
    pdf.textLine("Válido hasta", new Intl.DateTimeFormat("es-ES").format(validUntil));
    pdf.paragraph(safe.mode === "closed" ? "El precio incluye la operación completa hasta entregar el vehículo matriculado en España, salvo circunstancias extraordinarias previamente comunicadas." : "Estimación inicial sujeta a adjudicación, documentación y comprobaciones de la operación.");
    return pdf.finish();
}
function buildInternalPdf(JsPDF, budget) {
    const model = calculateKairosBudget(budget);
    const title = [budget.vehicle.make, budget.vehicle.model, budget.vehicle.year].filter(Boolean).join(" ") || "Informe interno";
    const pdf = pdfFrame(JsPDF, title, "Informe interno de operación · confidencial");
    if (budget.vehicle.taxRegime !== "No consta") {
        pdf.section("Vehículo");
        pdf.textLine("Régimen fiscal", budget.vehicle.taxRegime.toUpperCase(), true);
    }
    pdf.section("Compra Copart");
    pdf.textLine("Puja / martillo", formatEuro(model.hammer));
    pdf.textLine("Comisión Copart", formatEuro(model.copartCommission));
    pdf.textLine("Otros gastos Copart", formatEuro(model.copartOther));
    pdf.textLine("Compra total REBU", formatEuro(model.purchaseRebu), true);
    pdf.section("Gastos");
    budget.expenses.filter((item) => !item.includedInPurchase && Number(item.amount) > 0).forEach((item) => pdf.textLine(`${item.category} · ${item.name}`, formatEuro(Number(item.amount))));
    pdf.textLine("Gastos brutos", formatEuro(model.operatingExpensesGross));
    pdf.textLine("IVA español deducible", formatEuro(model.spanishRecoverableVat));
    pdf.textLine("IVA extranjero aplicado", formatEuro(budget.recovery.includeForeignVat ? model.foreignRecoverableVat : 0));
    pdf.textLine("Gastos netos", formatEuro(model.netExpenses), true);
    pdf.section("REBU y rentabilidad");
    pdf.textLine("Precio final cliente", formatEuro(model.finalPrice));
    pdf.textLine("Margen REBU", formatEuro(model.marginRebu));
    pdf.textLine(`IVA REBU (${formatPercent(model.vatRate)})`, formatEuro(model.vatRebu));
    pdf.textLine("Margen después de IVA", formatEuro(model.netMarginRebu));
    pdf.textLine("Beneficio objetivo", formatEuro(model.targetProfit));
    pdf.textLine("Colchón", formatEuro(model.buffer));
    pdf.textLine("Beneficio real antes de Sociedades", formatEuro(model.realProfit), true);
    pdf.textLine("Margen sobre venta", formatPercent(model.saleMarginPercent));
    pdf.textLine("ROI sobre invertido", formatPercent(model.roiPercent));
    pdf.textLine("Beneficio sobre compra", formatPercent(model.profitOnPurchasePercent));
    pdf.section("Calculadora inversa");
    pdf.textLine("Precio máximo compra Copart", formatEuro(model.maximumPurchase));
    pdf.textLine("Puja máxima de martillo", formatEuro(model.maximumHammer), true);
    pdf.section("Alertas");
    model.alerts.forEach((alert) => pdf.paragraph(`${alert.level === "danger" ? "NO" : "ATENCIÓN"}: ${alert.text}`));
    if (!model.alerts.length)
        pdf.paragraph("Sin alertas con los umbrales configurados.");
    pdf.section("Notas");
    pdf.paragraph(budget.vehicle.notes || "Sin notas internas.");
    return pdf.finish();
}
function toast(root, message, error = false) {
    const element = root.querySelector("[data-kb-toast]");
    if (!element)
        return;
    element.textContent = message;
    element.dataset.error = String(error);
    element.classList.add("is-visible");
    window.setTimeout(() => element.classList.remove("is-visible"), 3500);
}
export function mountKairosBudgetApp(options = {}) {
    ensureStyle();
    const root = options.root || document.querySelector("[data-kairos-budget]");
    if (!root)
        return;
    let store = loadStore(options.legacyState);
    const active = () => currentKairosBudget(store);
    const persist = () => { const budget = active(); budget.updatedAt = new Date().toISOString(); store = normalizeKairosBudgetStore(store); saveStore(store); };
    const rerender = () => { root.innerHTML = renderWorkspace(store).replace(/^<section[^>]*>|<\/section>$/g, ""); root.dataset.view = active().view; };
    root.addEventListener("input", (event) => {
        const target = event.target;
        const budget = active();
        if (target.dataset.kbField) {
            const value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
            setPath(budget, target.dataset.kbField, value);
            persist();
            updateOutputs(root, budget);
        }
        if (target.dataset.kbExpenseId && target.dataset.kbExpenseField) {
            const item = expenseById(budget, target.dataset.kbExpenseId);
            if (!item)
                return;
            const key = target.dataset.kbExpenseField;
            const value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
            if (["amount", "deductibleVat"].includes(String(key)))
                item[key] = value === "" ? "" : Math.max(0, Number(value) || 0);
            else if (key === "vatIncluded")
                item.vatIncluded = Boolean(value);
            else
                item[key] = String(value).slice(0, key === "note" ? 300 : 120);
            persist();
            updateOutputs(root, budget);
        }
    });
    root.addEventListener("change", (event) => {
        const target = event.target;
        if (target.matches("[data-kb-select]")) {
            store.currentId = target.value;
            saveStore(store);
            rerender();
            return;
        }
        if (target.matches("[data-kb-photo]")) {
            const file = target.files?.[0];
            if (!file)
                return;
            if (!/^image\/(png|jpeg|webp)$/i.test(file.type) || file.size > 2_000_000) {
                toast(root, "La foto debe ser JPG, PNG o WebP y ocupar menos de 2 MB.", true);
                target.value = "";
                return;
            }
            const reader = new FileReader();
            reader.addEventListener("load", () => { active().vehicle.photoDataUrl = String(reader.result || ""); persist(); rerender(); toast(root, "Foto guardada en este dispositivo."); }, { once: true });
            reader.readAsDataURL(file);
            return;
        }
        if (target.dataset.kbField && ["view", "client.mode", "client.detail", "status"].includes(target.dataset.kbField))
            rerender();
        if (target.dataset.kbExpenseField === "vatIncluded")
            updateOutputs(root, active());
    });
    root.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-kb-action]");
        if (!button)
            return;
        const action = button.dataset.kbAction;
        const budget = active();
        if (action === "view-internal" || action === "view-client") {
            budget.view = action === "view-client" ? "client" : "internal";
            persist();
            rerender();
            return;
        }
        if (action === "save") {
            persist();
            rerender();
            toast(root, "Presupuesto guardado en este dispositivo.");
            return;
        }
        if (action === "new") {
            if (store.budgets.length >= MAX_BUDGETS) {
                toast(root, `Puedes guardar hasta ${MAX_BUDGETS} presupuestos.`, true);
                return;
            }
            const next = createEmptyKairosBudget();
            store = { ...store, currentId: next.id, budgets: [...store.budgets, next] };
            saveStore(store);
            rerender();
            return;
        }
        if (action === "duplicate") {
            store = duplicateKairosBudget(store);
            saveStore(store);
            rerender();
            toast(root, "Presupuesto duplicado.");
            return;
        }
        if (action === "delete") {
            if (!window.confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer."))
                return;
            store.budgets = store.budgets.filter((item) => item.id !== budget.id);
            if (!store.budgets.length)
                store = createKairosBudgetStore();
            else
                store.currentId = store.budgets[0].id;
            saveStore(store);
            rerender();
            return;
        }
        if (action === "add-expense") {
            const next = addCustomExpense(budget);
            store.budgets = store.budgets.map((item) => item.id === budget.id ? next : item);
            saveStore(store);
            rerender();
            window.requestAnimationFrame(() => root.querySelector("[data-kb-expense-card]:last-of-type input")?.focus());
            return;
        }
        if (action === "remove-expense") {
            const item = expenseById(budget, button.dataset.kbId || "");
            if (!item?.custom || !window.confirm(`¿Eliminar el gasto «${item.name}»?`))
                return;
            budget.expenses = budget.expenses.filter((candidate) => candidate.id !== item.id);
            persist();
            rerender();
            return;
        }
        if (action === "remove-photo") {
            budget.vehicle.photoDataUrl = "";
            persist();
            rerender();
            return;
        }
        if (action === "use-required-price") {
            budget.pricing.finalPrice = calculateKairosBudget(budget).requiredSalePrice;
            persist();
            rerender();
            return;
        }
        if (action === "pdf-client" || action === "pdf-internal") {
            if (button.disabled)
                return;
            const original = button.textContent || "Generar PDF";
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            button.textContent = "Generando PDF…";
            try {
                const JsPDF = await loadPdfLibrary();
                const kind = action === "pdf-client" ? "Cliente" : "Interno";
                const doc = action === "pdf-client" ? buildClientPdf(JsPDF, budget) : buildInternalPdf(JsPDF, budget);
                doc.save(safePdfFileName(budget, kind));
                toast(root, `PDF ${kind.toLowerCase()} descargado.`);
            }
            catch (error) {
                console.error("No se pudo generar el PDF KAIROS", error);
                toast(root, "No hemos podido generar el PDF. Inténtalo de nuevo.", true);
            }
            finally {
                button.disabled = false;
                button.removeAttribute("aria-busy");
                button.textContent = original;
            }
        }
    });
}
export function kairosBudgetHasData(legacyState) {
    const store = loadStore(legacyState);
    const budget = currentKairosBudget(store);
    const model = calculateKairosBudget(budget);
    return store.budgets.length > 1 || model.purchaseRebu > 0 || model.operatingExpensesGross > 0 || Object.entries(budget.vehicle).some(([key, value]) => !["photoDataUrl", "taxRegime"].includes(key) && Boolean(value)) || Boolean(budget.vehicle.photoDataUrl);
}
export function clearKairosBudgets() { localStorage.removeItem(STORAGE_KEY); }
export function setKairosBudgetPurchase(value, legacyState) {
    const store = loadStore(legacyState);
    const budget = currentKairosBudget(store);
    budget.purchase.totalRebu = Math.max(0, Number(value) || 0);
    budget.updatedAt = new Date().toISOString();
    saveStore(store);
}
export const KAIROS_INTERNAL_FIELDS = INTERNAL_FIELDS;
