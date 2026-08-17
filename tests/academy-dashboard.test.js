import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  academyCoreStages,
  academyDashboardModel,
  academyProgressLessons,
  selectDashboardTools,
} from "../assets/academy/private/dashboard.js";

const root = new URL("../", import.meta.url);
const program = JSON.parse(await readFile(new URL("assets/academy/program-v2.json", root), "utf8"));

function state(progress = {}) {
  return { progress: { completedLessonIds: [], startedLessonIds: [], currentLessonId: "", ...progress } };
}

test("el Centro de Control deriva 12 módulos y 72 lecciones del catálogo canónico", () => {
  const stages = academyCoreStages(program);
  assert.equal(stages.length, 12);
  assert.deepEqual(stages.map((stage) => stage.id), Array.from({ length: 12 }, (_, index) => `stage-${String(index + 1).padStart(2, "0")}`));
  assert.equal(academyProgressLessons(program).length, 72);
});

test("un usuario nuevo recibe un estado seguro y el módulo 01 queda recomendado", () => {
  const model = academyDashboardModel(program, state());
  assert.equal(model.isNew, true);
  assert.equal(model.percentage, 0);
  assert.equal(model.completedCount, 0);
  assert.equal(model.totalLessons, 72);
  assert.equal(model.currentLesson.id, "lesson-00-01");
  assert.equal(model.recommendedStage.id, "stage-01");
  assert.equal(model.stages[0].status, "recommended");
  assert.ok(model.stages.slice(1).every((stage) => stage.status === "pending"));
});

test("el progreso parcial conserva la última lección válida y calcula estados de módulo", () => {
  const completedLessonIds = program.lessons.slice(0, 24).map((lesson) => lesson.id);
  const currentLesson = program.lessons[24];
  const model = academyDashboardModel(program, state({
    completedLessonIds,
    startedLessonIds: [currentLesson.id],
    currentLessonId: currentLesson.id,
  }));
  assert.equal(model.isNew, false);
  assert.equal(model.isComplete, false);
  assert.equal(model.completedCount, 24);
  assert.equal(model.percentage, 33);
  assert.equal(model.currentLesson.id, currentLesson.id);
  assert.equal(model.currentCoreStageId, currentLesson.stageId);
  assert.equal(model.stages.find((stage) => stage.id === currentLesson.stageId).status, "current");
  assert.ok(model.stages.some((stage) => stage.status === "complete"));
});

test("un identificador antiguo o inexistente cae en la primera lección sin romper el dashboard", () => {
  const model = academyDashboardModel(program, state({ currentLessonId: "lesson-that-no-longer-exists" }));
  assert.equal(model.currentLesson.id, "lesson-00-01");
  assert.equal(model.percentage, 0);
  assert.equal(model.recommendedStage.id, "stage-01");
});

test("la ruta completada conserva 100 %, los 12 módulos completos y una lección de repaso", () => {
  const completedLessonIds = program.lessons.map((lesson) => lesson.id);
  const model = academyDashboardModel(program, state({ completedLessonIds, currentLessonId: program.lessons.at(-1).id }));
  assert.equal(model.isComplete, true);
  assert.equal(model.percentage, 100);
  assert.equal(model.completedCount, 72);
  assert.equal(model.currentLesson.id, program.lessons.at(-1).id);
  assert.ok(model.stages.every((stage) => stage.status === "complete"));
});

test("las herramientas destacadas salen del catálogo y priorizan el módulo recomendado", () => {
  const selected = selectDashboardTools(program, "stage-08", 6);
  const canonicalIds = new Set(program.tools.map((tool) => tool.id));
  assert.equal(selected.length, 6);
  assert.deepEqual(selected.slice(0, 2).map((tool) => tool.id), ["inspection-checklist", "paint-sheet"]);
  assert.ok(selected.every((tool) => canonicalIds.has(tool.id)));
});

test("el frontend mantiene Academia educativa con módulos y buscador sin superficies operativas duplicadas", async () => {
  const source = await readFile(new URL("assets/academy/app.js", root), "utf8");
  const html = await readFile(new URL("academia/index.html", root), "utf8");
  assert.match(source, /academyDashboardModel\(app\.program, app\.state\)/);
  assert.match(source, /model\.stages\.map\(renderDashboardModule\)/);
  assert.match(source, /data-action="search-open"/);
  const dashboard = source.slice(source.indexOf("function renderDashboard()"), source.indexOf("function renderAcademyEntryChoices"));
  assert.doesNotMatch(dashboard, /selectDashboardTools|academy-control-europe|academy-control-tools/);
  assert.doesNotMatch(dashboard, /href="\/(?:herramientas|mi-operacion|recursos)/);
  assert.match(html, /<h1>Aprende a importar un coche desde Europa, paso a paso\.<\/h1>/);
  assert.match(html, /<main class="academy-noscript" id="academy-static-intro" hidden>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ivanimports\.es\/academia\/">/);
});
