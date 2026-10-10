import test from "node:test";
import assert from "node:assert/strict";
import { fakeRedis, makeGoogle, setup } from "./radar-helpers.js";
import { imagePath } from "../api/_radar/blob.js";
import { radarEnvironment } from "../api/_radar/security.js";

const IMG = "https://abc123.public.blob.vercel-storage.com/radar/preview/vehicles/x/foto.jpg";
const express = { brand: "Audi", model: "A4 Avant", year: 2019, price: 18900, country: "Alemania", originalUrl: "https://suchen.mobile.de/x", images: [{ url: IMG, alt: "" }], firstImpression: "Buen precio para su equipamiento.", editorialStatus: "express", accessMode: "free" };
const shared = () => { const google = makeGoogle(); const redis = fakeRedis(); return { preview: setup({ google, redis, env: { VERCEL_ENV: "preview" } }), production: setup({ google, redis, env: { VERCEL_ENV: "production" } }), redis }; };

test("Preview y Producción comparten Redis sin compartir datos: lo publicado en Preview no aparece en Producción", async () => {
  const { preview, production, redis } = shared();
  const a = await preview.admin();
  const saved = await (await a.post("admin-save", { data: express })).json();
  assert.equal((await a.post("admin-publish", { id: saved.vehicle.id, expectedVersion: 1 })).status, 200);
  assert.equal((await (await preview.call("vehicles")).json()).vehicles.length, 1);
  assert.equal((await (await production.call("vehicles")).json()).vehicles.length, 0, "Producción no ve el vehículo de Preview");
  assert.equal((await production.call(`vehicle&slug=${saved.vehicle.slug}`)).status, 404);
  for (const key of redis.kv.keys()) assert.match(key, /^radar:v1:preview:/);
  for (const key of redis.sets.keys()) assert.match(key, /^radar:v1:preview:/);
});

test("una sesión de administrador de Preview no vale en Producción aunque el secreto sea el mismo", async () => {
  const { preview, production } = shared();
  const a = await preview.admin();
  assert.equal((await preview.call("admin-stats", { cookie: a.cookie })).status, 200);
  assert.equal((await production.call("admin-stats", { cookie: a.cookie })).status, 401);
});

test("el entorno se deriva de VERCEL_ENV y las fotos se guardan en carpetas separadas", () => {
  assert.equal(radarEnvironment("production"), "production");
  assert.equal(radarEnvironment("preview"), "preview");
  for (const value of [undefined, "", "development", "test", "otro"]) assert.equal(radarEnvironment(value), "development");
  assert.equal(imagePath("preview", "abc12345", "jpg"), "radar/preview/vehicles/abc12345/foto.jpg");
  assert.notEqual(imagePath("preview", "abc12345", "jpg"), imagePath("production", "abc12345", "jpg"));
});

test("la subida de fotos usa la carpeta del entorno", async () => {
  const ctx = setup({ env: { VERCEL_ENV: "preview" } });
  const a = await ctx.admin();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), Buffer.alloc(64)]);
  const r = await ctx.handler(new Request("https://ivanimports.es/api/radar?action=admin-image&vehicleId=abc12345", { method: "POST", body: png, headers: { cookie: a.cookie, origin: "https://ivanimports.es", "x-radar-csrf": a.csrf, "content-type": "image/png" } }));
  assert.equal(r.status, 201);
  assert.match(ctx.uploads[0].path, /^radar\/preview\/vehicles\/abc12345\/foto\.png$/);
});
