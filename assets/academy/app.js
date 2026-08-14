import { iconSvg, stageIconName, toolIconName } from "./private/icons.js";
import { renderEuropeRouteMap, renderMobileRoute } from "./private/europe-map.js";
import { renderLessonVisuals, renderStageScene } from "./private/lesson-visuals.js";
import { migrateAcademyStateV1ToV2, normalizeLegacyLessonMap, resolveLegacyDeepLink, resolveLegacyLessonTarget } from "./private/migration.js";
import { ACADEMY_SEARCH_SUGGESTIONS, answerSemanticQuery } from "./private/semantic-search.js";
import { normalizeNumberFieldValue } from "./private/form-values.js";
import { ACADEMY_PATCH_NOTES, ACADEMY_VERSION } from "./patch-notes.js";

const PROGRAM_ROOT = "/academia/";
const STATE_STORAGE_KEY = "ivanimports.academy.public-state.v2";
const API = Object.freeze({
  program: "/assets/academy/program-v2.json",
});

const TOOL_CATALOG = Object.freeze([
  { slug: "operation-dashboard", title: "Panel de operación", description: "Separa tu expediente real de la ruta de aprendizaje y conserva el siguiente paso.", group: "organizar" },
  { slug: "candidate-board", title: "Tablero de candidatos", description: "Compara Plan A, B y C sin borrar decisiones anteriores.", group: "descubrir" },
  { slug: "presupuesto", title: "Presupuesto inicial", description: "Separa los gastos reservados y calcula cuánto puedes destinar al vehículo.", group: "decidir" },
  { slug: "filtros", title: "Filtros y búsquedas", description: "Guarda criterios comparables y una rutina de búsqueda repetible.", group: "descubrir" },
  { slug: "analizador-anuncio", title: "Analizador de anuncio", description: "Convierte lo que muestra y omite un anuncio en comprobaciones concretas.", group: "descubrir" },
  { slug: "mercado", title: "Comparador con España", description: "Ordena comparables añadidos manualmente y elige un valor conservador.", group: "decidir" },
  { slug: "coste-total", title: "Coste total", description: "Compara estimado, confirmado y real sin perder de vista la desviación.", group: "decidir" },
  { slug: "documentos", title: "Pasaporte documental", description: "Controla el estado de cada documento de tu operación.", group: "ejecutar" },
  { slug: "preguntas", title: "Preparador de preguntas", description: "Agrupa tus dudas y prepara una conversación clara con el vendedor.", group: "descubrir" },
  { slug: "plan-abc", title: "Plan A/B/C", description: "Prioriza candidatos y conserva alternativas antes de viajar.", group: "decidir" },
  { slug: "viaje", title: "Planificador de viaje", description: "Reúne horarios, transporte, banco, placas y alternativas.", group: "ejecutar" },
  { slug: "inspeccion", title: "Inspección presencial", description: "Registra comprobaciones delante del vehículo.", group: "ejecutar" },
  { slug: "pintura", title: "Mediciones de pintura", description: "Registra espesores por panel y detecta qué zonas debes revisar con más contexto.", group: "ejecutar" },
  { slug: "compra-salida", title: "Compra y salida", description: "Confirma contrato, originales, pago, llaves, placas y salida antes de marcharte.", group: "ejecutar" },
  { slug: "vuelta", title: "Checklist de vuelta", description: "Controla documentación, vehículo, ruta y contingencias durante el regreso.", group: "ejecutar" },
  { slug: "espana", title: "Carpeta España", description: "Ordena los hitos de ITV, fiscalidad, DGT y placas.", group: "ejecutar" },
  { slug: "metodo-7-dias", title: "Método 7 días", description: "Encaja tareas, citas, pagos y bloqueos en una vista operativa.", group: "ejecutar" },
]);

const TOOL_ALIASES = Object.freeze({
  "operation-dashboard": "operation-dashboard",
  "budget-calculator": "presupuesto",
  "candidate-board": "candidate-board",
  "search-filter-builder": "filtros",
  "ad-analyzer": "analizador-anuncio",
  "question-builder": "preguntas",
  "market-comparator": "mercado",
  "cost-calculator": "coste-total",
  "document-passport": "documentos",
  "travel-planner": "viaje",
  "inspection-checklist": "inspeccion",
  "paint-sheet": "pintura",
  "purchase-exit-checklist": "compra-salida",
  "return-checklist": "vuelta",
  "spain-folder": "espana",
  "method7-planner": "metodo-7-dias",
});

const TOOL_PUBLIC_SLUGS = Object.freeze(Object.fromEntries(
  Object.entries(TOOL_ALIASES).map(([publicSlug, internalSlug]) => [internalSlug, publicSlug]),
));

const TOOL_STATE_KEYS = Object.freeze({
  presupuesto: "budget",
  filtros: "searchFilters",
  "analizador-anuncio": "adAnalyzer",
  mercado: "market",
  "coste-total": "costs",
  documentos: "documents",
  preguntas: "questions",
  viaje: "travel",
  inspeccion: "inspection",
  pintura: "paint",
  "compra-salida": "purchaseExit",
  vuelta: "returnTrip",
  espana: "spain",
  "metodo-7-dias": "method7",
});

const OPERATION_FIELDS = Object.freeze([
  ["title", "Nombre de la operación", "text", "Mi primera importación"],
  ["purpose", "Finalidad", "select", [["personal", "Comprar para mí"], ["resale", "Estudiar una reventa"], ["learning", "Aprender"], ["helping", "Ayudar a otra persona"]]],
  ["status", "Estado actual", "select", [["learning", "Aprendiendo"], ["searching", "Buscando"], ["candidate", "Candidato"], ["verifying", "Verificando"], ["travel", "Viaje preparado"], ["inspection", "Inspección"], ["purchased", "Comprado"], ["returning", "Regreso"], ["spain", "En España"], ["itv", "ITV"], ["taxes", "Impuestos"], ["dgt", "DGT"], ["registered", "Matriculado"]]],
  ["country", "País", "text", "Alemania"], ["totalBudget", "Presupuesto total disponible (€)", "number", ""],
  ["transportMode", "Forma de traerlo", "select", [["driving", "Volver conduciendo"], ["carrier", "Utilizar transportista"], ["unknown", "Todavía no lo sé"]]],
  ["carWanted", "Vehículo objetivo", "text", ""], ["adUrl", "Enlace del anuncio", "url", "https://"],
  ["brand", "Marca", "text", ""], ["model", "Modelo", "text", ""], ["version", "Versión", "text", ""],
  ["year", "Año", "number", ""], ["firstRegistration", "Primera matriculación", "month", ""],
  ["powerCv", "Potencia (CV)", "number", ""], ["powerKw", "Potencia (kW)", "number", ""],
  ["mileage", "Kilómetros", "number", ""], ["fuel", "Combustible", "text", ""],
  ["transmission", "Transmisión", "text", ""], ["body", "Carrocería", "text", ""],
  ["price", "Precio del vehículo (€)", "number", ""], ["seller", "Vendedor", "text", ""],
  ["location", "Ubicación", "text", ""], ["phone", "Teléfono", "tel", ""], ["email", "Email", "email", ""],
  ["vin", "VIN", "text", ""], ["v7", "Campo V.7", "text", ""], ["fieldK", "Campo K", "text", ""],
  ["coc", "CoC", "select", [["unknown", "No revisado"], ["yes", "Disponible"], ["no", "No disponible"], ["doubt", "Con dudas"]]],
  ["tuv", "TÜV/HU", "select", [["unknown", "No revisado"], ["valid", "Vigente"], ["expired", "Caducado"], ["none", "No disponible"]]],
  ["tuvDate", "Fecha TÜV/HU", "date", ""], ["reforms", "Reformas", "text", ""],
  ["damage", "Daños", "text", ""], ["history", "Historial", "text", ""],
  ["nextAction", "Siguiente acción", "text", ""], ["decision", "Decisión", "select", [["study", "Seguir estudiando"], ["verify", "Verificar"], ["continue", "Continuar"], ["discard", "Descartar"]]],
  ["notes", "Notas", "textarea", ""],
]);

const COST_ROWS = Object.freeze([
  ["purchase", "Compra"], ["flight", "Vuelo"], ["localTransport", "Transporte local"], ["plates", "Placas"],
  ["insurance", "Seguro"], ["fuel", "Combustible"], ["tolls", "Peajes"], ["hotel", "Hotel"],
  ["food", "Comida"], ["itv", "ITV"], ["coc", "CoC / ficha"], ["ivtm", "IVTM"],
  ["dgt", "Tasa DGT"], ["registrationPlates", "Matrículas"], ["tax576", "Modelo 576"],
  ["maintenance", "Mantenimiento"], ["repairs", "Reparaciones"], ["contingency", "Imprevistos"],
  ["carrier", "Transportista"], ["other", "Otras partidas"],
]);

const COST_GROUPS = Object.freeze([
  ["Compra", ["purchase"]], ["Viaje", ["flight", "localTransport", "hotel", "food"]],
  ["Vuelta", ["plates", "insurance", "fuel", "tolls", "carrier"]],
  ["España", ["itv", "coc", "ivtm", "dgt", "registrationPlates", "tax576"]],
  ["Puesta a punto", ["maintenance", "repairs"]], ["Reserva", ["contingency", "other"]],
]);

const DOCUMENTS = Object.freeze([
  ["vin", "VIN"], ["v7", "Campo V.7"], ["k", "Campo K"], ["coc", "CoC"], ["reducedSheet", "Ficha reducida"],
  ["tuv", "TÜV/HU"], ["teil1", "Teil I"], ["teil2", "Teil II"], ["invoice", "Factura"], ["contract", "Contrato"],
  ["history", "Historial"], ["maintenance", "Facturas de mantenimiento"], ["export", "Documentos de exportación"],
  ["insurance", "Seguro"], ["spanishItv", "ITV española"], ["ivtm", "IVTM"], ["tax", "576 / 05 / 06"],
  ["dgtFee", "Tasa 1.1"], ["dgtApplication", "Solicitud DGT"], ["spanishPermit", "Permiso español"],
]);

const DOCUMENT_STATUSES = Object.freeze([
  ["unchecked", "No revisado"], ["pending", "Pendiente"], ["received", "Recibido"], ["correct", "Correcto"],
  ["doubt", "Duda"], ["unavailable", "No disponible"], ["na", "No aplica"],
]);

const INSPECTION_ITEMS = Object.freeze([
  ["vin", "VIN"], ["diagnosisStart", "Diagnosis inicial"], ["start", "Arranque"], ["idle", "Ralentí"],
  ["fluids", "Líquidos"], ["leaks", "Fugas"], ["paint", "Pintura"], ["gaps", "Huecos de carrocería"],
  ["fasteners", "Tornillos y desmontaje"], ["lights", "Faros y pilotos"], ["glass", "Cristales"], ["structure", "Estructura"],
  ["tyres", "Neumáticos"], ["braking", "Frenada"], ["steering", "Dirección"], ["gearbox", "Caja"],
  ["clutch", "Embrague"], ["road", "Prueba en vía rápida"], ["temperature", "Temperatura"], ["extras", "Extras"],
  ["diagnosisEnd", "Diagnosis final"], ["costs", "Costes detectados"], ["decision", "Decisión"],
]);

const SPAIN_STEPS = Object.freeze([
  ["itv", "ITV de matriculación"], ["ivtm", "IVTM"], ["tax", "Modelo 576 / 05 / 06"],
  ["fee", "Tasa 1.1"], ["dgt", "Expediente DGT"], ["plates", "Fabricación de placas"],
]);

const METHOD_DAYS = Object.freeze([
  ["before", "Antes"], ["day0", "Día 0"], ["day1", "Día 1"], ["days23", "Días 2–3"],
  ["day4", "Día 4"], ["day5", "Día 5"], ["days67", "Días 6–7"],
]);

const app = {
  root: null,
  session: null,
  program: null,
  legacyMap: null,
  state: null,
  route: null,
  saveTimer: 0,
  savePromise: Promise.resolve(),
  saveDirty: false,
  saveState: "idle",
  searchItems: [],
  searchOpen: false,
  onboardingStep: 0,
  onboardingDraft: {},
  candidateEditing: null,
  lastFocused: null,
  onboardingStartedTracked: false,
  method7StartedTracked: false,
  programCompletionTracked: false,
  learningCompletionTracked: false,
  realCompletionTracked: false,
  routeOpenedTracked: false,
  sectionObserver: null,
  observedSections: new Set(),
  toolStarted: new Set(),
  toolCompleted: new Set(),
  migrationNeedsReview: false,
  migrationReviewTracked: false,
};

function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character]));
}

