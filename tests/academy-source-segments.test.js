import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertPilotSourceSegments, auditPilotSourceSegments } from "../scripts/academy-source-segments.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const program = JSON.parse(readFileSync(resolve(root, "assets/academy/program-v2.json"), "utf8"));

test("01-01, 01-02 y 01-03 cubren una sola vez los 14 segmentos de las páginas 7-12", () => {
  const audit = assertPilotSourceSegments(program);
  assert.equal(audit.segmentCount, 14);
  assert.deepEqual(audit.coveredPages, [7, 8, 9, 10, 11, 12]);
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
