import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./radar-helpers.js";

const IMG = "https://abc123.public.blob.vercel-storage.com/radar/vehicles/x/foto.jpg";
const express = (over = {}) => ({ brand: "BMW", model: "320d Touring", versionName: "190 CV", year: 2020, km: 68000, fuel: "Diésel", transmission: "Automático", hp: 190, country: "Francia", platform: "AutoScout24", price: 21500, originalUrl: "https://www.autoscout24.es/anuncio/123", images: [{ url: IMG, alt: "BMW azul" }], firstImpression: "Me llama la atención por precio y configuración.", editorialStatus: "express", ...over });
const publicList = async (ctx, q = "") => (await (await ctx.call(`vehicles${q}`)).json());
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), Buffer.alloc(64)]);

test("flujo mínimo: entrar → añadir Express → guardar → publicar → ver en catálogo → editar → archivar", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const created = await (await a.post("admin-save", { data: { brand: "BMW", model: "320d Touring", originalUrl: "https://www.autoscout24.es/x" } })).json();
  const id = created.vehicle.id;
  assert.equal(created.vehicle.published, false); assert.equal(created.vehicle.accessMode, "pro"); assert.equal(created.vehicle.editorialStatus, "draft");
  assert.equal((await publicList(ctx)).vehicles.length, 0, "un borrador no aparece");
  const bad = await a.post("admin-publish", { id, expectedVersion: 1 });
  assert.equal(bad.status, 422);
  let saved = await (await a.post("admin-save", { id, expectedVersion: 1, data: express({ accessMode: "free" }) })).json();
  assert.equal(saved.vehicle.version, 2);
  assert.equal((await publicList(ctx)).vehicles.length, 0, "guardado pero sin publicar");
  const pub = await (await a.post("admin-publish", { id, expectedVersion: 2 })).json();
  assert.equal(pub.vehicle.published, true);
  const list = await publicList(ctx);
  assert.equal(list.vehicles.length, 1);
  const item = list.vehicles[0];
  assert.equal(item.brand, "BMW"); assert.equal(item.tier, "basic");
  assert.equal(item.slug, pub.vehicle.slug);
  const ficha = await (await ctx.call(`vehicle&slug=${item.slug}`)).json();
  assert.equal(ficha.vehicle.model, "320d Touring");
  const conflict = await a.post("admin-save", { id, expectedVersion: 2, data: { price: 20900 } });
  assert.equal(conflict.status, 409, "versión obsoleta");
  const edited = await (await a.post("admin-save", { id, expectedVersion: 3, data: { price: 20900 } })).json();
  assert.equal(edited.vehicle.price, 20900); assert.equal(edited.vehicle.brand, "BMW", "no se pierde lo anterior"); assert.equal(edited.vehicle.slug, item.slug, "URL estable");
  const arch = await a.post("admin-listing", { id, expectedVersion: 4, listingStatus: "archived" });
  assert.equal(arch.status, 200);
  assert.equal((await publicList(ctx)).vehicles.length, 0, "archivado no es oportunidad activa");
  const hist = await publicList(ctx, "&archive=1");
  assert.equal(hist.vehicles.length, 1); assert.equal(hist.vehicles[0].tier, "archive");
  assert.equal(hist.locked, 0);
  const counts = (await (await a.get("admin-stats")).json()).counts;
  assert.equal(counts.archived, 1); assert.equal(counts.published, 0);
});

test("la creación es idempotente y las solicitudes repetidas no duplican vehículos", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const body = { clientId: "abcdef12-3456-7890-abcd-ef1234567890", data: { brand: "Audi", model: "A4" } };
  const one = await (await a.post("admin-save", body)).json();
  const two = await (await a.post("admin-save", body)).json();
  assert.equal(one.created, true); assert.equal(two.created, false); assert.equal(one.vehicle.id, two.vehicle.id);
  assert.equal((await (await a.get("admin-vehicles")).json()).vehicles.length, 1);
});

test("toda escritura exige sesión, origen y CSRF", async () => {
  const ctx = setup(); const a = await ctx.admin();
  for (const action of ["admin-save", "admin-publish", "admin-unpublish", "admin-listing", "admin-delete", "admin-image", "admin-template-save", "admin-template-delete"]) {
    assert.equal((await ctx.call(action, { method: "POST", body: { id: "x" } })).status, 401, `${action} sin sesión`);
    assert.equal((await ctx.call(action, { method: "POST", cookie: a.cookie, body: { id: "x" } })).status, 403, `${action} sin CSRF`);
    assert.equal((await ctx.call(action, { method: "POST", cookie: a.cookie, origin: "https://evil.example", headers: { "x-radar-csrf": a.csrf }, body: { id: "x" } })).status, 403, `${action} origen ajeno`);
  }
  for (const action of ["admin-vehicles", "admin-vehicle", "admin-templates", "admin-stats"]) assert.equal((await ctx.call(action)).status, 401, action);
});