function escapeAttribute(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function slugify(value = "") {
  return String(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function normalizeText(value = "") {
  return String(value).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

function clamp(number, min, max) {
  return Math.min(max, Math.max(min, Number(number) || 0));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function currency(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(finite(value));
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(date);
}

function uid(prefix = "item") {
  return `${prefix}_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function academyTrack(event, properties = {}) {
  const allowed = ["programId", "stageId", "lessonId", "toolId", "conceptId", "answerId", "sectionId", "visualId", "mode", "contentType"];
  const safe = { viewport: innerWidth < 720 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop" };
  allowed.forEach((key) => { if (properties[key]) safe[key] = String(properties[key]).slice(0, 100); });
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...safe });
}

function safeInternalPath(value, fallback = PROGRAM_ROOT) {
  try {
    const url = new URL(value || fallback, location.origin);
    if (url.origin !== location.origin) return fallback;
    if (/^\/(?:ruta|etapa|paso|mi-operacion|candidatos|herramientas|respuestas|recursos|soporte|actualizaciones)(?:\/|$)/i.test(url.pathname)) {
      url.pathname = `/academia${url.pathname}`;
    }
    return /^\/academia(?:\/|$)/i.test(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}

async function fetchJson(url, options = {}) {
  const headers = { Accept: "application/json", ...options.headers };
  const response = await fetch(url, { credentials: "same-origin", cache: "default", ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.message || payload.error || "request_failed"), {
      status: response.status, code: payload.error || payload.code || "request_failed", payload,
    });
  }
  return payload;
}

function unwrap(payload, key) {
  if (payload && typeof payload === "object" && payload[key] && typeof payload[key] === "object") return payload[key];
  return payload || {};
}

function normalizeProgram(payload) {
  const program = clone(unwrap(payload, "program"));
  program.schemaVersion = Math.max(1, finite(program.schemaVersion, 1));
  program.id ||= "importa-tu-primer-coche";
  program.slug ||= "importa-tu-primer-coche";
  program.title ||= "Importa tu primer coche";
  program.descriptor ||= "Desde cero, paso a paso";
  program.learningCompletionCopy ||= program.completionSemantics?.learning?.message || "";
  program.realOperationCompletionCopy ||= program.completionSemantics?.realOperation?.message || "";
  const globalLessons = Array.isArray(program.lessons) ? program.lessons : [];
  const lessonById = new Map();
  globalLessons.forEach((lesson, index) => {
    if (!lesson || typeof lesson !== "object") return;
    lesson.id ||= lesson.slug || `lesson-${index + 1}`;
    lesson.slug ||= slugify(lesson.id);
    lessonById.set(String(lesson.id), lesson);
    lessonById.set(String(lesson.slug), lesson);
  });
  program.stages = (Array.isArray(program.stages) ? program.stages : []).map((stage, index) => {
    const normalized = { ...stage };
    normalized.id ||= normalized.slug || `stage-${index + 1}`;
    normalized.slug ||= slugify(normalized.id);
    normalized.order = finite(normalized.order, index);
    const nested = Array.isArray(normalized.lessons) ? normalized.lessons : [];
    nested.forEach((lesson, lessonIndex) => {
      lesson.id ||= lesson.slug || `${normalized.id}-${lessonIndex + 1}`;
      lesson.slug ||= slugify(lesson.id);
      lesson.stageId ||= normalized.id;
      if (!lessonById.has(String(lesson.id))) globalLessons.push(lesson);
      lessonById.set(String(lesson.id), lesson);
      lessonById.set(String(lesson.slug), lesson);
    });
    const ids = Array.isArray(normalized.lessonIds) ? normalized.lessonIds : nested.map((lesson) => lesson.id);
    normalized.lessons = ids.map((id) => lessonById.get(String(id))).filter(Boolean);
    normalized.tools = Array.isArray(normalized.tools) ? normalized.tools : Array.isArray(normalized.toolIds) ? normalized.toolIds : [];
    if (!normalized.completionMessage && normalized.completion) normalized.completionMessage = typeof normalized.completion === "string" ? normalized.completion : normalized.completion.message || normalized.completion.copy;
    return normalized;
  }).sort((a, b) => a.order - b.order);
  globalLessons.forEach((lesson) => {
    const stage = program.stages.find((item) => String(item.id) === String(lesson.stageId) || item.slug === lesson.stageId);
    if (stage && !stage.lessons.some((item) => item.id === lesson.id)) stage.lessons.push(lesson);
  });
  const stageOrder = new Map(program.stages.flatMap((stage, index) => [[String(stage.id), finite(stage.order, index)], [String(stage.slug), finite(stage.order, index)]]));
  program.lessons = [...new Map(globalLessons.filter(Boolean).map((lesson) => [String(lesson.id), lesson])).values()]
    .sort((a, b) => (stageOrder.get(String(a.stageId)) ?? Number.MAX_SAFE_INTEGER) - (stageOrder.get(String(b.stageId)) ?? Number.MAX_SAFE_INTEGER) || finite(a.order) - finite(b.order));
  program.tools = Array.isArray(program.tools) ? program.tools : [];
  program.faqs = Array.isArray(program.faqs) ? program.faqs : [];
  program.answers = [...new Map([...(Array.isArray(program.answers) ? program.answers : []), ...program.faqs]
    .filter(Boolean).map((answer, index) => [String(answer.id || normalizeText(answer.question || answer.title) || index), answer])).values()];
  program.concepts = Array.isArray(program.concepts) ? program.concepts : [];
  program.searchIndex = Array.isArray(program.searchIndex) ? program.searchIndex : [];
  program.glossary = Array.isArray(program.glossary) ? program.glossary : [];
  program.resources = Array.isArray(program.resources) ? program.resources : [];
  program.officialSources = Array.isArray(program.officialSources) ? program.officialSources : [];
  program.contentFacts = Array.isArray(program.contentFacts) ? program.contentFacts : [];
  return program;
}

function defaultState() {
  return {
    schemaVersion: 2,
    onboardingCompleted: true,
    onboarding: {},
    progress: { completedLessonIds: [], startedLessonIds: [], completedStageIds: [], currentLessonId: "", currentStageId: "", currentAnchor: "", percentage: 0 },
    operation: null,
    candidates: [],
    tools: {},
    preferences: { reducedMotion: false, dashboardMode: "learning", presentationMode: false },
    revision: 0,
  };
}

function normalizeStoredNumbers(state) {
  const normalizeKeys = (object, keys, options = { min: "0" }) => {
    if (!object || typeof object !== "object") return;
    keys.forEach((key) => {
      if (object[key] !== undefined) object[key] = normalizeNumberFieldValue(object[key], options);
    });
  };
  normalizeKeys(state.operation, ["totalBudget", "year", "powerCv", "powerKw", "mileage", "price"]);
  (state.candidates || []).forEach((candidate) => normalizeKeys(candidate, ["year", "mileage", "price"]));
  const tools = state.tools || {};
  normalizeKeys(tools.budget, ["total", "travel", "plates", "return", "spain", "contingency"]);
  normalizeKeys(tools.searchFilters, ["yearMin", "yearMax", "mileageMax", "powerMin", "priceMin", "priceMax", "radius"]);
  normalizeKeys(tools.adAnalyzer, ["price", "mileage"]);
  normalizeKeys(tools.market, ["conservativeValue"]);
  (tools.market?.comparables || []).forEach((comparable) => {
    normalizeKeys(comparable, ["price", "mileage", "power"]);
    normalizeKeys(comparable, ["year"], { min: "1900" });
  });
  normalizeKeys(tools.costs, ["marketValue", "desiredProfit"]);
  Object.values(tools.costs?.rows || {}).forEach((row) => normalizeKeys(row, ["estimated", "confirmed", "actual"]));
  normalizeKeys(tools.paint?.panels, ["bonnet", "roof", "boot", "frontLeft", "frontRight", "doorLeft", "doorRight", "rearLeft", "rearRight"]);
  return state;
}

function normalizeState(payload) {
  const source = clone(unwrap(payload, "state"));
  const base = defaultState();
  const state = { ...base, ...source };
  state.schemaVersion = Math.max(1, finite(source.schemaVersion, app.program?.schemaVersion || 1));
  state.onboardingCompleted = Boolean(source.onboardingCompleted ?? source.preferences?.onboardingComplete ?? source.progress?.onboardingCompleted ?? base.onboardingCompleted);
  state.onboarding = { ...base.onboarding, ...(source.onboarding || source.preferences?.onboarding || source.progress?.onboarding || {}) };
  state.progress = { ...base.progress, ...(source.progress || {}) };
  state.progress.completedLessonIds = [...new Set(source.completedLessonIds || state.progress.completedLessonIds || [])].map(String);
  state.progress.startedLessonIds = [...new Set(state.progress.startedLessonIds || [])].map(String);
  state.progress.completedStageIds = [...new Set(source.completedStageIds || state.progress.completedStageIds || [])].map(String);
  state.operation = source.operation && Object.keys(source.operation).length ? source.operation : null;
  state.candidates = Array.isArray(source.candidates) ? source.candidates : [];
  state.tools = source.tools && typeof source.tools === "object" ? source.tools : {};
  state.preferences = { ...base.preferences, ...(source.preferences || {}) };
  state.revision = finite(payload?.revision ?? source.revision, 0);
  return normalizeStoredNumbers(state);
}

function serializableState(state) {
  const progress = clone(state.progress || {});
  delete progress.onboardingCompleted;
  delete progress.onboarding;
  const preferences = clone(state.preferences || {});
  preferences.onboardingComplete = Boolean(state.onboardingCompleted);
  preferences.onboarding = clone(state.onboarding || {});
  return {
    schemaVersion: Math.max(1, finite(state.schemaVersion, app.program?.schemaVersion || 1)),
    version: finite(state.version, 1) || 1,
    progress,
    operation: state.operation && typeof state.operation === "object" ? clone(state.operation) : {},
    candidates: clone((state.candidates || []).slice(0, 20)),
    tools: clone(state.tools || {}),
    preferences,
    activeLessonId: String(state.progress?.currentLessonId || state.activeLessonId || ""),
    ...(state.migration ? { migration: clone(state.migration) } : {}),
  };
}

function completedLessonSet() {
  return new Set(app.state?.progress?.completedLessonIds || []);
}

function coreStages() {
  const stages = app.program?.stages || [];
  return stages.filter((stage, index) => stage.countsTowardProgress !== false && stage.kind !== "prologue" && !(finite(stage.order, index) === 0 && stages.length === 13));
}

function progressLessons() {
  const lessons = app.program?.lessons || [];
  if (app.program?.schemaVersion >= 2) return lessons.filter((lesson) => lesson.countsTowardProgress !== false);
  const stageIds = new Set(coreStages().map((stage) => String(stage.id)));
  return lessons.filter((lesson) => lesson.countsTowardProgress !== false && stageIds.has(String(lesson.stageId)));
}

function progressInfo() {
  const completed = completedLessonSet();
  const stages = coreStages();
  const allProgramLessons = app.program?.lessons || [];
  const allLessons = progressLessons();
  const completedCount = allLessons.filter((lesson) => completed.has(String(lesson.id))).length;
  const percentage = allLessons.length ? Math.round((completedCount / allLessons.length) * 100) : 0;
  const completedStageIds = stages.filter((stage) => stage.lessons?.length && stage.lessons.every((lesson) => completed.has(String(lesson.id)))).map((stage) => String(stage.id));
  const savedCurrentLesson = findLesson(app.state?.progress?.currentLessonId);
  const currentLesson = savedCurrentLesson && !completed.has(String(savedCurrentLesson.id)) ? savedCurrentLesson
    : allProgramLessons.find((lesson) => !completed.has(String(lesson.id))) || allLessons[allLessons.length - 1] || null;
  const currentStage = currentLesson ? findStage(currentLesson.stageId) : stages.find((stage) => !completedStageIds.includes(String(stage.id))) || stages[0] || app.program?.stages?.[0] || null;
  return { percentage, completedCount, totalLessons: allLessons.length, completedStageIds, stages, currentLesson, currentStage, currentStageId: String(app.state?.progress?.currentStageId || currentStage?.id || "") };
}

function stageDisplayNumber(stage, index) {
  if (stage.kind === "prologue" || stage.countsTowardProgress === false || finite(stage.order, index) === 0) return "00";
  return String(finite(stage.order, index + 1)).padStart(2, "0");
}

function stageAccessiblePosition(stage, index, total) {
  return stageDisplayNumber(stage, index) === "00" ? "Prólogo" : `Etapa ${stageDisplayNumber(stage, index)} de ${Math.max(1, coreStages().length || total - 1)}`;
}

function findStage(value) {
  return (app.program?.stages || []).find((stage) => String(stage.id) === String(value) || stage.slug === value) || null;
}

function findLesson(value) {
  const direct = (app.program?.lessons || []).find((lesson) => String(lesson.id) === String(value) || lesson.slug === value);
  if (direct || !app.legacyMap) return direct || null;
  const target = resolveLegacyLessonTarget(String(value || ""), app.legacyMap);
  return target ? (app.program?.lessons || []).find((lesson) => String(lesson.id) === String(target.lessonId) || lesson.slug === target.lessonSlug) || null : null;
}

function stageStatus(stage, progress = progressInfo()) {
  if (progress.completedStageIds.includes(String(stage.id)) || (stage.lessons?.length && stage.lessons.every((lesson) => completedLessonSet().has(String(lesson.id))))) return "complete";
  if (String(progress.currentStageId || progress.currentStage?.id || "") === String(stage.id)) return "current";
  return "pending";
}

function lessonHref(lesson) { return `/academia/paso/${encodeURIComponent(lesson.slug)}/`; }
function stageHref(stage) { return `/academia/etapa/${encodeURIComponent(stage.slug)}/`; }
function canonicalToolSlug(slug) { return TOOL_ALIASES[slug] || slug; }
function publicToolSlug(slug) {
  const internal = canonicalToolSlug(slug);
  return TOOL_PUBLIC_SLUGS[internal] || slug;
}
function toolHref(slug) {
  const canonical = canonicalToolSlug(slug);
  if (canonical === "operation-dashboard") return "/academia/mi-operacion";
  if (canonical === "candidate-board") return "/academia/candidatos";
  return `/academia/herramientas/${encodeURIComponent(publicToolSlug(canonical))}/`;
}

function parseRoute(pathname = location.pathname) {
  const programBase = PROGRAM_ROOT.replace(/\/+$/, "");
  let path = String(pathname || "/").replace(/\/+$/, "") || "/";
  if (path === programBase) path = "/";
  else if (path.startsWith(`${programBase}/`)) path = path.slice(programBase.length) || "/";
  let match;
  if ((match = path.match(/^\/etapa\/([^/]+)$/i))) return { name: "stage", slug: decodeURIComponent(match[1]) };
  if ((match = path.match(/^\/paso\/([^/]+)$/i))) return { name: "lesson", slug: decodeURIComponent(match[1]) };
  if ((match = path.match(/^\/herramientas\/([^/]+)$/i))) return { name: "tool", slug: decodeURIComponent(match[1]) };
  if (path === "/ruta") return { name: "route" };
  if (path === "/mi-operacion") return { name: "operation" };
  if (path === "/candidatos") return { name: "candidates" };
  if (path === "/herramientas") return { name: "tools" };
  if (path === "/respuestas") return { name: "answers" };
  if (path === "/recursos") return { name: "resources" };
  if (path === "/soporte") return { name: "support" };
  if (path === "/actualizaciones") return { name: "updates" };
  if (path === "/cuenta") return { name: "account" };
  return { name: "dashboard" };
}

function routePath(route) {
  if (route.name === "stage") return `/academia/etapa/${route.slug}/`;
  if (route.name === "lesson") return `/academia/paso/${route.slug}/`;
  if (route.name === "tool") return `/academia/herramientas/${publicToolSlug(route.slug)}/`;
  return ({ route: "/academia/ruta", operation: "/academia/mi-operacion", candidates: "/academia/candidatos", tools: "/academia/herramientas", answers: "/academia/respuestas", resources: "/academia/recursos", support: "/academia/soporte", updates: "/academia/actualizaciones", account: "/academia/cuenta", dashboard: PROGRAM_ROOT })[route.name] || PROGRAM_ROOT;
}

function normalizeRenderedNavigation(root = document) {
  const fixed = {
    "/ruta": "/academia/ruta", "/academia/ruta": "/academia/ruta",
    "/mi-operacion": "/academia/mi-operacion", "/academia/mi-operacion": "/academia/mi-operacion",
    "/candidatos": "/academia/candidatos", "/academia/candidatos": "/academia/candidatos",
    "/herramientas": "/academia/herramientas", "/academia/herramientas": "/academia/herramientas",
    "/respuestas": "/academia/respuestas", "/academia/respuestas": "/academia/respuestas",
    "/recursos": "/academia/recursos", "/academia/recursos": "/academia/recursos",
    "/actualizaciones": "/academia/actualizaciones", "/academia/actualizaciones": "/academia/actualizaciones",
    "/cuenta": "/academia/cuenta", "/academia/cuenta": "/academia/cuenta",
  };
  root.querySelectorAll?.("a[data-nav]").forEach((anchor) => {
    const raw = anchor.getAttribute("href") || "";
    const url = new URL(raw, location.origin);
    if (url.origin !== location.origin) return;
    if (["/soporte", "/academia/soporte", "/academia/ayuda", "/academia/ayuda/"].includes(url.pathname)) {
      anchor.href = `/academia/ayuda/${url.hash}`;
      anchor.removeAttribute("data-nav");
      return;
    }
    const toolMatch = url.pathname.replace(/\/+$/, "").match(/^\/(?:academia\/)?herramientas\/([^/]+)$/i);
    const stageMatch = url.pathname.replace(/\/+$/, "").match(/^\/(?:academia\/)?etapa\/([^/]+)$/i);
    const lessonMatch = url.pathname.replace(/\/+$/, "").match(/^\/(?:academia\/)?paso\/([^/]+)$/i);
    let path = fixed[url.pathname.replace(/\/+$/, "")] || url.pathname;
    if (toolMatch) path = toolHref(decodeURIComponent(toolMatch[1]));
    if (stageMatch) path = `/academia/etapa/${encodeURIComponent(decodeURIComponent(stageMatch[1]))}/`;
    if (lessonMatch) path = `/academia/paso/${encodeURIComponent(decodeURIComponent(lessonMatch[1]))}/`;
    anchor.href = `${path}${url.search}${url.hash}`;
  });
}

function addPageResetControl(root = document) {
  const toolId = app.route.name === "operation" ? "operation-dashboard" : app.route.name === "candidates" ? "candidate-board" : "";
  if (!toolId) return;
  const actions = root.querySelector?.("[data-view-root] .academy-page-head .academy-page-actions");
  if (!actions || actions.querySelector('[data-action="tool-reset"]')) return;
  actions.insertAdjacentHTML("afterbegin", `<button class="academy-button academy-button--ghost academy-button--small" type="button" data-action="tool-reset" data-tool-id="${toolId}">Vaciar datos</button>`);
}

function navigate(path, { replace = false } = {}) {
  const destination = safeInternalPath(path);
  const destinationUrl = new URL(destination, location.origin);
  const method = replace ? "replaceState" : "pushState";
  history[method]({}, "", destination);
  app.route = parseRoute(destinationUrl.pathname);
  renderView();
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  window.requestAnimationFrame(() => {
    const anchorId = destinationUrl.hash ? decodeURIComponent(destinationUrl.hash.slice(1)) : "";
    const anchor = anchorId ? document.getElementById(anchorId) : null;
    if (anchor) {
      if (anchor.tagName === "DETAILS") anchor.open = true;
      anchor.scrollIntoView({ behavior, block: "start" });
    } else scrollTo({ top: 0, behavior });
  });
}

function setSaveState(state) {
  app.saveState = state;
  const element = document.querySelector("[data-save-status]");
  if (!element) return;
  const labels = { idle: "", saving: "Guardando…", saved: "Guardado", error: "Error al guardar" };
  element.dataset.state = state;
  element.textContent = labels[state] || "";
}

function scheduleSave({ immediate = false } = {}) {
  if (app.migrationNeedsReview) {
    setSaveState("error");
    return;
  }
  app.saveDirty = true;
  window.clearTimeout(app.saveTimer);
  setSaveState("saving");
  app.saveTimer = window.setTimeout(saveState, immediate ? 0 : 650);
}

async function saveState() {
  if (!app.saveDirty || !app.state) return;
  app.saveDirty = false;
  const snapshot = serializableState(app.state);
  app.savePromise = app.savePromise.then(async () => {
    setSaveState("saving");
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(snapshot));
      app.state.revision = finite(app.state.revision, 0) + 1;
      setSaveState("saved");
      window.setTimeout(() => { if (app.saveState === "saved") setSaveState("idle"); }, 2000);
    } catch {
      app.saveDirty = true;
      setSaveState("error");
      toast("El navegador no ha permitido guardar en este dispositivo. Mantén esta pantalla abierta para no perder los cambios.", "error");
    }
  });
  await app.savePromise;
  if (app.saveDirty && navigator.onLine) scheduleSave();
}

function getPath(object, path, fallback = "") {
  return String(path).split(".").reduce((value, key) => value?.[key], object) ?? fallback;
}

function setPath(object, path, value) {
  const keys = String(path).split(".");
  let cursor = object;
  keys.slice(0, -1).forEach((key) => {
    if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
}

function toast(message, tone = "info") {
  const region = document.querySelector("[data-toast-region]");
  if (!region) return;
  const element = document.createElement("div");
  element.className = "academy-toast";
  element.dataset.tone = tone;
  element.setAttribute("role", tone === "error" ? "alert" : "status");
  element.textContent = message;
  region.append(element);
  window.setTimeout(() => element.remove(), 4500);
}

function handleVideoEvent(event) {
  const video = event.target.closest?.("video[data-academy-video]");
  if (!video) return;
  const marker = event.type === "ended" ? "completionTracked" : "startTracked";
  if (video.dataset[marker] === "true") return;
  video.dataset[marker] = "true";
  academyTrack(event.type === "ended" ? "academy_video_completed" : "academy_video_started", {
    programId: app.program?.id,
    lessonId: video.dataset.lessonId,
    contentType: "video",
  });
}

function navCurrent(name) {
  if (name === "route") return ["route", "stage", "lesson"].includes(app.route.name);
  if (name === "operation") return ["operation", "candidates"].includes(app.route.name);
  if (name === "tools") return ["tools", "tool"].includes(app.route.name);
  return app.route.name === name;
}

function navLink(href, name, label, icon) {
  return `<a class="academy-nav-link" href="${href}" data-nav${navCurrent(name) ? ' aria-current="page"' : ""}>
    <span class="academy-nav-icon">${iconSvg(icon, { className: "academy-icon" })}</span><span>${escapeHtml(label)}</span></a>`;
}

function mobileNavLink(href, name, label, icon) {
  return `<a href="${href}" data-nav${navCurrent(name) ? ' aria-current="page"' : ""}><span>${iconSvg(icon, { className: "academy-icon" })}</span><span>${escapeHtml(label)}</span></a>`;
}

function userInitials() {
  const user = app.session?.user || app.session || {};
  const name = user.name || user.displayName || "Academia";
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AI";
}

function renderShell() {
  const progress = progressInfo();
  const currentTitle = pageTitle();
  app.root.className = `academy-app${app.state.preferences.presentationMode ? " academy-app--presentation" : ""}`;
  app.root.innerHTML = `
    <div class="academy-app-shell">
      <aside class="academy-sidebar" aria-label="Navegación de la Academia">
        <a class="academy-sidebar-brand" href="${PROGRAM_ROOT}" data-nav>
          <img src="/assets/brand/ivan-imports-wordmark-light.svg" width="430" height="88" alt="IvanImports">
          <span>Academia IvanImports</span><small>${escapeHtml(app.program.descriptor || "Desde cero, paso a paso")}</small>
        </a>
        <nav class="academy-sidebar-nav">
          ${navLink(PROGRAM_ROOT, "dashboard", "Mi ruta", "route")}
          ${navLink("/academia/ruta", "route", "Ruta completa", "map")}
          ${navLink("/academia/mi-operacion", "operation", "Mi operación", "car")}
          ${navLink("/academia/herramientas", "tools", "Herramientas", "tools")}
          ${navLink("/academia/respuestas", "answers", "Respuestas", "search")}
          ${navLink("/academia/recursos", "resources", "Recursos", "book")}
          ${navLink("/academia/actualizaciones", "updates", "Actualizaciones", "checkpoint")}
          <a class="academy-nav-link" href="/academia/ayuda/"><span class="academy-nav-icon">${iconSvg("support", { className: "academy-icon" })}</span><span>Ayuda y sugerencias</span></a>
          <a class="academy-nav-link academy-nav-link--pro" href="/servicios/"><span class="academy-nav-icon">✦</span><span>Servicios PRO</span></a>
        </nav>
        <div class="academy-sidebar-progress">
          <span>Progreso global</span><strong>${progress.percentage}%</strong>
          <div class="academy-progress-track"><div class="academy-progress-bar" style="--progress:${progress.percentage}%"></div></div>
        </div>
      </aside>
      <div class="academy-shell-main">
        <header class="academy-topbar">
          <div class="academy-topbar-title"><strong>${escapeHtml(currentTitle)}</strong><span>${escapeHtml(app.program.title)}</span></div>${app.state.preferences.presentationMode ? `<span class="academy-presentation-badge">Demo segura</span>` : ""}
          <div class="academy-topbar-actions">
            <span class="academy-save-status" data-save-status data-state="${app.saveState}" aria-live="polite">${app.saveState === "saving" ? "Guardando…" : ""}</span>
            <button class="academy-search-trigger" type="button" data-action="search-open" aria-label="Buscar en la Academia">
              ${iconSvg("search", { className: "academy-icon" })}<span>¿Qué necesitas resolver?</span><kbd>Ctrl/⌘ K</kbd>
            </button>
            <a class="academy-version-chip" href="/academia/actualizaciones" data-nav aria-label="Ver actualizaciones">v${escapeHtml(ACADEMY_VERSION)}</a>
          </div>
        </header>
        <main class="academy-main" id="academy-main" tabindex="-1" data-view-root></main>
      </div>
    </div>
    <nav class="academy-mobile-nav" aria-label="Navegación móvil">
      ${mobileNavLink(PROGRAM_ROOT, "dashboard", "Inicio", "home")}${mobileNavLink("/academia/ruta", "route", "Ruta", "map")}
      ${mobileNavLink("/academia/mi-operacion", "operation", "Operación", "car")}${mobileNavLink("/academia/herramientas", "tools", "Herramientas", "tools")}
      ${mobileNavLink("/academia/respuestas", "answers", "Resolver", "search")}
    </nav>
    ${renderSearchDialog()}
    ${renderCandidateDialog()}
    ${renderOnboardingDialog()}
    <div class="academy-toast-region" data-toast-region aria-live="polite"></div>`;
}

function pageTitle() {
  if (app.route.name === "stage") return findStage(app.route.slug)?.title || "Etapa";
  if (app.route.name === "lesson") return findLesson(app.route.slug)?.title || "Lección";
  if (app.route.name === "tool") return toolDefinition(app.route.slug)?.title || "Herramienta";
  return ({ dashboard: "Tu ruta de importación", route: "Ruta completa", operation: "Mi operación", candidates: "Vehículos candidatos", tools: "Herramientas", answers: "Centro de respuestas", resources: "Recursos", support: "Errores y sugerencias", updates: "Actualizaciones", account: "Preferencias" })[app.route.name] || app.program.title;
}

function renderView() {
  if (!app.root || !app.program || !app.state) return;
  renderShell();
  const view = document.querySelector("[data-view-root]");
  const renderers = { dashboard: renderDashboard, route: renderRoutePage, stage: renderStage, lesson: renderLesson, operation: renderOperation, candidates: renderCandidates, tools: renderTools, tool: renderTool, answers: renderAnswers, resources: renderResources, support: renderSupport, updates: renderUpdates, account: renderAccount };
  try {
    const progress = progressInfo();
    const showCompletion = ["dashboard", "route", "stage", "lesson"].includes(app.route.name);
    view.innerHTML = `${renderMigrationNotice()}${showCompletion ? renderCompletionHeroes(progress, app.route.name === "dashboard") : ""}${(renderers[app.route.name] || renderDashboard)()}${renderFeedbackStrip()}`;
    normalizeRenderedNavigation(app.root);
    addPageResetControl(app.root);
    trackCompletionTransitions(progress);
    document.title = `${pageTitle()} | Academia IvanImports`;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = `https://ivanimports.es${routePath(app.route)}`;
    updateDynamicResults();
    bindSectionTracking();
  } catch (error) {
    console.error("Academy view error", error);
    view.innerHTML = renderErrorState("No hemos podido preparar esta pantalla.", "Vuelve a intentarlo. Tus datos siguen guardados en este dispositivo.");
  }
}

function renderMigrationNotice() {
  if (!app.migrationNeedsReview) return "";
  return `<section class="academy-migration-notice" role="alert"><span>${iconSvg("warning")}</span><div><strong>Tu progreso anterior necesita una revisión segura.</strong><p>Lo mostramos en esta sesión, pero no lo sobrescribiremos hasta resolver las referencias que no se pudieron trasladar.</p></div><a class="academy-button academy-button--secondary academy-button--small" href="/soporte" data-nav>Solicitar revisión</a></section>`;
}

function renderLearningCompletion(progress, primaryHeading = false) {
  if (!progress.totalLessons || progress.percentage !== 100) return "";
  const heading = primaryHeading ? "h1" : "h2";
  const copy = app.program.learningCompletionCopy || "Ruta de aprendizaje completada.";
  return `<section class="academy-completion-hero academy-completion-hero--learning" role="status" aria-labelledby="academy-learning-completion-title"><div><span class="academy-eyebrow">Aprendizaje completado</span><${heading} id="academy-learning-completion-title">Tu mapa ya está completo.</${heading}><p>${escapeHtml(copy)}</p><small>Esto confirma tu aprendizaje; no afirma que una operación real haya terminado.</small></div><div class="academy-page-actions"><a class="academy-button academy-button--primary" href="/ruta" data-nav>Repasar mi ruta</a><a class="academy-button academy-button--secondary" href="/mi-operacion" data-nav>Abrir operación real</a></div></section>`;
}

function realOperationCompleted() {
  const operation = app.state?.operation || {};
  const status = normalizeText(operation.status);
  const registration = operation.registrationAssigned === true || operation.registrationConfirmed === true;
  const folder = operation.finalFolderCompleted === true || app.state?.tools?.spain?.finalFolderComplete === true;
  const closure = operation.closureCompleted === true || operation.closureConfirmed === true;
  return ["registered", "matriculado"].includes(status) && registration && folder && closure;
}

function renderRealCompletion(primaryHeading = false) {
  if (!realOperationCompleted()) return "";
  const heading = primaryHeading ? "h1" : "h2";
  const copy = app.program.realOperationCompletionCopy || "Operación real completada.";
  return `<section class="academy-completion-hero academy-completion-hero--real" role="status" aria-labelledby="academy-real-completion-title"><div><span class="academy-eyebrow">Operación real cerrada</span><${heading} id="academy-real-completion-title">Matrícula española confirmada.</${heading}><p>${escapeHtml(copy)}</p></div><div class="academy-page-actions"><a class="academy-button academy-button--primary" href="/mi-operacion" data-nav>Ver expediente</a><a class="academy-button academy-button--secondary" href="/recursos" data-nav>Abrir recursos</a></div></section>`;
}

function renderCompletionHeroes(progress, primaryHeading = false) {
  return `${renderLearningCompletion(progress, primaryHeading)}${renderRealCompletion(primaryHeading && progress.percentage !== 100)}`;
}

function trackCompletionTransitions(progress) {
  if (progress.totalLessons && progress.percentage === 100) {
    if (!app.learningCompletionTracked) {
      academyTrack("academy_learning_route_completed", { programId: app.program.id });
      academyTrack("academy_program_completed", { programId: app.program.id });
    }
    app.learningCompletionTracked = true;
    app.programCompletionTracked = true;
  } else {
    app.learningCompletionTracked = false;
    app.programCompletionTracked = false;
  }
  if (realOperationCompleted()) {
    if (!app.realCompletionTracked) academyTrack("academy_real_operation_completed", { programId: app.program.id });
    app.realCompletionTracked = true;
  } else app.realCompletionTracked = false;
}

function renderErrorState(title, copy, { retry = true } = {}) {
  const actions = retry
    ? `<button class="academy-button academy-button--primary" type="button" data-action="retry">Reintentar</button>`
    : `<div class="academy-error-actions"><a class="academy-button academy-button--primary" href="/academia/ruta" data-nav>Volver a la ruta</a><button class="academy-button academy-button--secondary" type="button" data-action="search-open">Buscar en la Academia</button></div>`;
  return `<div class="academy-error-state"><div class="academy-state-copy"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p>${actions}</div></div>`;
}

function renderPageHead(eyebrow, title, copy = "", actions = "") {
  return `<header class="academy-page-head"><div><span class="academy-eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1>${copy ? `<p>${escapeHtml(copy)}</p>` : ""}</div>${actions ? `<div class="academy-page-actions">${actions}</div>` : ""}</header>`;
}

function continueTarget() {
  const progress = progressInfo();
  if (progress.currentLesson) return { href: lessonHref(progress.currentLesson), label: progress.completedCount ? "Continuar por donde lo dejaste" : "Empezar mi ruta" };
  return { href: "/ruta", label: "Explorar la ruta" };
}

function renderDashboardLegacy() {
  const progress = progressInfo();
  const next = continueTarget();
  const operation = app.state.operation;
  const currentStage = progress.currentStage;
  const currentLessons = currentStage?.lessons || [];
  const heading = "h2";
  return `
    <section class="academy-dashboard-hero">
      <div class="academy-dashboard-copy"><span class="academy-eyebrow">Academia IvanImports</span><${heading}>Tu ruta de importación</${heading}>
        <p>De la primera búsqueda a la matrícula española: identifica dónde estás y cuál es tu siguiente paso.</p>
        <div class="academy-dashboard-actions"><a class="academy-button academy-button--primary" href="${next.href}" data-nav>${escapeHtml(next.label)} <span aria-hidden="true">→</span></a><a class="academy-button academy-button--secondary" href="/ruta" data-nav>Ver ruta completa</a></div>
      </div>
      <div class="academy-progress-summary"><div class="academy-progress-number"><strong>${progress.percentage}</strong><span>%</span></div>
        <p>Has completado ${progress.completedStageIds.length} de ${progress.stages.length || 12} etapas · ${progress.completedCount} de ${progress.totalLessons} lecciones.</p>
        <div class="academy-progress-track"><div class="academy-progress-bar" style="--progress:${progress.percentage}%"></div></div>
      </div>
    </section>
    <div class="academy-dashboard-grid">
      <section class="academy-card academy-route-card" aria-labelledby="dashboard-route-title">
        <div class="academy-route-card-head"><div><h2 id="dashboard-route-title">Mapa de tu ruta</h2><p>La ruta recomienda un orden, pero puedes consultar cualquier etapa.</p></div><span class="academy-badge">${progress.stages.length || 12} etapas${app.program.stages.length > progress.stages.length ? " + empieza aquí" : ""}</span></div>
        ${renderRouteMap(app.program.stages, progress)}
      </section>
      <aside class="academy-dashboard-rail">
        ${renderCurrentStageCard(currentStage, currentLessons, progress)}
        <section class="academy-card academy-operation-mini"><h3>Operación activa</h3>${operation ? `<p><strong>${escapeHtml(operation.title || operation.brand || "Mi importación")}</strong><br>${escapeHtml(operation.nextAction || "Define tu siguiente acción.")}</p><a class="academy-button academy-button--secondary academy-button--small" href="/mi-operacion" data-nav>Abrir expediente</a>` : `<p>Todavía no has creado una operación. Puedes aprender sin tener un coche mirado.</p><a class="academy-button academy-button--secondary academy-button--small" href="/mi-operacion" data-nav>Crear mi primera operación</a>`}</section>
        ${renderSupportMini()}
      </aside>
    </div>
    <section style="margin-top:1rem">${renderDashboardStats(progress)}</section>
    <a class="academy-button academy-button--primary academy-sticky-continue" href="${next.href}" data-nav>${escapeHtml(next.label)} →</a>`;
}

function dashboardMode() {
  return app.state.preferences.dashboardMode === "operation" ? "operation" : "learning";
}

function routeViewModels(progress = progressInfo()) {
  return (app.program.stages || []).map((stage, index) => ({
    ...stage,
    number: stageDisplayNumber(stage, index),
    status: stageStatus(stage, progress),
    href: stageHref(stage),
    lessonCount: stage.lessons?.length || 0,
    accessibleLabel: stageAccessiblePosition(stage, index, app.program.stages.length),
  }));
}

function renderDashboardOperation() {
  const operation = app.state.operation;
  const candidates = app.state.candidates.filter((candidate) => !candidate.discarded);
  if (!operation) return `<section class="academy-card academy-operation-empty"><div class="academy-operation-empty-icon">${iconSvg("car")}</div><span class="academy-eyebrow">Operación real</span><h2>Aprende primero o crea tu expediente cuando tengas un caso.</h2><p>La ruta de aprendizaje no necesita un coche. El expediente real empieza solo cuando tú lo decides.</p><a class="academy-button academy-button--primary" href="/mi-operacion" data-nav>Crear mi operación</a></section>`;
  const checkpoints = [
    ["searching", "Búsqueda", ["searching", "candidate", "verifying", "travel", "inspection", "purchased", "returning", "spain", "itv", "taxes", "dgt", "registered"]],
    ["verification", "Verificación", ["verifying", "travel", "inspection", "purchased", "returning", "spain", "itv", "taxes", "dgt", "registered"]],
    ["travel", "Compra y vuelta", ["travel", "inspection", "purchased", "returning", "spain", "itv", "taxes", "dgt", "registered"]],
    ["spain", "Trámites España", ["spain", "itv", "taxes", "dgt", "registered"]],
    ["registered", "Matrícula", ["registered", "matriculado"]],
  ];
  const status = normalizeText(operation.status || "learning");
  return `<div class="academy-operation-dashboard"><section class="academy-card academy-operation-command"><div><span class="academy-eyebrow">Expediente activo</span><h2>${escapeHtml(operation.title || operation.carWanted || "Mi primera importación")}</h2><p>${escapeHtml(operation.nextAction || "Define la siguiente acción para mantener el control.")}</p></div><div class="academy-operation-command-actions"><span class="academy-badge">${escapeHtml(operation.country || "País pendiente")}</span><a class="academy-button academy-button--primary" href="/mi-operacion" data-nav>Abrir expediente</a></div></section><section class="academy-card academy-operation-timeline"><h2>Del candidato a la matrícula</h2><ol>${checkpoints.map(([id, label, activeStatuses], index) => `<li data-complete="${activeStatuses.includes(status)}"><span>${activeStatuses.includes(status) ? "✓" : index + 1}</span><strong>${label}</strong></li>`).join("")}</ol></section><div class="academy-grid academy-grid--3"><article class="academy-card academy-stat-card"><span>Candidatos activos</span><strong>${candidates.length}</strong><a href="/candidatos" data-nav>Comparar planes →</a></article><article class="academy-card academy-stat-card"><span>Presupuesto</span><strong>${currency(operation.totalBudget)}</strong><a href="/herramientas/coste-total" data-nav>Revisar coste →</a></article><article class="academy-card academy-stat-card"><span>Cierre real</span><strong>${realOperationCompleted() ? "Confirmado" : "Pendiente"}</strong><a href="/herramientas/espana" data-nav>Ver carpeta →</a></article></div></div>`;
}

function renderDashboard() {
  const progress = progressInfo();
  const next = continueTarget();
  const mode = dashboardMode();
  const currentStage = progress.currentStage;
  const lessonUnit = app.program.schemaVersion >= 2 ? "lecciones" : "pasos";
  const heading = "h2";
  const modeSwitch = `<div class="academy-mode-switch" role="group" aria-label="Cambiar vista del panel"><button type="button" data-action="mode-change" data-mode="learning" aria-pressed="${mode === "learning"}">${iconSvg("book")} Aprender</button><button type="button" data-action="mode-change" data-mode="operation" aria-pressed="${mode === "operation"}">${iconSvg("car")} Operación real</button></div>`;
  const learning = `<div class="academy-dashboard-v2-grid"><section class="academy-card academy-route-card academy-route-card--europe"><div class="academy-route-card-head"><div><span class="academy-eyebrow">Tu viaje por Europa</span><h2 id="dashboard-route-title">Mapa de la ruta</h2><p>España → Francia → Benelux → Alemania → España.</p></div><span class="academy-badge">${progress.stages.length || 12} etapas${app.program.stages.length > progress.stages.length ? " + prólogo" : ""}</span></div>${renderRouteMap(app.program.stages, progress)}</section><aside class="academy-dashboard-rail">${renderCurrentStageCard(currentStage, currentStage?.lessons || [], progress)}${renderNextStageCard(currentStage, progress)}<section class="academy-card academy-quick-actions"><h3>Accesos rápidos</h3><a href="/academia/respuestas" data-nav>${iconSvg("search")} Resolver una duda</a><a href="/academia/herramientas" data-nav>${iconSvg("tools")} Abrir herramientas</a><a href="/academia/ruta" data-nav>${iconSvg("map")} Ver ruta completa</a><a href="/academia/mi-operacion" data-nav>${iconSvg("car")} Mi operación</a></section></aside></div>${renderDashboardStats(progress)}`;
  return `${renderAcademyEntryChoices()}<section class="academy-dashboard-hero academy-dashboard-hero--v2"><div class="academy-dashboard-copy"><span class="academy-eyebrow">Academia IvanImports · gratis y sin registro</span><${heading}>Tu ruta de importación</${heading}><p>Aprende con una ruta visual y abre tu expediente real solo cuando lo necesites.</p>${modeSwitch}<div class="academy-dashboard-actions"><a class="academy-button academy-button--primary" href="${next.href}" data-nav>${escapeHtml(next.label)} ${iconSvg("chevron")}</a><a class="academy-button academy-button--secondary" href="/academia/ruta" data-nav>Ver ruta completa</a></div></div><div class="academy-progress-summary"><div class="academy-progress-number"><strong>${progress.percentage}</strong><span>%</span></div><p>${progress.completedCount} de ${progress.totalLessons} ${lessonUnit} · ${progress.completedStageIds.length} de ${progress.stages.length || 12} etapas.</p><div class="academy-progress-track"><div class="academy-progress-bar" style="--progress:${progress.percentage}%"></div></div></div></section>${mode === "operation" ? renderDashboardOperation() : learning}<a class="academy-button academy-button--primary academy-sticky-continue" href="${next.href}" data-nav>${escapeHtml(next.label)} ${iconSvg("chevron")}</a>`;
}

function renderAcademyEntryChoices() {
  const next = continueTarget();
  return `<section class="academy-entry" aria-labelledby="academy-entry-title"><div class="academy-entry-heading"><span class="academy-eyebrow">IvanImports Academy · gratis</span><h1 id="academy-entry-title">Aprende a importar tu primer coche.</h1><p>Desde la primera búsqueda hasta la matrícula española. Gratis, sin registro y explicado para alguien que empieza desde cero.</p><div class="academy-entry-actions"><a class="academy-button academy-button--primary" href="/academia/ruta" data-nav>Empezar desde cero</a><a class="academy-button academy-button--secondary" href="${next.href}" data-nav>Continuar donde lo dejé</a><button class="academy-button academy-button--secondary" type="button" data-action="onboarding-open">Personalizar mi ruta</button><a class="academy-button academy-button--ghost" href="/academia/respuestas" data-nav>Buscar una respuesta</a></div><small>Tu progreso se guarda únicamente en este dispositivo.</small></div><div class="academy-entry-grid"><article class="academy-entry-card academy-entry-card--free"><span class="academy-entry-number">01</span><span class="academy-entry-label">APRENDER</span><h2>TODO ESTÁ AQUÍ. GRATIS.</h2><p>Hazlo por tu cuenta con la ruta completa, herramientas y recursos.</p><ul><li>72 lecciones</li><li>17 herramientas</li><li>Sin registro</li></ul><a class="academy-button academy-button--primary academy-button--wide" href="/academia/ruta" data-nav>ENTRAR EN LA ACADEMIA</a></article><article class="academy-entry-card academy-entry-card--pro"><span class="academy-entry-number">02</span><span class="academy-entry-label">PASAR A LA ACCIÓN</span><h2>PRIMERA IMPORTACIÓN CONTIGO</h2><p>La primera la hacemos juntos. Las siguientes, tú solo.</p><div class="academy-entry-pro-note">997 € IVA incluido · solicitud previa</div><a class="academy-button academy-button--gold academy-button--wide" href="/servicios/primera-importacion-contigo/">SOLICITAR PLAZA</a></article></div></section>`;
}

function renderDashboardStats(progress) {
  const candidateCount = app.state.candidates.filter((candidate) => !candidate.discarded).length;
  const docs = app.state.tools.documents || {};
  const correctDocs = Object.values(docs).filter((value) => value === "correct").length;
  return `<div class="academy-grid academy-grid--4">
    <article class="academy-card academy-stat-card"><span>Próxima parada</span><strong>${escapeHtml(progress.currentStage?.shortTitle || progress.currentStage?.title || "Empieza")}</strong><small>${progress.currentLesson ? escapeHtml(progress.currentLesson.shortTitle || progress.currentLesson.title) : "Explora la ruta"}</small></article>
    <article class="academy-card academy-stat-card"><span>Candidatos activos</span><strong>${candidateCount}</strong><small>Plan A, B y C</small></article>
    <article class="academy-card academy-stat-card"><span>Documentos correctos</span><strong>${correctDocs}</strong><small>de ${DOCUMENTS.length} controlados</small></article>
    <article class="academy-card academy-stat-card"><span>Última actividad</span><strong>${formatDate(app.state.updatedAt || app.state.lastActivityAt) || "Hoy"}</strong><small>Tu avance se guarda automáticamente</small></article>
  </div>`;
}

function renderCurrentStageCard(stage, lessons, progress) {
  if (!stage) return `<section class="academy-card academy-current-card"><span class="academy-badge">Ruta preparada</span><h2>Explora el programa</h2><p>El catálogo aparecerá aquí cuando esté disponible.</p><a class="academy-button" href="/ruta" data-nav>Ver ruta</a></section>`;
  const completed = lessons.filter((lesson) => completedLessonSet().has(String(lesson.id))).length;
  const next = continueTarget();
  return `<section class="academy-card academy-current-card"><span class="academy-badge">Etapa actual</span><h2>${escapeHtml(stage.title)}</h2><p>${escapeHtml(stage.description || stage.subtitle || "Continúa con el siguiente paso recomendado.")}</p>
    <div class="academy-current-meta"><span>${completed}/${lessons.length} lecciones</span>${stage.estimatedMinutes ? `<span>· ${finite(stage.estimatedMinutes)} min</span>` : ""}${stage.tools?.length ? `<span>· ${stage.tools.length} herramientas</span>` : ""}</div>
    <a class="academy-button" href="${next.href || stageHref(stage)}" data-nav>${escapeHtml(next.label || "Continuar lección")} ${iconSvg("chevron")}</a></section>`;
}

function renderNextStageCard(stage, progress) {
  const stages = progress.stages || coreStages();
  const index = stages.findIndex((item) => String(item.id) === String(stage?.id));
  const next = stages[index >= 0 ? index + 1 : 0];
  if (!next) return `<section class="academy-card academy-next-stage-card"><span class="academy-eyebrow">Destino final</span><h3>Método 7 días</h3><p>Repasa el sistema completo y prepara tu operación real.</p><a href="/ruta" data-nav>Ver ruta completa ${iconSvg("chevron")}</a></section>`;
  return `<section class="academy-card academy-next-stage-card"><span class="academy-eyebrow">Siguiente etapa</span><h3>${escapeHtml(next.shortTitle || next.title)}</h3><p>${escapeHtml(next.description || next.subtitle || "Continúa avanzando por la ruta de importación.")}</p><a href="${stageHref(next)}" data-nav>Ver siguiente etapa ${iconSvg("chevron")}</a></section>`;
}

function renderSupportMini() {
  const support = supportData();
  const { active } = supportAvailability(support);
  return `<section class="academy-card academy-support-mini"><h3>${active ? "Acompañamiento activo" : "Resolver una duda"}</h3><p>${active ? `Tu periodo directo está activo${support.endsAt ? ` hasta el ${formatDate(support.endsAt)}` : ""}.` : "Busca una respuesta o consulta las opciones de soporte."}</p><a class="academy-button academy-button--ghost academy-button--small" href="/soporte" data-nav>Ir a soporte</a></section>`;
}

function supportData() {
  const entitlement = app.session?.entitlement || {};
  return {
    ...(app.session?.support || {}),
    ...(app.state?.support || {}),
    eligible: app.state?.support?.eligible ?? app.session?.support?.eligible ?? entitlement.bonus_eligible ?? entitlement.bonusEligible ?? false,
    endsAt: app.state?.support?.endsAt || app.session?.support?.endsAt || entitlement.support_expires_at || entitlement.supportExpiresAt || "",
    status: app.state?.support?.status || app.session?.support?.status || "",
    url: app.state?.support?.url || app.session?.support?.url || entitlement.support_url || entitlement.supportUrl || "",
  };
}

function supportAvailability(support) {
  const status = String(support?.status || "").toLocaleLowerCase("es");
  const end = support?.endsAt ? new Date(support.endsAt) : null;
  const hasValidEnd = Boolean(end && !Number.isNaN(end.getTime()));
  const expired = status === "expired" || Boolean(hasValidEnd && end <= new Date());
  const active = Boolean(support?.eligible) && !expired && (hasValidEnd || status === "active");
  return { active, expired };
}

function routePoints(stages) {
  const count = Math.max(stages.length, 2);
  return stages.map((stage, index) => {
    const provided = stage.mapPosition || {};
    if (Number.isFinite(Number(provided.x)) && Number.isFinite(Number(provided.y))) {
      const x = Number(provided.x) <= 100 ? clamp(provided.x, 5, 95) : clamp((Number(provided.x) / 900) * 100, 5, 95);
      const y = Number(provided.y) <= 100 ? clamp(provided.y, 10, 90) : clamp((Number(provided.y) / 420) * 100, 10, 90);
      return { x, y };
    }
    const ratio = index / (count - 1);
    return { x: 7 + ratio * 86, y: 68 - Math.sin(ratio * Math.PI) * 43 + Math.sin(ratio * Math.PI * 4) * 7 };
  });
}

function renderRouteMapLegacy(stages, progress) {
  if (!stages.length) return `<div class="academy-empty"><div class="academy-state-copy"><strong>La ruta se está preparando</strong><p>No hemos podido cargar las etapas. Recarga la página para intentarlo de nuevo.</p></div></div>`;
  const points = routePoints(stages);
  const svgPoints = points.map((point) => `${(point.x * 9).toFixed(1)},${(point.y * 4.2).toFixed(1)}`).join(" ");
  const currentIndex = Math.max(0, stages.findIndex((stage) => String(stage.id) === String(progress.currentStage?.id)));
  const currentPoint = points[currentIndex] || points[0];
  const routeComplete = stages.length > 1 ? Math.round((currentIndex / (stages.length - 1)) * 1000) : 0;
  const nodes = stages.map((stage, index) => {
    const status = stageStatus(stage, progress);
    return `<div class="academy-route-node" data-status="${status}" style="left:${points[index].x}%;top:${points[index].y}%"><button type="button" data-nav-to="${stageHref(stage)}" aria-label="${escapeAttribute(`${stageAccessiblePosition(stage, index, stages.length)}: ${stage.title}. ${status === "complete" ? "Completada" : status === "current" ? "Etapa actual" : "Pendiente"}`)}">${status === "complete" ? "✓" : stageDisplayNumber(stage, index)}</button><span class="academy-route-node-label">${escapeHtml(stage.shortTitle || stage.title)}</span></div>`;
  }).join("");
  const mobile = stages.map((stage, index) => `<a class="academy-route-mobile-item" data-status="${stageStatus(stage, progress)}" href="${stageHref(stage)}" data-nav><strong>${stageDisplayNumber(stage, index)} · ${escapeHtml(stage.shortTitle || stage.title)}</strong><small>${stageStatus(stage, progress) === "complete" ? "Completada" : stageStatus(stage, progress) === "current" ? "Etapa actual" : "Pendiente"}</small></a>`).join("");
  return `<div class="academy-route-map" aria-hidden="true">
    <svg viewBox="0 0 900 420" preserveAspectRatio="none">
      <defs><linearGradient id="academy-route-progress-gradient"><stop offset="0" stop-color="#16c9d0"/><stop offset="1" stop-color="#16b8a9"/></linearGradient></defs>
      <path class="academy-map-land" d="M-25 310C65 245 120 282 178 226s103-30 160-92 115-80 169-37 62 109 135 101 120-79 179-43 84 70 120 39v190H-25Z"/>
      <path class="academy-map-contour" d="M-10 330c95-81 169-28 240-97s115-34 178-104 127-58 191-4 128 22 201-34 104-7 126 29"/>
      <path class="academy-map-contour" d="M20 262c73-44 120-13 182-62s95-85 165-65 85 98 153 90 86-63 145-44 89 75 169 22"/>
      <polyline class="academy-map-path-future" points="${svgPoints}"/>
      <polyline class="academy-map-path-complete" points="${svgPoints}" pathLength="1000" style="--route-complete:${routeComplete}"/>
      <g class="academy-map-car" transform="translate(${(currentPoint.x * 9 - 18).toFixed(1)} ${(currentPoint.y * 4.2 - 27).toFixed(1)})"><rect x="0" y="12" width="42" height="19" rx="7" fill="white" stroke="currentColor" stroke-width="3"/><path d="M8 12 16 3h16l7 9" fill="white" stroke="currentColor" stroke-width="3"/><circle cx="11" cy="33" r="4" fill="#16c4d8"/><circle cx="33" cy="33" r="4" fill="#16c4d8"/></g>
    </svg>${nodes}</div>
    <div class="academy-route-list-mobile" style="--mobile-progress:${progress.percentage}%">${mobile}</div>
    <ol class="academy-sr-only">${stages.map((stage, index) => `<li><a href="${stageHref(stage)}" data-nav>${stageAccessiblePosition(stage, index, stages.length)}: ${escapeHtml(stage.title)}. ${stageStatus(stage, progress) === "complete" ? "Completada" : stageStatus(stage, progress) === "current" ? "En curso" : "Pendiente"}.</a></li>`).join("")}</ol>`;
}

function renderRouteMap(stages, progress) {
  if (!stages.length) return `<div class="academy-empty"><div class="academy-state-copy"><strong>La ruta se está preparando</strong><p>No hemos podido cargar las etapas. Recarga la página para intentarlo de nuevo.</p></div></div>`;
  const view = routeViewModels(progress).filter((stage) => stage.kind !== "prologue" && stage.countsTowardProgress !== false && stage.number !== "00");
  const requestedCurrentId = progress.currentStageId || progress.currentStage?.id;
  const currentStageId = view.some((stage) => String(stage.id) === String(requestedCurrentId)) ? requestedCurrentId : view[0]?.id;
  return `<div class="academy-route-desktop">${renderEuropeRouteMap({ stages: view, percentage: progress.percentage, currentStageId })}</div><div class="academy-route-mobile-v2">${renderMobileRoute({ stages: view, percentage: progress.percentage, currentStageId })}</div>`;
}

function renderRoutePage() {
  const progress = progressInfo();
  academyTrack("academy_route_opened", { programId: app.program.id });
  if (innerWidth < 720 && !app.routeOpenedTracked) academyTrack("academy_mobile_route_opened", { programId: app.program.id });
  app.routeOpenedTracked = true;
  return `${renderPageHead("Mi ruta", "De cero a matrícula española", "Consulta cualquier etapa cuando la necesites. La progresión es una recomendación, no un bloqueo.", `<a class="academy-button academy-button--primary" href="${continueTarget().href}" data-nav>Continuar →</a>`)}
    <section class="academy-card academy-route-card"><div class="academy-route-card-head"><div><h2>Ruta completa</h2><p>${progress.completedStageIds.length} de ${progress.stages.length || 12} etapas completadas.</p></div><span class="academy-badge academy-badge--success">${progress.percentage}%</span></div>${renderRouteMap(app.program.stages, progress)}</section>
    <section class="academy-stage-gallery"><div class="academy-section-head"><div><span class="academy-eyebrow">Las paradas del viaje</span><h2>Explora las 12 etapas y el prólogo</h2></div></div><div class="academy-grid academy-grid--3">${app.program.stages.map((stage, index) => `<article class="academy-card academy-card-pad academy-stage-tile"><div class="academy-stage-tile-icon">${iconSvg(stageIconName(stage, index))}</div><span class="academy-badge${stageStatus(stage, progress) === "complete" ? " academy-badge--success" : ""}">${stageStatus(stage, progress) === "complete" ? "Completada" : stageStatus(stage, progress) === "current" ? "Etapa actual" : "Pendiente"}</span><h2>${stageDisplayNumber(stage, index)} · ${escapeHtml(stage.title)}</h2><p>${escapeHtml(stage.description || stage.subtitle || "")}</p><a class="academy-button academy-button--ghost academy-button--small" href="${stageHref(stage)}" data-nav>Ver etapa ${iconSvg("chevron")}</a></article>`).join("")}</div></section>`;
}

function renderStageLegacy() {
  const stage = findStage(app.route.slug);
  if (!stage) return renderErrorState("No encontramos esta etapa.", "Abre la ruta completa para elegir una etapa disponible.", { retry: false });
  const completed = completedLessonSet();
  const completeCount = (stage.lessons || []).filter((lesson) => completed.has(String(lesson.id))).length;
  const percentage = stage.lessons?.length ? Math.round((completeCount / stage.lessons.length) * 100) : 0;
  academyTrack("academy_stage_opened", { programId: app.program.id, stageId: stage.id });
  return `<nav aria-label="Migas de pan"><ol class="academy-breadcrumbs"><li><a href="${PROGRAM_ROOT}" data-nav>Inicio</a></li><li><a href="/ruta" data-nav>Ruta</a></li><li aria-current="page">${escapeHtml(stage.shortTitle || stage.title)}</li></ol></nav>
    <section class="academy-stage-hero"><div><span class="academy-stage-number">${stage.kind === "prologue" ? "Preparación" : `Etapa ${finite(stage.order) || (app.program.stages.indexOf(stage) + 1)}`}</span><h1>${escapeHtml(stage.title)}</h1><p>${escapeHtml(stage.description || stage.subtitle || "")}</p></div><div class="academy-stage-progress-ring" style="--progress:${percentage}%"><strong>${percentage}%</strong></div></section>
    ${percentage === 100 && stage.completionMessage ? `<section class="academy-stage-complete" role="status"><span aria-hidden="true">✓</span><div><strong>${escapeHtml(stage.completionMessage)}</strong><p>Has completado todas las lecciones de esta etapa.</p></div></section>` : ""}
    <section style="margin-top:1rem"><div class="academy-section-head"><div><h2>Lecciones de esta etapa</h2><p>${completeCount} de ${stage.lessons?.length || 0} completadas</p></div></div>
      <div class="academy-lesson-list">${stage.lessons?.length ? stage.lessons.map((lesson, index) => renderLessonCard(lesson, index, completed)).join("") : `<div class="academy-empty"><div class="academy-state-copy"><strong>Contenido no disponible todavía</strong><p>Esta etapa está en el mapa, pero sus lecciones aún no se han cargado.</p></div></div>`}</div>
      ${stage.checkpoint ? `<article class="academy-checkpoint-card"><span class="academy-eyebrow">Punto de control</span><h2>${escapeHtml(stage.checkpoint.title || stage.checkpoint)}</h2>${stage.checkpoint.description ? `<p>${escapeHtml(stage.checkpoint.description)}</p>` : ""}</article>` : ""}
    </section>`;
}

function renderStage() {
  const stage = findStage(app.route.slug);
  if (!stage) return renderErrorState("No encontramos esta etapa.", "Abre la ruta completa para elegir una etapa disponible.", { retry: false });
  const completed = completedLessonSet();
  const lessons = stage.lessons || [];
  const completeCount = lessons.filter((lesson) => completed.has(String(lesson.id))).length;
  const percentage = lessons.length ? Math.round((completeCount / lessons.length) * 100) : 0;
  const index = app.program.stages.indexOf(stage);
  academyTrack("academy_stage_opened", { programId: app.program.id, stageId: stage.id });
  academyTrack("academy_stage_viewed", { programId: app.program.id, stageId: stage.id });
  const checkpoint = stage.checkpoint;
  const toolLinks = (stage.tools || []).map((tool) => typeof tool === "string" ? tool : tool.slug || tool.id).filter(Boolean);
  return `<nav aria-label="Migas de pan"><ol class="academy-breadcrumbs"><li><a href="${PROGRAM_ROOT}" data-nav>Inicio</a></li><li><a href="/ruta" data-nav>Ruta</a></li><li aria-current="page">${escapeHtml(stage.shortTitle || stage.title)}</li></ol></nav><section class="academy-stage-cinema" data-stage-kind="${escapeAttribute(stage.kind || "route")}"><div class="academy-stage-cinema-copy"><span class="academy-stage-number">${stage.kind === "prologue" ? "Empieza aquí" : `Etapa ${stageDisplayNumber(stage, index)}`}</span><h1>${escapeHtml(stage.title)}</h1><p>${escapeHtml(stage.description || stage.subtitle || "")}</p><div class="academy-stage-cinema-meta"><span>${iconSvg("book")} ${lessons.length} lecciones</span>${stage.estimatedMinutes ? `<span>${iconSvg("clock")} ${finite(stage.estimatedMinutes)} min</span>` : ""}<span>${completeCount}/${lessons.length} completadas</span></div><div class="academy-progress-track"><div class="academy-progress-bar" style="--progress:${percentage}%"></div></div></div>${renderStageScene(stage, index)}</section>${percentage === 100 && stage.completionMessage ? `<section class="academy-stage-complete" role="status">${iconSvg("checkpoint")}<div><strong>${escapeHtml(stage.completionMessage)}</strong><p>Has completado todas las lecciones de esta etapa.</p></div></section>` : ""}<section class="academy-stage-lessons"><div class="academy-section-head"><div><span class="academy-eyebrow">Contenido de la etapa</span><h2>${lessons.length} lecciones para avanzar</h2><p>Abre cualquier lección; la ruta no bloquea consultas.</p></div></div><div class="academy-lesson-list">${lessons.length ? lessons.map((lesson, lessonIndex) => renderLessonCard(lesson, lessonIndex, completed)).join("") : `<div class="academy-empty"><div class="academy-state-copy"><strong>Contenido en preparación</strong><p>No hemos podido cargar las lecciones de esta etapa. Recarga la página para intentarlo de nuevo.</p></div></div>`}</div>${checkpoint ? `<article class="academy-checkpoint-card">${iconSvg("checkpoint")}<div><span class="academy-eyebrow">Punto de control</span><h2>${escapeHtml(checkpoint.title || checkpoint)}</h2>${checkpoint.description ? `<p>${escapeHtml(checkpoint.description)}</p>` : ""}</div></article>` : ""}${toolLinks.length ? `<div class="academy-stage-tools"><h2>Herramientas de esta etapa</h2>${toolLinks.map((slug) => { const tool = toolDefinition(slug); return `<a class="academy-card academy-stage-tool-link" href="${toolHref(slug)}" data-nav><span>${iconSvg(toolIconName(slug))}</span><strong>${escapeHtml(tool.title || slug)}</strong>${iconSvg("chevron")}</a>`; }).join("")}</div>` : ""}</section>`;
}

function renderLessonCard(lesson, index, completed) {
  const done = completed.has(String(lesson.id));
  return `<a class="academy-lesson-card" data-complete="${done}" href="${lessonHref(lesson)}" data-nav><span class="academy-lesson-index">${done ? "✓" : String(index + 1).padStart(2, "0")}</span><span class="academy-lesson-copy"><strong>${escapeHtml(lesson.title)}</strong><span>${escapeHtml(lesson.shortAnswer || lesson.oneSentence || lesson.summary || lesson.learningObjective || "")}</span></span><span class="academy-lesson-meta">${lesson.estimatedMinutes ? `${finite(lesson.estimatedMinutes)} min` : "Abrir lección"} ${iconSvg("chevron")}</span></a>`;
}

function renderLessonLegacy() {
  const lesson = findLesson(app.route.slug);
  if (!lesson) return renderErrorState("No encontramos este paso.", "Utiliza la ruta o la búsqueda para abrir un contenido disponible.", { retry: false });
  const stage = findStage(lesson.stageId);
  const completed = completedLessonSet().has(String(lesson.id));
  app.state.progress.currentLessonId = String(lesson.id);
  if (stage) app.state.progress.currentStageId = String(stage.id);
  scheduleSave();
  academyTrack("academy_lesson_opened", { programId: app.program.id, stageId: stage?.id, lessonId: lesson.id });
  academyTrack("academy_lesson_started", { programId: app.program.id, stageId: stage?.id, lessonId: lesson.id });
  const lessonIndex = app.program.lessons.findIndex((item) => item.id === lesson.id);
  const previous = app.program.lessons[lessonIndex - 1] || null;
  const next = app.program.lessons[lessonIndex + 1] || null;
  return `<nav aria-label="Migas de pan"><ol class="academy-breadcrumbs"><li><a href="${PROGRAM_ROOT}" data-nav>Inicio</a></li><li><a href="/ruta" data-nav>Ruta</a></li>${stage ? `<li><a href="${stageHref(stage)}" data-nav>${escapeHtml(stage.shortTitle || stage.title)}</a></li>` : ""}<li aria-current="page">${escapeHtml(lesson.shortTitle || lesson.title)}</li></ol></nav>
    <div class="academy-lesson-layout"><article class="academy-lesson-article"><header class="academy-lesson-header"><span class="academy-stage-number">${stage ? escapeHtml(stage.title) : "Paso de la ruta"}</span><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.summary || lesson.learningObjective || "")}</p></header>
      ${renderVideo(lesson.video, lesson)}<div class="academy-content-flow">${renderLessonContent(lesson)}</div>${renderLessonGlossary(lesson)}
      ${renderLessonChecklist(lesson)}
      <nav class="academy-lesson-nav" aria-label="Navegación entre lecciones">${previous ? `<a href="${lessonHref(previous)}" data-nav><small>← Lección anterior</small><strong>${escapeHtml(previous.shortTitle || previous.title)}</strong></a>` : `<a href="${stage ? stageHref(stage) : "/ruta"}" data-nav><small>← Volver</small><strong>${stage ? escapeHtml(stage.title) : "Ruta completa"}</strong></a>`}${next ? `<a href="${lessonHref(next)}" data-nav><small>Siguiente lección →</small><strong>${escapeHtml(next.shortTitle || next.title)}</strong></a>` : `<a href="/ruta" data-nav><small>Ruta</small><strong>Ver el mapa completo →</strong></a>`}</nav>
    </article><aside class="academy-lesson-aside"><section class="academy-card academy-lesson-aside-card"><h2>Progreso del paso</h2><p>${completed ? "Este paso está completado." : "Cuando termines, márcalo para actualizar tu ruta."}</p><button class="academy-button ${completed ? "academy-button--secondary" : "academy-button--primary"}" type="button" data-action="lesson-toggle" data-lesson-id="${escapeAttribute(lesson.id)}">${completed ? "Marcar como pendiente" : "Marcar como completado"}</button></section>
      ${lesson.toolLinks?.length ? `<section class="academy-card academy-lesson-aside-card"><h2>Herramientas relacionadas</h2>${lesson.toolLinks.map((slug) => `<a class="academy-button academy-button--ghost academy-button--small" href="${toolHref(typeof slug === "string" ? slug : slug.slug)}" data-nav>${escapeHtml(typeof slug === "string" ? toolDefinition(slug)?.title || slug : slug.title)}</a>`).join("")}</section>` : ""}
      ${lesson.lastReviewed ? `<section class="academy-card academy-lesson-aside-card"><h2>Revisión del contenido</h2><p>Última revisión: ${escapeHtml(formatDate(lesson.lastReviewed) || lesson.lastReviewed)}. Comprueba siempre la fuente vigente antes de ejecutar.</p></section>` : ""}</aside></div>
    ${next ? `<a class="academy-button academy-button--primary academy-sticky-continue" href="${lessonHref(next)}" data-nav>Siguiente lección →</a>` : ""}`;
}

function lessonConcepts(lesson) {
  const ids = new Set([...(lesson.conceptIds || []), ...(lesson.legacyConceptIds || [])].map(String));
  return (app.program.concepts || []).filter((concept) => String(concept.lessonId) === String(lesson.id) || ids.has(String(concept.id)));
}

function renderLessonConcepts(lesson) {
  if (lesson.showConcepts === false) return "";
  const concepts = lessonConcepts(lesson);
  if (!concepts.length) return "";
  return `<section class="academy-lesson-concepts" data-lesson-section="concepts" aria-labelledby="lesson-concepts-title"><div class="academy-section-head"><div><span class="academy-eyebrow">Respuestas dentro de la lección</span><h2 id="lesson-concepts-title">Conceptos que puedes consultar</h2></div></div><div class="academy-concept-grid">${concepts.map((concept) => `<details class="academy-concept-card" id="${escapeAttribute(concept.anchor || concept.slug || concept.id)}" data-concept-id="${escapeAttribute(concept.id)}"><summary><span>${iconSvg(concept.type === "official" ? "official" : "answers")}</span><strong>${escapeHtml(concept.title)}</strong>${iconSvg("chevron")}</summary><div>${concept.shortAnswer ? `<p class="academy-concept-short">${escapeHtml(concept.shortAnswer)}</p>` : ""}${concept.explanation ? `<p>${escapeHtml(concept.explanation)}</p>` : ""}${concept.action ? `<div class="academy-status-message" data-tone="info"><strong>Qué hacer:</strong> ${escapeHtml(concept.action)}</div>` : ""}${renderBlockLinks(concept)}</div></details>`).join("")}</div></section>`;
}

function renderKnowledgeCheck(lesson) {
  const check = lesson.knowledgeCheck;
  if (!check) return "";
  const items = Array.isArray(check) ? check : Array.isArray(check.items) ? check.items : [check];
  return `<section class="academy-knowledge-check" data-lesson-section="knowledge-check"><span class="academy-eyebrow">Comprueba que lo has entendido</span><h2>${escapeHtml(check.title || "Pausa y decide")}</h2>${items.map((item, index) => { const question = typeof item === "string" ? item : item.question || item.title; const answer = typeof item === "object" ? item.answer || item.explanation : ""; return `<details><summary>${escapeHtml(question || `Comprobación ${index + 1}`)}</summary>${answer ? `<p>${escapeHtml(answer)}</p>` : ""}</details>`; }).join("")}</section>`;
}

function renderLesson() {
  const lesson = findLesson(app.route.slug);
  if (!lesson) return renderErrorState("No encontramos esta lección.", "Utiliza la ruta o la búsqueda para abrir un contenido disponible.", { retry: false });
  const stage = findStage(lesson.stageId);
  const completed = completedLessonSet().has(String(lesson.id));
  app.state.progress.currentLessonId = String(lesson.id);
  app.state.progress.currentAnchor = location.hash ? decodeURIComponent(location.hash.slice(1)) : "";
  app.state.progress.startedLessonIds ||= [];
  if (!completed && !app.state.progress.startedLessonIds.includes(String(lesson.id))) app.state.progress.startedLessonIds.push(String(lesson.id));
  if (stage) app.state.progress.currentStageId = String(stage.id);
  scheduleSave();
  academyTrack("academy_lesson_opened", { programId: app.program.id, stageId: stage?.id, lessonId: lesson.id });
  academyTrack("academy_lesson_started", { programId: app.program.id, stageId: stage?.id, lessonId: lesson.id });
  const lessonIndex = app.program.lessons.findIndex((item) => item.id === lesson.id);
  const previous = findLesson(lesson.previousLesson) || app.program.lessons[lessonIndex - 1] || null;
  const next = findLesson(lesson.nextLesson) || app.program.lessons[lessonIndex + 1] || null;
  const type = slugify(lesson.lessonType || "narrative-route");
  const showEssential = lesson.showEssential !== false && Boolean(lesson.oneSentence || lesson.simpleExplanation);
  const localLinks = [
    showEssential ? ["lesson-essential", "Lo esencial"] : null,
    lesson.sections?.length || lesson.blocks?.length || lesson.bodyBlocks?.length ? ["lesson-content", "Desarrollo"] : null,
    lesson.visuals?.length ? ["lesson-visuals", "Visuales"] : null,
    lessonConcepts(lesson).length ? ["lesson-concepts-title", "Conceptos"] : null,
    lesson.checklist?.length ? ["lesson-checklist", "Checklist"] : null,
  ].filter(Boolean);
  return `<nav aria-label="Migas de pan"><ol class="academy-breadcrumbs"><li><a href="${PROGRAM_ROOT}" data-nav>Inicio</a></li><li><a href="/ruta" data-nav>Ruta</a></li>${stage ? `<li><a href="${stageHref(stage)}" data-nav>${escapeHtml(stage.shortTitle || stage.title)}</a></li>` : ""}<li aria-current="page">${escapeHtml(lesson.shortTitle || lesson.title)}</li></ol></nav><div class="academy-lesson-layout academy-lesson-pattern--${escapeAttribute(type)}" data-lesson-id="${escapeAttribute(lesson.id)}"><article class="academy-lesson-article"><header class="academy-lesson-header"><span class="academy-stage-number">${stage ? escapeHtml(stage.title) : "Lección de la ruta"}</span><h1>${escapeHtml(lesson.title)}</h1><p>${escapeHtml(lesson.learningObjective || lesson.summary || "")}</p><div class="academy-lesson-header-meta">${lesson.estimatedMinutes ? `<span>${iconSvg("clock")} ${finite(lesson.estimatedMinutes)} min</span>` : ""}<span>${iconSvg("book")} ${escapeHtml(lessonTypeLabel(lesson.lessonType))}</span></div></header>${renderVideo(lesson.video, lesson)}${showEssential ? `<section class="academy-essential-card" id="lesson-essential" data-lesson-section="essential"><span class="academy-eyebrow">Lo esencial</span>${lesson.oneSentence ? `<h2>${escapeHtml(lesson.oneSentence)}</h2>` : ""}${lesson.simpleExplanation ? `<p>${escapeHtml(typeof lesson.simpleExplanation === "string" ? lesson.simpleExplanation : lesson.simpleExplanation.body || lesson.simpleExplanation.text || "")}</p>` : ""}</section>` : ""}<div class="academy-content-flow" id="lesson-content">${renderLessonContent(lesson)}</div><div id="lesson-visuals">${renderLessonVisuals(lesson)}</div>${renderLessonConcepts(lesson)}${renderLessonGlossary(lesson)}${renderLessonChecklist(lesson)}${renderKnowledgeCheck(lesson)}<nav class="academy-lesson-nav" aria-label="Navegación entre lecciones">${previous ? `<a href="${lessonHref(previous)}" data-nav><small>← Lección anterior</small><strong>${escapeHtml(previous.shortTitle || previous.title)}</strong></a>` : `<a href="${stage ? stageHref(stage) : "/ruta"}" data-nav><small>← Volver</small><strong>${stage ? escapeHtml(stage.title) : "Ruta completa"}</strong></a>`}${next ? `<a href="${lessonHref(next)}" data-nav><small>Siguiente lección →</small><strong>${escapeHtml(next.shortTitle || next.title)}</strong></a>` : `<a href="/ruta" data-nav><small>Ruta</small><strong>Ver el mapa completo →</strong></a>`}</nav></article><aside class="academy-lesson-aside">${localLinks.length ? `<nav class="academy-card academy-lesson-index" aria-label="Índice de esta lección"><span class="academy-eyebrow">En esta lección</span>${localLinks.map(([id, label]) => `<a href="#${escapeAttribute(id)}">${escapeHtml(label)}</a>`).join("")}</nav>` : ""}<section class="academy-card academy-lesson-aside-card"><h2>Tu progreso</h2><p>${completed ? "Esta lección está completada." : "Márcala cuando termines de revisar su contenido y sus decisiones."}</p><button class="academy-button ${completed ? "academy-button--secondary" : "academy-button--primary"}" type="button" data-action="lesson-toggle" data-lesson-id="${escapeAttribute(lesson.id)}">${completed ? "Marcar como pendiente" : "Completar lección"}</button></section>${lesson.toolLinks?.length ? `<section class="academy-card academy-lesson-aside-card"><h2>Herramientas relacionadas</h2>${lesson.toolLinks.map((tool) => { const slug = typeof tool === "string" ? tool : tool.slug || tool.id; return `<a class="academy-button academy-button--ghost academy-button--small" href="${toolHref(slug)}" data-nav>${iconSvg(toolIconName(slug))}${escapeHtml(typeof tool === "object" && tool.title ? tool.title : toolDefinition(slug)?.title || slug)}</a>`; }).join("")}</section>` : ""}${lesson.lastReviewed ? `<section class="academy-card academy-lesson-aside-card"><h2>Contenido revisado</h2><p>${escapeHtml(formatDate(lesson.lastReviewed) || lesson.lastReviewed)}. Comprueba siempre la fuente vigente antes de ejecutar.</p></section>` : ""}</aside></div>${next ? `<a class="academy-button academy-button--primary academy-sticky-continue" href="${lessonHref(next)}" data-nav>Siguiente lección ${iconSvg("chevron")}</a>` : ""}`;
}

function lessonTypeLabel(type) {
  return ({
    NARRATIVE_ROUTE: "Ruta narrativa", VISUAL_DECODER: "Decodificador visual", COMPARISON_LAB: "Laboratorio comparativo",
    GUIDED_CALCULATION: "Cálculo guiado", CONVERSATION_SIMULATOR: "Simulador de conversación",
    INSPECTION_WORKBENCH: "Mesa de inspección", PROCEDURE_TIMELINE: "Cronología del trámite",
  })[type] || "Lección guiada";
}

function renderVideo(video, lesson) {
  if (!video) return "";
  const config = typeof video === "string" ? { url: video } : video;
  const url = safeMediaUrl(config.url || config.src || "");
  const transcript = config.transcript || lesson.transcript;
  const captionEntries = Array.isArray(config.captions) ? config.captions : Array.isArray(config.tracks) ? config.tracks : config.captions ? [config.captions] : [];
  const tracks = captionEntries.map((caption) => {
    const entry = typeof caption === "string" ? { src: caption } : caption;
    const src = safeMediaUrl(entry.src || entry.url || "");
    if (!src) return "";
    return `<track kind="${escapeAttribute(entry.kind || "captions")}" src="${escapeAttribute(src)}" srclang="${escapeAttribute(entry.srclang || entry.language || "es")}" label="${escapeAttribute(entry.label || "Español")}"${entry.default ? " default" : ""}>`;
  }).filter(Boolean).join("");
  let player = "";
  if (url && url.startsWith(location.origin)) player = `<video controls preload="metadata" data-academy-video data-lesson-id="${escapeAttribute(lesson.id)}"${config.poster ? ` poster="${escapeAttribute(safeMediaUrl(config.poster) || "")}"` : ""}><source src="${escapeAttribute(url)}">${tracks}</video>`;
  else if (url && /youtube-nocookie\.com|player\.vimeo\.com/.test(url)) player = `<iframe src="${escapeAttribute(url)}" title="${escapeAttribute(config.title || lesson.title)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  if (!player && !transcript) return "";
  return `<section class="academy-video">${player}${transcript ? `<details class="academy-transcript"><summary>Leer transcripción</summary><div>${escapeHtml(transcript)}</div></details>` : ""}</section>`;
}

function safeMediaUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value, location.origin);
    if (url.origin === location.origin || ["www.youtube-nocookie.com", "player.vimeo.com"].includes(url.hostname)) return url.href;
  } catch { /* invalid */ }
  return "";
}

function blockLabel(type) {
  return ({ simpleExplanation: "En una frase", editorialExplanation: "Explicación", whyItMatters: "Por qué importa", easyExample: "Ejemplo fácil", ivanExperience: "Experiencia de Iván", officialRule: "Regla oficial", recommendation: "Recomendación", quickCalculation: "Cálculo rápido", commonMistake: "Error frecuente", expensiveMistake: "Error que puede costar", decisionBox: "Decisión", actionNow: "Qué haría ahora", whatIf: "Qué pasa si", ideaCentral: "Idea central", trick: "Truco", nextStep: "Siguiente paso", sourceCard: "Fuente" })[type] || "Contenido";
}

function normalizeBlockType(value) {
  const raw = String(value || "body").trim();
  const aliases = {
    accion: "actionNow",
    calculo: "quickCalculation",
    error: "commonMistake",
    experiencia: "ivanExperience",
    oficial: "officialRule",
    recomendacion: "recommendation",
  };
  return aliases[raw.toLocaleLowerCase("es")] || raw.replace(/[^a-zA-Z]/g, "") || "body";
}

function renderLessonContent(lesson) {
  const editorialSections = Array.isArray(lesson.sections) ? lesson.sections.map((section, index) => ({ ...section, id: section.id || `section-${index + 1}` })) : [];
  const blocks = editorialSections.length ? editorialSections : Array.isArray(lesson.blocks) ? lesson.blocks : Array.isArray(lesson.bodyBlocks) ? lesson.bodyBlocks : [];
  const lessonSources = renderBlockLinks(lesson);
  const sourceSection = lessonSources ? `<section class="academy-content-section" data-type="sourceCard" data-lesson-section="official-sources"><span class="academy-content-label">Fuentes oficiales</span><h2>Comprueba la fuente vigente</h2>${lessonSources}</section>` : "";
  if (blocks.length) return `${blocks.map(renderContentBlock).join("")}${sourceSection}`;
  const fields = [["whyItMatters", "whyItMatters"], ["easyExample", "easyExample"], ["realExample", "easyExample"], ["body", "body"], ["ivanExperience", "ivanExperience"], ["officialRules", "officialRule"], ["recommendations", "recommendation"], ["quickCalculations", "quickCalculation"], ["commonMistakes", "commonMistake"], ["decision", "decisionBox"], ["actionNow", "actionNow"], ["nextStep", "actionNow"]];
  const sections = fields.flatMap(([field, type]) => {
    const value = lesson[field];
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => renderContentBlock(typeof item === "object" ? { type, ...item } : { type, body: item }));
    return [renderContentBlock(typeof value === "object" ? { type, ...value } : { type, body: value })];
  });
  return `${sections.join("") || `<section class="academy-content-section academy-content-section--empty"><span class="academy-content-label">Contenido no cargado</span><p>No hemos podido cargar el desarrollo escrito de esta lección. Recarga la página para intentarlo de nuevo.</p></section>`}${sourceSection}`;
}

function renderLessonGlossary(lesson) {
  const requested = Array.isArray(lesson.glossaryTerms) ? lesson.glossaryTerms : [];
  const terms = requested.map((requestedTerm) => {
    const id = typeof requestedTerm === "string" ? requestedTerm : requestedTerm.id || requestedTerm.term;
    return (app.program.glossary || []).find((item) => String(item.id) === String(id) || normalizeText(item.term) === normalizeText(id) || (item.aliases || []).some((alias) => normalizeText(alias) === normalizeText(id)));
  }).filter(Boolean);
  const unique = [...new Map(terms.map((term) => [String(term.id || normalizeText(term.term)), term])).values()];
  if (!unique.length) return "";
  const sectionId = `lesson-glossary-${slugify(lesson.id)}`;
  return `<section class="academy-lesson-glossary" aria-labelledby="${escapeAttribute(sectionId)}"><div><span class="academy-eyebrow">Glosario del paso</span><h2 id="${escapeAttribute(sectionId)}">¿Qué significa?</h2></div><div class="academy-lesson-glossary-list">${unique.map((term) => `<details><summary>${escapeHtml(term.term || term.title)}</summary><p>${escapeHtml(term.definition || term.description || "")}</p></details>`).join("")}</div></section>`;
}

function renderContentBlock(block) {
  if (!block || typeof block !== "object") block = { type: "body", body: block };
  const type = normalizeBlockType(block.type);
  const title = block.title || block.label || blockLabel(type);
  const body = block.body ?? block.text ?? block.content ?? block.description ?? "";
  const paragraphs = Array.isArray(body) ? body : String(body).split(/\n{2,}/).filter(Boolean);
  const bodyMarkup = paragraphs.map((paragraph) => typeof paragraph === "object" ? renderBlockObject(paragraph) : `<p>${escapeHtml(paragraph)}</p>`).join("");
  const items = Array.isArray(block.items) && block.items.length ? `<ul>${block.items.map((item) => `<li>${escapeHtml(typeof item === "object" ? item.text || item.label || item.title : item)}</li>`).join("")}</ul>` : "";
  const tableRows = Array.isArray(block.table) ? block.table : Array.isArray(block.table?.rows) ? block.table.rows : [];
  const tableHeaders = Array.isArray(block.table?.headers) ? block.table.headers : [];
  const table = tableRows.length ? `<div class="academy-table-wrap"><table class="academy-table">${tableHeaders.length ? `<thead><tr>${tableHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>` : ""}<tbody>${tableRows.map((row) => `<tr>${(Array.isArray(row) ? row : Object.values(row)).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : "";
  const value = block.value !== undefined ? `<p><strong>${escapeHtml(block.value)}${block.unit ? ` ${escapeHtml(block.unit)}` : ""}</strong></p>` : "";
  const sourceSegmentIds = Array.isArray(block.sourceSegmentIds) ? block.sourceSegmentIds.map(String).filter(Boolean) : [];
  const sourceSegmentAttribute = sourceSegmentIds.length ? ` data-source-segments="${escapeAttribute(sourceSegmentIds.join(" "))}"` : "";
  return `<section class="academy-content-section"${block.id ? ` id="${escapeAttribute(block.id)}" data-lesson-section="${escapeAttribute(block.id)}"` : ""} data-type="${escapeAttribute(type)}"${sourceSegmentAttribute}><span class="academy-content-label">${escapeHtml(blockLabel(type))}</span>${title && title !== blockLabel(type) ? `<h2>${escapeHtml(title)}</h2>` : ""}${value}${bodyMarkup}${items}${table}${renderBlockLinks(block)}</section>`;
}

function renderBlockObject(value) {
  const title = value.title || value.label;
  const text = value.body || value.text || value.description || "";
  return `${title ? `<h3>${escapeHtml(title)}</h3>` : ""}${text ? `<p>${escapeHtml(text)}</p>` : ""}`;
}

function renderBlockLinks(block) {
  const directSources = Array.isArray(block.sources) ? block.sources : Array.isArray(block.sourceLinks) ? block.sourceLinks : [];
  const sourceIds = [...(Array.isArray(block.sourceIds) ? block.sourceIds : []), ...(Array.isArray(block.officialSourceIds) ? block.officialSourceIds : []), ...(block.sourceId ? [block.sourceId] : []), ...(block.officialSourceId ? [block.officialSourceId] : [])].map(String);
  const catalogSources = sourceIds.map((id) => app.program?.officialSources?.find((source) => String(source.id) === id)).filter(Boolean);
  const sources = [...new Map([...directSources, ...catalogSources].map((source, index) => {
    const key = typeof source === "string" ? source : source.id || source.url || source.href || index;
    return [String(key), source];
  })).values()];
  const safe = sources.map((source) => {
    const url = safeSourceUrl(typeof source === "string" ? source : source.url || source.href);
    if (!url) return "";
    const label = typeof source === "string" ? "Consultar fuente" : source.title || source.label || source.authority || "Consultar fuente";
    const reviewed = typeof source === "object" ? source.lastReviewed || block.lastReviewed : block.lastReviewed;
    const detail = typeof source === "object" ? [source.authority, reviewed ? `revisado ${formatDate(reviewed) || reviewed}` : ""].filter(Boolean).join(" · ") : reviewed ? `Revisado ${formatDate(reviewed) || reviewed}` : "";
    return `<a class="academy-source-link" href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(label)}</strong>${detail ? `<small>${escapeHtml(detail)}</small>` : ""}</a>`;
  }).filter(Boolean);
  return safe.length ? `<div class="academy-source-links" aria-label="Fuentes del contenido">${safe.join("")}</div>` : "";
}

function safeSourceUrl(value) {
  if (!value) return "";
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

function safeExternalUrl(value) {
  if (!value) return "";
  try { const url = new URL(value, location.origin); return url.origin === location.origin || url.protocol === "https:" ? url.href : ""; } catch { return ""; }
}

function renderLessonChecklist(lesson) {
  const checklist = Array.isArray(lesson.checklist) ? lesson.checklist : [];
  if (!checklist.length) return "";
  const saved = app.state.tools.lessonChecklists?.[lesson.id] || {};
  return `<section id="lesson-checklist" data-lesson-section="checklist" style="margin-top:1rem"><div class="academy-section-head"><div><h2>Antes de continuar</h2><p>Marca únicamente lo que hayas comprobado.</p></div></div><div class="academy-checklist-grid">${checklist.map((item, index) => {
    const id = typeof item === "object" ? item.id || `${lesson.id}-${index}` : `${lesson.id}-${index}`;
    const label = typeof item === "object" ? item.label || item.text || item.title : item;
    return `<label class="academy-check"><input type="checkbox" data-lesson-check="${escapeAttribute(lesson.id)}" data-item-id="${escapeAttribute(id)}"${saved[id] ? " checked" : ""}><span>${escapeHtml(label)}</span></label>`;
  }).join("")}</div></section>`;
}

function renderOperationLegacy() {
  const operation = app.state.operation || {};
  const operationStatus = operation.status === "zero" ? "learning" : operation.status;
  const statusLabel = OPERATION_FIELDS.find(([key]) => key === "status")?.[3]?.find(([value]) => value === operationStatus)?.[1] || "Aprendiendo";
  const transportLabel = { driving: "Volver conduciendo", carrier: "Transportista", unknown: "Transporte pendiente" }[operation.transportMode] || "Transporte pendiente";
  return `${renderPageHead("Operación real", "Mi operación", "Guarda en un único expediente la información del vehículo y tu siguiente acción.", `<a class="academy-button academy-button--secondary" href="/academia/candidatos" data-nav>Ver candidatos</a>`)}
    <div class="academy-workspace"><form class="academy-card academy-form-card" data-operation-form novalidate>
      <div class="academy-form-section"><h2>Identificación y estado</h2><div class="academy-form-grid">${OPERATION_FIELDS.slice(0, 8).map((field) => renderOperationField(field, operation)).join("")}</div></div>
      <div class="academy-form-section"><h2>Vehículo</h2><div class="academy-form-grid">${OPERATION_FIELDS.slice(8, 21).map((field) => renderOperationField(field, operation)).join("")}</div></div>
      <div class="academy-form-section"><h2>Vendedor y documentación</h2><div class="academy-form-grid">${OPERATION_FIELDS.slice(21, 33).map((field) => renderOperationField(field, operation)).join("")}</div></div>
      <div class="academy-form-section"><h2>Decisión y siguiente paso</h2><div class="academy-form-grid">${OPERATION_FIELDS.slice(33).map((field) => renderOperationField(field, operation)).join("")}</div></div>
    </form><aside class="academy-card academy-result-card academy-sticky-card"><span class="academy-eyebrow">Resumen</span><div class="academy-decision-panel" style="margin-top:1rem"><div><span>Operación</span><strong>${escapeHtml(operation.title || operation.brand || "Sin nombre")}</strong><small>${escapeHtml(operation.country || "País pendiente")}</small></div><div><span>Presupuesto disponible</span><strong>${currency(operation.totalBudget)}</strong><small>${escapeHtml(transportLabel)}</small></div><div><span>Precio indicado</span><strong>${currency(operation.price)}</strong><small>${escapeHtml(statusLabel)}</small></div><div><span>Siguiente acción</span><strong style="font-size:1rem">${escapeHtml(operation.nextAction || "Defínela en el formulario")}</strong></div></div>${!app.state.operation ? `<p style="margin-top:1rem;color:var(--academy-muted);font-size:.78rem">Empezaremos a guardar cuando completes el primer campo.</p>` : ""}</aside></div>`;
}

function renderOperationField([key, label, type, options], operation) {
  const rawValue = operation[key] ?? "";
  const value = key === "status" && rawValue === "zero" ? "learning" : key === "purpose" && rawValue === "other" ? "helping" : rawValue;
  const wide = ["adUrl", "reforms", "damage", "history", "nextAction", "notes"].includes(key) ? " academy-field--wide" : "";
  if (type === "select") return `<div class="academy-field${wide}"><label for="operation-${key}">${label}</label><select id="operation-${key}" data-operation-field="${key}"><option value="">Selecciona</option>${options.map(([option, text]) => `<option value="${escapeAttribute(option)}"${String(value) === option ? " selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select></div>`;
  if (type === "textarea") return `<div class="academy-field${wide}"><label for="operation-${key}">${label}</label><textarea id="operation-${key}" data-operation-field="${key}" maxlength="3000">${escapeHtml(value)}</textarea></div>`;
  return `<div class="academy-field${wide}"><label for="operation-${key}">${label}</label><input id="operation-${key}" type="${type}" data-operation-field="${key}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(options || "")}"${type === "number" ? ' min="0" step="any"' : ' maxlength="500"'}></div>`;
}

function renderOperation() {
  const operation = app.state.operation || {};
  const statusLabel = OPERATION_FIELDS.find(([key]) => key === "status")?.[3]?.find(([value]) => value === (operation.status === "zero" ? "learning" : operation.status))?.[1] || "Aprendiendo";
  const sections = [
    ["01", "Identidad y estado", "Qué estás importando y cuál es el siguiente paso.", OPERATION_FIELDS.slice(0, 8), true],
    ["02", "Vehículo", "Ficha técnica y comercial del candidato elegido.", OPERATION_FIELDS.slice(8, 21), false],
    ["03", "Vendedor y documentación", "Datos que debes verificar fuera de la analítica.", OPERATION_FIELDS.slice(21, 33), false],
    ["04", "Decisión", "Razón, riesgos, notas y siguiente acción.", OPERATION_FIELDS.slice(33), false],
  ];
  return `${renderPageHead("Operación real", "Mi expediente de importación", "Esta zona describe un caso real. Completar la ruta de aprendizaje no cambia automáticamente su estado.", `<a class="academy-button academy-button--secondary" href="/academia/candidatos" data-nav>${iconSvg("candidates")} Ver candidatos</a>`)}<section class="academy-operation-overview"><article class="academy-card academy-operation-command"><div><span class="academy-eyebrow">Estado actual</span><h2>${escapeHtml(operation.title || operation.carWanted || "Sin operación creada")}</h2><p>${escapeHtml(operation.nextAction || "Completa el primer bloque para definir la siguiente acción.")}</p></div><div><span class="academy-badge">${escapeHtml(statusLabel)}</span><strong>${currency(operation.totalBudget)}</strong><small>presupuesto disponible</small></div></article><div class="academy-grid academy-grid--3"><article class="academy-card academy-stat-card"><span>Vehículo</span><strong>${escapeHtml([operation.brand, operation.model].filter(Boolean).join(" ") || "Pendiente")}</strong><small>${escapeHtml(operation.version || operation.carWanted || "")}</small></article><article class="academy-card academy-stat-card"><span>País / ubicación</span><strong>${escapeHtml(operation.country || "Pendiente")}</strong><small>${escapeHtml(operation.location || "")}</small></article><article class="academy-card academy-stat-card"><span>Cierre real</span><strong>${realOperationCompleted() ? "Confirmado" : "Pendiente"}</strong><a href="${toolHref("espana")}" data-nav>Revisar carpeta →</a></article></div></section><form class="academy-operation-sections" data-operation-form novalidate>${sections.map(([number, title, copy, fields, open]) => `<details class="academy-card academy-operation-section"${open ? " open" : ""}><summary><span>${number}</span><div><strong>${title}</strong><small>${copy}</small></div>${iconSvg("chevron")}</summary><div class="academy-form-grid">${fields.map((field) => renderOperationField(field, operation)).join("")}</div></details>`).join("")}</form>`;
}

function renderCandidates() {
  const candidates = app.state.candidates || [];
  return `${renderPageHead("Plan A/B/C", "Vehículos candidatos", "Guarda alternativas, ordénalas y descarta sin borrar el historial.", `<button class="academy-button academy-button--primary" type="button" data-action="candidate-new">Añadir candidato</button>`)}
    ${candidates.length ? `<div class="academy-candidate-grid">${candidates.map(renderCandidateCard).join("")}</div>` : `<div class="academy-empty"><div class="academy-state-copy"><strong>Todavía no tienes candidatos</strong><p>No has viajado para comprar un coche concreto. Añade Plan A, B y C para comparar sin precipitarte.</p><button class="academy-button academy-button--primary" type="button" data-action="candidate-new">Crear mi primer candidato</button></div></div>`}`;
}

function renderCandidateCard(candidate) {
  return `<article class="academy-card academy-candidate-card" data-discarded="${Boolean(candidate.discarded)}"><span class="academy-badge${candidate.priority === "A" ? " academy-badge--success" : ""}">Plan ${escapeHtml(candidate.priority || "—")}</span><h2>${escapeHtml([candidate.brand, candidate.model].filter(Boolean).join(" ") || candidate.title || "Vehículo sin nombre")}</h2><p>${escapeHtml(candidate.location || candidate.country || "Ubicación pendiente")}</p><div class="academy-card-meta"><span>${currency(candidate.price)}</span>${candidate.mileage ? `<span>· ${finite(candidate.mileage).toLocaleString("es-ES")} km</span>` : ""}${candidate.year ? `<span>· ${escapeHtml(candidate.year)}</span>` : ""}</div><div class="academy-card-actions"><button class="academy-button academy-button--secondary academy-button--small" type="button" data-action="candidate-edit" data-id="${escapeAttribute(candidate.id)}">Editar</button><button class="academy-button academy-button--ghost academy-button--small" type="button" data-action="candidate-duplicate" data-id="${escapeAttribute(candidate.id)}">Duplicar</button><button class="academy-button academy-button--ghost academy-button--small" type="button" data-action="candidate-discard" data-id="${escapeAttribute(candidate.id)}">${candidate.discarded ? "Recuperar" : "Descartar"}</button></div></article>`;
}

function renderCandidateDialog() {
  return `<dialog class="academy-dialog" data-candidate-dialog aria-labelledby="academy-candidate-title"><div class="academy-dialog-head"><h2 id="academy-candidate-title" data-candidate-dialog-title>Nuevo candidato</h2><button class="academy-icon-button" type="button" data-action="candidate-close" aria-label="Cerrar">×</button></div><form class="academy-dialog-body" data-candidate-form><input type="hidden" name="id"><div class="academy-form-grid">
    ${[["priority", "Prioridad", "select"], ["title", "Nombre corto", "text"], ["brand", "Marca", "text"], ["model", "Modelo", "text"], ["version", "Versión", "text"], ["year", "Año", "number"], ["mileage", "Kilómetros", "number"], ["price", "Precio (€)", "number"], ["country", "País", "text"], ["location", "Ubicación", "text"], ["contact", "Contacto", "text"], ["availability", "Disponibilidad", "text"], ["adUrl", "Enlace", "url"], ["distance", "Distancia / ruta", "text"], ["documents", "Documentación", "textarea"], ["notes", "Notas", "textarea"]].map(([name, label, type]) => type === "select" ? `<div class="academy-field"><label for="candidate-${name}">${label}</label><select id="candidate-${name}" name="${name}"><option value="A">Plan A</option><option value="B">Plan B</option><option value="C">Plan C</option></select></div>` : type === "textarea" ? `<div class="academy-field academy-field--wide"><label for="candidate-${name}">${label}</label><textarea id="candidate-${name}" name="${name}" maxlength="2000"></textarea></div>` : `<div class="academy-field"><label for="candidate-${name}">${label}</label><input id="candidate-${name}" name="${name}" type="${type}"${type === "number" ? ' min="0" step="any"' : ' maxlength="500"'}></div>`).join("")}
    </div><div class="academy-page-actions" style="margin-top:1rem;justify-content:flex-end"><button class="academy-button academy-button--secondary" type="button" data-action="candidate-close">Cancelar</button><button class="academy-button academy-button--primary" type="submit">Guardar candidato</button></div></form></dialog>`;
}

function toolDefinition(slug) {
  const canonical = canonicalToolSlug(slug);
  const fromProgram = (app.program?.tools || []).find((tool) => canonicalToolSlug(tool.slug || tool.id) === canonical);
  const standard = TOOL_CATALOG.find((tool) => tool.slug === canonical);
  return { ...(standard || {}), ...(fromProgram || {}), slug: canonical, sourceSlug: fromProgram?.slug || fromProgram?.id || slug };
}

function availableTools() {
  const merged = new Map(TOOL_CATALOG.map((tool) => [tool.slug, toolDefinition(tool.slug)]));
  (app.program?.tools || []).forEach((tool) => {
    const slug = canonicalToolSlug(tool.slug || tool.id);
    merged.set(slug, toolDefinition(slug));
  });
  return [...merged.values()];
}

function renderTools() {
  const tools = availableTools();
  const groups = [
    ["organizar", "Organiza tu operación", "Expediente y estado antes de ejecutar."],
    ["descubrir", "Descubre y verifica", "Búsqueda, anuncios, preguntas y candidatos."],
    ["decidir", "Haz números y decide", "Presupuesto, mercado, coste total y alternativas."],
    ["ejecutar", "Compra, vuelve y matricula", "Viaje, inspección, documentos y España."],
  ];
  const card = (tool) => `<a class="academy-card academy-tool-card" href="${toolHref(tool.slug)}" data-nav><span class="academy-tool-icon">${iconSvg(toolIconName(tool.sourceSlug || tool.slug), { className: "academy-tool-svg" })}</span><span class="academy-badge">${escapeHtml(tool.group || "operativa")}</span><h3>${escapeHtml(tool.title)}</h3><p>${escapeHtml(tool.description || "Herramienta de la ruta.")}</p><strong>Abrir herramienta ${iconSvg("chevron")}</strong></a>`;
  return `<section class="academy-tools-hero">${renderPageHead("Centro operativo", "17 herramientas para una operación real", "Cada herramienta guarda datos de tu expediente. La ruta de aprendizaje permanece separada.", `<a class="academy-button academy-button--secondary" href="/academia/mi-operacion" data-nav>${iconSvg("car")} Abrir operación</a>`)}<picture class="academy-tools-hero-media" aria-hidden="true"><img src="/assets/visuals/final/tools-operations.webp" alt="" width="1672" height="941" decoding="async" fetchpriority="high"></picture></section><div class="academy-tool-groups">${groups.map(([key, title, copy]) => { const members = tools.filter((tool) => (tool.group || TOOL_CATALOG.find((item) => item.slug === tool.slug)?.group || "ejecutar") === key); return members.length ? `<section class="academy-tool-group"><div class="academy-section-head"><div><span class="academy-eyebrow">${String(members.length).padStart(2, "0")} herramientas</span><h2>${title}</h2><p>${copy}</p></div></div><div class="academy-tool-grid">${members.map(card).join("")}</div></section>` : ""; }).join("")}</div>`;
}

function renderTool() {
  const tool = toolDefinition(canonicalToolSlug(app.route.slug));
  academyTrack("academy_tool_opened", { programId: app.program.id, toolId: tool.slug });
  academyTrack("academy_tool_used", { programId: app.program.id, toolId: tool.slug });
  const renderer = ({ presupuesto: renderBudgetTool, filtros: renderSearchFilterTool, "analizador-anuncio": renderAdAnalyzerTool, mercado: renderMarketTool, "coste-total": renderCostTool, documentos: renderDocumentsTool, preguntas: renderQuestionsTool, "plan-abc": renderPlanTool, viaje: renderTravelTool, inspeccion: renderInspectionTool, pintura: renderPaintTool, "compra-salida": renderPurchaseExitTool, vuelta: renderReturnTool, espana: renderSpainTool, "metodo-7-dias": renderMethodTool })[tool.slug];
  const completed = Boolean(app.state.tools?._completed?.[tool.slug]);
  const content = renderer ? renderer() : tool.slug === "operation-dashboard" ? renderDashboardOperation() : tool.slug === "candidate-board" ? renderCandidates() : `<div class="academy-empty"><div class="academy-state-copy"><strong>Definición interactiva no recibida</strong><p>El catálogo identifica esta herramienta, pero todavía no existe un componente operativo asociado.</p><a class="academy-button academy-button--secondary" href="/academia/herramientas" data-nav>Volver al centro</a></div></div>`;
  const headActions = `<button class="academy-button academy-button--ghost academy-button--small" type="button" data-action="tool-reset" data-tool-id="${escapeAttribute(tool.slug)}">Vaciar herramienta</button><span class="academy-tool-head-icon">${iconSvg(toolIconName(tool.sourceSlug || tool.slug))}</span>`;
  return `<nav aria-label="Migas de pan"><ol class="academy-breadcrumbs"><li><a href="${PROGRAM_ROOT}" data-nav>Inicio</a></li><li><a href="/academia/herramientas" data-nav>Herramientas</a></li><li aria-current="page">${escapeHtml(tool.title || tool.slug)}</li></ol></nav>${renderPageHead("Herramienta", tool.title || tool.slug, tool.description || "Tus cambios se guardan automáticamente.", headActions)}<div class="academy-tool-workbench" data-tool-id="${escapeAttribute(tool.slug)}">${content}${!["operation-dashboard", "candidate-board"].includes(tool.slug) ? `<section class="academy-tool-complete-card"><div><strong>${completed ? "Herramienta revisada" : "¿Has terminado esta comprobación?"}</strong><p>Marcarla no certifica el vehículo; registra que has terminado tu revisión actual.</p></div><button class="academy-button ${completed ? "academy-button--secondary" : "academy-button--primary"}" type="button" data-action="tool-complete" data-tool-id="${escapeAttribute(tool.slug)}">${completed ? "Volver a abrir" : "Marcar como revisada"}</button></section>` : ""}</div>`;
}

function renderBudgetTool() {
  const data = app.state.tools.budget || {};
  const fields = [["total", "Presupuesto total"], ["travel", "Viaje o transporte"], ["plates", "Placas y seguro"], ["return", "Vuelta"], ["spain", "Gastos en España"], ["contingency", "Fondo de sorpresas"]];
  return `<div class="academy-workspace"><section class="academy-card academy-form-card"><div class="academy-form-grid">${fields.map(([key, label]) => `<div class="academy-field"><label for="budget-${key}">${label} (€)</label><input id="budget-${key}" type="number" min="0" step="any" value="${escapeAttribute(data[key] ?? "")}" data-tool-field="budget.${key}"></div>`).join("")}</div></section><aside class="academy-card academy-result-card academy-sticky-card"><span class="academy-eyebrow">Resultado orientativo</span><div class="academy-decision-panel" style="margin-top:1rem"><div><span>Precio máximo inicial</span><strong data-budget-result>${currency(budgetResult())}</strong><small>Presupuesto menos reservas e imprevistos.</small></div></div></aside></div>`;
}

function budgetResult() {
  const data = app.state.tools.budget || {};
  return Math.max(0, finite(data.total) - ["travel", "plates", "return", "spain", "contingency"].reduce((total, key) => total + finite(data[key]), 0));
}

function renderSearchFilterTool() {
  const data = app.state.tools.searchFilters || {};
  const textFields = [
    ["name", "Nombre de la búsqueda", "Ej.: Compacto gasolina"], ["brand", "Marca", ""], ["model", "Modelo", ""],
    ["body", "Carrocería", ""], ["fuel", "Combustible", ""], ["transmission", "Transmisión", ""],
    ["country", "País o zona", ""], ["include", "Palabras que debe incluir", "Separadas por comas"],
    ["exclude", "Palabras que quieres excluir", "Separadas por comas"],
  ];
  const numberFields = [["yearMin", "Año mínimo"], ["yearMax", "Año máximo"], ["mileageMax", "Km máximos"], ["powerMin", "Potencia mínima"], ["priceMin", "Precio mínimo (€)"], ["priceMax", "Precio máximo (€)"], ["radius", "Radio de búsqueda (km)"]];
  const coverage = searchFilterCoverage();
  return `<div class="academy-workspace"><section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Criterios comparables</h2><p>Guarda un filtro estable para no cambiar de objetivo con cada anuncio.</p></div></div><div class="academy-form-grid">${textFields.map(([key, label, placeholder]) => `<div class="academy-field${["include", "exclude"].includes(key) ? " academy-field--wide" : ""}"><label for="filter-${key}">${label}</label><input id="filter-${key}" value="${escapeAttribute(data[key] || "")}" placeholder="${escapeAttribute(placeholder)}" maxlength="500" data-tool-field="searchFilters.${key}"></div>`).join("")}${numberFields.map(([key, label]) => `<div class="academy-field"><label for="filter-${key}">${label}</label><input id="filter-${key}" type="number" min="0" step="any" value="${escapeAttribute(data[key] ?? "")}" data-tool-field="searchFilters.${key}"></div>`).join("")}<div class="academy-field academy-field--wide"><label for="filter-routine">Rutina y portales a revisar</label><textarea id="filter-routine" maxlength="3000" data-tool-field="searchFilters.routine">${escapeHtml(data.routine || "")}</textarea></div></div></section><aside class="academy-card academy-result-card academy-sticky-card"><span class="academy-eyebrow">Resumen guardado</span><div class="academy-tool-gauge" data-filter-gauge style="--gauge:${coverage}"><div><strong data-filter-coverage>${coverage}%</strong><small>criterios definidos</small></div></div><div class="academy-decision-panel"><div><span>Búsqueda actual</span><strong data-filter-summary>${escapeHtml(searchFilterSummary())}</strong><small>Edítala cuando cambie tu objetivo, no por impulso.</small></div></div><div class="academy-tool-signal-row"><span>Objetivo</span><span>Límites</span><span>Exclusiones</span><span>Rutina</span></div></aside></div>`;
}

function searchFilterCoverage() {
  const data = app.state.tools.searchFilters || {};
  const keys = ["name", "brand", "model", "body", "fuel", "transmission", "country", "include", "exclude", "yearMin", "yearMax", "mileageMax", "powerMin", "priceMin", "priceMax", "radius", "routine"];
  return Math.round((keys.filter((key) => String(data[key] ?? "").trim()).length / keys.length) * 100);
}

function searchFilterSummary() {
  const data = app.state.tools.searchFilters || {};
  const vehicle = [data.brand, data.model, data.body].filter(Boolean).join(" ") || data.name || "Sin vehículo definido";
  const limits = [data.yearMin && `desde ${data.yearMin}`, data.yearMax && `hasta ${data.yearMax}`, data.mileageMax && `≤ ${finite(data.mileageMax).toLocaleString("es-ES")} km`, data.priceMax && `≤ ${currency(data.priceMax)}`].filter(Boolean);
  return `${vehicle}${limits.length ? ` · ${limits.join(" · ")}` : ""}`;
}

function renderAdAnalyzerTool() {
  const data = app.state.tools.adAnalyzer || {};
  const checks = [
    ["identity", "Versión y datos básicos identificables"], ["vin", "VIN disponible o solicitado"],
    ["mileage", "Kilometraje coherente entre texto y fotos"], ["history", "Historial y mantenimiento mencionados"],
    ["damage", "Daños y reformas explicados"], ["documents", "Documentación descrita"],
    ["seller", "Vendedor y ubicación verificables"], ["photos", "Fotos suficientes, claras y consistentes"],
  ];
  const score = adAnalyzerScore();
  return `<div class="academy-workspace"><section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Ficha del anuncio</h2><p>Registra evidencias y ausencias antes de interpretar el anuncio.</p></div></div><div class="academy-form-grid"><div class="academy-field academy-field--wide"><label for="ad-url">Enlace o referencia</label><input id="ad-url" type="url" maxlength="1000" value="${escapeAttribute(data.url || "")}" data-tool-field="adAnalyzer.url"></div><div class="academy-field"><label for="ad-price">Precio anunciado (€)</label><input id="ad-price" type="number" min="0" step="any" value="${escapeAttribute(data.price ?? "")}" data-tool-field="adAnalyzer.price"></div><div class="academy-field"><label for="ad-mileage">Kilometraje anunciado</label><input id="ad-mileage" type="number" min="0" step="1" value="${escapeAttribute(data.mileage ?? "")}" data-tool-field="adAnalyzer.mileage"></div><div class="academy-field academy-field--wide"><label for="ad-claims">Qué afirma el anuncio</label><textarea id="ad-claims" maxlength="4000" data-tool-field="adAnalyzer.claims">${escapeHtml(data.claims || "")}</textarea></div><div class="academy-field academy-field--wide"><label for="ad-missing">Qué falta o genera dudas</label><textarea id="ad-missing" maxlength="4000" data-tool-field="adAnalyzer.missing">${escapeHtml(data.missing || "")}</textarea></div></div><div class="academy-checklist-grid" style="margin-top:1rem">${checks.map(([key, label]) => `<label class="academy-check"><input type="checkbox" data-tool-field="adAnalyzer.checks.${key}"${data.checks?.[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="academy-form-grid" style="margin-top:1rem"><div class="academy-field"><label for="ad-decision">Decisión provisional</label><select id="ad-decision" data-tool-field="adAnalyzer.decision"><option value="">Sin decidir</option>${[["verify", "Pedir datos"], ["continue", "Seguir verificando"], ["discard", "Descartar"]].map(([value, label]) => `<option value="${value}"${data.decision === value ? " selected" : ""}>${label}</option>`).join("")}</select></div><div class="academy-field"><label for="ad-next">Siguiente comprobación</label><input id="ad-next" maxlength="500" value="${escapeAttribute(data.nextAction || "")}" data-tool-field="adAnalyzer.nextAction"></div></div></section><aside class="academy-card academy-result-card academy-sticky-card"><span class="academy-eyebrow">Cobertura del anuncio</span><div class="academy-tool-gauge" data-ad-gauge style="--gauge:${Math.round((score / checks.length) * 100)}"><div><strong data-ad-score>${score} de ${checks.length}</strong><small>señales registradas</small></div></div><div class="academy-decision-panel"><div><span>Lectura responsable</span><strong>${score === checks.length ? "Cobertura completa" : score >= 4 ? "Verificación en curso" : "Faltan evidencias"}</strong><small>Completar una casilla no sustituye verificar su evidencia.</small></div></div><div class="academy-tool-signal-row"><span>Identidad</span><span>Historial</span><span>Daños</span><span>Documentos</span></div></aside></div>`;
}

function adAnalyzerScore() {
  return Object.values(app.state.tools.adAnalyzer?.checks || {}).filter(Boolean).length;
}

function renderMarketToolLegacy() {
  const data = app.state.tools.market || { comparables: [] };
  const comparables = Array.isArray(data.comparables) ? data.comparables : [];
  return `<section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Comparables añadidos manualmente</h2><p>No se realiza scraping ni se afirma un precio final de venta.</p></div><button class="academy-button academy-button--primary academy-button--small" type="button" data-action="market-add">Añadir comparable</button></div>
    ${comparables.length ? `<div class="academy-table-wrap"><table class="academy-table"><thead><tr><th>URL / referencia</th><th>Precio</th><th>Km</th><th>Año</th><th>Potencia</th><th>Estado</th><th></th></tr></thead><tbody>${comparables.map((item, index) => `<tr><td><input aria-label="URL comparable ${index + 1}" value="${escapeAttribute(item.url || "")}" data-market-field="${index}.url"></td><td><input aria-label="Precio comparable ${index + 1}" type="number" min="0" value="${escapeAttribute(item.price || "")}" data-market-field="${index}.price"></td><td><input aria-label="Kilómetros comparable ${index + 1}" type="number" min="0" value="${escapeAttribute(item.mileage || "")}" data-market-field="${index}.mileage"></td><td><input aria-label="Año comparable ${index + 1}" type="number" min="1900" value="${escapeAttribute(item.year || "")}" data-market-field="${index}.year"></td><td><input aria-label="Potencia comparable ${index + 1}" type="number" min="0" value="${escapeAttribute(item.power || "")}" data-market-field="${index}.power"></td><td><input aria-label="Estado comparable ${index + 1}" value="${escapeAttribute(item.condition || "")}" data-market-field="${index}.condition"></td><td><button class="academy-icon-button" type="button" data-action="market-remove" data-index="${index}" aria-label="Eliminar comparable ${index + 1}">×</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="academy-empty"><div class="academy-state-copy"><strong>No hay comparables</strong><p>Añádelos manualmente desde los portales que tú consultes.</p></div></div>`}
    <div class="academy-grid academy-grid--3" style="margin-top:1rem"><article class="academy-card academy-stat-card"><span>Rango observado</span><strong data-market-range>—</strong></article><article class="academy-card academy-stat-card"><span>Mediana</span><strong data-market-median>—</strong><small>Referencia, no precio de venta.</small></article><article class="academy-card academy-stat-card"><span>Valor conservador elegido</span><div class="academy-field" style="margin-top:.5rem"><input type="number" min="0" value="${escapeAttribute(data.conservativeValue || "")}" data-tool-field="market.conservativeValue" aria-label="Valor conservador"></div></article></div></section>`;
}

function marketStats() {
  const prices = (app.state.tools.market?.comparables || [])
    .map((item) => Number(item.price))
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (!prices.length) return null;
  const middle = Math.floor(prices.length / 2);
  return { min: prices[0], max: prices.at(-1), median: prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2 };
}

function renderMarketTool() {
  const data = app.state.tools.market || { comparables: [] };
  const comparables = Array.isArray(data.comparables) ? data.comparables : [];
  const stats = marketStats();
  const max = stats?.max || 1;
  const chart = comparables.filter((item) => finite(item.price) > 0).slice(0, 12).map((item, index) => `<div class="academy-market-bar"><span style="--bar:${Math.max(8, Math.round((finite(item.price) / max) * 100))}%"></span><small>${escapeHtml(item.title || item.model || `C${index + 1}`)}</small><strong>${currency(item.price)}</strong></div>`).join("");
  return `<section class="academy-market-lab"><div class="academy-grid academy-grid--3"><article class="academy-card academy-stat-card"><span>Rango observado</span><strong data-market-range>${stats ? `${currency(stats.min)} – ${currency(stats.max)}` : "—"}</strong><small>Solo comparables añadidos por ti.</small></article><article class="academy-card academy-stat-card"><span>Mediana</span><strong data-market-median>${stats ? currency(stats.median) : "—"}</strong><small>Referencia, no precio final de venta.</small></article><article class="academy-card academy-stat-card"><label for="market-conservative">Valor conservador elegido</label><input id="market-conservative" type="number" min="0" value="${escapeAttribute(data.conservativeValue ?? "")}" data-tool-field="market.conservativeValue"></article></div><section class="academy-card academy-market-chart"><div class="academy-section-head"><div><h2>Panorama de comparables</h2><p>La altura permite detectar dispersión antes de entrar en el detalle.</p></div><button class="academy-button academy-button--primary academy-button--small" type="button" data-action="market-add">Añadir comparable</button></div>${chart ? `<div class="academy-market-bars" role="img" aria-label="Comparación visual de precios introducidos">${chart}</div>` : `<div class="academy-empty"><div class="academy-state-copy"><strong>No hay comparables</strong><p>Añádelos manualmente desde los portales que tú consultes.</p></div></div>`}</section><details class="academy-card academy-tool-advanced" data-market-editor${comparables.length ? "" : " open"}><summary>Editar detalle de comparables (${comparables.length})</summary>${comparables.length ? `<div class="academy-table-wrap"><table class="academy-table"><thead><tr><th>URL / referencia</th><th>Precio</th><th>Km</th><th>Año</th><th>Potencia</th><th>Estado</th><th></th></tr></thead><tbody>${comparables.map((item, index) => `<tr><td><input aria-label="URL comparable ${index + 1}" value="${escapeAttribute(item.url || "")}" data-market-field="${index}.url"></td><td><input aria-label="Precio comparable ${index + 1}" type="number" min="0" value="${escapeAttribute(item.price ?? "")}" data-market-field="${index}.price"></td><td><input aria-label="Kilómetros comparable ${index + 1}" type="number" min="0" value="${escapeAttribute(item.mileage ?? "")}" data-market-field="${index}.mileage"></td><td><input aria-label="Año comparable ${index + 1}" type="number" min="1900" value="${escapeAttribute(item.year ?? "")}" data-market-field="${index}.year"></td><td><input aria-label="Potencia comparable ${index + 1}" type="number" min="0" value="${escapeAttribute(item.power ?? "")}" data-market-field="${index}.power"></td><td><input aria-label="Estado comparable ${index + 1}" value="${escapeAttribute(item.condition || "")}" data-market-field="${index}.condition"></td><td><button class="academy-icon-button" type="button" data-action="market-remove" data-index="${index}" aria-label="Eliminar comparable ${index + 1}">×</button></td></tr>`).join("")}</tbody></table></div>` : `<p>Añade el primer comparable para abrir la edición.</p>`}</details></section>`;
}

function ensureCosts() {
  app.state.tools.costs ||= { rows: {}, marketValue: "", desiredProfit: "" };
  app.state.tools.costs.rows ||= {};
  return app.state.tools.costs;
}

function renderCostToolLegacy() {
  const data = ensureCosts();
  return `<section class="academy-card academy-form-card"><div class="academy-table-wrap"><table class="academy-table"><thead><tr><th>Partida</th><th>Estimado</th><th>Confirmado</th><th>Real</th><th>Desviación</th></tr></thead><tbody>${COST_ROWS.map(([key, label]) => { const row = data.rows[key] || {}; return `<tr><td><strong>${label}</strong></td>${["estimated", "confirmed", "actual"].map((column) => `<td><input type="number" min="0" step="any" value="${escapeAttribute(row[column] || "")}" data-cost-field="${key}.${column}" aria-label="${label}, ${column}"></td>`).join("")}<td data-cost-diff="${key}">${currency(finite(row.actual) - finite(row.estimated))}</td></tr>`; }).join("")}</tbody></table></div>
    <div class="academy-form-grid" style="margin-top:1rem"><div class="academy-field"><label for="cost-market">Mercado español conservador (€)</label><input id="cost-market" type="number" min="0" step="any" value="${escapeAttribute(data.marketValue || "")}" data-tool-field="costs.marketValue"></div><div class="academy-field"><label for="cost-profit">Beneficio mínimo deseado (€)</label><input id="cost-profit" type="number" min="0" step="any" value="${escapeAttribute(data.desiredProfit || "")}" data-tool-field="costs.desiredProfit"></div></div>
    <div class="academy-grid academy-grid--4" style="margin-top:1rem"><article class="academy-card academy-stat-card"><span>Coste estimado</span><strong data-cost-total="estimated">${currency(costTotals().estimated)}</strong></article><article class="academy-card academy-stat-card"><span>Coste real</span><strong data-cost-total="actual">${currency(costTotals().actual)}</strong></article><article class="academy-card academy-stat-card"><span>Margen bruto</span><strong data-cost-margin>${currency(costTotals().margin)}</strong></article><article class="academy-card academy-stat-card"><span>ROI orientativo</span><strong data-cost-roi>${costTotals().roi.toFixed(1)}%</strong></article></div></section>`;
}

function costTotals() {
  const data = ensureCosts();
  const sums = { estimated: 0, confirmed: 0, actual: 0 };
  Object.values(data.rows).forEach((row) => Object.keys(sums).forEach((key) => { sums[key] += finite(row[key]); }));
  const investment = sums.actual || sums.confirmed || sums.estimated;
  const margin = finite(data.marketValue) - investment;
  return { ...sums, margin, roi: investment > 0 ? (margin / investment) * 100 : 0 };
}

function renderCostTool() {
  const data = ensureCosts();
  const totals = costTotals();
  const groups = COST_GROUPS;
  const groupTotal = (keys, column) => keys.reduce((sum, key) => sum + finite(data.rows[key]?.[column]), 0);
  return `<section class="academy-cost-lab"><div class="academy-grid academy-grid--4"><article class="academy-card academy-stat-card"><span>Estimado</span><strong data-cost-total="estimated">${currency(totals.estimated)}</strong></article><article class="academy-card academy-stat-card"><span>Confirmado</span><strong data-cost-total="confirmed">${currency(totals.confirmed)}</strong></article><article class="academy-card academy-stat-card"><span>Real</span><strong data-cost-total="actual">${currency(totals.actual)}</strong></article><article class="academy-card academy-stat-card"><span>Desviación</span><strong>${currency(totals.actual - totals.estimated)}</strong></article></div><div class="academy-cost-blocks">${groups.map(([label, keys], index) => `<article class="academy-card academy-cost-block" data-block="${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span><h2>${label}</h2><div><small>Estimado</small><strong>${currency(groupTotal(keys, "estimated"))}</strong></div><div><small>Real</small><strong>${currency(groupTotal(keys, "actual"))}</strong></div></article>`).join("")}</div><section class="academy-card academy-cost-decision"><div class="academy-form-grid"><div class="academy-field"><label for="cost-market">Mercado español conservador (€)</label><input id="cost-market" type="number" min="0" step="any" value="${escapeAttribute(data.marketValue ?? "")}" data-tool-field="costs.marketValue"></div><div class="academy-field"><label for="cost-profit">Beneficio mínimo deseado (€)</label><input id="cost-profit" type="number" min="0" step="any" value="${escapeAttribute(data.desiredProfit ?? "")}" data-tool-field="costs.desiredProfit"></div></div><div class="academy-grid academy-grid--2"><article><span>Margen bruto orientativo</span><strong data-cost-margin>${currency(totals.margin)}</strong></article><article><span>ROI orientativo</span><strong data-cost-roi>${totals.roi.toFixed(1)}%</strong></article></div></section><details class="academy-card academy-tool-advanced"><summary>Editar las ${COST_ROWS.length} partidas</summary><div class="academy-table-wrap"><table class="academy-table"><thead><tr><th>Partida</th><th>Estimado</th><th>Confirmado</th><th>Real</th><th>Desviación</th></tr></thead><tbody>${COST_ROWS.map(([key, label]) => { const row = data.rows[key] || {}; return `<tr><td><strong>${label}</strong></td>${["estimated", "confirmed", "actual"].map((column) => `<td><input type="number" min="0" step="any" value="${escapeAttribute(row[column] ?? "")}" data-cost-field="${key}.${column}" aria-label="${label}, ${column}"></td>`).join("")}<td data-cost-diff="${key}">${currency(finite(row.actual) - finite(row.estimated))}</td></tr>`; }).join("")}</tbody></table></div></details></section>`;
}

function renderDocumentsTool() {
  const data = app.state.tools.documents || {};
  return `<section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Pasaporte documental</h2><p>El estado no sustituye la revisión de los originales.</p></div><button class="academy-button academy-button--secondary academy-button--small" type="button" data-action="print">Imprimir</button></div><div class="academy-doc-grid">${DOCUMENTS.map(([key, label]) => `<div class="academy-doc-item"><div><strong>${label}</strong><small>Actualiza cuando lo compruebes.</small></div><select data-document-field="${key}" aria-label="Estado de ${label}">${DOCUMENT_STATUSES.map(([status, text]) => `<option value="${status}"${(data[key] || "unchecked") === status ? " selected" : ""}>${text}</option>`).join("")}</select></div>`).join("")}</div></section>`;
}

function renderQuestionsTool() {
  const questions = Array.isArray(app.state.tools.questions) ? app.state.tools.questions : [];
  return `<div class="academy-workspace"><section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Mis preguntas</h2><p>Añade dudas concretas y ordénalas antes de contactar.</p></div><button class="academy-button academy-button--primary academy-button--small" type="button" data-action="question-add">Añadir pregunta</button></div><div class="academy-grid">${questions.map((question, index) => `<div class="academy-form-grid" style="padding:.8rem;border:1px solid var(--academy-border);border-radius:12px"><div class="academy-field"><label for="question-cat-${index}">Bloque</label><select id="question-cat-${index}" data-question-field="${index}.category">${["Estado general", "Motor, caja y ruedas", "Documentación", "Placas y fechas", "Precio"].map((category) => `<option${question.category === category ? " selected" : ""}>${category}</option>`).join("")}</select></div><div class="academy-field"><label for="question-text-${index}">Pregunta</label><input id="question-text-${index}" value="${escapeAttribute(question.text || "")}" data-question-field="${index}.text" maxlength="500"></div><button class="academy-button academy-button--ghost academy-button--small" type="button" data-action="question-remove" data-index="${index}">Eliminar</button></div>`).join("") || `<div class="academy-empty"><div class="academy-state-copy"><strong>No has añadido preguntas</strong><p>Empieza por una duda concreta. La herramienta no inventará traducciones ni respuestas.</p></div></div>`}</div></section><aside class="academy-card academy-result-card academy-sticky-card"><span class="academy-eyebrow">Lista preparada</span><div class="academy-output" style="margin-top:1rem"><pre data-question-output>${escapeHtml(questionOutput())}</pre></div><button class="academy-button academy-button--secondary academy-button--wide" style="margin-top:.8rem" type="button" data-action="copy-questions">Copiar lista</button></aside></div>`;
}

function questionOutput() {
  const groups = new Map();
  (app.state.tools.questions || []).filter((item) => item.text?.trim()).forEach((item) => {
    const category = item.category || "Otras preguntas";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item.text.trim());
  });
  return [...groups].map(([category, items]) => `${category.toUpperCase()}\n${items.map((item) => `• ${item}`).join("\n")}`).join("\n\n") || "Añade preguntas para preparar tu lista.";
}

function renderPlanTool() {
  return `<section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Plan A/B/C</h2><p>La prioridad se edita desde cada candidato.</p></div><a class="academy-button academy-button--primary academy-button--small" href="/candidatos" data-nav>Gestionar candidatos</a></div>${app.state.candidates.length ? `<div class="academy-candidate-grid">${app.state.candidates.slice().sort((a, b) => String(a.priority).localeCompare(String(b.priority))).map(renderCandidateCard).join("")}</div>` : `<div class="academy-empty"><div class="academy-state-copy"><strong>Primero añade candidatos</strong><p>Guarda al menos una alternativa antes de preparar el viaje.</p></div></div>`}</section>`;
}

function renderTravelTool() {
  const data = app.state.tools.travel || {};
  const fields = [["date", "Fecha", "date"], ["flight", "Vuelo", "text"], ["airport", "Aeropuerto", "text"], ["arrival", "Hora de llegada", "time"], ["transport", "Transporte local", "text"], ["seller", "Vendedor", "text"], ["sellerHours", "Horario", "text"], ["plates", "Placas confirmadas", "select"], ["bank", "Banco preparado", "select"], ["hotel", "Hotel", "text"], ["alternative", "Ruta alternativa", "text"], ["planBC", "Plan B/C", "text"], ["luggage", "Equipaje", "textarea"], ["tools", "Herramientas", "textarea"]];
  return `<div class="academy-workspace"><section class="academy-card academy-form-card"><div class="academy-form-grid">${fields.map(([key, label, type]) => type === "select" ? `<div class="academy-field"><label for="travel-${key}">${label}</label><select id="travel-${key}" data-tool-field="travel.${key}"><option value="">Pendiente</option><option value="yes"${data[key] === "yes" ? " selected" : ""}>Sí</option><option value="no"${data[key] === "no" ? " selected" : ""}>No</option></select></div>` : type === "textarea" ? `<div class="academy-field academy-field--wide"><label for="travel-${key}">${label}</label><textarea id="travel-${key}" data-tool-field="travel.${key}" maxlength="2000">${escapeHtml(data[key] || "")}</textarea></div>` : `<div class="academy-field"><label for="travel-${key}">${label}</label><input id="travel-${key}" type="${type}" value="${escapeAttribute(data[key] || "")}" data-tool-field="travel.${key}" maxlength="500"></div>`).join("")}</div></section><aside class="academy-card academy-result-card academy-sticky-card"><span class="academy-eyebrow">Alertas de preparación</span><div class="academy-grid" style="margin-top:1rem">${travelWarnings().map((warning) => `<div class="academy-status-message" data-tone="${warning.tone}">${escapeHtml(warning.text)}</div>`).join("") || `<div class="academy-status-message" data-tone="success">No hay alertas básicas pendientes.</div>`}</div></aside></div>`;
}

function travelWarnings() {
  const data = app.state.tools.travel || {};
  const warnings = [];
  if (!data.plates || data.plates === "no") warnings.push({ tone: "error", text: "Las placas todavía no están confirmadas." });
  if (!data.bank || data.bank === "no") warnings.push({ tone: "error", text: "Prepara límites y transferencias con el banco." });
  if (!data.planBC) warnings.push({ tone: "info", text: "Tu Plan B/C está vacío." });
  if (data.arrival && data.arrival >= "20:00") warnings.push({ tone: "info", text: "La llegada es tardía; revisa horarios y alternativa." });
  if (data.date) { const day = new Date(`${data.date}T12:00:00`).getDay(); if ([4, 5].includes(day)) warnings.push({ tone: "info", text: "La fecha cae en jueves o viernes; conserva margen para gestiones laborables." }); }
  return warnings;
}

function renderInspectionTool() {
  const data = app.state.tools.inspection || {};
  return `<section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Checklist de inspección</h2><p>Registra hechos observados. La herramienta no diagnostica automáticamente un accidente.</p></div><button class="academy-button academy-button--secondary academy-button--small" type="button" data-action="print">Imprimir</button></div><div class="academy-checklist-grid">${INSPECTION_ITEMS.map(([key, label]) => `<label class="academy-check"><input type="checkbox" data-inspection-field="${key}"${data[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="academy-field" style="margin-top:1rem"><label for="inspection-notes">Observaciones y mediciones</label><textarea id="inspection-notes" data-tool-field="inspection.notes" maxlength="5000">${escapeHtml(data.notes || "")}</textarea></div></section>`;
}

function renderPaintTool() {
  const data = app.state.tools.paint || {};
  const panels = [["frontLeft", "Aleta delantera izq."], ["frontRight", "Aleta delantera dcha."], ["doorLeft", "Puerta izquierda"], ["doorRight", "Puerta derecha"], ["rearLeft", "Aleta trasera izq."], ["rearRight", "Aleta trasera dcha."], ["bonnet", "Capó"], ["roof", "Techo"], ["boot", "Portón / maletero"]];
  return `<div class="academy-paint-workbench"><section class="academy-card academy-paint-car" aria-labelledby="paint-map-title"><div class="academy-section-head"><div><span class="academy-eyebrow">Vista del vehículo</span><h2 id="paint-map-title">Mapa de mediciones</h2><p>Anota cada lectura y compara zonas equivalentes; una cifra aislada no diagnostica una reparación.</p></div></div><svg viewBox="0 0 600 280" role="img" aria-labelledby="paint-car-title paint-car-desc"><title id="paint-car-title">Silueta superior de un vehículo</title><desc id="paint-car-desc">Nueve paneles relacionados con los campos de medición que aparecen junto al dibujo.</desc><g class="academy-paint-silhouette"><path data-panel="bonnet" d="M210 42h180l40 58H170Z"/><path data-panel="roof" d="M210 105h180v70H210Z"/><path data-panel="boot" d="m170 180 40 58h180l40-58Z"/><path data-panel="frontLeft" d="M95 55h105l-35 47H70Z"/><path data-panel="frontRight" d="M400 55h105l25 47h-95Z"/><path data-panel="doorLeft" d="M70 107h135v66H70Z"/><path data-panel="doorRight" d="M395 107h135v66H395Z"/><path data-panel="rearLeft" d="M70 178h95l35 47H95Z"/><path data-panel="rearRight" d="M435 178h95l-25 47H400Z"/></g><circle cx="80" cy="75" r="22"/><circle cx="80" cy="205" r="22"/><circle cx="520" cy="75" r="22"/><circle cx="520" cy="205" r="22"/></svg></section><section class="academy-card academy-form-card"><div class="academy-paint-readings">${panels.map(([key, label]) => `<label><span>${escapeHtml(label)}</span><span><input type="number" min="0" step="1" inputmode="numeric" value="${escapeAttribute(data.panels?.[key] ?? "")}" data-tool-field="paint.panels.${key}" aria-label="${escapeAttribute(`${label}, micras`)}"><small>µm</small></span></label>`).join("")}</div><div class="academy-field" style="margin-top:1rem"><label for="paint-reference">Referencia de la herramienta y observaciones</label><textarea id="paint-reference" maxlength="3000" data-tool-field="paint.notes">${escapeHtml(data.notes || "")}</textarea></div></section></div>`;
}

function renderOperationalChecklist(path, title, copy, items) {
  const saved = getPath(app.state.tools, path, {});
  const done = items.filter(([key]) => saved[key] === true).length;
  return `<section class="academy-card academy-form-card academy-execution-checklist"><div class="academy-section-head"><div><span class="academy-eyebrow">${done} de ${items.length} confirmados</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(copy)}</p></div><div class="academy-stage-progress-ring" style="--progress:${Math.round((done / items.length) * 100)}%"><strong>${Math.round((done / items.length) * 100)}%</strong></div></div><div class="academy-execution-list">${items.map(([key, label, hint], index) => `<label class="academy-execution-item"><input type="checkbox" data-tool-field="${escapeAttribute(path)}.${escapeAttribute(key)}"${saved[key] ? " checked" : ""}><span class="academy-execution-number">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(label)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ""}</span></label>`).join("")}</div><div class="academy-field" style="margin-top:1rem"><label for="${escapeAttribute(path)}-notes">Notas de esta revisión</label><textarea id="${escapeAttribute(path)}-notes" maxlength="3000" data-tool-field="${escapeAttribute(path)}.notes">${escapeHtml(saved.notes || "")}</textarea></div></section>`;
}

function renderPurchaseExitTool() {
  return renderOperationalChecklist("purchaseExit", "Compra y salida", "Confirma cada punto con evidencias antes de entregar el control de la operación al viaje.", [
    ["identity", "Identidad y datos del vendedor", "Coinciden con contrato o factura."], ["vin", "VIN del vehículo y documentos", "Mismo identificador en todos los originales."], ["contract", "Contrato o factura firmado", "Importes, fecha y partes correctos."], ["originals", "Documentos originales recibidos", "No solo fotografías o promesas."], ["keys", "Llaves y accesorios entregados", "Registra cualquier ausencia."], ["payment", "Pago confirmado", "Conserva justificante fuera de la analítica."], ["plates", "Placas y seguro vigentes", "Comprueba alcance y fechas."], ["exit", "Salida y ruta confirmadas", "Incluye una alternativa realista."],
  ]);
}

function renderReturnTool() {
  return renderOperationalChecklist("returnTrip", "Checklist de vuelta", "Mantén separados los controles del vehículo, los documentos y la ruta hasta llegar a España.", [
    ["fuel", "Combustible o carga planificados", "Incluye la primera parada."], ["route", "Ruta principal y alternativa", "Evita depender de un único paso."], ["documents", "Documentación accesible", "Originales protegidos y a mano."], ["insurance", "Seguro y placas dentro de vigencia", "Revisa horas y países cubiertos."], ["warnings", "Testigos y niveles revisados", "Detén la operación si aparece una alerta crítica."], ["breaks", "Descansos previstos", "La prisa no forma parte del método."], ["arrival", "Llegada y custodia en España", "Define dónde quedará el vehículo."], ["next", "Siguiente cita o trámite preparado", "Conserva margen si cambian horarios."],
  ]);
}

function renderSpainTool() {
  const data = app.state.tools.spain || {};
  const operation = app.state.operation || {};
  return `<section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Carpeta de matriculación</h2><p>Selecciona tu perfil y marca cada hito cuando esté realmente resuelto.</p></div></div><div class="academy-field" style="max-width:320px;margin-bottom:1rem"><label for="spain-profile">Titular</label><select id="spain-profile" data-tool-field="spain.profile"><option value="individual"${data.profile === "individual" ? " selected" : ""}>Particular</option><option value="selfEmployed"${data.profile === "selfEmployed" ? " selected" : ""}>Autónomo</option><option value="company"${data.profile === "company" ? " selected" : ""}>Empresa</option></select></div><div class="academy-checklist-grid">${SPAIN_STEPS.map(([key, label], index) => `<label class="academy-check"><input type="checkbox" data-spain-field="${key}"${data[key] ? " checked" : ""}><span><strong>${index + 1}. ${label}</strong></span></label>`).join("")}</div><div class="academy-real-close"><span class="academy-eyebrow">Cierre de una operación real</span><h2>Tres confirmaciones explícitas</h2><p>La ruta formativa puede estar completa sin que estas confirmaciones lo estén.</p><div class="academy-execution-list"><label class="academy-execution-item"><input type="checkbox" data-operation-confirm="registrationAssigned"${operation.registrationAssigned || operation.registrationConfirmed ? " checked" : ""}><span>${iconSvg("spain")}</span><span><strong>Matrícula asignada</strong><small>El estado de la operación debe ser Matriculado.</small></span></label><label class="academy-execution-item"><input type="checkbox" data-operation-confirm="finalFolderCompleted"${operation.finalFolderCompleted || data.finalFolderComplete ? " checked" : ""}><span>${iconSvg("documents")}</span><span><strong>Carpeta final completada</strong><small>Documentos y justificantes de cierre reunidos.</small></span></label><label class="academy-execution-item"><input type="checkbox" data-operation-confirm="closureCompleted"${operation.closureCompleted || operation.closureConfirmed ? " checked" : ""}><span>${iconSvg("checkpoint")}</span><span><strong>Operación cerrada</strong><small>Has revisado el expediente y confirmado su cierre.</small></span></label></div>${realOperationCompleted() ? renderRealCompletion(false) : ""}</div></section>`;
}

function renderMethodTool() {
  const data = app.state.tools.method7 || {};
  return `<section class="academy-card academy-form-card"><div class="academy-section-head"><div><h2>Planificador Método 7 días</h2><p>Es una forma de anticipar bloqueos, no una garantía rígida de plazo.</p></div></div><div class="academy-grid academy-grid--3">${METHOD_DAYS.map(([key, label]) => `<article class="academy-card academy-card-pad"><span class="academy-badge">${label}</span><div class="academy-field" style="margin-top:.7rem"><label for="method-${key}">Vehículo, documentación, citas y pagos</label><textarea id="method-${key}" data-tool-field="method7.${key}" maxlength="2000">${escapeHtml(data[key] || "")}</textarea></div></article>`).join("")}</div><div class="academy-field" style="margin-top:1rem"><label for="method-blocks">Bloqueos y respuesta prevista</label><textarea id="method-blocks" data-tool-field="method7.blockers" maxlength="4000">${escapeHtml(data.blockers || "")}</textarea></div></section>`;
}

function buildSearchItems() {
  const items = [];
  const add = (type, title, summary, href, keywords = [], meta = {}) => {
    if (!title || !href) return;
    const keywordList = Array.isArray(keywords) ? keywords : [keywords];
    const search = normalizeText([title, summary, ...keywordList].join(" "));
    items.push({ type, title: String(title), summary: String(summary || ""), href, search, keywords: keywordList.filter(Boolean), ...meta });
  };
  app.program.stages.forEach((stage) => add("Etapas", stage.title, stage.description || stage.subtitle, stageHref(stage), stage.keywords));
  app.program.lessons.forEach((lesson) => add("Lecciones", lesson.title, lesson.summary || lesson.learningObjective, lessonHref(lesson), [...(lesson.keywords || []), ...(lesson.glossaryTerms || [])], { lessonId: lesson.id, sourcePages: lesson.sourcePages || [] }));
  availableTools().forEach((tool) => add("Herramientas", tool.title, tool.description, toolHref(tool.slug), tool.keywords));
  app.program.concepts.forEach((concept) => {
    const lesson = findLesson(concept.lessonId);
    if (lesson) add("Conceptos", concept.title, concept.shortAnswer || concept.explanation, `${lessonHref(lesson)}#${encodeURIComponent(concept.anchor || concept.slug || concept.id)}`, [...(concept.aliases || []), ...(concept.glossaryTerms || [])], { conceptId: concept.id, lessonId: lesson.id, sourcePages: concept.sourcePages || lesson.sourcePages || [], sourceLabel: "Concepto trazado al material del programa" });
  });
  app.program.answers.forEach((answer) => add("Respuestas", answer.question || answer.title, answer.answer || answer.summary || answer.body, `/respuestas#${slugify(answer.id || answer.question || answer.title)}`, answer.keywords, { answerId: answer.id || slugify(answer.question || answer.title), lessonId: answer.lessonId || "", sourcePages: answer.sourcePages || [], sourceLabel: "Respuesta editorial del programa" }));
  app.program.glossary.forEach((term) => add("Términos", term.term || term.title, term.definition || term.description, `/respuestas#glosario-${slugify(term.id || term.term)}`, term.aliases));
  app.program.resources.forEach((resource) => add("Recursos", resource.title, resource.description, "/recursos", resource.keywords));
  app.program.officialSources.forEach((source) => { if (safeSourceUrl(source.url)) add("Fuentes", source.label || source.title, [source.authority, source.jurisdiction].filter(Boolean).join(" · "), "/respuestas#fuentes-oficiales"); });
  app.program.contentFacts.forEach((fact) => add("Datos revisables", fact.label || fact.title, fact.notes, "/respuestas#fuentes-oficiales", [fact.status, fact.jurisdiction]));
  app.program.searchIndex.forEach((entry) => {
    const lesson = findLesson(entry.lessonId);
    const href = lesson ? `${lessonHref(lesson)}${entry.anchor ? `#${encodeURIComponent(entry.anchor)}` : ""}` : typeof entry.href === "string" && entry.href.startsWith("/") ? safeInternalPath(entry.href) : "";
    const searchType = ({ lesson: "Lecciones", concept: "Conceptos", faq: "Respuestas", glossary: "Términos", tool: "Herramientas" })[entry.kind] || entry.type || "Contenido";
    add(searchType, entry.title || entry.label, entry.summary || entry.shortAnswer || entry.description, href, [...(entry.keywords || entry.aliases || []), entry.text].filter(Boolean), { conceptId: entry.conceptId || (entry.kind === "concept" ? entry.id : ""), answerId: entry.kind === "faq" ? entry.id : "", sourcePages: entry.sourcePages || [] });
  });
  app.searchItems = items;
}

function renderSearchDialog() {
  return `<dialog class="academy-dialog academy-search-dialog" data-search-dialog aria-labelledby="academy-search-title"><div class="academy-search-box">${iconSvg("search")}<label class="academy-sr-only" for="academy-global-search" id="academy-search-title">Buscar en la Academia</label><input id="academy-global-search" type="search" autocomplete="off" placeholder="¿Qué necesitas resolver?" data-search-input><button class="academy-icon-button" type="button" data-action="search-close" aria-label="Cerrar búsqueda">${iconSvg("close")}</button></div><div class="academy-search-results" data-search-results>${renderSearchPrompt()}</div></dialog>`;
}

function renderSearchPrompt() {
  return `<div class="academy-search-prompt"><div class="academy-state-copy"><strong>Pregunta como lo harías a una persona</strong><p>Las respuestas proceden únicamente de las lecciones, conceptos y fuentes ya revisadas.</p></div><div class="academy-search-suggestions" aria-label="Búsquedas sugeridas">${ACADEMY_SEARCH_SUGGESTIONS.map((query) => `<button type="button" data-action="search-suggest" data-query="${escapeAttribute(query)}">${escapeHtml(query)}</button>`).join("")}</div></div>`;
}

function renderSemanticAnswer(answer) {
  if (!answer) return "";
  const pages = answer.sourcePages?.length ? ` · págs. ${answer.sourcePages.join("–")}` : "";
  return `<article class="academy-search-answer" data-confidence="${escapeAttribute(answer.confidence)}"><div class="academy-search-answer-head"><span>${iconSvg("answers")}</span><div><small>Respuesta encontrada · confianza ${escapeHtml(answer.confidence)}</small><strong>${escapeHtml(answer.title)}</strong></div></div><p>${escapeHtml(String(answer.text).slice(0, 520))}</p><footer><span>${escapeHtml(answer.sourceLabel)}${escapeHtml(pages)}</span><button class="academy-button academy-button--ghost academy-button--small" type="button" data-nav-to="${escapeAttribute(answer.href)}"${answer.conceptId ? ` data-search-concept-id="${escapeAttribute(answer.conceptId)}"` : ""}>Abrir contexto</button></footer></article>`;
}

function renderRankedResult(result) {
  const { item } = result;
  return `<button class="academy-search-result" type="button" data-nav-to="${escapeAttribute(item.href)}"${item.conceptId ? ` data-search-concept-id="${escapeAttribute(item.conceptId)}"` : ""}${item.answerId ? ` data-search-answer-id="${escapeAttribute(item.answerId)}"` : ""}><span class="academy-search-result-icon">${iconSvg(item.type === "Herramientas" ? "tools" : item.type === "Conceptos" || item.type === "Respuestas" ? "answers" : "book")}</span><span><b>${escapeHtml(item.title)}</b>${item.summary ? `<small>${escapeHtml(item.summary.slice(0, 180))}</small>` : ""}<em>${escapeHtml(result.reason || "Coincidencia en el programa")}</em></span>${iconSvg("chevron")}</button>`;
}

function renderSearchResultList(query) {
  const container = document.querySelector("[data-search-results]");
  if (!container) return;
  if (!query.trim()) { container.innerHTML = renderSearchPrompt(); return; }
  const response = answerSemanticQuery(query, app.searchItems, { limit: 30 });
  const results = response.results;
  academyTrack("academy_search_used", { programId: app.program.id, contentType: results.length ? "results" : "no_result" });
  if (!results.length) { container.innerHTML = `<div class="academy-empty"><div class="academy-state-copy"><strong>No encuentro una respuesta respaldada</strong><p>Prueba otra formulación, consulta las lecciones relacionadas o utiliza la guía de ayuda.</p><a class="academy-button academy-button--secondary" href="/academia/ayuda/">Ver opciones de ayuda</a></div></div>`; academyTrack("academy_search_no_result", { programId: app.program.id }); return; }
  const groups = Map.groupBy ? Map.groupBy(results, (result) => result.item.type) : results.reduce((map, result) => map.set(result.item.type, [...(map.get(result.item.type) || []), result]), new Map());
  container.innerHTML = `${renderSemanticAnswer(response.answer)}${[...groups].map(([type, ranked]) => `<section class="academy-search-group"><strong>${escapeHtml(type)}</strong>${ranked.map(renderRankedResult).join("")}</section>`).join("")}`;
}

function renderAnswers() {
  const answers = app.program.answers || [];
  const glossary = app.program.glossary || [];
  return `${renderPageHead("Centro de respuestas", "Resuelve una duda", "Busca en el contenido real del programa. Esta zona no genera respuestas ni asesoramiento inventado.", `<button class="academy-button academy-button--primary" type="button" data-action="search-open">Abrir búsqueda global</button>`)}
    <div class="academy-answer-layout"><section><div class="academy-answer-search"><span aria-hidden="true">⌕</span><label class="academy-sr-only" for="answer-filter">Buscar una respuesta</label><input class="academy-input" id="answer-filter" type="search" placeholder="Escribe una duda: CoC, V.7, placas, ROI…" data-answer-filter></div><div class="academy-answer-list" data-answer-list>${renderAnswerItems(answers, glossary)}</div></section><aside class="academy-card academy-card-pad academy-sticky-card"><h2 style="font-size:1.1rem">¿No encuentras tu caso?</h2><p style="margin-top:.45rem;color:var(--academy-muted);font-size:.8rem">No queremos inventar una respuesta para una operación real.</p><a class="academy-button academy-button--secondary academy-button--wide" style="margin-top:.8rem" href="/academia/ayuda/">Ver opciones de ayuda</a></aside></div>${renderTraceabilityLibrary()}`;
}

function renderAnswerSearch(query) {
  if (!query.trim()) return renderAnswerItems(app.program.answers, app.program.glossary);
  const response = answerSemanticQuery(query, app.searchItems, { limit: 12 });
  if (!response.results.length) return `<div class="academy-empty"><div class="academy-state-copy"><strong>No encuentro una respuesta respaldada</strong><p>Prueba otra formulación o abre la búsqueda global.</p></div></div>`;
  return `${renderSemanticAnswer(response.answer)}<div class="academy-answer-ranked">${response.results.map(renderRankedResult).join("")}</div>`;
}

function renderAnswerItems(answers, glossary, query = "") {
  const needle = normalizeText(query);
  const answerMarkup = answers.filter((item) => !needle || normalizeText([item.question, item.title, item.answer, item.summary, ...(item.keywords || [])].join(" ")).includes(needle)).map((item) => {
    const id = slugify(item.id || item.question || item.title);
    const body = item.answer || item.summary || item.body || "";
    return `<details class="academy-answer-item" id="${escapeAttribute(id)}" data-answer-id="${escapeAttribute(item.id || id)}" data-answer-type="faq"><summary>${escapeHtml(item.question || item.title)}</summary><div class="academy-answer-body">${Array.isArray(body) ? body.map((text) => `<p>${escapeHtml(text)}</p>`).join("") : `<p>${escapeHtml(body)}</p>`}${item.lessonId ? `<div class="academy-answer-links"><a class="academy-button academy-button--ghost academy-button--small" href="${lessonHref(findLesson(item.lessonId) || { slug: item.lessonId })}" data-nav>Ver lección relacionada</a></div>` : ""}</div></details>`;
  });
  const glossaryMarkup = glossary.filter((item) => !needle || normalizeText([item.term, item.definition, ...(item.aliases || [])].join(" ")).includes(needle)).map((item) => `<details class="academy-answer-item" id="glosario-${escapeAttribute(slugify(item.id || item.term))}" data-answer-id="${escapeAttribute(item.id || slugify(item.term))}" data-answer-type="glossary"><summary>${escapeHtml(item.term || item.title)}</summary><div class="academy-answer-body"><p>${escapeHtml(item.definition || item.description || "")}</p></div></details>`);
  return [...answerMarkup, ...glossaryMarkup].join("") || `<div class="academy-empty"><div class="academy-state-copy"><strong>No hay resultados</strong><p>Prueba con otra palabra o abre la búsqueda global.</p></div></div>`;
}

function renderResources() {
  const resources = app.program.resources || [];
  return `${renderPageHead("Biblioteca abierta", "Recursos gratuitos", "Descarga las guías o abre las herramientas directamente. No necesitas registro ni un enlace firmado.")}
    ${resources.length ? `<div class="academy-resource-grid">${resources.map(renderResourceCard).join("")}</div>` : `<div class="academy-empty"><div class="academy-state-copy"><strong>La biblioteca se está preparando</strong><p>Vuelve a comprobar esta sección más adelante.</p></div></div>`}${renderTraceabilityLibrary()}`;
}

function resourceInternalHref(resource) {
  const routes = {
    "workbook-budget": toolHref("presupuesto"), "workbook-searches": toolHref("filtros"),
    "workbook-candidate": "/academia/candidatos", "workbook-questions": toolHref("preguntas"),
    "workbook-market": toolHref("mercado"), "workbook-total-cost": toolHref("coste-total"),
    "workbook-real-costs": toolHref("coste-total"), "workbook-documents": toolHref("documentos"),
    "workbook-plan-abc": toolHref("plan-abc"), "workbook-travel": toolHref("viaje"),
    "workbook-inspection": toolHref("inspeccion"), "paint-measurement-sheet": toolHref("pintura"),
    "workbook-return": toolHref("vuelta"), "workbook-spain": toolHref("espana"),
    "master-checklists": toolHref("documentos"), glossary: "/academia/respuestas",
    "official-sources": "/academia/respuestas", "cases-needing-review": "/academia/respuestas",
  };
  return routes[resource.id] || "";
}

function renderResourceCard(resource) {
  const internalHref = resourceInternalHref(resource);
  const publicUrl = String(resource.publicUrl || "");
  const usable = Boolean(publicUrl || internalHref);
  let action = `<strong>Disponible próximamente</strong>`;
  if (publicUrl) action = `<a class="academy-button academy-button--secondary academy-button--small" style="margin-top:auto" href="${escapeAttribute(publicUrl)}"${publicUrl.endsWith(".pdf") ? ' target="_blank" rel="noopener"' : ""}>${publicUrl.endsWith(".pdf") ? "Abrir o descargar" : "Leer guía"}</a>`;
  else if (internalHref) action = `<a class="academy-button academy-button--secondary academy-button--small" style="margin-top:auto" href="${escapeAttribute(internalHref)}" data-nav>Abrir en la Academia</a>`;
  return `<article class="academy-card academy-resource-card" data-unavailable="${!usable}"><span class="academy-resource-icon" aria-hidden="true">${escapeHtml((resource.type || "R").slice(0, 3).toUpperCase())}</span><h2>${escapeHtml(resource.title)}</h2><p>${escapeHtml(resource.description || "Recurso del programa.")}</p><div class="academy-card-meta">${resource.version ? `<span>Versión ${escapeHtml(resource.version)}</span>` : ""}${resource.size ? `<span>· ${escapeHtml(resource.size)}</span>` : ""}</div>${action}</article>`;
}

function renderTraceabilityLibrary() {
  const sources = (app.program.officialSources || []).map((source) => ({ ...source, safeUrl: safeSourceUrl(source.url) })).filter((source) => source.safeUrl);
  const facts = app.program.contentFacts || [];
  if (!sources.length && !facts.length) return "";
  const sourceCards = sources.map((source) => `<a class="academy-trace-source" href="${escapeAttribute(source.safeUrl)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(source.label || source.title || source.authority || source.id)}</strong><span>${escapeHtml([source.authority, source.jurisdiction].filter(Boolean).join(" · "))}</span>${source.lastReviewed ? `<small>Revisado ${escapeHtml(formatDate(source.lastReviewed) || source.lastReviewed)}</small>` : ""}</a>`).join("");
  const factCards = facts.map((fact) => {
    const source = sources.find((item) => String(item.id) === String(fact.sourceId || fact.source));
    return `<article class="academy-trace-fact"><span class="academy-badge">${escapeHtml(fact.status || "dato revisable")}</span><h3>${escapeHtml(fact.label || fact.title || fact.id)}</h3><strong>${escapeHtml(formatFactValue(fact))}</strong>${fact.notes ? `<p>${escapeHtml(fact.notes)}</p>` : ""}<div class="academy-card-meta">${fact.lastReviewed ? `<span>Revisado ${escapeHtml(formatDate(fact.lastReviewed) || fact.lastReviewed)}</span>` : ""}${source ? `<a href="${escapeAttribute(source.safeUrl)}" target="_blank" rel="noopener noreferrer">Ver fuente</a>` : ""}</div></article>`;
  }).join("");
  return `<section class="academy-traceability" id="fuentes-oficiales"><div class="academy-section-head"><div><span class="academy-eyebrow">Trazabilidad</span><h2>Fuentes oficiales y datos revisables</h2><p>Consulta la fuente vigente antes de ejecutar un trámite o utilizar un importe.</p></div></div>${sources.length ? `<details class="academy-trace-group"><summary>Fuentes con enlace verificado (${sources.length})</summary><div class="academy-trace-source-grid">${sourceCards}</div></details>` : ""}${facts.length ? `<details class="academy-trace-group"><summary>Datos que debes volver a comprobar (${facts.length})</summary><div class="academy-trace-fact-grid">${factCards}</div></details>` : ""}</section>`;
}

function formatFactValue(fact) {
  const value = fact.value;
  if (Array.isArray(value)) return `${value.join(" · ")}${fact.unit ? ` ${fact.unit}` : ""}`;
  if (value && typeof value === "object") return `${Object.keys(value).length} valores de referencia${fact.unit ? ` · ${fact.unit}` : ""}`;
  return `${value ?? "Dato contextual"}${fact.unit ? ` ${fact.unit}` : ""}`;
}

function feedbackUrl(kind) {
  const labels = {
    error: "He encontrado un error en IvanImports Academy. Está en esta pantalla:",
    clarity: "Hay una explicación de IvanImports Academy que no entiendo. Está en esta pantalla:",
    suggestion: "Tengo una sugerencia para IvanImports Academy. Se refiere a esta pantalla:",
  };
  return `https://wa.me/34674252436?text=${encodeURIComponent(`${labels[kind] || labels.suggestion} ${location.href}`)}`;
}

function renderFeedbackStrip() {
  return `<section class="academy-feedback" aria-labelledby="academy-feedback-title"><div><span class="academy-eyebrow">Ayúdanos a mejorar</span><h2 id="academy-feedback-title">¿Has encontrado un error?</h2><p>Esta Academia está viva. Cuéntanos qué falla, qué no se entiende o qué añadirías.</p></div><div class="academy-feedback-actions"><a href="${escapeAttribute(feedbackUrl("error"))}" target="_blank" rel="noopener noreferrer">He encontrado un error</a><a href="${escapeAttribute(feedbackUrl("clarity"))}" target="_blank" rel="noopener noreferrer">Algo no se entiende</a><a href="${escapeAttribute(feedbackUrl("suggestion"))}" target="_blank" rel="noopener noreferrer">Tengo una sugerencia</a></div></section>`;
}

function renderUpdates() {
  const notes = ACADEMY_PATCH_NOTES.map((release) => `<article class="academy-patch-card"><header><span class="academy-patch-version">v${escapeHtml(release.version)}</span><div><h2>${escapeHtml(release.title)}</h2><time>${escapeHtml(release.date)}</time></div></header>${release.sections.map((section) => `<section><h3>${escapeHtml(section.label)}</h3><ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`).join("")}</article>`).join("");
  return `${renderPageHead("Patch notes", `Academia v${ACADEMY_VERSION}`, "Cambios visibles, mejoras de contenido y correcciones de la plataforma.")}<div class="academy-patch-list">${notes}</div>`;
}

function renderSupport() {
  return `<section class="academy-card academy-support-hero"><div><span class="academy-eyebrow" style="color:#9cecf5">Academia abierta</span><h1>Que una duda no bloquee tu aprendizaje</h1><p>Busca primero una respuesta respaldada por las lecciones y fuentes. Si detectas un problema editorial, envíanos el contexto exacto.</p><div class="academy-dashboard-actions"><a class="academy-button" style="background:#fff;color:var(--academy-primary-deep)" href="/academia/respuestas" data-nav>Resolver una duda</a><a class="academy-button" style="border-color:rgba(255,255,255,.28);color:#fff" href="${escapeAttribute(feedbackUrl("error"))}" target="_blank" rel="noopener noreferrer">Informar de un error</a></div></div><div class="academy-support-status"><span>Acceso</span><strong>Público y gratuito</strong><small>Sin cuenta ni registro</small></div></section>
    <div class="academy-grid academy-grid--3" style="margin-top:1rem"><article class="academy-card academy-support-card"><h2 style="font-size:1.1rem">1. Busca una respuesta</h2><p style="margin-top:.45rem;color:var(--academy-muted)">Consulta lecciones, conceptos, glosario, herramientas y fuentes.</p><button class="academy-button academy-button--ghost academy-button--small" style="margin-top:.8rem" type="button" data-action="search-open">Buscar</button></article><article class="academy-card academy-support-card"><h2 style="font-size:1.1rem">2. Reúne el contexto</h2><p style="margin-top:.45rem;color:var(--academy-muted)">Indica la pantalla, el texto y qué resultado esperabas. No envíes documentos sensibles.</p></article><article class="academy-card academy-support-card"><h2 style="font-size:1.1rem">3. ¿Necesitas ayuda profesional?</h2><p style="margin-top:.45rem;color:var(--academy-muted)">La formación es gratuita; el acompañamiento personal es una opción separada.</p><a class="academy-button academy-button--secondary academy-button--small" style="margin-top:.8rem" href="/servicios/primera-importacion-contigo/">Ver Servicios PRO</a></article></div>`;
}

function renderAccount() {
  return `${renderPageHead("Preferencias", "Este dispositivo", "No existe una cuenta obligatoria. El progreso permanece únicamente en este navegador.")}
    <div class="academy-grid academy-grid--2"><section class="academy-card academy-account-card"><h2 style="font-size:1.2rem">Acceso abierto</h2><div class="academy-account-row"><div><strong>IvanImports Academy</strong><span>Sin email, contraseña, pago ni cookie de acceso.</span></div><span class="academy-badge academy-badge--success">Gratis</span></div><div class="academy-account-row"><div><strong>Privacidad local</strong><span>Tu operación y tu progreso no se envían a nuestros servidores.</span></div></div></section>
      <section class="academy-card academy-account-card"><h2 style="font-size:1.2rem">Experiencia</h2><div class="academy-account-row"><div><strong>Reducir movimiento</strong><span>Limita animaciones dentro de la Academia.</span></div><label class="academy-check" style="min-height:auto;padding:.45rem"><input type="checkbox" data-preference="reducedMotion"${app.state.preferences.reducedMotion ? " checked" : ""}><span>Activar</span></label></div><div class="academy-account-row"><div><strong>Guardado</strong><span>Progreso y herramientas guardados localmente.</span></div><span class="academy-badge">Automático</span></div></section></div>`;
}

function renderOnboardingDialog() {
  return `<dialog class="academy-dialog academy-onboarding" data-onboarding-dialog aria-labelledby="onboarding-title"><div class="academy-onboarding-layout"><aside class="academy-onboarding-aside"><span class="academy-eyebrow" style="color:#8deaf4">Tu ruta</span><h2>Un minuto para recomendarte por dónde empezar.</h2><p>No ocultaremos ninguna etapa. Solo ajustaremos tu siguiente paso.</p><ol class="academy-onboarding-steps">${["Punto actual", "Objetivo", "Transporte", "Operación"].map((label, index) => `<li data-current="${app.onboardingStep === index}" data-complete="${app.onboardingStep > index}"><span>${app.onboardingStep > index ? "✓" : index + 1}</span>${label}</li>`).join("")}</ol></aside><form class="academy-onboarding-main" data-onboarding-form>${renderOnboardingStep()}</form></div></dialog>`;
}

function renderOnboardingStep() {
  const step = app.onboardingStep;
  const selected = { ...app.state.onboarding, ...app.onboardingDraft };
  const choice = (name, value, label, description = "") => `<label class="academy-choice"><input type="radio" name="${name}" value="${value}"${selected[name] === value ? " checked" : ""} required><span>${label}${description ? `<small>${description}</small>` : ""}</span></label>`;
  let content = "";
  if (step === 0) content = `<span class="academy-eyebrow">Paso 1 de 4</span><h3 id="onboarding-title">¿En qué punto estás?</h3><p>Elegiremos una recomendación inicial, no un bloqueo.</p><div class="academy-choice-grid">${choice("startingPoint", "zero", "Empiezo completamente desde cero")}${choice("startingPoint", "searching", "Ya estoy buscando vehículos")}${choice("startingPoint", "candidate", "Ya tengo un coche mirado")}${choice("startingPoint", "purchased", "Ya he comprado el vehículo")}${choice("startingPoint", "spain", "El vehículo ya está en España")}</div>`;
  if (step === 1) content = `<span class="academy-eyebrow">Paso 2 de 4</span><h3 id="onboarding-title">¿Cuál es tu objetivo?</h3><p>Así podremos dar más contexto a tu operación.</p><div class="academy-choice-grid">${choice("purpose", "personal", "Comprar para mí")}${choice("purpose", "resale", "Estudiar una posible reventa")}${choice("purpose", "learning", "Aprender para futuras operaciones")}${choice("purpose", "helping", "Ayudar a comprar a otra persona")}</div>`;
  if (step === 2) content = `<span class="academy-eyebrow">Paso 3 de 4</span><h3 id="onboarding-title">¿Cómo imaginas traerlo?</h3><p>Podrás cambiarlo más adelante.</p><div class="academy-choice-grid">${choice("transportMode", "driving", "Volver conduciendo")}${choice("transportMode", "carrier", "Utilizar transportista")}${choice("transportMode", "unknown", "Todavía no lo sé")}</div>`;
  if (step === 3) content = `<span class="academy-eyebrow">Paso 4 de 4</span><h3 id="onboarding-title">Crea tu primera operación</h3><p>Solo lo esencial. También puedes explorar sin tener un coche mirado.</p><div class="academy-form-grid" style="margin-top:1.4rem"><div class="academy-field academy-field--wide"><label for="onboarding-title-input">Nombre opcional</label><input id="onboarding-title-input" name="operationTitle" maxlength="120" value="${escapeAttribute(selected.operationTitle || "")}" placeholder="Mi primera importación"></div><div class="academy-field"><label for="onboarding-country">País principal</label><input id="onboarding-country" name="country" maxlength="80" value="${escapeAttribute(selected.country || "")}" placeholder="Alemania"></div><div class="academy-field"><label for="onboarding-budget">Presupuesto aproximado (€)</label><input id="onboarding-budget" name="totalBudget" type="number" min="0" step="any" value="${escapeAttribute(selected.totalBudget ?? "")}"></div><div class="academy-field academy-field--wide"><label for="onboarding-car">Coche buscado, si ya lo sabes</label><input id="onboarding-car" name="carWanted" maxlength="180" value="${escapeAttribute(selected.carWanted || "")}"></div></div>`;
  return `${content}<div class="academy-onboarding-actions">${step ? `<button class="academy-button academy-button--secondary" type="button" data-action="onboarding-back">Atrás</button>` : `<span></span>`}<div class="academy-page-actions">${step === 3 ? `<button class="academy-button academy-button--ghost" type="button" data-action="onboarding-explore">Explorar primero</button><button class="academy-button academy-button--primary" type="submit">Entrar en mi ruta</button>` : `<button class="academy-button academy-button--primary" type="submit">Continuar →</button>`}</div></div>`;
}

function openOnboarding() {
  const dialog = document.querySelector("[data-onboarding-dialog]");
  if (dialog && !dialog.open) {
    dialog.showModal();
    if (!app.onboardingStartedTracked) academyTrack("academy_onboarding_started", { programId: app.program.id });
    app.onboardingStartedTracked = true;
  }
}

function updateOnboardingDialog() {
  const dialog = document.querySelector("[data-onboarding-dialog]");
  if (!dialog) return;
  dialog.outerHTML = renderOnboardingDialog();
  openOnboarding();
}

function completeOnboarding({ createOperation }) {
  app.state.onboardingCompleted = true;
  app.state.onboarding = { ...app.state.onboarding, ...app.onboardingDraft, completedAt: new Date().toISOString() };
  if (createOperation && !app.state.operation) {
    const draft = app.onboardingDraft;
    const startingStatus = draft.startingPoint === "zero" ? "learning" : draft.startingPoint || "learning";
    app.state.operation = { id: uid("operation"), title: draft.operationTitle || "Mi primera importación", purpose: draft.purpose || "personal", status: startingStatus, country: draft.country || "", totalBudget: normalizeNonNegativeNumber(draft.totalBudget), carWanted: draft.carWanted || "", transportMode: draft.transportMode || "unknown", createdAt: new Date().toISOString() };
    const onboardingBudget = normalizeNonNegativeNumber(draft.totalBudget);
    app.state.tools.budget = { ...(app.state.tools.budget || {}), total: onboardingBudget === "" ? (app.state.tools.budget?.total ?? "") : onboardingBudget };
    academyTrack("academy_operation_created", { programId: app.program.id });
  }
  const startingPoint = app.onboardingDraft.startingPoint || "zero";
  const stages = coreStages();
  const recommended = { searching: 1, candidate: 2, purchased: Math.max(0, stages.length - 3), spain: Math.max(0, stages.length - 2) }[startingPoint] || 0;
  const prologue = app.program.stages.find((item, index) => item.kind === "prologue" || item.countsTowardProgress === false || (finite(item.order, index) === 0 && app.program.stages.length === 13));
  const stage = startingPoint === "zero" ? prologue || app.program.stages[0] : stages[recommended] || stages[0] || app.program.stages[0];
  if (stage) app.state.progress.currentStageId = String(stage.id);
  const lesson = stage?.lessons?.[0];
  if (lesson) app.state.progress.currentLessonId = String(lesson.id);
  scheduleSave({ immediate: true });
  document.querySelector("[data-onboarding-dialog]")?.close();
  academyTrack("academy_onboarding_completed", { programId: app.program.id });
  toast("Tu ruta está preparada.", "success");
  renderView();
}

function updateDynamicResults() {
  const budget = document.querySelector("[data-budget-result]");
  if (budget) budget.textContent = currency(budgetResult());
  const filterSummary = document.querySelector("[data-filter-summary]");
  if (filterSummary) filterSummary.textContent = searchFilterSummary();
  const filterCoverage = searchFilterCoverage();
  const filterGauge = document.querySelector("[data-filter-gauge]");
  if (filterGauge) filterGauge.style.setProperty("--gauge", filterCoverage);
  const filterCoverageText = document.querySelector("[data-filter-coverage]");
  if (filterCoverageText) filterCoverageText.textContent = `${filterCoverage}%`;
  const adScore = document.querySelector("[data-ad-score]");
  if (adScore) adScore.textContent = `${adAnalyzerScore()} de 8`;
  const adGauge = document.querySelector("[data-ad-gauge]");
  if (adGauge) adGauge.style.setProperty("--gauge", Math.round((adAnalyzerScore() / 8) * 100));
  const travelWarningsContainer = document.querySelector('[data-tool-id="viaje"] .academy-result-card .academy-grid');
  if (travelWarningsContainer) {
    const warnings = travelWarnings();
    travelWarningsContainer.innerHTML = warnings.length
      ? warnings.map((warning) => `<div class="academy-status-message" data-tone="${warning.tone}">${escapeHtml(warning.text)}</div>`).join("")
      : `<div class="academy-status-message" data-tone="success">No hay alertas básicas pendientes.</div>`;
  }
  const executionChecklist = document.querySelector(".academy-execution-checklist");
  if (executionChecklist) {
    const checkboxes = [...executionChecklist.querySelectorAll('input[type="checkbox"][data-tool-field]')];
    const done = checkboxes.filter((checkbox) => checkbox.checked).length;
    const percentage = checkboxes.length ? Math.round((done / checkboxes.length) * 100) : 0;
    const count = executionChecklist.querySelector(".academy-section-head .academy-eyebrow");
    const ring = executionChecklist.querySelector(".academy-stage-progress-ring");
    if (count) count.textContent = `${done} de ${checkboxes.length} confirmados`;
    if (ring) ring.style.setProperty("--progress", `${percentage}%`);
    if (ring?.querySelector("strong")) ring.querySelector("strong").textContent = `${percentage}%`;
  }
  const stats = marketStats();
  const range = document.querySelector("[data-market-range]");
  const median = document.querySelector("[data-market-median]");
  if (range) range.textContent = stats ? `${currency(stats.min)} – ${currency(stats.max)}` : "—";
  if (median) median.textContent = stats ? currency(stats.median) : "—";
  const totals = costTotals();
  document.querySelectorAll("[data-cost-total]").forEach((element) => { element.textContent = currency(totals[element.dataset.costTotal]); });
  document.querySelectorAll(".academy-cost-block").forEach((element, index) => {
    const keys = COST_GROUPS[index]?.[1] || [];
    const values = element.querySelectorAll("strong");
    if (values[0]) values[0].textContent = currency(keys.reduce((sum, key) => sum + finite(app.state.tools.costs?.rows?.[key]?.estimated), 0));
    if (values[1]) values[1].textContent = currency(keys.reduce((sum, key) => sum + finite(app.state.tools.costs?.rows?.[key]?.actual), 0));
  });
  const deviation = document.querySelector(".academy-cost-lab > .academy-grid--4 > .academy-stat-card:nth-child(4) strong");
  if (deviation) deviation.textContent = currency(totals.actual - totals.estimated);
  const margin = document.querySelector("[data-cost-margin]"); if (margin) margin.textContent = currency(totals.margin);
  const roi = document.querySelector("[data-cost-roi]"); if (roi) roi.textContent = `${totals.roi.toFixed(1)}%`;
  COST_ROWS.forEach(([key]) => { const element = document.querySelector(`[data-cost-diff="${key}"]`); const row = app.state.tools.costs?.rows?.[key] || {}; if (element) element.textContent = currency(finite(row.actual) - finite(row.estimated)); });
  const output = document.querySelector("[data-question-output]"); if (output) output.textContent = questionOutput();
}

function inputValue(target) {
  if (target.type === "checkbox") return target.checked;
  if (target.type === "number") return normalizeNumberFieldValue(target.value, { min: target.min, max: target.max });
  return target.value;
}

function updateNumberValidity(target) {
  if (target.type !== "number") return;
  const invalid = target.value !== "" && !target.validity.valid;
  if (invalid) target.setAttribute("aria-invalid", "true");
  else target.removeAttribute("aria-invalid");
}

function resetTool(slug) {
  const canonical = canonicalToolSlug(slug);
  const stateKey = TOOL_STATE_KEYS[canonical];
  if (stateKey) delete app.state.tools[stateKey];
  if (["plan-abc", "candidate-board"].includes(canonical)) app.state.candidates = [];
  if (canonical === "operation-dashboard") app.state.operation = null;
  if (app.state.tools?._completed) delete app.state.tools._completed[canonical];
  scheduleSave({ immediate: true });
  renderView();
  toast("Herramienta vaciada. Puedes empezar una comprobación nueva.", "success");
}

function openCandidate(candidate = null) {
  const dialog = document.querySelector("[data-candidate-dialog]");
  const form = dialog?.querySelector("[data-candidate-form]");
  if (!dialog || !form) return;
  form.reset();
  app.candidateEditing = candidate?.id || null;
  dialog.querySelector("[data-candidate-dialog-title]").textContent = candidate ? "Editar candidato" : "Nuevo candidato";
  [...form.elements].forEach((element) => { if (element.name && candidate?.[element.name] !== undefined) element.value = candidate[element.name]; });
  dialog.showModal();
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); toast("Copiado al portapapeles.", "success"); }
  catch { toast("No hemos podido copiar automáticamente. Selecciona el texto y cópialo manualmente.", "error"); }
}

function openSearch() {
  const dialog = document.querySelector("[data-search-dialog]");
  if (!dialog) return;
  app.lastFocused = document.activeElement;
  dialog.showModal();
  window.requestAnimationFrame(() => dialog.querySelector("[data-search-input]")?.focus());
}

function closeSearch() {
  const dialog = document.querySelector("[data-search-dialog]");
  dialog?.close();
  app.lastFocused?.focus?.();
}

function handleClick(event) {
  const visual = event.target.closest("[data-visual-interaction]");
  if (visual) academyTrack("academy_visual_interacted", { programId: app.program?.id, stageId: app.route?.name === "stage" ? findStage(app.route.slug)?.id : "", lessonId: app.route?.name === "lesson" ? findLesson(app.route.slug)?.id : "", visualId: visual.dataset.visualInteraction, contentType: "visual" });
  const openingDetails = event.target.closest("summary")?.parentElement;
  if (openingDetails && !openingDetails.open) {
    if (openingDetails.dataset.conceptId) academyTrack("academy_concept_opened", { programId: app.program?.id, lessonId: app.route?.name === "lesson" ? findLesson(app.route.slug)?.id : "", conceptId: openingDetails.dataset.conceptId });
    if (openingDetails.dataset.answerId) academyTrack("academy_answer_opened", { programId: app.program?.id, answerId: openingDetails.dataset.answerId, contentType: openingDetails.dataset.answerType || "answer" });
  }
  const nav = event.target.closest("a[data-nav]");
  if (nav && !event.ctrlKey && !event.metaKey && !event.shiftKey && nav.origin === location.origin) { event.preventDefault(); navigate(`${nav.pathname}${nav.search}${nav.hash}`); return; }
  const navButton = event.target.closest("[data-nav-to]");
  if (navButton) {
    event.preventDefault();
    if (navButton.matches("[data-map-stage]") && matchMedia("(max-width: 767px)").matches) {
      const map = navButton.closest(".academy-europe-map");
      const card = map?.querySelector("[data-map-current-card]");
      map?.querySelectorAll(".academy-europe-node[data-selected]").forEach((node) => node.removeAttribute("data-selected"));
      navButton.closest(".academy-europe-node")?.setAttribute("data-selected", "true");
      if (card) {
        card.querySelector("[data-map-card-kicker]").textContent = navButton.dataset.stageStatus || "Etapa seleccionada";
        card.querySelector("[data-map-card-number]").textContent = navButton.dataset.stageNumber || "";
        card.querySelector("[data-map-card-title]").textContent = navButton.dataset.stageTitle || "";
        card.querySelector("[data-map-card-description]").textContent = navButton.dataset.stageDescription || "";
        card.querySelector("[data-map-card-meta]").textContent = navButton.dataset.stageMeta || "";
        card.querySelector("[data-map-card-link]").setAttribute("href", navButton.dataset.navTo || "/ruta");
        card.scrollIntoView({ block: "nearest", behavior: app.state.preferences.reducedMotion ? "auto" : "smooth" });
      }
      return;
    }
    if (navButton.dataset.searchConceptId) academyTrack("academy_concept_opened", { programId: app.program?.id, conceptId: navButton.dataset.searchConceptId, contentType: "search" });
    if (navButton.dataset.searchAnswerId) academyTrack("academy_answer_opened", { programId: app.program?.id, answerId: navButton.dataset.searchAnswerId, contentType: "search" });
    closeSearch(); navigate(navButton.dataset.navTo); return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  const target = event.target.closest("[data-action]");
  if (action === "search-suggest") {
    const input = document.querySelector("[data-search-input]");
    if (input) { input.value = target.dataset.query || ""; renderSearchResultList(input.value); input.focus(); }
  }
  if (action === "search-open") openSearch();
  if (action === "search-close") closeSearch();
  if (action === "retry") boot();
  if (action === "candidate-new") {
    if (app.state.candidates.length >= 20) toast("Has alcanzado el máximo de 20 candidatos. Descarta o reutiliza una ficha existente.", "error");
    else openCandidate();
  }
  if (action === "candidate-edit") openCandidate(app.state.candidates.find((item) => item.id === target.dataset.id));
  if (action === "candidate-close") document.querySelector("[data-candidate-dialog]")?.close();
  if (action === "candidate-duplicate") {
    const source = app.state.candidates.find((item) => item.id === target.dataset.id);
    if (app.state.candidates.length >= 20) toast("Has alcanzado el máximo de 20 candidatos.", "error");
    else if (source) { app.state.candidates.push({ ...clone(source), id: uid("candidate"), title: `${source.title || source.model || "Candidato"} (copia)`, createdAt: new Date().toISOString() }); scheduleSave(); renderView(); toast("Candidato duplicado.", "success"); }
  }
  if (action === "candidate-discard") { const item = app.state.candidates.find((candidate) => candidate.id === target.dataset.id); if (item) { item.discarded = !item.discarded; item.discardedAt = item.discarded ? new Date().toISOString() : ""; scheduleSave(); renderView(); } }
  if (action === "lesson-toggle") {
    const id = String(target.dataset.lessonId); const completed = completedLessonSet();
    const lesson = findLesson(id); const stage = lesson ? findStage(lesson.stageId) : null;
    if (completed.has(id)) completed.delete(id); else completed.add(id);
    const isComplete = completed.has(id);
    const stageComplete = isComplete && stage?.lessons?.length && stage.lessons.every((item) => completed.has(String(item.id)));
    app.state.progress.completedLessonIds = [...completed]; app.state.progress.currentLessonId = id;
    scheduleSave({ immediate: true }); academyTrack(isComplete ? "academy_lesson_completed" : "academy_lesson_started", { programId: app.program.id, stageId: stage?.id, lessonId: id }); renderView(); toast(stageComplete && stage.completionMessage ? `${stage.completionMessage}. Etapa completada.` : isComplete ? "Paso completado. Tu ruta se ha actualizado." : "El paso vuelve a estar pendiente.", "success");
  }
  if (action === "mode-change") {
    const mode = target.dataset.mode === "operation" ? "operation" : "learning";
    app.state.preferences.dashboardMode = mode;
    scheduleSave();
    academyTrack("academy_mode_changed", { programId: app.program.id, mode });
    renderView();
  }
  if (action === "tool-complete") {
    const slug = canonicalToolSlug(target.dataset.toolId);
    app.state.tools._completed ||= {};
    app.state.tools._completed[slug] = !app.state.tools._completed[slug];
    if (app.state.tools._completed[slug]) academyTrack("academy_tool_completed", { programId: app.program.id, toolId: slug });
    scheduleSave({ immediate: true });
    renderView();
  }
  if (action === "tool-reset") {
    const slug = canonicalToolSlug(target.dataset.toolId);
    if (window.confirm("¿Vaciar todos los datos guardados en esta herramienta? Esta acción no se puede deshacer.")) resetTool(slug);
  }
  if (action === "market-add") { app.state.tools.market ||= { comparables: [] }; app.state.tools.market.comparables ||= []; if (app.state.tools.market.comparables.length >= 50) toast("Has alcanzado el máximo de 50 comparables.", "error"); else { app.state.tools.market.comparables.push({ id: uid("comparable") }); scheduleSave(); renderView(); const editor = document.querySelector("[data-market-editor]"); if (editor) editor.open = true; window.requestAnimationFrame(() => editor?.querySelector("input")?.focus()); } }
  if (action === "market-remove") { app.state.tools.market?.comparables?.splice(finite(target.dataset.index), 1); scheduleSave(); renderView(); }
  if (action === "question-add") { app.state.tools.questions ||= []; if (app.state.tools.questions.length >= 40) toast("Has alcanzado el máximo de 40 preguntas.", "error"); else { app.state.tools.questions.push({ id: uid("question"), category: "Estado general", text: "" }); scheduleSave(); renderView(); } }
  if (action === "question-remove") { app.state.tools.questions?.splice(finite(target.dataset.index), 1); scheduleSave(); renderView(); }
  if (action === "copy-questions") copyText(questionOutput());
  if (action === "resource-open") openResource(target.dataset.file, target.dataset.endpoint);
  if (action === "print") window.print();
  if (action === "onboarding-back") { app.onboardingStep = Math.max(0, app.onboardingStep - 1); updateOnboardingDialog(); }
  if (action === "onboarding-open") openOnboarding();
  if (action === "onboarding-explore") completeOnboarding({ createOperation: false });
  if (action === "logout") logout();
}

function handleInput(event) {
  const target = event.target;
  if (target.type === "number" && target.value !== "") {
    const normalized = inputValue(target);
    if (normalized !== "" && Number(target.value) !== normalized) target.value = String(normalized);
  }
  updateNumberValidity(target);
  trackToolStart(target);
  if (target.matches("[data-search-input]")) { renderSearchResultList(target.value); return; }
  if (target.matches("[data-answer-filter]")) { document.querySelector("[data-answer-list]").innerHTML = renderAnswerSearch(target.value); return; }
  if (target.matches("[data-operation-field]")) { const created = !app.state.operation; app.state.operation ||= { id: uid("operation"), createdAt: new Date().toISOString() }; app.state.operation[target.dataset.operationField] = inputValue(target); app.state.operation.updatedAt = new Date().toISOString(); if (created) academyTrack("academy_operation_created", { programId: app.program.id }); scheduleSave(); return; }
  if (target.matches("[data-tool-field]")) { setPath(app.state.tools, target.dataset.toolField, inputValue(target)); if (target.dataset.toolField.startsWith("method7.") && !app.method7StartedTracked) { academyTrack("academy_method7_started", { programId: app.program.id, toolId: "metodo-7-dias" }); app.method7StartedTracked = true; } scheduleSave(); updateDynamicResults(); return; }
  if (target.matches("[data-market-field]")) { const [index, key] = target.dataset.marketField.split("."); app.state.tools.market.comparables[finite(index)][key] = inputValue(target); scheduleSave(); updateDynamicResults(); return; }
  if (target.matches("[data-cost-field]")) { const [row, column] = target.dataset.costField.split("."); ensureCosts().rows[row] ||= {}; ensureCosts().rows[row][column] = inputValue(target); scheduleSave(); updateDynamicResults(); return; }
  if (target.matches("[data-question-field]")) { const [index, key] = target.dataset.questionField.split("."); app.state.tools.questions[finite(index)][key] = inputValue(target); scheduleSave(); updateDynamicResults(); }
}

function handleChange(event) {
  const target = event.target;
  if (target.type === "number") {
    const normalized = inputValue(target);
    if (target.value !== "" && normalized !== "") target.value = String(normalized);
    updateNumberValidity(target);
  }
  trackToolStart(target);
  if (target.matches("[data-market-field], [data-cost-field]")) window.requestAnimationFrame(renderView);
  if (target.matches("[data-lesson-check]")) { app.state.tools.lessonChecklists ||= {}; app.state.tools.lessonChecklists[target.dataset.lessonCheck] ||= {}; app.state.tools.lessonChecklists[target.dataset.lessonCheck][target.dataset.itemId] = target.checked; scheduleSave(); academyTrack("academy_checklist_updated", { lessonId: target.dataset.lessonCheck, contentType: "lesson" }); }
  if (target.matches("[data-document-field]")) { app.state.tools.documents ||= {}; app.state.tools.documents[target.dataset.documentField] = target.value; scheduleSave(); academyTrack("academy_checklist_updated", { toolId: "documentos" }); }
  if (target.matches("[data-inspection-field]")) { app.state.tools.inspection ||= {}; app.state.tools.inspection[target.dataset.inspectionField] = target.checked; scheduleSave(); }
  if (target.matches("[data-spain-field]")) { app.state.tools.spain ||= {}; app.state.tools.spain[target.dataset.spainField] = target.checked; scheduleSave(); }
  if (target.matches("[data-operation-confirm]")) {
    const created = !app.state.operation;
    app.state.operation ||= { id: uid("operation"), title: "Mi primera importación", status: "learning", createdAt: new Date().toISOString() };
    app.state.operation[target.dataset.operationConfirm] = target.checked;
    if (target.dataset.operationConfirm === "finalFolderCompleted") { app.state.tools.spain ||= {}; app.state.tools.spain.finalFolderComplete = target.checked; }
    if (created) academyTrack("academy_operation_created", { programId: app.program.id });
    scheduleSave({ immediate: true });
    renderView();
  }
  if (target.matches("[data-preference]")) { app.state.preferences[target.dataset.preference] = target.checked; document.documentElement.classList.toggle("academy-reduce-motion", target.dataset.preference === "reducedMotion" && target.checked); scheduleSave(); }
}

function trackToolStart(target) {
  const workbench = target.closest?.("[data-tool-id]");
  const toolId = workbench?.dataset.toolId;
  if (!toolId || app.toolStarted.has(toolId)) return;
  app.toolStarted.add(toolId);
  academyTrack("academy_tool_started", { programId: app.program?.id, toolId });
}

function bindSectionTracking() {
  app.sectionObserver?.disconnect?.();
  if (!("IntersectionObserver" in window) || app.route.name !== "lesson") return;
  const lesson = findLesson(app.route.slug);
  app.sectionObserver = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      const sectionId = entry.target.dataset.lessonSection || entry.target.id || "section";
      const key = `${lesson?.id}:${sectionId}`;
      if (app.observedSections.has(key)) return;
      app.observedSections.add(key);
      academyTrack("academy_lesson_section_viewed", { programId: app.program.id, stageId: lesson?.stageId, lessonId: lesson?.id, sectionId });
    });
  }, { threshold: .55 });
  document.querySelectorAll("[data-lesson-section]").forEach((section) => app.sectionObserver.observe(section));
}

function handleSubmit(event) {
  if (event.target.matches("[data-candidate-form]")) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.target));
    ["price", "mileage", "year"].forEach((key) => { values[key] = values[key] === "" ? "" : finite(values[key]); });
    if (app.candidateEditing) { const index = app.state.candidates.findIndex((item) => item.id === app.candidateEditing); if (index >= 0) app.state.candidates[index] = { ...app.state.candidates[index], ...values, id: app.candidateEditing, updatedAt: new Date().toISOString() }; }
    else if (app.state.candidates.length < 20) app.state.candidates.push({ ...values, id: uid("candidate"), createdAt: new Date().toISOString(), discarded: false });
    else { toast("Has alcanzado el máximo de 20 candidatos.", "error"); return; }
    scheduleSave({ immediate: true }); document.querySelector("[data-candidate-dialog]")?.close(); academyTrack("academy_candidate_created", { programId: app.program.id }); renderView(); toast("Candidato guardado.", "success");
  }
  if (event.target.matches("[data-onboarding-form]")) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.target)); Object.assign(app.onboardingDraft, values);
    if (app.onboardingStep < 3) { if (!event.target.checkValidity()) { event.target.reportValidity(); return; } app.onboardingStep += 1; updateOnboardingDialog(); }
    else completeOnboarding({ createOperation: true });
  }
}

