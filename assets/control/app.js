import {
  applyControlMutation,
  createDemoControlState,
  dateKey,
  getLevelProgress,
  goalProgress,
  projectProgress,
  questCompletedForPeriod,
  questIsDueOn,
  questPeriodKey,
  weekKey,
} from "./domain.js";

const API = Object.freeze({
  session: "/api/control/session",
  state: "/api/control/state",
  mutate: "/api/control/mutate",
  demoReset: "/api/control/demo-reset",
  login: "/api/control/login",
});

const app = {
  root: document.querySelector("[data-control-app]"),
  state: null,
  revision: 0,
  session: null,
  route: null,
  localPreview: ["localhost", "127.0.0.1", "::1"].includes(location.hostname) && new URLSearchParams(location.search).get("demo") === "1",
  pendingMutation: null,
  filters: { project: "", category: "", status: "open", recurrence: "" },
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function operationId() {
  return globalThis.crypto?.randomUUID?.() || `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function formatDate(value = Date.now(), options = {}) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", ...options }).format(new Date(value));
}

function formatNumber(value, unit = "count") {
  if (unit === "€") return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value) || 0);
  if (unit === "%") return `${Number(value) || 0}%`;
  if (unit === "boolean") return Number(value) ? "Sí" : "No";
  return new Intl.NumberFormat("es-ES").format(Number(value) || 0);
}

function relativeTime(value) {
  const delta = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(delta);
  if (absolute < 60000) return "ahora";
  if (absolute < 3600000) return `${Math.ceil(absolute / 60000)} min`;
  if (absolute < 86400000) return `${Math.ceil(absolute / 3600000)} h`;
  return `${Math.ceil(absolute / 86400000)} d`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
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
  history.pushState({}, "", path);
  app.route = parseRoute(path);
  render();
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function projectFor(id) {
  return app.state.projects.find((project) => project.id === id) || null;
}

function projectLabel(id) {
  return projectFor(id)?.title || "Sin proyecto";
}

function projectAccent(id) {
  return projectFor(id)?.accent || "#91a3b8";
}

function todayQuests() {
  return app.state.quests.filter((quest) => questIsDueOn(quest, Date.now()));
}

function todayCompletion(quest) {
  return questCompletedForPeriod(app.state, quest, Date.now());
}

function completedToday() {
  return todayQuests().filter(todayCompletion);
}

function todayXp() {
  return app.state.quest_completions.filter((item) => dateKey(item.completed_at) === dateKey()).reduce((sum, item) => sum + Number(item.xp_awarded || 0), 0);
}

function icon(name) {
  const icons = {
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    flag: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>',
    bulb: '<path d="M9 18h6m-5 3h4m4-11a6 6 0 0 1-3 5.2V16H9v-.8A6 6 0 1 1 18 10Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M15 9 21 3"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.grid}</svg>`;
}

function statusBadge(status) {
  const labels = { ACTIVE: "Activo", PAUSED: "En pausa", IDEA: "Idea", COMPLETED: "Completado", ARCHIVED: "Archivado", VAULT: "Vault", CANDIDATE: "Candidato", CONVERTED: "Convertido", DISCARDED: "Descartado" };
  return `<span class="mc-status mc-status--${String(status).toLowerCase()}"><i></i>${escapeHtml(labels[status] || status)}</span>`;
}

function progressBar(percent, label = "") {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="mc-progress" role="progressbar" aria-label="${escapeAttribute(label || "Progreso")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(safe)}"><span style="width:${safe}%"></span></div>`;
}

function levelBlock() {
  const progress = getLevelProgress(app.state.user_game_stats.total_xp);
  return `<div class="mc-level-cluster">
    <span class="mc-level-badge">LVL ${progress.level}</span>
    <div class="mc-level-copy"><div><strong>${formatNumber(progress.totalXp)} XP</strong><small>${formatNumber(progress.ceiling)} siguiente nivel</small></div>${progressBar(progress.percent, "Progreso de nivel")}</div>
    <span class="mc-streak" title="Racha actual">🔥 ${app.state.user_game_stats.current_streak} días</span>
  </div>`;
}

function appShell(content) {
  const route = app.route.name;
  return `<div class="mc-app">
    <aside class="mc-sidebar">
      <a class="mc-brand" href="/control/" data-nav><span class="mc-brand-mark">MC</span><span><strong>Mission Control</strong><small>Personal OS · V1</small></span></a>
      <nav class="mc-nav" aria-label="Mission Control">
        <a href="/control/" data-nav class="${route === "dashboard" ? "is-active" : ""}">${icon("grid")}<span>Hoy</span><kbd>1</kbd></a>
        <a href="/control/quests/" data-nav class="${route === "quests" ? "is-active" : ""}">${icon("check")}<span>Quests</span><kbd>2</kbd></a>
        <a href="/control/ideas/" data-nav class="${route === "ideas" ? "is-active" : ""}">${icon("bulb")}<span>Idea Vault</span><kbd>3</kbd></a>
      </nav>
      <div class="mc-sidebar-foot"><span>Principio operativo</span><strong>Publicar → Vender<br>Terminar → Repetir</strong>${app.session?.user?.demo ? '<button type="button" class="mc-text-button" data-action="demo-reset">Restaurar demo</button>' : ""}</div>
    </aside>
    <section class="mc-workspace">
      <header class="mc-topbar">
        <div><span class="mc-eyebrow">${formatDate(Date.now(), { weekday: "long" })}</span><strong>${formatDate(Date.now(), { day: "numeric", month: "long" })}</strong></div>
        ${levelBlock()}
        <button class="mc-idea-button" type="button" data-capture="idea">${icon("bulb")}<span>Idea</span></button>
      </header>
      <main class="mc-main" id="mc-main">${content}</main>
    </section>
    <button class="mc-fab" type="button" data-action="quick-open" aria-label="Captura rápida">${icon("plus")}</button>
    ${quickDialog()}
    ${editorDialog()}
    ${limitDialog()}
    <div class="mc-toast-region" aria-live="polite" data-toasts></div>
  </div>`;
}

function dailyHero() {
  const quests = todayQuests();
  const complete = completedToday().length;
  const percent = quests.length ? (complete / quests.length) * 100 : 0;
  const allDone = quests.length > 0 && complete === quests.length;
  return `<section class="mc-daily-hero ${allDone ? "is-complete" : ""}">
    <div class="mc-daily-ring" style="--progress:${percent * 3.6}deg"><div><strong>${complete}<span>/ ${quests.length}</span></strong><small>${allDone ? "DAY COMPLETE" : "MISIONES"}</small></div></div>
    <div class="mc-daily-copy"><span class="mc-kicker">${allDone ? "Mapa despejado" : "Progreso del día"}</span><h1>${allDone ? "Día completado ✓" : quests.length ? `${quests.length - complete} misiones para cerrar el día` : "El mapa está despejado"}</h1><p>${allDone ? `Has ganado ${todayXp()} XP hoy. Cierra el día sabiendo que terminaste lo importante.` : quests.length ? `${Math.round(percent)}% completado · Cada cierre mueve el mapa.` : "Crea la primera misión y elige qué significa ganar hoy."}</p>${progressBar(percent, "Misiones diarias")}</div>
    <button type="button" class="mc-button mc-button--ghost" data-capture="quest">${icon("plus")} Nueva quest</button>
  </section>`;
}

function mainQuestCard() {
  const quest = todayQuests().find((item) => item.is_main_quest);
  if (!quest) return `<section class="mc-panel mc-main-quest mc-empty-main"><span class="mc-kicker">🎯 Main Quest</span><h2>Define la victoria del día</h2><p>Una sola misión que merezca proteger tu atención.</p><button class="mc-button mc-button--primary" type="button" data-capture="quest" data-main="true">Elegir Main Quest</button></section>`;
  const done = todayCompletion(quest);
  return `<section class="mc-panel mc-main-quest ${done ? "is-done" : ""}">
    <div class="mc-panel-head"><span class="mc-kicker">🎯 Main Quest</span><span class="mc-reward">+${quest.xp_reward} XP</span></div>
    <button class="mc-main-check" type="button" data-quest-toggle="${quest.id}" aria-pressed="${done}"><span>${done ? icon("check") : ""}</span><div><h2>${escapeHtml(quest.title)}</h2><p><i style="background:${projectAccent(quest.project_id)}"></i>${escapeHtml(projectLabel(quest.project_id))} · ${quest.estimated_minutes || 30} min</p></div></button>
  </section>`;
}

function questItem(quest, { compact = false } = {}) {
  const done = todayCompletion(quest) || (quest.recurrence_type === "once" && quest.status === "COMPLETED");
  const project = projectFor(quest.project_id);
  return `<article class="mc-quest ${done ? "is-done" : ""} ${compact ? "is-compact" : ""}">
    <button type="button" class="mc-quest-check" data-quest-toggle="${quest.id}" aria-label="${done ? "Reabrir" : "Completar"} ${escapeAttribute(quest.title)}" aria-pressed="${done}">${done ? icon("check") : ""}</button>
    <div class="mc-quest-copy"><strong>${escapeHtml(quest.title)}</strong><small>${project ? `<i style="background:${project.accent}"></i>${escapeHtml(project.title)} · ` : ""}${escapeHtml(quest.recurrence_type)}${quest.estimated_minutes ? ` · ${quest.estimated_minutes} min` : ""}</small></div>
    <span class="mc-category mc-category--${quest.category.toLowerCase()}">${escapeHtml(quest.category)}</span>
    <span class="mc-xp">+${quest.xp_reward}</span>
  </article>`;
}

function todayQuestPanel() {
  const quests = todayQuests().filter((quest) => !quest.is_main_quest);
  if (!quests.length) return `<section class="mc-panel mc-empty"><span>${icon("check")}</span><h2>No missions today</h2><p>El mapa está despejado.</p><button class="mc-button mc-button--secondary" data-capture="quest">Crear primera misión</button></section>`;
  const groups = ["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"].map((category) => [category, quests.filter((quest) => quest.category === category)]).filter(([, items]) => items.length);
  return `<section class="mc-panel mc-quests-panel"><div class="mc-panel-head"><div><span class="mc-kicker">Daily Quests</span><h2>Misiones de hoy</h2></div><button class="mc-icon-button" type="button" data-capture="quest" aria-label="Nueva quest">${icon("plus")}</button></div>${groups.map(([category, items]) => `<div class="mc-quest-group"><div class="mc-group-label"><span>${category}</span><small>${items.filter((item) => !todayCompletion(item)).length} pendientes</small></div>${items.map((item) => questItem(item)).join("")}</div>`).join("")}</section>`;
}

function weeklyBoss() {
  const boss = app.state.goals.find((goal) => goal.is_boss && goal.period === "WEEKLY");
  if (!boss) return `<section class="mc-panel mc-boss mc-empty"><span>👹</span><h2>Sin Weekly Boss</h2><p>Elige un cierre que cambie la semana.</p><button class="mc-button mc-button--secondary" data-capture="goal" data-boss="true">Crear Boss</button></section>`;
  const percent = goalProgress(boss);
  return `<section class="mc-panel mc-boss"><div class="mc-panel-head"><span class="mc-kicker">👹 Weekly Boss</span><span class="mc-reward">+${boss.xp_reward} XP</span></div><h2>${escapeHtml(boss.title)}</h2><p>${escapeHtml(projectLabel(boss.project_id))}</p><div class="mc-goal-number"><strong>${formatNumber(boss.current_value, boss.unit)}</strong><span>/ ${formatNumber(boss.target_value, boss.unit)}</span></div>${progressBar(percent, "Weekly Boss")}<div class="mc-inline-actions"><small>${Math.round(percent)}% del objetivo</small><button type="button" class="mc-button mc-button--tiny" data-goal-increment="${boss.id}">+1 progreso</button></div></section>`;
}

function monthlyObjectives() {
  const goals = app.state.goals.filter((goal) => goal.period === "MONTHLY" && !goal.archived_at).slice(0, 5);
  return `<section class="mc-panel mc-monthly"><div class="mc-panel-head"><div><span class="mc-kicker">${formatDate(Date.now(), { month: "long" })}</span><h2>Objetivos mensuales</h2></div><button class="mc-icon-button" data-capture="goal" aria-label="Nuevo objetivo">${icon("plus")}</button></div>${goals.length ? `<div class="mc-goal-list">${goals.map((goal) => `<article><div><strong>${escapeHtml(goal.title)}</strong><span>${formatNumber(goal.current_value, goal.unit)} / ${formatNumber(goal.target_value, goal.unit)}</span></div>${progressBar(goalProgress(goal), goal.title)}</article>`).join("")}</div>` : '<div class="mc-mini-empty">No hay objetivos mensuales todavía.</div>'}</section>`;
}

function projectCard(project) {
  const pending = app.state.quests.filter((quest) => quest.project_id === project.id && quest.status !== "COMPLETED").length;
  const completedWeek = app.state.quest_completions.filter((completion) => {
    const quest = app.state.quests.find((item) => item.id === completion.quest_id);
    return quest?.project_id === project.id && dateKey(completion.completed_at) >= weekKey();
  }).length;
  const progress = projectProgress(app.state, project);
  const activity = app.state.activity_log.find((item) => item.project_id === project.id);
  return `<a class="mc-project-card" href="/control/projects/${encodeURIComponent(project.id)}/" data-nav style="--accent:${project.accent}">
    <div class="mc-project-top"><span class="mc-project-icon">${escapeHtml(project.icon || "◆")}</span>${statusBadge(project.status)}</div>
    <h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.main_goal || project.description || "Sin objetivo principal definido.")}</p>
    <div class="mc-project-progress"><div><span>Progreso</span><strong>${progress}%</strong></div>${progressBar(progress, project.title)}</div>
    <footer><span>${pending} pendientes</span><span>${completedWeek} esta semana</span><span>${activity ? relativeTime(activity.updated_at || activity.created_at) : "Sin actividad"}</span>${icon("chevron")}</footer>
  </a>`;
}

function projectsSection() {
  const projects = [...app.state.projects].filter((item) => item.status !== "ARCHIVED").sort((a, b) => ["ACTIVE", "PAUSED", "IDEA", "COMPLETED"].indexOf(a.status) - ["ACTIVE", "PAUSED", "IDEA", "COMPLETED"].indexOf(b.status));
  return `<section class="mc-section mc-projects-section" id="projects"><div class="mc-section-head"><div><span class="mc-kicker">Portfolio</span><h2>Projects</h2><p>${app.state.projects.filter((item) => item.status === "ACTIVE").length} / ${app.state.user_game_stats.max_active_projects} activos · Protege el foco.</p></div><button class="mc-button mc-button--secondary" data-capture="project">${icon("plus")} Nuevo proyecto</button></div><div class="mc-project-grid">${projects.length ? projects.map(projectCard).join("") : '<div class="mc-panel mc-empty"><h3>Construye tu mapa</h3><p>Crea tus proyectos y activa como máximo los que puedas terminar.</p></div>'}</div></section>`;
}

function ideaPreview() {
  const ideas = app.state.ideas.filter((idea) => !["DISCARDED", "CONVERTED"].includes(idea.status)).slice(0, 3);
  return `<section class="mc-panel mc-idea-preview"><div class="mc-panel-head"><div><span class="mc-kicker">Idea Vault</span><h2>Ideas sin abrir frentes</h2></div><a href="/control/ideas/" data-nav>Ver todas ${icon("arrow")}</a></div>${ideas.length ? ideas.map((idea) => ideaMini(idea)).join("") : '<div class="mc-mini-empty">Aquí vivirán las ideas que todavía no necesitan ser proyectos.</div>'}<button class="mc-button mc-button--wide mc-button--secondary" data-capture="idea">${icon("plus")} Capturar idea</button></section>`;
}

function ideaMini(idea) {
  const locked = new Date(idea.cooldown_until).getTime() > Date.now();
  return `<article class="mc-idea-mini"><span>${locked ? "🔒" : "🔓"}</span><div><strong>${escapeHtml(idea.title)}</strong><small>${locked ? `Cooldown · ${relativeTime(idea.cooldown_until)}` : "Ready to evaluate"}</small></div>${statusBadge(idea.status)}</article>`;
}

function activityPanel() {
  const items = app.state.activity_log.slice(0, 6);
  return `<section class="mc-panel mc-activity"><div class="mc-panel-head"><div><span class="mc-kicker">Telemetry</span><h2>Actividad reciente</h2></div><span class="mc-live-dot">LIVE</span></div>${items.length ? `<div class="mc-activity-list">${items.map((item) => `<article><span class="mc-activity-icon">${item.xp_delta > 0 ? "+" : "•"}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.type.replaceAll("_", " "))} · ${relativeTime(item.created_at)}</small></div>${item.xp_delta ? `<b class="${item.xp_delta < 0 ? "is-negative" : ""}">${item.xp_delta > 0 ? "+" : ""}${item.xp_delta} XP</b>` : ""}</article>`).join("")}</div>` : '<div class="mc-mini-empty">Completa una misión para iniciar el registro.</div>'}</section>`;
}

function renderDashboard() {
  return `${dailyHero()}<div class="mc-dashboard-grid"><div class="mc-primary-column">${mainQuestCard()}${todayQuestPanel()}</div><aside class="mc-secondary-column">${weeklyBoss()}${monthlyObjectives()}</aside></div>${projectsSection()}<div class="mc-lower-grid">${ideaPreview()}${activityPanel()}</div>`;
}

function renderProjectDetail(project) {
  if (!project) return `<section class="mc-panel mc-empty"><h1>Proyecto no encontrado</h1><a href="/control/" data-nav>Volver al mapa</a></section>`;
  const progress = projectProgress(app.state, project);
  const quests = app.state.quests.filter((quest) => quest.project_id === project.id);
  const today = quests.filter((quest) => questIsDueOn(quest));
  const backlog = quests.filter((quest) => !questIsDueOn(quest) && quest.status !== "COMPLETED");
  const completed = quests.filter((quest) => quest.status === "COMPLETED" || app.state.quest_completions.some((item) => item.quest_id === quest.id));
  const goals = app.state.goals.filter((goal) => goal.project_id === project.id);
  const xp = app.state.quest_completions.filter((completion) => quests.some((quest) => quest.id === completion.quest_id)).reduce((sum, item) => sum + Number(item.xp_awarded || 0), 0);
  return `<a class="mc-back" href="/control/" data-nav>${icon("arrow")} Volver al mapa</a>
    <section class="mc-project-hero" style="--accent:${project.accent}"><div class="mc-project-hero-copy"><span class="mc-project-icon">${escapeHtml(project.icon)}</span><div>${statusBadge(project.status)}<h1>${escapeHtml(project.title)}</h1><p>${escapeHtml(project.description || "Sin descripción todavía.")}</p></div></div><div class="mc-project-score"><span>Progreso</span><strong>${progress}%</strong>${progressBar(progress, project.title)}<small>${formatNumber(xp)} XP generados</small></div><div class="mc-inline-actions"><button class="mc-button mc-button--secondary" data-edit-project="${project.id}">Editar</button>${project.status === "ACTIVE" ? `<button class="mc-button mc-button--ghost" data-project-status="${project.id}" data-status="PAUSED">Pausar</button>` : `<button class="mc-button mc-button--primary" data-project-status="${project.id}" data-status="ACTIVE">Activar</button>`}</div></section>
    <div class="mc-project-layout"><div><section class="mc-panel mc-project-objective"><span class="mc-kicker">Objetivo principal</span><h2>${escapeHtml(project.main_goal || "Define el cierre que hace que este proyecto merezca estar activo.")}</h2></section>
    ${projectQuestSection("Today", today, project.id)}${projectQuestSection("Backlog", backlog, project.id)}${projectQuestSection("Completed", completed.slice(0, 8), project.id)}</div>
    <aside><section class="mc-panel"><div class="mc-panel-head"><div><span class="mc-kicker">Goals</span><h2>Objetivos</h2></div><button class="mc-icon-button" data-capture="goal" data-project="${project.id}">${icon("plus")}</button></div><div class="mc-goal-list">${goals.length ? goals.map((goal) => `<article><div><strong>${escapeHtml(goal.title)}</strong><span>${formatNumber(goal.current_value, goal.unit)} / ${formatNumber(goal.target_value, goal.unit)}</span></div>${progressBar(goalProgress(goal), goal.title)}</article>`).join("") : '<div class="mc-mini-empty">Sin objetivos medibles.</div>'}</div></section>
    <section class="mc-panel mc-notes"><div class="mc-panel-head"><div><span class="mc-kicker">Notes</span><h2>Notas</h2></div></div><p>${project.notes ? escapeHtml(project.notes).replaceAll("\n", "<br>") : "Un espacio breve para contexto, decisiones y siguiente paso."}</p></section>
    <section class="mc-panel mc-links"><div class="mc-panel-head"><div><span class="mc-kicker">Links</span><h2>Enlaces</h2></div></div>${project.links?.length ? project.links.map((link) => `<a href="${escapeAttribute(link.url)}" target="_blank" rel="noreferrer">${icon("link")}${escapeHtml(link.label || link.url)}</a>`).join("") : '<div class="mc-mini-empty">Añádelos desde Editar proyecto.</div>'}</section></aside></div>`;
}

function projectQuestSection(title, quests, projectId) {
  return `<section class="mc-panel mc-project-quests"><div class="mc-panel-head"><div><span class="mc-kicker">${quests.length} items</span><h2>${title}</h2></div><button class="mc-icon-button" data-capture="quest" data-project="${projectId}" aria-label="Nueva quest">${icon("plus")}</button></div>${quests.length ? quests.map((quest) => questItem(quest, { compact: true })).join("") : '<div class="mc-mini-empty">Nada aquí.</div>'}</section>`;
}

function renderAllQuests() {
  let quests = [...app.state.quests];
  if (app.filters.project) quests = quests.filter((item) => item.project_id === app.filters.project);
  if (app.filters.category) quests = quests.filter((item) => item.category === app.filters.category);
  if (app.filters.recurrence) quests = quests.filter((item) => item.recurrence_type === app.filters.recurrence);
  if (app.filters.status === "open") quests = quests.filter((item) => item.status !== "COMPLETED");
  if (app.filters.status === "completed") quests = quests.filter((item) => item.status === "COMPLETED" || app.state.quest_completions.some((completion) => completion.quest_id === item.id));
  const today = quests.filter((item) => questIsDueOn(item));
  const upcoming = quests.filter((item) => item.due_date && new Date(item.due_date) > new Date() && !questIsDueOn(item));
  const recurring = quests.filter((item) => item.recurrence_type !== "once" && !today.includes(item));
  const backlog = quests.filter((item) => item.recurrence_type === "once" && !item.due_date && item.status !== "COMPLETED");
  const completed = quests.filter((item) => item.status === "COMPLETED");
  return `<div class="mc-page-head"><div><span class="mc-kicker">Quest log</span><h1>All Quests</h1><p>Lo que importa hoy arriba. El resto permanece visible, sin robar el foco.</p></div><button class="mc-button mc-button--primary" data-capture="quest">${icon("plus")} Nueva quest</button></div>
    <form class="mc-filterbar" data-filters><label>Proyecto<select name="project"><option value="">Todos</option>${app.state.projects.map((project) => `<option value="${project.id}"${app.filters.project === project.id ? " selected" : ""}>${escapeHtml(project.title)}</option>`).join("")}</select></label><label>Categoría<select name="category"><option value="">Todas</option>${["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"].map((value) => `<option${app.filters.category === value ? " selected" : ""}>${value}</option>`).join("")}</select></label><label>Estado<select name="status"><option value="open"${app.filters.status === "open" ? " selected" : ""}>Abiertas</option><option value="completed"${app.filters.status === "completed" ? " selected" : ""}>Completadas</option><option value="all"${app.filters.status === "all" ? " selected" : ""}>Todas</option></select></label><label>Frecuencia<select name="recurrence"><option value="">Todas</option>${["once", "daily", "weekly", "monthly"].map((value) => `<option${app.filters.recurrence === value ? " selected" : ""}>${value}</option>`).join("")}</select></label></form>
    <div class="mc-quest-log">${questLogSection("Today", today)}${questLogSection("Upcoming", upcoming)}${questLogSection("Recurring", recurring)}${questLogSection("Backlog", backlog)}${questLogSection("Completed", completed)}</div>`;
}

function questLogSection(title, quests) {
  return `<section class="mc-panel"><div class="mc-panel-head"><h2>${title}</h2><span class="mc-count">${quests.length}</span></div>${quests.length ? quests.map((quest) => questItem(quest)).join("") : '<div class="mc-mini-empty">Sin misiones en esta sección.</div>'}</section>`;
}

function renderIdeas() {
  const ideas = [...app.state.ideas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return `<div class="mc-page-head"><div><span class="mc-kicker">Cooldown before commitment</span><h1>Idea Vault</h1><p>Captura rápido. Evalúa despacio. Una idea no es todavía un proyecto.</p></div><button class="mc-button mc-button--primary" data-capture="idea">${icon("plus")} Nueva idea</button></div><div class="mc-idea-grid">${ideas.length ? ideas.map(ideaCard).join("") : '<section class="mc-panel mc-empty"><span>◇</span><h2>El Vault está vacío</h2><p>Aquí vivirán las ideas que todavía no necesitan convertirse en proyectos.</p></section>'}</div>`;
}

function ideaCard(idea) {
  const locked = new Date(idea.cooldown_until).getTime() > Date.now();
  return `<article class="mc-panel mc-idea-card ${locked ? "is-locked" : ""}"><div class="mc-panel-head"><span class="mc-lock">${locked ? "🔒" : "🔓"}</span>${statusBadge(idea.status)}</div><h2>${escapeHtml(idea.title)}</h2><p>${escapeHtml(idea.description || "Sin descripción.")}</p>${idea.tags?.length ? `<div class="mc-tags">${idea.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : ""}<div class="mc-cooldown"><span>${icon("clock")}</span><div><strong>${locked ? "Idea en cooldown" : "Ready to evaluate"}</strong><small>${locked ? `Disponible en ${relativeTime(idea.cooldown_until)}` : `Cooldown finalizado ${relativeTime(idea.cooldown_until)}`}</small></div></div>${!["CONVERTED", "DISCARDED"].includes(idea.status) ? `<div class="mc-inline-actions">${locked ? '<small>Protege el foco durante 72 horas.</small>' : `<button class="mc-button mc-button--primary" data-idea-convert="${idea.id}">Convertir en proyecto</button><button class="mc-button mc-button--ghost" data-idea-status="${idea.id}" data-status="DISCARDED">Descartar</button>`}</div>` : ""}</article>`;
}

