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
  const seed = { sets: { "radar:v1:idx:published": ["a", "b", "c"] }, kv: {
    "radar:v1:vehicle:a": JSON.stringify(v({ id: "a", accessMode: "free", slug: "a" })),
    "radar:v1:vehicle:b": JSON.stringify(v({ id: "b", accessMode: "pro", analysis: { secret: "SECRETO-PRO" } })),
    "radar:v1:vehicle:c": JSON.stringify(v({ id: "c", published: false, accessMode: "free" })) } };
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
  for (const k of ["analysis", "costs", "comparables", "questions", "risks", "video"]) assert.equal(k in free, false, k);
  assert.equal("note" in free.spainReference, false);
  assert.ok(projectForViewer(item, "pro", NOW).analysis);
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
