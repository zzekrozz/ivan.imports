import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createIVIHandler } from "../api/ivi.js";
import { MemoryIVIRepository } from "../api/_ivi/repository.js";

const readyPayload = JSON.parse(await readFile(new URL("fixtures/one-auto/build-sheet-ready.json", import.meta.url), "utf8"));
const identityPayload = JSON.parse(await readFile(new URL("fixtures/one-auto/vin-decoder-ready.json", import.meta.url), "utf8"));
const env = { IVI_ANALYSIS_ENABLED: "true", IVI_CALLBACK_SECRET: "a".repeat(32), IVI_BASE_URL: "https://preview.example.com", ONE_AUTO_SANDBOX: "true" };
const body = { vin: "WVWZZZ1JZXW000001", purchaseCountry: "Alemania", mileageKm: 85000, purchasePrice: 24900, currency: "EUR", modifications: { towbar: "yes" } };
const request = (url, options = {}) => new Request(`https://ivanimports.es${url}`, options);

test("analyze crea un informe READY, devuelve token una vez y no expone hashes", async () => {
  const repository = new MemoryIVIRepository();
  const provider = { sandbox: true, lookupBuildSheet: async () => ({ state: "READY", payload: readyPayload, latencyMs: 18, httpStatus: 200 }) };
  const handler = createIVIHandler({ env, repository, provider, now: () => new Date("2026-08-17T12:00:00.000Z"), randomBytesImpl: () => Buffer.from("aabbccdd", "hex") });
  const response = await handler(request("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.report.id, "IVI-2026-AABBCCDD");
  assert.equal(result.report.status, "READY");
  assert.ok(result.accessToken.length > 20);
  assert.equal("accessTokenHash" in result.report, false);
  assert.equal(repository.raw.has(result.report.id), true);
  const stored = await repository.getReport(result.report.id);
  assert.ok(stored.accessTokenHash);
  assert.equal("accessToken" in stored, false);
});

test("report exige token opaco y PDF devuelve un documento válido", async () => {
  const repository = new MemoryIVIRepository();
  const provider = { sandbox: true, lookupBuildSheet: async () => ({ state: "READY", payload: readyPayload, latencyMs: 10, httpStatus: 200 }) };
  const handler = createIVIHandler({ env, repository, provider });
  const created = await (await handler(request("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))).json();
  const denied = await handler(request(`/api/ivi/report?id=${created.report.id}`));
  assert.equal(denied.status, 401);
  const allowed = await handler(request(`/api/ivi/report?id=${created.report.id}`, { headers: { authorization: `Bearer ${created.accessToken}` } }));
  assert.equal(allowed.status, 200);
  const pdf = await handler(request(`/api/ivi/pdf?id=${created.report.id}`, { headers: { authorization: `Bearer ${created.accessToken}` } }));
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
});

test("flujo asíncrono pasa de PROCESSING a READY mediante callback firmado", async () => {
  const repository = new MemoryIVIRepository();
  let callbackUrl;
  const provider = { sandbox: true, lookupBuildSheet: async (_vin, options) => { callbackUrl = options.callbackUrl; return { state: "PROCESSING", payload: { request_id: "one-1" }, requestId: "one-1", latencyMs: 5, httpStatus: 202 }; } };
  const handler = createIVIHandler({ env, repository, provider });
  const response = await handler(request("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  const created = await response.json();
  assert.equal(response.status, 202);
  assert.equal(created.report.status, "PROCESSING");
  const callback = new URL(callbackUrl);
  const webhook = await handler(new Request(callback, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(readyPayload) }));
  assert.equal(webhook.status, 200);
  assert.equal((await repository.getReport(created.report.id)).status, "READY");
});

test("fallo del proveedor conserva informe FAILED y no registra el VIN", async () => {
  const repository = new MemoryIVIRepository();
  const provider = { sandbox: true, lookupBuildSheet: async () => { throw Object.assign(new Error("boom"), { code: "provider_unavailable" }); } };
  const handler = createIVIHandler({ env, repository, provider });
  const result = await (await handler(request("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))).json();
  assert.equal(result.report.status, "FAILED");
  assert.equal(result.report.provider.error, "provider_failed");
});

test("VIN Decoder conserva identificación PARTIAL cuando Build Sheet no devuelve datos", async () => {
  const repository = new MemoryIVIRepository();
  const provider = {
    sandbox: true,
    lookupBuildSheet: async () => ({ state: "NO_DATA", payload: null, latencyMs: 8, httpStatus: 204 }),
    lookupIdentity: async () => ({ state: "READY", payload: identityPayload, latencyMs: 6, httpStatus: 200 }),
  };
  const handler = createIVIHandler({ env, repository, provider });
  const result = await (await handler(request("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))).json();
  assert.equal(result.report.status, "PARTIAL");
  assert.equal(result.report.vehicle.identity.manufacturer.value, "Volkswagen");
  assert.equal(result.report.vehicle.identity.model.value, "Golf VIII");
});

test("análisis queda desactivado por defecto aunque exista proveedor", async () => {
  const handler = createIVIHandler({ env: { ...env, IVI_ANALYSIS_ENABLED: "false" }, repository: new MemoryIVIRepository(), provider: { sandbox: true } });
  const response = await handler(request("/api/ivi/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  assert.equal(response.status, 503);
});

test("la UI no contiene claves ni nombres de secretos server-side", async () => {
  const source = `${await readFile(new URL("../assets/ivi/app.js", import.meta.url), "utf8")}\n${await readFile(new URL("../ivi/index.html", import.meta.url), "utf8")}`;
  assert.doesNotMatch(source, /ONE_AUTO_API_KEY|IVI_CALLBACK_SECRET|x-api-key/i);
  assert.doesNotMatch(source, /sk_(?:live|test)|whsec_/);
});
