import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderEuropeRouteMap, renderMobileRoute } from "../assets/academy/private/europe-map.js";
import { toolIconName } from "../assets/academy/private/icons.js";
import { normalizeLegacyLessonMap, resolveLegacyDeepLink } from "../assets/academy/private/migration.js";

export const ACADEMY_V2_EXPECTED = Object.freeze({
  programId: "importa-tu-primer-coche",
  schemaVersion: 2,
  stages: 13,
  lessons: 72,
  concepts: 317,
  mappings: 317,
  tools: 17,
  videos: 40,
});

export const ACADEMY_COMPLETION_COPY = Object.freeze({
  learning: "HAS COMPLETADO LA RUTA.",
  realOperation: "FELICIDADES. TU VEHÍCULO YA TIENE MATRÍCULA ESPAÑOLA. HAS COMPLETADO TU PRIMERA IMPORTACIÓN.",
});

export const DEFAULT_QA_PATHS = Object.freeze({
  privateProgram: "private-products/academy/v2/dist/program-v2.json",
  publicProgram: "assets/academy/program-v2.json",
  frontend: "assets/academy/app.js",
  stylesheet: "assets/academy/app.css",
  landing: "academia/index.html",
  shell: "api/_academy/shell.js",
  contentLoader: "api/_academy/content.js",
  vercel: "vercel.json",
  dist: "dist",
});

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const BLOCKING_SEVERITIES = new Set(["P0", "P1"]);
const REQUIRED_PUBLIC_ROUTES = Object.freeze([
  "academia/index.html",
  "herramientas/index.html",
  "mi-operacion/index.html",
  "mi-operacion/candidatos/index.html",
  "recursos/index.html",
  "recursos/respuestas/index.html",
]);
const NEW_EXPERIENCE_ASSETS = Object.freeze([
  "assets/academy/app.js",
  "assets/academy/app.css",
  "assets/academy/private/europe-map.js",
  "assets/academy/private/icons.js",
  "assets/academy/private/lesson-visuals.js",
  "assets/academy/private/migration.js",
  "assets/academy/patch-notes.js",
]);

function readText(root, path) {
  return readFileSync(resolve(root, path), "utf8");
}

function readJson(root, path) {
  return JSON.parse(readText(root, path));
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(absolute) : [absolute];
  });
}

function unique(values) {
  return new Set(values).size === values.length;
}

function countMatches(source, expression) {
  return [...String(source).matchAll(expression)].length;
}

function functionBlock(source, name) {
  const plain = String(source).indexOf(`function ${name}(`);
  const asynchronous = String(source).indexOf(`async function ${name}(`);
  const start = [plain, asynchronous].filter((index) => index >= 0).sort((left, right) => left - right)[0] ?? -1;
  if (start < 0) return "";
  const end = String(source).indexOf("\nfunction ", start + name.length + 10);
  return String(source).slice(start, end < 0 ? undefined : end);
}

function normalizedBrandText(source) {
  return String(source || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function hasMatriculaPro(source) {
  return /\bmatricula\s*pro\b/i.test(normalizedBrandText(source));
}

function collectObjectKeys(value, result = new Set()) {
  if (Array.isArray(value)) value.forEach((entry) => collectObjectKeys(entry, result));
  else if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      result.add(key);
      collectObjectKeys(entry, result);
    }
  }
  return result;
}

