import { COST_GROUPS, COST_ITEMS, COST_STATUS, costSummary, relevant } from "./cost-model.js";

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const NF = new Intl.NumberFormat("es-ES", { useGrouping: "always", maximumFractionDigits: 2 });
export const E = (n) => `${NF.format(n)} €`;
export const sg = (n) => `${n >= 0 ? "+" : "−"}${E(Math.abs(n))}`;
const K = (n) => `${NF.format(n)} km`;
const dt = (s) => (s ? new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const nm = (v) => `${v.brand || ""} ${v.model || ""}`.trim() || "Vehículo";
const safeUrl = (u) => (/^https?:\/\//.test(u || "") ? esc(u) : "#");
export const EDIT = { express: "Radar Express", analyzing: "En análisis", reviewed: "Revisado por Iván", discarded: "Descartado por Iván" };
export const LIST = { available: "Disponible", pending: "Pendiente de confirmar", withdrawn: "Retirado", sold: "Vendido", archived: "Archivado" };
const QL = { pending: "Pendiente", asked: "Preguntado", answered: "Respondido", verified: "Verificado", unverified: "No verificado" };
const QC = { pending: "p", asked: "a", answered: "r", verified: "v", unverified: "n" };
const KL = { confirmed: "Confirmado", declared: "Declarado", estimated: "Estimado", hypothesis: "Hipótesis", pending: "Pendiente" };
const KC = { confirmed: "confirmado", declared: "declarado", estimated: "estimado", hypothesis: "hipotesis", pending: "pendiente" };

export const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="#0A2347" stroke-width="3"/><path d="M16 16V3a13 13 0 0 1 11.3 6.5Z" fill="#F3BE34"/><circle cx="16" cy="16" r="2.6" fill="#0A2347"/></svg>';
export const header = () => `<div class="nh"><div class="wr"><a class="lo" href="/radar/" style="text-decoration:none;color:inherit">${LOGO}<span>IvanImports&nbsp;<b>Radar</b></span></a><nav><a class="on" href="/radar/">Oportunidades</a></nav><div class="r"><span class="dm">Radar Gratis</span></div></div></div>`;

const isExpress = (v) => v.editorialStatus === "express" || v.editorialStatus === "analyzing";
const spec = (v) => `<div class="sp">${[v.year, v.km != null && K(v.km), [v.fuel, v.hp && `${v.hp} CV`].filter(Boolean).join(" · "), v.transmission].filter(Boolean).map((s) => `<span>${esc(s)}</span>`).join("")}</div>`;
const statusLabel = (v) => (v.tier === "archive" ? `Archivo · ${v.editorialStatus === "discarded" ? "Descartado por Iván" : LIST[v.listingStatus] || "Archivado"}` : EDIT[v.editorialStatus] || "Radar");
const refText = (v) => { const r = v.spainReference; if (r && r.min && r.max) return `Referencia en España: ${E(r.min)} – ${E(r.max)}`; if (r && r.value) return `Referencia en España: ${E(r.value)}`; return "Referencia española pendiente de analizar"; };
const cover = (v) => (v.images && v.images[0] ? `<img src="${esc(v.images[0].url)}" alt="${esc(v.images[0].alt || nm(v))}" loading="lazy">` : "Sin fotografía");
const href = (v) => `/radar/coche/${encodeURIComponent(v.slug)}/`;

export function row(v) {
  const x = isExpress(v), arch = v.tier === "archive", s = v.costSummary, full = v.tier === "open" && s && !x;
  let r;
  if (full) r = `<div><small>Coste estimado puesto en España</small><div class="t">${E(s.total)}</div></div>${s.difference !== null ? `<div><small>Diferencia estimada</small><div class="df">${sg(s.difference)}</div></div>` : ""}<div class="sec">Precio del coche ${E(v.price)}${s.reference ? ` · Ref. precios ES ${E(s.reference)}` : ""}${s.partial ? " · estimación parcial" : ""}</div><span class="go">Ver análisis</span>`;
  else if (x) r = `<span class="pd">Sin analizar</span><div><small>Precio del coche</small><div class="t">${E(v.price)}</div></div><div class="sec">Coste estimado y diferencia aún sin calcular.</div><span class="go">Ver candidato</span>`;
  else r = `<small>Precio del coche</small><div class="t">${E(v.price)}</div><div class="sec">${esc(refText(v))}</div><span class="go">Ver ficha</span>`;
  const quote = v.firstImpression ? `<div class="q"><i>I</i><span>${x ? "<b>Primera impresión:</b> " : ""}“${esc(v.firstImpression)}”</span></div>` : "";
  return `<a class="rw ${x ? "ex" : ""} ${arch ? "ar" : ""}" href="${href(v)}" style="text-decoration:none;color:inherit"><div class="ph">${cover(v)}</div><div class="rm"><div class="h"><div class="st"><span class="d ${x ? "y" : arch ? "g" : ""}"></span>${esc(statusLabel(v))}${v.country ? ` · ${esc(v.country)}` : ""}${v.platform ? ` · ${esc(v.platform)}` : ""}${v.tier === "open" ? '<span class="ub">Análisis PRO desbloqueado</span>' : ""}</div><h3>${esc(nm(v))}</h3><div class="v">${esc(v.versionName || v.engine || "")}</div></div>${spec(v)}${quote}</div><div class="rn">${r}</div></a>`;
}

export function fog(n) {
  return n > 0 ? `<div class="fog" aria-label="Oportunidades reservadas para PRO"><div class="fr"><div class="fph"></div><div class="fbl"><i></i><i></i><i style="width:65%"></i></div><div class="fbn"><i></i><i style="width:50%"></i></div></div><div class="fc"><b>${n}</b><div><h3>${n === 1 ? "oportunidad más por descubrir" : "oportunidades más por descubrir"} 🔒</h3><p>Accede a todos los vehículos antes que los demás y descubre los análisis completos de Iván.</p></div><button class="bn y" disabled>Radar PRO · próximamente</button></div></div>` : "";
}

/* ---------------- ficha ---------------- */
const li = (a) => `<ul>${(a || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
function summaryBox(v) {
  const s = v.costSummary;
  if (v.tier !== "open" || !s || isExpress(v)) return `<section class="bx sm"><span class="kk">Resumen</span><div class="rw2"><small>Precio del coche</small><b>${E(v.price)}</b></div>${isExpress(v) ? "<p>Coste y diferencia pendientes de análisis.</p>" : `<div class="rw2"><small>Referencia de precios en España</small><b class="rg">${esc(refText(v).replace("Referencia en España: ", "").replace("Referencia española pendiente de analizar", "pendiente de analizar"))}</b></div>`}</section>`;
  return `<section class="bx sm"><span class="kk">Resumen económico</span><div class="rw2"><small>Precio del coche</small><b>${E(v.price)}</b></div><div class="big"><small>Coste estimado puesto en España</small><b>${E(s.total)}</b>${s.partial ? `<em>Estimación parcial: faltan ${esc(s.pending.slice(0, 3).join(", "))}${s.pending.length > 3 ? "…" : ""}</em>` : ""}</div>${s.reference ? `<div class="rw2"><small>Referencia de precios en España</small><b>${E(s.reference)}</b></div>` : ""}${s.difference !== null ? `<div class="dfb"><small>Diferencia estimada</small><b>${sg(s.difference)}</b></div>` : ""}<p>Diferencia de precios, no beneficio neto. Puede no incluir todos los gastos aplicables.</p></section>`;
}
const analysisBox = (v) => { const a = v.analysis; if (!a) return ""; return `<section class="bx an"><span class="kk">Valoración personal</span><h2>El análisis de Iván</h2>${a.head ? `<div class="qq">“${esc(a.head)}”</div>` : ""}<div class="cl">${a.why ? `<div><h4>Por qué lo he seleccionado</h4><p>${esc(a.why)}</p></div>` : ""}${a.like?.length ? `<div><h4>Qué me gusta</h4>${li(a.like)}</div>` : ""}${a.doubt?.length ? `<div><h4>Mis dudas</h4>${li(a.doubt)}</div>` : ""}${a.chk ? `<div><h4>Qué comprobaría antes</h4><p>${esc(a.chk)}</p></div>` : ""}${a.fair ? `<div><h4>Precio razonable en España</h4><p>Entre ${E(a.fair.min)} y ${E(a.fair.max)} anunciado.</p></div>` : ""}${a.body ? `<div style="grid-column:1/-1"><h4>Análisis ampliado</h4><p style="white-space:pre-line">${esc(a.body)}</p></div>` : ""}</div></section>`; };
const questionsBox = (v) => (v.questions?.length ? `<section class="bx"><h2>Preguntas pendientes al vendedor</h2>${v.questions.map((q) => `<div class="qi"><b>${esc(q.q)}</b><span class="qs ${QC[q.status] || "p"}">${QL[q.status] || "Pendiente"}</span>${q.answer ? `<p><b>Respuesta declarada:</b> ${esc(q.answer)}</p>` : ""}${q.note ? `<p>${esc(q.note)}</p>` : ""}${q.evidence ? `<small>Evidencia: ${esc(q.evidence)}</small>` : ""}<small>${q.updatedAt ? `Actualizado ${dt(q.updatedAt)}` : "Sin actualizar"}${q.status === "answered" ? " · Lo que dice el vendedor no está verificado" : ""}</small></div>`).join("")}</section>` : "");
const risksBox = (v) => (v.risks?.length ? `<section class="bx"><h2>Antes de comprar, revisa esto</h2>${v.risks.map((r) => `<div class="rk"><span class="dq ${KC[r.kind] || "pendiente"}">${KL[r.kind] || "Pendiente"}</span><span>${esc(r.text)}</span></div>`).join("")}</section>` : "");
const compBox = (v) => { if (!v.comparables?.length) return ""; const avg = Math.round(v.comparables.reduce((s, c) => s + c.price, 0) / v.comparables.length / 100) * 100; return `<section class="bx"><span class="kk">Mercado español</span><h2>Con qué lo comparo</h2><div class="cp">${v.comparables.map((c) => `<div class="cc"><div>${esc(c.title)}</div><b>${E(c.price)}</b><small>${[c.year, c.km != null && K(c.km), c.platform, c.observedAt && `observado ${dt(c.observedAt)}`, c.note].filter(Boolean).map(esc).join(" · ")}</small>${c.url ? `<div class="bt"><a class="bn" href="${safeUrl(c.url)}" target="_blank" rel="noopener nofollow">Anuncio original ↗</a></div>` : ""}</div>`).join("")}</div><p class="nt2">Precios anunciados, no precios finales de venta. Media de estos comparables: ${E(avg)}${v.spainReference?.value ? ` · Referencia usada por Iván: ${E(v.spainReference.value)}` : ""}.</p>${v.spainReference?.note ? `<p class="nt2">${esc(v.spainReference.note)}</p>` : ""}</section>`; };

/* calculadora: el escenario del visitante vive en memoria y nunca cambia el análisis publicado */
export function initialScenario(v) {
  const mode = v.costs?.mode === "pickup" ? "pickup" : "truck";
  const items = {};
  for (const def of COST_ITEMS) { const it = v.costs?.items?.find((x) => x.key === def.key); items[def.key] = it ? { on: it.applicable !== false && it.status !== "na", a: Number(it.amount) || 0, s: it.status === "na" ? "estimated" : it.status } : { on: false, a: 0, s: "estimated" }; }
  const custom = (v.costs?.items || []).filter((x) => x.key.startsWith("custom:")).map((x) => ({ key: x.key, label: x.label, group: x.group || 4, on: x.applicable !== false && x.status !== "na", a: Number(x.amount) || 0, s: x.status === "na" ? "estimated" : x.status }));
  return { mode, price: v.price, items, custom };
}
export const scenarioSummary = (v, u) => costSummary({ price: u.price, costs: { mode: u.mode, items: [...COST_ITEMS.filter((d) => u.items[d.key].on).map((d) => ({ key: d.key, amount: u.items[d.key].a, status: u.items[d.key].s })), ...u.custom.filter((c) => c.on).map((c) => ({ key: c.key, label: c.label, group: c.group, amount: c.a, status: c.s }))] }, reference: v.spainReference });
export function calcBody(v, u) {
  const iv = v.costs?.items || [];
  const row = (key, label, c, def) => `<div class="cr2 ${c.on ? "" : "off"}" data-k="${esc(key)}"><label><input type="checkbox" data-f="on" ${c.on ? "checked" : ""}>${esc(label)}</label><input type="number" min="0" step="10" data-f="a" value="${c.a}" aria-label="Importe"><select data-f="s" aria-label="Estado">${["estimated", "confirmed", "pending"].map((o) => `<option value="${o}" ${c.s === o ? "selected" : ""}>${COST_STATUS[o]}</option>`).join("")}</select><small>${def ? (() => { const q = iv.find((x) => x.key === key); return q && q.applicable !== false && q.status !== "na" ? `Iván: ${q.amount != null ? E(q.amount) : "pendiente"}` : "Iván: no incluido"; })() : "Tuyo"}</small></div>`;
  let h = `<div class="cm"><button data-act="mode" data-m="truck" class="${u.mode === "truck" ? "on" : ""}">Contratar transporte</button><button data-act="mode" data-m="pickup" class="${u.mode === "pickup" ? "on" : ""}">Recoger personalmente</button></div><p class="nt2" style="margin:0 0 10px">El transporte profesional y el viaje para recoger el coche son alternativas: solo se cuenta una. Los importes son los que ha introducido Iván o los que escribas tú.</p><div class="cr2" style="border:0"><label><b>Precio del coche</b></label><input type="number" min="0" data-f="price" value="${u.price}"><span></span><small>Iván: ${E(v.price)}</small></div>`;
  for (const g of [1, 2, 3, 4]) h += `<details class="cg" ${g === 1 ? "open" : ""}><summary><span>${COST_GROUPS[g]}</span><b data-sub="${g}"></b></summary>${COST_ITEMS.filter((d) => d.group === g && relevant(d, u.mode)).map((d) => row(d.key, d.label, u.items[d.key], true)).join("")}${u.custom.filter((c) => c.group === g).map((c) => row(c.key, c.label, c, false)).join("")}${g === 4 ? '<div class="cr2"><button class="bn" data-act="add">＋ Añadir gasto personalizado</button></div>' : ""}</details>`;
  return `${h}<div class="tt2"><div>Estimación de Iván<b data-t="iv"></b></div><div class="u">Mi cálculo personalizado<b data-t="me"></b></div><div class="g">Diferencia estimada con mi cálculo<b data-t="df"></b></div></div><p class="nt2" data-t="pend"></p><button class="bn" data-act="reset">Restablecer mi cálculo</button>`;
}
export function refreshTotals(root, v, u) {
  const s = scenarioSummary(v, u), set = (k, t) => { const e = root.querySelector(`[data-t="${k}"]`); if (e) e.textContent = t; };
  [1, 2, 3, 4].forEach((g) => { const e = root.querySelector(`[data-sub="${g}"]`); if (e) e.textContent = E(s.subtotals[g]); });
  set("iv", v.costSummary ? E(v.costSummary.total) : "—"); set("me", E(s.total)); set("df", s.difference === null ? "—" : sg(s.difference));
  set("pend", s.partial ? `Total parcial: ${s.pending.length} ${s.pending.length === 1 ? "concepto pendiente" : "conceptos pendientes"} (${s.pending.slice(0, 3).join(", ")}). No es un coste cerrado.` : "Todos los conceptos activos tienen importe definido.");
}
const calcBox = (v) => (v.costs && v.costSummary ? `<details class="cal" id="cal"><summary><div><span class="kk">Herramienta</span><h2>Calculadora de importación</h2></div><div class="cs"><div>Estimación de Iván<b>${E(v.costSummary.total)}</b></div>${v.costSummary.difference !== null ? `<div>Diferencia estimada<b>${sg(v.costSummary.difference)}</b></div>` : ""}</div><span class="bn p ed">Editar mi cálculo</span></summary><div class="cin" id="cbody"></div></details>` : "");

export function renderFicha(v, { preview = false } = {}) {
  const x = isExpress(v), arch = v.tier === "archive", open = v.tier === "open" || v.tier === "pro";
  const imgs = v.images || [];
  const bar = `<div class="bar">${preview ? "" : '<a class="bk" href="/radar/" style="text-decoration:none">← Volver a oportunidades</a>'}<div class="st"><span class="d ${x ? "y" : arch ? "g" : ""}"></span>${esc(statusLabel(v))}</div>${v.tier === "open" ? '<span class="ub st">Análisis PRO desbloqueado</span>' : ""}</div>`;
  const hero = `<div class="dh"><h1>${esc(nm(v))}</h1><div style="color:var(--mu)">${esc([v.versionName, v.engine, v.country, v.platform].filter(Boolean).join(" · "))}</div></div><div class="hero"><div class="ph" id="mainph">${cover(v)}</div>${imgs.length > 1 ? `<div class="gal">${imgs.map((im, i) => `<button data-img="${i}" class="${i === 0 ? "on" : ""}" aria-label="Foto ${i + 1}"><img src="${esc(im.url)}" alt="${esc(im.alt || "")}" loading="lazy"></button>`).join("")}</div>` : ""}<small>${v.publishedAt ? `Publicado ${dt(v.publishedAt)} · ` : ""}${v.updatedAt ? `Actualizado ${dt(v.updatedAt)} · ` : ""}${esc(LIST[v.listingStatus] || "")} · Datos del anuncio declarados; sin comprobar con el vendedor salvo que se indique</small></div><div class="spg">${[["Año", v.year], ["Kilómetros", v.km != null ? K(v.km) : null], ["Combustible", v.fuel], ["Motor", v.engine], ["Potencia", v.hp ? `${v.hp} CV` : null], ["Transmisión", v.transmission]].filter((z) => z[1]).map((z) => `<div><small>${z[0]}</small><b>${esc(z[1])}</b></div>`).join("")}</div>`;
  const orig = v.originalUrl ? `<a class="bn y" href="${safeUrl(v.originalUrl)}" target="_blank" rel="noopener nofollow">↗ Abrir anuncio original</a>` : "";
  const side = `${summaryBox(v)}<div class="ls" style="margin:0">${orig}</div><aside class="ext"><span class="kk">Historial · próximamente</span><h3>Comprueba el historial antes de comprar</h3><p>Los informes de terceros pueden ser incompletos.</p><button class="bn p" disabled>Consultar historial del vehículo</button><small>Aún no hay enlace autorizado ni colaboración activa.</small></aside>`;
  let main = "";
  if (arch) main += `<div class="nb">Esta oportunidad ya no está activa (${esc(statusLabel(v).replace("Archivo · ", ""))}). Se conserva como referencia histórica.</div>`;
  if (v.tier === "open") main += `<div class="nb i">Iván ha abierto esta oportunidad para que puedas descubrir cómo funciona Radar PRO.</div>`;
  if (x) main += `<section class="bx" style="border-style:dashed"><span class="kk">Estado del candidato</span><h2>${v.editorialStatus === "analyzing" ? "En análisis" : "Pendiente de investigar"}</h2><p>${v.editorialStatus === "analyzing" ? "Iván está investigando este candidato." : "Candidato con datos básicos y mi primera impresión."} Aún no hay coste total, diferencia ni comparables.</p></section>`;
  if (v.firstImpression) main += `<section class="bx an"><span class="kk">${x ? "Primera impresión" : "Mi primera impresión"}</span><h2>${x ? "Lo que pienso por ahora" : "Primera impresión de Iván"}</h2><div class="qq">“${esc(v.firstImpression)}”</div><p class="nt2">Primera impresión, no un análisis definitivo.</p></section>`;
  if (open && !x) main += analysisBox(v) + questionsBox(v) + risksBox(v) + calcBox(v) + compBox(v);
  if (!open && !x && !arch) main += `<section class="pw"><h2>Radar PRO te ayuda a decidir</h2><p>Gratis ayuda a descubrir vehículos; PRO ayuda a decidir cuáles merece la pena comprar e importar: análisis de Iván, gastos desglosados, comparables, preguntas al vendedor y riesgos.</p><button class="bn y" disabled>Radar PRO · próximamente</button></section>`;
  if (v.description) main += `<section class="bx"><h2>Descripción del anuncio</h2><p style="white-space:pre-line;color:#34476b">${esc(v.description)}</p></section>`;
  if (v.features?.length) main += `<section class="bx"><h2>Características</h2><div class="fs">${v.features.map((f) => `<span>${esc(f)}</span>`).join("")}</div></section>`;
  return `<div class="wr">${bar}${hero}<div class="g2"><div class="mn">${main}</div><div class="sd">${side}</div></div><div class="foot">La diferencia estimada no es beneficio garantizado. Comprueba siempre disponibilidad, documentación y estado real antes de comprar.</div></div>`;
}

/** Enlaza galería y calculadora tras insertar la ficha en el DOM. */
export function bindFicha(root, v) {
  root.querySelectorAll("[data-img]").forEach((b) => b.addEventListener("click", () => { const im = v.images[Number(b.dataset.img)]; root.querySelector("#mainph").innerHTML = `<img src="${esc(im.url)}" alt="${esc(im.alt || "")}">`; root.querySelectorAll("[data-img]").forEach((o) => o.classList.toggle("on", o === b)); }));
  const body = root.querySelector("#cbody"); if (!body) return;
  let u = initialScenario(v);
  const draw = () => { body.innerHTML = calcBody(v, u); refreshTotals(body, v, u); };
  draw();
  body.addEventListener("input", (e) => { const t = e.target, rowEl = t.closest("[data-k]"); if (t.dataset.f === "price") u.price = Number(t.value) || 0; else if (rowEl) { const key = rowEl.dataset.k, tgt = key.startsWith("custom:") ? u.custom.find((c) => c.key === key) : u.items[key]; if (t.dataset.f === "a") tgt.a = Math.max(0, Number(t.value) || 0); } refreshTotals(body, v, u); });
  body.addEventListener("change", (e) => { const t = e.target, rowEl = t.closest("[data-k]"); if (!rowEl) return; const key = rowEl.dataset.k, tgt = key.startsWith("custom:") ? u.custom.find((c) => c.key === key) : u.items[key]; if (t.dataset.f === "on") { tgt.on = t.checked; rowEl.classList.toggle("off", !t.checked); } if (t.dataset.f === "s") tgt.s = t.value; refreshTotals(body, v, u); });
  body.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b) return; if (b.dataset.act === "mode") { u.mode = b.dataset.m; draw(); } if (b.dataset.act === "reset") { u = initialScenario(v); draw(); } if (b.dataset.act === "add") { u.custom.push({ key: `custom:g${Date.now().toString(36)}`, label: "Gasto personalizado", group: 4, on: true, a: 0, s: "estimated" }); draw(); } });
}
