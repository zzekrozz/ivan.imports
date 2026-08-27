import {
  applyControlMutation, buildReminderCandidates, createDemoControlState, dateKey,
  getActionableReminders, getLevelProgress, getTodaySummary, projectProgress,
  questCompletedForPeriod, questPeriodKey,
} from "./domain.js";

const API = {
  session: "/api/control/session", state: "/api/control/state", mutate: "/api/control/mutate",
  demoReset: "/api/control/demo-reset", login: "/api/control/login", pushConfig: "/api/control/push-config",
};

const app = {
  root: document.querySelector("[data-control-app]"), state: null, revision: 0, session: null, route: null,
  localPreview: ["localhost", "127.0.0.1", "::1"].includes(location.hostname) && new URLSearchParams(location.search).get("demo") === "1",
  filters: { project: "", priority: "", status: "open" },
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Madrid", checkingReminders: false,
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
  if (path === "/control/quests") return { name: "quests" };
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
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.today}</svg>`;
}

function levelBlock() {
  const progress = getLevelProgress(app.state.user_game_stats.total_xp);
  return `<div class="mc-level"><span>Nivel ${progress.level}</span><strong>${formatNumber(progress.totalXp)} XP</strong><div class="mc-line-progress"><i style="width:${progress.percent}%"></i></div><small>Racha · ${app.state.user_game_stats.current_streak} días</small></div>`;
}

function appShell(content) {
  const route = app.route.name;
  const title = route === "dashboard" ? "Hoy" : route === "quests" ? "Misiones" : route === "ideas" ? "Idea Vault" : projectFor(app.route.id)?.title || "Proyecto";
  return `<div class="mc-app"><aside class="mc-sidebar"><a class="mc-brand" href="/control/" data-nav><span class="mc-brand-mark">MC</span><span><strong>Mission Control</strong><small>Studio Nocturno</small></span></a><nav class="mc-nav" aria-label="Navegación principal"><a href="/control/" data-nav class="${route === "dashboard" ? "is-active" : ""}">${icon("today")}<span>Hoy</span><kbd>1</kbd></a><a href="/control/quests/" data-nav class="${route === "quests" ? "is-active" : ""}">${icon("check")}<span>Misiones</span><kbd>2</kbd></a><a href="/control/ideas/" data-nav class="${route === "ideas" ? "is-active" : ""}">${icon("idea")}<span>Idea Vault</span><kbd>3</kbd></a></nav><div class="mc-sidebar-foot">${levelBlock()}${app.session?.user?.demo ? '<button class="mc-text-button" type="button" data-action="demo-reset">Restaurar demo</button>' : ""}</div></aside><section class="mc-workspace"><header class="mc-topbar"><div><span class="mc-eyebrow">${formatDate(Date.now(), { weekday: "long", day: "numeric", month: "long" })}</span><strong>${escapeHtml(title)}</strong></div><button class="mc-quick-button" type="button" data-action="quick-open">${icon("plus")}<span>Añadir</span><kbd>Q</kbd></button></header><main id="mc-main" class="mc-main">${content}</main></section><button class="mc-fab" type="button" data-action="quick-open" aria-label="Añadir rápidamente">${icon("plus")}</button>${quickDialog()}${editorDialog()}${notificationDialog()}${limitDialog()}<div class="mc-toasts" data-toasts aria-live="polite"></div></div>`;
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

function questRow(quest, { overdue = false } = {}) {
  const done = questDone(quest); const reminderCount = quest.reminders?.filter((item) => item.enabled !== false).length || 0;
  const schedule = quest.scheduled_time || (overdue ? formatDate(`${quest.scheduled_date}T12:00:00Z`, { day: "2-digit", month: "short" }) : "—");
  return `<article class="mc-mission-row ${done ? "is-complete" : ""} ${overdue ? "is-overdue" : ""}"><button class="mc-check" type="button" data-quest-toggle="${escapeAttribute(quest.id)}" aria-label="${done ? "Reabrir" : "Completar"}"><span>${done ? "✓" : ""}</span></button><button class="mc-mission-copy" type="button" data-edit-quest="${escapeAttribute(quest.id)}"><strong>${escapeHtml(quest.title)}</strong><small><span>${escapeHtml(projectLabel(quest.project_id))}</span><span class="mc-priority mc-priority--${quest.priority.toLowerCase()}">${quest.priority === "HIGH" ? "Alta" : quest.priority === "LOW" ? "Baja" : "Normal"}</span>${quest.recurrence_type !== "once" ? `<span>${escapeHtml(recurrenceLabel(quest))}</span>` : ""}</small></button><div class="mc-mission-meta"><time>${escapeHtml(schedule)}</time>${reminderCount ? `<span>${icon("bell")}${reminderCount}</span>` : ""}</div></article>`;
}

function missionGroup(title, quests, options = {}) {
  if (!quests.length) return options.hideEmpty ? "" : `<section class="mc-panel"><div class="mc-section-head"><h2>${escapeHtml(title)}</h2></div><div class="mc-empty-inline">Nada pendiente aquí.</div></section>`;
  return `<section class="mc-panel"><div class="mc-section-head"><h2>${escapeHtml(title)}</h2><span>${quests.length}</span></div><div class="mc-mission-list">${quests.map((quest) => questRow(quest, options)).join("")}</div></section>`;
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
  return `<section class="mc-main-quest"><div><span class="mc-kicker">Main Quest</span><h2>${escapeHtml(quest.title)}</h2><p>${escapeHtml(quest.description || `${projectLabel(quest.project_id)} · ${quest.xp_reward} XP`)}</p></div><div class="mc-main-actions">${dueToday ? `<button class="mc-button mc-button--gold" type="button" data-quest-toggle="${escapeAttribute(quest.id)}">${questDone(quest) ? "Reabrir" : "Completar"}</button>` : ""}<button class="mc-icon-button" type="button" data-edit-quest="${escapeAttribute(quest.id)}">${icon("edit")}</button></div></section>`;
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

function renderDashboard() {
  const summary = getTodaySummary(app.state); const overdueIds = new Set(summary.overdue_missions.map((quest) => quest.id));
  const today = summary.missions.filter((quest) => !overdueIds.has(quest.id) && !questDone(quest));
  return `${notificationBanner()}${reminderInbox()}<section class="mc-day-summary"><div><span class="mc-kicker">Ritmo del día</span><h1>${summary.completed}<span>/</span>${summary.total}</h1><p>${summary.total ? summary.pending ? `${summary.pending} por cerrar con calma.` : "Día despejado." : "Añade tu primera misión de hoy."}</p></div>${progressDots(summary)}<button class="mc-button mc-button--secondary" type="button" data-action="quick-open">${icon("plus")} Nueva misión</button></section>${mainQuestCard(summary)}<div class="mc-two-column"><div>${missionGroup("Misiones de hoy", today)}${missionGroup("Completadas", summary.completed_missions, { hideEmpty: true })}</div><div>${calendarContext()}${missionGroup("Atrasadas", summary.overdue_missions, { overdue: true, hideEmpty: true })}${projectStrip()}</div></div>`;
}

function renderAllQuests() {
  const filtered = app.state.quests.filter((quest) => {
    if (["ARCHIVED", "CANCELLED"].includes(quest.status)) return app.filters.status === "archived";
    if (app.filters.status === "done" && !questDone(quest)) return false;
    if (app.filters.status === "open" && questDone(quest)) return false;
    if (app.filters.project && quest.project_id !== app.filters.project) return false;
    return !app.filters.priority || quest.priority === app.filters.priority;
  }).sort((left, right) => String(left.scheduled_date || "9999").localeCompare(String(right.scheduled_date || "9999")) || String(left.scheduled_time || "99:99").localeCompare(String(right.scheduled_time || "99:99")));
  return `<section class="mc-page-head"><div><span class="mc-kicker">Sistema de ejecución</span><h1>Todas las misiones</h1><p>Una sola lista, filtrada por lo que importa ahora.</p></div><button class="mc-button mc-button--gold" type="button" data-capture="quest">Nueva misión</button></section><form class="mc-filters" data-filters><label><span>Estado</span><select name="status"><option value="open"${app.filters.status === "open" ? " selected" : ""}>Pendientes</option><option value="done"${app.filters.status === "done" ? " selected" : ""}>Completadas</option><option value="all"${app.filters.status === "all" ? " selected" : ""}>Todas</option><option value="archived"${app.filters.status === "archived" ? " selected" : ""}>Archivadas</option></select></label><label><span>Proyecto</span><select name="project"><option value="">Todos</option>${app.state.projects.map((project) => `<option value="${escapeAttribute(project.id)}"${app.filters.project === project.id ? " selected" : ""}>${escapeHtml(project.title)}</option>`).join("")}</select></label><label><span>Prioridad</span><select name="priority"><option value="">Todas</option>${["HIGH", "NORMAL", "LOW"].map((priority) => `<option${app.filters.priority === priority ? " selected" : ""}>${priority}</option>`).join("")}</select></label></form>${missionGroup("Misiones", filtered)}`;
}

function ideaCard(idea) {
  const cooling = idea.status === "VAULT" && new Date(idea.cooldown_until) > new Date();
  return `<article class="mc-idea-card"><span class="mc-kicker">${escapeHtml(idea.status)}</span><h2>${escapeHtml(idea.title)}</h2><p>${escapeHtml(idea.description || "Sin notas adicionales.")}</p>${idea.tags?.length ? `<div class="mc-tags">${idea.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}<footer><small>${cooling ? `Disponible en ${relativeTime(idea.cooldown_until)}` : "Lista para evaluar"}</small><div>${!cooling && idea.status !== "CONVERTED" ? `<button type="button" data-idea-convert="${escapeAttribute(idea.id)}">Convertir</button>` : ""}${idea.status !== "DISCARDED" ? `<button type="button" data-idea-status="${escapeAttribute(idea.id)}" data-status="DISCARDED">Descartar</button>` : ""}</div></footer></article>`;
}

