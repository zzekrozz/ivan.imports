import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PILOT_SOURCE_SEGMENT_EDITORIAL_EXPECTATIONS,
  assertPilotSourceSegments,
  auditPilotSourceSegments,
} from "../scripts/academy-source-segments.mjs";

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
