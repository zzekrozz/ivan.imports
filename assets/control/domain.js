import {
  CONTROL_TIME_ZONE,
  DAY_MS,
  dateKey,
  getActionableReminders,
  getTodaySummary,
  monthKey,
  normalizeTimeZone,
  questCompletedForPeriod,
  questIsDueOn,
  questIsOverdue,
  questOccurrence,
  questPeriodKey,
  reminderScheduleAt,
  weekKey,
  weekdayNumber,
  zonedDateTimeToUtc,
  buildReminderCandidates,
} from "./mission-schedule.js";
import {
  buildQuestTreeIndex,
  canMoveQuest,
  getDirectQuestProgress,
  getQuestAncestors,
  getQuestChildren,
  getQuestDescendants,
  getQuestParent,
  getQuestPath,
  getRecursiveQuestProgress,
  repairQuestHierarchy,
  sortSiblingQuests,
} from "./mission-tree.js";
import {
  buildProjectIndex,
  getAttentionItems,
  getProjectOpenBlockers,
  getProjectOpenDecisions,
  getProjectQuestStats,
  getProjectRecentActivity,
  getProjectSummary,
} from "./project-cockpit.js";

export {
  CONTROL_TIME_ZONE,
  buildReminderCandidates,
  dateKey,
  getActionableReminders,
  getTodaySummary,
  monthKey,
  normalizeTimeZone,
  questCompletedForPeriod,
  questIsDueOn,
  questIsOverdue,
  questOccurrence,
  questPeriodKey,
  reminderScheduleAt,
  weekKey,
  weekdayNumber,
  zonedDateTimeToUtc,
  buildQuestTreeIndex,
  canMoveQuest,
  getDirectQuestProgress,
  getQuestAncestors,
  getQuestChildren,
  getQuestDescendants,
  getQuestParent,
  getQuestPath,
  getRecursiveQuestProgress,
  sortSiblingQuests,
  buildProjectIndex,
  getAttentionItems,
  getProjectOpenBlockers,
  getProjectOpenDecisions,
  getProjectQuestStats,
  getProjectRecentActivity,
  getProjectSummary,
};

export const CONTROL_SCHEMA_VERSION = 4;
export const PROJECT_STATUSES = Object.freeze(["ACTIVE", "PAUSED", "IDEA", "COMPLETED", "ARCHIVED"]);
export const QUEST_CATEGORIES = Object.freeze(["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"]);
export const QUEST_PRIORITIES = Object.freeze(["LOW", "NORMAL", "HIGH"]);
export const RECURRENCE_TYPES = Object.freeze(["once", "daily", "weekly", "monthly", "interval"]);
export const IDEA_STATUSES = Object.freeze(["VAULT", "CANDIDATE", "CONVERTED", "DISCARDED"]);
export const GOAL_PERIODS = Object.freeze(["DAILY", "WEEKLY", "MONTHLY"]);
export const PROJECT_HEALTH = Object.freeze(["GREEN", "YELLOW", "RED"]);

function randomId(prefix = "item") {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, finite(value)));
}

function cleanText(value, maximum = 500) {
  return String(value ?? "").trim().slice(0, maximum);
}

function iso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export function xpRequiredForLevel(level) {
  const safeLevel = Math.max(1, Math.floor(finite(level, 1)));
  let total = 0;
  for (let current = 1; current < safeLevel; current += 1) total += 200 + ((current - 1) * 25);
  return total;
}

export function getLevelFromXp(totalXp) {
  const xp = Math.max(0, Math.floor(finite(totalXp)));
  let level = 1;
  while (level < 500 && xp >= xpRequiredForLevel(level + 1)) level += 1;
  return level;
}

export function getLevelProgress(totalXp) {
  const total = Math.max(0, Math.floor(finite(totalXp)));
  const level = getLevelFromXp(total);
  const floor = xpRequiredForLevel(level);
  const ceiling = xpRequiredForLevel(level + 1);
  const earned = total - floor;
  const required = Math.max(1, ceiling - floor);
  return { level, totalXp: total, floor, ceiling, earned, required, percent: clamp((earned / required) * 100, 0, 100) };
}

export function createEmptyControlState(userId, { now = Date.now() } = {}) {
  const timestamp = iso(now);
  return {
    version: CONTROL_SCHEMA_VERSION,
    user_id: cleanText(userId, 128),
    projects: [],
    quests: [],
    quest_completions: [],
    progress_logs: [],
    project_logs: [],
    project_achievements: [],
    project_decisions: [],
    project_blockers: [],
    project_metrics: [],
    reminder_deliveries: [],
    goals: [],
    ideas: [],
    preferences: {
      timezone: CONTROL_TIME_ZONE,
      default_reminder_preset: "normal",
      reminder_presets: {
        normal: [60],
        important: [1440, 120, 15],
      },
      notifications_enabled: false,
      notification_prompt_dismissed: false,
      push_subscriptions: [],
    },
    user_game_stats: {
      user_id: cleanText(userId, 128),
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
      max_active_projects: 3,
      created_at: timestamp,
      updated_at: timestamp,
    },
    activity_log: [],
    operation_ids: [],
  };
}

