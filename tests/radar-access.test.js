import test from "node:test";
import assert from "node:assert/strict";
import { setup, BASE } from "./radar-helpers.js";
import { isActive, lockedCount, projectForViewer, visibleTier } from "../api/_radar/access.js";

const NOW = Date.parse("2026-10-10T12:00:00Z");
const v = (over) => ({ id: "x", published: true, editorialStatus: "express", listingStatus: "available", brand: "BMW", model: "320d", price: 21500, analysis: { why: "privado" }, costs: [{ id: "a", amount: 1 }], comparables: [{}], questions: [{}], risks: [{}], video: { key: "k" }, accessMode: "pro", ...over });

test("nuevo vehículo es PRO por defecto y un borrador nunca es visible", () => {
  assert.equal(visibleTier(v({ accessMode: undefined }), NOW), "pro");
  assert.equal(visibleTier(v({ published: false, accessMode: "free" }), NOW), "hidden");
  assert.equal(projectForViewer(v({ published: false, accessMode: "free" }), "free", NOW), null);
});

test("Gratis básico entrega solo campos básicos; PRO exclusivo no se entrega", () => {
  const basic = projectForViewer(v({ accessMode: "free" }), "free", NOW);
  assert.equal(basic.tier, "basic");
  for (const k of ["analysis", "costs", "comparables", "questions", "risks", "video"]) assert.equal(k in basic, false, k);
  assert.equal(projectForViewer(v(), "free", NOW), null);
});

test("PRO primero, gratis después: la liberación depende de la fecha del servidor", () => {
  const item = v({ accessMode: "delayed", freeReleaseAt: "2026-10-11T12:00:00Z" });
  assert.equal(projectForViewer(item, "free", NOW), null);
  assert.equal(projectForViewer(item, "free", Date.parse("2026-10-11T12:00:01Z")).tier, "basic");
});

test("análisis PRO abierto: ficha completa mientras dure y vuelve a protegerse al cerrar", () => {
  const open = v({ accessMode: "pro_open", openUntil: "2026-10-12T00:00:00Z" });
  const full = projectForViewer(open, "free", NOW);
  assert.equal(full.tier, "open"); assert.ok(full.analysis && full.costs);
  assert.equal(projectForViewer(open, "free", Date.parse("2026-10-12T00:00:01Z")), null);
  assert.equal(projectForViewer(v({ accessMode: "pro_open" }), "free", NOW).tier, "open", "sin fecha = sin cierre");
});

test("el contador de oportunidades reservadas es real y no cuenta archivadas", () => {
  const list = [v({ id: "1" }), v({ id: "2" }), v({ id: "3", listingStatus: "archived" }), v({ id: "6", editorialStatus: "discarded" }), v({ id: "4", accessMode: "free" }), v({ id: "5", published: false })];
  assert.equal(lockedCount(list, "free", NOW), 2);
  assert.equal(lockedCount([], "free", NOW), 0);
});

test("la API pública no filtra datos PRO ni borradores", async () => {
  const seed = { sets: { "radar:v1:production:idx:published": ["a", "b", "c"] }, kv: {
    "radar:v1:production:vehicle:a": JSON.stringify(v({ id: "a", accessMode: "free", slug: "a" })),
    "radar:v1:production:vehicle:b": JSON.stringify(v({ id: "b", accessMode: "pro", analysis: { secret: "SECRETO-PRO" } })),
    "radar:v1:production:vehicle:c": JSON.stringify(v({ id: "c", published: false, accessMode: "free" })) } };
  const ctx = setup({ redisSeed: seed });
  const res = await ctx.call("vehicles");
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(body.vehicles.length, 1); assert.equal(body.vehicles[0].id, "a");
  assert.equal(body.locked, 1);
  assert.doesNotMatch(text, /SECRETO-PRO|"analysis"|"costs"/);
});

