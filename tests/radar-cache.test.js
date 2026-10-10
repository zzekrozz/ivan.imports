import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./radar-helpers.js";

const NS = "radar:v1:production:";
const base = { published: true, editorialStatus: "reviewed", listingStatus: "available", brand: "BMW", model: "320d", year: 2020, price: 21500, analysis: { head: "ANALISIS-ABIERTO" } };
const seedOf = (vehicles) => ({ sets: { [`${NS}idx:published`]: vehicles.map((v) => v.id) }, kv: Object.fromEntries(vehicles.flatMap((v) => [[`${NS}vehicle:${v.id}`, JSON.stringify({ ...base, ...v })], [`${NS}slug:${v.slug}`, v.id]])) });
const CLOSE = Date.parse("2026-10-12T00:00:00Z");

test("un análisis PRO abierto nunca se guarda en la CDN ni en el navegador", async () => {
  const ctx = setup({ redisSeed: seedOf([{ id: "o", slug: "bmw-open", accessMode: "pro_open", openUntil: "2026-10-12T00:00:00Z" }, { id: "f", slug: "bmw-free", accessMode: "free" }]), now: () => CLOSE - 60_000 });
  const list = await ctx.call("vehicles");
  assert.match(await list.text(), /ANALISIS-ABIERTO/);
  assert.equal(list.headers.get("cache-control"), "private, no-store");
  const ficha = await ctx.call("vehicle&slug=bmw-open");
  assert.equal(ficha.status, 200);
  assert.equal(ficha.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(ficha.headers.get("cache-control"), /s-maxage|stale-while-revalidate|public/);
});

test("al cerrarse el análisis abierto deja de entregarse en la misma petición siguiente", async () => {
  let clock = CLOSE - 1000;
  const ctx = setup({ redisSeed: seedOf([{ id: "o", slug: "bmw-open", accessMode: "pro_open", openUntil: "2026-10-12T00:00:00Z" }]), now: () => clock });
  assert.equal((await ctx.call("vehicle&slug=bmw-open")).status, 200);
  clock = CLOSE + 1;
  const closed = await ctx.call("vehicle&slug=bmw-open");
  assert.equal(closed.status, 404);
  const list = await ctx.call("vehicles");
  const text = await list.text();
  assert.doesNotMatch(text, /ANALISIS-ABIERTO/);
  assert.equal(JSON.parse(text).locked, 1, "vuelve a contarse como reservada");
});

test("las respuestas sin análisis abiertos mantienen una caché pública corta", async () => {
  const ctx = setup({ redisSeed: seedOf([{ id: "f", slug: "bmw-free", accessMode: "free" }, { id: "s", slug: "bmw-sold", accessMode: "pro_open", listingStatus: "sold" }]) });
  assert.match((await ctx.call("vehicles")).headers.get("cache-control"), /^public, max-age=0, s-maxage=5/);
  assert.match((await ctx.call("vehicles&archive=1")).headers.get("cache-control"), /^public, max-age=0, s-maxage=5/);
  assert.match((await ctx.call("vehicle&slug=bmw-free")).headers.get("cache-control"), /^public/);
  assert.equal((await ctx.call("vehicle&slug=no-existe")).headers.get("cache-control"), "private, no-store");
});
