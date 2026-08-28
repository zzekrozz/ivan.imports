import test from "node:test";
import assert from "node:assert/strict";
import {
  applyControlMutation,
  buildReminderCandidates,
  createEmptyControlState,
  getMissionBuckets,
  getProjectUnscheduledMissions,
  getScheduledMissions,
  getTodaySummary,
  getUnscheduledMissions,
  questIsDueOn,
  zonedDateTimeToUtc,
} from "../assets/control/domain.js";

const USER = "owner";
const NOW = Date.parse("2026-08-18T08:00:00.000Z");

function mutate(state, action, payload, now = NOW) {
  return applyControlMutation(state, { action, payload, operation_id: `${action}:${Math.random()}` }, { userId: USER, now }).state;
}

test("timezone conversion remains correct on both sides of Madrid daylight saving time", () => {
  assert.equal(zonedDateTimeToUtc("2026-01-15", "09:00", "Europe/Madrid"), "2026-01-15T08:00:00.000Z");
  assert.equal(zonedDateTimeToUtc("2026-07-15", "09:00", "Europe/Madrid"), "2026-07-15T07:00:00.000Z");
  assert.equal(zonedDateTimeToUtc("2026-03-29", "02:30", "Europe/Madrid"), null);
});

test("weekly, monthly and interval recurrence use the configured schedule", () => {
  const base = { scheduled_date: "2026-08-17", status: "ACTIVE", timezone: "Europe/Madrid" };
  assert.equal(questIsDueOn({ ...base, recurrence_type: "weekly", recurrence_config: { days: [2, 4] } }, NOW), true);
  assert.equal(questIsDueOn({ ...base, recurrence_type: "weekly", recurrence_config: { days: [1, 3] } }, NOW), false);
  assert.equal(questIsDueOn({ ...base, recurrence_type: "monthly", recurrence_config: { day: 18 } }, NOW), true);
  assert.equal(questIsDueOn({ ...base, recurrence_type: "interval", recurrence_config: { interval: 2, unit: "days" } }, NOW), false);
  assert.equal(questIsDueOn({ ...base, recurrence_type: "interval", recurrence_config: { interval: 2, unit: "days" } }, Date.parse("2026-08-19T08:00:00Z")), true);
});

test("summary centralizes pending, completed and overdue counts without duplicating Main Quest", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state = mutate(state, "quest.create", { title: "Main", is_main_quest: true, scheduled_date: "2026-08-18", scheduled_time: "07:00" });
  state = mutate(state, "quest.create", { title: "Done", scheduled_date: "2026-08-18" });
  const done = state.quests.find((quest) => quest.title === "Done");
  state = mutate(state, "quest.complete", { id: done.id }, NOW);
  const summary = getTodaySummary(state, NOW);
  assert.equal(summary.total, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.pending, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(new Set(summary.missions.map((quest) => quest.id)).size, summary.missions.length);
});

test("missions without a date remain normal open work and stay outside Today", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state = mutate(state, "quest.create", { title: "Comprar aceite", scheduled_date: null, priority: "LOW" });
  const mission = state.quests[0];
  assert.equal(mission.scheduled_date, null);
  assert.equal(mission.scheduled_time, null);
  assert.equal(getUnscheduledMissions(state)[0].id, mission.id);
  assert.equal(getScheduledMissions(state).length, 0);
  assert.equal(getTodaySummary(state, NOW).missions.length, 0);
  assert.equal(getMissionBuckets(state, NOW).unscheduled.length, 1);
});

test("recurrence without a start date remains unscheduled until it is planned", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state = mutate(state, "quest.create", { title: "Revisar campaña", recurrence_type: "daily", scheduled_date: null });
  assert.equal(questIsDueOn(state.quests[0], NOW), false);
  assert.equal(getTodaySummary(state, NOW).total, 0);
  assert.equal(getUnscheduledMissions(state).length, 1);
});

test("project unscheduled missions include children and preserve project ownership", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state.user_game_stats.max_active_projects = 12;
  state = mutate(state, "project.create", { title: "Casa", status: "ACTIVE" });
  const project = state.projects[0];
  state = mutate(state, "quest.create", { title: "Vender sofá", project_id: project.id, scheduled_date: null });
  const parent = state.quests[0];
  state = mutate(state, "quest.create", { title: "Mirar precio", project_id: project.id, parent_id: parent.id, scheduled_date: null });
  state = mutate(state, "quest.create", { title: "Publicar", project_id: project.id, scheduled_date: "2026-08-20" });
  assert.deepEqual(getProjectUnscheduledMissions(state, project.id).map((quest) => quest.title), ["Vender sofá", "Mirar precio"]);
  assert.ok(getProjectUnscheduledMissions(state, project.id).every((quest) => quest.project_id === project.id));
});

