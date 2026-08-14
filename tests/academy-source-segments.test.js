import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  FIRST_BATCH_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
  PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
  assertCanonicalMigratedSourceSegments,
  assertFirstMigrationBatchSourceSegments,
  assertFullCanonicalSourceSegments,
  assertPilotSourceSegments,
  auditFirstMigrationBatchSourceSegments,
  auditFullCanonicalSourceSegments,
  auditPilotSourceSegments,
} from "../scripts/academy-source-segments.mjs";
import {
  CANONICAL_LESSON_TITLES,
  CANONICAL_SOURCE_SEGMENTS,
} from "../scripts/academy-canonical-map.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const program = JSON.parse(readFileSync(resolve(root, "assets/academy/program-v2.json"), "utf8"));

test("01-01, 01-02 y 01-03 cubren una sola vez los 14 segmentos de las páginas 7-12", () => {
  const audit = assertPilotSourceSegments(program);
  assert.equal(audit.segmentCount, 14);
  assert.deepEqual(audit.coveredPages, [7, 8, 9, 10, 11, 12]);
});

test("cada segmento tiene hogar, secciones trazadas y cobertura editorial propia", () => {
  const audit = assertPilotSourceSegments(program);
  assert.equal(audit.sectionMappingCount, 23);
  assert.equal(audit.visualMappingCount, 3);
  assert.equal(
    audit.editorialIdeaCount,
    Object.values(PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS).flat().length,
  );
  assert.ok(audit.editorialIdeaCount >= 90);
});

test("la unidad piloto conserva la secuencia 01-01 → 01-02 → 01-03 sin saltos", () => {
  const lesson01 = program.lessons.find((lesson) => lesson.id === "lesson-01-01");
  const lesson02 = program.lessons.find((lesson) => lesson.id === "lesson-01-02");
  const lesson03 = program.lessons.find((lesson) => lesson.id === "lesson-01-03");
  assert.equal(lesson01.relations.nextLessonId, lesson02.id);
  assert.equal(lesson02.relations.previousLessonId, lesson01.id);
  assert.equal(lesson02.relations.nextLessonId, lesson03.id);
  assert.equal(lesson03.relations.previousLessonId, lesson02.id);
});

test("la validación detecta un segmento sin asignar", () => {
  const altered = structuredClone(program);
  altered.lessons.find((lesson) => lesson.id === "lesson-01-03").sourceSegments.pop();
  const audit = auditPilotSourceSegments(altered);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((error) => error.includes("Segmento sin asignar")));
});

test("la validación detecta solapamientos aunque dos fragmentos compartan página", () => {
  const altered = structuredClone(program);
  const lesson01 = altered.lessons.find((lesson) => lesson.id === "lesson-01-01");
  const lesson02 = altered.lessons.find((lesson) => lesson.id === "lesson-01-02");
  lesson01.sourcePages.push(10);
  lesson01.sourceSegments.push(structuredClone(lesson02.sourceSegments[1]));
  const audit = auditPilotSourceSegments(altered);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((error) => error.includes("Solapamiento accidental")));
});

test("la validación rechaza una sección trazada a un segmento de otra lección", () => {
  const altered = structuredClone(program);
  altered.lessons.find((lesson) => lesson.id === "lesson-01-01").sections[0].sourceSegmentIds.push("importa7-p009-germany");
  const audit = auditPilotSourceSegments(altered);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((error) => error.includes("fuera de su hogar canónico")));
});

test("la validación detecta pérdida de una idea dentro de su segmento aunque el país siga nombrado", () => {
  const altered = structuredClone(program);
  const lesson = altered.lessons.find((item) => item.id === "lesson-01-02");
  const section = lesson.sections.find((item) => item.id === "lesson-01-02-netherlands");
  section.body = section.body.replace("certificado de exportación", "documento");
  const audit = auditPilotSourceSegments(altered);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((error) => error.includes("certificado de exportación")));
});

test("00-01, 00-02 y 00-03 cubren una sola vez los 14 segmentos del primer lote", () => {
  const audit = assertFirstMigrationBatchSourceSegments(program);
  assert.equal(audit.segmentCount, 14);
  assert.deepEqual(audit.coveredPages, [1, 2, 3, 4, 5, 6, 145, 146, 147, 148, 149]);
  assert.equal(audit.sectionMappingCount, 22);
  assert.equal(audit.visualMappingCount, 3);
  assert.equal(
    audit.editorialIdeaCount,
    Object.values(FIRST_BATCH_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS).flat().length,
  );
});

test("el primer lote conserva la asignación canónica 4 + 7 + 3", () => {
  const counts = ["lesson-00-01", "lesson-00-02", "lesson-00-03"]
    .map((lessonId) => program.lessons.find((lesson) => lesson.id === lessonId).sourceSegments.length);
  assert.deepEqual(counts, [4, 7, 3]);
});

test("el primer lote usa los títulos aprobados por la matriz y mantiene su secuencia", () => {
  const lesson01 = program.lessons.find((lesson) => lesson.id === "lesson-00-01");
  const lesson02 = program.lessons.find((lesson) => lesson.id === "lesson-00-02");
  const lesson03 = program.lessons.find((lesson) => lesson.id === "lesson-00-03");
  assert.equal(lesson01.title, "Tu ruta completa, de cero a matrícula");
  assert.equal(lesson02.title, "Cómo utilizar la academia, el cuaderno y sus fuentes");
  assert.equal(lesson03.title, "Qué casos cubre la ruta y dónde empezar");
  assert.equal(lesson01.relations.nextLessonId, lesson02.id);
  assert.equal(lesson02.relations.previousLessonId, lesson01.id);
  assert.equal(lesson02.relations.nextLessonId, lesson03.id);
  assert.equal(lesson03.relations.previousLessonId, lesson02.id);
  assert.equal(lesson03.relations.nextLessonId, "lesson-01-01");
});