test("sin Redis configurado la lista pública responde vacía sin romperse", async () => {
  const ctx = setup({ env: { UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" } });
  const body = await (await ctx.call("vehicles")).json();
  assert.deepEqual(body.vehicles, []); assert.equal(body.configured, false);
});

test("estado editorial y estado del anuncio son independientes: archivados y retirados no son oportunidades activas", () => {
  for (const listingStatus of ["archived", "withdrawn", "sold"]) {
    const item = v({ accessMode: "free", listingStatus });
    assert.equal(isActive(item), false, listingStatus);
    assert.equal(visibleTier(item, NOW), "archive", listingStatus);
    assert.equal(lockedCount([v({ listingStatus })], "free", NOW), 0);
  }
  assert.equal(visibleTier(v({ accessMode: "free", editorialStatus: "discarded" }), NOW), "archive");
  assert.equal(isActive(v({ listingStatus: "pending", accessMode: "free" })), true, "pendiente de confirmar sigue activo");
});

test("el archivo histórico solo entrega datos básicos a Gratis y nunca el análisis, aunque el vehículo fuera PRO abierto", () => {
  const item = v({ accessMode: "pro_open", listingStatus: "archived", spainReference: { min: 1, max: 2, note: "interna" } });
  const free = projectForViewer(item, "free", NOW);
  assert.equal(free.tier, "archive");
  for (const k of ["analysis", "costs", "comparables", "questions", "risks", "video", "costSummary", "spainReference", "firstImpression", "internalNotes"]) assert.equal(k in free, false, k);
  assert.ok(projectForViewer(item, "pro", NOW).analysis);
});

test("archivo histórico: lo que era PRO sigue siendo PRO; lo que era gratuito conserva su resumen básico", () => {
  const extra = { listingStatus: "sold", firstImpression: "Opinión de Iván", spainReference: { value: 25000, min: 24000, max: 26000, note: "interna" }, costSummary: { difference: 3000 }, internalNotes: "PRIVADO" };
  const cases = [["pro", false], ["pro_open", false], ["delayed", false], ["free", true]];
  for (const [accessMode, keeps] of cases) {
    const out = projectForViewer(v({ ...extra, accessMode, freeReleaseAt: "2026-12-01T00:00:00Z" }), "free", NOW);
    assert.equal(out.tier, "archive", accessMode);
    assert.equal(out.brand, "BMW"); assert.equal(out.price, 21500);
    for (const k of ["analysis", "costs", "comparables", "questions", "risks", "video", "costSummary", "internalNotes"]) assert.equal(k in out, false, `${accessMode}: ${k}`);
    assert.equal("firstImpression" in out, keeps, `${accessMode}: firstImpression`);
    assert.equal("spainReference" in out, keeps, `${accessMode}: spainReference`);
    if (keeps) assert.deepEqual(out.spainReference, { min: 24000, max: 26000 }, "sin valor exacto ni nota interna");
  }
  const released = projectForViewer(v({ ...extra, accessMode: "delayed", freeReleaseAt: "2026-10-01T00:00:00Z" }), "free", NOW);
  assert.equal(released.firstImpression, "Opinión de Iván", "diferido ya liberado = gratuito");
  const pro = projectForViewer(v({ ...extra, accessMode: "pro" }), "pro", NOW);
  assert.equal(pro.tier, "archive"); assert.ok(pro.analysis && pro.costSummary); assert.equal(pro.spainReference.note, "interna"); assert.equal("internalNotes" in pro, false);
});

test("la API del archivo no entrega a Gratis datos PRO de vehículos archivados", async () => {
  const seed = { sets: { "radar:v1:production:idx:published": ["p", "f"] }, kv: {
    "radar:v1:production:vehicle:p": JSON.stringify(v({ id: "p", slug: "bmw-p", accessMode: "pro", listingStatus: "sold", firstImpression: "OPINION-PRO", spainReference: { value: 1, min: 77777, max: 88888 }, analysis: { head: "ANALISIS-PRO" } })),
    "radar:v1:production:vehicle:f": JSON.stringify(v({ id: "f", slug: "bmw-f", accessMode: "free", listingStatus: "sold", firstImpression: "OPINION-GRATIS" })) } };
  const ctx = setup({ redisSeed: seed });
  const text = await (await ctx.call("vehicles&archive=1")).text();
  assert.equal(JSON.parse(text).vehicles.length, 2);
  assert.doesNotMatch(text, /OPINION-PRO|ANALISIS-PRO|77777|88888/);
  assert.match(text, /OPINION-GRATIS/);
  const ficha = await (await ctx.call("vehicle&slug=bmw-p")).text();
  assert.doesNotMatch(ficha, /OPINION-PRO|ANALISIS-PRO|77777/);
});

test("un borrador publicado por error jamás se muestra", () => {
  assert.equal(visibleTier(v({ editorialStatus: "draft", accessMode: "free" }), NOW), "hidden");
});

test("las preguntas internas y las notas privadas no salen en la API", () => {
  const item = v({ accessMode: "pro_open", internalNotes: "PRIVADO", questions: [{ id: "1", q: "¿Pública?", status: "p", public: true, internalNote: "SECRETO" }, { id: "2", q: "¿Interna?", status: "p", public: false }] });
  const out = JSON.stringify(projectForViewer(item, "free", NOW));
  assert.doesNotMatch(out, /PRIVADO|SECRETO|Interna/);
  assert.match(out, /Pública/);
});
