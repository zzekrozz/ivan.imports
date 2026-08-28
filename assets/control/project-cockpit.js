import { getProjectUnscheduledMissions, questCompletedForPeriod, questIsOverdue } from "./mission-schedule.js";

const CLOSED_PROJECTS = new Set(["COMPLETED", "ARCHIVED"]);
const CLOSED_QUESTS = new Set(["ARCHIVED", "CANCELLED"]);

export function buildProjectIndex(state) {
  const byId = new Map((state.projects || []).map((project) => [project.id, project]));
  const questsByProject = new Map();
  for (const quest of state.quests || []) {
    if (!questsByProject.has(quest.project_id || null)) questsByProject.set(quest.project_id || null, []);
    questsByProject.get(quest.project_id || null).push(quest);
  }
  const group = (items = []) => {
    const index = new Map();
    for (const item of items) {
      if (!index.has(item.project_id)) index.set(item.project_id, []);
      index.get(item.project_id).push(item);
    }
    return index;
  };
  return {
    byId,
    questsByProject,
    logsByProject: group(state.project_logs),
    achievementsByProject: group(state.project_achievements),
    decisionsByProject: group(state.project_decisions),
    blockersByProject: group(state.project_blockers),
    metricsByProject: group(state.project_metrics),
  };
}

export function getProjectQuestStats(state, projectOrId, now = Date.now(), index = buildProjectIndex(state)) {
  const projectId = typeof projectOrId === "string" ? projectOrId : projectOrId?.id;
  const quests = (index.questsByProject.get(projectId) || []).filter((quest) => !CLOSED_QUESTS.has(quest.status));
  const isCompleted = (quest) => quest.status === "COMPLETED" || questCompletedForPeriod(state, quest, now);
  const completed = quests.filter(isCompleted);
  const pending = quests.filter((quest) => !isCompleted(quest));
  const overdue = pending.filter((quest) => questIsOverdue(state, quest, now));
  return {
    total: quests.length,
    active: pending.filter((quest) => quest.status === "ACTIVE").length,
    in_progress: pending.filter((quest) => quest.status === "IN_PROGRESS").length,
    completed: completed.length,
    pending: pending.length,
    overdue: overdue.length,
    high_overdue: overdue.filter((quest) => quest.priority === "HIGH").length,
    scheduled: quests.filter((quest) => quest.scheduled_date || quest.due_date).length,
    unscheduled: getProjectUnscheduledMissions(state, projectId, { includeCompleted: true }).filter((quest) => !isCompleted(quest)).length,
  };
}

export function getProjectOpenDecisions(state, projectId, index = buildProjectIndex(state)) {
  return (index.decisionsByProject.get(projectId) || []).filter((item) => item.status !== "RESOLVED");
}

export function getProjectOpenBlockers(state, projectId, index = buildProjectIndex(state)) {
  return (index.blockersByProject.get(projectId) || []).filter((item) => item.status !== "RESOLVED");
}

export function getProjectRecentActivity(state, projectId, index = buildProjectIndex(state)) {
  return (index.logsByProject.get(projectId) || []).slice().sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export function getProjectSummary(state, projectOrId, now = Date.now(), index = buildProjectIndex(state)) {
  const project = typeof projectOrId === "string" ? index.byId.get(projectOrId) : projectOrId;
  if (!project) return null;
  return {
    project,
    quests: getProjectQuestStats(state, project.id, now, index),
    open_decisions: getProjectOpenDecisions(state, project.id, index),
    open_blockers: getProjectOpenBlockers(state, project.id, index),
    logs: getProjectRecentActivity(state, project.id, index),
    achievements: (index.achievementsByProject.get(project.id) || []).slice().sort((left, right) => String(right.achieved_at || right.created_at).localeCompare(String(left.achieved_at || left.created_at))),
    decisions: (index.decisionsByProject.get(project.id) || []).slice().sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))),
    blockers: (index.blockersByProject.get(project.id) || []).slice().sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))),
    metrics: (index.metricsByProject.get(project.id) || []).slice().sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0) || String(left.created_at).localeCompare(String(right.created_at))),
  };
}

export function getAttentionItems(state, now = Date.now()) {
  const index = buildProjectIndex(state);
  const items = [];
  for (const project of state.projects || []) {
    if (CLOSED_PROJECTS.has(project.status)) continue;
    const stats = getProjectQuestStats(state, project.id, now, index);
    const blockers = getProjectOpenBlockers(state, project.id, index);
    const decisions = getProjectOpenDecisions(state, project.id, index);
    if (project.health === "RED") items.push({ type: "project_health", severity: "HIGH", project_id: project.id, message: "Salud roja: necesita intervención." });
    if (blockers.length) items.push({ type: "open_blockers", severity: blockers.length > 1 ? "HIGH" : "NORMAL", project_id: project.id, count: blockers.length, message: `${blockers.length} ${blockers.length === 1 ? "bloqueo abierto" : "bloqueos abiertos"}.` });
    if (stats.high_overdue) items.push({ type: "overdue_high_quests", severity: "HIGH", project_id: project.id, count: stats.high_overdue, message: `${stats.high_overdue} ${stats.high_overdue === 1 ? "misión importante vencida" : "misiones importantes vencidas"}.` });
    if (decisions.length) items.push({ type: "open_decisions", severity: "NORMAL", project_id: project.id, count: decisions.length, message: `${decisions.length} ${decisions.length === 1 ? "decisión pendiente" : "decisiones pendientes"}.` });
  }
  const severity = { HIGH: 0, NORMAL: 1, LOW: 2 };
  return items.sort((left, right) => severity[left.severity] - severity[right.severity] || left.project_id.localeCompare(right.project_id));
}