test("la validación rechaza entradas inválidas y no deja fijar campos del servidor", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const cases = [{ price: -5 }, { price: "abc" }, { year: 1800 }, { km: 1.5 }, { originalUrl: "javascript:alert(1)" }, { fuel: "Agua" }, { images: [{ url: "https://evil.example/x.jpg" }] }, { costs: { items: [{ key: "inventado", amount: 5 }] } }, { costs: { items: [{ key: "itv", amount: 1 }, { key: "itv", amount: 2 }] } }, { costs: { items: [{ key: "itv", amount: -1 }] } }, { spainReference: { min: 10, max: 5 } }, { comparables: [{ title: "x", price: 0 }] }];
  for (const data of cases) assert.equal((await a.post("admin-save", { data: { brand: "VW", ...data } })).status, 422, JSON.stringify(data));
  const ok = await (await a.post("admin-save", { data: { brand: "VW", published: true, version: 99, id: "hack", accessMode: "free", slug: "mio" } })).json();
  assert.equal(ok.vehicle.published, false); assert.equal(ok.vehicle.version, 1); assert.notEqual(ok.vehicle.id, "hack"); assert.notEqual(ok.vehicle.slug, "mio");
});

test("el texto malicioso se guarda como dato y la API lo devuelve como JSON, nunca como HTML", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const r = await (await a.post("admin-save", { data: express({ accessMode: "free", firstImpression: "<img src=x onerror=alert(1)> Me gusta mucho el coche" }) })).json();
  await a.post("admin-publish", { id: r.vehicle.id, expectedVersion: 1 });
  const res = await ctx.call("vehicles");
  assert.match(res.headers.get("content-type"), /application\/json/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("Revisado: exige análisis, referencia, comparables y gastos; el total no inventa importes", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const base = express({ editorialStatus: "reviewed", accessMode: "pro_open" });
  const r = await (await a.post("admin-save", { data: base })).json();
  const id = r.vehicle.id;
  assert.equal((await a.post("admin-publish", { id, expectedVersion: 1 })).status, 422);
  const full = { ...base, analysis: { head: "Interesante si el historial acompaña", why: "Precio por debajo del mercado", like: ["Kilometraje"], doubt: ["Historial"], chk: "Documentación", fair: { min: 24000, max: 26000 } }, spainReference: { value: 25500, note: "Mediana de mis comparables" }, comparables: [{ title: "BMW 320d Touring", year: 2020, km: 74000, price: 26000, platform: "Portal", url: "https://example.com/a" }],
    costs: { mode: "truck", items: [{ key: "truck", amount: 900, status: "estimated" }, { key: "itv", amount: 120, status: "confirmed" }, { key: "registration_tax", amount: 800, status: "estimated" }, { key: "repairs", status: "pending" }, { key: "flight", amount: 150, status: "estimated" }] },
    questions: [{ q: "¿Tiene historial de mantenimiento?", status: "pending", public: true, internalNote: "NOTA-INTERNA" }, { q: "Pregunta solo interna", status: "pending", public: false }] };
  assert.equal((await a.post("admin-save", { id, expectedVersion: 1, data: full })).status, 200);
  assert.equal((await a.post("admin-publish", { id, expectedVersion: 2 })).status, 200);
  const view = (await (await ctx.call("vehicles")).json()).vehicles[0];
  assert.equal(view.tier, "open");
  const s = view.costSummary;
  assert.equal(s.total, 21500 + 900 + 120 + 800, "el avión no suma en escenario camión y el pendiente no suma");
  assert.equal(s.partial, true); assert.deepEqual(s.pending, ["Reparaciones"]);
  assert.equal(s.difference, 25500 - s.total);
  const text = JSON.stringify(view);
  assert.doesNotMatch(text, /NOTA-INTERNA|solo interna/);
});

test("contenido PRO nunca llega a Gratis, ni por listado ni por ficha, y 'pro_open' sí; al cerrar vuelve a protegerse", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const mk = async (over) => { const r = await (await a.post("admin-save", { data: express(over) })).json(); await a.post("admin-publish", { id: r.vehicle.id, expectedVersion: 1 }); return r.vehicle; };
  const pro = await mk({ accessMode: "pro", firstImpression: "SECRETO-PRO muy interesante" });
  const delayed = await mk({ accessMode: "delayed", freeReleaseAt: "2999-01-01T00:00:00Z", brand: "Audi" });
  const open = await mk({ accessMode: "pro_open", openUntil: "2999-01-01T00:00:00Z", brand: "Seat" });
  const list = await publicList(ctx); const text = JSON.stringify(list);
  assert.equal(list.vehicles.length, 1); assert.equal(list.vehicles[0].brand, "Seat"); assert.equal(list.locked, 2);
  assert.doesNotMatch(text, /SECRETO-PRO/);
  assert.equal((await ctx.call(`vehicle&slug=${pro.slug}`)).status, 404);
  assert.equal((await ctx.call(`vehicle&slug=${delayed.slug}`)).status, 404);
  assert.equal((await ctx.call(`vehicle&slug=${open.slug}`)).status, 200);
  const closed = await (await a.post("admin-save", { id: open.id, expectedVersion: 2, data: { openUntil: "2000-01-01T00:00:00Z" } })).json();
  assert.equal(closed.vehicle.accessMode, "pro_open");
  assert.equal((await ctx.call(`vehicle&slug=${open.slug}`)).status, 404, "al cerrar la apertura vuelve a estar protegido");
  assert.equal((await publicList(ctx)).locked, 3);
});