function renderIdeas() {
  const ideas = app.state.ideas.slice().sort((left, right) => new Date(right.created_at) - new Date(left.created_at));
  return `<section class="mc-page-head"><div><span class="mc-kicker">Aparcar sin olvidar</span><h1>Idea Vault</h1><p>Las ideas esperan 72 horas antes de convertirse en otro frente.</p></div><button class="mc-button mc-button--gold" type="button" data-capture="idea">Guardar idea</button></section><div class="mc-idea-grid">${ideas.length ? ideas.map(ideaCard).join("") : '<div class="mc-empty-card"><h2>El Vault está vacío.</h2><p>Captura una idea sin interrumpir tu día.</p></div>'}</div>`;
}

function renderProjectDetail(project) {
  if (!project) return `<section class="mc-empty-card"><h1>Proyecto no encontrado</h1><a href="/control/" data-nav>Volver</a></section>`;
  const quests = app.state.quests.filter((quest) => quest.project_id === project.id && quest.status !== "ARCHIVED"); const progress = projectProgress(app.state, project);
  return `<section class="mc-page-head"><div><span class="mc-kicker">${escapeHtml(project.status)}</span><h1>${escapeHtml(project.title)}</h1><p>${escapeHtml(project.description || project.main_goal || "Sin descripción.")}</p></div><button class="mc-button mc-button--secondary" type="button" data-edit-project="${escapeAttribute(project.id)}">Editar proyecto</button></section><section class="mc-project-overview"><div><span>Progreso</span><strong>${progress}%</strong><div class="mc-line-progress"><i style="width:${progress}%"></i></div></div><div><span>Objetivo principal</span><strong>${escapeHtml(project.main_goal || "Por definir")}</strong></div></section>${missionGroup("Misiones del proyecto", quests)}<button class="mc-button mc-button--gold" type="button" data-capture="quest" data-project="${escapeAttribute(project.id)}">Añadir misión</button>`;
}