function extractModuleImports(source) {
  return [...String(source).matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractLocalAssetReferences(source) {
  return [...String(source).matchAll(/\b(?:src|href)=["'](\/(?:assets\/[^"'?#]+|favicon\.svg))(?:[?#][^"']*)?["']/gi)]
    .map((match) => match[1]);
}

function privateFingerprints(program) {
  const concepts = Array.isArray(program?.concepts) ? program.concepts : [];
  const interval = Math.max(1, Math.floor(concepts.length / 12));
  const sampledProse = concepts.filter((_, index) => index % interval === 0 || index === concepts.length - 1)
    .flatMap((concept) => [concept.shortAnswer, concept.explanation]);
  return [...new Set([...concepts.map((concept) => concept.id), ...sampledProse]
    .filter((value) => typeof value === "string" && value.trim().length >= 24)
    .filter((value) => !Object.values(ACADEMY_COMPLETION_COPY).includes(value)))];
}

function checkResult(result, { id, category, ok, severity = "P1", message, evidence = "" }) {
  const record = { id, category, ok: Boolean(ok), severity, message, ...(evidence ? { evidence } : {}) };
  result.checks.push(record);
  if (!record.ok) result.findings.push(record);
  return record.ok;
}

function checkPrivateProgram(result, program, frontendSource) {
  const expected = ACADEMY_V2_EXPECTED;
  const stages = Array.isArray(program.stages) ? program.stages : [];
  const lessons = Array.isArray(program.lessons) ? program.lessons : [];
  const concepts = Array.isArray(program.concepts) ? program.concepts : [];
  const tools = Array.isArray(program.tools) ? program.tools : [];
  const videos = Array.isArray(program.videos) ? program.videos : [];
  const mappings = Array.isArray(program.legacyLessonMap?.mappings) ? program.legacyLessonMap.mappings : [];
  const facts = result.facts;
  Object.assign(facts, {
    programId: program.id,
    schemaVersion: program.schemaVersion,
    stages: stages.length,
    lessons: lessons.length,
    concepts: concepts.length,
    mappings: mappings.length,
    tools: tools.length,
    videos: videos.length,
    answers: Array.isArray(program.answers) ? program.answers.length : 0,
    resources: Array.isArray(program.resources) ? program.resources.length : 0,
  });

  checkResult(result, { id: "program.stable-id", category: "content", ok: program.id === expected.programId, severity: "P0", message: `El programa privado debe conservar id=${expected.programId}; el backend y entitlement dependen de ese ID.`, evidence: `id=${program.id || "(missing)"}` });
  checkResult(result, { id: "program.schema", category: "content", ok: program.schemaVersion === expected.schemaVersion, message: "El programa v2 debe declarar schemaVersion=2." });
  for (const field of ["stages", "lessons", "concepts", "tools", "videos"]) {
    checkResult(result, { id: `program.count.${field}`, category: "content", ok: facts[field] === expected[field], message: `El catálogo debe contener exactamente ${expected[field]} ${field}.`, evidence: `${field}=${facts[field]}` });
  }
  checkResult(result, { id: "program.count.mappings", category: "migration", ok: facts.mappings === expected.mappings, message: "El mapa legacy debe cubrir los 317 pasos v1.", evidence: `mappings=${facts.mappings}` });

  const stageIds = stages.map((stage) => String(stage.id || ""));
  const lessonIds = lessons.map((lesson) => String(lesson.id || ""));
  const conceptIds = concepts.map((concept) => String(concept.id || ""));
  const toolIds = tools.map((tool) => String(tool.id || tool.slug || ""));
  checkResult(result, { id: "program.unique-ids", category: "content", ok: [stageIds, lessonIds, conceptIds, toolIds].every(unique), message: "Etapas, lecciones, conceptos y herramientas deben tener IDs únicos." });
  checkResult(result, { id: "program.stage-id-contract", category: "content", ok: stageIds.every((id, index) => id === `stage-${String(index).padStart(2, "0")}`), message: "Las 13 etapas deben conservar el contrato stage-00…stage-12." });

  const stageSet = new Set(stageIds);
  const lessonSet = new Set(lessonIds);
  const conceptSet = new Set(conceptIds);
  const stageLessonRefs = stages.flatMap((stage) => Array.isArray(stage.lessonIds) ? stage.lessonIds.map(String) : []);
  checkResult(result, { id: "program.stage-lesson-graph", category: "content", ok: stageLessonRefs.length === expected.lessons && unique(stageLessonRefs) && stageLessonRefs.every((id) => lessonSet.has(id)) && lessons.every((lesson) => stageSet.has(String(lesson.stageId))), message: "Cada una de las 72 lecciones debe pertenecer exactamente a una etapa válida." });

  const lessonConceptRefs = lessons.flatMap((lesson) => Array.isArray(lesson.conceptIds) ? lesson.conceptIds.map(String) : []);
  const conceptAnchors = concepts.map((concept) => `${concept.lessonId}#${concept.anchor}`);
  checkResult(result, { id: "program.lesson-concept-graph", category: "content", ok: lessonConceptRefs.length === expected.concepts && unique(lessonConceptRefs) && lessonConceptRefs.every((id) => conceptSet.has(id)) && concepts.every((concept) => lessonSet.has(String(concept.lessonId))) && unique(conceptAnchors), message: "Los 317 conceptos deben estar asociados una sola vez a las 72 lecciones y tener anchors únicos por lección." });
  checkResult(result, { id: "program.authored-lessons", category: "content", ok: lessons.every((lesson) => ["authored", "reviewed"].includes(lesson.editorialStatus) && typeof lesson.simpleExplanation === "string" && lesson.simpleExplanation.trim().length > 80 && Array.isArray(lesson.checklist) && lesson.checklist.length > 0), message: "Todas las lecciones deben estar redactadas o revisadas y contener explicación y checklist." });

  let normalizedMap = null;
  try { normalizedMap = normalizeLegacyLessonMap(program.legacyLessonMap); } catch (error) {
    result.notes.push(`legacy map: ${error.message}`);
  }
  checkResult(result, { id: "program.legacy-map-contract", category: "migration", ok: Boolean(normalizedMap), message: "legacyLessonMap debe superar el contrato 317→72→13 y sus aliases." });
  if (normalizedMap) {
    const conceptById = new Map(concepts.map((concept) => [String(concept.id), concept]));
    checkResult(result, { id: "program.legacy-map-targets", category: "migration", ok: normalizedMap.mappings.every((mapping) => {
      const concept = conceptById.get(mapping.conceptId);
      return lessonSet.has(mapping.lessonId) && concept?.lessonId === mapping.lessonId && concept?.anchor === mapping.anchor;
    }), message: "Cada mapping legacy debe apuntar a una lección, concepto y anchor existentes." });
  }

  const structuralKeys = collectObjectKeys(program);
  const progressFunction = functionBlock(frontendSource, "progressLessons");
  const conceptSection = functionBlock(frontendSource, "renderLessonConcepts");
  checkResult(result, { id: "experience.no-317-tasks", category: "experience", ok: !structuralKeys.has("tasks") && /program\?\.lessons|program\.lessons/.test(progressFunction) && !/concepts/.test(progressFunction) && /<details\b/.test(conceptSection) && !/lesson-toggle|complete/i.test(conceptSection), message: "El progreso debe medir 72 lecciones; los 317 conceptos se consultan dentro de ellas y no se presentan como tareas." });

  const learning = program.completionSemantics?.learning;
  const real = program.completionSemantics?.realOperation;
  checkResult(result, { id: "experience.completion-semantics", category: "experience", ok: Boolean(learning?.condition) && real?.neverInferFromLearningProgress === true && lessons.every((lesson) => lesson.completion?.doesNotAssertRealOperation === true), message: "El contenido debe declarar que completar aprendizaje nunca acredita una operación real." });
  checkResult(result, { id: "experience.completion-code", category: "experience", ok: frontendSource.includes("academy_learning_route_completed") && frontendSource.includes("academy_real_operation_completed") && /registrationAssigned/.test(frontendSource) && /finalFolderCompleted/.test(frontendSource) && /closureCompleted/.test(frontendSource) && /\["registered", "matriculado"\]/.test(frontendSource), message: "La interfaz debe calcular y medir por separado aprendizaje y cierre real con confirmaciones explícitas." });
  checkResult(result, { id: "experience.completion-copy", category: "experience", ok: learning?.message === ACADEMY_COMPLETION_COPY.learning && real?.message === ACADEMY_COMPLETION_COPY.realOperation && frontendSource.includes("program.completionSemantics?.learning?.message") && frontendSource.includes("program.completionSemantics?.realOperation?.message") && frontendSource.includes("app.program.learningCompletionCopy") && frontendSource.includes("app.program.realOperationCompletionCopy"), message: "Los dos hitos deben conectar completionSemantics con sus copies finales obligatorios sin intercambiarlos." });

  const answers = Array.isArray(program.answers) ? program.answers : [];
  checkResult(result, { id: "experience.answers", category: "experience", ok: answers.length > 0 && answers.every((answer) => typeof (answer.question || answer.title) === "string" && typeof (answer.answer || answer.body || answer.summary) === "string") && /function renderAnswers\(/.test(frontendSource) && /academy-answer-item/.test(frontendSource), message: "El Centro de respuestas debe recibir respuestas trazables y renderizarlas como consultas, no como texto inventado." });

  const iconNames = tools.map((tool) => toolIconName(tool.slug || tool.id));
  const toolCatalogBlock = frontendSource.slice(frontendSource.indexOf("const TOOL_CATALOG"), frontendSource.indexOf("const TOOL_ALIASES"));
  const toolAliasBlock = frontendSource.slice(frontendSource.indexOf("const TOOL_ALIASES"), frontendSource.indexOf("const OPERATION_FIELDS"));
  const toolAliases = new Map([...toolAliasBlock.matchAll(/["']([a-z0-9-]+)["']\s*:\s*["']([a-z0-9-]+)["']/gi)].map((match) => [match[1], match[2]]));
  const catalogSlugs = new Set([...toolCatalogBlock.matchAll(/\bslug:\s*["']([a-z0-9-]+)["']/gi)].map((match) => match[1]));
  const toolRenderer = functionBlock(frontendSource, "renderTool");
  const routedTools = tools.every((tool) => {
    const sourceSlug = String(tool.slug || tool.id);
    const canonical = toolAliases.get(sourceSlug) || sourceSlug;
    return catalogSlugs.has(canonical) && (["operation-dashboard", "candidate-board"].includes(canonical) || toolRenderer.includes(canonical));
  });
  checkResult(result, { id: "experience.tools-and-icons", category: "experience", ok: tools.length === expected.tools && countMatches(toolCatalogBlock, /\{\s*slug:/g) === expected.tools && iconNames.every((name) => name !== "tools") && routedTools && /function renderTools\(/.test(frontendSource), message: "Las 17 herramientas deben aparecer en el centro operativo con icono y renderer específicos." });

  const collidesWithLegacy = (lesson) => {
    const target = resolveLegacyDeepLink(`/paso/${lesson.slug}`, program.legacyLessonMap);
    return target && target.lessonId !== lesson.id;
  };
  const collisionLesson = lessons.find((lesson) => lesson.id === "lesson-06-04" && collidesWithLegacy(lesson))
    || lessons.find(collidesWithLegacy);
  const legacySixFour = resolveLegacyDeepLink("/paso/6-04-enlace-antiguo", program.legacyLessonMap);
  const bootBlock = functionBlock(frontendSource, "boot");
  const initialPathIndex = bootBlock.indexOf("const initialPath");
  const legacyResolutionIndex = bootBlock.indexOf("resolveLegacyDeepLink", initialPathIndex);
  const beforeLegacyResolution = initialPathIndex >= 0 && legacyResolutionIndex > initialPathIndex
    ? bootBlock.slice(initialPathIndex, legacyResolutionIndex)
    : "";
  const exactV2LookupFirst = /findLesson\s*\(/.test(beforeLegacyResolution)
    || /program(?:\?\.)?\.lessons[\s\S]*?\.find\s*\(/.test(beforeLegacyResolution);
  result.facts.deepLinkCollision = collisionLesson ? {
    v2LessonId: collisionLesson.id,
    v2Slug: collisionLesson.slug,
    legacyTargetLessonId: resolveLegacyDeepLink(`/paso/${collisionLesson.slug}`, program.legacyLessonMap)?.lessonId,
  } : null;
  checkResult(result, { id: "routes.v2-before-legacy", category: "routes", ok: Boolean(collisionLesson) && exactV2LookupFirst && legacySixFour?.legacyLessonId === "lesson-6-04", severity: "P0", message: "Un slug v2 exacto debe resolverse antes que el alias numérico legacy, conservando /paso/6-04-* como deep link antiguo.", evidence: collisionLesson ? `${collisionLesson.slug} colisiona con ${result.facts.deepLinkCollision.legacyTargetLessonId}` : "no collision fixture" });
}

function checkVisualExperience(result, program, frontendSource, stylesheetSource) {
  const stages = Array.isArray(program?.stages) ? program.stages : Array.from({ length: 13 }, (_, index) => ({ id: `stage-${index}`, title: `Stage ${index}`, kind: index === 0 ? "prologue" : "stage" }));
  const models = stages.map((stage, index) => ({
    id: stage.id,
    title: stage.title,
    shortTitle: stage.shortTitle,
    description: stage.description,
    status: index === 0 ? "complete" : index === 1 ? "current" : "pending",
    href: `/etapa/${stage.slug || stage.id}`,
    number: String(index).padStart(2, "0"),
    accessibleLabel: `Etapa ${index}`,
    lessonCount: Array.isArray(stage.lessonIds) ? stage.lessonIds.length : 0,
    estimatedMinutes: stage.estimatedMinutes,
  }));
  const desktop = renderEuropeRouteMap({ stages: models, percentage: 20, currentStageId: models[1]?.id });
  const mobile = renderMobileRoute({ stages: models });
  checkResult(result, { id: "visual.europe-map", category: "visual", ok: desktop.includes("academy-europe-map--desktop") && desktop.includes("academy-map-geography") && desktop.includes('data-country="España"') && desktop.includes('data-country="Francia"') && countMatches(desktop, /data-visual-interaction="route-node"/g) === 12 && countMatches(desktop, /aria-label=/g) >= 13, message: "El mapa debe renderizar geografía vectorial reconocible, 12 etapas y alternativa accesible." });
  checkResult(result, { id: "visual.mobile-route", category: "visual", ok: mobile.includes("academy-europe-map--mobile") && mobile.includes("academy-map-geography") && countMatches(mobile, /data-visual-interaction="route-node"/g) === 12 && stylesheetSource.includes(".academy-route-mobile-v2 { display: none; }") && /@media\s*\(max-width:\s*767px\)[\s\S]*?\.academy-route-desktop\s*\{\s*display:\s*none\s*!important/.test(stylesheetSource) && /@media\s*\(max-width:\s*767px\)[\s\S]*?\.academy-route-mobile-v2\s*\{\s*display:\s*block\s*!important/.test(stylesheetSource), message: "La ruta móvil debe usar una composición vectorial propia y sustituir al mapa de escritorio." });
  checkResult(result, { id: "visual.frontend-wiring", category: "visual", ok: frontendSource.includes("renderEuropeRouteMap") && frontendSource.includes("renderMobileRoute") && frontendSource.includes("renderLessonVisuals") && frontendSource.includes("renderStageScene"), message: "La interfaz pública debe conectar mapa, ruta móvil y visuales editoriales." });
}

function checkAccessibility(result, landingSource, shellSource, frontendSource, stylesheetSource) {
  const landingH1 = countMatches(landingSource, /<h1\b/gi);
  const landingSkip = landingSource.match(/<a[^>]+class=["'][^"']*skip-link[^"']*["'][^>]+href=["']#([^"']+)["']/i)?.[1];
  const shellRootIsMain = /<main\b[^>]*(?:id=["']academy-app["']|data-academy-app)/i.test(shellSource);
  const injectedMain = /<main\b[^>]*id=["']academy-main["']/i.test(frontendSource);
  const shellSkip = shellSource.match(/class=["']skip-link["'][^>]+href=["']#([^"']+)["']/i)?.[1];
  checkResult(result, { id: "a11y.landing-landmarks", category: "accessibility", ok: /<html\s+lang=["']es["']/i.test(landingSource) && landingH1 === 1 && Boolean(landingSkip) && new RegExp(`id=["']${landingSkip}["']`).test(landingSource) && !/user-scalable\s*=\s*no/i.test(landingSource), message: "La landing debe tener idioma, un H1, skip-link resoluble y viewport ampliable." });
  checkResult(result, { id: "a11y.no-nested-main", category: "accessibility", ok: !(shellRootIsMain && injectedMain), message: "El shell servidor no debe envolver el main dinámico dentro de otro <main>.", evidence: shellRootIsMain && injectedMain ? "academy-app(main) > academy-main(main)" : "" });
  checkResult(result, { id: "a11y.shell-skip-target", category: "accessibility", ok: Boolean(shellSkip) && (new RegExp(`id=["']${shellSkip}["']`).test(shellSource) || frontendSource.includes(`setAttribute("href", "#academy-main")`)), severity: "P2", message: "El skip-link privado debe tener un destino válido antes o inmediatamente después del bootstrap." });
  checkResult(result, { id: "a11y.keyboard-and-motion", category: "accessibility", ok: /:focus-visible/.test(stylesheetSource) && /prefers-reduced-motion:\s*reduce/.test(stylesheetSource) && !/<button\b(?![^>]*\btype=)[^>]*>/i.test(frontendSource) && /aria-live/.test(frontendSource) && /<dialog\b[^>]*aria-labelledby=/i.test(frontendSource), message: "La experiencia debe conservar foco visible, movimiento reducido, botones tipados y estados anunciables." });
  const images = [...landingSource.matchAll(/<img\b([^>]*)>/gi)];
  checkResult(result, { id: "a11y.image-alternatives", category: "accessibility", ok: images.every((match) => /\balt=["'][^"']*["']/i.test(match[1])), message: "Todas las imágenes de la landing deben declarar alternativa textual." });
}

function checkAssetAndRouteIntegrity(result, root, landingSource, shellSource, frontendSource, stylesheetSource, vercel) {
  const sourceByPath = new Map(NEW_EXPERIENCE_ASSETS.map((path) => [path, readText(root, path)]));
  const remoteReferences = [];
  for (const [path, source] of sourceByPath) {
    if (/\b(?:fetch|import)\s*\(\s*["']https?:\/\//i.test(source) || /url\(\s*["']?https?:\/\//i.test(source)) remoteReferences.push(`${path}:remote-load`);
  }
  checkResult(result, { id: "assets.no-remote-urls", category: "assets", ok: remoteReferences.length === 0, message: "Los assets de Academia no deben cargar código ni estilos remotos.", evidence: remoteReferences.slice(0, 5).join(", ") });

  const moduleFiles = NEW_EXPERIENCE_ASSETS.filter((path) => extname(path) === ".js");
  const brokenImports = [];
  for (const path of moduleFiles) {
    const directory = dirname(resolve(root, path));
    for (const specifier of extractModuleImports(readText(root, path)).filter((value) => value.startsWith("."))) {
      if (!existsSync(resolve(directory, specifier))) brokenImports.push(`${path} -> ${specifier}`);
    }
  }
  checkResult(result, { id: "assets.module-imports", category: "assets", ok: brokenImports.length === 0, message: "Todos los imports relativos de la experiencia deben resolver a archivos locales.", evidence: brokenImports.join(", ") });

  const brokenAssets = [];
  for (const [path, source] of [[DEFAULT_QA_PATHS.landing, landingSource], [DEFAULT_QA_PATHS.shell, shellSource], [DEFAULT_QA_PATHS.frontend, frontendSource]]) {
    for (const asset of extractLocalAssetReferences(source)) if (!existsSync(resolve(root, asset.slice(1)))) brokenAssets.push(`${path} -> ${asset}`);
  }
  checkResult(result, { id: "assets.internal-references", category: "assets", ok: brokenAssets.length === 0, message: "Las referencias internas a CSS, JS, SVG e imágenes deben existir en el repositorio.", evidence: brokenAssets.join(", ") });

  const missingRoutes = REQUIRED_PUBLIC_ROUTES.filter((path) => !existsSync(resolve(root, path)));
  checkResult(result, { id: "routes.public-areas", category: "routes", ok: missingRoutes.length === 0, message: "Academia, Herramientas, Mi operación y Recursos deben tener entradas públicas reales.", evidence: missingRoutes.join(", ") });
  checkResult(result, { id: "landing.public-entry", category: "landing", ok: /isAccessibleForFree/.test(landingSource) && frontendSource.includes("ENTRAR EN LA ACADEMIA") && frontendSource.includes("PRIMERA IMPORTACIÓN CONTIGO") && !/academia\/acceso/.test(landingSource + frontendSource), message: "La portada debe abrir la Academia gratis y separar con claridad la opción de acompañamiento PRO." });
  checkResult(result, { id: "assets.responsive-css", category: "assets", ok: /@media\s*\(max-width:\s*360px\)/.test(stylesheetSource) && /@media\s*\(min-width:\s*1600px\)/.test(stylesheetSource), severity: "P2", message: "La hoja pública debe cubrir móvil estrecho y escritorio amplio." });
}

function checkForbiddenBrand(result, sources) {
  const hits = sources.filter(([path, source]) => hasMatriculaPro(source)).map(([path]) => path);
  checkResult(result, { id: "brand.no-matriculapro", category: "brand", ok: hits.length === 0, message: "MatriculaPRO no debe aparecer en la experiencia, landing ni programa v2.", evidence: hits.join(", ") });
}

function checkPublicDist(result, root, program, { requireDist }) {
  const distRoot = resolve(root, DEFAULT_QA_PATHS.dist);
  if (!existsSync(distRoot)) {
    checkResult(result, { id: "dist.available", category: "privacy", ok: !requireDist, severity: "P2", message: "dist/ no existe; ejecuta el build antes de auditar privacidad del artefacto." });
    return;
  }
  const files = walkFiles(distRoot);
  const relativeFiles = files.map((file) => relative(distRoot, file).replaceAll("\\", "/"));
  result.facts.distFiles = files.length;
  result.facts.distBytes = files.reduce((total, file) => total + statSync(file).size, 0);
  const forbiddenNames = relativeFiles.filter((path) => /(?:legacy-lesson-map|concept-map|source-map)\.json$/i.test(path) || path.startsWith("private-products/"));
  checkResult(result, { id: "dist.no-private-artifacts", category: "privacy", ok: forbiddenNames.length === 0, severity: "P0", message: "dist/ no debe contener fuentes editoriales internas ni rutas private-products.", evidence: forbiddenNames.join(", ") });

  const searchableFiles = files.filter((file) => new Set([".html", ".js", ".css", ".json", ".txt", ".xml"]).has(extname(file).toLowerCase()));
  const corpus = searchableFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  checkResult(result, { id: "dist.no-matriculapro", category: "brand", ok: !hasMatriculaPro(corpus), message: "El artefacto público completo no debe contener la marca MatriculaPRO." });
  const publishedPath = resolve(distRoot, "assets/academy/program-v2.json");
  let published = null;
  try { published = JSON.parse(readFileSync(publishedPath, "utf8")); } catch { /* reported below */ }
  checkResult(result, { id: "dist.public-program", category: "public-access", ok: published?.access === "public-free" && published?.lessons?.length === 72 && published?.concepts?.length === 317 && published?.tools?.length === 17, severity: "P0", message: "dist/ debe contener el catálogo público completo y gratuito." });
}

export function auditAcademyExperience({ root = DEFAULT_ROOT, requirePrivate = true, requireDist = true } = {}) {
  const resolvedRoot = resolve(root);
  const result = {
    generatedAt: new Date().toISOString(),
    root: resolvedRoot,
    facts: {},
    checks: [],
    findings: [],
    notes: [],
    ok: false,
  };

  const requiredPublicFiles = [DEFAULT_QA_PATHS.frontend, DEFAULT_QA_PATHS.stylesheet, DEFAULT_QA_PATHS.landing, DEFAULT_QA_PATHS.publicProgram, DEFAULT_QA_PATHS.shell, DEFAULT_QA_PATHS.contentLoader, DEFAULT_QA_PATHS.vercel, ...NEW_EXPERIENCE_ASSETS];
  const missingPublic = [...new Set(requiredPublicFiles)].filter((path) => !existsSync(resolve(resolvedRoot, path)));
  checkResult(result, { id: "files.public-scope", category: "files", ok: missingPublic.length === 0, severity: "P0", message: "Faltan archivos necesarios para ejecutar QA estática.", evidence: missingPublic.join(", ") });
  if (missingPublic.length) {
    result.ok = false;
    return result;
  }

  const frontendSource = readText(resolvedRoot, DEFAULT_QA_PATHS.frontend);
  const stylesheetSource = readText(resolvedRoot, DEFAULT_QA_PATHS.stylesheet);
  const landingSource = readText(resolvedRoot, DEFAULT_QA_PATHS.landing);
  const shellSource = readText(resolvedRoot, DEFAULT_QA_PATHS.shell);
  const contentLoaderSource = readText(resolvedRoot, DEFAULT_QA_PATHS.contentLoader);
  const vercel = readJson(resolvedRoot, DEFAULT_QA_PATHS.vercel);
  const privatePath = resolve(resolvedRoot, DEFAULT_QA_PATHS.privateProgram);
  let program = null;
  if (existsSync(privatePath)) {
    try { program = JSON.parse(readFileSync(privatePath, "utf8")); }
    catch (error) { result.notes.push(`private program parse: ${error.message}`); }
  }
  checkResult(result, { id: "files.private-program", category: "files", ok: Boolean(program) || !requirePrivate, severity: "P0", message: "El catálogo privado v2 no está disponible o no contiene JSON válido.", evidence: DEFAULT_QA_PATHS.privateProgram });

  if (program) checkPrivateProgram(result, program, frontendSource);
  checkVisualExperience(result, program, frontendSource, stylesheetSource);
  checkAccessibility(result, landingSource, shellSource, frontendSource, stylesheetSource);
  checkAssetAndRouteIntegrity(result, resolvedRoot, landingSource, shellSource, frontendSource, stylesheetSource, vercel);
  checkForbiddenBrand(result, [
    [DEFAULT_QA_PATHS.frontend, frontendSource],
    [DEFAULT_QA_PATHS.stylesheet, stylesheetSource],
    [DEFAULT_QA_PATHS.landing, landingSource],
    [DEFAULT_QA_PATHS.shell, shellSource],
    [DEFAULT_QA_PATHS.contentLoader, contentLoaderSource],
    ...(program ? [[DEFAULT_QA_PATHS.privateProgram, JSON.stringify(program)]] : []),
  ]);
  checkPublicDist(result, resolvedRoot, program, { requireDist });

  result.facts.checks = result.checks.length;
  result.facts.passed = result.checks.filter((check) => check.ok).length;
  result.facts.failed = result.findings.length;
  result.facts.blockers = result.findings.filter((finding) => BLOCKING_SEVERITIES.has(finding.severity)).length;
  result.ok = result.facts.blockers === 0;
  return result;
}

export function formatAcademyQa(result) {
  const lines = [
    `Academia v2 QA: ${result.ok ? "PASS" : "FAIL"}`,
    `Checks: ${result.facts.passed || 0}/${result.facts.checks || result.checks.length} · blockers: ${result.facts.blockers || 0} · warnings: ${result.findings.filter((finding) => !BLOCKING_SEVERITIES.has(finding.severity)).length}`,
  ];
  if (result.facts.stages !== undefined) {
    lines.push(`Catálogo: ${result.facts.stages} etapas · ${result.facts.lessons} lecciones · ${result.facts.concepts} conceptos · ${result.facts.tools} herramientas · ${result.facts.videos} vídeos`);
  }
  if (result.findings.length) {
    lines.push("Hallazgos:");
    for (const finding of result.findings) lines.push(`- [${finding.severity}] ${finding.id}: ${finding.message}${finding.evidence ? ` (${finding.evidence})` : ""}`);
  } else lines.push("Sin hallazgos P0/P1/P2 en la auditoría estática.");
  return lines.join("\n");
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH);
if (isMain) {
  const args = new Set(process.argv.slice(2));
  const result = auditAcademyExperience({ requirePrivate: !args.has("--public-only"), requireDist: !args.has("--no-dist") });
  process.stdout.write(args.has("--json") ? `${JSON.stringify(result, null, 2)}\n` : `${formatAcademyQa(result)}\n`);
  const strictFailure = args.has("--strict") && result.findings.length > 0;
  if (!result.ok || strictFailure) process.exitCode = 1;
}
