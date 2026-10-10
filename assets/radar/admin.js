const { state, clientId, csrf } = document.body.dataset;
const err = (message) => { const el = document.getElementById("err"); if (el) el.textContent = message || ""; };
const api = (action, options = {}) => fetch(`/api/radar/${action}`, { credentials: "same-origin", ...options });

function showSub(sub) {
  document.querySelector("main .card").innerHTML = `<h1>Tu identificador de Google</h1><p>Cópialo en Vercel como <code>RADAR_ADMIN_GOOGLE_SUBS</code> y vuelve a desplegar. No lo compartas públicamente.</p><p><code id="sub"></code></p><button class="btn" id="copy">Copiar</button><p>Después de redesplegar, este modo de alta desaparece y solo esa cuenta podrá entrar.</p>`;
  document.getElementById("sub").textContent = sub;
  document.getElementById("copy").onclick = () => navigator.clipboard.writeText(sub);
}

async function login() {
  const ready = await new Promise((resolve) => { let tries = 0; const t = setInterval(() => { if (window.google?.accounts?.id || ++tries > 100) { clearInterval(t); resolve(!!window.google?.accounts?.id); } }, 100); });
  if (!ready) return err("No se pudo cargar Google Sign-In.");
  const nonceResponse = await api("admin-nonce");
  if (!nonceResponse.ok) return err(nonceResponse.status === 429 ? "Demasiados intentos; espera unos minutos." : "No se pudo preparar el inicio de sesión.");
  const { nonce } = await nonceResponse.json();
  window.google.accounts.id.initialize({
    client_id: clientId, nonce, ux_mode: "popup",
    callback: async ({ credential }) => {
      const response = await api("admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
      if (response.ok) { const out = await response.json(); if (out.setup) return showSub(out.sub); location.reload(); } else err(response.status === 403 ? "Esta cuenta no tiene acceso." : "No se pudo iniciar sesión.");
    },
  });
  window.google.accounts.id.renderButton(document.getElementById("g-button"), { theme: "outline", size: "large", text: "continue_with", shape: "pill" });
}

/* ===================== PANEL (Etapa 2) ===================== */
import { bindFicha, esc, renderFicha } from "./render.js";
import { COST_GROUPS, COST_ITEMS, COST_STATUS, costSummary, relevant } from "./cost-model.js";

const NF = new Intl.NumberFormat("es-ES", { useGrouping: "always", maximumFractionDigits: 2 });
const root = document.getElementById("ax") || document.createElement("div");
const A = { view: "dash", list: [], counts: {}, templates: [], D: null, msg: null, tpl: "", rights: false, openAnalysis: false };
const EDIT = { draft: "Borrador", express: "Express", analyzing: "En análisis", reviewed: "Revisado", discarded: "Descartado" };
const LIST = { available: "Disponible", pending: "Pendiente de confirmar", withdrawn: "Retirado", sold: "Vendido (confirmado)", archived: "Archivado" };
const ACCESS = { pro: "Solo PRO", delayed: "PRO primero, Gratis después", free: "Gratis básico", pro_open: "Análisis PRO abierto a todos" };
const QS = { pending: "Pendiente", asked: "Preguntado", answered: "Respondido", verified: "Verificado", unverified: "No verificado" };
const RK = { confirmed: "Confirmado", declared: "Declarado por el vendedor", estimated: "Estimado", hypothesis: "Hipótesis", pending: "Pendiente" };
const COUNTERS = [["published", "Publicados"], ["draft", "Borradores"], ["reviewed", "Revisados"], ["express", "Express"], ["archived", "Archivados"], ["access_free", "Gratuitos"], ["access_pro", "Solo PRO"], ["access_open", "PRO abiertos"]];
const ERRNAME = { version_conflict: "Alguien (u otra pestaña) ha modificado este vehículo. Recarga para no perder cambios.", validation: "Revisa estos campos:", blob_not_configured: "El almacenamiento de imágenes no está configurado (RADAR_BLOB_READ_WRITE_TOKEN).", unsupported_image: "Formato de imagen no admitido (JPG, PNG o WebP).", too_large: "La imagen es demasiado grande.", unpublish_first: "Despublica antes de borrar.", rate_limited: "Demasiadas solicitudes; espera un momento." };

async function call(action, { method = "GET", body, query = "", raw, headers = {} } = {}) {
  const init = { method, credentials: "same-origin", headers: { ...(method === "POST" ? { "x-radar-csrf": csrf } : {}), ...headers } };
  if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  if (raw) init.body = raw;
  const res = await fetch(`/api/radar/${action}${query ? `?${query.replace(/^[?&]/, "")}` : ""}`, init);
  if (res.status === 401) { location.reload(); return { ok: false, status: 401, data: {} }; }
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}
const say = (text, kind = "ok", errors = []) => { A.msg = { text, kind, errors }; };
const fmtErr = (data) => (data.errors || []).map((e) => ({ field: e.field, message: e.message }));

const getp = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
function setp(o, p, v) { const ks = p.split("."); let c = o; ks.slice(0, -1).forEach((k, i) => { if (c[k] == null) c[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; c = c[k]; }); const last = ks.at(-1); if (v === undefined || v === "") delete c[last]; else c[last] = v; }
const toLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); const z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const bad = (f) => (A.msg?.errors || []).some((e) => e.field === f || e.field?.startsWith(`${f}.`) || e.field?.startsWith(`${f}[`));
const inp = (p, label, { type = "text", options, w, ph = "", lines } = {}) => {
  let v = getp(A.D, p);
  if (lines) v = (v || []).join("\n");
  if (type === "datetime-local") v = toLocal(v);
  if (type === "date") v = v ? v.slice(0, 10) : "";
  const attrs = `data-p="${p}" data-t="${type}"${lines ? " data-lines" : ""}`;
  const field = options ? `<select ${attrs}><option value=""></option>${options.map((o) => { const [val, text] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(v) === String(val) ? "selected" : ""}>${esc(text)}</option>`; }).join("")}</select>` : type === "textarea" || lines ? `<textarea ${attrs} placeholder="${esc(ph)}">${esc(v ?? "")}</textarea>` : `<input ${attrs} type="${type === "number" ? "number" : type}" ${type === "number" ? 'step="any" inputmode="decimal"' : ""} value="${esc(v ?? "")}" placeholder="${esc(ph)}">`;
  return `<label class="ax-f ${w ? "w" : ""} ${bad(p) ? "bad" : ""}"><span>${label}</span>${field}</label>`;
};
const arr = (p) => getp(A.D, p) || [];
const msg = () => (A.msg ? `<div class="${A.msg.kind === "ok" ? "ax-ok" : "ax-err"}" role="alert">${esc(A.msg.text)}${A.msg.errors?.length ? `<ul>${A.msg.errors.map((e) => `<li>${esc(e.field)}: ${esc(e.message)}</li>`).join("")}</ul>` : ""}</div>` : "");

async function loadDash() {
  const [v, t] = await Promise.all([call("admin-vehicles"), call("admin-templates")]);
  if (v.ok) { A.list = v.data.vehicles; A.counts = v.data.counts; }
  if (t.ok) A.templates = t.data.templates;
  A.view = "dash"; draw();
}
function dash() {
  return `<div class="ax-top"><div><h1>Radar Admin</h1><p class="ax-note">Sesión iniciada con tu cuenta de Google autorizada. Contadores reales leídos del almacenamiento.</p></div><div class="ax-row"><button class="ax-btn y" data-act="new">+ Añadir vehículo</button><button class="ax-btn" data-act="logout">Cerrar sesión</button></div></div>
