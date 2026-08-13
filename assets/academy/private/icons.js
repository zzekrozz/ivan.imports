const ICONS = Object.freeze({
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
  route: '<path d="M5 19c0-3 4-3 4-6s-4-3-4-6"/><path d="M19 5c0 3-4 3-4 6s4 3 4 6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>',
  operation: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3m8 2V3M8 10h8m-8 4h5"/>',
  tools: '<path d="m14.7 6.3 3-3a4.2 4.2 0 0 1-5.2 5.2l-6.8 6.8a2.1 2.1 0 1 0 3 3l6.8-6.8a4.2 4.2 0 0 1 5.2-5.2l-3 3"/><path d="m5 5 4 4"/>',
  answers: '<path d="M21 12a8.5 8.5 0 0 1-9 8.5 9.8 9.8 0 0 1-4-.9L3 21l1.4-4A8.6 8.6 0 1 1 21 12Z"/><path d="M9.8 9a2.4 2.4 0 1 1 3.3 2.2c-.8.4-1.1.9-1.1 1.8m0 3h.01"/>',
  resources: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 5.5v16M8 7h8m-8 4h6"/>',
  support: '<circle cx="12" cy="12" r="9"/><path d="M8 15v-3a4 4 0 0 1 8 0v3M8 14H6.5A1.5 1.5 0 0 0 5 15.5v1A1.5 1.5 0 0 0 6.5 18H8Zm8 0h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5H16Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  budget: '<path d="M4 7h16v12H4z"/><path d="M4 10h16M8 15h3m5 0h.01"/><path d="M7 7V5h10v2"/>',
  candidates: '<rect x="3" y="5" width="18" height="13" rx="3"/><path d="m6 14 1.5-4h9l1.5 4M7 14h10"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
  filter: '<path d="M4 5h16M7 12h10m-7 7h4"/><circle cx="8" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>',
  ad: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8m-8 4h5m-5 6 2-2 2 2 3-3 1 1"/>',
  market: '<path d="M4 20V10m5 10V5m6 15v-7m5 7V8"/><path d="m4 8 5-4 6 6 5-5"/>',
  calculator: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8 6h8v4H8zm0 8h.01m4 0h.01m4 0h.01M8 18h.01m4 0h.01m4 0h.01"/>',
  documents: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/><circle cx="6" cy="6" r="2"/>',
  questions: '<path d="M5 4h14v13H9l-4 4Z"/><path d="M9 9h6m-6 4h4"/>',
  plan: '<path d="M4 19V5h16v14Z"/><path d="M9.3 5v14m5.4-14v14"/><path d="m6 9 1.2-2L8.4 9M11 9h2m4-2h.01"/>',
  travel: '<path d="M3 17h18M5 17l2-9h10l2 9"/><path d="M9 8V5h6v3M7 12h10"/><circle cx="8" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',
  plane: '<path d="m2 16 8-4V5.5a2 2 0 0 1 4 0V12l8 4v2l-8-2v3l2 2v1l-4-1-4 1v-1l2-2v-3l-8 2Z"/>',
  inspection: '<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 5 5M8 10l1.5 1.5L12.5 8"/>',
  paint: '<path d="M5 19c4-1 5-5 3-8l6-6 5 5-6 6c-3-2-7-1-8 3Z"/><path d="m14 5 5-2 2 2-2 5"/><path d="M4 21h8"/>',
  purchase: '<path d="M4 8h16l-1 11H5Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2m-6 5 1.5 1.5L15 11"/>',
  return: '<path d="M20 8h-9a6 6 0 1 0 0 12h4"/><path d="m16 3 4 5-4 5"/><path d="M5 8h.01"/>',
  spain: '<path d="M5 4h14v16H5z"/><path d="M8 8h8m-8 4h8m-8 4h4"/><circle cx="17" cy="17" r="3"/><path d="m15.7 17 1 1 2-2"/>',
  method: '<path d="M5 3v18m14-18v18M5 7h14M5 13h14"/><path d="m9 17 2 2 4-4"/>',
  car: '<path d="m4 14 2-5h12l2 5"/><path d="M3 14h18v4H3z"/><path d="M7 9l2-3h6l2 3"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/>',
  checkpoint: '<path d="M6 21V4m0 1h11l-2 4 2 4H6"/><path d="m9 8 1.5 1.5L14 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22Z"/>',
  official: '<path d="m12 3 8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7Z"/><path d="m8.5 12 2.2 2.2L16 9"/>',
  experience: '<path d="M8 21h8M9 17h6M8 9a4 4 0 1 1 8 0c0 2-1 3-2 4H10c-1-1-2-2-2-4Z"/><path d="M4 9H2m20 0h-2M5 4 3.5 2.5M19 4l1.5-1.5"/>',
  recommendation: '<path d="M4 20h16V8l-8-5-8 5Z"/><path d="m8 13 2.5 2.5L16 10"/>',
  warning: '<path d="M12 3 2.8 20h18.4Z"/><path d="M12 9v5m0 3h.01"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
});

const TOOL_ICONS = Object.freeze({
  "operation-dashboard": "operation", "candidate-board": "candidates", presupuesto: "budget",
  "budget-calculator": "budget", filtros: "filter", "search-filter-builder": "filter",
  "analizador-anuncio": "ad", "ad-analyzer": "ad", mercado: "market", "market-comparator": "market",
  "coste-total": "calculator", "cost-calculator": "calculator", documentos: "documents",
  "document-passport": "documents", preguntas: "questions", "question-builder": "questions",
  "plan-abc": "plan", viaje: "travel", "travel-planner": "travel", inspeccion: "inspection",
  "inspection-checklist": "inspection", pintura: "paint", "paint-sheet": "paint",
  "compra-salida": "purchase", "purchase-exit-checklist": "purchase", vuelta: "return",
  "return-checklist": "return", espana: "spain", "spain-folder": "spain",
  "metodo-7-dias": "method", "method7-planner": "method",
});

const STAGE_ICONS = Object.freeze(["route", "budget", "search", "ad", "market", "calculator", "questions", "plane", "inspection", "purchase", "return", "spain", "method"]);

function cleanToken(value) {
  return String(value || "").replace(/[^a-z0-9_-]/gi, "");
}

export function iconSvg(name, { className = "", label = "" } = {}) {
  const key = ICONS[name] ? name : "route";
  const aria = label ? `role="img" aria-label="${String(label).replace(/[&<>'\"]/g, "")}"` : 'aria-hidden="true"';
  return `<svg class="academy-icon ${cleanToken(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${aria} focusable="false">${ICONS[key]}</svg>`;
}

export function toolIconName(slug) {
  return TOOL_ICONS[String(slug || "").toLocaleLowerCase("es")] || "tools";
}

export function stageIconName(stage, index = 0) {
  const order = Number.isFinite(Number(stage?.order)) ? Number(stage.order) : index;
  return STAGE_ICONS[Math.max(0, Math.min(STAGE_ICONS.length - 1, order))] || "route";
}