export function normalizeControlState(value, userId, { now = Date.now() } = {}) {
  const empty = createEmptyControlState(userId, { now });
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const state = {
    ...empty,
    ...value,
    version: CONTROL_SCHEMA_VERSION,
    user_id: cleanText(userId, 128),
    projects: Array.isArray(value.projects) ? value.projects : [],
    quests: Array.isArray(value.quests) ? value.quests : [],
    quest_completions: Array.isArray(value.quest_completions) ? value.quest_completions : [],
    progress_logs: Array.isArray(value.progress_logs) ? value.progress_logs.slice(-1000) : [],
    project_logs: Array.isArray(value.project_logs) ? value.project_logs.slice(-1000) : [],
    project_achievements: Array.isArray(value.project_achievements) ? value.project_achievements.slice(-1000) : [],
    project_decisions: Array.isArray(value.project_decisions) ? value.project_decisions.slice(-1000) : [],
    project_blockers: Array.isArray(value.project_blockers) ? value.project_blockers.slice(-1000) : [],
    project_metrics: Array.isArray(value.project_metrics) ? value.project_metrics.slice(-500) : [],
    reminder_deliveries: Array.isArray(value.reminder_deliveries) ? value.reminder_deliveries.slice(-500) : [],
    goals: Array.isArray(value.goals) ? value.goals : [],
    ideas: Array.isArray(value.ideas) ? value.ideas : [],
    activity_log: Array.isArray(value.activity_log) ? value.activity_log.slice(0, 200) : [],
    operation_ids: Array.isArray(value.operation_ids) ? value.operation_ids.slice(-100) : [],
    user_game_stats: { ...empty.user_game_stats, ...(value.user_game_stats || {}), user_id: cleanText(userId, 128) },
    preferences: {
      ...empty.preferences,
      ...(value.preferences || {}),
      timezone: normalizeTimeZone(value.preferences?.timezone || CONTROL_TIME_ZONE),
      reminder_presets: {
        ...empty.preferences.reminder_presets,
        ...(value.preferences?.reminder_presets || {}),
      },
      push_subscriptions: Array.isArray(value.preferences?.push_subscriptions) ? value.preferences.push_subscriptions.slice(-8) : [],
    },
  };
  state.projects = state.projects.map((project) => projectInput(state, project, now, project));
  state.quests = repairQuestHierarchy(state.quests.map((quest) => questInput(state, quest, now, quest)));
  for (const collection of [state.projects, state.quests, state.quest_completions, state.progress_logs, state.project_logs, state.project_achievements, state.project_decisions, state.project_blockers, state.project_metrics, state.reminder_deliveries, state.goals, state.ideas, state.activity_log]) {
    for (const item of collection) item.user_id = state.user_id;
  }
  return state;
}

export function goalProgress(goal) {
  const target = Math.max(0, finite(goal?.target_value));
  const current = Math.max(0, finite(goal?.current_value));
  return target > 0 ? clamp((current / target) * 100, 0, 100) : 0;
}

export function projectProgress(state, project) {
  const goals = state.goals.filter((goal) => goal.project_id === project.id && !goal.archived_at);
  if (project.progress_method === "calculated" && goals.length) {
    return Math.round(goals.reduce((sum, goal) => sum + goalProgress(goal), 0) / goals.length);
  }
  return Math.round(clamp(project.progress, 0, 100));
}

function entityBase(state, prefix, now) {
  const timestamp = iso(now);
  return { id: randomId(prefix), user_id: state.user_id, created_at: timestamp, updated_at: timestamp };
}

function addActivity(state, type, title, now, details = {}) {
  state.activity_log.unshift({ ...entityBase(state, "activity", now), type, title: cleanText(title, 180), ...details });
  state.activity_log = state.activity_log.slice(0, 200);
}

function refreshStreak(state, now) {
  const days = [...new Set(state.quest_completions.map((item) => dateKey(item.completed_at)))].sort().reverse();
  const today = dateKey(now);
  const yesterday = dateKey(new Date(new Date(`${today}T12:00:00Z`).getTime() - DAY_MS), "UTC");
  if (!days.includes(today) && !days.includes(yesterday)) {
    state.user_game_stats.current_streak = 0;
    state.user_game_stats.last_active_date = days[0] || null;
    return;
  }
  let cursor = days.includes(today) ? today : yesterday;
  let streak = 0;
  while (days.includes(cursor)) {
    streak += 1;
    cursor = dateKey(new Date(new Date(`${cursor}T12:00:00Z`).getTime() - DAY_MS), "UTC");
  }
  state.user_game_stats.current_streak = streak;
  state.user_game_stats.longest_streak = Math.max(finite(state.user_game_stats.longest_streak), streak);
  state.user_game_stats.last_active_date = days[0] || null;
}

function mutationError(code, details = {}) {
  return Object.assign(new Error(code), { code, status: 400, details });
}

function requireItem(collection, id, label) {
  const item = collection.find((entry) => entry.id === id);
  if (!item) throw mutationError(`${label}_not_found`);
  return item;
}

function projectInput(state, payload, now, existing = null) {
  const status = PROJECT_STATUSES.includes(payload.status) ? payload.status : existing?.status || "PAUSED";
  return {
    ...(existing || entityBase(state, "project", now)),
    title: cleanText(payload.title ?? existing?.title, 120),
    slug: cleanText(payload.slug ?? existing?.slug ?? payload.title, 120).toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: cleanText(payload.description ?? existing?.description, 1200),
    status,
    priority: QUEST_PRIORITIES.includes(payload.priority) ? payload.priority : existing?.priority || "NORMAL",
    icon: cleanText(payload.icon ?? existing?.icon ?? "◆", 8),
    accent: /^#[0-9a-f]{6}$/i.test(payload.accent) ? payload.accent : existing?.accent || "#8fa68e",
    progress: clamp(payload.progress ?? existing?.progress, 0, 100),
    progress_method: payload.progress_method === "calculated" ? "calculated" : existing?.progress_method || "manual",
    main_goal: cleanText(payload.main_goal ?? existing?.main_goal, 240),
    general_objective: cleanText(payload.general_objective ?? existing?.general_objective ?? existing?.main_goal, 800),
    weekly_objective: cleanText(payload.weekly_objective ?? existing?.weekly_objective, 800),
    current_focus: cleanText(payload.current_focus ?? existing?.current_focus, 500),
    health: PROJECT_HEALTH.includes(payload.health) ? payload.health : PROJECT_HEALTH.includes(existing?.health) ? existing.health : "GREEN",
    next_milestone: cleanText(payload.next_milestone ?? existing?.next_milestone, 500),
    next_milestone_date: payload.next_milestone_date === null || payload.next_milestone_date === "" ? null : cleanDate(payload.next_milestone_date ?? existing?.next_milestone_date),
    notes: cleanText(payload.notes ?? existing?.notes, 5000),
    links: Array.isArray(payload.links) ? payload.links.slice(0, 20).map((link) => ({ label: cleanText(link.label, 80), url: cleanText(link.url, 500) })) : existing?.links || [],
    completed_at: status === "COMPLETED" ? existing?.completed_at || iso(now) : null,
    updated_at: iso(now),
  };
}

