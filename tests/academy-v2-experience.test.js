import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACADEMY_COMPLETION_COPY,
  ACADEMY_V2_EXPECTED,
  DEFAULT_QA_PATHS,
  auditAcademyExperience,
  formatAcademyQa,
} from "../scripts/academy-experience-qa-v2.mjs";
import { resolveLegacyDeepLink } from "../assets/academy/private/migration.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privateAvailable = existsSync(resolve(root, DEFAULT_QA_PATHS.privateProgram));
const distAvailable = existsSync(resolve(root, DEFAULT_QA_PATHS.dist));
const privateProgram = privateAvailable ? JSON.parse(readFileSync(resolve(root, DEFAULT_QA_PATHS.privateProgram), "utf8")) : null;
const audit = auditAcademyExperience({ root, requirePrivate: privateAvailable, requireDist: distAvailable });

function check(id) {
  const found = audit.checks.find((entry) => entry.id === id);
  assert.ok(found, `falta el check ${id}`);
  assert.equal(found.ok, true, `${found.severity} ${id}: ${found.message}${found.evidence ? ` (${found.evidence})` : ""}`);
  return found;
}

function checks(ids) {
  ids.forEach(check);
}

test("el catálogo privado conserva 13 etapas, 72 lecciones, 317 conceptos y el mapa completo", { skip: !privateAvailable }, () => {
  assert.equal(audit.facts.programId, ACADEMY_V2_EXPECTED.programId);
  assert.equal(audit.facts.schemaVersion, 2);
  assert.equal(audit.facts.stages, 13);
  assert.equal(audit.facts.lessons, 72);
  assert.equal(audit.facts.concepts, 317);
  assert.equal(audit.facts.mappings, 317);
  checks([
    "program.stable-id",
    "program.schema",
    "program.count.stages",
    "program.count.lessons",
    "program.count.concepts",
    "program.count.mappings",
    "program.unique-ids",
    "program.stage-id-contract",
    "program.stage-lesson-graph",
    "program.lesson-concept-graph",
    "program.authored-lessons",
    "program.legacy-map-contract",
    "program.legacy-map-targets",
  ]);
});

test("los 317 conceptos se consultan dentro de lecciones y no gobiernan el progreso", { skip: !privateAvailable }, () => {
  check("experience.no-317-tasks");
});

test("un slug v2 06-04 gana a la colisión legacy y /paso/6-04-* sigue siendo resoluble", { skip: !privateAvailable }, () => {
  const v2Lesson = privateProgram.lessons.find((lesson) => lesson.id === "lesson-06-04");
  assert.ok(v2Lesson?.slug.startsWith("06-04-"));
  const rawLegacyInterpretation = resolveLegacyDeepLink(`/paso/${v2Lesson.slug}`, privateProgram.legacyLessonMap);
  assert.notEqual(rawLegacyInterpretation?.lessonId, v2Lesson.id, "el fixture debe conservar una colisión real para probar la precedencia del frontend");
  const legacy = resolveLegacyDeepLink("/paso/6-04-enlace-antiguo", privateProgram.legacyLessonMap);
  assert.equal(legacy?.legacyLessonId, "lesson-6-04");
  check("routes.v2-before-legacy");
});

test("aprendizaje y operación real mantienen condiciones y eventos independientes", { skip: !privateAvailable }, () => {
  assert.equal(privateProgram.completionSemantics.learning.message, ACADEMY_COMPLETION_COPY.learning);
  assert.equal(privateProgram.completionSemantics.realOperation.message, ACADEMY_COMPLETION_COPY.realOperation);
  checks(["experience.completion-semantics", "experience.completion-code", "experience.completion-copy"]);
});

test("mapa Europa, ruta móvil y visuales editoriales están conectados", () => {
  checks(["visual.europe-map", "visual.mobile-route", "visual.frontend-wiring"]);
});

test("las 17 herramientas tienen icono y el Centro de respuestas recibe contenido trazable", { skip: !privateAvailable }, () => {
  assert.equal(audit.facts.tools, 17);
  assert.ok(audit.facts.answers > 0);
  checks(["experience.tools-and-icons", "experience.answers"]);
});

test("la portada y las rutas internas abren una única Academia pública", () => {
  checks(["landing.public-entry", "routes.rewrites", "assets.internal-references", "assets.module-imports"]);
});

test("la accesibilidad estática cubre landmarks, teclado, movimiento e imágenes", () => {
  checks([
    "a11y.landing-landmarks",
    "a11y.no-nested-main",
    "a11y.shell-skip-target",
    "a11y.keyboard-and-motion",
    "a11y.image-alternatives",
    "assets.responsive-css",
  ]);
});

test("los nuevos assets no cargan URLs remotas y MatriculaPRO no aparece", () => {
  checks(["assets.no-remote-urls", "brand.no-matriculapro"]);
});

test("dist publica el programa completo sin fuentes editoriales internas", { skip: !distAvailable || !privateAvailable }, () => {
  assert.ok(audit.facts.distFiles > 0);
  checks(["dist.no-private-artifacts", "dist.public-program", "dist.no-matriculapro"]);
});

test("el runner QA no deja blockers y produce un resumen verificable", () => {
  assert.equal(audit.ok, true, formatAcademyQa(audit));
  assert.equal(audit.findings.filter((finding) => ["P0", "P1"].includes(finding.severity)).length, 0);
  assert.match(formatAcademyQa(audit), /Academia v2 QA: PASS/);
});