test("la validación del primer lote detecta segmentos sin asignar y solapamientos", () => {
  const missing = structuredClone(program);
  missing.lessons.find((lesson) => lesson.id === "lesson-00-02").sourceSegments.pop();
  assert.ok(auditFirstMigrationBatchSourceSegments(missing).errors.some((error) => error.includes("Segmento sin asignar")));

  const overlapping = structuredClone(program);
  const lesson01 = overlapping.lessons.find((lesson) => lesson.id === "lesson-00-01");
  const lesson03 = overlapping.lessons.find((lesson) => lesson.id === "lesson-00-03");
  lesson01.sourcePages.push(5);
  lesson01.sourceSegments.push(structuredClone(lesson03.sourceSegments[0]));
  assert.ok(auditFirstMigrationBatchSourceSegments(overlapping).errors.some((error) => error.includes("Solapamiento accidental")));
});

test("la validación del primer lote detecta pérdida editorial dentro de un segmento", () => {
  const altered = structuredClone(program);
  const lesson = altered.lessons.find((item) => item.id === "lesson-00-02");
  const section = lesson.sections.find((item) => item.id === "lesson-00-02-glossary");
  section.items = section.items.filter((item) => !item.startsWith("Motorschaden"));
  const audit = auditFirstMigrationBatchSourceSegments(altered);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((error) => error.includes("Motorschaden")));
});

test("los dos lotes migrados cubren 28 segmentos sin hogares duplicados", () => {
  const audit = assertCanonicalMigratedSourceSegments(program);
  assert.equal(audit.segmentCount, 28);
  assert.deepEqual(audit.coveredPages, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 145, 146, 147, 148, 149]);
  assert.equal(audit.sectionMappingCount, 45);
  assert.equal(audit.visualMappingCount, 6);
});

test("el mapa completo cubre 72 lecciones, 199 segmentos y 150 páginas", () => {
  const audit = assertFullCanonicalSourceSegments(program);
  assert.equal(audit.lessonCount, 72);
  assert.equal(audit.segmentCount, 199);
  assert.deepEqual(audit.coveredPages, Array.from({ length: 150 }, (_, index) => index + 1));
  assert.equal(audit.classifiedLessons, 66);
});

test("cada lección conserva exactamente los segmentos aprobados por la matriz", () => {
  for (const [lessonId, title] of Object.entries(CANONICAL_LESSON_TITLES)) {
    const lesson = program.lessons.find((item) => item.id === lessonId);
    const expected = CANONICAL_SOURCE_SEGMENTS.filter((segment) => segment.lessonId === lessonId);
    assert.equal(lesson.title, title);
    assert.deepEqual(lesson.sourceSegments.map((segment) => segment.id), expected.map((segment) => segment.id));
  }
});

test("la validación global detecta un hueco y un hogar duplicado", () => {
  const missing = structuredClone(program);
  missing.lessons.find((lesson) => lesson.id === "lesson-06-04").sourceSegments.pop();
  assert.ok(auditFullCanonicalSourceSegments(missing).errors.some((error) => error.includes("Segmento sin asignar")));

  const overlapping = structuredClone(program);
  const source = overlapping.lessons.find((lesson) => lesson.id === "lesson-08-02").sourceSegments[0];
  overlapping.lessons.find((lesson) => lesson.id === "lesson-08-03").sourceSegments.push(structuredClone(source));
  assert.ok(auditFullCanonicalSourceSegments(overlapping).errors.some((error) => error.includes("Solapamiento accidental")));
});

test("la huella canónica detecta pérdida editorial en cualquiera de las 66 lecciones migradas", () => {
  const altered = structuredClone(program);
  const lesson = altered.lessons.find((item) => item.id === "lesson-10-03");
  lesson.sections[0].body = lesson.sections[0].body.replace(/\S+/, "contenido-eliminado");
  const audit = auditFullCanonicalSourceSegments(altered);
  assert.equal(audit.ok, false);
  assert.ok(audit.errors.some((error) => error.includes("contenido visible no coincide")));
});

test("las 66 lecciones migradas clasifican toda capa no literal y no conservan sin_fuente", () => {
  const approved = new Set(["lesson-00-01", "lesson-00-02", "lesson-00-03", "lesson-01-01", "lesson-01-02", "lesson-01-03"]);
  const migrated = program.lessons.filter((lesson) => !approved.has(lesson.id));
  assert.equal(migrated.length, 66);
  assert.ok(migrated.every((lesson) => Object.keys(lesson.contentClassification || {}).length === 14));
  assert.ok(migrated.every((lesson) => !Object.values(lesson.contentClassification).includes("sin_fuente")));
});

test("la navegación anterior/siguiente forma una única cadena de 72 lecciones", () => {
  const ids = Object.keys(CANONICAL_LESSON_TITLES);
  ids.forEach((lessonId, index) => {
    const lesson = program.lessons.find((item) => item.id === lessonId);
    assert.equal(lesson.relations.previousLessonId, index ? ids[index - 1] : null);
    assert.equal(lesson.relations.nextLessonId, index + 1 < ids.length ? ids[index + 1] : null);
  });
});
