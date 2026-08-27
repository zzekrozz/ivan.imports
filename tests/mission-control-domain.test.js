import test from "node:test";
import assert from "node:assert/strict";
import {
  applyControlMutation,
  createDemoControlState,
  createEmptyControlState,
  getLevelFromXp,
  getLevelProgress,
  questPeriodKey,
} from "../assets/control/domain.js";

const NOW = new Date("2026-08-18T10:00:00.000Z");

function mutation(state, action, payload, operationId = `${action}-${Math.random()}`) {
  return applyControlMutation(state, { action, payload, operation_id: operationId }, { userId: "user-a", now: NOW });
}

test("level calculation is centralized and progressive", () => {
  assert.equal(getLevelFromXp(0), 1);
  assert.equal(getLevelFromXp(1840), 7);
  const progress = getLevelProgress(1840);
  assert.equal(progress.level, 7);
  assert.ok(progress.ceiling > 1840);
  assert.ok(progress.percent > 0 && progress.percent < 100);
});

test("quest completion awards XP once and keeps a completion record", () => {
  let state = createEmptyControlState("user-a", { now: NOW });
  ({ state } = mutation(state, "quest.create", { title: "Publicar", recurrence_type: "daily", xp_reward: 50 }, "create"));
  const quest = state.quests[0];
  const first = mutation(state, "quest.complete", { id: quest.id }, "complete-once");
  const second = mutation(first.state, "quest.complete", { id: quest.id }, "complete-once");
  assert.equal(first.state.user_game_stats.total_xp, 50);
  assert.equal(first.state.quest_completions.length, 1);
  assert.equal(second.state.user_game_stats.total_xp, 50);
  assert.equal(second.idempotent, true);
});

test("recurrent quest gets distinct daily period keys", () => {
  const quest = { id: "q", recurrence_type: "daily" };
  assert.notEqual(questPeriodKey(quest, NOW), questPeriodKey(quest, new Date("2026-08-19T10:00:00Z")));
});

test("undo completion reverts exactly the awarded XP", () => {
  const demo = createDemoControlState("user-a", { now: NOW });
  const quest = demo.quests.find((item) => item.id === "quest_scene");
  const complete = mutation(demo, "quest.complete", { id: quest.id }, "complete");
  const undo = mutation(complete.state, "quest.undo", { id: quest.id }, "undo");
  assert.equal(undo.state.user_game_stats.total_xp, demo.user_game_stats.total_xp);
  assert.equal(undo.state.quest_completions.some((item) => item.quest_id === quest.id), false);
});

test("active project limit requires a deliberate override", () => {
  let state = createEmptyControlState("user-a", { now: NOW });
  for (const title of ["A", "B", "C"]) ({ state } = mutation(state, "project.create", { title, status: "ACTIVE" }, title));
  assert.throws(() => mutation(state, "project.create", { title: "D", status: "ACTIVE" }, "D"), /active_project_limit/);
  const forced = mutation(state, "project.create", { title: "D", status: "ACTIVE", force: true }, "D-force");
  assert.equal(forced.state.projects.filter((item) => item.status === "ACTIVE").length, 4);
});

test("idea cooldown lasts 72 hours and blocks accidental conversion", () => {
  let state = createEmptyControlState("user-a", { now: NOW });
  ({ state } = mutation(state, "idea.create", { title: "Nueva oportunidad" }, "idea"));
  const idea = state.ideas[0];
  assert.equal(new Date(idea.cooldown_until).getTime() - NOW.getTime(), 72 * 60 * 60 * 1000);
  assert.throws(() => mutation(state, "idea.convert", { id: idea.id }, "convert"), /idea_cooldown_active/);
});

test("normalization always scopes every entity to the authenticated user", () => {
  const demo = createDemoControlState("other-user", { now: NOW });
  const result = applyControlMutation(demo, { action: "stats.update", payload: { max_active_projects: 4 } }, { userId: "authenticated-user", now: NOW });
  assert.equal(result.state.user_id, "authenticated-user");
  assert.ok(result.state.projects.every((item) => item.user_id === "authenticated-user"));
  assert.ok(result.state.quests.every((item) => item.user_id === "authenticated-user"));
});