async function openResource(file, endpoint) {
  const resource = (app.program.resources || []).find((item) => [item.id, item.file].includes(file));
  const url = resource?.publicUrl || (endpoint && safeInternalPath(endpoint, ""));
  if (!url) { toast("Este recurso no está disponible todavía.", "error"); return; }
  academyTrack("academy_resource_downloaded", { programId: app.program.id, contentType: file || "resource" });
  window.open(url, "_blank", "noopener,noreferrer");
}

async function logout() {
  academyTrack("academy_local_reset");
  localStorage.removeItem(STATE_STORAGE_KEY);
  location.replace(PROGRAM_ROOT);
}

function bindEvents() {
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("play", handleVideoEvent, true);
  document.addEventListener("ended", handleVideoEvent, true);
  window.addEventListener("popstate", () => { app.route = parseRoute(); renderView(); });
  window.addEventListener("online", () => { if (app.saveDirty) scheduleSave({ immediate: true }); toast("Conexión recuperada.", "success"); });
  window.addEventListener("offline", () => toast("Sin conexión. Mantén esta pantalla abierta para reintentar el guardado.", "error"));
  window.addEventListener("beforeunload", () => { if (app.saveDirty) saveState(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const searchDialog = document.querySelector("[data-search-dialog]");
      if (searchDialog?.open) { event.preventDefault(); closeSearch(); return; }
      const candidateDialog = document.querySelector("[data-candidate-dialog]");
      if (candidateDialog?.open) { event.preventDefault(); candidateDialog.close(); return; }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("es") === "k") { event.preventDefault(); openSearch(); }
  });
  document.addEventListener("click", (event) => { if (event.target.closest("[data-support-open]")) academyTrack("academy_support_opened", { programId: app.program?.id }); });
}