function quickDialog() {
  return `<dialog class="mc-dialog mc-quick-dialog" data-quick-dialog><div class="mc-dialog-head"><div><span class="mc-kicker">Quick Capture</span><h2>¿Qué quieres capturar?</h2></div><button class="mc-icon-button" type="button" data-dialog-close aria-label="Cerrar">${icon("close")}</button></div><div class="mc-capture-grid"><button data-capture="quest">${icon("check")}<strong>Nueva Quest</strong><small>Algo que terminar</small></button><button data-capture="idea">${icon("bulb")}<strong>Nueva Idea</strong><small>Al Vault, sin abrir frente</small></button><button data-capture="project">${icon("flag")}<strong>Nuevo Proyecto</strong><small>Un resultado con entidad</small></button><button data-capture="goal">${icon("target")}<strong>Nuevo Goal</strong><small>Progreso medible</small></button></div></dialog>`;
}

function editorDialog() {
  return `<dialog class="mc-dialog mc-editor-dialog" data-editor-dialog><div data-editor-content></div></dialog>`;
}

function limitDialog() {
  return `<dialog class="mc-dialog mc-limit-dialog" data-limit-dialog><div class="mc-dialog-head"><div><span class="mc-kicker">Active project limit</span><h2>Ya tienes ${app.state.user_game_stats.max_active_projects} proyectos activos</h2></div><button class="mc-icon-button" type="button" data-dialog-close>${icon("close")}</button></div><p>Para proteger tu foco, pausa uno antes de activar el siguiente.</p><div class="mc-limit-list">${app.state.projects.filter((project) => project.status === "ACTIVE").map((project) => `<button type="button" data-pause-for-activate="${project.id}"><span class="mc-project-icon" style="--accent:${project.accent}">${escapeHtml(project.icon)}</span><span><strong>${escapeHtml(project.title)}</strong><small>${projectProgress(app.state, project)}% completado</small></span><b>Pausar</b></button>`).join("")}</div><button class="mc-text-button" type="button" data-force-activate>Activar de todas formas</button></dialog>`;
}