function cleanDate(value) {
  const text = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanTime(value) {
  const text = cleanText(value, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : null;
}

function recurrenceConfig(value, recurrence, scheduledDate) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const days = Array.isArray(input.days) ? [...new Set(input.days.map(Number).filter((day) => day >= 1 && day <= 7))].sort() : [];
  const interval = Math.min(365, Math.max(1, Math.round(finite(input.interval, 1))));
  const unit = ["days", "weeks", "months"].includes(input.unit) ? input.unit : "days";
  const day = Math.min(31, Math.max(1, Math.round(finite(input.day, Number(String(scheduledDate || "01").slice(-2)) || 1))));
  if (recurrence === "weekly") return { days };
  if (recurrence === "monthly") return { day };
  if (recurrence === "interval") return { interval, unit };
  return {};
}

function reminderDefinitions(state, value, now, existing = []) {
  if (!Array.isArray(value)) return Array.isArray(existing) ? existing : [];
  const seen = new Set();
  return value.slice(0, 8).map((entry, index) => {
    const input = typeof entry === "number" ? { offset_minutes: entry } : entry && typeof entry === "object" ? entry : {};
    const offset = Math.min(60 * 24 * 30, Math.max(0, Math.round(finite(input.offset_minutes))));
    const signature = String(offset);
    if (seen.has(signature)) return null;
    seen.add(signature);
    return {
      id: cleanText(input.id, 128) || randomId(`reminder${index + 1}`),
      user_id: state.user_id,
      offset_minutes: offset,
      enabled: input.enabled !== false,
      created_at: input.created_at ? iso(input.created_at) : iso(now),
      updated_at: iso(now),
    };
  }).filter(Boolean).sort((left, right) => right.offset_minutes - left.offset_minutes);
}

function questInput(state, payload, now, existing = null) {
  const recurrence = RECURRENCE_TYPES.includes(payload.recurrence_type) ? payload.recurrence_type : existing?.recurrence_type || "once";
  const timezone = normalizeTimeZone(payload.timezone ?? existing?.timezone ?? state.preferences?.timezone ?? CONTROL_TIME_ZONE);
  const legacyDate = existing?.due_date ? dateKey(existing.due_date, timezone) : null;
  const scheduledDate = payload.scheduled_date === null || payload.scheduled_date === "" ? null : cleanDate(payload.scheduled_date ?? existing?.scheduled_date ?? legacyDate);
  const scheduledTime = payload.scheduled_time === null || payload.scheduled_time === "" ? null : cleanTime(payload.scheduled_time ?? existing?.scheduled_time);
  const dueAt = scheduledDate && scheduledTime ? zonedDateTimeToUtc(scheduledDate, scheduledTime, timezone) : null;
  const statusInput = cleanText(payload.status ?? existing?.status ?? "ACTIVE", 24).toUpperCase();
  const status = ["ACTIVE", "IN_PROGRESS", "COMPLETED", "ARCHIVED", "CANCELLED"].includes(statusInput) ? statusInput : "ACTIVE";
  const legacyPriority = existing?.priority === "CRITICAL" ? "HIGH" : existing?.priority;
  return {
    ...(existing || entityBase(state, "quest", now)),
    parent_id: payload.parent_id === null || payload.parent_id === "" ? null : cleanText(payload.parent_id ?? existing?.parent_id, 128) || null,
    sort_order: Math.round(clamp(payload.sort_order ?? existing?.sort_order, -1_000_000_000, 1_000_000_000)),
    project_id: payload.project_id === null ? null : cleanText(payload.project_id ?? existing?.project_id, 128) || null,
    title: cleanText(payload.title ?? existing?.title, 180),
    description: cleanText(payload.description ?? existing?.description, 1200),
    category: QUEST_CATEGORIES.includes(payload.category) ? payload.category : existing?.category || "BUILD",
    priority: QUEST_PRIORITIES.includes(payload.priority) ? payload.priority : QUEST_PRIORITIES.includes(legacyPriority) ? legacyPriority : "NORMAL",
    status,
    xp_reward: Math.round(clamp(payload.xp_reward ?? existing?.xp_reward ?? 30, 0, 5000)),
    recurrence_type: recurrence,
    recurrence_config: recurrenceConfig(payload.recurrence_config ?? existing?.recurrence_config, recurrence, scheduledDate),
    recurrence_end_date: payload.recurrence_end_date === null || payload.recurrence_end_date === "" ? null : cleanDate(payload.recurrence_end_date ?? existing?.recurrence_end_date),
    scheduled_date: scheduledDate,
    scheduled_time: scheduledTime,
    timezone,
    due_at: dueAt,
    due_date: scheduledDate ? dueAt || `${scheduledDate}T12:00:00.000Z` : null,
    reminders: reminderDefinitions(state, payload.reminders, now, existing?.reminders),
    is_main_quest: Boolean(payload.is_main_quest ?? existing?.is_main_quest),
    estimated_minutes: Math.round(clamp(payload.estimated_minutes ?? existing?.estimated_minutes, 0, 1440)) || null,
    money_impact: ["none", "low", "medium", "high", "direct"].includes(payload.money_impact) ? payload.money_impact : existing?.money_impact || "none",
    impact: Math.round(clamp(payload.impact ?? existing?.impact, 0, 10)) || null,
    source: ["control", "quick-add", "mobile"].includes(payload.source) ? payload.source : existing?.source || "control",
    completed_at: status === "COMPLETED" ? existing?.completed_at || iso(now) : null,
    updated_at: iso(now),
  };
}

function goalInput(state, payload, now, existing = null) {
  return {
    ...(existing || entityBase(state, "goal", now)),
    project_id: payload.project_id === null ? null : cleanText(payload.project_id ?? existing?.project_id, 128) || null,
    parent_goal_id: payload.parent_goal_id === null ? null : cleanText(payload.parent_goal_id ?? existing?.parent_goal_id, 128) || null,
    title: cleanText(payload.title ?? existing?.title, 180),
    period: GOAL_PERIODS.includes(payload.period) ? payload.period : existing?.period || "MONTHLY",
    metric_type: cleanText(payload.metric_type ?? existing?.metric_type ?? "number", 40),
    unit: ["count", "€", "%", "boolean"].includes(payload.unit) ? payload.unit : existing?.unit || "count",
    current_value: Math.max(0, finite(payload.current_value ?? existing?.current_value)),
    target_value: Math.max(0, finite(payload.target_value ?? existing?.target_value, 1)),
    xp_reward: Math.round(clamp(payload.xp_reward ?? existing?.xp_reward ?? 100, 0, 5000)),
    is_boss: Boolean(payload.is_boss ?? existing?.is_boss),
    start_date: payload.start_date ? iso(payload.start_date) : existing?.start_date || iso(now),
    end_date: payload.end_date ? iso(payload.end_date) : existing?.end_date || null,
    updated_at: iso(now),
  };
}

function awardGoalTransition(state, goal, wasComplete, now) {
  const complete = goal.target_value > 0 && goal.current_value >= goal.target_value;
  if (complete && !wasComplete && !goal.completed_at) {
    goal.completed_at = iso(now);
    goal.xp_awarded = goal.xp_reward;
    state.user_game_stats.total_xp += goal.xp_reward;
    addActivity(state, "goal_completed", goal.title, now, { goal_id: goal.id, xp_delta: goal.xp_reward });
  } else if (!complete && (wasComplete || goal.completed_at)) {
    state.user_game_stats.total_xp = Math.max(0, state.user_game_stats.total_xp - finite(goal.xp_awarded));
    goal.completed_at = null;
    goal.xp_awarded = 0;
  }
}

function cancelQuestDeliveries(state, questId, now, { occurrenceKey = null, reason = "quest_changed" } = {}) {
  for (const delivery of state.reminder_deliveries) {
    if (delivery.quest_id !== questId || (occurrenceKey && delivery.occurrence_key !== occurrenceKey)) continue;
    if (["CANCELLED", "DISMISSED"].includes(delivery.status)) continue;
    delivery.status = "CANCELLED";
    delivery.cancelled_at = iso(now);
    delivery.cancel_reason = reason;
    delivery.updated_at = iso(now);
  }
}

function normalizePushSubscription(state, payload, now) {
  const endpoint = cleanText(payload?.endpoint, 2000);
  const p256dh = cleanText(payload?.keys?.p256dh, 500);
  const auth = cleanText(payload?.keys?.auth, 500);
  if (!/^https:\/\//i.test(endpoint) || !p256dh || !auth) throw mutationError("invalid_push_subscription");
  return {
    id: cleanText(payload.id, 128) || randomId("push"),
    user_id: state.user_id,
    endpoint,
    expirationTime: Number.isFinite(Number(payload.expirationTime)) ? Number(payload.expirationTime) : null,
    keys: { p256dh, auth },
    user_agent: cleanText(payload.user_agent, 240),
    created_at: payload.created_at ? iso(payload.created_at) : iso(now),
    updated_at: iso(now),
  };
}

function nextQuestSortOrder(state, parentId) {
  const siblings = state.quests.filter((quest) => (quest.parent_id || null) === (parentId || null));
  return siblings.reduce((maximum, quest) => Math.max(maximum, finite(quest.sort_order)), 0) + 1000;
}

function archiveQuestEntity(state, quest, now, reason) {
  quest.status = "ARCHIVED";
  quest.deleted_at = iso(now);
  quest.is_main_quest = false;
  quest.updated_at = iso(now);
  cancelQuestDeliveries(state, quest.id, now, { reason });
}

function requireProject(state, projectId) {
  return requireItem(state.projects, cleanText(projectId, 128), "project");
}

function projectTextEntity(state, payload, now, prefix, maximum = 3000) {
  const project = requireProject(state, payload.project_id);
  const item = { ...entityBase(state, prefix, now), project_id: project.id, text: cleanText(payload.text, maximum) };
  if (!item.text) throw mutationError(`${prefix}_text_required`);
  return { project, item };
}

export function applyControlMutation(inputState, mutation, { userId, now = Date.now() } = {}) {
  const state = structuredClone(normalizeControlState(inputState, userId, { now }));
  const action = cleanText(mutation?.action, 80);
  const payload = mutation?.payload && typeof mutation.payload === "object" ? mutation.payload : {};
  const operationId = cleanText(mutation?.operation_id, 128);
  if (operationId && state.operation_ids.includes(operationId)) return { state, idempotent: true };
  const previousLevel = getLevelFromXp(state.user_game_stats.total_xp);
  let result = null;

  if (action === "project.create") {
    const project = projectInput(state, payload, now);
    if (!project.title) throw mutationError("project_title_required");
    const activeCount = state.projects.filter((item) => item.status === "ACTIVE").length;
    if (project.status === "ACTIVE" && activeCount >= state.user_game_stats.max_active_projects && !payload.force) {
      throw mutationError("active_project_limit", { active_projects: state.projects.filter((item) => item.status === "ACTIVE") });
    }
    state.projects.push(project);
    addActivity(state, "project_created", project.title, now, { project_id: project.id });
    result = project;
  } else if (action === "project.update") {
    const existing = requireItem(state.projects, payload.id, "project");
    const project = projectInput(state, payload, now, existing);
    const activeCount = state.projects.filter((item) => item.status === "ACTIVE" && item.id !== existing.id).length;
    if (project.status === "ACTIVE" && existing.status !== "ACTIVE" && activeCount >= state.user_game_stats.max_active_projects && !payload.force) {
      throw mutationError("active_project_limit", { active_projects: state.projects.filter((item) => item.status === "ACTIVE") });
    }
    Object.assign(existing, project);
    if (existing.status === "COMPLETED") addActivity(state, "project_completed", existing.title, now, { project_id: existing.id });
    result = existing;
  } else if (action === "project.pause-and-activate") {
    const activate = requireItem(state.projects, payload.activate_id, "project");
    const pause = requireItem(state.projects, payload.pause_id, "project");
    pause.status = "PAUSED";
    pause.updated_at = iso(now);
    activate.status = "ACTIVE";
    activate.updated_at = iso(now);
    addActivity(state, "project_paused", pause.title, now, { project_id: pause.id });
    result = activate;
  } else if (action === "project.log.add") {
    const { project, item } = projectTextEntity(state, payload, now, "project_log");
    state.project_logs.push(item);
    addActivity(state, "project_progress_added", project.title, now, { project_id: project.id, project_log_id: item.id });
    result = item;
  } else if (action === "project.log.delete") {
    const index = state.project_logs.findIndex((item) => item.id === payload.id);
    if (index < 0) throw mutationError("project_log_not_found");
    [result] = state.project_logs.splice(index, 1);
  } else if (action === "project.achievement.add") {
    const { project, item } = projectTextEntity(state, payload, now, "achievement", 1000);
    item.achieved_at = payload.achieved_at ? iso(payload.achieved_at) : iso(now);
    state.project_achievements.push(item);
    addActivity(state, "project_achievement_added", item.text, now, { project_id: project.id, achievement_id: item.id });
    result = item;
  } else if (action === "project.achievement.delete") {
    const index = state.project_achievements.findIndex((item) => item.id === payload.id);
    if (index < 0) throw mutationError("achievement_not_found");
    [result] = state.project_achievements.splice(index, 1);
  } else if (action === "project.decision.add") {
    const { project, item } = projectTextEntity(state, payload, now, "decision", 1200);
    Object.assign(item, { status: "OPEN", resolved_at: null, resolution: "", resolution_notes: "" });
    state.project_decisions.push(item);
    addActivity(state, "project_decision_added", item.text, now, { project_id: project.id, decision_id: item.id });
    result = item;
  } else if (action === "project.decision.resolve") {
    const item = requireItem(state.project_decisions, payload.id, "decision");
    item.status = "RESOLVED";
    item.resolution = cleanText(payload.resolution, 1200);
    item.resolution_notes = cleanText(payload.resolution_notes, 3000);
    item.resolved_at = iso(now);
    item.updated_at = iso(now);
    result = item;
  } else if (action === "project.decision.delete") {
    const index = state.project_decisions.findIndex((item) => item.id === payload.id);
    if (index < 0) throw mutationError("decision_not_found");
    [result] = state.project_decisions.splice(index, 1);
  } else if (action === "project.blocker.add") {
    const { project, item } = projectTextEntity(state, payload, now, "blocker", 1200);
    Object.assign(item, { status: "OPEN", resolved_at: null });
    state.project_blockers.push(item);
    addActivity(state, "project_blocker_added", item.text, now, { project_id: project.id, blocker_id: item.id });
    result = item;
  } else if (action === "project.blocker.resolve") {
    const item = requireItem(state.project_blockers, payload.id, "blocker");
    item.status = "RESOLVED";
    item.resolved_at = iso(now);
    item.updated_at = iso(now);
    result = item;
  } else if (action === "project.blocker.delete") {
    const index = state.project_blockers.findIndex((item) => item.id === payload.id);
    if (index < 0) throw mutationError("blocker_not_found");
    [result] = state.project_blockers.splice(index, 1);
  } else if (action === "project.metric.add") {
    const project = requireProject(state, payload.project_id);
    const siblings = state.project_metrics.filter((item) => item.project_id === project.id);
    const item = {
      ...entityBase(state, "metric", now), project_id: project.id,
      name: cleanText(payload.name, 120), value: cleanText(payload.value, 120), unit: cleanText(payload.unit, 30),
      target: payload.target === null || payload.target === "" || payload.target === undefined ? null : cleanText(payload.target, 120),
      sort_order: payload.sort_order === undefined ? siblings.reduce((maximum, metric) => Math.max(maximum, finite(metric.sort_order)), 0) + 1000 : Math.round(clamp(payload.sort_order, -1_000_000, 1_000_000)),
    };
    if (!item.name) throw mutationError("metric_name_required");
    state.project_metrics.push(item);
    result = item;
  } else if (action === "project.metric.update") {
    const item = requireItem(state.project_metrics, payload.id, "metric");
    if (payload.name !== undefined) item.name = cleanText(payload.name, 120);
    if (payload.value !== undefined) item.value = cleanText(payload.value, 120);
    if (payload.unit !== undefined) item.unit = cleanText(payload.unit, 30);
    if (payload.target !== undefined) item.target = payload.target === null || payload.target === "" ? null : cleanText(payload.target, 120);
    if (payload.sort_order !== undefined) item.sort_order = Math.round(clamp(payload.sort_order, -1_000_000, 1_000_000));
    item.updated_at = iso(now);
    result = item;
  } else if (action === "project.metric.delete") {
    const index = state.project_metrics.findIndex((item) => item.id === payload.id);
    if (index < 0) throw mutationError("metric_not_found");
    [result] = state.project_metrics.splice(index, 1);
  } else if (action === "quest.create") {
    const parent = payload.parent_id ? requireItem(state.quests, payload.parent_id, "parent_quest") : null;
    const input = { ...payload };
    if (parent && payload.project_id === undefined) input.project_id = parent.project_id;
    if (payload.sort_order === undefined) input.sort_order = nextQuestSortOrder(state, parent?.id || null);
    const quest = questInput(state, input, now);
    if (!quest.title) throw mutationError("quest_title_required");
    if (quest.project_id && !state.projects.some((item) => item.id === quest.project_id)) throw mutationError("project_not_found");
    if (quest.is_main_quest) state.quests.forEach((item) => { item.is_main_quest = false; });
    state.quests.push(quest);
    result = quest;
  } else if (action === "quest.update") {
    const existing = requireItem(state.quests, payload.id, "quest");
    if (payload.parent_id !== undefined) {
      const movement = canMoveQuest(buildQuestTreeIndex(state.quests), existing.id, payload.parent_id || null);
      if (!movement.allowed) throw mutationError(movement.reason);
    }
    const previousSchedule = JSON.stringify([existing.scheduled_date, existing.scheduled_time, existing.timezone, existing.reminders, existing.recurrence_type, existing.recurrence_config, existing.recurrence_end_date]);
    const quest = questInput(state, payload, now, existing);
    if (quest.is_main_quest) state.quests.forEach((item) => { if (item.id !== existing.id) item.is_main_quest = false; });
    Object.assign(existing, quest);
    const nextSchedule = JSON.stringify([existing.scheduled_date, existing.scheduled_time, existing.timezone, existing.reminders, existing.recurrence_type, existing.recurrence_config, existing.recurrence_end_date]);
    if (previousSchedule !== nextSchedule) cancelQuestDeliveries(state, existing.id, now);
    result = existing;
  } else if (action === "quest.move") {
    const quest = requireItem(state.quests, payload.id, "quest");
    const parentId = cleanText(payload.parent_id, 128) || null;
    const movement = canMoveQuest(buildQuestTreeIndex(state.quests), quest.id, parentId);
    if (!movement.allowed) throw mutationError(movement.reason);
    quest.parent_id = parentId;
    quest.sort_order = payload.sort_order === undefined ? nextQuestSortOrder(state, parentId) : Math.round(clamp(payload.sort_order, -1_000_000_000, 1_000_000_000));
    quest.updated_at = iso(now);
    addActivity(state, "quest_moved", quest.title, now, { quest_id: quest.id, parent_id: parentId });
    result = quest;
  } else if (action === "quest.delete") {
    const quest = requireItem(state.quests, payload.id, "quest");
    const index = buildQuestTreeIndex(state.quests);
    const children = getQuestChildren(index, quest.id);
    if (children.length && !["branch", "promote_children"].includes(payload.mode)) throw mutationError("quest_has_children", { child_count: children.length });
    if (payload.mode === "branch") {
      const branch = [quest, ...getQuestDescendants(index, quest.id)];
      for (const item of branch) archiveQuestEntity(state, item, now, "quest_branch_archived");
      addActivity(state, "quest_branch_archived", quest.title, now, { quest_id: quest.id, archived_count: branch.length });
      result = { quest, archived_count: branch.length };
    } else {
      if (payload.mode === "promote_children") for (const child of children) { child.parent_id = quest.parent_id || null; child.updated_at = iso(now); }
      archiveQuestEntity(state, quest, now, "quest_archived");
      addActivity(state, "quest_archived", quest.title, now, { quest_id: quest.id, promoted_children: payload.mode === "promote_children" ? children.length : 0 });
      result = quest;
    }
  } else if (action === "quest.complete") {
    const quest = requireItem(state.quests, payload.id, "quest");
    const completionDate = payload.completed_at ? new Date(payload.completed_at) : new Date(now);
    const periodKey = payload.period_key || questPeriodKey(quest, completionDate);
    const existing = state.quest_completions.find((item) => item.quest_id === quest.id && item.period_key === periodKey);
    if (existing) return { state, result: existing, idempotent: true };
    const completion = { ...entityBase(state, "completion", now), quest_id: quest.id, completed_at: iso(completionDate), period_key: periodKey, xp_awarded: quest.xp_reward };
    state.quest_completions.push(completion);
    state.user_game_stats.total_xp += quest.xp_reward;
    if (quest.recurrence_type === "once") {
      quest.status = "COMPLETED";
      quest.completed_at = iso(completionDate);
    }
    quest.updated_at = iso(now);
    cancelQuestDeliveries(state, quest.id, now, { occurrenceKey: periodKey, reason: "quest_completed" });
    addActivity(state, "quest_completed", quest.title, now, { quest_id: quest.id, project_id: quest.project_id, xp_delta: quest.xp_reward });
    refreshStreak(state, now);
    result = completion;
  } else if (action === "quest.undo") {
    const quest = requireItem(state.quests, payload.id, "quest");
    const periodKey = payload.period_key || questPeriodKey(quest, payload.completed_at || now);
    const index = state.quest_completions.findIndex((item) => item.quest_id === quest.id && item.period_key === periodKey);
    if (index < 0) return { state, result: null, idempotent: true };
    const [completion] = state.quest_completions.splice(index, 1);
    state.user_game_stats.total_xp = Math.max(0, state.user_game_stats.total_xp - finite(completion.xp_awarded));
    if (quest.recurrence_type === "once") {
      quest.status = "ACTIVE";
      quest.completed_at = null;
    }
    quest.updated_at = iso(now);
    addActivity(state, "quest_reopened", quest.title, now, { quest_id: quest.id, xp_delta: -finite(completion.xp_awarded) });
    refreshStreak(state, now);
    result = completion;
  } else if (action === "goal.create") {
    const goal = goalInput(state, payload, now);
    if (!goal.title) throw mutationError("goal_title_required");
    if (goal.is_boss) state.goals.forEach((item) => { if (item.period === "WEEKLY") item.is_boss = false; });
    state.goals.push(goal);
    awardGoalTransition(state, goal, false, now);
    result = goal;
  } else if (action === "goal.update") {
    const existing = requireItem(state.goals, payload.id, "goal");
    const wasComplete = Boolean(existing.completed_at);
    const goal = goalInput(state, payload, now, existing);
    if (goal.is_boss) state.goals.forEach((item) => { if (item.id !== existing.id && item.period === "WEEKLY") item.is_boss = false; });
    Object.assign(existing, goal);
    awardGoalTransition(state, existing, wasComplete, now);
    result = existing;
  } else if (action === "idea.create") {
    const base = entityBase(state, "idea", now);
    const idea = {
      ...base,
      related_project_id: cleanText(payload.related_project_id, 128) || null,
      title: cleanText(payload.title, 180),
      description: cleanText(payload.description, 3000),
      tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 10).map((tag) => cleanText(tag, 40)).filter(Boolean) : [],
      status: IDEA_STATUSES.includes(payload.status) ? payload.status : "VAULT",
      cooldown_until: iso(new Date(now).getTime() + (72 * 60 * 60 * 1000)),
    };
    if (!idea.title) throw mutationError("idea_title_required");
    state.ideas.push(idea);
    addActivity(state, "idea_created", idea.title, now, { idea_id: idea.id });
    result = idea;
  } else if (action === "progress.create") {
    const quest = requireItem(state.quests, payload.quest_id, "quest");
    const entry = { ...entityBase(state, "progress", now), quest_id: quest.id, text: cleanText(payload.text, 3000) };
    if (!entry.text) throw mutationError("progress_text_required");
    state.progress_logs.push(entry);
    state.progress_logs = state.progress_logs.slice(-1000);
    addActivity(state, "quest_progress_added", quest.title, now, { quest_id: quest.id, progress_id: entry.id });
    result = entry;
  } else if (action === "progress.delete") {
    const index = state.progress_logs.findIndex((entry) => entry.id === payload.id);
    if (index < 0) throw mutationError("progress_not_found");
    const [entry] = state.progress_logs.splice(index, 1);
    result = entry;
  } else if (action === "idea.update") {
    const idea = requireItem(state.ideas, payload.id, "idea");
    if (payload.title !== undefined) idea.title = cleanText(payload.title, 180);
    if (payload.description !== undefined) idea.description = cleanText(payload.description, 3000);
    if (IDEA_STATUSES.includes(payload.status)) idea.status = payload.status;
    if (Array.isArray(payload.tags)) idea.tags = payload.tags.slice(0, 10).map((tag) => cleanText(tag, 40)).filter(Boolean);
    idea.updated_at = iso(now);
    result = idea;
  } else if (action === "idea.convert") {
    const idea = requireItem(state.ideas, payload.id, "idea");
    if (new Date(idea.cooldown_until).getTime() > new Date(now).getTime() && !payload.override_cooldown) throw mutationError("idea_cooldown_active");
    const project = projectInput(state, { title: idea.title, description: idea.description, status: "IDEA", priority: "NORMAL" }, now);
    state.projects.push(project);
    idea.status = "CONVERTED";
    idea.converted_project_id = project.id;
    idea.updated_at = iso(now);
    addActivity(state, "idea_converted", idea.title, now, { idea_id: idea.id, project_id: project.id });
    result = project;
  } else if (action === "reminder.mark-delivered") {
    const entries = Array.isArray(payload.deliveries) ? payload.deliveries.slice(0, 50) : [];
    for (const entry of entries) {
      const quest = requireItem(state.quests, entry.quest_id, "quest");
      if (!quest.reminders.some((reminder) => reminder.id === entry.reminder_id)) continue;
      let delivery = state.reminder_deliveries.find((item) => item.schedule_key === entry.schedule_key);
      if (!delivery) {
        delivery = {
          ...entityBase(state, "delivery", now),
          quest_id: quest.id,
          reminder_id: cleanText(entry.reminder_id, 128),
          occurrence_key: cleanText(entry.occurrence_key, 180),
          schedule_key: cleanText(entry.schedule_key, 500),
          scheduled_at: iso(entry.scheduled_at),
          due_at: iso(entry.due_at),
        };
        state.reminder_deliveries.push(delivery);
      }
      delivery.status = "DELIVERED";
      delivery.delivered_at = iso(now);
      delivery.snoozed_until = null;
      delivery.updated_at = iso(now);
    }
    state.reminder_deliveries = state.reminder_deliveries.slice(-500);
    result = entries;
  } else if (action === "reminder.snooze") {
    const delivery = requireItem(state.reminder_deliveries, payload.id, "reminder_delivery");
    const minutes = Math.min(7 * 24 * 60, Math.max(1, Math.round(finite(payload.minutes, 15))));
    delivery.status = "SNOOZED";
    delivery.snoozed_until = iso(new Date(now).getTime() + (minutes * 60 * 1000));
    delivery.updated_at = iso(now);
    result = delivery;
  } else if (action === "reminder.dismiss") {
    const delivery = requireItem(state.reminder_deliveries, payload.id, "reminder_delivery");
    delivery.status = "DISMISSED";
    delivery.dismissed_at = iso(now);
    delivery.updated_at = iso(now);
    result = delivery;
  } else if (action === "preferences.update") {
    if (payload.timezone !== undefined) state.preferences.timezone = normalizeTimeZone(payload.timezone, state.preferences.timezone);
    if (["normal", "important", "custom"].includes(payload.default_reminder_preset)) state.preferences.default_reminder_preset = payload.default_reminder_preset;
    if (payload.notifications_enabled !== undefined) state.preferences.notifications_enabled = Boolean(payload.notifications_enabled);
    if (payload.notification_prompt_dismissed !== undefined) state.preferences.notification_prompt_dismissed = Boolean(payload.notification_prompt_dismissed);
    result = state.preferences;
  } else if (action === "push.subscribe") {
    const subscription = normalizePushSubscription(state, payload, now);
    state.preferences.push_subscriptions = state.preferences.push_subscriptions.filter((item) => item.endpoint !== subscription.endpoint);
    state.preferences.push_subscriptions.push(subscription);
    state.preferences.push_subscriptions = state.preferences.push_subscriptions.slice(-8);
    state.preferences.notifications_enabled = true;
    result = subscription;
  } else if (action === "push.unsubscribe") {
    const endpoint = cleanText(payload.endpoint, 2000);
    state.preferences.push_subscriptions = state.preferences.push_subscriptions.filter((item) => item.endpoint !== endpoint);
    if (!state.preferences.push_subscriptions.length) state.preferences.notifications_enabled = false;
    result = { endpoint };
  } else if (action === "stats.update") {
    state.user_game_stats.max_active_projects = Math.round(clamp(payload.max_active_projects ?? state.user_game_stats.max_active_projects, 1, 12));
    result = state.user_game_stats;
  } else throw mutationError("invalid_action");

  const currentLevel = getLevelFromXp(state.user_game_stats.total_xp);
  if (currentLevel > previousLevel) addActivity(state, "level_up", `Nivel ${currentLevel}`, now, { level: currentLevel });
  state.user_game_stats.updated_at = iso(now);
  if (operationId) state.operation_ids = [...state.operation_ids.filter((id) => id !== operationId), operationId].slice(-100);
  return { state, result, idempotent: false };
}

export function createDemoControlState(userId = "demo", { now = Date.now() } = {}) {
  const state = createEmptyControlState(userId, { now });
  state.user_game_stats.total_xp = 1840;
  state.user_game_stats.current_streak = 6;
  state.user_game_stats.longest_streak = 11;
  state.user_game_stats.last_active_date = dateKey(now);
  const projectData = [
    ["project_ivanimports", "IvanImports", "ACTIVE", 72, "#C9A227", "IV", "Publicar, vender y mejorar el ecosistema IvanImports."],
    ["project_removals", "Removals", "ACTIVE", 45, "#8FA68E", "RM", "Cerrar trabajos rentables y afinar captación."],
    ["project_ddtm", "DDTM", "ACTIVE", 20, "#C1673D", "DD", "Convertir experimentos visuales en piezas publicadas."],
    ["project_vehicles", "Venta de vehículos", "PAUSED", 60, "#9B8B62", "VV", "Operaciones y anuncios de vehículos."],
    ["project_fynddo", "Fynddo", "PAUSED", 10, "#8C8A7C", "FY", "Hipótesis aparcada hasta liberar foco."],
  ];
  state.projects = projectData.map(([id, title, status, progress, accent, icon, description], index) => ({
    ...entityBase(state, "project", new Date(now).getTime() - ((index + 2) * DAY_MS)), id, title, slug: title.toLocaleLowerCase("es").replace(/\s+/g, "-"), description, status, priority: index < 2 ? "HIGH" : "NORMAL", icon, accent, progress, progress_method: "manual", main_goal: index === 1 ? "Conseguir 10 trabajos este mes" : "", general_objective: description, weekly_objective: index === 0 ? "Publicar dos mejoras visibles y cerrar una venta." : index === 2 ? "Terminar el sistema del próximo vídeo." : "", current_focus: index === 0 ? "Terminar Mission Control V4." : index === 1 ? "Cerrar la campaña de captación." : index === 2 ? "Terminar vídeo 30 días sin Internet." : "Foco por definir", health: index === 2 ? "YELLOW" : index === 3 ? "RED" : "GREEN", next_milestone: index === 2 ? "Publicar primer vídeo terminado." : "Cerrar el siguiente entregable.", next_milestone_date: null, notes: "", links: [], completed_at: null, updated_at: iso(new Date(now).getTime() - (index * 3600000)) }));
  const today = dateKey(now);
  const questData = [
    ["quest_reel", "Crear y publicar Reel del vaciado completo", "project_removals", "MONEY", 100, true, "once"],
    ["quest_tiktok", "Publicar TikTok IvanImports", "project_ivanimports", "GROWTH", 50, false, "daily"],
    ["quest_leads", "Responder leads pendientes", "project_removals", "MONEY", 30, false, "daily"],
    ["quest_wallapop", "Revisar Wallapop", "project_vehicles", "MONEY", 20, false, "daily"],
    ["quest_milanuncios", "Revisar Milanuncios", "project_vehicles", "MAINTENANCE", 20, false, "daily"],
    ["quest_meta", "Revisar campaña Meta", "project_removals", "GROWTH", 20, false, "daily"],
    ["quest_scene", "Crear una escena IA", "project_ddtm", "EXPERIMENT", 30, false, "daily"],
    ["quest_cta", "Mejorar un CTA de la web", "project_ivanimports", "BUILD", 30, false, "daily"],
  ];
  state.quests = questData.map(([id, title, project_id, category, xp_reward, is_main_quest, recurrence_type], index) => {
    const quest = questInput(state, {
    id,
    project_id,
    title,
    description: "",
    category,
    priority: is_main_quest ? "HIGH" : "NORMAL",
    status: "ACTIVE",
    xp_reward,
    recurrence_type,
    recurrence_config: {},
    scheduled_date: today,
    scheduled_time: index < 4 ? ["09:30", "11:00", "12:30", "17:00"][index] : null,
    reminders: index === 0 ? [{ offset_minutes: 60 }] : [],
    is_main_quest,
    estimated_minutes: 30,
    money_impact: category === "MONEY" ? "high" : "none",
      impact: is_main_quest ? 10 : 6,
    }, now);
    quest.id = id;
    return quest;
  });
  for (const quest of state.quests.slice(1, 4)) state.quest_completions.push({ ...entityBase(state, "completion", now), quest_id: quest.id, completed_at: iso(now), period_key: questPeriodKey(quest, now), xp_awarded: quest.xp_reward });
  const streakQuest = state.quests.find((quest) => quest.id === "quest_tiktok");
  for (let daysAgo = 1; daysAgo <= 5; daysAgo += 1) {
    const completedAt = new Date(new Date(now).getTime() - (daysAgo * DAY_MS));
    state.quest_completions.push({ ...entityBase(state, "completion", completedAt), quest_id: streakQuest.id, completed_at: iso(completedAt), period_key: questPeriodKey(streakQuest, completedAt), xp_awarded: streakQuest.xp_reward });
  }
  state.goals = [
    ["goal_boss", "Cerrar 3 trabajos de removals", "project_removals", "WEEKLY", 1, 3, "count", 300, true],
    ["goal_videos", "Publicar 20 vídeos", "project_ivanimports", "MONTHLY", 12, 20, "count", 250, false],
    ["goal_jobs", "Completar 10 trabajos", "project_removals", "MONTHLY", 4, 10, "count", 300, false],
    ["goal_revenue", "Facturación", null, "MONTHLY", 2450, 5000, "€", 400, false],
    ["goal_ddtm", "Publicar 10 vídeos DDTM", "project_ddtm", "MONTHLY", 3, 10, "count", 250, false],
  ].map(([id, title, project_id, period, current_value, target_value, unit, xp_reward, is_boss]) => ({ ...entityBase(state, "goal", now), id, project_id, parent_goal_id: null, title, period, metric_type: "number", unit, current_value, target_value, xp_reward, is_boss, start_date: iso(now), end_date: null, completed_at: null, xp_awarded: 0 }));
  state.project_logs = [
    { ...entityBase(state, "project_log", new Date(now).getTime() - DAY_MS), id: "project_log_ddtm", project_id: "project_ddtm", text: "Definida la estructura principal del vídeo." },
    { ...entityBase(state, "project_log", new Date(now).getTime() - (2 * DAY_MS)), id: "project_log_ivan", project_id: "project_ivanimports", text: "Mission Tree V3 desplegado y verificado." },
  ];
  state.project_achievements = [{ ...entityBase(state, "achievement", new Date(now).getTime() - (3 * DAY_MS)), id: "achievement_ivan_v3", project_id: "project_ivanimports", text: "Mission Control V3 publicado.", achieved_at: iso(new Date(now).getTime() - (3 * DAY_MS)) }];
  state.project_decisions = [{ ...entityBase(state, "decision", new Date(now).getTime() - DAY_MS), id: "decision_ddtm_length", project_id: "project_ddtm", text: "¿Vídeo de 4:30 o 8 minutos?", status: "OPEN", resolved_at: null, resolution: "", resolution_notes: "" }];
  state.project_blockers = [{ ...entityBase(state, "blocker", new Date(now).getTime() - DAY_MS), id: "blocker_removals_api", project_id: "project_removals", text: "Falta acceso a la API de captación.", status: "OPEN", resolved_at: null }];
  state.project_metrics = [
    { ...entityBase(state, "metric", now), id: "metric_ddtm_videos", project_id: "project_ddtm", name: "Vídeos publicados", value: "4", unit: "vídeos", target: "10", sort_order: 1000 },
    { ...entityBase(state, "metric", now), id: "metric_ivan_leads", project_id: "project_ivanimports", name: "Leads", value: "14", unit: "", target: "25", sort_order: 1000 },
  ];
  const ideaCreated = new Date(now).getTime() - (20 * 60 * 60 * 1000);
  state.ideas = [
    { ...entityBase(state, "idea", ideaCreated), id: "idea_automation", related_project_id: null, title: "Automatizar resumen de leads", description: "Agrupar origen, importe y siguiente acción sin abrir otro proyecto todavía.", tags: ["automatización", "ventas"], status: "VAULT", cooldown_until: iso(ideaCreated + (72 * 60 * 60 * 1000)) },
    { ...entityBase(state, "idea", new Date(now).getTime() - (5 * DAY_MS)), id: "idea_series", related_project_id: "project_ivanimports", title: "Serie: errores reales al importar", description: "Evaluar formato de 10 capítulos cortos.", tags: ["contenido"], status: "CANDIDATE", cooldown_until: iso(new Date(now).getTime() - DAY_MS) },
  ];
  state.activity_log = state.quest_completions.map((completion) => {
    const quest = state.quests.find((item) => item.id === completion.quest_id);
    return { ...entityBase(state, "activity", completion.completed_at), type: "quest_completed", title: quest.title, quest_id: quest.id, project_id: quest.project_id, xp_delta: completion.xp_awarded };
  });
  return state;
}
