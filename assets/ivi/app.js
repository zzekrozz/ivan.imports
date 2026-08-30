const form = document.querySelector("[data-ivi-form]");
const results = document.querySelector("[data-results]");
const content = document.querySelector("[data-result-content]");
const statusNode = document.querySelector("[data-form-status]");
const submit = document.querySelector("[data-submit]");
const MODIFICATIONS = ["towbar", "wheels", "suspension", "exhaust", "lpg", "camper", "lighting", "bodyKit", "power", "other"];
const REPORT_STATES = ["DRAFT", "PROCESSING", "READY", "PARTIAL", "NO_DATA", "FAILED"];
const STATUS_LABELS = { confirmed: "Confirmado", likely: "Probable", estimated: "Estimado", pending: "Pendiente", unknown: "Desconocido", not_confirmed: "No confirmado", direct: "Directo" };
const GROUP_LABELS = { comfort: "Confort", safety: "Seguridad y ADAS", exterior: "Exterior", interior: "Interior", registration: "Relevante para matriculación", other: "Otros códigos" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function track(event, detail = {}) {
  window.trackIvanImportsEvent?.(event, detail);
}

function showStatus(message, kind = "error") {
  statusNode.hidden = !message;
  statusNode.dataset.kind = kind;
  statusNode.textContent = message || "";
}

function accessKey(id) { return `ivanimports.ivi.access.${id}`; }
function getAccess(id) { return sessionStorage.getItem(accessKey(id)) || ""; }
function setAccess(id, token) { if (id && token) sessionStorage.setItem(accessKey(id), token); }

function pointRow(label, point, formatter = (value) => value) {
  const value = point?.value;
  const available = value !== null && value !== undefined && value !== "";
  const source = available ? point.source === "ONE_AUTO" ? "One Auto · OE Build Sheet" : point.source || "Fuente declarada" : "Sin fuente disponible";
  const status = STATUS_LABELS[point?.status] || (available ? "Confirmado" : "Desconocido");
  return `<div class="ivi-data-row"><small>${escapeHtml(label)}</small><strong class="${available ? "" : "ivi-unknown"}">${available ? escapeHtml(formatter(value)) : "Pendiente de confirmación"}</strong><em>${escapeHtml(status)} · ${escapeHtml(source)}</em></div>`;
}

function renderEquipment(equipment = {}) {
  const groups = Object.entries(equipment.groups || {}).filter(([, items]) => items?.length);
  if (!groups.length) return `<p class="ivi-unknown">El proveedor no ha devuelto equipamiento positivo interpretable.</p>`;
  return `<div class="ivi-equipment-tabs">${groups.map(([group, items]) => `<details${group === "registration" ? " open" : ""}><summary>${escapeHtml(GROUP_LABELS[group] || group)} · ${items.length}</summary><div class="ivi-equipment-tags">${items.slice(0, 80).map((item) => `<span title="${escapeHtml(item.code)}">${escapeHtml(item.description)}</span>`).join("")}</div></details>`).join("")}${equipment.all?.length ? `<details><summary>Todos los códigos originales · ${equipment.all.length}</summary><div class="ivi-equipment-tags">${equipment.all.slice(0, 250).map((item) => `<span title="${escapeHtml(item.description)}">${escapeHtml(item.code)}</span>`).join("")}</div></details>` : ""}</div>`;
}

function renderFindings(findings = []) {
  if (!findings.length) return `<p>No se han generado comprobaciones adicionales con los datos disponibles.</p>`;
  return `<div class="ivi-findings">${findings.map((item) => `<article class="ivi-finding" data-severity="${escapeHtml(item.severity)}"><small>${escapeHtml(item.severity)}</small><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.explanation)}</p><p><strong>Siguiente paso:</strong> ${escapeHtml(item.recommendation)}</p></article>`).join("")}</div>`;
}

function renderCosts(registration = {}) {
  return (registration.items || []).map((item) => `<div class="ivi-cost-row"><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.explanation)}</small></div><span>${item.amount === null ? "Pendiente" : `${Number(item.amount).toLocaleString("es-ES")} ${escapeHtml(item.currency)}`}</span></div>`).join("");
}

function reportTitle(report) {
  const identity = report.vehicle?.identity || {};
  return [identity.manufacturer?.value, identity.model?.value, identity.variant?.value].filter(Boolean).join(" ") || "Vehículo identificado parcialmente";
}