function quickDialog() {
  const projects = app.state.projects.filter((project) => project.status !== "ARCHIVED").map((project) => `<option value="${escapeAttribute(project.id)}">${escapeHtml(project.title)}</option>`).join("");
  return `<dialog class="mc-dialog mc-quick-dialog" data-quick-dialog><form method="dialog" class="mc-dialog-head"><div><span class="mc-kicker">Quick Add</span><h2>Captura y sigue.</h2></div><button class="mc-icon-button" value="cancel" aria-label="Cerrar">${icon("close")}</button></form><form class="mc-quick-form" data-quick-form><div class="mc-segmented"><label><input type="radio" name="quick_type" value="quest" checked><span>Misión</span></label><label><input type="radio" name="quick_type" value="idea"><span>Idea</span></label></div><label class="mc-field"><span>Título</span><input name="title" required maxlength="180" autofocus autocomplete="off" placeholder="¿Qué quieres capturar?"></label><details><summary>Añadir detalles</summary><div class="mc-form-grid"><label class="mc-field"><span>Fecha</span><input type="date" name="scheduled_date" value="${dateKey()}"></label><label class="mc-field"><span>Hora</span><input type="time" name="scheduled_time"></label><label class="mc-field"><span>Proyecto</span><select name="project_id"><option value="">Sin proyecto</option>${projects}</select></label><label class="mc-field"><span>Recordatorio</span><select name="reminder_preset"><option value="none">Ninguno</option><option value="normal">Normal · 1 h antes</option><option value="important">Importante · 1 d, 2 h y 15 min</option></select></label></div></details><button class="mc-button mc-button--gold mc-button--wide" type="submit">Guardar</button><small class="mc-shortcut-hint">Q o Ctrl/⌘ K para abrir</small></form></dialog>`;
}

