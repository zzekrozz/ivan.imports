import test from "node:test";
import assert from "node:assert/strict";
import {
  applyControlMutation,
  buildReminderCandidates,
  createEmptyControlState,
  getTodaySummary,
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