${msg()}<div class="ax-cnt">${COUNTERS.map(([k, l]) => `<div><small>${l}</small><b>${A.counts[k] ?? 0}</b></div>`).join("")}</div>
<div class="ax-card"><h2>Vehículos recientes</h2>${A.list.length ? `<div class="ax-list">${A.list.map((v) => `<div class="ax-item">${v.cover ? `<img src="${esc(v.cover)}" alt="">` : '<div class="ph0"></div>'}<div><b>${esc([v.brand, v.model, v.year].filter(Boolean).join(" ") || "Sin título")}</b><span class="ax-chip ${v.published ? "g" : "y"}">${v.published ? "Publicado" : "No publicado"}</span><span class="ax-chip">${EDIT[v.editorialStatus] || ""}</span><span class="ax-chip">${LIST[v.listingStatus] || ""}</span><span class="ax-chip">${ACCESS[v.accessMode] || ""}</span></div><div class="ax-row"><button class="ax-btn s" data-act="edit" data-id="${v.id}">Editar</button>${v.published ? `<a class="ax-btn s" style="text-decoration:none" href="/radar/coche/${v.slug}/" target="_blank" rel="noopener">Ver</a>` : ""}</div></div>`).join("")}</div>` : '<p class="ax-note">Todavía no has creado ningún vehículo. Pulsa «+ Añadir vehículo».</p>'}</div>`;
}

function newVehicle() { A.D = { clientId: crypto.randomUUID(), editorialStatus: "draft", listingStatus: "available", accessMode: "pro", currency: "EUR", images: [], features: [], costs: { mode: "truck", items: [] }, comparables: [], questions: [], risks: [] }; A.msg = null; A.view = "edit"; draw(); }
function normalizeLoaded() { A.D.costs ||= { mode: "truck", items: [] }; for (const k of ["images", "features", "comparables", "questions", "risks"]) A.D[k] ||= []; }
async function openVehicle(id) { const r = await call("admin-vehicle", { query: `id=${id}` }); if (!r.ok) { say("No se pudo abrir el vehículo.", "err"); return draw(); } A.D = r.data.vehicle; normalizeLoaded(); A.msg = null; A.view = "edit"; draw(); }
const costMap = () => Object.fromEntries((A.D.costs.items || []).map((i) => [i.key, i]));
function costRow(def, it) {
  const on = Boolean(it);
  return `<div class="ax-cost" data-key="${esc(def.key)}"><input type="checkbox" data-c="on" ${on ? "checked" : ""} aria-label="Incluir ${esc(def.label)}"><span>${esc(def.label)}</span><input type="number" step="any" min="0" data-c="amount" value="${it?.amount ?? ""}" placeholder="€" ${on ? "" : "disabled"}><select data-c="status" ${on ? "" : "disabled"}>${Object.entries(COST_STATUS).map(([k, l]) => `<option value="${k}" ${(it?.status || "pending") === k ? "selected" : ""}>${l}</option>`).join("")}</select><input class="nt" type="text" data-c="note" value="${esc(it?.note ?? "")}" placeholder="Observación / fuente" ${on ? "" : "disabled"}></div>`;
}
function costsSection() {
  const m = costMap(), mode = A.D.costs.mode, cs = costSummary({ price: A.D.price || 0, costs: A.D.costs, reference: A.D.spainReference });
  const custom = (A.D.costs.items || []).filter((i) => i.key.startsWith("custom:"));
  return `<div class="ax-row"><label class="ax-f"><span>Escenario</span><select data-cmode><option value="truck" ${mode === "truck" ? "selected" : ""}>Contratar transporte profesional</option><option value="pickup" ${mode === "pickup" ? "selected" : ""}>Recoger personalmente</option></select></label><label class="ax-f"><span>Plantilla de gastos</span><select data-tpl><option value="">— elegir —</option>${A.templates.map((t) => `<option value="${t.id}" ${A.tpl === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label></div>
<div class="ax-row"><button class="ax-btn s" data-act="tpl-apply">Aplicar plantilla</button><button class="ax-btn s" data-act="tpl-new">Guardar como plantilla nueva</button><button class="ax-btn s" data-act="tpl-update">Actualizar plantilla elegida</button><button class="ax-btn s r" data-act="tpl-del">Borrar plantilla</button></div><p class="ax-note">Las plantillas son tus importes habituales: al aplicarlas se copian a este vehículo y puedes modificarlos sin tocar la plantilla. No hay importes por defecto. Marca solo lo que corresponda a esta operación.</p>
${[1, 2, 3, 4].map((g) => `<div><b>${COST_GROUPS[g]}</b>${COST_ITEMS.filter((d) => d.group === g && relevant(d, mode)).map((d) => costRow(d, m[d.key])).join("")}${g === 4 ? custom.map((c) => costRow({ key: c.key, label: c.label }, c)).join("") + '<button class="ax-btn s" data-act="cost-add">＋ Añadir gasto personalizado</button>' : ""}</div>`).join("")}
<div class="ax-tot"><div><small>Precio del coche</small><b>${A.D.price ? NF.format(A.D.price) : "—"} €</b></div><div><small>Coste estimado puesto en España</small><b data-tot>${NF.format(cs.total)} €</b></div><div><small>Diferencia estimada</small><b data-dif>${cs.difference === null ? "—" : `${NF.format(cs.difference)} €`}</b></div></div>${cs.partial ? `<p class="ax-note">Estimación parcial: pendiente ${esc(cs.pending.join(", "))}.</p>` : ""}`;
}
function repeater(p, title, addLabel, rowHtml) {
  return `<div class="ax-body"><p class="ax-note">${title}</p>${arr(p).map((x, i) => `<div class="ax-rep">${rowHtml(x, i)}<div class="ax-row"><button class="ax-btn s r" data-act="rm" data-p="${p}" data-i="${i}">Quitar</button><button class="ax-btn s" data-act="up" data-p="${p}" data-i="${i}">↑</button><button class="ax-btn s" data-act="down" data-p="${p}" data-i="${i}">↓</button></div></div>`).join("")}<button class="ax-btn s" data-act="add" data-p="${p}">${addLabel}</button></div>`;
}
function editor() {
  const D = A.D, st = D.editorialStatus;
  const imgs = D.images.map((im, i) => `<div class="${i === 0 ? "cov" : ""}"><img src="${esc(im.url)}" alt=""><label class="ax-f"><span>${i === 0 ? "Portada · " : ""}Texto alternativo</span><input type="text" data-p="images.${i}.alt" data-t="text" value="${esc(im.alt || "")}"></label><div class="ax-row"><button class="ax-btn s" data-act="cover" data-i="${i}" ${i === 0 ? "disabled" : ""}>Portada</button><button class="ax-btn s" data-act="img-up" data-i="${i}">←</button><button class="ax-btn s" data-act="img-down" data-i="${i}">→</button><button class="ax-btn s r" data-act="img-rm" data-i="${i}">Quitar</button></div></div>`).join("");
  return `<div class="ax-top"><div><button class="ax-btn s" data-act="back">← Vehículos</button><h1>${esc([D.brand, D.model].filter(Boolean).join(" ") || "Nuevo vehículo")}</h1><p class="ax-note">${D.id ? `Versión ${D.version} · ${D.published ? "Publicado" : "Sin publicar"}${D.published ? ` · <a href="/radar/coche/${D.slug}/" target="_blank" rel="noopener">ver ficha pública</a>` : ""}` : "Aún no guardado"}</p></div></div>${msg()}
<form class="ax-form" onsubmit="return false">
<details open><summary>1 · Anuncio y vehículo</summary><div class="ax-body">${inp("originalUrl", "Pega el enlace del anuncio", { w: 1, ph: "https://…" })}<p class="ax-note">No se importan datos automáticamente: rellena los campos a mano.</p><div class="ax-g">${inp("platform", "Plataforma")}${inp("country", "País")}${inp("brand", "Marca")}${inp("model", "Modelo")}${inp("versionName", "Versión")}${inp("engine", "Motorización")}${inp("fuel", "Combustible", { options: ["Diésel", "Gasolina", "Híbrido", "Eléctrico", "GLP", "Otro"] })}${inp("transmission", "Cambio", { options: ["Manual", "Automático", "Otro"] })}${inp("hp", "Potencia (CV)", { type: "number" })}${inp("year", "Año", { type: "number" })}${inp("firstRegistration", "Primera matriculación (aaaa-mm)")}${inp("km", "Kilómetros", { type: "number" })}${inp("price", "Precio del coche", { type: "number" })}${inp("currency", "Moneda", { options: ["EUR", "GBP", "CHF", "PLN", "CZK", "SEK", "DKK"] })}</div>${inp("features", "Características (una por línea)", { lines: 1, w: 1 })}${inp("description", "Descripción del anuncio", { type: "textarea", w: 1 })}${inp("firstImpression", "Primera impresión de Iván (visible)", { type: "textarea", w: 1 })}${inp("internalNotes", "Notas internas (solo tú)", { type: "textarea", w: 1 })}</div></details>
<details open><summary>2 · Fotografías</summary><div class="ax-body"><label class="ax-row" style="font-size:14px"><input type="checkbox" data-rights ${A.rights ? "checked" : ""}> Confirmo que tengo permiso para usar estas fotografías en Radar.</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload ${A.rights ? "" : "disabled"}><p class="ax-note">Se reducen a 1600 px y se reencodifican antes de subirse (así se eliminan los datos EXIF). La primera es la portada. Máx. 30.</p><div class="ax-ph">${imgs}</div></div></details>
<details open><summary>3 · Estado, acceso y publicación</summary><div class="ax-body"><div class="ax-g">${inp("editorialStatus", "Estado editorial", { options: Object.entries(EDIT) })}${inp("listingStatus", "Estado del anuncio", { options: Object.entries(LIST) })}${inp("accessMode", "Acceso", { options: Object.entries(ACCESS) })}${D.accessMode === "delayed" ? inp("freeReleaseAt", "Se libera gratis el", { type: "datetime-local" }) : ""}${D.accessMode === "pro_open" ? inp("openUntil", "Abierto hasta (vacío = sin cierre)", { type: "datetime-local" }) : ""}</div>${D.accessMode === "delayed" ? `<div class="ax-row">${[24, 48, 72].map((h) => `<button class="ax-btn s" data-act="free-in" data-h="${h}">+${h} h desde ${D.publishedAt ? "la publicación" : "ahora"}</button>`).join("")}</div>` : ""}<p class="ax-note">Todo vehículo nuevo es solo PRO por defecto. Las fechas y permisos se aplican en el servidor. «Retirado» y «Archivado» no son lo mismo que vendido.</p></div></details>
<details ${["reviewed", "discarded"].includes(st) ? "open" : ""}><summary>4 · Análisis de Iván (Revisado)</summary><div class="ax-body">${inp("analysis.head", "Frase destacada", { w: 1 })}${inp("analysis.why", "Por qué lo he seleccionado", { type: "textarea", w: 1 })}${inp("analysis.like", "Qué me gusta (una por línea)", { lines: 1, w: 1 })}${inp("analysis.doubt", "Mis dudas (una por línea)", { lines: 1, w: 1 })}${inp("analysis.chk", "Qué comprobaría antes de comprar", { type: "textarea", w: 1 })}${inp("analysis.body", "Análisis ampliado (opcional)", { type: "textarea", w: 1 })}<div class="ax-g">${inp("analysis.fair.min", "Precio razonable en España · mín.", { type: "number" })}${inp("analysis.fair.max", "· máx.", { type: "number" })}${inp("spainReference.value", "Referencia en España (valor que usas)", { type: "number" })}${inp("spainReference.min", "Rango visible · mín.", { type: "number" })}${inp("spainReference.max", "Rango visible · máx.", { type: "number" })}</div>${inp("spainReference.note", "Cómo has fijado la referencia (visible en PRO)", { w: 1 })}</div></details>
<details><summary>5 · Gastos de importación</summary><div class="ax-body" id="costs">${costsSection()}</div></details>
<details><summary>6 · Comparables españoles</summary>${repeater("comparables", "Anuncios que has usado para comparar. Precio anunciado, no precio de venta.", "＋ Añadir comparable", (c, i) => `<div class="ax-g">${inp(`comparables.${i}.title`, "Modelo y versión")}${inp(`comparables.${i}.price`, "Precio anunciado", { type: "number" })}${inp(`comparables.${i}.year`, "Año", { type: "number" })}${inp(`comparables.${i}.km`, "Km", { type: "number" })}${inp(`comparables.${i}.platform`, "Plataforma")}${inp(`comparables.${i}.url`, "Enlace")}${inp(`comparables.${i}.observedAt`, "Fecha observada", { type: "date" })}${inp(`comparables.${i}.note`, "Observación")}</div>`)}</details>
<details><summary>7 · Preguntas pendientes al vendedor</summary>${repeater("questions", "Una respuesta del vendedor no es una verificación: usa «Verificado» solo con evidencia.", "＋ Añadir pregunta", (q, i) => `<div class="ax-g">${inp(`questions.${i}.q`, "Pregunta", { w: 1 })}${inp(`questions.${i}.status`, "Estado", { options: Object.entries(QS) })}${inp(`questions.${i}.answer`, "Respuesta del vendedor")}${inp(`questions.${i}.evidence`, "Fuente o evidencia")}${inp(`questions.${i}.note`, "Observación visible")}${inp(`questions.${i}.internalNote`, "Nota interna (no se publica)")}</div><label class="ax-row"><input type="checkbox" data-p="questions.${i}.public" data-t="bool" ${q.public !== false ? "checked" : ""}> Mostrar en la ficha</label>`)}</details>
<details><summary>8 · Riesgos y comprobaciones</summary>${repeater("risks", "Distingue hechos, lo que declara el vendedor, estimaciones, hipótesis y pendientes.", "＋ Añadir riesgo", (r, i) => `<div class="ax-g">${inp(`risks.${i}.kind`, "Tipo", { options: Object.entries(RK) })}${inp(`risks.${i}.text`, "Descripción", { w: 1 })}</div>`)}</details>
<details><summary>9 · Vídeo</summary><div class="ax-body"><p class="ax-note">La subida de vídeo se añadirá en la Etapa 5. El diseño de V5 se conserva y no se muestra ningún reproductor vacío.</p></div></details>
</form>
<div class="ax-bar"><button class="ax-btn p" data-act="save">Guardar${D.published ? " cambios" : " borrador"}</button><button class="ax-btn" data-act="preview">Vista previa</button>${D.published ? '<button class="ax-btn" data-act="unpublish">Despublicar</button>' : '<button class="ax-btn y" data-act="publish">Publicar</button>'}${D.id ? `<select data-listing aria-label="Estado del anuncio">${Object.entries(LIST).map(([k, l]) => `<option value="${k}" ${D.listingStatus === k ? "selected" : ""}>${l}</option>`).join("")}</select><button class="ax-btn" data-act="listing">Cambiar estado del anuncio</button>` : ""}${D.id && !D.published ? '<button class="ax-btn r" data-act="delete">Eliminar borrador</button>' : ""}</div>`;
}
function draw() {
  const y = scrollY, open = [...root.querySelectorAll(".ax-form details")].map((d) => d.open);
  root.innerHTML = A.view === "dash" ? dash() : editor();
  const ds = [...root.querySelectorAll(".ax-form details")];
  if (open.length === ds.length) ds.forEach((d, i) => { d.open = open[i]; });
  if (A.openAnalysis && ds[3]) ds[3].open = true;
  A.openAnalysis = false;
  scrollTo(0, y);
}

async function save({ quiet = false } = {}) {
  const D = A.D, body = { data: D };
  if (D.id) { body.id = D.id; body.expectedVersion = D.version; } else body.clientId = D.clientId;
  const r = await call("admin-save", { method: "POST", body });
  if (!r.ok) { say(ERRNAME[r.data.error] || "No se pudo guardar.", "err", fmtErr(r.data)); draw(); return false; }
  A.D = r.data.vehicle; normalizeLoaded();
  if (!quiet) say("Guardado.", "ok"); draw(); return true;
}
async function transition(action, extra = {}, ok = "Hecho.") {
  const r = await call(action, { method: "POST", body: { id: A.D.id, expectedVersion: A.D.version, ...extra } });
  if (!r.ok) { say(ERRNAME[r.data.error] || "No se pudo completar la acción.", "err", fmtErr(r.data)); draw(); return false; }
  A.D = { ...A.D, ...r.data.vehicle }; say(ok, "ok"); draw(); return true;
}
function resize(file) {
  return createImageBitmap(file).then((bmp) => { const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)); const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); return new Promise((res) => c.toBlob(res, "image/jpeg", 0.84)); });
}
async function upload(files) {
  for (const f of files) {
    if (A.D.images.length >= 30) break;
    const blob = await resize(f);
    const r = await call("admin-image", { method: "POST", raw: blob, headers: { "Content-Type": "image/jpeg" }, query: A.D.id ? `vehicleId=${A.D.id}` : "" });
    if (!r.ok) { say(ERRNAME[r.data.error] || "No se pudo subir la imagen.", "err"); break; }
    A.D.images.push({ url: r.data.url, alt: "" });
  }
  draw();
}
const swap = (list, i, j) => { if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; };
const blank = { comparables: () => ({ title: "" }), questions: () => ({ q: "", status: "pending", public: true }), risks: () => ({ kind: "pending", text: "" }) };
const customKey = () => `custom:g${Date.now().toString(36)}`;

