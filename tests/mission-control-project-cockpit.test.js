import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTROL_SCHEMA_VERSION,
  applyControlMutation,
  buildReminderCandidates,
  createEmptyControlState,
  getAttentionItems,
  getProjectQuestStats,
  getProjectSummary,
  normalizeControlState,
  questPeriodKey,
} from "../assets/control/domain.js";

const NOW = Date.parse("2026-08-27T12:00:00Z");
const USER = "cockpit-owner";

function mutate(state, action, payload, offset = 0) {
  return applyControlMutation(state, { action, payload, operation_id: `${action}-${Math.random()}` }, { userId: USER, now: NOW + offset }).state;
}

function projectState() {
  let state = createEmptyControlState(USER, { now: NOW });
  state.user_game_stats.max_active_projects = 12;
  state = mutate(state, "project.create", { title: "DDTM", status: "ACTIVE" });
  return { state, project: state.projects[0] };
}

test("schema V4 lazily migrates legacy projects and preserves their original data", () => {
  const legacy = createEmptyControlState(USER, { now: NOW });
  legacy.version = 3;
  legacy.projects.push({ id: "p1", user_id: "old", title: "Legacy", description: "Conservar", main_goal: "Objetivo anterior", status: "ACTIVE", created_at: new Date(NOW).toISOString() });
  delete legacy.project_logs;
  const state = normalizeControlState(legacy, USER, { now: NOW });
  assert.equal(CONTROL_SCHEMA_VERSION, 4);
  assert.equal(state.version, 4);
  assert.equal(state.projects[0].description, "Conservar");
  assert.equal(state.projects[0].general_objective, "Objetivo anterior");
  assert.equal(state.projects[0].health, "GREEN");
  assert.deepEqual(state.project_logs, []);
});

test("Project persists objectives, focus, health and next milestone", () => {
  let { state, project } = projectState();
  state = mutate(state, "project.update", { id: project.id, general_objective: "Canal rentable", weekly_objective: "Publicar dos vídeos", current_focus: "Cerrar el vídeo", health: "YELLOW", next_milestone: "Primer vídeo", next_milestone_date: "2026-09-01" });
  project = state.projects[0];
  assert.equal(project.general_objective, "Canal rentable");
  assert.equal(project.weekly_objective, "Publicar dos vídeos");
  assert.equal(project.current_focus, "Cerrar el vídeo");
  assert.equal(project.health, "YELLOW");
  assert.equal(project.next_milestone, "Primer vídeo");
});

test("project stats count active, completed, pending and overdue quests transparently", () => {
  let { state, project } = projectState();
  state = mutate(state, "quest.create", { title: "Vencida", project_id: project.id, priority: "HIGH", scheduled_date: "2026-08-25" });
  state = mutate(state, "quest.create", { title: "Terminada", project_id: project.id, scheduled_date: "2026-08-27" });
  const completed = state.quests.find((quest) => quest.title === "Terminada");
  state = mutate(state, "quest.complete", { id: completed.id, period_key: questPeriodKey(completed, NOW) });
  const stats = getProjectQuestStats(state, project.id, NOW);
  assert.deepEqual(stats, { total: 2, active: 1, in_progress: 0, completed: 1, pending: 1, overdue: 1, high_overdue: 1 });
});

test("achievements and project logs create, persist and delete independently", () => {
  let { state, project } = projectState();
  state = mutate(state, "project.achievement.add", { project_id: project.id, text: "Primer vídeo publicado" });
  state = mutate(state, "project.log.add", { project_id: project.id, text: "Terminada estructura" });
  assert.equal(getProjectSummary(state, project.id, NOW).achievements.length, 1);
  assert.equal(getProjectSummary(state, project.id, NOW).logs.length, 1);
  state = mutate(state, "project.achievement.delete", { id: state.project_achievements[0].id });
  state = mutate(state, "project.log.delete", { id: state.project_logs[0].id });
  assert.equal(state.project_achievements.length, 0);
  assert.equal(state.project_logs.length, 0);
});

test("decisions and blockers retain their resolved history", () => {
  let { state, project } = projectState();
  state = mutate(state, "project.decision.add", { project_id: project.id, text: "¿Vídeo corto o largo?" });
  state = mutate(state, "project.blocker.add", { project_id: project.id, text: "Falta acceso API" });
  state = mutate(state, "project.decision.resolve", { id: state.project_decisions[0].id, resolution: "4:30", resolution_notes: "Más frecuencia" });
  state = mutate(state, "project.blocker.resolve", { id: state.project_blockers[0].id });
  assert.equal(state.project_decisions[0].status, "RESOLVED");
  assert.equal(state.project_decisions[0].resolution, "4:30");
  assert.equal(state.project_blockers[0].status, "RESOLVED");
  assert.ok(state.project_blockers[0].resolved_at);
});

test("metrics accept value, optional target, update and deletion", () => {
  let { state, project } = projectState();
  state = mutate(state, "project.metric.add", { project_id: project.id, name: "Vídeos publicados", value: "4", target: "10", unit: "vídeos" });
  const metric = state.project_metrics[0];
  assert.equal(metric.value, "4");
  state = mutate(state, "project.metric.update", { id: metric.id, value: "5" });
  assert.equal(state.project_metrics[0].value, "5");
  state = mutate(state, "project.metric.delete", { id: metric.id });
  assert.equal(state.project_metrics.length, 0);
});

test("attention engine exposes red health, blockers, decisions and overdue HIGH quests", () => {
  let { state, project } = projectState();
  state = mutate(state, "project.update", { id: project.id, health: "RED" });
  state = mutate(state, "project.blocker.add", { project_id: project.id, text: "API" });
  state = mutate(state, "project.decision.add", { project_id: project.id, text: "Proveedor" });
  state = mutate(state, "quest.create", { title: "Urgente", project_id: project.id, priority: "HIGH", scheduled_date: "2026-08-25" });
  assert.deepEqual(new Set(getAttentionItems(state, NOW).map((item) => item.type)), new Set(["project_health", "open_blockers", "open_decisions", "overdue_high_quests"]));
});

test("new Project collections remain owner scoped and do not alter reminders or recurrence", () => {
  let { state, project } = projectState();
  state = mutate(state, "project.log.add", { project_id: project.id, text: "Avance" });
  state = mutate(state, "quest.create", { title: "Revisar", project_id: project.id, recurrence_type: "daily", scheduled_date: "2026-08-27", scheduled_time: "14:00", reminders: [{ offset_minutes: 60 }] });
  const normalized = normalizeControlState(state, "new-owner", { now: NOW });
  assert.equal(normalized.project_logs[0].user_id, "new-owner");
  assert.equal(normalized.quests[0].recurrence_type, "daily");
  assert.equal(buildReminderCandidates(normalized, NOW).length, 1);
});
