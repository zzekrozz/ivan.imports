const DESKTOP_POINTS = Object.freeze([
  { x: 24, y: 72, zone: "España · preparación" },
  { x: 27, y: 65, zone: "España · preparación" },
  { x: 31, y: 72, zone: "España · preparación" },
  { x: 34, y: 64, zone: "España · preparación" },
  { x: 38, y: 71, zone: "España · preparación" },
  { x: 39, y: 62, zone: "España · preparación" },
  { x: 63, y: 29, zone: "Alemania / Benelux · compra" },
  { x: 69, y: 35, zone: "Alemania / Benelux · compra" },
  { x: 61, y: 40, zone: "Alemania / Benelux · compra" },
  { x: 47, y: 51, zone: "Francia · regreso" },
  { x: 32, y: 78, zone: "España · cierre" },
  { x: 27, y: 82, zone: "España · cierre" }
]);

const MOBILE_POINTS = Object.freeze([
  { x: 28, y: 76, zone: "España · preparación" },
  { x: 33, y: 69, zone: "España · preparación" },
  { x: 39, y: 76, zone: "España · preparación" },
  { x: 43, y: 68, zone: "España · preparación" },
  { x: 49, y: 75, zone: "España · preparación" },
  { x: 52, y: 66, zone: "España · preparación" },
  { x: 72, y: 25, zone: "Alemania / Benelux · compra" },
  { x: 80, y: 31, zone: "Alemania / Benelux · compra" },
  { x: 69, y: 38, zone: "Alemania / Benelux · compra" },
  { x: 59, y: 52, zone: "Francia · regreso" },
  { x: 43, y: 82, zone: "España · cierre" },
  { x: 34, y: 87, zone: "España · cierre" }
]);

