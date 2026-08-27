import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTROL_SCHEMA_VERSION,
  applyControlMutation,
  buildQuestTreeIndex,
  buildReminderCandidates,
  canMoveQuest,
  createEmptyControlState,
  getDirectQuestProgress,
  getQuestAncestors,
  getQuestDescendants,
  getQuestPath,
  getRecursiveQuestProgress,
  getTodaySummary,
  normalizeControlState,
} from "../assets/control/domain.js";

const NOW = Date.parse("2026-08-27T10:00:00.000Z");
const USER = "tree-owner";

function apply(state, action, payload, suffix = Math.random()) {
  return applyControlMutation(state, { action, payload, operation_id: `${action}:${suffix}` }, { userId: USER, now: NOW });
}

function create(state, title, parentId = null, extra = {}) {
  const result = apply(state, "quest.create", { title, parent_id: parentId, ...extra }, title);
  return { state: result.state, quest: result.result };
}

test("schema V3 lazily migrates flat V2 quests to roots without losing data", () => {
  const legacy = createEmptyControlState(USER, { now: NOW });
  legacy.version = 2;
  legacy.quests = [{ id: "legacy", user_id: USER, title: "Legacy", status: "ACTIVE", priority: "HIGH", recurrence_type: "once", created_at: new Date(NOW).toISOString() }];
  const migrated = normalizeControlState(legacy, USER, { now: NOW });
  assert.equal(CONTROL_SCHEMA_VERSION, 3);
  assert.equal(migrated.version, 3);
  assert.equal(migrated.quests[0].parent_id, null);
  assert.equal(migrated.quests[0].title, "Legacy");
  assert.deepEqual(migrated.progress_logs, []);
});

test("ancestors, descendants and path support arbitrary-depth branches", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  const branch = [];
  let parentId = null;
  for (let depth = 0; depth < 12; depth += 1) {
    const created = create(state, `Nivel ${depth + 1}`, parentId);
    state = created.state;
    branch.push(created.quest);
    parentId = created.quest.id;
  }
  const index = buildQuestTreeIndex(state.quests);
  assert.deepEqual(getQuestAncestors(index, branch.at(-1)).map((quest) => quest.title), branch.slice(0, -1).map((quest) => quest.title));
  assert.deepEqual(getQuestDescendants(index, branch[0]).map((quest) => quest.title), branch.slice(1).map((quest) => quest.title));
  assert.equal(getQuestPath(index, branch.at(-1)).length, 12);
});

test("direct and recursive progress are centralized and ready_to_complete does not close the parent", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  let result = create(state, "A"); state = result.state; const parent = result.quest;
  result = create(state, "B", parent.id); state = result.state; const childB = result.quest;
  result = create(state, "C", parent.id); state = result.state; const childC = result.quest;
  result = create(state, "D", parent.id); state = result.state; const childD = result.quest;
  state = apply(state, "quest.complete", { id: childB.id }, "complete-b").state;
  state = apply(state, "quest.complete", { id: childD.id }, "complete-d").state;
  let index = buildQuestTreeIndex(state.quests);
  const isComplete = (quest) => quest.status === "COMPLETED";
  assert.deepEqual(getDirectQuestProgress(index, parent.id, isComplete), { total: 3, completed: 2, pending: 1, percent: 67, ready_to_complete: false });
  state = apply(state, "quest.complete", { id: childC.id }, "complete-c").state;
  index = buildQuestTreeIndex(state.quests);
  assert.equal(getRecursiveQuestProgress(index, parent.id, isComplete).ready_to_complete, true);
  assert.equal(state.quests.find((quest) => quest.id === parent.id).status, "ACTIVE");
});

test("moving a quest preserves its data and rejects self or descendant cycles", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  let result = create(state, "A"); state = result.state; const a = result.quest;
  result = create(state, "B", a.id); state = result.state; const b = result.quest;
  result = create(state, "C", a.id, { description: "Conservar", scheduled_date: "2026-08-27", reminders: [60] }); state = result.state; const c = result.quest;
  state = apply(state, "quest.move", { id: c.id, parent_id: b.id }, "move-c").state;
  const moved = state.quests.find((quest) => quest.id === c.id);
  assert.equal(moved.parent_id, b.id);
  assert.equal(moved.description, "Conservar");
  assert.equal(moved.reminders.length, 1);
  const index = buildQuestTreeIndex(state.quests);
  assert.equal(canMoveQuest(index, a.id, c.id).allowed, false);
  assert.throws(() => apply(state, "quest.move", { id: a.id, parent_id: c.id }, "cycle"), /quest_cycle/);
});

test("archiving a branch never leaves active descendants orphaned", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  let result = create(state, "A"); state = result.state; const a = result.quest;
  result = create(state, "B", a.id); state = result.state; const b = result.quest;
  result = create(state, "C", b.id); state = result.state; const c = result.quest;
  assert.throws(() => apply(state, "quest.delete", { id: a.id }, "unsafe"), /quest_has_children/);
  state = apply(state, "quest.delete", { id: a.id, mode: "branch" }, "archive-branch").state;
  assert.ok([a.id, b.id, c.id].every((id) => state.quests.find((quest) => quest.id === id).status === "ARCHIVED"));
});

test("promoting children archives only the selected quest and keeps a valid tree", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  let result = create(state, "A"); state = result.state; const a = result.quest;
  result = create(state, "B", a.id); state = result.state; const b = result.quest;
  result = create(state, "C", b.id); state = result.state; const c = result.quest;
  state = apply(state, "quest.delete", { id: b.id, mode: "promote_children" }, "promote").state;
  assert.equal(state.quests.find((quest) => quest.id === b.id).status, "ARCHIVED");
  assert.equal(state.quests.find((quest) => quest.id === c.id).parent_id, a.id);
});

test("a scheduled child appears once in Today and Main Quest remains deduplicated", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  let result = create(state, "Parent"); state = result.state; const parent = result.quest;
  result = create(state, "Child", parent.id, { scheduled_date: "2026-08-27", is_main_quest: true }); state = result.state; const child = result.quest;
  const summary = getTodaySummary(state, NOW);
  assert.equal(summary.total, 1);
  assert.deepEqual(summary.missions.map((quest) => quest.id), [child.id]);
});

test("child reminders and recurrence remain independent from parent completion", () => {
  let state = createEmptyControlState(USER, { now: NOW });
  let result = create(state, "Parent"); state = result.state; const parent = result.quest;
  result = create(state, "Child", parent.id, { scheduled_date: "2026-08-27", scheduled_time: "13:00", recurrence_type: "daily", reminders: [60] }); state = result.state; const child = result.quest;
  state = apply(state, "quest.complete", { id: parent.id }, "complete-parent").state;
  assert.notEqual(state.quests.find((quest) => quest.id === child.id).status, "COMPLETED");
  assert.equal(buildReminderCandidates(state, NOW).some((candidate) => candidate.quest_id === child.id), true);
});

test("progress logs create, persist, delete and remain owner scoped", () => {
  let state = createEmptyControlState("other", { now: NOW });
  let result = create(state, "Mission"); state = result.state; const quest = result.quest;
  result = apply(state, "progress.create", { quest_id: quest.id, text: "Primer avance" }, "progress"); state = result.state; const entry = result.result;
  assert.equal(state.progress_logs[0].text, "Primer avance");
  assert.equal(state.progress_logs[0].user_id, USER);
  state = apply(state, "progress.delete", { id: entry.id }, "progress-delete").state;
  assert.deepEqual(state.progress_logs, []);
});
