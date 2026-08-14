import { iconSvg } from "./icons.js";

function esc(value = "") {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function list(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function visualKind(visual) {
  return String(visual?.component || visual?.type || "editorial").toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-");
}

function renderItems(items) {
  return list(items).map((item, index) => {
    if (typeof item !== "object") return `<li><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(item)}</strong></li>`;
    return `<li data-tone="${esc(item.tone || item.status || "neutral")}"><span>${esc(item.number || item.value || String(index + 1).padStart(2, "0"))}</span><div><strong>${esc(item.title || item.label || item.name || "")}</strong>${item.description || item.text || item.copy ? `<p>${esc(item.description || item.text || item.copy)}</p>` : ""}</div></li>`;
  }).join("");
}

function renderComparison(visual) {
  const items = list(visual.data?.items || visual.items || visual.data?.columns);
  if (!items.length) return "";
  return `<div class="academy-visual-comparison">${items.map((item, index) => `<article data-tone="${esc(item.tone || item.status || "neutral")}"><span>${esc(item.eyebrow || item.badge || `Escenario ${index + 1}`)}</span><strong>${esc(item.title || item.label || item.name || item.value || "")}</strong>${item.description || item.text ? `<p>${esc(item.description || item.text)}</p>` : ""}${list(item.points || item.items).length ? `<ul>${list(item.points || item.items).map((point) => `<li>${esc(typeof point === "object" ? point.text || point.label : point)}</li>`).join("")}</ul>` : ""}</article>`).join("")}</div>`;
}

function renderTimeline(visual) {
  const items = list(visual.data?.steps || visual.data?.items || visual.steps || visual.items);
  if (!items.length) return "";
  return `<ol class="academy-visual-timeline">${renderItems(items)}</ol>`;
}

function renderTable(visual) {
  const table = visual.data?.table || visual.table || visual.data || {};
  const headers = list(table.headers || table.columns).map((header) => typeof header === "object" ? header.label || header.title : header);
  const rows = list(table.rows);
  if (!headers.length || !rows.length) return "";
  return `<div class="academy-visual-table-wrap"><table><thead><tr>${headers.map((header) => `<th scope="col">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => { const cells = Array.isArray(row) ? row : headers.map((header) => row[header] ?? row[String(header).toLocaleLowerCase("es")]); return `<tr>${cells.map((cell, index) => `<${index ? "td" : "th"}${index ? "" : ' scope="row"'}>${esc(typeof cell === "object" ? cell.label || cell.value || cell.text : cell ?? "")}</${index ? "td" : "th"}>`).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}

function renderFunnel(visual) {
  const items = list(visual.data?.steps || visual.data?.items || visual.items);
  if (!items.length) return "";
  return `<div class="academy-visual-funnel">${items.map((item, index) => `<div style="--funnel-level:${index}" data-tone="${esc(item.tone || "neutral")}"><strong>${esc(item.value || item.number || "")}</strong><span>${esc(item.label || item.title || item.text || "")}</span></div>`).join("")}</div>`;
}

function renderCalculation(visual) {
  const data = visual.data || {};
  const parts = list(data.parts || data.steps || visual.items);
  if (!parts.length && !data.formula && !data.result) return "";
  return `<div class="academy-visual-calculation">${parts.length ? `<div>${parts.map((part, index) => `<span><small>${esc(part.label || part.title || `Paso ${index + 1}`)}</small><strong>${esc(part.value || part.text || "")}</strong></span>`).join('<i aria-hidden="true">→</i>')}</div>` : ""}${data.formula ? `<code>${esc(data.formula)}</code>` : ""}${data.result ? `<output><small>${esc(data.resultLabel || "Resultado")}</small><strong>${esc(data.result)}</strong></output>` : ""}</div>`;
}

function renderDocument(visual) {
  const fields = list(visual.data?.fields || visual.data?.callouts || visual.items);
  return `<div class="academy-visual-document"><div class="academy-visual-document-paper"><span class="academy-visual-document-eu">EU</span><i></i><i></i><i></i><i></i>${fields.map((field, index) => `<b style="--callout:${index}">${esc(field.label || field.title || field.name || field)}</b>`).join("")}</div><div class="academy-visual-document-notes">${fields.map((field, index) => `<span><b>${index + 1}</b>${esc(typeof field === "object" ? field.description || field.text || field.label : field)}</span>`).join("")}</div></div>`;
}

function renderInspection(visual) {
  const hotspots = list(visual.data?.hotspots || visual.data?.panels || visual.items);
  return `<div class="academy-visual-inspection"><svg viewBox="0 0 640 280" aria-hidden="true"><path d="M83 178c16-51 57-74 113-82l70-11 72-36h105l84 71c27 6 42 24 46 58l-4 24H79Z"/><path d="m270 87 78-31h88l51 60H244Z"/><circle cx="185" cy="203" r="43"/><circle cx="477" cy="203" r="43"/><path d="M257 119v72m107-132v132m123-72v72"/></svg>${hotspots.map((hotspot, index) => `<span class="academy-visual-hotspot" style="--hotspot-x:${Number(hotspot.x) || 20 + (index % 4) * 20}%;--hotspot-y:${Number(hotspot.y) || 35 + (index % 2) * 28}%"><b>${index + 1}</b><small>${esc(hotspot.label || hotspot.title || hotspot)}</small></span>`).join("")}</div>`;
}

function renderEditorial(visual) {
  const items = list(visual.data?.items || visual.items);
  return `<div class="academy-visual-blueprint"><div class="academy-visual-blueprint-grid" aria-hidden="true"></div><div class="academy-visual-blueprint-core">${iconSvg(visual.data?.icon || "route")}<strong>${esc(visual.title || "Vista operativa")}</strong>${visual.purpose ? `<span>${esc(visual.purpose)}</span>` : ""}</div>${items.length ? `<ol>${renderItems(items)}</ol>` : ""}</div>`;
}

function euros(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function renderPriceKmCluster(visual) {
  const points = list(visual.data);
  if (!points.length) return "";
  const prices = points.map((point) => Number(point.priceEur) || 0);
  const kms = points.map((point) => Number(point.km) || 0);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minKm = Math.min(...kms);
  const maxKm = Math.max(...kms);
  const x = (price) => 10 + ((price - minPrice) / Math.max(1, maxPrice - minPrice)) * 78;
  const y = (km) => 84 - ((km - minKm) / Math.max(1, maxKm - minKm)) * 66;
  return `<div class="academy-visual-scatter"><div class="academy-visual-axis academy-visual-axis--y"><span>${Math.round(maxKm / 1000)}k km</span><span>${Math.round(minKm / 1000)}k km</span></div><div class="academy-visual-scatter-plot" role="img" aria-label="Ocho anuncios situados por precio y kilometraje"><span class="academy-visual-cluster-band">Franja repetida</span>${points.map((point, index) => `<span class="academy-visual-dot" data-tone="${/outlier/i.test(point.classification) ? "warning" : /franja/i.test(point.classification) ? "success" : "neutral"}" style="--dot-x:${x(Number(point.priceEur))}%;--dot-y:${y(Number(point.km))}%" tabindex="0"><b>${index + 1}</b><small>${euros(point.priceEur)} · ${Math.round(Number(point.km) / 1000)}k km<br>${esc(point.classification)}</small></span>`).join("")}</div><div class="academy-visual-axis academy-visual-axis--x"><span>${euros(minPrice)}</span><strong>Precio anunciado</strong><span>${euros(maxPrice)}</span></div></div>`;
}

function renderWaterfall(visual) {
  const example = visual.data?.example || {};
  const parts = [
    ["Valor conservador en España", example.spainValueEur, "start"],
    ["Viaje e importación", -Number(example.travelImportEur || 0), "cost"],
    ["Preparación", -Number(example.preparationEur || 0), "cost"],
    ["Contingencia", -Number(example.contingencyEur || 0), "reserve"],
    ["Beneficio deseado", -Number(example.desiredBenefitEur || 0), "reserve"],
    ["Techo de compra en Europa", example.maxEuropeEur, "result"],
  ];
  return `<div class="academy-visual-waterfall">${parts.map(([label, value, tone], index) => `<div data-tone="${tone}"><span>${String(index + 1).padStart(2, "0")}</span><div><small>${esc(label)}</small><strong>${Number(value) < 0 ? "− " : ""}${euros(Math.abs(Number(value) || 0))}</strong></div></div>`).join("")}<code>${esc(visual.data?.formula || "")}</code></div>`;
}

function renderRoiComparison(visual) {
  const examples = list(visual.data?.examples);
  return `<div class="academy-visual-roi"><code>${esc(visual.data?.formula || "beneficio / inversión total × 100")}</code><div>${examples.map((example, index) => `<article><span>Escenario ${index + 1}</span><div class="academy-visual-roi-ring" style="--roi:${Math.min(100, Number(example.roiPercent) || 0)}"><strong>${esc(example.roiPercent)}%</strong></div><dl><div><dt>Beneficio</dt><dd>${euros(example.benefitEur)}</dd></div><div><dt>Inversión</dt><dd>${euros(example.investmentEur)}</dd></div></dl></article>`).join("")}</div><p>El porcentaje no sustituye revisar riesgo, plazo, estado y liquidez.</p></div>`;
}

function renderTaxFlow(visual) {
  const examples = list(visual.data?.examples);
  const bands = list(visual.data?.emissionsBands);
  return `<div class="academy-visual-tax"><div class="academy-visual-tax-warning"><strong>Ejemplos para entender el cálculo</strong><span>Verifica tablas, antigüedad y tramo vigentes antes de liquidar.</span></div><div class="academy-visual-tax-flow"><span><small>01</small><strong>Valor oficial</strong></span><i>×</i><span><small>02</small><strong>% por antigüedad</strong></span><i>=</i><span><small>03</small><strong>Base</strong></span><i>×</i><span><small>04</small><strong>Tramo de emisiones</strong></span></div><div class="academy-visual-tax-bands">${bands.map((band) => `<span><small>${esc(band.condition)}</small><strong>${esc(band.ratePercent)}%</strong></span>`).join("")}</div><div class="academy-visual-tax-examples">${examples.map((example) => `<article><span>${esc(example.emissionsGKm)} g/km · ${esc(example.agePercent)}% edad</span><strong>${euros(example.resultEur)}</strong><small>Base ${euros(example.taxableBaseEur)} · tipo ${esc(example.ratePercent)}%</small></article>`).join("")}</div></div>`;
}

function renderDocumentDecision(visual) {
  const v7 = list(visual.data?.v7Cases);
  const k = list(visual.data?.kCases);
  return `<div class="academy-visual-decision-tree"><div class="academy-visual-decision-root"><span>Permiso de circulación</span><strong>Lee el valor literal. No completes por intuición.</strong></div><div class="academy-visual-decision-lanes"><section><header><span>V.7</span><div><strong>Emisiones de CO₂</strong><small>Registrar dato y documento</small></div></header>${v7.map((item) => `<article data-tone="${item.value === "vacío" ? "warning" : "neutral"}"><strong>${esc(item.value)}</strong><span>${item.referenceRatePercent !== undefined ? `Ejemplo de tramo: ${esc(item.referenceRatePercent)}%` : `Reserva conservadora del ejemplo: ${esc(item.conservativeBudgetRatePercent)}%`}</span><small>${esc(item.action)}</small></article>`).join("")}</section><section><header><span>K</span><div><strong>Homologación de tipo</strong><small>Transcribir código completo</small></div></header>${k.map((item) => `<article data-tone="${/vacío|revisar/i.test(item.classification) ? "warning" : "neutral"}"><strong>${esc(item.value)}</strong><span>${esc(item.classification)}</span><small>${/revisar/i.test(item.classification) ? "Revisión documental o técnica" : "Contrastar con VIN y CoC"}</small></article>`).join("")}</section></div><footer><span>V.7 vacío ≠ cero emisiones</span><span>K vacío ≠ homologación europea</span><span>CoC ≠ campo K</span></footer></div>`;
}

function renderPaintMap() {
  const panels = [["Capó",50,18],["Techo",50,45],["Maletero",50,75],["Aleta izq.",18,30],["Puerta izq.",18,56],["Aleta der.",82,30],["Puerta der.",82,56]];
  return `<div class="academy-visual-paint-map"><div class="academy-visual-paint-car" role="img" aria-label="Vista superior del vehículo con siete zonas de medición"><svg viewBox="0 0 400 500" aria-hidden="true"><path d="M120 38h160l55 95v240l-55 89H120l-55-89V133Z"/><path d="M130 70h140l35 90H95Z"/><path d="M106 178h188v142H106Z"/><path d="m95 340 35 90h140l35-90Z"/></svg>${panels.map(([label, x, y], index) => `<span style="--panel-x:${x}%;--panel-y:${y}%"><b>${index + 1}</b><small>${label}</small></span>`).join("")}</div><ol><li><span>01</span><div><strong>Mide</strong><small>Registra posición y lectura.</small></div></li><li><span>02</span><div><strong>Compara</strong><small>Contrasta zonas equivalentes.</small></div></li><li><span>03</span><div><strong>Verifica</strong><small>Une medidas con señales físicas.</small></div></li></ol><p>Una cifra aislada no diagnostica una reparación.</p></div>`;
}

function renderExportTimeline() {
  return `<div class="academy-visual-export-timeline"><div class="academy-visual-export-plate"><span>D</span><strong>EXPORT</strong><i></i><b>VIGENCIA</b></div><ol><li><span>01</span><div><strong>Inicio de cobertura</strong><small>Confirma fecha y hora.</small></div></li><li><span>02</span><div><strong>Ruta prevista</strong><small>Comprueba territorio y vehículo.</small></div></li><li><span>03</span><div><strong>Margen de contingencia</strong><small>No planifiques llegar el último día.</small></div></li><li><span>04</span><div><strong>Fin de vigencia</strong><small>Si no alcanza, cambia fechas, trámite o transporte.</small></div></li></ol></div>`;
}

export function renderLessonVisual(visual, index = 0) {
  if (!visual || typeof visual !== "object") return "";
  const kind = visualKind(visual);
  let body = "";
  if (kind === "price-km-cluster-chart") body = renderPriceKmCluster(visual);
  else if (kind === "price-waterfall") body = renderWaterfall(visual);
  else if (kind === "roi-comparison") body = renderRoiComparison(visual);
  else if (kind === "tax-calculation-flow") body = renderTaxFlow(visual);
  else if (kind === "document-field-decision-tree") body = renderDocumentDecision(visual);
  else if (kind === "paint-measurement-map") body = renderPaintMap(visual);
  else if (kind === "export-plate-timeline") body = renderExportTimeline(visual);
  else if (/comparison|compare|columns|country/.test(kind)) body = renderComparison(visual);
  else if (/timeline|procedure|journey|flow/.test(kind)) body = renderTimeline(visual);
  else if (/table|matrix|market/.test(kind)) body = renderTable(visual);
  else if (/funnel/.test(kind)) body = renderFunnel(visual);
  else if (/calculation|formula|calculator|budget/.test(kind)) body = renderCalculation(visual);
  else if (/document|passport|v7|field-k/.test(kind)) body = renderDocument(visual);
  else if (/inspection|paint|car-body|vehicle/.test(kind)) body = renderInspection(visual);
  if (!body) body = renderEditorial(visual);
  const id = visual.id || `visual-${index + 1}`;
  const sourceSegmentIds = list(visual.sourceSegmentIds).map(String).filter(Boolean);
  const sourceSegmentAttribute = sourceSegmentIds.length ? ` data-source-segments="${esc(sourceSegmentIds.join(" "))}"` : "";
  return `<figure class="academy-lesson-visual" id="${esc(id)}" data-visual-kind="${esc(kind)}" data-lesson-section="${esc(id)}" data-visual-interaction="lesson-visual"${sourceSegmentAttribute} tabindex="0"><figcaption><span>${iconSvg("experience")}</span><div><small>Visual de la lección</small><strong>${esc(visual.title || visual.purpose || "Comprender de un vistazo")}</strong>${visual.purpose && visual.title ? `<p>${esc(visual.purpose)}</p>` : ""}</div>${visual.sourcePages ? `<em>Pág. ${esc(list(visual.sourcePages).join("–"))}</em>` : ""}</figcaption>${body}${visual.alt ? `<p class="academy-visual-alt">${esc(visual.alt)}</p>` : ""}</figure>`;
}

export function renderLessonVisuals(lesson) {
  return list(lesson?.visuals).map(renderLessonVisual).join("");
}

export function renderStageScene(stage, index = 0) {
  const visual = stage?.visual || {};
  const order = Number(stage?.order ?? index);
  const scenes = [
    ["España", "origen", "Define el punto de partida"], ["Francia", "autopista", "Prepara país y presupuesto"],
    ["Alemania", "ciudad", "Abre el mercado"], ["Alemania", "anuncio", "Lee cada señal"],
    ["Benelux", "mercado", "Compara equivalentes"], ["Europa", "numeros", "Protege el margen"],
    ["Alemania", "documentos", "Verifica antes de viajar"], ["Europa", "aeropuerto", "Construye un plan alternativo"],
    ["Alemania", "taller", "Inspecciona con método"], ["Europa", "salida", "Compra solo con salida viable"],
    ["Francia", "regreso", "Controla la vuelta"], ["España", "administracion", "Cierra el expediente"],
    ["España", "destino", "Consolida tu método"],
  ];
  const [country, terrain, sceneCopy] = scenes[Math.min(Math.max(order, 0), scenes.length - 1)];
  const image = order === 1
    ? `<picture class="academy-stage-scene-media" aria-hidden="true"><img src="/assets/visuals/final/before-search-desk.webp" alt="" width="1672" height="941" loading="eager" decoding="async"></picture>`
    : `<div class="academy-stage-scene-fallback" aria-hidden="true"><span>${String(order).padStart(2, "0")}</span></div>`;
  return `<div class="academy-stage-scene" data-stage-order="${esc(order)}" data-scene="${esc(terrain)}">${image}<div class="academy-stage-scene-marker"><small>${esc(country)}</small><strong>${String(order).padStart(2, "0")}</strong></div><div class="academy-stage-scene-copy"><span>${esc(visual.eyebrow || `Parada ${String(order).padStart(2, "0")}`)}</span><strong>${esc(visual.title || stage?.shortTitle || stage?.title || "Ruta europea")}</strong><small>${esc(visual.description || sceneCopy)}</small></div></div>`;
}
