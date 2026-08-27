const CLOSED_STATUSES = new Set(["ARCHIVED", "CANCELLED"]);

function questId(value) {
  return typeof value === "string" ? value : value?.id;
}

function visible(quest, includeArchived) {
  return Boolean(quest && (includeArchived || (!CLOSED_STATUSES.has(quest.status) && !quest.deleted_at)));
}

export function buildQuestTreeIndex(quests = []) {
  const byId = new Map();
  const childrenByParent = new Map();
  for (const quest of quests) if (quest?.id) byId.set(quest.id, quest);
  for (const quest of quests) {
    if (!quest?.id) continue;
    const parentId = quest.parent_id || null;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(quest);
  }
  return { byId, childrenByParent };
}

export function getQuestParent(index, questOrId) {
  const quest = index.byId.get(questId(questOrId));
  return quest?.parent_id ? index.byId.get(quest.parent_id) || null : null;
}

export function getQuestChildren(index, questOrId = null, { includeArchived = false } = {}) {
  const id = questOrId === null ? null : questId(questOrId);
  return (index.childrenByParent.get(id) || []).filter((quest) => visible(quest, includeArchived));
}

export function getQuestAncestors(index, questOrId, { includeSelf = false } = {}) {
  const start = index.byId.get(questId(questOrId));
  if (!start) return [];
  const ancestors = [];
  const visited = new Set([start.id]);
  let cursor = includeSelf ? start : getQuestParent(index, start);
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    ancestors.push(cursor);
    cursor = getQuestParent(index, cursor);
  }
  return ancestors.reverse();
}

export function getQuestPath(index, questOrId) {
  const quest = index.byId.get(questId(questOrId));
  return quest ? [...getQuestAncestors(index, quest), quest] : [];
}

export function getQuestDescendants(index, questOrId, { includeArchived = false } = {}) {
  const rootId = questId(questOrId);
  if (!index.byId.has(rootId)) return [];
  const descendants = [];
  const visited = new Set([rootId]);
  const queue = [...getQuestChildren(index, rootId, { includeArchived })];
  while (queue.length) {
    const quest = queue.shift();
    if (!quest || visited.has(quest.id)) continue;
    visited.add(quest.id);
    descendants.push(quest);
    queue.push(...getQuestChildren(index, quest.id, { includeArchived }));
  }
  return descendants;
}

function progressFor(quests, isComplete = (quest) => quest.status === "COMPLETED") {
  const total = quests.length;
  const completed = quests.filter((quest) => isComplete(quest)).length;
  return {
    total,
    completed,
    pending: Math.max(0, total - completed),
    percent: total ? Math.round((completed / total) * 100) : 0,
    ready_to_complete: total > 0 && completed === total,
  };
}

export function getDirectQuestProgress(index, questOrId, isComplete) {
  return progressFor(getQuestChildren(index, questOrId), isComplete);
}

export function getRecursiveQuestProgress(index, questOrId, isComplete) {
  return progressFor(getQuestDescendants(index, questOrId), isComplete);
}

export function canMoveQuest(index, questOrId, nextParentId) {
  const id = questId(questOrId);
  if (!index.byId.has(id)) return { allowed: false, reason: "quest_not_found" };
  if (!nextParentId) return { allowed: true, reason: null };
  if (id === nextParentId) return { allowed: false, reason: "quest_cycle" };
  const parent = index.byId.get(nextParentId);
  if (!parent || !visible(parent, false)) return { allowed: false, reason: "parent_not_found" };
  const descendants = new Set(getQuestDescendants(index, id, { includeArchived: true }).map((quest) => quest.id));
  return descendants.has(nextParentId) ? { allowed: false, reason: "quest_cycle" } : { allowed: true, reason: null };
}

export function sortSiblingQuests(quests, { isOverdue = () => false } = {}) {
  const rank = { HIGH: 0, NORMAL: 1, LOW: 2 };
  return quests.slice().sort((left, right) => {
    const priority = (rank[left.priority] ?? 1) - (rank[right.priority] ?? 1);
    if (priority) return priority;
    const overdue = Number(isOverdue(right)) - Number(isOverdue(left));
    if (overdue) return overdue;
    const leftDate = left.due_at || (left.scheduled_date ? `${left.scheduled_date}T${left.scheduled_time || "23:59"}` : "9999");
    const rightDate = right.due_at || (right.scheduled_date ? `${right.scheduled_date}T${right.scheduled_time || "23:59"}` : "9999");
    const scheduled = String(leftDate).localeCompare(String(rightDate));
    if (scheduled) return scheduled;
    const manual = Number(left.sort_order || 0) - Number(right.sort_order || 0);
    if (manual) return manual;
    return String(left.created_at || "").localeCompare(String(right.created_at || ""));
  });
}

export function repairQuestHierarchy(quests = []) {
  const index = buildQuestTreeIndex(quests);
  for (const quest of quests) {
    if (!quest.parent_id || quest.parent_id === quest.id || !index.byId.has(quest.parent_id)) quest.parent_id = null;
  }
  const repaired = buildQuestTreeIndex(quests);
  for (const quest of quests) {
    const visited = new Set([quest.id]);
    let cursor = getQuestParent(repaired, quest);
    while (cursor) {
      if (visited.has(cursor.id)) { quest.parent_id = null; break; }
      visited.add(cursor.id);
      cursor = getQuestParent(repaired, cursor);
    }
  }
  return quests;
}