function renderReport(report) {
  if (!REPORT_STATES.includes(report.status)) report = { ...report, status: "FAILED" };
  if (["DRAFT", "PROCESSING"].includes(report.status)) {
    content.innerHTML = `<div class="ivi-loading"><div class="ivi-spinner" aria-hidden="true"></div><h2>Estamos construyendo tu informe</h2><p>One Auto está procesando la configuración de fábrica. Puedes mantener esta página abierta.</p><span class="ivi-report-id">${escapeHtml(report.id)}</span></div>`;
    results.hidden = false;
    return;
  }
  if (report.status === "FAILED" || report.status === "NO_DATA") {
    const noData = report.status === "NO_DATA";
    content.innerHTML = `<div class="ivi-report-card"><span class="ivi-report-id">${escapeHtml(report.id)}</span><h2>${noData ? "No hay datos de fábrica para este VIN" : "El proveedor no ha podido completar el análisis"}</h2><p>${noData ? "El VIN puede ser válido y aun así quedar fuera de cobertura. No convertimos esta ausencia en una conclusión sobre el vehículo." : "El informe se conserva para poder reintentar o revisar el fallo sin pedirte los datos de nuevo."}</p><div class="ivi-review-cta"><div><h3>Podemos revisar la documentación</h3><p>La ausencia de cobertura automática no impide analizar el CoC y los documentos extranjeros.</p></div><a class="ivi-button ivi-button--gold" href="/servicios/consultoria/">Solicitar revisión</a></div></div>`;
    results.hidden = false;
    return;
  }
  const identity = report.vehicle?.identity || {};
  const factory = report.vehicle?.factory || {};
  const technical = report.vehicle?.technical || {};
  const emissions = report.vehicle?.emissions || {};
  const homologationPoint = { value: report.vehicle?.homologation?.status === "likely" ? "Probablemente compatible; falta comprobación documental" : report.vehicle?.homologation?.status === "confirmed" ? "Homologación europea confirmada" : null, status: report.vehicle?.homologation?.status, source: report.vehicle?.homologation?.europeanTypeApproval?.source };
  content.innerHTML = `<header class="ivi-report-head"><div><span class="ivi-report-id">${escapeHtml(report.id)} · ${escapeHtml(report.status)}</span><h2>${escapeHtml(reportTitle(report))}</h2><span class="ivi-verdict" data-level="${escapeHtml(report.verdict?.level)}">${escapeHtml(report.verdict?.label || "Información pendiente")}</span></div><div class="ivi-report-actions"><button class="ivi-button ivi-button--primary" type="button" data-download-pdf>Descargar PDF</button><button class="ivi-button" type="button" data-copy-questions>Copiar preguntas</button></div></header>
  <div class="ivi-report-grid">
    <section class="ivi-report-card"><h3>1 · Identificación</h3><div class="ivi-data-grid">${pointRow("Marca",identity.manufacturer)}${pointRow("Modelo",identity.model)}${pointRow("Versión",identity.variant)}${pointRow("Carrocería",identity.bodyType)}${pointRow("Año modelo",identity.modelYear)}${pointRow("Fecha de fabricación",factory.manufacturedDate)}</div></section>
    <section class="ivi-report-card"><h3>2 · Configuración técnica</h3>${pointRow("Motor",technical.engine)}${pointRow("Potencia",technical.powerKw,(value)=>`${value} kW`)}${pointRow("Cambio",technical.transmission)}${pointRow("Tracción",technical.drivetrain)}${pointRow("Llantas de fábrica",technical.wheels)}${pointRow("Color original",factory.colour)}</section>
    <section class="ivi-report-card ivi-report-card--wide"><h3>3 · Equipamiento de fábrica</h3>${report.vehicle?.equipment?.highlights?.length ? `<div class="ivi-equipment-tags">${report.vehicle.equipment.highlights.map((item)=>`<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}${renderEquipment(report.vehicle?.equipment)}</section>
    <section class="ivi-report-card"><h3>4 · Homologación</h3>${pointRow("Estado",homologationPoint)}${pointRow("Referencia europea",report.vehicle?.homologation?.europeanTypeApproval)}<p>Solo marcamos «confirmada» cuando existe evidencia suficiente. Un campo vacío nunca produce una alerta roja por sí mismo.</p></section>
    <section class="ivi-report-card"><h3>5 · CO₂ y emisiones</h3>${pointRow("CO₂",emissions.co2,(value)=>`${value} ${emissions.co2?.unit || "g/km"}`)}${pointRow("Norma de emisiones",emissions.euroNorm)}<p>Sin un CO₂ confirmado no calculamos el impuesto de matriculación como si fuera definitivo.</p></section>
    <section class="ivi-report-card ivi-report-card--wide"><h3>6 · Riesgos y comprobaciones</h3>${renderFindings(report.findings)}</section>
    <section class="ivi-report-card"><h3>7 · Costes España</h3>${renderCosts(report.registration)}<div class="ivi-cost-row"><div><strong>Coste puesto en España</strong><small>${escapeHtml(report.registration?.total?.explanation || "Faltan datos para cerrar el total.")}</small></div><span>Pendiente</span></div></section>
    <section class="ivi-report-card"><h3>8 · Qué falta por confirmar</h3><ul class="ivi-list">${(report.missingInformation || []).map((item)=>`<li>${escapeHtml(item)}</li>`).join("") || "<li>No hay ausencias principales identificadas.</li>"}</ul></section>
    <section class="ivi-report-card ivi-report-card--wide"><h3>9 · Preguntas para el vendedor</h3><ol class="ivi-list">${(report.sellerQuestions || []).map((item)=>`<li>${escapeHtml(item)}</li>`).join("") || "<li>No se han generado preguntas adicionales.</li>"}</ol></section>
    <section class="ivi-report-card ivi-report-card--wide"><div class="ivi-review-cta"><div><span class="ivi-product-label">Revisión documental</span><h3>¿Quieres confirmar los puntos pendientes?</h3><p>Sube después el CoC y la documentación extranjera para revisar K, V.7, masas, reformas y datos que la consulta automática no puede garantizar.</p></div><a class="ivi-button ivi-button--gold" href="/servicios/consultoria/">Solicitar revisión documental</a></div></section>
  </div>`;
  results.hidden = false;
  content.querySelector("[data-download-pdf]")?.addEventListener("click", () => downloadPdf(report));
  content.querySelector("[data-copy-questions]")?.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText((report.sellerQuestions || []).map((item,index)=>`${index+1}. ${item}`).join("\n"));
    event.currentTarget.textContent = "Preguntas copiadas";
    track("ivi_seller_questions_copied", { reportStatus: report.status });
  });
}

