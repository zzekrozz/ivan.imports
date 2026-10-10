import { bindFicha, esc, fog, header, renderFicha, row } from "./render.js";

const app = document.getElementById("radar-app");
const S = { tab: "all", q: "", country: "", platform: "", max: 0, sort: "new" };
const path = location.pathname.replace(/\/+$/, "");
const slug = path.startsWith("/radar/coche/") ? decodeURIComponent(path.split("/")[3] || "") : "";
const api = (q) => fetch(`/api/radar/${q}`, { headers: { Accept: "application/json" } });

async function showFicha() {
  app.innerHTML = header() + '<div class="wr" style="padding:40px 0">Cargando…</div>';
  const res = await api(`vehicle?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) { app.innerHTML = header() + '<div class="wr"><div class="em"><h3>Esta ficha no está disponible</h3><p style="color:var(--mu)">Puede estar reservada para PRO, haberse retirado o no existir.</p><a class="bn" href="/radar/" style="display:inline-block;margin-top:14px;text-decoration:none">Volver a Radar</a></div></div>'; return; }
  const { vehicle } = await res.json();
  document.title = `${vehicle.brand || ""} ${vehicle.model || ""} · IvanImports Radar`;
  app.innerHTML = header() + renderFicha(vehicle);
  bindFicha(app, vehicle);
}

let data = { active: [], archive: [], locked: 0 };
const isExpress = (v) => v.editorialStatus === "express" || v.editorialStatus === "analyzing";
function filtered() {
  const q = S.q.trim().toLowerCase();
  let list = S.tab === "arch" ? data.archive : data.active.filter((v) => S.tab === "all" || (S.tab === "ex") === isExpress(v));
  list = list.filter((v) => (!q || `${v.brand} ${v.model} ${v.versionName || ""}`.toLowerCase().includes(q)) && (!S.country || v.country === S.country) && (!S.platform || v.platform === S.platform) && (!S.max || v.price <= S.max));
  const by = { new: (a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)), pa: (a, b) => a.price - b.price, pd: (a, b) => b.price - a.price, km: (a, b) => (a.km ?? 1e9) - (b.km ?? 1e9), df: (a, b) => (b.costSummary?.difference ?? -1e9) - (a.costSummary?.difference ?? -1e9) };
  return list.sort(by[S.sort]);
}
function list() {
  const act = data.active, week = Date.now() - 7 * 864e5;
  const uniq = (k) => [...new Set([...act, ...data.archive].map((v) => v[k]).filter(Boolean))].sort();
  const sel = (k, label, opts) => `<select data-s="${k}" aria-label="${label}"><option value="">${label}</option>${opts.map((o) => `<option ${S[k] === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  const tabs = [["all", "Todos", act.length], ["rev", "Revisados", act.filter((v) => !isExpress(v)).length], ["ex", "Radar Express", act.filter(isExpress).length], ["arch", "Archivo", data.archive.length]];
  const l = filtered();
  const rv = l.filter((v) => !isExpress(v) && v.tier !== "archive"), ex = l.filter((v) => isExpress(v) && v.tier !== "archive"), ar = l.filter((v) => v.tier === "archive");
  const sec = (h, s, a) => (a.length ? `<div class="sc"><h2>${h}</h2><span>${s}</span></div>${a.map(row).join("")}` : "");
  app.innerHTML = `${header()}<div class="wr"><div class="hd"><div><h1>Oportunidades seleccionadas</h1><p>Vehículos interesantes encontrados y analizados por Iván.</p></div><div class="kp"><div><b>${act.length}</b>activas</div><div><b>${act.filter((v) => Date.parse(v.publishedAt) >= week).length}</b>nuevas 7 días</div><div><b>${act.filter((v) => !isExpress(v)).length}</b>revisadas</div><div><b>${act.filter(isExpress).length}</b>por investigar</div></div></div>
<div class="cb"><div class="sg">${tabs.map((t) => `<button data-tab="${t[0]}" class="${S.tab === t[0] ? "on" : ""}">${t[1]}<i>${t[2]}</i></button>`).join("")}</div><div class="fl"><input data-q placeholder="Buscar marca o modelo" value="${esc(S.q)}"></div><div class="fl">${sel("country", "País", uniq("country"))}${sel("platform", "Plataforma", uniq("platform"))}<select data-s="max">${[[0, "Precio: sin límite"], [15000, "Hasta 15.000 €"], [20000, "Hasta 20.000 €"], [25000, "Hasta 25.000 €"], [30000, "Hasta 30.000 €"]].map((o) => `<option value="${o[0]}" ${S.max == o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select><select data-s="sort">${[["new", "Más recientes"], ["pa", "Precio: menor a mayor"], ["pd", "Precio: mayor a menor"], ["km", "Kilometraje menor"], ["df", "Diferencia estimada (solo con análisis visible)"]].map((o) => `<option value="${o[0]}" ${S.sort === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></div></div>
${l.length ? (S.tab === "arch" ? sec("Archivo histórico", "Anuncios que ya no están activos", ar) : sec("Revisadas por Iván", "Con análisis, costes estimados y mi opinión", rv) + sec("Radar Express", "Candidatos que me llaman la atención; aún sin analizar", ex)) : `<div class="em"><h3>${act.length || data.archive.length ? "Ningún vehículo coincide" : "Todavía no hay oportunidades publicadas"}</h3><p style="color:var(--mu)">${act.length || data.archive.length ? "Prueba a quitar algún filtro." : "Vuelve pronto: se publican aquí en cuanto Iván las selecciona."}</p>${act.length || data.archive.length ? '<button data-clear>Limpiar filtros</button>' : ""}</div>`}
${S.tab !== "arch" ? fog(data.locked) : ""}<div class="foot">Diferencia estimada = referencia de precios en España − coste estimado puesto en España; no es beneficio garantizado. Comprueba siempre disponibilidad, documentación y estado real.</div></div>`;
}
function wire() {
  app.addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) { S.tab = t.dataset.tab; list(); } if (e.target.closest("[data-clear]")) { Object.assign(S, { q: "", country: "", platform: "", max: 0, tab: "all" }); list(); } });
  app.addEventListener("change", (e) => { const k = e.target.dataset.s; if (k) { S[k] = k === "max" ? Number(e.target.value) : e.target.value; list(); } });
  app.addEventListener("input", (e) => { if (e.target.hasAttribute("data-q")) { S.q = e.target.value; const pos = e.target.selectionStart; list(); const i = app.querySelector("[data-q]"); i.focus(); i.setSelectionRange(pos, pos); } });
}
async function showList() {
  app.innerHTML = header() + '<div class="wr" style="padding:40px 0">Cargando…</div>';
  try {
    const [a, h] = await Promise.all([api("vehicles").then((r) => r.json()), api("vehicles?archive=1").then((r) => r.json())]);
    data = { active: a.vehicles || [], archive: h.vehicles || [], locked: a.locked || 0 };
    list(); wire();
  } catch { app.innerHTML = header() + '<div class="wr"><div class="em"><h3>No se pudo cargar Radar</h3><p style="color:var(--mu)">Inténtalo de nuevo en unos instantes.</p></div></div>'; }
}
if (slug) showFicha(); else showList();