root.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.p) {
    const kind = t.dataset.t;
    const v = t.dataset.lines ? t.value.split("\n").map((x) => x.trim()).filter(Boolean) : kind === "number" ? (t.value === "" ? undefined : Number(t.value)) : kind === "bool" ? t.checked : kind === "datetime-local" || kind === "date" ? (t.value ? new Date(t.value).toISOString() : undefined) : t.value;
    setp(A.D, t.dataset.p, t.dataset.lines && !v.length ? undefined : v);
    if (["price", "spainReference.value"].includes(t.dataset.p)) refreshCosts();
  }
  const row = t.closest("[data-key]");
  if (row && t.dataset.c) {
    const items = A.D.costs.items, key = row.dataset.key, it = items.find((x) => x.key === key);
    if (t.dataset.c === "on") { if (t.checked && !it) items.push({ key, status: "pending", applicable: true, ...(key.startsWith("custom:") ? { label: "Gasto personalizado", group: 4 } : {}) }); if (!t.checked) A.D.costs.items = items.filter((x) => x.key !== key); draw(); return; }
    if (it) { if (t.dataset.c === "amount") { if (t.value === "") delete it.amount; else it.amount = Number(t.value); } else it[t.dataset.c] = t.value || undefined; refreshCosts(); }
  }
});
function refreshCosts() {
  const cs = costSummary({ price: A.D.price || 0, costs: A.D.costs, reference: A.D.spainReference });
  const b = root.querySelector("[data-tot]"), d = root.querySelector("[data-dif]");
  if (b) b.textContent = `${NF.format(cs.total)} €`;
  if (d) d.textContent = cs.difference === null ? "—" : `${NF.format(cs.difference)} €`;
}
root.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.hasAttribute("data-rights")) { A.rights = t.checked; draw(); }
  if (t.hasAttribute("data-upload") && t.files.length) await upload([...t.files]);
  if (t.hasAttribute("data-cmode")) { A.D.costs.mode = t.value; draw(); }
  if (t.hasAttribute("data-tpl")) A.tpl = t.value;
  if (t.dataset.p === "editorialStatus") A.openAnalysis = ["reviewed", "discarded"].includes(t.value);
  if (["accessMode", "editorialStatus"].includes(t.dataset.p)) draw();
});
root.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, i = Number(b.dataset.i), p = b.dataset.p;
  if (act === "new") return newVehicle();
  if (act === "edit") return openVehicle(b.dataset.id);
  if (act === "back") { A.msg = null; return loadDash(); }
  if (act === "logout") { await call("admin-logout", { method: "POST" }); return location.reload(); }
  if (act === "add") { A.D[p].push(blank[p]()); return draw(); }
  if (act === "rm") { A.D[p].splice(i, 1); return draw(); }
  if (act === "up" || act === "down") { swap(A.D[p], i, act === "up" ? i - 1 : i + 1); return draw(); }
  if (act === "cover") { A.D.images.unshift(...A.D.images.splice(i, 1)); return draw(); }
  if (act === "img-up" || act === "img-down") { swap(A.D.images, i, act === "img-up" ? i - 1 : i + 1); return draw(); }
  if (act === "img-rm") { A.D.images.splice(i, 1); return draw(); }
  if (act === "free-in") { const base = A.D.publishedAt ? Date.parse(A.D.publishedAt) : Date.now(); A.D.freeReleaseAt = new Date(base + Number(b.dataset.h) * 36e5).toISOString(); return draw(); }
  if (act === "cost-add") { A.D.costs.items.push({ key: customKey(), label: "Gasto personalizado", group: 4, status: "pending", applicable: true }); return draw(); }
  if (act === "tpl-apply") { const t = A.templates.find((x) => x.id === A.tpl); if (!t) { say("Elige una plantilla.", "err"); return draw(); } A.D.costs = { mode: t.mode, items: t.items.map((x) => ({ ...x })), templateId: t.id }; say(`Plantilla «${t.name}» aplicada. Puedes modificar cada importe; la plantilla no cambia.`, "ok"); return draw(); }
  if (act === "tpl-new" || act === "tpl-update") {
    const cur = A.templates.find((x) => x.id === A.tpl);
    if (act === "tpl-update" && !cur) { say("Elige la plantilla que quieres actualizar.", "err"); return draw(); }
    const name = act === "tpl-update" ? cur.name : prompt("Nombre de la plantilla (por ejemplo, «Alemania: recogida personal»)"); if (!name) return;
    const items = A.D.costs.items.map(({ key, amount, status, applicable, note, source, label, group }) => ({ key, amount, status, applicable, note, source, label, group }));
    const r = await call("admin-template-save", { method: "POST", body: { id: act === "tpl-update" ? cur.id : undefined, name, mode: A.D.costs.mode, items } });
    if (!r.ok) { say("No se pudo guardar la plantilla.", "err", fmtErr(r.data)); return draw(); }
    A.templates = (await call("admin-templates")).data.templates; A.tpl = r.data.template.id; say("Plantilla guardada.", "ok"); return draw();
  }
  if (act === "tpl-del") { if (!A.tpl || !confirm("¿Borrar esta plantilla? Los vehículos que la usaron no cambian.")) return; await call("admin-template-delete", { method: "POST", body: { id: A.tpl } }); A.templates = (await call("admin-templates")).data.templates; A.tpl = ""; say("Plantilla borrada.", "ok"); return draw(); }
  if (act === "save") return save();
  if (act === "preview") {
    if (!(await save({ quiet: true }))) return;
    const r = await call("admin-vehicle", { query: `id=${A.D.id}` });
    const v = { ...r.data.vehicle, tier: "open" };
    const ov = document.createElement("div"); ov.className = "ax-ov";
    ov.innerHTML = `<div class="ax-ovin"><div class="ax-ovbar"><span>Vista previa privada: así la vería un miembro PRO (la versión Gratis muestra menos datos).</span><button class="ax-btn s" data-close>Cerrar</button></div>${renderFicha(v, { preview: true })}</div>`;
    ov.addEventListener("click", (ev) => { if (ev.target.closest("[data-close]") || ev.target === ov) ov.remove(); });
    document.body.append(ov); bindFicha(ov, v); return;
  }
  if (act === "publish") { if (!(await save({ quiet: true }))) return; return transition("admin-publish", {}, "Publicado: ya aparece en Radar según el acceso elegido."); }
  if (act === "unpublish") return transition("admin-unpublish", {}, "Despublicado: ya no es visible.");
  if (act === "listing") { const listingStatus = root.querySelector("[data-listing]").value; if (!(await save({ quiet: true }))) return; return transition("admin-listing", { listingStatus }, "Estado del anuncio actualizado."); }
  if (act === "delete") { if (!confirm("¿Eliminar este borrador definitivamente?")) return; const r = await call("admin-delete", { method: "POST", body: { id: A.D.id } }); if (!r.ok) { say(ERRNAME[r.data.error] || "No se pudo eliminar.", "err"); return draw(); } say("Borrador eliminado.", "ok"); return loadDash(); }
});
if (state === "login") login(); else if (state === "panel") loadDash();