const editorDialog = () => '<dialog class="mc-dialog mc-editor-dialog" data-editor-dialog><div data-editor-content></div></dialog>';
function notificationDialog() {
  return `<dialog class="mc-dialog mc-notification-dialog" data-notification-dialog><form method="dialog" class="mc-dialog-head"><div><span class="mc-kicker">Recordatorios</span><h2>Avisos en este dispositivo</h2></div><button class="mc-icon-button" value="cancel" aria-label="Cerrar">${icon("close")}</button></form><div class="mc-dialog-copy"><p>Mission Control puede avisarte aunque esta pestaña no esté abierta, siempre que el navegador lo permita y el envío programado esté configurado.</p><p class="mc-fine-print">No se enviará nada sin tu permiso.</p><div class="mc-dialog-actions"><button class="mc-button mc-button--gold" type="button" data-action="notification-enable">Activar avisos</button><button class="mc-button mc-button--secondary" type="button" data-action="notification-later">Ahora no</button></div></div></dialog>`;
}
const limitDialog = () => '<dialog class="mc-dialog" data-limit-dialog><div class="mc-dialog-copy"><span class="mc-kicker">Límite de foco</span><h2>Demasiados proyectos activos.</h2><button class="mc-button mc-button--secondary" type="button" data-dialog-close>Cerrar</button></div></dialog>';

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
  return `${editorHeader(quest ? "Editar misión" : "Nueva misión", quest?.title || "Define un cierre claro")}<form class="mc-editor-form" data-editor-form="quest"><input type="hidden" name="id" value="${escapeAttribute(quest?.id || "")}"><label class="mc-field"><span>Título</span><input name="title" required maxlength="180" autofocus value="${escapeAttribute(quest?.title || "")}"></label><div class="mc-form-grid"><label class="mc-field"><span>Fecha</span><input name="scheduled_date" type="date" value="${escapeAttribute(quest?.scheduled_date || dateKey())}"></label><label class="mc-field"><span>Hora <small>opcional</small></span><input name="scheduled_time" type="time" value="${escapeAttribute(quest?.scheduled_time || "")}"></label><label class="mc-field"><span>Proyecto</span><select name="project_id"><option value="">Sin proyecto</option>${projects}</select></label><label class="mc-field"><span>Prioridad</span><select name="priority"><option value="LOW"${selected(quest?.priority, "LOW")}>Baja</option><option value="NORMAL"${selected(quest?.priority || "NORMAL", "NORMAL")}>Normal</option><option value="HIGH"${selected(quest?.priority, "HIGH")}>Alta</option></select></label></div>${reminderChecks(quest)}<details class="mc-advanced"><summary>Repetición y detalles</summary><div class="mc-form-grid"><label class="mc-field"><span>Repetición</span><select name="recurrence_type" data-recurrence><option value="once"${selected(recurrence, "once")}>Una vez</option><option value="daily"${selected(recurrence, "daily")}>Cada día</option><option value="weekly"${selected(recurrence, "weekly")}>Días de la semana</option><option value="monthly"${selected(recurrence, "monthly")}>Cada mes</option><option value="interval"${selected(recurrence, "interval")}>Intervalo</option></select></label><label class="mc-field"><span>Termina</span><input name="recurrence_end_date" type="date" value="${escapeAttribute(quest?.recurrence_end_date || "")}"></label></div><div class="mc-recurrence-panel" data-recurrence-panel="weekly"><span>Días</span><div class="mc-weekdays">${[[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [7, "D"]].map(([day, label]) => `<label><input type="checkbox" name="recurrence_day" value="${day}"${checked(days.has(day))}><span>${label}</span></label>`).join("")}</div></div><div class="mc-recurrence-panel mc-form-grid" data-recurrence-panel="interval"><label class="mc-field"><span>Cada</span><input name="recurrence_interval" type="number" min="1" max="365" value="${quest?.recurrence_config?.interval || 2}"></label><label class="mc-field"><span>Unidad</span><select name="recurrence_unit"><option value="days"${selected(quest?.recurrence_config?.unit || "days", "days")}>Días</option><option value="weeks"${selected(quest?.recurrence_config?.unit, "weeks")}>Semanas</option><option value="months"${selected(quest?.recurrence_config?.unit, "months")}>Meses</option></select></label></div><label class="mc-field"><span>Descripción</span><textarea name="description" rows="3">${escapeHtml(quest?.description || "")}</textarea></label><div class="mc-form-grid"><label class="mc-field"><span>Estado</span><select name="status">${["ACTIVE", "IN_PROGRESS", "COMPLETED"].map((item) => `<option${selected(quest?.status || "ACTIVE", item)}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Categoría</span><select name="category">${["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"].map((item) => `<option${selected(quest?.category || "BUILD", item)}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>XP</span><input name="xp_reward" type="number" min="0" max="5000" value="${quest?.xp_reward ?? (context.main ? 100 : 30)}"></label><label class="mc-field"><span>Minutos</span><input name="estimated_minutes" type="number" min="0" max="1440" value="${quest?.estimated_minutes || ""}"></label></div></details><label class="mc-switch"><input type="checkbox" name="is_main_quest"${checked(quest?.is_main_quest || context.main)}><span>Usar como Main Quest</span></label><div class="mc-editor-actions">${quest && !questDone(quest) ? `<button class="mc-button mc-button--secondary" type="button" data-quest-toggle="${escapeAttribute(quest.id)}">Marcar hecha</button>` : ""}${quest ? `<button class="mc-button mc-button--danger" type="button" data-delete-quest="${escapeAttribute(quest.id)}">${icon("archive")} Archivar</button>` : ""}<button class="mc-button mc-button--gold" type="submit">${quest ? "Guardar cambios" : "Crear misión"}</button></div></form>`;
}

function ideaEditor() { return `${editorHeader("Idea Vault", "Captura sin abrir otro frente")}<form class="mc-editor-form" data-editor-form="idea"><label class="mc-field"><span>Título</span><input name="title" required autofocus></label><label class="mc-field"><span>Notas</span><textarea name="description" rows="4"></textarea></label><label class="mc-field"><span>Etiquetas</span><input name="tags" placeholder="ventas, contenido"></label><button class="mc-button mc-button--gold mc-button--wide" type="submit">Guardar en el Vault</button></form>`; }
function projectEditor(project) { return `${editorHeader("Proyecto", project.title)}<form class="mc-editor-form" data-editor-form="project"><input type="hidden" name="id" value="${escapeAttribute(project.id)}"><label class="mc-field"><span>Nombre</span><input name="title" required value="${escapeAttribute(project.title)}"></label><label class="mc-field"><span>Descripción</span><textarea name="description" rows="3">${escapeHtml(project.description || "")}</textarea></label><div class="mc-form-grid"><label class="mc-field"><span>Estado</span><select name="status">${["ACTIVE", "PAUSED", "IDEA", "COMPLETED", "ARCHIVED"].map((item) => `<option${selected(project.status, item)}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Progreso</span><input name="progress" type="number" min="0" max="100" value="${project.progress || 0}"></label></div><label class="mc-field"><span>Objetivo principal</span><input name="main_goal" value="${escapeAttribute(project.main_goal || "")}"></label><button class="mc-button mc-button--gold mc-button--wide" type="submit">Guardar proyecto</button></form>`; }

function syncRecurrencePanels(scope = document) { const recurrence = scope.querySelector("[data-recurrence]")?.value; scope.querySelectorAll("[data-recurrence-panel]").forEach((panel) => { panel.hidden = panel.dataset.recurrencePanel !== recurrence; }); const picker = scope.querySelector("[data-reminder-picker]"); if (picker) picker.hidden = !scope.querySelector('[name="scheduled_time"]')?.value; }
function openEditor(type, context = {}) {
  document.querySelector("[data-quick-dialog]")?.close(); const dialog = document.querySelector("[data-editor-dialog]");
  if (type === "quest") dialog.querySelector("[data-editor-content]").innerHTML = questEditor(context.editId ? app.state.quests.find((item) => item.id === context.editId) : null, context);
  if (type === "idea") dialog.querySelector("[data-editor-content]").innerHTML = ideaEditor();
  if (type === "project") dialog.querySelector("[data-editor-content]").innerHTML = projectEditor(projectFor(context.editId));
  dialog.showModal(); syncRecurrencePanels(dialog);
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
      app.revision += 1; response = { state: app.state, revision: app.revision }; localStorage.setItem("ivanimports.mission-control.local-demo.v2", JSON.stringify(response));
    } else response = await fetchJson(API.mutate, { method: "POST", body: JSON.stringify(request) });
    app.state = response.state; app.revision = response.revision; render(); if (success && !quiet) toast(success); return response;
  } catch (error) {
    if (previous) { app.state = previous.state; app.revision = previous.revision; render(); }
    if (error.status === 409 && error.body?.state) { app.state = error.body.state; app.revision = error.body.revision; render(); toast("El mapa se actualizó desde otra pestaña.", "warning"); return null; }
    toast(error.message === "idea_cooldown_active" ? "La idea sigue en pausa de 72 horas." : "No se pudo guardar.", "error"); throw error;
  }
}

function render() {
  app.route ||= parseRoute(); let content = renderDashboard();
  if (app.route.name === "quests") content = renderAllQuests();
  if (app.route.name === "ideas") content = renderIdeas();
  if (app.route.name === "project") content = renderProjectDetail(projectFor(app.route.id));
  app.root.innerHTML = appShell(content); app.root.removeAttribute("aria-busy");
  const title = app.route.name === "dashboard" ? "Hoy" : app.route.name === "quests" ? "Misiones" : app.route.name === "ideas" ? "Idea Vault" : projectFor(app.route.id)?.title || "Proyecto";
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
    else { const reminders = data.scheduled_time ? presetReminders(data.reminder_preset) : []; await mutate("quest.create", { title: data.title, scheduled_date: data.scheduled_date || dateKey(), scheduled_time: data.scheduled_time || null, project_id: data.project_id || null, reminders, timezone: app.timezone, source: "quick-add" }, { success: "Misión añadida" }); if (reminders.length) maybeOfferNotifications(); }
    document.querySelector("[data-quick-dialog]")?.close(); return;
  }
  const editor = event.target.closest("[data-editor-form]"); if (!editor) return; event.preventDefault(); const data = formObject(editor);
  if (editor.dataset.editorForm === "quest") {
    data.project_id ||= null; data.scheduled_time ||= null; data.recurrence_end_date ||= null; data.xp_reward = Number(data.xp_reward) || 0; data.estimated_minutes = Number(data.estimated_minutes) || null; data.is_main_quest = editor.elements.is_main_quest.checked; data.reminders = data.scheduled_time ? reminderPayload(editor) : []; data.recurrence_config = recurrencePayload(editor, data); data.timezone = app.timezone;
    const shouldComplete = Boolean(data.id && data.status === "COMPLETED" && !questDone(app.state.quests.find((quest) => quest.id === data.id)));
    if (shouldComplete) data.status = "ACTIVE";
    await mutate(data.id ? "quest.update" : "quest.create", data, { success: shouldComplete ? "" : data.id ? "Misión actualizada" : "Misión creada" });
    if (shouldComplete) await mutate("quest.complete", { id: data.id }, { success: `Misión completada · +${data.xp_reward} XP`, optimistic: true });
    if (data.reminders.length) maybeOfferNotifications();
  }
  if (editor.dataset.editorForm === "idea") { data.tags = String(data.tags || "").split(",").map((item) => item.trim()).filter(Boolean); await mutate("idea.create", data, { success: "Idea guardada en el Vault" }); }
  if (editor.dataset.editorForm === "project") { data.progress = Number(data.progress) || 0; await mutate("project.update", data, { success: "Proyecto actualizado" }); }
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
  if (event.target.closest("[data-action='quick-open']")) { document.querySelector("[data-quick-dialog]")?.showModal(); return; }
  if (event.target.closest("[data-action='notification-open']")) { document.querySelector("[data-notification-dialog]")?.showModal(); return; }
  if (event.target.closest("[data-action='notification-later']")) { document.querySelector("[data-notification-dialog]")?.close(); await mutate("preferences.update", { notification_prompt_dismissed: true }, { quiet: true }); return; }
  if (event.target.closest("[data-action='notification-enable']")) { const button = event.target.closest("button"); button.disabled = true; try { await enableNotifications(); document.querySelector("[data-notification-dialog]")?.close(); } catch (error) { toast(error.message === "push_not_configured" ? "El envío programado aún no está configurado." : "No se pudieron activar los avisos.", "warning"); button.disabled = false; } return; }
  const capture = event.target.closest("[data-capture]"); if (capture) { openEditor(capture.dataset.capture, { main: capture.dataset.main === "true", projectId: capture.dataset.project || "" }); return; }
  const editQuest = event.target.closest("[data-edit-quest]"); if (editQuest) { openEditor("quest", { editId: editQuest.dataset.editQuest }); return; }
  const editProject = event.target.closest("[data-edit-project]"); if (editProject) { openEditor("project", { editId: editProject.dataset.editProject }); return; }
  const toggle = event.target.closest("[data-quest-toggle]"); if (toggle) { const quest = app.state.quests.find((item) => item.id === toggle.dataset.questToggle); const done = questDone(quest); await mutate(done ? "quest.undo" : "quest.complete", { id: quest.id, period_key: questPeriodKey(quest) }, { success: done ? "Misión reabierta" : `Misión completada · +${quest.xp_reward} XP`, optimistic: true }); return; }
  const deletion = event.target.closest("[data-delete-quest]"); if (deletion) { if (!confirm("¿Archivar esta misión? Sus recordatorios se cancelarán.")) return; await mutate("quest.delete", { id: deletion.dataset.deleteQuest }, { success: "Misión archivada" }); document.querySelector("[data-editor-dialog]")?.close(); return; }
  const snooze = event.target.closest("[data-reminder-snooze]"); if (snooze) { const minutes = snooze.dataset.minutes === "custom" ? Number(prompt("¿Cuántos minutos quieres posponer?", "30")) : Number(snooze.dataset.minutes); if (!Number.isFinite(minutes) || minutes < 1) return; await mutate("reminder.snooze", { id: snooze.dataset.reminderSnooze, minutes }, { success: `Pospuesto ${minutes} min` }); return; }
  const dismiss = event.target.closest("[data-reminder-dismiss]"); if (dismiss) { await mutate("reminder.dismiss", { id: dismiss.dataset.reminderDismiss }, { success: "Recordatorio cerrado" }); return; }
  const convert = event.target.closest("[data-idea-convert]"); if (convert) { await mutate("idea.convert", { id: convert.dataset.ideaConvert }, { success: "Idea convertida en proyecto" }); return; }
  const ideaStatus = event.target.closest("[data-idea-status]"); if (ideaStatus) { await mutate("idea.update", { id: ideaStatus.dataset.ideaStatus, status: ideaStatus.dataset.status }, { success: "Idea actualizada" }); return; }
  if (event.target.closest("[data-action='demo-reset']")) { if (!confirm("¿Restaurar la demo?")) return; if (app.localPreview) { app.state = createDemoControlState("demo"); app.revision += 1; localStorage.removeItem("ivanimports.mission-control.local-demo.v2"); render(); } else { const response = await fetchJson(API.demoReset, { method: "POST", body: "{}" }); app.state = response.state; app.revision = response.revision; render(); } toast("Demo restaurada"); }
}

function handleChange(event) {
  const filters = event.target.closest("[data-filters]"); if (filters) { app.filters = { ...app.filters, ...formObject(filters) }; render(); return; }
  if (event.target.matches("[data-recurrence], [name='scheduled_time']")) syncRecurrencePanels(event.target.closest("form"));
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
    if (app.localPreview) { const saved = JSON.parse(localStorage.getItem("ivanimports.mission-control.local-demo.v2") || "null"); app.session = { authenticated: true, user: { demo: true } }; app.state = saved?.state || createDemoControlState("demo"); app.revision = saved?.revision || 0; render(); return; }
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("[data-quick-dialog]")?.showModal(); return; }
  if (!editing) { if (event.key === "1") navigate("/control/"); if (event.key === "2") navigate("/control/quests/"); if (event.key === "3") navigate("/control/ideas/"); if (event.key.toLowerCase() === "q") document.querySelector("[data-quick-dialog]")?.showModal(); }
});
setInterval(refreshState, 5 * 60 * 1000); setInterval(checkInAppReminders, 60 * 1000);
boot();