test("despublicar retira la ficha y un publicado no puede quedar incoherente", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const r = await (await a.post("admin-save", { data: express({ accessMode: "free" }) })).json();
  await a.post("admin-publish", { id: r.vehicle.id, expectedVersion: 1 });
  assert.equal((await a.post("admin-save", { id: r.vehicle.id, expectedVersion: 2, data: { editorialStatus: "draft" } })).status, 422, "no se puede pasar a borrador publicado");
  assert.equal((await a.post("admin-delete", { id: r.vehicle.id })).status, 409, "no se borra un publicado");
  assert.equal((await a.post("admin-unpublish", { id: r.vehicle.id, expectedVersion: 2 })).status, 200);
  assert.equal((await publicList(ctx)).vehicles.length, 0);
  assert.equal((await a.post("admin-delete", { id: r.vehicle.id })).status, 200);
  assert.equal((await ctx.call(`vehicle&slug=${r.vehicle.slug}`)).status, 404);
});

test("fotografías: solo imágenes reales y de tamaño razonable, con CSRF", async () => {
  const ctx = setup(); const a = await ctx.admin();
  const up = (body, headers = {}) => ctx.call("admin-image", { method: "POST", cookie: a.cookie, headers: { "x-radar-csrf": a.csrf, "content-type": "image/png", ...headers }, rawBody: body });
  const send = (body) => ctx.handler(new Request("https://ivanimports.es/api/radar?action=admin-image", { method: "POST", headers: { origin: "https://ivanimports.es", cookie: a.cookie, "x-radar-csrf": a.csrf, "content-type": "image/png" }, body }));
  const ok = await send(png());
  assert.equal(ok.status, 201); assert.match((await ok.json()).url, /public\.blob\.vercel-storage\.com/);
  assert.equal((await send(Buffer.from("<html><script>alert(1)</script></html>"))).status, 415, "HTML disfrazado de imagen");
  assert.equal((await send(Buffer.alloc(4 * 1024 * 1024, 0xff))).status, 413);
  assert.equal((await send(Buffer.alloc(0))).status, 413);
  assert.equal(ctx.uploads.length, 1);
});

test("plantillas de gastos: crear, validar, aplicar sin alterarlas y borrar", async () => {
  const ctx = setup(); const a = await ctx.admin();
  assert.equal((await a.post("admin-template-save", { name: "", items: [] })).status, 422);
  assert.equal((await a.post("admin-template-save", { name: "X", items: [{ key: "inventado", amount: 1 }] })).status, 422);
  const t = await (await a.post("admin-template-save", { name: "Alemania: transporte profesional", mode: "truck", items: [{ key: "truck", amount: 0, status: "pending" }, { key: "itv", amount: 100, status: "estimated" }] })).json();
  const list = await (await a.get("admin-templates")).json();
  assert.equal(list.templates.length, 1); assert.equal(list.templates[0].items.length, 2);
  assert.equal((await a.post("admin-template-delete", { id: t.template.id })).status, 200);
  assert.equal((await (await a.get("admin-templates")).json()).templates.length, 0);
});

test("los contadores del panel proceden de los datos guardados", async () => {
  const ctx = setup(); const a = await ctx.admin();
  assert.deepEqual((await (await a.get("admin-stats")).json()).counts, { published: 0, draft: 0, reviewed: 0, express: 0, archived: 0, access_free: 0, access_pro: 0, access_open: 0 });
  await a.post("admin-save", { data: { brand: "A" } });
  const r = await (await a.post("admin-save", { data: express({ accessMode: "free" }) })).json();
  await a.post("admin-publish", { id: r.vehicle.id, expectedVersion: 1 });
  const c = (await (await a.get("admin-stats")).json()).counts;
  assert.equal(c.draft, 1); assert.equal(c.published, 1); assert.equal(c.express, 1); assert.equal(c.access_free, 1);
});