function esc(value = "") {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function visibleStages(stages = []) {
  return stages.filter((stage) => stage.kind !== "prologue" && stage.countsTowardProgress !== false).slice(0, 12);
}

function pointAt(index, variant) {
  const points = variant === "mobile" ? MOBILE_POINTS : DESKTOP_POINTS;
  return points[index] || points.at(-1);
}

function dimensions(variant) {
  return variant === "mobile" ? { width: 430, height: 720 } : { width: 960, height: 580 };
}

function svgPoint(point, variant) {
  const { width, height } = dimensions(variant);
  return { x: point.x * width / 100, y: point.y * height / 100 };
}

function routePath(stages, variant, end = stages.length) {
  const points = stages.slice(0, end).map((_, index) => svgPoint(pointAt(index, variant), variant));
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C${controlX.toFixed(1)},${previous.y.toFixed(1)} ${controlX.toFixed(1)},${point.y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`);
}

function geographySvg(variant) {
  const { width, height } = dimensions(variant);
  const scaleX = variant === "mobile" ? .43 : 1;
  const transform = variant === "mobile" ? "translate(5 24) scale(.43 1.12)" : "";
  return `<svg class="academy-map-geography" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="academy-sea-${variant}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e9f5fc"/><stop offset="1" stop-color="#c8e2f2"/></linearGradient>
      <linearGradient id="academy-land-${variant}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9fcf8"/><stop offset="1" stop-color="#dcebdc"/></linearGradient>
      <filter id="academy-land-shadow-${variant}" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#17496d" flood-opacity=".16"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#academy-sea-${variant})"/>
    <g transform="${transform}" class="academy-map-countries" fill="url(#academy-land-${variant})" stroke="#90aec0" stroke-width="1.4" vector-effect="non-scaling-stroke" filter="url(#academy-land-shadow-${variant})">
      <path data-country="Portugal" d="M145 360 181 351 190 382 180 430 155 458 139 441 143 401Z"/>
      <path data-country="España" d="M181 351 254 336 334 350 370 389 350 433 292 458 228 454 180 430 190 382Z"/>
      <path data-country="Francia" d="M292 237 373 214 452 240 463 307 419 354 370 389 334 350 282 319Z"/>
      <path data-country="Bélgica" d="M430 207 470 196 489 219 462 239 438 235Z"/>
      <path data-country="Países Bajos" d="M456 151 486 143 502 181 489 219 470 196Z"/>
      <path data-country="Luxemburgo" d="M459 239 476 233 481 253 465 259Z"/>
      <path data-country="Alemania" d="M502 154 580 140 634 184 620 263 576 298 503 276 481 253 489 219Z"/>
      <path data-country="Suiza" d="M437 319 500 304 535 329 493 350 447 346Z"/>
      <path data-country="Austria" d="M535 304 627 289 676 316 644 341 558 337 535 329Z"/>
      <path data-country="Italia" d="M493 350 548 353 570 402 612 451 596 486 565 459 545 416 516 394 475 373Z"/>
    </g>
    <g class="academy-map-country-names" fill="#36566d" font-family="Inter, sans-serif" font-size="12" font-weight="700" transform="${transform}">
      <text x="238" y="408">ESPAÑA</text><text x="350" y="293">FRANCIA</text><text x="447" y="220">BÉLGICA</text><text x="448" y="168">PAÍSES BAJOS</text><text x="541" y="225">ALEMANIA</text><text x="456" y="335">SUIZA</text><text x="581" y="325">AUSTRIA</text><text x="547" y="390">ITALIA</text><text x="145" y="412">PT</text>
    </g>
  </svg>`;
}

function overlaySvg(stages, currentIndex, variant) {
  const { width, height } = dimensions(variant);
  const future = routePath(stages, variant);
  const complete = routePath(stages, variant, Math.max(1, currentIndex + 1));
  return `<svg class="academy-europe-overlay" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id="academy-route-energy-${variant}" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#0cafb9"/><stop offset="1" stop-color="#0b67d9"/></linearGradient></defs>
    <path class="academy-europe-route-future" d="${future}"/>
    <path class="academy-europe-route-complete" d="${complete}" stroke="url(#academy-route-energy-${variant})"/>
  </svg>`;
}

function carMarker(point, variant) {
  const paintId = `academy-vehicle-paint-${variant}`;
  return `<div class="academy-map-car-marker" style="--car-x:${point.x}%;--car-y:${point.y}%" aria-hidden="true"><svg viewBox="0 0 120 48" focusable="false"><defs><linearGradient id="${paintId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbfdff"/><stop offset=".5" stop-color="#b9d2e6"/><stop offset="1" stop-color="#5d89ad"/></linearGradient></defs><ellipse cx="61" cy="42" rx="49" ry="5" fill="#08243d" opacity=".28"/><path d="M10 31c4-8 12-12 25-14l13-11h28c8 0 15 4 22 12l12 3c5 1 8 5 8 10v5H5v-3c0-1 2-2 5-2Z" fill="url(#${paintId})" stroke="#315f81" stroke-width="1.5"/><path d="m48 9-9 9h50L76 9Z" fill="#7fb4d1" opacity=".8"/><path d="M64 9v9" stroke="#e8f5fb"/><path d="M20 28h84" stroke="#fff" opacity=".55"/><circle cx="29" cy="36" r="9" fill="#102c43"/><circle cx="29" cy="36" r="4" fill="#adc4d5"/><circle cx="94" cy="36" r="9" fill="#102c43"/><circle cx="94" cy="36" r="4" fill="#adc4d5"/><path d="M8 30h10m88-6 8 2" stroke="#fff3c4" stroke-width="3" stroke-linecap="round"/></svg></div>`;
}

function stageMeta(stage) {
  const lessons = Number(stage.lessonCount) || 0;
  return `${lessons} ${lessons === 1 ? "lección" : "lecciones"}${stage.estimatedMinutes ? ` · ${esc(stage.estimatedMinutes)} min` : ""}`;
}

function nodeMarkup(stages, currentIndex, variant) {
  return stages.map((stage, index) => {
    const point = pointAt(index, variant);
    const number = String(index + 1).padStart(2, "0");
    const status = index < currentIndex ? "complete" : index === currentIndex ? "current" : index === currentIndex + 1 ? "next" : "pending";
    const statusLabel = status === "complete" ? "Completada" : status === "current" ? "Etapa actual" : status === "next" ? "Siguiente etapa" : "Pendiente";
    const accessible = stage.accessibleLabel || `Etapa ${index + 1} de 12`;
    return `<div class="academy-europe-node" data-status="${status}" data-zone="${esc(point.zone)}" data-final="${index === 11}" style="--map-x:${point.x}%;--map-y:${point.y}%"><button type="button" data-map-stage="true" data-nav-to="${esc(stage.href)}" data-stage-number="${number}" data-stage-title="${esc(stage.shortTitle || stage.title)}" data-stage-description="${esc(stage.description || "Continúa con el siguiente punto de control.")}" data-stage-meta="${esc(stageMeta(stage))}" data-stage-status="${statusLabel}" data-visual-interaction="route-node" aria-label="${esc(`${accessible}: ${stage.title}. ${statusLabel}`)}"><span>${status === "complete" ? "✓" : number}</span></button><div class="academy-europe-node-label"><small>${statusLabel}</small><strong>${esc(stage.shortTitle || stage.title)}</strong></div></div>`;
  }).join("");
}

function zoneLabels(variant) {
  const labels = variant === "mobile"
    ? [["ESPAÑA", "PREPARACIÓN", 8, 62], ["ALEMANIA / BENELUX", "COMPRA", 56, 11], ["FRANCIA", "REGRESO", 55, 44], ["ESPAÑA", "CIERRE", 10, 91]]
    : [["ESPAÑA", "PREPARACIÓN", 13, 58], ["ALEMANIA / BENELUX", "COMPRA", 59, 12], ["FRANCIA", "REGRESO", 42, 42], ["ESPAÑA", "CIERRE", 12, 87]];
  return labels.map(([place, phase, x, y]) => `<span class="academy-map-zone" style="--zone-x:${x}%;--zone-y:${y}%"><strong>${place}</strong><small>${phase}</small></span>`).join("");
}

function accessibleAlternative(stages) {
  return `<ol class="academy-sr-only"><li>España · preparación: etapas 1 a 6.</li><li>Alemania y Benelux · compra: etapas 7 a 9.</li><li>Francia · regreso: etapa 10.</li><li>España · cierre: etapas 11 y 12.</li>${stages.map((stage, index) => `<li>Etapa ${index + 1}: ${esc(stage.title)}.</li>`).join("")}</ol>`;
}

function mapCanvas(variant) {
  const desktop = "/assets/visuals/final/route-map-desktop.webp";
  const mobile = "/assets/visuals/final/route-map-mobile.webp";
  return `<picture class="academy-map-canvas" aria-hidden="true"><source media="(max-width: 767px)" srcset="${mobile}"><img src="${variant === "mobile" ? mobile : desktop}" alt="" width="${variant === "mobile" ? 941 : 1586}" height="${variant === "mobile" ? 1672 : 992}" decoding="async"></picture>`;
}

function renderMap({ stages = [], percentage = 0, currentStageId = "" }, variant) {
  const routeStages = visibleStages(stages);
  const currentById = routeStages.findIndex((stage) => stage.id === currentStageId);
  const currentByStatus = routeStages.findIndex((stage) => stage.status === "current");
  const currentIndex = Math.max(0, currentById >= 0 ? currentById : currentByStatus >= 0 ? currentByStatus : routeStages.findIndex((stage) => stage.status !== "complete"));
  const current = routeStages[currentIndex] || routeStages[0];
  const next = routeStages[currentIndex + 1];
  const carPoint = pointAt(currentIndex, variant);
  return `<section class="academy-europe-map academy-europe-map--${variant}" aria-label="Mapa europeo interactivo de las 12 etapas">
    ${mapCanvas(variant)}${geographySvg(variant)}${overlaySvg(routeStages, currentIndex, variant)}${zoneLabels(variant)}${nodeMarkup(routeStages, currentIndex, variant)}${carMarker(carPoint, variant)}
    <div class="academy-map-status"><span>${Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)))}%</span><small>Progreso de aprendizaje</small></div>
    <div class="academy-map-next${next ? "" : " academy-map-next--finish"}"><small>${next ? "Siguiente etapa" : "Cierre de ruta"}</small><strong>${esc(next?.shortTitle || next?.title || "Método 7 días")}</strong></div>
    ${current ? `<aside class="academy-map-current-card" aria-label="Etapa actual"><span class="academy-map-current-kicker">Estás aquí · ${esc(carPoint.zone)}</span><div><strong><span>${String(currentIndex + 1).padStart(2, "0")}</span><span>${esc(current.shortTitle || current.title)}</span></strong><p>${esc(current.description || "Continúa con el siguiente punto de control.")}</p><small>${esc(stageMeta(current))}</small></div><a href="${esc(current.href)}" data-nav>Continuar etapa →</a></aside>` : ""}
    ${accessibleAlternative(routeStages)}
  </section>`;
}

export function renderEuropeRouteMap(options = {}) {
  return renderMap(options, "desktop");
}

export function renderMobileRoute(options = {}) {
  return renderMap(options, "mobile");
}
