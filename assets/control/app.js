import {
  applyControlMutation, buildReminderCandidates, createDemoControlState, dateKey,
  getActionableReminders, getDirectQuestProgress, getLevelProgress, getQuestChildren,
  getQuestDescendants, getQuestPath, getRecursiveQuestProgress, getTodaySummary,
  getAttentionItems, getMissionBuckets, getProjectQuestStats, getProjectSummary,
  getProjectUnscheduledMissions, getScheduledMissions, getUnscheduledMissions, projectProgress,
  normalizeControlState, questCompletedForPeriod, questIsOverdue, questPeriodKey,
  buildQuestTreeIndex, canMoveQuest, sortSiblingQuests,
} from "./domain.js";

const API = {
  session: "/api/control/session", state: "/api/control/state", mutate: "/api/control/mutate",
  demoReset: "/api/control/demo-reset", login: "/api/control/login", pushConfig: "/api/control/push-config",
};

const app = {
  root: document.querySelector("[data-control-app]"), state: null, revision: 0, session: null, route: null,
  localPreview: ["localhost", "127.0.0.1", "::1"].includes(location.hostname) && new URLSearchParams(location.search).get("demo") === "1",
  filters: { project: "", priority: "", status: "open", level: "roots", schedule: "all" },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid", checkingReminders: false,
  tree: null, projectIndex: null, quickParentId: null, quickProjectId: null, pendingArchiveId: null,
  missionView: ["grid", "tree", "list"].includes(localStorage.getItem("ivanimports.mission-control.mission-view")) ? localStorage.getItem("ivanimports.mission-control.mission-view") : "grid",
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const escapeAttribute = (value) => escapeHtml(value).replace(/`/g, "&#96;");
const operationId = () => globalThis.crypto?.randomUUID?.() || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const formatNumber = (value) => new Intl.NumberFormat("es-ES").format(Number(value) || 0);

function formatDate(value = Date.now(), options = {}) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: app.state?.preferences?.timezone || app.timezone, ...options }).format(new Date(value));
}

function relativeTime(value) {
  const amount = Math.abs(new Date(value).getTime() - Date.now());
  if (amount < 60_000) return "ahora";
  if (amount < 3_600_000) return `${Math.ceil(amount / 60_000)} min`;
  if (amount < 86_400_000) return `${Math.ceil(amount / 3_600_000)} h`;
  return `${Math.ceil(amount / 86_400_000)} d`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || "request_failed"), { status: response.status, body });
  return body;
}

function parseRoute(pathname = location.pathname) {
  const path = pathname.replace(/\/+$/, "") || "/control";
  const project = path.match(/^\/control\/projects\/([^/]+)$/);
  if (project) return { name: "project", id: decodeURIComponent(project[1]) };
  const quest = path.match(/^\/control\/quests\/([^/]+)$/);
  if (quest) return { name: "quest", id: decodeURIComponent(quest[1]) };
  if (path === "/control/quests") return { name: "quests" };
  if (path === "/control/projects") return { name: "projects" };
  if (path === "/control/unscheduled") return { name: "unscheduled" };
  if (path === "/control/ideas") return { name: "ideas" };
  return { name: "dashboard" };
}

function navigate(path) {
  history.pushState({}, "", path); app.route = parseRoute(path); render(); window.scrollTo({ top: 0, behavior: "auto" });
}

const projectFor = (id) => app.state.projects.find((project) => project.id === id) || null;
const projectLabel = (id) => projectFor(id)?.title || "Sin proyecto";
const questDone = (quest, value = Date.now()) => questCompletedForPeriod(app.state, quest, value) || (quest.recurrence_type === "once" && quest.status === "COMPLETED");

function icon(name) {
  const paths = {
    today: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', check: '<path d="m5 12 4 4L19 6"/>',
    idea: '<path d="M9 18h6m-5 3h4m4-11a6 6 0 0 1-3 5.2V16H9v-.8A6 6 0 1 1 18 10Z"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>', edit: '<path d="m4 16-1 5 5-1L19 9l-4-4Z"/><path d="m13 7 4 4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', archive: '<path d="M4 7h16v14H4zM3 3h18v4H3zM9 11h6"/>',
    projects: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5V3h8v2M8 10h8"/>', inbox: '<path d="M4 5h16v14H4zM4 14h4l2 3h4l2-3h4"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.today}</svg>`;
}

function levelBlock() {
  const progress = getLevelProgress(app.state.user_game_stats.total_xp);
  return `<div class="mc-level"><span>Nivel ${progress.level}</span><strong>${formatNumber(progress.totalXp)} XP</strong><div class="mc-line-progress"><i style="width:${progress.percent}%"></i></div><small>Racha · ${app.state.user_game_stats.current_streak} días</small></div>`;
}

function appShell(content) {
  const route = app.route.name;
  const title = route === "dashboard" ? "Hoy" : route === "quests" ? "Misiones" : route === "projects" ? "Proyectos" : route === "unscheduled" ? "Sin fecha" : route === "quest" ? app.tree?.byId.get(app.route.id)?.title || "Misión" : route === "ideas" ? "Idea Vault" : projectFor(app.route.id)?.title || "Proyecto";
  const projects = app.state.projects.filter((project) => project.status !== "ARCHIVED");
  const projectNav = `<div class="mc-nav-group"><div class="mc-nav-label"><span>Proyectos activos</span><button type="button" data-capture="project-new" aria-label="Crear proyecto">+</button></div>${projects.map((project) => { const stats = getProjectQuestStats(app.state, project.id); return `<a href="/control/projects/${encodeURIComponent(project.id)}/" data-nav class="mc-project-nav ${route === "project" && app.route.id === project.id ? "is-active" : ""}"><i style="--project:${escapeAttribute(project.accent)}"></i><span>${escapeHtml(project.title)}</span><b>${stats.pending}</b></a>`; }).join("")}</div>`;
  return `<div class="mc-app"><aside class="mc-sidebar"><a class="mc-brand" href="/control/" data-nav><span class="mc-brand-mark">MC</span><span><strong>Mission Control</strong><small>Espacio de trabajo</small></span></a><nav class="mc-nav" aria-label="Navegación principal"><a href="/control/" data-nav class="${route === "dashboard" ? "is-active" : ""}">${icon("today")}<span>Hoy</span><kbd>1</kbd></a><a href="/control/quests/" data-nav class="${["quests", "quest"].includes(route) ? "is-active" : ""}">${icon("check")}<span>Misiones</span><kbd>2</kbd></a><a href="/control/projects/" data-nav class="${["projects", "project"].includes(route) ? "is-active" : ""}">${icon("projects")}<span>Proyectos</span><kbd>3</kbd></a><a href="/control/unscheduled/" data-nav class="${route === "unscheduled" ? "is-active" : ""}">${icon("inbox")}<span>Sin fecha</span><kbd>4</kbd></a>${projectNav}<a href="/control/ideas/" data-nav class="${route === "ideas" ? "is-active" : ""}">${icon("idea")}<span>Idea Vault</span><kbd>5</kbd></a></nav><div class="mc-sidebar-foot">${levelBlock()}${app.session?.user?.demo ? '<button class="mc-text-button" type="button" data-action="demo-reset">Restaurar demo</button>' : ""}</div></aside><section class="mc-workspace"><header class="mc-topbar"><div><span class="mc-eyebrow">${formatDate(Date.now(), { weekday: "long", day: "numeric", month: "long" })}</span><strong>${escapeHtml(title)}</strong></div><button class="mc-quick-button" type="button" data-action="quick-open">${icon("plus")}<span>${route === "quest" ? "Submisión" : "Añadir"}</span><kbd>Q</kbd></button></header><main id="mc-main" class="mc-main">${content}</main></section><button class="mc-fab" type="button" data-action="quick-open" aria-label="Añadir rápidamente">${icon("plus")}</button>${quickDialog()}${editorDialog()}${notificationDialog()}${limitDialog()}${archiveDialog()}<div class="mc-toasts" data-toasts aria-live="polite"></div></div>`;
}

function progressDots(summary) {
  if (!summary.total) return '<div class="mc-dots"><i></i></div>';
  return `<div class="mc-dots" aria-label="${summary.completed} de ${summary.total} completadas">${Array.from({ length: Math.min(summary.total, 18) }, (_, index) => `<i class="${index < summary.completed ? "is-done" : ""}"></i>`).join("")}</div>`;
}

function recurrenceLabel(quest) {
  if (quest.recurrence_type === "daily") return "Diaria";
  if (quest.recurrence_type === "weekly") return "Semanal";
  if (quest.recurrence_type === "monthly") return "Mensual";
  if (quest.recurrence_type === "interval") return `Cada ${quest.recurrence_config?.interval || 1}`;
  return "Una vez";
}

function sortedQuests(quests) {
  return sortSiblingQuests(quests, { isOverdue: (quest) => questIsOverdue(app.state, quest) });
}

function questContext(quest, limit = 3) {
  const ancestors = getQuestPath(app.tree, quest.id).slice(0, -1);
  if (!ancestors.length) return projectLabel(quest.project_id);
  const visible = ancestors.slice(-limit).map((item) => item.title);
  return `${ancestors.length > limit ? "… › " : ""}${visible.join(" › ")}`;
}

function questRow(quest, { overdue = false } = {}) {
  const done = questDone(quest); const reminderCount = quest.reminders?.filter((item) => item.enabled !== false).length || 0;
  const schedule = quest.scheduled_time || (quest.scheduled_date ? formatDate(`${quest.scheduled_date}T12:00:00Z`, { day: "2-digit", month: "short" }) : "Sin fecha");
  const direct = getDirectQuestProgress(app.tree, quest.id, questDone);
  return `<article class="mc-mission-row ${done ? "is-complete" : ""} ${overdue ? "is-overdue" : ""}"><button class="mc-check mc-check--${quest.priority.toLowerCase()}" type="button" data-quest-toggle="${escapeAttribute(quest.id)}" aria-label="${done ? "Reabrir" : "Completar"}"><span>${done ? "✓" : ""}</span></button><button class="mc-mission-copy" type="button" data-open-quest="${escapeAttribute(quest.id)}"><strong>${escapeHtml(quest.title)}</strong><small><span>${escapeHtml(questContext(quest))}</span><span>${quest.priority === "HIGH" ? "Alta" : quest.priority === "LOW" ? "Baja" : "Normal"}</span>${direct.total ? `<span>${direct.completed}/${direct.total} submisiones</span>` : ""}${quest.recurrence_type !== "once" ? `<span>${escapeHtml(recurrenceLabel(quest))}</span>` : ""}</small></button><div class="mc-mission-meta"><time>${escapeHtml(schedule)}</time>${reminderCount ? `<span>${icon("bell")}${reminderCount}</span>` : ""}<button class="mc-row-edit" type="button" data-edit-quest="${escapeAttribute(quest.id)}" aria-label="Editar ${escapeAttribute(quest.title)}">${icon("edit")}</button></div></article>`;
}

function missionCard(quest) {
  const done = questDone(quest);
  const direct = getDirectQuestProgress(app.tree, quest.id, questDone);
  const reminderCount = quest.reminders?.filter((item) => item.enabled !== false).length || 0;
  const schedule = quest.scheduled_time || (quest.scheduled_date ? formatDate(`${quest.scheduled_date}T12:00:00Z`, { day: "numeric", month: "short" }) : "Sin fecha");
  const priority = quest.priority.toLowerCase();
  return `<article class="mc-mission-card mc-mission-card--${priority} ${done ? "is-complete" : ""}"><button class="mc-card-open" type="button" data-open-quest="${escapeAttribute(quest.id)}" aria-label="Abrir misión ${escapeAttribute(quest.title)}"><span class="mc-card-priority" aria-label="Prioridad ${priority === "high" ? "alta" : priority === "low" ? "baja" : "normal"}"></span><small>${escapeHtml(questContext(quest))}</small><strong>${escapeHtml(quest.title)}</strong><div class="mc-card-stats">${direct.total ? `<span><b>${direct.completed}/${direct.total}</b> ${direct.total === 1 ? "submisión" : "submisiones"}</span>` : `<span>${done ? "Completada" : quest.status === "IN_PROGRESS" ? "En progreso" : "Pendiente"}</span>`}</div><footer><time>${escapeHtml(schedule)}</time>${reminderCount ? `<span>${icon("bell")}${reminderCount}</span>` : ""}</footer></button><button class="mc-card-check" type="button" data-quest-toggle="${escapeAttribute(quest.id)}" aria-label="${done ? "Reabrir" : "Completar"}">${done ? "✓" : "○"}</button></article>`;
}

function missionGrid(quests, empty = "No hay misiones en esta vista.") {
  return quests.length ? `<div class="mc-mission-grid">${sortedQuests(quests).map(missionCard).join("")}</div>` : `<p class="mc-empty-inline">${escapeHtml(empty)}</p>`;
}

function missionTreeView(quests) {
  if (!quests.length) return '<p class="mc-empty-inline">No hay misiones en esta vista.</p>';
  const included = new Set(quests.map((quest) => quest.id));
  const roots = quests.filter((quest) => !quest.parent_id || !included.has(quest.parent_id));
  const rows = [];
  const visited = new Set();
  const stack = sortedQuests(roots).reverse().map((quest) => ({ quest, depth: 0 }));
  while (stack.length) {
    const { quest, depth } = stack.pop();
    if (visited.has(quest.id)) continue;
    visited.add(quest.id);
    const direct = getDirectQuestProgress(app.tree, quest.id, questDone);
    rows.push(`<article class="mc-tree-row" style="--depth:${Math.min(depth, 6)}"><span class="mc-tree-line"></span><button type="button" data-open-quest="${escapeAttribute(quest.id)}"><i class="mc-tree-priority mc-tree-priority--${quest.priority.toLowerCase()}"></i><span><strong>${escapeHtml(quest.title)}</strong><small>${escapeHtml(questContext(quest))}${direct.total ? ` · ${direct.completed}/${direct.total}` : ""}</small></span></button><button type="button" data-edit-quest="${escapeAttribute(quest.id)}" aria-label="Editar ${escapeAttribute(quest.title)}">${icon("edit")}</button></article>`);
    const children = sortedQuests(getQuestChildren(app.tree, quest.id).filter((child) => included.has(child.id)));
    for (let index = children.length - 1; index >= 0; index -= 1) stack.push({ quest: children[index], depth: depth + 1 });
  }
  return `<div class="mc-mission-tree">${rows.join("")}</div>`;
}

function missionRenderer(quests) {
  if (app.missionView === "tree") return missionTreeView(quests);
  if (app.missionView === "list") return `<section class="mc-panel"><div class="mc-mission-list">${sortedQuests(quests).map((quest) => questRow(quest)).join("")}</div></section>`;
  return missionGrid(quests);
}

function missionViewSwitch() {
  return `<div class="mc-view-switch" role="group" aria-label="Vista de misiones">${[["grid", "Cuadrícula"], ["tree", "Árbol"], ["list", "Lista"]].map(([value, label]) => `<button type="button" data-mission-view="${value}" class="${app.missionView === value ? "is-active" : ""}">${label}</button>`).join("")}</div>`;
}

function missionGroup(title, quests, options = {}) {
  if (!quests.length) return options.hideEmpty ? "" : `<section class="mc-panel"><div class="mc-section-head"><h2>${escapeHtml(title)}</h2></div><div class="mc-empty-inline">Nada pendiente aquí.</div></section>`;
  return `<section class="mc-panel"><div class="mc-section-head"><h2>${escapeHtml(title)}</h2><span>${quests.length}</span></div><div class="mc-mission-list">${sortedQuests(quests).map((quest) => questRow(quest, options)).join("")}</div></section>`;
}

function notificationBanner() {
  const relevant = app.state.quests.some((quest) => quest.reminders?.length) && !app.localPreview && !app.state.preferences?.notifications_enabled && !app.state.preferences?.notification_prompt_dismissed;
  return relevant ? `<section class="mc-notice">${icon("bell")}<div><strong>Recibe tus recordatorios</strong><p>Activa avisos para las misiones que tienen hora.</p></div><button class="mc-button mc-button--secondary" type="button" data-action="notification-open">Configurar</button></section>` : "";
}

function reminderInbox() {
  const reminders = getActionableReminders(app.state).slice(0, 4);
  if (!reminders.length) return "";
  return `<section class="mc-reminder-inbox"><div class="mc-section-head"><div><span class="mc-kicker">Recordatorios</span><h2>Necesitan tu atención</h2></div></div>${reminders.map((delivery) => { const quest = app.state.quests.find((item) => item.id === delivery.quest_id); return `<article class="mc-reminder-row"><span class="mc-reminder-icon">${icon("bell")}</span><div><strong>${escapeHtml(quest?.title || "Misión")}</strong><small>${delivery.status === "SNOOZED" ? `Pospuesto · ${relativeTime(delivery.snoozed_until)}` : `Avisado · ${relativeTime(delivery.delivered_at)}`}</small></div><div class="mc-row-actions"><button type="button" data-quest-toggle="${escapeAttribute(delivery.quest_id)}">Hecho</button><button type="button" data-reminder-snooze="${escapeAttribute(delivery.id)}" data-minutes="15">15 min</button><button type="button" data-reminder-snooze="${escapeAttribute(delivery.id)}" data-minutes="60">1 h</button><button type="button" data-reminder-snooze="${escapeAttribute(delivery.id)}" data-minutes="custom">Otro…</button><button type="button" data-reminder-dismiss="${escapeAttribute(delivery.id)}">Cerrar</button></div></article>`; }).join("")}</section>`;
}

function mainQuestCard(summary) {
  const quest = app.state.quests.find((item) => item.is_main_quest && !["ARCHIVED", "CANCELLED"].includes(item.status));
  if (!quest) return `<section class="mc-main-quest mc-empty-card"><div><span class="mc-kicker">Main Quest</span><h2>Elige el cierre que mueve el día.</h2></div><button class="mc-button mc-button--secondary" type="button" data-capture="quest" data-main="true">Definir Main Quest</button></section>`;
  const dueToday = summary.missions.some((item) => item.id === quest.id);
  return `<section class="mc-main-quest"><div><span class="mc-kicker">Main Quest</span><h2><button type="button" data-open-quest="${escapeAttribute(quest.id)}">${escapeHtml(quest.title)}</button></h2><p>${escapeHtml(questContext(quest))} · ${quest.xp_reward} XP</p></div><div class="mc-main-actions">${dueToday ? `<button class="mc-button mc-button--gold" type="button" data-quest-toggle="${escapeAttribute(quest.id)}">${questDone(quest) ? "Reabrir" : "Completar"}</button>` : ""}<button class="mc-icon-button" type="button" data-edit-quest="${escapeAttribute(quest.id)}" aria-label="Editar Main Quest">${icon("edit")}</button></div></section>`;
}

function projectStrip() {
  const projects = app.state.projects.filter((project) => !["ARCHIVED", "COMPLETED"].includes(project.status)).slice(0, 4);
  if (!projects.length) return "";
  return `<section class="mc-project-strip"><div class="mc-section-head"><h2>Frentes activos</h2></div><div class="mc-project-grid">${projects.map((project) => { const progress = projectProgress(app.state, project); return `<a href="/control/projects/${encodeURIComponent(project.id)}/" data-nav class="mc-project-tile"><span class="mc-project-mark" style="--project:${escapeAttribute(project.accent)}">${escapeHtml(project.icon || "·")}</span><div><strong>${escapeHtml(project.title)}</strong><small>${project.status === "ACTIVE" ? "Activo" : "En pausa"} · ${progress}%</small><div class="mc-line-progress"><i style="width:${progress}%"></i></div></div>${icon("arrow")}</a>`; }).join("")}</div></section>`;
}

function calendarContext() {
  const selectedKey = dateKey();
  const selected = new Date(`${selectedKey}T12:00:00Z`);
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  selected.setUTCDate(selected.getUTCDate() - mondayOffset);
  const days = Array.from({ length: 7 }, (_, index) => { const day = new Date(selected); day.setUTCDate(selected.getUTCDate() + index); return day; });
  return `<section class="mc-calendar"><div class="mc-section-head"><h2>Esta semana</h2><span>${formatDate(Date.now(), { month: "short" })}</span></div><div class="mc-calendar-days">${days.map((day) => { const key = day.toISOString().slice(0, 10); return `<div class="${key === selectedKey ? "is-selected" : ""}"><span>${new Intl.DateTimeFormat("es-ES", { weekday: "narrow", timeZone: "UTC" }).format(day)}</span><strong>${day.getUTCDate()}</strong></div>`; }).join("")}</div></section>`;
}

function attentionPanel() {
  const items = getAttentionItems(app.state).slice(0, 8);
  if (!items.length) return "";
  return `<section class="mc-attention"><div class="mc-section-head"><div><span class="mc-kicker">Señales claras</span><h2>Necesita tu atención</h2></div><span>${items.length}</span></div><div class="mc-attention-grid">${items.map((item) => { const project = projectFor(item.project_id); return `<a href="/control/projects/${encodeURIComponent(item.project_id)}/" data-nav><i class="mc-health-dot mc-health-dot--${item.severity === "HIGH" ? "red" : "yellow"}"></i><span><strong>${escapeHtml(project?.title || "Proyecto")}</strong><small>${escapeHtml(item.message)}</small></span>${icon("arrow")}</a>`; }).join("")}</div></section>`;
}

function projectCockpitCards() {
  const projects = app.state.projects.filter((project) => project.status === "ACTIVE");
  if (!projects.length) return "";
  return `<section class="mc-project-cards-section"><div class="mc-section-head"><div><span class="mc-kicker">Focos activos</span><h2>Project Cockpits</h2></div></div><div class="mc-project-cards">${projects.map((project) => { const summary = getProjectSummary(app.state, project); return `<a href="/control/projects/${encodeURIComponent(project.id)}/" data-nav class="mc-project-card"><header><span class="mc-project-mark" style="--project:${escapeAttribute(project.accent)}">${escapeHtml(project.icon || "·")}</span><i class="mc-health-dot mc-health-dot--${project.health.toLowerCase()}"></i></header><strong>${escapeHtml(project.title)}</strong><small>Foco actual</small><p>${escapeHtml(project.current_focus || "Foco por definir")}</p><footer><span>${summary.quests.pending} pendientes</span><span>${summary.open_decisions.length} decisiones</span><span>${summary.open_blockers.length} bloqueos</span></footer></a>`; }).join("")}</div></section>`;
}

function projectOverviewCard(project) {
  const summary = getProjectSummary(app.state, project);
  return `<a href="/control/projects/${encodeURIComponent(project.id)}/" data-nav class="mc-project-overview-card"><header><span class="mc-project-mark" style="--project:${escapeAttribute(project.accent)}">${escapeHtml(project.icon || "·")}</span><div><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(projectStatusLabel(project.status))}</small></div><span class="mc-health-pill mc-health-pill--${project.health.toLowerCase()}">${escapeHtml(healthLabel(project.health))}</span></header><div class="mc-project-focus"><span>Foco actual</span><p>${escapeHtml(project.current_focus || "Foco por definir")}</p></div><div class="mc-project-numbers"><span><b>${summary.quests.pending}</b> pendientes</span><span><b>${summary.quests.unscheduled}</b> sin fecha</span><span><b>${summary.open_decisions.length}</b> decisiones</span><span><b>${summary.open_blockers.length}</b> bloqueos</span></div><footer><span>${summary.achievements.length} logros registrados</span>${icon("arrow")}</footer></a>`;
}

function renderProjects() {
  const order = { ACTIVE: 0, PAUSED: 1, COMPLETED: 2, ARCHIVED: 3 };
  const projects = app.state.projects.slice().sort((left, right) => (order[left.status] ?? 4) - (order[right.status] ?? 4) || left.title.localeCompare(right.title, "es"));
  const active = projects.filter((project) => project.status === "ACTIVE").length;
  const pending = projects.reduce((total, project) => total + getProjectQuestStats(app.state, project.id).pending, 0);
  return `<section class="mc-page-head mc-projects-head"><div><span class="mc-kicker">Centros de mando</span><h1>Proyectos</h1><p>Dirección, foco y trabajo abierto en una sola vista.</p></div><button class="mc-button mc-button--gold" type="button" data-capture="project-new">${icon("plus")} Nuevo proyecto</button></section><section class="mc-planning-summary"><div><span>Proyectos activos</span><strong>${active}</strong></div><div><span>Misiones pendientes</span><strong>${pending}</strong></div><div><span>Sin calendarizar</span><strong>${getUnscheduledMissions(app.state).length}</strong></div></section><div class="mc-projects-overview-grid">${projects.length ? projects.map(projectOverviewCard).join("") : '<section class="mc-empty-card"><h2>Todavía no hay proyectos.</h2><p>Crea un frente cuando necesites reunir objetivos, decisiones y misiones.</p></section>'}</div>`;
}

function renderUnscheduled() {
  const all = getUnscheduledMissions(app.state);
  const filtered = all.filter((quest) => {
    if (app.filters.project && quest.project_id !== app.filters.project) return false;
    if (app.filters.priority && quest.priority !== app.filters.priority) return false;
    return true;
  });
  const unassigned = all.filter((quest) => !quest.project_id).length;
  const projects = new Set(all.map((quest) => quest.project_id).filter(Boolean)).size;
  return `<section class="mc-page-head"><div><span class="mc-kicker">Planificar antes de calendarizar</span><h1>Sin fecha</h1><p>Trabajo abierto que todavía no necesita un día ni una hora.</p></div><div class="mc-page-actions">${missionViewSwitch()}<button class="mc-button mc-button--gold" type="button" data-capture="quest">${icon("plus")} Nueva misión</button></div></section><section class="mc-planning-summary"><div><span>Misiones abiertas</span><strong>${all.length}</strong></div><div><span>En proyectos</span><strong>${projects}</strong></div><div><span>Sin proyecto</span><strong>${unassigned}</strong></div></section><form class="mc-filters mc-filters--two" data-filters><label><span>Proyecto</span><select name="project"><option value="">Todos, incluido Sin proyecto</option>${app.state.projects.map((project) => `<option value="${escapeAttribute(project.id)}"${app.filters.project === project.id ? " selected" : ""}>${escapeHtml(project.title)}</option>`).join("")}</select></label><label><span>Prioridad</span><select name="priority"><option value="">Todas</option>${[["HIGH", "Alta"], ["NORMAL", "Normal"], ["LOW", "Baja"]].map(([value, label]) => `<option value="${value}"${app.filters.priority === value ? " selected" : ""}>${label}</option>`).join("")}</select></label></form>${missionRenderer(filtered)}`;
}

function renderDashboard() {
  const summary = getTodaySummary(app.state); const overdueIds = new Set(summary.overdue_missions.map((quest) => quest.id));
  const today = summary.missions.filter((quest) => !overdueIds.has(quest.id) && !questDone(quest));
  return `${notificationBanner()}${reminderInbox()}${attentionPanel()}<section class="mc-day-summary"><div><span class="mc-kicker">Ritmo del día</span><h1>${summary.completed}<span>/</span>${summary.total}</h1><p>${summary.total ? summary.pending ? `${summary.pending} por cerrar con calma.` : "Día despejado." : "Añade tu primera misión de hoy."}</p></div>${progressDots(summary)}<button class="mc-button mc-button--secondary" type="button" data-action="quick-open">${icon("plus")} Nueva misión</button></section>${mainQuestCard(summary)}${projectCockpitCards()}<div class="mc-two-column"><div>${missionGroup("Misiones de hoy", today)}${missionGroup("Completadas", summary.completed_missions, { hideEmpty: true })}</div><div>${calendarContext()}${missionGroup("Atrasadas", summary.overdue_missions, { overdue: true, hideEmpty: true })}${projectStrip()}</div></div>`;
}

function renderAllQuests() {
  const buckets = getMissionBuckets(app.state);
  const scheduleIds = app.filters.schedule === "today" ? new Set(buckets.today.map((quest) => quest.id)) : app.filters.schedule === "upcoming" ? new Set(buckets.upcoming.map((quest) => quest.id)) : app.filters.schedule === "unscheduled" ? new Set(buckets.unscheduled.map((quest) => quest.id)) : null;
  const filtered = app.state.quests.filter((quest) => {
    if (["ARCHIVED", "CANCELLED"].includes(quest.status)) return app.filters.status === "archived";
    if (app.filters.status === "done" && !questDone(quest)) return false;
    if (app.filters.status === "open" && questDone(quest)) return false;
    if (app.filters.project && quest.project_id !== app.filters.project) return false;
    if (app.filters.priority && quest.priority !== app.filters.priority) return false;
    if (scheduleIds && !scheduleIds.has(quest.id)) return false;
    const children = getQuestChildren(app.tree, quest.id);
    if (app.filters.level === "roots" && quest.parent_id) return false;
    if (app.filters.level === "branches" && !children.length) return false;
    if (app.filters.level === "leaves" && children.length) return false;
    return true;
  });
  return `<section class="mc-page-head"><div><span class="mc-kicker">Mission Grid</span><h1>Todas las misiones</h1><p>Trabajo de hoy, próximo y todavía sin calendarizar.</p></div><div class="mc-page-actions">${missionViewSwitch()}<button class="mc-button mc-button--gold" type="button" data-capture="quest">Nueva misión raíz</button></div></section><form class="mc-filters mc-filters--five" data-filters><label><span>Planificación</span><select name="schedule"><option value="all"${app.filters.schedule === "all" ? " selected" : ""}>Todas</option><option value="today"${app.filters.schedule === "today" ? " selected" : ""}>Hoy</option><option value="upcoming"${app.filters.schedule === "upcoming" ? " selected" : ""}>Próximas</option><option value="unscheduled"${app.filters.schedule === "unscheduled" ? " selected" : ""}>Sin fecha</option></select></label><label><span>Estado</span><select name="status"><option value="open"${app.filters.status === "open" ? " selected" : ""}>Pendientes</option><option value="done"${app.filters.status === "done" ? " selected" : ""}>Completadas</option><option value="all"${app.filters.status === "all" ? " selected" : ""}>Todas</option><option value="archived"${app.filters.status === "archived" ? " selected" : ""}>Archivadas</option></select></label><label><span>Proyecto</span><select name="project"><option value="">Todos</option>${app.state.projects.map((project) => `<option value="${escapeAttribute(project.id)}"${app.filters.project === project.id ? " selected" : ""}>${escapeHtml(project.title)}</option>`).join("")}</select></label><label><span>Prioridad</span><select name="priority"><option value="">Todas</option>${["HIGH", "NORMAL", "LOW"].map((priority) => `<option${app.filters.priority === priority ? " selected" : ""}>${priority}</option>`).join("")}</select></label><label><span>Nivel</span><select name="level"><option value="roots"${app.filters.level === "roots" ? " selected" : ""}>Solo raíces</option><option value="all"${app.filters.level === "all" ? " selected" : ""}>Todas</option><option value="branches"${app.filters.level === "branches" ? " selected" : ""}>Con submisiones</option><option value="leaves"${app.filters.level === "leaves" ? " selected" : ""}>Hojas</option></select></label></form>${missionRenderer(filtered)}`;
}

function ideaCard(idea) {
  const cooling = idea.status === "VAULT" && new Date(idea.cooldown_until) > new Date();
  return `<article class="mc-idea-card"><span class="mc-kicker">${escapeHtml(idea.status)}</span><h2>${escapeHtml(idea.title)}</h2><p>${escapeHtml(idea.description || "Sin notas adicionales.")}</p>${idea.tags?.length ? `<div class="mc-tags">${idea.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}<footer><small>${cooling ? `Disponible en ${relativeTime(idea.cooldown_until)}` : "Lista para evaluar"}</small><div>${!cooling && idea.status !== "CONVERTED" ? `<button type="button" data-idea-convert="${escapeAttribute(idea.id)}">Convertir</button>` : ""}${idea.status !== "DISCARDED" ? `<button type="button" data-idea-status="${escapeAttribute(idea.id)}" data-status="DISCARDED">Descartar</button>` : ""}</div></footer></article>`;
}

function renderIdeas() {
  const ideas = app.state.ideas.slice().sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
  return `<section class="mc-page-head"><div><span class="mc-kicker">Aparcar sin olvidar</span><h1>Idea Vault</h1><p>Las ideas esperan 72 horas antes de convertirse en otro frente.</p></div><button class="mc-button mc-button--gold" type="button" data-capture="idea">Guardar idea</button></section><div class="mc-idea-grid">${ideas.length ? ideas.map(ideaCard).join("") : '<div class="mc-empty-card"><h2>El Vault está vacío.</h2><p>Captura una idea sin interrumpir tu día.</p></div>'}</div>`;
}

const projectStatusLabel = (status) => ({ ACTIVE: "Activo", PAUSED: "Pausado", COMPLETED: "Completado", ARCHIVED: "Archivado", IDEA: "Idea" })[status] || status;
const healthLabel = (health) => ({ GREEN: "Salud verde", YELLOW: "Salud amarilla", RED: "Salud roja" })[health] || "Salud verde";

function cockpitField(project, field, label, value, empty = "Pulsa para definir") {
  return `<button class="mc-cockpit-field" type="button" data-project-field="${field}" data-project-id="${escapeAttribute(project.id)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || empty)}</strong><small>Editar</small></button>`;
}

function projectEntityForm(projectId, kind, placeholder, fields = "") {
  return `<form class="mc-entity-form" data-project-entity-form="${kind}"><input type="hidden" name="project_id" value="${escapeAttribute(projectId)}">${fields || `<label><span class="sr-only">${escapeAttribute(placeholder)}</span><input name="text" required maxlength="1200" placeholder="${escapeAttribute(placeholder)}"></label>`}<button type="submit" aria-label="Añadir">${icon("plus")}</button></form>`;
}

function projectLogsPanel(summary) {
  return `<section class="mc-cockpit-panel"><div class="mc-section-head"><div><span class="mc-kicker">Cronología propia</span><h2>Avances</h2></div><span>${summary.logs.length}</span></div>${projectEntityForm(summary.project.id, "log", "Añadir avance del proyecto")}<div class="mc-cockpit-feed">${summary.logs.length ? summary.logs.map((item) => `<article><time>${formatDate(item.created_at, { day: "numeric", month: "short" })}</time><p>${escapeHtml(item.text)}</p><button type="button" data-project-entity-delete="log" data-entity-id="${escapeAttribute(item.id)}">Eliminar</button></article>`).join("") : '<p class="mc-empty-inline">Todavía no hay avances del proyecto.</p>'}</div></section>`;
}

function achievementsPanel(summary) {
  return `<section class="mc-cockpit-panel"><div class="mc-section-head"><div><span class="mc-kicker">Hechos conseguidos</span><h2>Logros</h2></div><span>${summary.achievements.length}</span></div>${projectEntityForm(summary.project.id, "achievement", "Registrar un logro real")}<div class="mc-cockpit-feed">${summary.achievements.length ? summary.achievements.map((item) => `<article class="mc-achievement"><time>${formatDate(item.achieved_at || item.created_at, { day: "numeric", month: "short" })}</time><p>${escapeHtml(item.text)}</p><button type="button" data-project-entity-delete="achievement" data-entity-id="${escapeAttribute(item.id)}">Eliminar</button></article>`).join("") : '<p class="mc-empty-inline">Los hitos conseguidos quedarán aquí.</p>'}</div></section>`;
}

function decisionsPanel(summary) {
  const open = summary.decisions.filter((item) => item.status !== "RESOLVED");
  return `<section class="mc-cockpit-panel mc-signal-panel"><div class="mc-section-head"><div><span class="mc-kicker">Decision Queue</span><h2>Decisiones</h2></div><span>${open.length} abiertas</span></div>${projectEntityForm(summary.project.id, "decision", "¿Qué tienes que decidir?")}<div class="mc-signal-list">${summary.decisions.length ? summary.decisions.map((item) => `<article class="${item.status === "RESOLVED" ? "is-resolved" : ""}"><i></i><div><strong>${escapeHtml(item.text)}</strong>${item.resolution ? `<p><b>Decisión:</b> ${escapeHtml(item.resolution)}</p>` : ""}${item.resolution_notes ? `<small>${escapeHtml(item.resolution_notes)}</small>` : ""}</div><div>${item.status !== "RESOLVED" ? `<button type="button" data-resolve-decision="${escapeAttribute(item.id)}">Resolver</button>` : '<span>Resuelta</span>'}<button type="button" data-project-entity-delete="decision" data-entity-id="${escapeAttribute(item.id)}">×</button></div></article>`).join("") : '<p class="mc-empty-inline">No hay decisiones pendientes.</p>'}</div></section>`;
}

function blockersPanel(summary) {
  const open = summary.blockers.filter((item) => item.status !== "RESOLVED");
  return `<section class="mc-cockpit-panel mc-signal-panel"><div class="mc-section-head"><div><span class="mc-kicker">Fricción real</span><h2>Bloqueos</h2></div><span>${open.length} abiertos</span></div>${projectEntityForm(summary.project.id, "blocker", "Añadir bloqueo")}<div class="mc-signal-list">${summary.blockers.length ? summary.blockers.map((item) => `<article class="${item.status === "RESOLVED" ? "is-resolved" : ""}"><i></i><div><strong>${escapeHtml(item.text)}</strong><small>${item.status === "RESOLVED" ? "Resuelto" : formatDate(item.created_at, { day: "numeric", month: "short" })}</small></div><div>${item.status !== "RESOLVED" ? `<button type="button" data-resolve-blocker="${escapeAttribute(item.id)}">Resolver</button>` : ""}<button type="button" data-project-entity-delete="blocker" data-entity-id="${escapeAttribute(item.id)}">×</button></div></article>`).join("") : '<p class="mc-empty-inline">Sin bloqueos registrados.</p>'}</div></section>`;
}

function metricsPanel(summary) {
  const fields = `<label><span class="sr-only">Métrica</span><input name="name" required maxlength="120" placeholder="Métrica"></label><label><span class="sr-only">Valor</span><input name="value" maxlength="120" placeholder="Valor"></label><label><span class="sr-only">Objetivo</span><input name="target" maxlength="120" placeholder="Objetivo"></label><label><span class="sr-only">Unidad</span><input name="unit" maxlength="30" placeholder="Unidad"></label>`;
  return `<section class="mc-cockpit-panel"><div class="mc-section-head"><div><span class="mc-kicker">Medir, no ejecutar</span><h2>Métricas</h2></div><span>${summary.metrics.length}</span></div>${projectEntityForm(summary.project.id, "metric", "Métrica", fields)}<div class="mc-metrics-grid">${summary.metrics.length ? summary.metrics.map((metric) => `<article><span>${escapeHtml(metric.name)}</span><strong>${escapeHtml(metric.value || "—")}${metric.unit ? ` <small>${escapeHtml(metric.unit)}</small>` : ""}</strong>${metric.target !== null ? `<p>${escapeHtml(metric.value || "0")} / ${escapeHtml(metric.target)} ${escapeHtml(metric.unit || "")}</p>` : ""}<footer><button type="button" data-edit-metric="${escapeAttribute(metric.id)}">Actualizar</button><button type="button" data-project-entity-delete="metric" data-entity-id="${escapeAttribute(metric.id)}">Eliminar</button></footer></article>`).join("") : '<p class="mc-empty-inline">Añade la primera métrica.</p>'}</div></section>`;
}

function renderProjectDetail(project) {
  if (!project) return `<section class="mc-empty-card"><h1>Proyecto no encontrado</h1><a href="/control/" data-nav>Volver</a></section>`;
  const summary = getProjectSummary(app.state, project);
  const scheduled = getScheduledMissions(app.state, { projectId: project.id, rootsOnly: true });
  const unscheduled = getProjectUnscheduledMissions(app.state, project.id);
  return `<a class="mc-up-link" href="/control/projects/" data-nav>← Todos los proyectos</a><section class="mc-cockpit-hero"><div><span class="mc-kicker">Project Cockpit</span><h1>${escapeHtml(project.title)}</h1><p>${escapeHtml(project.description || project.general_objective || "Centro de mando del proyecto.")}</p><div class="mc-cockpit-badges"><span>${escapeHtml(projectStatusLabel(project.status))}</span><span><i class="mc-health-dot mc-health-dot--${project.health.toLowerCase()}"></i>${escapeHtml(healthLabel(project.health))}</span><span>${summary.quests.completed}/${summary.quests.total} misiones completadas</span><span>${summary.quests.unscheduled} sin fecha</span>${summary.quests.overdue ? `<span>${summary.quests.overdue} vencidas</span>` : ""}</div></div><button class="mc-button mc-button--secondary" type="button" data-edit-project="${escapeAttribute(project.id)}">Editar proyecto</button></section><section class="mc-focus-grid">${cockpitField(project, "current_focus", "Foco actual", project.current_focus)}${cockpitField(project, "weekly_objective", "Objetivo de esta semana", project.weekly_objective)}</section><section class="mc-project-missions"><div class="mc-section-head"><div><span class="mc-kicker">Calendarizadas</span><h2>Misiones programadas</h2></div><div><span>${scheduled.length} raíces</span><button class="mc-button mc-button--gold" type="button" data-capture="quest" data-project="${escapeAttribute(project.id)}">${icon("plus")} Misión</button></div></div>${missionGrid(scheduled, "No hay misiones programadas en este proyecto.")}</section><section class="mc-project-missions mc-project-unscheduled"><div class="mc-section-head"><div><span class="mc-kicker">Planificación abierta</span><h2>Misiones sin fecha</h2></div><div><span>${unscheduled.length} abiertas</span><a href="/control/unscheduled/" data-nav>Ver todas</a></div></div>${missionGrid(unscheduled, "Todo el trabajo de este proyecto ya está calendarizado.")}</section><div class="mc-cockpit-signals">${decisionsPanel(summary)}${blockersPanel(summary)}</div><div class="mc-cockpit-lower">${projectLogsPanel(summary)}${achievementsPanel(summary)}${metricsPanel(summary)}</div><section class="mc-project-direction"><div class="mc-section-head"><div><span class="mc-kicker">Dirección</span><h2>Contexto estratégico</h2></div></div><div>${cockpitField(project, "general_objective", "Objetivo general", project.general_objective)}${cockpitField(project, "next_milestone", "Próximo hito", project.next_milestone)}</div></section>`;
}

function breadcrumbMarkup(quest) {
  const path = getQuestPath(app.tree, quest.id);
  const project = projectFor(quest.project_id);
  return `<nav class="mc-breadcrumbs" aria-label="Ruta de la misión"><a href="/control/quests/" data-nav>Misiones</a>${project ? `<span aria-hidden="true">›</span><a class="mc-breadcrumb-project" href="/control/projects/${encodeURIComponent(project.id)}/" data-nav>${escapeHtml(project.title)}</a>` : ""}${path.map((item) => `<span aria-hidden="true">›</span><a href="/control/quests/${encodeURIComponent(item.id)}/" data-nav${item.id === quest.id ? ' aria-current="page"' : ""}>${escapeHtml(item.title)}</a>`).join("")}</nav>`;
}

function progressLogMarkup(quest) {
  const entries = app.state.progress_logs.filter((entry) => entry.quest_id === quest.id).sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
  return `<section class="mc-branch-card mc-progress-log"><div class="mc-section-head"><h2>Avances</h2><span>${entries.length}</span></div><form class="mc-progress-form" data-progress-form><input type="hidden" name="quest_id" value="${escapeAttribute(quest.id)}"><label><span class="sr-only">Nuevo avance</span><textarea name="text" required maxlength="3000" rows="2" placeholder="¿Qué ha avanzado?"></textarea></label><button class="mc-button mc-button--secondary" type="submit">Añadir avance</button></form><div class="mc-log-list">${entries.length ? entries.map((entry) => `<article><div><time>${formatDate(entry.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time><button type="button" data-delete-progress="${escapeAttribute(entry.id)}" aria-label="Eliminar avance">Eliminar</button></div><p>${escapeHtml(entry.text)}</p></article>`).join("") : '<p class="mc-empty-inline">Todavía no hay avances.</p>'}</div></section>`;
}

function renderQuestDetail(quest) {
  if (!quest || ["ARCHIVED", "CANCELLED"].includes(quest.status)) return `<section class="mc-empty-card"><h1>Misión no encontrada</h1><a href="/control/quests/" data-nav>Volver a Misiones</a></section>`;
  const parent = quest.parent_id ? app.tree.byId.get(quest.parent_id) : null;
  const children = sortedQuests(getQuestChildren(app.tree, quest.id));
  const direct = getDirectQuestProgress(app.tree, quest.id, questDone);
  const recursive = getRecursiveQuestProgress(app.tree, quest.id, questDone);
  const done = questDone(quest);
  return `${breadcrumbMarkup(quest)}<a class="mc-up-link" href="${parent ? `/control/quests/${encodeURIComponent(parent.id)}/` : quest.project_id ? `/control/projects/${encodeURIComponent(quest.project_id)}/` : "/control/quests/"}" data-nav>← Subir</a><section class="mc-branch-head"><div><span class="mc-kicker">${escapeHtml(projectLabel(quest.project_id))}</span><h1>${escapeHtml(quest.title)}</h1><div class="mc-branch-meta"><span class="mc-priority-label mc-priority-label--${quest.priority.toLowerCase()}">${quest.priority === "HIGH" ? "Alta" : quest.priority === "LOW" ? "Baja" : "Normal"}</span><span>${quest.status === "IN_PROGRESS" ? "En progreso" : done ? "Completada" : "Pendiente"}</span>${quest.scheduled_date ? `<span>${formatDate(`${quest.scheduled_date}T12:00:00Z`, { day: "numeric", month: "short" })}${quest.scheduled_time ? ` · ${quest.scheduled_time}` : ""}</span>` : '<span class="mc-unscheduled-label">Sin fecha</span>'}</div></div><div class="mc-branch-actions"><button class="mc-button mc-button--secondary" type="button" data-edit-quest="${escapeAttribute(quest.id)}">Editar</button><button class="mc-button mc-button--gold" type="button" data-quest-toggle="${escapeAttribute(quest.id)}">${done ? "Reabrir" : "Completar misión"}</button></div></section><div class="mc-branch-layout"><div class="mc-branch-primary"><section class="mc-branch-card"><div class="mc-section-head"><div><h2>Submisiones</h2>${direct.ready_to_complete && !done ? '<small>Lista para cerrar</small>' : ""}</div><span>${direct.completed}/${direct.total}</span></div><div class="mc-branch-grid-wrap">${missionGrid(children, "Esta misión todavía no tiene submisiones.")}</div><div class="mc-card-action"><button class="mc-button mc-button--gold" type="button" data-quick-parent="${escapeAttribute(quest.id)}">${icon("plus")} Añadir submisión</button></div></section>${progressLogMarkup(quest)}</div><aside class="mc-branch-side"><section class="mc-branch-card mc-branch-progress"><span class="mc-kicker">Progreso de la rama</span><strong>${recursive.completed}<i>/</i>${recursive.total}</strong><p>${recursive.pending ? `${recursive.pending} descendientes pendientes.` : recursive.total ? "Toda la rama ejecutada." : "Sin descendientes."}</p></section><section class="mc-branch-card mc-description"><div class="mc-section-head"><h2>Descripción</h2></div><p>${escapeHtml(quest.description || "Sin descripción. Edita la misión para añadir contexto estable.")}</p></section></aside></div>`;
}

function quickDialog() {
  const projects = app.state.projects.filter((project) => project.status !== "ARCHIVED").map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.title)}</option>`).join("");
  return `<dialog class="mc-dialog mc-quick-dialog" data-quick-dialog><form method="dialog" class="mc-dialog-head"><div><span class="mc-kicker">Quick Add</span><h2>Captura y sigue.</h2></div><button class="mc-icon-button" value="cancel" aria-label="Cerrar">${icon("close")}</button></form><form class="mc-quick-form" data-quick-form><input type="hidden" name="parent_id" value=""><p class="mc-quick-context" data-quick-context hidden></p><div class="mc-segmented"><label><input type="radio" name="quick_type" value="quest" checked><span>Misión</span></label><label><input type="radio" name="quick_type" value="idea"><span>Idea</span></label></div><label class="mc-field"><span>Título</span><input name="title" required maxlength="180" autofocus autocomplete="off" placeholder="¿Qué quieres capturar?"></label><p class="mc-quick-default">Se guardará en <strong>Sin fecha</strong>. Puedes calendarizarla cuando lo necesites.</p><details><summary>Añadir fecha, proyecto o prioridad</summary><div class="mc-form-grid"><label class="mc-field"><span>Fecha <small>opcional</small></span><input type="date" name="scheduled_date"></label><label class="mc-field"><span>Hora <small>opcional</small></span><input type="time" name="scheduled_time"></label><label class="mc-field"><span>Proyecto</span><select name="project_id"><option value="">Heredar / Sin proyecto</option>${projects}</select></label><label class="mc-field"><span>Prioridad</span><select name="priority"><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="LOW">Baja</option></select></label><label class="mc-field"><span>Recordatorio</span><select name="reminder_preset"><option value="none">Ninguno</option><option value="normal">Normal · 1 h antes</option><option value="important">Importante · 1 d, 2 h y 15 min</option></select></label></div></details><button class="mc-button mc-button--gold mc-button--wide" type="submit">Guardar misión</button><small class="mc-shortcut-hint">Q o Ctrl/⌘ K para abrir</small></form></dialog>`;
}

const editorDialog = () => '<dialog class="mc-dialog mc-editor-dialog" data-editor-dialog><div data-editor-content></div></dialog>';
function notificationDialog() {
  return `<dialog class="mc-dialog mc-notification-dialog" data-notification-dialog><form method="dialog" class="mc-dialog-head"><div><span class="mc-kicker">Recordatorios</span><h2>Avisos en este dispositivo</h2></div><button class="mc-icon-button" value="cancel" aria-label="Cerrar">${icon("close")}</button></form><div class="mc-dialog-copy"><p>Mission Control puede avisarte aunque esta pestaña no esté abierta, siempre que el navegador lo permita y el envío programado esté configurado.</p><p class="mc-fine-print">No se enviará nada sin tu permiso.</p><div class="mc-dialog-actions"><button class="mc-button mc-button--gold" type="button" data-action="notification-enable">Activar avisos</button><button class="mc-button mc-button--secondary" type="button" data-action="notification-later">Ahora no</button></div></div></dialog>`;
}
const limitDialog = () => '<dialog class="mc-dialog" data-limit-dialog><div class="mc-dialog-copy"><span class="mc-kicker">Límite de foco</span><h2>Demasiados proyectos activos.</h2><button class="mc-button mc-button--secondary" type="button" data-dialog-close>Cerrar</button></div></dialog>';
const archiveDialog = () => '<dialog class="mc-dialog" data-archive-dialog><div class="mc-dialog-copy"><span class="mc-kicker">Archivar misión</span><h2>Esta misión contiene submisiones.</h2><p>Elige qué debe ocurrir con su rama.</p><div class="mc-archive-actions"><button class="mc-button mc-button--danger" type="button" data-archive-mode="branch">Archivar toda la rama</button><button class="mc-button mc-button--secondary" type="button" data-archive-mode="promote_children">Archivar y subir hijos</button><button class="mc-text-button" type="button" data-dialog-close>Cancelar</button></div></div></dialog>';

const selected = (value, expected) => value === expected ? " selected" : "";
const checked = (value) => value ? " checked" : "";
function editorHeader(kicker, title) { return `<form method="dialog" class="mc-dialog-head"><div><span class="mc-kicker">${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2></div><button class="mc-icon-button" value="cancel" aria-label="Cerrar">${icon("close")}</button></form>`; }

function reminderChecks(quest) {
  const offsets = new Set((quest?.reminders || []).map((item) => Number(item.offset_minutes)));
  const known = new Set([1440, 120, 60, 15, 0]); const custom = [...offsets].find((offset) => !known.has(offset));
  return `<fieldset class="mc-reminder-options" data-reminder-picker><legend>Recordatorios</legend>${[[1440, "1 día antes"], [120, "2 horas antes"], [60, "1 hora antes"], [15, "15 minutos antes"], [0, "A la hora"]].map(([offset, label]) => `<label><input type="checkbox" name="reminder_offset" value="${offset}"${checked(offsets.has(offset))}><span>${label}</span></label>`).join("")}<label class="mc-custom-reminder"><span>Personalizado</span><input type="number" name="custom_reminder_offset" min="0" max="43200" value="${custom ?? ""}" placeholder="min antes"></label></fieldset>`;
}

function questEditor(quest = null, context = {}) {
  const recurrence = quest?.recurrence_type || "once"; const days = new Set(quest?.recurrence_config?.days || []);
  const projects = app.state.projects.map((project) => `<option value="${escapeAttribute(project.id)}"${selected(quest?.project_id || context.projectId, project.id)}>${escapeHtml(project.title)}</option>`).join("");
  return `${editorHeader(quest ? "Editar misión" : "Nueva misión", quest?.title || "Captura ahora, calendariza después")}<form class="mc-editor-form" data-editor-form="quest"><input type="hidden" name="id" value="${escapeAttribute(quest?.id || "")}"><label class="mc-field"><span>Título</span><input name="title" required maxlength="180" autofocus value="${escapeAttribute(quest?.title || "")}"></label><div class="mc-form-grid"><label class="mc-field"><span>Fecha <small>opcional</small></span><input name="scheduled_date" type="date" value="${escapeAttribute(quest?.scheduled_date || "")}"></label><label class="mc-field"><span>Hora <small>opcional</small></span><input name="scheduled_time" type="time" value="${escapeAttribute(quest?.scheduled_time || "")}"></label><label class="mc-field"><span>Proyecto</span><select name="project_id"><option value="">Sin proyecto</option>${projects}</select></label><label class="mc-field"><span>Prioridad</span><select name="priority"><option value="LOW"${selected(quest?.priority, "LOW")}>Baja</option><option value="NORMAL"${selected(quest?.priority || "NORMAL", "NORMAL")}>Normal</option><option value="HIGH"${selected(quest?.priority, "HIGH")}>Alta</option></select></label></div>${reminderChecks(quest)}<details class="mc-advanced"><summary>Repetición y detalles</summary><div class="mc-form-grid"><label class="mc-field"><span>Repetición</span><select name="recurrence_type" data-recurrence><option value="once"${selected(recurrence, "once")}>Una vez</option><option value="daily"${selected(recurrence, "daily")}>Cada día</option><option value="weekly"${selected(recurrence, "weekly")}>Días de la semana</option><option value="monthly"${selected(recurrence, "monthly")}>Cada mes</option><option value="interval"${selected(recurrence, "interval")}>Intervalo</option></select></label><label class="mc-field"><span>Termina</span><input name="recurrence_end_date" type="date" value="${escapeAttribute(quest?.recurrence_end_date || "")}"></label></div><div class="mc-recurrence-panel" data-recurrence-panel="weekly"><span>Días</span><div class="mc-weekdays">${[[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [7, "D"]].map(([day, label]) => `<label><input type="checkbox" name="recurrence_day" value="${day}"${checked(days.has(day))}><span>${label}</span></label>`).join("")}</div></div><div class="mc-recurrence-panel mc-form-grid" data-recurrence-panel="interval"><label class="mc-field"><span>Cada</span><input name="recurrence_interval" type="number" min="1" max="365" value="${quest?.recurrence_config?.interval || 2}"></label><label class="mc-field"><span>Unidad</span><select name="recurrence_unit"><option value="days"${selected(quest?.recurrence_config?.unit || "days", "days")}>Días</option><option value="weeks"${selected(quest?.recurrence_config?.unit, "weeks")}>Semanas</option><option value="months"${selected(quest?.recurrence_config?.unit, "months")}>Meses</option></select></label></div><label class="mc-field"><span>Descripción</span><textarea name="description" rows="3">${escapeHtml(quest?.description || "")}</textarea></label><div class="mc-form-grid"><label class="mc-field"><span>Estado</span><select name="status">${["ACTIVE", "IN_PROGRESS", "COMPLETED"].map((item) => `<option${selected(quest?.status || "ACTIVE", item)}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Categoría</span><select name="category">${["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"].map((item) => `<option${selected(quest?.category || "BUILD", item)}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>XP</span><input name="xp_reward" type="number" min="0" max="5000" value="${quest?.xp_reward ?? (context.main ? 100 : 30)}"></label><label class="mc-field"><span>Minutos</span><input name="estimated_minutes" type="number" min="0" max="1440" value="${quest?.estimated_minutes || ""}"></label></div></details><label class="mc-switch"><input type="checkbox" name="is_main_quest"${checked(quest?.is_main_quest || context.main)}><span>Usar como Main Quest</span></label><div class="mc-editor-actions">${quest && !questDone(quest) ? `<button class="mc-button mc-button--secondary" type="button" data-quest-toggle="${escapeAttribute(quest.id)}">Marcar hecha</button>` : ""}${quest ? `<button class="mc-button mc-button--danger" type="button" data-delete-quest="${escapeAttribute(quest.id)}">${icon("archive")} Archivar</button>` : ""}<button class="mc-button mc-button--gold" type="submit">${quest ? "Guardar cambios" : "Crear misión"}</button></div></form>`;
}

function ideaEditor() { return `${editorHeader("Idea Vault", "Captura sin abrir otro frente")}<form class="mc-editor-form" data-editor-form="idea"><label class="mc-field"><span>Título</span><input name="title" required autofocus></label><label class="mc-field"><span>Notas</span><textarea name="description" rows="4"></textarea></label><label class="mc-field"><span>Etiquetas</span><input name="tags" placeholder="ventas, contenido"></label><button class="mc-button mc-button--gold mc-button--wide" type="submit">Guardar en el Vault</button></form>`; }
function projectEditor(project = null) {
  return `${editorHeader(project ? "Editar proyecto" : "Nuevo proyecto", project?.title || "Abre un nuevo frente")}<form class="mc-editor-form" data-editor-form="project"><input type="hidden" name="id" value="${escapeAttribute(project?.id || "")}"><label class="mc-field"><span>Nombre</span><input name="title" required autofocus value="${escapeAttribute(project?.title || "")}"></label><label class="mc-field"><span>Descripción</span><textarea name="description" rows="2">${escapeHtml(project?.description || "")}</textarea></label><div class="mc-form-grid"><label class="mc-field"><span>Estado</span><select name="status">${["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].map((item) => `<option${selected(project?.status || "PAUSED", item)}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Salud</span><select name="health">${["GREEN", "YELLOW", "RED"].map((item) => `<option${selected(project?.health || "GREEN", item)}>${item}</option>`).join("")}</select></label></div><label class="mc-field"><span>Objetivo general</span><textarea name="general_objective" rows="2">${escapeHtml(project?.general_objective || project?.main_goal || "")}</textarea></label><label class="mc-field"><span>Objetivo de esta semana</span><textarea name="weekly_objective" rows="2">${escapeHtml(project?.weekly_objective || "")}</textarea></label><label class="mc-field"><span>Foco actual</span><input name="current_focus" value="${escapeAttribute(project?.current_focus || "")}"></label><div class="mc-form-grid"><label class="mc-field"><span>Próximo hito</span><input name="next_milestone" value="${escapeAttribute(project?.next_milestone || "")}"></label><label class="mc-field"><span>Fecha del hito</span><input name="next_milestone_date" type="date" value="${escapeAttribute(project?.next_milestone_date || "")}"></label></div><button class="mc-button mc-button--gold mc-button--wide" type="submit">${project ? "Guardar proyecto" : "Crear proyecto"}</button></form>`;
}

function syncRecurrencePanels(scope = document) { const recurrence = scope.querySelector("[data-recurrence]")?.value; scope.querySelectorAll("[data-recurrence-panel]").forEach((panel) => { panel.hidden = panel.dataset.recurrencePanel !== recurrence; }); const picker = scope.querySelector("[data-reminder-picker]"); if (picker) picker.hidden = !scope.querySelector('[name="scheduled_date"]')?.value || !scope.querySelector('[name="scheduled_time"]')?.value; }
function movePickerMarkup(quest) {
  if (!quest) return "";
  const options = app.state.quests
    .filter((candidate) => !["ARCHIVED", "CANCELLED"].includes(candidate.status) && canMoveQuest(app.tree, quest.id, candidate.id).allowed)
    .sort((left, right) => getQuestPath(app.tree, left.id).map((item) => item.title).join(" / ").localeCompare(getQuestPath(app.tree, right.id).map((item) => item.title).join(" / "), "es"))
    .map((candidate) => `<option value="${escapeAttribute(candidate.id)}"${selected(quest.parent_id, candidate.id)}>${escapeHtml(getQuestPath(app.tree, candidate.id).map((item) => item.title).join(" › "))}</option>`)
    .join("");
  return `<label class="mc-field mc-move-field"><span>Ubicación en el árbol</span><select name="move_parent_id"><option value=""${selected(quest.parent_id, null)}>Misión raíz</option>${options}</select></label>`;
}
function openEditor(type, context = {}) {
  document.querySelector("[data-quick-dialog]")?.close(); const dialog = document.querySelector("[data-editor-dialog]");
  if (type === "quest") {
    const quest = context.editId ? app.state.quests.find((item) => item.id === context.editId) : null;
    dialog.querySelector("[data-editor-content]").innerHTML = questEditor(quest, context);
    const advanced = dialog.querySelector(".mc-advanced");
    if (advanced && quest) advanced.insertAdjacentHTML("beforeend", movePickerMarkup(quest));
  }
  if (type === "idea") dialog.querySelector("[data-editor-content]").innerHTML = ideaEditor();
  if (type === "project") dialog.querySelector("[data-editor-content]").innerHTML = projectEditor(context.editId ? projectFor(context.editId) : null);
  dialog.showModal(); syncRecurrencePanels(dialog);
}

function openQuick(parentId = null, projectId = null) {
  const dialog = document.querySelector("[data-quick-dialog]");
  const form = dialog?.querySelector("[data-quick-form]");
  if (!dialog || !form) return;
  app.quickParentId = parentId && app.tree.byId.has(parentId) ? parentId : null;
  app.quickProjectId = projectId && projectFor(projectId) ? projectId : null;
  form.reset();
  form.elements.parent_id.value = app.quickParentId || "";
  form.elements.scheduled_date.value = "";
  form.elements.quick_type.value = "quest";
  if (app.quickProjectId) form.elements.project_id.value = app.quickProjectId;
  const context = form.querySelector("[data-quick-context]");
  if (app.quickParentId) {
    const parent = app.tree.byId.get(app.quickParentId);
    context.hidden = false;
    context.textContent = `Nueva submisión dentro de ${parent.title}`;
  } else if (app.quickProjectId) {
    context.hidden = false;
    context.textContent = `Nueva misión dentro de ${projectFor(app.quickProjectId).title}`;
  } else {
    context.hidden = true;
    context.textContent = "";
  }
  dialog.showModal();
  form.elements.title.focus();
}

function toast(message, tone = "success") {
  const region = document.querySelector("[data-toasts]"); if (!region) return;
  const item = document.createElement("div"); item.className = `mc-toast mc-toast--${tone}`; item.textContent = message; region.append(item); setTimeout(() => item.remove(), 3600);
}

async function mutate(action, payload, { success = "Guardado", optimistic = false, quiet = false } = {}) {
  const request = { action, payload, operation_id: operationId(), expected_revision: app.revision };
  const previous = optimistic ? { state: structuredClone(app.state), revision: app.revision } : null;
  try {
    if (optimistic) { app.state = applyControlMutation(app.state, request, { userId: app.state.user_id, now: Date.now() }).state; render(); }
    let response;
    if (app.localPreview) {
      if (!optimistic) app.state = applyControlMutation(app.state, request, { userId: "demo", now: Date.now() }).state;
      app.revision += 1; response = { state: app.state, revision: app.revision }; localStorage.setItem("ivanimports.mission-control.local-demo.v5", JSON.stringify(response));
    } else response = await fetchJson(API.mutate, { method: "POST", body: JSON.stringify(request) });
    app.state = response.state; app.revision = response.revision; render(); if (success && !quiet) toast(success); return response;
  } catch (error) {
    if (previous) { app.state = previous.state; app.revision = previous.revision; render(); }
    if (error.status === 409 && error.body?.state) { app.state = error.body.state; app.revision = error.body.revision; render(); toast("El mapa se actualizó desde otra pestaña.", "warning"); return null; }
    toast(error.message === "idea_cooldown_active" ? "La idea sigue en pausa de 72 horas." : "No se pudo guardar.", "error"); throw error;
  }
}

function render() {
  app.route ||= parseRoute(); app.tree = buildQuestTreeIndex(app.state.quests); let content = renderDashboard();
  if (app.route.name === "quests") content = renderAllQuests();
  if (app.route.name === "projects") content = renderProjects();
  if (app.route.name === "unscheduled") content = renderUnscheduled();
  if (app.route.name === "quest") content = renderQuestDetail(app.tree.byId.get(app.route.id));
  if (app.route.name === "ideas") content = renderIdeas();
  if (app.route.name === "project") content = renderProjectDetail(projectFor(app.route.id));
  app.root.innerHTML = appShell(content); app.root.removeAttribute("aria-busy");
  const title = app.route.name === "dashboard" ? "Hoy" : app.route.name === "quests" ? "Misiones" : app.route.name === "projects" ? "Proyectos" : app.route.name === "unscheduled" ? "Sin fecha" : app.route.name === "quest" ? app.tree.byId.get(app.route.id)?.title || "Misión" : app.route.name === "ideas" ? "Idea Vault" : projectFor(app.route.id)?.title || "Proyecto";
  document.title = `${title} · Mission Control`;
}

function renderLogin() {
  app.root.innerHTML = `<main class="mc-auth"><section class="mc-auth-card"><div class="mc-brand"><span class="mc-brand-mark">MC</span><span><strong>Mission Control</strong><small>Acceso privado</small></span></div><span class="mc-kicker">Identificación requerida</span><h1>Vuelve a tu mapa.</h1><p>Introduce tu código de acceso.</p><form class="mc-auth-form" data-control-login><label class="mc-field"><span>Código</span><input type="password" name="code" required autocomplete="current-password" autofocus maxlength="128"></label><button class="mc-button mc-button--gold mc-button--wide">Entrar</button></form><p class="mc-auth-status" data-auth-status aria-live="polite"></p></section></main>`; app.root.removeAttribute("aria-busy");
}

const formObject = (form) => Object.fromEntries(new FormData(form).entries());
function reminderPayload(form) { const offsets = new FormData(form).getAll("reminder_offset").map(Number); const custom = Number(form.elements.custom_reminder_offset?.value); if (Number.isFinite(custom) && form.elements.custom_reminder_offset?.value !== "") offsets.push(custom); return [...new Set(offsets)].map((offset_minutes) => ({ offset_minutes })); }
function recurrencePayload(form, data) {
  if (data.recurrence_type === "weekly") return { days: new FormData(form).getAll("recurrence_day").map(Number) };
  if (data.recurrence_type === "monthly") return { day: Number(String(data.scheduled_date || "01").slice(-2)) };
  if (data.recurrence_type === "interval") return { interval: Number(data.recurrence_interval) || 1, unit: data.recurrence_unit || "days" };
  return {};
}
function presetReminders(value) { return value === "normal" ? [{ offset_minutes: 60 }] : value === "important" ? [1440, 120, 15].map((offset_minutes) => ({ offset_minutes })) : []; }

async function handleSubmit(event) {
  const login = event.target.closest("[data-control-login]");
  if (login) {
    event.preventDefault(); const status = login.querySelector("[data-auth-status]") || document.querySelector("[data-auth-status]"); login.querySelector("button").disabled = true; status.textContent = "Comprobando…";
    try { await fetchJson(API.login, { method: "POST", body: JSON.stringify({ code: formObject(login).code }) }); location.assign("/control/"); } catch { status.textContent = "Código incorrecto."; login.querySelector("button").disabled = false; } return;
  }
  const quick = event.target.closest("[data-quick-form]");
  if (quick) {
    event.preventDefault(); const data = formObject(quick);
    if (data.quick_type === "idea") await mutate("idea.create", { title: data.title, source: "quick-add" }, { success: "Idea guardada en el Vault" });
    else { const scheduledDate = data.scheduled_date || null; const scheduledTime = scheduledDate && data.scheduled_time ? data.scheduled_time : null; const reminders = scheduledTime ? presetReminders(data.reminder_preset) : []; const payload = { title: data.title, parent_id: data.parent_id || null, scheduled_date: scheduledDate, scheduled_time: scheduledTime, priority: data.priority || "NORMAL", reminders, timezone: app.timezone, source: "quick-add" }; if (!data.parent_id || data.project_id) payload.project_id = data.project_id || null; await mutate("quest.create", payload, { success: data.parent_id ? "Submisión añadida" : scheduledDate ? "Misión calendarizada" : "Misión guardada en Sin fecha" }); if (reminders.length) maybeOfferNotifications(); }
    document.querySelector("[data-quick-dialog]")?.close(); return;
  }
  const progress = event.target.closest("[data-progress-form]");
  if (progress) { event.preventDefault(); const data = formObject(progress); await mutate("progress.create", data, { success: "Avance añadido" }); return; }
  const projectEntity = event.target.closest("[data-project-entity-form]");
  if (projectEntity) {
    event.preventDefault(); const data = formObject(projectEntity); const kind = projectEntity.dataset.projectEntityForm;
    const actions = { log: "project.log.add", achievement: "project.achievement.add", decision: "project.decision.add", blocker: "project.blocker.add", metric: "project.metric.add" };
    await mutate(actions[kind], data, { success: kind === "decision" ? "Decisión añadida" : kind === "blocker" ? "Bloqueo añadido" : kind === "achievement" ? "Logro registrado" : kind === "metric" ? "Métrica añadida" : "Avance añadido" }); return;
  }
  const editor = event.target.closest("[data-editor-form]"); if (!editor) return; event.preventDefault(); const data = formObject(editor);
  if (editor.dataset.editorForm === "quest") {
    const original = data.id ? app.state.quests.find((quest) => quest.id === data.id) : null;
    const moveParentId = data.move_parent_id || null; delete data.move_parent_id;
    data.project_id ||= null; data.scheduled_date ||= null; data.scheduled_time = data.scheduled_date && data.scheduled_time ? data.scheduled_time : null; data.recurrence_end_date ||= null; data.xp_reward = Number(data.xp_reward) || 0; data.estimated_minutes = Number(data.estimated_minutes) || null; data.is_main_quest = editor.elements.is_main_quest.checked; data.reminders = data.scheduled_date && data.scheduled_time ? reminderPayload(editor) : []; data.recurrence_config = recurrencePayload(editor, data); data.timezone = app.timezone;
    const shouldComplete = Boolean(data.id && data.status === "COMPLETED" && !questDone(app.state.quests.find((quest) => quest.id === data.id)));
    if (shouldComplete) data.status = "ACTIVE";
    await mutate(data.id ? "quest.update" : "quest.create", data, { success: shouldComplete ? "" : data.id ? "Misión actualizada" : "Misión creada" });
    if (original && moveParentId !== (original.parent_id || null)) await mutate("quest.move", { id: original.id, parent_id: moveParentId }, { success: "Misión movida" });
    if (shouldComplete) await mutate("quest.complete", { id: data.id }, { success: `Misión completada · +${data.xp_reward} XP`, optimistic: true });
    if (data.reminders.length) maybeOfferNotifications();
  }
  if (editor.dataset.editorForm === "idea") { data.tags = String(data.tags || "").split(",").map((item) => item.trim()).filter(Boolean); await mutate("idea.create", data, { success: "Idea guardada en el Vault" }); }
  if (editor.dataset.editorForm === "project") { const creating = !data.id; await mutate(creating ? "project.create" : "project.update", data, { success: creating ? "Proyecto creado" : "Proyecto actualizado" }); }
  document.querySelector("[data-editor-dialog]")?.close();
}

function maybeOfferNotifications() {
  if (!app.localPreview && !app.state.preferences?.notifications_enabled && !app.state.preferences?.notification_prompt_dismissed) document.querySelector("[data-notification-dialog]")?.showModal();
}
function base64ToBytes(value) { const padding = "=".repeat((4 - (value.length % 4)) % 4); const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
async function registerServiceWorker() { return "serviceWorker" in navigator ? navigator.serviceWorker.register("/control/sw.js", { scope: "/control/" }) : null; }
async function enableNotifications() {
  if (!("Notification" in window) || !("PushManager" in window)) throw new Error("push_unsupported");
  if (await Notification.requestPermission() !== "granted") { await mutate("preferences.update", { notification_prompt_dismissed: true }, { quiet: true }); throw new Error("permission_denied"); }
  const config = await fetchJson(API.pushConfig); if (!config.available || !config.public_key) throw new Error("push_not_configured");
  const registration = await registerServiceWorker(); const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(config.public_key) });
  await mutate("push.subscribe", { ...subscription.toJSON(), user_agent: navigator.userAgent }, { success: "Avisos activados" });
}

async function handleClick(event) {
  const nav = event.target.closest("[data-nav]"); if (nav && nav.origin === location.origin && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); navigate(`${nav.pathname}${nav.search}`); return; }
  if (event.target.closest("[data-dialog-close]")) { event.target.closest("dialog")?.close(); return; }
  if (event.target.closest("[data-action='quick-open']")) { openQuick(app.route.name === "quest" ? app.route.id : null, app.route.name === "project" ? app.route.id : null); return; }
  if (event.target.closest("[data-action='notification-open']")) { document.querySelector("[data-notification-dialog]")?.showModal(); return; }
  if (event.target.closest("[data-action='notification-later']")) { document.querySelector("[data-notification-dialog]")?.close(); await mutate("preferences.update", { notification_prompt_dismissed: true }, { quiet: true }); return; }
  if (event.target.closest("[data-action='notification-enable']")) { const button = event.target.closest("button"); button.disabled = true; try { await enableNotifications(); document.querySelector("[data-notification-dialog]")?.close(); } catch (error) { toast(error.message === "push_not_configured" ? "El envío programado aún no está configurado." : "No se pudieron activar los avisos.", "warning"); button.disabled = false; } return; }
  const view = event.target.closest("[data-mission-view]"); if (view) { app.missionView = view.dataset.missionView; if (app.missionView === "tree" && app.filters.level === "roots") app.filters.level = "all"; localStorage.setItem("ivanimports.mission-control.mission-view", app.missionView); render(); return; }
  const capture = event.target.closest("[data-capture]"); if (capture) { const type = capture.dataset.capture === "project-new" ? "project" : capture.dataset.capture; openEditor(type, { main: capture.dataset.main === "true", projectId: capture.dataset.project || "" }); return; }
  const quickParent = event.target.closest("[data-quick-parent]"); if (quickParent) { openQuick(quickParent.dataset.quickParent); return; }
  const openQuest = event.target.closest("[data-open-quest]"); if (openQuest) { navigate(`/control/quests/${encodeURIComponent(openQuest.dataset.openQuest)}/`); return; }
  const editQuest = event.target.closest("[data-edit-quest]"); if (editQuest) { openEditor("quest", { editId: editQuest.dataset.editQuest }); return; }
  const editProject = event.target.closest("[data-edit-project]"); if (editProject) { openEditor("project", { editId: editProject.dataset.editProject }); return; }
  const projectField = event.target.closest("[data-project-field]"); if (projectField) { const project = projectFor(projectField.dataset.projectId); const labels = { current_focus: "Foco actual", weekly_objective: "Objetivo de esta semana", general_objective: "Objetivo general", next_milestone: "Próximo hito" }; const value = prompt(labels[projectField.dataset.projectField], project?.[projectField.dataset.projectField] || ""); if (value === null) return; await mutate("project.update", { id: project.id, [projectField.dataset.projectField]: value }, { success: "Proyecto actualizado" }); return; }
  const resolveDecision = event.target.closest("[data-resolve-decision]"); if (resolveDecision) { const resolution = prompt("Decisión tomada", ""); if (resolution === null) return; const notes = prompt("Motivo o notas (opcional)", "") || ""; await mutate("project.decision.resolve", { id: resolveDecision.dataset.resolveDecision, resolution, resolution_notes: notes }, { success: "Decisión resuelta" }); return; }
  const resolveBlocker = event.target.closest("[data-resolve-blocker]"); if (resolveBlocker) { await mutate("project.blocker.resolve", { id: resolveBlocker.dataset.resolveBlocker }, { success: "Bloqueo resuelto" }); return; }
  const editMetric = event.target.closest("[data-edit-metric]"); if (editMetric) { const metric = app.state.project_metrics.find((item) => item.id === editMetric.dataset.editMetric); const value = prompt(`Nuevo valor para ${metric.name}`, metric.value || ""); if (value === null) return; await mutate("project.metric.update", { id: metric.id, value }, { success: "Métrica actualizada" }); return; }
  const entityDelete = event.target.closest("[data-project-entity-delete]"); if (entityDelete) { if (!confirm("¿Eliminar este elemento?")) return; const actions = { log: "project.log.delete", achievement: "project.achievement.delete", decision: "project.decision.delete", blocker: "project.blocker.delete", metric: "project.metric.delete" }; await mutate(actions[entityDelete.dataset.projectEntityDelete], { id: entityDelete.dataset.entityId }, { success: "Elemento eliminado" }); return; }
  const toggle = event.target.closest("[data-quest-toggle]"); if (toggle) { const quest = app.state.quests.find((item) => item.id === toggle.dataset.questToggle); const done = questDone(quest); const branch = getRecursiveQuestProgress(app.tree, quest.id, questDone); if (!done && branch.pending && !confirm(`Esta misión tiene ${branch.pending} submisiones pendientes. ¿Completar solo esta misión?`)) return; await mutate(done ? "quest.undo" : "quest.complete", { id: quest.id, period_key: questPeriodKey(quest) }, { success: done ? "Misión reabierta" : `Misión completada · +${quest.xp_reward} XP`, optimistic: true }); return; }
  const deletion = event.target.closest("[data-delete-quest]"); if (deletion) { const children = getQuestChildren(app.tree, deletion.dataset.deleteQuest); if (children.length) { app.pendingArchiveId = deletion.dataset.deleteQuest; document.querySelector("[data-archive-dialog]")?.showModal(); return; } if (!confirm("¿Archivar esta misión? Sus recordatorios se cancelarán.")) return; const quest = app.tree.byId.get(deletion.dataset.deleteQuest); await mutate("quest.delete", { id: deletion.dataset.deleteQuest }, { success: "Misión archivada" }); document.querySelector("[data-editor-dialog]")?.close(); if (app.route.name === "quest" && app.route.id === quest.id) navigate(quest.parent_id ? `/control/quests/${encodeURIComponent(quest.parent_id)}/` : "/control/quests/"); return; }
  const archiveMode = event.target.closest("[data-archive-mode]"); if (archiveMode && app.pendingArchiveId) { const quest = app.tree.byId.get(app.pendingArchiveId); const destination = quest?.parent_id ? `/control/quests/${encodeURIComponent(quest.parent_id)}/` : "/control/quests/"; await mutate("quest.delete", { id: app.pendingArchiveId, mode: archiveMode.dataset.archiveMode }, { success: archiveMode.dataset.archiveMode === "branch" ? "Rama archivada" : "Misión archivada; hijos promovidos" }); app.pendingArchiveId = null; document.querySelector("[data-archive-dialog]")?.close(); document.querySelector("[data-editor-dialog]")?.close(); if (app.route.name === "quest") navigate(destination); return; }
  const deleteProgress = event.target.closest("[data-delete-progress]"); if (deleteProgress) { if (!confirm("¿Eliminar este avance?")) return; await mutate("progress.delete", { id: deleteProgress.dataset.deleteProgress }, { success: "Avance eliminado" }); return; }
  const snooze = event.target.closest("[data-reminder-snooze]"); if (snooze) { const minutes = snooze.dataset.minutes === "custom" ? Number(prompt("¿Cuántos minutos quieres posponer?", "30")) : Number(snooze.dataset.minutes); if (!Number.isFinite(minutes) || minutes < 1) return; await mutate("reminder.snooze", { id: snooze.dataset.reminderSnooze, minutes }, { success: `Pospuesto ${minutes} min` }); return; }
  const dismiss = event.target.closest("[data-reminder-dismiss]"); if (dismiss) { await mutate("reminder.dismiss", { id: dismiss.dataset.reminderDismiss }, { success: "Recordatorio cerrado" }); return; }
  const convert = event.target.closest("[data-idea-convert]"); if (convert) { await mutate("idea.convert", { id: convert.dataset.ideaConvert }, { success: "Idea convertida en proyecto" }); return; }
  const ideaStatus = event.target.closest("[data-idea-status]"); if (ideaStatus) { await mutate("idea.update", { id: ideaStatus.dataset.ideaStatus, status: ideaStatus.dataset.status }, { success: "Idea actualizada" }); return; }
  if (event.target.closest("[data-action='demo-reset']")) { if (!confirm("¿Restaurar la demo?")) return; if (app.localPreview) { app.state = createDemoControlState("demo"); app.revision += 1; localStorage.removeItem("ivanimports.mission-control.local-demo.v5"); render(); } else { const response = await fetchJson(API.demoReset, { method: "POST", body: "{}" }); app.state = response.state; app.revision = response.revision; render(); } toast("Demo restaurada"); }
}

function handleChange(event) {
  const filters = event.target.closest("[data-filters]"); if (filters) { app.filters = { ...app.filters, ...formObject(filters) }; render(); return; }
  if (event.target.matches("[data-recurrence], [name='scheduled_date'], [name='scheduled_time']")) syncRecurrencePanels(event.target.closest("form"));
}

async function checkInAppReminders() {
  if (app.checkingReminders || !app.state || document.hidden) return; const candidates = buildReminderCandidates(app.state, Date.now(), { horizonDays: 1 }); if (!candidates.length) return; app.checkingReminders = true;
  try { if (globalThis.Notification?.permission === "granted") for (const candidate of candidates) new Notification(candidate.title, { body: "Tienes una misión pendiente.", icon: "/favicon.svg", tag: candidate.schedule_key }); await mutate("reminder.mark-delivered", { deliveries: candidates }, { quiet: true }); } finally { app.checkingReminders = false; }
}
async function refreshState() {
  if (app.localPreview || !app.session?.authenticated || document.hidden) return;
  try { const payload = await fetchJson(API.state); if (payload.revision !== app.revision) { app.state = payload.state; app.revision = payload.revision; render(); } await checkInAppReminders(); } catch { /* retry later */ }
}

async function boot() {
  app.route = parseRoute(document.body.dataset.controlRoute || location.pathname);
  try {
    if (app.localPreview) { const saved = JSON.parse(localStorage.getItem("ivanimports.mission-control.local-demo.v5") || localStorage.getItem("ivanimports.mission-control.local-demo.v4") || localStorage.getItem("ivanimports.mission-control.local-demo.v3") || localStorage.getItem("ivanimports.mission-control.local-demo.v2") || "null"); app.session = { authenticated: true, user: { demo: true } }; app.state = normalizeControlState(saved?.state || createDemoControlState("demo"), "demo", { now: Date.now() }); app.revision = saved?.revision || 0; render(); return; }
    app.session = await fetchJson(API.session); if (!app.session.authenticated) { renderLogin(); return; }
    const payload = await fetchJson(API.state); app.state = payload.state; app.revision = payload.revision; render(); registerServiceWorker().catch(() => {});
    if (app.state.preferences?.timezone !== app.timezone) await mutate("preferences.update", { timezone: app.timezone }, { quiet: true });
    checkInAppReminders().catch(() => {});
  } catch { app.root.innerHTML = '<main class="mc-auth"><section class="mc-auth-card"><span class="mc-kicker">Sin conexión</span><h1>No hemos podido abrir tu mapa.</h1><p>Comprueba la conexión.</p><button class="mc-button mc-button--gold" type="button" onclick="location.reload()">Reintentar</button></section></main>'; }
}

document.addEventListener("click", (event) => { handleClick(event).catch(() => {}); });
document.addEventListener("submit", (event) => { handleSubmit(event).catch(() => {}); });
document.addEventListener("change", handleChange);
window.addEventListener("popstate", () => { app.route = parseRoute(); render(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshState(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openQuick(app.route.name === "quest" ? app.route.id : null, app.route.name === "project" ? app.route.id : null); return; }
  if (!editing) { if (event.key === "1") navigate("/control/"); if (event.key === "2") navigate("/control/quests/"); if (event.key === "3") navigate("/control/projects/"); if (event.key === "4") navigate("/control/unscheduled/"); if (event.key === "5") navigate("/control/ideas/"); if (event.key.toLowerCase() === "q") openQuick(app.route.name === "quest" ? app.route.id : null, app.route.name === "project" ? app.route.id : null); }
});
setInterval(refreshState, 5 * 60 * 1000); setInterval(checkInAppReminders, 60 * 1000);
boot();