async function downloadPdf(report) {
  const button = content.querySelector("[data-download-pdf]");
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = "Generando…"; }
  try {
    const response = await fetch(`/api/ivi/pdf?id=${encodeURIComponent(report.id)}`, { headers: { authorization: `Bearer ${getAccess(report.id)}` } });
    if (!response.ok) throw new Error("No hemos podido generar el PDF.");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${report.id}-IVI-Vehicle-Report.pdf`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    track("ivi_pdf_downloaded", { reportStatus: report.status });
  } catch (error) { showStatus(error.message); }
  finally { if (button) { button.disabled = false; button.textContent = original; } }
}

async function loadReport(id, { poll = false } = {}) {
  const token = getAccess(id);
  if (!token) { showStatus("Este informe necesita el acceso de la sesión en la que se creó."); return; }
  const response = await fetch(`/api/ivi/report?id=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "No hemos podido recuperar el informe.");
  renderReport(body.report);
  if (body.report.status === "PROCESSING" && poll) setTimeout(() => loadReport(id, { poll: true }).catch((error) => showStatus(error.message)), 3_000);
}

function payloadFromForm() {
  const data = new FormData(form);
  const selected = new Set(data.getAll("modification"));
  const knowledge = data.get("modificationKnowledge") || "unknown";
  return {
    vin: data.get("vin"), purchaseCountry: data.get("purchaseCountry"), mileageKm: data.get("mileageKm"), purchasePrice: data.get("purchasePrice"), currency: data.get("currency"), firstRegistration: data.get("firstRegistration"), notes: data.get("notes"),
    modifications: Object.fromEntries(MODIFICATIONS.map((key) => [key, selected.has(key) ? "yes" : knowledge === "none" ? "no" : "unknown"])),
  };
}

form?.querySelectorAll('input[name="modification"]').forEach((input) => input.addEventListener("change", () => {
  if (input.checked) form.querySelector('input[name="modificationKnowledge"][value="some"]').checked = true;
}));

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  showStatus("");
  if (!form.reportValidity()) return;
  submit.disabled = true; submit.innerHTML = "Consultando configuración…";
  results.hidden = false; content.innerHTML = `<div class="ivi-loading"><div class="ivi-spinner" aria-hidden="true"></div><h2>Consultando el VIN</h2><p>La consulta se realiza de forma segura en el servidor.</p></div>`;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
  track("ivi_analysis_started", { source: "ivi_page" });
  try {
    const response = await fetch("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payloadFromForm()) });
    const body = await response.json();
    if (!response.ok) {
      if (body.error === "not_configured") throw new Error("IVI está preparado, pero el análisis todavía no está habilitado en este entorno. Configura el proveedor y el almacenamiento para probar un VIN.");
      throw new Error(body.message || "No hemos podido iniciar el análisis.");
    }
    setAccess(body.report.id, body.accessToken);
    history.replaceState({}, "", `${location.pathname}?report=${encodeURIComponent(body.report.id)}`);
    renderReport(body.report);
    if (body.report.status === "PROCESSING") setTimeout(() => loadReport(body.report.id, { poll: true }).catch((error) => showStatus(error.message)), 3_000);
    else track("ivi_analysis_completed", { reportStatus: body.report.status });
  } catch (error) {
    results.hidden = true;
    showStatus(error.message);
    track("ivi_analysis_failed", { reason: "request_failed" });
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  } finally { submit.disabled = false; submit.innerHTML = "Analizar vehículo <span>→</span>"; }
});

const existingId = new URLSearchParams(location.search).get("report");
if (existingId) loadReport(existingId, { poll: true }).then(() => results.scrollIntoView({ block: "start" })).catch((error) => showStatus(error.message));