function editorMarkup(type, context = {}) {
  const project = context.editId ? projectFor(context.editId) : null;
  const commonHead = (kicker, title) => `<div class="mc-dialog-head"><div><span class="mc-kicker">${kicker}</span><h2>${title}</h2></div><button class="mc-icon-button" type="button" data-dialog-close>${icon("close")}</button></div>`;
  const projects = `<option value="">Sin proyecto</option>${app.state.projects.filter((item) => !["ARCHIVED", "COMPLETED"].includes(item.status)).map((item) => `<option value="${item.id}"${context.projectId === item.id ? " selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}`;
  if (type === "quest") return `${commonHead("Quest", context.main ? "Define la Main Quest" : "Nueva misión")}<form class="mc-form" data-editor-form="quest"><input type="hidden" name="project_id" value="${escapeAttribute(context.projectId || "")}"><label class="mc-field mc-field--wide"><span>Título</span><input name="title" required maxlength="180" autofocus placeholder="¿Qué significa terminar?"></label><label class="mc-field"><span>Proyecto</span><select name="project_select">${projects}</select></label><label class="mc-field"><span>Categoría</span><select name="category">${["MONEY", "GROWTH", "BUILD", "MAINTENANCE", "EXPERIMENT"].map((item) => `<option>${item}</option>`).join("")}</select></label><label class="mc-field"><span>XP</span><input name="xp_reward" type="number" min="0" max="5000" value="${context.main ? 100 : 30}"></label><label class="mc-field"><span>Frecuencia</span><select name="recurrence_type" data-recurrence><option value="once">Una vez</option><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option></select></label><label class="mc-field"><span>Fecha</span><input name="due_date" type="date" value="${dateKey()}"></label><label class="mc-field"><span>Minutos estimados</span><input name="estimated_minutes" type="number" min="0" max="1440" value="30"></label><label class="mc-field"><span>Impacto económico</span><select name="money_impact"><option value="none">Ninguno</option><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option><option value="direct">Directo</option></select></label><label class="mc-check-field"><input name="is_main_quest" type="checkbox"${context.main ? " checked" : ""}><span>Usar como Main Quest</span></label><button class="mc-button mc-button--primary mc-button--wide" type="submit">Crear misión</button></form>`;
  if (type === "idea") return `${commonHead("Idea Vault", "Captura sin abrir otro frente")}<form class="mc-form" data-editor-form="idea"><label class="mc-field mc-field--wide"><span>Título</span><input name="title" required maxlength="180" autofocus placeholder="La idea en una línea"></label><label class="mc-field mc-field--wide"><span>Descripción</span><textarea name="description" rows="4" placeholder="Contexto suficiente para evaluarla dentro de 72 horas"></textarea></label><label class="mc-field mc-field--wide"><span>Tags <small>separados por comas</small></span><input name="tags" placeholder="automatización, ventas"></label><button class="mc-button mc-button--primary mc-button--wide" type="submit">Guardar en el Vault</button></form>`;
  if (type === "project") return `${commonHead(project ? "Project settings" : "Project", project ? `Editar ${escapeHtml(project.title)}` : "Nuevo proyecto")}<form class="mc-form" data-editor-form="project"><input type="hidden" name="id" value="${escapeAttribute(project?.id || "")}"><label class="mc-field mc-field--wide"><span>Nombre</span><input name="title" required maxlength="120" autofocus value="${escapeAttribute(project?.title || "")}" placeholder="Nombre del proyecto"></label><label class="mc-field mc-field--wide"><span>Descripción</span><textarea name="description" rows="3">${escapeHtml(project?.description || "")}</textarea></label><label class="mc-field"><span>Estado</span><select name="status">${["ACTIVE", "PAUSED", "IDEA", "COMPLETED", "ARCHIVED"].map((item) => `<option${project?.status === item || (!project && item === "PAUSED") ? " selected" : ""}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Prioridad</span><select name="priority">${["LOW", "NORMAL", "HIGH", "CRITICAL"].map((item) => `<option${project?.priority === item ? " selected" : ""}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Icono</span><input name="icon" maxlength="8" value="${escapeAttribute(project?.icon || "◆")}"></label><label class="mc-field"><span>Color</span><input name="accent" type="color" value="${escapeAttribute(project?.accent || "#6ee7d8")}"></label><label class="mc-field mc-field--wide"><span>Objetivo principal</span><input name="main_goal" maxlength="240" value="${escapeAttribute(project?.main_goal || "")}"></label><label class="mc-field"><span>Progreso manual</span><input name="progress" type="number" min="0" max="100" value="${project?.progress || 0}"></label><label class="mc-field"><span>Método</span><select name="progress_method"><option value="manual"${project?.progress_method !== "calculated" ? " selected" : ""}>Manual</option><option value="calculated"${project?.progress_method === "calculated" ? " selected" : ""}>Calculado por goals</option></select></label><label class="mc-field mc-field--wide"><span>Notas</span><textarea name="notes" rows="4">${escapeHtml(project?.notes || "")}</textarea></label><label class="mc-field mc-field--wide"><span>Enlaces <small>uno por línea: Nombre | URL</small></span><textarea name="links" rows="3">${escapeHtml((project?.links || []).map((link) => `${link.label} | ${link.url}`).join("\n"))}</textarea></label><button class="mc-button mc-button--primary mc-button--wide" type="submit">${project ? "Guardar cambios" : "Crear proyecto"}</button></form>`;
  return `${commonHead(context.boss ? "Weekly Boss" : "Goal", context.boss ? "Define el gran cierre semanal" : "Nuevo objetivo")}<form class="mc-form" data-editor-form="goal"><label class="mc-field mc-field--wide"><span>Título</span><input name="title" required maxlength="180" autofocus placeholder="Resultado medible"></label><label class="mc-field"><span>Proyecto</span><select name="project_id">${projects}</select></label><label class="mc-field"><span>Periodo</span><select name="period">${["DAILY", "WEEKLY", "MONTHLY"].map((item) => `<option${context.boss && item === "WEEKLY" ? " selected" : ""}>${item}</option>`).join("")}</select></label><label class="mc-field"><span>Valor actual</span><input name="current_value" type="number" min="0" value="0"></label><label class="mc-field"><span>Objetivo</span><input name="target_value" type="number" min="1" value="10"></label><label class="mc-field"><span>Unidad</span><select name="unit"><option value="count">Cantidad</option><option value="€">€</option><option value="%">%</option><option value="boolean">Sí / no</option></select></label><label class="mc-field"><span>XP al completar</span><input name="xp_reward" type="number" min="0" max="5000" value="${context.boss ? 300 : 100}"></label><label class="mc-check-field"><input name="is_boss" type="checkbox"${context.boss ? " checked" : ""}><span>Usar como Weekly Boss</span></label><button class="mc-button mc-button--primary mc-button--wide" type="submit">Crear objetivo</button></form>`;
}

function openEditor(type, context = {}) {
  document.querySelector("[data-quick-dialog]")?.close();
  const dialog = document.querySelector("[data-editor-dialog]");
  dialog.querySelector("[data-editor-content]").innerHTML = editorMarkup(type, context);
  dialog.showModal();
}

function toast(message, tone = "success") {
  const region = document.querySelector("[data-toasts]");
  if (!region) return;
  const item = document.createElement("div");
  item.className = `mc-toast mc-toast--${tone}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3600);
}

function celebrate(target) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = target?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const burst = document.createElement("div");
  burst.className = "mc-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  burst.innerHTML = Array.from({ length: 8 }, (_, index) => `<i style="--i:${index}"></i>`).join("");
  document.body.append(burst);
  setTimeout(() => burst.remove(), 700);
}

async function mutate(action, payload, { success = "Guardado", target = null } = {}) {
  const mutation = { action, payload, operation_id: operationId(), expected_revision: app.revision };
  try {
    let response;
    if (app.localPreview) {
      const applied = applyControlMutation(app.state, mutation, { userId: "demo", now: Date.now() });
      response = { state: applied.state, revision: app.revision + (applied.idempotent ? 0 : 1), result: applied.result };
      localStorage.setItem("ivanimports.mission-control.local-demo.v1", JSON.stringify(response));
    } else response = await fetchJson(API.mutate, { method: "POST", body: JSON.stringify(mutation) });
    app.state = response.state;
    app.revision = response.revision;
    render();
    if (success) toast(success);
    if (action === "quest.complete") celebrate(target);
    return response;
  } catch (error) {
    if (error.message === "active_project_limit" || error.body?.error === "active_project_limit") {
      app.pendingMutation = { action, payload };
      document.querySelector("[data-limit-dialog]")?.showModal();
      return null;
    }
    if (error.status === 409 && error.body?.state) {
      app.state = error.body.state;
      app.revision = error.body.revision;
      render();
      toast("El mapa cambió en otra pestaña. Se ha actualizado.", "warning");
      return null;
    }
    toast(error.message === "idea_cooldown_active" ? "La idea sigue en cooldown." : "No se pudo guardar. Inténtalo de nuevo.", "error");
    throw error;
  }
}

function render() {
  app.route ||= parseRoute();
  let content = renderDashboard();
  if (app.route.name === "project") content = renderProjectDetail(projectFor(app.route.id));
  if (app.route.name === "quests") content = renderAllQuests();
  if (app.route.name === "ideas") content = renderIdeas();
  app.root.innerHTML = appShell(content);
  app.root.removeAttribute("aria-busy");
  const viewTitle = app.route.name === "project" ? projectFor(app.route.id)?.title || "Project" : app.route.name === "quests" ? "All Quests" : "Idea Vault";
  document.title = app.route.name === "dashboard" ? "Mission Control" : `${viewTitle} · Mission Control`;
}

function renderLogin() {
  app.root.innerHTML = `<main class="mc-auth"><section class="mc-auth-card"><div class="mc-brand"><span class="mc-brand-mark">MC</span><span><strong>Mission Control</strong><small>Private access</small></span></div><span class="mc-kicker">Acceso privado</span><h1>Vuelve a tu mapa.</h1><p>Introduce tu código para entrar en Mission Control.</p><form class="mc-auth-form" data-control-login><label><span>Código de acceso</span><input type="password" name="code" required autocomplete="current-password" autofocus maxlength="128" placeholder="Código"></label><button class="mc-button mc-button--primary mc-button--wide">Entrar en Mission Control</button></form><p class="mc-auth-status" data-auth-status aria-live="polite"></p></section></main>`;
  app.root.removeAttribute("aria-busy");
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function handleSubmit(event) {
  const loginForm = event.target.closest("[data-control-login]");
  if (loginForm) {
    event.preventDefault();
    const data = formObject(loginForm);
    const status = document.querySelector("[data-auth-status]");
    const button = loginForm.querySelector("button");
    status.textContent = "Comprobando código…";
    button.disabled = true;
    try {
      await fetchJson(API.login, { method: "POST", body: JSON.stringify({ code: data.code }) });
      location.assign("/control/");
    } catch {
      status.textContent = "Código incorrecto.";
      loginForm.elements.code.select();
      button.disabled = false;
    }
    return;
  }
  const filterForm = event.target.closest("[data-filters]");
  if (filterForm) { event.preventDefault(); return; }
  const editor = event.target.closest("[data-editor-form]");
  if (!editor) return;
  event.preventDefault();
  const type = editor.dataset.editorForm;
  const data = formObject(editor);
  if (type === "quest") {
    data.project_id = data.project_select || data.project_id || null;
    data.xp_reward = Number(data.xp_reward);
    data.estimated_minutes = Number(data.estimated_minutes) || null;
    data.is_main_quest = editor.elements.is_main_quest.checked;
    data.due_date = data.recurrence_type === "once" && data.due_date ? `${data.due_date}T12:00:00Z` : null;
    await mutate("quest.create", data, { success: `Quest creada · +${data.xp_reward} XP al completar` });
  }
  if (type === "idea") {
    data.tags = String(data.tags || "").split(",").map((item) => item.trim()).filter(Boolean);
    await mutate("idea.create", data, { success: "Idea enviada al Vault · cooldown 72 h" });
  }
  if (type === "project") {
    data.progress = Number(data.progress);
    data.links = String(data.links || "").split("\n").map((line) => { const [label, ...url] = line.split("|"); return { label: label.trim(), url: url.join("|").trim() }; }).filter((link) => link.label && /^https?:\/\//.test(link.url));
    const action = data.id ? "project.update" : "project.create";
    await mutate(action, data, { success: data.id ? "Proyecto actualizado" : "Proyecto creado" });
  }
  if (type === "goal") {
    data.project_id ||= null;
    data.current_value = Number(data.current_value);
    data.target_value = Number(data.target_value);
    data.xp_reward = Number(data.xp_reward);
    data.is_boss = editor.elements.is_boss.checked;
    await mutate("goal.create", data, { success: data.is_boss ? "Weekly Boss definido" : "Objetivo creado" });
  }
  document.querySelector("[data-editor-dialog]")?.close();
}

async function handleClick(event) {
  const nav = event.target.closest("[data-nav]");
  if (nav && nav.origin === location.origin && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); navigate(`${nav.pathname}${nav.search}`); return; }
  if (event.target.closest("[data-dialog-close]")) { event.target.closest("dialog")?.close(); return; }
  if (event.target.closest("[data-action='quick-open']")) { document.querySelector("[data-quick-dialog]")?.showModal(); return; }
  const capture = event.target.closest("[data-capture]");
  if (capture) { openEditor(capture.dataset.capture, { main: capture.dataset.main === "true", boss: capture.dataset.boss === "true", projectId: capture.dataset.project || (app.route.name === "project" ? app.route.id : "") }); return; }
  const questToggle = event.target.closest("[data-quest-toggle]");
  if (questToggle) {
    const quest = app.state.quests.find((item) => item.id === questToggle.dataset.questToggle);
    const complete = todayCompletion(quest) || (quest.recurrence_type === "once" && quest.status === "COMPLETED");
    await mutate(complete ? "quest.undo" : "quest.complete", { id: quest.id, period_key: questPeriodKey(quest) }, { success: complete ? `Quest reabierta · -${quest.xp_reward} XP` : `+${quest.xp_reward} XP · Misión completada`, target: questToggle });
    return;
  }
  const editProject = event.target.closest("[data-edit-project]");
  if (editProject) { openEditor("project", { editId: editProject.dataset.editProject }); return; }
  const projectStatus = event.target.closest("[data-project-status]");
  if (projectStatus) { await mutate("project.update", { id: projectStatus.dataset.projectStatus, status: projectStatus.dataset.status }, { success: projectStatus.dataset.status === "ACTIVE" ? "Proyecto activado" : "Proyecto pausado" }); return; }
  const increment = event.target.closest("[data-goal-increment]");
  if (increment) { const goal = app.state.goals.find((item) => item.id === increment.dataset.goalIncrement); await mutate("goal.update", { id: goal.id, current_value: Number(goal.current_value) + 1 }, { success: "Progreso actualizado" }); return; }
  const ideaConvert = event.target.closest("[data-idea-convert]");
  if (ideaConvert) { await mutate("idea.convert", { id: ideaConvert.dataset.ideaConvert }, { success: "Idea convertida en proyecto · permanece en estado IDEA" }); return; }
  const ideaStatus = event.target.closest("[data-idea-status]");
  if (ideaStatus) { await mutate("idea.update", { id: ideaStatus.dataset.ideaStatus, status: ideaStatus.dataset.status }, { success: "Idea actualizada" }); return; }
  const pauseFor = event.target.closest("[data-pause-for-activate]");
  if (pauseFor && app.pendingMutation) {
    const activateId = app.pendingMutation.payload.id;
    document.querySelector("[data-limit-dialog]")?.close();
    await mutate("project.pause-and-activate", { pause_id: pauseFor.dataset.pauseForActivate, activate_id: activateId }, { success: "Foco actualizado: un proyecto pausado y otro activado" });
    app.pendingMutation = null;
    return;
  }
  if (event.target.closest("[data-force-activate]") && app.pendingMutation) {
    const pending = app.pendingMutation;
    app.pendingMutation = null;
    document.querySelector("[data-limit-dialog]")?.close();
    await mutate(pending.action, { ...pending.payload, force: true }, { success: "Proyecto activado por encima del límite" });
    return;
  }
  if (event.target.closest("[data-action='demo-reset']")) {
    if (!confirm("¿Restaurar los datos de demostración?")) return;
    if (app.localPreview) { app.state = createDemoControlState("demo"); app.revision += 1; localStorage.removeItem("ivanimports.mission-control.local-demo.v1"); render(); }
    else { const response = await fetchJson(API.demoReset, { method: "POST", body: "{}" }); app.state = response.state; app.revision = response.revision; render(); }
    toast("Demo restaurada");
    return;
  }
}

function handleChange(event) {
  const filters = event.target.closest("[data-filters]");
  if (filters) { app.filters = { ...app.filters, ...formObject(filters) }; render(); }
}

async function boot() {
  app.route = parseRoute(document.body.dataset.controlRoute || location.pathname);
  try {
    if (app.localPreview) {
      const saved = JSON.parse(localStorage.getItem("ivanimports.mission-control.local-demo.v1") || "null");
      app.session = { authenticated: true, user: { email_masked: "preview@local", demo: true } };
      app.state = saved?.state || createDemoControlState("demo");
      app.revision = saved?.revision || 0;
      render();
      return;
    }
    app.session = await fetchJson(API.session);
    if (!app.session.authenticated) { renderLogin(); return; }
    const payload = await fetchJson(API.state);
    app.state = payload.state;
    app.revision = payload.revision;
    render();
  } catch {
    app.root.innerHTML = `<main class="mc-auth"><section class="mc-auth-card"><span class="mc-kicker">Connection lost</span><h1>No hemos podido abrir tu mapa.</h1><p>Comprueba la conexión y la configuración privada de Mission Control.</p><button class="mc-button mc-button--primary" onclick="location.reload()">Reintentar</button></section></main>`;
  }
}

document.addEventListener("click", (event) => { handleClick(event).catch(() => {}); });
document.addEventListener("submit", (event) => { handleSubmit(event).catch(() => {}); });
document.addEventListener("change", handleChange);
window.addEventListener("popstate", () => { app.route = parseRoute(); render(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
  if (!["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
    if (event.key === "1") navigate("/control/");
    if (event.key === "2") navigate("/control/quests/");
    if (event.key === "3") navigate("/control/ideas/");
    if (event.key.toLowerCase() === "n") document.querySelector("[data-quick-dialog]")?.showModal();
  }
});

boot();