test("an unscheduled mission can be scheduled later without losing its planning data", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state = mutate(state, "quest.create", { title: "Mejorar landing", description: "Revisar el hero", priority: "HIGH", scheduled_date: null });
  const mission = state.quests[0];
  state = mutate(state, "progress.create", { quest_id: mission.id, text: "Analizada la conversión" });
  state = mutate(state, "quest.create", { title: "Preparar copy", parent_id: mission.id, scheduled_date: null });
  state = mutate(state, "quest.update", { id: mission.id, scheduled_date: "2026-08-21", scheduled_time: "10:30" });
  const updated = state.quests.find((quest) => quest.id === mission.id);
  assert.equal(updated.scheduled_date, "2026-08-21");
  assert.equal(updated.scheduled_time, "10:30");
  assert.equal(updated.description, "Revisar el hero");
  assert.equal(updated.priority, "HIGH");
  assert.equal(state.quests.find((quest) => quest.parent_id === mission.id).title, "Preparar copy");
  assert.equal(state.progress_logs[0].text, "Analizada la conversión");
  assert.equal(getUnscheduledMissions(state).some((quest) => quest.id === mission.id), false);
  assert.equal(getScheduledMissions(state).some((quest) => quest.id === mission.id), true);
});

test("multiple reminders become candidates once and snooze reschedules the same delivery", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state = mutate(state, "quest.create", {
    title: "Enviar propuesta",
    scheduled_date: "2026-08-18",
    scheduled_time: "10:15",
    reminders: [{ id: "r-60", offset_minutes: 60 }, { id: "r-15", offset_minutes: 15 }],
  });
  const at0915 = Date.parse("2026-08-18T07:15:00.000Z");
  const first = buildReminderCandidates(state, at0915);
  assert.equal(first.length, 1);
  state = mutate(state, "reminder.mark-delivered", { deliveries: first }, at0915);
  const delivery = state.reminder_deliveries[0];
  assert.equal(buildReminderCandidates(state, at0915).length, 0);
  state = mutate(state, "reminder.snooze", { id: delivery.id, minutes: 15 }, at0915);
  assert.equal(buildReminderCandidates(state, Date.parse("2026-08-18T07:29:00Z")).length, 0);
  assert.equal(buildReminderCandidates(state, Date.parse("2026-08-18T07:30:00Z")).length, 1);
});

test("changing a mission time recalculates relative reminder delivery", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  state = mutate(state, "quest.create", { title: "Cita", scheduled_date: "2026-08-18", scheduled_time: "10:00", reminders: [60] });
  const quest = state.quests[0];
  assert.equal(buildReminderCandidates(state, Date.parse("2026-08-18T07:00:00Z"))[0].due_at, "2026-08-18T08:00:00.000Z");
  state = mutate(state, "quest.update", { id: quest.id, scheduled_time: "11:00" }, Date.parse("2026-08-18T07:00:00Z"));
  assert.equal(buildReminderCandidates(state, Date.parse("2026-08-18T07:00:00Z")).length, 0);
  assert.equal(buildReminderCandidates(state, Date.parse("2026-08-18T08:00:00Z"))[0].due_at, "2026-08-18T09:00:00.000Z");
});

test("completion cancels future deliveries and normalized entities remain owner scoped", () => {
  let state = createEmptyControlState("other", { now: NOW });
  state = mutate(state, "quest.create", { title: "Cerrar", scheduled_date: "2026-08-18", scheduled_time: "11:00", reminders: [60] });
  const quest = state.quests[0];
  const candidate = buildReminderCandidates(state, Date.parse("2026-08-18T08:00:00Z"))[0];
  state = mutate(state, "reminder.mark-delivered", { deliveries: [candidate] }, NOW);
  state = mutate(state, "quest.complete", { id: quest.id }, NOW);
  assert.equal(state.reminder_deliveries[0].status, "CANCELLED");
  assert.ok(state.quests.every((item) => item.user_id === USER));
  assert.ok(state.reminder_deliveries.every((item) => item.user_id === USER));
});
