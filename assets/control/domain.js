export const CONTROL_SCHEMA_VERSION = 1;
export const CONTROL_TIME_ZONE = "Europe/Madrid";
export const PROJECT_STATUSES = Object.freeze(["ACTIVE", "PAUSED", "IDEA", "COMPLETED", "ARCHIVED"]);
export const QUEST_CATEGORIES = Object.freeze(["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"]);
export const QUEST_PRIORITIES = Object.freeze(["LOW", "NORMAL", "HIGH", "CRITICAL"]);
export const RECURRENCE_TYPES = Object.freeze(["once", "daily", "weekly", "monthly"]);
export const IDEA_STATUSES = Object.freeze(["VAULT", "CANDIDATE", "CONVERTED", "DISCARDED"]);
export const GOAL_PERIODS = Object.freeze(["DAILY", "WEEKLY", "MONTHLY"]);

const DAY_MS = 24 * 60 * 60 * 1000;

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

function zonedParts(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  return Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function dateKey(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const parts = zonedParts(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function monthKey(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  return dateKey(value, timeZone).slice(0, 7);
}

function weekdayNumber(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const weekday = zonedParts(value, timeZone).weekday;
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[weekday] || 1;
}

export function weekKey(value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const currentKey = dateKey(value, timeZone);
  const noonUtc = new Date(`${currentKey}T12:00:00Z`);
  noonUtc.setUTCDate(noonUtc.getUTCDate() - (weekdayNumber(value, timeZone) - 1));
  return dateKey(noonUtc, "UTC");
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
    goals: [],
    ideas: [],
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
    goals: Array.isArray(value.goals) ? value.goals : [],
    ideas: Array.isArray(value.ideas) ? value.ideas : [],
    activity_log: Array.isArray(value.activity_log) ? value.activity_log.slice(0, 200) : [],
    operation_ids: Array.isArray(value.operation_ids) ? value.operation_ids.slice(-100) : [],
    user_game_stats: { ...empty.user_game_stats, ...(value.user_game_stats || {}), user_id: cleanText(userId, 128) },
  };
  for (const collection of [state.projects, state.quests, state.quest_completions, state.goals, state.ideas, state.activity_log]) {
    for (const item of collection) item.user_id = state.user_id;
  }
  return state;
}

export function questPeriodKey(quest, value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const recurrence = RECURRENCE_TYPES.includes(quest?.recurrence_type) ? quest.recurrence_type : "once";
  if (recurrence === "daily") return `day:${dateKey(value, timeZone)}`;
  if (recurrence === "weekly") {
    const days = Array.isArray(quest?.recurrence_config?.days) ? quest.recurrence_config.days : [];
    return days.length > 1 ? `day:${dateKey(value, timeZone)}` : `week:${weekKey(value, timeZone)}`;
  }
  if (recurrence === "monthly") return `month:${monthKey(value, timeZone)}`;
  return `once:${quest?.id || "unknown"}`;
}

export function questIsDueOn(quest, value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  if (!quest || ["ARCHIVED", "CANCELLED"].includes(quest.status)) return false;
  if (quest.recurrence_type === "daily") return true;
  if (quest.recurrence_type === "weekly") {
    const days = Array.isArray(quest.recurrence_config?.days) ? quest.recurrence_config.days.map(Number) : [];
    return !days.length || days.includes(weekdayNumber(value, timeZone));
  }
  if (quest.recurrence_type === "monthly") {
    const day = Number(quest.recurrence_config?.day || 1);
    return Number(dateKey(value, timeZone).slice(-2)) === day;
  }
  if (!quest.due_date) return false;
  return dateKey(quest.due_date, timeZone) === dateKey(value, timeZone);
}

export function questCompletedForPeriod(state, quest, value = Date.now(), timeZone = CONTROL_TIME_ZONE) {
  const periodKey = questPeriodKey(quest, value, timeZone);
  return state.quest_completions.some((completion) => completion.quest_id === quest.id && completion.period_key === periodKey);
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
    accent: /^#[0-9a-f]{6}$/i.test(payload.accent) ? payload.accent : existing?.accent || "#6ee7d8",
    progress: clamp(payload.progress ?? existing?.progress, 0, 100),
    progress_method: payload.progress_method === "calculated" ? "calculated" : existing?.progress_method || "manual",
    main_goal: cleanText(payload.main_goal ?? existing?.main_goal, 240),
    notes: cleanText(payload.notes ?? existing?.notes, 5000),
    links: Array.isArray(payload.links) ? payload.links.slice(0, 20).map((link) => ({ label: cleanText(link.label, 80), url: cleanText(link.url, 500) })) : existing?.links || [],
    completed_at: status === "COMPLETED" ? existing?.completed_at || iso(now) : null,
    updated_at: iso(now),
  };
}

function questInput(state, payload, now, existing = null) {
  const recurrence = RECURRENCE_TYPES.includes(payload.recurrence_type) ? payload.recurrence_type : existing?.recurrence_type || "once";
  return {
    ...(existing || entityBase(state, "quest", now)),
    project_id: payload.project_id === null ? null : cleanText(payload.project_id ?? existing?.project_id, 128) || null,
    title: cleanText(payload.title ?? existing?.title, 180),
    description: cleanText(payload.description ?? existing?.description, 1200),
    category: QUEST_CATEGORIES.includes(payload.category) ? payload.category : existing?.category || "BUILD",
    priority: QUEST_PRIORITIES.includes(payload.priority) ? payload.priority : existing?.priority || "NORMAL",
    status: cleanText(payload.status ?? existing?.status ?? "ACTIVE", 24),
    xp_reward: Math.round(clamp(payload.xp_reward ?? existing?.xp_reward ?? 30, 0, 5000)),
    recurrence_type: recurrence,
    recurrence_config: payload.recurrence_config && typeof payload.recurrence_config === "object" ? payload.recurrence_config : existing?.recurrence_config || {},
    due_date: payload.due_date === null ? null : payload.due_date ? iso(payload.due_date) : existing?.due_date || null,
    is_main_quest: Boolean(payload.is_main_quest ?? existing?.is_main_quest),
    estimated_minutes: Math.round(clamp(payload.estimated_minutes ?? existing?.estimated_minutes, 0, 1440)) || null,
    money_impact: ["none", "low", "medium", "high", "direct"].includes(payload.money_impact) ? payload.money_impact : existing?.money_impact || "none",
    impact: Math.round(clamp(payload.impact ?? existing?.impact, 0, 10)) || null,
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
  } else if (action === "quest.create") {
    const quest = questInput(state, payload, now);
    if (!quest.title) throw mutationError("quest_title_required");
    if (quest.project_id && !state.projects.some((item) => item.id === quest.project_id)) throw mutationError("project_not_found");
    if (quest.is_main_quest) state.quests.forEach((item) => { item.is_main_quest = false; });
    state.quests.push(quest);
    result = quest;
  } else if (action === "quest.update") {
    const existing = requireItem(state.quests, payload.id, "quest");
    const quest = questInput(state, payload, now, existing);
    if (quest.is_main_quest) state.quests.forEach((item) => { if (item.id !== existing.id) item.is_main_quest = false; });
    Object.assign(existing, quest);
    result = existing;
  } else if (action === "quest.complete") {
    const quest = requireItem(state.quests, payload.id, "quest");
    const completionDate = payload.completed_at ? new Date(payload.completed_at) : new Date(now);
    const periodKey = payload.period_key || questPeriodKey(quest, completionDate);
    const existing = state.quest_completions.find((item) => item.quest_id === quest.id && item.period_key === periodKey);
    if (existing) return { state, result: existing, idempotent: true };
    const completion = { ...entityBase(state, "completion", now), quest_id: quest.id, completed_at: iso(completionDate), period_key: periodKey, xp_awarded: quest.xp_reward };
    state.quest_completions.push(completion);
    state.user_game_stats.total_xp += quest.xp_reward;
    if (quest.recurrence_type === "once") quest.status = "COMPLETED";
    quest.updated_at = iso(now);
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
    if (quest.recurrence_type === "once") quest.status = "ACTIVE";
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
    ["project_ivanimports", "IvanImports", "ACTIVE", 72, "#68e1fd", "◆", "Publicar, vender y mejorar el ecosistema IvanImports."],
    ["project_removals", "Removals", "ACTIVE", 45, "#6ee7b7", "▰", "Cerrar trabajos rentables y afinar captación."],
    ["project_ddtm", "DDTM", "ACTIVE", 20, "#a78bfa", "◈", "Convertir experimentos visuales en piezas publicadas."],
    ["project_vehicles", "Venta de vehículos", "PAUSED", 60, "#fbbf77", "◇", "Operaciones y anuncios de vehículos."],
    ["project_fynddo", "Fynddo", "PAUSED", 10, "#fb7185", "○", "Hipótesis aparcada hasta liberar foco."],
  ];
  state.projects = projectData.map(([id, title, status, progress, accent, icon, description], index) => ({
    ...entityBase(state, "project", new Date(now).getTime() - ((index + 2) * DAY_MS)), id, title, slug: title.toLocaleLowerCase("es").replace(/\s+/g, "-"), description, status, priority: index < 2 ? "HIGH" : "NORMAL", icon, accent, progress, progress_method: "manual", main_goal: index === 1 ? "Conseguir 10 trabajos este mes" : "", notes: "", links: [], completed_at: null, updated_at: iso(new Date(now).getTime() - (index * 3600000)) }));
  const today = `${dateKey(now)}T10:00:00.000Z`;
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
  state.quests = questData.map(([id, title, project_id, category, xp_reward, is_main_quest, recurrence_type]) => ({ ...entityBase(state, "quest", now), id, project_id, title, description: "", category, priority: is_main_quest ? "CRITICAL" : "NORMAL", status: "ACTIVE", xp_reward, recurrence_type, recurrence_config: {}, due_date: recurrence_type === "once" ? today : null, is_main_quest, estimated_minutes: 30, money_impact: category === "MONEY" ? "high" : "none", impact: is_main_quest ? 10 : 6 }));
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