function loadingMarkup() {
  return `<div class="academy-app"><main class="academy-main"><div class="academy-loading-state" aria-busy="true" aria-label="Cargando Academia"><div class="academy-loading-layout"><div class="academy-skeleton"></div><div class="academy-skeleton"></div><div class="academy-skeleton"></div></div></div></main></div>`;
}

async function boot() {
  document.body.classList.add("academy-app-page");
  const shellSkipLink = document.querySelector("body > .skip-link");
  if (shellSkipLink) {
    shellSkipLink.classList.add("academy-skip-link");
    shellSkipLink.setAttribute("href", "#academy-main");
  }
  app.root ||= document.querySelector("[data-academy-app]") || document.querySelector("#academy-app");
  if (!app.root) { app.root = document.createElement("div"); app.root.id = "academy-app"; app.root.dataset.academyApp = ""; document.body.append(app.root); }
  app.root.innerHTML = loadingMarkup();
  try {
    const programPayload = await fetchJson(API.program);
    let statePayload = {};
    try { statePayload = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) || "{}"); } catch { statePayload = {}; }
    app.session = { authenticated: false, public: true, user: { public: true } };
    app.program = normalizeProgram(programPayload);
    let statePayloadForRender = statePayload;
    let migratedState = false;
    if (app.program.schemaVersion >= 2 && app.program.legacyLessonMap) {
      app.legacyMap = normalizeLegacyLessonMap(app.program.legacyLessonMap, { expectedMappingCount: 317 });
      const rawState = clone(unwrap(statePayload, "state"));
      if (finite(rawState.schemaVersion, 1) < 2) {
        const migrated = migrateAcademyStateV1ToV2(rawState, app.legacyMap, { expectedMappingCount: 317 });
        statePayloadForRender = { state: migrated, revision: finite(statePayload?.revision ?? rawState.revision, 0) };
        const migration = migrated.migration || {};
        app.migrationNeedsReview = Object.entries(migration).some(([key, value]) => key.startsWith("unmapped") && (Array.isArray(value) ? value.length > 0 : Boolean(value)));
        migratedState = !app.migrationNeedsReview;
        if (app.migrationNeedsReview && !app.migrationReviewTracked) {
          academyTrack("academy_state_migration_review_required", { programId: app.program.id, contentType: "unmapped" });
          app.migrationReviewTracked = true;
        }
      }
    }
    app.state = normalizeState(statePayloadForRender);
    app.state.preferences.presentationMode = false;
    document.documentElement.classList.toggle("academy-reduce-motion", Boolean(app.state.preferences.reducedMotion));
    document.documentElement.classList.toggle("academy-presentation-mode", Boolean(app.state.preferences.presentationMode));
    const initialPath = location.pathname || document.body.dataset.academyRoute || PROGRAM_ROOT;
    const parsedInitialRoute = parseRoute(initialPath);
    const exactV2Lesson = parsedInitialRoute.name === "lesson" && Boolean((app.program.lessons || []).find((lesson) => lesson.slug === parsedInitialRoute.slug || String(lesson.id) === String(parsedInitialRoute.slug)));
    const legacyTarget = !exactV2Lesson && app.legacyMap ? resolveLegacyDeepLink(initialPath, app.legacyMap) : null;
    if (legacyTarget) {
      history.replaceState({}, "", legacyTarget.href);
      app.route = { name: "lesson", slug: legacyTarget.lessonSlug };
      app.state.progress.currentLessonId = legacyTarget.lessonId;
      app.state.progress.currentStageId = legacyTarget.stageId;
      app.state.progress.currentAnchor = legacyTarget.anchor;
    } else app.route = parsedInitialRoute;
    app.onboardingDraft = { ...app.state.onboarding };
    buildSearchItems();
    renderView();
    if (migratedState) scheduleSave({ immediate: true });
    app.root.removeAttribute("aria-busy");
    academyTrack("academy_program_opened", { programId: app.program.id });
  } catch (error) {
    app.root.innerHTML = `<main class="academy-main">${renderErrorState("No hemos podido cargar la Academia.", navigator.onLine ? "Vuelve a intentarlo en unos segundos." : "Comprueba tu conexión y vuelve a intentarlo.")}</main><div class="academy-toast-region" data-toast-region></div>`;
  }
}

bindEvents();
boot();
